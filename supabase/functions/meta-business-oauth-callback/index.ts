/**
 * meta-business-oauth-callback — Login com o Meta Business Suite.
 *
 * Fluxo (Facebook Login clássico, diferente do Instagram Business Login):
 *   1. code → short-lived user token   (GET graph.facebook.com/oauth/access_token)
 *   2. short → long-lived user token   (GET .../oauth/access_token, ~60 dias)
 *   3. busca as Páginas do usuário (com Instagram Business vinculado, se tiver)
 *   4. salva token + perfil em companies, e as Páginas em company_meta_pages
 *
 * Usa FACEBOOK_APP_ID / FACEBOOK_APP_SECRET (produto "Facebook Login for
 * Business"), diferente do INSTAGRAM_APP_ID/SECRET do login direto do Instagram.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const FB_VERSION = 'v21.0'

interface FbPage { id: string; name?: string; access_token?: string; instagram_business_account?: { id: string } }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorMsg = url.searchParams.get('error_description') || url.searchParams.get('error')

  // Conexões vive em Configurações agora (foi consolidado pra lá) — manda
  // direto pro lugar certo, sem passar pelo endereço antigo (que hoje só
  // redireciona e perde a mensagem de sucesso/erro no meio do caminho).
  if (errorMsg) return htmlRedirect(`/dashboard/settings?tab=conexoes&error=${encodeURIComponent(errorMsg)}`)
  if (!code || !state) return htmlRedirect('/dashboard/settings?tab=conexoes&error=missing_params')

  let companyId: string
  try {
    companyId = JSON.parse(atob(state)).company_id
  } catch {
    return htmlRedirect('/dashboard/settings?tab=conexoes&error=invalid_state')
  }

  const appId = Deno.env.get('FACEBOOK_APP_ID')
  const appSecret = Deno.env.get('FACEBOOK_APP_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!appId || !appSecret) return htmlRedirect('/dashboard/settings?tab=conexoes&error=meta_business_not_configured')

  const redirectUri = `${supabaseUrl}/functions/v1/meta-business-oauth-callback`

  try {
    // 1. code → short-lived token
    const shortRes = await fetch(`https://graph.facebook.com/${FB_VERSION}/oauth/access_token?` + new URLSearchParams({
      client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
    }))
    if (!shortRes.ok) throw new Error(`Short token failed: ${await shortRes.text()}`)
    const shortJson = await shortRes.json() as { access_token?: string }
    if (!shortJson.access_token) throw new Error(`Short token failed: resposta sem access_token — ${JSON.stringify(shortJson)}`)

    // 2. short → long-lived token (~60 dias)
    const llRes = await fetch(`https://graph.facebook.com/${FB_VERSION}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortJson.access_token,
    }))
    const llJson = llRes.ok ? await llRes.json() as { access_token?: string; expires_in?: number } : {}
    const longToken = llJson.access_token ?? shortJson.access_token
    const expiresIn = llJson.expires_in ?? 5184000 // 60 dias padrão
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // 3. quem é o usuário
    const meRes = await fetch(`https://graph.facebook.com/${FB_VERSION}/me?` + new URLSearchParams({ fields: 'id,name', access_token: longToken }))
    const me = meRes.ok ? await meRes.json() as { id?: string; name?: string } : {}

    // 4. Páginas que o usuário administra, com Instagram Business vinculado quando tiver
    const pagesRes = await fetch(`https://graph.facebook.com/${FB_VERSION}/me/accounts?` + new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account', access_token: longToken,
    }))
    const pagesJson = pagesRes.ok ? await pagesRes.json() as { data?: FbPage[] } : {}
    const pages = pagesJson.data ?? []

    const admin = createClient(supabaseUrl, serviceKey)
    const { error: updateErr } = await admin.from('companies').update({
      meta_business_user_id: me.id ?? null,
      meta_business_name: me.name ?? null,
      meta_business_access_token: longToken,
      meta_business_token_expires_at: expiresAt,
      meta_business_connected_at: new Date().toISOString(),
    }).eq('id', companyId)
    if (updateErr) throw new Error(updateErr.message)

    if (pages.length > 0) {
      const rows = pages.map(p => ({
        company_id: companyId, page_id: p.id, name: p.name ?? null,
        access_token: p.access_token ?? null, instagram_business_account_id: p.instagram_business_account?.id ?? null,
      }))
      await admin.from('company_meta_pages').upsert(rows, { onConflict: 'company_id,page_id' })
    }

    return htmlRedirect('/dashboard/settings?tab=conexoes&meta_business=connected')
  } catch (err) {
    console.error('Meta Business OAuth error:', err)
    return htmlRedirect(`/dashboard/settings?tab=conexoes&error=${encodeURIComponent(String(err))}`)
  }
})

function htmlRedirect(path: string) {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://getsaleboost.com'
  return Response.redirect(`${appUrl}${path}`, 302)
}
