/**
 * strategy-generate — Agente de Estratégia: lê o negócio + dado real
 * disponível e propõe uma estratégia (principal ou iniciativa), com metas,
 * orçamento, plano de funil e estimativa de prazo/viabilidade. Nunca inventa
 * métrica — baseline só é preenchido quando bate com um dado real coletado
 * (marketing_ai_tracking_snapshots/marketing_ai_competitors/reviews); sem
 * isso fica null ("desconhecido"), nunca 0.
 *
 * `reanalyze` é o botão "Reavaliar" (monitoramento manual, pedido do dono
 * 2026-09: sem cron automático nesta fase) — relê dado real, compara com as
 * metas, e só GRAVA UMA RECOMENDAÇÃO em marketing_ai_strategy_log (reaproveita
 * a tabela que o Aprendizado/BrainTab já lê) quando algo precisa de ajuste.
 * Nunca aplica a mudança sozinho — sempre fica 'proposed' até o dono aprovar.
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
async function fetchRealBaseline(admin: SupaClient, companyId: string): Promise<{ engagementPct: number | null; reach: number | null; followers: number | null; label: string } | null> {
  const { data } = await admin.from('marketing_ai_tracking_snapshots').select('followers, engagement_rate, avg_reach').eq('company_id', companyId).order('collected_at', { ascending: false }).limit(1).maybeSingle()
  const d = data as { followers: number | null; engagement_rate: number | null; avg_reach: number | null } | null
  if (!d) return null
  const parts: string[] = []
  if (d.engagement_rate != null && d.engagement_rate > 0) parts.push(`engajamento ${round1(d.engagement_rate)}%`)
  if (d.avg_reach != null && d.avg_reach > 0) parts.push(`alcance médio ${fmtNum(d.avg_reach)}`)
  if (d.followers != null && d.followers > 0) parts.push(`${fmtNum(d.followers)} seguidores`)
  if (!parts.length) return null
  return { engagementPct: d.engagement_rate, reach: d.avg_reach, followers: d.followers, label: parts.join(', ') }
}

async function callClaude(anthropicKey: string, prompt: string, maxTokens = 1800): Promise<string> {
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

async function generateStrategy(admin: SupaClient, anthropicKey: string, company: Company, kind: 'main' | 'initiative', parentStrategyId: string | null): Promise<Record<string, unknown>> {
  const [{ data: cfgRow }, { data: insRows }, { data: extRows }, baseline] = await Promise.all([
    admin.from('marketing_ai_config').select('brand_voice, target_audience, content_pillars, marketing_goals').eq('company_id', company.id).maybeSingle(),
    admin.from('marketing_ai_insights').select('pillar, title, description').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(8),
    admin.from('external_insights').select('category, opportunity, why, action').eq('company_id', company.id).order('created_at', { ascending: false }).limit(8),
    fetchRealBaseline(admin, company.id),
  ])
  const cfg = (cfgRow ?? {}) as { brand_voice?: string; target_audience?: string; content_pillars?: string[]; marketing_goals?: string }
  const insights = (insRows ?? []) as { pillar: string; title: string; description: string }[]
  const extInsights = (extRows ?? []) as { category: string; opportunity: string; why: string | null; action: string | null }[]

  let parentContext = ''
  if (kind === 'initiative' && parentStrategyId) {
    const { data: parent } = await admin.from('marketing_ai_strategies').select('name, primary_business_objective, strategic_focus').eq('id', parentStrategyId).maybeSingle()
    if (parent) parentContext = `\nEssa é uma INICIATIVA dentro da estratégia principal "${parent.name}" (objetivo: ${parent.primary_business_objective ?? '—'}, foco: ${parent.strategic_focus ?? '—'}) — a iniciativa precisa servir esse objetivo maior, não competir com ele.`
  }

  const prompt = `Você é o Agente de Estratégia do Sales Boost — um consultor de crescimento pra pequenos negócios. Sua função é ler o negócio e o dado real disponível e propor uma estratégia ${kind === 'main' ? 'PRINCIPAL (direção geral do período)' : 'de INICIATIVA (ação específica dentro da estratégia principal)'}.

${businessPreamble(company, cfg)}
${parentContext}
${insights.length ? `\nInsights internos abertos:\n${insights.map(i => `- [${i.pillar}] ${i.title}: ${i.description}`).join('\n')}` : ''}
${extInsights.length ? `\nOportunidades externas coletadas (web):\n${extInsights.map(i => `- [${i.category}] ${i.opportunity}${i.action ? ` — ação sugerida: ${i.action}` : ''}`).join('\n')}` : ''}
${baseline ? `\nDADO REAL de performance atual (NÃO invente outro número — use exatamente este como baseline quando relevante): ${baseline.label}.` : '\nAinda não há dado real de performance coletado (sem tracking de Instagram ainda) — trate qualquer número de baseline como DESCONHECIDO, nunca assuma 0 nem invente um valor.'}

REGRAS CRÍTICAS:
- NUNCA invente taxa de conversão, CPC, CPM, CAC, ROAS ou qualquer métrica histórica que não foi te dada acima. Se precisar de uma suposição de planejamento, marque claramente como suposição (não como dado).
- NUNCA garanta um resultado. Use faixas/estimativas com a incerteza explícita.
- Metas: proponha no máximo 3, com "goal_type" sendo um destes: ${GOAL_TYPES.join('|')}. NÃO preencha baseline — isso é calculado à parte com dado real.
- Orçamento: só proponha valores de orçamento SE o dono já informou um orçamento mensal acima; caso contrário, deixe os campos de valor null e explique em "budget_reasoning" que o dono precisa informar um orçamento antes de alocar.
- Plano de funil: 2 a 4 etapas relevantes (não precisa cobrir as 4 sempre).
- Seja específico ao negócio — nunca genérico ("poste mais", "use hashtags") sem conectar ao que foi dito sobre esse negócio específico.

Retorne APENAS um JSON:
{
  "name": "nome curto da estratégia",
  "primary_business_objective": "",
  "primary_marketing_objective": "",
  "strategic_focus": "1 frase",
  "horizon": "ex: 90 dias",
  "reasoning": "por que essa estratégia, 2-4 frases, linguagem simples pra dono não-especialista",
  "assumptions": ["...", "..."],
  "constraints": ["...", "..."],
  "funnel_plan": [{"stage":"awareness|consideration|conversion|retention","objective":"","audience":"","message":"","format":"","cta":"","destination":"","metric":"","dependencies":"","horizon":""}],
  "goals": [{"name":"","goal_type":"","target_value":null,"period":"daily|weekly|monthly|custom","deadline":null,"priority":"high|medium|low","data_source":"","measurement_method":""}],
  "budget": {"total":null,"currency":"BRL","period":"monthly","paid_ads":null,"organic":null,"creative":null,"other":null,"is_flexible":true,"allocation":[{"channel":"","amount":null,"reason":""}],"budget_reasoning":""},
  "estimates": {"time_to_signals":"","time_to_progress":"","time_to_target":"","confidence":"high|medium|low","risks":"","feasibility_status":"supports_plan|needs_more_data|needs_adjustment|significant_constraints","feasibility_reasoning":""},
  "campaign_draft": {"name":"","goal":""}
}`

  const raw = await callClaude(anthropicKey, prompt)
  const parsed = parseObj(raw)

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
      if (kind === 'main') {
        // Só 1 main ativa por vez — pausa a anterior (não apaga, guarda histórico).
        await admin.from('marketing_ai_strategies').update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('company_id', company.id).eq('kind', 'main').eq('status', 'active')
      }
      const { parsed, goals, baselineFound } = await generateStrategy(admin, anthropicKey, company, kind, parentId)

      const { data: inserted, error: insErr } = await admin.from('marketing_ai_strategies').insert({
        company_id: company.id, kind, parent_strategy_id: parentId,
        name: String(parsed.name ?? (kind === 'main' ? 'Estratégia principal' : 'Nova iniciativa')),
        status: 'active', created_by: 'ai',
        primary_business_objective: parsed.primary_business_objective ? String(parsed.primary_business_objective) : null,
        primary_marketing_objective: parsed.primary_marketing_objective ? String(parsed.primary_marketing_objective) : null,
        strategic_focus: parsed.strategic_focus ? String(parsed.strategic_focus) : null,
        horizon: parsed.horizon ? String(parsed.horizon) : null,
        reasoning: parsed.reasoning ? String(parsed.reasoning) : null,
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        funnel_plan: Array.isArray(parsed.funnel_plan) ? parsed.funnel_plan : [],
        budget: parsed.budget && typeof parsed.budget === 'object' ? parsed.budget : {},
        estimates: parsed.estimates && typeof parsed.estimates === 'object' ? parsed.estimates : {},
        data_provenance: { baseline_source: baselineFound ? 'marketing_ai_tracking_snapshots' : 'nenhum dado real ainda — metas sem baseline verificado' },
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
      const baseline = await fetchRealBaseline(admin, company.id)

      const prompt = `Você é o Agente de Estratégia reavaliando uma estratégia já ativa, com dado atualizado.

Estratégia: "${strategy.name}" — objetivo: ${strategy.primary_business_objective ?? '—'}, foco: ${strategy.strategic_focus ?? '—'}, horizonte: ${strategy.horizon ?? '—'}.
Metas atuais: ${JSON.stringify((goalRows ?? []).map((g: Record<string, unknown>) => ({ name: g.name, goal_type: g.goal_type, target: g.target_value, baseline: g.baseline_value, progress: g.current_progress })))}
${baseline ? `Dado real ATUAL: ${baseline.label}.` : 'Ainda sem dado real de performance coletado.'}

Decida: os dados atuais sugerem manter a estratégia como está, ou existe um ajuste concreto que vale recomendar (orçamento, conteúdo, prioridade, prazo)? NÃO invente número que não foi dado acima. Se não houver dado suficiente pra avaliar de verdade, diga isso.

Retorne APENAS um JSON: {"needs_adjustment": true|false, "recommendation": "1-2 frases, o que mudar (vazio se needs_adjustment=false)", "reasoning": "por que, citando o dado real ou a falta dele"}`

      const raw = await callClaude(anthropicKey, prompt, 700)
      const parsed = parseObj(raw)
      if (parsed.needs_adjustment && parsed.recommendation) {
        await admin.from('marketing_ai_strategy_log').insert({
          company_id: company.id, strategy_id: strategyId,
          recommendation: String(parsed.recommendation), reasoning: String(parsed.reasoning ?? ''), status: 'proposed',
        })
        return json({ ok: true, needs_adjustment: true })
      }
      return json({ ok: true, needs_adjustment: false, reasoning: parsed.reasoning ? String(parsed.reasoning) : null })
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
      const allowed = ['name', 'status', 'primary_business_objective', 'primary_marketing_objective', 'strategic_focus', 'horizon', 'assumptions', 'constraints', 'funnel_plan', 'budget']
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
