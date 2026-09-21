/**
 * instagram-oauth-start — Instagram Business Login (API with Instagram Login).
 *
 * Redireciona o dono do negócio para o login do INSTAGRAM (não do Facebook).
 * Não exige Página do Facebook — o cliente loga direto com o Instagram
 * (conta Profissional: Business ou Criador).
 *
 * Usa o Instagram App ID (produto Instagram → "API setup with Instagram login"),
 * diferente do App ID do Facebook.
 *
 * Query: ?company_id=...
 */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Permissões do Instagram Login (não são as mesmas do Facebook Login) —
// precisa bater com o que está configurado em Instagram > API setup with
// Instagram login > "Add required messaging permissions" no App Dashboard.
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
  'instagram_business_manage_insights',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const companyId = url.searchParams.get('company_id')
  if (!companyId) return json({ error: 'company_id is required' }, 400)

  const appId = Deno.env.get('INSTAGRAM_APP_ID')
  if (!appId) return json({ error: 'INSTAGRAM_APP_ID not configured' }, 500)

  const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI')

if (!redirectUri) {
  return json({ error: 'INSTAGRAM_REDIRECT_URI not configured' }, 500)
}
  const state = btoa(JSON.stringify({ company_id: companyId, ts: Date.now() }))

  const authUrl = new URL('https://www.instagram.com/oauth/authorize')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES.join(','))
  authUrl.searchParams.set('state', state)
  // Força uma autorização nova a cada vez (em vez de reaproveitar uma sessão
  // antiga guardada no navegador) — é assim que a URL gerada pelo próprio
  // painel do Meta ("Embed URL") vem por padrão.
  authUrl.searchParams.set('force_reauth', 'true')

  return Response.redirect(authUrl.toString(), 302)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
