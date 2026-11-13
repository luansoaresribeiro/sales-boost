import { useNavigate } from 'react-router-dom'
import type { Lang } from '../../../contexts/LanguageContext'
import { barWidths, type Breakdown, type FunnelResult } from '../../../lib/commercialFunnel'
import { CARD, BORDER, MUTED, ORANGE, D } from './shared'
import { FUNNEL_DAYS, type CommercialFunnelState } from './useCommercialFunnel'

// Topo do painel (dono, 2026-11-12): o resultado comercial, não quantos posts saíram. Conteúdo inspirado no print do dono
// (4 números + funil + de onde veio), com o visual que o painel já tem. Só dado real; sem dado = "ainda sem dados".
// "Leads recebidos" ≠ "lead qualificado" (a qualificação ainda não existe — especificação de leads v2, docs/CONVERSION.md).
const TX = {
  pt: {
    title: 'Resultado comercial', win: `últimos ${FUNNEL_DAYS} dias`, views: 'Visualizações dos imóveis', interested: 'Interessados',
    leads: 'Leads recebidos', visits: 'Visitas agendadas', funnel: 'Funil', byItem: 'De onde veio · por imóvel', byPost: 'De onde veio · por publicação',
    viewsHint: 'aberturas da página do imóvel', interestedHint: (c: number, m: number) => `${c} clique${c === 1 ? '' : 's'} no WhatsApp/DM · ${m} comentário${m === 1 ? '' : 's'} com interesse`,
    leadsHint: (f: number, i: number, o: number) => `formulário ${f} · Instagram ${i}${o ? ` · outros ${o}` : ''} — ainda sem regra de qualificação`,
    visitsHint: 'marcadas no Funil', none: 'ainda sem dados', loading: 'Carregando…', error: 'Não foi possível carregar agora.',
    empty: 'Os números aparecem quando a página do imóvel está no ar e as pessoas chegam pelo link (por exemplo, a DM do "Comente QUERO").',
    emptyCta: 'Ver imóveis', noPost: 'Ainda sem leads ligados a uma publicação. Começa pelas DMs do "Comente QUERO".', funnelCta: 'Abrir o Funil',
    cols: ['Visualiz.', 'Interess.', 'Leads', 'Visitas'], demo: 'exemplo',
  },
  en: {
    title: 'Commercial results', win: `last ${FUNNEL_DAYS} days`, views: 'Property page views', interested: 'Interested',
    leads: 'Leads received', visits: 'Visits scheduled', funnel: 'Funnel', byItem: 'Where it came from · by property', byPost: 'Where it came from · by post',
    viewsHint: 'property page opens', interestedHint: (c: number, m: number) => `${c} WhatsApp/DM click${c === 1 ? '' : 's'} · ${m} interested comment${m === 1 ? '' : 's'}`,
    leadsHint: (f: number, i: number, o: number) => `form ${f} · Instagram ${i}${o ? ` · other ${o}` : ''} — no qualification rule yet`,
    visitsHint: 'set in the Funnel', none: 'no data yet', loading: 'Loading…', error: 'Could not load right now.',
    empty: 'Numbers show up once a property page is live and people arrive through its link (e.g. the "Comment WANT" DM).',
    emptyCta: 'See properties', noPost: 'No leads tied to a post yet. It starts with the "Comment WANT" DMs.', funnelCta: 'Open the Funnel',
    cols: ['Views', 'Interest.', 'Leads', 'Visits'], demo: 'example',
  },
} as const

const DEMO: FunnelResult = {
  totals: { views: 1284, interested: 86, leads: 24, visits: 12 }, interestedBy: { clicks: 61, comments: 25 }, leadsBy: { form: 15, instagram: 9, other: 0 },
  byItem: [{ id: 'a', views: 640, interested: 41, leads: 13, visits: 7 }, { id: 'b', views: 420, interested: 30, leads: 8, visits: 4 }],
  byPost: [{ id: 'p', views: 310, interested: 22, leads: 7, visits: 3 }],
}
const DEMO_TITLES = { a: 'Apartamento Ipanema', b: 'Casa Barra da Tijuca', p: 'Carrossel — Apartamento Ipanema' }

const CSS = `
.cf-wrap{margin:24px 32px 0;font-family:${D}}
.cf-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.cf-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
@media (max-width:767px){.cf-wrap{margin:18px 14px 0}.cf-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cf-two{grid-template-columns:1fr}}
`
const box = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', minWidth: 0 } as const
const fmt = (lang: Lang, n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR')

function Tile({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div style={box}>
      <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginTop: '6px' }}>{label}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '4px', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{hint}</div>
    </div>
  )
}

function Table({ title, rows, titles, cols, lang, empty }: { title: string; rows: Breakdown[]; titles: Record<string, string>; cols: readonly string[]; lang: Lang; empty: string }) {
  return (
    <div style={box}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{title}</div>
      {!rows.length ? <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5 }}>{empty}</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(4, 52px)', gap: '6px 8px', fontSize: '12px', alignItems: 'center' }}>
          <span />{cols.map(c => <span key={c} style={{ color: MUTED, fontSize: '10.5px', textAlign: 'right' }}>{c}</span>)}
          {rows.map(r => [
            <span key={`${r.id}t`} style={{ color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={titles[r.id]}>{titles[r.id] ?? '—'}</span>,
            ...[r.views, r.interested, r.leads, r.visits].map((n, i) => <span key={`${r.id}${i}`} style={{ color: i === 2 && n ? ORANGE : 'white', textAlign: 'right', fontWeight: i === 2 ? 800 : 500 }}>{fmt(lang, n)}</span>),
          ])}
        </div>
      )}
    </div>
  )
}

export default function CommercialFunnel({ lang, state, demo }: { lang: Lang; state: CommercialFunnelState; demo: boolean }) {
  const t = TX[lang]
  const navigate = useNavigate()
  const data = demo ? DEMO : state.data
  const itemTitles = demo ? DEMO_TITLES : state.itemTitles
  const postTitles = demo ? DEMO_TITLES : state.postTitles
  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white', margin: 0 }}>{t.title}</h2>
        <span style={{ fontSize: '12px', color: MUTED }}>{t.win}</span>
        {demo && <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: 'rgba(251,191,36,0.12)', color: '#FBBF24', textTransform: 'uppercase' }}>{t.demo}</span>}
      </div>
      <button onClick={() => navigate('/dashboard/marketing-ai/conversao')} style={{ background: 'none', border: 'none', color: ORANGE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D, padding: 0 }}>{t.funnelCta} →</button>
    </div>
  )
  if (!demo && (state.loading || state.error || !data)) {
    return (
      <div className="cf-wrap"><style>{CSS}</style>{header}
        <div style={{ ...box, fontSize: '13px', color: MUTED }} role="status">{state.loading ? t.loading : t.error}</div>
      </div>
    )
  }
  const d = data!
  const allZero = d.totals.views + d.totals.interested + d.totals.leads + d.totals.visits === 0
  const v = (n: number) => (allZero ? '—' : fmt(lang, n))
  const w = barWidths(d.totals)
  const steps: [string, number, number][] = [[t.views, d.totals.views, w.views], [t.interested, d.totals.interested, w.interested], [t.leads, d.totals.leads, w.leads], [t.visits, d.totals.visits, w.visits]]
  return (
    <div className="cf-wrap"><style>{CSS}</style>{header}
      <div className="cf-tiles">
        <Tile value={v(d.totals.views)} label={t.views} hint={allZero ? t.none : t.viewsHint} />
        <Tile value={v(d.totals.interested)} label={t.interested} hint={allZero ? t.none : t.interestedHint(d.interestedBy.clicks, d.interestedBy.comments)} />
        <Tile value={v(d.totals.leads)} label={t.leads} hint={allZero ? t.none : t.leadsHint(d.leadsBy.form, d.leadsBy.instagram, d.leadsBy.other)} />
        <Tile value={v(d.totals.visits)} label={t.visits} hint={allZero ? t.none : t.visitsHint} />
      </div>
      {allZero ? (
        <div style={{ ...box, marginTop: '12px', fontSize: '12.5px', color: MUTED, lineHeight: 1.55 }}>
          {t.empty}{' '}
          <button onClick={() => navigate('/dashboard/catalogo')} style={{ background: 'none', border: 'none', color: ORANGE, fontWeight: 700, cursor: 'pointer', fontFamily: D, fontSize: '12.5px', padding: 0 }}>{t.emptyCta} →</button>
        </div>
      ) : (
        <>
          <div style={{ ...box, marginTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{t.funnel}</div>
            {steps.map(([label, n, width]) => (
              <div key={label} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'white', marginBottom: '5px' }}><span>{label}</span><span style={{ color: MUTED }}>{fmt(lang, n)}</span></div>
                <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${width}%`, height: '100%', borderRadius: '99px', background: ORANGE }} />
                </div>
              </div>
            ))}
          </div>
          <div className="cf-two">
            <Table title={t.byItem} rows={d.byItem} titles={itemTitles} cols={t.cols} lang={lang} empty={t.none} />
            <Table title={t.byPost} rows={d.byPost} titles={postTitles} cols={t.cols} lang={lang} empty={t.noPost} />
          </div>
        </>
      )}
    </div>
  )
}
