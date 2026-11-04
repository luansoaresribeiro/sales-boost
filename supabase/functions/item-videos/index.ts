import { fetchItemCfg, ownerBlockMessage } from '../_shared/itemService.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requirePaidAccess } from '../_shared/access.ts'
import { advanceTour, clipPrompt, estimateUsd, hfHeaders, SECONDS, studioReady, submitAll, VIDEO_BUCKET, type ClipKind, type TourRow } from '../_shared/tourEngine.ts'
import { validEndcardUrl } from '../_shared/tourPick.ts'
import { draftReply, type DmReplyConfig } from '../_shared/dmReply.ts'
import { keepQueroNotice } from '../_shared/videoCta.ts'
import { capMessage, fitsCap, monthSpend } from '../_shared/spendCap.ts'
import { withDmLink } from '../_shared/publicPageRun.ts'
import { lng } from '../_shared/publicPage.ts'

// Vídeos curtos de um imóvel do catálogo (plano pago — decisões do dono
// 2026-10-09, docs/DECISIONS.md). O vídeo é ISCA: 1 cômodo ('room'), 2 cômodos
// vizinhos ('pair', caminhada de uma foto até a outra) ou a abertura de fora
// mostrando a vista ('opening'). O corretor escolhe as fotos. Nunca o imóvel
// inteiro. Teto de custo por cliente: US$ 40/mês, ÚNICO pra tudo que é pago
// por peça (regra 7, _shared/spendCap.ts).
//
// Junto, a resposta do "Comente QUERO" (opção B do dono): o corretor aprova
// UMA VEZ a mensagem (modelo da ficha + dados cadastrados) e ela vai na DM de
// quem comentar QUERO em qualquer post deste imóvel (instagram-webhook,
// engagement_automations.item_id).
//
// actions:
//  - list {item_id}: vídeos do imóvel, gasto do mês, resposta do QUERO (salva ou rascunho)
//  - create {item_id, kind, photos[], label?}: confere teto e manda o trecho pra Higgsfield
//  - status {video_id}: avança geração/gravação; no fim devolve a URL
//  - save_reply {item_id, message, active}: aprova/desliga a resposta automática
// Caminho do cron (cron_secret no corpo, decisão do dono 2026-10-14: mínimo de
// 3 vídeos/semana criados sozinhos pelo calendário):
//  - create {company_id, item_id, kind, photos[], piece_id}: igual ao do dono,
//    e liga o vídeo à peça do calendário (plan.piece_id);
//  - tick: avança os vídeos em andamento (sem ninguém com a tela aberta) e,
//    quando fica pronto, põe o vídeo na peça do calendário.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const KINDS: ClipKind[] = ['room', 'pair', 'opening']
const WAITING_STUDIO = 'Aguardando estúdio: os trechos do vídeo estão prontos, mas o servidor de vídeo está fora do ar. O vídeo (9:16, com encerramento) é montado sozinho assim que ele voltar — nada sai antes disso.'
const IG_TEXT_MAX = 1000 // limite de texto de mensagem do Instagram

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any
interface PlanVideo { id: string; company_id: string; status: string; plan: { kind?: string; label?: string; piece_id?: string; endcard_url?: string; endcard_seconds?: number } | null; photos: string[]; clips: unknown; video_path: string | null; assembly: unknown; updated_at: string }

// Avança 1 vídeo (Higgsfield → gravação). Pronto: põe na peça do calendário
// ligada (plan.piece_id). Falhou: não conta no teto e a peça diz o motivo.
async function advanceVideo(admin: Admin, supabaseUrl: string, serviceKey: string, verticalKey: string | null, v: PlanVideo): Promise<'completed' | 'failed' | 'processing'> {
  const publicVideo = (path: string) => admin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl
  const pieceId = v.plan?.piece_id
  const finish = async (path: string) => {
    if (pieceId) {
      const url = publicVideo(path)
      // Só o aviso do "QUERO sem resposta aprovada" sobrevive; o resto do reasoning era "vídeo sendo feito".
      const { data: cur } = await admin.from('marketing_ai_test_content').select('reasoning').eq('id', pieceId).eq('company_id', v.company_id).maybeSingle()
      await admin.from('marketing_ai_test_content').update({ video_url: url, media: [{ url, type: 'video' }], reasoning: keepQueroNotice(cur?.reasoning as string | null) }).eq('id', pieceId).eq('company_id', v.company_id)
    }
    return 'completed' as const
  }
  if (v.status === 'completed' && v.video_path) return await finish(v.video_path)
  if (v.status === 'failed') return 'failed'
  const headers = hfHeaders()
  if (!headers) return 'processing'
  const kind = (v.plan?.kind ?? 'room') as ClipKind
  // Tour do calendário com encerramento de marca: só sai pelo estúdio (9:16 + encerramento).
  const endcard = v.plan?.endcard_url ? { url: v.plan.endcard_url, seconds: Number(v.plan.endcard_seconds) || 2.5 } : null
  const r = await advanceTour(admin, supabaseUrl, serviceKey, headers, await clipPrompt(admin, verticalKey, kind), v as unknown as TourRow,
    () => [{ path: `plan/${v.company_id}/${v.id}.mp4`, from: 0, to: 1 }], SECONDS[kind], endcard)
  if (r.status === 'completed') return await finish(r.outputs[0].path)
  if (r.status === 'failed') {
    const studio = r.reason === 'studio'
    // Não cobra no teto o que não foi entregue (a Higgsfield devolve crédito de trecho que falha).
    // Falha do estúdio é diferente: os trechos já foram gerados e pagos — o custo fica.
    if (!studio) await admin.from('video_tours').update({ cost_usd: 0 }).eq('id', v.id)
    if (pieceId) {
      const { data: cur } = await admin.from('marketing_ai_test_content').select('reasoning').eq('id', pieceId).eq('company_id', v.company_id).maybeSingle()
      const notice = keepQueroNotice(cur?.reasoning as string | null)
      const msg = studio ? 'O vídeo não saiu: o estúdio de vídeo (servidor) não conseguiu montar. Os trechos já foram gerados e cobrados; fale com o suporte.' : 'O vídeo não saiu: a Higgsfield recusou (costuma ser falta de crédito). Nada foi cobrado.'
      await admin.from('marketing_ai_test_content').update({ reasoning: `${msg}${notice ? ` ${notice}` : ''}` }).eq('id', pieceId).eq('company_id', v.company_id)
    }
    return 'failed'
  }
  if (r.status === 'processing' && r.waiting === 'studio' && pieceId) {
    // "Aguardando estúdio": o vídeo está pronto pra montar, mas o servidor está fora do ar. Avisa na peça (uma vez).
    const { data: cur } = await admin.from('marketing_ai_test_content').select('reasoning').eq('id', pieceId).eq('company_id', v.company_id).maybeSingle()
    if (!String(cur?.reasoning ?? '').startsWith(WAITING_STUDIO)) {
      const notice = keepQueroNotice(cur?.reasoning as string | null)
      await admin.from('marketing_ai_test_content').update({ reasoning: `${WAITING_STUDIO}${notice ? ` ${notice}` : ''}` }).eq('id', pieceId).eq('company_id', v.company_id)
    }
  }
  return 'processing'
}

type CreateResult = { ok: true; video_id: string } | { ok: false; status: number; error: string; cap?: boolean; paid?: boolean }
// Confere o teto, manda os trechos pra Higgsfield (é aqui que gasta) e grava o vídeo. Quem chama já validou fotos e encerramento.
async function createPlanVideo(admin: Admin, company: { id: string; vertical_key: string | null }, itemId: string, kind: ClipKind, photos: string[], label: string,
  pieceId: string | undefined, endcard: { url: string; seconds: number } | null): Promise<CreateResult> {
  const estimate = estimateUsd(kind)
  const cap = await fitsCap(admin, company.id, estimate)
  if (!cap.ok) return { ok: false, status: 429, error: capMessage(cap.spend.cap_usd), cap: true }
  const headers = hfHeaders()
  if (!headers) return { ok: false, status: 503, error: 'Geração de vídeo indisponível no momento.' }
  const clips = await submitAll(headers, await clipPrompt(admin, company.vertical_key, kind), photos, [kind === 'pair' ? { from: 0, to: 1 } : { from: 0 }], SECONDS[kind])
  if (!clips[0].job_ref) return { ok: false, status: 502, error: 'Não consegui iniciar o vídeo agora. Tente de novo em alguns minutos.' }
  const { data: v, error } = await admin.from('video_tours')
    .insert({ company_id: company.id, kind: 'plan', item_id: itemId, status: 'generating', photos, clips, plan: { kind, label, ...(pieceId ? { piece_id: pieceId } : {}), ...(endcard ? { endcard_url: endcard.url, endcard_seconds: endcard.seconds } : {}) }, cost_usd: estimate })
    .select('id').single()
  if (error) return { ok: false, status: 500, error: error.message, paid: true } // trechos já mandados (pagos) e o registro falhou
  console.log('[item-videos] vídeo iniciado', company.id, v.id, kind, estimate.toFixed(2), 'USD')
  return { ok: true, video_id: v.id }
}

const PENDING_MAX_MS = 48 * 3_600_000
const PENDING_MAX_ATTEMPTS = 3
const PAYABLE_PIECE_STATUS = ['idea', 'draft', 'vault'] // peça publicada/rejeitada/em publicação não gera mais vídeo
interface PendingTour { item_id: string; kind: ClipKind; photos: string[]; endcard_url: string; endcard_seconds: number; since: string; attempts?: number }

// Peças do calendário que esperam o estúdio ANTES de gastar (concept.tour_pending): com o estúdio de volta, paga os trechos e segue.
// Ordem: a mais antiga primeiro. O pedido é RESERVADO antes de pagar (update condicional: só quem tirou o pedido paga — dois ticks
// ao mesmo tempo não pagam duas vezes). Pagamento que falhou sem gerar vídeo devolve o pedido (3 tentativas, depois "não feita");
// vídeo pago mas não registrado NUNCA volta pra fila (registra o erro na peça).
async function resumePending(admin: Admin, supabaseUrl: string, deadline: number): Promise<number> {
  const { data: rows } = await admin.from('marketing_ai_test_content').select('id, company_id, status, reasoning, concept').not('concept->tour_pending', 'is', null)
    .order('created_at', { ascending: true }).limit(5)
  const list = (rows ?? []) as { id: string; company_id: string; status: string; reasoning: string | null; concept: { tour_pending?: PendingTour } | null }[]
  if (!list.length) return 0
  const ready = await studioReady(admin)
  let started = 0
  for (const piece of list) {
    if (Date.now() > deadline) break
    const pend = piece.concept?.tour_pending
    const notice = keepQueroNotice(piece.reasoning)
    const withN = (m: string) => `${m}${notice ? ` ${notice}` : ''}`
    const setPiece = (reasoning: string, clear: boolean) => admin.from('marketing_ai_test_content').update({ reasoning, ...(clear ? { concept: null } : {}) }).eq('id', piece.id).eq('company_id', piece.company_id)
    if (!pend || !validEndcardUrl(pend.endcard_url, supabaseUrl) || !KINDS.includes(pend.kind)) { await setPiece(withN('O vídeo não foi feito (pedido inválido). Nada foi cobrado.'), true); continue }
    if (!PAYABLE_PIECE_STATUS.includes(piece.status)) { await admin.from('marketing_ai_test_content').update({ concept: null }).eq('id', piece.id).eq('company_id', piece.company_id); continue }
    if (Date.now() - Date.parse(pend.since) > PENDING_MAX_MS) { await setPiece(withN('O vídeo não foi feito: o servidor de vídeo ficou fora do ar por mais de 48 h. Nada foi cobrado.'), true); continue }
    if (!ready) continue
    try {
      const { data: company } = await admin.from('companies').select('id, plan, vertical_key').eq('id', piece.company_id).maybeSingle()
      if (!company || await requirePaidAccess(admin, company.id)) { await setPiece(withN('O vídeo não foi feito: a conta não tem plano ativo. Nada foi cobrado.'), true); continue }
      const { data: item } = await admin.from('marketing_ai_knowledge').select('id, meta').eq('id', pend.item_id).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
      const have = new Set(((item?.meta?.photos ?? []) as { url: string }[]).map(p => p.url))
      const blockedMsg = item ? ownerBlockMessage(item as never, { ...(await fetchItemCfg(admin, company.vertical_key)), minPhotos: 0 }) : null
      if (blockedMsg) { await setPiece(withN(`O vídeo não foi feito: ${blockedMsg} Nada foi cobrado.`), true); continue }
      if (!item || pend.photos.some(u => !have.has(u))) { await setPiece(withN('O vídeo não foi feito: as fotos do imóvel mudaram. Nada foi cobrado.'), true); continue }
      // Reserva ANTES de pagar: só segue quem conseguiu tirar o pedido da peça (e a peça ainda existe).
      const { data: claim } = await admin.from('marketing_ai_test_content').update({ concept: null })
        .eq('id', piece.id).eq('company_id', piece.company_id).in('status', PAYABLE_PIECE_STATUS).not('concept->tour_pending', 'is', null).select('id').maybeSingle()
      if (!claim) continue
      const attempts = (pend.attempts ?? 0) + 1
      let r: CreateResult
      try { r = await createPlanVideo(admin, company, item.id, pend.kind, pend.photos, 'Calendário', piece.id, { url: pend.endcard_url, seconds: pend.endcard_seconds }) }
      catch (e) { r = { ok: false, status: 500, error: String(e).slice(0, 160) }; console.error('[item-videos] retomada: pagamento lançou erro', piece.id, r.error) }
      if (r.ok) { await setPiece(withN('Vídeo sendo feito na Higgsfield a partir de foto real — aparece aqui em alguns minutos.'), false); started++ }
      else if (r.paid) await setPiece(withN('O vídeo foi pago na Higgsfield, mas não consegui registrá-lo aqui. Não vou tentar de novo sozinho (evita cobrar duas vezes) — fale com o suporte.'), false)
      else if (r.cap) await setPiece(withN(`O vídeo não foi feito: ${r.error}. Nada foi cobrado.`), false)
      else if (attempts >= PENDING_MAX_ATTEMPTS) await setPiece(withN('O vídeo não foi feito: a Higgsfield não aceitou o pedido depois de 3 tentativas. Nada foi cobrado.'), false)
      else await admin.from('marketing_ai_test_content').update({ concept: { tour_pending: { ...pend, attempts } } }).eq('id', piece.id).eq('company_id', piece.company_id) // devolve o pedido
    } catch (e) { console.error('[item-videos] retomada falhou', piece.id, String(e).slice(0, 200)) }
  }
  return started
}

const VIDEO_SELECT ='id, company_id, status, plan, photos, clips, video_path, assembly, updated_at'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as { action?: string; item_id?: string; video_id?: string; kind?: string; photos?: unknown; label?: string; message?: string; active?: boolean; cron_secret?: string; company_id?: string; piece_id?: string; endcard_url?: string; endcard_seconds?: number }
    const cronSecret = Deno.env.get('CRON_SECRET')
    const isCron = !!cronSecret && body.cron_secret === cronSecret

    // Cron: avança os vídeos em andamento de todas as empresas (até ~100 s).
    if (isCron && body.action === 'tick') {
      const { data: rows } = await admin.from('video_tours').select(`${VIDEO_SELECT}, companies(vertical_key)`)
        .eq('kind', 'plan').in('status', ['generating', 'assembling']).not('plan->>kind', 'is', null)
        .order('updated_at', { ascending: true }).limit(10)
      const deadline = Date.now() + 100_000
      const result: Record<string, number> = { completed: 0, failed: 0, processing: 0 }
      for (const row of (rows ?? []) as (PlanVideo & { companies: { vertical_key: string | null } | null })[]) {
        if (Date.now() > deadline) break
        try { result[await advanceVideo(admin, supabaseUrl, serviceKey, row.companies?.vertical_key ?? null, row)]++ }
        catch (e) { console.error('[item-videos] tick falhou', row.id, String(e)) }
      }
      // Vídeo montado pela VPS: o vps-worker marca o tour 'completed' direto, então ele não entra na busca de cima e a peça
      // do calendário ficava com a foto pra sempre (Teste Zero, 2026-11-03). Aqui: tours prontos dos últimos 3 dias cuja
      // peça ainda está sem vídeo → põe o vídeo na peça (advanceVideo com status 'completed' só faz isso).
      let attached = 0
      try {
        const since = new Date(Date.now() - 3 * 86400_000).toISOString()
        const { data: done } = await admin.from('video_tours').select(`${VIDEO_SELECT}, companies(vertical_key)`)
          .eq('kind', 'plan').eq('status', 'completed').not('video_path', 'is', null).not('plan->>piece_id', 'is', null)
          .gte('updated_at', since).order('updated_at', { ascending: false }).limit(30)
        const list = (done ?? []) as (PlanVideo & { companies: { vertical_key: string | null } | null })[]
        const ids = [...new Set(list.map(v => v.plan?.piece_id).filter((x): x is string => !!x))]
        if (ids.length) {
          const { data: bare } = await admin.from('marketing_ai_test_content').select('id').in('id', ids).is('video_url', null)
          const need = new Set(((bare ?? []) as { id: string }[]).map(r => r.id))
          for (const v of list) {
            if (Date.now() > deadline) break
            if (!v.plan?.piece_id || !need.has(v.plan.piece_id)) continue
            need.delete(v.plan.piece_id)
            try { await advanceVideo(admin, supabaseUrl, serviceKey, v.companies?.vertical_key ?? null, v); attached++ }
            catch (e) { console.error('[item-videos] ligar vídeo pronto à peça falhou', v.id, String(e)) }
          }
        }
      } catch (e) { console.error('[item-videos] busca de vídeos prontos sem peça falhou', String(e).slice(0, 200)) }
      let resumed = 0
      try { resumed = await resumePending(admin, supabaseUrl, deadline) } catch (e) { console.error('[item-videos] resumePending falhou', String(e).slice(0, 200)) }
      return json({ ok: true, seen: (rows ?? []).length, ...result, attached, resumed })
    }

    let company: { id: string; plan: string | null; manual_access?: boolean | null; vertical_key: string | null; language?: string | null } | null = null
    if (isCron && body.action === 'create' && typeof body.company_id === 'string') {
      const { data } = await admin.from('companies').select('id, plan, manual_access, vertical_key, language').eq('id', body.company_id).maybeSingle()
      company = data
    } else {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data } = await admin.from('companies').select('id, plan, manual_access, vertical_key, language').eq('user_id', user.id).maybeSingle()
      company = data
    }
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const publicVideo = (path: string) => admin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl

    const loadItem = async (id: unknown) => {
      if (typeof id !== 'string') return null
      const { data } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', id).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
      return data as { id: string; title: string; meta: { photos?: { url: string }[]; fields?: Record<string, unknown> } | null } | null
    }

    if (body.action === 'list') {
      const item = await loadItem(body.item_id)
      if (!item) return json({ error: 'Imóvel não encontrado.' }, 404)
      const [{ data: vids }, { data: auto }, { data: pb }, spent] = await Promise.all([
        admin.from('video_tours').select('id, status, plan, video_path, created_at').eq('company_id', company.id).eq('kind', 'plan').eq('item_id', item.id)
          .not('plan->>kind', 'is', null).order('created_at', { ascending: false }).limit(30),
        admin.from('engagement_automations').select('id, keywords, message, active').eq('company_id', company.id).eq('item_id', item.id).maybeSingle(),
        company.vertical_key ? admin.from('vertical_playbooks').select('config').eq('key', company.vertical_key).eq('enabled', true).maybeSingle() : Promise.resolve({ data: null }),
        monthSpend(admin, company.id),
      ])
      const draft = draftReply(((pb?.config ?? {}) as { dm_reply?: DmReplyConfig }).dm_reply, item.meta?.fields ?? {})
      // Etapa 5: SÓ a mensagem NOVA (rascunho ainda não aprovada) ganha o link da página pública, se o imóvel tem uma no ar.
      // A já aprovada (`auto`) fica exatamente como o dono aprovou.
      if (!auto) draft.message = await withDmLink(admin, company.id, item.id, lng(company.language), (pb?.config as { public_page?: unknown } | null)?.public_page, draft.message)
      return json({
        videos: (vids ?? []).map((v: { id: string; status: string; plan: { kind: string; label?: string }; video_path: string | null; created_at: string }) => ({
          id: v.id, status: v.status, kind: v.plan?.kind, label: v.plan?.label ?? '', created_at: v.created_at,
          video_url: v.status === 'completed' && v.video_path ? publicVideo(v.video_path) : null,
        })),
        reply: auto ? { keyword: (auto.keywords ?? [draft.keyword])[0], message: auto.message, active: auto.active, saved: true } : { ...draft, active: false, saved: false },
        month_spent_usd: spent.total_usd, month_cap_usd: spent.cap_usd,
        cost_usd: Object.fromEntries(KINDS.map(k => [k, estimateUsd(k)])),
      })
    }

    if (body.action === 'create') {
      const noPlan = await requirePaidAccess(admin, company.id)
      if (noPlan) return noPlan
      // Acesso liberado à mão (manual_access) conta como plano — mesma regra do hasPaidAccess. Antes, empresa liberada à mão
      // ficava com tudo menos o vídeo: o calendário planejava o tour e ele caía pra foto (Teste Zero, 2026-11-03).
      if ((!company.plan || company.plan === 'free') && company.manual_access !== true) return json({ error: 'Os vídeos do imóvel fazem parte do plano.' }, 403)
      const item = await loadItem(body.item_id)
      if (!item) return json({ error: 'Imóvel não encontrado.' }, 404)
      // Fase 4: imóvel indisponível = 400 ANTES de qualquer gasto na Higgsfield.
      const blockMsg = ownerBlockMessage(item, await fetchItemCfg(admin, company.vertical_key))
      if (blockMsg && !/fotos reais/.test(blockMsg)) return json({ error: blockMsg, code: 'item_unavailable' }, 400)
      const kind = body.kind as ClipKind
      if (!KINDS.includes(kind)) return json({ error: 'Tipo de vídeo inválido.' }, 400)
      const photos = Array.isArray(body.photos) ? body.photos.map(String) : []
      const itemPhotos = new Set((item.meta?.photos ?? []).map(p => p.url))
      if (photos.length !== (kind === 'pair' ? 2 : 1) || photos.some(p => !itemPhotos.has(p)) || photos[0] === photos[1]) {
        return json({ error: kind === 'pair' ? 'Escolha 2 fotos diferentes deste imóvel.' : 'Escolha 1 foto deste imóvel.' }, 400)
      }
      // Encerramento de marca (só no caminho do cron): imagem 1080×1920 feita por código no nosso Storage, nunca por IA.
      // Validado ANTES de qualquer gasto: o calendário exige encerramento válido (sem ele o vídeo sairia 4:5 pela colagem antiga).
      let endcard: { url: string; seconds: number } | null = null
      if (isCron) {
        if (!validEndcardUrl(body.endcard_url, supabaseUrl)) return json({ error: 'Encerramento da marca ausente ou inválido — o vídeo do calendário não é feito sem ele.' }, 400)
        endcard = { url: body.endcard_url, seconds: Math.min(6, Math.max(1, Number(body.endcard_seconds) || 2.5)) }
      }
      // Peça do calendário (só no caminho do cron, e só se for desta empresa).
      let pieceId: string | undefined
      if (isCron && typeof body.piece_id === 'string') {
        const { data: piece } = await admin.from('marketing_ai_test_content').select('id').eq('id', body.piece_id).eq('company_id', company.id).maybeSingle()
        pieceId = piece?.id
      }
      const r = await createPlanVideo(admin, company, item.id, kind, photos, String(body.label ?? '').trim().slice(0, 80), pieceId, endcard)
      if (!r.ok) return json({ error: r.error, ...(r.cap ? { status: 'cap_reached' } : {}) }, r.status)
      return json({ status: 'processing', video_id: r.video_id })
    }

    if (body.action === 'status') {
      if (typeof body.video_id !== 'string') return json({ error: 'video_id obrigatório' }, 400)
      const { data: v } = await admin.from('video_tours').select(VIDEO_SELECT)
        .eq('id', body.video_id).eq('company_id', company.id).eq('kind', 'plan').maybeSingle()
      if (!v) return json({ error: 'Vídeo não encontrado.' }, 404)
      const st = await advanceVideo(admin, supabaseUrl, serviceKey, company.vertical_key, v as PlanVideo)
      if (st === 'completed') {
        const { data: done } = await admin.from('video_tours').select('video_path').eq('id', v.id).maybeSingle()
        return json({ status: 'completed', video_url: done?.video_path ? publicVideo(done.video_path) : null })
      }
      return json({ status: st })
    }

    if (body.action === 'save_reply') {
      const item = await loadItem(body.item_id)
      if (!item) return json({ error: 'Imóvel não encontrado.' }, 404)
      const message = String(body.message ?? '').trim()
      const active = body.active === true
      if (active && !message) return json({ error: 'Escreva a mensagem antes de ligar.' }, 400)
      if (message.length > IG_TEXT_MAX) return json({ error: `A mensagem passa de ${IG_TEXT_MAX} caracteres.` }, 400)
      const { data: pb } = company.vertical_key
        ? await admin.from('vertical_playbooks').select('config').eq('key', company.vertical_key).eq('enabled', true).maybeSingle()
        : { data: null }
      const keyword = draftReply(((pb?.config ?? {}) as { dm_reply?: DmReplyConfig }).dm_reply, {}).keyword
      const row = {
        company_id: company.id, item_id: item.id, name: `${keyword} — ${item.title}`.slice(0, 120), active,
        trigger_type: 'ig_comment', intent_type: 'keyword', keywords: [keyword], media_ref: null,
        action_type: 'send_dm', message, create_lead: true,
        // Aprovado uma vez pelo dono (opção B): o envio de cada DM é automático.
        execution_mode: 'automatic', allowed_auto_actions: ['send_dm'], updated_at: new Date().toISOString(),
      }
      const { data: existing } = await admin.from('engagement_automations').select('id').eq('company_id', company.id).eq('item_id', item.id).maybeSingle()
      const { error } = existing
        ? await admin.from('engagement_automations').update(row).eq('id', existing.id)
        : await admin.from('engagement_automations').insert(row)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, reply: { keyword, message, active, saved: true } })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (err) {
    console.error('item-videos error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
