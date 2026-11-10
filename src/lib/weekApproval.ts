// Cópia pra TELA de supabase/functions/_shared/weekApproval.ts (o servidor é quem decide de verdade; aqui só
// escolhemos quais peças mostrar no bloco "Sua semana" e o texto do dia). scripts/test-week-approval.mjs falha
// se as duas divergirem. Sem import (o teste roda esta cópia direto no Node); o horário e o "hoje" são os mesmos
// de src/lib/publishSlot.ts — o teste confere.

export const PUBLISH_HOUR_BRT = 18
const todayBRT = (nowMs = Date.now()): string => new Date(nowMs - 3 * 3600_000).toISOString().slice(0, 10)

export const WEEK_MAX = 21
export const WEEK_DAYS = 7
export const TODAY_MARGIN_MS = 15 * 60_000

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

export function weekWindow(nowMs = Date.now()): { from: string; to: string } {
  const today = todayBRT(nowMs)
  return { from: today, to: addDays(today, WEEK_DAYS) }
}

/** ISO do horário em que a peça sai, ou null se já não dá pra agendar (passou, sem data, fora da semana). */
export function weekSlotIso(plannedFor: unknown, nowMs = Date.now()): string | null {
  if (typeof plannedFor !== 'string' || !DAY_RE.test(plannedFor)) return null
  const { from, to } = weekWindow(nowMs)
  if (plannedFor < from || plannedFor > to) return null
  const t = Date.parse(`${plannedFor}T${String(PUBLISH_HOUR_BRT).padStart(2, '0')}:00:00-03:00`)
  if (!Number.isFinite(t)) return null
  const margin = plannedFor === from ? TODAY_MARGIN_MS : 0
  return t - nowMs >= margin && t > nowMs ? new Date(t).toISOString() : null
}

/** "seg 16/11" / "Mon 11/16". */
export function dayLabel(day: string, lang: 'pt' | 'en'): string {
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay()
  const [, m, d] = day.split('-')
  const pt = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return lang === 'en' ? `${en[wd]} ${m}/${d}` : `${pt[wd]} ${d}/${m}`
}
