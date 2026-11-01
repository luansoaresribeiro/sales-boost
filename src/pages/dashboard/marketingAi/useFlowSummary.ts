import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Resumo ao vivo dos 5 componentes do fluxo (hub do Marketing AI). Só contagens de linhas reais da empresa;
// consulta que falha vira null e o card simplesmente não mostra aquela linha — nunca um 0 fingido (regra 5).
export interface FlowSummary {
  items: number | null          // imóveis do catálogo
  signals: number | null        // sinais de mercado (manuais + automáticos)
  autoSignals: number | null    // notícias que o sistema buscou sozinho
  oppsNew: number | null        // oportunidades esperando o dono
  oppsApproved: number | null
  lastOppAt: string | null      // última rodada do motor
  pagesLive: number | null      // páginas de imóvel no ar
  leads30: number | null        // leads dos últimos 30 dias
  tracked30: number | null      // ...desses, com origem rastreada (link da página)
}

const EMPTY: FlowSummary = { items: null, signals: null, autoSignals: null, oppsNew: null, oppsApproved: null, lastOppAt: null, pagesLive: null, leads30: null, tracked30: null }

export function useFlowSummary(companyId?: string): FlowSummary {
  const [s, setS] = useState<FlowSummary>(EMPTY)
  useEffect(() => {
    if (!companyId) { setS(EMPTY); return }
    let cancelled = false
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
    const head = { count: 'exact' as const, head: true }
    Promise.all([
      supabase.from('marketing_ai_knowledge').select('id', head).eq('company_id', companyId).eq('kind', 'product'),
      supabase.from('market_signals').select('id', head).eq('company_id', companyId),
      supabase.from('market_signals').select('id', head).eq('company_id', companyId).eq('collected_by', 'system'),
      supabase.from('growth_opportunities').select('id', head).eq('company_id', companyId).eq('status', 'suggested'),
      supabase.from('growth_opportunities').select('id', head).eq('company_id', companyId).eq('status', 'approved'),
      supabase.from('growth_opportunities').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('public_pages').select('item_id', head).eq('company_id', companyId).eq('enabled', true),
      supabase.from('leads').select('id', head).eq('company_id', companyId).gte('created_at', since),
      supabase.from('leads').select('id', head).eq('company_id', companyId).gte('created_at', since).not('link_id', 'is', null),
    ]).then(r => {
      if (cancelled) return
      const n = (i: number) => (r[i].error ? null : r[i].count ?? 0)
      const last = r[5].error ? null : ((r[5].data as { created_at?: string } | null)?.created_at ?? null)
      setS({ items: n(0), signals: n(1), autoSignals: n(2), oppsNew: n(3), oppsApproved: n(4), lastOppAt: last, pagesLive: n(6), leads30: n(7), tracked30: n(8) })
    }).catch(() => { if (!cancelled) setS(EMPTY) })
    return () => { cancelled = true }
  }, [companyId])
  return s
}
