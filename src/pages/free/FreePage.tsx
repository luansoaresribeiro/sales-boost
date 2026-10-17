// Página dos planos das contas em "modo vitrine" (conta nova antes de pagar).
// A conta navega pelo painel em somente visualização (docs/DECISIONS.md); "Ver
// planos" e o pop-up do cupom levam pra cá (/gratis#plano). O kit grátis acabou
// (decisão do dono 2026-10-17): aqui fica só o que o plano libera + a oferta
// (com o cupom do 1º mês, se estiver valendo). Os dados adicionais (/setup) só
// são pedidos depois de pagar. Quem decide se a conta é vitrine é
// isShowcaseMode (lib/setupGate.ts).
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import PlanOffer from '../dashboard/PlanOffer'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#1A1008'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const CONFIRM_EVERY_MS = 3000
const CONFIRM_MAX_MS = 90_000

const TX = {
  pt: {
    logout: 'Sair', back: '← Painel', tag: 'Planos',
    h1: 'Escolha seu plano', sub: 'Com o plano, o Sales Boost cria, publica e aprende por você — e nada vai ao ar sem a sua aprovação.',
    unlockT: 'O que o plano libera',
    unlock: [
      '🎬 Vídeos curtos dos seus imóveis toda semana, feitos com as suas fotos reais',
      '📈 Planejamento completo: estratégia, calendário, público e metas',
      '🖼️ Posts e criativos na quantidade que a estratégia pedir',
      '💬 Quem comentar QUERO recebe os dados do imóvel na DM na hora — e vira contato seu',
      '🔍 Seus concorrentes e o que está em alta na sua região',
      '✅ Nada vai ao ar sem a sua aprovação',
    ],
    planT: 'Ative o plano e o Sales Boost começa a trabalhar',
    planIntro: 'Depois do pagamento, pedimos só os dados que faltam pra começar (telefone, algumas perguntas e as fotos dos seus imóveis).',
    confirming: 'Confirmando seu pagamento…',
    confirmLate: 'Ainda não recebemos a confirmação do pagamento. Se você já pagou, aguarde alguns minutos e recarregue a página.',
  },
  en: {
    logout: 'Log out', back: '← Dashboard', tag: 'Plans',
    h1: 'Pick your plan', sub: 'With the plan, Sales Boost creates, publishes and learns for you — and nothing goes live without your approval.',
    unlockT: 'What the plan unlocks',
    unlock: [
      '🎬 Short videos of your properties every week, made from your real photos',
      '📈 A complete plan: strategy, calendar, audience and goals',
      '🖼️ Posts and creatives in the amount the strategy calls for',
      '💬 Whoever comments QUERO gets the property details in DMs right away — and becomes your lead',
      '🔍 Your competitors and what is trending in your area',
      '✅ Nothing goes live without your approval',
    ],
    planT: 'Activate the plan and Sales Boost starts working',
    planIntro: 'After payment, we only ask for what is missing to start (phone, a few questions and photos of your properties).',
    confirming: 'Confirming your payment…',
    confirmLate: 'We have not received the payment confirmation yet. If you already paid, wait a few minutes and reload the page.',
  },
} as const

export default function FreePage() {
  const { lang } = useLang()
  const t = TX[lang]
  const { signOut } = useAuth()
  const { company, refreshCompany } = useCompany()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const wantsPlan = location.hash === '#plano'
  const [waited, setWaited] = useState(0)

  // Volta do checkout: o Stripe avisa o servidor alguns segundos depois. Enquanto
  // a conta não aparece como paga, recarrega; quando aparecer, o roteador leva
  // pro painel (e de lá pros dados adicionais).
  const confirming = params.get('upgrade') === 'success'
  useEffect(() => {
    if (!confirming || waited > CONFIRM_MAX_MS) return
    const h = setTimeout(() => { void refreshCompany(); setWaited(w => w + CONFIRM_EVERY_MS) }, CONFIRM_EVERY_MS)
    return () => clearTimeout(h)
  }, [confirming, waited, refreshCompany])

  useEffect(() => {
    if (!wantsPlan) return
    const h = setTimeout(() => document.getElementById('plano')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    return () => clearTimeout(h)
  }, [wantsPlan])

  return (
    <div style={{ minHeight: '100vh', background: BG, color: 'white', fontFamily: D, overflowX: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.02em' }}><span style={{ color: ORANGE }}>Sales</span>Boost</span>
        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: D, marginLeft: 'auto' }}>{t.back}</button>
        <button onClick={async () => { await signOut(); navigate('/') }}
          style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: D }}>{t.logout}</button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {confirming && (
          <div role="status" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 14, padding: '14px 16px', fontSize: 13.5, lineHeight: 1.5 }}>
            {waited > CONFIRM_MAX_MS ? t.confirmLate : t.confirming}
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t.tag}</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 6vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.1 }}>{t.h1}</h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, margin: 0 }}>{company?.business_name && company.business_name !== 'Perfil pessoal' ? `${company.business_name} — ` : ''}{t.sub}</p>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{t.unlockT}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {t.unlock.map(u => <li key={u} style={{ fontSize: 13.5, lineHeight: 1.45 }}>{u}</li>)}
          </ul>
        </div>
        <PlanOffer id="plano" title={t.planT} intro={t.planIntro} cancelPath="/gratis" />
      </div>
    </div>
  )
}
