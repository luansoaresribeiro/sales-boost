import { useState } from 'react'
import { CARD, MUTED, BORDER, D, timeAgo } from './shared'
import {
  EVENT_STATUS_META, ACTION_META, activityCounts,
  type EngagementEvent, type EngagementAutomation,
} from './engagementDemo'

const ORANGE = '#FF6D29'

// ── Conversations (o dono acompanha o que rolou) ────────────────────────────
export function ConversationsSection({ events, automations }: { events: EngagementEvent[]; automations: EngagementAutomation[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (events.length === 0) {
    return <Empty text="Nenhuma conversa ainda. Quando alguém comentar num post com automação ligada, aparece aqui." />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1.2fr 1fr 0.9fr', gap: '8px', padding: '0 14px', fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span>Usuário</span><span>Comentário</span><span>Intenção</span><span>Ação</span><span style={{ textAlign: 'right' }}>Status</span>
      </div>
      {events.map(e => {
        const st = EVENT_STATUS_META[e.status]
        const auto = automations.find(a => a.id === e.automation_id)
        const expanded = open === e.id
        return (
          <div key={e.id} style={{ background: CARD, border: `1px solid ${expanded ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '11px', overflow: 'hidden' }}>
            <button onClick={() => setOpen(expanded ? null : e.id)}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1.2fr 1fr 0.9fr', gap: '8px', alignItems: 'center', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: D, textAlign: 'left' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.ig_user ?? '—'}</span>
              <span style={{ fontSize: '11.5px', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{e.comment_text}"</span>
              <span style={{ fontSize: '11px', color: 'white' }}>{e.intent_detected ?? '—'}</span>
              <span style={{ fontSize: '11px', color: MUTED }}>{ACTION_META[(e.action_type ?? 'send_dm') as keyof typeof ACTION_META]?.label ?? e.action_type}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: st.color, textAlign: 'right' }}>{st.label}</span>
            </button>
            {expanded && (
              <div style={{ padding: '2px 16px 16px', borderTop: `1px solid ${BORDER}` }}>
                <Row k="Post/Campanha" v={auto?.name ?? '—'} />
                <Row k="Comentário" v={`"${e.comment_text}"`} />
                <Row k="Interpretação da IA" v={e.ai_interpretation ?? '—'} highlight />
                <Row k="Ação" v={`${ACTION_META[(e.action_type ?? 'send_dm') as keyof typeof ACTION_META]?.label ?? e.action_type}`} />
                {e.action_message && <Row k="Mensagem" v={e.action_message} />}
                <Row k="Resultado" v={`${st.label}${e.error ? ` · ${e.error}` : ''}`} />
                <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>{timeAgo(e.created_at)}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div style={{ marginTop: '9px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{k}</div>
      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5, ...(highlight ? { background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '8px', padding: '8px 11px' } : {}) }}>{v}</div>
    </div>
  )
}

// ── Activity (visão operacional) ────────────────────────────────────────────
export function ActivitySection({ events }: { events: EngagementEvent[] }) {
  const c = activityCounts(events)
  const cards: { label: string; value: number; color: string; icon: string }[] = [
    { label: 'Comentários detectados', value: c.detected, color: '#4ade80', icon: '🟢' },
    { label: 'Intenções entendidas', value: c.understood, color: '#4ade80', icon: '🟢' },
    { label: 'DMs enviados', value: c.sent, color: '#4ade80', icon: '🟢' },
    { label: 'Aguardando aprovação', value: c.awaiting, color: '#FBBF24', icon: '🟡' },
    { label: 'Leads criados', value: c.leads, color: '#4ade80', icon: '🧲' },
    { label: 'Falhas', value: c.failed, color: '#f87171', icon: '🔴' },
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '18px' }}>
        {cards.map(cd => (
          <div key={cd.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{cd.icon} {cd.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: cd.color }}>{cd.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6, background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '10px', padding: '11px 14px' }}>
        💡 Esses resultados reais alimentam o <strong style={{ color: 'white' }}>Business Game</strong> — ex.: "O SalesBoost cuidou de {c.detected} conversas do Instagram." Cada evento pode ser aberto na aba <strong style={{ color: 'white' }}>Conversas</strong>.
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{text}</div>
}
