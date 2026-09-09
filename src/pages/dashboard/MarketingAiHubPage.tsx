import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { ModuleCard } from './agentCardShared'
import GrowthCommandCenter from './marketingAi/GrowthCommandCenter'
import { buildGrowthDemo, useDemoMode } from './marketingAi/growthDemo'
import { MUTED, BORDER, D } from './marketingAi/shared'

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

export default function MarketingAiHubPage() {
  const { company } = useCompany()
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useDemoMode(company?.id)

  const demo = useMemo(() => (company ? buildGrowthDemo(company) : null), [company])

  if (!company || !demo) {
    return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>Carregando...</div>
  }

  const open = (section: string) => navigate(`/dashboard/marketing-ai/${section}`)

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

      {demoMode ? (
        <GrowthCommandCenter data={demo} onOpenModule={open} />
      ) : (
        <div style={{ margin: '24px 32px 0', padding: '16px 20px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '12px', fontSize: '12.5px', color: 'white', lineHeight: 1.6 }}>
          O modo demonstração está desligado. Os painéis com receita, ROAS e funil ficam vazios até as integrações reais (Meta, WhatsApp) serem conectadas e verificadas. Ligue o modo demonstração acima para ver o produto funcionando de ponta a ponta.
        </div>
      )}

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
