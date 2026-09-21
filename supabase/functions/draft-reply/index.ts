import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildReviewReplyPrompt(company: { business_name: string; business_type: string | null; city: string | null }, review: { author: string; rating: number; text: string | null; review_date: string }): string {
  return `Você é o gerente de ${company.business_name} (${company.business_type ?? 'estabelecimento'} em ${company.city ?? 'Brasil'}).

Escreva uma resposta profissional, humana e cordial para esta avaliação no Google:

**Avaliador:** ${review.author}
**Nota:** ${review.rating}/5 estrelas
**Comentário:** ${review.text ?? '(sem comentário)'}
**Data:** ${review.review_date}

Regras:
- Máximo 4 frases
- Comece agradecendo pelo feedback, mesmo que negativo
- Se a nota for baixa (1-2): reconheça o problema, peça desculpas e convide para nova visita
- Se a nota for alta (4-5): reforçe o que fizeram bem e convide para voltar
- Tom profissional mas humano, em português brasileiro
- Não use emojis excessivos
- Assine como "Equipe ${company.business_name}"

Escreva APENAS o texto da resposta, sem explicações adicionais.`
}

async function callClaude(anthropicKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

type SupaClient = ReturnType<typeof createClient>

async function notifyMarketing(chatId: number | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ?? null, data }),
  }).catch(() => {})
}

// Publica uma resposta direto no Google Business Profile (mesmo caminho do
// reply-google-review, mas por service-role, para o modo automático do cron).
async function publishReplyToGBP(admin: SupaClient, companyId: string, reviewId: string, googleReviewId: string, replyText: string, clientId?: string, clientSecret?: string): Promise<boolean> {
  try {
    const { data: integration } = await admin.from('company_integrations')
      .select('access_token, refresh_token, token_expires_at, metadata')
      .eq('company_id', companyId).eq('type', 'google_business_profile').maybeSingle()
    if (!integration) return false
    const meta = integration.metadata as { account_id?: string; location_id?: string }
    if (!meta?.account_id || !meta?.location_id) return false

    let accessToken = integration.access_token
    const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : new Date(0)
    if (expiresAt < new Date(Date.now() + 60_000) && integration.refresh_token && clientId && clientSecret) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: integration.refresh_token, grant_type: 'refresh_token' }),
      })
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json()
        accessToken = refreshed.access_token
        await admin.from('company_integrations').update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
        }).eq('company_id', companyId).eq('type', 'google_business_profile')
      }
    }

    const reviewName = `accounts/${meta.account_id}/locations/${meta.location_id}/reviews/${googleReviewId}`
    const replyRes = await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, {
      method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: replyText.trim() }),
    })
    if (!replyRes.ok) { console.error('auto-reply GBP error:', await replyRes.text()); return false }
    await admin.from('reviews').update({ owner_reply: replyText.trim(), responded_at: new Date().toISOString() }).eq('id', reviewId)
    return true
  } catch (e) { console.error('publishReplyToGBP error:', e); return false }
}

async function draftPendingReviewReplies(admin: SupaClient, anthropicKey: string, companyId: string, autoReply: boolean, clientId?: string, clientSecret?: string): Promise<{ drafted: number; negative: number; stale: number; published: number }> {
  const { data: opps } = await admin
    .from('opportunities')
    .select('id, ref_id, type')
    .eq('company_id', companyId)
    .eq('ref_type', 'review')
    .eq('status', 'open')
    .is('ai_draft', null)

  let drafted = 0, negative = 0, stale = 0, published = 0
  for (const opp of opps ?? []) {
    if (!opp.ref_id) continue
    try {
      const { data: company } = await admin.from('companies').select('business_name, business_type, city').eq('id', companyId).single()
      const { data: review } = await admin.from('reviews').select('author, rating, text, review_date, google_review_id').eq('id', opp.ref_id).single()
      if (!company || !review) continue
      const draft = await callClaude(anthropicKey, buildReviewReplyPrompt(company, review))
      await admin.from('opportunities').update({ ai_draft: draft }).eq('id', opp.id)
      drafted++
      if (opp.type === 'negative_review') negative++
      else if (opp.type === 'unanswered_review') stale++

      if (autoReply && review.google_review_id) {
        const ok = await publishReplyToGBP(admin, companyId, opp.ref_id as string, review.google_review_id as string, draft, clientId, clientSecret)
        if (ok) {
          published++
          await admin.from('opportunities').update({ status: 'acted_on' }).eq('id', opp.id)
        }
      }
    } catch (e) {
      console.error(`draft-reply cron: opportunity ${opp.id} error:`, e)
    }
  }
  return { drafted, negative, stale, published }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')

    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurado.' }, 503)

    const admin = createClient(supabaseUrl, serviceKey)

    // Cron mode: auto-draft replies for every open review-type opportunity, across all active companies
    const bodyForCron = req.method === 'POST' ? await req.json().catch(() => ({})) as Record<string, unknown> : {}
    if (cronSecretEnv && bodyForCron.cron_secret === cronSecretEnv) {
      const { data: companies } = await admin.from('companies').select('id, telegram_chat_id, notification_prefs, auto_reply_reviews').eq('active', true)
      let total = 0
      for (const c of companies ?? []) {
        const r = await draftPendingReviewReplies(admin, anthropicKey, c.id, !!c.auto_reply_reviews, clientId, clientSecret)
        total += r.drafted
        if (r.drafted > 0) {
          const prefs = (c.notification_prefs as Record<string, boolean> | null) ?? {}
          if (prefs.agent_actions !== false) {
            const reasonParts: string[] = []
            if (r.negative > 0) reasonParts.push(`${r.negative} avaliação(ões) negativa(s) sem resposta`)
            if (r.stale > 0) reasonParts.push(`${r.stale} avaliação(ões) parada(s) há +14 dias sem resposta`)
            const published = r.published > 0 ? ` — ${r.published} publicada(s) automaticamente no Google` : ''
            notifyMarketing(c.telegram_chat_id as number | null, c.id as string, 'AGENT_ACTION', {
              action: r.published > 0 ? 'replies_published' : 'replies_drafted',
              count: r.drafted,
              reason: (reasonParts.join(' e ') || 'avaliações sem resposta detectadas') + published,
            })
          }
        }
      }
      return json({ ok: true, cron: true, companies: companies?.length ?? 0, drafted: total })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { opportunity_id } = bodyForCron as { opportunity_id?: string }
    if (!opportunity_id) return json({ error: 'opportunity_id é obrigatório' }, 400)

    const { data: company } = await admin
      .from('companies')
      .select('id, business_name, business_type, city')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    const { data: opp } = await admin
      .from('opportunities')
      .select('*')
      .eq('id', opportunity_id)
      .eq('company_id', company.id)
      .maybeSingle()

    if (!opp) return json({ error: 'Oportunidade não encontrada.' }, 404)

    if (opp.ai_draft) return json({ ok: true, draft: opp.ai_draft })

    let prompt = ''

    if (opp.ref_type === 'review' && opp.ref_id) {
      const { data: review } = await admin
        .from('reviews')
        .select('author, rating, text, review_date, source')
        .eq('id', opp.ref_id)
        .single()

      if (!review) return json({ error: 'Review não encontrada.' }, 404)

      prompt = buildReviewReplyPrompt(company, review)
    } else if (opp.type === 'low_engagement') {
      prompt = `Você é consultor de marketing digital para ${company.business_name}.

O engajamento no Instagram está abaixo do ideal (${opp.description}).

Escreva 3 sugestões práticas e específicas para aumentar o engajamento, considerando o tipo de negócio: ${company.business_type ?? 'estabelecimento'}.

Formato: lista numerada, máximo 2 linhas por sugestão. Em português brasileiro.`
    } else {
      prompt = `Para o negócio ${company.business_name}, sugira uma ação concreta para resolver esta situação: ${opp.title}. ${opp.description ?? ''}

Seja direto e prático. Máximo 3 frases. Em português brasileiro.`
    }

    let draft: string
    try {
      draft = await callClaude(anthropicKey, prompt)
    } catch (e) {
      return json({ error: String(e) }, 502)
    }

    await admin.from('opportunities').update({ ai_draft: draft }).eq('id', opportunity_id)

    return json({ ok: true, draft })
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
