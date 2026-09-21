import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, ORANGE, SUPABASE_URL, timeAgo } from './shared'
import { BudgetPanel, FunnelPanel, EstimatesPanel, InitiativesPanel, MonitoringPanel } from './StrategyPanels'
import {
  type Strategy, type Goal, type LogRow, type Budget,
  GOAL_TYPE_LABEL, STATUS_LABEL, STATUS_COLOR, EMPTY_BUDGET,
} from './strategyTypes'

async function callStrategy(token: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/strategy-generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new Error(String(data.error ?? 'Erro'))
  return data
}

const ghostBtn: React.CSSProperties = { padding: '9px 14px', background: 'transparent', border: `1px solid ${BORDER}`, color: ORANGE, fontWeight: 700, fontSize: '11.5px', borderRadius: '9px', cursor: 'pointer', fontFamily: D }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D }

// Agente de Estratégia — ponte entre Agente de Dados e Agente de Conteúdo.
// Várias estratégias PRINCIPAIS podem ficar ativas em paralelo (o dono
// pediu — criar uma nova nunca pausa as outras) + N iniciativas por
// principal. A primeira estratégia é criada pela IA sozinha, sem exigir
// clique; o botão "+ Criar estratégia" fica sempre visível pra criar mais.
// Tudo (metas/orçamento/funil/estimativas/iniciativas/acompanhamento) vive
// numa tela única, sem sub-abas — pedido do dono 2026-09-20. Nada aqui
// inventa métrica: baseline vem de dado real coletado (ver strategy-
// generate/fetchRealBaseline) ou fica explicitamente "desconhecido".
export default function StrategySection({ company }: { company: CompanyData }) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [mains, setMains] = useState<Strategy[]>([])
  const [selectedMainId, setSelectedMainId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null) // quando != null, olhando uma iniciativa
  const [viewing, setViewing] = useState<Strategy | null>(null)
  const [initiatives, setInitiatives] = useState<Strategy[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [log, setLog] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [savingBudget, setSavingBudget] = useState(false)
  const [localBudget, setLocalBudget] = useState<Budget>(EMPTY_BUDGET)
  const [error, setError] = useState('')
  const autoTried = useRef(false)

  const main = mains.find(m => m.id === selectedMainId) ?? mains[0] ?? null
  const active = viewing ?? main

  const loadMains = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_strategies').select('*')
      .eq('company_id', company.id).eq('kind', 'main').order('updated_at', { ascending: false })
    const list = (data ?? []) as Strategy[]
    setMains(list)
    setSelectedMainId(prev => (prev && list.some(m => m.id === prev)) ? prev : (list[0]?.id ?? null))
    setLoading(false)
  }, [company.id])

  const loadLog = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_strategy_log').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(20)
    setLog((data ?? []) as LogRow[])
  }, [company.id])

  useEffect(() => { loadMains(); loadLog() }, [loadMains, loadLog])

  const createStrategy = useCallback(async (kind: 'main' | 'initiative') => {
    setCreating(true); setError('')
    try {
      const res = await callStrategy(token, { action: 'generate', kind, parent_strategy_id: kind === 'initiative' ? main?.id : undefined })
      setViewingId(null)
      await loadMains()
      if (kind === 'main' && res.strategy_id) setSelectedMainId(String(res.strategy_id))
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao criar estratégia') }
    setCreating(false)
  }, [token, main?.id, loadMains])

  // Primeira estratégia: a IA cria sozinha, sem exigir clique do dono.
  useEffect(() => {
    if (loading || autoTried.current || mains.length > 0) return
    autoTried.current = true
    void createStrategy('main')
  }, [loading, mains.length, createStrategy])

  useEffect(() => {
    if (!main) { setInitiatives([]); return }
    supabase.from('marketing_ai_strategies').select('*').eq('parent_strategy_id', main.id).order('created_at', { ascending: false })
      .then(({ data }) => setInitiatives((data ?? []) as Strategy[]))
  }, [main])

  useEffect(() => {
    if (!viewingId) { setViewing(null); return }
    supabase.from('marketing_ai_strategies').select('*').eq('id', viewingId).maybeSingle().then(({ data }) => setViewing(data as Strategy | null))
  }, [viewingId])

  useEffect(() => {
    if (!active) { setGoals([]); setLocalBudget(EMPTY_BUDGET); return }
    setLocalBudget({ ...EMPTY_BUDGET, ...active.budget })
    supabase.from('marketing_ai_strategy_goals').select('*').eq('strategy_id', active.id).order('priority', { ascending: true })
      .then(({ data }) => setGoals((data ?? []) as Goal[]))
  }, [active])

  const reanalyze = async () => {
    if (!active) return
    setReanalyzing(true); setError('')
    try {
      await callStrategy(token, { action: 'reanalyze', strategy_id: active.id })
      await loadLog()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao reavaliar') }
    setReanalyzing(false)
  }

  const saveBudget = async () => {
    if (!active) return
    setSavingBudget(true); setError('')
    try {
      await callStrategy(token, { action: 'update_strategy', strategy_id: active.id, patch: { budget: localBudget } })
      await loadMains()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar orçamento') }
    setSavingBudget(false)
  }

  const updateGoal = async (goalId: string, patch: Partial<Goal>) => {
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, ...patch } : g))
    try { await callStrategy(token, { action: 'update_goal', goal_id: goalId, patch }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar meta') }
  }

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div>

  return (
    <div>
      {/* Cabeçalho: sempre visível, com "+ Criar estratégia" fixo no canto
          superior direito — vazio ou não, e mesmo com várias em paralelo. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          {viewing && (
            <button onClick={() => setViewingId(null)} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '11.5px', cursor: 'pointer', padding: 0, marginBottom: '6px', display: 'block' }}>← Voltar pra estratégia principal</button>
          )}
          {mains.length > 1 && !viewing && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {mains.map(m => (
                <button key={m.id} onClick={() => setSelectedMainId(m.id)}
                  style={{ padding: '5px 12px', borderRadius: '99px', border: `1px solid ${m.id === selectedMainId ? 'rgba(255,109,41,0.5)' : BORDER}`, background: m.id === selectedMainId ? 'rgba(255,109,41,0.12)' : 'transparent', color: m.id === selectedMainId ? ORANGE : MUTED, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
          {active ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: 800, color: 'white' }}>{active.name}</span>
              <span style={{ fontSize: '9.5px', fontWeight: 800, color: STATUS_COLOR[active.status] ?? MUTED, border: `1px solid ${STATUS_COLOR[active.status] ?? MUTED}55`, borderRadius: '99px', padding: '3px 9px' }}>● {STATUS_LABEL[active.status] ?? active.status}</span>
              {active.kind === 'initiative' && <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#A78BFA', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '99px', padding: '3px 9px' }}>INICIATIVA</span>}
            </div>
          ) : (
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>🧭 Agente de Estratégia</span>
          )}
          {active && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Atualizada {timeAgo(active.updated_at)}</div>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {active && !viewing && (
            <button onClick={reanalyze} disabled={reanalyzing} style={ghostBtn}>{reanalyzing ? 'Reavaliando...' : '↻ Reavaliar'}</button>
          )}
          <button onClick={() => createStrategy('main')} disabled={creating} style={{ ...primaryBtn, opacity: creating ? 0.7 : 1, cursor: creating ? 'default' : 'pointer' }}>
            {creating ? 'Criando...' : '+ Criar estratégia'}
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '14px' }}>{error}</div>}

      {!active && (
        <div style={{ maxWidth: '560px', padding: '40px 32px', textAlign: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧭</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
            {creating ? 'Criando sua primeira estratégia...' : 'Nenhuma estratégia ainda'}
          </div>
          <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
            A IA lê o que já sabemos do seu negócio e o dado real disponível, e propõe objetivo, metas, orçamento e prazo — você revisa e edita tudo depois.
          </p>
        </div>
      )}

      {active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <StrategyBlock title="🧭 Visão Geral"><OverviewPanel strategy={active} /></StrategyBlock>
          <StrategyBlock title="🎯 Metas"><GoalsPanel goals={goals} onUpdate={updateGoal} /></StrategyBlock>
          <StrategyBlock title="💰 Orçamento"><BudgetPanel budget={localBudget} onChange={setLocalBudget} onSave={saveBudget} saving={savingBudget} /></StrategyBlock>
          <StrategyBlock title="🔀 Conteúdo & Campanha"><FunnelPanel strategy={active} /></StrategyBlock>
          <StrategyBlock title="⏱️ Prazo & Viabilidade"><EstimatesPanel strategy={active} /></StrategyBlock>
          {!viewing && (
            <StrategyBlock title="✨ Iniciativas">
              <InitiativesPanel initiatives={initiatives} onCreate={() => createStrategy('initiative')} creating={creating} onOpen={setViewingId} />
            </StrategyBlock>
          )}
          <StrategyBlock title="📡 Acompanhamento">
            <MonitoringPanel log={log.filter(l => l.strategy_id === active.id)} onReanalyze={reanalyze} reanalyzing={reanalyzing} />
          </StrategyBlock>
        </div>
      )}
    </div>
  )
}

function StrategyBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${BORDER}` }}>{title}</div>
      {children}
    </div>
  )
}

function OverviewPanel({ strategy }: { strategy: Strategy }) {
  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }
  return (
    <div style={{ maxWidth: '740px' }}>
      {strategy.reasoning && (
        <div style={{ ...box, background: 'rgba(255,109,41,0.05)', borderColor: 'rgba(255,109,41,0.15)' }}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Por que essa estratégia</div>
          <div style={{ fontSize: '13px', color: 'white', lineHeight: 1.6 }}>{strategy.reasoning}</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Objetivo de negócio</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.primary_business_objective || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Objetivo de marketing</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.primary_marketing_objective || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Foco estratégico</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.strategic_focus || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Horizonte</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.horizon || '—'}</div></div>
      </div>
      {strategy.assumptions.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '7px' }}>Suposições</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'white', lineHeight: 1.7 }}>{strategy.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {strategy.constraints.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '7px' }}>Restrições atuais</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'white', lineHeight: 1.7 }}>{strategy.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function GoalsPanel({ goals, onUpdate }: { goals: Goal[]; onUpdate: (id: string, patch: Partial<Goal>) => void }) {
  if (!goals.length) return <div style={{ fontSize: '12.5px', color: MUTED }}>Nenhuma meta ainda.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '680px' }}>
      {goals.map(g => (
        <div key={g.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{g.name}</div>
              <div style={{ fontSize: '10.5px', color: MUTED }}>{GOAL_TYPE_LABEL[g.goal_type] ?? g.goal_type}{g.period ? ` · ${g.period}` : ''}</div>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 800, color: g.priority === 'high' ? '#f87171' : g.priority === 'low' ? MUTED : '#FBBF24', flexShrink: 0 }}>{g.priority.toUpperCase()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>Base atual</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: g.baseline_verified ? 'white' : MUTED, fontStyle: g.baseline_verified ? 'normal' : 'italic' }}>
                {g.baseline_verified && g.baseline_value != null ? g.baseline_value : 'desconhecido'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>Meta</div>
              <input type="number" value={g.target_value ?? ''} onChange={e => onUpdate(g.id, { target_value: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>Progresso atual</div>
              <input type="number" value={g.current_progress ?? ''} onChange={e => onUpdate(g.id, { current_progress: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          </div>
          {(g.data_source || g.measurement_method) && (
            <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>
              {g.data_source && <div>Fonte: {g.data_source}</div>}
              {g.measurement_method && <div>Como medir: {g.measurement_method}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
