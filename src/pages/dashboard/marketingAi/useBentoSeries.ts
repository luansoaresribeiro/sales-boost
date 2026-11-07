import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Séries dos gráficos do Bento (2026-11-07). SÓ LEITURA, uma consulta por série, sempre filtrada por company_id. Sem realtime.
// Falha de consulta ou leitura cortada pelo limite = 'error' ("Não foi possível verificar"), nunca um número chutado (regra 5).
export type Series<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }
export interface MarketDay { day: string; accepted: number | null; discarded: number | null } // day = AAAA-MM-DD (dia local)
export interface OppCounts { suggested: number; approved: number; dismissed: number }
export interface IgPost { id: string; type: string | null; at: string | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null }

export const MARKET_WINDOW_DAYS = 30
export const IG_POSTS = 12
const OPP_LIMIT = 1000
const RUN_LIMIT = 300
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const num = (v: unknown): number | null => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }

function useRead<T>(enabled: boolean, key: string | undefined, run: () => PromiseLike<Series<T>>): Series<T> {
  const [s, setS] = useState<Series<T>>({ status: 'loading' })
  useEffect(() => {
    if (!enabled || !key) return
    let cancelled = false
    run().then(r => { if (!cancelled) setS(r) }, () => { if (!cancelled) setS({ status: 'error' }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])
  return s
}

/** Coletas (market_intel_runs.phase = 'collect') dos últimos 30 dias, somadas por dia: accepted = guardadas, filtered = descartadas pelo filtro. */
export function useMarketSeries(companyId: string | undefined, enabled: boolean): Series<MarketDay[]> {
  return useRead<MarketDay[]>(enabled, companyId, async (): Promise<Series<MarketDay[]>> => {
    const since = new Date(Date.now() - MARKET_WINDOW_DAYS * 24 * 3600_000).toISOString()
    const r = await supabase.from('market_intel_runs').select('created_at, accepted, filtered').eq('company_id', companyId!).eq('phase', 'collect')
      .gte('created_at', since).order('created_at', { ascending: true }).limit(RUN_LIMIT)
    const rows = (r.data ?? []) as { created_at: string; accepted: number | null; filtered: number | null }[]
    if (r.error || rows.length >= RUN_LIMIT) return { status: 'error' }
    const by = new Map<string, MarketDay>()
    for (const x of rows) {
      const k = localDay(x.created_at), a = num(x.accepted), d = num(x.filtered)
      const cur = by.get(k) ?? { day: k, accepted: null, discarded: null }
      if (a != null) cur.accepted = (cur.accepted ?? 0) + a
      if (d != null) cur.discarded = (cur.discarded ?? 0) + d
      by.set(k, cur)
    }
    // dia em que nenhum dos dois contadores foi medido não vira ponto
    return { status: 'ready', data: [...by.values()].filter(x => x.accepted != null || x.discarded != null) }
  })
}

/** growth_opportunities da empresa (todas, sem janela), contadas por status. */
export function useOppSeries(companyId: string | undefined, enabled: boolean): Series<OppCounts> {
  return useRead<OppCounts>(enabled, companyId, async (): Promise<Series<OppCounts>> => {
    const r = await supabase.from('growth_opportunities').select('status').eq('company_id', companyId!).limit(OPP_LIMIT)
    const rows = (r.data ?? []) as { status: string }[]
    if (r.error || rows.length >= OPP_LIMIT) return { status: 'error' }
    const c: OppCounts = { suggested: 0, approved: 0, dismissed: 0 }
    for (const x of rows) if (x.status === 'suggested' || x.status === 'approved' || x.status === 'dismissed') c[x.status]++
    return { status: 'ready', data: c }
  })
}

/** Últimos posts medidos do Instagram (instagram_content_performance, já sincronizada pela aba Desempenho) — leitura da tabela, sem chamar a Meta. */
export function useIgSeries(companyId: string | undefined, enabled: boolean): Series<IgPost[]> {
  return useRead<IgPost[]>(enabled, companyId, async (): Promise<Series<IgPost[]>> => {
    const r = await supabase.from('instagram_content_performance').select('media_id, media_type, posted_at, reach, likes, comments, shares, saves')
      .eq('company_id', companyId!).order('posted_at', { ascending: false }).limit(IG_POSTS)
    if (r.error) return { status: 'error' }
    const rows = (r.data ?? []) as { media_id: string; media_type: string | null; posted_at: string | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null }[]
    return { status: 'ready', data: rows.reverse().map(x => ({ id: x.media_id, type: x.media_type, at: x.posted_at, reach: num(x.reach), likes: num(x.likes), comments: num(x.comments), shares: num(x.shares), saves: num(x.saves) })) }
  })
}

/** Dados de EXEMPLO (só no Modo demonstração, sempre com a etiqueta "exemplo" no cartão). Determinístico por empresa. */
export function demoBento(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296 }
  const market: MarketDay[] = []
  for (let i = MARKET_WINDOW_DAYS - 1; i >= 0; i -= 3) market.push({ day: localDay(new Date(Date.now() - i * 24 * 3600_000).toISOString()), accepted: Math.floor(rnd() * 6) + 1, discarded: Math.floor(rnd() * 14) + 2 })
  const opps: OppCounts = { suggested: 3 + Math.floor(rnd() * 5), approved: 2 + Math.floor(rnd() * 4), dismissed: 1 + Math.floor(rnd() * 5) }
  const ig: IgPost[] = Array.from({ length: IG_POSTS }, (_, i) => ({
    id: `demo${i}`, type: ['post', 'reel', 'carousel'][i % 3], at: new Date(Date.now() - (IG_POSTS - i) * 3 * 24 * 3600_000).toISOString(),
    reach: 400 + Math.floor(rnd() * 1800), likes: 20 + Math.floor(rnd() * 90), comments: Math.floor(rnd() * 14), shares: Math.floor(rnd() * 9), saves: Math.floor(rnd() * 20),
  }))
  return { market, opps, ig }
}
