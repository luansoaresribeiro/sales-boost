// Regra ÚNICA dos dados do negócio que a estratégia exige. Espelho de
// supabase/functions/_shared/setupReady.ts (nome e cidade com 2+ letras,
// telefone com 10+ dígitos) — tela e servidor nunca podem discordar.
// Estrela vermelha na tela = obrigatório (decisão do dono 2026-10-21).

export const REQUIRED_STAR = '#ef4444'

export const nameOk = (v: unknown): boolean => String(v ?? '').trim().length >= 2
export const cityOk = (v: unknown): boolean => String(v ?? '').trim().length >= 2
export const phoneOk = (v: unknown): boolean => String(v ?? '').replace(/\D/g, '').length >= 10

export type BizField = 'name' | 'city' | 'phone'

/** Quais dos 3 dados obrigatórios faltam (ordem fixa: nome, cidade, telefone). */
export function missingBizFields(c: { business_name?: unknown; city?: unknown; phone?: unknown }): BizField[] {
  const out: BizField[] = []
  if (!nameOk(c.business_name)) out.push('name')
  if (!cityOk(c.city)) out.push('city')
  if (!phoneOk(c.phone)) out.push('phone')
  return out
}
