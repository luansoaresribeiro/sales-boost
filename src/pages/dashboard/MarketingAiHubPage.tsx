import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ModuleCard } from './agentCardShared'
import GrowthCommandCenter from './marketingAi/GrowthCommandCenter'
import { buildGrowthDemo, useDemoMode, type GrowthDemoData, type CommandInsight, type DemoAgentStatus } from './marketingAi/growthDemo'
import { mapStage, type LeadRow } from './marketingAi/salesReal'
import type { LeadStageKey } from './marketingAi/salesDemo'
import DataVeil, { veilMode } from './marketingAi/DataVeil'
import { MUTED, BORDER, D, SUPABASE_URL } from './marketingAi/shared'

const ORANGE = '#FF6D29'
const CARD = '#150E08'

interface ModuleDef { section: string; title: string; desc: string; icon: string; soon?: boolean }

// Os agentes de crescimento — o coração do Growth OS. O Agente de Conteúdo é o
// agente principal (hero); os demais trabalham conectados a ele.
const CONTENT_MODULE: ModuleDef = { section: 'content', title: 'Agente de Conteúdo', desc: 'Calendário, ideias, roteiros de Reels, legendas, criativos e automação de comentários e DMs do Instagram.', icon: '✍️' }

const GROWTH_MODULES: ModuleDef[] = [
  { section: 'competitors', title: 'Inteligência de Mercado', desc: 'Concorrentes, tendências e oportunidades do seu segmento.', icon: '🧭' },
  { section: 'meta-ads', title: 'Agente de Meta Ads', desc: 'Analisa campanhas, otimiza orçamento e cria testes de criativo.', icon: '🎯' },
  { section: 'funil', title: 'Funil de Vendas', desc: 'CRM inteligente: captura e qualifica leads do Instagram e do WhatsApp.', icon: '🔀' },
  { section: 'whatsapp', title: 'Atendimento', desc: 'Conversas do WhatsApp e do Instagram num lugar só — responde e passa pro humano quando precisa.', icon: '💬' },
]

// Pilares de inteligência do hub. Conexões e Contexto do Negócio foram pra
// Configurações (config do cliente num lugar só) — aqui ficam os que são
// leitura/insight do agente.
const INTEL_MODULES: ModuleDef[] = [
  { section: 'feedback', title: 'Feedback Loop', desc: 'Aprende seu cliente ideal (ICP) e refina sozinho.', icon: '🔁' },
  { section: 'insights', title: 'Insights', desc: 'Oportunidades de fora: eventos, datas, tendências, parcerias.', icon: '💡' },
  { section: 'saude-meta', title: 'Saúde da Meta', desc: 'Um score de 0 a 100: quão saudável está seu ecossistema na Meta e o que melhorar primeiro.', icon: '❤️‍🩹' },
]

const STAGE_ORDER: LeadStageKey[] = ['novo', 'contato', 'qualificado', 'proposta', 'venda']
const STAGE_LABEL: Record<LeadStageKey, string> = { novo: 'Novo Lead', contato: 'Contato realizado', qualificado: 'Qualificado', proposta: 'Proposta', venda: 'Venda realizada' }
const TAB_LABEL: Record<string, string> = { avaliacoes: 'Avaliações', opinioes: 'Opiniões', concorrentes: 'Concorrentes', crescimento: 'Crescimento', performance: 'Performance', audiencia: 'Audiência', diagnostico: 'Diagnóstico de links' }

interface RealGrowth { data: GrowthDemoData; hasReal: boolean }

// Painel-resumo real: soma o que já é real em cada aba (leads → funil,
// instagram_performance_snapshots → crescimento/engajamento, meta-ads-insights
// → receita/ROAS ao vivo, insights_reports → recomendações da IA) num só
// objeto na MESMA forma que o demo usa. Nenhuma peça sem fonte real vira
// número inventado — fica null e o KpiTile mostra "—".
function useRealGrowth(companyId: string, token: string): { real: RealGrowth | null; loading: boolean } {
  const [state, setState] = useState<{ real: RealGrowth | null; loading: boolean }>({ real: null, loading: true })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: leadRows }, { data: snapRows }, { data: reportRows }, { data: companyRow }, { data: ideaRow }, { data: trendRow }] = await Promise.all([
        supabase.from('leads').select('stage, value_estimate, created_at').eq('company_id', companyId),
        supabase.from('instagram_performance_snapshots').select('captured_for, followers, engagement_rate').eq('company_id', companyId).order('captured_for', { ascending: false }).limit(30),
        supabase.from('insights_reports').select('tab_key, summary, suggestions, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
        supabase.from('companies').select('meta_ads_account_id, whatsapp_phone_number_id').eq('id', companyId).maybeSingle(),
        supabase.from('marketing_ai_ideas').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('marketing_ai_trends').select('detected_at').eq('company_id', companyId).eq('source', 'instagram_scan').order('detected_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      let ads: { connected: boolean; totals?: { spend: number; revenue: number; roas: number } } | null = null
      if (token) {
        ads = await fetch(`${SUPABASE_URL}/functions/v1/meta-ads-insights`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId }),
        }).then(r => r.json()).catch(() => null)
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
      setState({ real: { data, hasReal }, loading: false })
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
  const { real, loading: realLoading } = useRealGrowth(company?.id ?? '', session?.access_token ?? '')

  if (!company || !demo) {
    return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>Carregando...</div>
  }

  const open = (section: string) => navigate(`/dashboard/marketing-ai/${section}`)
  const panelData = real?.hasReal ? real.data : demo
  const panelMode = veilMode({ hasReal: !!real?.hasReal, demoMode, error: undefined })

  return (
    <div>
      <div style={{ padding: '26px 32px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', marginBottom: '4px' }}>
            Growth OS <span style={{ color: ORANGE }}>·</span> <span style={{ fontSize: '1rem', fontWeight: 700, color: MUTED }}>{company.business_name}</span>
          </h1>
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
            title="Painel-resumo ainda sem dado real"
            message="Receita, ROAS e funil agregados aqui em cima ainda não têm dado real — assim que houver leads, Instagram ou Meta Ads conectados, cada peça some aqui automaticamente. Ligue o Modo demonstração pra ver como fica quando tudo estiver somado."
            cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
            <GrowthCommandCenter data={panelData} onOpenModule={open} />
          </DataVeil>
        )}
      </div>

      <div style={{ padding: '10px 32px 32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
          Sua equipe de agentes
        </div>

        {/* Painel da equipe: o Agente de Conteúdo é o principal (hero) e os
            demais agentes ficam conectados logo abaixo, como um time só. */}
        <div style={{ border: '1px solid rgba(255,109,41,0.18)', borderRadius: '22px', padding: '16px', background: 'rgba(255,109,41,0.035)', marginBottom: '30px' }}>
          <HeroAgentCard m={CONTENT_MODULE} onClick={() => open(CONTENT_MODULE.section)} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 4px 12px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Trabalham junto com ele
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,109,41,0.14)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {GROWTH_MODULES.map(m => (
              <ModuleCard
                key={m.section}
                title={m.title}
                desc={m.desc}
                preview={null}
                icon={m.icon}
                soon={!!m.soon}
                openLabel="Abrir"
                soonLabel="Em breve"
                onClick={() => { if (!m.soon) open(m.section) }}
              />
            ))}
          </div>
        </div>

        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Inteligência do negócio
        </div>
        <p style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6, marginBottom: '14px', maxWidth: '680px' }}>
          O que a IA usa pra entender seu negócio — o <strong style={{ color: 'white' }}>cliente ideal</strong> (Feedback Loop), as <strong style={{ color: 'white' }}>oportunidades de fora</strong> (Insights) e a <strong style={{ color: 'white' }}>Saúde da Meta</strong> num único score. <span style={{ color: 'rgba(255,255,255,0.5)' }}>As <strong>Conexões</strong> e o <strong>Contexto do Negócio</strong> agora ficam em Configurações.</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px' }}>
          {INTEL_MODULES.map((m, i) => (
            <button key={m.section} onClick={() => open(m.section)}
              style={{ textAlign: 'left', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 17px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '7px', transition: 'border-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,109,41,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ fontSize: '20px' }}>{m.icon}</span>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{m.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: '9.5px', fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>{i + 1}/{INTEL_MODULES.length}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Card principal (hero) do Agente de Conteúdo — maior e em destaque, no topo
// do painel da equipe. Sinaliza que é o agente central sem se desconectar dos
// outros (que ficam logo abaixo, dentro do mesmo painel).
function HeroAgentCard({ m, onClick }: { m: ModuleDef; onClick: () => void }) {
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
            Agente principal
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
