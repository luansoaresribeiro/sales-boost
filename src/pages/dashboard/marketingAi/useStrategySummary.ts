import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Resumo leve da estratégia principal ativa — usado no card compacto do Hub.
// Só lê (nunca gera nada aqui); a geração de verdade mora em StrategySection.
export interface StrategySummary {
  id: string
  name: string
  status: string
  primary_business_objective: string | null
  estimates: { feasibility_status?: string } | null
  updated_at: string
  topGoal: { name: string; target_value: number | null; current_progress: number | null } | null
}

export function useStrategySummary(companyId?: string): { summary: StrategySummary | null; loading: boolean } {
  const [summary, setSummary] = useState<StrategySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) { setLoading(false); return }
    let alive = true
    ;(async () => {
      const { data: strat } = await supabase.from('marketing_ai_strategies')
        .select('id, name, status, primary_business_objective, estimates, updated_at')
        .eq('company_id', companyId).eq('kind', 'main').eq('status', 'active')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (!alive) return
      if (!strat) { setSummary(null); setLoading(false); return }
      const { data: goals } = await supabase.from('marketing_ai_strategy_goals')
        .select('name, target_value, current_progress, priority')
        .eq('strategy_id', strat.id).order('priority', { ascending: true }).limit(1)
      if (!alive) return
      setSummary({ ...(strat as Omit<StrategySummary, 'topGoal'>), topGoal: (goals?.[0] as StrategySummary['topGoal']) ?? null })
      setLoading(false)
    })()
    return () => { alive = false }
  }, [companyId])

  return { summary, loading }
}
