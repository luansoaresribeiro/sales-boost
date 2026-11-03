import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../../../contexts/LanguageContext'
import { MUTED, BORDER, D, ORANGE, CARD } from './shared'
import type { DecisionKpis as Kpis } from './useDecisionKpis'
import type { FlowSummary } from './useFlowSummary'

// Bloco de decisão do hub (Fase 1 do plano pós-validação, 2026-11-03): 4 indicadores com regra fixa e visível + "Status da coleta"
// recolhido. Sem dado (carregando ou erro) = "sem dado ainda", nunca 0 fingido. Em modo demonstração os números vêm de buildDecisionDemo.
const TX = {
  pt: {
    title: 'Para decidir agora', window: 'janela de 7 dias', noData: 'sem dado ainda', demoTag: 'exemplo',
    k1: 'Sinais relevantes', r1: 'Sinais com fonte e data dos últimos 7 dias (já filtrados e sem repetição na coleta).',
    k2: 'Oportunidades para avaliar', r2: 'Oportunidades aguardando a sua decisão (aprovar ou descartar).', n2: (n: number) => `${n} nova${n === 1 ? '' : 's'} em 7 dias`,
    k3: 'Direcionamento ativo', r3: 'Estratégias principais com status ativo.', none3: 'Nenhuma estratégia ativa — clique para criar.',
    k4: 'Ações prontas', r4: 'Peças originais que passaram na nota e aguardam sua aprovação, ainda não agendadas (adaptações não contam de novo).', n4: (b: number) => `+ ${b} em revisão (ainda não passaram na nota)`,
    cStatus: 'Status da coleta', cHint: 'contagens do que o sistema coletou — abre com clique',
    cSignals: (n: number, a: number | null) => `${n} sinal${n === 1 ? '' : 'is'} de mercado${a ? ` (${a} automático${a === 1 ? '' : 's'})` : ''}`,
    cRun: (d: string) => `última rodada de oportunidades ${d}`, cNoRun: 'ainda sem rodada de oportunidades', cNone: 'sem dado ainda',
  },
  en: {
    title: 'To decide now', window: '7-day window', noData: 'no data yet', demoTag: 'example',
    k1: 'Relevant signals', r1: 'Signals with source and date from the last 7 days (already filtered and de-duplicated at collection).',
    k2: 'Opportunities to review', r2: 'Opportunities waiting for your decision (approve or dismiss).', n2: (n: number) => `${n} new in 7 days`,
    k3: 'Active direction', r3: 'Main strategies with active status.', none3: 'No active strategy — click to create one.',
    k4: 'Ready actions', r4: 'Original pieces that passed the quality score and await your approval, not yet scheduled (adaptations are not counted again).', n4: (b: number) => `+ ${b} in review (not yet past the quality score)`,
    cStatus: 'Collection status', cHint: 'counts of what the system collected — click to open',
    cSignals: (n: number, a: number | null) => `${n} market signal${n === 1 ? '' : 's'}${a ? ` (${a} automatic)` : ''}`,
    cRun: (d: string) => `last opportunity run ${d}`, cNoRun: 'no opportunity run yet', cNone: 'no data yet',
  },
} as const

interface Tile { key: string; label: string; value: string | null; sub?: string | null; rule: string; to: string }

export default function DecisionKpis({ lang, kpis, loading, demo, strategyName, flow }: {
  lang: Lang; kpis: Kpis; loading: boolean; demo: boolean; strategyName: string | null; flow: FlowSummary
}) {
  const t = TX[lang]
  const navigate = useNavigate()
  const [openColl, setOpenColl] = useState(false)
  const v = (n: number | null) => (loading || n == null ? null : String(n))
  const stratN = kpis.strategiesActive
  const tiles: Tile[] = [
    { key: 'signals', label: t.k1, value: v(kpis.signals7), rule: t.r1, to: '/dashboard/marketing-ai/dados?sub=mercado' },
    { key: 'opps', label: t.k2, value: v(kpis.oppsSuggested), sub: kpis.oppsNew7 != null && !loading ? t.n2(kpis.oppsNew7) : null, rule: t.r2, to: '/dashboard/opportunities' },
    { key: 'strategy', label: t.k3, value: v(stratN), sub: stratN === 0 && !loading ? t.none3 : strategyName, rule: t.r3, to: '/dashboard/marketing-ai/estrategia' },
    { key: 'actions', label: t.k4, value: v(kpis.actionsReady), sub: kpis.actionsVault != null && kpis.actionsReady != null && !loading ? t.n4(kpis.actionsVault) : null, rule: t.r4, to: '/dashboard/aprovacoes' },
  ]
  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  const coll: string[] = []
  if (flow.signals != null) coll.push(t.cSignals(flow.signals, flow.autoSignals))
  if (flow.lastOppAt) coll.push(t.cRun(new Date(flow.lastOppAt).toLocaleDateString(locale)))
  else if (flow.oppsApproved != null) coll.push(t.cNoRun)
  return (
    <div style={{ margin: '24px 32px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.title}</span>
        <span style={{ fontSize: '11px', color: MUTED }}>· {t.window}</span>
        {demo && <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#FBBF24', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '99px', padding: '2px 8px', textTransform: 'uppercase' }}>{t.demoTag}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {tiles.map(k => (
          <button key={k.key} onClick={() => navigate(k.to)}
            style={{ textAlign: 'left', cursor: 'pointer', fontFamily: D, background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,109,41,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</span>
            {k.value != null
              ? <span style={{ fontSize: '28px', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>{k.value}</span>
              : <span style={{ fontSize: '14px', fontWeight: 700, color: MUTED, lineHeight: 1.8 }}>{t.noData}</span>}
            {k.sub && <span style={{ fontSize: '12px', color: ORANGE, fontWeight: 700 }}>{k.sub}</span>}
            <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.45, marginTop: 'auto', paddingTop: '4px' }}>{k.rule}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: '12px' }}>
        <button onClick={() => setOpenColl(o => !o)} aria-expanded={openColl}
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: D, color: MUTED, fontSize: '12px', fontWeight: 700 }}>
          {openColl ? '▾' : '▸'} {t.cStatus} <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>— {t.cHint}</span>
        </button>
        {openColl && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {coll.length ? coll.map(c => <span key={c}>{c}</span>) : <span style={{ color: MUTED }}>{t.cNone}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
