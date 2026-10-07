import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, ORANGE, SUPABASE_URL, timeAgo } from './shared'
import { BudgetPanel, FunnelPanel, EstimatesPanel, InitiativesPanel, MonitoringPanel } from './StrategyPanels'
import IntelligenceDomainsPanel from './IntelligenceDomainsPanel'
import HermesGapsPanel from './HermesGapsPanel'
import {
  type Strategy, type Goal, type LogRow, type Budget,
  STATUS_COLOR, EMPTY_BUDGET, strategyLabels,
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
const TX = {
  pt: {
    errGeneric: 'Erro', promptPivot: 'Isso substitui sua estratégia principal atual por uma nova (é um pivô de direção) — a atual fica guardada no histórico, não some.\n\nPor quê? (aparece no aviso do Telegram/Atividades)',
    generatingName: 'Gerando estratégia...', errCreate: 'Erro ao criar estratégia', tooLong: 'Demorou demais e não terminou — tente gerar de novo.', failedGen: 'Não consegui gerar — tente de novo.',
    errReanalyze: 'Erro ao reavaliar', errBudget: 'Erro ao salvar orçamento', errGoal: 'Erro ao salvar meta', loading: 'Carregando...',
    backMain: '← Voltar pra estratégia principal', initiativeBadge: 'INICIATIVA', agentTitle: '🧭 Agente de Estratégia', updated: 'Atualizada',
    reanalyzing: 'Reavaliando...', reanalyze: '↻ Reavaliar', generating: 'Gerando...', askNew: '↻ Pedir nova estratégia', create: '+ Criar estratégia',
    creatingFirst: 'Criando sua primeira estratégia...', generatingYours: 'Gerando sua estratégia...', couldNot: 'Não consegui gerar a estratégia', none: 'Nenhuma estratégia ainda',
    noneDesc: 'A IA lê o que já sabemos do seu negócio e o dado real disponível, e propõe objetivo, metas, orçamento e prazo — você revisa e edita tudo depois.', retry: 'Tentar de novo',
    initFailed: 'Essa iniciativa não terminou de gerar', initGenerating: 'Gerando essa iniciativa...',
    bOverview: '🧭 Visão Geral', bDomains: '🧠 Inteligência do Negócio (9 domínios)', bGoals: '🎯 Metas', bBudget: '💰 Orçamento', bFunnel: '🔀 Conteúdo & Campanha', bEstimates: '⏱️ Prazo & Viabilidade', bInit: '✨ Iniciativas', bMonitor: '📡 Acompanhamento',
    thesis: 'Tese estratégica', why: 'Por que essa estratégia', mainConstraint: 'Restrição principal', opportunity: 'Oportunidade estratégica', bizObj: 'Objetivo de negócio', mktObj: 'Objetivo de marketing', focus: 'Foco estratégico', horizon: 'Horizonte', cadence: 'Cadência de revisão',
    components: 'Componentes ativos', exclusions: 'O que NÃO vamos fazer agora', workingSigns: 'Sinais de que está funcionando', notWorkingSigns: 'Sinais de que não está funcionando', assumptions: 'Suposições', constraints: 'Restrições atuais',
    noGoals: 'Nenhuma meta ainda.', baseline: 'Base atual', unknown: 'desconhecido', target: 'Meta', progress: 'Progresso atual', source: 'Fonte: ', howMeasure: 'Como medir: ',
    prio: { high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' } as Record<string, string>,
  },
  en: {
    errGeneric: 'Error', promptPivot: 'This replaces your current main strategy with a new one (it is a change of direction) — the current one is kept in the history, it does not disappear.\n\nWhy? (shows up in the Telegram/Activity notice)',
    generatingName: 'Generating strategy...', errCreate: 'Error creating strategy', tooLong: 'It took too long and did not finish — try generating again.', failedGen: 'Could not generate — try again.',
    errReanalyze: 'Error re-evaluating', errBudget: 'Error saving budget', errGoal: 'Error saving goal', loading: 'Loading...',
    backMain: '← Back to the main strategy', initiativeBadge: 'INITIATIVE', agentTitle: '🧭 Strategy Agent', updated: 'Updated',
    reanalyzing: 'Re-evaluating...', reanalyze: '↻ Re-evaluate', generating: 'Generating...', askNew: '↻ Ask for a new strategy', create: '+ Create strategy',
    creatingFirst: 'Creating your first strategy...', generatingYours: 'Generating your strategy...', couldNot: 'Could not generate the strategy', none: 'No strategy yet',
    noneDesc: 'The AI reads what we already know about your business and the real data available, and proposes a goal, targets, budget and timeline — you review and edit everything afterwards.', retry: 'Try again',
    initFailed: 'This initiative did not finish generating', initGenerating: 'Generating this initiative...',
    bOverview: '🧭 Overview', bDomains: '🧠 Business Intelligence (9 domains)', bGoals: '🎯 Goals', bBudget: '💰 Budget', bFunnel: '🔀 Content & Campaign', bEstimates: '⏱️ Timeline & Feasibility', bInit: '✨ Initiatives', bMonitor: '📡 Monitoring',
    thesis: 'Strategic thesis', why: 'Why this strategy', mainConstraint: 'Main constraint', opportunity: 'Strategic opportunity', bizObj: 'Business objective', mktObj: 'Marketing objective', focus: 'Strategic focus', horizon: 'Horizon', cadence: 'Review cadence',
    components: 'Active components', exclusions: 'What we will NOT do now', workingSigns: 'Signs it is working', notWorkingSigns: 'Signs it is not working', assumptions: 'Assumptions', constraints: 'Current constraints',
    noGoals: 'No goals yet.', baseline: 'Current baseline', unknown: 'unknown', target: 'Target', progress: 'Current progress', source: 'Source: ', howMeasure: 'How to measure: ',
    prio: { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' } as Record<string, string>,
  },
} as const

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
  const { lang } = useLang()
  const t = TX[lang]
  const L = strategyLabels(lang)
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
      const input = window.prompt(t.promptPivot, '')
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
          setInitiatives(prev => [{ id: strategyId, name: t.generatingName, status: 'generating', strategic_focus: '' } as Strategy, ...prev])
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : t.errCreate) }
    setCreating(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, main])

  // Polling da geração em segundo plano (2 execuções separadas no backend —
  // ver nota no topo do strategy-generate/index.ts). Trata >10min parado
  // como falha aqui também, mesmo sem o backend ter marcado 'failed'.
  useEffect(() => {
    if (!generating) return
    const startedAt = Date.now()
    const tick = async () => {
      if (Date.now() - startedAt > GENERATING_TIMEOUT_MS) {
        setGenError(t.tooLong)
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
        setGenError((data.reasoning as string | null) || t.failedGen)
        setGenerating(null)
        if (generating.kind === 'initiative' && main) {
          const { data: inits } = await supabase.from('marketing_ai_strategies').select('*').eq('parent_strategy_id', main.id).order('created_at', { ascending: false })
          setInitiatives((inits ?? []) as Strategy[])
        }
      }
    }
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (e) { setError(e instanceof Error ? e.message : t.errReanalyze) }
    setReanalyzing(false)
  }

  const saveBudget = async () => {
    if (!active) return
    setSavingBudget(true); setError('')
    try {
      await callStrategy(token, { action: 'update_strategy', strategy_id: active.id, patch: { budget: localBudget } })
      await loadMain()
    } catch (e) { setError(e instanceof Error ? e.message : t.errBudget) }
    setSavingBudget(false)
  }

  const updateGoal = async (goalId: string, patch: Partial<Goal>) => {
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, ...patch } : g))
    try { await callStrategy(token, { action: 'update_goal', goal_id: goalId, patch }) }
    catch (e) { setError(e instanceof Error ? e.message : t.errGoal) }
  }

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>{t.loading}</div>

  return (
    <div>
      {/* Cabeçalho: sempre visível, com "+ Criar estratégia" fixo no canto
          superior direito — criar uma nova enquanto existe uma ativa é um
          pivô consciente (confirmado antes de chamar a API). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          {viewing && (
            <button onClick={() => setViewingId(null)} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '11.5px', cursor: 'pointer', padding: 0, marginBottom: '6px', display: 'block' }}>{t.backMain}</button>
          )}
          {active ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: 800, color: 'white' }}>{active.name}</span>
              <span style={{ fontSize: '9.5px', fontWeight: 800, color: STATUS_COLOR[active.status] ?? MUTED, border: `1px solid ${STATUS_COLOR[active.status] ?? MUTED}55`, borderRadius: '99px', padding: '3px 9px' }}>● {L.STATUS[active.status] ?? active.status}</span>
              {active.kind === 'initiative' && <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#A78BFA', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '99px', padding: '3px 9px' }}>{t.initiativeBadge}</span>}
            </div>
          ) : (
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>{t.agentTitle}</span>
          )}
          {active && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{t.updated} {timeAgo(active.updated_at, lang)}</div>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {active && !viewing && active.status !== 'generating' && active.status !== 'failed' && (
            <button onClick={reanalyze} disabled={reanalyzing} style={ghostBtn}>{reanalyzing ? t.reanalyzing : t.reanalyze}</button>
          )}
          <button onClick={() => createStrategy('main')} disabled={creating || !!generating} style={{ ...primaryBtn, opacity: (creating || !!generating) ? 0.7 : 1, cursor: (creating || !!generating) ? 'default' : 'pointer' }}>
            {creating || generating?.kind === 'main' ? t.generating : main ? t.askNew : t.create}
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '14px' }}>{error}</div>}

      {!active && (
        <div style={{ maxWidth: '560px', padding: '40px 32px', textAlign: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{genError ? '⚠️' : '🧭'}</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
            {creating ? t.creatingFirst : generating ? t.generatingYours : genError ? t.couldNot : t.none}
          </div>
          <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
            {genError || t.noneDesc}
          </p>
          {genError && (
            <button onClick={() => createStrategy('main')} disabled={creating} style={{ ...primaryBtn, marginTop: '14px' }}>{t.retry}</button>
          )}
        </div>
      )}

      {active && (active.status === 'generating' || active.status === 'failed') && (
        <div style={{ maxWidth: '560px', padding: '40px 32px', textAlign: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{active.status === 'failed' ? '⚠️' : '🧭'}</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
            {active.status === 'failed' ? t.initFailed : t.initGenerating}
          </div>
          {active.status === 'failed' && active.reasoning && (
            <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>{active.reasoning}</p>
          )}
        </div>
      )}

      {active && active.status !== 'generating' && active.status !== 'failed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <StrategyBlock title={t.bOverview}><OverviewPanel strategy={active} /></StrategyBlock>
          <HermesGapsPanel company={company} />
          <StrategyBlock title={t.bDomains}><IntelligenceDomainsPanel companyId={company.id} /></StrategyBlock>
          <StrategyBlock title={t.bGoals}><GoalsPanel goals={goals} onUpdate={updateGoal} /></StrategyBlock>
          <StrategyBlock title={t.bBudget}><BudgetPanel budget={localBudget} onChange={setLocalBudget} onSave={saveBudget} saving={savingBudget} /></StrategyBlock>
          <StrategyBlock title={t.bFunnel}><FunnelPanel strategy={active} /></StrategyBlock>
          <StrategyBlock title={t.bEstimates}><EstimatesPanel strategy={active} /></StrategyBlock>
          {!viewing && (
            <StrategyBlock title={t.bInit}>
              <InitiativesPanel initiatives={initiatives} onCreate={() => createStrategy('initiative')} creating={creating} onOpen={setViewingId} />
            </StrategyBlock>
          )}
          <StrategyBlock title={t.bMonitor}>
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
  const { lang } = useLang()
  const t = TX[lang]
  const L = strategyLabels(lang)
  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }
  return (
    <div style={{ maxWidth: '740px' }}>
      {strategy.thesis && (
        <div style={{ ...box, background: 'rgba(255,109,41,0.06)', borderColor: 'rgba(255,109,41,0.2)', borderLeft: `3px solid ${ORANGE}` }}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t.thesis}</div>
          <div style={{ fontSize: '14px', color: 'white', lineHeight: 1.65, fontStyle: 'italic' }}>"{strategy.thesis}"</div>
        </div>
      )}
      {strategy.reasoning && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t.why}</div>
          <div style={{ fontSize: '13px', color: 'white', lineHeight: 1.6 }}>{strategy.reasoning}</div>
        </div>
      )}
      {(strategy.primary_constraint || strategy.strategic_opportunity) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div style={{ ...box, marginBottom: 0, borderColor: 'rgba(248,113,113,0.25)' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: '5px' }}>{t.mainConstraint}</div>
            <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.55 }}>{strategy.primary_constraint || '—'}</div>
          </div>
          <div style={{ ...box, marginBottom: 0, borderColor: 'rgba(74,222,128,0.25)' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', marginBottom: '5px' }}>{t.opportunity}</div>
            <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.55 }}>{strategy.strategic_opportunity || '—'}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.bizObj}</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.primary_business_objective || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.mktObj}</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.primary_marketing_objective || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.focus}</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.strategic_focus || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.horizon}</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.horizon || '—'}</div></div>
        <div style={box}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.cadence}</div><div style={{ fontSize: '13px', color: 'white' }}>{strategy.review_cadence || '—'}</div></div>
      </div>
      {strategy.active_components.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '8px' }}>{t.components}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {strategy.active_components.map(c => (
              <span key={c} style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '99px', padding: '4px 10px' }}>{L.COMPONENT[c] ?? c}</span>
            ))}
          </div>
        </div>
      )}
      {strategy.exclusions.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '7px' }}>{t.exclusions}</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'white', lineHeight: 1.7 }}>{strategy.exclusions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {(strategy.success_conditions || strategy.failure_conditions) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          {strategy.success_conditions && (
            <div style={{ ...box, marginBottom: 0 }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', marginBottom: '5px' }}>{t.workingSigns}</div>
              <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.55 }}>{strategy.success_conditions}</div>
            </div>
          )}
          {strategy.failure_conditions && (
            <div style={{ ...box, marginBottom: 0 }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: '5px' }}>{t.notWorkingSigns}</div>
              <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.55 }}>{strategy.failure_conditions}</div>
            </div>
          )}
        </div>
      )}
      {strategy.assumptions.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '7px' }}>{t.assumptions}</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'white', lineHeight: 1.7 }}>{strategy.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {strategy.constraints.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '7px' }}>{t.constraints}</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'white', lineHeight: 1.7 }}>{strategy.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function GoalsPanel({ goals, onUpdate }: { goals: Goal[]; onUpdate: (id: string, patch: Partial<Goal>) => void }) {
  const { lang } = useLang()
  const t = TX[lang]
  const L = strategyLabels(lang)
  if (!goals.length) return <div style={{ fontSize: '12.5px', color: MUTED }}>{t.noGoals}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '680px' }}>
      {goals.map(g => (
        <div key={g.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{g.name}</div>
              <div style={{ fontSize: '10.5px', color: MUTED }}>{L.GOAL_TYPE[g.goal_type] ?? g.goal_type}{g.period ? ` · ${g.period}` : ''}</div>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 800, color: g.priority === 'high' ? '#f87171' : g.priority === 'low' ? MUTED : '#FBBF24', flexShrink: 0 }}>{t.prio[g.priority] ?? g.priority.toUpperCase()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>{t.baseline}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: g.baseline_verified ? 'white' : MUTED, fontStyle: g.baseline_verified ? 'normal' : 'italic' }}>
                {g.baseline_verified && g.baseline_value != null ? g.baseline_value : t.unknown}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>{t.target}</div>
              <input type="number" value={g.target_value ?? ''} onChange={e => onUpdate(g.id, { target_value: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>{t.progress}</div>
              <input type="number" value={g.current_progress ?? ''} onChange={e => onUpdate(g.id, { current_progress: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          </div>
          {(g.data_source || g.measurement_method) && (
            <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>
              {g.data_source && <div>{t.source}{g.data_source}</div>}
              {g.measurement_method && <div>{t.howMeasure}{g.measurement_method}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
