// Performance — centro de inteligência do Instagram.
//
// Três estados, nesta ordem de prioridade:
//   1. Conta conectada → dados REAIS da edge function `instagram-performance`.
//      Nenhuma métrica é inventada; o que a API não entrega vira "Não disponível".
//   2. Não conectada + modo demonstração ligado → preview com dados de exemplo
//      (banner amarelo bem explícito), só pra ver o produto de ponta a ponta.
//   3. Não conectada + demonstração desligado → empty state "Conecte o Instagram".
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'
import { useDemoMode } from './growthDemo'
import { buildPerformanceDemo, type PerformanceData, type Recommendation } from './performanceDemo'
import { proposeAgentAction } from '../../../lib/agentActions'
import {
  PerfHeader, KpiCard, ScoreCard, TrendSection, AudienceSection, ReachSection,
  EngagementSection, Panel, RANGES, type RangeKey,
} from './performanceParts'
import {
  ContentSectionPerf, ContentTypeSection, ConsistencySection, BestTimeSection,
  FunnelSection, PillarSection, AnomaliesSection, AiAnalysisSection,
  CompetitorSection, RecommendationsSection, GameSection,
} from './performanceInsights'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'

type Company = Pick<CompanyData, 'id' | 'business_name' | 'instagram_user_id' | 'instagram_url'>

export default function PerformanceTab({ company, onCreateContent }: { company: Company; onCreateContent?: (prompt: string) => void }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [demoMode] = useDemoMode(company.id)
  const [range, setRange] = useState<RangeKey>('30d')
  const [live, setLive] = useState<PerformanceData | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const demo = useMemo(() => buildPerformanceDemo(company), [company])

  const load = async (force = false) => {
    if (!session) return
    setSyncing(true); setSyncError(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/instagram-performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ company_id: company.id, force }),
      })
      const d = await res.json().catch(() => ({}))
      if (d?.connected && d?.score) setLive(d as PerformanceData)
      else { setLive(null); if (d?.error) setSyncError(String(d.error)) }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [company.id, session])

  const connected = !!live
  const data = live ?? demo
  const days = RANGES.find(r => r.key === range)?.days ?? 30

  const handleCreate = async (r: Recommendation) => {
    try { void navigator.clipboard?.writeText(r.prompt) } catch { /* ignore */ }
    // A recomendação NÃO executa direto — vira uma proposta na Central de
    // Approvals (Marketing Agent). O dono aprova lá; o executor cria o rascunho.
    if (session) {
      try {
        await proposeAgentAction(session.access_token, {
          company_id: company.id,
          agent_key: 'marketing', agent_name: 'Agente de Marketing',
          action_type: 'create_content', channel: 'instagram', source: 'performance',
          title: r.title, description: r.action,
          agent_interpretation: r.reason, reason: r.reason, expected_outcome: r.objective,
          payload: { prompt: r.prompt, impact: r.impact },
          risk_level: 'low', priority: r.priority === 'high' ? 'high' : 'normal',
          // Sem forçar: o motor decide auto/manual pela config de Modo automático.
        })
        setToast('Recomendação enviada pra Central de Approvals — abra "Aprovações" pra revisar (ou já executa, se o Modo automático estiver ligado).')
        setTimeout(() => setToast(null), 6000)
        return
      } catch { /* cai no fallback abaixo */ }
    }
    onCreateContent?.(r.prompt)
    setToast('Ideia copiada. Abra a aba Conteúdo → Orgânico pra gerar o rascunho.')
    setTimeout(() => setToast(null), 5000)
  }

  // Estado 3: empty state premium (não conectado, sem modo demonstração).
  if (!connected && !demoMode) {
    return <EmptyState hasInstagram={!!company.instagram_url} onConnect={() => navigate('/dashboard/settings?tab=conexoes')} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
      {toast && (
        <div style={{ position: 'sticky', top: '12px', zIndex: 30, alignSelf: 'center', background: '#0E0B0A', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '11px', padding: '10px 16px', fontSize: '11.5px', color: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          ✅ {toast}
        </div>
      )}

      {/* Banner de estado dos dados */}
      {connected ? (
        <Banner tone="green">🟢 <strong>Dados reais</strong> da conta @{data.username} — atualizados direto do Instagram. Métricas sem permissão da API aparecem como "Não disponível" (nunca inventamos número).</Banner>
      ) : (
        <Banner tone="amber">⏳ <strong>Modo demonstração.</strong> Estes números são exemplos pra você ver o produto. Conecte seu Instagram em <strong>Configurações → Conexões</strong> — aí tudo aqui vira dado real da sua conta, sem mudar o design.</Banner>
      )}

      {syncError && <Banner tone="red">⚠️ Não consegui sincronizar agora: {syncError}. Os dados podem estar desatualizados. Tente "Sincronizar agora".</Banner>}

      <PerfHeader d={data} range={range} onRange={setRange} onSync={() => load(true)} syncing={syncing} />

      {/* Acima da dobra: score + KPIs principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 0.9fr) 1.5fr', gap: '14px', alignItems: 'stretch' }}>
        <Panel title="Score de performance" icon="⚡"><ScoreCard score={data.score} /></Panel>
        <Panel title="Visão executiva" icon="📌">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '9px' }}>
            {data.kpis.slice(0, 6).map(k => <KpiCard key={k.key} kpi={k} />)}
          </div>
        </Panel>
      </div>

      {/* KPIs secundários */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '9px' }}>
        {data.kpis.slice(6).map(k => <KpiCard key={k.key} kpi={k} />)}
      </div>

      <AiAnalysisSection ai={data.aiAnalysis} />
      <AnomaliesSection anomalies={data.anomalies} />
      <TrendSection trend={data.trend} days={days} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
        <AudienceSection a={data.audience} trend={data.trend} days={days} />
        <ReachSection r={data.reach} />
      </div>

      <EngagementSection e={data.engagement} />
      <ContentSectionPerf content={data.content} />
      <ContentTypeSection types={data.contentTypes} conclusion={data.contentTypeConclusion} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
        <ConsistencySection c={data.consistency} />
        <BestTimeSection b={data.bestTime} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
        <FunnelSection funnel={data.funnel} note={data.funnelNote} />
        <PillarSection pillars={data.pillars} />
      </div>

      <RecommendationsSection recs={data.recommendations} onCreate={handleCreate} />
      <CompetitorSection c={data.competitor} />
      <GameSection game={data.game} />

      <SyncFooter data={data} connected={connected} syncing={syncing} error={syncError} />
    </div>
  )
}

function Banner({ tone, children }: { tone: 'green' | 'amber' | 'red'; children: React.ReactNode }) {
  const map = {
    green: { bg: 'rgba(74,222,128,0.06)', bd: 'rgba(74,222,128,0.22)' },
    amber: { bg: 'rgba(251,191,36,0.06)', bd: 'rgba(251,191,36,0.22)' },
    red: { bg: 'rgba(248,113,113,0.06)', bd: 'rgba(248,113,113,0.28)' },
  }[tone]
  return (
    <div style={{ padding: '12px 16px', background: map.bg, border: `1px solid ${map.bd}`, borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>{children}</div>
  )
}

function SyncFooter({ data, connected, syncing, error }: { data: PerformanceData; connected: boolean; syncing: boolean; error: string | null }) {
  const status = syncing ? 'Sincronizando…' : error ? 'Erro na sincronização' : connected ? 'Conectado' : 'Modo demonstração'
  const color = syncing ? '#FBBF24' : error ? RED : connected ? GREEN : MUTED
  const last = new Date(data.lastSync).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '11px 16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', fontSize: '10.5px', color: MUTED }}>
      <span>Camada de dados isolada por empresa (Supabase) · snapshots históricos pra comparar períodos.</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: color }} />
        <span style={{ color }}>{status}</span> · última sincronização {last}
      </span>
    </div>
  )
}

function EmptyState({ hasInstagram, onConnect }: { hasInstagram: boolean; onConnect: () => void }) {
  return (
    <div style={{ padding: '56px 32px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(255,109,41,0.08), rgba(255,109,41,0.01))', border: `1px solid ${BORDER}`, borderRadius: '18px' }}>
      <div style={{ fontSize: '44px', marginBottom: '14px' }}>📊</div>
      <div style={{ fontSize: '18px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>Conecte o Instagram pra desbloquear o Performance</div>
      <div style={{ fontSize: '13px', color: MUTED, maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.6 }}>
        O Performance transforma os dados reais do seu Instagram em um centro de inteligência: score, crescimento, alcance, melhores conteúdos, melhor horário e as próximas ações — tudo com dado de verdade, nada inventado.
      </div>
      <button onClick={onConnect}
        style={{ padding: '11px 22px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '11px', cursor: 'pointer', fontFamily: D }}>
        {hasInstagram ? 'Conectar Instagram' : 'Conectar Instagram'}
      </button>
      <div style={{ marginTop: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
        Prefere só ver como fica? Ligue o <strong style={{ color: MUTED }}>Modo demonstração</strong> no topo do Growth OS.
      </div>
    </div>
  )
}
