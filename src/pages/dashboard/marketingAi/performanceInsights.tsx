// Seções de inteligência do Performance: conteúdo, formatos, consistência,
// melhor horário, funil, pilares, anomalias, análise da IA, concorrentes,
// recomendações e conexão com o Business Game.
import { useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D } from './shared'
import { PERF_TX, localeOf, FORMAT_EN, FUNNEL_EN, DAY_NAMES_EN } from './performance.i18n'
import { Panel, Heatmap, NotAvailable, DeltaBadge } from './performanceParts'
import {
  metricText, DAY_NAMES, SLOT_NAMES,
  type PerformanceData, type ContentPerf, type ContentFormat, type Recommendation,
} from './performanceDemo'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'
const FMT_ICON: Record<ContentFormat, string> = { reel: '🎬', post: '🖼️', carousel: '🎠', story: '📖' }

// ── Content performance ───────────────────────────────────────────────────
type SortKey = 'reach' | 'engagementRate' | 'shares' | 'saves' | 'comments' | 'followersGained'
const SORTS: { key: SortKey; tk: 'reach' | 'sRate' | 'sharesShort' | 'saves' | 'comments' | 'sFollowersGen' }[] = [
  { key: 'reach', tk: 'reach' }, { key: 'engagementRate', tk: 'sRate' },
  { key: 'shares', tk: 'sharesShort' }, { key: 'saves', tk: 'saves' },
  { key: 'comments', tk: 'comments' }, { key: 'followersGained', tk: 'sFollowersGen' },
]
function ContentCard({ c, rank }: { c: ContentPerf; rank?: number }) {
  const { lang } = useLang()
  const t = PERF_TX[lang]
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>
          {c.thumb ? <img src={c.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} /> : FMT_ICON[c.type]}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rank ? `#${rank} ` : ''}{c.caption}
          </div>
          <div style={{ fontSize: '9.5px', color: MUTED, marginTop: '1px' }}>{FMT_ICON[c.type]} {c.pillar} · {new Date(c.date).toLocaleDateString(localeOf(lang), { day: '2-digit', month: 'short' })}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        <Mini label={t.reach} value={metricText(c.reach)} />
        <Mini label={t.sRate} value={metricText(c.engagementRate, 'pct')} color={ORANGE} />
        <Mini label={t.sharesShort} value={metricText(c.shares)} />
        <Mini label={t.savesShort} value={metricText(c.saves)} />
      </div>
    </div>
  )
}
function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '11.5px', fontWeight: 700, color: color ?? 'white' }}>{value}</div>
    </div>
  )
}
export function ContentSectionPerf({ content }: { content: ContentPerf[] }) {
  const t = PERF_TX[useLang().lang]
  const [sort, setSort] = useState<SortKey>('reach')
  const sorted = [...content].sort((a, b) => Number(b[sort] ?? 0) - Number(a[sort] ?? 0))
  const top = sorted.slice(0, 5)
  const bottom = sorted.slice(-3).reverse()
  if (content.length === 0) return <Panel title={t.contentPerf} icon="🏆"><NotAvailable label={t.noContent} /></Panel>
  return (
    <Panel title={t.contentPerf} icon="🏆" right={
      <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
        style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '11.5px', fontFamily: D, outline: 'none', cursor: 'pointer' }}>
        {SORTS.map(s => <option key={s.key} value={s.key} style={{ background: '#0E0B0A' }}>{t.sortBy} {t[s.tk]}</option>)}
      </select>
    }>
      <div style={{ fontSize: '11px', fontWeight: 700, color: GREEN, marginBottom: '9px' }}>{t.top5}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '9px', marginBottom: '18px' }}>
        {top.map((c, i) => <ContentCard key={c.id} c={c} rank={i + 1} />)}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: RED, marginBottom: '9px' }}>{t.below}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '9px' }}>
        {bottom.map(c => <ContentCard key={c.id} c={c} />)}
      </div>
    </Panel>
  )
}

// ── Content type analysis ─────────────────────────────────────────────────
export function ContentTypeSection({ types, conclusion }: { types: PerformanceData['contentTypes']; conclusion: string }) {
  const { lang } = useLang()
  const tx = PERF_TX[lang]
  const max = Math.max(1, ...types.map(t => Number(t.avgReach ?? 0)))
  return (
    <Panel title={tx.byFormat} icon="🎞️">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {types.filter(t => t.count > 0).map(t => (
          <div key={t.type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>{FMT_ICON[t.type]} {lang === 'en' ? FORMAT_EN[t.type] ?? t.label : t.label} <span style={{ color: MUTED, fontWeight: 400 }}>({t.count})</span></span>
              <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>{tx.avgReachLbl} {metricText(t.avgReach)}</span>
                <DeltaBadge d={{ pct: t.delta, positive: t.delta >= 0 }} small />
              </span>
            </div>
            <div style={{ height: '9px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{ width: `${(Number(t.avgReach ?? 0) / max) * 100}%`, height: '100%', background: ORANGE, borderRadius: '99px' }} />
            </div>
            <div style={{ fontSize: '9.5px', color: MUTED, marginTop: '3px' }}>{tx.avgEng} {metricText(t.avgEng)} · {tx.sharesShort} {metricText(t.avgShares)} · {tx.savesShort} {metricText(t.avgSaves)}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '13px', fontSize: '11.5px', color: 'white', lineHeight: 1.55, background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', padding: '9px 12px' }}>💡 {conclusion}</div>
    </Panel>
  )
}

// ── Consistency + Best time ───────────────────────────────────────────────
export function ConsistencySection({ c }: { c: PerformanceData['consistency'] }) {
  const { lang } = useLang()
  const t = PERF_TX[lang]
  const weeks = c.heatmap.map((_, i) => (i % 3 === 0 ? `${t.weekPrefix}${c.heatmap.length - i}` : ''))
  return (
    <Panel title={t.consistency} icon="🗓️" right={<span style={{ fontSize: '11px', color: MUTED }}>{c.perWeek}{t.perWeek} · {t.recommended} {c.recommendedPerWeek}</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '9px', marginBottom: '14px' }}>
        <MiniStat label={t.pubd} value={String(c.published)} />
        <MiniStat label={t.daysActive} value={String(c.daysActive)} />
        <MiniStat label={t.curStreak} value={`${c.currentStreak} ${t.wk}`} />
        <MiniStat label={t.longStreak} value={`${c.longestStreak} ${t.wk}`} />
      </div>
      <Heatmap grid={c.heatmap} rows={weeks} cols={lang === 'en' ? DAY_NAMES_EN : DAY_NAMES} />
      <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'white', lineHeight: 1.55, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '9px 12px' }}>💡 {c.note}</div>
    </Panel>
  )
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '9px 11px' }}>
      <div style={{ fontSize: '9px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{value}</div>
    </div>
  )
}
export function BestTimeSection({ b }: { b: PerformanceData['bestTime'] }) {
  const { lang } = useLang()
  const t = PERF_TX[lang]
  return (
    <Panel title={t.bestTime} icon="⏰" right={b.enough ? <span style={{ fontSize: '11px', fontWeight: 700, color: ORANGE }}>{b.best}</span> : null}>
      {b.enough ? (
        <>
          <Heatmap grid={b.heatmap} rows={lang === 'en' ? DAY_NAMES_EN : DAY_NAMES} cols={SLOT_NAMES} />
          <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'white', lineHeight: 1.55, background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', padding: '9px 12px' }}>
            💡 {t.bestWindow} <strong>{b.window}</strong>. {t.bestWindowTail}
          </div>
        </>
      ) : <NotAvailable label={t.notEnough} />}
    </Panel>
  )
}

// ── Funnel + Pillars ──────────────────────────────────────────────────────
export function FunnelSection({ funnel, note }: { funnel: PerformanceData['funnel']; note: string }) {
  const { lang } = useLang()
  return (
    <Panel title={PERF_TX[lang].byFunnel} icon="🔀">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {funnel.map(f => {
          const color = f.score >= 80 ? GREEN : f.score >= 60 ? '#8bd450' : f.score >= 40 ? '#FBBF24' : RED
          return (
            <div key={f.stage}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>{lang === 'en' ? FUNNEL_EN[f.stage] ?? f.label : f.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color }}>{f.score}/100</span>
              </div>
              <div style={{ height: '9px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ width: `${f.score}%`, height: '100%', background: color, borderRadius: '99px' }} />
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '13px', fontSize: '11.5px', color: 'white', lineHeight: 1.55, background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', padding: '9px 12px' }}>💡 {note}</div>
    </Panel>
  )
}
export function PillarSection({ pillars }: { pillars: PerformanceData['pillars'] }) {
  const t = PERF_TX[useLang().lang]
  const rows = pillars.filter(p => p.posts > 0)
  const max = Math.max(1, ...rows.map(p => Number(p.avgReach ?? 0)))
  const best = rows.reduce((a, b) => (Number(b.avgReach ?? 0) > Number(a.avgReach ?? 0) ? b : a), rows[0])
  return (
    <Panel title={t.byPillar} icon="🧱" right={best ? <span style={{ fontSize: '11px', color: MUTED }}>{t.best} <strong style={{ color: ORANGE }}>{best.name}</strong></span> : null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {rows.map(p => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11.5px', color: 'white', width: '110px', flexShrink: 0 }}>{p.name} <span style={{ color: MUTED }}>({p.posts})</span></span>
            <div style={{ flex: 1, height: '9px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{ width: `${(Number(p.avgReach ?? 0) / max) * 100}%`, height: '100%', background: p.name === best?.name ? ORANGE : 'rgba(255,255,255,0.25)', borderRadius: '99px' }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', width: '62px', textAlign: 'right' }}>{metricText(p.avgReach)}</span>
            <span style={{ width: '52px', textAlign: 'right' }}><DeltaBadge d={{ pct: p.delta, positive: p.delta >= 0 }} small /></span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── Anomalies ─────────────────────────────────────────────────────────────
const ANOM_COLOR = { opportunity: GREEN, breakout: ORANGE, attention: '#FBBF24' }
export function AnomaliesSection({ anomalies }: { anomalies: PerformanceData['anomalies'] }) {
  const t = PERF_TX[useLang().lang]
  return (
    <Panel title={t.alerts} icon="🔔">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '9px' }}>
        {anomalies.map((a, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${ANOM_COLOR[a.kind]}33`, borderRadius: '11px', padding: '12px 14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: ANOM_COLOR[a.kind], marginBottom: '4px' }}>{a.icon} {a.title}</div>
            <div style={{ fontSize: '11px', color: 'white', lineHeight: 1.5 }}>{a.body}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── AI analysis ───────────────────────────────────────────────────────────
export function AiAnalysisSection({ ai }: { ai: PerformanceData['aiAnalysis'] }) {
  const t = PERF_TX[useLang().lang]
  const items: { k: string; label: string; color: string; text: string }[] = [
    { k: 'working', label: t.aiWorking, color: GREEN, text: ai.working },
    { k: 'notWorking', label: t.aiNot, color: RED, text: ai.notWorking },
    { k: 'why', label: t.aiWhy, color: MUTED, text: ai.why },
    { k: 'opportunity', label: t.aiOpp, color: ORANGE, text: ai.opportunity },
    { k: 'risk', label: t.aiRisk, color: '#FBBF24', text: ai.risk },
    { k: 'next', label: t.aiNext, color: 'white', text: ai.nextAction },
  ]
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,109,41,0.10), rgba(255,109,41,0.02))', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '16px', padding: '18px 20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '13px' }}>{t.aiTitle}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '11px' }}>
        {items.map(it => (
          <div key={it.k}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: it.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{it.label}</div>
            <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.5 }}>{it.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Competitor benchmarking ───────────────────────────────────────────────
export function CompetitorSection({ c }: { c: PerformanceData['competitor'] }) {
  const t = PERF_TX[useLang().lang]
  if (!c.hasData) return <Panel title={t.vsComp} icon="🥊"><NotAvailable label={t.noComp} /></Panel>
  return (
    <Panel title={t.vsComp} icon="🥊" right={<span style={{ fontSize: '9.5px', color: MUTED }}>{t.realEst}</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <BenchRow name={t.you} postsPerWeek={c.you.postsPerWeek} engagement={c.you.engagement} estimated={false} formats={t.yourAccount} highlight />
        {c.rows.map((r, i) => <BenchRow key={i} {...r} />)}
      </div>
      <div style={{ marginTop: '11px', fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>
        {t.compNote1}<strong style={{ color: '#FBBF24' }}>{t.compNoteEst}</strong>{t.compNote2}
      </div>
    </Panel>
  )
}
function BenchRow({ name, postsPerWeek, engagement, estimated, formats, highlight }: { name: string; postsPerWeek: number; engagement: number; estimated: boolean; formats: string; highlight?: boolean }) {
  const t = PERF_TX[useLang().lang]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr', gap: '8px', alignItems: 'center', padding: '10px 13px', background: highlight ? 'rgba(255,109,41,0.08)' : CARD, border: `1px solid ${highlight ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '10px' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color: highlight ? ORANGE : 'white' }}>{name} <span style={{ color: MUTED, fontWeight: 400 }}>{estimated ? '~' : '★'}</span></span>
      <span style={{ fontSize: '11.5px', color: 'white', textAlign: 'right' }}>{postsPerWeek}{t.perWk}</span>
      <span style={{ fontSize: '11.5px', color: 'white', textAlign: 'right' }}>{engagement}%</span>
      <span style={{ fontSize: '10px', color: MUTED, textAlign: 'right' }}>{formats}</span>
    </div>
  )
}

// ── Recommendations ───────────────────────────────────────────────────────
const PRIO_COLOR = { high: RED, medium: '#FBBF24', low: MUTED }
const PRIO_KEY = { high: 'prioHigh', medium: 'prioMed', low: 'prioLow' } as const
export function RecommendationsSection({ recs, onCreate }: { recs: Recommendation[]; onCreate: (r: Recommendation) => void }) {
  const t = PERF_TX[useLang().lang]
  return (
    <Panel title={t.recsTitle} icon="🎯">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '11px' }}>
        {recs.map(r => (
          <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'white' }}>{r.title}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: PRIO_COLOR[r.priority], textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{t[PRIO_KEY[r.priority]]}</span>
            </div>
            <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '5px' }}><strong style={{ color: 'white' }}>{t.reason}</strong> {r.reason}</div>
            <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '5px' }}><strong style={{ color: 'white' }}>{t.action}</strong> {r.action}</div>
            <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '11px' }}><strong style={{ color: 'white' }}>{t.objective}</strong> {r.objective} · <span style={{ color: ORANGE }}>{t.impact} {r.impact}</span></div>
            <button onClick={() => onCreate(r)}
              style={{ marginTop: 'auto', padding: '8px 15px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '11.5px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
              {t.createThis}
            </button>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── Business Game connection ──────────────────────────────────────────────
export function GameSection({ game }: { game: PerformanceData['game'] }) {
  const t = PERF_TX[useLang().lang]
  return (
    <Panel title={t.gameTitle} icon="🎮">
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '12px' }}>
        {t.gameDesc}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '9px' }}>
        {game.map((g, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 13px', background: g.done ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${g.done ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '10px' }}>
            <span style={{ fontSize: '16px' }}>{g.done ? '✅' : g.kind === 'achievement' ? '🏅' : g.kind === 'reward' ? '🎁' : '⭐'}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'white', lineHeight: 1.3 }}>{g.label}</div>
              <div style={{ fontSize: '9.5px', color: g.done ? GREEN : MUTED }}>{g.xp != null ? `+${g.xp} XP` : g.kind === 'achievement' ? t.achievement : t.reward}{g.done ? t.won : t.open}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
