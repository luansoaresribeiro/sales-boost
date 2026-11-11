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
export interface Segment { kind: SegKind; from: number; to?: number }
export type Passage = 'start' | 'walk' | 'walk_unconfirmed' | 'cut' | 'enter'
export interface TourOrderCfg { walk_order: string[]; tour_max_photos: number; tour_per_room: number; opening_candidates: string[] }
export type ExcludeReason = 'low_quality' | 'repeat_room' | 'over_limit'
export interface TourOrder {
  photos: string[]; rooms: (string | null)[]; segments: Segment[]; passages: Passage[]
  excluded: { url: string; room: string | null; reason: ExcludeReason }[]
}

export const TOUR_MAX_HARD = 12
const slug = (s: unknown) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const num = (v: unknown, def: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : def }

/** Campos do tour completo em config.tour (tolerante). Sem walk_order, usa room_priority da própria ficha. */
export function tourOrderCfgFrom(config: unknown, base: Pick<TourCfg, 'room_priority'>): TourOrderCfg {
  const t = (((config ?? {}) as { tour?: Record<string, unknown> }).tour ?? {}) as Record<string, unknown>
  const walk = (Array.isArray(t.walk_order) ? t.walk_order : []).map(slug).filter(Boolean).slice(0, 40)
  return {
    walk_order: walk.length ? walk : base.room_priority,
    tour_max_photos: num(t.tour_max_photos, 10, 2, TOUR_MAX_HARD),
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
 * Trechos do vídeo na ordem dada (caminhada CONTÍNUA, pedido do dono 2026-11-11): cada trecho vai de uma foto até
 * a seguinte, então a câmera nunca para nem corta. `cuts` = índices i em que o dono pediu corte ANTES da foto i.
 * Passagem entre cômodos que a ficha não diz serem vizinhos (ou 2 fotos do mesmo tipo) = 'walk_unconfirmed': a tela
 * e o post avisam pra conferir no vídeo. Foto sozinha (depois de corte, ou tour de 1 foto) vira 1 trecho próprio —
 * 'opening' se for fachada/vista, senão 'room'.
 * Foto DE FORA (fachada/vista, Etapa 3 — 2026-11-11): nunca caminha até outra foto nem vem de outra — a IA teria que
 * inventar o caminho de fora pra dentro (regra 4). Ela vira a abertura própria (movimento de drone dentro do que a foto
 * mostra) e a passagem seguinte é um corte AUTOMÁTICO ('enter'), que o dono não desliga.
 */
export function tourSegments(rooms: (string | null)[], adjacent: [string, string][], openingRooms: string[], cuts: number[] = []): { segments: Segment[]; passages: Passage[] } {
  const n = rooms.length
  const segments: Segment[] = []
  const passages: Passage[] = rooms.map(() => 'cut')
  if (!n) return { segments, passages }
  passages[0] = 'start'
  const cut = new Set(cuts.filter(i => Number.isInteger(i) && i > 0 && i < n))
  const outside = (r: string | null) => !!r && openingRooms.includes(r)
  for (let i = 1; i < n; i++) if (outside(rooms[i - 1]) || outside(rooms[i])) { cut.add(i); passages[i] = 'enter' }
  let covered = -1   // última foto que já aparece num trecho
  for (let i = 0; i < n; i++) {
    if (i + 1 < n && !cut.has(i + 1)) {
      segments.push({ kind: 'pair', from: i, to: i + 1 })
      passages[i + 1] = linked(rooms[i], rooms[i + 1], adjacent) ? 'walk' : 'walk_unconfirmed'
      covered = i + 1
    } else if (covered < i) {
      const r = rooms[i]
      segments.push({ kind: r && openingRooms.includes(r) ? 'opening' : 'room', from: i })
      covered = i
    }
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
  const picked: TourPhoto[] = []
  const take = (p: TourPhoto) => { picked.push(p); usable.splice(usable.indexOf(p), 1) }
  // 1) Abertura de fora: melhor foto real de fachada/vista.
  const opening = usable.filter(p => { const r = roomOf(p, cfg); return !!r && cfg.opening_rooms.includes(r) }).sort(byQuality)[0]
  if (opening) take(opening)
  // 2) Cômodos na ordem da ficha, até N fotos por cômodo (as melhores).
  const perRoom = new Map<string, number>()
  if (opening) perRoom.set(roomOf(opening, cfg)!, 1)
  const order = [...ocfg.walk_order, ...cfg.rooms.map(r => r.key).filter(k => !ocfg.walk_order.includes(k))]
  for (const room of order) {
    for (const p of usable.filter(x => roomOf(x, cfg) === room).sort(byQuality)) {
      const c = perRoom.get(room) ?? 0
      if (c >= ocfg.tour_per_room) { excluded.push({ url: p.url, room, reason: 'repeat_room' }); usable.splice(usable.indexOf(p), 1); continue }
      perRoom.set(room, c + 1); take(p)
    }
  }
  // 3) Sem cômodo identificado: no fim, na ordem do cadastro (nunca sorteio).
  for (const p of [...usable]) take(p)
  const kept = picked.slice(0, ocfg.tour_max_photos)
  for (const p of picked.slice(ocfg.tour_max_photos)) excluded.push({ url: p.url, room: roomOf(p, cfg), reason: 'over_limit' })
  const rooms = kept.map(p => roomOf(p, cfg))
  const { segments, passages } = tourSegments(rooms, cfg.adjacent_rooms, cfg.opening_rooms)
  return { photos: kept.map(p => p.url), rooms, segments, passages, excluded }
}

/** Segundos de cada trecho (mesma tabela do motor: caminhada um pouco mais longa). */
export function tourSeconds(segments: Segment[], seconds: Record<SegKind, number>): number {
  return segments.reduce((s, g) => s + seconds[g.kind], 0)
}
