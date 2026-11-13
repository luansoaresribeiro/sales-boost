import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { useCompany } from '../../contexts/CompanyContext'
import { MUTED, BORDER, D } from './marketingAi/shared'
import { MODULES, modulePath } from './marketingAi/agentModules'
import { useFactoryState } from './marketingAi/factory/useFactoryState'
import FactorySection from './marketingAi/factory/FactorySection'
import type { StationKey } from './marketingAi/factory/factoryState'
import BrandLoader from '../../components/BrandLoader'

// Aba Agentes. Desde 2026-11-10 (dono): só os robôs em 3D, sempre abertos — sem cortina e sem os 5 cartões.
// Tocar num robô abre o painel da estação; o "Abrir" do painel leva à aba daquele agente (as mesmas de sempre).
const MOBILE_MAX = 767
const TX = {
  pt: { title: 'Agentes', sub: 'A equipe que observa o mercado, prioriza, decide, ativa e aprende. Nada vai ao ar sem a sua aprovação.' },
  en: { title: 'Agents', sub: 'The team that watches the market, prioritizes, decides, activates and learns. Nothing goes live without your approval.' },
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
  const { stations } = useFactoryState(lang)
  const [selected, setSelected] = useState<StationKey | null>(null)
  const open = useCallback((k: StationKey) => navigate(modulePath(MODULES[lang][k])), [navigate, lang])

  if (!company) return <BrandLoader />

  return (
    <div>
      <div style={{ padding: narrow ? '18px 14px 12px' : '26px 32px 18px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.9rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', margin: '0 0 4px' }}>{t.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px', margin: 0 }}>{t.sub}</p>
      </div>
      <div style={{ padding: narrow ? '12px 14px 24px' : '18px 32px 28px' }}>
        {/* Clique no robô abre o agente direto, sem o painel intermediário (dono, 13/11). O painel (StationPanel) continua no código. */}
        <FactorySection lang={lang} stations={stations} selected={selected} onSelect={k => (k ? open(k) : setSelected(null))} onOpen={open} sheet={narrow} />
      </div>
    </div>
  )
}
