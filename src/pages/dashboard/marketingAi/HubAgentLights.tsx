import { Link } from 'react-router-dom'
import type { Lang } from '../../../contexts/LanguageContext'
import { MUTED, BORDER } from './shared'
import { AGENT_ORDER } from './agentModules'
import type { CardModel } from './HubAgentCards'

// Linha fina do hub (C.2): "Sua equipe de agentes" + 5 luzes de estado em 2D + link pra aba Agentes. As luzes usam o MESMO
// CardModel dos cartões (cardModels), então cor e texto nunca divergem dos cartões da aba Agentes. Sem three.js aqui.
const COLOR = { ok: '#4ade80', alert: '#FF6D29', muted: '#6b6560' } as const

export default function HubAgentLights({ lang, title, cards, names }: { lang: Lang; title: string; cards: Record<string, CardModel>; names: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} role="list">
        {AGENT_ORDER.map((k, i) => {
          const m = cards[k]
          return (
            <span key={k} role="listitem" title={`${i + 1} · ${names[i]} — ${m.status}`} aria-label={`${i + 1} · ${names[i]}: ${m.status}`}
              style={{ width: '11px', height: '11px', borderRadius: '50%', background: COLOR[m.tone], boxShadow: m.tone === 'muted' ? 'none' : `0 0 0 3px ${COLOR[m.tone]}22` }} />
          )
        })}
      </div>
      <Link to="/dashboard/agentes" style={{ marginLeft: 'auto', fontSize: '12.5px', fontWeight: 700, color: '#FF6D29', textDecoration: 'none' }}>
        {lang === 'en' ? 'See agents →' : 'Ver agentes →'}
      </Link>
    </div>
  )
}
