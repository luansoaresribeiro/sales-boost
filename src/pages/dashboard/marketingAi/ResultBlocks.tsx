import { useLang } from '../../../contexts/LanguageContext'
import { MUTED, BORDER } from './shared'
import { show, type MarketingBlock, type CommercialBlock } from './resultsModel'

// Blocos de resultado da Fase 5 (Marketing × Comercial), sempre separados, sem nota única e sem soma entre eles.
// Estados (regra 5): carregando / ausência / dado real / "Não foi possível verificar" (nunca "0" nem "sem resultado" no lugar de falha).

const TX = {
  pt: {
    mkt: 'Marketing (Instagram)', com: 'Comercial (leads e conversas)', loading: 'Carregando…', error: 'Não foi possível verificar', noData: 'sem dado', noMeasure: 'sem medição',
    posts: 'Posts publicados', reach: 'Alcance', saves: 'Salvamentos', shares: 'Compartilhamentos', likes: 'Curtidas', comments: 'Comentários',
    convs: 'Conversas', leads: 'Leads', visits: 'Visitas', proposals: 'Propostas', sales: 'Vendas', value: 'Valor informado',
    absentItem: 'Nenhuma peça publicada ligada a este imóvel', absentOpp: 'Nenhuma peça publicada ligada a esta oportunidade',
    noMetric: (n: number) => `${n} ${n === 1 ? 'post publicado ainda sem métrica do Instagram' : 'posts publicados ainda sem métrica do Instagram'} (fora das somas).`,
    metricsErr: 'Métricas do Instagram: não foi possível verificar.', convsErr: 'Conversas: não foi possível verificar.',
    convsNote: 'Conversas = comentários com intenção detectada nos posts publicados deste imóvel (uma por pessoa por post); DMs ainda não são registradas.',
    ofWith: (n: number, m: number) => `${n} de ${m} ${m === 1 ? 'venda' : 'vendas'} com valor informado`,
    rule: 'Ligação por imóvel/oportunidade, não por peça: o lado comercial não diz qual peça gerou cada lead.',
  },
  en: {
    mkt: 'Marketing (Instagram)', com: 'Commercial (leads and conversations)', loading: 'Loading…', error: 'Could not verify', noData: 'no data', noMeasure: 'not measured',
    posts: 'Published posts', reach: 'Reach', saves: 'Saves', shares: 'Shares', likes: 'Likes', comments: 'Comments',
    convs: 'Conversations', leads: 'Leads', visits: 'Visits', proposals: 'Proposals', sales: 'Sales', value: 'Reported value',
    absentItem: 'No published piece linked to this listing', absentOpp: 'No published piece linked to this opportunity',
    noMetric: (n: number) => `${n} published ${n === 1 ? 'post' : 'posts'} without Instagram metrics yet (left out of the sums).`,
    metricsErr: 'Instagram metrics: could not verify.', convsErr: 'Conversations: could not verify.',
    convsNote: 'Conversations = comments with detected intent on this listing\'s published posts (one per person per post); DMs are not recorded yet.',
    ofWith: (n: number, m: number) => `${n} of ${m} ${m === 1 ? 'sale' : 'sales'} with a reported value`,
    rule: 'Linked by listing/opportunity, not by piece: the commercial side does not say which piece produced each lead.',
  },
} as const

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '6px 8px', minWidth: 0 }}>
      <div style={{ fontSize: '9.5px', color: MUTED, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginTop: '1px', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '6px', marginTop: '4px' }
const head: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }
const note: React.CSSProperties = { fontSize: '10px', color: MUTED, marginTop: '4px', lineHeight: 1.45 }
const warn: React.CSSProperties = { fontSize: '10.5px', color: '#FBBF24', marginTop: '4px' }

export function MarketingCard({ block, scope }: { block: MarketingBlock | 'loading'; scope: 'item' | 'opp' }) {
  const { lang } = useLang()
  const t = TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={head}>{t.mkt}</div>
      {block === 'loading' ? <div style={{ fontSize: '10.5px', color: MUTED }}>{t.loading}</div>
        : block.state === 'error' ? <div role="status" style={warn}>{t.error}</div>
        : block.state === 'absent' ? <div style={{ fontSize: '10.5px', color: MUTED }}>{scope === 'item' ? t.absentItem : t.absentOpp}</div>
        : <>
          <div style={grid}>
            <Stat label={t.posts} value={show(block.posts, t.noMeasure, loc)} />
            <Stat label={t.reach} value={show(block.metricsError ? null : block.reach, t.noMeasure, loc)} />
            <Stat label={t.saves} value={show(block.metricsError ? null : block.saves, t.noMeasure, loc)} />
            <Stat label={t.shares} value={show(block.metricsError ? null : block.shares, t.noMeasure, loc)} />
            <Stat label={t.likes} value={show(block.metricsError ? null : block.likes, t.noMeasure, loc)} />
            <Stat label={t.comments} value={show(block.metricsError ? null : block.comments, t.noMeasure, loc)} />
          </div>
          {block.metricsError && <div role="status" style={warn}>{t.metricsErr}</div>}
          {!block.metricsError && (block.postsWithoutMetric ?? 0) > 0 && <div style={note}>{t.noMetric(block.postsWithoutMetric ?? 0)}</div>}
        </>}
    </div>
  )
}

export function CommercialCard({ block, extra }: { block: CommercialBlock | 'loading'; extra?: React.ReactNode }) {
  const { lang } = useLang()
  const t = TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  let valueText: string = t.noData
  if (block !== 'loading' && block.vendas !== null) {
    if (block.vendas === 0) valueText = t.noData
    else if (block.valor === null) valueText = t.noData
    else valueText = block.valor.toLocaleString(loc, { style: 'currency', currency: 'BRL' })
  }
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={head}>{t.com}</div>
      {block === 'loading' ? <div style={{ fontSize: '10.5px', color: MUTED }}>{t.loading}</div>
        : block.state === 'error' ? <div role="status" style={warn}>{t.error}</div>
        : <>
          <div style={grid}>
            <Stat label={t.convs} value={show(block.conversas, t.noData, loc)} />
            <Stat label={t.leads} value={show(block.leads, t.noData, loc)} />
            <Stat label={t.visits} value={show(block.visitas, t.noData, loc)} />
            <Stat label={t.proposals} value={show(block.propostas, t.noData, loc)} />
            <Stat label={t.sales} value={show(block.vendas, t.noData, loc)} />
            <Stat label={t.value} value={valueText} />
          </div>
          {block.conversasError && <div role="status" style={warn}>{t.convsErr}</div>}
          {block.valor !== null && block.vendas !== null && block.vendasComValor !== null && <div style={note}>{t.ofWith(block.vendasComValor, block.vendas)}</div>}
          <div style={note}>{t.convsNote}</div>
          {extra}
        </>}
      <div style={note}>{t.rule}</div>
    </div>
  )
}
