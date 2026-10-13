import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { useShowcase, PLANS_PATH } from '../../contexts/ShowcaseContext'
import { useKitStatus } from '../../lib/useKitStatus'

// Peças visuais do "modo vitrine" (decisão do dono 2026-10-13): a faixa fixa no
// topo do painel e o pop-up do kit grátis. A lógica de bloqueio fica em
// contexts/ShowcaseContext.tsx e lib/showcaseGuard.ts.

const ORANGE = '#FF6D29'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

const TX = {
  pt: {
    banner: 'Você está vendo o painel em modo demonstração — escolha um plano pra usar de verdade',
    plans: 'Ver planos',
    kitT: '🎁 Seu presente está esperando',
    kitB: 'Você veio do diagnóstico grátis, então tem direito a 2 vídeos + 1 criativo com as fotos reais do seu imóvel — sem pagar nada. Quer criar agora?',
    kitGo: 'Ver meu presente', kitLater: 'Depois',
  },
  en: {
    banner: 'You are viewing the dashboard in demo mode — pick a plan to use it for real',
    plans: 'See plans',
    kitT: '🎁 Your gift is waiting',
    kitB: 'You came from the free diagnostic, so you get 2 videos + 1 creative made from real photos of your property — for free. Want to create them now?',
    kitGo: 'See my gift', kitLater: 'Later',
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

// Pop-up do kit: aparece TODA vez que a pessoa entra no painel (sessão do
// navegador) até o kit ser criado. "Depois" fecha só nesta visita. Só em vitrine,
// só pra quem veio do diagnóstico grátis e ainda não criou o kit.
const DISMISS_KEY = 'sb_kit_popup_dismissed'
export function KitPromoModal() {
  const { readOnly } = useShowcase()
  const { company } = useCompany()
  const { lang } = useLang()
  const navigate = useNavigate()
  const kit = useKitStatus(company?.id, readOnly)
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })
  if (!readOnly || kit.loading || !kit.entitled || kit.created || dismissed) return null
  const t = TX[lang]
  const later = () => { try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* sem sessionStorage: só fecha agora */ } setDismissed(true) }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.kitT} onClick={later}
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '420px', background: '#1A1008', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '18px', padding: '24px', fontFamily: D, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
        <div style={{ fontSize: '21px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>{t.kitT}</div>
        <div style={{ fontSize: '13px', color: '#BABABA', lineHeight: 1.6, marginBottom: '18px' }}>{t.kitB}</div>
        <button onClick={() => navigate('/gratis')}
          style={{ width: '100%', padding: '13px', background: ORANGE, color: '#000', fontWeight: 900, fontSize: '14px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: D }}>{t.kitGo} →</button>
        <button onClick={later}
          style={{ display: 'block', width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: '#BABABA', fontSize: '12.5px', cursor: 'pointer', fontFamily: D }}>{t.kitLater}</button>
      </div>
    </div>,
    document.body,
  )
}
