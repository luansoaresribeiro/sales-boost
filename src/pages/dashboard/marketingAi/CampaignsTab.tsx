import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D } from './shared'
import {
  buildCampaignDemo, FUNNEL_META, STATUS_META,
  type Campaign, type CampaignRecommendation, type FunnelStage,
} from './campaignDemo'
import { buildMetaHealthDemo, HEALTH_CLASS_META, classifyHealth } from './metaHealthDemo'
import ModuleLibrary from './ModuleLibrary'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'
import { CAMP_FUNNEL_EN, CAMP_STATUS_EN, HEALTH_CLASS_EN } from './labels.i18n'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const REC_META: Record<CampaignRecommendation['kind'], { label: string; labelEn: string; icon: string; color: string }> = {
  fix: { label: 'Corrigir', labelEn: 'Fix', icon: '🔧', color: '#f87171' },
  scale: { label: 'Escalar', labelEn: 'Scale', icon: '📈', color: GREEN },
  create: { label: 'Criar', labelEn: 'Create', icon: '✨', color: ORANGE },
  retarget: { label: 'Remarketing', labelEn: 'Remarketing', icon: '🔁', color: '#f472b6' },
}
const PRIORITY_COLOR: Record<CampaignRecommendation['priority'], string> = { high: '#f87171', medium: '#FBBF24', low: MUTED }

const TX = {
  pt: {
    priority: { high: 'Alta', medium: 'Média', low: 'Baixa' },
    demoBanner: 'Modo demonstração.', demoBannerA: ' Estas campanhas, métricas e leituras do pixel são exemplos realistas. Quando a conta de anúncios da Meta for conectada e verificada, tudo aqui vira dado real — ', demoBannerB: 'nada vai ao ar sem sua aprovação.',
    campHealth: 'Saúde da campanha', predRoas: 'ROAS previsto', reach: 'Alcance', spend: 'Gasto', whyStage: '🧠 Por que esta etapa do funil', valueOffer: '🎁 Oferta baseada em valor',
    goal: 'Objetivo', strategy: 'Estratégia', audience: 'Público', persona: 'Persona', angle: 'Ângulo', hook: 'Gancho (hook)', headline: 'Título (headline)', primaryText: 'Texto principal',
    imagePrompt: 'Prompt de imagem', videoConcept: 'Conceito de vídeo', landing: 'Landing page', successMetrics: 'Métricas de sucesso', expected: 'Resultado esperado', risk: 'Risco / atenção',
    variations: 'Variações pra testar (A/B)', variation: 'Variação', approveDemo: 'Aprovar campanha (demo)', editFields: 'Editar campos',
    noRealTitle: 'Sem campanhas reais ainda', noRealMsg: 'Este painel de campanhas pagas é um exemplo do layout. Conecte o Meta Ads pra ver campanhas reais — ou ligue o Modo demonstração pra explorar.',
    seeExample: 'Ver exemplo (modo demonstração)',
    intro1: 'O ', introStrong: 'Estrategista de Mídia Paga', intro2: ' monta campanhas com consciência de funil — escolhe a etapa certa, cria ofertas de valor (não desconto) e lê o comportamento do pixel pra decidir o próximo passo. Complementa o Agente de Conteúdo: um cuida do orgânico, o outro do pago.',
    activeCamps: 'Campanhas ativas', drafts: 'Rascunhos', portfolioAvg: 'média do portfólio', avgHealth: 'Saúde média', outOf100: 'de 100 (destas campanhas)', monthlyBudget: 'Orçamento/mês',
    metaHealth: 'Saúde da Meta:', healthDesc: 'Pixel, Business Manager e verificação — a base de qualquer campanha paga. Ver detalhes em Agente de Dados →', open: 'Abrir →',
    recsTitle: '🤖 Recomendações do estrategista', recsSub: 'O que a IA sugere agir agora — priorizado por impacto.',
    funnelTitle: '🔀 Distribuição por funil', funnelSub: 'Cada campanha ocupa uma etapa — do frio ao cliente fiel.', campaign: 'campanha', campaigns: 'campanhas',
    campsTitle: '📣 Campanhas', campsSub: 'Clique pra abrir todos os campos — todos editáveis quando for real.',
    pixelTitle: '🎯 Inteligência do Pixel da Meta', pixelSub: 'A jornada do cliente e o que cada comportamento diz pra próxima campanha.', journey: 'Jornada — onde o público some',
    whatHappens: 'O que acontece: ', why: 'Por quê: ', howImprove: 'Como melhorar: ',
    ideasTitle: '✍️ Melhores ideias de conteúdo pra campanha', ideasSub: 'O Estrategista de Mídia Paga olha o que já funcionou no orgânico (Agente de Conteúdo) antes de sugerir promover algo do zero.',
    storiesTitle: '📱 Stories Ads interativos', storiesSub: 'Story ad com sticker de verdade (enquete, quiz, slider, contagem) — engaja e ainda manda sinal rico pro pixel, diferente de um vídeo passivo.', ex: 'ex: ',
    libTitle: '🎨 Biblioteca de criativos', libSub: 'Peças geradas pela IA — legenda, ângulo e desempenho.',
    learnTitle: '🧠 Motor de aprendizado', learnSub: 'O que já funcionou melhor — a IA usa isto pra montar a próxima campanha.',
  },
  en: {
    priority: { high: 'High', medium: 'Medium', low: 'Low' },
    demoBanner: 'Demo mode.', demoBannerA: ' These campaigns, metrics and pixel readings are realistic examples. Once the Meta ad account is connected and verified, everything here becomes real data — ', demoBannerB: 'nothing goes live without your approval.',
    campHealth: 'Campaign health', predRoas: 'Predicted ROAS', reach: 'Reach', spend: 'Spend', whyStage: '🧠 Why this funnel stage', valueOffer: '🎁 Value-based offer',
    goal: 'Goal', strategy: 'Strategy', audience: 'Audience', persona: 'Persona', angle: 'Angle', hook: 'Hook', headline: 'Headline', primaryText: 'Primary text',
    imagePrompt: 'Image prompt', videoConcept: 'Video concept', landing: 'Landing page', successMetrics: 'Success metrics', expected: 'Expected result', risk: 'Risk / watch out',
    variations: 'Variations to test (A/B)', variation: 'Variation', approveDemo: 'Approve campaign (demo)', editFields: 'Edit fields',
    noRealTitle: 'No real campaigns yet', noRealMsg: 'This paid campaigns panel is an example of the layout. Connect Meta Ads to see real campaigns — or turn on Demo mode to explore.',
    seeExample: 'See an example (demo mode)',
    intro1: 'The ', introStrong: 'Paid Media Strategist', intro2: ' builds funnel-aware campaigns — picks the right stage, creates value offers (not discounts) and reads pixel behavior to decide the next step. It complements the Content Agent: one handles organic, the other paid.',
    activeCamps: 'Active campaigns', drafts: 'Drafts', portfolioAvg: 'portfolio average', avgHealth: 'Average health', outOf100: 'out of 100 (these campaigns)', monthlyBudget: 'Budget/month',
    metaHealth: 'Meta Health:', healthDesc: 'Pixel, Business Manager and verification — the foundation of any paid campaign. See details in Data Agent →', open: 'Open →',
    recsTitle: '🤖 Strategist recommendations', recsSub: 'What the AI suggests acting on now — prioritized by impact.',
    funnelTitle: '🔀 Funnel distribution', funnelSub: 'Each campaign takes a stage — from cold to loyal customer.', campaign: 'campaign', campaigns: 'campaigns',
    campsTitle: '📣 Campaigns', campsSub: 'Click to open all fields — all editable once it is real.',
    pixelTitle: '🎯 Meta Pixel Intelligence', pixelSub: 'The customer journey and what each behavior tells the next campaign.', journey: 'Journey — where the audience drops off',
    whatHappens: 'What happens: ', why: 'Why: ', howImprove: 'How to improve: ',
    ideasTitle: '✍️ Best content ideas for campaigns', ideasSub: 'The Paid Media Strategist looks at what already worked organically (Content Agent) before suggesting to promote something from scratch.',
    storiesTitle: '📱 Interactive Stories Ads', storiesSub: 'Story ads with real stickers (poll, quiz, slider, countdown) — they engage and send rich signal to the pixel, unlike a passive video.', ex: 'e.g.: ',
    libTitle: '🎨 Creative library', libSub: 'AI-generated pieces — caption, angle and performance.',
    learnTitle: '🧠 Learning engine', learnSub: 'What has worked best — the AI uses this to build the next campaign.',
  },
} as const

function Banner() {
  const t = TX[useLang().lang]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 15px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', marginBottom: '18px' }}>
      <span style={{ fontSize: '16px' }}>🧪</span>
      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5 }}>
        <strong style={{ color: '#FBBF24' }}>{t.demoBanner}</strong>{t.demoBannerA}<strong>{t.demoBannerB}</strong>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${accent ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '12px', padding: '15px 16px' }}>
      <div style={{ fontSize: '10.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: accent ? ORANGE : 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

function StageBadge({ stage }: { stage: FunnelStage }) {
  const { lang } = useLang()
  const m = FUNNEL_META[stage]
  const mLabel = lang === 'en' ? CAMP_FUNNEL_EN[stage]?.label ?? m.label : m.label
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}40`, borderRadius: '99px', padding: '3px 9px' }}>
      {m.icon} {mLabel}
    </span>
  )
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? GREEN : score >= 65 ? '#FBBF24' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '99px' }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 700, color }}>{score}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '9px 11px' }}>
      <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginTop: '2px' }}>{value}</div>
    </div>
  )
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function CampaignCard({ c }: { c: Campaign }) {
  const { lang } = useLang()
  const t = TX[lang]
  const [open, setOpen] = useState(false)
  const st = STATUS_META[c.status]
  const stLabel = lang === 'en' ? CAMP_STATUS_EN[c.status] ?? st.label : st.label
  return (
    <div style={{ background: CARD, border: `1px solid ${open ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: D }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>{c.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <StageBadge stage={c.stage} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: st.color, background: `${st.color}18`, border: `1px solid ${st.color}40`, borderRadius: '99px', padding: '3px 9px' }}>{stLabel}</span>
            </div>
          </div>
          <span style={{ fontSize: '12px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>{t.campHealth}</div>
            <HealthBar score={c.healthScore} />
          </div>
          <div>
            <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>{t.predRoas}</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: c.predictedRoas >= 3 ? GREEN : 'white' }}>{c.predictedRoas > 0 ? `${c.predictedRoas.toFixed(1)}×` : '—'}</div>
          </div>
        </div>
      </button>

      {c.metrics && (
        <div style={{ padding: '0 17px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <Metric label={t.reach} value={fmt(c.metrics.reach)} />
          <Metric label="CTR" value={`${c.metrics.ctr}%`} />
          <Metric label="Leads" value={fmt(c.metrics.leads)} />
          <Metric label={t.spend} value={`R$ ${c.metrics.spend}`} />
        </div>
      )}

      {open && (
        <div style={{ padding: '4px 17px 18px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '11px 13px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '10px', marginTop: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{t.whyStage}</div>
            <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.55 }}>{c.whyStage}</div>
          </div>

          <div style={{ padding: '11px 13px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{t.valueOffer}</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>{c.offer}</div>
            <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55 }}>{c.offerRationale}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
            <Field label={t.goal}>{c.goal}</Field>
            <Field label={t.strategy}>{c.strategy}</Field>
            <Field label={t.audience}>{c.audience}</Field>
            <Field label={t.persona}>{c.persona}</Field>
            <Field label={t.angle}>{c.angle}</Field>
            <Field label="CTA">{c.cta}</Field>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Field label={t.hook}><span style={{ fontStyle: 'italic' }}>“{c.hook}”</span></Field>
            <Field label={t.headline}>{c.headline}</Field>
            <Field label={t.primaryText}>{c.primaryText}</Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
            <Field label={t.imagePrompt}><span style={{ color: MUTED }}>{c.imagePrompt}</span></Field>
            <Field label={t.videoConcept}><span style={{ color: MUTED }}>{c.videoConcept}</span></Field>
          </div>
          <Field label={t.landing}><span style={{ color: MUTED }}>{c.landingPage}</span></Field>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t.successMetrics}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {c.successMetrics.map((m, i) => (
                <span key={i} style={{ fontSize: '11px', color: 'white', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '4px 11px' }}>✓ {m}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
            <Field label={t.expected}><span style={{ color: GREEN }}>{c.expectedOutcome}</span></Field>
            <Field label={t.risk}><span style={{ color: '#FBBF24' }}>{c.risk}</span></Field>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>{t.variations}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {c.variations.map((v, i) => (
                <div key={i} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: ORANGE, marginBottom: '3px' }}>{t.variation} {String.fromCharCode(65 + i + 1)} · {v.angle}</div>
                  <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.5 }}><span style={{ fontStyle: 'italic', color: MUTED }}>“{v.hook}”</span> — {v.headline}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button disabled style={{ padding: '9px 16px', background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '9px', color: ORANGE, fontSize: '12px', fontWeight: 700, fontFamily: D, cursor: 'not-allowed', opacity: 0.75 }}>{t.approveDemo}</button>
            <button disabled style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '12px', fontWeight: 700, fontFamily: D, cursor: 'not-allowed', opacity: 0.75 }}>{t.editFields}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CampaignsTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const navigate = useNavigate()
  const demo = useMemo(() => buildCampaignDemo(company), [company])
  const { campaigns, recommendations, pixelJourney, pixelReads, creatives, learnings, contentIdeas, storyAds, overview } = demo
  // Mesmo score que vive em Agente de Dados → Saúde da Meta — aparece aqui
  // também porque quem roda campanha paga precisa ver isso sem trocar de aba
  // (o Pixel/Business Manager são a base de tudo que acontece em Campanhas).
  const metaHealth = useMemo(() => buildMetaHealthDemo(company), [company])
  const healthKey = classifyHealth(metaHealth.overall)
  const healthCls = HEALTH_CLASS_META[healthKey]
  const healthLabel = lang === 'en' ? HEALTH_CLASS_EN[healthKey] ?? healthCls.label : healthCls.label

  // Distribuição por etapa do funil (só as etapas que têm campanha).
  const stageCounts = useMemo(() => {
    const counts: Partial<Record<FunnelStage, number>> = {}
    campaigns.forEach(c => { counts[c.stage] = (counts[c.stage] ?? 0) + 1 })
    return counts
  }, [campaigns])

  const maxJourney = pixelJourney[0]?.count ?? 1
  // Campanhas reais virão da Meta Ads; sem dado real, layout borrado.
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const mode = veilMode({ hasReal: false, demoMode })
  const sectionTitle = (t: string, s: string) => (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', fontFamily: D }}>{t}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>{s}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: '1080px' }}>
    <DataVeil mode={mode}
      title={t.noRealTitle}
      message={t.noRealMsg}
      cta={{ label: t.seeExample, onClick: () => setDemoMode(true) }}>
      <Banner />

      <div style={{ marginBottom: '10px', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
        {t.intro1}<strong style={{ color: 'white' }}>{t.introStrong}</strong>{t.intro2}
      </div>

      {/* Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', margin: '18px 0 14px' }}>
        <StatCard label={t.activeCamps} value={overview.active} accent />
        <StatCard label={t.drafts} value={overview.drafts} />
        <StatCard label={t.predRoas} value={`${overview.predictedRoas.toFixed(1)}×`} sub={t.portfolioAvg} />
        <StatCard label={t.avgHealth} value={overview.health} sub={t.outOf100} />
        <StatCard label={t.monthlyBudget} value={overview.monthlyBudget} />
      </div>

      {/* Saúde da Meta — mesmo score de Agente de Dados → Saúde da Meta,
          repetido aqui porque quem roda campanha paga precisa dele sem sair
          da aba (Pixel/Business Manager são a base de qualquer campanha). */}
      <button onClick={() => navigate('/dashboard/marketing-ai/saude-meta')}
        style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 16px', marginBottom: '26px', cursor: 'pointer', fontFamily: D }}>
        <span style={{ fontSize: '22px' }}>❤️‍🩹</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'white' }}>{t.metaHealth} <span style={{ color: healthCls.color }}>{metaHealth.overall}/100 · {healthLabel}</span></div>
          <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '1px' }}>{t.healthDesc}</div>
        </div>
        <span style={{ fontSize: '11px', color: ORANGE, fontWeight: 700, flexShrink: 0 }}>{t.open}</span>
      </button>

      {/* Recomendações da IA */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(t.recsTitle, t.recsSub)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {recommendations.map(r => {
            const m = REC_META[r.kind]
            return (
              <div key={r.id} style={{ display: 'flex', gap: '12px', padding: '13px 15px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{r.title}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}40`, borderRadius: '99px', padding: '2px 8px' }}>{lang === 'en' ? m.labelEn : m.label}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: PRIORITY_COLOR[r.priority] }}>● {t.priority[r.priority]}</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, marginBottom: '6px' }}>{r.detail}</div>
                  <div style={{ fontSize: '11.5px', color: ORANGE, fontWeight: 600 }}>→ {r.action}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Funil */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(t.funnelTitle, t.funnelSub)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {(Object.keys(FUNNEL_META) as FunnelStage[]).map(stage => {
            const m = FUNNEL_META[stage]
            const count = stageCounts[stage] ?? 0
            return (
              <div key={stage} style={{ background: CARD, border: `1px solid ${count > 0 ? `${m.color}40` : BORDER}`, borderRadius: '11px', padding: '13px 10px', textAlign: 'center', opacity: count > 0 ? 1 : 0.5 }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{m.icon}</div>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: m.color, marginBottom: '4px' }}>{lang === 'en' ? CAMP_FUNNEL_EN[stage]?.short ?? m.short : m.short}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>{count}</div>
                <div style={{ fontSize: '9px', color: MUTED }}>{count === 1 ? t.campaign : t.campaigns}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Campanhas */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(t.campsTitle, t.campsSub)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {campaigns.map(c => <CampaignCard key={c.id} c={c} />)}
        </div>
      </div>

      {/* Meta Pixel Intelligence */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(t.pixelTitle, t.pixelSub)}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', marginBottom: '11px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{t.journey}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {pixelJourney.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '120px', flexShrink: 0, fontSize: '11.5px', color: 'white' }}>{s.label}</div>
                <div style={{ flex: 1, height: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max((s.count / maxJourney) * 100, 2)}%`, height: '100%', background: `linear-gradient(90deg, ${ORANGE}, rgba(255,109,41,0.5))`, borderRadius: '6px' }} />
                </div>
                <div style={{ width: '64px', flexShrink: 0, textAlign: 'right', fontSize: '11.5px', fontWeight: 700, color: 'white' }}>{fmt(s.count)}</div>
                <div style={{ width: '48px', flexShrink: 0, textAlign: 'right', fontSize: '10.5px', fontWeight: 700, color: s.drop ? '#f87171' : 'transparent' }}>{s.drop ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {pixelReads.map((p, i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 15px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: ORANGE, marginBottom: '7px' }}>{p.event}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', lineHeight: 1.5 }}>
                <div><span style={{ color: MUTED }}>{t.whatHappens}</span><span style={{ color: 'white' }}>{p.what}</span></div>
                <div><span style={{ color: MUTED }}>{t.why}</span><span style={{ color: 'white' }}>{p.why}</span></div>
                <div><span style={{ color: MUTED }}>{t.howImprove}</span><span style={{ color: 'white' }}>{p.improve}</span></div>
                <div style={{ marginTop: '3px', paddingTop: '7px', borderTop: `1px solid ${BORDER}`, color: GREEN }}>→ {p.nextCampaign}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Melhores ideias de conteúdo pra promover */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(t.ideasTitle, t.ideasSub)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
          {contentIdeas.map(ci => {
            const m = FUNNEL_META[ci.stage]
            return (
              <div key={ci.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}40`, borderRadius: '99px', padding: '2px 8px' }}>{m.icon} {lang === 'en' ? CAMP_FUNNEL_EN[ci.stage]?.short ?? m.short : m.short}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: MUTED }}>{ci.format}</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '5px', lineHeight: 1.4 }}>{ci.title}</div>
                <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>{ci.why}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stories Ads interativos */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(t.storiesTitle, t.storiesSub)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
          {storyAds.map(sa => (
            <div key={sa.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 14px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#f472b6', background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.3)', borderRadius: '99px', padding: '2px 8px', display: 'inline-block', textTransform: 'uppercase', marginBottom: '7px' }}>{sa.sticker}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '5px', lineHeight: 1.4 }}>{sa.concept}</div>
              <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.5, marginBottom: '6px' }}>{sa.goal}</div>
              <div style={{ fontSize: '10.5px', color: ORANGE, fontStyle: 'italic' }}>{t.ex}{sa.example}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Biblioteca de criativos */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(t.libTitle, t.libSub)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
          {creatives.map(cr => (
            <div key={cr.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ height: '96px', background: 'linear-gradient(135deg, rgba(255,109,41,0.15), rgba(255,109,41,0.03))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>
                {cr.format === 'reel' ? '🎬' : cr.format === 'carrossel' ? '🖼️' : '📸'}
              </div>
              <div style={{ padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cr.format}</span>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>·</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: ORANGE }}>{cr.tone}</span>
                  {cr.ctr != null && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: GREEN }}>CTR {cr.ctr}%</span>}
                </div>
                <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.5, marginBottom: '4px' }}>{cr.caption}</div>
                <div style={{ fontSize: '10px', color: MUTED }}>{cr.angle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Motor de aprendizado */}
      <div>
        {sectionTitle(t.learnTitle, t.learnSub)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '9px' }}>
          {learnings.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: '11px', padding: '12px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>🏆</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{l.dimension}</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>{l.winner}</div>
                <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{l.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </DataVeil>

      <ModuleLibrary module="campanhas" />
    </div>
  )
}
