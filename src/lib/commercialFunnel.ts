// Funil comercial do painel (dono, 2026-11-12): o topo do painel mostra o resultado comercial — visualizações dos imóveis →
// interessados → leads recebidos → visitas agendadas — e de onde veio, por imóvel e por publicação. PURO (sem supabase), testado
// em scripts/test-commercial-funnel.mjs. Regras (especificação de leads v2, docs/CONVERSION.md):
// - só dado que existe; o que não tem medição vem como null ("ainda sem dados"), nunca 0 fingido;
// - "Leads recebidos" NÃO é "lead qualificado" (a qualificação ainda não existe no sistema);
// - comentário e DM contam como interesse; só viram "lead" quando o sistema já criou o lead (como no Funil).

export interface LinkRow { id: string; item_id: string | null; content_id: string | null; channel: string }
export interface LinkEventRow { link_id: string | null; event: string }
export interface LeadRowLite { id: string; item_id: string | null; link_id: string | null; channel: string | null; source: string | null; visit_at: string | null; created_at: string }
export interface CommentRow { item_id: string | null }

export interface FunnelCounts { views: number; interested: number; leads: number; visits: number }
export interface Breakdown { id: string; views: number; interested: number; leads: number; visits: number }
export interface FunnelResult {
  totals: FunnelCounts
  interestedBy: { clicks: number; comments: number }
  leadsBy: { form: number; instagram: number; other: number }
  byItem: Breakdown[]
  byPost: Breakdown[]
}

const blank = (id: string): Breakdown => ({ id, views: 0, interested: 0, leads: 0, visits: 0 })
const CLICKS = new Set(['click_whatsapp', 'click_dm'])

/** Origem de um lead (para a quebra "formulário · Instagram · outros"). */
export function leadChannel(l: Pick<LeadRowLite, 'channel' | 'source' | 'link_id'>): 'form' | 'instagram' | 'other' {
  if (l.link_id || l.source === 'link_page') return 'form'
  if (l.channel === 'instagram' || (l.source ?? '').startsWith('instagram')) return 'instagram'
  return 'other'
}

/**
 * Junta os registros da janela num funil. `visitsSince` = início da janela: visita conta pela data da visita (visit_at), não
 * pela data do lead. `postIds` = publicações reais (posts.id) — link de rascunho (content_id que não é post) não entra em
 * "por publicação".
 */
export function buildFunnel(input: {
  links: LinkRow[]; events: LinkEventRow[]; leads: LeadRowLite[]; visitLeads: LeadRowLite[]; comments: CommentRow[]
  postIds: Set<string>; limit?: number
}): FunnelResult {
  const limit = input.limit ?? 5
  const linkById = new Map(input.links.map(l => [l.id, l]))
  const items = new Map<string, Breakdown>()
  const posts = new Map<string, Breakdown>()
  const it = (id: string | null | undefined) => (id ? (items.get(id) ?? items.set(id, blank(id)).get(id)!) : null)
  const po = (id: string | null | undefined) => (id && input.postIds.has(id) ? (posts.get(id) ?? posts.set(id, blank(id)).get(id)!) : null)

  let views = 0, clicks = 0
  for (const e of input.events) {
    const link = e.link_id ? linkById.get(e.link_id) : undefined
    if (e.event === 'view') {
      views++
      const a = it(link?.item_id); if (a) a.views++
      const b = po(link?.content_id); if (b) b.views++
    } else if (CLICKS.has(e.event)) {
      clicks++
      const a = it(link?.item_id); if (a) a.interested++
      const b = po(link?.content_id); if (b) b.interested++
    }
  }
  for (const c of input.comments) { const a = it(c.item_id); if (a) a.interested++ }

  const leadsBy = { form: 0, instagram: 0, other: 0 }
  for (const l of input.leads) {
    leadsBy[leadChannel(l)]++
    const link = l.link_id ? linkById.get(l.link_id) : undefined
    const a = it(l.item_id ?? link?.item_id); if (a) a.leads++
    const b = po(link?.content_id); if (b) b.leads++
  }
  for (const l of input.visitLeads) {
    const link = l.link_id ? linkById.get(l.link_id) : undefined
    const a = it(l.item_id ?? link?.item_id); if (a) a.visits++
    const b = po(link?.content_id); if (b) b.visits++
  }

  const score = (b: Breakdown) => b.leads * 1e6 + b.interested * 1e3 + b.views
  const top = (m: Map<string, Breakdown>) => [...m.values()].filter(b => b.views + b.interested + b.leads + b.visits > 0).sort((x, y) => score(y) - score(x)).slice(0, limit)
  return {
    totals: { views, interested: clicks + input.comments.length, leads: input.leads.length, visits: input.visitLeads.length },
    interestedBy: { clicks, comments: input.comments.length },
    leadsBy,
    byItem: top(items),
    byPost: top(posts),
  }
}

/** Largura das barras do funil (0–100), relativa ao maior número; tudo zero = barras vazias. */
export function barWidths(t: FunnelCounts): FunnelCounts {
  const max = Math.max(t.views, t.interested, t.leads, t.visits)
  const w = (n: number) => (max > 0 ? Math.round((n / max) * 100) : 0)
  return { views: w(t.views), interested: w(t.interested), leads: w(t.leads), visits: w(t.visits) }
}
