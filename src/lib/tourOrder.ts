// Cópia pra TELA de `linked`/`tourSegments` de supabase/functions/_shared/tourOrder.ts: quando o dono muda a ordem
// das fotos, a tela recalcula na hora onde a câmera caminha e onde corta. O servidor recalcula de novo antes de
// gastar (nunca confia na tela). scripts/test-tour-order.mjs falha se as duas divergirem.
export type SegKind = 'opening' | 'pair' | 'room'
export interface Segment { kind: SegKind; from: number; to?: number; entry?: boolean }
export type Passage = 'start' | 'walk' | 'walk_unconfirmed' | 'walk_in'

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

/** Cópia de `withOutsideFirst` do servidor: o dono escolheu abrir de fora com a 1ª foto (só cômodos de `opening_candidates`). */
export function withOutsideFirst(rooms: (string | null)[], openingRooms: string[], candidates: string[], outsideFirst: boolean): (string | null)[] {
  const r0 = rooms[0]
  if (!outsideFirst || !r0 || !openingRooms.length || openingRooms.includes(r0) || !candidates.includes(r0)) return rooms
  return [openingRooms[openingRooms.length - 1], ...rooms.slice(1)]
}

export const tourSeconds = (segments: Segment[], seconds: Record<SegKind, number>) => segments.reduce((s, g) => s + seconds[g.kind], 0)
