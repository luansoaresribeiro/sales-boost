import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

interface Company { id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null }
interface TavilyResult { title: string; url: string; content: string }

const CATEGORIES = ['evento', 'sazonal', 'feriado', 'tendencia', 'parceria', 'influenciador', 'concorrente', 'setor', 'opiniao']

async function tavilySearch(apiKey: string, query: string): Promise<TavilyResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: 'basic', max_results: 8, include_answer: false, topic: 'general' }),
  })
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.results ?? []).map((r: Record<string, unknown>) => ({ title: String(r.title ?? ''), url: String(r.url ?? ''), content: String(r.content ?? '') }))
}

async function distill(anthropicKey: string, company: Company, results: TavilyResult[]): Promise<Record<string, unknown>[]> {
  const local = company.city ?? 'a região'
  const prompt = `Você é o analista de inteligência de mercado de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${local}). Objetivo do dono: ${company.goal ?? 'crescer'}.

Abaixo estão resultados reais de busca na web — parte é sobre eventos/tendências, parte é sobre o que clientes reais estão comentando/reclamando/elogiando nesse segmento. Extraia oportunidades externas concretas e úteis pra esse negócio nas próximas semanas:
- eventos locais, datas comemorativas, tendências do segmento, possíveis parcerias, movimentos relevantes (categorias: evento/sazonal/feriado/tendencia/parceria/influenciador/concorrente/setor)
- opiniões/sentimento real de clientes sobre esse tipo de negócio — reclamações recorrentes, elogios recorrentes, dúvidas frequentes, o que pesa na decisão de compra (categoria: "opiniao" — vira insight só quando dá pra transformar em ação real, ex: "clientes reclamam de demora no atendimento" → ação: reforçar tempo de resposta na comunicação)
Ignore o que for irrelevante ou genérico. Se nada for útil, retorne [].

Resultados:
${results.map((r, i) => `[${i}] ${r.title} — ${r.content.slice(0, 240)} (${r.url})`).join('\n')}

Retorne APENAS um array JSON (sem markdown), no máximo 8 itens, cada um:
{ "category": um de ${JSON.stringify(CATEGORIES)}, "opportunity": "título curto e claro", "why": "por que importa pra esse negócio", "impact": "impacto estimado em 1 frase", "action": "ação concreta sugerida", "priority": "high"|"medium"|"low", "confidence": 0-100, "time_window": "quando agir (ex: próximas 2 semanas)", "source_index": índice do resultado usado (número) }

Nunca invente evento/data/opinião que não esteja nos resultados. Seja honesto no confidence.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const data = await res.json()
  const raw = (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
  try { return JSON.parse(raw) } catch {
    const m = raw.match(/\[[\s\S]*\]/)
    if (m) { try { return JSON.parse(m[0]) } catch { return [] } }
    return []
  }
}

async function collectForCompany(admin: SupaClient, company: Company, env: Record<string, string | undefined>, force: boolean): Promise<{ inserted: number; skipped?: string }> {
  // Memory-first: não re-coleta se já tem insight fresco (< 7 dias).
  if (!force) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin.from('external_insights').select('id', { count: 'exact', head: true }).eq('company_id', company.id).gte('created_at', weekAgo)
    if ((count ?? 0) > 0) return { inserted: 0, skipped: 'insights ainda frescos (< 7 dias)' }
  }

  const { data: src } = await admin.from('insight_sources').select('enabled').eq('type', 'tavily').eq('enabled', true).maybeSingle()
  if (!src) return { inserted: 0, skipped: 'fonte Tavily desligada' }
  if (!env.TAVILY_API_KEY) return { inserted: 0, skipped: 'TAVILY_API_KEY não configurada' }
  if (!env.ANTHROPIC_API_KEY) return { inserted: 0, skipped: 'ANTHROPIC_API_KEY não configurada' }

  // Duas buscas: eventos/tendências (já existia) + opiniões reais sobre o
  // segmento (nova — "o que os clientes acham") — mesma fonte (Tavily), só
  // amplia o que a IA tem pra ler antes de destilar os insights.
  const eventsQuery = `${company.business_type ?? 'negócio local'} em ${company.city ?? 'Brasil'}: eventos locais, datas comemorativas, tendências do segmento e oportunidades de marketing nas próximas semanas`
  const opinionsQuery = `o que clientes reais falam sobre ${company.business_type ?? 'esse tipo de negócio'}: reclamações comuns, elogios recorrentes, dúvidas frequentes, comparações com concorrentes`
  const [eventsResults, opinionsResults] = await Promise.all([
    tavilySearch(env.TAVILY_API_KEY, eventsQuery),
    tavilySearch(env.TAVILY_API_KEY, opinionsQuery).catch(() => []),
  ])
  const results = [...eventsResults, ...opinionsResults]
  if (results.length === 0) return { inserted: 0, skipped: 'busca sem resultados' }

  const items = await distill(env.ANTHROPIC_API_KEY, company, results)
  if (items.length === 0) return { inserted: 0, skipped: 'nada relevante extraído' }

  const rows = items.slice(0, 8).map(it => {
    const idx = Number(it.source_index)
    const url = Number.isInteger(idx) && results[idx] ? results[idx].url : null
    const category = CATEGORIES.includes(String(it.category)) ? String(it.category) : 'setor'
    return {
      company_id: company.id, category, opportunity: String(it.opportunity ?? '').slice(0, 240),
      why: it.why ? String(it.why) : null, impact: it.impact ? String(it.impact) : null, action: it.action ? String(it.action) : null,
      priority: ['high', 'medium', 'low'].includes(String(it.priority)) ? String(it.priority) : 'medium',
      confidence: Math.max(0, Math.min(100, Number(it.confidence) || 70)), time_window: it.time_window ? String(it.time_window) : null,
      source: 'tavily', url,
    }
  }).filter(r => r.opportunity)

  // Substitui o lote anterior (refresh) pra não acumular.
  await admin.from('external_insights').delete().eq('company_id', company.id)
  if (rows.length) await admin.from('external_insights').insert(rows)
  return { inserted: rows.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const env = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'), ANON: Deno.env.get('SUPABASE_ANON_KEY'),
      SERVICE: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'),
      TAVILY_API_KEY: Deno.env.get('TAVILY_API_KEY'), CRON_SECRET: Deno.env.get('CRON_SECRET'),
    }
    const admin = createClient(env.SUPABASE_URL!, env.SERVICE ?? env.ANON!)
    // Fallback: se a secret não estiver no ambiente, lê do _app_config (mesmo
    // lugar seguro onde o cron_secret já mora). Permite ligar sem redeploy.
    if (!env.TAVILY_API_KEY) {
      const { data: cfg } = await admin.from('_app_config').select('value').eq('key', 'tavily_api_key').maybeSingle()
      if (cfg?.value) env.TAVILY_API_KEY = String(cfg.value)
    }
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = env.CRON_SECRET && body.cron_secret === env.CRON_SECRET
    const force = body.force === true

    const FIELDS = 'id, business_name, business_type, city, goal'

    if (isCron) {
      const { data: companies } = await admin.from('companies').select(FIELDS).eq('active', true)
      let processed = 0, inserted = 0
      for (const c of (companies ?? []) as Company[]) {
        try { const r = await collectForCompany(admin, c, env, force); processed++; inserted += r.inserted } catch (e) { console.error('insights-collect', c.id, e) }
      }
      return json({ ok: true, cron: true, processed, inserted })
    }

    // Interativo: cliente pedindo os insights da própria empresa.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(env.SUPABASE_URL!, env.ANON!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: company } = await admin.from('companies').select(FIELDS).eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

    const r = await collectForCompany(admin, company as Company, env, force || body.force === undefined)
    return json({ ok: true, ...r })
  } catch (err) {
    console.error('insights-collect error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
