// Gate do /setup: contas criadas a partir desta data, sem assinatura, só
// entram no painel depois de completar o /setup (dados + perguntas da ficha
// + 1 item com fotos). As empresas já existentes são anteriores (a última de
// 2026-09-30), então nenhum cliente atual é trancado.
export const SETUP_GATE_FROM = '2026-10-06T00:00:00Z'

export function setupGateApplies(company: { created_at?: string | null; stripe_subscription_id?: string | null } | null): boolean {
  if (!company || company.stripe_subscription_id) return false
  if (!company.created_at) return false // sem data confiável: não tranca ninguém
  const t = new Date(company.created_at).getTime()
  return Number.isFinite(t) && t >= new Date(SETUP_GATE_FROM).getTime()
}
