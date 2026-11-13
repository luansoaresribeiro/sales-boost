import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { buildFunnel, type FunnelResult, type LeadRowLite, type LinkEventRow, type LinkRow } from '../../../lib/commercialFunnel'

// Dados do funil comercial do painel (2026-11-12). Janela fixa de 30 dias. Só leitura (as políticas de leitura por empresa já
// cobrem link_events, tracked_links, leads, engagement_events e posts). Consulta que falha ou passa do limite = sem dado
// (null), nunca número chutado (regra 5). Sem canal em tempo real (evita canal duplicado no hub — PITFALLS).
export const FUNNEL_DAYS = 30
const LIMIT = 5000
const DAY = 24 * 3600_000

export interface CommercialFunnelState {
  data: FunnelResult | null
  itemTitles: Record<string, string>
  postTitles: Record<string, string>
  loading: boolean
  error: boolean
}

const short = (s: string | null | undefined) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57)}…` : t
}

export function useCommercialFunnel(companyId?: string, enabled = true): CommercialFunnelState {
  const [state, setState] = useState<CommercialFunnelState>({ data: null, itemTitles: {}, postTitles: {}, loading: !!companyId && enabled, error: false })
  useEffect(() => {
    if (!companyId || !enabled) { setState({ data: null, itemTitles: {}, postTitles: {}, loading: false, error: false }); return }
    let cancelled = false
    const since = new Date(Date.now() - FUNNEL_DAYS * DAY).toISOString()
    ;(async () => {
      const [links, events, leads, visits, comments, autos] = await Promise.all([
        supabase.from('tracked_links').select('id, item_id, content_id, channel').eq('company_id', companyId).limit(LIMIT),
        supabase.from('link_events').select('link_id, event').eq('company_id', companyId).gte('created_at', since).limit(LIMIT),
        supabase.from('leads').select('id, item_id, link_id, channel, source, visit_at, created_at').eq('company_id', companyId).gte('created_at', since).limit(LIMIT),
        supabase.from('leads').select('id, item_id, link_id, channel, source, visit_at, created_at').eq('company_id', companyId).gte('visit_at', since).limit(LIMIT),
        // Comentário com interesse = comentário que acionou uma automação (o mesmo que aparece em Engajamento).
        supabase.from('engagement_events').select('automation_id').eq('company_id', companyId).not('automation_id', 'is', null).gte('created_at', since).limit(LIMIT),
        supabase.from('engagement_automations').select('id, item_id').eq('company_id', companyId).limit(LIMIT),
      ])
      const all = [links, events, leads, visits, comments, autos]
      if (all.some(r => r.error || (r.data?.length ?? 0) >= LIMIT)) throw new Error('consulta incompleta')
      const itemOfAuto = new Map(((autos.data ?? []) as { id: string; item_id: string | null }[]).map(a => [a.id, a.item_id]))
      const linkRows = (links.data ?? []) as LinkRow[]
      const contentIds = [...new Set(linkRows.map(l => l.content_id).filter((x): x is string => !!x))]
      const { data: postRows, error: pErr } = contentIds.length
        ? await supabase.from('posts').select('id, content').eq('company_id', companyId).in('id', contentIds.slice(0, 200))
        : { data: [], error: null }
      if (pErr) throw new Error(pErr.message)
      const posts = (postRows ?? []) as { id: string; content: string | null }[]
      const result = buildFunnel({
        links: linkRows,
        events: (events.data ?? []) as LinkEventRow[],
        leads: (leads.data ?? []) as LeadRowLite[],
        visitLeads: (visits.data ?? []) as LeadRowLite[],
        comments: ((comments.data ?? []) as { automation_id: string }[]).map(c => ({ item_id: itemOfAuto.get(c.automation_id) ?? null })),
        postIds: new Set(posts.map(p => p.id)),
      })
      const itemIds = result.byItem.map(b => b.id)
      const { data: itemRows } = itemIds.length
        ? await supabase.from('marketing_ai_knowledge').select('id, title').eq('company_id', companyId).in('id', itemIds)
        : { data: [] }
      if (cancelled) return
      setState({
        data: result,
        itemTitles: Object.fromEntries(((itemRows ?? []) as { id: string; title: string | null }[]).map(r => [r.id, short(r.title) || '—'])),
        postTitles: Object.fromEntries(posts.map(p => [p.id, short(p.content) || '—'])),
        loading: false, error: false,
      })
    })().catch(() => { if (!cancelled) setState({ data: null, itemTitles: {}, postTitles: {}, loading: false, error: true }) })
    return () => { cancelled = true }
  }, [companyId, enabled])
  return state
}
