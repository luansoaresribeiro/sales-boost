import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { useCompany } from '../../contexts/CompanyContext'
import { MUTED, BORDER, D } from './marketingAi/shared'
import { HeroAgentCard, FlowArrow } from './marketingAi/HubAgentCards'
import { MODULES, BADGES, AGENT_ORDER, modulePath } from './marketingAi/agentModules'
import { useFactoryState } from './marketingAi/factory/useFactoryState'
import FactorySection from './marketingAi/factory/FactorySection'
import type { StationKey } from './marketingAi/factory/factoryState'

// Aba Agentes (C.2, 2026-11-07): a fábrica 3D (carregada à parte, nunca trava a página) + os 5 cartões que antes ficavam no hub.
// Estação ↔ cartão conversam: clicar numa estação destaca e rola até o cartão; focar num cartão seleciona a estação.
const MOBILE_MAX = 767
const TX = {
  pt: { title: 'Agentes', sub: 'A equipe que observa o mercado, prioriza, decide, ativa e aprende — com o estado de cada estação. Nada vai ao ar sem a sua aprovação.', team: 'Sua equipe de agentes', loading: 'Carregando...' },
  en: { title: 'Agents', sub: 'The team that watches the market, prioritizes, decides, activates and learns — with each station\'s state. Nothing goes live without your approval.', team: 'Your team of agents', loading: 'Loading...' },
} as const

function useIsNarrow() {
  const [n, setN] = useState(() => window.innerWidth <= MOBILE_MAX)
  useEffect(() => { const f = () => setN(window.innerWidth <= MOBILE_MAX); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return n
}

export default function AgentsPage() {
  const { lang } = useLang()
  const { company } = useCompany()
  const navigate = useNavigate()
  const narrow = useIsNarrow()
  const t = TX[lang]
  const M = MODULES[lang]
  const { cards, stations } = useFactoryState(lang)
  const [selected, setSelected] = useState<StationKey | null>(null)

  const open = useCallback((k: StationKey) => navigate(modulePath(MODULES[lang][k])), [navigate, lang])
  // Clique numa estação: destaca o cartão e rola até ele (sem animação se a pessoa pediu menos movimento).
  const pickStation = useCallback((k: StationKey | null) => {
    setSelected(k)
    if (!k) return
    const el = document.getElementById(`agent-card-${k}`)
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' })
  }, [])

  if (!company) return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>{t.loading}</div>

  const factory = <FactorySection lang={lang} stations={stations} selected={selected} onSelect={pickStation} onOpen={open} compact={narrow} />
  const cardList = (
    <div style={{ border: '1px solid rgba(255,109,41,0.18)', borderRadius: '22px', padding: '16px', background: 'rgba(255,109,41,0.035)' }}>
      {AGENT_ORDER.map((k, i) => (
        <div key={k}>
          {i > 0 && <FlowArrow />}
          <HeroAgentCard lang={lang} m={M[k]} badge={BADGES[lang][k]} onClick={() => open(k)} model={cards[k]} id={`agent-card-${k}`} selected={selected === k} onSelect={() => setSelected(k)} />
        </div>
      ))}
    </div>
  )
  return (
    <div>
      <div style={{ padding: '26px 32px 18px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.9rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', margin: '0 0 4px' }}>{t.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px', margin: 0 }}>{t.sub}</p>
      </div>
      <div style={{ padding: narrow ? '16px 14px 32px' : '22px 32px 32px' }}>
        {narrow ? <>{cardList}<div style={{ height: '18px' }} />{factory}</> : <>{factory}{cardList}</>}
      </div>
    </div>
  )
}
