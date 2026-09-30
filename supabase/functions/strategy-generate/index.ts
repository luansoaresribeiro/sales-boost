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
 * GERAÇÃO EM 2 EXECUÇÕES SEPARADAS (2026-09-29) — o projeto está no plano
 * Free do Supabase: 150s de wall-clock por execução, incluindo trabalho em
 * segundo plano via EdgeRuntime.waitUntil (medido e confirmado: uma única
 * chamada de 4500 tokens à Claude já leva ~92s sozinha, e ainda assim saía
 * cortada — 2 tentativas na MESMA execução nunca caberiam em 150s). A
 * geração virou 2 passos, cada um sua própria execução HTTP (seu próprio
 * relógio de 150s):
 *   1. action='generate' cria a linha (status:'generating', nome
 *      provisório), devolve o id NA HORA, e dispara `runStep1` em segundo
 *      plano — só a tese/diagnóstico (menor, cabe com folga mesmo com 1
 *      retry). Ao terminar, grava esse pedaço (ainda 'generating') e chama
 *      o PRÓPRIO strategy-generate (action='continue') — uma execução
 *      nova, com relógio zerado.
 *   2. action='continue' (autenticada por cron_secret, chamada só por este
 *      arquivo) roda `runStep2` em segundo plano — funil/metas/orçamento/
 *      estimativas/campanha (a parte mais pesada; sem retry — ver
 *      callClaudeStep). Só aí grava status:'active' e pausa a estratégia
 *      principal antiga.
 * Nunca fica "gerando" pra sempre: se travar por mais de 10 min, tanto o
 * backend (próxima chamada de generate) quanto o frontend tratam como
 * 'failed'. Clique duplo devolve a geração já em andamento em vez de
 * duplicar.
 *
 * ARMADILHA DO verify_jwt (ver CLAUDE.md): esta function está deployada com
 * verify_jwt=true. A chamada interna 'continue' por isso PRECISA do header
 * `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` além do cron_secret
 * no corpo — sem o header, o gateway barra com 401 antes do código rodar,
 * em silêncio (a 2ª etapa nunca aconteceria).
 *
 * `reanalyze` é o Strategy Health Check + Review (botão "Reavaliar",
 * monitoramento manual — sem cron automático nesta fase, pedido do dono):
 * relê o DELTA do Data Agent desde a última atualização da estratégia e
 * decide CONTINUE (não grava nada) ou REFINE/PIVOT/TERMINATE (grava UMA
 * recomendação em marketing_ai_strategy_log com decision_type). Regra do
 * produto (human-in-the-loop) sobrepõe o "Hermes decide" do framework
 * colado: aqui Hermes sempre só RECOMENDA — status fica 'proposed' até o
 * dono aprovar, nunca aplica sozinho. Não precisou da divisão em 2 passos
 * (resposta pequena, 900 tokens, sempre coube no tempo).
 *
 * Interativo (generate/reanalyze/update_*) só: JWT do dono. 'continue' só:
 * cron_secret + Bearer de service role.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
type SupaClient = ReturnType<typeof createClient>

const STALE_GENERATING_MS = 10 * 60 * 1000 // ponto 3: 'generating' há mais de 10min = tratado como 'failed'

interface Company {
  id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null
  business_description: string | null; ideal_customer: string | null; business_stage: string | null
  main_challenges: string | null; website_summary: string | null; marketing_monthly_budget: number | null
  avg_ticket: number | null; vertical_key: string | null; playbook_answers: Record<string, unknown> | null
  telegram_chat_id: number | null; notification_prefs: Record<string, boolean> | null
}

const COMPANY_SELECT = 'id, business_name, business_type, city, goal, business_description, ideal_customer, business_stage, main_challenges, website_summary, marketing_monthly_budget, avg_ticket, vertical_key, playbook_answers, telegram_chat_id, notification_prefs'

// Mesmo padrao de generate-posts/creative-generate -- avisa o dono (Telegram +
// aba Atividades, via log-bot-event) quando o Hermes decide algo sozinho que
// merece atencao. So chamado em PIVOT/TERMINATE (estrategia nova) -- REFINE/
// refresh de rotina sao silenciosos de proposito (ver ajuste do dono).
async function notifyStrategy(supabaseUrl: string, chatId: number | null, companyId: string, event: string, data?: Record<string, unknown>) {
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  try {
    await fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId, data }),
    })
  } catch { /* nunca derruba o fluxo por causa de notificacao */ }
}

// Ficha de setor (vertical_playbooks) + respostas do onboarding da empresa,
// mescladas num bloco de texto pra injetar no prompt. Ficha vazia (caso
// 'generico', ou qualquer setor sem ficha configurada) + sem respostas =
// devolve '' = prompt fica idêntico ao de antes desta função existir. Nunca
// derruba a geração por causa de erro no banco de fichas (try/catch).
async function fetchPlaybookBlock(admin: SupaClient, verticalKey: string, playbookAnswers: Record<string, unknown> | null): Promise<string> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('name, config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
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

function round1(n: number): string { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') }
function fmtNum(n: number): string { return Math.round(n).toLocaleString('pt-BR') }

// Mesmo padrão de creative-generate's fetchRealStat — nunca inventa número.
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

// Chama a função data-agent internamente (cron_secret) — fonte de verdade
// dos 9 domínios, nunca re-consultamos as tabelas brutas aqui.
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

// callClaude "simples" — só pro reanalyze (900 tokens, nunca chegou perto
// do limite de tempo, não precisou da divisão em 2 passos).
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

// callClaude "com etapa" — usado pelos passos 1 e 2 da geração. Ponto-chave
// (pedido explícito do dono): olha o stop_reason de verdade. Se vier
// 'max_tokens', a resposta foi CORTADA — repetir a MESMA chamada vai
// cortar de novo, então só tenta de novo com mais espaço (allowRetry+
// bumpedMaxTokens) ou desiste com motivo claro. JSON malformado SEM corte
// é outra causa (falha de formatação, não de tamanho) — aí sim vale
// repetir do mesmo tamanho. allowRetry=false (usado na parte 2, mais
// pesada) nunca tenta de novo, pra nunca arriscar estourar os 150s da
// execução dentro da qual está rodando.
async function callClaudeStep(
  anthropicKey: string, prompt: string, maxTokens: number,
  opts: { allowRetry: boolean; bumpedMaxTokens?: number }, label: string,
): Promise<{ ok: true; parsed: Record<string, unknown> } | { ok: false; reason: string }> {
  const attempt = async (tokens: number): Promise<{ text: string; stopReason: string } | null> => {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: tokens, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok) { console.error(`callClaudeStep ${label}: Claude respondeu ${res.status}`); return null }
      const data = await res.json()
      const text = (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
      const stopReason = String(data.stop_reason ?? '')
      return { text, stopReason }
    } catch (e) { console.error(`callClaudeStep ${label}: erro de rede:`, e); return null }
  }

  const first = await attempt(maxTokens)
  if (!first) return { ok: false, reason: `${label}: erro de rede/sobrecarga na chamada à Claude.` }

  if (first.stopReason === 'max_tokens') {
    console.error(`callClaudeStep ${label}: resposta CORTADA (stop_reason=max_tokens, ${maxTokens} tokens).`)
    if (!opts.allowRetry) return { ok: false, reason: `${label}: a resposta ficou grande demais pra esse limite — tente de novo.` }
    const bumped = await attempt(opts.bumpedMaxTokens ?? Math.round(maxTokens * 1.4))
    if (!bumped) return { ok: false, reason: `${label}: erro de rede/sobrecarga na nova tentativa.` }
    if (bumped.stopReason === 'max_tokens') return { ok: false, reason: `${label}: a resposta ficou grande demais mesmo com mais espaço — tente de novo.` }
    const parsed = parseObj(bumped.text)
    if (!Object.keys(parsed).length) return { ok: false, reason: `${label}: resposta não veio em JSON válido.` }
    return { ok: true, parsed }
  }

  const parsed = parseObj(first.text)
  if (Object.keys(parsed).length) return { ok: true, parsed }

  console.error(`callClaudeStep ${label}: JSON malformado (sem corte). Últimos 500 chars:`, first.text.slice(-500))
  if (!opts.allowRetry) return { ok: false, reason: `${label}: resposta não veio em JSON válido.` }
  const retry = await attempt(maxTokens)
  if (!retry) return { ok: false, reason: `${label}: erro de rede/sobrecarga na nova tentativa.` }
  if (retry.stopReason === 'max_tokens') return { ok: false, reason: `${label}: a resposta ficou grande demais na nova tentativa — tente de novo.` }
  const retryParsed = parseObj(retry.text)
  if (!Object.keys(retryParsed).length) return { ok: false, reason: `${label}: resposta não veio em JSON válido mesmo após nova tentativa.` }
  return { ok: true, parsed: retryParsed }
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

function goalsWithBaselineFrom(rawGoals: unknown, baseline: { engagementPct: number | null; reach: number | null; followers: number | null } | null): Record<string, unknown>[] {
  const goals = (Array.isArray(rawGoals) ? rawGoals : []) as Record<string, unknown>[]
  return goals.slice(0, 3).map(g => {
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
}

// ── PASSO 1 (execução do 'generate') — diagnóstico + tese. Roda em segundo
// plano via EdgeRuntime.waitUntil; ao terminar, grava o pedaço (ainda
// 'generating') e dispara o PRÓPRIO strategy-generate (action='continue')
// como uma execução nova, com relógio de 150s zerado, pro passo 2.
async function runStep1(
  admin: SupaClient, supabaseUrl: string, cronSecret: string, anthropicKey: string,
  company: Company, kind: 'main' | 'initiative', parentStrategyId: string | null, strategyId: string,
): Promise<void> {
  const markFailed = async (reason: string) => {
    console.error(`strategy-generate step1[${strategyId}]: FALHOU — ${reason}`)
    await admin.from('marketing_ai_strategies').update({ status: 'failed', reasoning: reason, updated_at: new Date().toISOString() }).eq('id', strategyId)
  }
  try {
    const t0 = Date.now()
    const lap = (label: string) => console.log(`TIMING strategy-generate step1[${strategyId}]: ${label} = ${Date.now() - t0}ms`)

    const [{ data: cfgRow }, dataAgentState, baseline, playbookBlock] = await Promise.all([
      admin.from('marketing_ai_config').select('brand_voice, target_audience, content_pillars, marketing_goals').eq('company_id', company.id).maybeSingle(),
      fetchDataAgentState(supabaseUrl, cronSecret, company.id, 'state'),
      fetchRealBaseline(admin, company.id),
      fetchPlaybookBlock(admin, company.vertical_key ?? 'generico', company.playbook_answers),
    ])
    lap('data-agent + baseline + playbook (paralelo)')
    const cfg = (cfgRow ?? {}) as { brand_voice?: string; target_audience?: string; content_pillars?: string[]; marketing_goals?: string }

    let parentContext = ''
    if (kind === 'initiative' && parentStrategyId) {
      const { data: parent } = await admin.from('marketing_ai_strategies').select('name, primary_business_objective, strategic_focus, thesis').eq('id', parentStrategyId).maybeSingle()
      if (parent) parentContext = `\nEssa é uma INICIATIVA dentro da estratégia principal "${parent.name}" (tese: ${parent.thesis ?? parent.strategic_focus ?? '—'}) — a iniciativa precisa servir essa tese, não competir com ela.`
    }

    const prompt = `Você é Hermes, o motor de inteligência estratégica e decisão do Sales Boost — não um gerador de conteúdo, não um gestor de anúncios: você decide em QUE o negócio deve focar agora, por quê, por quanto tempo, e o que NÃO fazer.

Sua fonte de verdade são os 9 domínios do Data Agent (Business/Customer/Market/Competition/Digital/Content/History/Resources/Performance). Não analise os domínios isolados — procure relações entre eles antes de decidir (ex: concorrente compete por preço + cliente reclama de preço + negócio tem margem melhor em serviço premium + histórico mostra que desconto atraiu cliente ruim + performance mostra que cliente premium tem LTV maior ⇒ a resposta não é baixar preço, é reposicionar por valor).

${businessPreamble(company, cfg)}${playbookBlock}
${parentContext}

ESTADO ATUAL DOS 9 DOMÍNIOS (Data Agent):
${formatDomains(dataAgentState)}
${baseline ? `\nDADO REAL de performance atual (NÃO invente outro número — use exatamente este quando relevante): ${baseline.label}.` : '\nAinda não há dado real de performance coletado — trate qualquer número de baseline como DESCONHECIDO, nunca assuma 0 nem invente um valor.'}

Esta é a PARTE 1 de 2 (diagnóstico + tese). A parte 2 (funil/metas/orçamento) vem depois, com a sua tese como base — não tente incluir funil/metas/orçamento aqui.

REGRAS CRÍTICAS:
- NUNCA invente taxa de conversão, CPC, CPM, CAC, ROAS ou qualquer métrica histórica que não foi te dada acima. Quando precisar supor algo, rotule dentro do texto (reasoning/assumptions) com um destes níveis de confiança: VERIFICADO (veio de dado real acima), INFORMADO_PELO_DONO, OBSERVADO (sinal do Data Agent), ESTIMADO, INFERIDO, ou DESCONHECIDO — nunca apresente estimativa como fato.
- Diagnostique a RESTRIÇÃO PRINCIPAL primeiro (o que está travando o crescimento agora — não assuma automaticamente que é "falta de conteúdo" ou "falta de anúncio"; pode ser posicionamento fraco, oferta fraca, conversão fraca, retenção fraca, etc.) e a OPORTUNIDADE ESTRATÉGICA (a coisa de maior impacto que o Sales Boost consegue realmente influenciar agora).
- A TESE precisa seguir o formato: "Porque [evidência], acreditamos [hipótese]. Por isso, vamos [abordagem] por [horizonte] pra alcançar [objetivo]." — baseada em evidência real acima, nunca genérica.
- Só ative os COMPONENTES necessários pra essa tese (não ative os 11 automaticamente): ${COMPONENTS.join(', ')}.
- Defina EXCLUSÕES explícitas — o que o Sales Boost NÃO vai fazer agora e por quê (evita diluição estratégica).
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
  "failure_conditions": "que evidência mostraria que não está funcionando"
}`
    lap(`prompt 1 montado, ${prompt.length} chars`)

    const r1 = await callClaudeStep(anthropicKey, prompt, 2200, { allowRetry: true, bumpedMaxTokens: 3200 }, 'Parte 1 (tese)')
    lap(`parte 1 concluída, ok=${r1.ok}`)
    if (!r1.ok) { await markFailed(r1.reason); return }
    const parsed1 = r1.parsed
    if (!parsed1.name || !parsed1.thesis) { await markFailed('Parte 1: resposta sem nome/tese mesmo com JSON válido.'); return }

    const activeComponents = (Array.isArray(parsed1.active_components) ? parsed1.active_components : []).filter((c: unknown) => COMPONENTS.includes(String(c)))

    await admin.from('marketing_ai_strategies').update({
      name: String(parsed1.name),
      thesis: String(parsed1.thesis),
      primary_constraint: parsed1.primary_constraint ? String(parsed1.primary_constraint) : null,
      strategic_opportunity: parsed1.strategic_opportunity ? String(parsed1.strategic_opportunity) : null,
      primary_business_objective: parsed1.primary_business_objective ? String(parsed1.primary_business_objective) : null,
      primary_marketing_objective: parsed1.primary_marketing_objective ? String(parsed1.primary_marketing_objective) : null,
      strategic_focus: parsed1.strategic_focus ? String(parsed1.strategic_focus) : null,
      horizon: parsed1.horizon ? String(parsed1.horizon) : null,
      review_cadence: parsed1.review_cadence ? String(parsed1.review_cadence) : null,
      reasoning: parsed1.reasoning ? String(parsed1.reasoning) : null,
      assumptions: Array.isArray(parsed1.assumptions) ? parsed1.assumptions : [],
      constraints: Array.isArray(parsed1.constraints) ? parsed1.constraints : [],
      exclusions: Array.isArray(parsed1.exclusions) ? parsed1.exclusions : [],
      active_components: activeComponents,
      success_conditions: parsed1.success_conditions ? String(parsed1.success_conditions) : null,
      failure_conditions: parsed1.failure_conditions ? String(parsed1.failure_conditions) : null,
      // status continua 'generating' de propósito — só a parte 2 põe 'active'.
      updated_at: new Date().toISOString(),
    }).eq('id', strategyId)
    lap('parte 1 gravada')

    let fired = false
    try {
      // Function deployada com --no-verify-jwt (ver CLAUDE.md) -- so o
      // cron_secret no corpo ja basta, sem precisar de Bearer nenhum.
      const res = await fetch(`${supabaseUrl}/functions/v1/strategy-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'continue', strategy_id: strategyId, cron_secret: cronSecret }),
      })
      fired = res.ok
      if (!fired) console.error(`strategy-generate step1[${strategyId}]: 'continue' respondeu HTTP ${res.status}`)
    } catch (e) {
      console.error(`strategy-generate step1[${strategyId}]: falha ao disparar 'continue':`, e)
    }
    lap(`continue disparado, ok=${fired}`)
    if (!fired) await markFailed('Não consegui continuar a geração (falha ao disparar a 2ª etapa) — tente de novo.')
  } catch (e) {
    await markFailed(e instanceof Error ? e.message : String(e))
  }
}

// ── PASSO 2 (execução do 'continue') — plano tático: funil, metas,
// orçamento, estimativas, campanha. Execução própria, relógio de 150s
// zerado. Sem retry (allowRetry:false) — é a parte mais pesada, e mesmo 1
// retry do mesmo tamanho já arriscaria estourar os 150s desta execução.
async function runStep2(admin: SupaClient, supabaseUrl: string, cronSecret: string, anthropicKey: string, row: Record<string, unknown>): Promise<void> {
  const strategyId = String(row.id)
  const companyId = String(row.company_id)
  const markFailed = async (reason: string) => {
    console.error(`strategy-generate step2[${strategyId}]: FALHOU — ${reason}`)
    await admin.from('marketing_ai_strategies').update({ status: 'failed', reasoning: reason, updated_at: new Date().toISOString() }).eq('id', strategyId)
  }
  try {
    const t0 = Date.now()
    const lap = (label: string) => console.log(`TIMING strategy-generate step2[${strategyId}]: ${label} = ${Date.now() - t0}ms`)

    const { data: companyRow } = await admin.from('companies')
      .select(COMPANY_SELECT)
      .eq('id', companyId).maybeSingle()
    const company = companyRow as Company | null
    if (!company) { await markFailed('Empresa não encontrada na 2ª etapa.'); return }

    const [dataAgentState, baseline, playbookBlock] = await Promise.all([
      fetchDataAgentState(supabaseUrl, cronSecret, companyId, 'state'),
      fetchRealBaseline(admin, companyId),
      fetchPlaybookBlock(admin, company.vertical_key ?? 'generico', company.playbook_answers),
    ])
    lap('data-agent + baseline + playbook (2a etapa)')

    const prompt = `Você é Hermes, continuando o plano tático de uma estratégia cuja tese já foi decidida (parte 1, já gravada) — não questione a tese, só desdobre em plano tático.

${businessPreamble(company, {})}${playbookBlock}

TESE JÁ DECIDIDA:
Nome: ${row.name}
Tese: ${row.thesis}
Restrição principal: ${row.primary_constraint ?? '—'}
Oportunidade estratégica: ${row.strategic_opportunity ?? '—'}
Objetivo: ${row.primary_business_objective ?? row.primary_marketing_objective ?? '—'}
Foco estratégico: ${row.strategic_focus ?? '—'}
Componentes ativos: ${Array.isArray(row.active_components) ? (row.active_components as string[]).join(', ') : '—'}
Horizonte: ${row.horizon ?? '—'}

ESTADO ATUAL DOS 9 DOMÍNIOS (Data Agent):
${formatDomains(dataAgentState)}
${baseline ? `\nDADO REAL de performance atual (NÃO invente outro número — use exatamente este quando relevante): ${baseline.label}.` : '\nAinda não há dado real de performance coletado — trate qualquer número de baseline como DESCONHECIDO, nunca assuma 0 nem invente um valor.'}

REGRAS CRÍTICAS:
- NUNCA invente taxa de conversão, CPC, CPM, CAC, ROAS ou qualquer métrica histórica que não foi te dada acima.
- NUNCA garanta um resultado. Use faixas/estimativas com a incerteza explícita.
- Metas: no máximo 3, "goal_type" sendo um destes: ${GOAL_TYPES.join('|')}. NÃO preencha baseline — isso é calculado à parte com dado real.
- Orçamento: só proponha valores SE o dono já informou orçamento mensal (${company.marketing_monthly_budget ? `informou: R$ ${company.marketing_monthly_budget}` : 'não informou'}); caso contrário, campos null e explique em "budget_reasoning" que falta essa informação.
- Seja específico ao negócio e à tese acima — nunca genérico.

Retorne APENAS um JSON:
{
  "funnel_plan": [{"stage":"awareness|consideration|conversion|retention","objective":"","audience":"","message":"","format":"","cta":"","destination":"","metric":"","dependencies":"","horizon":""}],
  "goals": [{"name":"","goal_type":"","target_value":null,"period":"daily|weekly|monthly|custom","deadline":null,"priority":"high|medium|low","data_source":"","measurement_method":""}],
  "budget": {"total":null,"currency":"BRL","period":"monthly","paid_ads":null,"organic":null,"creative":null,"other":null,"is_flexible":true,"allocation":[{"channel":"","amount":null,"reason":""}],"budget_reasoning":""},
  "estimates": {"time_to_signals":"","time_to_progress":"","time_to_target":"","confidence":"high|medium|low","risks":"","feasibility_status":"supports_plan|needs_more_data|needs_adjustment|significant_constraints","feasibility_reasoning":""},
  "campaign_draft": {"name":"","goal":""}
}`
    lap(`prompt 2 montado, ${prompt.length} chars`)

    // 3200 tokens cortava toda vez no teste real (66-67s, sempre truncado) —
    // subiu pra 4500 (~95-110s medido, ainda com folga dentro dos 150s desta
    // execução) depois de confirmar que a parte 2 (funil/metas/orçamento/
    // estimativas/campanha) precisa mesmo de mais espaço que isso.
    const r2 = await callClaudeStep(anthropicKey, prompt, 4500, { allowRetry: false }, 'Parte 2 (plano tático)')
    lap(`parte 2 concluída, ok=${r2.ok}`)
    if (!r2.ok) { await markFailed(r2.reason); return }
    const parsed2 = r2.parsed

    const goals = goalsWithBaselineFrom(parsed2.goals, baseline)

    if (String(row.kind) === 'main') {
      // Só agora, com a geração inteira completa, pausa a antiga — se
      // qualquer etapa tivesse falhado, a empresa continuaria com a
      // estratégia anterior ativa em vez de ficar sem nenhuma.
      await admin.from('marketing_ai_strategies').update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('company_id', companyId).eq('kind', 'main').eq('status', 'active').neq('id', strategyId)
    }

    await admin.from('marketing_ai_strategies').update({
      funnel_plan: Array.isArray(parsed2.funnel_plan) ? parsed2.funnel_plan : [],
      budget: parsed2.budget && typeof parsed2.budget === 'object' ? parsed2.budget : {},
      estimates: parsed2.estimates && typeof parsed2.estimates === 'object' ? parsed2.estimates : {},
      data_provenance: { baseline_source: baseline ? 'instagram_performance_snapshots' : 'nenhum dado real ainda — metas sem baseline verificado', source: 'data-agent' },
      status: 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', strategyId)
    lap('parte 2 gravada, status=active')

    if (goals.length) {
      await admin.from('marketing_ai_strategy_goals').insert(goals.map(g => ({ ...g, strategy_id: strategyId })))
    }
    const campaignDraft = parsed2.campaign_draft as { name?: string; goal?: string } | undefined
    if (campaignDraft?.name) {
      const budgetObj = parsed2.budget as { paid_ads?: number | null } | undefined
      await admin.from('marketing_ai_campaigns').insert({
        company_id: companyId, name: String(campaignDraft.name).slice(0, 200), goal: campaignDraft.goal ? String(campaignDraft.goal) : null,
        budget: budgetObj?.paid_ads ?? null, status: 'planned',
      })
    }
    lap('goals + campaign draft gravados')
  } catch (e) {
    await markFailed(e instanceof Error ? e.message : String(e))
  }
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

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action ?? 'generate')

    // Deploy com --no-verify-jwt (ver CLAUDE.md, armadilha do gateway) --
    // o codigo valida por conta propria: cron_secret no corpo (chamada
    // automatica, interna ou do pg_cron) OU JWT real do dono (chamada
    // interativa). NUNCA aceita company_id vindo do corpo quando quem
    // chama e um JWT de dono -- a empresa e sempre resolvida por
    // user_id=auth.uid(), nunca pelo que o corpo pediu (evita um dono
    // pedir dado de outra empresa so trocando o company_id no payload).
    const isCron = !!cronSecret && String(body.cron_secret ?? '') === cronSecret

    // ── 'continue' — 2a execucao da geracao (ver nota da arquitetura no
    // topo do arquivo). So cron_secret, sem JWT nenhum -- e o proprio
    // strategy-generate (passo 1) se rechamando.
    if (action === 'continue') {
      if (!isCron) return json({ error: 'Unauthorized' }, 401)
      const strategyId = String(body.strategy_id ?? '')
      const { data: row } = await admin.from('marketing_ai_strategies').select('*').eq('id', strategyId).maybeSingle()
      // A prova de repeticao (ponto 4): so segue se ainda 'generating' E a
      // parte 1 ja gravou (thesis presente) -- senao, ja foi processada,
      // falhou, ou a parte 1 ainda nao terminou; ignora sem erro.
      if (!row || row.status !== 'generating' || !row.thesis) return json({ ok: true, skipped: true })
      // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
      EdgeRuntime.waitUntil(runStep2(admin, supabaseUrl, cronSecret, anthropicKey, row as Record<string, unknown>))
      return json({ ok: true })
    }

    // ── 'cron_dispatch' — o despachante do Hermes independente: acha ate
    // ROUND_LIMIT empresas elegiveis (auto_strategy=true) por rodada e
    // dispara 1 chamada por empresa (generate se nao tem estrategia ativa,
    // reanalyze se ja passou 1 semana desde o ultimo check-up, refresh se
    // ja passou 1 mes desde o ultimo refresh) -- espera cada chamada ser
    // aceita (2xx) antes de seguir pra proxima, registra as que falharem.
    if (action === 'cron_dispatch') {
      if (!isCron) return json({ error: 'Unauthorized' }, 401)
      const ROUND_LIMIT = Number(body.round_limit ?? 5)
      const WEEK_MS = 7 * 24 * 60 * 60 * 1000
      const MONTH_MS = 30 * 24 * 60 * 60 * 1000
      const now = Date.now()

      const { data: companies } = await admin.from('companies').select('id, business_name').eq('auto_strategy', true)
      const results: { company_id: string; business_name: string; action: string; ok: boolean; error?: string }[] = []
      let dispatched = 0

      for (const c of (companies ?? [])) {
        if (dispatched >= ROUND_LIMIT) break
        const { data: activeStrategy } = await admin.from('marketing_ai_strategies')
          .select('id, last_reanalyzed_at, last_refreshed_at')
          .eq('company_id', c.id).eq('kind', 'main').eq('status', 'active').maybeSingle()

        let targetAction: string | null = null
        let extra: Record<string, unknown> = {}

        if (!activeStrategy) {
          const { data: generating } = await admin.from('marketing_ai_strategies')
            .select('id, created_at').eq('company_id', c.id).eq('kind', 'main').eq('status', 'generating')
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (generating && (now - new Date(generating.created_at as string).getTime()) < STALE_GENERATING_MS) continue
          targetAction = 'generate'
        } else {
          const lastReanalyzed = activeStrategy.last_reanalyzed_at ? new Date(activeStrategy.last_reanalyzed_at as string).getTime() : 0
          const lastRefreshed = activeStrategy.last_refreshed_at ? new Date(activeStrategy.last_refreshed_at as string).getTime() : 0
          if (now - lastReanalyzed >= WEEK_MS) { targetAction = 'reanalyze'; extra = { strategy_id: activeStrategy.id } }
          else if (now - lastRefreshed >= MONTH_MS) { targetAction = 'refresh'; extra = { strategy_id: activeStrategy.id } }
        }
        if (!targetAction) continue

        dispatched++
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/strategy-generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: targetAction, company_id: c.id, cron_secret: cronSecret, ...extra }),
          })
          results.push({ company_id: c.id, business_name: String(c.business_name), action: targetAction, ok: res.ok, error: res.ok ? undefined : await res.text() })
        } catch (e) {
          results.push({ company_id: c.id, business_name: String(c.business_name), action: targetAction, ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      }
      return json({ ok: true, dispatched, results })
    }

    // ── Todo o resto (generate/reanalyze/refresh/update_*) resolve a
    // empresa por cron (company_id no corpo) OU por JWT real do dono
    // (nunca confia em company_id do corpo nesse caminho) ──
    let company: Company | null = null
    if (isCron) {
      const cronCompanyId = String(body.company_id ?? '')
      if (!cronCompanyId) return json({ error: 'company_id obrigatório no modo cron.' }, 400)
      const { data: companyRow } = await admin.from('companies').select(COMPANY_SELECT).eq('id', cronCompanyId).maybeSingle()
      company = companyRow as Company | null
    } else {
      const bearer = req.headers.get('Authorization') ?? ''
      if (!bearer) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data: companyRow } = await admin.from('companies').select(COMPANY_SELECT).eq('user_id', user.id).maybeSingle()
      company = companyRow as Company | null
    }
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    if (action === 'generate') {
      const kind = body.kind === 'initiative' ? 'initiative' : 'main'
      const parentId = body.parent_strategy_id ? String(body.parent_strategy_id) : null
      if (kind === 'initiative' && !parentId) return json({ error: 'Falta a estratégia principal pra vincular essa iniciativa.' }, 400)

      // Ponto 4 — clique duplo: já existe uma geração em andamento (<10min)
      // pra essa empresa+kind? Devolve o id dela em vez de duplicar.
      let existingQuery = admin.from('marketing_ai_strategies').select('id, created_at')
        .eq('company_id', company.id).eq('kind', kind).eq('status', 'generating')
      if (kind === 'initiative') existingQuery = existingQuery.eq('parent_strategy_id', parentId)
      const { data: existing } = await existingQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (existing) {
        const ageMs = Date.now() - new Date(existing.created_at as string).getTime()
        if (ageMs < STALE_GENERATING_MS) return json({ ok: true, strategy_id: existing.id, status: 'generating' })
        // Ponto 3 — travada há mais de 10min: trata como falha e segue criando uma nova.
        await admin.from('marketing_ai_strategies').update({ status: 'failed', reasoning: 'Demorou demais e não terminou — tente gerar de novo.', updated_at: new Date().toISOString() }).eq('id', existing.id)
      }

      // Ponto 6 — a linha nasce com as colunas obrigatórias preenchidas
      // (name não é null-able) com um valor provisório.
      const { data: inserted, error: insErr } = await admin.from('marketing_ai_strategies').insert({
        company_id: company.id, kind, parent_strategy_id: parentId,
        name: 'Gerando estratégia...', status: 'generating', created_by: 'ai',
      }).select('id').single()
      if (insErr) throw new Error(insErr.message)

      // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
      EdgeRuntime.waitUntil(runStep1(admin, supabaseUrl, cronSecret, anthropicKey, company, kind, parentId, inserted.id as string))
      return json({ ok: true, strategy_id: inserted.id, status: 'generating' })
    }

    if (action === 'reanalyze') {
      // Modo cron pode nao mandar strategy_id -- resolve a principal ativa
      // da propria empresa (o dispatcher ja manda, mas o cron_dispatch
      // tambem cobre esse caso caso mude no futuro).
      let strategyId = String(body.strategy_id ?? '')
      if (!strategyId) {
        const { data: activeMain } = await admin.from('marketing_ai_strategies').select('id').eq('company_id', company.id).eq('kind', 'main').eq('status', 'active').maybeSingle()
        strategyId = activeMain?.id ? String(activeMain.id) : ''
      }
      const { data: strategy } = await admin.from('marketing_ai_strategies').select('*').eq('id', strategyId).eq('company_id', company.id).maybeSingle()
      if (!strategy) return json({ error: 'Estratégia não encontrada.' }, 404)
      const { data: goalRows } = await admin.from('marketing_ai_strategy_goals').select('*').eq('strategy_id', strategyId)
      const [delta, baseline, playbookBlock] = await Promise.all([
        fetchDataAgentState(supabaseUrl, cronSecret, company.id, 'delta', String(strategy.updated_at)),
        fetchRealBaseline(admin, company.id),
        fetchPlaybookBlock(admin, company.vertical_key ?? 'generico', company.playbook_answers),
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
${playbookBlock}

Decida:
1. STRATEGY_STATUS: ON_TRACK | NEEDS_ADJUSTMENT | UNDERPERFORMING | AT_RISK | INVALIDATED
2. DECISION: CONTINUE | REFINE | PIVOT | TERMINATE (só REFINE/PIVOT/TERMINATE geram recomendação pro dono — CONTINUE significa "sem sinal forte o bastante pra mudar nada agora")
Não conclua que a estratégia toda falhou por causa de 1 sinal fraco isolado — considere volume de evidência, não ruído de curto prazo.

Retorne APENAS um JSON: {"status": "ON_TRACK|NEEDS_ADJUSTMENT|UNDERPERFORMING|AT_RISK|INVALIDATED", "decision": "continue|refine|pivot|terminate", "recommendation": "1-3 frases, o que mudar (vazio se decision=continue)", "reasoning": "por que, citando os sinais reais ou a falta deles"}`

      const raw = await callClaude(anthropicKey, prompt, 900)
      const parsed = parseObj(raw)
      const decision = String(parsed.decision ?? 'continue')
      // Marca sempre que o check-up rodou -- e o que o cron_dispatch usa
      // pra saber quando a proxima semana comeca (independente da decisao).
      await admin.from('marketing_ai_strategies').update({ last_reanalyzed_at: new Date().toISOString() }).eq('id', strategyId)

      if (decision !== 'continue' && parsed.recommendation) {
        await admin.from('marketing_ai_strategy_log').insert({
          company_id: company.id, strategy_id: strategyId, decision_type: decision,
          recommendation: String(parsed.recommendation), reasoning: String(parsed.reasoning ?? ''), status: 'proposed',
        })

        if (decision === 'refine') {
          // Ajuste do dono: check-up que pede ajuste ATUALIZA a estrategia
          // ativa em vez de so propor -- silencioso (nao avisa), mesmo
          // caminho do refresh mensal de rotina. Disparado em segundo
          // plano (nao trava a resposta do reanalyze/do despachante).
          fetch(`${supabaseUrl}/functions/v1/strategy-generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'refresh', company_id: company.id, strategy_id: strategyId, cron_secret: cronSecret }),
          }).catch(e => console.error(`reanalyze[${strategyId}]: falha ao disparar refresh:`, e))
        } else if (decision === 'pivot' || decision === 'terminate') {
          // So aqui (mudanca de rumo de verdade) gera estrategia NOVA e
          // avisa o dono com o motivo -- check-up que so refina fica quieto.
          fetch(`${supabaseUrl}/functions/v1/strategy-generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate', company_id: company.id, cron_secret: cronSecret }),
          }).catch(e => console.error(`reanalyze[${strategyId}]: falha ao disparar generate:`, e))

          const prefs = company.notification_prefs ?? {}
          if (prefs.strategy !== false) {
            notifyStrategy(supabaseUrl, company.telegram_chat_id, company.id, 'STRATEGY_PIVOT', {
              decision, reason: String(parsed.recommendation), reasoning: String(parsed.reasoning ?? ''),
            })
          }
        }

        return json({ ok: true, needs_adjustment: true, status: parsed.status, decision })
      }
      return json({ ok: true, needs_adjustment: false, status: parsed.status ?? null, reasoning: parsed.reasoning ? String(parsed.reasoning) : null })
    }

    // 'refresh' -- ATUALIZA a estrategia ativa no lugar (metas, funil,
    // orcamento, prioridades) com dado novo + o que ja funcionou -- a TESE
    // principal nunca muda aqui (isso so acontece via 'generate', e so
    // quando o reanalyze decidiu PIVOT/TERMINATE). Disparado: (a) pelo
    // cron_dispatch, 1x por mes por empresa; (b) pelo proprio reanalyze
    // quando a decisao foi REFINE (fora do calendario mensal). Silencioso
    // de proposito -- nao avisa o dono (so PIVOT/TERMINATE avisam).
    if (action === 'refresh') {
      let strategyId = String(body.strategy_id ?? '')
      if (!strategyId) {
        const { data: activeMain } = await admin.from('marketing_ai_strategies').select('id').eq('company_id', company.id).eq('kind', 'main').eq('status', 'active').maybeSingle()
        strategyId = activeMain?.id ? String(activeMain.id) : ''
      }
      const { data: strategy } = await admin.from('marketing_ai_strategies').select('*').eq('id', strategyId).eq('company_id', company.id).maybeSingle()
      if (!strategy) return json({ error: 'Estratégia não encontrada.' }, 404)

      const { data: goalRows } = await admin.from('marketing_ai_strategy_goals').select('*').eq('strategy_id', strategyId)
      const { data: pastLog } = await admin.from('marketing_ai_strategy_log').select('decision_type, recommendation, status, created_at').eq('strategy_id', strategyId).order('created_at', { ascending: false }).limit(5)
      const [dataAgentState, baseline, playbookBlock] = await Promise.all([
        fetchDataAgentState(supabaseUrl, cronSecret, company.id, 'state'),
        fetchRealBaseline(admin, company.id),
        fetchPlaybookBlock(admin, company.vertical_key ?? 'generico', company.playbook_answers),
      ])

      const prompt = `Você é Hermes, ATUALIZANDO uma estratégia ativa (refresh de rotina mensal, ou porque o check-up semanal pediu ajuste) — a TESE principal já está decidida e NÃO deve mudar aqui, só o plano tático (funil/metas/orçamento/prioridades) precisa refletir o que já funcionou até agora + os dados mais recentes.

${businessPreamble(company, {})}${playbookBlock}

TESE ATIVA (não mude, só use como base):
Nome: ${strategy.name}
Tese: ${strategy.thesis ?? strategy.strategic_focus ?? '—'}
Restrição principal: ${strategy.primary_constraint ?? '—'}
Componentes ativos: ${Array.isArray(strategy.active_components) ? (strategy.active_components as string[]).join(', ') : '—'}

PLANO TÁTICO ATUAL:
Funil: ${JSON.stringify(strategy.funnel_plan ?? [])}
Metas: ${JSON.stringify((goalRows ?? []).map((g: Record<string, unknown>) => ({ name: g.name, goal_type: g.goal_type, target: g.target_value, progress: g.current_progress })))}
Orçamento: ${JSON.stringify(strategy.budget ?? {})}

DECISÕES/RECOMENDAÇÕES PASSADAS (memória — o que já foi tentado/sugerido, pra não repetir o que não funcionou nem descartar o que já provou valor):
${(pastLog ?? []).length ? (pastLog ?? []).map((l: Record<string, unknown>) => `- [${l.decision_type}/${l.status}] ${l.recommendation}`).join('\n') : 'Nenhuma recomendação anterior ainda.'}

${baseline ? `Dado real ATUAL: ${baseline.label}.` : 'Ainda sem dado real de performance coletado.'}

ESTADO ATUAL DOS 9 DOMÍNIOS (Data Agent):
${formatDomains(dataAgentState)}

REGRAS: mantenha a tese intacta; priorize (regra 80/20) manter e reforçar o que os sinais reais mostram que já funciona, reservando só uma fatia menor pra testar algo novo; NUNCA invente métrica que não foi te dada acima; metas no máximo 3 (goal_type: ${GOAL_TYPES.join('|')}), NÃO preencha baseline.

Retorne APENAS um JSON:
{
  "what_changed": "2-4 frases: o que mudou no plano tático e por quê, citando os sinais reais que motivaram",
  "funnel_plan": [{"stage":"awareness|consideration|conversion|retention","objective":"","audience":"","message":"","format":"","cta":"","destination":"","metric":"","dependencies":"","horizon":""}],
  "goals": [{"name":"","goal_type":"","target_value":null,"period":"daily|weekly|monthly|custom","deadline":null,"priority":"high|medium|low","data_source":"","measurement_method":""}],
  "budget": {"total":null,"currency":"BRL","period":"monthly","paid_ads":null,"organic":null,"creative":null,"other":null,"is_flexible":true,"allocation":[{"channel":"","amount":null,"reason":""}],"budget_reasoning":""}
}`

      const r = await callClaudeStep(anthropicKey, prompt, 4500, { allowRetry: false }, 'Refresh (atualização mensal)')
      if (!r.ok) return json({ error: r.reason }, 500)
      const parsed = r.parsed
      const goals = goalsWithBaselineFrom(parsed.goals, baseline)

      await admin.from('marketing_ai_strategies').update({
        funnel_plan: Array.isArray(parsed.funnel_plan) ? parsed.funnel_plan : strategy.funnel_plan,
        budget: parsed.budget && typeof parsed.budget === 'object' ? parsed.budget : strategy.budget,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', strategyId)

      if (goals.length) {
        await admin.from('marketing_ai_strategy_goals').delete().eq('strategy_id', strategyId)
        await admin.from('marketing_ai_strategy_goals').insert(goals.map(g => ({ ...g, strategy_id: strategyId })))
      }

      await admin.from('marketing_ai_strategy_log').insert({
        company_id: company.id, strategy_id: strategyId, decision_type: 'update',
        recommendation: String(parsed.what_changed ?? 'Plano tático atualizado com dados novos.'),
        reasoning: String(parsed.what_changed ?? ''), status: 'implemented',
      })

      return json({ ok: true, strategy_id: strategyId, what_changed: parsed.what_changed ?? null })
    }

    if (action === 'update_goal') {
      const goalId = String(body.goal_id ?? '')
      const patch = body.patch as Record<string, unknown>
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
