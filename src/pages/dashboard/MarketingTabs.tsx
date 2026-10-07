import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const TX = {
  pt: {
    trendsErr: 'Não foi possível gerar as tendências agora. Tente novamente.', trendsTitle: 'Tendências virais para o seu negócio',
    trendsDesc: 'O Agente de Marketing analisa seu perfil e identifica o que está bombando no Instagram e WhatsApp agora — com hooks prontos para usar.',
    trendsGen: 'Gerar tendências agora', trendsLoading: 'Agente de Marketing identificando as tendências do seu segmento...',
    thisWeek: 'Tendências desta semana', refresh: 'Atualizar', hook: 'Hook sugerido', hashtags: 'Hashtags em alta', bestFormat: 'Melhor formato agora', bestTimes: 'Melhores horários',
    autoTrend: '🔥 Tendência identificada pelo agente', approve: 'Aprovar', post: 'post', posts: 'posts',
    approved: 'Aprovado', published: 'Publicado', draft: 'Rascunho',
    createErr: 'Não foi possível criar o plano agora. Tente novamente.', campaigns: 'Campanhas',
    campaignsDesc: 'Toda semana o Agente de Marketing identifica uma tendência do seu segmento sozinho e já deixa os posts em rascunho aqui.',
    cancel: 'Cancelar', newCampaign: '+ Nova campanha', campName: 'Nome da campanha', campNamePh: 'Ex: Semana do Aniversário, Volta às Aulas...',
    goal: 'Objetivo', goalPh: 'Ex: Aumentar vendas, lançar produto, ganhar seguidores...', duration: 'Duração',
    durations: [['7', '1 semana'], ['14', '2 semanas'], ['30', '1 mês']] as [string, string][], creating: 'Criando plano...', createPlan: 'Criar plano de campanha',
    loading: 'Carregando...', none: 'Nenhuma campanha ainda. Toda semana o agente cria uma automaticamente com base nas tendências do seu segmento — ou clique em "Nova campanha" para pedir uma agora.',
  },
  en: {
    trendsErr: 'Could not generate the trends right now. Please try again.', trendsTitle: 'Viral trends for your business',
    trendsDesc: 'The Marketing Agent analyzes your profile and identifies what is booming on Instagram and WhatsApp right now — with ready-to-use hooks.',
    trendsGen: 'Generate trends now', trendsLoading: 'Marketing Agent identifying the trends in your segment...',
    thisWeek: 'This week\'s trends', refresh: 'Refresh', hook: 'Suggested hook', hashtags: 'Trending hashtags', bestFormat: 'Best format right now', bestTimes: 'Best times',
    autoTrend: '🔥 Trend identified by the agent', approve: 'Approve', post: 'post', posts: 'posts',
    approved: 'Approved', published: 'Published', draft: 'Draft',
    createErr: 'Could not create the plan right now. Please try again.', campaigns: 'Campaigns',
    campaignsDesc: 'Every week the Marketing Agent identifies a trend in your segment on its own and leaves the posts as drafts here.',
    cancel: 'Cancel', newCampaign: '+ New campaign', campName: 'Campaign name', campNamePh: 'E.g.: Anniversary Week, Back to School...',
    goal: 'Goal', goalPh: 'E.g.: Increase sales, launch a product, gain followers...', duration: 'Duration',
    durations: [['7', '1 week'], ['14', '2 weeks'], ['30', '1 month']] as [string, string][], creating: 'Creating plan...', createPlan: 'Create campaign plan',
    loading: 'Loading...', none: 'No campaign yet. Every week the agent creates one automatically based on your segment\'s trends — or click "New campaign" to request one now.',
  },
}

// ── Shared helper ──────────────────────────────────────────────

async function callContentIntelligence(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/content-intelligence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// ── Viral Trends ───────────────────────────────────────────────

interface Trend {
  topic: string
  reason: string
  hook: string
  format: string
}

interface TrendsData {
  trends: Trend[]
  hashtags: string[]
  best_format: string
  best_times: string[]
}

export function ViralTrendsTab() {
  const { session } = useAuth()
  const { lang } = useLang()
  const tx = TX[lang]
  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const result = await callContentIntelligence(session.access_token, { type: 'trends' })
      setData(result)
    } catch {
      setError(tx.trendsErr)
    }
    setLoading(false)
  }

  if (!data && !loading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🔥</div>
          <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{tx.trendsTitle}</div>
          <p style={{ color: MUTED, fontSize: '13px', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.7 }}>
            {tx.trendsDesc}
          </p>
          {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <button onClick={generate} style={{ padding: '11px 28px', background: ORANGE, color: '#000', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: D }}>
            {tx.trendsGen}
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div style={{ background: CARD, border: `1px solid rgba(255,109,41,0.15)`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid rgba(255,109,41,0.3)`, borderTopColor: ORANGE, margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: MUTED, fontSize: '13px' }}>{tx.trendsLoading}</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontFamily: D, fontWeight: 700, color: 'white', fontSize: '1rem' }}>{tx.thisWeek}</div>
        <button onClick={generate} disabled={loading} style={{ padding: '7px 14px', background: 'rgba(255,109,41,0.1)', color: ORANGE, border: '1px solid rgba(255,109,41,0.25)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: D }}>
          {tx.refresh}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {data!.trends?.map((t, i) => (
          <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.2)', color: ORANGE, fontSize: '11px', fontWeight: 700 }}>
                {t.format}
              </span>
              <div style={{ fontFamily: D, fontWeight: 700, color: 'white', fontSize: '14px' }}>{t.topic}</div>
            </div>
            <p style={{ color: MUTED, fontSize: '12.5px', marginBottom: '12px', lineHeight: 1.6 }}>{t.reason}</p>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '5px' }}>{tx.hook}</div>
              <div style={{ color: 'white', fontSize: '13px', fontStyle: 'italic' }}>"{t.hook}"</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '12px' }}>{tx.hashtags}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
            {data!.hashtags?.map((h, i) => (
              <span key={i} style={{ padding: '4px 10px', borderRadius: '99px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: MUTED, fontSize: '12px' }}>{h}</span>
            ))}
          </div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '8px' }}>{tx.bestFormat}</div>
          <p style={{ color: 'white', fontSize: '13px', lineHeight: 1.6, marginBottom: '14px' }}>{data!.best_format}</p>
          <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '6px' }}>{tx.bestTimes}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '5px' }}>
            {data!.best_times?.map((t, i) => (
              <span key={i} style={{ padding: '3px 9px', borderRadius: '6px', background: 'rgba(255,109,41,0.08)', color: ORANGE, fontSize: '11px', fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Campanhas ──────────────────────────────────────────────────

interface SavedCampaign {
  id: string
  name: string
  goal: string
  brief: string | null
  source: 'manual' | 'auto_trend'
  created_at: string
  posts: { id: string; content: string; best_time: string | null; platform: string | null; status: 'rascunho' | 'aprovado' | 'publicado' }[]
}

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  rascunho: '#FBBF24', aprovado: '#4ade80', publicado: '#A78BFA',
}

function SavedCampaignCard({ campaign, onApproveAll }: { campaign: SavedCampaign; onApproveAll: (id: string) => void }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const pendingCount = campaign.posts.filter(p => p.status === 'rascunho').length
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 22px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ fontFamily: D, fontWeight: 700, color: 'white', fontSize: '1rem' }}>{campaign.name}</div>
            {campaign.source === 'auto_trend' && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE }}>{tx.autoTrend}</span>
            )}
          </div>
          {campaign.brief && <p style={{ color: MUTED, fontSize: '12.5px', marginTop: '4px', lineHeight: 1.6, maxWidth: '560px' }}>{campaign.brief}</p>}
        </div>
        {pendingCount > 0 && (
          <button onClick={() => onApproveAll(campaign.id)} style={{ padding: '8px 16px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.25)', cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>
            {tx.approve} {pendingCount} {pendingCount === 1 ? tx.post : tx.posts}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
        {campaign.posts.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px', flexShrink: 0, background: `${CAMPAIGN_STATUS_COLORS[p.status ?? 'rascunho']}22`, color: CAMPAIGN_STATUS_COLORS[p.status ?? 'rascunho'] }}>
              {p.status === 'aprovado' ? tx.approved : p.status === 'publicado' ? tx.published : tx.draft}
            </span>
            <div style={{ flex: 1, minWidth: 0, fontSize: '12.5px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.content}</div>
            {p.best_time && <div style={{ fontSize: '11px', color: MUTED, flexShrink: 0 }}>{p.best_time}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampanhasTab() {
  const { session } = useAuth()
  const { lang } = useLang()
  const tx = TX[lang]
  const [saved, setSaved] = useState<SavedCampaign[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [duration, setDuration] = useState('7')

  const loadCampaigns = async () => {
    const { data } = await supabase
      .from('campaigns')
      .select('id, name, goal, brief, source, created_at, posts(id, content, best_time, platform, status)')
      .order('created_at', { ascending: false })
      .limit(10)
    setSaved((data ?? []) as unknown as SavedCampaign[])
    setLoadingList(false)
  }

  useEffect(() => { loadCampaigns() }, [])

  const approveAll = async (campaignId: string) => {
    await supabase.from('posts').update({ status: 'aprovado' }).eq('campaign_id', campaignId).eq('status', 'rascunho')
    await loadCampaigns()
  }

  const create = async () => {
    if (!session || !name.trim() || !goal.trim()) return
    setLoading(true)
    setError('')
    try {
      await callContentIntelligence(session.access_token, {
        type: 'campaign',
        name: name.trim(),
        goal: goal.trim(),
        duration_days: Number(duration),
        channels: ['Instagram', 'WhatsApp'],
      })
      setName(''); setGoal(''); setDuration('7'); setShowForm(false)
      await loadCampaigns()
    } catch {
      setError(tx.createErr)
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontFamily: D, fontWeight: 700, color: 'white', fontSize: '1rem' }}>{tx.campaigns}</div>
          <p style={{ color: MUTED, fontSize: '12.5px', marginTop: '2px' }}>
            {tx.campaignsDesc}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '9px 16px', background: showForm ? 'transparent' : ORANGE, color: showForm ? MUTED : '#000', border: `1px solid ${showForm ? BORDER : 'transparent'}`, borderRadius: '10px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>
          {showForm ? tx.cancel : tx.newCampaign}
        </button>
      </div>

      {showForm && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '24px', marginBottom: '24px', maxWidth: '560px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>{tx.campName}</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tx.campNamePh}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '10px 14px', color: 'white', fontSize: '13px', fontFamily: D, boxSizing: 'border-box' as const, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>{tx.goal}</label>
              <input
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder={tx.goalPh}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '10px 14px', color: 'white', fontSize: '13px', fontFamily: D, boxSizing: 'border-box' as const, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: '8px' }}>{tx.duration}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {tx.durations.map(([val, label]) => (
                  <button key={val} onClick={() => setDuration(val)}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${duration === val ? ORANGE : BORDER}`, background: duration === val ? 'rgba(255,109,41,0.1)' : 'transparent', color: duration === val ? ORANGE : MUTED, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: D }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p style={{ marginTop: '12px', fontSize: '12px', color: '#f87171' }}>{error}</p>}

          <button
            onClick={create}
            disabled={loading || !name.trim() || !goal.trim()}
            style={{ marginTop: '20px', width: '100%', padding: '12px', background: name.trim() && goal.trim() ? ORANGE : 'rgba(255,109,41,0.3)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: name.trim() && goal.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: D, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading
              ? <><div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', animation: 'spin 0.8s linear infinite' }} /> {tx.creating}</>
              : tx.createPlan}
          </button>
        </div>
      )}

      {loadingList ? (
        <div style={{ textAlign: 'center', padding: '40px', color: MUTED, fontSize: '13px' }}>{tx.loading}</div>
      ) : !saved || saved.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📣</div>
          <div style={{ color: MUTED, fontSize: '13px', maxWidth: '380px', margin: '0 auto' }}>
            {tx.none}
          </div>
        </div>
      ) : (
        saved.map(c => <SavedCampaignCard key={c.id} campaign={c} onApproveAll={approveAll} />)
      )}
    </div>
  )
}
