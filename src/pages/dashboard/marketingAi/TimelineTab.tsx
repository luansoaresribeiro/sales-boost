import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, PILLAR_LABEL, PILLAR_ICON, timeAgo, type ActivityLogRow } from './shared'

const PILLAR_EN: Record<string, string> = { tracking: 'Tracking', content: 'Content', competitor: 'Competitors', strategy: 'Strategy' }

export default function TimelineTab({ activity }: { activity: ActivityLogRow[] }) {
  const { lang } = useLang(); const en = lang === 'en'
  if (activity.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>
        {en ? 'No activity recorded yet. As soon as Marketing AI collects data, generates content or recommends something, it shows up here.' : 'Nenhuma atividade registrada ainda. Assim que o Marketing AI coletar dados, gerar conteúdo ou recomendar algo, aparece aqui.'}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {activity.map((a, i) => (
        <div key={a.id} style={{ display: 'flex', gap: '14px', padding: '14px 4px', borderBottom: i < activity.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: CARD, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>
            {PILLAR_ICON[a.pillar ?? ''] ?? '🤖'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'rgba(255,109,41,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{(en ? PILLAR_EN : PILLAR_LABEL)[a.pillar ?? ''] ?? (en ? 'System' : 'Sistema')}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(a.created_at, lang)}</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'white', fontWeight: 500 }}>{a.action}</div>
            {a.reasoning && <div style={{ fontSize: '11px', color: MUTED, marginTop: '3px', lineHeight: 1.5 }}>{a.reasoning}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
