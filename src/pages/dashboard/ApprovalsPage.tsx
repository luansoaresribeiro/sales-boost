import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'
import {
  listAgentActions, decideAgentAction, editAgentAction,
  APPROVAL_META, EXECUTION_META, type AgentAction,
} from '../../lib/agentActions'

const FORMAT_ICON: Record<string, string> = { reel: '🎬', carrossel: '🎠', story: '📱', foto: '📸' }
const CHANNEL_ICON: Record<string, string> = { instagram: '📸', whatsapp: '💬', google: '⭐', email: '✉️', facebook: '📘', website: '🌐', internal: '⚙️' }

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'

interface AiContent {
  id: string; idea: string | null; caption: string | null; hashtags: string | null
  format: 'reel' | 'carrossel' | 'story' | 'foto' | null; image_url: string | null
  reasoning: string | null; status: string; created_at: string
}

// ── Card universal de AÇÃO (qualquer agente) ────────────────────────────────
function ActionCard({ a, busy, onDecide, onEdit, lang }: {
  a: AgentAction; busy: boolean; onDecide: (d: 'approve' | 'reject') => void; onEdit: (desc: string) => void; lang: 'pt' | 'en'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(a.description ?? '')
  const ap = APPROVAL_META[a.approval_status]
  const risk = a.risk_level === 'high' ? '#f87171' : a.risk_level === 'medium' ? '#FBBF24' : MUTED
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>
          {CHANNEL_ICON[a.channel ?? 'internal'] ?? '⚙️'} {a.title}
        </div>
        <span style={{ fontSize: '9.5px', fontWeight: 700, color: ap.color, padding: '2px 8px', border: `1px solid ${ap.color}44`, borderRadius: '99px', flexShrink: 0 }}>{ap.label}</span>
      </div>
      {/* WHO / WHERE / WHEN */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10.5px', color: MUTED, marginBottom: '8px' }}>
        <span>👤 {a.agent_name ?? a.agent_key}</span>
        {a.channel && <span>· {a.channel}</span>}
        {a.target && <span>· 🎯 {a.target}</span>}
        <span>· {new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <span>· ⚠️ <span style={{ color: risk }}>{a.risk_level}</span></span>
      </div>
      {/* WHY */}
      {(a.agent_interpretation || a.reason) && (
        <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55, marginBottom: '6px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', padding: '8px 11px' }}>
          💡 {a.agent_interpretation ?? a.reason}
        </div>
      )}
      {/* Payload preview (caption) + description */}
      {typeof a.payload?.caption === 'string' && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55, marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{a.payload.caption as string}</div>}
      {editing ? (
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12px', padding: '8px', fontFamily: D, outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }} />
      ) : a.description ? (
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, marginBottom: '6px' }}>{a.description}</div>
      ) : null}
      {/* Expected */}
      {a.expected_outcome && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '10px' }}>🎯 {lang === 'en' ? 'Expected' : 'Resultado esperado'}: {a.expected_outcome}</div>}
      {/* Ações */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        {editing ? (
          <>
            <button onClick={() => { onEdit(draft); setEditing(false) }} disabled={busy}
              style={btn(ORANGE, '#000')}>{lang === 'en' ? 'Save' : 'Salvar'}</button>
            <button onClick={() => { setEditing(false); setDraft(a.description ?? '') }}
              style={btnGhost()}>{lang === 'en' ? 'Cancel' : 'Cancelar'}</button>
          </>
        ) : (
          <>
            <button onClick={() => onDecide('approve')} disabled={busy} style={btn(ORANGE, '#000')}>✓ {lang === 'en' ? 'Approve' : 'Aprovar'}</button>
            <button onClick={() => setEditing(true)} disabled={busy} style={btnGhost()}>✎ {lang === 'en' ? 'Edit' : 'Editar'}</button>
            <button onClick={() => onDecide('reject')} disabled={busy} style={{ ...btnGhost(), color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>✕ {lang === 'en' ? 'Reject' : 'Rejeitar'}</button>
          </>
        )}
      </div>
    </div>
  )
}
const btn = (bg: string, color: string) => ({ padding: '8px 16px', background: bg, color, fontWeight: 700, fontSize: '12px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D } as const)
const btnGhost = () => ({ padding: '8px 16px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '12px', border: `1px solid ${BORDER}`, borderRadius: '9px', cursor: 'pointer', fontFamily: D } as const)

// ── Card de CONTEÚDO (fluxo atual, mantido) ─────────────────────────────────
function ContentCard({ item, onApprove, onDiscard, busy, lang }: {
  item: AiContent; onApprove: () => void; onDiscard: () => void; busy: boolean; lang: 'pt' | 'en'
}) {
  const icon = item.format ? (FORMAT_ICON[item.format] ?? '📝') : '📝'
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: '14px' }}>
        {item.image_url && <img src={item.image_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: `1px solid ${BORDER}` }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{icon} {item.idea ?? (lang === 'en' ? 'Content idea' : 'Ideia de conteúdo')}</div>
          {item.caption && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55, marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{item.caption}</div>}
          {item.hashtags && <div style={{ fontSize: '11.5px', color: '#60a5fa', marginBottom: '6px' }}>{item.hashtags}</div>}
          {item.reasoning && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>💡 {item.reasoning}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button onClick={onApprove} disabled={busy} style={btn(ORANGE, '#000')}>{lang === 'en' ? 'Approve' : 'Aprovar'}</button>
        <button onClick={onDiscard} disabled={busy} style={btnGhost()}>{lang === 'en' ? 'Discard' : 'Descartar'}</button>
      </div>
    </div>
  )
}

// ── Linha do histórico de execução ──────────────────────────────────────────
function HistoryRow({ a }: { a: AgentAction }) {
  const ap = APPROVAL_META[a.approval_status], ex = EXECUTION_META[a.execution_status]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
      <span style={{ fontSize: '14px' }}>{CHANNEL_ICON[a.channel ?? 'internal'] ?? '⚙️'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
        <div style={{ fontSize: '9.5px', color: MUTED }}>{a.agent_name ?? a.agent_key} · {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{a.execution_error ? ` · ${a.execution_error.slice(0, 60)}` : ''}</div>
      </div>
      <span style={{ fontSize: '9px', fontWeight: 700, color: ap.color, flexShrink: 0 }}>{ap.label}</span>
      <span style={{ fontSize: '9px', fontWeight: 700, color: ex.color, flexShrink: 0 }}>{ex.label}</span>
    </div>
  )
}

export default function ApprovalsPage() {
  const { user, session } = useAuth()
  const { lang } = useLang()
  const T = d[lang].approvals

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [content, setContent] = useState<AiContent[]>([])
  const [pending, setPending] = useState<AgentAction[]>([])
  const [history, setHistory] = useState<AgentAction[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const token = session?.access_token ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    const { data: company } = await supabase.from('companies').select('id').eq('user_id', user!.id).maybeSingle()
    if (!company) { setLoading(false); return }
    setCompanyId(company.id)
    const { data: c } = await supabase.from('marketing_ai_content')
      .select('id, idea, caption, hashtags, format, image_url, reasoning, status, created_at')
      .eq('company_id', company.id).in('status', ['idea', 'draft']).order('created_at', { ascending: false })
    setContent((c ?? []) as AiContent[])
    if (token) {
      try {
        const [p, h] = await Promise.all([
          listAgentActions(token, company.id, 'pending'),
          listAgentActions(token, company.id, 'history'),
        ])
        setPending(p); setHistory(h.slice(0, 12))
      } catch { /* motor indisponível — a tela ainda mostra o conteúdo */ }
    }
    setLoading(false)
  }, [user, token])

  useEffect(() => { if (user) void load() }, [user, load])

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    if (!companyId) return
    setBusyId(id)
    try { await decideAgentAction(token, companyId, id, decision) } catch { /* ignore */ }
    setPending(prev => prev.filter(a => a.id !== id))
    await load(); setBusyId(null)
  }
  const edit = async (id: string, description: string) => {
    if (!companyId) return
    setBusyId(id)
    try { await editAgentAction(token, companyId, id, { description }) } catch { /* ignore */ }
    setBusyId(null); await load()
  }
  const approveContent = async (id: string) => {
    setBusyId(id)
    await supabase.from('marketing_ai_content').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id)
    setContent(prev => prev.filter(i => i.id !== id)); setBusyId(null)
  }
  const discardContent = async (id: string) => {
    setBusyId(id)
    await supabase.from('marketing_ai_content').delete().eq('id', id)
    setContent(prev => prev.filter(i => i.id !== id)); setBusyId(null)
  }

  const nothing = !loading && pending.length === 0 && content.length === 0

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>
          {lang === 'en'
            ? 'Everything any agent wants to do passes through here. Nothing runs without going through Approvals.'
            : 'Tudo que qualquer agente quer fazer passa por aqui. Nada é executado sem passar pela Central de Approvals.'}
        </p>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: '820px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: MUTED }}>{d[lang].common.loading}</div>
        ) : (
          <>
            {/* Ações universais dos agentes */}
            {pending.length > 0 && (
              <section style={{ marginBottom: '28px' }}>
                <SectionTitle label={lang === 'en' ? 'Actions to approve' : 'Ações pra aprovar'} count={pending.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pending.map(a => (
                    <ActionCard key={a.id} a={a} busy={busyId === a.id} lang={lang}
                      onDecide={d => decide(a.id, d)} onEdit={desc => edit(a.id, desc)} />
                  ))}
                </div>
              </section>
            )}

            {/* Conteúdo (fluxo atual) */}
            {content.length > 0 && (
              <section style={{ marginBottom: '28px' }}>
                <SectionTitle label={lang === 'en' ? 'Content to approve' : 'Conteúdo pra aprovar'} count={content.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {content.map(item => (
                    <ContentCard key={item.id} item={item} busy={busyId === item.id} lang={lang}
                      onApprove={() => approveContent(item.id)} onDiscard={() => discardContent(item.id)} />
                  ))}
                </div>
              </section>
            )}

            {nothing && (
              <div style={{ padding: '18px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '12px', color: MUTED, fontSize: '13px', marginBottom: '28px' }}>
                {lang === 'en' ? 'Nothing waiting for approval right now.' : 'Nada esperando aprovação agora.'}
              </div>
            )}

            {/* Histórico de execução */}
            {history.length > 0 && (
              <section>
                <SectionTitle label={lang === 'en' ? 'Execution history' : 'Histórico de execução'} count={history.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {history.map(a => <HistoryRow key={a.id} a={a} />)}
                </div>
              </section>
            )}

            <div style={{ marginTop: '20px', fontSize: '11.5px', color: MUTED, lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: GREEN }}>✓</span> {lang === 'en' ? 'Approving executes it — nothing runs without you.' : 'Aprovar executa a ação — nada roda sem você.'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{label}</span>
      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', background: 'rgba(255,109,41,0.12)', color: ORANGE }}>{count}</span>
    </div>
  )
}
