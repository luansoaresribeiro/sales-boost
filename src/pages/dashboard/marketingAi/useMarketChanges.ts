import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { deriveChanges, type Changes, type RunRow } from './marketChanges'

// "O que mudou" (Fase 2): últimas rodadas de `market_intel_runs` (coleta / reclassificação / análise) + quantos sinais o sistema ignorou.
// Busca as 20 mais recentes (não só 2) porque cada dia grava até 3 fases e a tela precisa da última de CADA uma.
// Estados: loading · error (consulta falhou ou a tabela ainda não existe) · empty (nenhuma rodada) · ready. systemIgnored null = não medido.
export type MarketChangesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty'; systemIgnored: number | null }
  | { status: 'ready'; changes: Changes; systemIgnored: number | null }

export function useMarketChanges(companyId: string | undefined, enabled = true): { state: MarketChangesState; reload: () => void } {
  const [state, setState] = useState<MarketChangesState>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(x => x + 1), [])
  useEffect(() => {
    if (!companyId || !enabled) return
    let cancelled = false
    Promise.all([
      supabase.from('market_intel_runs').select('phase, searched, collected, filtered, accepted, interpreted, discarded, ignored_by_system, unchanged, cost_usd, month_cost_usd, tokens, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
      supabase.from('market_signals').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('meta->>ignored', 'true').eq('meta->>ignored_by', 'system'),
    ]).then(([runs, ign]) => {
      if (cancelled) return
      if (runs.error) { setState({ status: 'error' }); return }
      const systemIgnored = ign.error ? null : ign.count ?? 0
      const rows = (runs.data ?? []) as RunRow[]
      setState(rows.length === 0 ? { status: 'empty', systemIgnored } : { status: 'ready', changes: deriveChanges(rows), systemIgnored })
    }).catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [companyId, enabled, tick])
  return { state, reload }
}
