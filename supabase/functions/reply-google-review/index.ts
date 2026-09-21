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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { review_id, reply_text } = await req.json()
    if (!review_id || !reply_text?.trim()) return json({ error: 'review_id e reply_text são obrigatórios' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: company } = await admin
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

    const { data: review } = await admin
      .from('reviews')
      .select('google_review_id')
      .eq('id', review_id)
      .eq('company_id', company.id)
      .single()
    if (!review) return json({ error: 'Avaliação não encontrada' }, 404)
    if (!review.google_review_id) return json({ error: 'Esta avaliação não tem ID do Google para resposta direta' }, 400)

    const { data: integration } = await admin
      .from('company_integrations')
      .select('access_token, refresh_token, token_expires_at, metadata')
      .eq('company_id', company.id)
      .eq('type', 'google_business_profile')
      .single()
    if (!integration) return json({ error: 'Google Business Profile não conectado. Vá em Integrações para conectar.' }, 400)

    const meta = integration.metadata as { account_id?: string; location_id?: string }
    if (!meta?.account_id || !meta?.location_id) {
      return json({ error: 'account_id ou location_id não encontrados. Reconecte o Google Business Profile.' }, 400)
    }

    let accessToken = integration.access_token
    const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : new Date(0)
    if (expiresAt < new Date(Date.now() + 60_000) && integration.refresh_token && clientId && clientSecret) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json()
        accessToken = refreshed.access_token
        await admin.from('company_integrations').update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
        }).eq('company_id', company.id).eq('type', 'google_business_profile')
      }
    }

    const reviewName = `accounts/${meta.account_id}/locations/${meta.location_id}/reviews/${review.google_review_id}`
    const replyRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: reply_text.trim() }),
      },
    )

    if (!replyRes.ok) {
      const errBody = await replyRes.text()
      return json({ error: `Erro da API Google: ${errBody}` }, 500)
    }

    await admin.from('reviews').update({
      owner_reply: reply_text.trim(),
      responded_at: new Date().toISOString(),
    }).eq('id', review_id)

    return json({ success: true })

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
