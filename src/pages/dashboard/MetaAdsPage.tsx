// Agente de Meta Ads — item próprio no menu esquerdo (fora do fluxo
// Dados → Conteúdo → Conversão do Growth OS). Reaproveita o MetaAdsTab
// existente, só muda onde ele mora.
import { useCompany } from '../../contexts/CompanyContext'
import { MUTED, BORDER, D } from './marketingAi/shared'
import MetaAdsTab from './marketingAi/MetaAdsTab'

export default function MetaAdsPage() {
  const { company, loading } = useCompany()
  if (loading || !company) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>Carregando...</div>

  return (
    <div>
      <div style={{ padding: '20px 32px', borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontFamily: D, fontSize: '14px', fontWeight: 700, color: 'white' }}>🎯 Agente de Meta Ads</span>
      </div>
      <div style={{ padding: '28px 32px' }}>
        <MetaAdsTab company={company} />
      </div>
    </div>
  )
}
