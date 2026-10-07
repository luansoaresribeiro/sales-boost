import { useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, timeAgo } from './shared'
import { ACTION_EN, EVENT_STATUS_EN } from './labels.i18n'
import {
  EVENT_STATUS_META, ACTION_META, activityCounts,
  type EngagementEvent, type EngagementAutomation,
} from './engagementDemo'

const ORANGE = '#FF6D29'

const TX = {
  pt: {
    none: 'Nenhuma conversa ainda. Quando alguém comentar num post com automação ligada, aparece aqui.',
    user: 'Usuário', comment: 'Comentário', intent: 'Intenção', action: 'Ação', status: 'Status', postCamp: 'Post/Campanha', aiInterp: 'Interpretação da IA', message: 'Mensagem', result: 'Resultado',
    detected: 'Comentários detectados', understood: 'Intenções entendidas', dmsSent: 'DMs enviados', awaiting: 'Aguardando aprovação', leadsCreated: 'Leads criados', failures: 'Falhas',
    gameA: 'Esses resultados reais alimentam o ', gameB: 'Business Game', gameC: ' — ex.: "O SalesBoost cuidou de ', gameD: ' conversas do Instagram." Cada evento pode ser aberto na aba ', gameE: 'Conversas', gameF: '.',
  },
  en: {
    none: 'No conversations yet. When someone comments on a post with an automation turned on, it shows up here.',
    user: 'User', comment: 'Comment', intent: 'Intent', action: 'Action', status: 'Status', postCamp: 'Post/Campaign', aiInterp: 'AI interpretation', message: 'Message', result: 'Result',
    detected: 'Comments detected', understood: 'Intents understood', dmsSent: 'DMs sent', awaiting: 'Awaiting approval', leadsCreated: 'Leads created', failures: 'Failures',
    gameA: 'These real results feed the ', gameB: 'Business Game', gameC: ' — e.g.: "SalesBoost handled ', gameD: ' Instagram conversations." Each event can be opened in the ', gameE: 'Conversations', gameF: ' tab.',
  },
} as const

// ── Conversations (o dono acompanha o que rolou) ────────────────────────────
export function ConversationsSection({ events, automations }: { events: EngagementEvent[]; automations: EngagementAutomation[] }) {
  const { lang } = useLang()
  const t = TX[lang]
  const actionLabel = (k: string | null) => { const key = k ?? 'send_dm'; return lang === 'en' ? ACTION_EN[key]?.label ?? key : ACTION_META[key as keyof typeof ACTION_META]?.label ?? key }
  const [open, setOpen] = useState<string | null>(null)
  if (events.length === 0) {
    return <Empty text={t.none} />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1.2fr 1fr 0.9fr', gap: '8px', padding: '0 14px', fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span>{t.user}</span><span>{t.comment}</span><span>{t.intent}</span><span>{t.action}</span><span style={{ textAlign: 'right' }}>{t.status}</span>
      </div>
      {events.map(e => {
        const st0 = EVENT_STATUS_META[e.status]
        const st = { ...st0, label: lang === 'en' ? EVENT_STATUS_EN[e.status] ?? st0.label : st0.label }
        const auto = automations.find(a => a.id === e.automation_id)
        const expanded = open === e.id
        return (
          <div key={e.id} style={{ background: CARD, border: `1px solid ${expanded ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '11px', overflow: 'hidden' }}>
            <button onClick={() => setOpen(expanded ? null : e.id)}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1.2fr 1fr 0.9fr', gap: '8px', alignItems: 'center', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: D, textAlign: 'left' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.ig_user ?? '—'}</span>
              <span style={{ fontSize: '11.5px', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{e.comment_text}"</span>
              <span style={{ fontSize: '11px', color: 'white' }}>{e.intent_detected ?? '—'}</span>
              <span style={{ fontSize: '11px', color: MUTED }}>{actionLabel(e.action_type)}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: st.color, textAlign: 'right' }}>{st.label}</span>
            </button>
            {expanded && (
              <div style={{ padding: '2px 16px 16px', borderTop: `1px solid ${BORDER}` }}>
                <Row k={t.postCamp} v={auto?.name ?? '—'} />
                <Row k={t.comment} v={`"${e.comment_text}"`} />
                <Row k={t.aiInterp} v={e.ai_interpretation ?? '—'} highlight />
                <Row k={t.action} v={actionLabel(e.action_type)} />
                {e.action_message && <Row k={t.message} v={e.action_message} />}
                <Row k={t.result} v={`${st.label}${e.error ? ` · ${e.error}` : ''}`} />
                <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>{timeAgo(e.created_at, lang)}</div>
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
  const t = TX[useLang().lang]
  const c = activityCounts(events)
  const cards: { label: string; value: number; color: string; icon: string }[] = [
    { label: t.detected, value: c.detected, color: '#4ade80', icon: '🟢' },
    { label: t.understood, value: c.understood, color: '#4ade80', icon: '🟢' },
    { label: t.dmsSent, value: c.sent, color: '#4ade80', icon: '🟢' },
    { label: t.awaiting, value: c.awaiting, color: '#FBBF24', icon: '🟡' },
    { label: t.leadsCreated, value: c.leads, color: '#4ade80', icon: '🧲' },
    { label: t.failures, value: c.failed, color: '#f87171', icon: '🔴' },
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
        💡 {t.gameA}<strong style={{ color: 'white' }}>{t.gameB}</strong>{t.gameC}{c.detected}{t.gameD}<strong style={{ color: 'white' }}>{t.gameE}</strong>{t.gameF}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{text}</div>
}
