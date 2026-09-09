import { useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { CARD, MUTED, BORDER, D } from './shared'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'
import {
  buildMetaHealthDemo, classifyHealth, HEALTH_CLASS_META, CHECK_META,
  PRIORITY_META, DIFFICULTY_META,
  type HealthCategory, type HealthRecommendation, type HistoryPoint,
} from './metaHealthDemo'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

function Banner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 15px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', marginBottom: '18px' }}>
      <span style={{ fontSize: '16px' }}>🧪</span>
      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5 }}>
        <strong style={{ color: '#FBBF24' }}>Modo demonstração.</strong> Este score e suas categorias são calculados a partir de dados de exemplo. Quando a conta da Meta (Business Manager, Pixel, anúncios) for conectada, o score vira um KPI vivo que aprende e evolui sozinho.
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const cls = classifyHealth(score)
  const color = HEALTH_CLASS_META[cls].color
  const r = 62, c = 2 * Math.PI * r
  const off = c - (score / 100) * c
  return (
    <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0 }}>
      <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" />
        <circle cx="75" cy="75" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '36px', fontWeight: 900, color: 'white', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>de 100</div>
      </div>
    </div>
  )
}

function MiniChart({ points }: { points: HistoryPoint[] }) {
  const scores = points.map(p => p.score)
  const min = Math.min(...scores) - 4, max = Math.max(...scores) + 2
  const range = Math.max(max - min, 1)
  const bestGain = useMemo(() => {
    let idx = 1, best = -Infinity
    for (let i = 1; i < points.length; i++) { const g = points[i].score - points[i - 1].score; if (g > best) { best = g; idx = i } }
    return idx
  }, [points])
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '130px', padding: '0 4px' }}>
      {points.map((p, i) => {
        const h = ((p.score - min) / range) * 100
        const highlight = i === bestGain
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: highlight ? GREEN : 'white' }}>{p.score}</div>
            <div style={{ width: '100%', height: `${h}%`, minHeight: '4px', background: highlight ? `linear-gradient(180deg, ${GREEN}, rgba(74,222,128,0.3))` : `linear-gradient(180deg, ${ORANGE}, rgba(255,109,41,0.25))`, borderRadius: '6px 6px 0 0' }} />
            <div style={{ fontSize: '9.5px', color: MUTED, whiteSpace: 'nowrap' }}>{p.period}</div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryCard({ cat }: { cat: HealthCategory }) {
  const [open, setOpen] = useState(false)
  const cls = classifyHealth(cat.score)
  const color = HEALTH_CLASS_META[cls].color
  return (
    <div style={{ background: CARD, border: `1px solid ${open ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '13px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 16px', fontFamily: D }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
          <span style={{ fontSize: '17px' }}>{cat.icon}</span>
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'white' }}>{cat.label}</span>
          <span style={{ fontSize: '15px', fontWeight: 900, color }}>{cat.score}</span>
          <span style={{ fontSize: '11px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden', marginBottom: '7px' }}>
          <div style={{ width: `${cat.score}%`, height: '100%', background: color, borderRadius: '99px' }} />
        </div>
        <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{cat.summary}</div>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '13px 0 7px' }}>Por que este score</div>
          <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {cat.reasons.map((r, i) => <li key={i} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{r}</li>)}
          </ul>
          <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Checklist</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px' }}>
            {cat.checks.map((ch, i) => {
              const m = CHECK_META[ch.status]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
                  <span style={{ width: '16px', height: '16px', flexShrink: 0, borderRadius: '99px', background: `${m.color}22`, color: m.color, fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.label}</div>
                    {ch.note && <div style={{ fontSize: '9.5px', color: MUTED }}>{ch.note}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RecCard({ rec }: { rec: HealthRecommendation }) {
  const pri = PRIORITY_META[rec.priority]
  const diff = DIFFICULTY_META[rec.difficulty]
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '9px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '5px', lineHeight: 1.35 }}>{rec.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: pri.color, background: `${pri.color}18`, border: `1px solid ${pri.color}40`, borderRadius: '99px', padding: '2px 8px' }}>Prioridade {pri.label}</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: diff.color }}>● {diff.label}</span>
            <span style={{ fontSize: '9px', color: MUTED, background: 'rgba(255,255,255,0.05)', borderRadius: '99px', padding: '2px 8px' }}>{rec.category}</span>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '10px', padding: '6px 10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 900, color: GREEN, lineHeight: 1 }}>+{rec.scoreGain}</div>
          <div style={{ fontSize: '8.5px', color: MUTED, marginTop: '1px' }}>no score</div>
        </div>
      </div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, marginBottom: '7px' }}>{rec.impact}</div>
      <div style={{ fontSize: '11.5px', color: ORANGE, fontWeight: 600, lineHeight: 1.5 }}>→ {rec.action}</div>
    </div>
  )
}

export default function MetaHealthTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'> }) {
  const demo = useMemo(() => buildMetaHealthDemo(company), [company])
  const { overall, trendDelta, categories, recommendations, actions, history, benchmark, executiveSummary } = demo
  // Não há fonte real de "Saúde da Meta" ainda → nunca mostra número real
  // fake. Com Modo demonstração desligado, o layout fica borrado (DataVeil).
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const mode = veilMode({ hasReal: false, demoMode })

  const cls = classifyHealth(overall)
  const clsMeta = HEALTH_CLASS_META[cls]
  const [range, setRange] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly')
  const [checked, setChecked] = useState<Set<string>>(() => new Set(actions.filter(a => a.done).map(a => a.id)))

  const projected = useMemo(() => {
    const gain = actions.filter(a => !a.done && checked.has(a.id)).reduce((s, a) => s + a.scoreGain, 0)
    return Math.min(100, overall + gain)
  }, [checked, actions, overall])

  const toggle = (id: string) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const sectionTitle = (t: string, s: string) => (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', fontFamily: D }}>{t}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>{s}</div>
    </div>
  )
  const rangePoints = history[range]

  return (
    <div style={{ maxWidth: '1080px' }}>
    <DataVeil mode={mode}
      title="Sem dados reais ainda"
      message="A Saúde da Meta cruza seus dados reais de Instagram e anúncios — que ainda não estão disponíveis. Ligue o Modo demonstração pra explorar o layout com um exemplo."
      cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
      <Banner />

      <div style={{ marginBottom: '20px', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
        Em vez de métricas soltas, a IA calcula <strong style={{ color: 'white' }}>um único score de 0 a 100</strong> que mede quão saudável, madura e otimizada está a presença do seu negócio na Meta — e responde: <strong style={{ color: 'white' }}>o que melhorar primeiro pra crescer mais rápido.</strong>
      </div>

      {/* Hero */}
      <div style={{ display: 'flex', gap: '22px', alignItems: 'center', flexWrap: 'wrap', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '22px 24px', marginBottom: '26px' }}>
        <ScoreRing score={overall} />
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Meta Health Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px', fontWeight: 900, color: clsMeta.color }}>{clsMeta.label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: trendDelta >= 0 ? GREEN : '#f87171', background: trendDelta >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', borderRadius: '99px', padding: '3px 10px' }}>
              {trendDelta >= 0 ? '▲' : '▼'} {Math.abs(trendDelta)} pts vs. mês anterior
            </span>
          </div>
          <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6 }}>
            Seu ecossistema na Meta está <strong style={{ color: 'white' }}>{clsMeta.label.toLowerCase()}</strong>. Você está à frente de <strong style={{ color: 'white' }}>{benchmark.percentile}%</strong> dos {benchmark.segment}. As maiores alavancas agora são <strong style={{ color: 'white' }}>Pixel</strong> e <strong style={{ color: 'white' }}>funil</strong>.
          </div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '14px', flexWrap: 'wrap' }}>
            {(Object.keys(HEALTH_CLASS_META) as (keyof typeof HEALTH_CLASS_META)[]).reverse().map(k => {
              const m = HEALTH_CLASS_META[k]
              const active = k === cls
              return <span key={k} style={{ fontSize: '9.5px', fontWeight: 700, color: active ? '#0E0B0A' : m.color, background: active ? m.color : `${m.color}14`, border: `1px solid ${m.color}${active ? '' : '30'}`, borderRadius: '99px', padding: '3px 9px' }}>{m.label} {m.range}</span>
            })}
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle('🩺 Categorias de saúde', 'O score geral vem da média ponderada destas categorias. Clique pra ver os motivos e o checklist.')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '11px' }}>
          {categories.map(c => <CategoryCard key={c.key} cat={c} />)}
        </div>
      </div>

      {/* Recomendações */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle('🤖 Recomendações da IA', 'Cada problema vira uma ação com prioridade, dificuldade e quanto sobe no score.')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '10px' }}>
          {recommendations.map(r => <RecCard key={r.id} rec={r} />)}
        </div>
      </div>

      {/* Action Center */}
      <div style={{ marginBottom: '28px' }}>
        {sectionTitle('✅ Melhorar meu score', 'Marque o que já foi feito — o score projetado sobe na hora.')}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '14px', paddingBottom: '14px', borderBottom: `1px solid ${BORDER}` }}>
            <div>
              <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score atual</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>{overall}</div>
            </div>
            <span style={{ fontSize: '20px', color: MUTED }}>→</span>
            <div>
              <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projetado</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: GREEN }}>{projected}</div>
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${overall}%`, height: '100%', background: 'rgba(255,255,255,0.25)', position: 'absolute' }} />
                <div style={{ width: `${projected}%`, height: '100%', background: GREEN, borderRadius: '99px', position: 'absolute', opacity: 0.7 }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {actions.map(a => {
              const on = checked.has(a.id)
              return (
                <button key={a.id} onClick={() => toggle(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px', background: on ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '10px', cursor: 'pointer', fontFamily: D, textAlign: 'left' }}>
                  <span style={{ width: '18px', height: '18px', flexShrink: 0, borderRadius: '6px', border: `2px solid ${on ? GREEN : 'rgba(255,255,255,0.25)'}`, background: on ? GREEN : 'transparent', color: '#0E0B0A', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                  <span style={{ flex: 1, fontSize: '12.5px', color: on ? MUTED : 'white', textDecoration: on ? 'line-through' : 'none' }}>{a.label}</span>
                  {a.scoreGain > 0 && <span style={{ fontSize: '11px', fontWeight: 800, color: GREEN, flexShrink: 0 }}>+{a.scoreGain}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Histórico + Benchmark */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', fontFamily: D }}>📅 Evolução do score</div>
              <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>Em verde, o maior salto do período.</div>
            </div>
            <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
              {(['weekly', 'monthly', 'quarterly'] as const).map(r => (
                <button key={r} onClick={() => setRange(r)} style={{ padding: '5px 11px', background: range === r ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${range === r ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '7px', cursor: 'pointer', fontFamily: D, fontSize: '11px', fontWeight: 700, color: range === r ? ORANGE : MUTED }}>
                  {r === 'weekly' ? 'Semanal' : r === 'monthly' ? 'Mensal' : 'Trimestral'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 18px 12px' }}>
            <MiniChart points={rangePoints} />
          </div>
        </div>

        <div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', fontFamily: D }}>🏆 Comparação com o segmento</div>
            <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>Como você está vs. {benchmark.segment}.</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px' }}>
            <div style={{ fontSize: '13px', color: 'white', lineHeight: 1.5, marginBottom: '16px' }}>
              Você está <strong style={{ color: GREEN, fontSize: '16px' }}>à frente de {benchmark.percentile}%</strong> dos negócios parecidos.
            </div>
            {[
              { label: 'Seu score', value: benchmark.yourScore, color: ORANGE },
              { label: 'Média do segmento', value: benchmark.segmentAvg, color: MUTED },
              { label: 'Top 10% do segmento', value: benchmark.segmentTop, color: GREEN },
            ].map((row, i) => (
              <div key={i} style={{ marginBottom: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: MUTED }}>{row.label}</span>
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: row.color }}>{row.value}</span>
                </div>
                <div style={{ height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${row.value}%`, height: '100%', background: row.color, borderRadius: '99px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumo executivo */}
      <div>
        {sectionTitle('📋 Resumo executivo da IA', 'A leitura de um consultor de Meta, em um parágrafo.')}
        <div style={{ background: 'linear-gradient(135deg, rgba(255,109,41,0.08), rgba(255,109,41,0.02))', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '14px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', color: 'white', lineHeight: 1.65 }}>{executiveSummary}</div>
        </div>
      </div>
    </DataVeil>
    </div>
  )
}
