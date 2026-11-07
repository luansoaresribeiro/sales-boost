import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import ActivityPage, { MessageModal, eventMeta, firstLine, type BotNotifRow } from './ActivityPage'

// Aba "Relatórios" (07/11): em cima os relatórios que o sistema já gera (bot_notifications com event_type
// WEEKLY_/MONTHLY_/ANNUAL_REPORT, gravados pela periodic-report); embaixo o histórico de atividades (o mesmo componente da
// antiga página Atividades). O relatório de saúde (tabela `reports`) continua na própria página /dashboard/relatorio.
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const REPORT_TYPES = ['WEEKLY_REPORT', 'MONTHLY_REPORT', 'ANNUAL_REPORT']

const TX = {
  pt: {
    title: '📄 Relatórios', sub: 'Os relatórios que o agente gera pra você e, embaixo, tudo o que ele fez.',
    featured: 'Relatórios em destaque', loading: 'Carregando...', error: 'Não foi possível carregar os relatórios agora.',
    empty: 'Ainda não há relatórios. Os relatórios semanal e mensal aparecem aqui assim que o sistema gerar o primeiro — sempre com dados reais da sua conta.',
    open: 'Abrir completo', health: 'Relatório de saúde do negócio →', history: 'Histórico de atividades',
  },
  en: {
    title: '📄 Reports', sub: 'The reports the agent generates for you and, below, everything it did.',
    featured: 'Featured reports', loading: 'Loading...', error: 'Could not load the reports right now.',
    empty: 'No reports yet. Weekly and monthly reports show up here as soon as the system generates the first one — always from your real account data.',
    open: 'Open full report', health: 'Business health report →', history: 'Activity history',
  },
} as const

export default function ReportsPage() {
  const { user } = useAuth()
  const { lang } = useLang()
  const t = TX[lang]
  const [rows, setRows] = useState<BotNotifRow[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [selected, setSelected] = useState<BotNotifRow | null>(null)

  useEffect(() => {
    if (!user) return
    let alive = true
    void (async () => {
      const { data: co, error: e1 } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
      if (!alive) return
      if (e1) { setState('error'); return }
      if (!co) { setState('ok'); return }
      const { data, error } = await supabase.from('bot_notifications')
        .select('id, bot_name, event_type, message, created_at')
        .eq('company_id', co.id).in('event_type', REPORT_TYPES)
        .order('created_at', { ascending: false }).limit(12)
      if (!alive) return
      if (error) { setState('error'); return }
      setRows((data ?? []) as BotNotifRow[]); setState('ok')
    })()
    return () => { alive = false }
  }, [user])

  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{t.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>{t.sub}</p>
      </div>

      <div style={{ padding: '28px 32px 20px', maxWidth: '884px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{t.featured}</h2>
          <Link to="/dashboard/relatorio" style={{ fontSize: '12px', color: '#FF6D29', textDecoration: 'none' }}>{t.health}</Link>
        </div>
        {state === 'loading' ? <div style={{ color: MUTED, fontSize: '13px' }}>{t.loading}</div>
          : state === 'error' ? <div style={{ color: '#F87171', fontSize: '13px' }}>{t.error}</div>
          : rows.length === 0 ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '28px 24px', color: MUTED, fontSize: '13px', lineHeight: 1.6 }}>{t.empty}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {rows.map(r => {
                const m = eventMeta(r.event_type, lang)
                const body = r.message.split('\n').slice(1).join(' ').trim()
                return (
                  <button key={r.id} onClick={() => setSelected(r)} style={{ textAlign: 'left', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,109,41,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.icon} {m.label}</span>
                    <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{firstLine(r.message)}</span>
                    <span style={{ fontSize: '11px', color: MUTED }}>{new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    {body && <span style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</span>}
                    <span style={{ fontSize: '11.5px', color: '#FF6D29', marginTop: '2px' }}>{t.open}</span>
                  </button>
                )
              })}
            </div>
          )}
      </div>

      <div style={{ padding: '8px 32px 12px' }}><h2 style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{t.history}</h2></div>
      <ActivityPage embedded />
      {selected && <MessageModal row={selected} lang={lang} onClose={() => setSelected(null)} />}
    </div>
  )
}
