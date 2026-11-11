// Tour virtual COMPLETO (menu "Tour virtual", decisão do dono 2026-11-10). Funções PURAS — rodam no Deno
// (item-videos plan_tour/create) e no Node (scripts/test-tour-order.mjs). A tela tem uma cópia de `tourSegments`
// (src/lib/tourOrder.ts) pra recalcular as passagens quando o dono muda a ordem; o teste confere as duas.
//
// Nada de setor aqui (regra 6): a ordem dos cômodos, quais são vizinhos e quais abrem "de fora" vêm da ficha
// (vertical_playbooks.config.tour: walk_order, adjacent_rooms, opening_rooms, min_quality, min_room_conf,
// tour_max_photos, tour_per_room). Sem ficha = ordem das fotos do cadastro, tudo em corte.
//
// Regra de segurança (regra 4, foto sempre real): a câmera só CAMINHA de uma foto até a outra quando os dois
// cômodos são vizinhos pela ficha. Entre cômodos que não se ligam o vídeo faz CORTE — se a IA
// andasse de um para o outro, ela inventaria o corredor no meio. A abertura "de fora" só existe com foto real
// de fachada/vista; o movimento fica dentro do que a foto mostra (instrução de câmera da ficha).

import type { TourCfg, TourPhoto } from './tourPick.ts'

export type SegKind = 'opening' | 'pair' | 'room'
export interface Segment { kind: SegKind; from: number; to?: number }
export type Passage = 'start' | 'walk' | 'cut'
export interface TourOrderCfg { walk_order: string[]; tour_max_photos: number; tour_per_room: number }
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
  }
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
 * Trechos do vídeo na ordem dada. Abre de fora se a 1ª foto for de fachada/vista; depois, caminhada entre fotos
 * ligadas (encadeadas: a foto de fim de um trecho é a de começo do próximo) e corte entre fotos não ligadas.
 */
export function tourSegments(rooms: (string | null)[], adjacent: [string, string][], openingRooms: string[]): { segments: Segment[]; passages: Passage[] } {
  const n = rooms.length
  const segments: Segment[] = []
  const passages: Passage[] = rooms.map(() => 'cut')
  if (!n) return { segments, passages }
  passages[0] = 'start'
  let i = 0
  if (rooms[0] && openingRooms.includes(rooms[0])) { segments.push({ kind: 'opening', from: 0 }); i = 1 }
  let covered = i === 1 ? 0 : -1   // última foto que já aparece num trecho
  for (; i < n; i++) {
    if (i + 1 < n && linked(rooms[i], rooms[i + 1], adjacent)) {
      segments.push({ kind: 'pair', from: i, to: i + 1 })
      passages[i + 1] = 'walk'
      covered = i + 1
    } else if (covered < i) {
      segments.push({ kind: 'room', from: i })
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
