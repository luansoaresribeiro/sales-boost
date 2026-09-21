/**
 * meta-ads-insights — puxa os numeros REAIS da conta de anuncios (30 dias).
 * Body: { company_id }. Se nao conectado, devolve { connected: false }.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const META_API = 'https://graph.facebook.com/v21.0'
const CONV_TYPES = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.purchase', 'lead', 'offsite_conversion.fb_pixel_lead']

function sumAction(list, types) {
  if (!list) return 0
  return list.filter(a => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value ?? 0), 0)
}
const n = (v) => Number(v ?? 0)
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { company_id } = await req.json().catch(() => ({}))
    if (!company_id) return json({ error: 'company_id obrigatorio' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: company } = await admin.from('companies')
      .select('id, user_id, meta_ads_account_id, meta_ads_account_name, meta_ads_access_token, meta_ads_token_expires_at')
      .eq('id', company_id).maybeSingle()
    if (!company || company.user_id !== user.id) return json({ error: 'Forbidden' }, 403)
    if (!company.meta_ads_account_id || !company.meta_ads_access_token) return json({ connected: false })
    if (company.meta_ads_token_expires_at && new Date(company.meta_ads_token_expires_at) < new Date()) {
      return json({ connected: false, expired: true })
    }

    const acct = company.meta_ads_account_id.startsWith('act_') ? company.meta_ads_account_id : `act_${company.meta_ads_account_id}`
    const token = company.meta_ads_access_token

    const accRes = await fetch(`${META_API}/${acct}/insights?` + new URLSearchParams({
      fields: 'spend,impressions,clicks,ctr,cpc,reach,actions,action_values,purchase_roas',
      date_preset: 'last_30d', access_token: token,
    }))
    if (!accRes.ok) return json({ connected: true, error: `Meta API: ${await accRes.text()}` }, 200)
    const acc = (await accRes.json()).data?.[0] ?? {}
    const spend = n(acc.spend)
    const conversions = sumAction(acc.actions, CONV_TYPES)
    const revenue = sumAction(acc.action_values, CONV_TYPES) || (n(acc.purchase_roas?.[0]?.value) * spend)
    const totals = {
      spend: round(spend), revenue: round(revenue),
      roas: spend > 0 ? round(revenue / spend) : 0,
      ctr: round(n(acc.ctr)), cpc: round(n(acc.cpc)),
      cpa: conversions > 0 ? round(spend / conversions) : 0,
      conversions: Math.round(conversions),
    }

    const campRes = await fetch(`${META_API}/${acct}/campaigns?` + new URLSearchParams({
      fields: 'name,status,objective,insights.date_preset(last_30d){spend,ctr,cpc,actions,action_values,purchase_roas}',
      limit: '25', access_token: token,
    }))
    const campData = campRes.ok ? ((await campRes.json()).data ?? []) : []
    const campaigns = campData.map((c, i) => {
      const ins = c.insights?.data?.[0] ?? {}
      const cSpend = n(ins.spend)
      const cConv = sumAction(ins.actions, CONV_TYPES)
      const cRev = sumAction(ins.action_values, CONV_TYPES) || (n(ins.purchase_roas?.[0]?.value) * cSpend)
      return {
        id: c.id ?? `camp_${i}`, name: c.name ?? 'Campanha',
        objective: (c.objective ?? '').replace('OUTCOME_', '').toLowerCase(),
        status: c.status === 'ACTIVE' ? 'active' : c.status === 'PAUSED' ? 'paused' : 'draft',
        spend: round(cSpend), roas: cSpend > 0 ? round(cRev / cSpend) : 0,
        ctr: round(n(ins.ctr)), cpc: round(n(ins.cpc)),
        cpa: cConv > 0 ? round(cSpend / cConv) : 0,
      }
    })

    return json({ connected: true, account_name: company.meta_ads_account_name, totals, campaigns })
  } catch (err) {
    console.error('meta-ads-insights error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
