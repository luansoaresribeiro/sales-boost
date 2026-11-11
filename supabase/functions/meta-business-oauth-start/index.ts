/**
 * meta-business-oauth-start — Login com o Meta Business Suite.
 *
 * Diferente do login do Instagram (instagram-oauth-start): esse aqui é o
 * login clássico do FACEBOOK ("Facebook Login for Business"), que dá acesso
 * às Páginas, contas de Instagram vinculadas e negócios do Business Manager
 * do cliente — dados reais, não mock.
 *
 * Usa FACEBOOK_APP_ID (produto "Facebook Login for Business" do app do
 * Meta), diferente do INSTAGRAM_APP_ID usado no login direto do Instagram.
 *
 * POST { company_id } com o login do dono → { url } (N1, 2026-11-11). A tela abre a url.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ownerOfCompany, signState, stateSecret } from '../_shared/oauthState.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FB_VERSION = 'v21.0'

// Permissões pedidas — só o que a plataforma já sabe usar (Páginas, conta de
// Instagram vinculada, negócios do Business Manager). Nunca pede mais do
// que consegue realmente aproveitar.
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'instagram_basic',
  'whatsapp_business_management',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // N1 (2026-11-11): o início exige o login do dono e confere que a empresa é dele. O link antigo
  // (GET ?company_id=, sem login) não funciona mais — a tela agora pede o link por aqui (POST) e só então abre.
  if (req.method !== 'POST') return json({ error: 'Atualize a página e clique em Conectar de novo.' }, 400)
  const body = await req.json().catch(() => ({})) as { company_id?: unknown }
  const owner = await ownerOfCompany(req, createClient, body.company_id)
  if ('error' in owner) return json({ error: owner.error }, owner.status)

  const appId = Deno.env.get('FACEBOOK_APP_ID')
  if (!appId) return json({ error: 'FACEBOOK_APP_ID not configured' }, 500)

  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-business-oauth-callback`
  const state = await signState(stateSecret(), { companyId: owner.companyId, userId: owner.userId, provider: 'meta_business' })

  const authUrl = new URL(`https://www.facebook.com/${FB_VERSION}/dialog/oauth`)
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES.join(','))
  authUrl.searchParams.set('state', state)

  return json({ url: authUrl.toString() })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
