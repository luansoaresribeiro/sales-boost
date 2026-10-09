import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { advanceTour, clipPrompt, estimateUsd, hfHeaders, SECONDS, submitAll, VIDEO_BUCKET, type ClipKind, type TourRow } from '../_shared/tourEngine.ts'
import { draftReply, type DmReplyConfig } from '../_shared/dmReply.ts'

// Vídeos curtos de um imóvel do catálogo (plano pago — decisões do dono
// 2026-10-09, docs/DECISIONS.md). O vídeo é ISCA: 1 cômodo ('room'), 2 cômodos
// vizinhos ('pair', caminhada de uma foto até a outra) ou a abertura de fora
// mostrando a vista ('opening'). O corretor escolhe as fotos. Nunca o imóvel
// inteiro. Teto de custo por cliente: US$ 40/mês (regra 7).
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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MONTHLY_CAP_USD = Number(Deno.env.get('VIDEO_MONTHLY_CAP_USD') ?? '40') || 40
const KINDS: ClipKind[] = ['room', 'pair', 'opening']
const IG_TEXT_MAX = 1000 // limite de texto de mensagem do Instagram

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function monthSpent(admin: Admin, companyId: string): Promise<number> {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const { data } = await admin.from('video_tours').select('cost_usd').eq('company_id', companyId).eq('kind', 'plan').gte('created_at', monthStart)
  return (data ?? []).reduce((s: number, r: { cost_usd: number | string }) => s + Number(r.cost_usd || 0), 0)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: company } = await admin.from('companies').select('id, plan, vertical_key').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const body = await req.json().catch(() => ({})) as { action?: string; item_id?: string; video_id?: string; kind?: string; photos?: unknown; label?: string; message?: string; active?: boolean }
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
        monthSpent(admin, company.id),
      ])
      const draft = draftReply(((pb?.config ?? {}) as { dm_reply?: DmReplyConfig }).dm_reply, item.meta?.fields ?? {})
      return json({
        videos: (vids ?? []).map((v: { id: string; status: string; plan: { kind: string; label?: string }; video_path: string | null; created_at: string }) => ({
          id: v.id, status: v.status, kind: v.plan?.kind, label: v.plan?.label ?? '', created_at: v.created_at,
          video_url: v.status === 'completed' && v.video_path ? publicVideo(v.video_path) : null,
        })),
        reply: auto ? { keyword: (auto.keywords ?? [draft.keyword])[0], message: auto.message, active: auto.active, saved: true } : { ...draft, active: false, saved: false },
        month_spent_usd: spent, month_cap_usd: MONTHLY_CAP_USD,
        cost_usd: Object.fromEntries(KINDS.map(k => [k, estimateUsd(k)])),
      })
    }

    if (body.action === 'create') {
      if (!company.plan || company.plan === 'free') return json({ error: 'Os vídeos do imóvel fazem parte do plano.' }, 403)
      const item = await loadItem(body.item_id)
      if (!item) return json({ error: 'Imóvel não encontrado.' }, 404)
      const kind = body.kind as ClipKind
      if (!KINDS.includes(kind)) return json({ error: 'Tipo de vídeo inválido.' }, 400)
      const photos = Array.isArray(body.photos) ? body.photos.map(String) : []
      const itemPhotos = new Set((item.meta?.photos ?? []).map(p => p.url))
      if (photos.length !== (kind === 'pair' ? 2 : 1) || photos.some(p => !itemPhotos.has(p)) || photos[0] === photos[1]) {
        return json({ error: kind === 'pair' ? 'Escolha 2 fotos diferentes deste imóvel.' : 'Escolha 1 foto deste imóvel.' }, 400)
      }
      const estimate = estimateUsd(kind)
      const spent = await monthSpent(admin, company.id)
      if (spent + estimate > MONTHLY_CAP_USD) {
        return json({ error: `O limite de vídeos do mês (US$ ${MONTHLY_CAP_USD.toFixed(0)}) foi atingido. Volta no próximo mês.`, status: 'cap_reached' }, 429)
      }
      const headers = hfHeaders()
      if (!headers) return json({ error: 'Geração de vídeo indisponível no momento.' }, 503)
      const clips = await submitAll(headers, await clipPrompt(admin, company.vertical_key, kind), photos, [kind === 'pair' ? { from: 0, to: 1 } : { from: 0 }], SECONDS[kind])
      if (!clips[0].job_ref) return json({ error: 'Não consegui iniciar o vídeo agora. Tente de novo em alguns minutos.' }, 502)
      const label = String(body.label ?? '').trim().slice(0, 80)
      const { data: v, error } = await admin.from('video_tours')
        .insert({ company_id: company.id, kind: 'plan', item_id: item.id, status: 'generating', photos, clips, plan: { kind, label }, cost_usd: estimate })
        .select('id').single()
      if (error) return json({ error: error.message }, 500)
      console.log('[item-videos] vídeo iniciado', company.id, v.id, kind, estimate.toFixed(2), 'USD')
      return json({ status: 'processing', video_id: v.id })
    }

    if (body.action === 'status') {
      if (typeof body.video_id !== 'string') return json({ error: 'video_id obrigatório' }, 400)
      const { data: v } = await admin.from('video_tours').select('id, status, plan, photos, clips, video_path, assembly, updated_at')
        .eq('id', body.video_id).eq('company_id', company.id).eq('kind', 'plan').maybeSingle()
      if (!v) return json({ error: 'Vídeo não encontrado.' }, 404)
      if (v.status === 'completed' && v.video_path) return json({ status: 'completed', video_url: publicVideo(v.video_path) })
      if (v.status === 'failed') return json({ status: 'failed' })
      const headers = hfHeaders()
      if (!headers) return json({ status: 'processing' })
      const kind = (v.plan?.kind ?? 'room') as ClipKind
      const r = await advanceTour(admin, supabaseUrl, serviceKey, headers, await clipPrompt(admin, company.vertical_key, kind), v as TourRow,
        () => [{ path: `plan/${company.id}/${v.id}.mp4`, from: 0, to: 1 }], SECONDS[kind])
      if (r.status === 'completed') return json({ status: 'completed', video_url: publicVideo(r.outputs[0].path) })
      if (r.status === 'failed') {
        // Não cobra no teto o que não foi entregue (a Higgsfield devolve crédito de trecho que falha).
        await admin.from('video_tours').update({ cost_usd: 0 }).eq('id', v.id)
        return json({ status: 'failed' })
      }
      return json({ status: 'processing' })
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
