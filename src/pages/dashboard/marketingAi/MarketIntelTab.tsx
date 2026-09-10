import { useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER } from './shared'
import { fmtNum, useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'
import {
  buildMarketDemo, MOVE_META,
  type CompetitorMove, type MarketTrend, type MarketOpportunity,
} from './intelDemo'
import PartnershipSection from './PartnershipSection'

const ORANGE = '#FF6D29'
const IMPACT_COLOR: Record<string, string> = { high: '#f87171', medium: '#FBBF24', low: MUTED }
const IMPACT_LABEL: Record<string, string> = { high: 'Alto', medium: 'Médio', low: 'Baixo' }
const RELEVANCE_LABEL: Record<string, string> = { high: 'Muito relevante', medium: 'Relevante', low: 'De olho' }

interface SnapshotRow {
  competitor_id: string; instagram_followers: number | null; instagram_posting_freq_days: number | null
  avg_engagement: number | null; latest_move: string | null; latest_move_type: string | null; collected_at: string
}

// Concorrentes reais já escaneados (Apify) — só entra na lista quem já tem
// pelo menos uma varredura de Instagram com seguidores conhecidos. Sem
// legenda de posts pra analisar, "move"/"moveType" ficam sem dado em vez de
// inventados (a IA só classifica quando tem legenda real pra ler).
function useRealCompetitors(companyId: string | undefined): CompetitorMove[] | null {
  const [items, setItems] = useState<CompetitorMove[] | null>(null)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    supabase.from('competitors').select('id, name').eq('company_id', companyId)
      .then(async ({ data: comps }) => {
        if (!alive) return
        if (!comps || comps.length === 0) { setItems([]); return }
        const { data: snaps } = await supabase.from('competitor_snapshots')
          .select('competitor_id, instagram_followers, instagram_posting_freq_days, avg_engagement, latest_move, latest_move_type, collected_at')
          .in('competitor_id', comps.map(c => c.id))
          .not('instagram_followers', 'is', null)
          .order('collected_at', { ascending: false }) as { data: SnapshotRow[] | null }
        if (!alive) return
        const latest = new Map<string, SnapshotRow>()
        for (const s of snaps ?? []) if (!latest.has(s.competitor_id)) latest.set(s.competitor_id, s)
        const mapped: CompetitorMove[] = comps
          .filter(c => latest.has(c.id))
          .map(c => {
            const s = latest.get(c.id)!
            return {
              name: c.name,
              followers: s.instagram_followers ?? 0,
              postingFreq: s.instagram_posting_freq_days ? `~1 post a cada ${s.instagram_posting_freq_days}d` : 'Sem dado de frequência ainda',
              engagement: s.avg_engagement,
              move: s.latest_move ?? 'Ainda sem análise dos posts recentes.',
              moveType: s.latest_move_type as CompetitorMove['moveType'],
            }
          })
        setItems(mapped)
      })
    return () => { alive = false }
  }, [companyId])

  return items
}

function CompetitorCard({ c }: { c: CompetitorMove }) {
  const m = c.moveType ? MOVE_META[c.moveType] : { icon: '🔍', color: MUTED }
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '7px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{c.name}</span>
        <span style={{ fontSize: '10px', color: MUTED }}>{fmtNum(c.followers)} seg · {c.engagement != null ? `${c.engagement}% eng` : 'sem dado de engajamento'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '9px 11px' }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>{m.icon}</span>
        <div>
          <div style={{ fontSize: '11.5px', color: 'white', lineHeight: 1.45 }}>{c.move}</div>
          <div style={{ fontSize: '9.5px', color: MUTED, marginTop: '2px' }}>{c.postingFreq}</div>
        </div>
      </div>
    </div>
  )
}

function TrendCard({ t }: { t: MarketTrend }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>🔥 {t.title}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: IMPACT_COLOR[t.relevance], flexShrink: 0 }}>{RELEVANCE_LABEL[t.relevance]}</span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{t.description}</div>
    </div>
  )
}

function OpportunityCard({ o }: { o: MarketOpportunity }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '13px 15px', borderLeft: `3px solid ${ORANGE}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>💰 {o.title}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: IMPACT_COLOR[o.impact], flexShrink: 0 }}>{IMPACT_LABEL[o.impact]} impacto</span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{o.description}</div>
    </div>
  )
}

export default function MarketIntelTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'> }) {
  const demo = useMemo(() => buildMarketDemo(company), [company])
  const real = useRealCompetitors(company.id)
  const hasRealCompetitors = !!real && real.length > 0
  const competitors = hasRealCompetitors ? real : demo.competitors
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const competitorsMode = veilMode({ hasReal: hasRealCompetitors, demoMode })
  // Tendências/oportunidades ainda não têm gerador real (é IA lendo o
  // segmento, não plugada) — sempre demo/locked, nunca "real".
  const trendsMode = veilMode({ hasReal: false, demoMode })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Movimentos dos concorrentes — real assim que houver concorrente escaneado */}
      <DataVeil mode={competitorsMode}
        title="Sem concorrentes escaneados ainda"
        message="O agente mapeia concorrentes e acha o Instagram deles sozinho, automaticamente. Ligue o Modo demonstração pra ver o layout com um exemplo enquanto isso roda."
        cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
        <section>
          {!hasRealCompetitors && (
            <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
              🔵 <strong>Modo demonstração.</strong> O agente monitora o Instagram dos concorrentes — aqui é uma amostra do que ele entrega.
            </div>
          )}
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>🔍 Movimentos dos concorrentes</div>
          <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px' }}>O que quem disputa o seu público andou fazendo.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {competitors.map((c, i) => <CompetitorCard key={i} c={c} />)}
          </div>
        </section>
      </DataVeil>

      {/* Tendências e oportunidades — ainda sem gerador real (IA/Apify não plugados) */}
      <DataVeil mode={trendsMode}
        title="Sem dados reais ainda"
        message="A leitura de tendências e oportunidades do segmento ainda não tem uma fonte real plugada. Ligue o Modo demonstração pra explorar o layout com um exemplo."
        cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
          {/* Tendências */}
          <section>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>📈 Conteúdos que estão performando</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {demo.trends.map(t => <TrendCard key={t.id} t={t} />)}
            </div>
          </section>

          {/* Oportunidades */}
          <section>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>✨ Novas oportunidades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {demo.opportunities.map(o => <OpportunityCard key={o.id} o={o} />)}
            </div>
          </section>
        </div>
      </DataVeil>

      {/* Oportunidades de Parceria — capacidade real, nativa da Inteligência de Mercado */}
      <PartnershipSection companyId={company.id} />
    </div>
  )
}
