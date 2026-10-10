// Acesso das contas novas (decisão do dono 2026-10-10, docs/DECISIONS.md):
//  - Antes de pagar ("modo grátis"): a conta só vê a página /gratis, que leva
//    aos 3 vídeos grátis e, depois deles, mostra o plano e o cupom.
//  - Depois de pagar: aí sim pede os dados adicionais (/setup) e libera o
//    painel inteiro.
// Vale só pra contas criadas a partir de NEW_FLOW_FROM — as antigas (Liga dos
// Sonhos, conta Sales Boost) continuam como estavam.
import type { AccessInfo } from '../contexts/CompanyContext'

export const NEW_FLOW_FROM = '2026-10-06T00:00:00Z'

type CompanyLike = { created_at?: string | null; stripe_subscription_id?: string | null } | null

function isNewAccount(company: CompanyLike): boolean {
  if (!company?.created_at) return false // sem data confiável: não mexe em ninguém
  const t = new Date(company.created_at).getTime()
  return Number.isFinite(t) && t >= new Date(NEW_FLOW_FROM).getTime()
}

const hasPaidAccess = (company: CompanyLike, access: AccessInfo | null) =>
  !!company?.stripe_subscription_id || access?.source === 'paid' || access?.source === 'manual'

// Conta nova que ainda não pagou (nem foi liberada à mão / bloqueada).
export function isFreeMode(company: CompanyLike, access: AccessInfo | null): boolean {
  if (!isNewAccount(company) || access?.source === 'blocked') return false
  return !hasPaidAccess(company, access)
}

// /setup (dados adicionais): só pra conta nova que JÁ pagou.
export function setupGateApplies(company: CompanyLike, access: AccessInfo | null): boolean {
  return isNewAccount(company) && hasPaidAccess(company, access)
}
