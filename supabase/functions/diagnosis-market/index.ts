/**
 * diagnosis-market — parte "você vs. a concorrência + o que está em alta" do
 * diagnóstico grátis (v2, 2026-10-09).
 *
 * Velocidade (pedido do dono 2026-10-10): o run-diagnosis chama esta função
 * com `drive: true` logo que cria o diagnóstico — ela responde na hora e
 * toca a análise inteira em segundo plano, emendando uma etapa na outra
 * (a Apify segura a resposta até cada execução terminar). A página só
 * pergunta o estado; se ninguém estiver tocando (ex.: o disparo falhou), a
 * própria pergunta da página toca por alguns segundos.
 *
 * Trava: `market_data.lease_until` marca quem está tocando — duas chamadas
 * nunca iniciam a mesma etapa na Apify (custo em dobro). Toda gravação usa
 * trava otimista por `market_data.v`.
 *
 * Custo: só começa pra diagnóstico novo (até 30 min) e respeita o teto
 * mensal MARKET_SCAN_MONTHLY_CAP. Sem APIFY_TOKEN → "indisponível", a página
 * mostra só a parte de sempre.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { advanceMarket, feedCompany, initialMarket, marketHashtags, MARKET_SCAN_MONTHLY_CAP, type MarketData } from '../_shared/marketScan.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
// deno-lint-ignore no-explicit-any
type Any = any
const FRESH_MS = 30 * 60 * 1000
const DRIVE_BUDGET_MS = 130_000 // segundo plano (limite do Supabase: 150 s)
const POLL_BUDGET_MS = 20_000 // quando quem chama é a página
const LEASE_MS = 45_000
const DIAG_COLS = 'id, created_at, business_name, business_type, city, instagram_url, instagram_data, status, onboarding_context, company_id, market_data'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// O que a página vê: sem ids de execução nem posts crus.
function publicView(m: MarketData | null) {
  if (!m) return { status: 'none' }
  return { status: m.status, reason: m.reason ?? null, hashtags: m.hashtags, competitors: m.competitors ?? [], trends: m.trends ?? null, insights: m.insights ?? null }
}

const finished = (m: MarketData) => m.status === 'done' || m.status === 'unavailable'
const leaseActive = (m: MarketData) => !!m.lease_until && Date.parse(m.lease_until) > Date.now()

// Grava `next` só se ninguém mexeu desde `prev` (trava otimista).
async function save(admin: Any, id: string, prev: MarketData, next: MarketData): Promise<boolean> {
  const { data } = await admin.from('diagnostics').update({ market_data: next }).eq('id', id).eq('market_data->>v', String(prev.v)).select('id').maybeSingle()
  return !!data
}

// Toca a análise até terminar ou acabar o tempo. Só uma chamada por vez
// (lease); devolve o estado mais recente.
async function run(admin: Any, diagId: string, budgetMs: number, token: string): Promise<MarketData | null> {
  const t0 = Date.now()
  let { data: diag } = await admin.from('diagnostics').select(DIAG_COLS).eq('id', diagId).maybeSingle()
  let m = (diag?.market_data ?? null) as MarketData | null
  if (!diag || !m || finished(m) || leaseActive(m)) return m

  const claimed: MarketData = { ...m, v: m.v + 1, lease_until: new Date(Date.now() + LEASE_MS).toISOString() }
  if (!(await save(admin, diagId, m, claimed))) return m
  m = claimed

  while (!finished(m) && Date.now() - t0 < budgetMs) {
    // A análise usa o Instagram do próprio dono (lido pelo run-diagnosis em
    // paralelo). Na hora de escrever, espera ele chegar (até ~25 s).
    if (m.status === 'thinking' && !diag.instagram_data && diag.status === 'processing' && Date.now() - Date.parse(diag.created_at) < 90_000) {
      await new Promise(r => setTimeout(r, 2500))
      diag = (await admin.from('diagnostics').select(DIAG_COLS).eq('id', diagId).maybeSingle()).data ?? diag
      const held: MarketData = { ...m, v: m.v + 1, lease_until: new Date(Date.now() + LEASE_MS).toISOString() }
      if (!(await save(admin, diagId, m, held))) return m
      m = held
      continue
    }
    const left = (budgetMs - (Date.now() - t0)) / 1000
    const handle = String(diag.instagram_url ?? '').split('instagram.com/')[1]?.replace(/\/$/, '').toLowerCase() || null
    const next = await advanceMarket(m, {
      token, anthropicKey: Deno.env.get('ANTHROPIC_API_KEY') ?? null, templates: null, ownHandle: handle,
      own: diag.instagram_data, business: `${diag.business_type ?? 'negócio'} em ${diag.city ?? 'sua cidade'}`,
      waitSecs: Math.min(25, Math.max(0, left - 5)),
    })
    const renewed: MarketData = { ...next, v: Math.max(next.v, m.v) + (next.v === m.v ? 1 : 0), lease_until: finished(next) ? null : new Date(Date.now() + LEASE_MS).toISOString() }
    if (!(await save(admin, diagId, m, renewed))) return m // alguém mexeu: para por aqui
    if (renewed.status !== m.status) console.log('[diagnosis-market]', diagId, '→', renewed.status, renewed.reason ?? '', `${Math.round((Date.now() - t0) / 1000)}s`)
    m = renewed
    if (m.status === 'done' && diag.company_id) await feedCompany(admin, diag.company_id, m)
    if (m.status === 'thinking' && !diag.instagram_data) diag = (await admin.from('diagnostics').select(DIAG_COLS).eq('id', diagId).maybeSingle()).data ?? diag
  }
  if (!finished(m)) { // solta a vez pra próxima chamada continuar
    const released: MarketData = { ...m, v: m.v + 1, lease_until: null }
    if (await save(admin, diagId, m, released)) m = released
  }
  return m
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { diagnostic_id, drive } = await req.json().catch(() => ({}))
    if (typeof diagnostic_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(diagnostic_id)) return json({ error: 'diagnostic_id inválido' }, 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: diag } = await admin.from('diagnostics').select(DIAG_COLS).eq('id', diagnostic_id).maybeSingle()
    if (!diag) return json({ error: 'Diagnóstico não encontrado.' }, 404)

    let m = (diag.market_data ?? null) as MarketData | null
    const token = (Deno.env.get('APIFY_TOKEN') ?? '').trim()

    if (!m) {
      if (Date.now() - Date.parse(diag.created_at) > FRESH_MS) return json(publicView(null))
      const { data: bt } = await admin.from('business_types').select('vertical_key').eq('label', diag.business_type ?? '').maybeSingle()
      const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', bt?.vertical_key ?? 'generico').eq('enabled', true).maybeSingle()
      const tpl = (pb?.config as Any)?.market_hashtags
      const hashtags = marketHashtags(Array.isArray(tpl) ? tpl : null, diag.business_type, diag.city, (diag.onboarding_context as Any)?.playbook_answers?.bairros)
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
      const { count } = await admin.from('diagnostics').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()).not('market_data->runs->>posts', 'is', null)
      const reason = !token ? 'sem_token' : (count ?? 0) >= MARKET_SCAN_MONTHLY_CAP ? 'teto_mensal' : undefined
      const init = initialMarket(hashtags, reason)
      const { data: ok } = await admin.from('diagnostics').update({ market_data: init }).eq('id', diag.id).is('market_data', null).select('id').maybeSingle()
      if (ok) m = init
      if (reason) console.log('[diagnosis-market] indisponível', diag.id, reason)
    }
    if (!m || finished(m) || !token) return json(publicView(m ?? { status: 'queued' } as MarketData))

    if (drive) {
      // Responde na hora; a análise continua em segundo plano.
      const work = run(admin, diagnostic_id, DRIVE_BUDGET_MS, token).catch(e => console.error('diagnosis-market drive:', e))
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime
      if (rt?.waitUntil) rt.waitUntil(work); else await work
      return json(publicView(m))
    }
    if (leaseActive(m)) return json(publicView(m))
    return json(publicView(await run(admin, diagnostic_id, POLL_BUDGET_MS, token) ?? m))
  } catch (err) {
    console.error('diagnosis-market error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
