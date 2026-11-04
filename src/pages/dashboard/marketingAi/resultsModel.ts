// Fase 5 — Resultados lado a lado: Marketing (Instagram) e Comercial (leads) em DOIS blocos separados. Módulo puro (sem I/O),
// no estilo de leadOrigin.ts; testado em scripts/test-results-model.mjs.
// Regras:
//  - todo valor é número | null; null = "sem medição"/"sem dado" e NUNCA vira 0 (zero só quando a consulta deu certo e o dado existe);
//  - nunca soma entre blocos e não existe nota única (o 80/20 de learning.ts é "aprendizado", outra coisa);
//  - a ligação comercial é por IMÓVEL / OPORTUNIDADE, nunca por peça: `tracked_links` é único por imóvel+oportunidade+canal e
//    `content_id` guarda só a primeira peça — por isso nada aqui diz "esta peça gerou este lead";
//  - conversa por peça é o único vínculo verificável peça→conversa: `engagement_events.media_ref` = `posts.instagram_media_id`.

export type Num = number | null
/** Resultado de uma consulta: `ok:false` = a consulta falhou (→ "Não foi possível verificar"), nunca "sem resultado". */
export interface Src<T> { ok: boolean; rows: T[] }
export interface CountSrc { ok: boolean; count: number | null }

export interface PostRow { id: string; status: string | null; instagram_media_id: string | null; item_id?: string | null }
export interface PerfRow { media_id: string; reach: Num; likes: Num; comments: Num; shares: Num; saves: Num }
export interface EventRow { media_ref: string | null; intent_detected: string | null; ig_user_id?: string | null; ig_user?: string | null }
export interface LeadRow { visit_at: string | null; proposal_at: string | null; closed_at: string | null; closed_value: Num }

/** `error` = alguma consulta do bloco falhou; `absent` = consulta ok mas não há nada ligado; `ok` = há dado real. */
export type BlockState = 'ok' | 'error' | 'absent'

export interface MarketingBlock {
  state: BlockState
  posts: Num; reach: Num; saves: Num; shares: Num; likes: Num; comments: Num
  /** Publicados que têm `instagram_media_id` mas ainda sem linha de métrica (ou sem media_id): fora das somas. */
  postsWithoutMetric: Num
  /** A consulta de métricas falhou (os posts foram contados, as métricas não). */
  metricsError: boolean
}
export interface CommercialBlock {
  state: BlockState
  conversas: Num; leads: Num; visitas: Num; propostas: Num; vendas: Num
  valor: Num // soma só dos valores informados; null se nenhuma venda tem valor
  vendasComValor: Num
  conversasError: boolean
}

const PUBLISHED = new Set(['published', 'publicado'])
export const isPublished = (p: Pick<PostRow, 'status'>) => PUBLISHED.has(String(p.status ?? '').toLowerCase())

const NONE_M: MarketingBlock = { state: 'error', posts: null, reach: null, saves: null, shares: null, likes: null, comments: null, postsWithoutMetric: null, metricsError: false }
const NONE_C: CommercialBlock = { state: 'error', conversas: null, leads: null, visitas: null, propostas: null, vendas: null, valor: null, vendasComValor: null, conversasError: false }

/** Soma só os valores conhecidos; nenhum conhecido → null (não 0). */
function sumKnown(vals: Num[]): Num {
  const known = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return known.length ? known.reduce((a, b) => a + b, 0) : null
}

export function marketingBlock(posts: Src<PostRow>, perf: Src<PerfRow>): MarketingBlock {
  if (!posts.ok) return { ...NONE_M }
  const published = posts.rows.filter(isPublished)
  if (published.length === 0) return { ...NONE_M, state: 'absent' }
  const base = { ...NONE_M, state: 'ok' as const, posts: published.length }
  const mediaIds = [...new Set(published.map(p => p.instagram_media_id).filter((x): x is string => !!x))]
  if (!perf.ok) return { ...base, metricsError: true }
  const byMedia = new Map(perf.rows.map(r => [r.media_id, r]))
  const measured = mediaIds.map(m => byMedia.get(m)).filter((r): r is PerfRow => !!r)
  // Posts sem métrica = publicados cujo media_id não tem linha (inclui os sem media_id). Posts distintos, não mídias.
  const withMetric = published.filter(p => p.instagram_media_id && byMedia.has(p.instagram_media_id)).length
  return {
    ...base,
    reach: sumKnown(measured.map(r => r.reach)), saves: sumKnown(measured.map(r => r.saves)), shares: sumKnown(measured.map(r => r.shares)),
    likes: sumKnown(measured.map(r => r.likes)), comments: sumKnown(measured.map(r => r.comments)),
    postsWithoutMetric: published.length - withMetric,
  }
}

/** Conversas por media_id: comentário com intenção detectada, uma por usuário do IG em cada post (mesma regra do 80/20). */
export function conversationsByMedia(events: EventRow[], mediaIds: string[]): Record<string, number> {
  const wanted = new Set(mediaIds)
  const by = new Map<string, Set<string>>()
  events.forEach((e, i) => {
    if (!e.intent_detected || !e.media_ref || !wanted.has(e.media_ref)) return
    const set = by.get(e.media_ref) ?? new Set<string>()
    set.add(String(e.ig_user_id ?? e.ig_user ?? `evt#${i}`))
    by.set(e.media_ref, set)
  })
  return Object.fromEntries([...by].map(([k, s]) => [k, s.size]))
}

/**
 * Bloco comercial de um imóvel (leads.item_id). Conversas vêm dos posts publicados do imóvel via media_ref.
 * `posts`/`events` só servem às conversas: se falharem, conversas = null + conversasError (leads seguem).
 */
export function commercialBlock(leads: Src<LeadRow>, posts: Src<PostRow>, events: Src<EventRow>): CommercialBlock {
  if (!leads.ok) return { ...NONE_C }
  let conversas: Num = null
  let conversasError = false
  if (!posts.ok || !events.ok) conversasError = true
  else {
    const mediaIds = [...new Set(posts.rows.filter(isPublished).map(p => p.instagram_media_id).filter((x): x is string => !!x))]
    // Sem peça publicada com media_id não há como ligar conversa a este imóvel → "sem dado", não 0.
    if (mediaIds.length) conversas = Object.values(conversationsByMedia(events.rows, mediaIds)).reduce((a, b) => a + b, 0)
  }
  const rows = leads.rows
  const sold = rows.filter(l => l.closed_at)
  const withValue = sold.filter(l => typeof l.closed_value === 'number')
  return {
    state: 'ok', conversas, conversasError,
    leads: rows.length,
    visitas: rows.filter(l => l.visit_at).length,
    propostas: rows.filter(l => l.proposal_at).length,
    vendas: sold.length,
    valor: sumKnown(withValue.map(l => l.closed_value)),
    vendasComValor: withValue.length,
  }
}

/** Texto de um valor: null → "sem medição" (marketing) ou "sem dado" (comercial); nunca "0" no lugar de desconhecido. */
export function show(n: Num, noData: string, locale = 'pt-BR'): string {
  return n === null ? noData : n.toLocaleString(locale)
}

/** Linhas de aviso obrigatórias. `null` = não foi possível contar → o texto diz que não foi possível verificar. */
export function leftOutLines(postsNoItem: CountSrc, leadsNoOrigin: CountSrc, lang: 'pt' | 'en'): string[] {
  const pt = lang === 'pt'
  const line = (c: CountSrc, one: string, many: string, fail: string) =>
    !c.ok || c.count === null ? fail : c.count === 1 ? one : many.replace('{n}', String(c.count))
  return [
    line(leadsNoOrigin,
      pt ? '1 lead sem origem registrada' : '1 lead without a recorded origin',
      pt ? '{n} leads sem origem registrada' : '{n} leads without a recorded origin',
      pt ? 'Leads sem origem registrada: não foi possível verificar' : 'Leads without a recorded origin: could not verify'),
    line(postsNoItem,
      pt ? '1 post publicado ficou de fora (imóvel não registrado)' : '1 published post left out (listing not recorded)',
      pt ? '{n} posts publicados ficaram de fora (imóvel não registrado)' : '{n} published posts left out (listing not recorded)',
      pt ? 'Posts sem imóvel registrado: não foi possível verificar' : 'Posts without a recorded listing: could not verify'),
  ]
}
