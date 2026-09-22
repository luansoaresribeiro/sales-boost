/**
 * strategy-generate — Agente de Estratégia / Hermes: lê o estado dos 9
 * domínios do Data Agent e decide a UMA tese estratégica principal da
 * empresa (nunca duas ao mesmo tempo — criar uma nova enquanto existe uma
 * ativa é um PIVÔ consciente, a antiga vira histórico via status:'paused').
 * Adaptado do framework "Hermes — Strategic Intelligence, Planning &
 * Decision Engine" (colado pelo dono 2026-09-21): diagnostica constraint +
 * oportunidade cruzando os domínios, escreve a tese no formato "porque
 * [evidência], acreditamos [hipótese]. por isso vamos [abordagem] por
 * [horizonte] pra alcançar [objetivo]", só ativa os componentes
 * necessários, define exclusões e condições de sucesso/fracasso.
 *
 * Fonte de verdade: a edge function `data-agent` (chamada aqui internamente
 * via cron_secret, nunca as tabelas brutas direto) — mesmo padrão que
 * hermes-proxy já usa pra consultar o Data Agent.
 *
 * `reanalyze` é o Strategy Health Check + Review (botão "Reavaliar",
 * monitoramento manual — sem cron automático nesta fase, pedido do dono):
 * relê o DELTA do Data Agent desde a última atualização da estratégia e
 * decide CONTINUE (não grava nada) ou REFINE/PIVOT/TERMINATE (grava UMA
 * recomendação em marketing_ai_strategy_log com decision_type). Regra do
 * produto (human-in-the-loop) sobrepõe o "Hermes decide" do framework
 * colado: aqui Hermes sempre só RECOMENDA — status fica 'proposed' até o
 * dono aprovar, nunca aplica sozinho.
 *
 * Interativo só: JWT do dono.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
type SupaClient = ReturnType<typeof createClient>

interface Company {
  id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null
  business_description: string | null; ideal_customer: string | null; business_stage: string | null
  main_challenges: string | null; website_summary: string | null; marketing_monthly_budget: number | null
  avg_ticket: number | null
}

function round1(n: number): string { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') }
function fmtNum(n: number): string { return Math.round(n).toLocaleString('pt-BR') }

// Mesmo padrão de creative-generate's fetchRealStat — nunca inventa número.
// Continua existindo pra alimentar o baseline_verified das metas (o Data
// Agent não devolve esse detalhe granular por goal_type).
async function fetchRealBaseline(admin: SupaClient, companyId: string): Promise<{ engagementPct: number | null; reach: number | null; followers: number | null; label: string } | null> {
  const { data } = await admin.from('instagram_performance_snapshots').select('followers, engagement_rate, reach').eq('company_id', companyId).order('captured_for', { ascending: false }).limit(1).maybeSingle()
  const d = data as { followers: number | null; engagement_rate: number | null; reach: number | null } | null
  if (!d) return null
  const parts: string[] = []
  if (d.engagement_rate != null && d.engagement_rate > 0) parts.push(`engajamento ${round1(d.engagement_rate)}%`)
  if (d.reach != null && d.reach > 0) parts.push(`alcance ${fmtNum(d.reach)}`)
  if (d.followers != null && d.followers > 0) parts.push(`${fmtNum(d.followers)} seguidores`)
  if (!parts.length) return null
  return { engagementPct: d.engagement_rate, reach: d.reach, followers: d.followers, label: parts.join(', ') }
}

// Chama a função data-agent internamente (cron_secret, mesmo padrão que
// hermes-proxy já usa) — é a fonte de verdade dos 9 domínios, nunca
// re-consultamos as tabelas brutas aqui.
async function fetchDataAgentState(
  supabaseUrl: string, cronSecret: string, companyId: string, kind: 'state' | 'delta', since?: string,
): Promise<{ domains: Array<{ domain: string; summary: string; metrics: Record<string, unknown>; signals: unknown[] }> } | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/data-agent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, cron_secret: cronSecret, company_id: companyId, ...(since ? { since } : {}) }),
    })
    const data = await res.json()
    if (!res.ok || data.error) return null
    return data
  } catch { return null }
}

function formatDomains(state: { domains: Array<{ domain: string; summary: string; signals: unknown[] }> } | null): string {
  if (!state || !state.domains.length) return 'Data Agent ainda sem dado suficiente em nenhum domínio.'
  return state.domains.map(d => {
    const sigs = (d.signals as Array<{ key: string; evidence: string[]; business_relevance: string }>) ?? []
    const sigLines = sigs.length ? sigs.map(s => `    · [${s.business_relevance}] ${s.key}: ${s.evidence.join('; ')}`).join('\n') : '    (sem sinal real ainda)'
    return `- ${d.domain.toUpperCase()}: ${d.summary}\n${sigLines}`
  }).join('\n')
}

async function callClaude(anthropicKey: string, prompt: string, maxTokens = 2400): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude: ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}
function parseObj(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { /* */ }
  const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) } catch { /* */ } }
  return {}
}

const GOAL_TYPES = ['lead_gen', 'sales', 'acquisition', 'awareness', 'instagram_growth', 'engagement', 'website_conversions', 'whatsapp', 'bookings', 'retention', 'other']
const COMPONENTS = ['positioning', 'offer', 'acquisition', 'content', 'conversion', 'customer_service', 'retention', 'reactivation', 'reputation', 'competitive_response', 'digital_infrastructure']

function businessPreamble(company: Company, cfg: { brand_voice?: string; target_audience?: string; content_pillars?: string[]; marketing_goals?: string }): string {
  return `Negócio: "${company.business_name}" (${company.business_type ?? 'tipo não informado'}) em ${company.city ?? 'Brasil'}.
O que o negócio faz: ${company.business_description ?? 'não informado'}.
Cliente ideal: ${company.ideal_customer ?? cfg.target_audience ?? 'não informado'}.
Fase do negócio: ${company.business_stage ?? 'não informada'}.
Maior desafio citado pelo dono: ${company.main_challenges ?? 'não informado'}.
Objetivo principal do dono: ${company.goal ?? cfg.marketing_goals ?? 'não informado'}.
Ticket médio: ${company.avg_ticket ? `R$ ${company.avg_ticket}` : 'não informado'}.
Orçamento de marketing mensal informado pelo dono: ${company.marketing_monthly_budget ? `R$ ${company.marketing_monthly_budget}` : 'não informado'}.
${company.website_summary ? `Resumo real do site (lido pela IA): ${company.website_summary}` : 'Site ainda não foi lido/resumido.'}`
}

async function generateStrategy(
  admin: SupaClient, supabaseUrl: string, cronSecret: string, anthropicKey: string,
  company: Company, kind: 'main' | 'initiative', parentStrategyId: string | null,
): Promise<Record<string, unknown>> {
  const [{ data: cfgRow }, dataAgentState, baseline] = await Promise.all([
    admin.from('marketing_ai_config').select('brand_voice, target_audience, content_pillars, marketing_goals').eq('company_id', company.id).maybeSingle(),
    fetchDataAgentState(supabaseUrl, cronSecret, company.id, 'state'),
    fetchRealBaseline(admin, company.id),
  ])
  const cfg = (cfgRow ?? {}) as { brand_voice?: string; target_audience?: string; content_pillars?: string[]; marketing_goals?: string }

  let parentContext = ''
  if (kind === 'initiative' && parentStrategyId) {
    const { data: parent } = await admin.from('marketing_ai_strategies').select('name, primary_business_objective, strategic_focus, thesis').eq('id', parentStrategyId).maybeSingle()
    if (parent) parentContext = `\nEssa é uma INICIATIVA dentro da estratégia principal "${parent.name}" (tese: ${parent.thesis ?? parent.strategic_focus ?? '—'}) — a iniciativa precisa servir essa tese, não competir com ela.`
  }

  const prompt = `Você é Hermes, o motor de inteligência estratégica e decisão do Sales Boost — não um gerador de conteúdo, não um gestor de anúncios: você decide em QUE o negócio deve focar agora, por quê, por quanto tempo, e o que NÃO fazer.

Sua fonte de verdade são os 9 domínios do Data Agent (Business/Customer/Market/Competition/Digital/Content/History/Resources/Performance). Não analise os domínios isolados — procure relações entre eles antes de decidir (ex: concorrente compete por preço + cliente reclama de preço + negócio tem margem melhor em serviço premium + histórico mostra que desconto atraiu cliente ruim + performance mostra que cliente premium tem LTV maior ⇒ a resposta não é baixar preço, é reposicionar por valor).

${businessPreamble(company, cfg)}
${parentContext}

ESTADO ATUAL DOS 9 DOMÍNIOS (Data Agent):
${formatDomains(dataAgentState)}
${baseline ? `\nDADO REAL de performance atual (NÃO invente outro número — use exatamente este quando relevante): ${baseline.label}.` : '\nAinda não há dado real de performance coletado — trate qualquer número de baseline como DESCONHECIDO, nunca assuma 0 nem invente um valor.'}

REGRAS CRÍTICAS:
- NUNCA invente taxa de conversão, CPC, CPM, CAC, ROAS ou qualquer métrica histórica que não foi te dada acima. Quando precisar supor algo, rotule dentro do texto (reasoning/assumptions) com um destes níveis de confiança: VERIFICADO (veio de dado real acima), INFORMADO_PELO_DONO, OBSERVADO (sinal do Data Agent), ESTIMADO, INFERIDO, ou DESCONHECIDO — nunca apresente estimativa como fato.
- NUNCA garanta um resultado. Use faixas/estimativas com a incerteza explícita.
- Diagnostique a RESTRIÇÃO PRINCIPAL primeiro (o que está travando o crescimento agora — não assuma automaticamente que é "falta de conteúdo" ou "falta de anúncio"; pode ser posicionamento fraco, oferta fraca, conversão fraca, retenção fraca, etc.) e a OPORTUNIDADE ESTRATÉGICA (a coisa de maior impacto que o Sales Boost consegue realmente influenciar agora).
- A TESE precisa seguir o formato: "Porque [evidência], acreditamos [hipótese]. Por isso, vamos [abordagem] por [horizonte] pra alcançar [objetivo]." — baseada em evidência real acima, nunca genérica.
- Só ative os COMPONENTES necessários pra essa tese (não ative os 11 automaticamente): ${COMPONENTS.join(', ')}.
- Defina EXCLUSÕES explícitas — o que o Sales Boost NÃO vai fazer agora e por quê (evita diluição estratégica).
- Metas: no máximo 3, "goal_type" sendo um destes: ${GOAL_TYPES.join('|')}. NÃO preencha baseline — isso é calculado à parte com dado real.
- Orçamento: só proponha valores SE o dono já informou orçamento mensal acima; caso contrário, campos null e explique em "budget_reasoning" que falta essa informação.
- Cadência de revisão: campanha/tática rápida = "semanal"; estratégia ampla = "2-4 semanas".
- Horizonte: normalmente 1-6 meses — escolha com base no tipo de negócio/ciclo de venda, nunca um número fixo padrão; justifique.
- Seja específico ao negócio — nunca genérico ("poste mais", "use hashtags") sem conectar ao que foi dito sobre esse negócio específico.

Retorne APENAS um JSON:
{
  "name": "nome curto da estratégia",
  "thesis": "Porque [evidência], acreditamos [hipótese]. Por isso, vamos [abordagem] por [horizonte] pra alcançar [objetivo].",
  "primary_constraint": "a restrição principal que trava o crescimento agora, com a evidência",
  "strategic_opportunity": "a oportunidade de maior impacto que dá pra perseguir agora",
  "primary_business_objective": "",
  "primary_marketing_objective": "",
  "strategic_focus": "1 frase",
  "horizon": "ex: 90 dias",
  "review_cadence": "semanal|2-4 semanas",
  "reasoning": "por que essa estratégia, 2-4 frases, linguagem simples pra dono não-especialista",
  "assumptions": ["...", "..."],
  "constraints": ["...", "..."],
  "exclusions": ["o que não vamos fazer agora, e por quê", "..."],
  "active_components": ["só os necessários, escolha dentre: ${COMPONENTS.join('|')}"],
  "success_conditions": "que evidência mostraria que está funcionando",
  "failure_conditions": "que evidência mostraria que não está funcionando",
  "funnel_plan": [{"stage":"awareness|consideration|conversion|retention","objective":"","audience":"","message":"","format":"","cta":"","destination":"","metric":"","dependencies":"","horizon":""}],
  "goals": [{"name":"","goal_type":"","target_value":null,"period":"daily|weekly|monthly|custom","deadline":null,"priority":"high|medium|low","data_source":"","measurement_method":""}],
  "budget": {"total":null,"currency":"BRL","period":"monthly","paid_ads":null,"organic":null,"creative":null,"other":null,"is_flexible":true,"allocation":[{"channel":"","amount":null,"reason":""}],"budget_reasoning":""},
  "estimates": {"time_to_signals":"","time_to_progress":"","time_to_target":"","confidence":"high|medium|low","risks":"","feasibility_status":"supports_plan|needs_more_data|needs_adjustment|significant_constraints","feasibility_reasoning":""},
  "campaign_draft": {"name":"","goal":""}
}`

  // Nunca salva uma estratégia vazia por causa de uma resposta que falhou em
  // parsear — 1 retry, e se continuar sem o essencial (nome+tese), erro de
  // verdade em vez de gravar lixo silenciosamente (bug real encontrado
  // 2026-09-22: uma linha ficou "ativa" com tudo null, e o auto-criar nunca
  // tentava de novo porque já via uma estratégia "existente").
  let raw = await callClaude(anthropicKey, prompt, 4500)
  let parsed = parseObj(raw)
  if (!parsed.name || !parsed.thesis) {
    raw = await callClaude(anthropicKey, prompt, 4500)
    parsed = parseObj(raw)
  }
  if (!parsed.name || !parsed.thesis) {
    console.error('strategy-generate: resposta não parseável mesmo após retry. Últimos 800 chars:', raw.slice(-800))
    throw new Error('A IA não conseguiu gerar uma estratégia completa — tente de novo em instantes.')
  }

  // Baseline real só entra se bater com um goal_type que temos dado de verdade.
  const goals = (Array.isArray(parsed.goals) ? parsed.goals : []) as Record<string, unknown>[]
  const goalsWithBaseline = goals.slice(0, 3).map(g => {
    const goalType = GOAL_TYPES.includes(String(g.goal_type)) ? String(g.goal_type) : 'other'
    let baselineValue: number | null = null
    let baselineVerified = false
    if (baseline && (goalType === 'instagram_growth' || goalType === 'engagement' || goalType === 'awareness')) {
      if (goalType === 'engagement' && baseline.engagementPct != null) { baselineValue = baseline.engagementPct; baselineVerified = true }
      else if (baseline.followers != null) { baselineValue = baseline.followers; baselineVerified = true }
      else if (baseline.reach != null) { baselineValue = baseline.reach; baselineVerified = true }
    }
    return {
      name: String(g.name ?? '').slice(0, 200) || 'Meta', goal_type: goalType,
      baseline_value: baselineValue, baseline_verified: baselineVerified,
      target_value: typeof g.target_value === 'number' ? g.target_value : null,
      period: g.period ? String(g.period) : null,
      deadline: g.deadline ? String(g.deadline) : null,
      priority: ['high', 'medium', 'low'].includes(String(g.priority)) ? String(g.priority) : 'medium',
      data_source: g.data_source ? String(g.data_source) : null,
      measurement_method: g.measurement_method ? String(g.measurement_method) : null,
    }
  })

  return { parsed, goals: goalsWithBaseline, baselineFound: !!baseline }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: companyRow } = await admin.from('companies')
      .select('id, business_name, business_type, city, goal, business_description, ideal_customer, business_stage, main_challenges, website_summary, marketing_monthly_budget, avg_ticket')
      .eq('user_id', user.id).maybeSingle()
    const company = companyRow as Company | null
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action ?? 'generate')

    if (action === 'generate') {
      const kind = body.kind === 'initiative' ? 'initiative' : 'main'
      const parentId = body.parent_strategy_id ? String(body.parent_strategy_id) : null
      if (kind === 'initiative' && !parentId) return json({ error: 'Falta a estratégia principal pra vincular essa iniciativa.' }, 400)
      // Gera ANTES de pausar a antiga — se a geração falhar, a estratégia
      // atual continua ativa em vez de a empresa ficar sem nenhuma.
      const { parsed, goals, baselineFound } = await generateStrategy(admin, supabaseUrl, cronSecret, anthropicKey, company, kind, parentId)
      if (kind === 'main') {
        // Hermes mantém UMA tese estratégica principal ativa por vez — criar
        // uma nova é um pivô consciente (a anterior vira histórico, nunca
        // some). O frontend já confirma isso com o dono antes de chamar aqui.
        await admin.from('marketing_ai_strategies').update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('company_id', company.id).eq('kind', 'main').eq('status', 'active')
      }

      const activeComponents = (Array.isArray(parsed.active_components) ? parsed.active_components : []).filter((c: unknown) => COMPONENTS.includes(String(c)))
      const { data: inserted, error: insErr } = await admin.from('marketing_ai_strategies').insert({
        company_id: company.id, kind, parent_strategy_id: parentId,
        name: String(parsed.name ?? (kind === 'main' ? 'Estratégia principal' : 'Nova iniciativa')),
        status: 'active', created_by: 'ai',
        thesis: parsed.thesis ? String(parsed.thesis) : null,
        primary_constraint: parsed.primary_constraint ? String(parsed.primary_constraint) : null,
        strategic_opportunity: parsed.strategic_opportunity ? String(parsed.strategic_opportunity) : null,
        primary_business_objective: parsed.primary_business_objective ? String(parsed.primary_business_objective) : null,
        primary_marketing_objective: parsed.primary_marketing_objective ? String(parsed.primary_marketing_objective) : null,
        strategic_focus: parsed.strategic_focus ? String(parsed.strategic_focus) : null,
        horizon: parsed.horizon ? String(parsed.horizon) : null,
        review_cadence: parsed.review_cadence ? String(parsed.review_cadence) : null,
        reasoning: parsed.reasoning ? String(parsed.reasoning) : null,
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        exclusions: Array.isArray(parsed.exclusions) ? parsed.exclusions : [],
        active_components: activeComponents,
        success_conditions: parsed.success_conditions ? String(parsed.success_conditions) : null,
        failure_conditions: parsed.failure_conditions ? String(parsed.failure_conditions) : null,
        funnel_plan: Array.isArray(parsed.funnel_plan) ? parsed.funnel_plan : [],
        budget: parsed.budget && typeof parsed.budget === 'object' ? parsed.budget : {},
        estimates: parsed.estimates && typeof parsed.estimates === 'object' ? parsed.estimates : {},
        data_provenance: { baseline_source: baselineFound ? 'instagram_performance_snapshots' : 'nenhum dado real ainda — metas sem baseline verificado', source: 'data-agent' },
      }).select('id').single()
      if (insErr) throw new Error(insErr.message)

      if (goals.length) {
        await admin.from('marketing_ai_strategy_goals').insert(goals.map(g => ({ ...g, strategy_id: inserted.id })))
      }

      // Rascunho de campanha — NUNCA publica, só grava a intenção (status 'planned').
      const campaignDraft = parsed.campaign_draft as { name?: string; goal?: string } | undefined
      if (campaignDraft?.name) {
        const budgetObj = parsed.budget as { paid_ads?: number | null } | undefined
        await admin.from('marketing_ai_campaigns').insert({
          company_id: company.id, name: String(campaignDraft.name).slice(0, 200), goal: campaignDraft.goal ? String(campaignDraft.goal) : null,
          budget: budgetObj?.paid_ads ?? null, status: 'planned',
        })
      }

      return json({ ok: true, strategy_id: inserted.id })
    }

    if (action === 'reanalyze') {
      const strategyId = String(body.strategy_id ?? '')
      const { data: strategy } = await admin.from('marketing_ai_strategies').select('*').eq('id', strategyId).eq('company_id', company.id).maybeSingle()
      if (!strategy) return json({ error: 'Estratégia não encontrada.' }, 404)
      const { data: goalRows } = await admin.from('marketing_ai_strategy_goals').select('*').eq('strategy_id', strategyId)
      const [delta, baseline] = await Promise.all([
        fetchDataAgentState(supabaseUrl, cronSecret, company.id, 'delta', String(strategy.updated_at)),
        fetchRealBaseline(admin, company.id),
      ])

      const prompt = `Você é Hermes fazendo o Strategy Health Check de uma tese já ativa — decida se ela continua sustentada pela evidência ou se precisa de ajuste. Novidade não muda a estratégia automaticamente: só muda se a evidência realmente invalidar a tese.

Estratégia ativa: "${strategy.name}"
Tese: ${strategy.thesis ?? strategy.strategic_focus ?? '—'}
Restrição principal identificada: ${strategy.primary_constraint ?? '—'}
Oportunidade perseguida: ${strategy.strategic_opportunity ?? '—'}
Condições de sucesso: ${strategy.success_conditions ?? '—'}
Condições de fracasso: ${strategy.failure_conditions ?? '—'}
Metas atuais: ${JSON.stringify((goalRows ?? []).map((g: Record<string, unknown>) => ({ name: g.name, goal_type: g.goal_type, target: g.target_value, baseline: g.baseline_value, progress: g.current_progress })))}
${baseline ? `Dado real ATUAL: ${baseline.label}.` : 'Ainda sem dado real de performance coletado.'}

O QUE MUDOU nos 9 domínios desde a última atualização (Data Agent, delta):
${formatDomains(delta)}

Decida:
1. STRATEGY_STATUS: ON_TRACK | NEEDS_ADJUSTMENT | UNDERPERFORMING | AT_RISK | INVALIDATED
2. DECISION: CONTINUE | REFINE | PIVOT | TERMINATE (só REFINE/PIVOT/TERMINATE geram recomendação pro dono — CONTINUE significa "sem sinal forte o bastante pra mudar nada agora")
Não conclua que a estratégia toda falhou por causa de 1 sinal fraco isolado — considere volume de evidência, não ruído de curto prazo.

Retorne APENAS um JSON: {"status": "ON_TRACK|NEEDS_ADJUSTMENT|UNDERPERFORMING|AT_RISK|INVALIDATED", "decision": "continue|refine|pivot|terminate", "recommendation": "1-3 frases, o que mudar (vazio se decision=continue)", "reasoning": "por que, citando os sinais reais ou a falta deles"}`

      const raw = await callClaude(anthropicKey, prompt, 900)
      const parsed = parseObj(raw)
      const decision = String(parsed.decision ?? 'continue')
      if (decision !== 'continue' && parsed.recommendation) {
        await admin.from('marketing_ai_strategy_log').insert({
          company_id: company.id, strategy_id: strategyId, decision_type: decision,
          recommendation: String(parsed.recommendation), reasoning: String(parsed.reasoning ?? ''), status: 'proposed',
        })
        return json({ ok: true, needs_adjustment: true, status: parsed.status, decision })
      }
      return json({ ok: true, needs_adjustment: false, status: parsed.status ?? null, reasoning: parsed.reasoning ? String(parsed.reasoning) : null })
    }

    if (action === 'update_goal') {
      const goalId = String(body.goal_id ?? '')
      const patch = body.patch as Record<string, unknown>
      // Confere que a meta pertence a uma estratégia dessa empresa antes de aceitar o update.
      const { data: ownerCheck } = await admin.from('marketing_ai_strategy_goals').select('id, strategy_id, marketing_ai_strategies!inner(company_id)').eq('id', goalId).maybeSingle()
      const owned = (ownerCheck as { marketing_ai_strategies?: { company_id?: string } } | null)?.marketing_ai_strategies?.company_id === company.id
      if (!owned) return json({ error: 'Meta não encontrada.' }, 404)
      const allowed = ['name', 'goal_type', 'target_value', 'period', 'deadline', 'priority', 'data_source', 'measurement_method', 'current_progress', 'status']
      const safePatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const k of allowed) if (k in (patch ?? {})) safePatch[k] = patch[k]
      const { error } = await admin.from('marketing_ai_strategy_goals').update(safePatch).eq('id', goalId)
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    if (action === 'update_strategy') {
      const strategyId = String(body.strategy_id ?? '')
      const patch = body.patch as Record<string, unknown>
      const allowed = [
        'name', 'status', 'thesis', 'primary_constraint', 'strategic_opportunity',
        'primary_business_objective', 'primary_marketing_objective', 'strategic_focus', 'horizon', 'review_cadence',
        'assumptions', 'constraints', 'exclusions', 'active_components', 'success_conditions', 'failure_conditions',
        'funnel_plan', 'budget',
      ]
      const safePatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const k of allowed) if (k in (patch ?? {})) safePatch[k] = patch[k]
      const { error } = await admin.from('marketing_ai_strategies').update(safePatch).eq('id', strategyId).eq('company_id', company.id)
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (err) {
    console.error('strategy-generate error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
