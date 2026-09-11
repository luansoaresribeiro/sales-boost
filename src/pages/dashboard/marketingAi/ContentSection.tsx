import { useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { BORDER, MUTED, D } from './shared'
import ContentAgentTab from './ContentAgentTab'
import CampaignsTab from './CampaignsTab'
import StoriesTab from './StoriesTab'
import ContentLibrary from './ContentLibrary'
import EngagementTab from './EngagementTab'

const ORANGE = '#FF6D29'

type Mode = 'conteudo' | 'biblioteca' | 'engagement'
type Sub = 'organico' | 'campanhas' | 'stories'

// Vault e Testes agora vivem dentro de Biblioteca (canônicos, não duplicados
// aqui) — ver ContentLibrary.tsx. Performance saiu daqui — agora mora no
// Agente de Dados (junto com Inteligência de Mercado), acima na sequência.
const TABS: { key: Mode; icon: string; label: string; sub: string }[] = [
  { key: 'conteudo', icon: '✍️', label: 'Conteúdo', sub: 'Orgânico, campanhas e stories' },
  { key: 'biblioteca', icon: '📚', label: 'Biblioteca', sub: 'Ideias, formatos, estilos, testes e vault' },
  { key: 'engagement', icon: '🤝', label: 'Engagement', sub: 'Automação de comentários e DMs' },
]

const SUBTABS: { key: Sub; icon: string; label: string; sub: string }[] = [
  { key: 'organico', icon: '✍️', label: 'Orgânico', sub: 'Calendário, ideias e criativos' },
  { key: 'campanhas', icon: '🎯', label: 'Campanhas', sub: 'Mídia paga com funil (demo)' },
  { key: 'stories', icon: '📖', label: 'Stories', sub: 'Stories + Story Ads (demo)' },
]

// Casa os módulos de conteúdo sob uma única aba "Conteúdo" (orgânico, campanhas
// e stories como sub-opções) + Vault + Biblioteca, e a nova aba Performance
// (centro de inteligência real do Instagram).
export default function ContentSection({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city' | 'instagram_user_id' | 'instagram_url'> }) {
  const [mode, setMode] = useState<Mode>('conteudo')
  const [sub, setSub] = useState<Sub>('organico')

  return (
    <div>
      {/* Abas principais */}
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: mode === 'conteudo' ? '14px' : '22px', flexWrap: 'wrap' }}>
        {TABS.map(t => <TabButton key={t.key} t={t} active={mode === t.key} onClick={() => setMode(t.key)} />)}
      </div>

      {/* Sub-abas aparecem só ao clicar em "Conteúdo" */}
      {mode === 'conteudo' && (
        <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '12px', marginBottom: '22px', marginLeft: '2px', flexWrap: 'wrap' }}>
          {SUBTABS.map(t => <TabButton key={t.key} t={t} active={sub === t.key} onClick={() => setSub(t.key)} />)}
        </div>
      )}

      {mode === 'conteudo' ? (
        sub === 'organico' ? <ContentAgentTab company={company} />
          : sub === 'campanhas' ? <CampaignsTab company={company} />
          : <StoriesTab company={company} />
      ) : mode === 'biblioteca' ? <ContentLibrary companyId={company.id} />
        : <EngagementTab company={company} />}
    </div>
  )
}

function TabButton({ t, active, onClick }: { t: { icon: string; label: string; sub: string }; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 15px', background: active ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${active ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '9px', cursor: 'pointer', fontFamily: D, textAlign: 'left' }}>
      <span style={{ fontSize: '17px' }}>{t.icon}</span>
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: active ? ORANGE : 'white' }}>{t.label}</div>
        <div style={{ fontSize: '10px', color: MUTED }}>{t.sub}</div>
      </div>
    </button>
  )
}
