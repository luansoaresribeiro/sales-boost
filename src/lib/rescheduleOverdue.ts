// P2 do plano dos 5 pontos (dono, 24/11): posts que passaram da data sem aprovação ganham "Remarcar para os próximos
// dias livres". Só muda a data (planned_for): não aprova nem publica nada. Regra do calendário: 1 post por dia, e
// qualquer peça ativa ocupa o dia (#179). Função PURA; teste em scripts/test-reschedule-overdue.mjs.

const todayBRT = (nowMs = Date.now()): string => new Date(nowMs - 3 * 3600_000).toISOString().slice(0, 10)
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Até quantos dias à frente procura dia livre. */
export const RESCHEDULE_HORIZON_DAYS = 21

/** Vencido = esperando aprovação com data anterior a hoje (Brasília). */
export function isOverdue(plannedFor: unknown, nowMs = Date.now()): boolean {
  return typeof plannedFor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(plannedFor) && plannedFor < todayBRT(nowMs)
}

/**
 * Nova data para cada post vencido (do mais antigo ao mais novo), começando AMANHÃ e pulando os dias já ocupados.
 * Devolve só os que couberam no horizonte; o resto fica como está (a tela avisa).
 */
export function planReschedule(
  overdue: { id: string; planned_for: string }[],
  takenDays: (string | null | undefined)[],
  nowMs = Date.now(),
): { id: string; from: string; to: string }[] {
  const taken = new Set(takenDays.filter((d): d is string => !!d))
  const start = addDays(todayBRT(nowMs), 1)
  const out: { id: string; from: string; to: string }[] = []
  let i = 0
  for (const p of [...overdue].sort((a, b) => a.planned_for.localeCompare(b.planned_for))) {
    while (i < RESCHEDULE_HORIZON_DAYS && taken.has(addDays(start, i))) i++
    if (i >= RESCHEDULE_HORIZON_DAYS) break
    const day = addDays(start, i)
    taken.add(day)
    out.push({ id: p.id, from: p.planned_for, to: day })
  }
  return out
}
