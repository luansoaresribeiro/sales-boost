// Cópia pra TELA de `linked`/`tourSegments` de supabase/functions/_shared/tourOrder.ts: quando o dono muda a ordem
// das fotos, a tela recalcula na hora onde a câmera caminha e onde corta. O servidor recalcula de novo antes de
// gastar (nunca confia na tela). scripts/test-tour-order.mjs falha se as duas divergirem.
export type SegKind = 'opening' | 'pair' | 'room'
export interface Segment { kind: SegKind; from: number; to?: number }
export type Passage = 'start' | 'walk' | 'cut'

export function linked(a: string | null, b: string | null, adjacent: [string, string][]): boolean {
  if (!a || !b) return false
  // Mesmo TIPO de cômodo não liga: duas fotos de "quarto" podem ser dois quartos diferentes (a IA inventaria o caminho).
  if (a === b) return false
  return adjacent.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export function tourSegments(rooms: (string | null)[], adjacent: [string, string][], openingRooms: string[]): { segments: Segment[]; passages: Passage[] } {
  const n = rooms.length
  const segments: Segment[] = []
  const passages: Passage[] = rooms.map(() => 'cut')
  if (!n) return { segments, passages }
  passages[0] = 'start'
  let i = 0
  if (rooms[0] && openingRooms.includes(rooms[0])) { segments.push({ kind: 'opening', from: 0 }); i = 1 }
  let covered = i === 1 ? 0 : -1
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

export const tourSeconds = (segments: Segment[], seconds: Record<SegKind, number>) => segments.reduce((s, g) => s + seconds[g.kind], 0)
