import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Trend { topic: string; reason: string; hook: string; format: string }
interface TrendsData { trends: Trend[]; hashtags: string[]; best_format: string; best_times: string[] }

interface CampaignPostDraft {
  day: number; day_name: string; theme: string; caption_hook: string
  full_caption: string; hashtags: string; format: string; channel: string; best_time: string
}
interface CampaignPlan { brief: string; posts: CampaignPostDraft[] }

async function notifyMarketing(chatId: number | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  // Sempre grava na aba Atividades, mesmo sem Telegram conectado — o envio
  // ao Telegram (dentro de log-bot-event) e so um bonus quando existe chatId.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ?? null, data }),
  }).catch(() => {})
}

async function callClaude(prompt: string, anthropicKey: string, model: string, maxTokens: number): Promise<string> {
  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    })
    if (res.ok) {
      const data = await res.json()
      return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
    }
    lastError = await res.text()
    const retryable = res.status >= 500 || res.status === 429
    if (!retryable || attempt === 3) throw new Error(`Claude API (${res.status}): ${lastError}`)
    await new Promise(r => setTimeout(r, attempt * 800))
  }
  throw new Error(`Claude API: ${lastError}`)
}

function parseJson<T>(raw: string): T | null {
  try { return JSON.parse(raw) } catch { /* fall through */ }
  const match = raw.match(/[[{][\s\S]*[\]}]/)
  if (match) { try { return JSON.parse(match[0]) } catch { /* give up */ } }
  return null
}

async function generateTrends(profile: string, anthropicKey: string): Promise<TrendsData> {
  const prompt = `Você é o Agente de Marketing especialista em conteúdo viral para pequenos negócios brasileiros.

Perfil da empresa:
---
${profile}
---

Identifique 4 tendências atuais (formatos, temas ou desafios que estão bombando agora no Instagram/WhatsApp) que fazem sentido para este negócio especificamente.

Retorne APENAS um JSON válido, sem markdown:
{
  "trends": [
    { "topic": "nome curto da tendência", "reason": "por que combina com este negócio", "hook": "frase de abertura pronta para usar no post", "format": "Reels | Carrossel | Story | Foto" }
  ],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "best_format": "explicação de 1 frase do formato que mais funciona agora para este tipo de negócio",
  "best_times": ["Terça 12h", "Sexta 19h"]
}`
  const raw = await callClaude(prompt, anthropicKey, 'claude-haiku-4-5-20251001', 1500)
  const data = parseJson<TrendsData>(raw)
  if (!data || !Array.isArray(data.trends) || data.trends.length === 0) throw new Error('Claude não gerou tendências')
  return data
}

async function generateCampaignPlan(
  profile: string, name: string, goal: string, durationDays: number, channels: string[], anthropicKey: string, trendContext?: string
): Promise<CampaignPlan> {
  const postCount = Math.max(3, Math.min(10, Math.round(durationDays / 2)))
  const prompt = `Você é o Agente de Marketing especialista em campanhas para pequenos negócios brasileiros.

Perfil da empresa:
---
${profile}
---
${trendContext ? `\nTendência do momento a usar como base da campanha:\n${trendContext}\n` : ''}
Crie um calendário de campanha chamada "${name}", com objetivo "${goal}", duração de ${durationDays} dias, usando os canais: ${channels.join(', ')}.

Crie exatamente ${postCount} posts distribuídos ao longo dos dias. Cada post precisa de legenda completa pronta para copiar e publicar (full_caption), não só um resumo.

Retorne APENAS um JSON válido, sem markdown:
{
  "brief": "resumo estratégico da campanha em 2-3 frases",
  "posts": [
    {
      "day": 1,
      "day_name": "Segunda-feira",
      "theme": "tema curto do post",
      "caption_hook": "primeira frase de impacto da legenda",
      "full_caption": "legenda completa com emojis, pronta para publicar",
      "hashtags": "#tag1 #tag2 #tag3",
      "format": "Reels | Carrossel | Story | Foto",
      "channel": "Instagram | WhatsApp",
      "best_time": "19h"
    }
  ]
}`
  const raw = await callClaude(prompt, anthropicKey, 'claude-sonnet-4-6', 6000)
  const data = parseJson<CampaignPlan>(raw)
  if (!data || !Array.isArray(data.posts) || data.posts.length === 0) throw new Error('Claude não gerou a campanha')
  return data
}

async function persistCampaign(
  db: ReturnType<typeof createClient>, companyId: string, name: string, goal: string, plan: CampaignPlan, source: 'manual' | 'auto_trend'
): Promise<number> {
  const { data: campaign, error: campaignErr } = await db.from('campaigns')
    .insert({ company_id: companyId, name, goal, brief: plan.brief, source })
    .select('id').single()
  if (campaignErr || !campaign) throw new Error(`DB (campaigns): ${campaignErr?.message}`)

  const rows = plan.posts.map(p => ({
    company_id: companyId,
    campaign_id: campaign.id,
    content: `${p.full_caption}\n\n${p.hashtags}`.trim(),
    image_suggestion: null,
    image_url: null,
    best_time: `${p.day_name} às ${p.best_time}`,
    platform: (p.channel ?? 'instagram').toLowerCase(),
    status: 'rascunho',
    agent_notes: `Campanha "${name}" — ${p.theme}`,
  }))
  const { error: postsErr } = await db.from('posts').insert(rows)
  if (postsErr) throw new Error(`DB (posts): ${postsErr.message}`)
  return rows.length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const cronSecretEnv = Deno.env.get('CRON_SECRET')

    if (!anthropicKey) return json({ error: 'Serviço indisponível.' }, 200)

    const db = createClient(supabaseUrl, serviceKey)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) as Record<string, unknown> : {}
    const isCron = cronSecretEnv && body.cron_secret === cronSecretEnv

    // Modo cron: uma vez por semana por empresa, o agente identifica a tendência
    // do momento sozinho e já monta a campanha em rascunho — sem o dono precisar
    // clicar em nada. Nunca roda se já existe pilha de rascunhos parados sem
    // aprovação (stale_draft), mesma regra usada em generate-posts, pra não
    // empilhar mais conteúdo em cima do que o dono ainda não revisou.
    if (isCron) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await db.from('companies')
        .select('id, ai_profile, telegram_chat_id, notification_prefs')
        .not('ai_profile', 'is', null)

      let created = 0, skipped = 0
      for (const c of (companies ?? [])) {
        try {
          const { data: recentCampaign } = await db.from('campaigns')
            .select('created_at').eq('company_id', c.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (recentCampaign?.created_at && recentCampaign.created_at > sevenDaysAgo) { skipped++; continue }

          const { data: openOpps } = await db.from('opportunities')
            .select('type').eq('company_id', c.id).eq('status', 'open').eq('type', 'stale_draft')
          if ((openOpps ?? []).length > 0) { skipped++; continue }

          const trends = await generateTrends(c.ai_profile as string, anthropicKey)
          const top = trends.trends[0]
          const trendContext = `${top.topic} — ${top.reason} (formato sugerido: ${top.format})`
          const plan = await generateCampaignPlan(c.ai_profile as string, `Tendência: ${top.topic}`, 'Aproveitar a tendência do momento', 7, ['Instagram', 'WhatsApp'], anthropicKey, trendContext)
          const count = await persistCampaign(db, c.id as string, `Tendência: ${top.topic}`, 'Aproveitar a tendência do momento', plan, 'auto_trend')
          created += count

          const prefs = (c.notification_prefs as Record<string, boolean> | null) ?? {}
          if (prefs.agent_actions !== false) {
            notifyMarketing(c.telegram_chat_id as number | null, c.id as string, 'AGENT_ACTION', {
              action: 'campaign_created',
              count,
              reason: `Tendência identificada: ${top.topic}`,
              sample: plan.brief,
            })
          }
        } catch (e) { console.error('content-intelligence cron company error:', e) }
      }
      return json({ ok: true, cron: true, created, skipped })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401)

    const { data: company } = await db.from('companies').select('id, ai_profile').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    if (!company.ai_profile) return json({ error: 'Perfil incompleto. Preencha as Configurações primeiro.' }, 400)

    const type = body.type as string

    if (type === 'trends') {
      const trends = await generateTrends(company.ai_profile as string, anthropicKey)
      return json(trends)
    }

    if (type === 'campaign') {
      const name = String(body.name ?? '').trim()
      const goal = String(body.goal ?? '').trim()
      const durationDays = Number(body.duration_days ?? 7)
      const channels = Array.isArray(body.channels) ? body.channels as string[] : ['Instagram', 'WhatsApp']
      if (!name || !goal) return json({ error: 'Nome e objetivo são obrigatórios.' }, 400)

      const plan = await generateCampaignPlan(company.ai_profile as string, name, goal, durationDays, channels, anthropicKey)
      await persistCampaign(db, company.id as string, name, goal, plan, 'manual')
      return json(plan)
    }

    return json({ error: 'Tipo inválido.' }, 400)
  } catch (err) {
    console.error('content-intelligence error:', err)
    return json({ error: friendlyError(err) }, 200)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function friendlyError(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  if (msg.includes('credit') || msg.includes('balance')) return 'Agente de Marketing temporariamente indisponível. Tente novamente.'
  if (msg.includes('rate') || msg.includes('429') || msg.includes('overload')) return 'Agente de Marketing muito ocupado. Tente em alguns minutos.'
  return 'Não foi possível gerar agora. Tente novamente.'
}
