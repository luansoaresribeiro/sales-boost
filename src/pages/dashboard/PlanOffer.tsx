// Escolha do plano + checkout (Stripe, via create-checkout) + cupom do 1º mês.
// Usado no resumo do trial (contas antigas) e na página /gratis (contas novas
// antes de pagar). O cupom só vale se a oferta foi vista há no máximo 7 dias
// (companies.coupon_offer_shown_at — o servidor confere de novo no checkout).
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, ORANGE, D, SUPABASE_URL } from './marketingAi/shared'

type BillingPlan = 'monthly' | 'annual_commit'
const COUPON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const TX = {
  pt: {
    checkoutErr: 'Erro ao iniciar assinatura', opening: 'Abrindo checkout...',
    pMonthly: 'Mensal', pMonthlyPrice: 'R$2.449', perMonth: '/mês', pMonthlyNote: 'Sem fidelidade. Cancele quando quiser.',
    pAnnual: 'Anual', pAnnualPrice: 'R$1.449', pAnnualNote: 'Fidelidade de 12 meses, cobrado mensalmente.',
    annualClause: 'Atenção: se você cancelar antes de completar os 12 meses, paga uma multa de 30% das mensalidades que faltarem. Exemplo: cancelando com 6 meses restantes, a multa é 30% × 6 × R$1.449 = R$2.608,20.',
    chooseMonthly: 'Assinar o mensal →', chooseAnnual: 'Assinar o anual (12 meses) →',
    couponLine: '1º mês por R$1.449, depois R$2.449/mês',
    couponLeft: (d: number, h: number) => d > 0 ? `Oferta válida por mais ${d} ${d === 1 ? 'dia' : 'dias'} e ${h} h.` : `Oferta válida por mais ${h} h.`,
  },
  en: {
    checkoutErr: 'Error starting subscription', opening: 'Opening checkout...',
    pMonthly: 'Monthly', pMonthlyPrice: 'R$2,449', perMonth: '/month', pMonthlyNote: 'No commitment. Cancel any time.',
    pAnnual: 'Annual', pAnnualPrice: 'R$1,449', pAnnualNote: '12-month commitment, billed monthly.',
    annualClause: 'Note: if you cancel before completing the 12 months, you pay a fee of 30% of the remaining monthly payments. Example: cancelling with 6 months left, the fee is 30% × 6 × R$1,449 = R$2,608.20.',
    chooseMonthly: 'Choose monthly →', chooseAnnual: 'Choose annual (12 months) →',
    couponLine: '1st month for R$1,449, then R$2,449/month',
    couponLeft: (d: number, h: number) => d > 0 ? `Offer valid for ${d} more ${d === 1 ? 'day' : 'days'} and ${h} h.` : `Offer valid for ${h} more hours.`,
  },
} as const

export default function PlanOffer({ title, intro, cancelPath, refreshKey = 0, id }: {
  title: string; intro?: ReactNode; cancelPath: string; refreshKey?: number; id?: string
}) {
  const tx = TX[useLang().lang]
  const { session } = useAuth()
  const { company } = useCompany()
  const [checkoutLoading, setCheckoutLoading] = useState<BillingPlan | null>(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [couponShownAt, setCouponShownAt] = useState<string | null>(null)

  // Consulta tolerante a erro: se falhar, simplesmente sem cupom. `refreshKey`
  // muda quando o popup do cupom acabou de abrir (a data é gravada no servidor).
  useEffect(() => {
    if (!company?.id) return
    void supabase.from('companies').select('coupon_offer_shown_at').eq('id', company.id).maybeSingle()
      .then(({ data, error }) => { if (!error) setCouponShownAt((data as { coupon_offer_shown_at?: string | null } | null)?.coupon_offer_shown_at ?? null) })
  }, [company?.id, refreshKey])

  const couponMsLeft = couponShownAt ? new Date(couponShownAt).getTime() + COUPON_WINDOW_MS - Date.now() : 0
  const couponActive = couponMsLeft > 0 && couponMsLeft <= COUPON_WINDOW_MS

  const startCheckout = async (plan: BillingPlan) => {
    if (!session) return
    setCheckoutLoading(plan)
    setCheckoutError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          success_url: `${window.location.origin}/dashboard?upgrade=success`,
          cancel_url: `${window.location.origin}${cancelPath}`,
        }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? tx.checkoutErr)
      window.location.href = data.url
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : String(e))
      setCheckoutLoading(null)
    }
  }

  return (
    <div id={id} style={{ background: `linear-gradient(180deg, ${CARD}, #100b07)`, border: '1px solid rgba(255,109,41,0.3)', borderRadius: '16px', padding: '26px', fontFamily: D }}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{title}</div>
      {intro && <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, marginBottom: '18px' }}>{intro}</div>}
      {checkoutError && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>{checkoutError}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        <PlanCard title={tx.pMonthly} price={tx.pMonthlyPrice} per={tx.perMonth} note={tx.pMonthlyNote}
          extra={couponActive ? <><strong style={{ color: '#4ade80' }}>{tx.couponLine}</strong><br />{tx.couponLeft(Math.floor(couponMsLeft / 86400000), Math.floor((couponMsLeft % 86400000) / 3600000))}</> : undefined}
          btn={checkoutLoading === 'monthly' ? tx.opening : tx.chooseMonthly} disabled={!!checkoutLoading} onClick={() => startCheckout('monthly')} />
        <PlanCard title={tx.pAnnual} price={tx.pAnnualPrice} per={tx.perMonth} note={tx.pAnnualNote} warn={tx.annualClause}
          btn={checkoutLoading === 'annual_commit' ? tx.opening : tx.chooseAnnual} disabled={!!checkoutLoading} onClick={() => startCheckout('annual_commit')} />
      </div>
    </div>
  )
}

function PlanCard({ title, price, per, note, extra, warn, btn, disabled, onClick }: {
  title: string; price: string; per: string; note: string; extra?: ReactNode; warn?: string; btn: string; disabled: boolean; onClick: () => void
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: MUTED }}>{title}</div>
      <div><span style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>{price}</span><span style={{ fontSize: '12px', color: MUTED }}>{per}</span></div>
      <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5 }}>{note}</div>
      {extra && <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5 }}>{extra}</div>}
      {warn && <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.55, padding: '9px 11px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px' }}>{warn}</div>}
      <button onClick={onClick} disabled={disabled}
        style={{ marginTop: 'auto', padding: '12px 18px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: disabled ? 'wait' : 'pointer' }}>
        {btn}
      </button>
    </div>
  )
}
