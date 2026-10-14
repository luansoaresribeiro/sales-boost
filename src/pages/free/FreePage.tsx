// Página do kit grátis + planos das contas em "modo vitrine" (conta nova antes de
// pagar). Desde 2026-10-13 a conta NÃO é mais presa aqui — navega pelo painel em
// somente visualização (docs/DECISIONS.md) — e esta página é um destino: o
// pop-up do kit leva pra cá, e "Ver planos" leva pra /gratis#plano.
//  - Quem veio do diagnóstico grátis tem o kit (1 foto → 3 artes, decisão
//    2026-10-14); quando fica pronto mostra o que o plano libera e o cupom.
//  - Quem criou a conta direto não tem kit: vê só os planos.
// Os dados adicionais (/setup) só são pedidos depois de pagar. Quem decide se a
// conta é vitrine é isShowcaseMode (lib/setupGate.ts).
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import FreeVideoCard, { type State as VideoState } from '../dashboard/FreeVideoCard'
import PlanOffer from '../dashboard/PlanOffer'
import { useKitStatus } from '../../lib/useKitStatus'

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
    logout: 'Sair', back: '← Painel', tag: 'Seu acesso grátis',
    h1Plan: 'Escolha seu plano', subPlan: 'Com o plano, o Sales Boost cria, publica e aprende por você — e nada vai ao ar sem a sua aprovação.',
    h1: 'Seu kit grátis: 3 artes da sua foto', h1Done: 'Seu kit grátis está pronto 🎉',
    sub: 'Com a foto real do seu imóvel, com acabamento profissional: 2 artes pro feed e 1 pro stories, prontas pra postar — sem inventar nada.',
    steps: ['Escolha a foto mais bonita do imóvel', 'A IA cria as 3 artes (cerca de 1 minuto)', 'Publique com "Comente QUERO" e receba os interessados'],
    next: 'Depois do kit, você vê tudo o que o Sales Boost faz com o plano — e ganha um cupom pro 1º mês.',
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
    logout: 'Log out', back: '← Dashboard', tag: 'Your free access',
    h1Plan: 'Pick your plan', subPlan: 'With the plan, Sales Boost creates, publishes and learns for you — and nothing goes live without your approval.',
    h1: 'Your free kit: 3 designs from your photo', h1Done: 'Your free kit is ready 🎉',
    sub: 'From the real photo of your property, with a professional finish: 2 feed designs and 1 for stories, ready to post — nothing made up.',
    steps: ['Pick the best photo of the property', 'The AI creates the 3 designs (about 1 minute)', 'Post them with "Comment QUERO" and get interested buyers'],
    next: 'After the kit, you will see everything Sales Boost does with the plan — and get a coupon for the 1st month.',
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
  const kit = useKitStatus(company?.id, true)
  const wantsPlan = location.hash === '#plano'
  const [video, setVideo] = useState<{ state: VideoState; couponShown: boolean }>({ state: 'loading', couponShown: false })
  const [couponKey, setCouponKey] = useState(0)
  const [waited, setWaited] = useState(0)

  const onState = useCallback((s: { state: VideoState; couponShown: boolean }) => {
    setVideo(prev => (prev.state === s.state && prev.couponShown === s.couponShown ? prev : s))
    if (s.couponShown) setCouponKey(k => k + 1)
  }, [])

  // Volta do checkout: o Stripe avisa o servidor alguns segundos depois. Enquanto
  // a conta não aparece como paga, recarrega; quando aparecer, o roteador leva
  // pro painel (e de lá pros dados adicionais).
  const confirming = params.get('upgrade') === 'success'
  useEffect(() => {
    if (!confirming || waited > CONFIRM_MAX_MS) return
    const h = setTimeout(() => { void refreshCompany(); setWaited(w => w + CONFIRM_EVERY_MS) }, CONFIRM_EVERY_MS)
    return () => clearTimeout(h)
  }, [confirming, waited, refreshCompany])

  // Sem direito ao kit (conta direta) ou pediu "Ver planos": mostra o plano já.
  const noKit = !kit.loading && !kit.entitled
  const showPlan = video.state === 'completed' || video.state === 'cap' || noKit || wantsPlan
  useEffect(() => {
    if (!wantsPlan || kit.loading) return
    const h = setTimeout(() => document.getElementById('plano')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    return () => clearTimeout(h)
  }, [wantsPlan, kit.loading])
  const goPlan = () => document.getElementById('plano')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

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
          <h1 style={{ fontSize: 'clamp(1.6rem, 6vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.1 }}>{noKit ? t.h1Plan : video.state === 'completed' ? t.h1Done : t.h1}</h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, margin: 0 }}>{company?.business_name && company.business_name !== 'Perfil pessoal' ? `${company.business_name} — ` : ''}{noKit ? t.subPlan : t.sub}</p>
        </div>

        {kit.entitled && <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {t.steps.map((s, i) => (
            <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'white' }}>
              <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: 'rgba(255,109,41,0.15)', border: `1px solid ${ORANGE}`, color: ORANGE, fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>}

        {company && kit.entitled && <FreeVideoCard companyId={company.id} onActivate={goPlan} onState={onState} />}

        {!showPlan && kit.entitled && <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>{t.next}</p>}

        {showPlan && (
          <>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{t.unlockT}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {t.unlock.map(u => <li key={u} style={{ fontSize: 13.5, lineHeight: 1.45 }}>{u}</li>)}
              </ul>
            </div>
            <PlanOffer id="plano" title={t.planT} intro={t.planIntro} cancelPath="/gratis" refreshKey={couponKey} />
          </>
        )}
      </div>
    </div>
  )
}
