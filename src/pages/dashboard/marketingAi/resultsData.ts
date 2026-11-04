import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  marketingBlock, commercialBlock, conversationsByMedia,
  type MarketingBlock, type CommercialBlock, type CountSrc, type Src, type PostRow, type PerfRow, type EventRow, type LeadRow,
} from './resultsModel'

// Leitura (só com o login do dono, como useItemActivity) dos dados da Fase 5. Cada consulta vira `{ ok, rows }`: erro de rede, coluna
// ausente (migration pendente) ou política = ok:false → o modelo mostra "Não foi possível verificar", nunca "0".
// Ligação peça→métrica: posts.instagram_media_id = instagram_content_performance.media_id. Ligação peça→conversa: o mesmo id em
// engagement_events.media_ref. Ligação comercial: por imóvel (leads.item_id) / oportunidade — nunca por peça (docs/DECISIONS.md, 2026-11-04).

const LIMIT = 500
const CHUNK = 100 // ids por consulta (a lista vai na URL)
type Res = { data: unknown; error: unknown }
async function rows<T>(p: PromiseLike<Res>): Promise<Src<T>> {
  try { const r = await p; return r.error ? { ok: false, rows: [] } : { ok: true, rows: (r.data ?? []) as T[] } } catch { return { ok: false, rows: [] } }
}
async function count(p: PromiseLike<{ count: number | null; error: unknown }>): Promise<CountSrc> {
  try { const r = await p; return r.error || r.count === null ? { ok: false, count: null } : { ok: true, count: r.count } } catch { return { ok: false, count: null } }
}
const mediaIdsOf = (p: Src<PostRow>) => [...new Set(p.rows.map(r => r.instagram_media_id).filter((x): x is string => !!x))]
/** Consulta em blocos de ids; se qualquer bloco falhar o conjunto inteiro falha (nada de soma parcial calada). */
async function chunked<T>(ids: string[], run: (part: string[]) => PromiseLike<Res>): Promise<Src<T>> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const r = await rows<T>(run(ids.slice(i, i + CHUNK)))
    if (!r.ok) return { ok: false, rows: [] }
    out.push(...r.rows)
  }
  return { ok: true, rows: out }
}

/** Posts de um imóvel ou de uma oportunidade + métricas (Marketing) — duas consultas encadeadas. */
export async function loadPostsAndPerf(companyId: string, col: 'item_id' | 'opportunity_id', id: string) {
  const posts = await rows<PostRow>(supabase.from('posts').select('id, status, instagram_media_id').eq('company_id', companyId).eq(col, id).limit(LIMIT))
  const perf: Src<PerfRow> = posts.ok
    ? await chunked<PerfRow>(mediaIdsOf(posts), part => supabase.from('instagram_content_performance').select('media_id, reach, likes, comments, shares, saves').eq('company_id', companyId).in('media_id', part))
    : { ok: false, rows: [] }
  return { posts, perf }
}

export function loadEvents(companyId: string, mediaIds: string[]): Promise<Src<EventRow>> {
  return chunked<EventRow>(mediaIds, part => supabase.from('engagement_events').select('media_ref, intent_detected, ig_user_id, ig_user').eq('company_id', companyId).not('intent_detected', 'is', null).in('media_ref', part).limit(5000))
}

export type Loadable<T> = { state: 'loading' } | { state: 'done'; value: T }
export interface ItemResultsData { marketing: MarketingBlock; commercial: CommercialBlock; postsNoItem: CountSrc; leadsNoOrigin: CountSrc }

/** "Resultado do imóvel": Marketing (posts.item_id + métricas) e Comercial (leads.item_id + conversas por media_ref). */
export function useItemResults(companyId: string, itemId: string, enabled: boolean): Loadable<ItemResultsData> {
  const [data, setData] = useState<Loadable<ItemResultsData>>({ state: 'loading' })
  useEffect(() => {
    if (!enabled) return
    let alive = true
    setData({ state: 'loading' })
    void (async () => {
      const [{ posts, perf }, leads, postsNoItem, leadsNoOrigin] = await Promise.all([
        loadPostsAndPerf(companyId, 'item_id', itemId),
        rows<LeadRow>(supabase.from('leads').select('visit_at, proposal_at, closed_at, closed_value').eq('company_id', companyId).eq('item_id', itemId).limit(LIMIT)),
        count(supabase.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('item_id', null).in('status', ['published', 'publicado'])),
        count(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('item_id', null).is('opportunity_id', null).is('link_id', null)),
      ])
      const events = posts.ok ? await loadEvents(companyId, mediaIdsOf(posts)) : { ok: false, rows: [] as EventRow[] }
      if (alive) setData({ state: 'done', value: { marketing: marketingBlock(posts, perf), commercial: commercialBlock(leads, posts, events), postsNoItem, leadsNoOrigin } })
    })()
    return () => { alive = false }
  }, [companyId, itemId, enabled])
  return data
}

/** Marketing de uma oportunidade (posts.opportunity_id + métricas). O lado comercial continua vindo de opportunity_results. */
export function useOpportunityMarketing(companyId: string, oppId: string): Loadable<MarketingBlock> {
  const [data, setData] = useState<Loadable<MarketingBlock>>({ state: 'loading' })
  useEffect(() => {
    let alive = true
    setData({ state: 'loading' })
    void loadPostsAndPerf(companyId, 'opportunity_id', oppId).then(({ posts, perf }) => { if (alive) setData({ state: 'done', value: marketingBlock(posts, perf) }) })
    return () => { alive = false }
  }, [companyId, oppId])
  return data
}

/** Conversas por post (Resultados): media_id → nº de conversas. `error` = não foi possível verificar. */
export type ConvState = { state: 'loading' } | { state: 'error' } | { state: 'ok'; byMedia: Record<string, number> }
export function useConversationsByMedia(companyId: string, mediaIds: string[], enabled: boolean): ConvState {
  const [data, setData] = useState<ConvState>({ state: 'loading' })
  const key = mediaIds.join('|')
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const ids = key ? key.split('|') : []
    setData({ state: 'loading' })
    void loadEvents(companyId, ids).then(ev => {
      if (alive) setData(ev.ok ? { state: 'ok', byMedia: conversationsByMedia(ev.rows, ids) } : { state: 'error' })
    })
    return () => { alive = false }
  }, [companyId, key, enabled])
  return data
}
