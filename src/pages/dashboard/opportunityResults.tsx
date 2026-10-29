import { useLang } from '../../contexts/LanguageContext'
import { MUTED, BORDER } from './marketingAi/shared'
import { attributionCodes, metric, type OppResultRow } from './resultsBrokers'

// Resultados de uma oportunidade aprovada (Etapa 6). Só números com origem rastreável: visitas/cliques/leads vêm do link /p/<código>
// da oportunidade; sem link = "sem dado" (diferente de 0). Valor: só a soma dos informados pelo dono. Nada é inventado.

const TX = {
  pt: {
    title: 'Resultados', pieces: 'Peças aprovadas', visits: 'Visitas à página', clicks: 'Cliques', leads: 'Leads', visitsSched: 'Visitas agendadas',
    proposals: 'Propostas', sales: 'Vendas', value: 'Valor das vendas', noData: 'sem dado', noSales: 'sem vendas ainda', notInformed: 'valor não informado',
    ofWith: (n: number, m: number) => `${n} de ${m} ${m === 1 ? 'venda' : 'vendas'} com valor`, attribution: 'Atribuição',
    fixed: 'Leads que chegam por comentário ou DM ainda não são atribuídos a oportunidades.',
    noLink: 'Esta oportunidade ainda não tem link rastreável (o link entra nas peças quando o imóvel tem página pública no ar).',
  },
  en: {
    title: 'Results', pieces: 'Approved pieces', visits: 'Page visits', clicks: 'Clicks', leads: 'Leads', visitsSched: 'Scheduled visits',
    proposals: 'Proposals', sales: 'Sales', value: 'Sales value', noData: 'no data', noSales: 'no sales yet', notInformed: 'value not informed',
    ofWith: (n: number, m: number) => `${n} of ${m} ${m === 1 ? 'sale' : 'sales'} with a value`, attribution: 'Attribution',
    fixed: 'Leads that arrive by comment or DM are not yet attributed to opportunities.',
    noLink: 'This opportunity has no trackable link yet (the link is added to pieces when the property has a live public page).',
  },
} as const

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: '10px', color: MUTED, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginTop: '2px', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

export default function OpportunityResults({ row, codes }: { row: OppResultRow; codes: string[] }) {
  const { lang } = useLang()
  const t = TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  const hasLink = row.links > 0
  const show = (n: number | null) => (n === null ? t.noData : n.toLocaleString(loc))
  const sales = metric(hasLink, row.vendas)
  const withValue = Number(row.vendas_com_valor ?? 0)
  const total = Number(row.valor_vendas ?? 0)
  let valueText: string
  if (sales === null) valueText = t.noData
  else if (sales === 0) valueText = t.noSales
  else if (withValue === 0) valueText = t.notInformed
  else valueText = `${total.toLocaleString(loc, { style: 'currency', currency: 'BRL' })} · ${t.ofWith(withValue, sales)}`
  const attrib = attributionCodes(codes, row)
  return (
    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, marginBottom: '8px' }}>{t.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
        <Stat label={t.pieces} value={show(Number(row.pecas_aprovadas ?? 0))} />
        <Stat label={t.visits} value={show(metric(hasLink, row.visitas))} />
        <Stat label={t.clicks} value={show(metric(hasLink, row.cliques))} />
        <Stat label={t.leads} value={show(metric(hasLink, row.leads))} />
        <Stat label={t.visitsSched} value={show(metric(hasLink, row.visitas_agendadas))} />
        <Stat label={t.proposals} value={show(metric(hasLink, row.propostas))} />
        <Stat label={t.sales} value={show(sales)} />
        <Stat label={t.value} value={valueText} />
      </div>
      {!hasLink && <div style={{ fontSize: '11px', color: MUTED, marginTop: '8px', lineHeight: 1.5 }}>{t.noLink}</div>}
      {attrib.length > 0 && <div style={{ fontSize: '11px', color: MUTED, marginTop: '8px', overflowWrap: 'anywhere' }}>{t.attribution}: link {attrib.join(', ')}</div>}
      <div style={{ fontSize: '11px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>{t.fixed}</div>
    </div>
  )
}
