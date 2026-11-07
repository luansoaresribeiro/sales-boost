// Estado das 5 estações da fábrica (C.2). Lógica pura — sem three.js, sem React — pra poder ser lida por qualquer tela.
// Regras vêm de docs/DECISIONS.md (04/11 "Regras da fábrica"): "Processando" SÓ com agent_actions.execution_status=EXECUTING;
// QUEUED vira Agendada / Na fila / Atrasada; as outras estações mostram "última rodada" e "atualizado às". Nada de número inventado.
import type { Lang } from '../../../../contexts/LanguageContext'
import type { AgentKey, CardModel } from '../HubAgentCards'
import type { DecisionKpis } from '../useDecisionKpis'
import type { FlowSummary } from '../useFlowSummary'

export type StationKey = AgentKey
export const STATION_KEYS: StationKey[] = ['data', 'opportunities', 'strategy', 'content', 'conversion']

export type StateKind = 'unknown' | 'unavailable' | 'standby' | 'approval' | 'processing' | 'scheduled' | 'queued' | 'late' | 'recent' | 'failed'
export type Maturity = 'operational' | 'validating' | 'awaiting'

// Selo de maturidade (constante única; só muda quando o gate correspondente for aprovado em docs/DECISIONS.md).
// 2 Oportunidades: ainda não aprovado nas 5 perguntas. 4 Ativação: publicação real ainda não validada.
// 5 Resultados: ainda sem publicações reais, logo sem dado de desempenho.
export const MATURITY: Record<StationKey, Maturity> = { data: 'operational', opportunities: 'validating', strategy: 'operational', content: 'validating', conversion: 'awaiting' }

// QUEUED com horário já passado: até 10 min = "Na fila" (o executor roda a cada poucos minutos); depois disso = "Atrasada".
export const QUEUE_LATE_AFTER_MIN = 10
export const RECENT_DONE_HOURS = 24      // "Concluído recentemente"
export const FAILED_WINDOW_DAYS = 7      // falha mais antiga que isso sai da vista (continua na página Aprovações)

export interface ActionsRead {
  executing: number | null
  queued: { scheduled_at: string }[] | null        // QUEUED com horário, mais cedo primeiro
  failed: { at: string; error: string | null } | null  // falha mais recente na janela
  lastDoneAt: string | null                          // último EXECUTED (executed_at)
  error: boolean
}

export interface FactoryInputs {
  lang: Lang
  cards: Record<StationKey, CardModel>
  kpis: DecisionKpis
  flow: FlowSummary
  actions: ActionsRead | null          // null = ainda carregando
  marketLastAt: string | null
  strategyUpdatedAt: string | null
  hasStrategy: boolean
  instagramConnected: boolean
  loading: boolean                     // true até a 1ª resposta de todas as leituras (estado Desconhecido mostra 'Verificando…')
  updatedAt: Date
  now: number
}

export interface StationInfo {
  key: StationKey
  kind: StateKind
  stateLabel: string
  headline: string                      // frase do cartão (mesma fonte)
  facts: { label: string; value: string }[]
  lastEvent: string | null
  updatedAt: string                     // "HH:MM"
  maturity: Maturity
  approvals: number                     // número do "Requer aprovação" (0 = nenhum)
}

const TX = {
  pt: {
    kind: { unknown: 'Não foi possível verificar', unavailable: 'Indisponível', standby: 'Em espera', approval: 'Requer aprovação', processing: 'Processando', scheduled: 'Agendada', queued: 'Na fila', late: 'Atrasada', recent: 'Concluído recentemente', failed: 'Falhou' },
    maturity: { operational: 'Operacional', validating: 'Em validação', awaiting: 'Aguardando dados' },
    lastRound: (h: string) => `Última rodada às ${h}`, lastRoundDay: (d: string) => `Última rodada em ${d}`,
    checking: 'Verificando…', noIg: 'Instagram não conectado',
    f: { signals7: 'Sinais com fonte (7 dias)', autoSignals: 'Notícias coletadas sozinhas', oppsNew: 'Oportunidades para avaliar', oppsOk: 'Oportunidades aprovadas', strat: 'Estratégia ativa', pieces: 'Peças para aprovar', review: 'Peças em revisão', pages: 'Páginas de imóvel no ar', executing: 'Em execução agora', queued: 'Na fila de publicação', leads: 'Leads em 30 dias', tracked: 'Com origem rastreada', yes: 'sim', no: 'não' },
    nextAt: (d: string) => `Próxima: ${d}`, failedAt: (d: string) => `Falhou em ${d}`, doneAt: (d: string) => `Concluído em ${d}`,
    none: 'Sem evento registrado ainda',
  },
  en: {
    kind: { unknown: 'Could not verify', unavailable: 'Unavailable', standby: 'Standby', approval: 'Needs approval', processing: 'Processing', scheduled: 'Scheduled', queued: 'Queued', late: 'Late', recent: 'Recently completed', failed: 'Failed' },
    maturity: { operational: 'Operational', validating: 'In validation', awaiting: 'Awaiting data' },
    lastRound: (h: string) => `Last run at ${h}`, lastRoundDay: (d: string) => `Last run on ${d}`,
    checking: 'Checking…', noIg: 'Instagram not connected',
    f: { signals7: 'Sourced signals (7 days)', autoSignals: 'News collected automatically', oppsNew: 'Opportunities to review', oppsOk: 'Approved opportunities', strat: 'Active strategy', pieces: 'Pieces to approve', review: 'Pieces in review', pages: 'Listing pages live', executing: 'Running now', queued: 'In the publishing queue', leads: 'Leads in 30 days', tracked: 'With tracked source', yes: 'yes', no: 'no' },
    nextAt: (d: string) => `Next: ${d}`, failedAt: (d: string) => `Failed on ${d}`, doneAt: (d: string) => `Done on ${d}`,
    none: 'No event recorded yet',
  },
} as const

const fmtN = (n: number | null) => (n == null ? '—' : String(n))
export const hhmm = (d: Date | string, lang: Lang) => new Date(d).toLocaleTimeString(lang === 'en' ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayTime = (d: string, lang: Lang) => new Date(d).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Classifica QUEUED pelo horário do mais próximo/mais atrasado. Devolve null se não há fila.
export function classifyQueue(queued: { scheduled_at: string }[] | null, now: number): { kind: 'scheduled' | 'queued' | 'late'; first: string } | null {
  if (!queued?.length) return null
  const times = queued.map(q => new Date(q.scheduled_at).getTime()).filter(t => !Number.isNaN(t)).sort((a, b) => a - b)
  if (!times.length) return null
  const oldest = times[0]
  const lateMs = QUEUE_LATE_AFTER_MIN * 60_000
  const kind = oldest > now ? 'scheduled' : now - oldest > lateMs ? 'late' : 'queued'
  return { kind, first: new Date(oldest).toISOString() }
}

export function buildStations(i: FactoryInputs): Record<StationKey, StationInfo> {
  const t = TX[i.lang]
  const upd = hhmm(i.updatedAt, i.lang)
  const { kpis, flow, actions } = i
  const lastRound = (iso: string | null) => (iso ? t.lastRound(hhmm(iso, i.lang)) + ` (${new Date(iso).toLocaleDateString(i.lang === 'en' ? 'en-US' : 'pt-BR')})` : null)
  // Cartão sem dado = cardModels devolveu 'Verificando…'/'Não foi possível verificar' (tom neutro e sem informação extra).
  const unknownCard = (k: StationKey) => i.cards[k].tone === 'muted' && !i.cards[k].info

  const mk = (key: StationKey, kind: StateKind, facts: StationInfo['facts'], lastEvent: string | null, approvals = 0): StationInfo =>
    ({ key, kind, stateLabel: kind === 'unknown' && i.loading ? t.checking : t.kind[kind], headline: i.cards[key].status, facts, lastEvent, updatedAt: upd, maturity: MATURITY[key], approvals })

  // 1 Inteligência de Mercado: nunca "Processando"; mostra a última rodada real (varredura registrada).
  const market = mk('data', unknownCard('data') ? 'unknown' : 'standby',
    [{ label: t.f.signals7, value: fmtN(kpis.signals7) }, { label: t.f.autoSignals, value: fmtN(flow.autoSignals) }], lastRound(i.marketLastAt) ?? t.none)
  market.headline = i.cards.data.info ? `${i.cards.data.status} — ${i.cards.data.info}` : i.cards.data.status

  // 2 Motor de Oportunidades.
  const oppN = kpis.oppsSuggested
  const opps = mk('opportunities', oppN == null ? 'unknown' : oppN > 0 ? 'approval' : 'standby',
    [{ label: t.f.oppsNew, value: fmtN(oppN) }, { label: t.f.oppsOk, value: fmtN(flow.oppsApproved) }], lastRound(flow.lastOppAt) ?? t.none, oppN ?? 0)

  // 3 Estratégia.
  const strat = mk('strategy', unknownCard('strategy') ? 'unknown' : 'standby',
    [{ label: t.f.strat, value: i.hasStrategy ? t.f.yes : t.f.no }], lastRound(i.strategyUpdatedAt) ?? t.none)
  strat.headline = i.cards.strategy.info ? `${i.cards.strategy.status} — ${i.cards.strategy.info}` : i.cards.strategy.status

  // 4 Ativação: a única estação com execução real gravada (agent_actions).
  const ready = kpis.actionsReady
  const facts4 = [{ label: t.f.pieces, value: fmtN(ready) }, { label: t.f.review, value: fmtN(kpis.actionsVault) }, { label: t.f.queued, value: actions?.queued ? String(actions.queued.length) : '—' }, { label: t.f.executing, value: fmtN(actions?.executing ?? null) }, { label: t.f.pages, value: fmtN(flow.pagesLive) }]
  let content: StationInfo
  if (!actions || actions.error) content = mk('content', 'unknown', facts4, null)
  else {
    const q = classifyQueue(actions.queued, i.now)
    const doneRecent = actions.lastDoneAt && i.now - new Date(actions.lastDoneAt).getTime() < RECENT_DONE_HOURS * 3600_000
    const last = actions.failed ? t.failedAt(dayTime(actions.failed.at, i.lang)) + (actions.failed.error ? `: ${actions.failed.error}` : '')
      : q ? t.nextAt(dayTime(q.first, i.lang)) : actions.lastDoneAt ? t.doneAt(dayTime(actions.lastDoneAt, i.lang)) : t.none
    // falha só acende se nenhuma ação terminou com sucesso depois dela; execução em andamento vem primeiro
    const failedOpen = !!actions.failed && !(actions.lastDoneAt && new Date(actions.lastDoneAt).getTime() > new Date(actions.failed.at).getTime())
    if ((actions.executing ?? 0) > 0) content = mk('content', 'processing', facts4, last)
    else if (failedOpen) content = mk('content', 'failed', facts4, last)
    else if (q) content = mk('content', q.kind, facts4, last)
    else if (ready != null && ready > 0) content = mk('content', 'approval', facts4, last, ready)
    else if (doneRecent) content = mk('content', 'recent', facts4, last)
    else content = mk('content', ready == null ? 'unknown' : 'standby', facts4, last)
  }
  content.headline = i.cards.content.info ? `${i.cards.content.status} — ${i.cards.content.info}` : i.cards.content.status

  // 5 Resultados e Aprendizado: sem Instagram conectado não há o que medir = Indisponível.
  const results = mk('conversion', !i.instagramConnected ? 'unavailable' : unknownCard('conversion') ? 'unknown' : 'standby',
    [{ label: t.f.leads, value: fmtN(flow.leads30) }, { label: t.f.tracked, value: fmtN(flow.tracked30) }], !i.instagramConnected ? t.noIg : t.none)

  return { data: market, opportunities: opps, strategy: strat, content, conversion: results }
}

export const maturityLabel = (m: Maturity, lang: Lang) => TX[lang].maturity[m]
