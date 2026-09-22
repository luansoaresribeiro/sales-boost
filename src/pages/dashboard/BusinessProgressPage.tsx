import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabase'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './marketingAi/shared'
import { buildProgress, type RealSignals, type ProgressData } from './marketingAi/progressGame'
import {
  LevelCard, MilestoneCard, WhileAway, HealthCard, WeeklyCard, PinsGrid,
  RewardsGrid, Timeline, NextBestAction, RecoveryCard, StreakCard,
  JourneyTrack, LeagueLadder,
} from './marketingAi/progressParts'
import { fetchDiscoveries, DiscoveriesSection, type Discovery } from './marketingAi/Discoveries'
import { type Goal, type Strategy, GOAL_TYPE_LABEL } from './marketingAi/strategyTypes'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const LS_VISIT = 'sb_progress_last_visit'

const tabRow: React.CSSProperties = { display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px' }
function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      style={{ padding: '8px 16px', background: active ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${active ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: D, fontSize: '12.5px', fontWeight: 700, color: active ? ORANGE : 'white' }}>
      {label}
    </button>
  )
}

// Objetivos = leitura das metas do Agente de Estratégia (marketing_ai_strategy_goals
// da estratégia principal ativa). Só leitura aqui de propósito — editar
// mora no Agente de Estratégia, pra não ter dois lugares mexendo na mesma
// meta de jeitos diferentes.
function ObjetivosTab({ companyId, onOpenStrategy }: { companyId: string; onOpenStrategy: () => void }) {
  const [strategy, setStrategy] = useState<Strategy | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: strat } = await supabase.from('marketing_ai_strategies').select('*')
        .eq('company_id', companyId).eq('kind', 'main').eq('status', 'active')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (!alive) return
      setStrategy((strat as Strategy | null) ?? null)
      if (strat) {
        const { data: g } = await supabase.from('marketing_ai_strategy_goals').select('*').eq('strategy_id', strat.id).order('priority', { ascending: true })
        if (alive) setGoals((g ?? []) as Goal[])
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [companyId])

  if (loading) return <div style={{ color: MUTED, fontSize: '13px' }}>Carregando objetivos…</div>

  if (!strategy) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>🧭</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>Nenhuma estratégia ativa ainda</div>
        <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, marginBottom: '16px' }}>Os objetivos aparecem aqui assim que o Agente de Estratégia criar a estratégia principal.</p>
        <button onClick={onOpenStrategy} style={{ padding: '10px 18px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: D }}>Abrir Agente de Estratégia →</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>{strategy.name}</div>
          {strategy.thesis && <div style={{ fontSize: '12px', color: MUTED, marginTop: '3px', maxWidth: '600px', lineHeight: 1.5 }}>{strategy.thesis}</div>}
        </div>
        <button onClick={onOpenStrategy} style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${BORDER}`, color: ORANGE, fontWeight: 700, fontSize: '12px', borderRadius: '9px', cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>Ver e editar →</button>
      </div>
      {goals.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: MUTED }}>Nenhuma meta registrada nessa estratégia ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {goals.map(g => (
            <div key={g.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{g.name}</div>
                  <div style={{ fontSize: '10.5px', color: MUTED }}>{GOAL_TYPE_LABEL[g.goal_type] ?? g.goal_type}{g.period ? ` · ${g.period}` : ''}</div>
                </div>
                <span style={{ fontSize: '9px', fontWeight: 800, color: g.priority === 'high' ? '#f87171' : g.priority === 'low' ? MUTED : '#FBBF24', flexShrink: 0 }}>{g.priority.toUpperCase()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>Base</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: g.baseline_verified ? 'white' : MUTED, fontStyle: g.baseline_verified ? 'normal' : 'italic' }}>
                    {g.baseline_verified && g.baseline_value != null ? g.baseline_value : 'desconhecido'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>Meta</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{g.target_value ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>Progresso</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: ORANGE }}>{g.current_progress ?? '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function headCount(q: { count: number | null } | PromiseLike<{ count: number | null }>): Promise<number> {
  const { count } = await q
  return count ?? 0
}

export default function BusinessProgressPage() {
  const { company } = useCompany()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [toast, setToast] = useState<string>('')
  const [disc, setDisc] = useState<{ pending: Discovery[]; revealed: Discovery[] }>({ pending: [], revealed: [] })
  const [tab, setTab] = useState<'progresso' | 'objetivos'>('progresso')

  const companyId = company?.id
  const businessName = company?.business_name ?? 'seu negócio'

  useEffect(() => {
    if (!companyId) return
    let alive = true
    ;(async () => {
      setLoading(true)
      // Sinais reais da plataforma (contagens) — não inventa, deriva do que existe.
      const [posts, postsPublished, opportunities, reviewsReplied, campaigns] = await Promise.all([
        headCount(supabase.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
        headCount(supabase.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'publicado')),
        headCount(supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
        headCount(supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('owner_reply', 'is', null)),
        headCount(supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
      ])

      // Última visita: melhor esforço via progress_state; fallback localStorage.
      let daysSinceVisit = 1
      let lastVisitIso: string | null = null
      try {
        const { data: st } = await supabase.from('progress_state').select('last_visit_at').eq('company_id', companyId).maybeSingle()
        lastVisitIso = st?.last_visit_at ?? null
      } catch { /* RLS/offline — usa localStorage */ }
      if (!lastVisitIso) { try { lastVisitIso = localStorage.getItem(LS_VISIT) } catch { /* ignore */ } }
      if (lastVisitIso) daysSinceVisit = Math.max(0, Math.round((Date.now() - new Date(lastVisitIso).getTime()) / 86400000))
      try { localStorage.setItem(LS_VISIT, new Date().toISOString()) } catch { /* ignore */ }

      let activitySinceVisit = 0
      try {
        const since = lastVisitIso ?? new Date(Date.now() - 7 * 86400000).toISOString()
        const { count } = await supabase.from('client_activity').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', since)
        activitySinceVisit = count ?? 0
      } catch { /* opcional */ }

      const real: RealSignals = { posts, postsPublished, opportunities, reviewsReplied, campaigns, activitySinceVisit, daysSinceVisit }
      const built = buildProgress({ id: companyId, business_name: businessName }, real)

      // Overlay: rewards ativos de verdade (do banco), se houver.
      try {
        const { data: acts } = await supabase.from('progress_reward_activations').select('reward_key, expires_at').eq('company_id', companyId).gt('expires_at', new Date().toISOString())
        if (acts?.length) {
          const activeKeys = new Set(acts.map(a => a.reward_key))
          built.rewards = built.rewards.map(r => activeKeys.has(r.key) ? { ...r, unlocked: true, active: true } : r)
        }
      } catch { /* opcional */ }

      if (alive) { setData(built); setLoading(false) }
    })()
    return () => { alive = false }
  }, [companyId, businessName])

  // Descobertas reais (detecta + lista). XP só credita quando o usuário revela.
  useEffect(() => {
    if (!companyId || !session) return
    let alive = true
    fetchDiscoveries(session.access_token, companyId).then(r => { if (alive) setDisc(r) }).catch(() => {})
    return () => { alive = false }
  }, [companyId, session])

  const activate = async (rewardKey: string) => {
    if (!companyId || !session || activating) return
    setActivating(rewardKey)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/business-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'activate_reward', company_id: companyId, reward_key: rewardKey, agent: 'marketing' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Falha ao ativar')
      setToast(json.already ? 'Esse boost já estava ativo.' : `✓ ${json.name ?? 'Boost'} ativado por ${json.duration_hours ?? 24}h!`)
      setData(prev => prev ? { ...prev, rewards: prev.rewards.map(r => r.key === rewardKey ? { ...r, unlocked: true, active: true } : r) } : prev)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Erro ao ativar boost')
    }
    setActivating(null)
    setTimeout(() => setToast(''), 4000)
  }

  const firstName = useMemo(() => businessName.split(' ')[0], [businessName])

  if (!company) return <div style={{ padding: '40px', color: MUTED, fontFamily: D }}>Carregando…</div>
  if (loading || !data) return <div style={{ padding: '40px', color: MUTED, fontFamily: D }}>Calculando seu progresso…</div>

  return (
    <div style={{ maxWidth: '1120px', width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: '28px 32px', fontFamily: D, display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Boas-vindas */}
      <div>
        <div style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>🚀 Seu negócio avançou</div>
        <div style={{ fontSize: '13.5px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>
          Bem-vindo de volta, <strong style={{ color: 'white' }}>{firstName}</strong>. Seu SalesBoost trabalhou enquanto você estava fora — <strong style={{ color: 'white' }}>{data.actionsCount} ações executadas</strong> desde a última visita.
        </div>
      </div>

      <div style={tabRow}>
        <TabButton active={tab === 'progresso'} onClick={() => setTab('progresso')} label="🚀 Progresso" />
        <TabButton active={tab === 'objetivos'} onClick={() => setTab('objetivos')} label="🎯 Objetivos" />
      </div>

      {tab === 'objetivos' ? (
        companyId && <ObjetivosTab companyId={companyId} onOpenStrategy={() => navigate('/dashboard/marketing-ai/estrategia')} />
      ) : (
      <>
      {/* Modo demonstração (honestidade) */}
      <div style={{ padding: '11px 15px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
        🧪 <strong>Progresso combinado.</strong> Já usa seus dados reais (conteúdo, oportunidades, avaliações, campanhas). Leads, conversas e conversões entram como projeção até o Funil e o Atendimento reais (WhatsApp/Instagram) serem ligados — aí tudo vira 100% real, sem mudar a tela.
      </div>

      {/* Nível + Milestone */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        <LevelCard d={data} />
        <MilestoneCard d={data} />
      </div>

      {/* Progresso: health 72 -> 81 + deltas */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px 22px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>📈 Seu progresso</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span style={{ fontSize: '30px', fontWeight: 900, color: MUTED }}>{data.healthFrom}</span>
          <span style={{ fontSize: '20px', color: MUTED }}>→</span>
          <span style={{ fontSize: '34px', fontWeight: 900, color: data.healthTo >= data.healthFrom ? GREEN : '#f87171' }}>{data.healthTo}</span>
          <span style={{ fontSize: '12px', color: MUTED }}>Health Score</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {data.deltas.map(dl => (
            <div key={dl.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '9px 13px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: dl.up ? GREEN : '#f87171' }}>{dl.value}</span>
              <span style={{ fontSize: '11px', color: MUTED, marginLeft: '6px' }}>{dl.label}</span>
            </div>
          ))}
        </div>
      </div>

      <JourneyTrack d={data} />

      {(disc.pending.length > 0 || disc.revealed.length > 0) && session && companyId && (
        <DiscoveriesSection token={session.access_token} companyId={companyId} pending={disc.pending} revealed={disc.revealed}
          onRevealed={(d) => setDisc(prev => ({ pending: prev.pending.filter(p => p.id !== d.id), revealed: [d, ...prev.revealed] }))} />
      )}

      <WhileAway d={data} onOpen={navigate} />

      {data.recovery && <RecoveryCard d={data} onActivate={activate} activating={activating} />}

      <NextBestAction d={data} onOpen={navigate} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        <HealthCard d={data} />
        <WeeklyCard d={data} />
      </div>

      <StreakCard d={data} />
      <LeagueLadder d={data} />
      <PinsGrid pins={data.pins} onActivate={activate} activating={activating} />
      <RewardsGrid rewards={data.rewards} />
      <Timeline d={data} />
      </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#150E08', border: `1px solid ${GREEN}55`, borderRadius: '12px', padding: '13px 20px', fontSize: '13px', fontWeight: 700, color: 'white', zIndex: 50, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
