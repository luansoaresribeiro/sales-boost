import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { useShowcase, PLANS_PATH } from '../../contexts/ShowcaseContext'
import { supabase } from '../../lib/supabase'
import { brl, PRICING, usePlanTier } from '../../lib/pricing'

// Peças visuais do "modo vitrine" (decisão do dono 2026-10-13): a faixa fixa no
// topo do painel e o pop-up do cupom (desde 2026-10-17 — antes era o do kit
// grátis, que acabou). A lógica de bloqueio fica em contexts/ShowcaseContext.tsx
// e lib/showcaseGuard.ts.

const ORANGE = '#FF6D29'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
// Mesma janela do PlanOffer e do create-checkout (o servidor confere de novo).
const COUPON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const TX = {
  pt: {
    banner: 'Você está vendo o painel em modo demonstração — escolha um plano pra usar de verdade',
    plans: 'Ver planos',
    cT: (c: string) => `🎟️ Você ganhou um cupom de ${c}`,
    cB: (c: string, first: string, monthly: string) => `${c} de desconto no 1º mês do plano: você paga ${first} no primeiro mês e depois ${monthly}/mês. Sem fidelidade.`,
    cLeft: (d: number, h: number) => d > 0 ? `Válido por mais ${d} ${d === 1 ? 'dia' : 'dias'} e ${h} h.` : `Válido por mais ${h} h.`,
    cGo: 'Usar meu cupom', cLater: 'Depois',
  },
  en: {
    banner: 'You are viewing the dashboard in demo mode — pick a plan to use it for real',
    plans: 'See plans',
    cT: (c: string) => `🎟️ You got a ${c} coupon`,
    cB: (c: string, first: string, monthly: string) => `${c} off the 1st month of the plan: you pay ${first} for the first month, then ${monthly}/month. No commitment.`,
    cLeft: (d: number, h: number) => d > 0 ? `Valid for ${d} more ${d === 1 ? 'day' : 'days'} and ${h} h.` : `Valid for ${h} more hours.`,
    cGo: 'Use my coupon', cLater: 'Later',
  },
} as const

// Faixa fixa no topo (só em vitrine). Reserva espaço à direita pro sino de
// pendências, que fica por cima no canto.
export function ShowcaseBanner() {
  const { readOnly } = useShowcase()
  const { lang } = useLang()
  const navigate = useNavigate()
  if (!readOnly) return null
  const t = TX[lang]
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', padding: '9px 76px 9px 16px', background: 'rgba(255,109,41,0.14)', borderBottom: '1px solid rgba(255,109,41,0.35)', fontFamily: D, fontSize: '12.5px', color: 'white', textAlign: 'center', lineHeight: 1.4 }}>
      <span>{t.banner}</span>
      <button onClick={() => navigate(PLANS_PATH)}
        style={{ padding: '6px 14px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>{t.plans}</button>
    </div>
  )
}

// Pop-up do cupom: aparece ao entrar no painel (1x por sessão do navegador) pra
// conta em vitrine, enquanto o cupom vale. Na 1ª vez avisa o servidor
// (trial-video, action coupon_seen) — é aí que começam os 7 dias do cupom.
const DISMISS_KEY = 'sb_coupon_popup_dismissed'
export function CouponModal() {
  const { readOnly } = useShowcase()
  const { company } = useCompany()
  const { lang } = useLang()
  const navigate = useNavigate()
  const price = PRICING[usePlanTier(company?.business_type)]
  const [msLeft, setMsLeft] = useState<number | null>(null) // null = carregando / sem cupom
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })

  useEffect(() => {
    if (!readOnly || !company?.id || dismissed) return
    let alive = true
    void (async () => {
      const { data, error } = await supabase.from('companies').select('coupon_offer_shown_at').eq('id', company.id).maybeSingle()
      if (!alive || error) return
      const at = (data as { coupon_offer_shown_at?: string | null } | null)?.coupon_offer_shown_at ?? null
      if (at) { setMsLeft(new Date(at).getTime() + COUPON_WINDOW_MS - Date.now()); return }
      // 1ª vez: começa a contar os 7 dias no servidor.
      await supabase.functions.invoke('trial-video', { body: { action: 'coupon_seen' } }).catch(() => null)
      if (alive) setMsLeft(COUPON_WINDOW_MS)
    })()
    return () => { alive = false }
  }, [readOnly, company?.id, dismissed])

  if (!readOnly || dismissed || msLeft === null || msLeft <= 0) return null
  const t = TX[lang]
  const c = brl(price.coupon, lang)
  const later = () => { try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* sem sessionStorage: só fecha agora */ } setDismissed(true) }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.cT(c)} onClick={later}
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '420px', background: '#1A1008', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '18px', padding: '24px', fontFamily: D, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
        <div style={{ fontSize: '21px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>{t.cT(c)}</div>
        <div style={{ fontSize: '13px', color: '#BABABA', lineHeight: 1.6, marginBottom: '6px' }}>{t.cB(c, brl(price.monthly - price.coupon, lang), brl(price.monthly, lang))}</div>
        <div style={{ fontSize: '12.5px', color: ORANGE, fontWeight: 700, marginBottom: '18px' }}>{t.cLeft(Math.floor(msLeft / 86_400_000), Math.floor((msLeft % 86_400_000) / 3_600_000))}</div>
        <button onClick={() => { later(); navigate(PLANS_PATH) }}
          style={{ width: '100%', padding: '13px', background: ORANGE, color: '#000', fontWeight: 900, fontSize: '14px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: D }}>{t.cGo} →</button>
        <button onClick={later}
          style={{ display: 'block', width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: '#BABABA', fontSize: '12.5px', cursor: 'pointer', fontFamily: D }}>{t.cLater}</button>
      </div>
    </div>,
    document.body,
  )
}
