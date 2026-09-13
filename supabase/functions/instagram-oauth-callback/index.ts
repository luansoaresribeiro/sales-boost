/**
 * instagram-oauth-callback — Instagram Business Login (API with Instagram Login).
 *
 * Recebe o code do login do INSTAGRAM, troca por token e salva na empresa.
 * Fluxo (diferente do Facebook Login):
 *   1. code → short-lived token  (POST api.instagram.com/oauth/access_token)
 *   2. short → long-lived token  (GET graph.instagram.com/access_token, 60 dias)
 *   3. salva instagram_user_id + token + expiração em companies
 *
 * Usa INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET (produto Instagram), não os do
 * Facebook. Não precisa de Página do Facebook.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// IDs do Instagram têm 17 dígitos — passam de Number.MAX_SAFE_INTEGER (16
// dígitos). Se a resposta vier com "user_id":123... como NÚMERO json (não
// string), o .json() nativo já arredonda o valor ao dar parse (perde o
// último dígito) — String() depois disso só formata o número já errado.
// Aspeia esses campos no texto cru ANTES do parse, então o precision loss
// nunca acontece. Bug real: causou instagram_user_id salvo 1 dígito errado
// (…30 em vez de …31), e toda publicação subsequente falhava com "Object
// with ID … does not exist".
function parseJsonSafeIds<T>(raw: string): T {
  return JSON.parse(raw.replace(/"(user_id|id)":\s*(\d+)/g, '"$1":"$2"')) as T
}

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

  const appId = Deno.env.get('INSTAGRAM_APP_ID')
  const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!appId || !appSecret) return htmlRedirect('/dashboard/settings?tab=conexoes&error=instagram_not_configured')

  const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`
  // O Instagram às vezes acrescenta "#_" no fim do code — remove.
  const cleanCode = code.replace(/#_$/, '')

  try {
    // 1. code → short-lived token — a doc oficial do Meta manda esse POST
    // como multipart/form-data (exemplo em curl usa -F), não form-urlencoded.
    const form = new FormData()
    form.set('client_id', appId)
    form.set('client_secret', appSecret)
    form.set('grant_type', 'authorization_code')
    form.set('redirect_uri', redirectUri)
    form.set('code', cleanCode)
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
    })
    const shortText = await shortRes.text()
    if (!shortRes.ok) throw new Error(`Short token failed: ${shortText}`)
    const shortJson = parseJsonSafeIds<
      { access_token?: string; user_id?: number | string; permissions?: string; data?: { access_token: string; user_id?: number | string; permissions?: string }[] }
    >(shortText)
    // A doc oficial mostra a resposta embrulhada em "data": [...] — trata os
    // dois formatos pra não quebrar se a API devolver liso (sem o wrapper).
    const shortPayload = shortJson.data?.[0] ?? shortJson
    const shortToken = shortPayload.access_token
    let igUserId = shortPayload.user_id != null ? String(shortPayload.user_id) : ''
    if (!shortToken) throw new Error(`Short token failed: resposta sem access_token — ${JSON.stringify(shortJson)}`)

    // 2. short → long-lived token (60 dias)
    const llRes = await fetch(`https://graph.instagram.com/access_token?` + new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortToken,
    }))
    const llJson = llRes.ok ? await llRes.json() as { access_token?: string; expires_in?: number } : {}
    const longToken = llJson.access_token ?? shortToken
    const expiresIn = llJson.expires_in ?? 5184000 // 60 dias padrão
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // 3. (fallback) garante o user id via /me se não veio no passo 1
    if (!igUserId) {
      const meRes = await fetch(`https://graph.instagram.com/me?` + new URLSearchParams({ fields: 'user_id,username', access_token: longToken }))
      if (meRes.ok) {
        const me = parseJsonSafeIds<{ user_id?: string; id?: string }>(await meRes.text())
        igUserId = String(me.user_id ?? me.id ?? '')
      }
    }
    if (!igUserId) throw new Error('Não foi possível obter o ID da conta do Instagram.')

    const admin = createClient(supabaseUrl, serviceKey)
    const { error: updateErr } = await admin
      .from('companies')
      .update({
        instagram_user_id: igUserId,
        instagram_access_token: longToken,
        instagram_token_expires_at: expiresAt,
      })
      .eq('id', companyId)
    if (updateErr) throw new Error(updateErr.message)

    return htmlRedirect('/dashboard/settings?tab=conexoes&instagram=connected')
  } catch (err) {
    console.error('Instagram OAuth error:', err)
    return htmlRedirect(`/dashboard/settings?tab=conexoes&error=${encodeURIComponent(String(err))}`)
  }
})

function htmlRedirect(path: string) {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://sales-boost-restaurants.luancontasecundaria22.workers.dev'
  return Response.redirect(`${appUrl}${path}`, 302)
}
