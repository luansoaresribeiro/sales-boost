import { useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { BORDER, MUTED, D } from './shared'
import ContentLibrary from './ContentLibrary'
import ContentOverviewTab from './ContentOverviewTab'
import WeeklyCalendarTab from './WeeklyCalendarTab'

const ORANGE = '#FF6D29'

type Mode = 'calendario' | 'overview' | 'biblioteca'

// Engagement mudou pra Agente de Conversão (é conversa/atendimento de quem já
// chegou, não criação). Campanhas mudou pra dentro de Agente de Meta Ads
// (junto da Performance real da conta). A antiga aba "Conteúdo" (Orgânico/
// Stories soltos) foi removida — Biblioteca (Ideias→Formatos→Testes→Vault)
// já cobre a criação de verdade.
// Calendário da Semana fica mais à ESQUERDA (1ª aba) — é o ponto de partida
// real do fluxo (decide o que vai ser feito, com base nas Ideias que também
// moraram pra dentro dela). Overview, mesmo sendo o que vem DEPOIS no fluxo
// (resumo do que já saiu), fica logo ao lado — é o "e aí, como estamos".
const TABS: { key: Mode; icon: string; label: string; sub: string }[] = [
  { key: 'calendario', icon: '🗓️', label: 'Calendário da Semana', sub: 'Ideias, planejamento e stories/posts da semana' },
  { key: 'overview', icon: '🏠', label: 'Overview', sub: 'Agendados, Vault e equilíbrio do funil' },
  { key: 'biblioteca', icon: '📚', label: 'Biblioteca', sub: 'Ideias, formatos, testes e vault' },
]

export default function ContentSection({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city' | 'instagram_user_id' | 'instagram_url'> }) {
  const [mode, setMode] = useState<Mode>('calendario')

  return (
    <div>
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {TABS.map(t => <TabButton key={t.key} t={t} active={mode === t.key} onClick={() => setMode(t.key)} />)}
      </div>

      {mode === 'calendario' ? <WeeklyCalendarTab companyId={company.id} />
        : mode === 'overview' ? <ContentOverviewTab companyId={company.id} onOpenVault={() => setMode('biblioteca')} />
        : <ContentLibrary companyId={company.id} />}
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
