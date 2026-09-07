// ─────────────────────────────────────────────────────────────────────────
// Camada de dados do Performance (centro de inteligência do Instagram).
//
// Uma única interface `PerformanceData` descreve TUDO que a tela mostra. Ela é
// preenchida de dois jeitos:
//   1. Dados REAIS — a edge function `instagram-performance` devolve este mesmo
//      shape puxando do Instagram Graph. Métrica que a API não entrega vem
//      `null` → a UI mostra "Não disponível" (nunca inventa número).
//   2. Demonstração — `buildPerformanceDemo` gera dados plausíveis (seeded por
//      empresa) só pra visualizar o produto antes de conectar. Sempre marcado
//      `demo: true` com banner explícito.
//
// Regra de ouro: com a conta conectada, só dado real. Sem conta conectada, ou
// é o modo demonstração (rótulo visível) ou o empty state "Conecte o Instagram".
// ─────────────────────────────────────────────────────────────────────────
import { seededRng } from './growthDemo'
import type { CompanyData } from '../../../contexts/CompanyContext'

export type MetricValue = number | null // null = "Não disponível" (sem permissão/dado)

export interface Kpi {
  key: string
  label: string
  value: MetricValue
  prev: MetricValue
  format: 'int' | 'pct' | 'ratio'
  meaning: string
  calc: string
  matters: string
  ifDown: string
}

export interface ScoreComponent { key: string; label: string; value: number; note: string }
export interface PerformanceScore { total: number; label: string; components: ScoreComponent[] }

export interface TrendPoint {
  date: string
  followers: number
  reach: number
  impressions: MetricValue
  engagement: number
  engagementRate: number
  profileVisits: MetricValue
  websiteClicks: MetricValue
  published: number
}

export type ContentFormat = 'reel' | 'post' | 'carousel' | 'story'
export interface ContentPerf {
  id: string
  type: ContentFormat
  date: string
  caption: string
  thumb: string | null
  reach: MetricValue
  impressions: MetricValue
  likes: number
  comments: number
  shares: MetricValue
  saves: MetricValue
  engagementRate: number
  followersGained: MetricValue
  pillar: string
  funnel: 'tof' | 'mof' | 'bof'
}

export interface ContentTypeStat {
  type: ContentFormat; label: string; count: number
  avgReach: MetricValue; avgEng: number; avgRate: number
  avgShares: MetricValue; avgSaves: MetricValue; delta: number
}

export interface PillarStat {
  name: string; posts: number; avgReach: MetricValue; avgEng: number
  rate: number; shares: MetricValue; saves: MetricValue; delta: number
}

export interface FunnelStage { stage: 'tof' | 'mof' | 'bof'; label: string; score: number; reach: number; engagement: number }

export interface Anomaly { kind: 'opportunity' | 'attention' | 'breakout'; icon: string; title: string; body: string }

export interface Recommendation {
  id: string; priority: 'high' | 'medium' | 'low'
  title: string; reason: string; action: string; objective: string; impact: string
  prompt: string // enviado pro Agente de Conteúdo no "Criar isto"
}

export interface GameEvent { label: string; xp: number | null; kind: 'xp' | 'achievement' | 'reward'; done: boolean }
export interface CompetitorRow { name: string; postsPerWeek: number; engagement: number; estimated: boolean; formats: string }

export type HealthLevel = 'excellent' | 'good' | 'attention' | 'critical'
export type SyncStatus = 'connected' | 'syncing' | 'error' | 'demo' | 'disconnected'

export interface PerformanceData {
  connected: boolean
  demo: boolean
  username: string
  profilePic: string | null
  followers: MetricValue
  lastSync: string
  health: { level: HealthLevel; score: number }
  score: PerformanceScore
  kpis: Kpi[]
  trend: TrendPoint[] // até 180 dias diários; a UI corta por range
  audience: {
    start: number; current: number; net: number; gained: number; lost: number
    growthRate: number; velocityPerWeek: number
    momentum: 'accelerating' | 'stable' | 'slowing' | 'declining'; note: string
  }
  reach: {
    total: MetricValue; nonFollowers: MetricValue; followers: MetricValue; impressions: MetricValue
    avgPerContent: MetricValue; growth: MetricValue; nonFollowerPct: MetricValue; insight: string
  }
  engagement: {
    likes: number; comments: number; shares: MetricValue; saves: MetricValue; total: number
    rate: number; perReach: MetricValue; avgPerPost: number; strongest: string; note: string
    breakdownDelta: { likes: number; comments: number; shares: number; saves: number }
  }
  content: ContentPerf[]
  contentTypes: ContentTypeStat[]
  contentTypeConclusion: string
  consistency: {
    published: number; perWeek: number; daysActive: number
    currentStreak: number; longestStreak: number; recommendedPerWeek: number
    heatmap: number[][]; note: string // heatmap: 12 semanas x 7 dias
  }
  bestTime: { enough: boolean; heatmap: number[][]; best: string; window: string } // 7 dias x 6 faixas
  funnel: FunnelStage[]
  funnelNote: string
  pillars: PillarStat[]
  anomalies: Anomaly[]
  aiAnalysis: { working: string; notWorking: string; why: string; opportunity: string; risk: string; nextAction: string }
  competitor: { hasData: boolean; rows: CompetitorRow[]; you: { postsPerWeek: number; engagement: number } }
  recommendations: Recommendation[]
  game: GameEvent[]
  sync: { status: SyncStatus; lastSync: string; error: string | null }
}

const DAY = 86400000
const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()
const PILLARS = ['Educação', 'Bastidores', 'Prova social', 'Produto', 'Entretenimento']
const FMT_LABEL: Record<ContentFormat, string> = { reel: 'Reels', post: 'Posts', carousel: 'Carrosséis', story: 'Stories' }

// ── Cálculo do score (normalizado, não é média crua) ──────────────────────
export function computeScore(c: {
  growth: number; reach: number; engagement: number; content: number; consistency: number
}): PerformanceScore {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
  const components: ScoreComponent[] = [
    { key: 'growth', label: 'Crescimento', value: clamp(c.growth), note: 'Velocidade de novos seguidores vs seu histórico e o tamanho da conta.' },
    { key: 'reach', label: 'Alcance', value: clamp(c.reach), note: 'Alcance médio por conteúdo e quanto vem de não-seguidores (descoberta).' },
    { key: 'engagement', label: 'Engajamento', value: clamp(c.engagement), note: 'Interações de alta intenção (salvamentos, compartilhamentos, comentários) sobre o alcance.' },
    { key: 'content', label: 'Conteúdo', value: clamp(c.content), note: 'Consistência de desempenho entre os formatos e os melhores conteúdos.' },
    { key: 'consistency', label: 'Consistência', value: clamp(c.consistency), note: 'Regularidade de publicação — e se ela está gerando resultado, não só volume.' },
  ]
  // pesos: descoberta e engajamento pesam mais que volume bruto
  const total = clamp(
    components[0].value * 0.22 + components[1].value * 0.24 + components[2].value * 0.26 +
    components[3].value * 0.16 + components[4].value * 0.12,
  )
  const label = total >= 80 ? 'Desempenho forte' : total >= 60 ? 'Desempenho bom' : total >= 40 ? 'Precisa de atenção' : 'Desempenho crítico'
  return { total, label, components }
}

export function healthFromScore(score: number): { level: HealthLevel; score: number } {
  const level: HealthLevel = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'attention' : 'critical'
  return { level, score }
}

// ── Builder de demonstração (seeded por empresa) ──────────────────────────
export function buildPerformanceDemo(company: Pick<CompanyData, 'id' | 'business_name'>): PerformanceData {
  const rng = seededRng((company.id || company.business_name || 'demo') + ':perf')
  const rand = (min: number, max: number) => min + rng() * (max - min)
  const randi = (min: number, max: number) => Math.round(rand(min, max))

  const baseFollowers = randi(3800, 28000)
  const days = 180

  // Trend diário: seguidores acumulando + alcance/engajamento com ruído e picos.
  const trend: TrendPoint[] = []
  let followers = Math.round(baseFollowers * 0.86)
  const dailyGain = (baseFollowers * 0.14) / days
  for (let i = days - 1; i >= 0; i--) {
    const spike = rng() > 0.94 ? rand(1.8, 3.4) : 1
    followers += Math.max(0, Math.round(dailyGain * rand(0.2, 2.1)))
    const posted = rng() > 0.62 ? 1 : 0
    const reach = Math.round(followers * rand(0.28, 0.72) * spike)
    const engagement = Math.round(reach * rand(0.03, 0.08))
    trend.push({
      date: isoDaysAgo(i),
      followers,
      reach,
      impressions: Math.round(reach * rand(1.15, 1.6)),
      engagement,
      engagementRate: Math.round((engagement / Math.max(1, reach)) * 1000) / 10,
      profileVisits: Math.round(reach * rand(0.02, 0.06)),
      websiteClicks: Math.round(reach * rand(0.003, 0.012)),
      published: posted,
    })
  }
  const current = trend[trend.length - 1].followers

  // Janela dos últimos 30 vs 30 anteriores (pros KPIs).
  const last30 = trend.slice(-30)
  const prev30 = trend.slice(-60, -30)
  const sum = (rows: TrendPoint[], k: keyof TrendPoint) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0)

  const followersGrowth = current - prev30[prev30.length - 1].followers
  const prevGrowth = prev30[prev30.length - 1].followers - prev30[0].followers
  const reachNow = sum(last30, 'reach'), reachPrev = sum(prev30, 'reach')
  const engNow = sum(last30, 'engagement'), engPrev = sum(prev30, 'engagement')
  const pubNow = sum(last30, 'published'), pubPrev = sum(prev30, 'published')
  const imprNow = sum(last30, 'impressions'), imprPrev = sum(prev30, 'impressions')
  const visitsNow = sum(last30, 'profileVisits'), visitsPrev = sum(prev30, 'profileVisits')
  const clicksNow = sum(last30, 'websiteClicks'), clicksPrev = sum(prev30, 'websiteClicks')
  const engRateNow = Math.round((engNow / Math.max(1, reachNow)) * 1000) / 10
  const engRatePrev = Math.round((engPrev / Math.max(1, reachPrev)) * 1000) / 10

  const kpis: Kpi[] = [
    { key: 'followers', label: 'Seguidores', value: current, prev: prev30[prev30.length - 1].followers, format: 'int',
      meaning: 'Total de contas que seguem seu perfil hoje.', calc: 'Valor atual reportado pelo Instagram.', matters: 'É a base de audiência que você construiu e pode reengajar sem pagar mídia.', ifDown: 'Publique mais conteúdo de descoberta (Reels) e revise se algum post afastou a audiência.' },
    { key: 'followersGrowth', label: 'Novos seguidores', value: followersGrowth, prev: prevGrowth, format: 'int',
      meaning: 'Seguidores líquidos ganhos no período.', calc: 'Seguidores no fim do período − seguidores no início.', matters: 'Mede se sua audiência está de fato crescendo, não só o tamanho.', ifDown: 'Aumente formatos de descoberta e teste ganchos mais fortes nos primeiros 3s dos Reels.' },
    { key: 'reach', label: 'Alcance', value: reachNow, prev: reachPrev, format: 'int',
      meaning: 'Contas únicas que viram seu conteúdo.', calc: 'Soma do alcance de cada conteúdo no período.', matters: 'É o topo do funil — sem alcance não há novos clientes.', ifDown: 'Priorize Reels e conteúdo salvável; poste no melhor horário identificado abaixo.' },
    { key: 'impressions', label: 'Impressões', value: imprNow, prev: imprPrev, format: 'int',
      meaning: 'Total de vezes que seu conteúdo apareceu (inclui repetições).', calc: 'Soma das impressões de cada conteúdo.', matters: 'Mostra frequência de exposição da sua marca.', ifDown: 'Mais publicações consistentes aumentam impressões acumuladas.' },
    { key: 'engagement', label: 'Engajamento', value: engNow, prev: engPrev, format: 'int',
      meaning: 'Total de interações (curtidas, comentários, salvamentos, compartilhamentos).', calc: 'Soma de todas as interações do período.', matters: 'Sinaliza pro algoritmo que vale a pena distribuir seu conteúdo.', ifDown: 'Faça perguntas nas legendas e crie conteúdo salvável (listas, passo a passo).' },
    { key: 'engagementRate', label: 'Taxa de engajamento', value: engRateNow, prev: engRatePrev, format: 'pct',
      meaning: 'Interações sobre alcance.', calc: 'Engajamento ÷ alcance × 100.', matters: 'Mede qualidade — não adianta alcançar muito e ninguém interagir.', ifDown: 'Melhore a chamada pra ação e priorize temas que geraram mais salvamentos.' },
    { key: 'profileVisits', label: 'Visitas ao perfil', value: visitsNow, prev: visitsPrev, format: 'int',
      meaning: 'Quantas vezes seu perfil foi aberto.', calc: 'Soma das visitas no período.', matters: 'Passo intermediário entre descoberta e conversão (seguir/clicar no link).', ifDown: 'Reforce a proposta de valor na bio e use CTAs que levem ao perfil.' },
    { key: 'websiteClicks', label: 'Cliques no link', value: clicksNow, prev: clicksPrev, format: 'int',
      meaning: 'Cliques no link da bio.', calc: 'Soma dos cliques no período.', matters: 'Sinal mais próximo de conversão real (site, agendamento, loja).', ifDown: 'Direcione conteúdo pro link e teste chamadas mais claras ("link na bio").' },
    { key: 'published', label: 'Conteúdos publicados', value: pubNow, prev: pubPrev, format: 'int',
      meaning: 'Quantidade de publicações no período.', calc: 'Contagem de posts/Reels/carrosséis publicados.', matters: 'Consistência alimenta o alcance — mas volume sem qualidade não ajuda.', ifDown: 'Volte a um ritmo sustentável (ver frequência recomendada abaixo).' },
    { key: 'avgReach', label: 'Alcance médio / post', value: Math.round(reachNow / Math.max(1, pubNow)), prev: Math.round(reachPrev / Math.max(1, pubPrev)), format: 'int',
      meaning: 'Alcance médio por conteúdo publicado.', calc: 'Alcance total ÷ conteúdos publicados.', matters: 'Isola a eficiência do conteúdo do simples volume de posts.', ifDown: 'Menos posts, mais qualidade: dobre no formato que mais alcança.' },
    { key: 'avgEng', label: 'Engajamento médio / post', value: Math.round(engNow / Math.max(1, pubNow)), prev: Math.round(engPrev / Math.max(1, pubPrev)), format: 'int',
      meaning: 'Interações médias por conteúdo.', calc: 'Engajamento total ÷ conteúdos publicados.', matters: 'Mostra se cada peça está realmente conversando com a audiência.', ifDown: 'Reaproveite os temas dos seus melhores conteúdos abaixo.' },
  ]

  // Conteúdos (últimos ~14).
  const formats: ContentFormat[] = ['reel', 'carousel', 'post', 'reel', 'story', 'reel', 'carousel', 'post', 'reel', 'carousel', 'post', 'reel', 'story', 'carousel']
  const captions = [
    '3 erros que afastam clientes do seu negócio', 'Bastidores: como preparamos tudo', 'O que nossos clientes falam da gente',
    'Novidade que acabou de chegar', 'Um dia na rotina do time', 'Passo a passo pra você aplicar hoje',
    'Antes e depois que impressiona', 'Dica rápida que ninguém te conta', 'A pergunta que mais recebemos',
    'Promoção da semana', 'Como escolher o certo pra você', 'O segredo por trás do resultado',
    'Responde a dúvida mais comum', 'Comparativo: qual vale mais a pena',
  ]
  const content: ContentPerf[] = formats.map((type, i) => {
    const base = current * rand(0.25, 0.9) * (type === 'reel' ? rand(1.2, 2.4) : type === 'carousel' ? rand(0.9, 1.4) : rand(0.5, 0.9))
    const reach = Math.round(base)
    const likes = Math.round(reach * rand(0.03, 0.07))
    const comments = Math.round(reach * rand(0.002, 0.01))
    const shares = type === 'reel' ? Math.round(reach * rand(0.004, 0.02)) : Math.round(reach * rand(0.001, 0.008))
    const saves = type === 'carousel' ? Math.round(reach * rand(0.008, 0.03)) : Math.round(reach * rand(0.002, 0.012))
    const total = likes + comments + shares + saves
    return {
      id: `demo_${i}`, type, date: isoDaysAgo(i * 2 + randi(0, 2)), caption: captions[i % captions.length], thumb: null,
      reach, impressions: Math.round(reach * rand(1.1, 1.6)), likes, comments, shares, saves,
      engagementRate: Math.round((total / Math.max(1, reach)) * 1000) / 10,
      followersGained: Math.round(reach * rand(0.001, 0.006)),
      pillar: PILLARS[i % PILLARS.length],
      funnel: type === 'reel' ? 'tof' : type === 'carousel' ? 'mof' : 'bof',
    }
  })

  // Estatística por formato.
  const byFormat = (f: ContentFormat) => content.filter(c => c.type === f)
  const contentTypes: ContentTypeStat[] = (['reel', 'carousel', 'post', 'story'] as ContentFormat[]).map(f => {
    const rows = byFormat(f)
    const n = rows.length || 1
    const avgReach = rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.reach ?? 0), 0) / n) : 0
    const avgEng = rows.length ? Math.round(rows.reduce((s, r) => s + r.likes + r.comments + Number(r.shares ?? 0) + Number(r.saves ?? 0), 0) / n) : 0
    return {
      type: f, label: FMT_LABEL[f], count: rows.length, avgReach,
      avgEng, avgRate: rows.length ? Math.round((avgEng / Math.max(1, avgReach)) * 1000) / 10 : 0,
      avgShares: rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.shares ?? 0), 0) / n) : 0,
      avgSaves: rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.saves ?? 0), 0) / n) : 0,
      delta: Math.round(rand(-15, 42)),
    }
  })

  // Pilares.
  const pillars: PillarStat[] = PILLARS.map(name => {
    const rows = content.filter(c => c.pillar === name)
    const n = rows.length || 1
    const avgReach = rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.reach ?? 0), 0) / n) : 0
    const avgEng = rows.length ? Math.round(rows.reduce((s, r) => s + r.likes + r.comments + Number(r.shares ?? 0) + Number(r.saves ?? 0), 0) / n) : 0
    return {
      name, posts: rows.length, avgReach, avgEng,
      rate: rows.length ? Math.round((avgEng / Math.max(1, avgReach)) * 1000) / 10 : 0,
      shares: rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.shares ?? 0), 0) / n) : 0,
      saves: rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.saves ?? 0), 0) / n) : 0,
      delta: Math.round(rand(-12, 38)),
    }
  })

  // Consistência: heatmap 12 semanas x 7 dias.
  const heatmap: number[][] = Array.from({ length: 12 }, () => Array.from({ length: 7 }, () => (rng() > 0.55 ? randi(1, 2) : 0)))
  const published = heatmap.flat().reduce((s, v) => s + v, 0)
  const perWeek = Math.round((published / 12) * 10) / 10

  // Melhor horário: 7 dias x 6 faixas de horário (índice de engajamento).
  const bestHeat: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => randi(10, 100)))
  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const SLOTS = ['6–9h', '9–12h', '12–15h', '15–18h', '18–21h', '21–24h']
  let bestD = 0, bestS = 0, bestV = 0
  bestHeat.forEach((row, d) => row.forEach((v, s) => { if (v > bestV) { bestV = v; bestD = d; bestS = s } }))

  // Momentum.
  const velocity = Math.round(followersGrowth / (30 / 7))
  const momentum: PerformanceData['audience']['momentum'] =
    followersGrowth > prevGrowth * 1.15 ? 'accelerating' : followersGrowth < prevGrowth * 0.85 ? 'slowing' : 'stable'

  const nonFollowerPct = Math.round(rand(48, 71))
  const strongestSignal = contentTypes[0].avgSaves && contentTypes[0].avgShares
    ? (rng() > 0.5 ? 'compartilhamentos' : 'salvamentos') : 'salvamentos'

  const score = computeScore({
    growth: 55 + velocity / 8,
    reach: 50 + nonFollowerPct / 3,
    engagement: 45 + engRateNow * 6,
    content: 60 + contentTypes[0].delta / 3,
    consistency: 40 + perWeek * 12,
  })

  const topReel = content.filter(c => c.type === 'reel').sort((a, b) => Number(b.reach) - Number(a.reach))[0]

  const recommendations: Recommendation[] = [
    { id: 'rec1', priority: 'high', title: 'Aumente os Reels educativos', impact: 'Alto',
      reason: `Reels educativos alcançam ${contentTypes[0].delta > 0 ? '2,1x' : '1,8x'} o seu alcance médio e trazem mais não-seguidores.`,
      action: 'Crie 3 Reels educativos esta semana sobre os temas que mais geraram salvamentos.', objective: 'Aumentar descoberta e novos seguidores.',
      prompt: 'Crie 3 Reels educativos curtos (até 30s) sobre os temas que mais geraram salvamentos no meu perfil, com ganchos fortes nos primeiros 3 segundos.' },
    { id: 'rec2', priority: 'medium', title: 'Poste no melhor horário', impact: 'Médio',
      reason: `Seu maior engajamento acontece ${DAY_NAMES[bestD]} entre ${SLOTS[bestS]}.`,
      action: `Agende os próximos posts para ${DAY_NAMES[bestD]} ${SLOTS[bestS]}.`, objective: 'Maximizar alcance inicial e distribuição.',
      prompt: `Monte um calendário de publicação priorizando ${DAY_NAMES[bestD]} no horário de ${SLOTS[bestS]}.` },
    { id: 'rec3', priority: 'medium', title: 'Reforce conteúdo salvável', impact: 'Médio',
      reason: 'Carrosséis geram mais salvamentos — sinal de alta intenção que o algoritmo valoriza.',
      action: 'Transforme seu melhor Reel em um carrossel "passo a passo" salvável.', objective: 'Aumentar salvamentos e engajamento de qualidade.',
      prompt: 'Transforme meu conteúdo de melhor desempenho em um carrossel passo a passo, salvável, com um slide final de chamada pra ação.' },
  ]

  return {
    connected: false,
    demo: true,
    username: guessHandle(company.business_name),
    profilePic: null,
    followers: current,
    lastSync: isoDaysAgo(0),
    health: healthFromScore(score.total),
    score,
    kpis,
    trend,
    audience: {
      start: prev30[0].followers, current, net: followersGrowth,
      gained: followersGrowth + randi(40, 180), lost: randi(40, 180),
      growthRate: Math.round((followersGrowth / Math.max(1, prev30[0].followers)) * 1000) / 10,
      velocityPerWeek: velocity, momentum,
      note: momentum === 'accelerating' ? `Crescimento acelerou ${Math.round(rand(12, 34))}% em relação ao período anterior.`
        : momentum === 'slowing' ? 'O ritmo de crescimento desacelerou — vale reforçar o conteúdo de descoberta.'
        : 'Crescimento estável em relação ao período anterior.',
    },
    reach: {
      total: reachNow, nonFollowers: Math.round(reachNow * nonFollowerPct / 100),
      followers: Math.round(reachNow * (100 - nonFollowerPct) / 100),
      impressions: imprNow, avgPerContent: Math.round(reachNow / Math.max(1, pubNow)),
      growth: Math.round(((reachNow - reachPrev) / Math.max(1, reachPrev)) * 1000) / 10,
      nonFollowerPct,
      insight: `${nonFollowerPct}% do seu alcance veio de não-seguidores. Isso indica bom potencial de descoberta — os Reels são o que mais puxa audiência nova hoje.`,
    },
    engagement: {
      likes: content.reduce((s, c) => s + c.likes, 0),
      comments: content.reduce((s, c) => s + c.comments, 0),
      shares: content.reduce((s, c) => s + Number(c.shares ?? 0), 0),
      saves: content.reduce((s, c) => s + Number(c.saves ?? 0), 0),
      total: engNow, rate: engRateNow,
      perReach: Math.round((engNow / Math.max(1, reachNow)) * 1000) / 10,
      avgPerPost: Math.round(engNow / Math.max(1, pubNow)),
      strongest: strongestSignal,
      note: `${strongestSignal === 'compartilhamentos' ? 'Compartilhamentos' : 'Salvamentos'} subiram ${Math.round(rand(18, 40))}% e são hoje seu sinal de engajamento mais forte — priorize conteúdo que gera esse tipo de ação.`,
      breakdownDelta: { likes: Math.round(rand(-8, 22)), comments: Math.round(rand(-5, 30)), shares: Math.round(rand(5, 40)), saves: Math.round(rand(8, 44)) },
    },
    content,
    contentTypes,
    contentTypeConclusion: 'Reels são hoje seu formato de descoberta mais forte, enquanto carrosséis geram mais salvamentos (intenção alta). Posts estáticos ficam abaixo da média em alcance.',
    consistency: {
      published, perWeek, daysActive: heatmap.flat().filter(v => v > 0).length,
      currentStreak: randi(1, 6), longestStreak: randi(6, 14), recommendedPerWeek: 4,
      heatmap, note: perWeek < 3 ? 'Você está publicando abaixo do ritmo recomendado (4/semana). Mais consistência tende a aumentar o alcance acumulado.'
        : 'Bom ritmo de publicação. Foque em manter a qualidade em vez de só aumentar volume.',
    },
    bestTime: {
      enough: content.length >= 8, heatmap: bestHeat,
      best: `${DAY_NAMES[bestD]} — ${SLOTS[bestS]}`, window: `${DAY_NAMES[bestD]} ${SLOTS[bestS]}`,
    },
    funnel: [
      { stage: 'tof', label: 'Topo — Descoberta', score: randi(78, 94), reach: reachNow, engagement: Math.round(engNow * 0.4) },
      { stage: 'mof', label: 'Meio — Consideração', score: randi(64, 82), reach: Math.round(reachNow * 0.6), engagement: Math.round(engNow * 0.38) },
      { stage: 'bof', label: 'Fundo — Conversão', score: randi(48, 70), reach: Math.round(reachNow * 0.3), engagement: Math.round(engNow * 0.22) },
    ],
    funnelNote: 'A descoberta (topo) é seu ponto mais forte. A conversão (fundo) é onde há mais espaço — falta conteúdo que leve pra ação (link, agendamento, oferta).',
    pillars,
    anomalies: [
      { kind: 'opportunity', icon: '🚀', title: 'Oportunidade de descoberta', body: `Seus Reels alcançaram ${Math.round(rand(2.2, 3.1) * 10) / 10}x sua audiência normal esta semana. Vale dobrar nesse formato enquanto está performando.` },
      topReel ? { kind: 'breakout', icon: '🔥', title: 'Conteúdo em destaque', body: `O Reel "${topReel.caption}" está superando seu Reel médio em ${Math.round(rand(180, 360))}%. Considere transformá-lo em campanha.` } : null,
      { kind: 'attention', icon: '⚠️', title: 'Atenção ao engajamento', body: `A taxa de engajamento oscilou ${Math.round(rand(8, 19))}% nas últimas 2 semanas. Reforce chamadas pra ação nas legendas.` },
    ].filter(Boolean) as Anomaly[],
    aiAnalysis: {
      working: 'Reels educativos estão gerando muito acima da média de alcance e trazendo não-seguidores — sua descoberta está saudável.',
      notWorking: 'Posts estáticos promocionais recebem menos engajamento e puxam a média pra baixo.',
      why: 'O algoritmo prioriza conteúdo salvável e compartilhável; seus Reels e carrosséis entregam isso, os posts estáticos não.',
      opportunity: 'Criar mais Reels curtos educativos sobre o tema que mais gerou salvamentos deve acelerar o crescimento.',
      risk: 'A frequência de publicação caiu — se continuar, o alcance acumulado tende a cair junto.',
      nextAction: 'Publique 3 Reels educativos esta semana baseados nos temas com mais salvamentos e agende no seu melhor horário.',
    },
    competitor: {
      hasData: true,
      you: { postsPerWeek: perWeek, engagement: engRateNow },
      rows: [
        { name: 'Concorrente A', postsPerWeek: Math.round(rand(3, 7)), engagement: Math.round(rand(2, 6) * 10) / 10, estimated: true, formats: 'Reels, Carrosséis' },
        { name: 'Concorrente B', postsPerWeek: Math.round(rand(2, 5)), engagement: Math.round(rand(1.5, 5) * 10) / 10, estimated: true, formats: 'Reels, Stories' },
      ],
    },
    recommendations,
    game: [
      { label: '+100 seguidores no mês', xp: 100, kind: 'xp', done: followersGrowth >= 100 },
      { label: 'Marco de alcance (10k)', xp: 150, kind: 'xp', done: reachNow >= 10000 },
      { label: 'Melhor post do mês', xp: null, kind: 'achievement', done: !!topReel },
      { label: 'Sequência de consistência', xp: null, kind: 'achievement', done: perWeek >= 4 },
      { label: 'Score de performance subiu', xp: 80, kind: 'xp', done: score.total >= 70 },
      { label: 'Meta de crescimento mensal', xp: null, kind: 'reward', done: momentum === 'accelerating' },
    ],
    sync: { status: 'demo', lastSync: isoDaysAgo(0), error: null },
  }
}

function guessHandle(name: string): string {
  const h = (name || 'seu_negocio').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 20)
  return h || 'seu_negocio'
}

// Rótulos e helpers compartilhados com a UI.
export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const SLOT_NAMES = ['6–9h', '9–12h', '12–15h', '15–18h', '18–21h', '21–24h']
export const FORMAT_LABEL = FMT_LABEL

export const HEALTH_META: Record<HealthLevel, { label: string; color: string }> = {
  excellent: { label: 'Excelente', color: '#4ade80' },
  good: { label: 'Bom', color: '#8bd450' },
  attention: { label: 'Precisa de atenção', color: '#FBBF24' },
  critical: { label: 'Crítico', color: '#f87171' },
}

export function metricText(v: MetricValue, format: 'int' | 'pct' | 'ratio' = 'int'): string {
  if (v == null) return 'Não disponível'
  if (format === 'pct') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  if (format === 'ratio') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export function deltaOf(value: MetricValue, prev: MetricValue): { pct: number; positive: boolean } | null {
  if (value == null || prev == null || prev === 0) return null
  const pct = Math.round(((value - prev) / Math.abs(prev)) * 1000) / 10
  return { pct, positive: pct >= 0 }
}
