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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    if (!clientId || !clientSecret) return json({ error: 'Google OAuth não configurado' }, 500)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { code, company_id } = await req.json()
    if (!code || !company_id) return json({ error: 'code and company_id required' }, 400)

    // N1 (2026-11-11): só grava a conexão do Google na empresa de QUEM está logado.
    const { data: owned } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!).from('companies').select('id').eq('id', company_id).eq('user_id', user.id).maybeSingle()
    if (!owned) return json({ error: 'Esta empresa não é da sua conta. Nada foi conectado.' }, 403)

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/auth/gbp/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return json({ error: `Google OAuth error: ${err}` }, 500)
    }

    const tokens = await tokenRes.json()
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()
    const accessToken = tokens.access_token

    // Get company google_place_id for location matching
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: company } = await admin
      .from('companies')
      .select('google_place_id')
      .eq('id', company_id)
      .single()

    // List GBP accounts
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const accountsData = await accountsRes.json()
    const accounts: Array<{ name: string; accountName?: string }> = accountsData.accounts ?? []

    // Fail loudly here instead of silently saving a "connected" row with empty
    // account_id/location_id — that used to only surface as a confusing error
    // much later, when someone actually tried to reply to a review.
    if (accounts.length === 0) {
      return json({
        error: 'Essa conta Google não administra nenhum perfil de negócio (Google Business Profile). Peça para o dono do perfil no Google conectar usando a própria conta Google dele.',
      }, 400)
    }

    const accountId = accounts[0].name.replace('accounts/', '')
    const accountName = accounts[0].accountName ?? ''

    // Find matching location
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?pageSize=100&readMask=name,metadata`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const locData = await locRes.json()
    const locations: Array<{ name: string; metadata?: { placeId?: string } }> = locData.locations ?? []

    if (locations.length === 0) {
      return json({
        error: `A conta Google "${accountName}" não tem nenhum local (location) de negócio cadastrado no Google Business Profile.`,
      }, 400)
    }

    // Try to match by placeId
    const matched = company?.google_place_id
      ? locations.find(l => l.metadata?.placeId === company.google_place_id)
      : null

    const targetLocation = matched ?? locations[0]
    // name is like "locations/NUMBER"
    const locationId = targetLocation.name.replace('locations/', '')

    // Store in company_integrations
    const { error: upsertErr } = await admin
      .from('company_integrations')
      .upsert({
        company_id,
        type: 'google_business_profile',
        access_token: accessToken,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        domain: accountName,
        metadata: { account_id: accountId, location_id: locationId },
        connected_at: new Date().toISOString(),
      }, { onConflict: 'company_id,type' })

    if (upsertErr) return json({ error: upsertErr.message }, 500)

    return json({ success: true, account_name: accountName, account_id: accountId, location_id: locationId })

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
