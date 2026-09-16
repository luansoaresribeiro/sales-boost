import { useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { BORDER, MUTED, D } from './shared'
import CampaignsTab from './CampaignsTab'
import ContentLibrary from './ContentLibrary'
import ContentOverviewTab from './ContentOverviewTab'
import WeeklyCalendarTab from './WeeklyCalendarTab'

const ORANGE = '#FF6D29'

type Mode = 'overview' | 'biblioteca' | 'campanhas' | 'calendario'

// Engagement mudou pra Agente de Conversão (é conversa/atendimento de quem já
// chegou, não criação — fica junto do Funil e do Atendimento). A antiga aba
// "Conteúdo" (Orgânico/Stories soltos) foi removida: Biblioteca (Ideias →
// Testes → Vault) já cobre a criação de verdade, e o Overview/Calendário
// abaixo cobrem o que ela mostrava (o que está pronto/agendado).
// Overview fica mais à ESQUERDA mesmo sendo, no FLUXO, o que vem depois de
// tudo acontecer — é o resumo de chegada, faz sentido ser a 1ª coisa que se vê.
const TABS: { key: Mode; icon: string; label: string; sub: string }[] = [
  { key: 'overview', icon: '🏠', label: 'Overview', sub: 'Agendados, Vault e equilíbrio do funil' },
  { key: 'biblioteca', icon: '📚', label: 'Biblioteca', sub: 'Ideias, formatos, testes e vault' },
  { key: 'campanhas', icon: '🎯', label: 'Campanhas', sub: 'Mídia paga com funil e pixel' },
  { key: 'calendario', icon: '🗓️', label: 'Calendário da Semana', sub: 'Posts e stories da semana' },
]

export default function ContentSection({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city' | 'instagram_user_id' | 'instagram_url'> }) {
  const [mode, setMode] = useState<Mode>('overview')

  return (
    <div>
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {TABS.map(t => <TabButton key={t.key} t={t} active={mode === t.key} onClick={() => setMode(t.key)} />)}
      </div>

      {mode === 'overview' ? <ContentOverviewTab companyId={company.id} onOpenVault={() => setMode('biblioteca')} />
        : mode === 'biblioteca' ? <ContentLibrary companyId={company.id} />
        : mode === 'campanhas' ? <CampaignsTab company={company} />
        : <WeeklyCalendarTab companyId={company.id} />}
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
