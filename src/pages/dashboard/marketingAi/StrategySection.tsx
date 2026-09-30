import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, ORANGE, SUPABASE_URL, timeAgo } from './shared'
import { BudgetPanel, FunnelPanel, EstimatesPanel, InitiativesPanel, MonitoringPanel } from './StrategyPanels'
import IntelligenceDomainsPanel from './IntelligenceDomainsPanel'
import HermesGapsPanel from './HermesGapsPanel'
import {
  type Strategy, type Goal, type LogRow, type Budget,
  GOAL_TYPE_LABEL, STATUS_LABEL, STATUS_COLOR, EMPTY_BUDGET, COMPONENT_LABEL,
} from './strategyTypes'

async function callStrategy(token: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/strategy-generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new Error(String(data.error ?? 'Erro'))
  return data
}

// A geração agora é assíncrona (2 execuções separadas em segundo plano —
// ver strategy-generate/index.ts): o backend devolve o id na hora com
// status:'generating', e esta tela faz o polling até virar 'active' (pronta)
// ou 'failed'. Nunca fica esperando pra sempre: 10 min sem resolver = trata
// como falha aqui também, mesmo sem nova resposta do backend.
const GENERATING_TIMEOUT_MS = 10 * 60 * 1000
const POLL_INTERVAL_MS = 3000

const ghostBtn: React.CSSProperties = { padding: '9px 14px', background: 'transparent', border: `1px solid ${BORDER}`, color: ORANGE, fontWeight: 700, fontSize: '11.5px', borderRadius: '9px', cursor: 'pointer', fontFamily: D }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D }

// Agente de Estratégia (Hermes) — ponte entre Agente de Dados e Agente de
// Conteúdo. Mantém UMA tese estratégica principal ativa por vez (nunca
// duas em paralelo — pedido do dono 2026-09-21, adaptado do framework
// Hermes colado por ele). Criar uma estratégia nova enquanto existe uma
// ativa é um PIVÔ consciente: a antiga vira histórico (status:'paused'),
// nunca some — o dono confirma antes. Iniciativas (kind='initiative')
// continuam podendo ser várias dentro da principal. A primeira estratégia
// é criada pela IA sozinha, sem exigir clique. Tudo (metas/orçamento/
// funil/estimativas/iniciativas/acompanhamento) vive numa tela única, sem
// sub-abas — pedido do dono 2026-09-20. Nada aqui inventa métrica: baseline
// vem de dado real coletado (ver strategy-generate/fetchRealBaseline) ou
// fica explicitamente "desconhecido".
export default function StrategySection({ company }: { company: CompanyData }) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [main, setMain] = useState<Strategy | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null) // quando != null, olhando uma iniciativa
  const [viewing, setViewing] = useState<Strategy | null>(null)
  const [initiatives, setInitiatives] = useState<Strategy[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [log, setLog] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<{ id: string; kind: 'main' | 'initiative' } | null>(null)
  const [genError, setGenError] = useState('')
  const [reanalyzing, setReanalyzing] = useState(false)
  const [savingBudget, setSavingBudget] = useState(false)
  const [localBudget, setLocalBudget] = useState<Budget>(EMPTY_BUDGET)
  const [error, setError] = useState('')
  const autoTried = useRef(false)

  const active = viewing ?? main

  const loadMain = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_strategies').select('*')
      .eq('company_id', company.id).eq('kind', 'main').eq('status', 'active')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()
    setMain((data as Strategy | null) ?? null)
    setLoading(false)
  }, [company.id])

  const loadLog = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_strategy_log').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(20)
    setLog((data ?? []) as LogRow[])
  }, [company.id])

  useEffect(() => { loadMain(); loadLog() }, [loadMain, loadLog])

  // "Pedir nova estratégia" (dono) usa o MESMO caminho do PIVOT automático
  // (reanalyze decidindo PIVOT/TERMINATE) — gera nova, pausa a antiga, avisa
  // Telegram/Atividades com o motivo. Pede confirmação + o "por quê" antes.
  const createStrategy = useCallback(async (kind: 'main' | 'initiative') => {
    let reason = ''
    if (kind === 'main' && main) {
      const input = window.prompt('Isso substitui sua estratégia principal atual por uma nova (é um pivô de direção) — a atual fica guardada no histórico, não some.\n\nPor quê? (aparece no aviso do Telegram/Atividades)', '')
      if (input === null) return // cancelou
      reason = input.trim()
    }
    setCreating(true); setError(''); setGenError('')
    try {
      const res = await callStrategy(token, { action: 'generate', kind, parent_strategy_id: kind === 'initiative' ? main?.id : undefined, reason: reason || undefined })
      const strategyId = res.strategy_id ? String(res.strategy_id) : ''
      if (strategyId && res.status === 'generating') {
        setGenerating({ id: strategyId, kind })
        setViewingId(null)
        if (kind === 'initiative') {
          setInitiatives(prev => [{ id: strategyId, name: 'Gerando estratégia...', status: 'generating', strategic_focus: '' } as Strategy, ...prev])
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao criar estratégia') }
    setCreating(false)
  }, [token, main])

  // Polling da geração em segundo plano (2 execuções separadas no backend —
  // ver nota no topo do strategy-generate/index.ts). Trata >10min parado
  // como falha aqui também, mesmo sem o backend ter marcado 'failed'.
  useEffect(() => {
    if (!generating) return
    const startedAt = Date.now()
    const tick = async () => {
      if (Date.now() - startedAt > GENERATING_TIMEOUT_MS) {
        setGenError('Demorou demais e não terminou — tente gerar de novo.')
        setGenerating(null)
        return
      }
      const { data } = await supabase.from('marketing_ai_strategies').select('id, status, reasoning').eq('id', generating.id).maybeSingle()
      if (!data) return
      if (data.status === 'active') {
        setGenerating(null)
        if (generating.kind === 'main') {
          await loadMain()
        } else if (main) {
          const { data: inits } = await supabase.from('marketing_ai_strategies').select('*').eq('parent_strategy_id', main.id).order('created_at', { ascending: false })
          setInitiatives((inits ?? []) as Strategy[])
        }
      } else if (data.status === 'failed') {
        setGenError((data.reasoning as string | null) || 'Não consegui gerar — tente de novo.')
        setGenerating(null)
        if (generating.kind === 'initiative' && main) {
          const { data: inits } = await supabase.from('marketing_ai_strategies').select('*').eq('parent_strategy_id', main.id).order('created_at', { ascending: false })
          setInitiatives((inits ?? []) as Strategy[])
        }
      }
    }
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [generating, main, loadMain])

  // Primeira estratégia: a IA cria sozinha, sem exigir clique do dono.
  useEffect(() => {
    if (loading || autoTried.current || main) return
    autoTried.current = true
    void createStrategy('main')
  }, [loading, main, createStrategy])

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

  // O check-up agora roda em segundo plano (backend responde na hora e faz
  // o raciocínio via EdgeRuntime.waitUntil, pro despachante não ficar
  // travado esperando) — faz polling curto em last_reanalyzed_at até ver
  // que rodou de verdade, em vez de confiar na resposta síncrona antiga.
  const reanalyze = async () => {
    if (!active) return
    const startedAt = active.last_reanalyzed_at
    setReanalyzing(true); setError('')
    try {
      await callStrategy(token, { action: 'reanalyze', strategy_id: active.id })
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
        const { data } = await supabase.from('marketing_ai_strategies').select('last_reanalyzed_at').eq('id', active.id).maybeSingle()
        if (data?.last_reanalyzed_at && data.last_reanalyzed_at !== startedAt) break
      }
      await Promise.all([loadLog(), loadMain()])
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao reavaliar') }
    setReanalyzing(false)
  }

  const saveBudget = async () => {
    if (!active) return
    setSavingBudget(true); setError('')
    try {
      await callStrategy(token, { action: 'update_strategy', strategy_id: active.id, patch: { budget: localBudget } })
      await loadMain()
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
          superior direito — criar uma nova enquanto existe uma ativa é um
          pivô consciente (confirmado antes de chamar a API). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          {viewing && (
            <button onClick={() => setViewingId(null)} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '11.5px', cursor: 'pointer', padding: 0, marginBottom: '6px', display: 'block' }}>← Voltar pra estratégia principal</button>
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
          {active && !viewing && active.status !== 'generating' && active.status !== 'failed' && (
            <button onClick={reanalyze} disabled={reanalyzing} style={ghostBtn}>{reanalyzing ? 'Reavaliando...' : '↻ Reavaliar'}</button>
          )}
          <button onClick={() => createStrategy('main')} disabled={creating || !!generating} style={{ ...primaryBtn, opacity: (creating || !!generating) ? 0.7 : 1, cursor: (creating || !!generating) ? 'default' : 'pointer' }}>
            {creating || generating?.kind === 'main' ? 'Gerando...' : main ? '↻ Pedir nova estratégia' : '+ Criar estratégia'}
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '14px' }}>{error}</div>}

      {!active && (
        <div style={{ maxWidth: '560px', padding: '40px 32px', textAlign: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{genError ? '⚠️' : '🧭'}</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
            {creating ? 'Criando sua primeira estratégia...' : generating ? 'Gerando sua estratégia...' : genError ? 'Não consegui gerar a estratégia' : 'Nenhuma estratégia ainda'}
          </div>
          <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
            {genError || 'A IA lê o que já sabemos do seu negócio e o dado real disponível, e propõe objetivo, metas, orçamento e prazo — você revisa e edita tudo depois.'}
          </p>
          {genError && (
            <button onClick={() => createStrategy('main')} disabled={creating} style={{ ...primaryBtn, marginTop: '14px' }}>Tentar de novo</button>
          )}
        </div>
      )}

      {active && (active.status === 'generating' || active.status === 'failed') && (
        <div style={{ maxWidth: '560px', padding: '40px 32px', textAlign: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{active.status === 'failed' ? '⚠️' : '🧭'}</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
            {active.status === 'failed' ? 'Essa iniciativa não terminou de gerar' : 'Gerando essa iniciativa...'}
          </div>
          {active.status === 'failed' && active.reasoning && (
            <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>{active.reasoning}</p>
          )}
        </div>
      )}

      {active && active.status !== 'generating' && active.status !== 'failed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <StrategyBlock title="🧭 Visão Geral"><OverviewPanel strategy={active} /></StrategyBlock>
          <HermesGapsPanel company={company} />
          <StrategyBlock title="🧠 Inteligência do Negócio (9 domínios)"><IntelligenceDomainsPanel companyId={company.id} /></StrategyBlock>
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
      {strategy.thesis && (
        <div style={{ ...box, background: 'rgba(255,109,41,0.06)', borderColor: 'rgba(255,109,41,0.2)', borderLeft: `3px solid ${ORANGE}` }}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Tese estratégica</div>
          <div style={{ fontSize: '14px', color: 'white', lineHeight: 1.65, fontStyle: 'italic' }}>"{strategy.thesis}"</div>
        </div>
      )}
      {strategy.reasoning && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Por que essa estratégia</div>
          <div style={{ fontSize: '13px', color: 'white', lineHeight: 1.6 }}>{strategy.reasoning}</div>
        </div>
      )}
      {(strategy.primary_constraint || strategy.strategic_opportunity) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div style={{ ...box, marginBottom: 0, borderColor: 'rgba(248,113,113,0.25)' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: '5px' }}>Restrição principal</div>
            <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.55 }}>{strategy.primary_constraint || '—'}</div>
          </div>
          <div style={{ ...box, marginBottom: 0, borderColor: 'rgba(74,222,128,0.25)' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', marginBottom: '5px' }}>Oportunidade estratégica</div>
            <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.55 }}>{strategy.strategic_opportunity || '—'}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Objetivo de negócio</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.primary_business_objective || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Objetivo de marketing</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.primary_marketing_objective || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Foco estratégico</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.strategic_focus || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Horizonte</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.horizon || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Cadência de revisão</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.review_cadence || '—'}</div></div>
      </div>
      {strategy.active_components.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '8px' }}>Componentes ativos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {strategy.active_components.map(c => (
              <span key={c} style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '99px', padding: '4px 10px' }}>{COMPONENT_LABEL[c] ?? c}</span>
            ))}
          </div>
        </div>
      )}
      {strategy.exclusions.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '7px' }}>O que NÃO vamos fazer agora</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'white', lineHeight: 1.7 }}>{strategy.exclusions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {(strategy.success_conditions || strategy.failure_conditions) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          {strategy.success_conditions && (
            <div style={{ ...box, marginBottom: 0 }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', marginBottom: '5px' }}>Sinais de que está funcionando</div>
              <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.55 }}>{strategy.success_conditions}</div>
            </div>
          )}
          {strategy.failure_conditions && (
            <div style={{ ...box, marginBottom: 0 }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: '5px' }}>Sinais de que não está funcionando</div>
              <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.55 }}>{strategy.failure_conditions}</div>
            </div>
          )}
        </div>
      )}
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
