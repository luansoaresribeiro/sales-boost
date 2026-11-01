// Quando uma peça aprovada sai (2026-10-26, "Tudo automático"). PURO (sem Deno, sem rede): roda no Deno
// (agent-actions, telegram-buddy, telegram-webhook) e no Node (scripts/test-publish-slot.mjs).
//
// Regra: peça com `planned_for` (data do calendário) NO FUTURO (dia de Brasília depois de hoje) é aprovada
// agora, mas AGENDADA pra esse dia no horário padrão abaixo (scheduled_at → cron run-scheduled-actions-5min).
// Peça sem data, de hoje ou de dia passado: publica ao aprovar, como sempre.
//
// O horário padrão mora SÓ AQUI (não existe preferência de horário por empresa no banco; `best_posting_hour`
// em instagram_metrics é medição, não escolha do dono). O front tem uma cópia só pra mostrar o texto
// ("vai sair dia X às 18h") em src/lib/publishSlot.ts — scripts/test-publish-slot.mjs falha se divergirem.
// Brasília não tem horário de verão desde 2019: offset fixo -03:00.

export const PUBLISH_HOUR_BRT = 18
export const BRT_OFFSET = '-03:00'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Data de hoje em Brasília (YYYY-MM-DD). */
export function todayBRT(nowMs = Date.now()): string {
  return new Date(nowMs - 3 * 3600_000).toISOString().slice(0, 10)
}

export interface PublishPlan { day: string; hour: number; iso: string }

/** Plano de agendamento pra uma peça com `planned_for`, ou null quando deve publicar ao aprovar. */
export function plannedPublishAt(plannedFor: unknown, nowMs = Date.now()): PublishPlan | null {
  if (typeof plannedFor !== 'string' || !DAY_RE.test(plannedFor)) return null
  if (plannedFor <= todayBRT(nowMs)) return null                                  // hoje ou passado: publica ao aprovar
  const t = Date.parse(`${plannedFor}T${String(PUBLISH_HOUR_BRT).padStart(2, '0')}:00:00${BRT_OFFSET}`)
  if (!Number.isFinite(t) || t <= nowMs) return null
  return { day: plannedFor, hour: PUBLISH_HOUR_BRT, iso: new Date(t).toISOString() }
}

/** "dia 28/10 às 18h" — texto honesto pro dono (tela e Telegram). */
export function publishWhenLabel(plan: PublishPlan): string {
  const [, m, d] = plan.day.split('-')
  return `dia ${d}/${m} às ${plan.hour}h`
}

// ── Semana atual em Brasília (calendário assim que a estratégia nova fica pronta) ──────────────
/** As 7 datas (segunda a domingo) da semana de `nowMs` em Brasília, e as que ainda faltam (amanhã até domingo). */
export function currentWeekBRT(nowMs = Date.now()): { week: string[]; remaining: string[] } {
  const today = todayBRT(nowMs)
  const d = new Date(`${today}T00:00:00Z`)
  const dow = d.getUTCDay()                                  // 0 = domingo
  const monday = d.getTime() + (dow === 0 ? -6 : 1 - dow) * 86400_000
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday + i * 86400_000).toISOString().slice(0, 10))
  return { week, remaining: week.filter(x => x > today) }
}
