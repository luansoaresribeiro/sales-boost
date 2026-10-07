import { useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { CARD, MUTED, BORDER, D } from './shared'
import {
  buildStoriesDemo, STICKER_META, STORY_STAGE_META, STORY_STATUS_META,
  type OrganicStory, type StoryAd, type StoryStage,
} from './storiesDemo'
import ModuleLibrary from './ModuleLibrary'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: {
    demo1: 'Modo demonstração.', demo2: ' Stories, figurinhas interativas e Story Ads de exemplo. Ao conectar a conta da Meta, o agente cria, agenda e publica de verdade — sempre ', demo3: 'com sua aprovação', demo4: '. Tudo é configurável no Control Center.',
    stage: { topo: 'Topo', meio: 'Meio', fundo: 'Fundo' } as Record<string, string>,
    sticker: { poll: 'Enquete', question: 'Caixa de pergunta', quiz: 'Quiz', countdown: 'Contagem regressiva', slider: 'Slider de emoji', link: 'Link' } as Record<string, string>,
    status: { rascunho: 'Rascunho', agendado: 'Agendado', publicado: 'Publicado' } as Record<string, string>,
    closeDet: 'Fechar detalhes ▲', seeDet: 'Ver detalhes ▼', storyText: 'Texto do Story', mediaPrompt: 'Prompt da mídia (IA)', whyNow: '🧠 Por que agora',
    approveDemo: 'Aprovar e agendar (demo)', edit: 'Editar',
    active: 'Ativa', draft: 'Rascunho', health: 'saúde', reach: 'Alcance', retention: 'Retenção', costRes: 'Custo/result.',
    objective: 'Objetivo', audience: 'Público', hook: 'Gancho', mainText: 'Texto principal', creativePrompt: 'Prompt do criativo (IA)',
    forward: 'Avançar', back: 'Voltar', replies: 'Respostas', conversions: 'Conversões', abTest: 'Variações em teste (A/B)', variation: 'Variação',
    noStoriesT: 'Sem stories reais ainda', noStoriesM: 'Este painel de stories é um exemplo do layout. Quando o Instagram estiver conectado, os stories reais entram aqui. Ligue o Modo demonstração pra explorar.',
    seeExample: 'Ver exemplo (modo demonstração)',
    i1: 'O agente cria ', i2: 'Stories orgânicos', i3: ' (com enquete, pergunta, quiz, contagem e link) e ', i4: 'Story Ads interativos', i5: ', testa variações em A/B e aprende o que engaja mais — alimentando o cérebro de marketing pra melhorar tudo daqui pra frente.',
    scheduled: 'Agendados', drafts: 'Rascunhos', activeAds: 'Story Ads ativos', predCtr: 'CTR previsto', avgRet: 'Retenção média', monthly: 'Verba/mês',
    cfgT: '⚙️ Configuração (Control Center)', cfgS: 'Automação, agenda, verba, meta de otimização, interações, aprendizado e aprovação — tudo editável pelo dono.',
    automation: 'Automação', on: '🟢 Ligada', off: '⚪ Desligada', schedule: 'Agenda de publicação', adBudget: 'Verba de anúncios', optGoal: 'Meta de otimização', approvalFlow: 'Fluxo de aprovação',
    contLearn: 'Aprendizado contínuo', onM: '🟢 Ligado', offM: '⚪ Desligado', interTypes: 'Tipos de interação ativos',
    orgT: '📖 Stories orgânicos', orgS: 'Prontos pra aprovar. Cada um com figurinha interativa e o porquê da IA.',
    adsT: '🎯 Story Ads interativos', adsS: 'Anúncios em Stories com enquete/quiz/contagem, testados em A/B e otimizados por resultado.',
    learnT: '🧠 O que os Stories ensinaram', learnS: 'O agente aprende o que engaja mais e melhora sozinho — e isso vai pro cérebro de marketing, ajudando todo o resto do conteúdo.',
  },
  en: {
    demo1: 'Demo mode.', demo2: ' Sample Stories, interactive stickers and Story Ads. Once you connect your Meta account, the agent creates, schedules and publishes for real — always ', demo3: 'with your approval', demo4: '. Everything is configurable in the Control Center.',
    stage: { topo: 'Top', meio: 'Middle', fundo: 'Bottom' } as Record<string, string>,
    sticker: { poll: 'Poll', question: 'Question box', quiz: 'Quiz', countdown: 'Countdown', slider: 'Emoji slider', link: 'Link' } as Record<string, string>,
    status: { rascunho: 'Draft', agendado: 'Scheduled', publicado: 'Published' } as Record<string, string>,
    closeDet: 'Hide details ▲', seeDet: 'See details ▼', storyText: 'Story text', mediaPrompt: 'Media prompt (AI)', whyNow: '🧠 Why now',
    approveDemo: 'Approve and schedule (demo)', edit: 'Edit',
    active: 'Active', draft: 'Draft', health: 'health', reach: 'Reach', retention: 'Retention', costRes: 'Cost/result',
    objective: 'Objective', audience: 'Audience', hook: 'Hook', mainText: 'Primary text', creativePrompt: 'Creative prompt (AI)',
    forward: 'Forward', back: 'Back', replies: 'Replies', conversions: 'Conversions', abTest: 'Variations being tested (A/B)', variation: 'Variation',
    noStoriesT: 'No real stories yet', noStoriesM: 'This stories panel is a layout example. When Instagram is connected, real stories show up here. Turn on Demo mode to explore.',
    seeExample: 'See example (demo mode)',
    i1: 'The agent creates ', i2: 'organic Stories', i3: ' (with poll, question, quiz, countdown and link) and ', i4: 'interactive Story Ads', i5: ', tests A/B variations and learns what engages most — feeding the marketing brain to improve everything from here on.',
    scheduled: 'Scheduled', drafts: 'Drafts', activeAds: 'Active Story Ads', predCtr: 'Predicted CTR', avgRet: 'Avg retention', monthly: 'Budget/month',
    cfgT: '⚙️ Settings (Control Center)', cfgS: 'Automation, schedule, budget, optimization goal, interactions, learning and approval — all editable by the owner.',
    automation: 'Automation', on: '🟢 On', off: '⚪ Off', schedule: 'Publishing schedule', adBudget: 'Ad budget', optGoal: 'Optimization goal', approvalFlow: 'Approval flow',
    contLearn: 'Continuous learning', onM: '🟢 On', offM: '⚪ Off', interTypes: 'Active interaction types',
    orgT: '📖 Organic Stories', orgS: 'Ready to approve. Each one with an interactive sticker and the AI reasoning.',
    adsT: '🎯 Interactive Story Ads', adsS: 'Ads in Stories with poll/quiz/countdown, A/B tested and optimized by result.',
    learnT: '🧠 What Stories taught', learnS: 'The agent learns what engages most and improves on its own — and that goes to the marketing brain, helping all the rest of the content.',
  },
} as const

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

function Banner() {
  const tx = TX[useLang().lang]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 15px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', marginBottom: '18px' }}>
      <span style={{ fontSize: '16px' }}>🧪</span>
      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5 }}>
        <strong style={{ color: '#FBBF24' }}>{tx.demo1}</strong>{tx.demo2}<strong>{tx.demo3}</strong>{tx.demo4}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${accent ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '12px', padding: '14px 15px' }}>
      <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: accent ? ORANGE : 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

function StageTag({ stage }: { stage: StoryStage }) {
  const tx = TX[useLang().lang]
  const m = STORY_STAGE_META[stage]
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}40`, borderRadius: '99px', padding: '2px 8px' }}>{m.icon} {tx.stage[stage]}</span>
}

function StickerChip({ kind, detail }: { kind: keyof typeof STICKER_META; detail: string }) {
  const tx = TX[useLang().lang]
  const m = STICKER_META[kind]
  return <span style={{ fontSize: '10px', color: 'white', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '3px 9px' }}>{m.icon} {tx.sticker[kind] ?? m.label}: {detail}</span>
}

// Mini prévia vertical 9:16 estilo Story.
function StoryPreview({ text, cta, stickerIcon }: { text: string; cta: string; stickerIcon: string }) {
  return (
    <div style={{ width: '92px', flexShrink: 0, aspectRatio: '9 / 16', borderRadius: '12px', background: 'linear-gradient(160deg, rgba(255,109,41,0.35), rgba(21,14,8,0.9))', border: `1px solid ${BORDER}`, padding: '9px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
      <div style={{ fontSize: '8.5px', color: 'white', lineHeight: 1.35, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</div>
      <div style={{ alignSelf: 'center', fontSize: '18px' }}>{stickerIcon}</div>
      <div style={{ fontSize: '8px', fontWeight: 800, color: '#000', background: 'white', borderRadius: '99px', padding: '3px 6px', textAlign: 'center' }}>{cta}</div>
    </div>
  )
}

function fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }

function OrganicCard({ s }: { s: OrganicStory }) {
  const tx = TX[useLang().lang]
  const [open, setOpen] = useState(false)
  const st = STORY_STATUS_META[s.status]
  const stickerIcon = s.stickers[0] ? STICKER_META[s.stickers[0].kind].icon : '✨'
  return (
    <div style={{ background: CARD, border: `1px solid ${open ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '14px', padding: '14px', display: 'flex', gap: '13px' }}>
      <StoryPreview text={s.text} cta={s.cta} stickerIcon={stickerIcon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{s.format === 'vídeo' ? '🎬' : '📷'} {s.title}</span>
          <StageTag stage={s.stage} />
          <span style={{ fontSize: '9px', fontWeight: 700, color: st.color, background: `${st.color}18`, border: `1px solid ${st.color}40`, borderRadius: '99px', padding: '2px 8px' }}>{tx.status[s.status] ?? st.label}</span>
        </div>
        <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '7px' }}>🗓️ {s.scheduledFor}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '9px' }}>
          {s.stickers.map((st2, i) => <StickerChip key={i} kind={st2.kind} detail={st2.detail} />)}
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'transparent', border: 'none', color: ORANGE, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D, padding: 0 }}>
          {open ? tx.closeDet : tx.seeDet}
        </button>
        {open && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <Field label={tx.storyText}>{s.text}</Field>
            <Field label={tx.mediaPrompt}><span style={{ color: MUTED }}>{s.mediaPrompt}</span></Field>
            <div style={{ padding: '9px 11px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '9px' }}>
              <Field label={tx.whyNow}>{s.whyNow}</Field>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled style={{ padding: '8px 15px', background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '9px', color: ORANGE, fontSize: '12px', fontWeight: 700, fontFamily: D, cursor: 'not-allowed', opacity: 0.75 }}>{tx.approveDemo}</button>
              <button disabled style={{ padding: '8px 15px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '12px', fontWeight: 700, fontFamily: D, cursor: 'not-allowed', opacity: 0.75 }}>{tx.edit}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '8px 10px' }}>
      <div style={{ fontSize: '9px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginTop: '2px' }}>{value}</div>
    </div>
  )
}

function AdCard({ a }: { a: StoryAd }) {
  const tx = TX[useLang().lang]
  const [open, setOpen] = useState(false)
  const color = a.healthScore >= 80 ? GREEN : a.healthScore >= 65 ? '#FBBF24' : '#f87171'
  return (
    <div style={{ background: CARD, border: `1px solid ${open ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '15px 17px', fontFamily: D, display: 'flex', flexDirection: 'column', gap: '9px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '5px' }}>{a.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: STICKER_META[a.interaction] ? '#a78bfa' : MUTED, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '2px 8px' }}>{STICKER_META[a.interaction].icon} {tx.sticker[a.interaction] ?? STICKER_META[a.interaction].label}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: a.status === 'ativa' ? GREEN : '#FBBF24', background: a.status === 'ativa' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)', borderRadius: '99px', padding: '2px 8px' }}>{a.status === 'ativa' ? tx.active : tx.draft}</span>
              <span style={{ fontSize: '10px', color: MUTED }}>{a.budget}</span>
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color }}>{a.healthScore}</div>
            <div style={{ fontSize: '8px', color: MUTED }}>{tx.health}</div>
          </div>
          <span style={{ fontSize: '11px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
        {a.metrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px', width: '100%' }}>
            <Metric label={tx.reach} value={fmt(a.metrics.reach)} />
            <Metric label="CTR" value={`${a.metrics.ctr}%`} />
            <Metric label={tx.retention} value={`${a.metrics.retention}%`} />
            <Metric label={tx.costRes} value={`R$ ${a.metrics.costPerResult}`} />
          </div>
        )}
      </button>
      {open && (
        <div style={{ padding: '2px 17px 17px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '13px' }}>
            <Field label={tx.objective}>{a.objective}</Field>
            <Field label={tx.audience}>{a.audience}</Field>
            <Field label={tx.hook}><span style={{ fontStyle: 'italic' }}>“{a.hook}”</span></Field>
            <Field label="CTA">{a.cta}</Field>
          </div>
          <Field label={tx.mainText}>{a.primaryText}</Field>
          <Field label={tx.creativePrompt}><span style={{ color: MUTED }}>{a.creativePrompt}</span></Field>
          {a.metrics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
              <Metric label={tx.forward} value={fmt(a.metrics.tapsForward)} />
              <Metric label={tx.back} value={fmt(a.metrics.tapsBack)} />
              <Metric label={tx.replies} value={fmt(a.metrics.replies)} />
              <Metric label={tx.conversions} value={fmt(a.metrics.conversions)} />
            </div>
          )}
          <div>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>{tx.abTest}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {a.variations.map((v, i) => (
                <div key={i} style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', fontSize: '11.5px', color: 'white' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: ORANGE }}>{tx.variation} {String.fromCharCode(65 + i + 1)} · {v.angle} · {STICKER_META[v.sticker].icon}</span>
                  <div style={{ marginTop: '2px', fontStyle: 'italic', color: MUTED }}>“{v.hook}”</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StoriesTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'> }) {
  const tx = TX[useLang().lang]
  const demo = useMemo(() => buildStoriesDemo(company), [company])
  const { organic, ads, learnings, config, overview } = demo
  // Stories reais virão do Instagram/Meta; sem dado real, layout borrado.
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
      title={tx.noStoriesT}
      message={tx.noStoriesM}
      cta={{ label: tx.seeExample, onClick: () => setDemoMode(true) }}>
      <Banner />

      <div style={{ marginBottom: '10px', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
        {tx.i1}<strong style={{ color: 'white' }}>{tx.i2}</strong>{tx.i3}<strong style={{ color: 'white' }}>{tx.i4}</strong>{tx.i5}
      </div>

      {/* Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '9px', margin: '18px 0 26px' }}>
        <StatCard label={tx.scheduled} value={overview.scheduled} accent />
        <StatCard label={tx.drafts} value={overview.drafts} />
        <StatCard label={tx.activeAds} value={overview.activeAds} />
        <StatCard label={tx.predCtr} value={`${overview.predictedCtr}%`} />
        <StatCard label={tx.avgRet} value={`${overview.avgRetention}%`} />
        <StatCard label={tx.monthly} value={overview.monthlyBudget} />
      </div>

      {/* Config (Control Center) */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(tx.cfgT, tx.cfgS)}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '13px' }}>
          <Field label={tx.automation}>{config.automation ? tx.on : tx.off}</Field>
          <Field label={tx.schedule}>{config.publishSchedule}</Field>
          <Field label={tx.adBudget}>{config.adBudget}</Field>
          <Field label={tx.optGoal}>{config.optimizationGoal}</Field>
          <Field label={tx.approvalFlow}>{config.approval}</Field>
          <Field label={tx.contLearn}>{config.learning ? tx.onM : tx.offM}</Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{tx.interTypes}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {config.interactionTypes.map(k => <span key={k} style={{ fontSize: '10.5px', color: 'white', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '3px 10px' }}>{STICKER_META[k].icon} {tx.sticker[k] ?? STICKER_META[k].label}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Stories orgânicos */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(tx.orgT, tx.orgS)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {organic.map(s => <OrganicCard key={s.id} s={s} />)}
        </div>
      </div>

      {/* Story Ads */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle(tx.adsT, tx.adsS)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {ads.map(a => <AdCard key={a.id} a={a} />)}
        </div>
      </div>

      {/* Aprendizado */}
      <div>
        {sectionTitle(tx.learnT, tx.learnS)}
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

      <ModuleLibrary module="stories" />
    </div>
  )
}
