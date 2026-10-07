import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'
import { InsightReport } from '../../components/InsightReport'

const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const ORANGE = '#FF6D29'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface Competitor {
  id: string
  name: string
  rating: number | null
  review_count: number
  distance_m: number | null
  price_level: number | null
  google_place_id: string | null
  instagram_url: string | null
}

interface Snapshot {
  competitor_id: string
  price_level: number | null
  instagram_followers: number | null
  instagram_posts_count: number | null
  instagram_posting_freq_days: number | null
  collected_at: string
}

function PriceLevel({ level }: { level: number | null }) {
  if (!level) return <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
  return (
    <span style={{ fontWeight: 600 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} style={{ color: i < level ? '#FBBF24' : 'rgba(255,255,255,0.15)' }}>$</span>
      ))}
    </span>
  )
}

function RatingBar({ rating }: { rating: number | null }) {
  if (!rating) return <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>—</span>
  const color = rating >= 4.3 ? '#4ade80' : rating >= 3.8 ? '#FBBF24' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontFamily: D, fontWeight: 800, fontSize: '1.1rem', color }}>{rating.toFixed(1)}</span>
      <div style={{ flex: 1, height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', minWidth: '60px' }}>
        <div style={{ width: `${(rating / 5) * 100}%`, height: '100%', background: color, borderRadius: '99px' }} />
      </div>
      <span style={{ fontSize: '10px', color: '#FBBF24' }}>★</span>
    </div>
  )
}

const TX = {
  pt: {
    loc: 'pt-BR',
    unknownErr: 'Erro desconhecido', analysisErr: 'Erro na análise', analysisFail: 'Erro ao gerar análise: ',
    monitored: (m: number, t: number) => `${m}/${t} concorrentes monitorados`,
    mapped: (n: number, r: number) => `${n} concorrentes mapeados no raio de ${r}km`,
    distUnknown: 'distância desconhecida', priceUnknown: 'preço desconhecido', noRating: 'sem nota', reviews: 'reviews', noReviews: 'sem reviews', away: 'de distância',
    prompt: (name: string, mine: string, avg: string, list: string) => `Analise os concorrentes do meu negócio "${name}" e crie um plano estratégico para esta semana.

Minha nota no Google: ${mine}
Média dos concorrentes: ${avg}

Lista de concorrentes próximos:
${list}

Por favor, estruture a resposta assim:
**1. Análise de cada concorrente** — para cada um, identifique 1-2 pontos fortes e 1-2 pontos fracos com base nos dados.
**2. Maior ameaça** — qual é o concorrente mais perigoso e por quê.
**3. Plano da semana** — 5 ações concretas para superar os concorrentes nesta semana (posts, atendimento, preço, reputação).`,
    notSet: 'não configurada', unknown: 'desconhecida',
    loading: 'Carregando...',
    mappedSub: (n: number, r: number) => `${n} concorrentes mapeados no raio de ${r}km`, noneYet: 'Nenhum concorrente mapeado ainda',
    analyzing: '🤖 Analisando...', analyzeAI: '🤖 Analisar com IA',
    monTitle: 'Puxa seguidores e frequência de postagem do Instagram de cada concorrente (quando identificado)',
    monitoring: '📡 Monitorando...', monitor: '📡 Monitorar redes sociais',
    radiusTitle: 'Raio de busca — o limite do Google Maps é 50km', radius: 'Raio',
    linkGoogleTitle: 'Vincule seu negócio ao Google nas Configurações primeiro',
    mapping: 'Mapeando...', mapBtn: '🗺 Mapear concorrentes',
    noneTitle: 'Nenhum concorrente mapeado',
    chooseA: 'Escolha o raio acima e clique em ', mapQuoted: '"Mapear concorrentes"', chooseB: ' para buscar negócios similares via Google Maps.',
    mapNow: '🗺 Mapear agora →',
    yourRating: 'Sua nota Google', avgRating: 'Média nota concorrentes', withRating: 'com nota', diff: 'Diferença de nota',
    above: 'acima da média', below: 'abaixo da média', onAvg: 'na média', avgPrice: 'Média de preço',
    cheap: 'barato', moderate: 'moderado', pricey: 'caro', veryPricey: 'muito caro', withPrice: 'com preço',
    cols: ['Nome', 'Avaliação', 'Reviews', 'Preço ↓', 'Redes sociais', 'Dist.'], priceCol: 'Preço ↓',
    priceUp: 'Preço subiu desde a última checagem', priceDown: 'Preço caiu desde a última checagem',
    followers: 'seguidores', postsEvery: (n: number) => `posta a cada ${n}d`, noIg: 'sem Instagram',
    sortedBy: 'Ordenado por preço (mais caro → mais barato) · Dados via Google Maps',
    aiTitle: 'Análise estratégica — Agente Secretário', aiSub: 'Pontos fortes/fracos de cada concorrente + plano da semana',
    reanalyze: '↻ Reanalisar', analyzeNow: '▶ Analisar agora →',
    analyzingN: (n: number) => `Analisando ${n} concorrentes e montando plano estratégico...`,
    emptyA: 'O Agente Secretário vai analisar cada concorrente, identificar a maior ameaça', emptyB: 'e montar um plano com ', emptyBold: '5 ações concretas para esta semana', emptyEnd: '.',
  },
  en: {
    loc: 'en-US',
    unknownErr: 'Unknown error', analysisErr: 'Analysis error', analysisFail: 'Error generating analysis: ',
    monitored: (m: number, t: number) => `${m}/${t} competitors monitored`,
    mapped: (n: number, r: number) => `${n} competitors mapped within ${r}km`,
    distUnknown: 'unknown distance', priceUnknown: 'unknown price', noRating: 'no rating', reviews: 'reviews', noReviews: 'no reviews', away: 'away',
    prompt: (name: string, mine: string, avg: string, list: string) => `Analyze the competitors of my business "${name}" and create a strategic plan for this week.

My Google rating: ${mine}
Competitor average: ${avg}

List of nearby competitors:
${list}

Please structure the answer like this:
**1. Analysis of each competitor** — for each one, identify 1-2 strengths and 1-2 weaknesses based on the data.
**2. Biggest threat** — which competitor is the most dangerous and why.
**3. Plan for the week** — 5 concrete actions to beat the competitors this week (posts, service, price, reputation).`,
    notSet: 'not set', unknown: 'unknown',
    loading: 'Loading...',
    mappedSub: (n: number, r: number) => `${n} competitors mapped within ${r}km`, noneYet: 'No competitors mapped yet',
    analyzing: '🤖 Analyzing...', analyzeAI: '🤖 Analyze with AI',
    monTitle: "Pulls each competitor's Instagram followers and posting frequency (when identified)",
    monitoring: '📡 Monitoring...', monitor: '📡 Monitor social media',
    radiusTitle: 'Search radius — the Google Maps limit is 50km', radius: 'Radius',
    linkGoogleTitle: 'Link your business to Google in Settings first',
    mapping: 'Mapping...', mapBtn: '🗺 Map competitors',
    noneTitle: 'No competitors mapped',
    chooseA: 'Choose the radius above and click ', mapQuoted: '"Map competitors"', chooseB: ' to find similar businesses via Google Maps.',
    mapNow: '🗺 Map now →',
    yourRating: 'Your Google rating', avgRating: 'Competitors avg. rating', withRating: 'with rating', diff: 'Rating difference',
    above: 'above average', below: 'below average', onAvg: 'on average', avgPrice: 'Average price',
    cheap: 'cheap', moderate: 'moderate', pricey: 'expensive', veryPricey: 'very expensive', withPrice: 'with price',
    cols: ['Name', 'Rating', 'Reviews', 'Price ↓', 'Social media', 'Dist.'], priceCol: 'Price ↓',
    priceUp: 'Price went up since the last check', priceDown: 'Price went down since the last check',
    followers: 'followers', postsEvery: (n: number) => `posts every ${n}d`, noIg: 'no Instagram',
    sortedBy: 'Sorted by price (most expensive → cheapest) · Data via Google Maps',
    aiTitle: 'Strategic analysis — Secretary Agent', aiSub: "Each competitor's strengths/weaknesses + plan for the week",
    reanalyze: '↻ Re-analyze', analyzeNow: '▶ Analyze now →',
    analyzingN: (n: number) => `Analyzing ${n} competitors and building a strategic plan...`,
    emptyA: 'The Secretary Agent will analyze each competitor, identify the biggest threat', emptyB: 'and build a plan with ', emptyBold: '5 concrete actions for this week', emptyEnd: '.',
  },
} as const

export default function CompetitorsPage() {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const { lang } = useLang()
  const T = d[lang].competitors
  const X = TX[lang]
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [myRating, setMyRating] = useState<number | null>(null)
  const [myName, setMyName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [mapping, setMapping] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [hasGoogle, setHasGoogle] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [radiusKm, setRadiusKm] = useState(3)
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({})
  const [monitoring, setMonitoring] = useState(false)
  const [monitorMsg, setMonitorMsg] = useState('')

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data: company } = await supabase
      .from('companies')
      .select('id, business_name, google_rating, google_place_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (company) {
      setMyRating(company.google_rating)
      setMyName(company.business_name ?? '')
      setHasGoogle(!!company.google_place_id)

      const { data } = await supabase
        .from('competitors')
        .select('id, name, rating, review_count, distance_m, price_level, google_place_id, instagram_url')
        .eq('company_id', company.id)
        .eq('is_verified_competitor', true)
        .order('distance_m', { ascending: true })

      const comps = (data ?? []) as Competitor[]
      setCompetitors(comps)

      if (comps.length > 0) {
        const { data: snaps } = await supabase
          .from('competitor_snapshots')
          .select('competitor_id, price_level, instagram_followers, instagram_posts_count, instagram_posting_freq_days, collected_at')
          .in('competitor_id', comps.map(c => c.id))
          .order('collected_at', { ascending: false })
        const grouped: Record<string, Snapshot[]> = {}
        for (const s of (snaps ?? []) as Snapshot[]) (grouped[s.competitor_id] ??= []).push(s)
        setSnapshots(grouped)
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const monitorSocial = async () => {
    if (!session) return
    setMonitoring(true)
    setMonitorMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/monitor-competitor-social`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? X.unknownErr)
      setMonitorMsg(data.message ?? X.monitored(data.monitored, data.total))
      await load()
    } catch (e: unknown) {
      setMonitorMsg(e instanceof Error ? e.message : String(e))
    }
    setMonitoring(false)
  }

  const mapNow = async () => {
    if (!session) return
    setMapping(true)
    setMsg('')
    setErr('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/map-competitors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ radius_km: radiusKm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? X.unknownErr)
      setMsg(X.mapped(data.mapped, data.radius_km ?? radiusKm))
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    setMapping(false)
  }

  const analyzeCompetitors = async () => {
    if (!session || competitors.length === 0) return
    setAnalyzing(true)
    setAnalysis(null)

    const competitorList = competitors.map(c => {
      const dist = c.distance_m != null
        ? (c.distance_m >= 1000 ? `${(c.distance_m / 1000).toFixed(1)}km` : `${c.distance_m}m`)
        : 'distância desconhecida'
      const price = c.price_level ? '$'.repeat(c.price_level) : 'preço desconhecido'
      return `- ${c.name}: ${c.rating ? `${c.rating}★` : X.noRating} | ${c.review_count > 0 ? `${c.review_count} ${X.reviews}` : X.noReviews} | ${price} | ${dist} ${X.away}`
    }).join('\n')

    const message = X.prompt(
      myName,
      myRating ? `${myRating}★` : X.notSet,
      avgCompRating ? `${avgCompRating.toFixed(1)}★` : X.unknown,
      competitorList,
    )

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/hermes-proxy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, agent_role: 'marketing', history: [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? X.analysisErr)
      setAnalysis(data.reply)
    } catch (e) {
      setAnalysis(`${X.analysisFail}${e instanceof Error ? e.message : String(e)}`)
    }
    setAnalyzing(false)
  }

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{X.loading}</div>

  const withRating = competitors.filter(c => c.rating)
  const avgCompRating = withRating.length
    ? withRating.reduce((s, c) => s + (c.rating ?? 0), 0) / withRating.length
    : null
  const ratingDiff = myRating && avgCompRating ? (myRating - avgCompRating) : null

  const withPrice = competitors.filter(c => c.price_level != null)
  const avgPrice = withPrice.length
    ? withPrice.reduce((s, c) => s + (c.price_level ?? 0), 0) / withPrice.length
    : null

  // Sort from most expensive to cheapest; nulls go last
  const sortedCompetitors = [...competitors].sort((a, b) => {
    if (a.price_level == null) return 1
    if (b.price_level == null) return -1
    return b.price_level - a.price_level
  })

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
          <p style={{ color: MUTED, fontSize: '13px' }}>
            {competitors.length > 0 ? X.mappedSub(competitors.length, radiusKm) : X.noneYet}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {competitors.length > 0 && (
            <>
              <button
                onClick={analyzeCompetitors}
                disabled={analyzing}
                style={{ padding: '9px 18px', background: analyzing ? 'rgba(255,109,41,0.15)' : 'rgba(255,109,41,0.12)', color: ORANGE, fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: '1px solid rgba(255,109,41,0.3)', cursor: analyzing ? 'not-allowed' : 'pointer' }}>
                {analyzing ? X.analyzing : X.analyzeAI}
              </button>
              <button
                onClick={monitorSocial}
                disabled={monitoring}
                title={X.monTitle}
                style={{ padding: '9px 18px', background: monitoring ? 'rgba(255,109,41,0.15)' : 'rgba(255,109,41,0.12)', color: ORANGE, fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: '1px solid rgba(255,109,41,0.3)', cursor: monitoring ? 'not-allowed' : 'pointer' }}>
                {monitoring ? X.monitoring : X.monitor}
              </button>
            </>
          )}
          <select
            value={radiusKm}
            onChange={e => setRadiusKm(Number(e.target.value))}
            disabled={mapping}
            title={X.radiusTitle}
            style={{ padding: '9px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '13px', cursor: mapping ? 'not-allowed' : 'pointer', outline: 'none' }}>
            {[1, 3, 5, 10, 20, 30, 50].map(km => (
              <option key={km} value={km} style={{ background: CARD }}>{X.radius}: {km}km</option>
            ))}
          </select>
          <button
            onClick={mapNow}
            disabled={mapping || !hasGoogle}
            title={!hasGoogle ? X.linkGoogleTitle : ''}
            style={{ padding: '9px 18px', background: mapping ? 'rgba(255,109,41,0.3)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: mapping || !hasGoogle ? 'not-allowed' : 'pointer', opacity: !hasGoogle ? 0.5 : 1 }}>
            {mapping ? X.mapping : X.mapBtn}
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        <InsightReport tabKey="concorrentes" />

        {(msg || err) && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: err ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)', border: `1px solid ${err ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`, borderRadius: '10px', fontSize: '13px', color: err ? '#f87171' : '#4ade80' }}>
            {err || msg}
          </div>
        )}
        {monitorMsg && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '10px', fontSize: '13px', color: ORANGE }}>
            {monitorMsg}
          </div>
        )}

        {!hasGoogle ? (
          <div style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '14px', padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>🗺</div>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '10px' }}>{T.noGoogle}</div>
            <div style={{ fontSize: '14px', color: MUTED, maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.7 }}>{T.noGoogleDesc}</div>
            <button onClick={() => navigate('/dashboard/settings?section=google')}
              style={{ padding: '11px 24px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
              {T.configureGoogle}
            </button>
          </div>
        ) : competitors.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗺</div>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{X.noneTitle}</div>
            <div style={{ fontSize: '14px', color: MUTED, maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.7 }}>
              {X.chooseA}<strong style={{ color: ORANGE }}>{X.mapQuoted}</strong>{X.chooseB}
            </div>
            <button onClick={mapNow} disabled={mapping}
              style={{ padding: '11px 24px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
              {mapping ? X.mapping : X.mapNow}
            </button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            {(myRating || avgCompRating || avgPrice != null) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{X.yourRating}</div>
                  <div style={{ fontFamily: D, fontSize: '2rem', fontWeight: 900, color: myRating && myRating >= 4.3 ? '#4ade80' : myRating && myRating >= 3.8 ? '#FBBF24' : '#f87171' }}>
                    {myRating ? `${myRating}★` : '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>{myName}</div>
                </div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{X.avgRating}</div>
                  <div style={{ fontFamily: D, fontSize: '2rem', fontWeight: 900, color: MUTED }}>
                    {avgCompRating ? `${avgCompRating.toFixed(1)}★` : '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>{withRating.length} {X.withRating}</div>
                </div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{X.diff}</div>
                  <div style={{ fontFamily: D, fontSize: '2rem', fontWeight: 900, color: ratingDiff == null ? MUTED : ratingDiff > 0 ? '#4ade80' : '#f87171' }}>
                    {ratingDiff == null ? '—' : `${ratingDiff > 0 ? '+' : ''}${ratingDiff.toFixed(1)}`}
                  </div>
                  <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>
                    {ratingDiff == null ? '' : ratingDiff > 0 ? X.above : ratingDiff < 0 ? X.below : X.onAvg}
                  </div>
                </div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{X.avgPrice}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, marginTop: '4px' }}>
                    {avgPrice != null ? (
                      Array.from({ length: 4 }, (_, i) => (
                        <span key={i} style={{ color: i < Math.round(avgPrice) ? '#FBBF24' : 'rgba(255,255,255,0.15)', fontWeight: 800 }}>$</span>
                      ))
                    ) : <span style={{ fontFamily: D, color: MUTED }}>—</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>
                    {avgPrice != null ? (avgPrice <= 1.5 ? X.cheap : avgPrice <= 2.5 ? X.moderate : avgPrice <= 3.5 ? X.pricey : X.veryPricey) : `${withPrice.length} ${X.withPrice}`}
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: '2fr 1.1fr 0.9fr 1fr 1.3fr 80px', gap: '12px', alignItems: 'center' }}>
                {X.cols.map(h => (
                  <div key={h} style={{ fontSize: '10px', fontWeight: 700, color: h === X.priceCol ? ORANGE : MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                ))}
              </div>
              {sortedCompetitors.map((c, i) => {
                const compSnaps = snapshots[c.id] ?? []
                const priceHistory = compSnaps.filter(s => s.price_level != null)
                const priceTrend = priceHistory.length >= 2 && priceHistory[0].price_level !== priceHistory[1].price_level
                  ? (priceHistory[0].price_level! > priceHistory[1].price_level! ? 'up' : 'down')
                  : null
                const social = compSnaps.find(s => s.instagram_followers != null)
                return (
                  <div key={c.id} style={{ padding: '14px 22px', borderBottom: i < sortedCompetitors.length - 1 ? `1px solid ${BORDER}` : 'none', display: 'grid', gridTemplateColumns: '2fr 1.1fr 0.9fr 1fr 1.3fr 80px', gap: '12px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{c.name}</div>
                    <div><RatingBar rating={c.rating} /></div>
                    <div style={{ fontSize: '12px', color: MUTED }}>{c.review_count > 0 ? c.review_count.toLocaleString(X.loc) : '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PriceLevel level={c.price_level} />
                      {priceTrend && (
                        <span title={priceTrend === 'up' ? X.priceUp : X.priceDown}
                          style={{ fontSize: '11px', color: priceTrend === 'up' ? '#f87171' : '#4ade80' }}>
                          {priceTrend === 'up' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: MUTED }}>
                      {social ? (
                        <>
                          <span style={{ color: 'white' }}>{(social.instagram_followers ?? 0).toLocaleString(X.loc)}</span> {X.followers}
                          {social.instagram_posting_freq_days != null && (
                            <div>{X.postsEvery(social.instagram_posting_freq_days)}</div>
                          )}
                        </>
                      ) : c.instagram_url ? '—' : 'sem Instagram'}
                    </div>
                    <div style={{ fontSize: '12px', color: MUTED }}>
                      {c.distance_m != null ? (c.distance_m >= 1000 ? `${(c.distance_m / 1000).toFixed(1)}km` : `${c.distance_m}m`) : '—'}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
              {X.sortedBy}
            </div>

            {/* AI Analysis — always visible */}
            <div style={{ marginTop: '24px', background: CARD, border: `1px solid rgba(255,109,41,0.2)`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>🤖</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{X.aiTitle}</div>
                    <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>{X.aiSub}</div>
                  </div>
                </div>
                {!analyzing && (
                  <button onClick={analyzeCompetitors}
                    style={{ padding: '8px 18px', background: analysis ? 'rgba(255,255,255,0.04)' : ORANGE, color: analysis ? MUTED : '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: analysis ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', flexShrink: 0 }}>
                    {analysis ? X.reanalyze : X.analyzeNow}
                  </button>
                )}
              </div>
              <div style={{ padding: '22px' }}>
                {analyzing ? (
                  <div style={{ color: MUTED, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: ORANGE, animation: 'pulse 1.2s infinite' }} />
                    {X.analyzingN(competitors.length)}
                  </div>
                ) : analysis ? (
                  <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {analysis}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: MUTED, fontSize: '13px', lineHeight: 1.8 }}>
                    {X.emptyA}<br />
                    {X.emptyB}<strong style={{ color: 'white' }}>{X.emptyBold}</strong>{X.emptyEnd}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
