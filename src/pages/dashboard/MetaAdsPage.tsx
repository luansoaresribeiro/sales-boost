// Agente de Meta Ads — item próprio no menu esquerdo (fora do fluxo
// Dados → Conteúdo → Conversão do Growth OS). Performance (real, conta
// conectada) + Campanhas (o Estrategista de Mídia Paga, com funil/pixel/
// ideias de conteúdo/story ads) moraram pra cá juntas — as duas são "mídia
// paga na Meta", faz sentido viver no mesmo agente.
import { useState } from 'react'
import { useCompany } from '../../contexts/CompanyContext'
import { MUTED, BORDER, D } from './marketingAi/shared'
import MetaAdsTab from './marketingAi/MetaAdsTab'
import CampaignsTab from './marketingAi/CampaignsTab'

const ORANGE = '#FF6D29'

export default function MetaAdsPage() {
  const { company, loading } = useCompany()
  const [sub, setSub] = useState<'performance' | 'campanhas'>('performance')
  if (loading || !company) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>Carregando...</div>

  return (
    <div>
      <div style={{ padding: '20px 32px', borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontFamily: D, fontSize: '14px', fontWeight: 700, color: 'white' }}>🎯 Agente de Meta Ads</span>
      </div>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px', marginBottom: '22px' }}>
          <SubTabButton active={sub === 'performance'} onClick={() => setSub('performance')} icon="📊" label="Performance" />
          <SubTabButton active={sub === 'campanhas'} onClick={() => setSub('campanhas')} icon="📣" label="Campanhas" />
        </div>
        {sub === 'performance' ? <MetaAdsTab company={company} /> : <CampaignsTab company={company} />}
      </div>
    </div>
  )
}

function SubTabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: active ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${active ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: active ? ORANGE : 'white' }}>{label}</span>
    </button>
  )
}
