import { CARD, MUTED, BORDER, D } from './shared'
import {
  fmtBRL, fmtNum, fmtDelta,
  type GrowthDemoData, type CommandInsight, type CommandInsightKind, type DemoAgentStatus,
} from './growthDemo'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'
const AMBER = '#FBBF24'

// ── KPI tiles ─────────────────────────────────────────────────────────────
interface Kpi { label: string; value: string; delta?: { text: string; positive: boolean }; hint?: string; onClick?: () => void }

function KpiTile({ k }: { k: Kpi }) {
  return (
    <button onClick={k.onClick} disabled={!k.onClick}
      style={{ textAlign: 'left', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', cursor: k.onClick ? 'pointer' : 'default', fontFamily: D }}>
      <div style={{ fontSize: '10.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{k.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '23px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{k.value}</span>
        {k.delta && (
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: k.delta.positive ? GREEN : RED }}>{k.delta.text}</span>
        )}
      </div>
      {k.hint && <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>{k.hint}</div>}
    </button>
  )
}

// ── AI Insights ─────────────────────────────────────────────────────────
const INSIGHT_META: Record<CommandInsightKind, { label: string; icon: string; color: string }> = {
  oportunidade: { label: 'Oportunidade', icon: '💡', color: GREEN },
  problema: { label: 'Problema', icon: '⚠️', color: RED },
  acao_recomendada: { label: 'Ação recomendada', icon: '🎯', color: AMBER },
  acao_executada: { label: 'Já executado', icon: '✅', color: ORANGE },
}

function InsightRow({ ins }: { ins: CommandInsight }) {
  const meta = INSIGHT_META[ins.kind]
  return (
    <div style={{ padding: '12px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', borderLeft: `3px solid ${meta.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{meta.icon} {ins.title}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{meta.label}</span>
      </div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55 }}>{ins.description}</div>
    </div>
  )
}

// ── Agent status ──────────────────────────────────────────────────────────
const AGENT_STATE: Record<DemoAgentStatus['state'], { dot: string; label: string }> = {
  active: { dot: GREEN, label: 'Ativo' },
  idle: { dot: AMBER, label: 'Aguardando você' },
  soon: { dot: 'rgba(255,255,255,0.3)', label: 'Em breve' },
}

// ── Funnel ────────────────────────────────────────────────────────────────
function FunnelBar({ data }: { data: GrowthDemoData }) {
  const max = data.funnel[0]?.count || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {data.funnel.map((s, i) => {
        const pct = Math.max(6, Math.round((s.count / max) * 100))
        const isLast = i === data.funnel.length - 1
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '128px', flexShrink: 0, fontSize: '11.5px', color: isLast ? 'white' : MUTED, fontWeight: isLast ? 700 : 500 }}>{s.label}</span>
            <div style={{ flex: 1, height: '22px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: isLast ? ORANGE : 'rgba(255,109,41,0.35)', borderRadius: '6px', transition: 'width 0.4s' }} />
            </div>
            <span style={{ width: '52px', flexShrink: 0, textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'white' }}>{fmtNum(s.count)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function GrowthCommandCenter({ data, onOpenModule }: { data: GrowthDemoData; onOpenModule: (section: string) => void }) {
  const { kpis } = data
  const dash = (v: number | null, fmt: (n: number) => string) => (v == null ? '—' : fmt(v))
  const delta = (v: number | null) => (v == null ? undefined : fmtDelta(v))

  const tiles: Kpi[] = [
    { label: 'Receita gerada (mês)', value: dash(kpis.revenue, n => fmtBRL(n, true)), delta: delta(kpis.revenueDelta), hint: kpis.revenue == null ? 'Conecte o Meta Ads' : 'atribuída às campanhas' },
    { label: 'Leads capturados', value: fmtNum(kpis.leads), delta: delta(kpis.leadsDelta), onClick: () => onOpenModule('conversao') },
    { label: 'Conversão do funil', value: dash(kpis.funnelConversion, n => `${n}%`), delta: delta(kpis.funnelConversionDelta), hint: 'lead → venda', onClick: () => onOpenModule('conversao') },
    { label: 'ROAS das campanhas', value: dash(kpis.roas, n => `${n}x`), delta: delta(kpis.roasDelta), hint: kpis.adSpend == null ? 'Conecte o Meta Ads' : `investido ${fmtBRL(kpis.adSpend, true)}`, onClick: () => onOpenModule('meta-ads') },
    { label: 'Crescimento Instagram', value: dash(kpis.igFollowers, fmtNum), delta: kpis.igFollowersGained == null ? undefined : { text: `+${fmtNum(kpis.igFollowersGained)}`, positive: true }, hint: kpis.igFollowers == null ? 'Conecte o Instagram' : 'novos seguidores no período', onClick: () => onOpenModule('tracking') },
    { label: 'Engajamento do conteúdo', value: dash(kpis.contentEngagement, n => `${n}%`), delta: delta(kpis.contentEngagementDelta), onClick: () => onOpenModule('content') },
  ]

  const grouped: CommandInsightKind[] = ['problema', 'oportunidade', 'acao_recomendada', 'acao_executada']
  const insightsOrdered = grouped.flatMap(kind => data.insights.filter(i => i.kind === kind))

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        {tiles.map(t => <KpiTile key={t.label} k={t} />)}
      </div>

      {/* Status dos agentes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '26px' }}>
        {data.agents.map(a => {
          const st = AGENT_STATE[a.state]
          return (
            <div key={a.key} title={a.lastAction}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '99px', background: st.dot, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>{a.icon} {a.name}</span>
              <span style={{ fontSize: '10px', color: MUTED }}>· {st.label}</span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        {/* Insights da IA */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>✨ Insights da IA</span>
            <span style={{ fontSize: '10.5px', color: MUTED }}>{data.insights.length} itens</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {insightsOrdered.map(ins => <InsightRow key={ins.id} ins={ins} />)}
          </div>
        </div>

        {/* Funil */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>🔀 Funil de vendas</span>
            <button onClick={() => onOpenModule('funil')} style={{ fontSize: '11px', color: ORANGE, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>Abrir →</button>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 16px' }}>
            <FunnelBar data={data} />
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: MUTED }}>Receita no funil</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: ORANGE }}>{fmtBRL(data.funnel[data.funnel.length - 1]?.value ?? 0, true)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
