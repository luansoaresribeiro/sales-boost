import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// 4 indicadores de decisão do hub (Fase 1 do plano pós-validação, 2026-11-03). Janela de 7 dias, regras fixas.
// Só contagens (`head:true`); consulta que falha ou ainda carrega vira null = "sem dado ainda", nunca 0 fingido (regra 5).
// Não usar usePendencias aqui (canal realtime duplicado derruba a página — PITFALLS).
export interface DecisionKpis {
  signals7: number | null        // sinais com fonte e data nos últimos 7 dias (relevância de verdade = Fase 2)
  oppsSuggested: number | null   // oportunidades esperando decisão (status 'suggested')
  oppsNew7: number | null        // ...criadas nos últimos 7 dias
  strategiesActive: number | null // estratégias principais ativas
  actionsReady: number | null    // peças originais (sem adaptações) em 'vault' menos as já agendadas = o que Aprovações mostra
  actionsVault: number | null    // ...e, à parte, as 'draft' (em revisão, ainda não passaram na nota) — NÃO entram no total
}
const EMPTY: DecisionKpis = { signals7: null, oppsSuggested: null, oppsNew7: null, strategiesActive: null, actionsReady: null, actionsVault: null }
const ACTION_LIMIT = 500
const DAY = 24 * 3600_000

export function useDecisionKpis(companyId?: string): { kpis: DecisionKpis; loading: boolean } {
  const [state, setState] = useState<{ kpis: DecisionKpis; loading: boolean }>({ kpis: EMPTY, loading: !!companyId })
  useEffect(() => {
    if (!companyId) { setState({ kpis: EMPTY, loading: false }); return }
    let cancelled = false
    const head = { count: 'exact' as const, head: true }
    const since = new Date(Date.now() - 7 * DAY)
    const sinceIso = since.toISOString()
    const sinceDay = sinceIso.slice(0, 10)
    Promise.all([
      // Data do sinal = observed_at (data da notícia, a coleta sempre grava); sem ela, vale created_at (sinais manuais).
      supabase.from('market_signals').select('id', head).eq('company_id', companyId).not('source_url', 'is', null).neq('source_url', '')
        .or(`observed_at.gte.${sinceDay},and(observed_at.is.null,created_at.gte.${sinceIso})`),
      supabase.from('growth_opportunities').select('id', head).eq('company_id', companyId).eq('status', 'suggested'),
      supabase.from('growth_opportunities').select('id', head).eq('company_id', companyId).eq('status', 'suggested').gte('created_at', sinceIso),
      supabase.from('marketing_ai_strategies').select('id', head).eq('company_id', companyId).eq('kind', 'main').eq('status', 'active'),
      // Mesmo filtro da ApprovalsPage: peça já agendada (agent_actions QUEUED com scheduled_at) não conta. Busca ids (limite 500).
      supabase.from('marketing_ai_test_content').select('id, status').eq('company_id', companyId).in('status', ['vault', 'draft']).is('source_id', null).limit(ACTION_LIMIT),
      supabase.from('agent_actions').select('ref_id').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null).limit(ACTION_LIMIT),
    ]).then(r => {
      if (cancelled) return
      const n = (i: number) => (r[i].error ? null : r[i].count ?? 0)
      // Qualquer consulta falhou (ou estourou o limite, contagem incerta) = sem dado, nunca número chutado.
      let actionsReady: number | null = null, actionsVault: number | null = null
      const pieces = r[4].data as { id: string; status: string }[] | null
      const queued = r[5].data as { ref_id: string }[] | null
      if (!r[4].error && !r[5].error && pieces && queued && pieces.length < ACTION_LIMIT && queued.length < ACTION_LIMIT) {
        const sched = new Set(queued.map(q => q.ref_id))
        const open = pieces.filter(p => !sched.has(p.id))
        actionsReady = open.filter(p => p.status === 'vault').length   // bate com Aprovações
        actionsVault = open.filter(p => p.status === 'draft').length   // em revisão (campo reaproveitado: ver comentário da interface)
      }
      setState({ kpis: { signals7: n(0), oppsSuggested: n(1), oppsNew7: n(2), strategiesActive: n(3), actionsReady, actionsVault }, loading: false })
    }).catch(() => { if (!cancelled) setState({ kpis: EMPTY, loading: false }) })
    return () => { cancelled = true }
  }, [companyId])
  return state
}
