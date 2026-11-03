import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Uso de cada imóvel do catálogo no fluxo (2026-11-03): qual imóvel entrou em qual peça, quando foi a última,
// quando é a próxima e quantas peças nos últimos 30 dias. UMA consulta por empresa, compartilhada entre
// calendário, modal da peça, catálogo e "Lugares perto" (cache de 30 s + pedido em andamento reaproveitado).
//
// Fonte: marketing_ai_test_content (peças do calendário e avulsas, sem as adaptações) e posts (por item_id).
// Uma peça aprovada vira uma linha em `posts` com o MESMO item_id (agent-actions), então somar as duas fontes
// contaria 2x: o nº em 30 dias é o MAIOR das duas contagens (menor número seguro, nunca inventado).
// Consulta que falha = `ok: false` e as telas ESCONDEM a linha (regra 5: nada de "0" fingido).

export interface ItemInfo { id: string; title: string; cover: string | null; bairro: string | null }
export interface ItemUse {
  last: string | null   // YYYY-MM-DD da última peça (planejada ou criada, até hoje)
  next: string | null   // YYYY-MM-DD da próxima peça planejada (depois de hoje)
  n30: number           // peças nos últimos 30 dias
  total: number         // peças no período lido (mais recentes primeiro, até 2000 linhas por fonte)
}
export interface ItemUsageData { ok: boolean; items: Record<string, ItemInfo>; usage: Record<string, ItemUse> }

const EMPTY: ItemUsageData = { ok: false, items: {}, usage: {} }
const TTL_MS = 30_000
const cache = new Map<string, { at: number; data: ItemUsageData }>()
const inflight = new Map<string, Promise<ItemUsageData>>()

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayOf = (s: string | null): string | null => (s ? (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : isoDay(new Date(s))) : null)

async function fetchUsage(companyId: string): Promise<ItemUsageData> {
  const [kn, tc, ps] = await Promise.all([
    supabase.from('marketing_ai_knowledge').select('id, title, image_url, meta').eq('company_id', companyId).eq('kind', 'product'),
    supabase.from('marketing_ai_test_content').select('item_id, planned_for, created_at').eq('company_id', companyId).not('item_id', 'is', null).is('source_id', null).order('created_at', { ascending: false }).limit(2000),
    supabase.from('posts').select('item_id, published_at, created_at').eq('company_id', companyId).not('item_id', 'is', null).order('created_at', { ascending: false }).limit(2000),
  ])
  if (kn.error || tc.error || ps.error) return EMPTY
  const items: Record<string, ItemInfo> = {}
  for (const r of (kn.data ?? []) as { id: string; title: string; image_url: string | null; meta: { photos?: { url: string }[]; fields?: Record<string, unknown> } | null }[]) {
    const bairro = r.meta?.fields?.bairro
    items[r.id] = { id: r.id, title: r.title, cover: r.image_url ?? r.meta?.photos?.[0]?.url ?? null, bairro: bairro ? String(bairro) : null }
  }
  const today = isoDay(new Date())
  const since = isoDay(new Date(Date.now() - 30 * 86400000))
  type Acc = { last: string | null; next: string | null; tc30: number; ps30: number; tcAll: number; psAll: number }
  const acc: Record<string, Acc> = {}
  const get = (id: string): Acc => (acc[id] ??= { last: null, next: null, tc30: 0, ps30: 0, tcAll: 0, psAll: 0 })
  for (const r of (tc.data ?? []) as { item_id: string; planned_for: string | null; created_at: string }[]) {
    const a = get(r.item_id)
    const d = dayOf(r.planned_for) ?? dayOf(r.created_at)
    if (!d) continue
    a.tcAll++
    if (d > today) { if (!a.next || d < a.next) a.next = d } else {
      if (!a.last || d > a.last) a.last = d
      if (d >= since) a.tc30++
    }
  }
  for (const r of (ps.data ?? []) as { item_id: string; published_at: string | null; created_at: string }[]) {
    const a = get(r.item_id)
    const d = dayOf(r.published_at) ?? dayOf(r.created_at)
    if (!d || d > today) continue
    a.psAll++
    if (!a.last || d > a.last) a.last = d
    if (d >= since) a.ps30++
  }
  const usage: Record<string, ItemUse> = {}
  for (const [id, a] of Object.entries(acc)) usage[id] = { last: a.last, next: a.next, n30: Math.max(a.tc30, a.ps30), total: Math.max(a.tcAll, a.psAll) }
  return { ok: true, items, usage }
}

export function loadItemUsage(companyId: string, force = false): Promise<ItemUsageData> {
  const hit = cache.get(companyId)
  if (!force && hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.data)
  const pending = inflight.get(companyId)
  if (pending) return pending
  const p = fetchUsage(companyId).catch(() => EMPTY).then(data => {
    if (data.ok) cache.set(companyId, { at: Date.now(), data })
    inflight.delete(companyId)
    return data
  })
  inflight.set(companyId, p)
  return p
}

/** Imóvel → uso. `loading` true até a primeira resposta; `data.ok === false` = consulta falhou (esconda a linha). */
export function useItemUsage(companyId: string | null | undefined): { data: ItemUsageData; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<ItemUsageData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const run = useCallback((force: boolean) => {
    if (!companyId) { setLoading(false); return () => {} }
    let alive = true
    loadItemUsage(companyId, force).then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [companyId])
  useEffect(() => run(false), [run])
  return { data, loading, refresh: () => { run(true) } }
}

/** DD/MM a partir de YYYY-MM-DD. */
export const dayLabel = (iso: string): string => iso.split('-').reverse().slice(0, 2).join('/')
