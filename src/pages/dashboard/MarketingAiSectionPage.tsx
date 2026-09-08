import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useMarketingAiData } from './marketingAi/useMarketingAiData'
import { CARD, MUTED, BORDER, D, PILLAR_ICON, IMPACT_COLOR, IMPACT_LABEL, timeAgo, type ActivityLogRow, type Insight, type TrackingSnapshot, type MarketingAiConfig } from './marketingAi/shared'
import TrackingTab from './marketingAi/TrackingTab'
import ContentSection from './marketingAi/ContentSection'
import MarketIntelTab from './marketingAi/MarketIntelTab'
import BrainTab from './marketingAi/BrainTab'
import TimelineTab from './marketingAi/TimelineTab'
import ReportsTab from './marketingAi/ReportsTab'
import ExperimentsTab from './marketingAi/ExperimentsTab'
import ToolsTab from './marketingAi/ToolsTab'
import ConnectionsTab from './marketingAi/ConnectionsTab'
import MetaAdsTab from './marketingAi/MetaAdsTab'
import FunnelTab from './marketingAi/FunnelTab'
import WhatsAppTab from './marketingAi/WhatsAppTab'
import FeedbackLoopTab from './marketingAi/FeedbackLoopTab'
import ReviewsAgentTab from './marketingAi/ReviewsAgentTab'
import InsightsTab from './marketingAi/InsightsTab'
import BusinessContextTab from './marketingAi/BusinessContextTab'
import MetaHealthTab from './marketingAi/MetaHealthTab'
import { buildGrowthDemo } from './marketingAi/growthDemo'

const ORANGE = '#FF6D29'

const SECTION_TITLE: Record<string, string> = {
  tracking: 'Tracking', content: 'Conteúdo', competitors: 'Inteligência de Mercado', brain: 'Aprendizado',
  overview: 'Visão Geral', experiments: 'Experimentos', tools: 'Configuração', timeline: 'Central de Execução', reports: 'Relatórios',
  conexoes: 'Conexões', 'meta-ads': 'Agente de Meta Ads', funil: 'Funil de Vendas', whatsapp: 'Atendimento', feedback: 'Feedback Loop', configuracao: 'Configuração dos Agentes', avaliacoes: 'Avaliações', insights: 'Insights', context: 'Contexto do Negócio', 'saude-meta': 'Saúde da Meta',
}
const SECTION_ICON: Record<string, string> = {
  tracking: '📈', content: '✍️', competitors: '🧭', brain: '🧠',
  overview: '🏠', experiments: '🧪', tools: '🛠️', timeline: '🕓', reports: '📊',
  conexoes: '🔌', 'meta-ads': '🎯', funil: '🔀', whatsapp: '💬', feedback: '🔁', configuracao: '⚙️', avaliacoes: '⭐', insights: '💡', context: '🧠', 'saude-meta': '❤️‍🩹',
}

// Seções do Growth OS que funcionam em modo demonstração, sem depender da
// ativação/config do Marketing AI feita pela equipe.
const DEMO_SECTIONS = new Set(['overview', 'conexoes', 'meta-ads', 'funil', 'whatsapp', 'feedback', 'content', 'competitors', 'configuracao', 'avaliacoes', 'insights', 'context', 'saude-meta'])

export default function MarketingAiSectionPage() {
  const { section } = useParams<{ section: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { company } = useCompany()
  const data = useMarketingAiData(company?.id)

  if (!company || data.loading) {
    return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>Carregando...</div>
  }

  if (!section || !SECTION_TITLE[section]) return <Navigate to="/dashboard/marketing-ai" replace />
  // A configuração dos agentes (autonomia/objetivo) foi consolidada em
  // Configurações → Agentes, o lar único de config do cliente. Deep links
  // antigos pra cá redirecionam pra lá.
  if (section === 'configuracao') return <Navigate to="/dashboard/settings?tab=agentes" replace />
  // Conexões e Contexto do Negócio foram consolidados em Configurações.
  if (section === 'conexoes') return <Navigate to="/dashboard/settings?tab=conexoes" replace />
  if (section === 'context') return <Navigate to="/dashboard/settings?tab=contexto" replace />

  const accessToken = session?.access_token ?? ''
  const pendingContent = data.content.filter(c => c.status === 'idea' || c.status === 'draft').length
  const proposedStrategy = data.strategyLog.filter(s => s.status === 'proposed').length

  const requiresActivation = !DEMO_SECTIONS.has(section) && !data.config
  const goHome = () => navigate('/dashboard/marketing-ai')

  const render = () => {
    if (requiresActivation) {
      return (
        <div style={{ padding: '48px 32px', textAlign: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', margin: '28px 32px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>Marketing AI ainda não foi ativado</div>
          <div style={{ fontSize: '12.5px', color: MUTED, maxWidth: '420px', margin: '0 auto' }}>
            A ativação é feita pela equipe Sales Boost, configurando a marca, o público e os concorrentes. Fale com a gente pra ativar.
          </div>
        </div>
      )
    }
    switch (section) {
      case 'overview':
        return (
          <OverviewSection
            config={data.config} snapshots={data.snapshots} insights={data.insights} pendingContent={pendingContent}
            proposedStrategy={proposedStrategy} activity={data.activity} onNavigate={s => navigate(`/dashboard/marketing-ai/${s}`)}
          />
        )
      case 'tracking':
        return <TrackingTab accessToken={accessToken} snapshots={data.snapshots} insights={data.insights.filter(i => i.pillar === 'tracking')} hasInstagram={!!company.instagram_url} onRefresh={data.refresh} />
      case 'content':
        return <ContentSection company={company} />
      case 'competitors':
        return <MarketIntelTab company={company} />
      case 'brain':
        return <BrainTab nodes={data.brainNodes} accessToken={accessToken} strategyLog={data.strategyLog} onRefresh={data.refresh} />
      case 'experiments':
        return <ExperimentsTab accessToken={accessToken} experiments={data.experiments} onRefresh={data.refresh} />
      case 'tools':
        return <ToolsTab companyId={company.id} tools={data.toolRegistry} configs={data.toolConfigs} onRefresh={data.refresh} />
      case 'timeline':
        return <TimelineTab activity={data.activity} />
      case 'reports':
        return <ReportsTab accessToken={accessToken} insights={data.insights} strategyLog={data.strategyLog} reports={data.reports} onRefresh={data.refresh} />
      case 'conexoes':
        return <ConnectionsTab connections={buildGrowthDemo(company).connections} />
      case 'meta-ads':
        return <MetaAdsTab company={company} />
      case 'funil':
        return <FunnelTab company={company} />
      case 'whatsapp':
        return <WhatsAppTab company={company} />
      case 'feedback':
        return <FeedbackLoopTab company={company} />
      case 'avaliacoes':
        return <ReviewsAgentTab company={company} />
      case 'insights':
        return <InsightsTab company={company} />
      case 'context':
        return <BusinessContextTab company={company} />
      case 'saude-meta':
        return <MetaHealthTab company={company} />
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ padding: '20px 32px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button onClick={goHome}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: D, flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = ORANGE; e.currentTarget.style.borderColor = 'rgba(255,109,41,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER }}>
          ← Voltar
        </button>
        <span style={{ fontFamily: D, fontSize: '14px', fontWeight: 700, color: 'white' }}>{SECTION_ICON[section]} {SECTION_TITLE[section]}</span>
      </div>
      <div style={{ padding: section === 'overview' ? 0 : '28px 32px' }}>
        {render()}
      </div>
    </div>
  )
}

function OverviewSection({
  config, snapshots, insights, pendingContent, proposedStrategy, activity, onNavigate,
}: {
  config: MarketingAiConfig | null; snapshots: TrackingSnapshot[]; insights: Insight[]
  pendingContent: number; proposedStrategy: number; activity: ActivityLogRow[]; onNavigate: (s: string) => void
}) {
  const latest = snapshots[0]
  const topInsights = insights.slice(0, 5)

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Seguidores" value={latest?.followers ?? '—'} onClick={() => onNavigate('tracking')} />
        <StatCard label="Conteúdo esperando aprovação" value={pendingContent} onClick={() => onNavigate('content')} highlight={pendingContent > 0} />
        <StatCard label="Recomendações novas" value={proposedStrategy} onClick={() => onNavigate('brain')} highlight={proposedStrategy > 0} />
        <StatCard label="Concorrentes monitorados" value={config?.competitors.length ?? 0} onClick={() => onNavigate('competitors')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>Insights em aberto</div>
          {topInsights.length === 0 ? (
            <div style={{ color: MUTED, fontSize: '12.5px' }}>Nenhum insight aberto agora.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {topInsights.map(ins => (
                <div key={ins.id} style={{ padding: '10px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>{PILLAR_ICON[ins.pillar]} {ins.title}</span>
                    {ins.impact && <span style={{ fontSize: '9px', fontWeight: 700, color: IMPACT_COLOR[ins.impact], flexShrink: 0 }}>{IMPACT_LABEL[ins.impact]}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{ins.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>Atividade recente</div>
          {activity.length === 0 ? (
            <div style={{ color: MUTED, fontSize: '12.5px' }}>Nenhuma atividade ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activity.slice(0, 5).map(a => (
                <div key={a.id} style={{ padding: '10px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'white' }}>{PILLAR_ICON[a.pillar ?? ''] ?? '🤖'} {a.action}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, onClick, highlight }: { label: string; value: number | string; onClick: () => void; highlight?: boolean }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: CARD, border: `1px solid ${highlight ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '12px', padding: '16px', cursor: 'pointer' }}>
      <div style={{ fontSize: '10.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: highlight ? ORANGE : 'white' }}>{value}</div>
    </button>
  )
}
