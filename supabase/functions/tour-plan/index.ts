import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { analysisCostUsd, buildAnalysisBody, buildPlan, linksFor, type Analysis, type PlanStep, type TourFicha, type TourPlan } from '../_shared/tourPlan.ts'
import { advanceTour, COST_PER_SECOND, DEFAULT_WALK_PROMPT, hfHeaders, planCuts, submitAll, VIDEO_BUCKET, walkClips, WALK_SECONDS, type TourRow } from '../_shared/tourEngine.ts'

// Tour do plano pago (decisões do dono 2026-10-09, docs/DECISIONS.md e
// docs/MEDIA-ENGINE.md): 1 tour completo em caminhada por imóvel do catálogo.
// Fluxo: analyze (IA olha todas as fotos e propõe a ordem) → o corretor vê,
// troca/tira e aprova (save_order) → generate (gera as passagens) → status.
// Teto de custo por cliente: US$ 40/mês somando análise + geração (regra 7).
//
// actions:
//  - analyze {item_id}: cria o tour em 'analyzing' e roda a análise em segundo plano
//  - get {item_id}: último tour do imóvel (plano, ligações, custo, status)
//  - save_order {tour_id, steps}: grava a ordem do corretor (só ambientes já analisados)
//  - generate {tour_id}: confere o teto do mês e manda as passagens pra Higgsfield
//  - status {tour_id}: avança geração/colagem; no fim devolve o vídeo e os recortes

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MONTHLY_CAP_USD = Number(Deno.env.get('TOUR_MONTHLY_CAP_USD') ?? '40') || 40
const MIN_PHOTOS = 6
const MAX_PHOTOS = 80 // a API aceita até 100 imagens por pedido; folga pro texto

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

async function loadFicha(admin: Admin, verticalKey: string | null): Promise<TourFicha & { walk_prompt?: string; cut_seconds?: [number, number] }> {
  if (!verticalKey) return {}
  const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
  return ((data?.config ?? {}) as { tour?: TourFicha }).tour ?? {}
}

// Custo estimado da geração: passagens × segundos × preço por segundo.
const estimateUsd = (steps: number) => Math.max(0, steps - 1) * WALK_SECONDS * COST_PER_SECOND

async function runAnalysis(admin: Admin, tourId: string, photos: string[], ficha: TourFicha) {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  let cost = 0 // análise que falha depois da resposta também é cobrada — entra no teto
  try {
    if (!key) throw new Error('ANTHROPIC_API_KEY não configurada')
    const started = Date.now()
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(buildAnalysisBody(photos, ficha)),
    })
    const data = await res.json().catch(() => ({}))
    cost = analysisCostUsd(data.usage)
    if (!res.ok) throw new Error(`Claude ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 200)}`)
    if (data.stop_reason !== 'end_turn') throw new Error(`análise incompleta (${data.stop_reason})`)
    const text = (data.content ?? []).find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const analysis = JSON.parse(text) as Analysis
    const plan = buildPlan(analysis, photos)
    if (plan.steps.length < 2) throw new Error('a análise não achou ambientes suficientes')
    await admin.from('video_tours').update({
      status: 'awaiting_approval', cost_usd: cost, photos: plan.steps.map(s => s.photo),
      plan: { ...plan, all_photos: photos, analysis, analysis_ms: Date.now() - started, usage: data.usage },
      updated_at: new Date().toISOString(),
    }).eq('id', tourId)
    console.log('[tour-plan] análise ok', tourId, plan.steps.length, 'ambientes', cost.toFixed(3), 'USD', Date.now() - started, 'ms')
  } catch (e) {
    console.error('[tour-plan] análise falhou', tourId, String(e))
    await admin.from('video_tours').update({ status: 'failed', cost_usd: cost, error: String(e).slice(0, 300), updated_at: new Date().toISOString() }).eq('id', tourId)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: company } = await admin.from('companies').select('id, plan, vertical_key').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const body = await req.json().catch(() => ({})) as { action?: string; item_id?: string; tour_id?: string; steps?: unknown }

    if (body.action === 'get') {
      if (typeof body.item_id !== 'string') return json({ error: 'item_id obrigatório' }, 400)
      const { data: tour } = await admin.from('video_tours')
        .select('id, status, plan, cost_usd, video_path, cuts, error, updated_at')
        .eq('company_id', company.id).eq('kind', 'plan').eq('item_id', body.item_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      const spent = await monthSpent(admin, company.id)
      let available: PlanStep[] = []
      let graph: Record<string, { ve: string[]; evidencia: string }> = {}
      if (tour?.plan?.analysis) {
        // Ambientes que a IA achou mas ficaram fora da ordem — o corretor pode pôr de volta.
        const a = tour.plan.analysis as Analysis
        const inPlan = new Set(((tour.plan.steps ?? []) as PlanStep[]).map(s => s.ambiente_id))
        available = buildPlan({ ...a, ordem: a.ambientes.map(x => x.id) }, tour.plan.all_photos ?? []).steps.filter(s => !inPlan.has(s.ambiente_id))
        // O que cada ambiente "vê" — a tela recalcula confirmada/não confirmada a cada troca de ordem.
        graph = Object.fromEntries(a.ambientes.map(x => [x.id, { ve: x.ve ?? [], evidencia: x.evidencia ?? '' }]))
        delete tour.plan.analysis // a tela não precisa da resposta crua da IA
      }
      return json({ tour, available, graph, month_spent_usd: spent, month_cap_usd: MONTHLY_CAP_USD, cost_per_step_usd: estimateUsd(2) })
    }

    if (body.action === 'save_order') {
      if (typeof body.tour_id !== 'string' || !Array.isArray(body.steps)) return json({ error: 'tour_id e steps obrigatórios' }, 400)
      const { data: tour } = await admin.from('video_tours').select('id, status, plan').eq('id', body.tour_id).eq('company_id', company.id).eq('kind', 'plan').maybeSingle()
      if (!tour?.plan) return json({ error: 'Tour não encontrado.' }, 404)
      if (tour.status !== 'awaiting_approval') return json({ error: 'Esse tour não está mais esperando aprovação.' }, 409)
      const analysis = tour.plan.analysis as Analysis
      // Só aceita ambientes e fotos que a análise conhece (o corretor reordena, tira ou troca a foto do mesmo ambiente).
      const known = new Map(analysis.ambientes.map(a => [a.id, a]))
      const allPhotos = (tour.plan.all_photos ?? []) as string[]
      // Foto → ambiente segundo a análise (a foto precisa ser do próprio ambiente).
      const photoAmb = new Map(analysis.fotos.filter(f => f.index >= 1 && f.index <= allPhotos.length).map(f => [allPhotos[f.index - 1], f.ambiente_id]))
      const steps: PlanStep[] = []
      const seen = new Set<string>()
      for (const s of body.steps as PlanStep[]) {
        const a = known.get(String(s?.ambiente_id))
        if (!a || seen.has(a.id) || photoAmb.get(String(s.photo)) !== a.id) return json({ error: 'Ordem inválida.' }, 400)
        seen.add(a.id)
        steps.push({ ambiente_id: a.id, nome: a.nome, zona: a.zona, photo: String(s.photo) })
      }
      if (steps.length < 2) return json({ error: 'O tour precisa de pelo menos 2 ambientes.' }, 400)
      const plan: TourPlan & Record<string, unknown> = { ...tour.plan, steps, links: linksFor(steps, analysis) }
      await admin.from('video_tours').update({ plan, photos: steps.map(s => s.photo), updated_at: new Date().toISOString() }).eq('id', tour.id)
      delete plan.analysis
      return json({ ok: true, plan })
    }

    if (body.action === 'analyze') {
      if (!company.plan || company.plan === 'free') return json({ error: 'O tour completo faz parte do plano.' }, 403)
      if (typeof body.item_id !== 'string') return json({ error: 'item_id obrigatório' }, 400)
      const { data: item } = await admin.from('marketing_ai_knowledge').select('id, meta').eq('id', body.item_id).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
      if (!item) return json({ error: 'Imóvel não encontrado.' }, 404)
      const photos = ((item.meta?.photos ?? []) as { url?: string }[]).map(p => String(p.url ?? '')).filter(Boolean)
      const prefix = `${supabaseUrl}/storage/v1/object/public/post-images/renders/${company.id}/`
      if (photos.some(p => !p.startsWith(prefix))) return json({ error: 'Foto inválida no imóvel.' }, 400)
      if (photos.length < MIN_PHOTOS) return json({ error: `O imóvel precisa de pelo menos ${MIN_PHOTOS} fotos.` }, 400)
      if (photos.length > MAX_PHOTOS) return json({ error: `Use no máximo ${MAX_PHOTOS} fotos por imóvel.` }, 400)
      const { data: running } = await admin.from('video_tours').select('id').eq('item_id', item.id).in('status', ['analyzing', 'generating', 'assembling']).limit(1).maybeSingle()
      if (running) return json({ error: 'Esse imóvel já tem um tour em andamento.' }, 409)
      const spent = await monthSpent(admin, company.id)
      if (spent >= MONTHLY_CAP_USD) return json({ error: 'O limite de vídeos deste mês já foi usado.', status: 'cap_reached' }, 429)

      const ficha = await loadFicha(admin, company.vertical_key)
      const { data: tour, error } = await admin.from('video_tours')
        .insert({ company_id: company.id, kind: 'plan', item_id: item.id, status: 'analyzing', plan: { all_photos: photos } })
        .select('id').single()
      if (error) return json({ error: error.message }, 500)
      // A análise leva ~1 min: roda em segundo plano; a tela consulta com 'get'.
      // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra tarefas em segundo plano
      EdgeRuntime.waitUntil(runAnalysis(admin, tour.id, photos, ficha))
      return json({ status: 'analyzing', tour_id: tour.id })
    }

    if (body.action === 'generate' || body.action === 'status') {
      if (typeof body.tour_id !== 'string') return json({ error: 'tour_id obrigatório' }, 400)
      const { data: tour } = await admin.from('video_tours').select('id, status, plan, photos, clips, cost_usd, video_path, cuts, assembly, updated_at')
        .eq('id', body.tour_id).eq('company_id', company.id).eq('kind', 'plan').maybeSingle()
      if (!tour) return json({ error: 'Tour não encontrado.' }, 404)
      const headers = hfHeaders()
      if (!headers) return json({ error: 'Geração de vídeo indisponível no momento.' }, 503)
      const ficha = await loadFicha(admin, company.vertical_key)
      const prompt = String(ficha.walk_prompt || DEFAULT_WALK_PROMPT).slice(0, 1500)
      const publicVideo = (path: string) => admin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl
      const steps = (tour.plan?.steps ?? []) as PlanStep[]

      if (body.action === 'generate') {
        if (!company.plan || company.plan === 'free') return json({ error: 'O tour completo faz parte do plano.' }, 403)
        if (tour.status !== 'awaiting_approval') return json({ error: 'Esse tour não está esperando aprovação.' }, 409)
        if (steps.length < 2) return json({ error: 'O tour precisa de pelo menos 2 ambientes.' }, 400)
        const estimate = estimateUsd(steps.length)
        const spent = await monthSpent(admin, company.id)
        if (spent + estimate > MONTHLY_CAP_USD) {
          return json({ error: `Esse tour custa cerca de US$ ${estimate.toFixed(2)} e sobram US$ ${Math.max(0, MONTHLY_CAP_USD - spent).toFixed(2)} no mês. Tire alguns ambientes ou espere o próximo mês.`, status: 'cap_reached' }, 429)
        }
        // Trava antes de gastar: só uma chamada passa de awaiting_approval pra generating.
        const { data: locked } = await admin.from('video_tours').update({ status: 'generating', updated_at: new Date().toISOString() })
          .eq('id', tour.id).eq('status', 'awaiting_approval').select('id').maybeSingle()
        if (!locked) return json({ error: 'Esse tour já está sendo gerado.' }, 409)
        const photos = steps.map(s => s.photo)
        const clips = await submitAll(headers, prompt, photos, walkClips(photos.length))
        if (clips.every(c => !c.job_ref)) {
          await admin.from('video_tours').update({ status: 'awaiting_approval', updated_at: new Date().toISOString() }).eq('id', tour.id)
          return json({ error: 'Não consegui iniciar o vídeo agora. Tente de novo em alguns minutos.' }, 502)
        }
        await admin.from('video_tours').update({ photos, clips, cost_usd: Number(tour.cost_usd || 0) + estimate, updated_at: new Date().toISOString() }).eq('id', tour.id)
        console.log('[tour-plan] geração iniciada', tour.id, clips.length, 'passagens', estimate.toFixed(2), 'USD')
        return json({ status: 'processing', done: 0, total: clips.length })
      }

      // status
      if (tour.status === 'completed' && tour.video_path) {
        return json({ status: 'completed', video_url: publicVideo(tour.video_path), cuts: (tour.cuts ?? []).map((c: { nome: string; path: string }) => ({ nome: c.nome, video_url: publicVideo(c.path) })) })
      }
      if (tour.status === 'failed') return json({ status: 'failed' })
      if (tour.status !== 'generating' && tour.status !== 'assembling') return json({ status: tour.status })
      const base = `plan/${company.id}/${tour.id}`
      const r = await advanceTour(admin, supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, headers, prompt, tour as TourRow, () => [
        { path: `${base}/tour.mp4`, from: 0, to: steps.length - 1, nome: 'Tour completo' },
        ...planCuts(steps, ficha.cut_seconds).map((c, i) => ({ path: `${base}/recorte-${i + 1}.mp4`, from: c.from, to: c.to, nome: c.nome })),
      ])
      if (r.status === 'completed') {
        const cuts = r.outputs.slice(1).map(o => ({ nome: o.nome, path: o.path, from: o.from, to: o.to }))
        await admin.from('video_tours').update({ cuts }).eq('id', tour.id)
        return json({ status: 'completed', video_url: publicVideo(r.outputs[0].path), cuts: cuts.map(c => ({ nome: c.nome, video_url: publicVideo(c.path) })) })
      }
      return json(r)
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (err) {
    console.error('tour-plan error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
