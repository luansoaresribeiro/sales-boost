import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Dados reais das faixas de fluxo (um hook por agente). Regra 5: consulta que falha vira null = "sem dado ainda", nunca um 0 fingido.
// O livro-caixa `agent_performance` é lido pela função company_flow_status (só agregados; confere que a empresa é de quem chama).
// Nunca usar usePendencias aqui (canal realtime duplicado derruba a página — PITFALLS).
const HEAD = { count: 'exact' as const, head: true }
const cnt = (r: { error: unknown; count: number | null }): number | null => (r.error ? null : r.count ?? 0)

export interface NewsLedger { has_config: boolean; last_at: string | null; last_ok: boolean | null; last_error: string | null; searches_today: number; searches_month: number; cost_month: number | string; news_budget: number | string | null }
export interface OppLedger {
  last_ok_at: string | null; last_fail_at: string | null; last_fail_error: string | null; last_note: string | null; generated_last_run: number | null
  plans_made: number; plans_failed: number; plan_last_error: string | null; plan_last_at: string | null; pieces_created: number; pieces_last_at: string | null
}
async function flowStatus<T>(companyId: string, key: 'news' | 'opportunities'): Promise<T | null> {
  try {
    const { data, error } = await supabase.rpc('company_flow_status', { p_company: companyId })
    if (error || !data) return null
    return ((data as Record<string, unknown>)[key] as T) ?? null
  } catch { return null }
}

export interface MarketFlow {
  news: NewsLedger | null
  signals: { total: number | null; auto: number | null; manual: number | null; new7: number | null; lastAt: string | null }
  diag: { competitors: number | null; trends: number | null; at: string | null }
  enrich: { ideas: number | null; places: number | null; faq: number | null }
}
export const EMPTY_MARKET: MarketFlow = { news: null, signals: { total: null, auto: null, manual: null, new7: null, lastAt: null }, diag: { competitors: null, trends: null, at: null }, enrich: { ideas: null, places: null, faq: null } }

export function useMarketFlow(companyId?: string): { data: MarketFlow; loading: boolean } {
  const [data, setData] = useState<MarketFlow>(EMPTY_MARKET)
  const [loading, setLoading] = useState(!!companyId)
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const since7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
    Promise.all([
      flowStatus<NewsLedger>(companyId, 'news'),
      supabase.from('market_signals').select('id', HEAD).eq('company_id', companyId),
      supabase.from('market_signals').select('id', HEAD).eq('company_id', companyId).eq('collected_by', 'system'),
      supabase.from('market_signals').select('id', HEAD).eq('company_id', companyId).gte('created_at', since7),
      supabase.from('market_signals').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('marketing_ai_competitors').select('id', HEAD).eq('company_id', companyId),
      supabase.from('marketing_ai_trends').select('id', HEAD).eq('company_id', companyId),
      supabase.from('marketing_ai_trends').select('detected_at').eq('company_id', companyId).order('detected_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('marketing_ai_ideas').select('id', HEAD).eq('company_id', companyId).neq('status', 'dismissed'),
      supabase.from('marketing_ai_knowledge').select('meta').eq('company_id', companyId).eq('kind', 'product').limit(300),
      supabase.from('marketing_ai_knowledge').select('id', HEAD).eq('company_id', companyId).eq('module', 'dados').eq('kind', 'faq'),
    ]).then(r => {
      if (cancelled) return
      const total = cnt(r[1]), auto = cnt(r[2])
      const places = r[9].error ? null : ((r[9].data ?? []) as { meta: { nearby?: { places?: unknown[] } } | null }[]).reduce((s, k) => s + (Array.isArray(k.meta?.nearby?.places) ? k.meta!.nearby!.places!.length : 0), 0)
      setData({
        news: r[0],
        signals: { total, auto, manual: total != null && auto != null ? Math.max(0, total - auto) : null, new7: cnt(r[3]), lastAt: r[4].error ? null : ((r[4].data as { created_at?: string } | null)?.created_at ?? null) },
        diag: { competitors: cnt(r[5]), trends: cnt(r[6]), at: r[7].error ? null : ((r[7].data as { detected_at?: string } | null)?.detected_at ?? null) },
        enrich: { ideas: cnt(r[8]), places, faq: cnt(r[10]) },
      })
      setLoading(false)
    }).catch(() => { if (!cancelled) { setData(EMPTY_MARKET); setLoading(false) } })
    return () => { cancelled = true }
  }, [companyId])
  return { data, loading }
}

export interface OppFlow {
  ledger: OppLedger | null
  lastSignalAt: string | null
  suggested: number | null
  approved: number | null
  withPlan: number | null          // aprovadas que já têm plano
  planApproved: number | null      // ...com plano aprovado pelo dono
  pieceDrafts: number | null       // rascunhos de peça ligados a oportunidade
  piecePosts: number | null        // posts (aprovados) ligados a oportunidade
}
export const EMPTY_OPP: OppFlow = { ledger: null, lastSignalAt: null, suggested: null, approved: null, withPlan: null, planApproved: null, pieceDrafts: null, piecePosts: null }

/** `refreshKey` muda quando a tela recarrega as oportunidades (aprovar/descartar) — a faixa acompanha. */
export function useOppFlow(companyId?: string | null, refreshKey?: unknown): { data: OppFlow; loading: boolean } {
  const [data, setData] = useState<OppFlow>(EMPTY_OPP)
  const [loading, setLoading] = useState(!!companyId)
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    Promise.all([
      flowStatus<OppLedger>(companyId, 'opportunities'),
      supabase.from('market_signals').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('growth_opportunities').select('id', HEAD).eq('company_id', companyId).eq('status', 'suggested'),
      supabase.from('growth_opportunities').select('id', HEAD).eq('company_id', companyId).eq('status', 'approved'),
      supabase.from('growth_opportunities').select('id', HEAD).eq('company_id', companyId).eq('status', 'approved').not('plan', 'is', null),
      supabase.from('growth_opportunities').select('id', HEAD).eq('company_id', companyId).eq('status', 'approved').not('plan_approved_at', 'is', null),
      supabase.from('marketing_ai_test_content').select('id', HEAD).eq('company_id', companyId).not('opportunity_id', 'is', null),
      supabase.from('posts').select('id', HEAD).eq('company_id', companyId).not('opportunity_id', 'is', null),
    ]).then(r => {
      if (cancelled) return
      setData({
        ledger: r[0], lastSignalAt: r[1].error ? null : ((r[1].data as { created_at?: string } | null)?.created_at ?? null),
        suggested: cnt(r[2]), approved: cnt(r[3]), withPlan: cnt(r[4]), planApproved: cnt(r[5]), pieceDrafts: cnt(r[6]), piecePosts: cnt(r[7]),
      })
      setLoading(false)
    }).catch(() => { if (!cancelled) { setData(EMPTY_OPP); setLoading(false) } })
    return () => { cancelled = true }
  }, [companyId, refreshKey])
  return { data, loading }
}
