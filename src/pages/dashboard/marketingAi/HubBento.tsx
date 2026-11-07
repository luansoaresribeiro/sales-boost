import { useState, type CSSProperties, type MouseEvent, type ReactNode, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../../../contexts/LanguageContext'
import { MUTED, D, ORANGE, CARD } from './shared'
import type { DecisionKpis } from './useDecisionKpis'
import type { FlowSummary } from './useFlowSummary'
import type { AttentionData, Row } from './useAttention'
import { TX as ATX, ROUTE } from './AttentionBlock'
import { TX as KTX, decisionTiles } from './DecisionKpis'
import { useMarketChanges } from './useMarketChanges'
import { changesText, demoChanges, describeChanges, ignoredLine } from './marketChanges'

// Bento do topo do Marketing AI (C.1, 2026-11-07): só reorganiza o que já existia — mesmos hooks, mesmos números, nenhuma métrica nova.
// Cada cartão leva à tela de origem e mantém seus estados (carregando · erro · ausência · valor). Demo: dado de exemplo com etiqueta.
const TX = {
  pt: {
    next: 'Próxima ação', approvals: 'Aprovações pendentes', approvalsHint: 'peças prontas para você aprovar', market: 'O que mudou no mercado', opps: 'Oportunidades',
    direction: 'Direcionamento', open: 'Abrir', noData: 'sem dado ainda', loading: 'Verificando…', error: 'Não foi possível verificar', demoTag: 'exemplo',
    lastSignal: 'Último sinal válido', collect: 'Status da coleta', collectHint: 'abre com clique', win: 'janela de 7 dias',
    cSignals: (n: number, a: number | null) => `${n} sinal${n === 1 ? '' : 'is'} de mercado${a ? ` (${a} automático${a === 1 ? '' : 's'})` : ''}`,
    cRun: (d: string) => `última rodada de oportunidades ${d}`, cNoRun: 'ainda sem rodada de oportunidades',
    objective: 'Objetivo',
  },
  en: {
    next: 'Next action', approvals: 'Pending approvals', approvalsHint: 'pieces ready for you to approve', market: 'What changed in the market', opps: 'Opportunities',
    direction: 'Direction', open: 'Open', noData: 'no data yet', loading: 'Checking…', error: 'Could not verify', demoTag: 'example',
    lastSignal: 'Latest valid signal', collect: 'Collection status', collectHint: 'click to open', win: '7-day window',
    cSignals: (n: number, a: number | null) => `${n} market signal${n === 1 ? '' : 's'}${a ? ` (${a} automatic)` : ''}`,
    cRun: (d: string) => `last opportunity run ${d}`, cNoRun: 'no opportunity run yet',
    objective: 'Objective',
  },
} as const

const CSS = `
.hb-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px;margin:24px 32px 0}
.hb-s8{grid-column:span 8}.hb-s6{grid-column:span 6}.hb-s4{grid-column:span 4}.hb-s3{grid-column:span 3}.hb-s12{grid-column:span 12}
.hb-card{position:relative;min-width:0;border-radius:14px;font-family:${D};text-align:left;color:white;display:flex}
.hb-card.hb-link{cursor:pointer}
.hb-layer{position:absolute;inset:0;border-radius:14px;pointer-events:none;transition:opacity .45s}
.hb-face{position:absolute;inset:1px;border-radius:13px;overflow:hidden;background:${CARD};pointer-events:none}
.hb-face>div{position:absolute;inset:0;transition:opacity .45s}
.hb-in{position:relative;z-index:1;display:flex;flex-direction:column;gap:6px;padding:16px 18px;width:100%;min-width:0}
.hb-clip{overflow-wrap:anywhere}
@media (max-width:767px){
  .hb-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 14px 0;gap:10px}
  .hb-s8,.hb-s6,.hb-s4,.hb-s12{grid-column:span 2}.hb-s3{grid-column:span 1}
  .hb-in{padding:14px}
}
@media (prefers-reduced-motion:reduce){.hb-layer,.hb-face>div{display:none}}
`

const lbl: CSSProperties = { fontSize: '11px', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }
const sub: CSSProperties = { fontSize: '12px', color: MUTED, lineHeight: 1.45 }
const RGB = '255, 109, 41' // laranja Sales Boost
const GRID = 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)'

// Casca de cada cartão (estrutura do GlowCard da referência TechStackBento): borda fraca + borda acesa, spotlight e grade fraca
// que seguem o cursor (ou o dedo, no celular). Com prefers-reduced-motion as camadas ficam ocultas (CSS) — só o cartão estático.
function Card({ cls, to, label, tag, children }: { cls: string; to?: string | null; label: string; tag?: string | false; children: ReactNode }) {
  const navigate = useNavigate()
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)
  const link = !!to
  const moveTo = (x: number, y: number, el: HTMLElement) => { const r = el.getBoundingClientRect(); setPos({ x: x - r.left, y: y - r.top }) }
  const touch = (e: TouchEvent<HTMLDivElement>) => { const t = e.touches[0]; if (t) { moveTo(t.clientX, t.clientY, e.currentTarget); setActive(true) } }
  const op = { opacity: active ? 1 : 0 }
  const mask = `radial-gradient(200px circle at ${pos.x}px ${pos.y}px, black, transparent 75%)`
  const nav = link ? { role: 'link', tabIndex: 0, onClick: () => navigate(to!), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') navigate(to!) } } : {}
  return (
    <div className={`hb-card ${cls}${link ? ' hb-link' : ''}`} {...nav}
      onMouseMove={(e: MouseEvent<HTMLDivElement>) => moveTo(e.clientX, e.clientY, e.currentTarget)}
      onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
      onTouchStart={touch} onTouchMove={touch} onTouchEnd={() => setActive(false)}
      onFocus={() => setActive(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(false) }}>
      <div aria-hidden="true" className="hb-layer" style={{ background: BORDER_DIM }} />
      <div aria-hidden="true" className="hb-layer" style={{ ...op, background: `radial-gradient(220px circle at ${pos.x}px ${pos.y}px, rgba(${RGB}, 0.9), transparent 70%)` }} />
      <div aria-hidden="true" className="hb-face">
        <div style={{ ...op, background: `radial-gradient(340px circle at ${pos.x}px ${pos.y}px, rgba(${RGB}, 0.12), transparent 65%)` }} />
        <div style={{ ...op, backgroundImage: GRID, backgroundSize: '26px 26px', maskImage: mask, WebkitMaskImage: mask }} />
      </div>
      <div className="hb-in">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span style={lbl}>{label}</span>
          {tag && <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#FBBF24', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '99px', padding: '2px 8px', textTransform: 'uppercase' }}>{tag}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}
const BORDER_DIM = 'rgba(255,255,255,0.10)'

export default function HubBento({ lang, companyId, kpis, kpisLoading, demo, attention, flow, strategyName, strategyObjective, strategyLoading, strategyError, revenue }: {
  lang: Lang; companyId: string; kpis: DecisionKpis; kpisLoading: boolean; demo: boolean; attention: AttentionData; flow: FlowSummary
  strategyName: string | null; strategyObjective: string; strategyLoading: boolean; strategyError: boolean; revenue: ReactNode
}) {
  const t = TX[lang]
  const at = ATX[lang]
  const kt = KTX[lang]
  const ct = changesText(lang)
  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  const loading = demo ? false : kpisLoading
  const { state: mc } = useMarketChanges(companyId, !demo)
  const [openColl, setOpenColl] = useState(false)
  const tag = demo && t.demoTag
  const fmt = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(locale) }
  const generic = (r: Row<unknown>) => (r.state === 'loading' ? t.loading : r.state === 'error' ? t.error : null)
  const muted = (s: string) => <div style={{ ...sub, fontSize: '13px' }}>{s}</div>

  // Próxima ação (mesma regra e texto do bloco "O que merece sua atenção")
  const { next, opportunity, direction, signal } = attention
  const nextKind = next.value?.kind
  const nextAlert = next.state === 'value' && nextKind !== 'ok'
  const nextSub = nextKind === 'approve' && next.value?.count ? at.approveN(next.value.count) : null

  // KPIs
  const tiles = decisionTiles(lang, kpis, loading, strategyName)
  const actions = tiles.find(x => x.key === 'actions')!
  const kpiTiles = tiles

  // Mercado
  const coll: string[] = []
  if (flow.signals != null) coll.push(t.cSignals(flow.signals, flow.autoSignals))
  if (flow.lastOppAt) coll.push(t.cRun(new Date(flow.lastOppAt).toLocaleDateString(locale)))
  else if (flow.oppsApproved != null) coll.push(t.cNoRun)
  let marketBody: ReactNode
  if (demo) { const d = demoChanges(); marketBody = <>{[...describeChanges(d.changes, lang), ignoredLine(d.systemIgnored, lang)].map(l => <div key={l} className="hb-clip" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{l}</div>)}</> }
  else if (mc.status === 'loading') marketBody = muted(ct.loading)
  else if (mc.status === 'error') marketBody = <div style={{ fontSize: '13px', color: '#FBBF24' }}>{ct.error}</div>
  else if (mc.status === 'empty') marketBody = <>{muted(ct.empty)}<div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{ignoredLine(mc.systemIgnored, lang)}</div></>
  else marketBody = <>{[...describeChanges(mc.changes, lang), ignoredLine(mc.systemIgnored, lang)].map(l => <div key={l} className="hb-clip" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{l}</div>)}</>
  const signalLine = generic(signal) ?? (signal.state === 'empty' ? at.noSignal : `${signal.value!.source} · ${fmt(signal.value!.date)}`)

  // Oportunidades
  const oppTile = tiles.find(x => x.key === 'opps')!
  const oppText = generic(opportunity) ?? (opportunity.state === 'empty' ? at.noOpp : at.oppN(opportunity.value!.count))

  // Direcionamento
  const dirText = generic(direction) ?? (direction.state === 'empty' ? (direction.why === 'no_strategy' ? at.noStrat : at.noCentral) : direction.value!.text)
  const stratLine = strategyLoading ? t.loading : strategyError ? t.error : strategyName

  return (
    <>
      <style>{CSS}</style>
      <div className="hb-grid">
        <Card cls="hb-s8" label={t.next} tag={tag} to={next.state === 'value' ? ROUTE[nextKind!] : null}>
          <div className="hb-clip" style={{ fontSize: '1.45rem', fontWeight: 900, lineHeight: 1.25, color: nextAlert ? ORANGE : 'white', marginTop: '4px' }}>{generic(next) ?? at.nexts[nextKind!]}</div>
          {nextSub && <div style={sub}>{nextSub}</div>}
          {next.state === 'value' && <span style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '12px', fontWeight: 800, color: ORANGE }}>{t.open} →</span>}
        </Card>

        <Card cls="hb-s4" label={t.approvals} tag={tag} to="/dashboard/aprovacoes">
          {actions.value != null
            ? <span style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1.1 }}>{actions.value}</span>
            : <span style={{ fontSize: '14px', fontWeight: 700, color: MUTED, lineHeight: 1.8 }}>{loading ? t.loading : t.noData}</span>}
          {actions.value != null && <div style={sub}>{t.approvalsHint}</div>}
          {actions.sub && <div style={{ fontSize: '12px', color: ORANGE, fontWeight: 700 }}>{actions.sub}</div>}
        </Card>

        {kpiTiles.map(k => (
          <Card key={k.key} cls="hb-s3" label={k.label} tag={tag} to={k.to}>
            {k.value != null
              ? <span style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1.1 }}>{k.value}</span>
              : <span style={{ fontSize: '14px', fontWeight: 700, color: MUTED, lineHeight: 1.8 }}>{kt.noData}</span>}
            {k.sub && <span className="hb-clip" style={{ fontSize: '12px', color: ORANGE, fontWeight: 700 }}>{k.sub}</span>}
            <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.45, marginTop: 'auto', paddingTop: '4px' }}>{k.rule}</span>
          </Card>
        ))}

        <Card cls="hb-s6" label={t.market} tag={tag} to="/dashboard/marketing-ai/dados?sub=mercado">
          {marketBody}
          <div style={{ ...sub, marginTop: '4px' }}>{t.lastSignal}: <span style={{ color: 'rgba(255,255,255,0.85)' }}>{signalLine}</span></div>
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} style={{ marginTop: 'auto', paddingTop: '6px' }}>
            <button onClick={() => setOpenColl(o => !o)} aria-expanded={openColl}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: D, color: MUTED, fontSize: '12px', fontWeight: 700 }}>
              {openColl ? '▾' : '▸'} {t.collect} <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>— {t.collectHint}</span>
            </button>
            {openColl && <div style={{ marginTop: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.7)', display: 'flex', gap: '4px 14px', flexWrap: 'wrap' }}>
              {coll.length ? coll.map(c => <span key={c}>{c}</span>) : <span style={{ color: MUTED }}>{t.noData}</span>}
            </div>}
          </div>
        </Card>

        <Card cls="hb-s6" label={t.opps} tag={tag} to="/dashboard/opportunities">
          {oppTile.value != null
            ? <span style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1.1 }}>{oppTile.value}</span>
            : <span style={{ fontSize: '14px', fontWeight: 700, color: MUTED, lineHeight: 1.8 }}>{loading ? t.loading : t.noData}</span>}
          <div className="hb-clip" style={{ fontSize: '13px', fontWeight: 700, color: opportunity.state === 'value' ? ORANGE : 'white', lineHeight: 1.4 }}>{oppText}</div>
          {opportunity.value?.title && <div className="hb-clip" style={sub}>{opportunity.value.title}</div>}
          {oppTile.sub && <div style={sub}>{oppTile.sub}</div>}
        </Card>

        <Card cls="hb-s12" label={t.direction} tag={tag} to="/dashboard/marketing-ai/estrategia">
          <div className="hb-clip" style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.4 }}>{dirText}</div>
          {stratLine && <div className="hb-clip" style={sub}>{stratLine}</div>}
          {strategyObjective && !strategyLoading && !strategyError && <div className="hb-clip" style={sub}>{t.objective}: {strategyObjective}</div>}
        </Card>

        <div className="hb-s12" style={{ minWidth: 0 }}>{revenue}</div>
      </div>
    </>
  )
}
