// C8 — Auditoria do conteúdo, etapa 2 (dono, 23/11: "tudo sim"; docs/AUDITORIA-CONTEUDO.md, seção 10, arquiteturas A e B).
// Funções PURAS (sem Deno/rede); o desenho é do render-format (template 'slide') e a chamada é do catalog-package.
// Teste em Node: scripts/test-guided-visit.mjs. Textos e nomes dos cômodos vêm da ficha (config.offer_guided, regra 6).
//
// A. Visita guiada (objetivo "levar à visita"): capa = foto do ponto forte + o ponto forte em palavras, SEM preço ·
//    chegada + até 3 ambientes na ordem da visita, 1 linha por foto · lá fora: 2–3 lugares reais com distância ·
//    números (quartos, área, vagas, condomínio, IPTU, preço) uma vez só · fecho com convite concreto.
// B. Custo real de morar: só com condomínio E IPTU do cadastro (sem soma estimada de custos).
import { dataLines, formatPrice, offerHeadline, photoScore, pickCoverPhoto, PT_LOCALE, type CatalogPhoto, type CoverRooms, type OfferLocale, type OfferSlide } from './carouselOffer.ts'

export const GUIDED_MAX_SLIDES = 9 // Instagram aceita 10
export const GUIDED_MAX_ROOMS = 4  // chegada + 3 ambientes

export interface GuidedTexts { invite_title: string; invite_text: string; places_title: string; numbers_title: string; cost_cover: string; cost_title: string; cost_condo: string; cost_iptu: string; cost_everyday: string; cost_close: string }
export interface GuidedCfg { roomTitles: Record<string, string>; walkOrder: string[]; texts: GuidedTexts }

const s = (v: unknown, max = 120): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const EMPTY = new Set(['', 'null', 'undefined', '—', '-', 'n/a'])
const str = (v: unknown): string => { const t = v === null || v === undefined ? '' : String(v).trim(); return EMPTY.has(t.toLowerCase()) ? '' : t }

/** Lê config.offer_guided[lang] + tour.walk_order. Sem textos na ficha = null (o carrossel antigo continua). */
export function guidedCfgFrom(config: unknown, lang: 'pt' | 'en'): GuidedCfg | null {
  const c = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>
  const og = (c.offer_guided && typeof c.offer_guided === 'object' ? c.offer_guided : null) as Record<string, unknown> | null
  const l = og ? ((og[lang] ?? og.pt) as Record<string, unknown> | undefined) : undefined
  if (!og || og.enabled !== true || !l || typeof l !== 'object') return null
  const t = (l.texts && typeof l.texts === 'object' ? l.texts : {}) as Record<string, unknown>
  const texts = { invite_title: s(t.invite_title), invite_text: s(t.invite_text), places_title: s(t.places_title), numbers_title: s(t.numbers_title), cost_cover: s(t.cost_cover), cost_title: s(t.cost_title), cost_condo: s(t.cost_condo, 40), cost_iptu: s(t.cost_iptu, 40), cost_everyday: s(t.cost_everyday), cost_close: s(t.cost_close) }
  if (!texts.invite_title || !texts.numbers_title) return null
  const rt = (l.room_titles && typeof l.room_titles === 'object' ? l.room_titles : {}) as Record<string, unknown>
  const roomTitles: Record<string, string> = {}
  for (const [k, v] of Object.entries(rt)) if (/^[a-z_]{2,30}$/.test(k) && s(v, 60)) roomTitles[k] = s(v, 60)
  const tour = (c.tour && typeof c.tour === 'object' ? c.tour : {}) as { walk_order?: unknown }
  const walkOrder = Array.isArray(tour.walk_order) ? tour.walk_order.filter((x): x is string => typeof x === 'string') : []
  return { roomTitles, walkOrder, texts }
}

const roomOf = (p: CatalogPhoto): string => (typeof p.room === 'string' ? p.room : '')
const usable = (photos: CatalogPhoto[] | null | undefined): CatalogPhoto[] => (photos ?? []).filter(p => p && typeof p.url === 'string' && /^https?:\/\//.test(p.url))

/**
 * Fotos da visita, na ordem da ficha (walk_order): a melhor foto de cada cômodo diferente, sem a capa, até `n`. Só entra
 * foto com cômodo conhecido E título na ficha (a linha do slide nunca é inventada). Faltando, completa com as melhores sem linha.
 */
export function visitPhotos(photos: CatalogPhoto[], cover: CatalogPhoto | null, cfg: GuidedCfg, n = GUIDED_MAX_ROOMS): { photo: CatalogPhoto; line: string }[] {
  const rest = usable(photos).filter(p => p.url !== cover?.url)
  const best = new Map<string, CatalogPhoto>()
  for (const p of rest) {
    const r = roomOf(p); if (!r || !cfg.roomTitles[r]) continue
    const cur = best.get(r)
    if (!cur || (photoScore(p) ?? -Infinity) > (photoScore(cur) ?? -Infinity)) best.set(r, p)
  }
  const order = (r: string) => { const i = cfg.walkOrder.indexOf(r); return i < 0 ? 999 : i }
  const picked = [...best.entries()].sort((a, b) => order(a[0]) - order(b[0])).slice(0, n).map(([r, p]) => ({ photo: p, line: cfg.roomTitles[r] }))
  if (picked.length < 2) {
    const extra = rest.filter(p => !picked.some(x => x.photo.url === p.url)).sort((a, b) => (photoScore(b) ?? -Infinity) - (photoScore(a) ?? -Infinity))
    for (const p of extra) { if (picked.length >= n) break; picked.push({ photo: p, line: '' }) }
  }
  return picked
}

/** Linhas de custo do cadastro: condomínio e IPTU (só número coerente). Vazio = não tem. */
export function costLines(f: Record<string, unknown>, cfg: GuidedCfg, loc: OfferLocale = PT_LOCALE): { condo: string; iptu: string } {
  const condo = formatPrice(f.condominio, loc), iptu = formatPrice(f.iptu, loc)
  return { condo: condo ? `${cfg.texts.cost_condo || 'Condomínio'}: ${condo}` : '', iptu: iptu ? `${cfg.texts.cost_iptu || 'IPTU'}: ${iptu}` : '' }
}

export interface GuidedIn {
  photos: CatalogPhoto[]
  fields: Record<string, unknown>
  cta: string
  cfg: GuidedCfg
  /** Ponto forte marcado pelo corretor com a foto que mostra ele (pontos fortes, C6). Sem marca = capa pelos cômodos da ficha. */
  strength?: { label: string; photo: CatalogPhoto } | null
  rooms?: CoverRooms | null
  /** Lugares reais já formatados ("Metrô · Antero de Quental · 300 m em linha reta"). */
  places?: string[]
  locale?: OfferLocale
}

/** A. Visita guiada. Sem foto utilizável → [] (quem chama cai no carrossel antigo). */
export function buildGuidedVisitSlides(i: GuidedIn): OfferSlide[] {
  const cover = i.strength?.photo ?? pickCoverPhoto(i.photos, i.rooms)
  if (!cover) return []
  const loc = i.locale ?? PT_LOCALE, head = offerHeadline(i.fields), T = i.cfg.texts
  // Capa: o ponto forte em palavras (nunca o preço). Sem ponto forte marcado: tipo + bairro.
  const strength = str(i.strength?.label)
  const out: OfferSlide[] = [{ kind: 'capa', photo: cover.url, fields: { layout: 'capa', cover_style: 'gancho', title: strength || head, text: strength ? head : '' } }]
  for (const v of visitPhotos(i.photos, cover, i.cfg)) out.push({ kind: 'foto', photo: v.photo.url, fields: v.line ? { layout: 'foto', text: v.line } : { layout: 'foto' } })
  const places = (i.places ?? []).map(str).filter(Boolean).slice(0, 3)
  if (places.length >= 2) out.push({ kind: 'dados', fields: { layout: 'lista', title: T.places_title || head, items: places.join('\n') } })
  // Números uma vez só: os do cadastro + condomínio e IPTU.
  const c = costLines(i.fields, i.cfg, loc)
  const nums = [...dataLines(i.fields, loc), c.condo, c.iptu].filter(Boolean)
  if (nums.length >= 2) out.push({ kind: 'dados', fields: { layout: 'lista', title: T.numbers_title, items: nums.join('\n') } })
  out.push({ kind: 'fecho', photo: cover.url, fields: { layout: 'fecho', title: T.invite_title, ...(T.invite_text ? { text: T.invite_text } : {}), cta: i.cta } })
  return out.slice(0, GUIDED_MAX_SLIDES)
}

/** B. Custo real de morar: só com condomínio E IPTU. O "dia a dia" usa só o campo de lazer do cadastro. Sem os dois → []. */
export function buildLivingCostSlides(i: GuidedIn & { everyday?: string }): OfferSlide[] {
  const loc = i.locale ?? PT_LOCALE, T = i.cfg.texts
  const c = costLines(i.fields, i.cfg, loc)
  const cover = i.strength?.photo ?? pickCoverPhoto(i.photos, i.rooms)
  if (!cover || !c.condo || !c.iptu || !T.cost_cover) return []
  const head = offerHeadline(i.fields)
  const out: OfferSlide[] = [{ kind: 'capa', photo: cover.url, fields: { layout: 'capa', cover_style: 'pergunta', title: T.cost_cover, text: head } }]
  out.push({ kind: 'dados', fields: { layout: 'lista', title: T.cost_title || head, items: [c.condo, c.iptu].join('\n') } })
  const everyday = str(i.everyday).split(/[\n,;]+/).map(x => x.trim()).filter(Boolean).slice(0, 4)
  if (everyday.length && T.cost_everyday) out.push({ kind: 'dados', fields: { layout: 'lista', title: T.cost_everyday, items: everyday.join('\n') } })
  out.push({ kind: 'fecho', photo: cover.url, fields: { layout: 'fecho', title: T.cost_close || T.invite_title, cta: i.cta } })
  return out
}
