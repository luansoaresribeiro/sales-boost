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

// Ficha de setor (vertical_playbooks) + respostas do onboarding, mescladas
// num bloco de texto pra injetar no prompt. Ficha vazia (caso 'generico', ou
// qualquer setor sem ficha configurada) + sem respostas = devolve '' = o
// prompt fica idêntico ao de antes desta função existir. Nunca derruba a
// geração por causa de erro no banco de fichas (try/catch).
async function fetchPlaybookBlock(db: ReturnType<typeof createClient>, verticalKey: string, playbookAnswers: Record<string, unknown> | null): Promise<string> {
  try {
    const { data } = await db.from('vertical_playbooks').select('name, config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const c = (data?.config ?? {}) as Record<string, unknown>
    const parts: string[] = []
    if (typeof c.tone === 'string' && c.tone) parts.push(`Tom de voz do setor: ${c.tone}`)
    if (Array.isArray(c.rules) && c.rules.length) parts.push(`Regras obrigatórias do setor:\n${(c.rules as string[]).map(r => `- ${r}`).join('\n')}`)
    if (c.pillars && typeof c.pillars === 'object' && Object.keys(c.pillars).length) {
      parts.push(`Pilares de conteúdo e peso sugerido: ${Object.entries(c.pillars as Record<string, number>).map(([k, v]) => `${k} ${v}%`).join(', ')}`)
    }
    if (c.hooks_by_pillar && typeof c.hooks_by_pillar === 'object' && Object.keys(c.hooks_by_pillar).length) {
      parts.push(`Ganchos de referência por pilar:\n${Object.entries(c.hooks_by_pillar as Record<string, string[]>).map(([k, arr]) => `${k}: ${arr.join('; ')}`).join('\n')}`)
    }
    if (c.ctas && typeof c.ctas === 'object' && Object.keys(c.ctas).length) {
      parts.push(`CTAs recomendados: ${Object.entries(c.ctas as Record<string, string>).map(([k, v]) => `${k} → "${v}"`).join(', ')}`)
    }
    if (c.vocabulary && typeof c.vocabulary === 'object' && Object.keys(c.vocabulary).length) {
      parts.push(`Vocabulário do setor: ${Object.entries(c.vocabulary as Record<string, string>).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
    const answers = playbookAnswers && typeof playbookAnswers === 'object'
      ? Object.entries(playbookAnswers).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
      : []
    if (answers.length) {
      parts.push(`Respostas do cadastro desta empresa (preferência real, sobrepõe qualquer padrão genérico do setor):\n${answers.map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}`)
    }
    if (!parts.length) return ''
    return `\n\nFICHA DE SETOR — "${String(data?.name ?? verticalKey)}":\n${parts.join('\n\n')}`
  } catch { return '' }
}

async function generateTrends(profile: string, anthropicKey: string, playbookBlock = ''): Promise<TrendsData> {
  const prompt = `Você é o Agente de Marketing especialista em conteúdo viral para pequenos negócios brasileiros.

Perfil da empresa:
---
${profile}
---
${playbookBlock}

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
  profile: string, name: string, goal: string, durationDays: number, channels: string[], anthropicKey: string, trendContext?: string, playbookBlock = ''
): Promise<CampaignPlan> {
  const postCount = Math.max(3, Math.min(10, Math.round(durationDays / 2)))
  const prompt = `Você é o Agente de Marketing especialista em campanhas para pequenos negócios brasileiros.

Perfil da empresa:
---
${profile}
---
${playbookBlock}
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
        .select('id, ai_profile, telegram_chat_id, notification_prefs, vertical_key, playbook_answers')
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

          const playbookBlock = await fetchPlaybookBlock(db, (c.vertical_key as string | null) ?? 'generico', c.playbook_answers as Record<string, unknown> | null)
          const trends = await generateTrends(c.ai_profile as string, anthropicKey, playbookBlock)
          const top = trends.trends[0]
          const trendContext = `${top.topic} — ${top.reason} (formato sugerido: ${top.format})`
          const plan = await generateCampaignPlan(c.ai_profile as string, `Tendência: ${top.topic}`, 'Aproveitar a tendência do momento', 7, ['Instagram', 'WhatsApp'], anthropicKey, trendContext, playbookBlock)
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

    const { data: company } = await db.from('companies').select('id, ai_profile, vertical_key, playbook_answers').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    if (!company.ai_profile) return json({ error: 'Perfil incompleto. Preencha as Configurações primeiro.' }, 400)
    const playbookBlock = await fetchPlaybookBlock(db, (company.vertical_key as string | null) ?? 'generico', company.playbook_answers as Record<string, unknown> | null)

    const type = body.type as string

    if (type === 'trends') {
      const trends = await generateTrends(company.ai_profile as string, anthropicKey, playbookBlock)
      return json(trends)
    }

    if (type === 'campaign') {
      const name = String(body.name ?? '').trim()
      const goal = String(body.goal ?? '').trim()
      const durationDays = Number(body.duration_days ?? 7)
      const channels = Array.isArray(body.channels) ? body.channels as string[] : ['Instagram', 'WhatsApp']
      if (!name || !goal) return json({ error: 'Nome e objetivo são obrigatórios.' }, 400)

      const plan = await generateCampaignPlan(company.ai_profile as string, name, goal, durationDays, channels, anthropicKey, undefined, playbookBlock)
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
