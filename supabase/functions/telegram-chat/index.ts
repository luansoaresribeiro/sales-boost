import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

const MAX_HISTORY = 10
type SupaClient = ReturnType<typeof createClient>

const TOOLS = [
  { name: 'create_post', description: 'Cria um rascunho de post para aprovação. NUNCA publica diretamente.', input_schema: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] }, image_suggestion: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } },
  { name: 'create_multiple_posts', description: 'Cria vários rascunhos de uma vez. Use para semana de conteúdo.', input_schema: { type: 'object', properties: { posts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] }, image_suggestion: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } } }, required: ['posts'] } },
  { name: 'get_business_overview', description: 'Resumo completo do negócio: perfil, contagens de posts por status, avaliações (total/média/sem resposta), oportunidades abertas.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_posts', description: 'Lista posts com filtro opcional por status (rascunho/aprovado/publicado).', input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['rascunho', 'aprovado', 'publicado'] }, limit: { type: 'number' } } } },
  { name: 'list_opportunities', description: 'Lista oportunidades de receita detectadas (leads, avaliações negativas, etc.).', input_schema: { type: 'object', properties: { status: { type: 'string', description: 'Ex: open. Omita para todas.' } } } },
  { name: 'list_reviews', description: 'Lista avaliações do Google com filtros.', input_schema: { type: 'object', properties: { rating_max: { type: 'number', description: 'Nota máxima (ex: 2 para 1-2★)' }, unanswered_only: { type: 'boolean', description: 'Somente sem resposta do dono' }, limit: { type: 'number' } } } },
  { name: 'get_latest_diagnostic', description: 'Diagnóstico mais recente do site: performance, SEO, acessibilidade, resumo da IA.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_competitors', description: 'Concorrentes mapeados no Google Maps com nota, reviews e nível de preço.', input_schema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'list_leads', description: 'Lista leads do CRM de vendas.', input_schema: { type: 'object', properties: { stage: { type: 'string' }, limit: { type: 'number' } } } },
]

const TOOL_CAP: Record<string, string> = {
  create_post: 'tg_content', create_multiple_posts: 'tg_content',
  get_business_overview: 'tg_overview', list_posts: 'tg_posts',
  list_opportunities: 'tg_opportunities', list_reviews: 'tg_reviews',
  get_latest_diagnostic: 'tg_diagnostic', list_competitors: 'tg_competitors',
  list_leads: 'tg_leads',
}

interface TgConfig {
  personality: string
  disabled: Set<string>
  ai_paused: boolean
  paused_reply: string
  active_hours_enabled: boolean
  active_start: number
  active_end: number
  timezone: string
  outside_hours_reply: string
}

async function getTelegramConfig(admin: SupaClient): Promise<TgConfig> {
  const [{ data: cfg }, { data: caps }] = await Promise.all([
    admin.from('telegram_agent_config').select('personality, ai_paused, paused_reply, active_hours_enabled, active_start, active_end, timezone, outside_hours_reply').eq('id', true).maybeSingle(),
    admin.from('capability_registry').select('id, enabled').contains('used_by', ['telegram']),
  ])
  const disabled = new Set<string>()
  for (const c of (caps ?? []) as { id: string; enabled: boolean }[]) if (!c.enabled) disabled.add(c.id)
  const c = (cfg ?? {}) as Record<string, unknown>
  return {
    personality: (c.personality as string) ?? '',
    disabled,
    ai_paused: (c.ai_paused as boolean) ?? false,
    paused_reply: (c.paused_reply as string) ?? 'Um atendente humano vai te responder por aqui em instantes.',
    active_hours_enabled: (c.active_hours_enabled as boolean) ?? false,
    active_start: (c.active_start as number) ?? 8,
    active_end: (c.active_end as number) ?? 20,
    timezone: (c.timezone as string) ?? 'America/Sao_Paulo',
    outside_hours_reply: (c.outside_hours_reply as string) ?? 'Estamos fora do horário de atendimento agora. Retornamos assim que possível!',
  }
}

function currentHourInTz(tz: string): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date())
    return parseInt(s, 10) % 24
  } catch { return new Date().getUTCHours() }
}

function isOutsideActiveHours(cfg: TgConfig): boolean {
  const h = currentHourInTz(cfg.timezone)
  const inside = cfg.active_start <= cfg.active_end
    ? (h >= cfg.active_start && h < cfg.active_end)
    : (h >= cfg.active_start || h < cfg.active_end)
  return !inside
}

async function runTool(tu: { name: string; id: string; input: unknown }, companyId: string, admin: SupaClient, disabled: Set<string>): Promise<{ result: string; posts: number }> {
  const inp = tu.input as Record<string, unknown>

  if (TOOL_CAP[tu.name] && disabled.has(TOOL_CAP[tu.name])) {
    return { result: 'Essa ação foi desativada pelo administrador no Agents Control Center.', posts: 0 }
  }

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
    let q = admin.from('posts').select('id, content, platform, status, best_time, created_at', { count: 'exact' }).eq('company_id', companyId)
    if (inp.status) q = q.eq('status', inp.status as string)
    const { data, count } = await q.order('created_at', { ascending: false }).limit(Number(inp.limit ?? 10))
    return { result: JSON.stringify({ total_matching: count ?? (data ?? []).length, returned: (data ?? []).length, items: data ?? [] }), posts: 0 }
  }

  if (tu.name === 'list_opportunities') {
    let q = admin.from('opportunities').select('type, title, description, value_estimate, status', { count: 'exact' }).eq('company_id', companyId)
    if (inp.status) q = q.eq('status', inp.status as string)
    const { data, count } = await q.order('created_at', { ascending: false }).limit(20)
    return { result: JSON.stringify({ total_matching: count ?? (data ?? []).length, returned: (data ?? []).length, items: data ?? [] }), posts: 0 }
  }

  if (tu.name === 'list_reviews') {
    let q = admin.from('reviews').select('author, rating, text, sentiment, review_date, owner_reply', { count: 'exact' }).eq('company_id', companyId)
    if (inp.rating_max) q = q.lte('rating', Number(inp.rating_max))
    if (inp.unanswered_only) q = q.is('owner_reply', null)
    const { data, count } = await q.order('review_date', { ascending: false }).limit(Number(inp.limit ?? 10))
    return { result: JSON.stringify({ total_matching: count ?? (data ?? []).length, returned: (data ?? []).length, items: data ?? [] }), posts: 0 }
  }

  if (tu.name === 'get_latest_diagnostic') {
    try {
      const { data } = await admin.from('diagnostics').select('website_url, status, created_at, pagespeed_mobile, pagespeed_desktop, frontend_review').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!data) return { result: JSON.stringify({ message: 'Nenhum diagnóstico encontrado.' }), posts: 0 }
      const ps_m = data.pagespeed_mobile as Record<string, unknown> | null
      const ps_d = data.pagespeed_desktop as Record<string, unknown> | null
      const fr = data.frontend_review as Record<string, unknown> | null
      return { result: JSON.stringify({ website_url: data.website_url, status: data.status, created_at: data.created_at, mobile: { performance: ps_m?.performance, seo: ps_m?.seo }, desktop: { performance: ps_d?.performance, seo: ps_d?.seo }, ai_score: fr?.score, ai_summary: fr?.summary }), posts: 0 }
    } catch { return { result: JSON.stringify({ message: 'Diagnóstico indisponível.' }), posts: 0 } }
  }

  if (tu.name === 'list_competitors') {
    try {
      const { data } = await admin.from('competitors').select('name, rating, review_count, distance_m, price_level').eq('company_id', companyId).order('distance_m', { ascending: true }).limit(Number(inp.limit ?? 10))
      return { result: JSON.stringify(data ?? []), posts: 0 }
    } catch { return { result: JSON.stringify({ message: 'Dados de concorrentes indisponíveis.' }), posts: 0 } }
  }

  if (tu.name === 'list_leads') {
    let q = admin.from('leads').select('id, name, contact, channel, stage, value_estimate, last_contact_at, notes, created_at', { count: 'exact' }).eq('company_id', companyId)
    if (inp.stage) q = q.eq('stage', inp.stage as string)
    const { data, count } = await q.order('created_at', { ascending: false }).limit(Number(inp.limit ?? 50))
    return { result: JSON.stringify({ total_matching: count ?? (data ?? []).length, returned: (data ?? []).length, items: data ?? [] }), posts: 0 }
  }

  return { result: `Ferramenta desconhecida: ${tu.name}`, posts: 0 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const secret = req.headers.get('x-webhook-secret')
    const envSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    if (envSecret && secret !== envSecret) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json() as Record<string, unknown>

    let chat_id: number | undefined
    let message: string | undefined
    let bot_type = 'marketing'

    if (body.message && typeof body.message === 'object') {
      const telegramMessage = body.message as Record<string, unknown>
      const chat = telegramMessage.chat as Record<string, unknown> | undefined
      chat_id = chat?.id as number | undefined
      message = telegramMessage.text as string | undefined
    } else if (typeof body === 'object' && 'chat_id' in body) {
      chat_id = body.chat_id as number | undefined
      message = body.message as string | undefined
      bot_type = (body.bot_type as string) ?? 'marketing'
    }

    if (!chat_id || !message) return json({ error: 'chat_id e message são obrigatórios' }, 400)

    const { data: company } = await admin.from('companies')
      .select('id, business_name, business_type, city, goal, ai_profile')
      .eq('telegram_chat_id', chat_id)
      .single()

    if (!company) {
      return json({ reply: 'Para usar o chat, primeiro conecte sua conta com /conectar CÓDIGO.\nGere seu código em: https://sales-boost-restaurants.luancontasecundaria22.workers.dev/dashboard/configuracoes' })
    }

    let { data: conv } = await admin.from('telegram_conversations')
      .select('id')
      .eq('telegram_chat_id', String(chat_id))
      .eq('bot_type', bot_type)
      .single()

    if (!conv) {
      const { data: newConv } = await admin.from('telegram_conversations').insert({
        customer_id: company.id,
        bot_type,
        telegram_chat_id: String(chat_id),
        status: 'active',
        context: {},
      }).select('id').single()
      conv = newConv
    }

    const { data: history } = await admin.from('telegram_messages')
      .select('role, content')
      .eq('conversation_id', conv!.id)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY)

    const historyMessages = (history ?? []).reverse().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const baseContext = [
      `Você é um assistente do Sales Boost.`,
      company.business_type ? `Tipo de negócio: ${company.business_type}` : '',
      company.city ? `Cidade: ${company.city}` : '',
      company.goal ? `Objetivo: ${company.goal}` : '',
      company.ai_profile ? `Perfil da empresa: ${company.ai_profile}` : '',
    ].filter(Boolean).join('\n')

    const roleContext = bot_type === 'vendas'
      ? 'Você é um assistente de vendas. Ajude com dúvidas sobre planos, preços, cases de sucesso e funcionalidades da plataforma. Seja amigável, direto e persuasivo.'
      : 'Você é um assistente de marketing. Ajude com estratégias de conteúdo, análise de avaliações, concorrentes, posts e crescimento de negócio.'

    const toolsNote = `\n\nVocê tem acesso a dados reais da plataforma — NUNCA diga que não tem acesso a informações em tempo real, e NUNCA invente ou estime um número. Antes de responder QUALQUER pergunta sobre posts, oportunidades, avaliações, diagnóstico do site, concorrentes ou leads — mesmo que ache que já sabe a resposta pelo histórico da conversa — use PRIMEIRO a ferramenta correspondente:\nget_business_overview, list_posts, list_opportunities, list_reviews, get_latest_diagnostic, list_competitors, list_leads.\n\nRegra de contagem: para responder "quantos/quantas X", use o campo total_matching que a ferramenta retorna — NUNCA conte os itens da lista "items" você mesmo, porque ela pode vir cortada (só uma amostra) e o total_matching é sempre o número exato e completo. Se o total_matching não existir (como em get_business_overview), use o campo de contagem já pronto ali (posts.total, openOpportunities, reviews.total).\n\nPara criar conteúdo de verdade (não só descrever), use create_post ou create_multiple_posts — nunca publica sozinho, tudo vira rascunho pra aprovação.`

    const cfg = await getTelegramConfig(admin)
    const disabled = cfg.disabled
    const activeTools = TOOLS.filter(t => !(TOOL_CAP[t.name] && disabled.has(TOOL_CAP[t.name])))
    const personalityNote = cfg.personality ? `\nPersonalidade definida pelo administrador (siga sempre): ${cfg.personality}` : ''

    const systemPrompt = [baseContext, roleContext, personalityNote, toolsNote, '', 'Responda de forma direta e útil via Telegram. Seja conciso. Sem markdown (sem **, ##, listas com marcadores) — texto corrido, como se estivesse falando.'].join('\n')

    let convo: unknown[] = [...historyMessages, { role: 'user', content: message }]
    let reply = ''
    let postsCreated = 0

    // Human handoff: IA pausada → responde com a mensagem de atendente humano.
    // Fora do horário de atendimento → auto-resposta.
    if (cfg.ai_paused) {
      reply = cfg.paused_reply
    } else if (cfg.active_hours_enabled && isOutsideActiveHours(cfg)) {
      reply = cfg.outside_hours_reply
    }

    if (!reply) for (let i = 0; i < 5; i++) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, tools: activeTools, messages: convo }),
      })

      if (!claudeRes.ok) {
        console.error('Claude error', await claudeRes.text())
        reply = 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.'
        break
      }

      const claudeData = await claudeRes.json()
      const blocks = claudeData.content ?? []
      const toolUses = blocks.filter((b: { type: string }) => b.type === 'tool_use')

      if (toolUses.length === 0) {
        reply = blocks.filter((b: { type: string }) => b.type === 'text').map((b: { text?: string }) => b.text ?? '').join('\n')
        break
      }

      convo.push({ role: 'assistant', content: blocks })
      const toolResults = []
      for (const tu of toolUses) {
        const { result, posts } = await runTool(tu as { name: string; id: string; input: unknown }, company.id, admin, disabled)
        postsCreated += posts
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
      }
      convo.push({ role: 'user', content: toolResults })
    }

    if (!reply) reply = postsCreated > 0 ? `Criei ${postsCreated} rascunho(s). Disponíveis na aba Posts para aprovação.` : 'Não consegui gerar uma resposta.'

    if (conv) {
      await admin.from('telegram_messages').insert([
        { conversation_id: conv.id, role: 'user', content: message },
        { conversation_id: conv.id, role: 'assistant', content: reply },
      ])
    }

    const sendMessageRes = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat_id, text: reply }),
    })

    if (!sendMessageRes.ok) {
      console.error('Telegram send error:', await sendMessageRes.text())
      return json({ error: 'Falha ao enviar mensagem para Telegram' }, 500)
    }

    return json({ ok: true, reply, postsCreated })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
