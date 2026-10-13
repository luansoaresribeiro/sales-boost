import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requirePaidAccess } from '../_shared/access.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_LIMITS: Record<string, number> = { free: 30, basic: 150, pro: Infinity }

type AgentRole = 'cmo' | 'sales'
type AIProvider = 'anthropic' | 'openai' | 'grok' | 'gemini'

interface AgentConfig {
  name: string; title: string; emoji: string
  provider: AIProvider; model: string
  buildPrompt: (c: Company) => string
}

interface Company {
  id: string; business_name: string; business_type: string | null
  city: string | null; instagram_url: string | null; goal: string | null
  plan?: string | null; social_data?: Record<string, unknown>
  agent_messages_used?: number; agent_messages_reset_at?: string
  google_rating?: number | null; google_review_count?: string | null
}

// ── Reporter note appended to every system prompt ─────────────────────
const REPORTER_NOTE = `

Você também é o REPÓRTER do negócio. Quando o dono perguntar sobre o estado atual — avaliações, posts, oportunidades, diagnóstico, concorrentes — use PRIMEIRO as ferramentas de leitura para buscar dados reais antes de responder:
• get_business_overview — resumo completo (perfil + posts/reviews/oportunidades)
• list_posts — listar posts filtrando por status (rascunho/aprovado/publicado)
• list_opportunities — oportunidades abertas detectadas
• list_reviews — avaliações com filtros (negativas, sem resposta do dono)
• get_latest_diagnostic — performance e SEO do site
• list_competitors — concorrentes mapeados

Regra permanente: NUNCA publique nem envie nada sem aprovação explícita do dono.

FORMATAÇÃO OBRIGATÓRIA: Responda sempre em texto corrido, sem markdown. Proibido usar **, __, ##, ---, tabelas, listas com marcadores ou hífens. Escreva em frases naturais e parágrafos curtos, como se estivesse falando em voz alta. Sem emojis desnecessários.`

// ── Agent roster ───────────────────────────────────────────────────────
const AGENTS: Record<AgentRole, AgentConfig> = {
  cmo: {
    name: 'Agente de Marketing', title: 'Marketing', emoji: '📣',
    provider: 'anthropic', model: 'claude-haiku-4-5-20251001',
    buildPrompt: (c) => {
      const ig = (c.social_data as Record<string, unknown> | undefined)?.instagram as Record<string, unknown> | undefined
      const igCtx = ig ? `\nInstagram: ${ig.followers} seguidores, ${ig.avg_likes} curtidas/post, ${ig.engagement_rate}% engajamento.` : ''
      return `Você é o Agente de Marketing do ${c.business_name} (${c.business_type ?? 'negócio'} em ${c.city ?? 'Brasil'}).${igCtx}

Você cria conteúdo que gera engajamento e atrai clientes. Objetivo: ${c.goal ?? 'crescer'}.

SEMPRE use ferramentas para criar conteúdo — nunca apenas descreva, FAÇA:
- Um post específico → use create_post
- Semana de conteúdo → use create_multiple_posts (5 posts variados)

Após criar, mencione que estão na aba Posts para aprovação.`
    },
  },

  sales: {
    name: 'Agente de Vendas', title: 'Vendas', emoji: '💼',
    provider: 'anthropic', model: 'claude-sonnet-4-6',
    buildPrompt: (c) => `Você é o Agente de Vendas do ${c.business_name} (${c.business_type ?? 'negócio'} em ${c.city ?? 'Brasil'}).

Você nunca deixa um lead escapar. Rascunha mensagens de follow-up personalizadas e converte contatos em clientes. Quando pedirem mensagens para leads, use create_post com plataforma 'whatsapp'.

Escreva como um vendedor experiente: direto, amigável e persuasivo. Todo conteúdo vai para aprovação antes de ser enviado.`,
  },
}

// ── Tools ─────────────────────────────────────────────────────────────
const tools = [
  // Write
  { name: 'create_post', description: 'Cria um rascunho de post para aprovação. NUNCA publica diretamente.', input_schema: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] }, image_suggestion: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } },
  { name: 'create_multiple_posts', description: 'Cria vários rascunhos de uma vez. Use para semana de conteúdo.', input_schema: { type: 'object', properties: { posts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] }, image_suggestion: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } } }, required: ['posts'] } },
  // Reporter (read-only)
  { name: 'get_business_overview', description: 'Resumo completo do negócio: perfil, contagens de posts por status, avaliações (total/média/sem resposta), oportunidades abertas.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_posts', description: 'Lista posts com filtro opcional por status (rascunho/aprovado/publicado).', input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['rascunho', 'aprovado', 'publicado'] }, limit: { type: 'number' } } } },
  { name: 'list_opportunities', description: 'Lista oportunidades de receita detectadas (leads, avaliações negativas, etc.).', input_schema: { type: 'object', properties: { status: { type: 'string', description: 'Ex: open. Omita para todas.' } } } },
  { name: 'list_reviews', description: 'Lista avaliações do Google com filtros.', input_schema: { type: 'object', properties: { rating_max: { type: 'number', description: 'Nota máxima (ex: 2 para 1-2★)' }, unanswered_only: { type: 'boolean', description: 'Somente sem resposta do dono' }, limit: { type: 'number' } } } },
  { name: 'get_latest_diagnostic', description: 'Diagnóstico mais recente do site: performance, SEO, acessibilidade, resumo da IA.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_competitors', description: 'Concorrentes mapeados no Google Maps com nota, reviews e nível de preço.', input_schema: { type: 'object', properties: { limit: { type: 'number' } } } },
]

// ── AI router ──────────────────────────────────────────────────────────
type AIResponse = { content: { type: string; id?: string; text?: string; name?: string; input?: unknown }[] }
async function callAI(provider: AIProvider, model: string, system: string, messages: unknown[], agentTools: unknown[]): Promise<AIResponse> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 2048, system, tools: agentTools, messages }),
    })
    if (!res.ok) throw new Error(`Anthropic: ${await res.text()}`)
    return res.json()
  }
  if (provider === 'openai') {
    const key = Deno.env.get('OPENAI_API_KEY'); if (!key) throw new Error('OPENAI_API_KEY not set')
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...(messages as object[])] }) })
    if (!res.ok) throw new Error(`OpenAI: ${await res.text()}`)
    const d = await res.json(); return { content: [{ type: 'text', text: d.choices[0].message.content }] }
  }
  if (provider === 'grok') {
    const key = Deno.env.get('GROK_API_KEY'); if (!key) throw new Error('GROK_API_KEY not set')
    const res = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...(messages as object[])] }) })
    if (!res.ok) throw new Error(`Grok: ${await res.text()}`)
    const d = await res.json(); return { content: [{ type: 'text', text: d.choices[0].message.content }] }
  }
  if (provider === 'gemini') {
    const key = Deno.env.get('GEMINI_API_KEY'); if (!key) throw new Error('GEMINI_API_KEY not set')
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: system + '\n\n' + (messages[messages.length - 1] as { content: string }).content }] }] }) })
    if (!res.ok) throw new Error(`Gemini: ${await res.text()}`)
    const d = await res.json(); return { content: [{ type: 'text', text: d.candidates[0].content.parts[0].text }] }
  }
  throw new Error(`Unknown provider: ${provider}`)
}

// ── Tool executor ─────────────────────────────────────────────────────
type SupaClient = ReturnType<typeof createClient>
async function runTool(tu: { name: string; id: string; input: unknown }, companyId: string, admin: SupaClient): Promise<{ result: string; posts: number }> {
  const inp = tu.input as Record<string, unknown>

  if (tu.name === 'create_post') {
    await admin.from('posts').insert({ company_id: companyId, content: inp.content, platform: inp.platform ?? 'instagram', image_suggestion: inp.image_suggestion ?? null, best_time: inp.best_time ?? null, status: 'rascunho' })
    return { result: 'Post criado como rascunho. Disponível na aba Posts para aprovação.', posts: 1 }
  }

  if (tu.name === 'create_multiple_posts') {
    let count = 0
    for (const p of (inp.posts as Record<string, unknown>[]) ?? []) {
      await admin.from('posts').insert({ company_id: companyId, content: p.content, platform: p.platform ?? 'instagram', image_suggestion: p.image_suggestion ?? null, best_time: p.best_time ?? null, status: 'rascunho' })
      count++
    }
    return { result: `${count} posts criados como rascunho. Disponíveis na aba Posts para aprovação.`, posts: count }
  }

  if (tu.name === 'get_business_overview') {
    const [coRes, postsRes, oppsRes, revRes] = await Promise.all([
      admin.from('companies').select('business_name, business_type, city, goal, plan, google_rating, google_review_count, instagram_url').eq('id', companyId).single(),
      admin.from('posts').select('status').eq('company_id', companyId),
      admin.from('opportunities').select('id').eq('company_id', companyId).eq('status', 'open'),
      admin.from('reviews').select('rating, owner_reply').eq('company_id', companyId),
    ])
    const byStatus = (postsRes.data ?? []).reduce((acc: Record<string, number>, p: { status: string }) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc }, {})
    const revs = revRes.data ?? []
    const avgRating = revs.length ? (revs.reduce((s: number, r: { rating: number }) => s + (r.rating ?? 0), 0) / revs.length).toFixed(1) : null
    const unanswered = revs.filter((r: { owner_reply: unknown }) => !r.owner_reply).length
    return { result: JSON.stringify({ profile: coRes.data, posts: { total: (postsRes.data ?? []).length, byStatus }, openOpportunities: (oppsRes.data ?? []).length, reviews: { total: revs.length, avgRating, unanswered } }), posts: 0 }
  }

  if (tu.name === 'list_posts') {
    let q = admin.from('posts').select('id, content, platform, status, best_time, created_at').eq('company_id', companyId)
    if (inp.status) q = q.eq('status', inp.status as string)
    const { data } = await q.order('created_at', { ascending: false }).limit(Number(inp.limit ?? 10))
    return { result: JSON.stringify(data ?? []), posts: 0 }
  }

  if (tu.name === 'list_opportunities') {
    let q = admin.from('opportunities').select('type, title, description, value_estimate, status').eq('company_id', companyId)
    if (inp.status) q = q.eq('status', inp.status as string)
    const { data } = await q.order('created_at', { ascending: false }).limit(20)
    return { result: JSON.stringify(data ?? []), posts: 0 }
  }

  if (tu.name === 'list_reviews') {
    let q = admin.from('reviews').select('author, rating, text, sentiment, review_date, owner_reply').eq('company_id', companyId)
    if (inp.rating_max) q = q.lte('rating', Number(inp.rating_max))
    if (inp.unanswered_only) q = q.is('owner_reply', null)
    const { data } = await q.order('review_date', { ascending: false }).limit(Number(inp.limit ?? 10))
    return { result: JSON.stringify(data ?? []), posts: 0 }
  }

  if (tu.name === 'get_latest_diagnostic') {
    try {
      const { data } = await admin.from('diagnostics').select('website_url, status, created_at, pagespeed_mobile, pagespeed_desktop, frontend_review').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!data) return { result: JSON.stringify({ message: 'Nenhum diagnóstico encontrado.' }), posts: 0 }
      const ps_m = data.pagespeed_mobile as Record<string, unknown> | null
      const ps_d = data.pagespeed_desktop as Record<string, unknown> | null
      const fr  = data.frontend_review  as Record<string, unknown> | null
      return { result: JSON.stringify({ website_url: data.website_url, status: data.status, created_at: data.created_at, mobile: { performance: ps_m?.performance, seo: ps_m?.seo }, desktop: { performance: ps_d?.performance, seo: ps_d?.seo }, ai_score: fr?.score, ai_summary: fr?.summary }), posts: 0 }
    } catch { return { result: JSON.stringify({ message: 'Diagnóstico indisponível.' }), posts: 0 } }
  }

  if (tu.name === 'list_competitors') {
    try {
      const { data } = await admin.from('competitors').select('name, rating, review_count, distance_m, price_level').eq('company_id', companyId).order('distance_m', { ascending: true }).limit(Number(inp.limit ?? 10))
      return { result: JSON.stringify(data ?? []), posts: 0 }
    } catch { return { result: JSON.stringify({ message: 'Dados de concorrentes indisponíveis.' }), posts: 0 } }
  }

  return { result: `Ferramenta desconhecida: ${tu.name}`, posts: 0 }
}

// ── Main handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey

    if (!Deno.env.get('ANTHROPIC_API_KEY')) {
      return json({ ok: true, reply: 'Agente não configurado. Configure ANTHROPIC_API_KEY no Supabase.', postsCreated: 0 })
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json()
    const { message, history } = body
    const agentRole: AgentRole = body.agent_role ?? 'cmo'
    if (!message) return json({ error: 'message é obrigatório' }, 400)

    const agent = AGENTS[agentRole] ?? AGENTS.cmo
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: company } = await admin
      .from('companies')
      .select('id, business_name, business_type, city, instagram_url, goal, plan, agent_messages_used, agent_messages_reset_at, social_data, social_scraped_at, google_rating, google_review_count')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Empresa não encontrada. Complete o onboarding primeiro.' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id)
    if (noPlan) return noPlan

    // Monthly reset
    const resetAt   = new Date(company.agent_messages_reset_at)
    const now       = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    let usedThisMonth = company.agent_messages_used
    if (resetAt < monthStart) {
      await admin.from('companies').update({ agent_messages_used: 0, agent_messages_reset_at: monthStart.toISOString() }).eq('id', company.id)
      usedThisMonth = 0
    }

    // Rate limit
    const plan  = company.plan ?? 'free'
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
    if (limit - usedThisMonth <= 0) return json({ error: 'rate_limit', plan, limit, used: usedThisMonth, remaining: 0 }, 429)

    // ── Agentic loop (max 5 turns) ──────────────────────────────────
    const systemPrompt = agent.buildPrompt(company as Company) + REPORTER_NOTE
    let convo: unknown[] = [...(history ?? []), { role: 'user', content: message }]
    let reply = ''
    let postsCreated = 0

    for (let i = 0; i < 5; i++) {
      const aiRes  = await callAI(agent.provider, agent.model, systemPrompt, convo, tools)
      const blocks = aiRes.content ?? []
      const toolUses = blocks.filter(b => b.type === 'tool_use')

      if (toolUses.length === 0) {
        reply = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n')
        break
      }

      convo.push({ role: 'assistant', content: blocks })
      const toolResults = []
      for (const tu of toolUses) {
        const { result, posts } = await runTool(tu as { name: string; id: string; input: unknown }, company.id, admin)
        postsCreated += posts
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
      }
      convo.push({ role: 'user', content: toolResults })
    }

    if (!reply) reply = postsCreated > 0 ? `Criei ${postsCreated} rascunho(s). Disponíveis na aba Posts para aprovação.` : 'Feito!'

    await Promise.all([
      admin.from('companies').update({ agent_messages_used: usedThisMonth + 1 }).eq('id', company.id),
      admin.from('agent_messages').insert([
        { company_id: company.id, role: 'user',      content: message, agent_role: agentRole },
        { company_id: company.id, role: 'assistant', content: reply,   agent_role: agentRole },
      ]),
    ])

    return json({ ok: true, reply, postsCreated, agent: { role: agentRole, name: agent.name, emoji: agent.emoji }, usage: { used: usedThisMonth + 1, limit, remaining: limit - usedThisMonth - 1 } })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
