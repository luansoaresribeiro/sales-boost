// Aprovar a semana (2026-11-10, pedido do dono). PURO (sem Deno, sem rede): roda no Deno (agent-actions →
// approve_week) e no Node (scripts/test-week-approval.mjs). A tela tem uma cópia mínima (src/lib/weekApproval.ts).
//
// Regra: o dono VÊ os posts da semana e aprova todos de uma vez. Cada peça vira uma ação APROVADA pelo dono
// (approved_by = quem clicou), AGENDADA pro dia planejado no horário padrão (_shared/publishSlot.ts). O cron
// de 5 em 5 min publica no dia, com as travas de sempre na hora de sair (aprovação humana, imóvel disponível,
// CRECI, texto público). Nada é aprovado "às cegas": só entra peça que o dono mandou (ids da tela).

import { plannedPublishAt, todayBRT, PUBLISH_HOUR_BRT, BRT_OFFSET, type PublishPlan } from './publishSlot.ts'

/** Máximo de peças por aprovação (3 por dia × 7 dias). */
export const WEEK_MAX = 21
/** A semana: de hoje até hoje + 7 dias (domingo à noite cobre segunda a domingo). */
export const WEEK_DAYS = 7
/** Peça de HOJE só entra se ainda faltar pelo menos isto até o horário padrão. */
export const TODAY_MARGIN_MS = 15 * 60_000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export type SkipReason = 'not_found' | 'not_ready' | 'no_date' | 'past' | 'beyond_week' | 'video_not_ready' | 'already_scheduled' | 'item_unavailable' | 'error'

export const SKIP_LABEL: Record<SkipReason, string> = {
  not_found: 'não encontrada',
  not_ready: 'não está pronta para aprovar',
  no_date: 'sem dia planejado (aprove sozinha)',
  past: 'o dia já passou (aprove sozinha)',
  beyond_week: 'fora desta semana',
  video_not_ready: 'o vídeo ainda não está pronto',
  already_scheduled: 'já estava agendada',
  item_unavailable: 'imóvel indisponível',
  error: 'não consegui agendar',
}

/** ids da tela → lista sem repetição, ou null se vazia, grande demais ou com id inválido. */
export function parseWeekIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!raw.every(x => typeof x === 'string' && UUID_RE.test(x))) return null
  const ids = [...new Set(raw as string[])]
  return ids.length <= WEEK_MAX ? ids : null
}

export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T12:00:00Z`) + n * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Janela da semana em dias de Brasília: hoje até hoje + WEEK_DAYS. */
export function weekWindow(nowMs = Date.now()): { from: string; to: string } {
  const today = todayBRT(nowMs)
  return { from: today, to: addDays(today, WEEK_DAYS) }
}

/** Horário em que a peça sai. Dia futuro: regra de sempre. Hoje: no horário padrão, se ainda der tempo. */
export function weekSlot(plannedFor: unknown, nowMs = Date.now()): PublishPlan | null {
  const plan = plannedPublishAt(plannedFor, nowMs)
  if (plan) return plan
  if (plannedFor !== todayBRT(nowMs)) return null
  const t = Date.parse(`${plannedFor}T${String(PUBLISH_HOUR_BRT).padStart(2, '0')}:00:00${BRT_OFFSET}`)
  if (!Number.isFinite(t) || t - nowMs < TODAY_MARGIN_MS) return null
  return { day: plannedFor as string, hour: PUBLISH_HOUR_BRT, iso: new Date(t).toISOString() }
}

export interface WeekPiece { id: string; status?: string | null; planned_for?: string | null; recipe?: string | null; video_url?: string | null }

/** Por que a peça NÃO entra na semana (null = entra). */
export function weekSkipReason(p: WeekPiece | undefined, scheduled: Set<string>, nowMs = Date.now()): SkipReason | null {
  if (!p) return 'not_found'
  if (p.status !== 'vault') return 'not_ready'
  if (scheduled.has(p.id)) return 'already_scheduled'
  if (p.recipe === 'video_imovel' && !p.video_url) return 'video_not_ready'
  const day = p.planned_for
  if (typeof day !== 'string' || !DAY_RE.test(day)) return 'no_date'
  const { to } = weekWindow(nowMs)
  if (day > to) return 'beyond_week'
  return weekSlot(day, nowMs) ? null : 'past'
}

/** Separa o que agenda do que fica de fora (com motivo), na ordem dos dias. */
export function planWeek<T extends WeekPiece>(ids: string[], rows: T[], scheduled: Set<string>, nowMs = Date.now()) {
  const byId = new Map(rows.map(r => [r.id, r]))
  const toSchedule: { piece: T; slot: PublishPlan }[] = []
  const skipped: { id: string; reason: SkipReason }[] = []
  for (const id of ids) {
    const p = byId.get(id)
    const reason = weekSkipReason(p, scheduled, nowMs)
    if (reason) { skipped.push({ id, reason }); continue }
    toSchedule.push({ piece: p!, slot: weekSlot(p!.planned_for, nowMs)! })
  }
  toSchedule.sort((a, b) => a.slot.iso.localeCompare(b.slot.iso))
  return { toSchedule, skipped }
}
