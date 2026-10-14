import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useLang } from '../../../contexts/LanguageContext'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { BORDER, MUTED, D } from './shared'
import ContentLibrary from './ContentLibrary'
import ContentOverviewTab from './ContentOverviewTab'
import WeeklyCalendarTab from './WeeklyCalendarTab'
import PerformanceTab from './PerformanceTab'
import MetaAdsTab from './MetaAdsTab'
import CampaignsTab from './CampaignsTab'
import MetaHealthTab from './MetaHealthTab'

const ORANGE = '#FF6D29'

type Top = 'conteudo' | 'campanha'
type ContentSub = 'calendario' | 'padrao'
type CampaignSub = 'resultados' | 'ideal' | 'anuncios' | 'saude'

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
const TX = {
  pt: {
    top: { conteudo: { icon: '✍️', label: 'Conteúdo', sub: 'Calendário da semana e padrão visual' }, campanha: { icon: '🎯', label: 'Campanha', sub: 'Análise, pixel e campanha ideal' } },
    content: { calendario: ['🗓️', 'Calendário da semana'], padrao: ['🎨', 'Padrão visual'] },
    campaign: { resultados: ['📈', 'Como os conteúdos estão indo'], ideal: ['📣', 'Campanha ideal e pixel'], anuncios: ['💰', 'Anúncios (Meta Ads)'], saude: ['❤️‍🩹', 'Saúde da Meta'] },
    soon: 'EM BREVE', overview: 'Resumo da semana',
    soonTitle: 'Rodar campanhas pagas chega em breve.',
    soonBody: ' Enquanto isso, esta aba já lê como seus conteúdos estão indo e mostra qual campanha valeria a pena rodar. Nenhum anúncio vai ao ar sem a sua aprovação.',
  },
  en: {
    top: { conteudo: { icon: '✍️', label: 'Content', sub: 'Weekly calendar and visual pattern' }, campanha: { icon: '🎯', label: 'Campaign', sub: 'Analysis, pixel and ideal campaign' } },
    content: { calendario: ['🗓️', 'Weekly calendar'], padrao: ['🎨', 'Visual pattern'] },
    campaign: { resultados: ['📈', 'How your content is doing'], ideal: ['📣', 'Ideal campaign & pixel'], anuncios: ['💰', 'Ads (Meta Ads)'], saude: ['❤️‍🩹', 'Meta Health'] },
    soon: 'COMING SOON', overview: 'Week summary',
    soonTitle: 'Running paid campaigns is coming soon.',
    soonBody: ' Meanwhile, this tab already reads how your content is doing and shows which campaign would be worth running. No ad goes live without your approval.',
  },
} as const

type Company = Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city' | 'instagram_user_id' | 'instagram_url'>

export default function ContentSection({ company }: { company: Company }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab')
  const [top, setTop] = useState<Top>(tab === 'campanha' ? 'campanha' : 'conteudo')
  const [contentSub, setContentSub] = useState<ContentSub>('calendario')

  const pickTop = (k: Top) => {
    setTop(k)
    const next = new URLSearchParams(params)
    if (k === 'campanha') next.set('tab', 'campanha'); else next.delete('tab')
    next.delete('sub')
    setParams(next, { replace: true })
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {(['conteudo', 'campanha'] as const).map(k => (
          <TabButton key={k} t={tx.top[k]} active={top === k} onClick={() => pickTop(k)} badge={k === 'campanha' ? tx.soon : undefined} />
        ))}
      </div>

      {top === 'campanha' ? <CampanhaPanel company={company} /> : (
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
  const navigate = useNavigate()
  // A sub-aba mora na URL (?sub=…) — assim o atalho "Saúde da Meta" de
  // dentro da Campanha ideal troca de sub-aba sem recarregar.
  const [params, setParams] = useSearchParams()
  const raw = params.get('sub')
  const sub: CampaignSub = raw === 'ideal' || raw === 'anuncios' || raw === 'saude' ? raw : 'resultados'
  const setSub = (k: CampaignSub) => {
    const next = new URLSearchParams(params)
    next.set('tab', 'campanha'); next.set('sub', k)
    setParams(next, { replace: true })
  }
  return (
    <div>
      <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6, background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', maxWidth: '820px' }}>
        <strong style={{ color: ORANGE }}>{tx.soonTitle}</strong>{tx.soonBody}
      </div>
      <SubTabs items={(['resultados', 'ideal', 'anuncios', 'saude'] as const).map(k => [k, ...tx.campaign[k]] as const)} active={sub} onPick={setSub} />
      {sub === 'resultados' ? <PerformanceTab company={company} onCreateContent={() => navigate('/dashboard/marketing-ai/content')} />
        : sub === 'ideal' ? <CampaignsTab company={company} />
        : sub === 'anuncios' ? <MetaAdsTab company={company} />
        : <MetaHealthTab company={company} />}
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
