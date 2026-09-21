/**
 * meta-ads-oauth-callback — recebe o code do Facebook, troca por token,
 * lista as contas de anuncios e salva a principal na empresa.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const META_API = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorMsg = url.searchParams.get('error_description') || url.searchParams.get('error')

  if (errorMsg) return htmlRedirect(`/dashboard/settings?tab=conexoes&error=${encodeURIComponent(errorMsg)}`)
  if (!code || !state) return htmlRedirect('/dashboard/settings?tab=conexoes&error=missing_params')

  let companyId
  try { companyId = JSON.parse(atob(state)).company_id } catch { return htmlRedirect('/dashboard/settings?tab=conexoes&error=invalid_state') }

  const appId = Deno.env.get('META_APP_ID')
  const appSecret = Deno.env.get('META_APP_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const redirectUri = `${supabaseUrl}/functions/v1/meta-ads-oauth-callback`

  try {
    const tokenRes = await fetch(`${META_API}/oauth/access_token?` + new URLSearchParams({
      client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
    }))
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`)
    const { access_token: shortToken } = await tokenRes.json()

    const llRes = await fetch(`${META_API}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken,
    }))
    const llJson = llRes.ok ? await llRes.json() : {}
    const longToken = llJson.access_token ?? shortToken
    const expiresIn = llJson.expires_in ?? 5184000
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const acctRes = await fetch(`${META_API}/me/adaccounts?` + new URLSearchParams({
      fields: 'account_id,name,account_status', access_token: longToken,
    }))
    if (!acctRes.ok) throw new Error(`Failed to list ad accounts: ${await acctRes.text()}`)
    const accts = (await acctRes.json()).data ?? []
    if (accts.length === 0) throw new Error('Nenhuma conta de anuncios encontrada nesta conta da Meta.')
    const chosen = accts.find(a => a.account_status === 1) ?? accts[0]

    const admin = createClient(supabaseUrl, serviceKey)
    const { error: updateErr } = await admin.from('companies').update({
      meta_ads_account_id: chosen.account_id,
      meta_ads_account_name: chosen.name,
      meta_ads_access_token: longToken,
      meta_ads_token_expires_at: expiresAt,
    }).eq('id', companyId)
    if (updateErr) throw new Error(updateErr.message)

    return htmlRedirect('/dashboard/settings?tab=conexoes&meta_ads=connected')
  } catch (err) {
    console.error('meta-ads OAuth error:', err)
    return htmlRedirect(`/dashboard/settings?tab=conexoes&error=${encodeURIComponent(String(err))}`)
  }
})

function htmlRedirect(path) {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://sales-boost-restaurants.luancontasecundaria22.workers.dev'
  return Response.redirect(`${appUrl}${path}`, 302)
}
