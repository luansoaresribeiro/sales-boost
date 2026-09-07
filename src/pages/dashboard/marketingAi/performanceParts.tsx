// Primitivas visuais + seções "acima da dobra e meio" do Performance.
// (Content/anomalias/IA/recomendações ficam em performanceInsights.tsx.)
import { Fragment, useState } from 'react'
import { CARD, MUTED, BORDER, D } from './shared'
import {
  metricText, deltaOf, HEALTH_META,
  type PerformanceData, type Kpi, type MetricValue, type TrendPoint, type PerformanceScore,
} from './performanceDemo'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'

// ── Primitivas ────────────────────────────────────────────────────────────
export function Panel({ title, icon, right, children, id }: { title: string; icon?: string; right?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>{icon ? `${icon} ` : ''}{title}</span>
        {right}
      </div>
      {children}
    </section>
  )
}

export function DeltaBadge({ d, small }: { d: { pct: number; positive: boolean } | null; small?: boolean }) {
  if (!d) return <span style={{ fontSize: small ? '10px' : '11px', color: 'rgba(255,255,255,0.3)' }}>—</span>
  const color = d.positive ? GREEN : RED
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: small ? '10px' : '11px', fontWeight: 700, color }}>
      {d.positive ? '▲' : '▼'} {d.positive ? '+' : ''}{d.pct}%
    </span>
  )
}

export function InfoTip({ tip }: { tip: { meaning: string; calc: string; matters: string; ifDown: string } }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span style={{ width: '15px', height: '15px', borderRadius: '99px', border: `1px solid ${BORDER}`, color: MUTED, fontSize: '9.5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>i</span>
      {open && (
        <div style={{ position: 'absolute', top: '20px', right: 0, zIndex: 20, width: '250px', background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '11px 13px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
          <Row k="O que é" v={tip.meaning} />
          <Row k="Como calculamos" v={tip.calc} />
          <Row k="Por que importa" v={tip.matters} />
          <Row k="Se estiver caindo" v={tip.ifDown} last />
        </div>
      )}
    </span>
  )
}
function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : '7px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1px' }}>{k}</div>
      <div style={{ fontSize: '10.5px', color: 'white', lineHeight: 1.45 }}>{v}</div>
    </div>
  )
}

// SVG line chart — série atual + (opcional) período anterior tracejado.
export function LineChart({ points, prev, color = ORANGE, height = 150 }: { points: number[]; prev?: number[]; color?: string; height?: number }) {
  const W = 640, H = height, pad = 6
  const all = [...points, ...(prev ?? [])]
  const min = Math.min(...all), max = Math.max(...all)
  const span = max - min || 1
  const toPath = (arr: number[]) => arr.map((v, i) => {
    const x = pad + (i / Math.max(1, arr.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / span) * (H - pad * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {prev && <path d={toPath(prev)} fill="none" stroke={MUTED} strokeWidth="1.4" strokeDasharray="4 4" opacity="0.5" />}
      <path d={`${toPath(points)} L${W - pad},${H} L${pad},${H} Z`} fill="url(#perfFill)" stroke="none" />
      <path d={toPath(points)} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function Heatmap({ grid, rows, cols, max }: { grid: number[][]; rows: string[]; cols: string[]; max?: number }) {
  const hi = max ?? Math.max(1, ...grid.flat())
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: `auto repeat(${cols.length}, 1fr)`, gap: '4px', minWidth: '100%' }}>
        <div />
        {cols.map(c => <div key={c} style={{ fontSize: '9px', color: MUTED, textAlign: 'center' }}>{c}</div>)}
        {rows.map((r, ri) => (
          <Fragment key={`r${ri}`}>
            <div style={{ fontSize: '9.5px', color: MUTED, alignSelf: 'center', paddingRight: '6px' }}>{r}</div>
            {(grid[ri] ?? []).map((v, ci) => {
              const t = v / hi
              return <div key={`${ri}-${ci}`} title={`${r} ${cols[ci]}: ${v}`} style={{ height: '20px', borderRadius: '4px', background: v === 0 ? 'rgba(255,255,255,0.03)' : `rgba(255,109,41,${0.15 + t * 0.75})` }} />
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────────────────
export const RANGES = [
  { key: '7d', label: '7 dias', days: 7 }, { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 }, { key: '6m', label: '6 meses', days: 180 },
] as const
export type RangeKey = typeof RANGES[number]['key']

export function PerfHeader({ d, range, onRange, onSync, syncing }: {
  d: PerformanceData; range: RangeKey; onRange: (r: RangeKey) => void; onSync: () => void; syncing: boolean
}) {
  const h = HEALTH_META[d.health.level]
  const initials = d.username.slice(0, 2).toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '99px', overflow: 'hidden', background: 'linear-gradient(135deg, #FF6D29, #b5471a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: '15px', flexShrink: 0 }}>
          {d.profilePic ? <img src={d.profilePic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>@{d.username}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: MUTED }}>Sincronizado {syncLabel(d.lastSync)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, color: h.color, padding: '2px 8px', border: `1px solid ${h.color}44`, borderRadius: '99px', background: `${h.color}12` }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: h.color }} /> Saúde: {h.label}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => onRange(r.key)}
              style={{ padding: '6px 11px', background: range === r.key ? 'rgba(255,109,41,0.14)' : 'transparent', border: `1px solid ${range === r.key ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '7px', color: range === r.key ? ORANGE : MUTED, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={onSync} disabled={syncing}
          style={{ padding: '8px 14px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '11.5px', border: 'none', borderRadius: '9px', cursor: syncing ? 'default' : 'pointer', fontFamily: D, opacity: syncing ? 0.6 : 1 }}>
          {syncing ? 'Sincronizando…' : '↻ Sincronizar agora'}
        </button>
      </div>
    </div>
  )
}
function syncLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)}d`
}

// ── KPIs executivos ────────────────────────────────────────────────────────
export function KpiCard({ kpi }: { kpi: Kpi }) {
  const d = deltaOf(kpi.value, kpi.prev)
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '7px' }}>
        <span style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
        <InfoTip tip={kpi} />
      </div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: kpi.value == null ? 'rgba(255,255,255,0.4)' : 'white', letterSpacing: '-0.02em' }}>
        {metricText(kpi.value, kpi.format)}
      </div>
      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <DeltaBadge d={d} small />
        {d && <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.35)' }}>vs período anterior</span>}
      </div>
    </div>
  )
}

// ── Score ───────────────────────────────────────────────────────────────
export function ScoreCard({ score }: { score: PerformanceScore }) {
  const [sel, setSel] = useState<string | null>(null)
  const color = score.total >= 80 ? GREEN : score.total >= 60 ? '#8bd450' : score.total >= 40 ? '#FBBF24' : RED
  const R = 52, C = 2 * Math.PI * R
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '22px', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '128px', height: '128px', flexShrink: 0 }}>
        <svg viewBox="0 0 128 128" width="128" height="128">
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
          <circle cx="64" cy="64" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - score.total / 100)} transform="rotate(-90 64 64)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '34px', fontWeight: 900, color: 'white', lineHeight: 1 }}>{score.total}</span>
          <span style={{ fontSize: '10px', color: MUTED }}>/ 100</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 800, color, marginBottom: '10px' }}>{score.label}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {score.components.map(c => (
            <button key={c.key} onClick={() => setSel(sel === c.key ? null : c.key)}
              style={{ textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: D }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: MUTED, width: '96px', flexShrink: 0 }}>{c.label}</span>
                <div style={{ flex: 1, height: '7px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${c.value}%`, height: '100%', background: ORANGE, borderRadius: '99px' }} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', width: '26px', textAlign: 'right' }}>{c.value}</span>
              </div>
              {sel === c.key && <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.5, margin: '5px 0 2px 106px' }}>{c.note}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Trend ───────────────────────────────────────────────────────────────
const TREND_METRICS: { key: keyof TrendPoint; label: string }[] = [
  { key: 'followers', label: 'Seguidores' }, { key: 'reach', label: 'Alcance' },
  { key: 'impressions', label: 'Impressões' }, { key: 'engagement', label: 'Engajamento' },
  { key: 'engagementRate', label: 'Taxa de eng.' }, { key: 'profileVisits', label: 'Visitas ao perfil' },
  { key: 'websiteClicks', label: 'Cliques no link' }, { key: 'published', label: 'Publicações' },
]
export function TrendSection({ trend, days }: { trend: TrendPoint[]; days: number }) {
  const [metric, setMetric] = useState<keyof TrendPoint>('reach')
  const cur = trend.slice(-days)
  const prev = trend.slice(-days * 2, -days)
  const series = cur.map(p => Number(p[metric] ?? 0))
  const prevSeries = prev.length ? prev.map(p => Number(p[metric] ?? 0)) : undefined
  const available = cur.some(p => p[metric] != null)
  const curSum = series.reduce((s, v) => s + v, 0)
  const prevSum = (prevSeries ?? []).reduce((s, v) => s + v, 0)
  const d = prevSum ? deltaOf(curSum, prevSum) : null
  return (
    <Panel title="Tendência de performance" icon="📈" right={
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {d && <DeltaBadge d={d} />}
        <select value={metric} onChange={e => setMetric(e.target.value as keyof TrendPoint)}
          style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '11.5px', fontFamily: D, outline: 'none', cursor: 'pointer' }}>
          {TREND_METRICS.map(m => <option key={m.key} value={m.key} style={{ background: '#0E0B0A' }}>{m.label}</option>)}
        </select>
      </div>
    }>
      {available ? (
        <>
          <LineChart points={series} prev={prevSeries} />
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '10px', color: MUTED }}>
            <span><span style={{ display: 'inline-block', width: '18px', height: '2px', background: ORANGE, verticalAlign: 'middle', marginRight: '5px' }} />Período atual</span>
            <span><span style={{ display: 'inline-block', width: '18px', borderTop: `2px dashed ${MUTED}`, verticalAlign: 'middle', marginRight: '5px' }} />Período anterior</span>
          </div>
        </>
      ) : <NotAvailable label="Esta métrica não está disponível para a conta conectada." />}
    </Panel>
  )
}

export function NotAvailable({ label }: { label?: string }) {
  return (
    <div style={{ padding: '20px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '10px', color: MUTED, fontSize: '11.5px' }}>
      {label ?? 'Não disponível para esta conta.'}
    </div>
  )
}

// ── Audiência + Alcance + Engajamento ─────────────────────────────────────
export function StatLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: '11.5px', color: MUTED }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color: color ?? 'white' }}>{value}</span>
    </div>
  )
}

const MOMENTUM_META: Record<PerformanceData['audience']['momentum'], { label: string; color: string }> = {
  accelerating: { label: 'Acelerando', color: GREEN }, stable: { label: 'Estável', color: '#8bd450' },
  slowing: { label: 'Desacelerando', color: '#FBBF24' }, declining: { label: 'Em queda', color: RED },
}
export function AudienceSection({ a, trend, days }: { a: PerformanceData['audience']; trend: TrendPoint[]; days: number }) {
  const m = MOMENTUM_META[a.momentum]
  return (
    <Panel title="Crescimento de audiência" icon="👥" right={
      <span style={{ fontSize: '11px', fontWeight: 700, color: m.color }}>{a.velocityPerWeek >= 0 ? '+' : ''}{a.velocityPerWeek}/semana · {m.label}</span>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div>
          <StatLine label="Seguidores no início" value={a.start.toLocaleString('pt-BR')} />
          <StatLine label="Seguidores agora" value={a.current.toLocaleString('pt-BR')} />
          <StatLine label="Novos (líquido)" value={`${a.net >= 0 ? '+' : ''}${a.net.toLocaleString('pt-BR')}`} color={a.net >= 0 ? GREEN : RED} />
          <StatLine label="Ganhos / perdidos" value={`+${a.gained.toLocaleString('pt-BR')} / -${a.lost.toLocaleString('pt-BR')}`} />
          <StatLine label="Taxa de crescimento" value={`${a.growthRate >= 0 ? '+' : ''}${a.growthRate}%`} color={a.growthRate >= 0 ? GREEN : RED} />
        </div>
        <div>
          <LineChart points={trend.slice(-days).map(p => p.followers)} height={120} color={GREEN} />
        </div>
      </div>
      <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'white', lineHeight: 1.55, background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', padding: '9px 12px' }}>
        💡 {a.note}
      </div>
    </Panel>
  )
}

export function ReachSection({ r }: { r: PerformanceData['reach'] }) {
  const nf = r.nonFollowerPct
  return (
    <Panel title="Alcance & Descoberta" icon="🔭">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div>
          <StatLine label="Alcance total" value={metricText(r.total)} />
          <StatLine label="Não-seguidores" value={metricText(r.nonFollowers)} color={ORANGE} />
          <StatLine label="Seguidores" value={metricText(r.followers)} />
          <StatLine label="Impressões" value={metricText(r.impressions)} />
          <StatLine label="Alcance médio / conteúdo" value={metricText(r.avgPerContent)} />
          <StatLine label="Crescimento do alcance" value={metricText(r.growth, 'pct')} color={(r.growth ?? 0) >= 0 ? GREEN : RED} />
        </div>
        <div>
          {nf != null ? (
            <>
              <div style={{ fontSize: '11px', color: MUTED, marginBottom: '8px' }}>Seguidores vs não-seguidores</div>
              <div style={{ display: 'flex', height: '30px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                <div style={{ width: `${100 - nf}%`, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white' }}>{100 - nf}%</div>
                <div style={{ width: `${nf}%`, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#000' }}>{nf}%</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: MUTED, marginTop: '5px' }}>
                <span>Seguidores</span><span>Não-seguidores (descoberta)</span>
              </div>
            </>
          ) : <NotAvailable label="Divisão de alcance não disponível para esta conta." />}
        </div>
      </div>
      <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'white', lineHeight: 1.55, background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', padding: '9px 12px' }}>
        💡 {r.insight}
      </div>
    </Panel>
  )
}

export function EngagementSection({ e }: { e: PerformanceData['engagement'] }) {
  const parts: { k: string; label: string; value: MetricValue; delta: number; strong?: boolean }[] = [
    { k: 'likes', label: 'Curtidas', value: e.likes, delta: e.breakdownDelta.likes },
    { k: 'comments', label: 'Comentários', value: e.comments, delta: e.breakdownDelta.comments, strong: true },
    { k: 'shares', label: 'Compart.', value: e.shares, delta: e.breakdownDelta.shares, strong: true },
    { k: 'saves', label: 'Salvamentos', value: e.saves, delta: e.breakdownDelta.saves, strong: true },
  ]
  const maxV = Math.max(1, ...parts.map(p => Number(p.value ?? 0)))
  return (
    <Panel title="Inteligência de engajamento" icon="💬" right={<span style={{ fontSize: '11px', color: MUTED }}>Taxa: <strong style={{ color: 'white' }}>{metricText(e.rate, 'pct')}</strong></span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {parts.map(p => (
          <div key={p.k} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: p.strong ? 'white' : MUTED, width: '92px', flexShrink: 0 }}>
              {p.label}{p.strong && <span title="Sinal de alta intenção" style={{ color: ORANGE }}> ★</span>}
            </span>
            <div style={{ flex: 1, height: '9px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{ width: `${(Number(p.value ?? 0) / maxV) * 100}%`, height: '100%', background: p.strong ? ORANGE : 'rgba(255,255,255,0.25)', borderRadius: '99px' }} />
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', width: '58px', textAlign: 'right' }}>{metricText(p.value)}</span>
            <span style={{ width: '52px', textAlign: 'right' }}><DeltaBadge d={{ pct: p.delta, positive: p.delta >= 0 }} small /></span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'white', lineHeight: 1.55, background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', padding: '9px 12px' }}>
        💡 {e.note} <span style={{ color: MUTED }}>Priorizamos salvamentos, compartilhamentos e comentários (★) por serem sinais de intenção mais alta que curtidas.</span>
      </div>
    </Panel>
  )
}
