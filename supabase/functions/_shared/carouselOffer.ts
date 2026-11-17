// Carrossel de OFERTA e de BAIRRO no sistema de slides (PR B, 2026-11-02). Função PURA (sem Deno/rede): só decide
// QUAIS fotos reais entram e QUE texto cada slide leva; o desenho é do render-format (template 'slide') e a
// chamada é do catalog-package. Teste em Node: scripts/test-carousel-quality.mjs.
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

/** Cômodos da ficha (tour.room_priority / tour.avoid_rooms — regra 6): ordem de preferência e o que nunca abre a peça. */
export interface CoverRooms { priority: string[]; avoid: string[] }
const roomOf = (p: CatalogPhoto): string => (typeof p.room === 'string' ? p.room : '')

/**
 * Foto da capa. Com os cômodos da ficha: primeiro foge dos cômodos a evitar (banheiro, área de serviço…), depois segue a
 * ordem de preferência (fachada, vista, sala…), e só então a MAIOR nota (empate = a primeira do cadastro). Sem ficha, como
 * antes: maior nota; sem nota em nenhuma → photos[0]. Nunca sorteia. (Teste Zero 2026-11-03: notas empatadas e a capa
 * saiu no banheiro com toalhas — a 1ª foto do cadastro.)
 */
export function pickCoverPhoto(photos: CatalogPhoto[] | null | undefined, rooms?: CoverRooms | null): CatalogPhoto | null {
  const list = usable(photos)
  if (!list.length) return null
  const rank = (p: CatalogPhoto, i: number) => {
    const r = roomOf(p), avoid = rooms && r && rooms.avoid.includes(r) ? 1 : 0
    const pri = rooms && r ? rooms.priority.indexOf(r) : -1
    return { p, i, avoid, pri: pri >= 0 ? pri : (rooms?.priority.length ?? 0), s: photoScore(p) }
  }
  const ranked = list.map(rank).sort((a, b) => a.avoid - b.avoid || (rooms ? a.pri - b.pri : 0) || (b.s ?? -Infinity) - (a.s ?? -Infinity) || a.i - b.i)
  return ranked[0].p
}

/** Fotos do meio: as melhores depois da capa (por nota, desc; sem nota nenhuma = ordem do cadastro). */
export function pickMiddlePhotos(photos: CatalogPhoto[] | null | undefined, cover: CatalogPhoto | null, n = OFFER_MAX_PHOTOS): CatalogPhoto[] {
  const rest = usable(photos).filter(p => p.url !== cover?.url)
  const scored = rest.some(p => photoScore(p) !== null)
  const ordered = scored ? rest.map((p, i) => ({ p, i, s: photoScore(p) })).sort((a, b) => (b.s ?? -Infinity) - (a.s ?? -Infinity) || a.i - b.i).map(x => x.p) : rest
  return ordered.slice(0, n)
}

const EMPTY_WORDS = new Set(['null', 'undefined', 'nan', 'n/a', 'na', '—', '–', '-', '--', '?'])
/** Texto do cadastro; vazio, "null", "undefined", "—" e afins viram '' (nunca aparecem no slide). */
const str = (v: unknown): string => { if (v === null || v === undefined) return ''; const t = String(v).trim(); return EMPTY_WORDS.has(t.toLowerCase()) ? '' : t }

const MULTS: Record<string, number> = { k: 1e3, mil: 1e3, mi: 1e6, milhao: 1e6, milhoes: 1e6, million: 1e6, millions: 1e6 }
/**
 * Preço do cadastro em reais, lendo multiplicador: "1500000" e "1.500.000" → "R$ 1.500.000"; "1,5 mi" → "R$ 1.500.000";
 * "850 mil" → "R$ 850.000"; "R$ 980.000" → "R$ 980.000". Formato ambíguo ("12.5", "1,500", "1.5.3"), vazio, zero ou lixo → ''
 * (não mostra; nunca "R$ —" nem um valor chutado).
 */
/** Moeda/idioma do slide (ficha: `currency`, E1 17/11). Padrão = reais em português, como era. */
export interface OfferLocale { lang: 'pt' | 'en'; currency: string }
export const PT_LOCALE: OfferLocale = { lang: 'pt', currency: 'R$' }
const isDollar = (l: OfferLocale) => l.currency.trim() === '$' || /usd/i.test(l.currency)

export function formatPrice(v: unknown, loc: OfferLocale = PT_LOCALE): string {
  if (isDollar(loc)) return formatUsd(v)
  const raw = str(v)
  if (!raw) return ''
  const t = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/r\$|reais|real/g, ' ').replace(/\s+/g, ' ').trim()
  const m = /^(\d[\d.,]*)\s*(milhoes|milhao|millions?|mil|mi|k)?$/.exec(t)
  if (!m) return ''
  const body = m[1], mult = m[2] ? MULTS[m[2]] : 1
  let n: number
  if (/^\d+$/.test(body)) n = Number(body)
  else if (m[2] && /^\d+[.,]\d{1,2}$/.test(body)) n = Number(body.replace(',', '.'))                    // "1,5 mi", "2.25 milhões"
  else if (!m[2] && /^\d{1,3}(\.\d{3})+$/.test(body)) n = Number(body.replace(/\./g, ''))               // "1.500.000" (milhar BR)
  else if (!m[2] && /^\d{1,3}(\.\d{3})+,\d{2}$/.test(body)) n = Number(body.replace(/\./g, '').replace(',', '.')) // "1.500.000,00"
  else return ''                                                                                         // ambíguo
  n *= mult
  if (!Number.isFinite(n) || n <= 0 || n > 1e10) return ''
  return `R$ ${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

/** Dólar: "1250000", "1,250,000", "$1,250,000", "1.25 million", "850k" → "$1,250,000". Ambíguo ("1.250.000", "12,5") → ''. */
export function formatUsd(v: unknown): string {
  const raw = str(v)
  if (!raw) return ''
  const t = raw.toLowerCase().replace(/us\$|usd|\$|dollars?/g, ' ').replace(/\s+/g, ' ').trim()
  const m = /^(\d[\d.,]*)\s*(millions?|mi|k)?$/.exec(t)
  if (!m) return ''
  const body = m[1], mult = m[2] ? MULTS[m[2]] : 1
  let n: number
  if (/^\d+$/.test(body)) n = Number(body)
  else if (m[2] && /^\d+\.\d{1,2}$/.test(body)) n = Number(body)                              // "1.25 million"
  else if (!m[2] && /^\d{1,3}(,\d{3})+$/.test(body)) n = Number(body.replace(/,/g, ''))           // "1,250,000"
  else if (!m[2] && /^\d{1,3}(,\d{3})+\.\d{2}$/.test(body)) n = Number(body.replace(/,/g, ''))   // "1,250,000.00"
  else return ''
  n *= mult
  if (!Number.isFinite(n) || n <= 0 || n > 1e10) return ''
  return `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

const num = (v: unknown): number | null => { const s = str(v).replace(',', '.'); return s && Number.isFinite(Number(s)) ? Number(s) : null }

export interface OfferSlide {
  kind: 'capa' | 'foto' | 'dados' | 'fecho'
  /** URL da foto real de fundo (capa, foto, fecho). */
  photo?: string
  fields: Record<string, string>
}

/** Linhas do slide de dados: só campo preenchido e coerente (m² fora de 10–2000 é erro de cadastro → não aparece). */
const LBL = {
  pt: { beds: 'Quartos', area: 'Área', parking: 'Vagas', hood: 'Bairro', price: 'Preço', data: 'Os dados', bed1: 'quarto', bedN: 'quartos', near3: '3 coisas perto daqui', nearIn: (b: string) => `Perto do imóvel em ${b}`, near: 'Perto do imóvel', live: (b: string) => `Morar em ${b}` },
  en: { beds: 'Bedrooms', area: 'Area', parking: 'Parking', hood: 'Neighborhood', price: 'Price', data: 'The details', bed1: 'bedroom', bedN: 'bedrooms', near3: '3 things nearby', nearIn: (b: string) => `Near this home in ${b}`, near: 'Near this home', live: (b: string) => `Living in ${b}` },
}

export function dataLines(f: Record<string, unknown>, loc: OfferLocale = PT_LOCALE): string[] {
  const L = LBL[loc.lang], out: string[] = []
  const q = num(f.quartos); if (q !== null && q > 0 && q < 30) out.push(`${L.beds}: ${q}`)
  // Área: m² no Brasil; nos EUA o cadastro é em sq ft (o número entra como foi digitado, faixa maior).
  const m2 = num(f.m2)
  if (isDollar(loc)) { if (m2 !== null && m2 >= 100 && m2 <= 30000) out.push(`${L.area}: ${m2.toLocaleString('en-US')} sq ft`) }
  else if (m2 !== null && m2 >= 10 && m2 <= 2000) out.push(`${L.area}: ${m2} m²`)
  const v = num(f.vagas); if (v !== null && v >= 0 && v < 30 && str(f.vagas)) out.push(`${L.parking}: ${v}`)
  if (str(f.bairro)) out.push(`${L.hood}: ${str(f.bairro)}`)
  const price = formatPrice(f.preco, loc); if (price) out.push(`${L.price}: ${price}`)
  return out
}

/** Título da capa/fecho: "Apartamento Ipanema" (sem "em/na" — dono, 2026-11-11) / só o tipo / só o bairro; vazio se o cadastro não tem nenhum dos dois. */
export function offerHeadline(f: Record<string, unknown>): string {
  const tipo = str(f.tipo), bairro = str(f.bairro)
  return tipo && bairro ? `${tipo} ${bairro}` : tipo || bairro
}

export interface OfferIn {
  photos: CatalogPhoto[]
  /** Fotos mobiliadas virtualmente (só entram com o aviso da ficha — quem chama decide). Ficam depois da capa. */
  staged?: CatalogPhoto[]
  fields: Record<string, unknown>
  /** CTA seguro decidido em código (decideVideoCta): nunca "Comente QUERO" sem resposta aprovada. */
  cta: string
  handle?: string
  /** Cômodos da ficha pra escolher a capa (opcional). */
  rooms?: CoverRooms | null
  /** Idioma e moeda do slide (padrão: português em reais). */
  locale?: OfferLocale
}

/** Monta os slides da oferta: capa (foto de maior nota + tipo/bairro/quartos/preço) · até 4 fotos · dados · fecho. Máx. 7. */
export function buildOfferSlides(i: OfferIn): OfferSlide[] {
  const cover = pickCoverPhoto(i.photos, i.rooms)
  if (!cover) return []
  const head = offerHeadline(i.fields)
  const loc = i.locale ?? PT_LOCALE, L = LBL[loc.lang]
  const q = num(i.fields.quartos), price = formatPrice(i.fields.preco, loc)
  const sub = [q !== null && q > 0 && q < 30 ? `${q} ${q === 1 ? L.bed1 : L.bedN}` : '', price].filter(Boolean).join(' · ')
  const out: OfferSlide[] = [{ kind: 'capa', photo: cover.url, fields: { layout: 'capa', cover_style: 'gancho', title: head, text: head ? sub : '' } }]
  if (!head && sub) out[0].fields.title = sub // sem tipo nem bairro: a capa leva só o que existe
  const staged = usable(i.staged).slice(0, 2)
  const middle = [...staged, ...pickMiddlePhotos(i.photos, cover, OFFER_MAX_PHOTOS)].slice(0, OFFER_MAX_PHOTOS)
  for (const p of middle) out.push({ kind: 'foto', photo: p.url, fields: { layout: 'foto' } })
  const lines = dataLines(i.fields, loc)
  if (lines.length >= 2) out.push({ kind: 'dados', fields: { layout: 'lista', title: L.data, items: lines.join('\n') } })
  // Fecho: foto do imóvel (a última do meio, ou a capa) + botão com o CTA seguro.
  const closer = middle[middle.length - 1]?.url ?? cover.url
  out.push({ kind: 'fecho', photo: closer, fields: { layout: 'fecho', title: head, cta: i.cta } })
  return out.slice(0, OFFER_MAX_SLIDES)
}

/** "3 coisas perto": capa com a foto real + lista dos 3 lugares (OpenStreetMap) + fecho com CTA. Sem lugares → []. */
export function buildNearbySlides(i: { photo: CatalogPhoto | null; bairro: string; places: string[]; cta: string; locale?: OfferLocale }): OfferSlide[] {
  const places = i.places.map(str).filter(Boolean).slice(0, 3)
  if (!i.photo || places.length < 3) return []
  const bairro = str(i.bairro), L = LBL[(i.locale ?? PT_LOCALE).lang]
  return [
    { kind: 'capa', photo: i.photo.url, fields: { layout: 'capa', cover_style: 'gancho', title: L.near3, text: bairro } },
    { kind: 'dados', fields: { layout: 'lista', title: bairro ? L.nearIn(bairro) : L.near, items: places.join('\n') } },
    { kind: 'fecho', photo: i.photo.url, fields: { layout: 'fecho', title: bairro ? L.live(bairro) : L.near3, cta: i.cta } },
  ]
}
