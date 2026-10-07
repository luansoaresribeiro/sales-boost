import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PostCard, type Post, type PostStatus } from './PostsPage'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const TX = {
  pt: {
    quota: (n: number) => `Você atingiu o limite de ${n} posts do plano este mês. Aguarde o próximo mês ou faça upgrade.`,
    genFail: 'Erro ao gerar posts', noGen: 'Não foi possível gerar posts agora.',
    unavailable: 'Agente de Marketing temporariamente indisponível. Tente novamente em alguns instantes.',
    busy: 'Agente de Marketing muito ocupado agora. Tente novamente em alguns minutos.',
    failed: 'Agente de Marketing não conseguiu gerar posts agora. Tente novamente em instantes.',
    seePlans: 'Ver planos →',
  },
  en: {
    quota: (n: number) => `You've reached your plan's limit of ${n} posts this month. Wait for next month or upgrade.`,
    genFail: 'Error generating posts', noGen: "Couldn't generate posts right now.",
    unavailable: 'Marketing Agent is temporarily unavailable. Please try again in a moment.',
    busy: 'Marketing Agent is too busy right now. Please try again in a few minutes.',
    failed: "Marketing Agent couldn't generate posts right now. Please try again shortly.",
    seePlans: 'See plans →',
  },
} as const

const PLAN_LIMITS: Record<string, number> = { free: 5, basic: 15, pro: 35, ultra: 50 }

function AgentStatusBar({ generating, lastGeneratedAt, onRequestMore, monthlyCount, monthlyLimit, plan, T, loc }: {
  generating: boolean; lastGeneratedAt: string | null; onRequestMore: () => void
  monthlyCount: number; monthlyLimit: number; plan: string; T: typeof d['pt']['posts']; loc: string
}) {
  const [dot, setDot] = useState(0)
  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => setDot(v => (v + 1) % 4), 400)
    return () => clearInterval(t)
  }, [generating])

  const atLimit = monthlyCount >= monthlyLimit
  const quotaPercent = monthlyLimit > 0 ? Math.min(100, (monthlyCount / monthlyLimit) * 100) : 0
  const quotaColor = quotaPercent >= 100 ? '#f87171' : quotaPercent >= 80 ? '#FBBF24' : '#4ade80'
  const monthName = new Date().toLocaleDateString(loc, { month: 'long' })

  return (
    <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '24px', background: generating ? 'rgba(255,109,41,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${generating ? 'rgba(255,109,41,0.2)' : BORDER}`, transition: 'all 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: generating ? ORANGE : '#4ade80', boxShadow: generating ? `0 0 6px ${ORANGE}` : '0 0 6px #4ade80', animation: generating ? 'pulse 1s infinite' : 'none' }} />
          <span style={{ fontSize: '12px', color: generating ? ORANGE : MUTED, fontWeight: generating ? 600 : 400 }}>
            {generating
              ? `${T.agentCreating}${'.'.repeat(dot)}`
              : lastGeneratedAt
                ? `${T.agentLast} ${new Date(lastGeneratedAt).toLocaleDateString(loc, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : T.agentActive}
          </span>
        </div>
        {!generating && !atLimit && (
          <button onClick={onRequestMore} style={{ fontSize: '11px', fontWeight: 600, color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
            {T.requestMore}
          </button>
        )}
        {!generating && atLimit && plan !== 'ultra' && (
          <Link to="/dashboard/settings" style={{ fontSize: '11px', fontWeight: 600, color: ORANGE, background: 'rgba(255,109,41,0.08)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '6px', padding: '4px 10px', textDecoration: 'none' }}>
            {T.upgrade}
          </Link>
        )}
      </div>
      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: `${quotaPercent}%`, height: '100%', borderRadius: '99px', background: quotaColor, transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontSize: '11px', color: atLimit ? '#f87171' : MUTED, flexShrink: 0, fontWeight: atLimit ? 600 : 400 }}>
          {monthlyCount}/{monthlyLimit} {T.postsIn} {monthName}
        </span>
      </div>
    </div>
  )
}

export default function AgentPostsTab() {
  const { user, session } = useAuth()
  const { lang } = useLang()
  const T = d[lang].posts
  const X = TX[lang]
  const [genLimit, setGenLimit] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [filterStatus, setFilterStatus] = useState<PostStatus | 'todos'>('todos')
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null)
  const [plan, setPlan] = useState('free')
  const [monthlyCount, setMonthlyCount] = useState(0)
  const [monthlyLimit, setMonthlyLimit] = useState(5)
  const autoGenTriggered = useRef(false)

  const loadPostsOnly = async () => {
    if (!user) return
    const { data: company } = await supabase.from('companies').select('id, plan').eq('user_id', user.id).maybeSingle()
    if (!company) return

    const startOfMonth = new Date()
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const { count } = await supabase.from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .gte('created_at', startOfMonth.toISOString())

    const planKey = company.plan ?? 'free'
    const limit = PLAN_LIMITS[planKey] ?? 5
    const monthly = count ?? 0
    setPlan(planKey); setMonthlyCount(monthly); setMonthlyLimit(limit)

    const { data } = await supabase
      .from('posts')
      .select('id, content, image_suggestion, image_url, best_time, status, platform, created_at, agent_notes')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
    const fetched = (data ?? []) as Post[]
    setPosts(fetched)
    setLastGeneratedAt(fetched[0]?.created_at ?? null)
    return { posts: fetched, planKey, limit, monthly }
  }

  const triggerGenerate = async (token: string) => {
    setGenerating(true)
    setGenError(''); setGenLimit(false)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.quota_reached) {
        setGenError(X.quota(data.limit)); setGenLimit(true)
        setGenerating(false)
        return
      }
      if (!res.ok) throw new Error(data.error ?? X.genFail)
      if (!data.generated) throw new Error(data.message ?? X.noGen)
      await loadPostsOnly()
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e).toLowerCase()
      if (msg.includes('credit') || msg.includes('balance')) {
        setGenError(X.unavailable)
      } else if (msg.includes('rate') || msg.includes('429') || msg.includes('overload')) {
        setGenError(X.busy)
      } else {
        setGenError(X.failed)
      }
    }
    setGenerating(false)
  }

  useEffect(() => {
    if (!user || !session) return
    const init = async () => {
      setLoading(true)
      const result = await loadPostsOnly()
      setLoading(false)
      if (!result) return
      const { posts: fetched, limit, monthly } = result
      const hasDrafts = fetched.some(p => p.status === 'rascunho')
      const quotaRemaining = limit - monthly
      if (!hasDrafts && !autoGenTriggered.current && quotaRemaining > 0) {
        autoGenTriggered.current = true
        await triggerGenerate(session.access_token)
      }
    }
    init()
  }, [user, session])

  const handleStatusChange = async (id: string, status: PostStatus) => {
    const { error } = await supabase.from('posts').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) setPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  const filtered = filterStatus === 'todos' ? posts : posts.filter(p => p.status === filterStatus)
  const counts: Record<string, number> = {
    todos: posts.length,
    rascunho: posts.filter(p => p.status === 'rascunho').length,
    aprovado: posts.filter(p => p.status === 'aprovado').length,
    publicado: posts.filter(p => p.status === 'publicado').length,
  }
  const locked = plan === 'free'
  const filterColors: Record<string, string> = { todos: 'white', rascunho: '#FBBF24', aprovado: '#4ade80', publicado: '#A78BFA' }

  return (
    <div style={{ padding: '24px 32px' }}>
      {genError && (
        <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#FBBF24', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚠️</span><span>{genError}</span>
          {genLimit && (
            <Link to="/dashboard/settings" style={{ color: ORANGE, marginLeft: 'auto', fontWeight: 700, textDecoration: 'none', fontSize: '12px', flexShrink: 0 }}>{X.seePlans}</Link>
          )}
        </div>
      )}

      <AgentStatusBar generating={generating} lastGeneratedAt={lastGeneratedAt} onRequestMore={() => session && triggerGenerate(session.access_token)} monthlyCount={monthlyCount} monthlyLimit={monthlyLimit} plan={plan} T={T} loc={lang === 'en' ? 'en-US' : 'pt-BR'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {(['todos', 'rascunho', 'aprovado', 'publicado'] as const).map(k => (
          <button key={k} onClick={() => setFilterStatus(k as PostStatus | 'todos')}
            style={{ background: filterStatus === k ? 'rgba(255,109,41,0.08)' : CARD, border: `1px solid ${filterStatus === k ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '12px', padding: '16px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{T.filterLabels[k]}</div>
            <div style={{ fontFamily: D, fontSize: '2rem', fontWeight: 900, color: filterColors[k], lineHeight: 1 }}>{counts[k]}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: MUTED }}>{d[lang].common.loading}</div>
      ) : generating && posts.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid rgba(255,109,41,0.15)`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🤖</div>
          <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{T.agentCreatingTitle}</div>
          <div style={{ color: MUTED, fontSize: '13px', lineHeight: 1.7, maxWidth: '380px', margin: '0 auto' }}>{T.agentCreatingDesc}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
          <div style={{ color: MUTED, fontSize: '13px' }}>{T.noFilter}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map(post => (
            <PostCard key={post.id} post={post} onStatusChange={handleStatusChange} locked={locked} T={T} />
          ))}
        </div>
      )}
    </div>
  )
}
