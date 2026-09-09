import { useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { CARD, MUTED, BORDER, D } from './shared'
import { buildInsightsDemo, INSIGHT_CATEGORY_META, PRIORITY_META, type InsightCategory, type InsightItem } from './growthIntelDemo'

const ORANGE = '#FF6D29'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface InsightRow { id: string; category: string; opportunity: string; why: string | null; impact: string | null; action: string | null; priority: string | null; confidence: number | null; time_window: string | null }
function rowToItem(r: InsightRow): InsightItem {
  return { id: r.id, category: r.category as InsightCategory, opportunity: r.opportunity, why: r.why ?? '', impact: r.impact ?? '', action: r.action ?? '', priority: (r.priority as InsightItem['priority']) ?? 'medium', confidence: r.confidence ?? 70, window: r.time_window ?? '' }
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <div style={{ width: '64px', height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: value >= 75 ? '#4ade80' : value >= 60 ? '#FBBF24' : '#60a5fa' }} />
      </div>
      <span style={{ fontSize: '10px', color: MUTED }}>{value}% confiança</span>
    </div>
  )
}

function Field({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: accent ? '#4ade80' : 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}

function InsightCard({ item }: { item: InsightItem }) {
  const cat = INSIGHT_CATEGORY_META[item.category]
  const pri = PRIORITY_META[item.priority]
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: MUTED, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '2px 9px' }}>{cat.icon} {cat.label}</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: pri.color, border: `1px solid ${pri.color}44`, borderRadius: '99px', padding: '2px 9px' }}>Prioridade {pri.label}</span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>{item.window}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '12px', lineHeight: 1.35 }}>{item.opportunity}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <Field label="Por que importa">{item.why}</Field>
        <Field label="Impacto estimado">{item.impact}</Field>
      </div>
      <div style={{ padding: '11px 13px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.18)', borderRadius: '10px', marginBottom: '11px' }}>
        <Field label="Ação recomendada"><span style={{ color: 'white' }}>{item.action}</span></Field>
      </div>
      <ConfidenceBar value={item.confidence} />
    </div>
  )
}

const FILTERS: { key: InsightCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'evento', label: '📍 Eventos' },
  { key: 'feriado', label: '🎉 Datas' },
  { key: 'sazonal', label: '🗓️ Sazonal' },
  { key: 'tendencia', label: '📈 Tendências' },
  { key: 'parceria', label: '🤝 Parcerias' },
  { key: 'influenciador', label: '⭐ Influenciadores' },
  { key: 'concorrente', label: '🧭 Concorrentes' },
]

export default function InsightsTab({ company }: { company: Pick<CompanyData, 'id' | 'city'> }) {
  const { session } = useAuth()
  const demo = useMemo(() => buildInsightsDemo(company.city), [company.city])
  const [real, setReal] = useState<InsightItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<InsightCategory | 'all'>('all')

  const load = async () => {
    const { data } = await supabase.from('external_insights').select('*').eq('company_id', company.id).order('created_at', { ascending: false })
    setReal(((data as InsightRow[] | null) ?? []).map(rowToItem))
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [company.id])
  useRealtime('external_insights', company.id, load)

  const refresh = async () => {
    if (!session || refreshing) return
    setRefreshing(true)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/insights-collect`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) })
    } catch { /* ignore */ }
    await load(); setRefreshing(false)
  }

  const hasReal = (real?.length ?? 0) > 0
  const all = hasReal ? real! : demo
  const items = filter === 'all' ? all : all.filter(i => i.category === filter)

  return (
    <div>
      {hasReal ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '18px' }}>
          <span>🌐 <strong style={{ color: '#4ade80' }}>Insights reais</strong> — coletados da web (Tavily) e destilados pela IA pro seu segmento e cidade.</span>
          <button onClick={refresh} disabled={refreshing} style={{ marginLeft: 'auto', flexShrink: 0, padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{refreshing ? 'Atualizando…' : '↻ Atualizar'}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '18px' }}>
          <span>🧪 <strong>Exemplos.</strong> Oportunidades de <strong>fora</strong> — eventos, datas, tendências, parcerias. Clique em buscar pra trazer insights <strong>reais</strong> do seu segmento e cidade (via web).</span>
          <button onClick={refresh} disabled={refreshing || loading} style={{ marginLeft: 'auto', flexShrink: 0, padding: '6px 12px', background: ORANGE, color: '#000', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', fontFamily: D }}>{refreshing ? 'Buscando…' : '🌐 Buscar reais'}</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: '6px 13px', borderRadius: '99px', border: `1px solid ${filter === f.key ? 'rgba(255,109,41,0.5)' : BORDER}`, background: filter === f.key ? 'rgba(255,109,41,0.1)' : 'transparent', color: filter === f.key ? ORANGE : MUTED, fontSize: '11.5px', fontWeight: filter === f.key ? 700 : 500, cursor: 'pointer', fontFamily: D }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
        {items.map(i => <InsightCard key={i.id} item={i} />)}
      </div>
    </div>
  )
}
