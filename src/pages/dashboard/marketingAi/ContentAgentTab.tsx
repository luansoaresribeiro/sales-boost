import { useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D } from './shared'
import {
  buildContentDemo, CONTENT_FORMAT_ICON, CONTENT_STATUS_META, CONTENT_FUNNEL_META,
  type CalendarPost, type ContentIdea, type ContentFunnel, type ContentFormat, type ContentStatus,
} from './intelDemo'
import TestingArea from './TestingArea'
import ModuleLibrary from './ModuleLibrary'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'

interface RealContentRow {
  id: string; idea: string | null; reasoning: string | null; format: string | null
  status: string | null; scheduled_at: string | null; caption: string | null
}

// Ideias/rascunhos reais gerados pelo agente (marketing_ai_content). Não tem
// "etapa do funil" nem roteiro/direção de arte — esses campos continuam sem
// fonte real, então o calendário e as ideias ficam reais independentemente
// do bloco "conteúdo detalhado" (que segue como exemplo).
function useRealContent(companyId: string | undefined) {
  const [items, setItems] = useState<RealContentRow[] | null>(null)
  useEffect(() => {
    if (!companyId) return
    let alive = true
    supabase.from('marketing_ai_content')
      .select('id, idea, reasoning, format, status, scheduled_at, caption')
      .eq('company_id', companyId)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(30)
      .then(({ data }) => { if (alive) setItems((data ?? []) as RealContentRow[]) })
    return () => { alive = false }
  }, [companyId])
  return items
}

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const FALLBACK_FORMAT: ContentFormat = 'Foto'
const FALLBACK_STATUS: ContentStatus = 'ideia'

function toCalendarPost(r: RealContentRow): CalendarPost {
  const d = r.scheduled_at ? new Date(r.scheduled_at) : null
  return {
    day: d ? DOW[d.getDay()] : '—',
    time: d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    format: (r.format as ContentFormat) ?? FALLBACK_FORMAT,
    title: r.idea ?? r.caption?.slice(0, 40) ?? 'Sem título',
    status: (r.status as ContentStatus) ?? FALLBACK_STATUS,
    funnel: 'meio', // sem fonte real pra etapa do funil — neutro em vez de inventado
  }
}
function toContentIdea(r: RealContentRow): ContentIdea {
  return {
    id: r.id,
    format: (r.format as ContentFormat) ?? FALLBACK_FORMAT,
    hook: r.idea ?? r.caption?.slice(0, 60) ?? 'Ideia sem título',
    reasoning: r.reasoning ?? '',
    funnel: 'meio',
  }
}

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const FLOW = ['Dados', 'Estratégia', 'Conteúdo', 'Aprovação', 'Publicação']

function FlowBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
      {FLOW.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: i >= 3 ? ORANGE : 'white', background: i >= 3 ? 'rgba(255,109,41,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i >= 3 ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '99px', padding: '4px 11px' }}>{step}</span>
          {i < FLOW.length - 1 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>→</span>}
        </div>
      ))}
    </div>
  )
}

function FunnelTag({ funnel, compact }: { funnel: ContentFunnel; compact?: boolean }) {
  const m = CONTENT_FUNNEL_META[funnel]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}40`, borderRadius: '99px', padding: '2px 8px', flexShrink: 0 }}>
      {m.icon} {compact ? m.short : m.label}
    </span>
  )
}

function CalendarRow({ p }: { p: CalendarPost }) {
  const st = CONTENT_STATUS_META[p.status]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 13px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
      <div style={{ width: '42px', flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: 'white' }}>{p.day}</div>
        <div style={{ fontSize: '9.5px', color: MUTED }}>{p.time}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CONTENT_FORMAT_ICON[p.format]} {p.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px' }}>
          <span style={{ fontSize: '9.5px', color: MUTED }}>{p.format}</span>
          <FunnelTag funnel={p.funnel} compact />
        </div>
      </div>
      <span style={{ fontSize: '9px', fontWeight: 700, color: st.color, flexShrink: 0 }}>{st.label}</span>
    </div>
  )
}

function FunnelBalance({ counts, insight }: { counts: Record<ContentFunnel, number>; insight: string }) {
  const total = counts.topo + counts.meio + counts.fundo || 1
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '15px 17px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🔀 Equilíbrio do funil</div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '12px', lineHeight: 1.5 }}>Cada post tem um papel: atrair, nutrir ou converter. Um feed saudável tem os três.</div>
      <div style={{ display: 'flex', height: '10px', borderRadius: '99px', overflow: 'hidden', marginBottom: '10px' }}>
        {(['topo', 'meio', 'fundo'] as ContentFunnel[]).map(f => (
          <div key={f} style={{ width: `${(counts[f] / total) * 100}%`, background: CONTENT_FUNNEL_META[f].color }} title={`${CONTENT_FUNNEL_META[f].short}: ${counts[f]}`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {(['topo', 'meio', 'fundo'] as ContentFunnel[]).map(f => {
          const m = CONTENT_FUNNEL_META[f]
          return (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: m.color, display: 'inline-block' }} />
              <span style={{ fontSize: '11px', color: 'white', fontWeight: 700 }}>{counts[f]}</span>
              <span style={{ fontSize: '11px', color: MUTED }}>{m.short}</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.55, padding: '10px 12px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.18)', borderRadius: '9px' }}>
        <span style={{ color: ORANGE, fontWeight: 700 }}>✨ IA:</span> {insight}
      </div>
    </div>
  )
}

function IdeaCard({ idea, approved, onApprove }: { idea: ContentIdea; approved: boolean; onApprove: () => void }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${approved ? 'rgba(74,222,128,0.3)' : BORDER}`, borderRadius: '11px', padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{CONTENT_FORMAT_ICON[idea.format]} {idea.hook}</div>
        <FunnelTag funnel={idea.funnel} compact />
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '11px' }}>{idea.reasoning}</div>
      {approved ? (
        <div style={{ fontSize: '11px', color: GREEN }}>✓ Enviado pra aba Posts como rascunho</div>
      ) : (
        <button onClick={onApprove}
          style={{ padding: '6px 13px', background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, fontWeight: 700, fontSize: '11px', borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
          Transformar em rascunho
        </button>
      )}
    </div>
  )
}

export default function ContentAgentTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type'> }) {
  const demo = useMemo(() => buildContentDemo(company), [company])
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const { featured } = demo
  const [demoMode, setDemoMode] = useDemoMode(company.id)

  // Calendário/ideias: reais assim que o agente gerar algo em marketing_ai_content.
  const realContent = useRealContent(company.id)
  const hasRealContent = !!realContent && realContent.length > 0
  const calendar = hasRealContent ? realContent.map(toCalendarPost) : demo.calendar
  const ideas = hasRealContent ? realContent.map(toContentIdea) : demo.ideas
  const calendarMode = veilMode({ hasReal: hasRealContent, demoMode })

  // Equilíbrio do funil + conteúdo detalhado (roteiro/direção de arte) não têm
  // fonte real ainda — nenhum campo desses existe em marketing_ai_content.
  const detailMode = veilMode({ hasReal: false, demoMode })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '11px' }}>Como o conteúdo nasce</div>
        <FlowBar />
      </section>

      <DataVeil mode={calendarMode}
        title="Sem conteúdo real ainda"
        message="Quando o agente gerar posts de verdade, o calendário e as ideias aparecem aqui. Ligue o Modo demonstração pra explorar o layout com exemplos."
        cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {!hasRealContent && (
            <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
              🔵 <strong>Modo demonstração.</strong> O agente monta o calendário e cria ideias baseado no que a Inteligência de Mercado e o Feedback Loop aprenderam. <strong>Nada é publicado sem sua aprovação.</strong>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '20px', alignItems: 'start' }}>
            {/* Calendário */}
            <section>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>📅 Calendário da semana</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {calendar.map((p, i) => <CalendarRow key={i} p={p} />)}
              </div>
            </section>

            {/* Ideias */}
            <section>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>💡 Ideias sugeridas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ideas.map(idea => (
                  <IdeaCard key={idea.id} idea={idea} approved={approved.has(idea.id)} onApprove={() => setApproved(prev => new Set(prev).add(idea.id))} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </DataVeil>

      {/* Equilíbrio do funil + conteúdo detalhado — sem fonte real (etapa do
          funil, roteiro e direção de arte não existem em marketing_ai_content) */}
      <DataVeil mode={detailMode}
        title="Sem essa análise real ainda"
        message="Equilíbrio do funil, roteiro e direção de arte são uma leitura mais profunda que ainda não tem fonte real. Ligue o Modo demonstração pra ver o layout com um exemplo."
        cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <FunnelBalance counts={demo.balance.counts} insight={demo.balance.insight} />

          {/* Conteúdo detalhado */}
          <section>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>🎬 Conteúdo pronto pra aprovar</div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{CONTENT_FORMAT_ICON[featured.format]} {featured.title}</div>
                <FunnelTag funnel={featured.funnel} />
              </div>
              <div style={{ fontSize: '11px', color: MUTED, marginBottom: '14px' }}>{CONTENT_FUNNEL_META[featured.funnel].goal}</div>

              <Block label="Roteiro">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {featured.script.map((line, i) => (
                    <div key={i} style={{ fontSize: '12px', color: 'white', lineHeight: 1.5, paddingLeft: '12px', borderLeft: `2px solid rgba(255,109,41,0.4)` }}>{line}</div>
                  ))}
                </div>
              </Block>

              <Block label="Legenda">
                <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', borderRadius: '9px', padding: '11px 13px' }}>{featured.caption}</div>
              </Block>

              <Block label="Hashtags">
                <div style={{ fontSize: '11.5px', color: '#60a5fa' }}>{featured.hashtags}</div>
              </Block>

              <Block label="Sugestão de criativo">
                <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55 }}>{featured.creative}</div>
              </Block>

              <Block label="🎨 Direção criativa (do DNA da marca)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '9px' }}>
                  {[
                    { k: 'Paleta', v: featured.art.palette },
                    { k: 'Estilo', v: featured.art.style },
                    { k: 'Referência visual', v: featured.art.reference },
                    { k: 'Evitar', v: featured.art.doNot },
                  ].map(row => (
                    <div key={row.k} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '9.5px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>{row.k}</div>
                      <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.5 }}>{row.v}</div>
                    </div>
                  ))}
                </div>
              </Block>

              <button style={{ marginTop: '6px', padding: '8px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>
                Aprovar e agendar
              </button>
            </div>
          </section>
        </div>
      </DataVeil>

      <ModuleLibrary module="organico" />
      <TestingArea companyId={company.id} kind="organico" />
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '15px' }}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{label}</div>
      {children}
    </div>
  )
}
