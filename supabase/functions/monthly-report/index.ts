import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Company {
  id: string
  business_name: string
  language: string
  telegram_chat_id: string
}

interface MonthlyData {
  postsCreated: number
  postsPublished: number
  reviewsReceived: number
  avgRating: number | null
  opportunitiesDetected: number
  opportunitiesResolved: number
  agentInteractions: number
}

async function getMonthlyData(
  db: ReturnType<typeof createClient>,
  companyId: string,
  monthStart: string,
  monthEnd: string,
): Promise<MonthlyData> {
  const [postsRes, reviewsRes, oppRes, msgRes] = await Promise.all([
    db.from('posts').select('status', { count: 'exact' })
      .eq('company_id', companyId)
      .gte('created_at', monthStart).lt('created_at', monthEnd),
    db.from('reviews').select('rating')
      .eq('company_id', companyId)
      .gte('created_at', monthStart).lt('created_at', monthEnd),
    db.from('opportunities').select('status', { count: 'exact' })
      .eq('company_id', companyId)
      .gte('created_at', monthStart).lt('created_at', monthEnd),
    db.from('agent_messages').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('role', 'assistant')
      .gte('created_at', monthStart).lt('created_at', monthEnd),
  ])

  const posts = postsRes.data ?? []
  const postsCreated = posts.length
  const postsPublished = posts.filter((p: { status: string }) => p.status === 'publicado').length

  const reviews = reviewsRes.data ?? []
  const reviewsReceived = reviews.length
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null

  const opps = oppRes.data ?? []
  const opportunitiesDetected = opps.length
  const opportunitiesResolved = opps.filter((o: { status: string }) => o.status === 'resolved').length

  const agentInteractions = msgRes.count ?? 0

  return { postsCreated, postsPublished, reviewsReceived, avgRating, opportunitiesDetected, opportunitiesResolved, agentInteractions }
}

async function generateReportText(
  company: Company,
  data: MonthlyData,
  monthLabel: string,
  anthropicKey: string,
): Promise<string> {
  const lang = company.language === 'en' ? 'en' : 'pt'

  const promptPT = `Você é o assistente de IA da plataforma Sales Boost. Gere um relatório mensal sucinto e motivador para o negócio "${company.business_name}", referente ao mês de ${monthLabel}.

Dados do mês:
- Posts criados: ${data.postsCreated} (${data.postsPublished} publicados)
- Avaliações recebidas: ${data.reviewsReceived}${data.avgRating !== null ? ` (média: ${data.avgRating}★)` : ''}
- Oportunidades detectadas: ${data.opportunitiesDetected} (${data.opportunitiesResolved} resolvidas)
- Interações com agente IA: ${data.agentInteractions}

Escreva uma mensagem de Telegram (sem HTML, sem markdown, texto puro) com:
1. Cabeçalho com nome do negócio e mês
2. Resumo dos resultados com emojis
3. 1-2 insights ou dicas para o próximo mês
4. Encerramento motivador

Máximo 250 palavras. Seja direto e positivo.`

  const promptEN = `You are the AI assistant for the Sales Boost platform. Generate a concise, motivating monthly report for the business "${company.business_name}" for the month of ${monthLabel}.

Month data:
- Posts created: ${data.postsCreated} (${data.postsPublished} published)
- Reviews received: ${data.reviewsReceived}${data.avgRating !== null ? ` (avg: ${data.avgRating}★)` : ''}
- Opportunities detected: ${data.opportunitiesDetected} (${data.opportunitiesResolved} resolved)
- AI agent interactions: ${data.agentInteractions}

Write a Telegram message (no HTML, no markdown, plain text) with:
1. Header with business name and month
2. Results summary with emojis
3. 1-2 insights or tips for next month
4. Motivating closing

Maximum 250 words. Be direct and positive.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: lang === 'en' ? promptEN : promptPT }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return (d.content?.[0]?.text ?? '').trim()
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram sendMessage failed: ${err}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500)
    if (!telegramToken) return json({ error: 'TELEGRAM_BOT_TOKEN not set' }, 500)

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const isCron = cronSecret && (body as Record<string, string>)?.cron_secret === cronSecret

    // Manual call: require owner JWT
    if (!isCron) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: { user }, error: userErr } = await userClient.auth.getUser()
      if (userErr || !user) return json({ error: 'Unauthorized' }, 401)
      const admin = createClient(supabaseUrl, serviceKey)
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
      if (roleRow?.role !== 'owner') return json({ error: 'Forbidden' }, 403)
    }

    const db = createClient(supabaseUrl, serviceKey)

    // Determine month range (previous month by default)
    const now = new Date()
    const targetMonth = (body as Record<string, unknown>)?.month as string | undefined
    let year: number, month: number
    if (targetMonth) {
      const [y, m] = targetMonth.split('-').map(Number)
      year = y; month = m
    } else {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      year = prev.getFullYear(); month = prev.getMonth() + 1
    }
    const monthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString()
    const monthEnd = new Date(Date.UTC(year, month, 1)).toISOString()

    const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    // Fetch all companies with telegram_chat_id
    const { data: companies, error: compErr } = await db
      .from('companies')
      .select('id, business_name, language, telegram_chat_id')
      .not('telegram_chat_id', 'is', null)

    if (compErr) return json({ error: compErr.message }, 500)
    if (!companies || companies.length === 0) return json({ sent: 0, message: 'No companies with Telegram connected' })

    let sent = 0
    const errors: string[] = []

    for (const company of companies as Company[]) {
      try {
        const data = await getMonthlyData(db, company.id, monthStart, monthEnd)
        const text = await generateReportText(company, data, monthLabel, anthropicKey)
        await sendTelegram(telegramToken, company.telegram_chat_id, text)
        sent++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`monthly-report error for ${company.id}:`, msg)
        errors.push(`${company.business_name}: ${msg.slice(0, 100)}`)
      }
    }

    return json({ sent, total: companies.length, errors: errors.length > 0 ? errors : undefined })
  } catch (err) {
    console.error('monthly-report top-level error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
