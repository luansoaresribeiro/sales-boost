// Escolha do plano + checkout (Stripe, via create-checkout) + cupom do 1º mês.
// Usado no resumo do trial (contas antigas) e na página /gratis (contas novas
// antes de pagar). O cupom só vale se a oferta foi vista há no máximo 7 dias
// (companies.coupon_offer_shown_at — o servidor confere de novo no checkout).
// Preço por tipo de negócio (lib/pricing.ts). Com cupom ativo, o "Assinar o
// mensal" abre antes um popup mostrando o desconto (decisão do dono 2026-10-11).
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { brl, PRICING, usePlanTier } from '../../lib/pricing'
import { CARD, MUTED, BORDER, ORANGE, D, SUPABASE_URL } from './marketingAi/shared'

type BillingPlan = 'monthly' | 'annual_commit'
const COUPON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

type P = { monthly: string; annual: string; coupon: string; firstMonth: string; fee6: string }
const TX = {
  pt: {
    checkoutErr: 'Erro ao iniciar assinatura', opening: 'Abrindo checkout...',
    pMonthly: 'Mensal', perMonth: '/mês', pMonthlyNote: 'Sem fidelidade. Cancele quando quiser.',
    pAnnual: 'Anual', pAnnualNote: 'Fidelidade de 12 meses, cobrado mensalmente.',
    annualClause: (p: P) => `Atenção: se você cancelar antes de completar os 12 meses, paga uma multa de 30% das mensalidades que faltarem. Exemplo: cancelando com 6 meses restantes, a multa é 30% × 6 × ${p.annual} = ${p.fee6}.`,
    chooseMonthly: 'Assinar o mensal →', chooseAnnual: 'Assinar o anual (12 meses) →',
    couponBadge: (p: P) => `🎁 Cupom de ${p.coupon} OFF no 1º mês`,
    couponLine: (p: P) => `1º mês por ${p.firstMonth}, depois ${p.monthly}/mês`,
    couponLeft: (d: number, h: number) => d > 0 ? `Oferta válida por mais ${d} ${d === 1 ? 'dia' : 'dias'} e ${h} h.` : `Oferta válida por mais ${h} h.`,
    mTitle: (p: P) => `Você ganhou ${p.coupon} de desconto 🎁`,
    mSub: 'Seu cupom já está aplicado no plano mensal. É só confirmar.',
    mFrom: 'Sem cupom', mTo: 'Seu 1º mês', mAfter: (p: P) => `Depois, ${p.monthly}/mês. Sem fidelidade: cancele quando quiser.`,
    mGo: (p: P) => `Usar meu cupom de ${p.coupon} e assinar →`, mBack: 'Voltar',
  },
  en: {
    checkoutErr: 'Error starting subscription', opening: 'Opening checkout...',
    pMonthly: 'Monthly', perMonth: '/month', pMonthlyNote: 'No commitment. Cancel any time.',
    pAnnual: 'Annual', pAnnualNote: '12-month commitment, billed monthly.',
    annualClause: (p: P) => `Note: if you cancel before completing the 12 months, you pay a fee of 30% of the remaining monthly payments. Example: cancelling with 6 months left, the fee is 30% × 6 × ${p.annual} = ${p.fee6}.`,
    chooseMonthly: 'Choose monthly →', chooseAnnual: 'Choose annual (12 months) →',
    couponBadge: (p: P) => `🎁 ${p.coupon} OFF coupon on the 1st month`,
    couponLine: (p: P) => `1st month for ${p.firstMonth}, then ${p.monthly}/month`,
    couponLeft: (d: number, h: number) => d > 0 ? `Offer valid for ${d} more ${d === 1 ? 'day' : 'days'} and ${h} h.` : `Offer valid for ${h} more hours.`,
    mTitle: (p: P) => `You got ${p.coupon} off 🎁`,
    mSub: 'Your coupon is already applied to the monthly plan. Just confirm.',
    mFrom: 'Without coupon', mTo: 'Your 1st month', mAfter: (p: P) => `Then ${p.monthly}/month. No commitment: cancel any time.`,
    mGo: (p: P) => `Use my ${p.coupon} coupon and subscribe →`, mBack: 'Back',
  },
} as const

export default function PlanOffer({ title, intro, cancelPath, refreshKey = 0, id }: {
  title: string; intro?: ReactNode; cancelPath: string; refreshKey?: number; id?: string
}) {
  const { lang } = useLang()
  const tx = TX[lang]
  const { session } = useAuth()
  const { company } = useCompany()
  const price = PRICING[usePlanTier(company?.business_type)]
  const p: P = {
    monthly: brl(price.monthly, lang), annual: brl(price.annual, lang), coupon: brl(price.coupon, lang),
    firstMonth: brl(price.monthly - price.coupon, lang), fee6: brl(Math.round(0.3 * 6 * price.annual * 100) / 100, lang),
  }
  const [couponModal, setCouponModal] = useState(false)
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
        <PlanCard title={tx.pMonthly} price={p.monthly} per={tx.perMonth} note={tx.pMonthlyNote}
          extra={couponActive ? <><span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80', fontWeight: 800, marginBottom: 6 }}>{tx.couponBadge(p)}</span><br /><strong style={{ color: '#4ade80' }}>{tx.couponLine(p)}</strong><br />{tx.couponLeft(Math.floor(couponMsLeft / 86400000), Math.floor((couponMsLeft % 86400000) / 3600000))}</> : undefined}
          btn={checkoutLoading === 'monthly' ? tx.opening : tx.chooseMonthly} disabled={!!checkoutLoading} onClick={() => couponActive ? setCouponModal(true) : void startCheckout('monthly')} />
        <PlanCard title={tx.pAnnual} price={p.annual} per={tx.perMonth} note={tx.pAnnualNote} warn={tx.annualClause(p)}
          btn={checkoutLoading === 'annual_commit' ? tx.opening : tx.chooseAnnual} disabled={!!checkoutLoading} onClick={() => startCheckout('annual_commit')} />
      </div>

      {couponModal && (
        <div role="dialog" aria-modal="true" onClick={() => setCouponModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '420px', background: CARD, border: '1px solid rgba(74,222,128,0.4)', borderRadius: '18px', padding: '24px', fontFamily: D, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ fontSize: '21px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '6px' }}>{tx.mTitle(p)}</div>
            <div style={{ fontSize: '13px', color: MUTED, marginBottom: '16px' }}>{tx.mSub}</div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '18px', padding: '14px', borderRadius: '12px', background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', marginBottom: '8px' }}>
              <div><div style={{ fontSize: '11px', color: MUTED }}>{tx.mFrom}</div><div style={{ fontSize: '17px', color: 'rgba(255,255,255,0.45)', textDecoration: 'line-through', fontWeight: 700 }}>{p.monthly}</div></div>
              <div><div style={{ fontSize: '11px', color: MUTED }}>{tx.mTo}</div><div style={{ fontSize: '30px', color: '#4ade80', fontWeight: 900, lineHeight: 1 }}>{p.firstMonth}</div></div>
            </div>
            <div style={{ fontSize: '12px', color: MUTED, marginBottom: '16px' }}>{tx.mAfter(p)}</div>
            <button onClick={() => { setCouponModal(false); void startCheckout('monthly') }}
              style={{ width: '100%', padding: '14px', background: '#4ade80', color: '#000', fontWeight: 900, fontSize: '14px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: D }}>{tx.mGo(p)}</button>
            <button onClick={() => setCouponModal(false)}
              style={{ display: 'block', width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: MUTED, fontSize: '12.5px', cursor: 'pointer', fontFamily: D }}>{tx.mBack}</button>
          </div>
        </div>
      )}
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
