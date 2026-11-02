// Carrossel de OFERTA e de BAIRRO no sistema de slides (PR B, 2026-11-02). Função PURA (sem Deno/rede): só decide
// QUAIS fotos reais entram e QUE texto cada slide leva; o desenho é do render-format (template 'slide') e a
// chamada é do catalog-package. Teste em Node: scripts/test-carousel-offer.mjs.
//
// Regras: foto de item é sempre real (nunca IA); só campo preenchido aparece (nunca "R$ —"); nada de número que
// não esteja no cadastro; no máximo 7 slides (capa + até 4 fotos + dados + fecho — decisão do dono, 2026-11-02).

export interface CatalogPhoto { url: string; path?: string; score?: unknown; quality?: unknown; room?: unknown }
export const OFFER_MAX_SLIDES = 7
export const OFFER_MAX_PHOTOS = 4

/**
 * Nota da foto, de forma TOLERANTE (o PR A grava `meta.photos[i] = {url, room, room_conf, quality, scored_at, model}`,
 * mas a forma exata da nota pode mudar): `score` ou `quality`, número, texto numérico ou objeto com score/overall/value/total.
 * Sem nota utilizável → null (nunca zero: foto sem nota não perde de foto com nota baixa por engano).
 */
export function photoScore(p: CatalogPhoto | null | undefined): number | null {
  const pick = (v: unknown, depth = 0): number | null => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
    if (v && typeof v === 'object' && depth < 2) {
      const o = v as Record<string, unknown>
      for (const k of ['score', 'overall', 'value', 'total', 'quality']) { const r = pick(o[k], depth + 1); if (r !== null) return r }
    }
    return null
  }
  if (!p) return null
  return pick(p.score) ?? pick(p.quality)
}

const usable = (photos: CatalogPhoto[] | null | undefined): CatalogPhoto[] => (photos ?? []).filter(p => p && typeof p.url === 'string' && /^https?:\/\//.test(p.url))

/** Foto da capa: a de MAIOR nota (empate = a primeira do cadastro); sem nota em nenhuma → photos[0]. Nunca sorteia. */
export function pickCoverPhoto(photos: CatalogPhoto[] | null | undefined): CatalogPhoto | null {
  const list = usable(photos)
  let best: CatalogPhoto | null = null, bestScore = -Infinity
  for (const p of list) { const s = photoScore(p); if (s !== null && s > bestScore) { best = p; bestScore = s } }
  return best ?? list[0] ?? null
}

/** Fotos do meio: as melhores depois da capa (por nota, desc; sem nota nenhuma = ordem do cadastro). */
export function pickMiddlePhotos(photos: CatalogPhoto[] | null | undefined, cover: CatalogPhoto | null, n = OFFER_MAX_PHOTOS): CatalogPhoto[] {
  const rest = usable(photos).filter(p => p.url !== cover?.url)
  const scored = rest.some(p => photoScore(p) !== null)
  const ordered = scored ? rest.map((p, i) => ({ p, i, s: photoScore(p) })).sort((a, b) => (b.s ?? -Infinity) - (a.s ?? -Infinity) || a.i - b.i).map(x => x.p) : rest
  return ordered.slice(0, n)
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())

/** Preço do cadastro em reais ("1500000" → "R$ 1.500.000"); texto que já vem com R$ fica como está; vazio/zero/lixo → '' (nunca "R$ —"). */
export function formatPrice(v: unknown): string {
  const s = str(v)
  if (!s || /^[-—–.\s]+$/.test(s)) return ''
  if (/r\$/i.test(s)) return /\d/.test(s) ? s : ''
  const digits = s.replace(/[^\d,.]/g, '')
  if (!/\d/.test(digits)) return ''
  const n = Number(digits.includes(',') ? digits.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(digits) ? digits.replace(/\./g, '') : digits)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`
}

const num = (v: unknown): number | null => { const s = str(v).replace(',', '.'); return s && Number.isFinite(Number(s)) ? Number(s) : null }

export interface OfferSlide {
  kind: 'capa' | 'foto' | 'dados' | 'fecho'
  /** URL da foto real de fundo (capa, foto, fecho). */
  photo?: string
  fields: Record<string, string>
}

/** Linhas do slide de dados: só campo preenchido e coerente (m² fora de 10–2000 é erro de cadastro → não aparece). */
export function dataLines(f: Record<string, unknown>): string[] {
  const out: string[] = []
  const q = num(f.quartos); if (q !== null && q > 0 && q < 30) out.push(`Quartos: ${q}`)
  const m2 = num(f.m2); if (m2 !== null && m2 >= 10 && m2 <= 2000) out.push(`Área: ${m2} m²`)
  const v = num(f.vagas); if (v !== null && v >= 0 && v < 30 && str(f.vagas)) out.push(`Vagas: ${v}`)
  if (str(f.bairro)) out.push(`Bairro: ${str(f.bairro)}`)
  const price = formatPrice(f.preco); if (price) out.push(`Preço: ${price}`)
  return out
}

/** Título da capa/fecho: "Apartamento em Ipanema" / só o tipo / só o bairro; vazio se o cadastro não tem nenhum dos dois. */
export function offerHeadline(f: Record<string, unknown>): string {
  const tipo = str(f.tipo), bairro = str(f.bairro)
  return tipo && bairro ? `${tipo} em ${bairro}` : tipo || bairro
}

export interface OfferIn {
  photos: CatalogPhoto[]
  /** Fotos mobiliadas virtualmente (só entram com o aviso da ficha — quem chama decide). Ficam depois da capa. */
  staged?: CatalogPhoto[]
  fields: Record<string, unknown>
  /** CTA seguro decidido em código (decideVideoCta): nunca "Comente QUERO" sem resposta aprovada. */
  cta: string
  handle?: string
}

/** Monta os slides da oferta: capa (foto de maior nota + tipo/bairro/quartos/preço) · até 4 fotos · dados · fecho. Máx. 7. */
export function buildOfferSlides(i: OfferIn): OfferSlide[] {
  const cover = pickCoverPhoto(i.photos)
  if (!cover) return []
  const head = offerHeadline(i.fields)
  const q = num(i.fields.quartos), price = formatPrice(i.fields.preco)
  const sub = [q !== null && q > 0 && q < 30 ? `${q} ${q === 1 ? 'quarto' : 'quartos'}` : '', price].filter(Boolean).join(' · ')
  const out: OfferSlide[] = [{ kind: 'capa', photo: cover.url, fields: { layout: 'capa', cover_style: 'gancho', title: head, text: head ? sub : '' } }]
  if (!head && sub) out[0].fields.title = sub // sem tipo nem bairro: a capa leva só o que existe
  const staged = usable(i.staged).slice(0, 2)
  const middle = [...staged, ...pickMiddlePhotos(i.photos, cover, OFFER_MAX_PHOTOS)].slice(0, OFFER_MAX_PHOTOS)
  for (const p of middle) out.push({ kind: 'foto', photo: p.url, fields: { layout: 'foto' } })
  const lines = dataLines(i.fields)
  if (lines.length >= 2) out.push({ kind: 'dados', fields: { layout: 'lista', title: 'Os dados', items: lines.join('\n') } })
  // Fecho: foto do imóvel (a última do meio, ou a capa) + botão com o CTA seguro.
  const closer = middle[middle.length - 1]?.url ?? cover.url
  out.push({ kind: 'fecho', photo: closer, fields: { layout: 'fecho', title: head, cta: i.cta } })
  return out.slice(0, OFFER_MAX_SLIDES)
}

/** "3 coisas perto": capa com a foto real + lista dos 3 lugares (OpenStreetMap) + fecho com CTA. Sem lugares → []. */
export function buildNearbySlides(i: { photo: CatalogPhoto | null; bairro: string; places: string[]; cta: string }): OfferSlide[] {
  const places = i.places.map(str).filter(Boolean).slice(0, 3)
  if (!i.photo || places.length < 3) return []
  const bairro = str(i.bairro)
  return [
    { kind: 'capa', photo: i.photo.url, fields: { layout: 'capa', cover_style: 'gancho', title: '3 coisas perto daqui', text: bairro } },
    { kind: 'dados', fields: { layout: 'lista', title: bairro ? `Perto do imóvel em ${bairro}` : 'Perto do imóvel', items: places.join('\n') } },
    { kind: 'fecho', photo: i.photo.url, fields: { layout: 'fecho', title: bairro ? `Morar em ${bairro}` : '3 coisas perto daqui', cta: i.cta } },
  ]
}
