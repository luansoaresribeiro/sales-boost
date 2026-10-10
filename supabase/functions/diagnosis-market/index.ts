/**
 * diagnosis-market — parte "você vs. a concorrência + o que está em alta" do
 * diagnóstico grátis (v2, 2026-10-09). A página /diagnostico/:id chama a cada
 * ~5 s; cada chamada avança UMA etapa (ver _shared/marketScan.ts) com trava
 * otimista (`market_data.v`), então várias abas abertas não duplicam gasto.
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// O que a página vê: sem ids de execução nem posts crus.
function publicView(m: MarketData | null) {
  if (!m) return { status: 'none' }
  return { status: m.status, reason: m.reason ?? null, hashtags: m.hashtags, competitors: m.competitors ?? [], trends: m.trends ?? null, insights: m.insights ?? null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { diagnostic_id } = await req.json().catch(() => ({}))
    if (typeof diagnostic_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(diagnostic_id)) return json({ error: 'diagnostic_id inválido' }, 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: diag } = await admin.from('diagnostics').select('id, created_at, business_name, business_type, city, instagram_url, instagram_data, onboarding_context, company_id, market_data').eq('id', diagnostic_id).maybeSingle()
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
      m = initialMarket(hashtags, reason)
      const { data: ok } = await admin.from('diagnostics').update({ market_data: m }).eq('id', diag.id).is('market_data', null).select('id').maybeSingle()
      if (!ok) return json({ status: 'queued' })
      if (reason) console.log('[diagnosis-market] indisponível', diag.id, reason)
    }

    if (!['done', 'unavailable'].includes(m.status) && token) {
      const handle = String(diag.instagram_url ?? '').split('instagram.com/')[1]?.replace(/\/$/, '').toLowerCase() || null
      const next = await advanceMarket(m, {
        token, anthropicKey: Deno.env.get('ANTHROPIC_API_KEY') ?? null, templates: null, ownHandle: handle,
        own: diag.instagram_data, business: `${diag.business_type ?? 'negócio'} em ${diag.city ?? 'sua cidade'}`,
      })
      if (next.v !== m.v) {
        const { data: ok } = await admin.from('diagnostics').update({ market_data: next }).eq('id', diag.id).eq('market_data->>v', String(m.v)).select('id').maybeSingle()
        if (ok) {
          m = next
          if (m.status === 'done' && diag.company_id) await feedCompany(admin, diag.company_id, m)
          console.log('[diagnosis-market]', diag.id, '→', m.status, m.reason ?? '')
        }
      }
    }
    return json(publicView(m))
  } catch (err) {
    console.error('diagnosis-market error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

