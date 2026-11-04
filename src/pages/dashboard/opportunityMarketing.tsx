import { MarketingCard } from './marketingAi/ResultBlocks'
import { useOpportunityMarketing } from './marketingAi/resultsData'

// Lado Marketing do card da oportunidade (Fase 5): posts.opportunity_id + métricas do Instagram. O lado Comercial é o bloco
// "Resultados" (opportunity_results). Não soma os dois nem dá nota única.
export default function OpportunityMarketing({ companyId, oppId }: { companyId: string; oppId: string }) {
  const d = useOpportunityMarketing(companyId, oppId)
  return <MarketingCard block={d.state === 'done' ? d.value : 'loading'} scope="opp" />
}
