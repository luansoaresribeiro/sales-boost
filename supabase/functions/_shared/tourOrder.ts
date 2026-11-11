// Tour virtual COMPLETO (menu "Tour virtual", decisão do dono 2026-11-10). Funções PURAS — rodam no Deno
// (item-videos plan_tour/create) e no Node (scripts/test-tour-order.mjs). A tela tem uma cópia de `tourSegments`
// (src/lib/tourOrder.ts) pra recalcular as passagens quando o dono muda a ordem; o teste confere as duas.
//
// Nada de setor aqui (regra 6): a ordem dos cômodos, quais são vizinhos e quais abrem "de fora" vêm da ficha
// (vertical_playbooks.config.tour: walk_order, adjacent_rooms, opening_rooms, min_quality, min_room_conf,
// tour_max_photos, tour_per_room). Sem ficha = ordem das fotos do cadastro, tudo em caminhada não confirmada.
//
// Caminhada CONTÍNUA (dono, 2026-11-11 — substitui a regra de 10/11 de "corte entre cômodos não vizinhos", que
// deixou o tour picotado): a câmera vai de uma foto até a seguinte, sem parar. Onde a ficha não confirma que os
// cômodos são vizinhos, a passagem é marcada 'walk_unconfirmed' — a tela pinta de amarelo e o post avisa pra
// conferir no vídeo (o dono assiste antes de aprovar). O dono pode pedir corte numa passagem. A abertura "de fora"
// só existe com foto real de fachada/vista (regra 4).

import type { TourCfg, TourPhoto } from './tourPick.ts'

export type SegKind = 'opening' | 'pair' | 'room'
export interface Segment { kind: SegKind; from: number; to?: number; entry?: boolean }
export type Passage = 'start' | 'walk' | 'walk_unconfirmed' | 'walk_in'
export interface TourOrderCfg { walk_order: string[]; tour_max_photos: number; tour_per_room: number; opening_candidates: string[] }
export type ExcludeReason = 'low_quality' | 'repeat_room' | 'over_limit'
export interface TourOrder {
  photos: string[]; rooms: (string | null)[]; segments: Segment[]; passages: Passage[]
  excluded: { url: string; room: string | null; reason: ExcludeReason }[]
  /** Cômodos que têm foto no imóvel mas ficaram fora do tour pelo limite de fotos (a tela avisa). */
  missing_rooms: string[]
}

export const TOUR_MAX_HARD = 16   // imóvel inteiro (dono, 2026-11-11): 1 foto por cômodo + extras
const slug = (s: unknown) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const num = (v: unknown, def: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : def }

/** Campos do tour completo em config.tour (tolerante). Sem walk_order, usa room_priority da própria ficha. */
export function tourOrderCfgFrom(config: unknown, base: Pick<TourCfg, 'room_priority'>): TourOrderCfg {
  const t = (((config ?? {}) as { tour?: Record<string, unknown> }).tour ?? {}) as Record<string, unknown>
  const walk = (Array.isArray(t.walk_order) ? t.walk_order : []).map(slug).filter(Boolean).slice(0, 40)
  return {
    walk_order: walk.length ? walk : base.room_priority,
    tour_max_photos: num(t.tour_max_photos, 15, 2, TOUR_MAX_HARD),
    tour_per_room: num(t.tour_per_room, 2, 1, 4),
    // Ambientes que o DONO pode escolher pra abrir de fora (ex.: varanda com vista), além de fachada/vista. Ficha, regra 6.
    opening_candidates: (Array.isArray(t.opening_candidates) ? t.opening_candidates : []).map(slug).filter(Boolean).slice(0, 10),
  }
}

/**
 * O dono escolheu abrir de fora com a 1ª foto (Etapa 3, 2026-11-11): a IA pode ter chamado de "varanda" uma foto da
 * piscina com a vista. Só vale se o cômodo da 1ª foto estiver em `opening_candidates` da ficha — um quarto nunca vira
 * "cena de drone". A foto continua a mesma foto real; só o tipo do trecho muda pra abertura.
 */
export function withOutsideFirst(rooms: (string | null)[], openingRooms: string[], candidates: string[], outsideFirst: boolean): (string | null)[] {
  const r0 = rooms[0]
  if (!outsideFirst || !r0 || !openingRooms.length || openingRooms.includes(r0) || !candidates.includes(r0)) return rooms
  return [openingRooms[openingRooms.length - 1], ...rooms.slice(1)]
}

/** Cômodo confiável da foto (abaixo da confiança mínima da ficha = não identificado). */
export function roomOf(p: TourPhoto, cfg: Pick<TourCfg, 'min_room_conf'>): string | null {
  return p.room && (p.room_conf ?? 0) >= cfg.min_room_conf ? p.room : null
}

/** Dois cômodos ligados = a câmera pode caminhar de um pro outro (par vizinho da ficha, em qualquer sentido). */
export function linked(a: string | null, b: string | null, adjacent: [string, string][]): boolean {
  if (!a || !b) return false
  // Mesmo TIPO de cômodo não liga: duas fotos de "quarto" podem ser dois quartos diferentes (a IA inventaria o caminho).
  if (a === b) return false
  return adjacent.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/**
 * Trechos do vídeo na ordem dada. IMÓVEL INTEIRO, ZERO CORTES (dono, 2026-11-11 — substitui o corte automático de
 * fora pra dentro do #144 e o ✂️ do #142): com 2 fotos ou mais, TODO trecho é uma caminhada da foto i até a i+1, então
 * o vídeo é uma única trajetória de câmera (pedido de corte de tela antiga é ignorado).
 * Passagens que precisam de revisão (o dono assiste antes de aprovar, regra 4):
 *  - 'walk_in': de uma foto DE FORA (fachada/vista) para a seguinte — a câmera entra no imóvel pela abertura visível;
 *  - 'walk_unconfirmed': cômodos que a ficha não diz serem vizinhos (ou 2 fotos do mesmo tipo).
 * Só um tour de 1 foto vira trecho solto ('opening' se for de fora, senão 'room').
 */
export function tourSegments(rooms: (string | null)[], adjacent: [string, string][], openingRooms: string[]): { segments: Segment[]; passages: Passage[] } {
  const n = rooms.length
  const segments: Segment[] = []
  const passages: Passage[] = rooms.map(() => 'start')
  if (!n) return { segments, passages }
  const outside = (r: string | null) => !!r && openingRooms.includes(r)
  if (n === 1) return { segments: [{ kind: outside(rooms[0]) ? 'opening' : 'room', from: 0 }], passages }
  for (let i = 0; i + 1 < n; i++) {
    const entry = outside(rooms[i])
    segments.push(entry ? { kind: 'pair', from: i, to: i + 1, entry: true } : { kind: 'pair', from: i, to: i + 1 })
    passages[i + 1] = entry ? 'walk_in' : linked(rooms[i], rooms[i + 1], adjacent) ? 'walk' : 'walk_unconfirmed'
  }
  return { segments, passages }
}

/** Ordem sugerida a partir das fotos com nota (o dono confere e pode mudar antes de gerar). */
export function orderTour(photos: TourPhoto[], cfg: TourCfg, ocfg: TourOrderCfg): TourOrder {
  const excluded: TourOrder['excluded'] = []
  const seen = new Set<string>()
  const list = photos.filter(p => typeof p.url === 'string' && /^https:\/\//.test(p.url) && !seen.has(p.url) && seen.add(p.url))
  const usable: TourPhoto[] = []
  for (const p of list) {
    if (typeof p.quality === 'number' && p.quality < cfg.min_quality) excluded.push({ url: p.url, room: roomOf(p, cfg), reason: 'low_quality' })
    else usable.push(p)
  }
  const q = (p: TourPhoto) => (typeof p.quality === 'number' ? p.quality : -1)
  const byQuality = (a: TourPhoto, b: TourPhoto) => q(b) - q(a)
  // IMÓVEL INTEIRO (dono, 2026-11-11): primeiro 1 foto (a melhor) de CADA cômodo, depois as 2ªs fotos, depois as sem
  // cômodo — sempre até o limite. A ordem final segue a ficha: de fora primeiro, depois `walk_order`.
  const order = [...ocfg.walk_order, ...cfg.rooms.map(r => r.key).filter(k => !ocfg.walk_order.includes(k))]
  const rank = (r: string | null) => (r && cfg.opening_rooms.includes(r) ? -1 : r && order.includes(r) ? order.indexOf(r) : r ? order.length : order.length + 1)
  const byRoom = new Map<string, TourPhoto[]>()
  const unknown: TourPhoto[] = []
  for (const p of usable) { const r = roomOf(p, cfg); if (r) byRoom.set(r, [...(byRoom.get(r) ?? []), p]); else unknown.push(p) }
  const rooms = [...byRoom.keys()].sort((a, b) => rank(a) - rank(b))
  for (const r of rooms) byRoom.get(r)!.sort(byQuality)
  // Fora: só a melhor foto de fachada/vista (a câmera entra uma vez).
  const outsideRooms = rooms.filter(r => cfg.opening_rooms.includes(r))
  const bestOutside = outsideRooms.flatMap(r => byRoom.get(r)!).sort(byQuality)[0]
  const picked = new Set<TourPhoto>()
  const max = ocfg.tour_max_photos
  if (bestOutside) picked.add(bestOutside)
  const inside = rooms.filter(r => !cfg.opening_rooms.includes(r))
  for (let round = 0; round < ocfg.tour_per_room; round++) {
    for (const r of inside) { const p = byRoom.get(r)![round]; if (p && picked.size < max) picked.add(p) }
  }
  for (const p of unknown) if (picked.size < max) picked.add(p)
  const missing_rooms = inside.filter(r => !byRoom.get(r)!.some(p => picked.has(p)))
  for (const p of usable) {
    if (picked.has(p)) continue
    const r = roomOf(p, cfg)
    const roomCovered = !!r && ([...picked].some(x => roomOf(x, cfg) === r) || (cfg.opening_rooms.includes(r) && !!bestOutside))
    excluded.push({ url: p.url, room: r, reason: roomCovered ? 'repeat_room' : 'over_limit' })
  }
  // Ordem final: de fora → cômodos na ordem da ficha (fotos do mesmo cômodo juntas, melhor primeiro) → sem cômodo, na ordem do cadastro.
  const kept = usable.filter(p => picked.has(p)).sort((a, b) => {
    const ra = roomOf(a, cfg), rb = roomOf(b, cfg)
    if (rank(ra) !== rank(rb)) return rank(ra) - rank(rb)
    return ra ? byQuality(a, b) : 0
  })
  const keptRooms = kept.map(p => roomOf(p, cfg))
  const { segments, passages } = tourSegments(keptRooms, cfg.adjacent_rooms, cfg.opening_rooms)
  return { photos: kept.map(p => p.url), rooms: keptRooms, segments, passages, excluded, missing_rooms }
}

/** Segundos de cada trecho (mesma tabela do motor: caminhada um pouco mais longa). */
export function tourSeconds(segments: Segment[], seconds: Record<SegKind, number>): number {
  return segments.reduce((s, g) => s + seconds[g.kind], 0)
}
