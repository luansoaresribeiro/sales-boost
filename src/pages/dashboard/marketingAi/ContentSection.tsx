import { useState } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../../../contexts/LanguageContext'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { BORDER, MUTED, D } from './shared'
import ContentLibrary from './ContentLibrary'
import ContentOverviewTab from './ContentOverviewTab'
import WeeklyCalendarTab from './WeeklyCalendarTab'
import MetaAdsTab from './MetaAdsTab'
import CampaignsTab from './CampaignsTab'
import MetaHealthTab from './MetaHealthTab'
import WhatsAppTab from './WhatsAppTab'
import EngagementTab from './EngagementTab'

const ORANGE = '#FF6D29'

type Top = 'conteudo' | 'campanha' | 'conversas'
type ContentSub = 'calendario' | 'padrao'
type CampaignSub = 'ideal' | 'anuncios' | 'saude'
type TalkSub = 'atendimento' | 'respostas'

// Agente de Conteúdo e Campanha — reorganizado em 2026-10-14 a pedido do
// dono em DUAS abas de topo:
// - Conteúdo: Calendário da semana (o overview: o que sai em cada dia, feed
//   e stories, + resumo de agendados/funil) e Padrão visual (marca + formatos).
//   A aba Vault saiu em 2026-10-14 (pedido do dono): a análise e a nota de
//   cada peça abrem clicando nela na grade do calendário (CalendarPostModal),
//   com aprovar/agendar ali mesmo.
// - Campanha ("em breve" pra rodar anúncio pago): como os conteúdos estão
//   indo (Instagram real), campanha ideal + pixel, anúncios (Meta Ads) e
//   Saúde da Meta (antes no Agente de Dados).
// Saíram: Biblioteca (virou Padrão visual + Vault), Testes e a sub-aba
// Ideias do calendário (o calendário vem da estratégia, não de ideia solta).
// Deep links antigos: ?tab=biblioteca|vault → Calendário; ?tab=campanha[&sub=…].
// 2026-11-01 (pedido do dono, Ativação = tudo que vai para a rua): nova aba de topo Conversas (Atendimento +
// respostas automáticas de comentários/DMs, vindas do antigo Agente de Conversão). "Como os conteúdos estão indo"
// saiu da Campanha e foi para Resultados e Aprendizado → Desempenho dos posts (link antigo redireciona).
const TX = {
  pt: {
    top: { conteudo: { icon: '✍️', label: 'Conteúdo', sub: 'Calendário da semana e padrão visual' }, campanha: { icon: '🎯', label: 'Campanha', sub: 'Pixel, campanha ideal e anúncios' }, conversas: { icon: '💬', label: 'Conversas', sub: 'Atendimento e respostas a comentários/DMs' } },
    talk: { atendimento: ['💬', 'Atendimento'], respostas: ['🤝', 'Respostas automáticas (comentários e DMs)'] },
    content: { calendario: ['🗓️', 'Calendário da semana'], padrao: ['🎨', 'Padrão visual'] },
    campaign: { ideal: ['📣', 'Campanha ideal e pixel'], anuncios: ['💰', 'Anúncios (Meta Ads)'], saude: ['❤️‍🩹', 'Saúde da Meta'] },
    soon: 'EM BREVE', overview: 'Resumo da semana',
    soonTitle: 'Rodar campanhas pagas chega em breve.',
    soonBody: ' Enquanto isso, esta aba já mostra qual campanha valeria a pena rodar (o desempenho dos posts fica em Resultados e Aprendizado). Nenhum anúncio vai ao ar sem a sua aprovação.',
  },
  en: {
    top: { conteudo: { icon: '✍️', label: 'Content', sub: 'Weekly calendar and visual pattern' }, campanha: { icon: '🎯', label: 'Campaign', sub: 'Pixel, ideal campaign and ads' }, conversas: { icon: '💬', label: 'Conversations', sub: 'Customer service and comment/DM replies' } },
    talk: { atendimento: ['💬', 'Customer service'], respostas: ['🤝', 'Automatic replies (comments and DMs)'] },
    content: { calendario: ['🗓️', 'Weekly calendar'], padrao: ['🎨', 'Visual pattern'] },
    campaign: { ideal: ['📣', 'Ideal campaign & pixel'], anuncios: ['💰', 'Ads (Meta Ads)'], saude: ['❤️‍🩹', 'Meta Health'] },
    soon: 'COMING SOON', overview: 'Week summary',
    soonTitle: 'Running paid campaigns is coming soon.',
    soonBody: ' Meanwhile, this tab already shows which campaign would be worth running (post performance lives in Results & Learning). No ad goes live without your approval.',
  },
} as const

type Company = Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city' | 'instagram_user_id' | 'instagram_url'>

export default function ContentSection({ company }: { company: Company }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab')
  // Aba "Campanha" (anúncios) fora do menu (dono, 2026-11-13: anúncio pago fora do modelo) — escondida, código mantido.
  // Link antigo ?tab=campanha cai no Conteúdo; ?tab=campanha&sub=saude continua abrindo a Saúde da Meta (conexão, não anúncio).
  const metaHealth = tab === 'campanha' && params.get('sub') === 'saude'
  const [top, setTop] = useState<Top>(tab === 'conversas' ? 'conversas' : 'conteudo')
  const [contentSub, setContentSub] = useState<ContentSub>('calendario')

  const pickTop = (k: Top) => {
    setTop(k)
    const next = new URLSearchParams(params)
    if (k === 'conteudo') next.delete('tab'); else next.set('tab', k)
    next.delete('sub')
    setParams(next, { replace: true })
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {(['conteudo', 'conversas'] as const).map(k => (
          <TabButton key={k} t={tx.top[k]} active={top === k} onClick={() => pickTop(k)} />
        ))}
      </div>

      {metaHealth ? <MetaHealthTab company={company} /> : top === 'campanha' ? <CampanhaPanel company={company} /> : top === 'conversas' ? <ConversasPanel company={company} /> : (
        <div>
          <SubTabs items={(['calendario', 'padrao'] as const).map(k => [k, ...tx.content[k]] as const)} active={contentSub} onPick={setContentSub} />
          {contentSub === 'calendario' ? (
            <>
              <WeeklyCalendarTab companyId={company.id} />
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '22px', marginTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{tx.overview}</div>
                <ContentOverviewTab companyId={company.id} />
              </div>
            </>
          ) : <ContentLibrary companyId={company.id} />}
        </div>
      )}
    </div>
  )
}

function CampanhaPanel({ company }: { company: Company }) {
  const { lang } = useLang()
  const tx = TX[lang]
  // A sub-aba mora na URL (?sub=…) — assim o atalho "Saúde da Meta" de
  // dentro da Campanha ideal troca de sub-aba sem recarregar.
  const [params, setParams] = useSearchParams()
  const raw = params.get('sub')
  const sub: CampaignSub = raw === 'anuncios' || raw === 'saude' ? raw : 'ideal'
  const setSub = (k: CampaignSub) => {
    const next = new URLSearchParams(params)
    next.set('tab', 'campanha'); next.set('sub', k)
    setParams(next, { replace: true })
  }
  if (raw === 'resultados') return <Navigate to="/dashboard/marketing-ai/conversao?sub=desempenho" replace />
  return (
    <div>
      <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6, background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', maxWidth: '820px' }}>
        <strong style={{ color: ORANGE }}>{tx.soonTitle}</strong>{tx.soonBody}
      </div>
      <SubTabs items={(['ideal', 'anuncios', 'saude'] as const).map(k => [k, ...tx.campaign[k]] as const)} active={sub} onPick={setSub} />
      {sub === 'ideal' ? <CampaignsTab company={company} />
        : sub === 'anuncios' ? <MetaAdsTab company={company} />
        : <MetaHealthTab company={company} />}
    </div>
  )
}

// Conversas: responder quem chegou (WhatsApp e respostas automáticas de comentários/DMs, ex.: "Comente QUERO").
// Nada é enviado sem aprovação do dono — a regra mora dentro de cada aba, que não mudou.
function ConversasPanel({ company }: { company: Company }) {
  const tx = TX[useLang().lang]
  const [params, setParams] = useSearchParams()
  const sub: TalkSub = params.get('sub') === 'respostas' ? 'respostas' : 'atendimento'
  const setSub = (k: TalkSub) => { const next = new URLSearchParams(params); next.set('tab', 'conversas'); next.set('sub', k); setParams(next, { replace: true }) }
  return (
    <div>
      <SubTabs items={(['atendimento', 'respostas'] as const).map(k => [k, ...tx.talk[k]] as const)} active={sub} onPick={setSub} />
      {sub === 'atendimento' ? <WhatsAppTab company={company} /> : <EngagementTab company={company} />}
    </div>
  )
}

function SubTabs<K extends string>({ items, active, onPick }: { items: readonly (readonly [K, string, string])[]; active: K; onPick: (k: K) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px', marginBottom: '20px', flexWrap: 'wrap' }}>
      {items.map(([k, icon, label]) => (
        <button key={k} onClick={() => onPick(k)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 13px', background: active === k ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${active === k ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
          <span style={{ fontSize: '14px' }}>{icon}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: active === k ? ORANGE : 'white' }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

function TabButton({ t, active, onClick, badge }: { t: { icon: string; label: string; sub: string }; active: boolean; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 15px', background: active ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${active ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '9px', cursor: 'pointer', fontFamily: D, textAlign: 'left' }}>
      <span style={{ fontSize: '17px' }}>{t.icon}</span>
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: active ? ORANGE : 'white' }}>
          {t.label}
          {badge && <span style={{ marginLeft: '7px', fontSize: '8.5px', fontWeight: 800, color: ORANGE, background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.35)', borderRadius: '99px', padding: '1px 6px', verticalAlign: 'middle' }}>{badge}</span>}
        </div>
        <div style={{ fontSize: '10px', color: MUTED }}>{t.sub}</div>
      </div>
    </button>
  )
}
