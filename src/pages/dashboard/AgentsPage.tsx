import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { useCompany } from '../../contexts/CompanyContext'
import { MUTED, BORDER, D } from './marketingAi/shared'
import { HeroAgentCard, FlowArrow } from './marketingAi/HubAgentCards'
import { MODULES, BADGES, AGENT_ORDER, modulePath } from './marketingAi/agentModules'
import { useFactoryState } from './marketingAi/factory/useFactoryState'
import FactorySection, { type Reveal } from './marketingAi/factory/FactorySection'
import { STATION_KEYS, type StationKey } from './marketingAi/factory/factoryState'
import { curtainSummary, robotView } from './marketingAi/factory/robotState'

// Aba Agentes (C.2.1, 2026-11-07): no topo a CORTINA da fábrica (fechada = só HTML/CSS; o 3D só baixa ao abrir) + os 5 cartões.
// Estação ↔ cartão conversam: tocar num cartão abre a cortina, rola até a fábrica e voa até a estação; tocar numa estação destaca o cartão.
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
  const { cards, stations, kpis, loading } = useFactoryState(lang)
  const [selected, setSelected] = useState<StationKey | null>(null)
  const [focused, setFocused] = useState<StationKey | null>(null)    // cartão com o foco do teclado (só destaca)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const problems = STATION_KEYS.filter(k => robotView(stations[k], lang).pose === 'problem').length
  const summary = useMemo(() => curtainSummary({ loading, opps: kpis.oppsSuggested, pieces: kpis.actionsReady, problems }, lang), [loading, kpis.oppsSuggested, kpis.actionsReady, problems, lang])

  const open = useCallback((k: StationKey) => navigate(modulePath(MODULES[lang][k])), [navigate, lang])
  const show = useCallback((k: StationKey) => setReveal(r => ({ k, n: (r?.n ?? 0) + 1 })), [])

  if (!company) return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>{t.loading}</div>

  const factory = <FactorySection lang={lang} stations={stations} summary={summary} selected={selected} onSelect={setSelected} onOpen={open} reveal={reveal} sheet={narrow} />
  const cardList = (
    <div style={{ border: '1px solid rgba(255,109,41,0.18)', borderRadius: '22px', padding: '16px', background: 'rgba(255,109,41,0.035)' }}>
      {AGENT_ORDER.map((k, i) => (
        <div key={k}>
          {i > 0 && <FlowArrow />}
          <HeroAgentCard lang={lang} m={M[k]} badge={BADGES[lang][k]} onClick={() => open(k)} model={cards[k]} id={`agent-card-${k}`} selected={selected === k || focused === k} onSelect={() => setFocused(k)} onShow={() => show(k)} />
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
        {factory}{cardList}
      </div>
    </div>
  )
}
