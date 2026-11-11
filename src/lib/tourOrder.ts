// Cópia pra TELA de `linked`/`tourSegments` de supabase/functions/_shared/tourOrder.ts: quando o dono muda a ordem
// das fotos, a tela recalcula na hora onde a câmera caminha e onde corta. O servidor recalcula de novo antes de
// gastar (nunca confia na tela). scripts/test-tour-order.mjs falha se as duas divergirem.
export type SegKind = 'opening' | 'pair' | 'room'
export interface Segment { kind: SegKind; from: number; to?: number }
export type Passage = 'start' | 'walk' | 'walk_unconfirmed' | 'cut' | 'enter'

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

/** Cópia de `withOutsideFirst` do servidor: o dono escolheu abrir de fora com a 1ª foto (só cômodos de `opening_candidates`). */
export function withOutsideFirst(rooms: (string | null)[], openingRooms: string[], candidates: string[], outsideFirst: boolean): (string | null)[] {
  const r0 = rooms[0]
  if (!outsideFirst || !r0 || !openingRooms.length || openingRooms.includes(r0) || !candidates.includes(r0)) return rooms
  return [openingRooms[openingRooms.length - 1], ...rooms.slice(1)]
}

export const tourSeconds = (segments: Segment[], seconds: Record<SegKind, number>) => segments.reduce((s, g) => s + seconds[g.kind], 0)
