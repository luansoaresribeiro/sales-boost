// Cópia pra TELA de supabase/functions/_shared/publishSlot.ts (o servidor é quem decide de verdade; aqui só
// montamos o texto "vai sair dia X às 18h" e o horário que o botão manda). Mesmo valor nos dois lugares:
// scripts/test-publish-slot.mjs falha se divergirem.
export const PUBLISH_HOUR_BRT = 18
const BRT_OFFSET = '-03:00'
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export const todayBRT = (nowMs = Date.now()): string => new Date(nowMs - 3 * 3600_000).toISOString().slice(0, 10)

export interface PublishPlan { day: string; hour: number; iso: string }

export function plannedPublishAt(plannedFor: unknown, nowMs = Date.now()): PublishPlan | null {
  if (typeof plannedFor !== 'string' || !DAY_RE.test(plannedFor)) return null
  if (plannedFor <= todayBRT(nowMs)) return null
  const t = Date.parse(`${plannedFor}T${String(PUBLISH_HOUR_BRT).padStart(2, '0')}:00:00${BRT_OFFSET}`)
  if (!Number.isFinite(t) || t <= nowMs) return null
  return { day: plannedFor, hour: PUBLISH_HOUR_BRT, iso: new Date(t).toISOString() }
}

export const publishWhenLabel = (plan: PublishPlan, lang: 'pt' | 'en' = 'pt'): string => {
  const [, m, d] = plan.day.split('-')
  return lang === 'en' ? `${m}/${d} at ${plan.hour}:00 (Brasília)` : `dia ${d}/${m} às ${plan.hour}h`
}
