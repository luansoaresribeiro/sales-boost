import { useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import type { Lang } from '../../../contexts/LanguageContext'
import { MUTED, ORANGE } from './shared'
import { MARKET_WINDOW_DAYS, type IgPost, type MarketDay } from './useBentoSeries'

// Gráficos do Bento (2026-11-07): SVG/HTML feitos à mão, sem biblioteca. Só desenham número que veio do banco — dia sem coleta fica
// em branco (nunca se interpola). Animação curta de entrada (CSS) some com prefers-reduced-motion. Toque/mouse mostra o valor exato.
export const C_MAIN = ORANGE
export const C_AMBER = '#FBBF24'
export const C_GRAPH = '#8A8178'   // grafite claro (legível sobre o fundo do cartão)
export const C_SOFT = '#FFB88A'    // laranja claro

const TX = {
  pt: {
    accepted: 'Aceitas', discarded: 'Descartadas', noRun: 'sem coleta neste dia', notMeasured: 'não medido', win: `últimos ${MARKET_WINDOW_DAYS} dias`,
    thin: 'ainda sem histórico suficiente', thinN: (n: number) => `${n} dia${n === 1 ? '' : 's'} com coleta`, noMarket: 'Nenhuma coleta nos últimos 30 dias',
    marketCap: 'Notícias por dia (soma das coletas)', total: 'total', none: 'nenhum registro ainda', oppsWin: 'todas as oportunidades da empresa',
    reach: 'Alcance', inter: 'Interações', avg: 'média da conta', avgOf: (n: number) => `média dos últimos ${n} posts medidos`, nd: 'não disponível',
    post: 'post', reel: 'reel', carousel: 'carrossel', story: 'story',
  },
  en: {
    accepted: 'Accepted', discarded: 'Discarded', noRun: 'no collection that day', notMeasured: 'not measured', win: `last ${MARKET_WINDOW_DAYS} days`,
    thin: 'not enough history yet', thinN: (n: number) => `${n} day${n === 1 ? '' : 's'} with a collection`, noMarket: 'No collection in the last 30 days',
    marketCap: 'News per day (sum of collections)', total: 'total', none: 'no records yet', oppsWin: 'all of the company\'s opportunities',
    reach: 'Reach', inter: 'Interactions', avg: 'account average', avgOf: (n: number) => `average of the last ${n} measured posts`, nd: 'not available',
    post: 'post', reel: 'reel', carousel: 'carousel', story: 'story',
  },
} as const
export const chartText = (lang: Lang) => TX[lang]

const CSS = `
@keyframes bc-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes bc-fade{from{opacity:0}to{opacity:1}}
@keyframes bc-x{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes bc-y{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.bc-draw{stroke-dasharray:1;stroke-dashoffset:0;animation:bc-draw .6s ease-out both}
.bc-fade{animation:bc-fade .6s ease-out .15s both}
.bc-x{transform-origin:left center;animation:bc-x .6s cubic-bezier(.2,.8,.2,1) both}
.bc-y{transform-origin:center bottom;animation:bc-y .6s cubic-bezier(.2,.8,.2,1) both}
@media (prefers-reduced-motion:reduce){.bc-draw,.bc-fade,.bc-x,.bc-y{animation:none}}
`
const tipStyle: CSSProperties = { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', minHeight: '18px', lineHeight: 1.45 }
const hint: CSSProperties = { fontSize: '11.5px', color: MUTED, lineHeight: 1.45 }

/** Envolve o gráfico: impede que o toque/clique no gráfico abra o link do cartão (o toque serve pra ver o valor). */
export function ChartBox({ children }: { children: ReactNode }) {
  return <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} style={{ cursor: 'default', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}><style>{CSS}</style>{children}</div>
}
export function Legend({ items }: { items: { color: string; label: string; value?: string | number | null }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
      {items.map(i => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'rgba(255,255,255,0.8)' }}>
          <span aria-hidden="true" style={{ width: '9px', height: '9px', borderRadius: '3px', background: i.color }} />{i.label}{i.value != null && <strong style={{ color: 'white' }}>{i.value}</strong>}
        </span>
      ))}
    </div>
  )
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtDay = (k: string, lang: Lang) => { const [, m, d] = k.split('-'); return lang === 'en' ? `${m}/${d}` : `${d}/${m}` }

// 1) Mercado — linha/área: aceitas (laranja, com gradiente) × descartadas (grafite). Só liga pontos de dias vizinhos com coleta.
const W = 320, H = 92, PX = 8, PT = 8, PB = 8
export function MarketSparkline({ days, lang }: { days: MarketDay[]; lang: Lang }) {
  const t = TX[lang]
  const [now] = useState(() => Date.now())
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const N = MARKET_WINDOW_DAYS
  const keys = Array.from({ length: N }, (_, i) => dayKey(new Date(now - (N - 1 - i) * 24 * 3600_000)))
  const byDay = new Map(days.map(d => [d.day, d]))
  const vals = days.flatMap(d => [d.accepted ?? 0, d.discarded ?? 0])
  const max = Math.max(1, ...vals)
  const x = (i: number) => PX + (i / (N - 1)) * (W - 2 * PX)
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB)
  const build = (pick: (d: MarketDay) => number | null) => {
    const runs: { i: number; v: number }[][] = []
    let cur: { i: number; v: number }[] = []
    keys.forEach((k, i) => { const v = byDay.has(k) ? pick(byDay.get(k)!) : null; if (v == null) { if (cur.length) runs.push(cur); cur = [] } else cur.push({ i, v }) })
    if (cur.length) runs.push(cur)
    return runs
  }
  const line = (r: { i: number; v: number }[]) => r.map((p, j) => `${j ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const series = [
    { runs: build(d => d.accepted), color: C_MAIN, area: true, id: 'a' },
    { runs: build(d => d.discarded), color: C_GRAPH, area: false, id: 'd' },
  ]
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect(); if (!r || !r.width) return
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(N - 1, Math.round(((px - PX) / (W - 2 * PX)) * (N - 1)))))
  }
  const hk = hover != null ? keys[hover] : null
  const hd = hk ? byDay.get(hk) : null
  const v = (n: number | null | undefined) => (n == null ? t.notMeasured : n)
  const tip = hk ? (hd ? `${fmtDay(hk, lang)} · ${t.accepted}: ${v(hd.accepted)} · ${t.discarded}: ${v(hd.discarded)}` : `${fmtDay(hk, lang)} · ${t.noRun}`) : null
  const thin = days.length < 3
  return (
    <ChartBox>
      <div style={tipStyle} aria-live="polite">{tip ?? <span style={hint}>{t.marketCap}</span>}</div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${t.marketCap} — ${t.win}`} style={{ display: 'block', touchAction: 'pan-y', overflow: 'visible' }}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id="bc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C_MAIN} stopOpacity="0.38" /><stop offset="100%" stopColor={C_MAIN} stopOpacity="0" /></linearGradient></defs>
        {[0, 0.5, 1].map(f => <line key={f} x1={PX} x2={W - PX} y1={PT + f * (H - PT - PB)} y2={PT + f * (H - PT - PB)} stroke="rgba(255,255,255,0.07)" strokeDasharray="2 4" />)}
        {series.map(s => s.runs.map((r, ri) => r.length > 1 ? (
          <g key={`${s.id}${ri}`}>
            {s.area && <path className="bc-fade" d={`${line(r)} L${x(r[r.length - 1].i).toFixed(1)} ${H - PB} L${x(r[0].i).toFixed(1)} ${H - PB} Z`} fill="url(#bc-area)" />}
            <path className="bc-draw" pathLength={1} d={line(r)} fill="none" stroke={s.color} strokeWidth={s.area ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : null))}
        {series.map(s => s.runs.flat().map(p => <circle key={`${s.id}${p.i}`} className="bc-fade" cx={x(p.i)} cy={y(p.v)} r={s.area ? 3 : 2.4} fill={s.color} stroke="#150E08" strokeWidth="1" />))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}><span>{fmtDay(keys[0], lang)}</span><span>{t.win}</span><span>{fmtDay(keys[N - 1], lang)}</span></div>
      <Legend items={[{ color: C_MAIN, label: t.accepted }, { color: C_GRAPH, label: t.discarded }]} />
      {thin && <div style={{ ...hint, color: C_AMBER }}>{t.thinN(days.length)} — {t.thin}</div>}
    </ChartBox>
  )
}

// 2/3) Barra empilhada com cantos arredondados; cada trecho cresce da esquerda. Valor exato ao passar o mouse/tocar.
export interface Seg { label: string; value: number; color: string }
export function StackBar({ segs, lang, note, emptyText }: { segs: Seg[]; lang: Lang; note?: string; emptyText?: string }) {
  const t = TX[lang]
  const [hover, setHover] = useState<string | null>(null)
  const total = segs.reduce((a, s) => a + s.value, 0)
  const sel = segs.find(s => s.label === hover)
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`
  return (
    <ChartBox>
      {total === 0
        ? <div style={hint}>{emptyText ?? t.none}</div>
        : <>
          <div style={tipStyle} aria-live="polite">{sel ? `${sel.label}: ${sel.value} (${pct(sel.value)})` : <span style={hint}>{t.total}: <strong style={{ color: 'white' }}>{total}</strong></span>}</div>
          <div role="img" aria-label={segs.map(s => `${s.label}: ${s.value}`).join(', ')} style={{ display: 'flex', height: '16px', gap: '3px', borderRadius: '99px', overflow: 'hidden' }}>
            {segs.filter(s => s.value > 0).map(s => (
              <div key={s.label} className="bc-x" tabIndex={0} onPointerEnter={() => setHover(s.label)} onPointerDown={() => setHover(s.label)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(s.label)} onBlur={() => setHover(null)}
                style={{ flex: s.value, minWidth: '6px', background: s.color, opacity: hover && hover !== s.label ? 0.45 : 1, transition: 'opacity .2s', borderRadius: '6px' }} />
            ))}
          </div>
        </>}
      <Legend items={segs.map(s => ({ color: s.color, label: `${s.label}: `, value: s.value }))} />
      {note && <div style={hint}>{note}</div>}
    </ChartBox>
  )
}

// 4) Instagram — barras por post + linha tracejada da média da própria conta (nunca meta inventada).
type Metric = 'reach' | 'inter'
const interOf = (p: IgPost) => (p.likes == null && p.comments == null && p.shares == null && p.saves == null ? null : (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0))
export function IgBars({ posts, lang }: { posts: IgPost[]; lang: Lang }) {
  const t = TX[lang]
  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  const [metric, setMetric] = useState<Metric>('reach')
  const [hover, setHover] = useState<number | null>(null)
  const val = (p: IgPost) => (metric === 'reach' ? p.reach : interOf(p))
  const measured = posts.map(val).filter((v): v is number => v != null)
  const max = Math.max(1, ...measured)
  const avg = measured.length ? measured.reduce((a, b) => a + b, 0) / measured.length : null
  const fmt = (n: number) => Math.round(n).toLocaleString(locale)
  const typeLabel = (ty: string | null) => (ty && ty in t ? (t as Record<string, unknown>)[ty] as string : ty ?? '')
  const date = (p: IgPost) => (p.at ? fmtDay(dayKey(new Date(p.at)), lang) : '—')
  const hp = hover != null ? posts[hover] : null
  const tip = hp ? `${date(hp)}${hp.type ? ` · ${typeLabel(hp.type)}` : ''} · ${t.reach}: ${hp.reach == null ? t.nd : fmt(hp.reach)} · ${t.inter}: ${interOf(hp) == null ? t.nd : fmt(interOf(hp)!)}` : null
  const BARH = 104
  const tabs: [Metric, string][] = [['reach', t.reach], ['inter', t.inter]]
  return (
    <ChartBox>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ ...tipStyle, flex: '1 1 160px' }} aria-live="polite">{tip ?? <span style={hint}>{avg != null ? `${t.avg}: ` : ''}{avg != null && <strong style={{ color: 'white' }}>{fmt(avg)}</strong>}</span>}</div>
        <div role="tablist" style={{ display: 'inline-flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', padding: '3px' }}>
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={metric === k} onClick={() => setMetric(k)}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', fontWeight: 800, padding: '4px 11px', borderRadius: '99px', background: metric === k ? C_MAIN : 'transparent', color: metric === k ? 'white' : MUTED }}>{l}</button>
          ))}
        </div>
      </div>
      <div key={metric} style={{ position: 'relative', height: `${BARH}px`, display: 'flex', alignItems: 'flex-end', gap: '5px', borderBottom: '1px solid rgba(255,255,255,0.1)' }} onPointerLeave={() => setHover(null)}>
        {avg != null && <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avg / max) * (BARH - 6)}px`, borderTop: `1.5px dashed ${C_AMBER}`, opacity: 0.85, pointerEvents: 'none', zIndex: 2 }} />}
        {posts.map((p, i) => {
          const v = val(p)
          return (
            <div key={p.id} tabIndex={0} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              style={{ flex: '1 1 0', minWidth: 0, maxWidth: '44px', height: '100%', display: 'flex', alignItems: 'flex-end', margin: '0 auto' }}>
              <div className="bc-y" style={{ width: '100%', height: v == null ? '3px' : `${Math.max(3, (v / max) * (BARH - 6))}px`, borderRadius: '6px 6px 2px 2px', animationDelay: `${i * 30}ms`,
                background: v == null ? 'rgba(255,255,255,0.15)' : `linear-gradient(180deg, ${C_MAIN}, ${C_SOFT})`, opacity: hover != null && hover !== i ? 0.5 : 1, transition: 'opacity .2s' }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}><span>{date(posts[0])}</span><span>{date(posts[posts.length - 1])}</span></div>
      <Legend items={[{ color: C_MAIN, label: metric === 'reach' ? t.reach : t.inter }, { color: C_AMBER, label: avg != null ? t.avgOf(measured.length) : t.avg }]} />
    </ChartBox>
  )
}
