import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import CompanyAiControl from './CompanyAiControl'
import CompanyAiUsage from './CompanyAiUsage'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface BusinessDna {
  mission?: string
  brand_voice?: string
  target_audience?: string
  differentiators?: string
  values?: string[]
}

interface CompanyDetail {
  id: string
  business_name: string
  business_type: string | null
  city: string | null
  goal: string | null
  plan: string | null
  instagram_url: string | null
  website_url: string | null
  google_rating: number | null
  google_review_count: number | null
  telegram_chat_id: string | null
  business_dna: BusinessDna | null
  agent_enabled: boolean
  marketing_ai_enabled: boolean
  created_at: string
  trial_started_at: string | null
  trial_expires_at: string | null
  trial_cancelled_at: string | null
  subscription_status: string | null
  current_period_start: string | null
  current_period_end: string | null
  subscription_cancelled_at: string | null
  manual_access: boolean
  manual_access_granted_at: string | null
  manual_access_granted_by: string | null
  manual_access_reason: string | null
  access_blocked_at: string | null
  access_blocked_by: string | null
  access_blocked_reason: string | null
}

type AccessSource = 'paid' | 'trial' | 'manual' | 'blocked' | 'none'
type AccessStatusLabel = 'Active' | 'Trial' | 'Expired' | 'Suspended' | 'Cancelled'
interface AccessStatus { granted: boolean; source: AccessSource; status_label: AccessStatusLabel }
interface AccessLogEntry { id: string; event: string; actor: string; actor_email: string | null; detail: string | null; created_at: string }

const ACCESS_STATUS_META: Record<AccessStatusLabel, { color: string; dot: string }> = {
  Active: { color: '#4ade80', dot: '🟢' },
  Trial: { color: '#60a5fa', dot: '🔵' },
  Expired: { color: '#f87171', dot: '🔴' },
  Suspended: { color: '#f87171', dot: '🔴' },
  Cancelled: { color: '#BABABA', dot: '⚪' },
}
const ACCESS_SOURCE_LABEL: Record<AccessSource, string> = { paid: 'Paid', trial: 'Trial', manual: 'Manually Granted', blocked: 'Blocked', none: 'None' }
const AUDIT_EVENT_LABEL: Record<string, string> = {
  access_granted: 'Owner manually granted access',
  access_blocked: 'Owner manually blocked access',
  payment_confirmed: 'Payment confirmed — access restored automatically',
  subscription_updated: 'Subscription status updated',
  subscription_cancelled: 'Subscription cancelled',
}

interface MarketingAiConfig {
  agent_name: string | null
  posting_frequency: string | null
  preferred_content_types: string[] | null
  content_pillars: string[] | null
  marketing_goals: string | null
  competitors: string[] | null
}

const CONTENT_TYPE_OPTIONS = ['reel', 'carrossel', 'foto', 'story']

interface AgentMessage { id: string; role: string; content: string; agent_role: string | null; created_at: string }
interface ClientActivity { id: string; event: string; label: string | null; meta: Record<string, unknown> | null; created_at: string }
interface TelegramConv {
  id: string; bot_type: string; telegram_chat_id: string; status: string; created_at: string
  messages: { id: string; role: string; content: string; created_at: string }[]
}

const AGENT_EMOJI: Record<string, string> = { ceo: '🗂️', researcher: '🔍', cmo: '📣', sales: '💼', analyst: '📊', cs: '⭐' }

// Diário do cliente: ícone + rótulo amigável por tipo de evento. Eventos novos
// caem no fallback (ponto + a própria chave), então nada some se faltar aqui.
const EVENT_META: Record<string, { icon: string; label: string }> = {
  content_generated: { icon: '🎨', label: 'Gerou conteúdo' },
  post_approved: { icon: '✅', label: 'Aprovou um post' },
  post_rejected: { icon: '🗑️', label: 'Descartou um post' },
  agent_message_sent: { icon: '💬', label: 'Falou com o agente' },
  channel_connected: { icon: '🔗', label: 'Conectou um canal' },
}
const eventMeta = (e: string) => EVENT_META[e] ?? { icon: '•', label: e.replace(/_/g, ' ') }

const inputStyle = { width: '100%', padding: '9px 12px', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [telegram, setTelegram] = useState<TelegramConv[]>([])
  const [activity, setActivity] = useState<ClientActivity[]>([])
  const [activityTab, setActivityTab] = useState<'cliente' | 'telegram' | 'agent'>('cliente')

  const [form, setForm] = useState({ business_name: '', business_type: '', city: '', goal: '', plan: '' })
  const [dna, setDna] = useState<BusinessDna>({})
  const [marketingAiEnabled, setMarketingAiEnabled] = useState(true)
  const [togglingFeature, setTogglingFeature] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Marketing AI — configurado aqui, junto do Business DNA, porque voz e
  // público vêm de lá (fonte única, não repetida no form abaixo).
  const [maExists, setMaExists] = useState(false)
  const [maAgentName, setMaAgentName] = useState('Agente de Marketing')
  const [maPostingFrequency, setMaPostingFrequency] = useState('3x por semana')
  const [maContentTypes, setMaContentTypes] = useState<string[]>(['reel', 'carrossel', 'foto'])
  const [maContentPillars, setMaContentPillars] = useState<string[]>([])
  const [maNewPillar, setMaNewPillar] = useState('')
  const [maMarketingGoals, setMaMarketingGoals] = useState('')
  const [maCompetitors, setMaCompetitors] = useState<string[]>([])
  const [maNewCompetitor, setMaNewCompetitor] = useState('')
  const [maSaving, setMaSaving] = useState(false)
  const [maSaved, setMaSaved] = useState(false)

  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [access, setAccess] = useState<AccessStatus | null>(null)
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([])
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessReason, setAccessReason] = useState('')
  const [showAccessReason, setShowAccessReason] = useState(false)

  useEffect(() => {
    if (!session || !id) return
    void load()
  }, [session, id])

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/owner-company-activity`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: id, limit: 30 }),
      })
      const data = await res.json() as { company?: CompanyDetail; messages?: AgentMessage[]; telegram?: TelegramConv[]; marketing_ai?: MarketingAiConfig | null; activity?: ClientActivity[]; access?: AccessStatus | null; access_log?: AccessLogEntry[]; error?: string }
      if (!res.ok || !data.company) {
        setLoadError(data.error ?? `Erro ao carregar (${res.status}).`)
      } else {
        setDetail(data.company)
        setMessages(data.messages ?? [])
        setTelegram(data.telegram ?? [])
        setActivity(data.activity ?? [])
        setAccess(data.access ?? null)
        setAccessLog(data.access_log ?? [])
        setForm({
          business_name: data.company.business_name ?? '',
          business_type: data.company.business_type ?? '',
          city: data.company.city ?? '',
          goal: data.company.goal ?? '',
          plan: data.company.plan ?? '',
        })
        setDna(data.company.business_dna ?? {})
        setMarketingAiEnabled(data.company.marketing_ai_enabled ?? true)

        const ma = data.marketing_ai
        setMaExists(!!ma)
        setMaAgentName(ma?.agent_name ?? 'Agente de Marketing')
        setMaPostingFrequency(ma?.posting_frequency ?? '3x por semana')
        setMaContentTypes(ma?.preferred_content_types ?? ['reel', 'carrossel', 'foto'])
        setMaContentPillars(ma?.content_pillars ?? [])
        setMaMarketingGoals(ma?.marketing_goals ?? '')
        setMaCompetitors(ma?.competitors ?? [])
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erro de rede inesperado.')
    }
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    await fetch(`${SUPABASE_URL}/functions/v1/owner-company-activity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id, action: 'update', updates: { ...form, business_dna: dna } }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setAccessState = async (kind: 'grant_access' | 'block_access') => {
    setAccessBusy(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/owner-company-activity`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: id, action: kind, reason: accessReason.trim() || undefined }),
      })
      const data = await res.json() as { access?: AccessStatus; error?: string }
      if (res.ok && data.access) setAccess(data.access)
      setAccessReason('')
      setShowAccessReason(false)
      await load()
    } catch { /* fica no estado anterior; o load acima ainda tenta atualizar */ }
    setAccessBusy(false)
  }

  const toggleFeature = async (feature: 'marketing_ai_enabled', value: boolean) => {
    setTogglingFeature(true)
    setMarketingAiEnabled(value)
    await fetch(`${SUPABASE_URL}/functions/v1/owner-company-activity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id, action: 'update', updates: { [feature]: value } }),
    })
    setTogglingFeature(false)
  }

  const addValue = () => {
    if (!newValue.trim()) return
    setDna(prev => ({ ...prev, values: [...(prev.values ?? []), newValue.trim()] }))
    setNewValue('')
  }
  const removeValue = (i: number) => setDna(prev => ({ ...prev, values: (prev.values ?? []).filter((_, idx) => idx !== i) }))

  const maToggleType = (t: string) => setMaContentTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const maAddPillar = () => { if (maNewPillar.trim()) { setMaContentPillars(prev => [...prev, maNewPillar.trim()]); setMaNewPillar('') } }
  const maRemovePillar = (i: number) => setMaContentPillars(prev => prev.filter((_, idx) => idx !== i))
  const maAddCompetitor = () => { if (maNewCompetitor.trim()) { setMaCompetitors(prev => [...prev, maNewCompetitor.trim()]); setMaNewCompetitor('') } }
  const maRemoveCompetitor = (i: number) => setMaCompetitors(prev => prev.filter((_, idx) => idx !== i))

  const saveMarketingAi = async () => {
    setMaSaving(true)
    setMaSaved(false)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/owner-company-activity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: id, action: 'update_marketing_ai',
        marketing_ai: {
          agent_name: maAgentName.trim() || 'Agente de Marketing',
          posting_frequency: maPostingFrequency,
          preferred_content_types: maContentTypes,
          content_pillars: maContentPillars,
          marketing_goals: maMarketingGoals || null,
          competitors: maCompetitors,
        },
      }),
    })
    setMaSaving(false)
    if (res.ok) { setMaExists(true); setMaSaved(true); setTimeout(() => setMaSaved(false), 2000) }
  }

  const deleteCompany = async () => {
    if (!id || !detail) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/owner-delete-company`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: id, confirm_name: deleteConfirmText }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao deletar')
      navigate('/owner')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e))
    }
    setDeleting(false)
  }

  const goBack = () => navigate('/owner')

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: MUTED, fontSize: '14px' }}>Carregando...</div>
      </div>
    )
  }

  if (loadError || !detail) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '24px', textAlign: 'center' }}>
        <div style={{ color: '#f87171', fontSize: '14px' }}>{loadError || 'Empresa não encontrada.'}</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={load} style={{ padding: '9px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer' }}>
            Tentar de novo
          </button>
          <button onClick={goBack} style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '13px', cursor: 'pointer' }}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={goBack} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer', padding: '4px' }}>← Voltar</button>
          <div style={{ width: '1px', height: '20px', background: BORDER }} />
          <span style={{ fontFamily: D, fontSize: '1rem', fontWeight: 800, color: 'white' }}>{detail.business_name}</span>
        </div>
        <button onClick={() => setShowDelete(true)} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>
          🗑️ Deletar empresa
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Access & Subscription — fonte central de verdade do acesso do cliente. */}
        <div style={{ background: CARD, border: `1px solid ${access?.source === 'blocked' ? 'rgba(248,113,113,0.35)' : BORDER}`, borderRadius: '14px', padding: '22px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>🔐 Access &amp; Subscription</div>
            {access && (
              <span style={{ fontSize: '12px', fontWeight: 800, color: ACCESS_STATUS_META[access.status_label].color }}>
                {ACCESS_STATUS_META[access.status_label].dot} {access.status_label}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            {[
              ['Access type', access ? ACCESS_SOURCE_LABEL[access.source] : '—'],
              ['Trial started', detail.trial_started_at ? new Date(detail.trial_started_at).toLocaleDateString('pt-BR') : '—'],
              ['Trial expires', detail.trial_expires_at ? new Date(detail.trial_expires_at).toLocaleDateString('pt-BR') : '—'],
              ['Subscription', detail.subscription_status ?? 'No active subscription'],
              ['Renews', detail.current_period_end ? new Date(detail.current_period_end).toLocaleDateString('pt-BR') : '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '12.5px', color: 'white', fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>

          {access?.source === 'manual' && (
            <div style={{ padding: '10px 13px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '9px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '14px' }}>
              🟡 <strong>Manual access.</strong> Sem assinatura ativa — liberado por {detail.manual_access_granted_by ?? 'um owner'}{detail.manual_access_granted_at ? ` em ${new Date(detail.manual_access_granted_at).toLocaleDateString('pt-BR')}` : ''}.{detail.manual_access_reason ? ` Motivo: "${detail.manual_access_reason}"` : ''}
            </div>
          )}
          {access?.source === 'blocked' && (
            <div style={{ padding: '10px 13px', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '9px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '14px' }}>
              🔴 <strong>Bloqueado manualmente</strong> por {detail.access_blocked_by ?? 'um owner'}{detail.access_blocked_at ? ` em ${new Date(detail.access_blocked_at).toLocaleDateString('pt-BR')}` : ''}.{detail.access_blocked_reason ? ` Motivo: "${detail.access_blocked_reason}"` : ''}
            </div>
          )}

          {showAccessReason && (
            <input value={accessReason} onChange={e => setAccessReason(e.target.value)} placeholder="Motivo (opcional)" style={{ ...inputStyle, marginBottom: '10px' }} />
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {access?.granted ? (
              <button onClick={() => setAccessState('block_access')} disabled={accessBusy}
                style={{ padding: '10px 20px', background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: '9px', color: '#f87171', fontWeight: 700, fontSize: '13px', cursor: accessBusy ? 'default' : 'pointer' }}>
                {accessBusy ? '...' : '🔒 Bloquear acesso'}
              </button>
            ) : (
              <button onClick={() => setAccessState('grant_access')} disabled={accessBusy}
                style={{ padding: '10px 20px', background: ORANGE, border: 'none', borderRadius: '9px', color: '#000', fontWeight: 700, fontSize: '13px', cursor: accessBusy ? 'default' : 'pointer' }}>
                {accessBusy ? '...' : '🔓 Liberar acesso'}
              </button>
            )}
            <button onClick={() => setShowAccessReason(s => !s)} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
              {showAccessReason ? 'Cancelar motivo' : '+ motivo'}
            </button>
          </div>

          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '9px' }}>Histórico de acesso</div>
            {accessLog.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: MUTED }}>Nenhum evento registrado ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {accessLog.map(e => (
                  <div key={e.id} style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5 }}>
                    <span style={{ color: 'white' }}>{new Date(e.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {' — '}{AUDIT_EVENT_LABEL[e.event] ?? e.event}
                    {e.actor_email ? ` (${e.actor_email})` : ''}
                    {e.detail ? `: ${e.detail}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>Dados da conta</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'business_name', label: 'Nome' },
                { key: 'business_type', label: 'Tipo' },
                { key: 'city', label: 'Cidade' },
                { key: 'goal', label: 'Objetivo' },
                { key: 'plan', label: 'Plano' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                  <input value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                ['Instagram', detail.instagram_url],
                ['Site', detail.website_url],
                ['Telegram', detail.telegram_chat_id ? `ID: ${detail.telegram_chat_id}` : null],
                ['Google', detail.google_rating ? `${detail.google_rating}★ (${detail.google_review_count ?? 0} avaliações)` : null],
                ['Cadastro', new Date(detail.created_at).toLocaleDateString('pt-BR')],
              ].map(([label, val]) => val ? (
                <div key={label as string} style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: MUTED, width: '80px', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: 'white', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>
                </div>
              ) : null)}
            </div>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>🧬 Business DNA</div>
            <div style={{ fontSize: '11px', color: MUTED, marginBottom: '10px', lineHeight: 1.5 }}>Quem esse negócio é de verdade — missão, voz, público e diferenciais. Base pra qualquer módulo que precisar entender a marca.</div>
            <div style={{ fontSize: '10.5px', color: '#FBBF24', marginBottom: '16px', lineHeight: 1.5, padding: '8px 11px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px' }}>
              ⏳ Em breve isto vira o <strong>Core da empresa</strong>, preenchido sozinho a partir do Meta (Feedback Loop). Por enquanto, preenchimento manual.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Missão</label>
                <textarea value={dna.mission ?? ''} onChange={e => setDna(d => ({ ...d, mission: e.target.value }))} rows={2}
                  placeholder="Por que esse negócio existe, além de vender." style={{ ...inputStyle, resize: 'vertical', fontFamily: D }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Voz da marca</label>
                <input value={dna.brand_voice ?? ''} onChange={e => setDna(d => ({ ...d, brand_voice: e.target.value }))}
                  placeholder="Ex: acolhedora, direta, bem-humorada" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Público-alvo</label>
                <input value={dna.target_audience ?? ''} onChange={e => setDna(d => ({ ...d, target_audience: e.target.value }))}
                  placeholder="Ex: famílias de classe média na zona sul" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Diferenciais</label>
                <textarea value={dna.differentiators ?? ''} onChange={e => setDna(d => ({ ...d, differentiators: e.target.value }))} rows={2}
                  placeholder="O que faz esse negócio diferente da concorrência." style={{ ...inputStyle, resize: 'vertical', fontFamily: D }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valores</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
                  {(dna.values ?? []).map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '7px' }}>
                      <span style={{ flex: 1, fontSize: '12px', color: 'white' }}>{v}</span>
                      <button onClick={() => removeValue(i)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '13px' }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Ex: transparência, agilidade..."
                    onKeyDown={e => { if (e.key === 'Enter') addValue() }} style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={addValue} style={{ padding: '0 14px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '7px', border: 'none', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>✨ Marketing AI</div>
          <div style={{ fontSize: '11px', color: MUTED, marginBottom: '16px', lineHeight: 1.5 }}>
            {maExists ? 'Já ativado pra essa empresa.' : 'Ainda não ativado — preencha e salve pra ligar as quatro inteligências (tracking, conteúdo, concorrentes, brain).'}
          </div>

          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Herdado do Business DNA</div>
            {dna.brand_voice || dna.target_audience ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '12.5px' }}>
                  <span style={{ color: MUTED }}>Voz da marca: </span>
                  <span style={{ color: 'white' }}>{dna.brand_voice || 'não definida'}</span>
                </div>
                <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '12.5px' }}>
                  <span style={{ color: MUTED }}>Público-alvo: </span>
                  <span style={{ color: 'white' }}>{dna.target_audience || 'não definido'}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 12px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '9px', fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                Preencha voz da marca e público-alvo no Business DNA acima primeiro.
              </div>
            )}
          </div>

          <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome do agente</label>
          <input value={maAgentName} onChange={e => setMaAgentName(e.target.value)} placeholder="Agente de Marketing" style={{ ...inputStyle, marginBottom: '14px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frequência de postagem</label>
              <input value={maPostingFrequency} onChange={e => setMaPostingFrequency(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Formatos preferidos</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {CONTENT_TYPE_OPTIONS.map(t => (
                  <button key={t} onClick={() => maToggleType(t)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${maContentTypes.includes(t) ? 'rgba(255,109,41,0.4)' : BORDER}`, background: maContentTypes.includes(t) ? 'rgba(255,109,41,0.1)' : 'transparent', color: maContentTypes.includes(t) ? ORANGE : MUTED, fontSize: '11.5px', cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pilares de conteúdo</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {maContentPillars.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ flex: 1, fontSize: '12.5px', color: 'white' }}>{p}</span>
                <button onClick={() => maRemovePillar(i)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input value={maNewPillar} onChange={e => setMaNewPillar(e.target.value)} placeholder="Ex: bastidores, promoções, depoimentos..."
              onKeyDown={e => { if (e.key === 'Enter') maAddPillar() }} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={maAddPillar} style={{ padding: '0 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>+ Adicionar</button>
          </div>

          <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Metas de marketing</label>
          <textarea value={maMarketingGoals} onChange={e => setMaMarketingGoals(e.target.value)} rows={2}
            placeholder="Ex: dobrar o engajamento no Instagram em 3 meses."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: D, marginBottom: '16px' }} />

          <label style={{ display: 'block', fontSize: '10.5px', color: MUTED, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concorrentes monitorados</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {maCompetitors.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ flex: 1, fontSize: '12.5px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
                <button onClick={() => maRemoveCompetitor(i)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            <input value={maNewCompetitor} onChange={e => setMaNewCompetitor(e.target.value)} placeholder="https://instagram.com/concorrente"
              onKeyDown={e => { if (e.key === 'Enter') maAddCompetitor() }} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={maAddCompetitor} style={{ padding: '0 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>+ Adicionar</button>
          </div>

          <button onClick={saveMarketingAi} disabled={maSaving}
            style={{ padding: '10px 22px', background: maSaved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer' }}>
            {maSaved ? '✓ Salvo' : maSaving ? 'Salvando...' : maExists ? 'Salvar Marketing AI' : 'Ativar Marketing AI'}
          </button>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Menu do cliente</div>
          <div style={{ fontSize: '11px', color: MUTED, marginBottom: '16px', lineHeight: 1.5 }}>
            Liga/desliga na hora — o que estiver desligado some do menu do dashboard dessa empresa (a página continua existindo, só não aparece no menu).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '9px', border: `1px solid ${marketingAiEnabled ? 'rgba(255,109,41,0.3)' : BORDER}`, background: marketingAiEnabled ? 'rgba(255,109,41,0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
              <input type="checkbox" checked={marketingAiEnabled} disabled={togglingFeature} onChange={e => toggleFeature('marketing_ai_enabled', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: ORANGE }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>✨ Marketing AI <span style={{ fontSize: '9.5px', fontWeight: 700, color: ORANGE, border: '1px solid rgba(255,109,41,0.4)', borderRadius: '99px', padding: '1px 7px', marginLeft: '4px' }}>PRINCIPAL</span></div>
                <div style={{ fontSize: '10.5px', color: MUTED }}>O agente principal (Growth OS). Desligado, o cliente cai em Atividades.</div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={save} disabled={saving}
            style={{ padding: '10px 22px', background: saved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer' }}>
            {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>

        <CompanyAiUsage companyId={detail.id} plan={detail.plan ?? 'free'} />

        <CompanyAiControl companyId={detail.id} plan={detail.plan ?? 'free'} />

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {([['cliente', '👤 Cliente'], ['telegram', '📱 Telegram'], ['agent', '🤖 Agente IA']] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActivityTab(tab)}
                style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '7px', border: `1px solid ${activityTab === tab ? 'rgba(255,109,41,0.4)' : BORDER}`, background: activityTab === tab ? 'rgba(255,109,41,0.1)' : 'transparent', color: activityTab === tab ? ORANGE : MUTED, cursor: 'pointer', fontWeight: activityTab === tab ? 700 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {activityTab === 'cliente' ? (
            activity.length === 0 ? (
              <div style={{ fontSize: '13px', color: MUTED }}>Nenhuma ação registrada ainda. Assim que o cliente usar o app (gerar conteúdo, aprovar post, falar com o agente), aparece aqui.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                {activity.map(a => {
                  const m = eventMeta(a.event)
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 14px', borderRadius: '9px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: '15px', flexShrink: 0 }}>{m.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{a.label || m.label}</div>
                        {a.label && a.label !== m.label && <div style={{ fontSize: '10.5px', color: MUTED }}>{m.label}</div>}
                      </div>
                      <span style={{ fontSize: '11px', color: MUTED, flexShrink: 0 }}>{new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )
                })}
              </div>
            )
          ) : activityTab === 'telegram' ? (
            telegram.length === 0 ? (
              <div style={{ fontSize: '13px', color: MUTED }}>Telegram não conectado ainda.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {telegram.map(conv => (
                  <div key={conv.id}>
                    <div style={{ fontSize: '11px', color: ORANGE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                      {conv.bot_type === 'marketing' ? '📣 Bot de Marketing' : '💼 Bot de Vendas'} · ID {conv.telegram_chat_id}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                      {conv.messages.map(msg => (
                        <div key={msg.id} style={{ padding: '10px 12px', borderRadius: '8px', background: msg.role === 'user' ? 'rgba(255,255,255,0.03)' : 'rgba(255,109,41,0.04)', border: `1px solid ${msg.role === 'user' ? BORDER : 'rgba(255,109,41,0.1)'}` }}>
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10.5px', color: msg.role === 'user' ? MUTED : ORANGE, fontWeight: 600 }}>{msg.role === 'user' ? '👤 Cliente' : '🤖 Bot'}</span>
                            <span style={{ fontSize: '10.5px', color: MUTED, marginLeft: 'auto' }}>{new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, wordBreak: 'break-word' }}>{msg.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            messages.length === 0 ? (
              <div style={{ fontSize: '13px', color: MUTED }}>Sem atividade ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ padding: '12px 14px', borderRadius: '9px', background: msg.role === 'user' ? 'rgba(255,255,255,0.03)' : 'rgba(255,109,41,0.04)', border: `1px solid ${msg.role === 'user' ? BORDER : 'rgba(255,109,41,0.1)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px' }}>{msg.role === 'user' ? '👤' : (AGENT_EMOJI[msg.agent_role ?? ''] ?? '🤖')}</span>
                      <span style={{ fontSize: '11px', color: msg.role === 'user' ? MUTED : ORANGE, fontWeight: 600 }}>{msg.role === 'user' ? 'Cliente' : (msg.agent_role ?? 'Bot')}</span>
                      <span style={{ fontSize: '11px', color: MUTED, marginLeft: 'auto' }}>{new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, wordBreak: 'break-word' }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: CARD, border: '1px solid rgba(248,113,113,0.3)', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '10px' }}>⚠️ Deletar empresa</div>
            <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.7, marginBottom: '16px' }}>
              Isso apaga <strong style={{ color: 'white' }}>{detail.business_name}</strong> e tudo relacionado (posts, avaliações, oportunidades, campanhas, leads, conversas) — pra sempre, sem volta. Pra confirmar, digite o nome exato do negócio abaixo.
            </p>
            <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder={detail.business_name} autoFocus
              style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '14px', outline: 'none', marginBottom: '14px' }} />
            {deleteError && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '14px' }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowDelete(false); setDeleteConfirmText(''); setDeleteError('') }}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={deleteCompany} disabled={deleting || deleteConfirmText.trim().toLowerCase() !== detail.business_name.trim().toLowerCase()}
                style={{
                  padding: '9px 18px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: 700,
                  background: deleteConfirmText.trim().toLowerCase() === detail.business_name.trim().toLowerCase() ? '#f87171' : 'rgba(248,113,113,0.25)',
                  color: deleteConfirmText.trim().toLowerCase() === detail.business_name.trim().toLowerCase() ? '#000' : 'rgba(255,255,255,0.4)',
                  cursor: deleting || deleteConfirmText.trim().toLowerCase() !== detail.business_name.trim().toLowerCase() ? 'not-allowed' : 'pointer',
                }}>
                {deleting ? 'Deletando...' : 'Deletar pra sempre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
