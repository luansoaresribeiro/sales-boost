import type { FlowStep } from './FlowStrip'
import type { MarketFlow, OppFlow } from './useFlowStripData'
import { fmtStamp, nextOpportunityRound, shortError, usd } from './flowStripLogic'

// Monta os passos de cada agente a partir de dado REAL (regra 5: faltou dado = "sem dado ainda", nunca número inventado).
// Cada passo foi conferido contra o código: marketIntelCron.ts / marketNewsRun.ts / marketIntel.ts (Inteligência de Mercado) e
// opportunityCron.ts / opportunityRun.ts / opportunityPlanRun.ts / opportunityPiecesRun.ts (Motor de Oportunidades).
type Lang = 'pt' | 'en'
const num = (n: number | null | undefined): n is number => typeof n === 'number'
const ms = (iso: string | null | undefined): number | null => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null }
const plural = (_lang: Lang, n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export type MarketSub = 'mercado' | 'ideias' | 'lugares' | 'faq'

export function marketSteps(lang: Lang, d: MarketFlow, o: { hasMarket: boolean; hasNearby: boolean; hasFaq: boolean; go: (s: MarketSub) => void }): FlowStep[] {
  const pt = lang === 'pt'
  const n = d.news
  // 1. Coleta de notícias — cron `market-intel-daily` (todo dia 09:43 UTC = 06:43 do Rio → cron_market_intel).
  let s1: FlowStep['status'] = 'waiting'
  if (n?.last_at) s1 = n.last_ok === false ? 'error' : 'ok'
  const spent = n ? usd(n.cost_month) : null
  const budget = n ? usd(n.news_budget) : null
  const step1: FlowStep = {
    key: 'coleta', status: s1, error: n?.last_error ? shortError(n.last_error) : (n?.last_ok === false ? (pt ? 'falhou sem detalhe' : 'failed without detail') : null),
    name: pt ? 'Coleta de notícias' : 'News collection',
    desc: pt ? 'Todo dia o sistema busca notícias da região dos seus imóveis, com fonte e data.' : 'Every day the system searches news about the area of your properties, with source and date.',
    last: fmtStamp(n?.last_at), next: pt ? 'todo dia por volta das 06:43 (Rio)' : 'every day around 06:43 (Rio time)',
    counts: n ? [plural(lang, n.searches_today, pt ? 'busca hoje' : 'search today', pt ? 'buscas hoje' : 'searches today'), plural(lang, n.searches_month, pt ? 'no mês' : 'this month', pt ? 'no mês' : 'this month')] : [],
    note: !n ? (pt ? 'sem dado ainda' : 'no data yet')
      : !n.has_config ? (pt ? 'Este setor ainda não tem a coleta configurada na ficha.' : 'This sector has no collection set up yet.')
      : spent && budget ? (pt ? `Gasto do mês: ${spent} de ${budget} (fatia de notícias, pela ficha)` : `Spent this month: ${spent} of ${budget} (news share, per the playbook)`)
      : spent ? (pt ? `Gasto do mês: ${spent}` : `Spent this month: ${spent}`) : null,
  }
  // 2. Coleta do Instagram — Estágio 4 ainda não existe. Só aparecem os dados do diagnóstico gratuito, se houver.
  const dg = d.diag
  const diagBits = [num(dg.competitors) && dg.competitors > 0 ? plural(lang, dg.competitors, pt ? 'concorrente' : 'competitor', pt ? 'concorrentes' : 'competitors') : '', num(dg.trends) && dg.trends > 0 ? plural(lang, dg.trends, pt ? 'tendência' : 'trend', pt ? 'tendências' : 'trends') : ''].filter(Boolean)
  const dgDate = fmtStamp(dg.at)?.split(' ')[0]
  const step2: FlowStep = {
    key: 'instagram', status: 'building',
    name: pt ? 'Coleta do Instagram' : 'Instagram collection',
    desc: pt ? 'Vai acompanhar os perfis concorrentes toda semana. Ainda não está pronto — por enquanto nada é coletado sozinho.' : 'Will follow competitor profiles every week. Not built yet — nothing is collected automatically for now.',
    counts: diagBits.length ? [pt ? `dados do diagnóstico${dgDate ? ` de ${dgDate}` : ''}` : `diagnosis data${dgDate ? ` from ${dgDate}` : ''}`, diagBits.join(' · ')] : [],
  }
  // 3. Sinais de mercado — aba 🌐 Insights e evidências.
  const g = d.signals
  const step3: FlowStep = {
    key: 'sinais', status: num(g.total) && g.total > 0 ? 'ok' : 'waiting',
    name: pt ? 'Sinais de mercado' : 'Market signals',
    desc: pt ? 'Notícias e fatos do mercado guardados com fonte e data. Os automáticos você pode apagar.' : 'Market news and facts saved with source and date. You can delete the automatic ones.',
    last: fmtStamp(g.lastAt), noTiming: false,
    counts: num(g.total) ? [pt ? `${g.total} no total${num(g.auto) && num(g.manual) ? ` (${g.auto} automáticos, ${g.manual} manuais)` : ''}` : `${g.total} total${num(g.auto) && num(g.manual) ? ` (${g.auto} automatic, ${g.manual} manual)` : ''}`, ...(num(g.new7) ? [pt ? `${g.new7} novos em 7 dias` : `${g.new7} new in 7 days`] : [])] : [],
    onClick: o.hasMarket ? () => o.go('mercado') : undefined,
  }
  // 4. Ideias, lugares e dicas — só as abas que existem para o setor.
  const e = d.enrich
  const bits: string[] = []
  if (num(e.ideas)) bits.push(plural(lang, e.ideas, pt ? 'ideia' : 'idea', pt ? 'ideias' : 'ideas'))
  if (o.hasNearby && num(e.places)) bits.push(plural(lang, e.places, pt ? 'lugar' : 'place', pt ? 'lugares' : 'places'))
  if (o.hasFaq && num(e.faq)) bits.push(plural(lang, e.faq, pt ? 'dica' : 'tip', pt ? 'dicas' : 'tips'))
  const any = (e.ideas ?? 0) + (o.hasNearby ? e.places ?? 0 : 0) + (o.hasFaq ? e.faq ?? 0 : 0) > 0
  const step4: FlowStep = {
    key: 'enriquecimento', status: any ? 'ok' : 'waiting', noTiming: true,
    name: pt ? 'Ideias, lugares e dicas' : 'Ideas, places and tips',
    desc: pt ? 'O que o mercado ensina vira ideias de post, lugares perto dos imóveis e respostas para as perguntas dos clientes.' : 'What the market teaches becomes post ideas, places near your properties and answers to customer questions.',
    counts: bits.length ? [bits.join(' · ')] : [], note: bits.length ? null : (pt ? 'sem dado ainda' : 'no data yet'),
    onClick: () => o.go('ideias'),
  }
  return [step1, step2, step3, step4]
}

export type OppAnchor = 'list'

export function oppSteps(lang: Lang, d: OppFlow, o: { go: (a: OppAnchor) => void; nowMs?: number }): FlowStep[] {
  const pt = lang === 'pt'
  const now = o.nowMs ?? Date.now()
  const l = d.ledger
  const lastOk = ms(l?.last_ok_at), lastFail = ms(l?.last_fail_at)
  // 1. Verificação automática — cron `opportunities-auto`: a cada 6 h, minuto 17 (docs/ARCHITECTURE). Não se consulta o cron daqui.
  const step1: FlowStep = {
    key: 'verificacao', status: l ? 'ok' : 'waiting', noTiming: true,
    name: pt ? 'Verificação automática' : 'Automatic check',
    desc: pt ? 'O sistema confere sozinho se já é hora de buscar oportunidades e de preparar planos e peças.' : 'The system checks by itself whether it is time to look for opportunities and prepare plans and pieces.',
    next: pt ? 'a cada 6 horas' : 'every 6 hours',
    note: pt ? 'O horário de cada passagem não fica registrado; o resultado aparece nos passos seguintes.' : 'The time of each pass is not recorded; the result shows in the next steps.',
  }
  // 2. Rodada de busca — run_opportunities; "próxima" pela regra real (shouldRunOpportunities).
  const failedLast = lastFail != null && (lastOk == null || lastFail > lastOk)
  const nr = nextOpportunityRound(lastOk, ms(d.lastSignalAt), lastFail)
  const when = (t: number | null) => (t != null && t > now ? fmtStamp(new Date(t).toISOString()) : null)
  let next: string
  if (nr.kind === 'first') next = when(nr.atMs) ? (pt ? `na primeira verificação depois de ${when(nr.atMs)}` : `at the first check after ${when(nr.atMs)}`) : (pt ? 'na próxima verificação (a cada 6 horas)' : 'at the next check (every 6 hours)')
  else if (nr.kind === 'signal') next = when(nr.atMs) ? (pt ? `há sinal de mercado novo — na primeira verificação depois de ${when(nr.atMs)}` : `new market signal — at the first check after ${when(nr.atMs)}`) : (pt ? 'há sinal de mercado novo — na próxima verificação' : 'new market signal — at the next check')
  else next = when(nr.atMs) ? (pt ? `${when(nr.atMs)} (7 dias depois da última), ou antes se entrar sinal de mercado novo (mín. 24 h entre rodadas)` : `${when(nr.atMs)} (7 days after the last), or earlier on a new market signal (min. 24 h between rounds)`) : (pt ? 'na próxima verificação (já passaram 7 dias)' : 'at the next check (7 days have passed)')
  const step2: FlowStep = {
    key: 'rodada', status: failedLast ? 'error' : lastOk ? 'ok' : 'waiting', error: shortError(l?.last_fail_error) || (pt ? 'falhou sem detalhe' : 'failed without detail'),
    name: pt ? 'Rodada de busca' : 'Search round',
    desc: pt ? 'Cruza seu catálogo com o mercado e escolhe as melhores oportunidades.' : 'Crosses your catalog with the market and picks the best opportunities.',
    last: fmtStamp(l?.last_ok_at ?? l?.last_fail_at), next,
    counts: num(l?.generated_last_run) ? [pt ? `${l!.generated_last_run} ${l!.generated_last_run === 1 ? 'oportunidade' : 'oportunidades'} na última busca` : `${l!.generated_last_run} ${l!.generated_last_run === 1 ? 'opportunity' : 'opportunities'} in the last search`] : [],
  }
  // 3. Sugeridas — status 'suggested'.
  const step3: FlowStep = {
    key: 'sugeridas', status: num(d.suggested) ? 'ok' : 'waiting', noTiming: true,
    name: pt ? 'Oportunidades sugeridas' : 'Suggested opportunities',
    desc: pt ? 'O que a busca achou. Você aprova ou descarta — nada segue sem o seu aval.' : 'What the search found. You approve or dismiss — nothing goes ahead without your OK.',
    counts: num(d.suggested) ? [pt ? `${d.suggested} sugerida${d.suggested === 1 ? '' : 's'}` : `${d.suggested} suggested`] : [], note: num(d.suggested) ? null : (pt ? 'sem dado ainda' : 'no data yet'),
    waiting: num(d.suggested) && d.suggested > 0 ? (pt ? `${d.suggested} ${d.suggested === 1 ? 'oportunidade' : 'oportunidades'} para você revisar` : `${d.suggested} ${d.suggested === 1 ? 'opportunity' : 'opportunities'} for you to review`) : null,
    onClick: () => o.go('list'),
  }
  // 4. Aprovadas → plano → peças.
  const planWaiting = num(d.withPlan) && num(d.planApproved) ? Math.max(0, d.withPlan - d.planApproved) : 0
  const planErr = !!l?.plan_last_error && num(d.approved) && num(d.withPlan) && d.approved > d.withPlan
  const stamps = [l?.plan_last_at, l?.pieces_last_at].filter(Boolean).sort() as string[]
  const c4: string[] = []
  if (num(d.approved)) c4.push(pt ? `${d.approved} aprovada${d.approved === 1 ? '' : 's'}${num(d.withPlan) ? ` · ${d.withPlan} com plano` : ''}` : `${d.approved} approved${num(d.withPlan) ? ` · ${d.withPlan} with plan` : ''}`)
  if (num(d.pieceDrafts) || num(d.piecePosts)) c4.push(pt ? `${d.pieceDrafts ?? 0} rascunho${d.pieceDrafts === 1 ? '' : 's'} · ${d.piecePosts ?? 0} post${d.piecePosts === 1 ? '' : 's'}` : `${d.pieceDrafts ?? 0} draft${d.pieceDrafts === 1 ? '' : 's'} · ${d.piecePosts ?? 0} post${d.piecePosts === 1 ? '' : 's'}`)
  const step4: FlowStep = {
    key: 'aprovadas', status: planErr ? 'error' : num(d.approved) && d.approved > 0 ? 'ok' : 'waiting', error: shortError(l?.plan_last_error),
    name: pt ? 'Aprovadas → plano → peças' : 'Approved → plan → pieces',
    desc: pt ? 'Aprovou? O sistema monta o plano; aprovando o plano, ele prepara os rascunhos das peças.' : 'Approved? The system builds the plan; once you approve the plan, it prepares the piece drafts.',
    last: fmtStamp(stamps[stamps.length - 1] ?? null), counts: c4, note: c4.length ? null : (pt ? 'sem dado ainda' : 'no data yet'),
    waiting: planWaiting > 0 ? (pt ? `${planWaiting} ${planWaiting === 1 ? 'plano' : 'planos'} para você aprovar` : `${planWaiting} ${planWaiting === 1 ? 'plan' : 'plans'} for you to approve`) : null,
    onClick: () => o.go('list'),
  }
  return [step1, step2, step3, step4]
}
