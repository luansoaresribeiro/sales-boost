import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? ''
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { company_id } = await req.json()
    if (!company_id) return json({ error: 'company_id required' }, 400)

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: company } = await serviceClient
      .from('companies')
      .select('id, website_url')
      .eq('id', company_id)
      .eq('user_id', user.id)
      .single()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

    const { data: integration } = await serviceClient
      .from('company_integrations')
      .select('*')
      .eq('company_id', company_id)
      .eq('type', 'google_search_console')
      .single()

    if (!integration) return json({ error: 'Google Search Console não conectado' }, 404)

    let accessToken = integration.access_token
    const expiresAt = new Date(integration.token_expires_at ?? 0)
    if (expiresAt <= new Date(Date.now() + 60_000) && integration.refresh_token && clientId && clientSecret) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: integration.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      })
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()
        accessToken = refreshData.access_token
        const newExpiry = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString()
        await serviceClient
          .from('company_integrations')
          .update({ access_token: accessToken, token_expires_at: newExpiry })
          .eq('id', integration.id)
      }
    }

    const siteUrl = integration.domain ?? `sc-domain:${new URL(company.website_url).hostname}`

    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 1)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 28)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const [queriesRes, pagesRes, summaryRes] = await Promise.all([
      fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: fmt(startDate), endDate: fmt(endDate), dimensions: ['query'], rowLimit: 10 }),
        }
      ),
      fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: fmt(startDate), endDate: fmt(endDate), dimensions: ['page'], rowLimit: 5 }),
        }
      ),
      fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: fmt(startDate), endDate: fmt(endDate) }),
        }
      ),
    ])

    const queries = queriesRes.ok ? (await queriesRes.json()).rows ?? [] : []
    const pages = pagesRes.ok ? (await pagesRes.json()).rows ?? [] : []
    const summaryData = summaryRes.ok ? await summaryRes.json() : {}
    const summary = summaryData.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 }

    return json({
      summary: {
        clicks: Math.round(summary.clicks ?? 0),
        impressions: Math.round(summary.impressions ?? 0),
        ctr: parseFloat(((summary.ctr ?? 0) * 100).toFixed(1)),
        position: parseFloat((summary.position ?? 0).toFixed(1)),
      },
      top_queries: queries.slice(0, 10).map((r: Record<string, unknown>) => ({
        query: (r.keys as string[])?.[0],
        clicks: Math.round(r.clicks as number ?? 0),
        impressions: Math.round(r.impressions as number ?? 0),
        position: parseFloat((r.position as number ?? 0).toFixed(1)),
      })),
      top_pages: pages.slice(0, 5).map((r: Record<string, unknown>) => ({
        page: (r.keys as string[])?.[0],
        clicks: Math.round(r.clicks as number ?? 0),
        impressions: Math.round(r.impressions as number ?? 0),
      })),
      period: { start: fmt(startDate), end: fmt(endDate) },
    })

  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
