import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useCompany } from '../../../../contexts/CompanyContext'
import type { Lang } from '../../../../contexts/LanguageContext'
import { useStrategySummary } from '../useStrategySummary'
import { useFlowSummary } from '../useFlowSummary'
import { useDecisionKpis } from '../useDecisionKpis'
import { cardModels, type CardModel } from '../HubAgentCards'
import type { DemoAgentStatus } from '../growthDemo'
import { buildStations, FAILED_WINDOW_DAYS, type ActionsRead, type StationInfo, type StationKey } from './factoryState'

// Dados da aba Agentes: os MESMOS hooks dos cartões do hub (estratégia, fluxo, indicadores de decisão) + 2 leituras baratas,
// só de leitura: a última varredura do mercado (mesma tabela que o hub usa) e as ações em andamento/fila/falha (agent_actions).
// Não chama usePendencias (canal realtime duplicado derruba a tela — PITFALLS). Sem tempo real nem recarga automática aqui (C.3).
const LABEL = {
  pt: { last: 'Última varredura real em', none: 'Ainda sem varredura registrada' },
  en: { last: 'Last real scan on', none: 'No scan recorded yet' },
} as const

// Mesmos rótulos e mesma frase de objetivo que o hub usava no cartão da estratégia.
const STATUS = {
  pt: { draft: 'Rascunho', active: 'Ativa', paused: 'Pausada', completed: 'Concluída', needs_review: 'Precisa revisão' },
  en: { draft: 'Draft', active: 'Active', paused: 'Paused', completed: 'Completed', needs_review: 'Needs review' },
} as const

interface Reads { market: { at: string | null } | 'error' | null; actions: ActionsRead | null; at: Date | null }

export function useFactoryState(lang: Lang): { cards: Record<StationKey, CardModel>; stations: Record<StationKey, StationInfo>; loading: boolean } {
  const { company } = useCompany()
  const companyId = company?.id
  const { summary, loading: stratLoading, error: stratError } = useStrategySummary(companyId)
  const flow = useFlowSummary(companyId)
  const { kpis, loading: kpisLoading } = useDecisionKpis(companyId)
  const [reads, setReads] = useState<Reads>({ market: null, actions: null, at: null })

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const since = new Date(Date.now() - FAILED_WINDOW_DAYS * 24 * 3600_000).toISOString()
    Promise.all([
      supabase.from('marketing_ai_trends').select('detected_at').eq('company_id', companyId).eq('source', 'instagram_scan').order('detected_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('agent_actions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('execution_status', 'EXECUTING'),
      supabase.from('agent_actions').select('scheduled_at').eq('company_id', companyId).eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null).order('scheduled_at', { ascending: true }).limit(200),
      supabase.from('agent_actions').select('executed_at, execution_error, created_at').eq('company_id', companyId).eq('execution_status', 'FAILED').gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('agent_actions').select('executed_at').eq('company_id', companyId).eq('execution_status', 'EXECUTED').not('executed_at', 'is', null).order('executed_at', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([m, ex, q, f, d]) => {
      if (cancelled) return
      const failedRow = f.data as { executed_at: string | null; execution_error: string | null; created_at: string } | null
      const actions: ActionsRead = {
        executing: ex.error ? null : ex.count ?? 0,
        queued: q.error ? null : ((q.data ?? []) as { scheduled_at: string }[]),
        failed: failedRow ? { at: failedRow.executed_at ?? failedRow.created_at, error: failedRow.execution_error } : null,
        lastDoneAt: (d.data as { executed_at: string } | null)?.executed_at ?? null,
        error: !!(ex.error || q.error || f.error || d.error),
      }
      setReads({ market: m.error ? 'error' : { at: (m.data as { detected_at: string } | null)?.detected_at ?? null }, actions, at: new Date() })
    }).catch(() => { if (!cancelled) setReads({ market: 'error', actions: { executing: null, queued: null, failed: null, lastDoneAt: null, error: true }, at: new Date() }) })
    return () => { cancelled = true }
  }, [companyId])

  const loading = !company || stratLoading || flow.loading || kpisLoading || reads.actions == null || reads.market == null

  return useMemo(() => {
    const marketAt = reads.market && reads.market !== 'error' ? reads.market.at : null
    const L = LABEL[lang]
    const agents: DemoAgentStatus[] | null = reads.market && reads.market !== 'error'
      ? [{ key: 'market', name: '', icon: '', state: marketAt ? 'active' : 'idle', lastAction: marketAt ? `${L.last} ${new Date(marketAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')}` : L.none }]
      : null
    const stratLabel = summary ? (STATUS[lang] as Record<string, string>)[summary.status] ?? summary.status : ''
    const goal = summary?.topGoal
    const objective = summary ? [summary.primary_business_objective || summary.name, goal ? `${goal.name}${goal.target_value != null ? `: ${goal.current_progress ?? 0}/${goal.target_value}` : ''}` : ''].filter(Boolean).join(' · ') : ''
    const cards = cardModels({
      lang, agents, loading: reads.market == null, kpis, kpisLoading, flow,
      strategy: summary ? { status: summary.status, label: stratLabel, objective } : null,
      strategyLoading: stratLoading, strategyError: stratError,
    })
    const stations = buildStations({
      lang, cards, kpis, flow, actions: reads.actions, marketLastAt: marketAt, strategyUpdatedAt: summary?.updated_at ?? null, hasStrategy: !!summary,
      instagramConnected: !!company?.instagram_user_id, loading, updatedAt: reads.at ?? new Date(), now: (reads.at ?? new Date()).getTime(),
    })
    return { cards, stations, loading }
  }, [lang, kpis, kpisLoading, flow, summary, stratLoading, stratError, reads, company?.instagram_user_id, loading])
}
