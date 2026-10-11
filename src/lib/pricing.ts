// Preços por tipo de negócio (decisão do dono 2026-10-11, docs/DECISIONS.md).
// A faixa vem de business_types.plan_tier (pelo tipo escolhido no cadastro).
// Os mesmos valores estão no Stripe (lookup_keys em create-checkout) — mudar
// aqui sem mudar lá deixa a tela mentindo.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type PlanTier = 'padrao' | 'corretor'

export const PRICING: Record<PlanTier, { monthly: number; annual: number; coupon: number }> = {
  padrao: { monthly: 2449, annual: 1449, coupon: 1000 }, // imobiliária
  corretor: { monthly: 797, annual: 597, coupon: 200 },
}

// R$2.449 (pt) / R$2,449 (en)
export const brl = (n: number, lang: 'pt' | 'en' = 'pt') =>
  `R$${n.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

// Faixa de preço da conta. Na dúvida (sem tipo, erro no banco), tabela padrão.
export function usePlanTier(businessType: string | null | undefined): PlanTier {
  const [tier, setTier] = useState<PlanTier>('padrao')
  useEffect(() => {
    if (!businessType) return
    let alive = true
    void supabase.from('business_types').select('plan_tier').eq('label', businessType).maybeSingle()
      .then(({ data }) => { if (alive && data?.plan_tier === 'corretor') setTier('corretor') })
    return () => { alive = false }
  }, [businessType])
  return tier
}
