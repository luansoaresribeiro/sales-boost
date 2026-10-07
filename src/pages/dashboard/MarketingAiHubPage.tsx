import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import GrowthCommandCenter from './marketingAi/GrowthCommandCenter'
import { buildGrowthDemo, useDemoMode, useDemoAllowed, type GrowthDemoData, type CommandInsight, type DemoAgentStatus } from './marketingAi/growthDemo'
import { mapStage, type LeadRow } from './marketingAi/salesReal'
import type { LeadStageKey } from './marketingAi/salesDemo'
import DataVeil, { veilMode } from './marketingAi/DataVeil'
import { MUTED, BORDER, D, SUPABASE_URL } from './marketingAi/shared'
import { useStrategySummary } from './marketingAi/useStrategySummary'

const ORANGE = '#FF6D29'
const CARD = '#150E08'

interface ModuleDef { section: string; title: string; desc: string; icon: string; soon?: boolean }

// O fluxo do Growth OS, de cima pra baixo: Agente de Dados (observa —
// Performance real + Inteligência de Mercado + Insights + Saúde da Meta) →
// Agente de Estratégia (direciona — lê o negócio e o dado real, define
// objetivo/orçamento/metas e manda o direcionamento pro Conteúdo) → Agente
// de Conteúdo (cria) → Agente de Conversão (fecha — Funil de Vendas +
// Atendimento + Engagement). O Feedback Loop não é mais um card do fluxo —
// virou um círculo flutuante (FeedbackWidget.tsx) que aparece dentro de
// cada uma dessas seções com o sinal real daquele agente.
const MODULES = {
  pt: {
    data: { section: 'dados', title: 'Agente de Dados', desc: 'Performance real do Instagram, inteligência de mercado, insights de oportunidades e a Saúde da Meta — o que já funcionou e o que está acontecendo agora.', icon: '📊' },
    strategy: { section: 'estrategia', title: 'Agente de Estratégia', desc: 'Lê o negócio e o dado real, define objetivo, metas, orçamento e prazo — e direciona o Agente de Conteúdo.', icon: '🧭' },
    content: { section: 'content', title: 'Agente de Conteúdo e Campanha', desc: 'Calendário da Semana, Overview, Biblioteca (formatos/testes/vault) e Campanha — o Agente de Meta Ads (performance real + campanhas) mora aqui dentro agora.', icon: '✍️' },
    conversion: { section: 'conversao', title: 'Agente de Conversão', desc: 'Funil de vendas, atendimento e engagement (comentários/DMs) — transforma quem chegou até você em cliente.', icon: '🔀' },
  },
  en: {
    data: { section: 'dados', title: 'Data Agent', desc: 'Real Instagram performance, market intelligence, opportunity insights and Meta Health — what has already worked and what is happening now.', icon: '📊' },
    strategy: { section: 'estrategia', title: 'Strategy Agent', desc: 'Reads the business and the real data, sets the goal, targets, budget and timeline — and guides the Content Agent.', icon: '🧭' },
    content: { section: 'content', title: 'Content & Campaign Agent', desc: 'Weekly Calendar, Overview, Library (formats/tests/vault) and Campaign — the Meta Ads Agent (real performance + campaigns) now lives in here.', icon: '✍️' },
    conversion: { section: 'conversao', title: 'Conversion Agent', desc: 'Sales pipeline, customer service and engagement (comments/DMs) — turns the people who reached you into customers.', icon: '🔀' },
  },
} as const satisfies Record<string, Record<string, ModuleDef>>

const TX = {
  pt: {
    draft: 'Rascunho', active: 'Ativa', paused: 'Pausada', completed: 'Concluída', needs_review: 'Precisa revisão',
    stNovo: 'Novo Lead', stContato: 'Contato realizado', stQual: 'Qualificado', stProp: 'Proposta', stVenda: 'Venda realizada',
    tAval: 'Avaliações', tOpin: 'Opiniões', tConc: 'Concorrentes', tCresc: 'Crescimento', tPerf: 'Performance', tAud: 'Audiência', tDiag: 'Diagnóstico de links',
    lastScan: 'Última varredura real em', noScan: 'Ainda sem varredura registrada', lastIdea: 'Última ideia gerada em', noIdea: 'Ainda sem ideias geradas',
    connected: 'Conectado', awaitAds: 'Aguardando conexão da conta de anúncios', awaitWa: 'Aguardando conexão do WhatsApp',
    market: 'Inteligência de Mercado', content: 'Conteúdo', sales: 'Vendas (Funil)', wa: 'Atendimento WhatsApp',
    pending: (n: number) => `${n} lead${n === 1 ? '' : 's'} aguardando follow-up`,
    loading: 'Carregando...', sub: 'Seu departamento de crescimento com IA — encontra oportunidades, executa campanhas e transforma dados em vendas. Nada vai ao ar sem sua aprovação.',
    config: '⚙️ Configuração', demo: 'Modo demonstração',
    vErrT: 'Erro ao carregar o painel-resumo', vEmptyT: 'Painel-resumo ainda sem dado real',
    vErrM: 'A consulta ao banco/Meta falhou — veja o erro abaixo pra saber o que corrigir.',
    vEmptyM: 'Receita, ROAS e funil agregados aqui em cima ainda não têm dado real — assim que houver leads, Instagram ou Meta Ads conectados, cada peça some aqui automaticamente. Ligue o Modo demonstração pra ver como fica quando tudo estiver somado.',
    vCta: 'Ver exemplo (modo demonstração)', team: 'Sua equipe de agentes',
    b1: '1 · Observa', b2: '2 · Direciona', b3: '3 · Agente principal', b4: '4 · Converte',
    noStrat: '{t.noStrat}',
    conn: 'Conexões', ctx: 'Contexto do Negócio', inSettings: 'ficam em Configurações.', and: 'e', open: 'Abrir',
  },
  en: {
    draft: 'Draft', active: 'Active', paused: 'Paused', completed: 'Completed', needs_review: 'Needs review',
    stNovo: 'New Lead', stContato: 'Contacted', stQual: 'Qualified', stProp: 'Proposal', stVenda: 'Sale closed',
    tAval: 'Reviews', tOpin: 'Opinions', tConc: 'Competitors', tCresc: 'Growth', tPerf: 'Performance', tAud: 'Audience', tDiag: 'Link diagnostics',
    lastScan: 'Last real scan on', noScan: 'No scan recorded yet', lastIdea: 'Last idea generated on', noIdea: 'No ideas generated yet',
    connected: 'Connected', awaitAds: 'Waiting for the ad account to be connected', awaitWa: 'Waiting for WhatsApp to be connected',
    market: 'Market Intelligence', content: 'Content', sales: 'Sales (Pipeline)', wa: 'WhatsApp Support',
    pending: (n: number) => `${n} lead${n === 1 ? '' : 's'} awaiting follow-up`,
    loading: 'Loading...', sub: 'Your AI-powered growth department — finds opportunities, runs campaigns and turns data into sales. Nothing goes live without your approval.',
    config: '⚙️ Settings', demo: 'Demo mode',
    vErrT: 'Error loading the summary panel', vEmptyT: 'Summary panel has no real data yet',
    vErrM: 'The database/Meta query failed — see the error below to know what to fix.',
    vEmptyM: 'Revenue, ROAS and the pipeline aggregated up here have no real data yet — as soon as leads, Instagram or Meta Ads are connected, each piece shows up here automatically. Turn on Demo mode to see how it looks when everything is added up.',
    vCta: 'See an example (demo mode)', team: 'Your team of agents',
    b1: '1 · Observes', b2: '2 · Directs', b3: '3 · Main agent', b4: '4 · Converts',
    noStrat: 'No active strategy yet — click to create one.',
    conn: 'Connections', ctx: 'Business Context', inSettings: 'live in Settings.', and: 'and', open: 'Open',
  },
} as const
type Lang = 'pt' | 'en'

const STRATEGY_STATUS_COLOR: Record<string, string> = { draft: MUTED, active: '#4ade80', paused: '#FBBF24', completed: '#60a5fa', needs_review: '#f87171' }

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
        supabase.from('companies').select('meta_ads_account_id, whatsapp_phone_number_id').eq('id', companyId).maybeSingle(),
        supabase.from('marketing_ai_ideas').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('marketing_ai_trends').select('detected_at').eq('company_id', companyId).eq('source', 'instagram_scan').order('detected_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      // Pedido do dono: se alguma dessas consultas falhar de verdade (não só
      // "ainda sem linha"), o painel borrado precisa mostrar o erro real.
      const queryErr = results.find(r => r.error)?.error
      if (queryErr) { if (!cancelled) setState({ real: null, loading: false, error: queryErr.message }); return }
      const [{ data: leadRows }, { data: snapRows }, { data: reportRows }, { data: companyRow }, { data: ideaRow }, { data: trendRow }] = results
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
      const agents: DemoAgentStatus[] = [
        { key: 'market', name: t.market, icon: '🧭', state: trendRow?.detected_at ? 'active' : 'idle', lastAction: trendRow?.detected_at ? `${t.lastScan} ${new Date(trendRow.detected_at).toLocaleDateString(locale)}` : t.noScan },
        { key: 'content', name: t.content, icon: '✍️', state: ideaRow?.created_at ? 'active' : 'idle', lastAction: ideaRow?.created_at ? `${t.lastIdea} ${new Date(ideaRow.created_at).toLocaleDateString(locale)}` : t.noIdea },
        { key: 'ads', name: 'Meta Ads', icon: '🎯', state: companyRow?.meta_ads_account_id ? 'active' : 'soon', lastAction: companyRow?.meta_ads_account_id ? t.connected : t.awaitAds },
        { key: 'sales', name: t.sales, icon: '🔀', state: 'idle', lastAction: t.pending(pending) },
        { key: 'whatsapp', name: t.wa, icon: '💬', state: companyRow?.whatsapp_phone_number_id ? 'active' : 'soon', lastAction: companyRow?.whatsapp_phone_number_id ? t.connected : t.awaitWa },
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
  const { real, loading: realLoading, error: realError } = useRealGrowth(company?.id ?? '', session?.access_token ?? '', lang)
  const { summary: strategySummary } = useStrategySummary(company?.id)

  if (!company || !demo) {
    return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>{t.loading}</div>
  }

  const open = (section: string) => navigate(`/dashboard/marketing-ai/${section}`)
  const panelData = real?.hasReal ? real.data : demo
  const panelMode = veilMode({ hasReal: !!real?.hasReal, demoMode, error: !!realError })

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
          <button onClick={() => navigate('/dashboard/settings?tab=agentes')}
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

      {/* Receita/ROAS/funil agregados: soma o que já é real em cada peça
          (leads → funil, Instagram → crescimento/engajamento, Meta Ads → ao
          vivo, insights_reports → recomendações). Sem nenhuma peça real
          ainda, fica borrado até ligar o demo — nunca mostra 0 fingido. */}
      <div style={{ margin: '24px 32px 0' }}>
        {!realLoading && (
          <DataVeil mode={panelMode}
            title={realError ? t.vErrT : t.vEmptyT}
            message={realError ? t.vErrM : t.vEmptyM}
            errorDetail={realError}
            cta={{ label: t.vCta, onClick: () => setDemoMode(true) }}>
            <GrowthCommandCenter data={panelData} />
          </DataVeil>
        )}
      </div>

      <div style={{ padding: '10px 32px 32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
          {t.team}
        </div>

        {/* O fluxo do Growth OS: Dados observa → Estratégia direciona →
            Conteúdo cria → Conversão fecha. As setas indicam a sequência —
            cada agente entrega pro próximo. O Feedback Loop aparece dentro
            de cada card (círculo flutuante), não é mais uma etapa separada. */}
        <div style={{ border: '1px solid rgba(255,109,41,0.18)', borderRadius: '22px', padding: '16px', background: 'rgba(255,109,41,0.035)' }}>
          <HeroAgentCard m={M.data} badge={t.b1} onClick={() => open(M.data.section)} />
          <FlowArrow />
          <HeroAgentCard m={M.strategy} badge={t.b2} onClick={() => open(M.strategy.section)}
            summary={strategySummary ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 800, color: STRATEGY_STATUS_COLOR[strategySummary.status] ?? MUTED }}>● {((t as Record<string, unknown>)[strategySummary.status] as string | undefined) ?? strategySummary.status}</span>
                <span style={{ fontSize: '12px', color: 'white', fontWeight: 700 }}>{strategySummary.primary_business_objective || strategySummary.name}</span>
                {strategySummary.topGoal && <span style={{ fontSize: '11px', color: MUTED }}>· {strategySummary.topGoal.name}{strategySummary.topGoal.target_value != null ? `: ${strategySummary.topGoal.current_progress ?? 0}/${strategySummary.topGoal.target_value}` : ''}</span>}
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: MUTED }}>{t.noStrat}</span>
            )} />
          <FlowArrow />
          <HeroAgentCard m={M.content} badge={t.b3} onClick={() => open(M.content.section)} />
          <FlowArrow />
          <HeroAgentCard m={M.conversion} badge={t.b4} onClick={() => open(M.conversion.section)} />
        </div>

        <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginTop: '14px', maxWidth: '680px' }}>
          <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{t.conn}</strong> {t.and} <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{t.ctx}</strong> {t.inSettings}
        </p>
      </div>
    </div>
  )
}

// Seta central entre dois cards do fluxo — indica a sequência (Dados →
// Conteúdo → Conversão), não é só decoração.
function FlowArrow() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: '20px', color: 'rgba(255,109,41,0.55)', lineHeight: 1 }}>↓</span>
    </div>
  )
}

// Card hero — usado 3x (Dados, Conteúdo, Conversão), sempre no mesmo tamanho
// e estilo, formando o fluxo vertical do Growth OS.
// `summary` é usado só pelo Agente de Estratégia: resumo ao vivo da
// estratégia ativa, mostrado embaixo da descrição. O card tem o mesmo
// tamanho dos outros (pedido do dono, 2026-10-07). `compact` continua
// existindo mas não é mais usado no hub.
function HeroAgentCard({ m, badge, onClick, compact, summary }: { m: ModuleDef; badge: string; onClick: () => void; compact?: boolean; summary?: React.ReactNode }) {
  const { lang } = useLang()
  const [hover, setHover] = useState(false)
  const iconSize = compact ? 44 : 58
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', fontFamily: D,
        display: 'flex', alignItems: 'center', gap: compact ? '16px' : '20px', flexWrap: 'wrap',
        background: 'linear-gradient(135deg, rgba(255,109,41,0.12), rgba(255,109,41,0.04))',
        border: `1px solid ${hover ? 'rgba(255,109,41,0.6)' : 'rgba(255,109,41,0.3)'}`,
        borderRadius: compact ? '14px' : '18px', padding: compact ? '16px 20px' : '24px 26px',
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 12px 34px rgba(255,109,41,0.18)' : '0 4px 18px rgba(255,109,41,0.08)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${iconSize}px`, height: `${iconSize}px`, flexShrink: 0, borderRadius: compact ? '12px' : '16px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.25)', fontSize: compact ? '22px' : '30px' }}>
        {m.icon}
      </div>
      <div style={{ flex: 1, minWidth: '220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: compact ? '16px' : '20px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{m.title}</span>
          <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '99px', background: 'rgba(255,109,41,0.16)', border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {badge}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: MUTED, margin: 0, lineHeight: 1.55, maxWidth: '560px' }}>{m.desc}</p>
        {summary && <div style={{ marginTop: '8px' }}>{summary}</div>}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0, padding: compact ? '9px 16px' : '11px 20px', borderRadius: '11px', background: hover ? ORANGE : 'rgba(255,109,41,0.14)', border: `1px solid ${hover ? ORANGE : 'rgba(255,109,41,0.35)'}`, color: hover ? '#0E0B0A' : ORANGE, fontSize: '13px', fontWeight: 800, transition: 'background 0.18s, color 0.18s' }}>
        {TX[lang].open} <span style={{ transition: 'transform 0.18s', transform: hover ? 'translateX(3px)' : 'none' }}>→</span>
      </div>
    </button>
  )
}
