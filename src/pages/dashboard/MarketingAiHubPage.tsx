import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import GrowthCommandCenter from './marketingAi/GrowthCommandCenter'
import { buildGrowthDemo, useDemoMode, type GrowthDemoData, type CommandInsight, type DemoAgentStatus } from './marketingAi/growthDemo'
import { mapStage, type LeadRow } from './marketingAi/salesReal'
import type { LeadStageKey } from './marketingAi/salesDemo'
import DataVeil, { veilMode } from './marketingAi/DataVeil'
import { MUTED, BORDER, D, SUPABASE_URL } from './marketingAi/shared'

const ORANGE = '#FF6D29'
const CARD = '#150E08'

interface ModuleDef { section: string; title: string; desc: string; icon: string; soon?: boolean }

// O fluxo do Growth OS, de cima pra baixo: Agente de Dados (observa —
// Performance real + Inteligência de Mercado + Insights + Saúde da Meta) →
// Agente de Conteúdo (cria) → Agente de Conversão (fecha — Funil de Vendas +
// Atendimento + Engagement) → Feedback Loop (aprende com o resultado e
// realimenta o Agente de Dados — fecha o ciclo, é o último agente do fluxo).
// Meta Ads virou item próprio no menu esquerdo, fora dessa sequência.
const DATA_MODULE: ModuleDef = { section: 'dados', title: 'Agente de Dados', desc: 'Performance real do Instagram, inteligência de mercado, insights de oportunidades e a Saúde da Meta — o que já funcionou e o que está acontecendo agora.', icon: '📊' }
const CONTENT_MODULE: ModuleDef = { section: 'content', title: 'Agente de Conteúdo', desc: 'Calendário da Semana (Ideias + planejamento), Overview do que já está pronto/agendado, e a Biblioteca com formatos, testes e vault.', icon: '✍️' }
const CONVERSION_MODULE: ModuleDef = { section: 'conversao', title: 'Agente de Conversão', desc: 'Funil de vendas, atendimento e engagement (comentários/DMs) — transforma quem chegou até você em cliente.', icon: '🔀' }
const FEEDBACK_MODULE: ModuleDef = { section: 'feedback', title: 'Feedback Loop', desc: 'Aprende seu cliente ideal (ICP) com o resultado de tudo acima e refina o Agente de Dados sozinho — fecha o ciclo.', icon: '🔁' }

const STAGE_ORDER: LeadStageKey[] = ['novo', 'contato', 'qualificado', 'proposta', 'venda']
const STAGE_LABEL: Record<LeadStageKey, string> = { novo: 'Novo Lead', contato: 'Contato realizado', qualificado: 'Qualificado', proposta: 'Proposta', venda: 'Venda realizada' }
const TAB_LABEL: Record<string, string> = { avaliacoes: 'Avaliações', opinioes: 'Opiniões', concorrentes: 'Concorrentes', crescimento: 'Crescimento', performance: 'Performance', audiencia: 'Audiência', diagnostico: 'Diagnóstico de links' }

interface RealGrowth { data: GrowthDemoData; hasReal: boolean }

// Painel-resumo real: soma o que já é real em cada aba (leads → funil,
// instagram_performance_snapshots → crescimento/engajamento, meta-ads-insights
// → receita/ROAS ao vivo, insights_reports → recomendações da IA) num só
// objeto na MESMA forma que o demo usa. Nenhuma peça sem fonte real vira
// número inventado — fica null e o KpiTile mostra "—".
function useRealGrowth(companyId: string, token: string): { real: RealGrowth | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ real: RealGrowth | null; loading: boolean; error: string | null }>({ real: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
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
        return { key: stage, label: STAGE_LABEL[stage], count: at.length, value: at.reduce((s, l) => s + Number(l.value_estimate ?? 0), 0) }
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
        return [{ id: `${r.tab_key}-${r.created_at}`, kind: 'acao_recomendada' as const, title: TAB_LABEL[r.tab_key] ?? r.tab_key, description: suggestion, impact: 'medium' as const }]
      })

      const pending = leads.filter(l => { const s = mapStage(l.stage); return s === 'novo' || s === 'contato' }).length
      const agents: DemoAgentStatus[] = [
        { key: 'market', name: 'Inteligência de Mercado', icon: '🧭', state: trendRow?.detected_at ? 'active' : 'idle', lastAction: trendRow?.detected_at ? `Última varredura real em ${new Date(trendRow.detected_at).toLocaleDateString('pt-BR')}` : 'Ainda sem varredura registrada' },
        { key: 'content', name: 'Conteúdo', icon: '✍️', state: ideaRow?.created_at ? 'active' : 'idle', lastAction: ideaRow?.created_at ? `Última ideia gerada em ${new Date(ideaRow.created_at).toLocaleDateString('pt-BR')}` : 'Ainda sem ideias geradas' },
        { key: 'ads', name: 'Meta Ads', icon: '🎯', state: companyRow?.meta_ads_account_id ? 'active' : 'soon', lastAction: companyRow?.meta_ads_account_id ? 'Conectado' : 'Aguardando conexão da conta de anúncios' },
        { key: 'sales', name: 'Vendas (Funil)', icon: '🔀', state: 'idle', lastAction: `${pending} lead${pending === 1 ? '' : 's'} aguardando follow-up` },
        { key: 'whatsapp', name: 'Atendimento WhatsApp', icon: '💬', state: companyRow?.whatsapp_phone_number_id ? 'active' : 'soon', lastAction: companyRow?.whatsapp_phone_number_id ? 'Conectado' : 'Aguardando conexão do WhatsApp' },
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
  }, [companyId, token])

  return state
}

export default function MarketingAiHubPage() {
  const { company } = useCompany()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useDemoMode(company?.id)

  const demo = useMemo(() => (company ? buildGrowthDemo(company) : null), [company])
  const { real, loading: realLoading, error: realError } = useRealGrowth(company?.id ?? '', session?.access_token ?? '')

  if (!company || !demo) {
    return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>Carregando...</div>
  }

  const open = (section: string) => navigate(section === 'meta-ads' ? '/dashboard/meta-ads' : `/dashboard/marketing-ai/${section}`)
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
          <p style={{ color: MUTED, fontSize: '13px' }}>Seu departamento de crescimento com IA — encontra oportunidades, executa campanhas e transforma dados em vendas. Nada vai ao ar sem sua aprovação.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button onClick={() => navigate('/dashboard/settings?tab=agentes')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', cursor: 'pointer', fontFamily: D, color: MUTED, fontSize: '12px', fontWeight: 700 }}
            onMouseEnter={e => { e.currentTarget.style.color = ORANGE; e.currentTarget.style.borderColor = 'rgba(255,109,41,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER }}>
            ⚙️ Configuração
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '8px 14px', background: CARD, border: `1px solid ${demoMode ? 'rgba(251,191,36,0.3)' : BORDER}`, borderRadius: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={demoMode} onChange={e => setDemoMode(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: ORANGE, cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: demoMode ? '#FBBF24' : MUTED }}>Modo demonstração</span>
          </label>
        </div>
      </div>

      {/* Receita/ROAS/funil agregados: soma o que já é real em cada peça
          (leads → funil, Instagram → crescimento/engajamento, Meta Ads → ao
          vivo, insights_reports → recomendações). Sem nenhuma peça real
          ainda, fica borrado até ligar o demo — nunca mostra 0 fingido. */}
      <div style={{ margin: '24px 32px 0' }}>
        {!realLoading && (
          <DataVeil mode={panelMode}
            title={realError ? 'Erro ao carregar o painel-resumo' : 'Painel-resumo ainda sem dado real'}
            message={realError ? 'A consulta ao banco/Meta falhou — veja o erro abaixo pra saber o que corrigir.' : 'Receita, ROAS e funil agregados aqui em cima ainda não têm dado real — assim que houver leads, Instagram ou Meta Ads conectados, cada peça some aqui automaticamente. Ligue o Modo demonstração pra ver como fica quando tudo estiver somado.'}
            errorDetail={realError}
            cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
            <GrowthCommandCenter data={panelData} onOpenModule={open} />
          </DataVeil>
        )}
      </div>

      <div style={{ padding: '10px 32px 32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
          Sua equipe de agentes
        </div>

        {/* O fluxo do Growth OS: Dados observa → Conteúdo cria → Conversão
            fecha → Feedback Loop aprende e realimenta o ciclo. As setas
            indicam a sequência — cada agente entrega pro próximo. */}
        <div style={{ border: '1px solid rgba(255,109,41,0.18)', borderRadius: '22px', padding: '16px', background: 'rgba(255,109,41,0.035)' }}>
          <HeroAgentCard m={DATA_MODULE} badge="1 · Observa" onClick={() => open(DATA_MODULE.section)} />
          <FlowArrow />
          <HeroAgentCard m={CONTENT_MODULE} badge="2 · Agente principal" onClick={() => open(CONTENT_MODULE.section)} />
          <FlowArrow />
          <HeroAgentCard m={CONVERSION_MODULE} badge="3 · Converte" onClick={() => open(CONVERSION_MODULE.section)} />
          <FlowArrow />
          <HeroAgentCard m={FEEDBACK_MODULE} badge="4 · Aprende" onClick={() => open(FEEDBACK_MODULE.section)} />
        </div>

        <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginTop: '14px', maxWidth: '680px' }}>
          <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Conexões</strong> e <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Contexto do Negócio</strong> ficam em Configurações.
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
function HeroAgentCard({ m, badge, onClick }: { m: ModuleDef; badge: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', fontFamily: D,
        display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
        background: 'linear-gradient(135deg, rgba(255,109,41,0.12), rgba(255,109,41,0.04))',
        border: `1px solid ${hover ? 'rgba(255,109,41,0.6)' : 'rgba(255,109,41,0.3)'}`,
        borderRadius: '18px', padding: '24px 26px',
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 12px 34px rgba(255,109,41,0.18)' : '0 4px 18px rgba(255,109,41,0.08)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '58px', height: '58px', flexShrink: 0, borderRadius: '16px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.25)', fontSize: '30px' }}>
        {m.icon}
      </div>
      <div style={{ flex: 1, minWidth: '220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '20px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{m.title}</span>
          <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '99px', background: 'rgba(255,109,41,0.16)', border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {badge}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: MUTED, margin: 0, lineHeight: 1.55, maxWidth: '560px' }}>{m.desc}</p>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0, padding: '11px 20px', borderRadius: '11px', background: hover ? ORANGE : 'rgba(255,109,41,0.14)', border: `1px solid ${hover ? ORANGE : 'rgba(255,109,41,0.35)'}`, color: hover ? '#0E0B0A' : ORANGE, fontSize: '13px', fontWeight: 800, transition: 'background 0.18s, color 0.18s' }}>
        Abrir <span style={{ transition: 'transform 0.18s', transform: hover ? 'translateX(3px)' : 'none' }}>→</span>
      </div>
    </button>
  )
}
