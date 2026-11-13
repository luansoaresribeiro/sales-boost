import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { buildGrowthDemo, buildDecisionDemo, useDemoMode, useDemoAllowed, type GrowthDemoData, type CommandInsight, type DemoAgentStatus } from './marketingAi/growthDemo'
import { mapStage, type LeadRow } from './marketingAi/salesReal'
import type { LeadStageKey } from './marketingAi/salesDemo'
import { MUTED, BORDER, D, SUPABASE_URL } from './marketingAi/shared'
import { useStrategySummary } from './marketingAi/useStrategySummary'
import HubBento from './marketingAi/HubBento'
import CommercialFunnel from './marketingAi/CommercialFunnel'
import { useCommercialFunnel } from './marketingAi/useCommercialFunnel'
import { useDecisionKpis } from './marketingAi/useDecisionKpis'
import { useFlowSummary } from './marketingAi/useFlowSummary'
import { useAttention } from './marketingAi/useAttention'
import { cardModels } from './marketingAi/HubAgentCards'
import HubAgentLights from './marketingAi/HubAgentLights'
import { MODULES, AGENT_ORDER } from './marketingAi/agentModules'

const ORANGE = '#FF6D29'
const CARD = '#150E08'

const TX = {
  pt: {
    draft: 'Rascunho', active: 'Ativa', paused: 'Pausada', completed: 'Concluída', needs_review: 'Precisa revisão',
    stNovo: 'Novo Lead', stContato: 'Contato realizado', stQual: 'Qualificado', stProp: 'Proposta', stVenda: 'Venda realizada',
    tAval: 'Avaliações', tOpin: 'Opiniões', tConc: 'Concorrentes', tCresc: 'Crescimento', tPerf: 'Performance', tAud: 'Audiência', tDiag: 'Diagnóstico de links',
    lastScan: 'Última varredura real em', noScan: 'Ainda sem varredura registrada', lastIdea: 'Última ideia gerada em', noIdea: 'Ainda sem ideias geradas',
    connected: 'Conectado', awaitAds: 'Aguardando conexão da conta de anúncios', awaitWa: 'Aguardando conexão do WhatsApp',
    market: 'Inteligência de Mercado', opp: 'Motor de Oportunidades', strat: 'Agente de Estratégia', content: 'Ativação', sales: 'Resultados e Aprendizado',
    oppAction: 'Roda sozinho toda semana — você aprova ou descarta', stratAction: 'Define público, oferta e mensagem — e direciona a Ativação',
    pending: (n: number) => `${n} lead${n === 1 ? '' : 's'} aguardando follow-up`,
    loading: 'Carregando...', sub: 'Seu departamento de crescimento com IA — encontra oportunidades, executa campanhas e transforma dados em vendas. Nada vai ao ar sem sua aprovação.',
    config: '⚙️ Configuração', demo: 'Modo demonstração',
    team: 'Sua equipe de agentes',
    noStrat: 'Ainda sem estratégia ativa — clique para criar.',
    conn: 'Conexões', ctx: 'Contexto do Negócio', inSettings: 'ficam em Configurações.', and: 'e',
  },
  en: {
    draft: 'Draft', active: 'Active', paused: 'Paused', completed: 'Completed', needs_review: 'Needs review',
    stNovo: 'New Lead', stContato: 'Contacted', stQual: 'Qualified', stProp: 'Proposal', stVenda: 'Sale closed',
    tAval: 'Reviews', tOpin: 'Opinions', tConc: 'Competitors', tCresc: 'Growth', tPerf: 'Performance', tAud: 'Audience', tDiag: 'Link diagnostics',
    lastScan: 'Last real scan on', noScan: 'No scan recorded yet', lastIdea: 'Last idea generated on', noIdea: 'No ideas generated yet',
    connected: 'Connected', awaitAds: 'Waiting for the ad account to be connected', awaitWa: 'Waiting for WhatsApp to be connected',
    market: 'Market Intelligence', opp: 'Opportunity Engine', strat: 'Strategy Agent', content: 'Activation', sales: 'Results & Learning',
    oppAction: 'Runs on its own every week — you approve or dismiss', stratAction: 'Sets audience, offer and message — and guides Activation',
    pending: (n: number) => `${n} lead${n === 1 ? '' : 's'} awaiting follow-up`,
    loading: 'Loading...', sub: 'Your AI-powered growth department — finds opportunities, runs campaigns and turns data into sales. Nothing goes live without your approval.',
    config: '⚙️ Settings', demo: 'Demo mode',
    team: 'Your team of agents',
    noStrat: 'No active strategy yet — click to create one.',
    conn: 'Connections', ctx: 'Business Context', inSettings: 'live in Settings.', and: 'and',
  },
} as const
type Lang = 'pt' | 'en'

const STAGE_ORDER: LeadStageKey[] = ['novo', 'contato', 'qualificado', 'proposta', 'venda']
const stageLabel = (lang: Lang): Record<LeadStageKey, string> => { const t = TX[lang]; return { novo: t.stNovo, contato: t.stContato, qualificado: t.stQual, proposta: t.stProp, venda: t.stVenda } }
const tabLabel = (lang: Lang): Record<string, string> => { const t = TX[lang]; return { avaliacoes: t.tAval, opinioes: t.tOpin, concorrentes: t.tConc, crescimento: t.tCresc, performance: t.tPerf, audiencia: t.tAud, diagnostico: t.tDiag } }

interface RealGrowth { data: GrowthDemoData; hasReal: boolean }

// Painel-resumo real: soma o que já é real em cada aba (leads → funil,
// instagram_performance_snapshots → crescimento/engajamento, meta-ads-insights
// → receita/ROAS ao vivo, insights_reports → recomendações da IA) num só
// objeto na MESMA forma que o demo usa. Nenhuma peça sem fonte real vira
// número inventado — fica null e o KpiTile mostra "—".
function useRealGrowth(companyId: string, token: string, lang: Lang): { real: RealGrowth | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ real: RealGrowth | null; loading: boolean; error: string | null }>({ real: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    const t = TX[lang]
    const locale = lang === 'en' ? 'en-US' : 'pt-BR'
    async function load() {
      const results = await Promise.all([
        supabase.from('leads').select('stage, value_estimate, created_at').eq('company_id', companyId),
        supabase.from('instagram_performance_snapshots').select('captured_for, followers, engagement_rate').eq('company_id', companyId).order('captured_for', { ascending: false }).limit(30),
        supabase.from('insights_reports').select('tab_key, summary, suggestions, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
        supabase.from('marketing_ai_ideas').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('marketing_ai_trends').select('detected_at').eq('company_id', companyId).eq('source', 'instagram_scan').order('detected_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      // Pedido do dono: se alguma dessas consultas falhar de verdade (não só
      // "ainda sem linha"), o painel borrado precisa mostrar o erro real.
      const queryErr = results.find(r => r.error)?.error
      if (queryErr) { if (!cancelled) setState({ real: null, loading: false, error: queryErr.message }); return }
      const [{ data: leadRows }, { data: snapRows }, { data: reportRows }, { data: ideaRow }, { data: trendRow }] = results
      let ads: { connected: boolean; totals?: { spend: number; revenue: number; roas: number }; error?: string } | null = null
      let adsError: string | null = null
      if (token) {
        ads = await fetch(`${SUPABASE_URL}/functions/v1/meta-ads-insights`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId }),
        }).then(r => r.json()).catch(e => { adsError = e instanceof Error ? e.message : String(e); return null })
        if (ads?.connected && ads.error) adsError = ads.error
      }
      if (cancelled) return

      // Funil real: cumulativo por estágio atual (quem já chegou em cada
      // etapa ou passou dela) — o mesmo jeito que um CRM lê um funil real.
      const leads = (leadRows ?? []) as LeadRow[]
      const stages = leads.map(l => mapStage(l.stage))
      const idx = (s: LeadStageKey) => STAGE_ORDER.indexOf(s)
      const funnel = STAGE_ORDER.map(stage => {
        const at = leads.filter((_, i) => idx(stages[i]) >= idx(stage))
        return { key: stage, label: stageLabel(lang)[stage], count: at.length, value: at.reduce((s, l) => s + Number(l.value_estimate ?? 0), 0) }
      })
      const salesCount = funnel[funnel.length - 1].count
      const funnelConversion = leads.length > 0 ? Number(((salesCount / leads.length) * 100).toFixed(1)) : null

      // Instagram: crescimento/engajamento reais das snapshots já coletadas
      // (mesma tabela que a aba Performance usa) — sem re-sincronizar aqui.
      const snaps = snapRows ?? []
      const latest = snaps[0] ?? null
      const oldest = snaps.length > 1 ? snaps[snaps.length - 1] : null
      const igFollowers = latest?.followers ?? null
      const igFollowersGained = latest && oldest && oldest.captured_for !== latest.captured_for ? (latest.followers ?? 0) - (oldest.followers ?? 0) : null
      const contentEngagement = latest?.engagement_rate ?? null

      const adsConnected = !!ads?.connected && !!ads.totals
      const revenue = adsConnected ? ads!.totals!.revenue : null
      const roas = adsConnected ? ads!.totals!.roas : null
      const adSpend = adsConnected ? ads!.totals!.spend : null

      const insights: CommandInsight[] = (reportRows ?? []).flatMap(r => {
        const suggestion = (r.suggestions as string[] | null)?.[0]
        if (!suggestion) return []
        return [{ id: `${r.tab_key}-${r.created_at}`, kind: 'acao_recomendada' as const, title: tabLabel(lang)[r.tab_key] ?? r.tab_key, description: suggestion, impact: 'medium' as const }]
      })

      const pending = leads.filter(l => { const s = mapStage(l.stage); return s === 'novo' || s === 'contato' }).length
      // Os 5 agentes atuais, com os mesmos ícones dos cards (MODULES). Só o que tem dado real mostra "ativo";
      // Oportunidades e Estratégia não têm leitura própria aqui — ficam "em espera" com a regra real, sem número.
      const agents: DemoAgentStatus[] = [
        { key: 'market', name: t.market, icon: '📊', state: trendRow?.detected_at ? 'active' : 'idle', lastAction: trendRow?.detected_at ? `${t.lastScan} ${new Date(trendRow.detected_at).toLocaleDateString(locale)}` : t.noScan },
        { key: 'opportunities', name: t.opp, icon: '💡', state: 'idle', lastAction: t.oppAction },
        { key: 'strategy', name: t.strat, icon: '🧭', state: 'idle', lastAction: t.stratAction },
        { key: 'content', name: t.content, icon: '✍️', state: ideaRow?.created_at ? 'active' : 'idle', lastAction: ideaRow?.created_at ? `${t.lastIdea} ${new Date(ideaRow.created_at).toLocaleDateString(locale)}` : t.noIdea },
        { key: 'sales', name: t.sales, icon: '🔀', state: 'idle', lastAction: t.pending(pending) },
      ]

      const hasReal = leads.length > 0 || snaps.length > 0 || adsConnected
      const data: GrowthDemoData = {
        kpis: {
          revenue, revenueDelta: null,
          leads: leads.length, leadsDelta: null,
          funnelConversion, funnelConversionDelta: null,
          roas, roasDelta: null,
          adSpend,
          igFollowers, igFollowersGained,
          contentEngagement, contentEngagementDelta: null,
        },
        connections: [], funnel, agents, insights,
      }
      // Só escala pra "erro" quando NADA real veio (senão um erro isolado do
      // Meta Ads borraria o painel inteiro mesmo com leads/Instagram reais).
      setState({ real: { data, hasReal }, loading: false, error: !hasReal && adsError ? adsError : null })
    }
    load()
    return () => { cancelled = true }
  }, [companyId, token, lang])

  return state
}

export default function MarketingAiHubPage() {
  const { lang } = useLang()
  const t = TX[lang]
  const M = MODULES[lang]
  const { company } = useCompany()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useDemoMode(company?.id)
  const demoAllowed = useDemoAllowed()

  const demo = useMemo(() => (company ? buildGrowthDemo(company, lang) : null), [company, lang])
  const { real, loading: realLoading } = useRealGrowth(company?.id ?? '', session?.access_token ?? '', lang)
  const { summary: strategySummary, loading: strategyLoading, error: strategyError } = useStrategySummary(company?.id)
  const flow = useFlowSummary(company?.id)
  const { kpis: realKpis, loading: kpisLoading } = useDecisionKpis(company?.id)
  const funnel = useCommercialFunnel(company?.id, !demoMode)
  // Não chamar usePendencias() aqui: ele abre um canal realtime com nome fixo e o DashboardLayout já abre o mesmo —
  // a 2ª inscrição derruba a tela inteira ("cannot add postgres_changes callbacks after subscribe()", 2026-10-30).
  const decisionDemo = useMemo(() => (company && demoMode ? buildDecisionDemo(company.id) : null), [company, demoMode])
  const attention = useAttention(company?.id, realKpis, kpisLoading, decisionDemo)

  if (!company || !demo) {
    return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>{t.loading}</div>
  }

  const kpis = decisionDemo ? { ...realKpis, ...decisionDemo } : realKpis
  const stratLabel = strategySummary ? ((t as Record<string, unknown>)[strategySummary.status] as string | undefined) ?? strategySummary.status : ''
  const stratObjective = strategySummary ? [strategySummary.primary_business_objective || strategySummary.name, strategySummary.topGoal ? `${strategySummary.topGoal.name}${strategySummary.topGoal.target_value != null ? `: ${strategySummary.topGoal.current_progress ?? 0}/${strategySummary.topGoal.target_value}` : ''}` : ''].filter(Boolean).join(' · ') : ''
  const cards = cardModels({
    lang, agents: demoMode ? demo.agents : real?.data.agents ?? null, loading: realLoading, kpis, kpisLoading: demoMode ? false : kpisLoading, flow,
    strategy: strategySummary ? { status: strategySummary.status, label: stratLabel, objective: stratObjective } : null, strategyLoading: !demoMode && strategyLoading, strategyError: !demoMode && strategyError,
  })

  return (
    <div>
      <div style={{ padding: '26px 32px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: D, fontSize: '1.9rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', margin: 0 }}>
              {company.business_name}
            </h1>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.3)', color: ORANGE, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Growth OS</span>
          </div>
          <p style={{ color: MUTED, fontSize: '13px' }}>{t.sub}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button onClick={() => navigate('/dashboard/aprovacoes')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', cursor: 'pointer', fontFamily: D, color: MUTED, fontSize: '12px', fontWeight: 700 }}
            onMouseEnter={e => { e.currentTarget.style.color = ORANGE; e.currentTarget.style.borderColor = 'rgba(255,109,41,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER }}>
            {t.config}
          </button>
          {demoAllowed && <label style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '8px 14px', background: CARD, border: `1px solid ${demoMode ? 'rgba(251,191,36,0.3)' : BORDER}`, borderRadius: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={demoMode} onChange={e => setDemoMode(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: ORANGE, cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: demoMode ? '#FBBF24' : MUTED }}>{t.demo}</span>
          </label>}
        </div>
      </div>

      {/* Resultado comercial no topo (dono, 2026-11-12): visualizações → interessados → leads → visitas, e de onde veio. */}
      <CommercialFunnel lang={lang} state={funnel} demo={demoMode} />

      {/* Bento do topo (C.1, 2026-11-07): próxima ação, aprovações, 4 indicadores, mercado, oportunidades, direcionamento e
          receita/ROAS/funil — mesmos hooks e números de antes (AttentionBlock/DecisionKpis seguem no código, sem uso aqui). A
          receita soma o que já é real (leads → funil, Instagram, Meta Ads, insights_reports); sem peça real fica borrada — nunca 0 fingido. */}
      <HubBento lang={lang} companyId={company.id} kpis={kpis} kpisLoading={kpisLoading} demo={demoMode} attention={attention} flow={flow}
        strategyName={strategySummary?.name ?? (demoMode ? (lang === 'en' ? 'Example strategy' : 'Estratégia de exemplo') : null)}
        strategyObjective={stratObjective} strategyLoading={!demoMode && strategyLoading} strategyError={!demoMode && strategyError} />
      {/* Painel-resumo (receita/ROAS/funil agregado, DataVeil + GrowthCommandCenter) saiu do topo a pedido do dono em 2026-11-13:
          o "Resultado comercial" acima mostra o funil com dado real. Os componentes continuam no código, sem uso aqui. */}

      <div style={{ padding: '10px 32px 32px' }}>
        {/* Os 5 cartões dos agentes e a fábrica 3D moraram aqui até C.2 (2026-11-07); agora ficam na aba Agentes. Aqui só a linha
            fina com as luzes de estado (mesmos cartões/dados — cardModels) e o link. Este arquivo NÃO importa nada da fábrica 3D. */}
        <HubAgentLights lang={lang} title={t.team} cards={cards} names={AGENT_ORDER.map(k => M[k].title)} />

        <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginTop: '14px', maxWidth: '680px' }}>
          <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{t.conn}</strong> {t.and} <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{t.ctx}</strong> {t.inSettings}
        </p>
      </div>
    </div>
  )
}
