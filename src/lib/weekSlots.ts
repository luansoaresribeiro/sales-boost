// Plano da semana a partir do mix da estratégia — CÓPIA da conta de
// supabase/functions/_shared/formatCatalog.ts (weekSlots), duplicada de
// propósito (convenção do projeto: front e functions não compartilham lib).
// Se mudar uma, mude a outra: é isso que faz a peça gerada cair no MESMO dia
// que o calendário mostra antes.
export type Producer = 'post' | 'item_package' | 'item_video' | 'dm'
export type Familia = 'tour' | 'oferta' | 'educativo' | 'bairro' | 'eventual'
// familia/pilar_ss/tema: rótulo único da peça (fase 3); opcionais (estratégia antiga não tem).
export interface MixItem { format: string; name: string; producer: Producer; per_week: number; pillar: string; purpose: string; familia?: Familia; pilar_ss?: string; tema?: string }
export interface WeekSlot { date: string; format: string; name: string; producer: Producer; pillar: string; purpose: string; familia?: Familia; pilar_ss?: string; tema?: string }

// Tour virtual saiu do plano da semana (dono, 2026-11-10) — mesma lista de _shared/formatCatalog.ts.
export const OUT_OF_WEEKLY_PLAN: Producer[] = ['item_video']

// EXATAMENTE 1 post por dia (dono, 2026-11-13) — mesma conta de dailySeven em _shared/formatCatalog.ts.
export function dailySeven<T extends { format: string; producer: string }>(queue: T[]): T[] {
  if (!queue.length) return []
  const pick = queue.slice(0, 7)
  for (let i = 0; pick.length < 7; i++) pick.push(queue[i % queue.length])
  // Ordena sem repetir formato em dias seguidos: a cada dia, o formato que mais sobra (≠ do dia anterior); empate = ordem da fila.
  const rest = [...pick], out: T[] = []
  while (rest.length) {
    const prev = out.length ? out[out.length - 1].format : null
    const left = (f: string) => rest.filter(m => m.format === f).length
    let best = -1
    for (let i = 0; i < rest.length; i++) if (rest[i].format !== prev && (best < 0 || left(rest[i].format) > left(rest[best].format))) best = i
    out.push(rest.splice(best < 0 ? 0 : best, 1)[0])
  }
  return out
}
export function weekSlots(mixRaw: MixItem[] | null | undefined, dates: string[], opts: { excludeFormats?: string[] } = {}): WeekSlot[] {
  const exclude = new Set(opts.excludeFormats ?? [])
  const mix = (Array.isArray(mixRaw) ? mixRaw : []).filter(m => m.producer !== 'dm' && !OUT_OF_WEEKLY_PLAN.includes(m.producer) && !exclude.has(m.format))
  const left = mix.map(m => ({ m, n: Math.max(0, m.per_week | 0) }))
  const queue: MixItem[] = []
  while (left.some(x => x.n > 0)) for (const x of left) if (x.n > 0) { queue.push(x.m); x.n-- }
  if (!queue.length || dates.length !== 7) return []
  return dailySeven(queue).map((m, k) => ({ date: dates[k], format: m.format, name: m.name, producer: m.producer, pillar: m.pillar, purpose: m.purpose, familia: m.familia, pilar_ss: m.pilar_ss, tema: m.tema }))
}

// Janela de planejamento = segunda a domingo (igual ao nextWeekDates do
// creative-generate). Devolve as 7 datas (YYYY-MM-DD) da janela que começa
// na segunda `offsetWeeks` semanas depois da segunda desta semana.
export function planWindow(offsetWeeks: number, today = new Date()): string[] {
  const back = (today.getDay() + 6) % 7 // dias desde a última segunda
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back + offsetWeeks * 7 + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}
