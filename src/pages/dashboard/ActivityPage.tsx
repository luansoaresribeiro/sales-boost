import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { timeAgo } from './marketingAi/shared'

const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'

// Mesmo evento que já vai pro Telegram (notifyMarketing() → marketing-bot →
// log-bot-event, ver CLAUDE.md "Toda ação real do agente..."). Esta página
// ANTES lia de `marketing_ai_activity_log` — uma tabela de uma arquitetura
// mais antiga que ninguém nunca escreveu nela (0 linhas sempre). O que
// realmente populava era `bot_notifications`, só que nenhuma tela lia de
// lá — por isso "chega no Telegram todo dia" mas "não aparece em Atividades"
// eram, na prática, dois sistemas desconectados. Corrigido aqui: agora lê
// da tabela certa, a mesma que já tem histórico real.
interface BotNotifRow { id: string; bot_name: string | null; event_type: string; message: string; created_at: string }

const EVENT_META: Record<string, { icon: string; label: string }> = {
  DAILY_REPORT: { icon: '📋', label: 'Relatório diário' },
  WEEKLY_REPORT: { icon: '🗓️', label: 'Relatório semanal' },
  MONTHLY_REPORT: { icon: '📊', label: 'Relatório mensal' },
  AGENT_ACTION: { icon: '🤖', label: 'Ação do agente' },
  OPPORTUNITY_DETECTED: { icon: '💰', label: 'Oportunidade detectada' },
  NEW_COMPETITOR: { icon: '🧭', label: 'Novo concorrente' },
  chat_response: { icon: '💬', label: 'Resposta no chat' },
  conectar_ok: { icon: '🔌', label: 'Conexão' },
  relatorio: { icon: '📄', label: 'Relatório' },
  concorrentes: { icon: '🧭', label: 'Concorrentes' },
}
const eventMeta = (t: string) => EVENT_META[t] ?? { icon: '🤖', label: t.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) }

// Primeira linha da mensagem vira o título curto da lista; o resto some no
// preview (2 linhas) e volta inteiro ao abrir o popup.
function firstLine(msg: string): string {
  const l = msg.split('\n').find(s => s.trim().length > 0) ?? msg
  return l.replace(/^#+\s*/, '').trim()
}
function restOf(msg: string): string {
  const idx = msg.indexOf('\n')
  return idx === -1 ? '' : msg.slice(idx + 1).trim()
}

// Exemplo mostrado só quando ainda não há atividade real — sempre marcado como
// demonstração e substituído automaticamente assim que o primeiro aviso real chegar.
const _n = Date.now()
const DEMO_ACTIVITY: BotNotifRow[] = [
  { id: 'demo-1', bot_name: 'marketing', event_type: 'AGENT_ACTION', message: 'Recomendou focar em Reels nesta semana\nOs Reels tiveram 3x mais alcance que os carrosséis nos últimos 14 dias.', created_at: new Date(_n - 2 * 3600e3).toISOString() },
  { id: 'demo-2', bot_name: 'marketing', event_type: 'AGENT_ACTION', message: 'Criou 2 ideias de post para aprovação\nBaseado no tema que mais engajou: bastidores do preparo.', created_at: new Date(_n - 5 * 3600e3).toISOString() },
  { id: 'demo-3', bot_name: 'marketing', event_type: 'NEW_COMPETITOR', message: 'Analisou 3 concorrentes\nUm concorrente aumentou a frequência de posts — dá pra se destacar no fim de semana.', created_at: new Date(_n - 26 * 3600e3).toISOString() },
  { id: 'demo-4', bot_name: 'marketing', event_type: 'DAILY_REPORT', message: 'Relatório diário\nEngajamento subiu 12% depois dos posts das 19h.', created_at: new Date(_n - 30 * 3600e3).toISOString() },
]

export default function ActivityPage() {
  const { user } = useAuth()
  const { lang } = useLang()
  const [activity, setActivity] = useState<BotNotifRow[]>([])
  const [selected, setSelected] = useState<BotNotifRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [noCompany, setNoCompany] = useState(false)

  const isDemo = !loading && !noCompany && activity.length === 0
  const rows = isDemo ? DEMO_ACTIVITY : activity

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  const load = async () => {
    setLoading(true)
    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user!.id).maybeSingle()
    if (!co) { setNoCompany(true); setLoading(false); return }

    const { data } = await supabase.from('bot_notifications')
      .select('id, bot_name, event_type, message, created_at')
      .eq('company_id', co.id)
      .order('created_at', { ascending: false })
      .limit(100)

    setActivity((data ?? []) as BotNotifRow[])
    setLoading(false)
  }

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          ✨ {lang === 'en' ? 'Agent activity' : 'Atividade do agente'}
        </h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>
          {lang === 'en' ? 'Everything the agent sent to Telegram — reports, actions and opportunities found.' : 'Tudo que o agente mandou pro Telegram — relatórios, ações e oportunidades encontradas.'}
        </p>
      </div>

      <div style={{ padding: '28px 32px' }}>
        {loading ? (
          <div style={{ color: MUTED, fontSize: '14px' }}>{lang === 'en' ? 'Loading...' : 'Carregando...'}</div>
        ) : noCompany ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '48px 32px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>
            {lang === 'en' ? 'Complete onboarding first.' : 'Complete o cadastro do seu negócio primeiro.'}
          </div>
        ) : (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden', maxWidth: '820px' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
                {lang === 'en' ? 'History' : 'Histórico'}
              </span>
              <span style={{ fontSize: '11px', color: MUTED }}>
                {lang === 'en' ? 'Same as Telegram · live' : 'Igual ao Telegram · ao vivo'}
              </span>
            </div>
            {isDemo && (
              <div style={{ padding: '12px 24px', background: 'rgba(251,191,36,0.06)', borderBottom: `1px solid ${BORDER}`, fontSize: '12px', color: '#FBBF24', lineHeight: 1.55 }}>
                🧪 {lang === 'en'
                  ? 'Example data — this is how it will look once the agent starts acting. Real activity replaces it automatically.'
                  : 'Dados de exemplo — é assim que fica quando o agente começar a agir. A atividade real substitui isto sozinha.'}
              </div>
            )}
            {(
              <div style={{ padding: '8px 0', opacity: isDemo ? 0.6 : 1 }}>
                {rows.map((a, i) => {
                  const m = eventMeta(a.event_type)
                  const title = firstLine(a.message)
                  const preview = restOf(a.message)
                  return (
                    <div key={a.id} onClick={() => setSelected(a)} style={{
                      display: 'flex', gap: '14px', padding: '12px 24px',
                      borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none',
                      alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                        {m.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,109,41,0.65)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {m.label}
                          </span>
                          <span style={{ fontSize: '10px', color: MUTED }}>{timeAgo(a.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{title}</div>
                        {preview && (
                          <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '3px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {preview}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (() => {
        const m = eventMeta(selected.event_type)
        return (
          <div onClick={() => setSelected(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px',
              maxWidth: '640px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
            }}>
              <div style={{ padding: '22px 28px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,109,41,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {m.icon} {m.label}
                  {' · '}
                  {new Date(selected.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button onClick={() => setSelected(null)}
                  style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}>
                  ✕
                </button>
              </div>
              <div style={{ padding: '28px' }}>
                <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {selected.message}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
