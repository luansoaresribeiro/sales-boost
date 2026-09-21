/**
 * meta-ads-oauth-start — conecta a conta de anuncios da Meta (Marketing API).
 * Usa Facebook Login com META_APP_ID. Pede leitura de anuncios.
 */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SCOPES = ['ads_read', 'business_management']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const companyId = url.searchParams.get('company_id')
  if (!companyId) return json({ error: 'company_id is required' }, 400)

  const appId = Deno.env.get('META_APP_ID')
  if (!appId) return json({ error: 'META_APP_ID not configured' }, 500)

  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-ads-oauth-callback`
  const state = btoa(JSON.stringify({ company_id: companyId, ts: Date.now() }))

  const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES.join(','))
  authUrl.searchParams.set('state', state)

  return Response.redirect(authUrl.toString(), 302)
})

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
