import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D } from './shared'
import type { GrowthDemoData } from './growthDemo'

const GREEN = '#4ade80'
const AMBER = '#FBBF24'

// ── Agent status ──────────────────────────────────────────────────────────
const AGENT_STATE_LABEL = {
  pt: { active: 'Ativo', idle: 'Aguardando você', soon: 'Em breve' },
  en: { active: 'Active', idle: 'Waiting on you', soon: 'Coming soon' },
} as const
const AGENT_STATE_DOT: Record<GrowthDemoData['agents'][number]['state'], string> = { active: GREEN, idle: AMBER, soon: 'rgba(255,255,255,0.3)' }

export default function GrowthCommandCenter({ data }: { data: GrowthDemoData }) {
  const { lang } = useLang()
  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Status dos agentes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {data.agents.map(a => {
          const st = { dot: AGENT_STATE_DOT[a.state], label: AGENT_STATE_LABEL[lang][a.state] }
          return (
            <div key={a.key} title={a.lastAction}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', fontFamily: D }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '99px', background: st.dot, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>{a.icon} {a.name}</span>
              <span style={{ fontSize: '10px', color: MUTED }}>· {st.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
