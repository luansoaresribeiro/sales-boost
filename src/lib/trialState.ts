// Estado do trial — calculado sempre a partir dos timestamps reais, nunca
// guardado como um campo à parte (evita o estado "desincronizar" do que é
// verdade). Uma única função, usada em todo o app.
import type { CompanyData } from '../contexts/CompanyContext'

export type TrialState =
  | 'trial_not_started'
  | 'trial_active'
  | 'trial_expiring'
  | 'trial_expired'
  | 'subscribed'
  | 'cancelled'

export interface TrialInfo {
  state: TrialState
  dayNumber: number | null
  totalDays: number | null
  hoursRemaining: number | null
  expiresAt: Date | null
  isTrial: boolean
  isBlocked: boolean
}

// Padrão de trials NOVOS (decisão 2026-10-02). O total real de cada trial é
// derivado de trial_started_at/trial_expires_at, então trials antigos de 3
// dias continuam mostrando "de 3" sem mentir.
export const TRIAL_DAYS = 7
const EXPIRING_THRESHOLD_HOURS = 6

export function getTrialInfo(company: Pick<CompanyData, 'trial_started_at' | 'trial_expires_at' | 'trial_cancelled_at' | 'plan' | 'stripe_subscription_id'> | null): TrialInfo {
  const empty: TrialInfo = { state: 'trial_not_started', dayNumber: null, totalDays: null, hoursRemaining: null, expiresAt: null, isTrial: false, isBlocked: false }
  if (!company) return empty

  // Assinante de verdade — trial deixa de importar.
  if (company.stripe_subscription_id && company.plan && company.plan !== 'free') {
    return { state: 'subscribed', dayNumber: null, totalDays: null, hoursRemaining: null, expiresAt: null, isTrial: false, isBlocked: false }
  }

  if (company.trial_cancelled_at) {
    return { state: 'cancelled', dayNumber: null, totalDays: null, hoursRemaining: null, expiresAt: null, isTrial: false, isBlocked: true }
  }

  if (!company.trial_started_at || !company.trial_expires_at) return empty

  const now = Date.now()
  const startedAt = new Date(company.trial_started_at).getTime()
  const expiresAt = new Date(company.trial_expires_at)
  const totalDays = Math.max(1, Math.round((expiresAt.getTime() - startedAt) / 86400000)) || TRIAL_DAYS
  const hoursRemaining = (expiresAt.getTime() - now) / 3600000

  if (hoursRemaining <= 0) {
    return { state: 'trial_expired', dayNumber: null, totalDays, hoursRemaining: 0, expiresAt, isTrial: false, isBlocked: true }
  }

  const hoursElapsed = (now - startedAt) / 3600000
  const dayNumber = Math.min(totalDays, Math.max(1, Math.ceil(hoursElapsed / 24) || 1))

  if (hoursRemaining <= EXPIRING_THRESHOLD_HOURS) {
    return { state: 'trial_expiring', dayNumber, totalDays, hoursRemaining, expiresAt, isTrial: true, isBlocked: false }
  }

  return { state: 'trial_active', dayNumber, totalDays, hoursRemaining, expiresAt, isTrial: true, isBlocked: false }
}

export function formatExpiresAt(date: Date | null, lang: 'pt' | 'en' = 'pt'): string {
  if (!date) return ''
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
