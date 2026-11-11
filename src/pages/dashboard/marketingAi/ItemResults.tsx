import { useLang } from '../../../contexts/LanguageContext'
import { MUTED } from './shared'
import { MarketingCard, CommercialCard } from './ResultBlocks'
import { useItemResults } from './resultsData'
import { leftOutLines } from './resultsModel'

// "Resultado do imóvel" (Fase 5): dentro da "Atividade do imóvel". Marketing (posts.item_id + métricas do Instagram) e Comercial
// (leads.item_id + conversas por media_ref) em dois blocos, sem soma entre eles e sem nota única. Ver resultsModel.ts.

export default function ItemResults({ itemId, companyId, enabled }: { itemId: string; companyId: string; enabled: boolean }) {
  const { lang } = useLang()
  const d = useItemResults(companyId, itemId, enabled)
  const v = d.state === 'done' ? d.value : null
  const left = v ? leftOutLines(v.postsNoItem, v.leadsNoOrigin, lang) : []
  return (
    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>{lang === 'en' ? 'Listing result' : 'Resultado do imóvel'}</div>
      <MarketingCard block={v ? v.marketing : 'loading'} scope="item" />
      <CommercialCard block={v ? v.commercial : 'loading'} />
      <div style={{ fontSize: '10px', color: MUTED, marginTop: '3px' }}>{lang === 'en' ? 'Leads linked only to an opportunity (no listing) appear on the opportunity card.' : 'Leads ligados só a uma oportunidade (sem imóvel) aparecem no card da oportunidade.'}</div>
      {left.map(l => <div key={l} style={{ fontSize: '10px', color: MUTED, marginTop: '3px' }}>{l}</div>)}
    </div>
  )
}
