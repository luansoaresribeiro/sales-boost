import { useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { CARD, MUTED, BORDER, D } from './shared'
import {
  buildCampaignDemo, FUNNEL_META, STATUS_META,
  type Campaign, type CampaignRecommendation, type FunnelStage,
} from './campaignDemo'
import TestingArea from './TestingArea'
import ModuleLibrary from './ModuleLibrary'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const REC_META: Record<CampaignRecommendation['kind'], { label: string; icon: string; color: string }> = {
  fix: { label: 'Corrigir', icon: '🔧', color: '#f87171' },
  scale: { label: 'Escalar', icon: '📈', color: GREEN },
  create: { label: 'Criar', icon: '✨', color: ORANGE },
  retarget: { label: 'Remarketing', icon: '🔁', color: '#f472b6' },
}
const PRIORITY_COLOR: Record<CampaignRecommendation['priority'], string> = { high: '#f87171', medium: '#FBBF24', low: MUTED }
const PRIORITY_LABEL: Record<CampaignRecommendation['priority'], string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }

function Banner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 15px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', marginBottom: '18px' }}>
      <span style={{ fontSize: '16px' }}>🧪</span>
      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5 }}>
        <strong style={{ color: '#FBBF24' }}>Modo demonstração.</strong> Estas campanhas, métricas e leituras do pixel são exemplos realistas. Quando a conta de anúncios da Meta for conectada e verificada, tudo aqui vira dado real — <strong>nada vai ao ar sem sua aprovação.</strong>
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
  const m = FUNNEL_META[stage]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}40`, borderRadius: '99px', padding: '3px 9px' }}>
      {m.icon} {m.label}
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
  const [open, setOpen] = useState(false)
  const st = STATUS_META[c.status]
  return (
    <div style={{ background: CARD, border: `1px solid ${open ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: D }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>{c.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <StageBadge stage={c.stage} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: st.color, background: `${st.color}18`, border: `1px solid ${st.color}40`, borderRadius: '99px', padding: '3px 9px' }}>{st.label}</span>
            </div>
          </div>
          <span style={{ fontSize: '12px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Saúde da campanha</div>
            <HealthBar score={c.healthScore} />
          </div>
          <div>
            <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>ROAS previsto</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: c.predictedRoas >= 3 ? GREEN : 'white' }}>{c.predictedRoas > 0 ? `${c.predictedRoas.toFixed(1)}×` : '—'}</div>
          </div>
        </div>
      </button>

      {c.metrics && (
        <div style={{ padding: '0 17px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <Metric label="Alcance" value={fmt(c.metrics.reach)} />
          <Metric label="CTR" value={`${c.metrics.ctr}%`} />
          <Metric label="Leads" value={fmt(c.metrics.leads)} />
          <Metric label="Gasto" value={`R$ ${c.metrics.spend}`} />
        </div>
      )}

      {open && (
        <div style={{ padding: '4px 17px 18px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '11px 13px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '10px', marginTop: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🧠 Por que esta etapa do funil</div>
            <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.55 }}>{c.whyStage}</div>
          </div>

          <div style={{ padding: '11px 13px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🎁 Oferta baseada em valor</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>{c.offer}</div>
            <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55 }}>{c.offerRationale}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
            <Field label="Objetivo">{c.goal}</Field>
            <Field label="Estratégia">{c.strategy}</Field>
            <Field label="Público">{c.audience}</Field>
            <Field label="Persona">{c.persona}</Field>
            <Field label="Ângulo">{c.angle}</Field>
            <Field label="CTA">{c.cta}</Field>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Field label="Gancho (hook)"><span style={{ fontStyle: 'italic' }}>“{c.hook}”</span></Field>
            <Field label="Título (headline)">{c.headline}</Field>
            <Field label="Texto principal">{c.primaryText}</Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
            <Field label="Prompt de imagem"><span style={{ color: MUTED }}>{c.imagePrompt}</span></Field>
            <Field label="Conceito de vídeo"><span style={{ color: MUTED }}>{c.videoConcept}</span></Field>
          </div>
          <Field label="Landing page"><span style={{ color: MUTED }}>{c.landingPage}</span></Field>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Métricas de sucesso</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {c.successMetrics.map((m, i) => (
                <span key={i} style={{ fontSize: '11px', color: 'white', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '4px 11px' }}>✓ {m}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>
            <Field label="Resultado esperado"><span style={{ color: GREEN }}>{c.expectedOutcome}</span></Field>
            <Field label="Risco / atenção"><span style={{ color: '#FBBF24' }}>{c.risk}</span></Field>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>Variações pra testar (A/B)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {c.variations.map((v, i) => (
                <div key={i} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: ORANGE, marginBottom: '3px' }}>Variação {String.fromCharCode(65 + i + 1)} · {v.angle}</div>
                  <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.5 }}><span style={{ fontStyle: 'italic', color: MUTED }}>“{v.hook}”</span> — {v.headline}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button disabled style={{ padding: '9px 16px', background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '9px', color: ORANGE, fontSize: '12px', fontWeight: 700, fontFamily: D, cursor: 'not-allowed', opacity: 0.75 }}>Aprovar campanha (demo)</button>
            <button disabled style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '12px', fontWeight: 700, fontFamily: D, cursor: 'not-allowed', opacity: 0.75 }}>Editar campos</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CampaignsTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'> }) {
  const demo = useMemo(() => buildCampaignDemo(company), [company])
  const { campaigns, recommendations, pixelJourney, pixelReads, creatives, learnings, overview } = demo

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
      title="Sem campanhas reais ainda"
      message="Este painel de campanhas pagas é um exemplo do layout. Conecte o Meta Ads pra ver campanhas reais — ou ligue o Modo demonstração pra explorar."
      cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
      <Banner />

      <div style={{ marginBottom: '10px', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
        O <strong style={{ color: 'white' }}>Estrategista de Mídia Paga</strong> monta campanhas com consciência de funil — escolhe a etapa certa, cria ofertas de valor (não desconto) e lê o comportamento do pixel pra decidir o próximo passo. Complementa o Agente de Conteúdo: um cuida do orgânico, o outro do pago.
      </div>

      {/* Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', margin: '18px 0 26px' }}>
        <StatCard label="Campanhas ativas" value={overview.active} accent />
        <StatCard label="Rascunhos" value={overview.drafts} />
        <StatCard label="ROAS previsto" value={`${overview.predictedRoas.toFixed(1)}×`} sub="média do portfólio" />
        <StatCard label="Saúde média" value={overview.health} sub="de 100" />
        <StatCard label="Orçamento/mês" value={overview.monthlyBudget} />
      </div>

      {/* Recomendações da IA */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle('🤖 Recomendações do estrategista', 'O que a IA sugere agir agora — priorizado por impacto.')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {recommendations.map(r => {
            const m = REC_META[r.kind]
            return (
              <div key={r.id} style={{ display: 'flex', gap: '12px', padding: '13px 15px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{r.title}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}40`, borderRadius: '99px', padding: '2px 8px' }}>{m.label}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: PRIORITY_COLOR[r.priority] }}>● {PRIORITY_LABEL[r.priority]}</span>
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
        {sectionTitle('🔀 Distribuição por funil', 'Cada campanha ocupa uma etapa — do frio ao cliente fiel.')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {(Object.keys(FUNNEL_META) as FunnelStage[]).map(stage => {
            const m = FUNNEL_META[stage]
            const count = stageCounts[stage] ?? 0
            return (
              <div key={stage} style={{ background: CARD, border: `1px solid ${count > 0 ? `${m.color}40` : BORDER}`, borderRadius: '11px', padding: '13px 10px', textAlign: 'center', opacity: count > 0 ? 1 : 0.5 }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{m.icon}</div>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: m.color, marginBottom: '4px' }}>{m.short}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>{count}</div>
                <div style={{ fontSize: '9px', color: MUTED }}>{count === 1 ? 'campanha' : 'campanhas'}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Campanhas */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle('📣 Campanhas', 'Clique pra abrir todos os campos — todos editáveis quando for real.')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {campaigns.map(c => <CampaignCard key={c.id} c={c} />)}
        </div>
      </div>

      {/* Meta Pixel Intelligence */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle('🎯 Inteligência do Pixel da Meta', 'A jornada do cliente e o que cada comportamento diz pra próxima campanha.')}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', marginBottom: '11px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Jornada — onde o público some</div>
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
                <div><span style={{ color: MUTED }}>O que acontece: </span><span style={{ color: 'white' }}>{p.what}</span></div>
                <div><span style={{ color: MUTED }}>Por quê: </span><span style={{ color: 'white' }}>{p.why}</span></div>
                <div><span style={{ color: MUTED }}>Como melhorar: </span><span style={{ color: 'white' }}>{p.improve}</span></div>
                <div style={{ marginTop: '3px', paddingTop: '7px', borderTop: `1px solid ${BORDER}`, color: GREEN }}>→ {p.nextCampaign}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Biblioteca de criativos */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle('🎨 Biblioteca de criativos', 'Peças geradas pela IA — legenda, ângulo e desempenho.')}
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
        {sectionTitle('🧠 Motor de aprendizado', 'O que já funcionou melhor — a IA usa isto pra montar a próxima campanha.')}
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
      <TestingArea companyId={company.id} kind="campanhas" />
    </div>
  )
}
