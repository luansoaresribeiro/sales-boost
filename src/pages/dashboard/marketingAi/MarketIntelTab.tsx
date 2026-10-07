import { useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
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
const TX = {
  pt: {
    impact: { high: 'Alto', medium: 'Médio', low: 'Baixo' } as Record<string, string>,
    relevance: { high: 'Muito relevante', medium: 'Relevante', low: 'De olho' } as Record<string, string>,
    freq: (d: number) => `~1 post a cada ${d}d`, noFreq: 'Sem dado de frequência ainda', noMove: 'Ainda sem análise dos posts recentes.',
    followersAbbr: 'seg', eng: 'eng', noEng: 'sem dado de engajamento', impactWord: 'impacto',
    errComp: 'Erro ao carregar os concorrentes', noComp: 'Sem concorrentes escaneados ainda', errMsg: 'A consulta ao banco falhou — veja o erro abaixo pra saber o que corrigir.',
    noCompMsg: 'O agente mapeia concorrentes e acha o Instagram deles sozinho, automaticamente. Ligue o Modo demonstração pra ver o layout com um exemplo enquanto isso roda.', seeExample: 'Ver exemplo (modo demonstração)',
    demoB: 'Modo demonstração.', demoBA: ' O agente monitora o Instagram dos concorrentes — aqui é uma amostra do que ele entrega.',
    movesTitle: '🔍 Movimentos dos concorrentes', movesSub: 'O que quem disputa o seu público andou fazendo.',
    errTrends: 'Erro ao carregar tendências/oportunidades', noData: 'Sem dados reais ainda',
    noTrendsMsg: 'A leitura de tendências, opiniões de clientes e oportunidades do segmento vem da coleta via web (aba Insights) — clique em buscar lá pra trazer dados reais. Ligue o Modo demonstração pra explorar o layout com um exemplo enquanto isso.',
    trendsTitle: '📈 Tendências e opiniões sobre o segmento', oppTitle: '✨ Novas oportunidades',
  },
  en: {
    impact: { high: 'High', medium: 'Medium', low: 'Low' } as Record<string, string>,
    relevance: { high: 'Highly relevant', medium: 'Relevant', low: 'Keep an eye' } as Record<string, string>,
    freq: (d: number) => `~1 post every ${d}d`, noFreq: 'No posting frequency data yet', noMove: 'No analysis of recent posts yet.',
    followersAbbr: 'followers', eng: 'eng', noEng: 'no engagement data', impactWord: 'impact',
    errComp: 'Error loading competitors', noComp: 'No competitors scanned yet', errMsg: 'The database query failed — see the error below to know what to fix.',
    noCompMsg: 'The agent maps competitors and finds their Instagram on its own, automatically. Turn on Demo mode to see the layout with an example while it runs.', seeExample: 'See an example (demo mode)',
    demoB: 'Demo mode.', demoBA: ' The agent monitors competitors\' Instagram — this is a sample of what it delivers.',
    movesTitle: '🔍 Competitor moves', movesSub: 'What those competing for your audience have been up to.',
    errTrends: 'Error loading trends/opportunities', noData: 'No real data yet',
    noTrendsMsg: 'The reading of trends, customer opinions and segment opportunities comes from web collection (Insights tab) — click search there to bring real data. Turn on Demo mode to explore the layout with an example in the meantime.',
    trendsTitle: '📈 Segment trends and opinions', oppTitle: '✨ New opportunities',
  },
} as const

interface SnapshotRow {
  competitor_id: string; instagram_followers: number | null; instagram_posting_freq_days: number | null
  avg_engagement: number | null; latest_move: string | null; latest_move_type: string | null; collected_at: string
}

// Concorrentes reais já escaneados (Apify) — só entra na lista quem já tem
// pelo menos uma varredura de Instagram com seguidores conhecidos. Sem
// legenda de posts pra analisar, "move"/"moveType" ficam sem dado em vez de
// inventados (a IA só classifica quando tem legenda real pra ler).
function useRealCompetitors(companyId: string | undefined, lang: 'pt' | 'en'): { items: CompetitorMove[] | null; error: string | null } {
  const [items, setItems] = useState<CompetitorMove[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    const t = TX[lang]
    supabase.from('competitors').select('id, name').eq('company_id', companyId)
      .then(async ({ data: comps, error: compsErr }) => {
        if (!alive) return
        if (compsErr) { setError(compsErr.message); return }
        if (!comps || comps.length === 0) { setError(null); setItems([]); return }
        const { data: snaps, error: snapsErr } = await supabase.from('competitor_snapshots')
          .select('competitor_id, instagram_followers, instagram_posting_freq_days, avg_engagement, latest_move, latest_move_type, collected_at')
          .in('competitor_id', comps.map(c => c.id))
          .not('instagram_followers', 'is', null)
          .order('collected_at', { ascending: false }) as { data: SnapshotRow[] | null; error: { message: string } | null }
        if (!alive) return
        if (snapsErr) { setError(snapsErr.message); return }
        const latest = new Map<string, SnapshotRow>()
        for (const s of snaps ?? []) if (!latest.has(s.competitor_id)) latest.set(s.competitor_id, s)
        const mapped: CompetitorMove[] = comps
          .filter(c => latest.has(c.id))
          .map(c => {
            const s = latest.get(c.id)!
            return {
              name: c.name,
              followers: s.instagram_followers ?? 0,
              postingFreq: s.instagram_posting_freq_days ? t.freq(s.instagram_posting_freq_days) : t.noFreq,
              engagement: s.avg_engagement,
              move: s.latest_move ?? t.noMove,
              moveType: s.latest_move_type as CompetitorMove['moveType'],
            }
          })
        setError(null)
        setItems(mapped)
      })
    return () => { alive = false }
  }, [companyId, lang])

  return { items, error }
}

interface ExternalInsightRow { id: string; category: string; opportunity: string; why: string | null; action: string | null; priority: string | null }

// Tendências/oportunidades reais — mesma fonte que a aba Insights
// (external_insights, coletado via Tavily em insights-collect: eventos,
// tendências do segmento E agora também opiniões reais de clientes sobre o
// segmento). "tendencia"/"opiniao" viram Tendências aqui; "setor"/"parceria"
// viram Oportunidades — mesmo dado, lente de Inteligência de Mercado.
function useRealTrendsOpportunities(companyId: string): { state: { trends: MarketTrend[]; opportunities: MarketOpportunity[] } | null; error: string | null } {
  const [state, setState] = useState<{ trends: MarketTrend[]; opportunities: MarketOpportunity[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    supabase.from('external_insights').select('id, category, opportunity, why, action, priority').eq('company_id', companyId)
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) { setError(err.message); return }
        const rows = (data ?? []) as ExternalInsightRow[]
        const rel = (p: string | null): 'high' | 'medium' | 'low' => (p === 'high' || p === 'low') ? p : 'medium'
        const trends = rows.filter(r => r.category === 'tendencia' || r.category === 'opiniao')
          .map(r => ({ id: r.id, title: r.opportunity, description: r.why ?? r.action ?? '', relevance: rel(r.priority) }))
        const opportunities = rows.filter(r => r.category === 'setor' || r.category === 'parceria')
          .map(r => ({ id: r.id, title: r.opportunity, description: r.action ?? r.why ?? '', impact: rel(r.priority) }))
        setError(null)
        setState({ trends, opportunities })
      })
    return () => { alive = false }
  }, [companyId])
  return { state, error }
}

function CompetitorCard({ c }: { c: CompetitorMove }) {
  const { lang } = useLang(); const t = TX[lang]
  const m = c.moveType ? MOVE_META[c.moveType] : { icon: '🔍', color: MUTED }
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '7px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{c.name}</span>
        <span style={{ fontSize: '10px', color: MUTED }}>{fmtNum(c.followers, lang)} {t.followersAbbr} · {c.engagement != null ? `${c.engagement}% ${t.eng}` : t.noEng}</span>
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
  const tx = TX[useLang().lang]
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>🔥 {t.title}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: IMPACT_COLOR[t.relevance], flexShrink: 0 }}>{tx.relevance[t.relevance]}</span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{t.description}</div>
    </div>
  )
}

function OpportunityCard({ o }: { o: MarketOpportunity }) {
  const tx = TX[useLang().lang]
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '13px 15px', borderLeft: `3px solid ${ORANGE}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>💰 {o.title}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: IMPACT_COLOR[o.impact], flexShrink: 0 }}>{tx.impact[o.impact]} {tx.impactWord}</span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{o.description}</div>
    </div>
  )
}

export default function MarketIntelTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const demo = useMemo(() => buildMarketDemo(company, lang), [company, lang])
  const { items: real, error: competitorsError } = useRealCompetitors(company.id, lang)
  const hasRealCompetitors = !!real && real.length > 0
  const competitors = hasRealCompetitors ? real : demo.competitors
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const competitorsMode = veilMode({ hasReal: hasRealCompetitors, demoMode, error: !!competitorsError })
  // Tendências/oportunidades — real assim que a coleta (Tavily, aba Insights)
  // já tiver rodado; a mesma fonte que a aba Insights usa.
  const { state: realTO, error: trendsError } = useRealTrendsOpportunities(company.id)
  const hasRealTO = !!realTO && (realTO.trends.length > 0 || realTO.opportunities.length > 0)
  const trends = hasRealTO ? realTO!.trends : demo.trends
  const opportunities = hasRealTO ? realTO!.opportunities : demo.opportunities
  const trendsMode = veilMode({ hasReal: hasRealTO, demoMode, error: !!trendsError })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Movimentos dos concorrentes — real assim que houver concorrente escaneado */}
      <DataVeil mode={competitorsMode}
        title={competitorsError ? t.errComp : t.noComp}
        message={competitorsError ? t.errMsg : t.noCompMsg}
        errorDetail={competitorsError}
        cta={{ label: t.seeExample, onClick: () => setDemoMode(true) }}>
        <section>
          {!hasRealCompetitors && (
            <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
              🔵 <strong>{t.demoB}</strong>{t.demoBA}
            </div>
          )}
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>{t.movesTitle}</div>
          <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px' }}>{t.movesSub}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {competitors.map((c, i) => <CompetitorCard key={i} c={c} />)}
          </div>
        </section>
      </DataVeil>

      {/* Tendências e oportunidades — real assim que a coleta via Tavily rodar
          (mesma fonte que a aba Insights, dentro de Agente de Dados) */}
      <DataVeil mode={trendsMode}
        title={trendsError ? t.errTrends : t.noData}
        message={trendsError ? t.errMsg : t.noTrendsMsg}
        errorDetail={trendsError}
        cta={{ label: t.seeExample, onClick: () => setDemoMode(true) }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
          {/* Tendências */}
          <section>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>{t.trendsTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {trends.map(tr => <TrendCard key={tr.id} t={tr} />)}
            </div>
          </section>

          {/* Oportunidades */}
          <section>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>{t.oppTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {opportunities.map(o => <OpportunityCard key={o.id} o={o} />)}
            </div>
          </section>
        </div>
      </DataVeil>

      {/* Oportunidades de Parceria — capacidade real, nativa da Inteligência de Mercado */}
      <PartnershipSection companyId={company.id} />
    </div>
  )
}
