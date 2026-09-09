import { useMemo } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { CARD, MUTED, BORDER } from './shared'
import { buildFeedbackDemo, CONFIDENCE_META, type AttributionStep, type Learning } from './feedbackDemo'
import { buildIcpDemo, type IcpSignal } from './growthIntelDemo'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const SIGNAL_META: Record<IcpSignal['kind'], { label: string; icon: string; color: string }> = {
  change: { label: 'Mudança detectada', icon: '🔀', color: '#60a5fa' },
  positioning: { label: 'Posicionamento', icon: '🎯', color: '#FBBF24' },
  opportunity: { label: 'Novo público', icon: '✨', color: GREEN },
}

// Motor de ICP (demo): o Feedback Loop aprende quem é o cliente ideal e
// refina sozinho. No futuro, alimentado por Meta + engajamento + campanhas.
function IcpEngine({ businessType, city }: { businessType?: string | null; city?: string | null }) {
  const { profile, signals, learning } = useMemo(() => buildIcpDemo(businessType, city), [businessType, city])
  const blocks: { label: string; items: string[] }[] = [
    { label: 'Demografia', items: profile.demographics },
    { label: 'Interesses', items: profile.interests },
    { label: 'Comportamento', items: profile.behaviors },
    { label: 'Gatilhos de compra', items: profile.triggers },
  ]
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>🧬 Cliente ideal (ICP) — aprendido pela IA</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: ORANGE, border: '1px solid rgba(255,109,41,0.35)', borderRadius: '99px', padding: '2px 9px' }}>
          {profile.confidence}% de confiança
        </span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px', lineHeight: 1.6, maxWidth: '660px' }}>
        A IA cruza quem segue, quem interage e quem compra pra montar (e refinar sozinha) o perfil do seu cliente ideal. Quanto mais dados reais, mais afiado.
      </div>

      <div style={{ background: CARD, border: '1px solid rgba(255,109,41,0.2)', borderRadius: '14px', padding: '16px 18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white', lineHeight: 1.4, marginBottom: '14px' }}>“{profile.headline}”</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          {blocks.map(b => (
            <div key={b.label}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{b.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {b.items.map(i => <span key={i} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.82)', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '3px 8px' }}>{i}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Onde ele está · ticket médio {profile.avgTicket}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {profile.channels.map(ch => (
              <span key={ch.name} style={{ fontSize: '11px', color: 'white', background: 'rgba(255,109,41,0.08)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '7px', padding: '3px 9px' }}>{ch.name} · {ch.share}%</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {signals.map((s, i) => {
          const m = SIGNAL_META[s.kind]
          return (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 15px' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{m.icon} {m.label}</div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '4px', lineHeight: 1.35 }}>{s.title}</div>
              <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{s.detail}</div>
            </div>
          )
        })}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 15px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Aprendendo com</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {learning.map((l, i) => (
            <div key={i} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
              <span style={{ color: ORANGE, fontWeight: 700 }}>{l.source}:</span> {l.note}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Cadeia de atribuição: anúncio → clique → lead → conversa → venda → receita
function AttributionChain({ steps }: { steps: AttributionStep[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
      {steps.map((s, i) => {
        const isRevenue = s.key === 'receita'
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ minWidth: '112px', background: CARD, border: `1px solid ${isRevenue ? 'rgba(255,109,41,0.4)' : BORDER}`, borderRadius: '12px', padding: '13px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '17px', marginBottom: '5px' }}>{s.icon}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: isRevenue ? ORANGE : 'white', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>{s.label}</div>
            </div>
            {i < steps.length - 1 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px' }}>→</span>}
          </div>
        )
      })}
    </div>
  )
}

// O ciclo que fecha: Ação → Resultado → Aprendizado → Nova ação
function LoopDiagram() {
  const nodes = [
    { icon: '⚡', label: 'Ação', desc: 'A IA executa (com sua aprovação)' },
    { icon: '📊', label: 'Resultado', desc: 'Mede o que aconteceu de verdade' },
    { icon: '🧠', label: 'Aprendizado', desc: 'Descobre o que funcionou e por quê' },
    { icon: '🔁', label: 'Nova ação', desc: 'Aplica o aprendizado na próxima' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {nodes.map((n, i) => (
        <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '10px 14px', minWidth: '150px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{n.icon} {n.label}</div>
            <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px', lineHeight: 1.4 }}>{n.desc}</div>
          </div>
          <span style={{ color: ORANGE, fontSize: '14px' }}>{i < nodes.length - 1 ? '→' : '↺'}</span>
        </div>
      ))}
    </div>
  )
}

function LearningCard({ l }: { l: Learning }) {
  const conf = CONFIDENCE_META[l.confidence]
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '7px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'white', lineHeight: 1.35 }}>💡 {l.title}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', fontWeight: 700, color: conf.color, flexShrink: 0, marginTop: '2px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: conf.color }} />{conf.label}
        </span>
      </div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, marginBottom: '11px' }}>{l.evidence}</div>
      <div style={{ fontSize: '11.5px', color: GREEN, lineHeight: 1.5, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: '8px', padding: '9px 12px' }}>
        <strong>Ação tomada:</strong> {l.action}
      </div>
    </div>
  )
}

// Campos do Core que o Meta preenche sozinho quando a conta conectar.
const CORE_FIELDS: { label: string; hint: string; icon: string }[] = [
  { label: 'Voz da marca', hint: 'Derivada do tom dos posts reais', icon: '🗣️' },
  { label: 'Público-alvo', hint: 'De quem segue e interage', icon: '🎯' },
  { label: 'Temas de conteúdo', hint: 'Os assuntos que mais engajam', icon: '🧩' },
  { label: 'Melhores horários', hint: 'Quando o público está online', icon: '⏰' },
  { label: 'Tom visual', hint: 'Estilo dos criativos que funcionam', icon: '🎨' },
]

// O "Core da empresa" — o perfil que todos os agentes usam. A ideia é que ele
// se preencha sozinho a partir do Meta (Instagram/Facebook) assim que a conta
// conectar, tirando o preenchimento manual da ficha do cliente no owner.
function CompanyCore({ metaConnected }: { metaConnected: boolean }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>🧬 Core da empresa</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: metaConnected ? GREEN : '#FBBF24', border: `1px solid ${metaConnected ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`, borderRadius: '99px', padding: '2px 9px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: metaConnected ? GREEN : '#FBBF24' }} />
          {metaConnected ? 'Meta conectado' : 'Aguardando Meta'}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px', lineHeight: 1.6, maxWidth: '640px' }}>
        O perfil que todos os agentes usam pra entender o negócio. {metaConnected
          ? 'O Meta está conectado — o Core é montado a partir dos seus dados reais do Instagram/Facebook e se atualiza sozinho.'
          : 'Assim que o Meta conectar, isto se preenche sozinho a partir do Instagram/Facebook — sem ninguém digitar nada.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
        {CORE_FIELDS.map(f => (
          <div key={f.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 14px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{f.icon} {f.label}</div>
            {metaConnected ? (
              <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.4 }}>{f.hint}</div>
            ) : (
              <div style={{ fontSize: '10.5px', color: '#FBBF24', lineHeight: 1.4 }}>Preenche com o Meta</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default function FeedbackLoopTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'instagram_user_id' | 'business_type' | 'city'> }) {
  const demo = useMemo(() => buildFeedbackDemo(company), [company])
  const metaConnected = !!company.instagram_user_id
  // Ainda não há fonte real de ICP/atribuição → sem número real fake. Modo
  // demonstração desligado deixa o layout borrado (DataVeil).
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const mode = veilMode({ hasReal: false, demoMode })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
    <DataVeil mode={mode}
      title="Sem dados reais ainda"
      message="O Feedback Loop cruza dados reais da Meta, do funil e do atendimento — que ainda não estão prontos. Ligue o Modo demonstração pra explorar o layout com um exemplo."
      cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
        🔁 <strong>O diferencial do Growth OS.</strong> A maioria das ferramentas para no "anúncio → resultado". Aqui a IA acompanha o caminho inteiro — <strong>anúncio → lead → venda → aprendizado</strong> — e ainda aprende <strong>quem é o seu cliente ideal</strong>, refinando sozinha a cada ciclo. No modo demonstração os números são de exemplo; ao vivo, cruzam os dados reais da Meta, do funil e do atendimento.
      </div>

      <CompanyCore metaConnected={metaConnected} />

      <IcpEngine businessType={company.business_type} city={company.city} />

      {/* Cadeia de atribuição */}
      <section>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>📍 De onde veio a receita</div>
        <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px' }}>O caminho completo do dinheiro, ponta a ponta — não só o clique.</div>
        <AttributionChain steps={demo.chain} />
      </section>

      {/* Ciclo */}
      <section>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '13px' }}>♻️ O ciclo que fica mais inteligente</div>
        <LoopDiagram />
      </section>

      {/* Aprendizados */}
      <section>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>🧠 Aprendizados da IA</div>
        <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px' }}>Cada aprendizado nasce de um dado real e já virou uma ação — é assim que a máquina melhora sozinha.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
          {demo.learnings.map(l => <LearningCard key={l.id} l={l} />)}
        </div>
      </section>
    </DataVeil>
    </div>
  )
}
