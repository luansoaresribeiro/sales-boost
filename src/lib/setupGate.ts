// Acesso das contas novas (decisão do dono 2026-10-13, docs/DECISIONS.md — substitui
// a de 2026-10-10 que prendia a conta em /gratis):
//  - Antes de pagar ("modo vitrine"): a conta navega por TODO o painel, mas em
//    "somente visualização" (ver contexts/ShowcaseContext.tsx e a rede de
//    segurança do servidor em supabase/functions/_shared/access.ts). Quem veio do
//    diagnóstico grátis ainda tem o kit grátis em /gratis (pop-up no painel).
//  - Depois de pagar: libera o painel inteiro. O /setup (dados adicionais)
//    saiu em 2026-10-19 — o essencial já vem do diagnóstico e o sino cobra o resto.
// Vale só pra contas criadas a partir de NEW_FLOW_FROM — as antigas (Liga dos
// Sonhos, conta Sales Boost) continuam como estavam.
import type { AccessInfo } from '../contexts/CompanyContext'

export const NEW_FLOW_FROM = '2026-10-06T00:00:00Z'

type CompanyLike = { created_at?: string | null; stripe_subscription_id?: string | null; manual_access?: boolean | null } | null

function isNewAccount(company: CompanyLike): boolean {
  if (!company?.created_at) return false // sem data confiável: não mexe em ninguém
  const t = new Date(company.created_at).getTime()
  return Number.isFinite(t) && t >= new Date(NEW_FLOW_FROM).getTime()
}

// manual_access direto da empresa: na função do banco o "trial" vem antes da
// liberação manual, então uma conta liberada pelo Owner que ainda tem trial
// gravado (ex.: Tespon) apareceria como "trial" — e a liberação do Owner
// tem que valer sempre (só o bloqueio vence ela, e ele já foi checado antes).
const hasPaidAccess = (company: CompanyLike, access: AccessInfo | null) =>
  !!company?.stripe_subscription_id || company?.manual_access === true || access?.source === 'paid' || access?.source === 'manual'

// Conta nova que ainda não pagou (nem foi liberada à mão / bloqueada) = "modo vitrine".
// Mesma regra do servidor (_shared/access.ts → hasPaidAccess).
export function isShowcaseMode(company: CompanyLike, access: AccessInfo | null): boolean {
  if (!isNewAccount(company) || access?.source === 'blocked') return false
  return !hasPaidAccess(company, access)
}

// Nome antigo (até 2026-10-12), mantido pra quem ainda importar.
export const isFreeMode = isShowcaseMode
