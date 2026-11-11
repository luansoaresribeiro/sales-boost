import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { DecisionKpis } from './useDecisionKpis'
import type { DecisionDemo } from './growthDemo'

// "O que merece sua atenção" (Pacote A, 2026-11-03): 4 linhas independentes, cada uma com seu estado (regra 5):
// loading | error ("Não foi possível verificar") | empty (ausência) | value. Os números de oportunidade/peças vêm de useDecisionKpis
// (NÃO refazer essas consultas); aqui só as consultas que ele não tem. Não usar usePendencias (canal realtime duplicado — PITFALLS).
export type QState = 'loading' | 'error' | 'empty' | 'value'
export interface Row<T> { state: QState; value?: T; why?: string }
export type NextKind = 'strategy' | 'opportunity' | 'approve' | 'week' | 'ok'
export interface AttentionData {
  signal: Row<{ source: string; date: string }>
  opportunity: Row<{ count: number; title: string | null }>
  direction: Row<{ text: string }>
  next: Row<{ kind: NextKind; count?: number }>
  demo: boolean
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

interface SignalRow { source_name: string | null; source_url: string; observed_at: string }
interface Raw {
  signal: { error: boolean; row: SignalRow | null } | null
  oppTitle: string | null
  strat: { error: boolean; found: boolean; central: string | null } | null
  week: number | null | undefined // undefined = carregando; null = erro
}

export function useAttention(companyId: string | undefined, kpis: DecisionKpis, kpisLoading: boolean, demo: DecisionDemo | null): AttentionData {
  const [raw, setRaw] = useState<Raw>({ signal: null, oppTitle: null, strat: null, week: undefined })
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const today = new Date()
    const from = iso(today), to = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6))
    Promise.all([
      // Sinal válido: fonte, título e data presentes e não ignorado (meta.ignored ainda não existe: tolera ausência).
      supabase.from('market_signals').select('source_name, source_url, observed_at').eq('company_id', companyId)
        .not('source_url', 'is', null).neq('source_url', '').not('title', 'is', null).not('observed_at', 'is', null)
        .or('meta->>ignored.is.null,meta->>ignored.neq.true').order('observed_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('growth_opportunities').select('title').eq('company_id', companyId).eq('status', 'suggested')
        .order('priority_rank', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('marketing_ai_strategies').select('content_plan').eq('company_id', companyId).eq('kind', 'main').eq('status', 'active')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('marketing_ai_test_content').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('source_id', null).gte('planned_for', from).lte('planned_for', to),
    ]).then(([sig, opp, st, wk]) => {
      if (cancelled) return
      const plan = (st.data as { content_plan?: { central_line?: string } | null } | null)?.content_plan
      setRaw({
        signal: { error: !!sig.error, row: (sig.data as SignalRow | null) ?? null },
        oppTitle: opp.error ? null : ((opp.data as { title?: string } | null)?.title ?? null),
        strat: { error: !!st.error, found: !!st.data, central: (plan?.central_line ?? '').trim() || null },
        week: wk.error ? null : wk.count ?? 0,
      })
    }).catch(() => { if (!cancelled) setRaw({ signal: { error: true, row: null }, oppTitle: null, strat: { error: true, found: false, central: null }, week: null }) })
    return () => { cancelled = true }
  }, [companyId])

  if (demo) {
    return {
      demo: true,
      signal: { state: 'value', value: demo.lastSignal },
      opportunity: { state: 'value', value: { count: demo.oppsSuggested, title: demo.oppTitle } },
      direction: { state: 'value', value: { text: demo.direction } },
      next: { state: 'value', value: { kind: 'approve', count: demo.actionsReady } },
    }
  }

  const { signal, strat, week } = raw
  const signalRow: AttentionData['signal'] = !signal ? { state: 'loading' } : signal.error ? { state: 'error' }
    : signal.row ? { state: 'value', value: { source: signal.row.source_name?.trim() || host(signal.row.source_url), date: signal.row.observed_at } } : { state: 'empty' }

  const oppN = kpis.oppsSuggested
  const oppRow: AttentionData['opportunity'] = kpisLoading ? { state: 'loading' } : oppN == null ? { state: 'error' } : oppN === 0 ? { state: 'empty' } : { state: 'value', value: { count: oppN, title: raw.oppTitle } }

  const dirRow: AttentionData['direction'] = !strat ? { state: 'loading' } : strat.error ? { state: 'error' }
    : !strat.found ? { state: 'empty', why: 'no_strategy' } : strat.central ? { state: 'value', value: { text: strat.central } } : { state: 'empty', why: 'no_central' }

  // Próxima ação: cada verificação é sim / não / desconhecida. Anda na ordem e para na primeira que não seja "não".
  // Desconhecida (carregando ou falhou) antes de achar um "sim" = não afirma nada. "Tudo em dia" só com as 4 em "não".
  type V = 'yes' | 'no' | 'loading' | 'unknown'
  const kv = (n: number | null, pos: (n: number) => boolean): V => (kpisLoading ? 'loading' : n == null ? 'unknown' : pos(n) ? 'yes' : 'no')
  const noStrat: V = !strat ? 'loading' : strat.error ? 'unknown' : strat.found ? 'no' : 'yes'
  const weekEmpty: V = noStrat === 'yes' ? 'no' : !strat || week === undefined ? 'loading' : week === null ? 'unknown' : strat.error ? 'unknown' : week === 0 ? 'yes' : 'no'
  const checks: [V, AttentionData['next']['value']][] = [
    [noStrat, { kind: 'strategy' }],
    [kv(oppN, n => n > 0), { kind: 'opportunity', count: oppN ?? 0 }],
    [kv(kpis.actionsReady, n => n > 0), { kind: 'approve', count: kpis.actionsReady ?? 0 }],
    [weekEmpty, { kind: 'week' }],
  ]
  let nextRow: AttentionData['next'] = { state: 'value', value: { kind: 'ok' } }
  for (const [v, val] of checks) {
    if (v === 'no') continue
    nextRow = v === 'yes' ? { state: 'value', value: val } : { state: v === 'loading' ? 'loading' : 'error' }
    break
  }
  return { demo: false, signal: signalRow, opportunity: oppRow, direction: dirRow, next: nextRow }
}
