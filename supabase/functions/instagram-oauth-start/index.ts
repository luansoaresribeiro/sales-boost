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
 * POST { company_id } com o login do dono → { url } (N1, 2026-11-11). A tela abre a url.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ownerOfCompany, signState, stateSecret } from '../_shared/oauthState.ts'

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

  // N1 (2026-11-11): o início exige o login do dono e confere que a empresa é dele. O link antigo
  // (GET ?company_id=, sem login) não funciona mais — a tela agora pede o link por aqui (POST) e só então abre.
  if (req.method !== 'POST') return json({ error: 'Atualize a página e clique em Conectar de novo.' }, 400)
  const body = await req.json().catch(() => ({})) as { company_id?: unknown }
  const owner = await ownerOfCompany(req, createClient, body.company_id)
  if ('error' in owner) return json({ error: owner.error }, owner.status)

  const appId = Deno.env.get('INSTAGRAM_APP_ID')
  if (!appId) return json({ error: 'INSTAGRAM_APP_ID not configured' }, 500)

  // Mesmo endereço de volta no início e na troca do código (instagram-oauth-callback usa o mesmo cálculo).
  const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI') || `${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram-oauth-callback`
  const state = await signState(stateSecret(), { companyId: owner.companyId, userId: owner.userId, provider: 'instagram' })

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

  return json({ url: authUrl.toString() })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
