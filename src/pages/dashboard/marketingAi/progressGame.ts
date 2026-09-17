// ── Business Progress Game — motor de progresso ──────────────────────────
// Compõe o payload da experiência a partir de SINAIS REAIS da plataforma
// (posts, oportunidades, avaliações, campanhas, atividade) + preenchimento
// determinístico por empresa (seededRng) onde a integração ainda não está
// ligada — mesmo padrão demo-first do resto do produto. As regras de GP,
// níveis, pins e rewards ficam no banco (progress_* tables); aqui ficam os
// PADRÕES espelhados para render imediato/offline.
import type { CompanyData } from '../../../contexts/CompanyContext'
import { seededRng } from './growthDemo'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type HealthStatus = 'growing' | 'stable' | 'at_risk'

// Sinais reais lidos do banco (contagens). Tudo opcional — 0 se não houver.
export interface RealSignals {
  posts: number
  postsPublished: number
  opportunities: number
  reviewsReplied: number
  campaigns: number
  activitySinceVisit: number
  daysSinceVisit: number
}

export interface WhileAwayItem { key: string; icon: string; label: string; count: number; link?: string }
export interface Delta { label: string; value: string; up: boolean }
export interface LevelInfo { level: number; key: string; name: string; icon: string; minGp: number; maxGp: number | null; identity: string; color: string }
export interface JourneyStage { key: string; label: string; state: 'done' | 'current' | 'locked' }
export interface Pin { key: string; name: string; description: string; icon: string; rarity: Rarity; unlocked: boolean; unlockedAt?: string; rewardKey?: string }
export interface Reward { key: string; category: string; name: string; description: string; icon: string; durationHours: number | null; unlocked: boolean; active: boolean; expiresLabel?: string }
export interface TimelineItem { when: string; icon: string; label: string; gp?: number }
export interface HealthMetric { label: string; value: string; delta: number }
export interface WeeklyRow { label: string; pct: number }

export interface ProgressData {
  lastVisitLabel: string
  whileAway: WhileAwayItem[]
  actionsCount: number
  gpEarnedSinceVisit: number
  totalGp: number
  level: LevelInfo
  nextLevel: LevelInfo | null
  gpToNext: number
  levelPct: number
  healthFrom: number
  healthTo: number
  deltas: Delta[]
  milestone: { title: string; icon: string; current: number; target: number; pct: number; remaining: number; nextGoal: string }
  health: { status: HealthStatus; metrics: HealthMetric[] }
  weekly: WeeklyRow[]
  pins: Pin[]
  rewards: Reward[]
  timeline: TimelineItem[]
  nextBestAction: { title: string; cta: string; link: string }
  recovery: { declining: boolean; metrics: { label: string; value: string }[]; causes: string[] } | null
  streak: number
  journey: JourneyStage[]
  reachPct: number
  engagementPct: number
  contentCreated: number
  newAchievement: string | null
}

// ── Smart Popup: escolhe a variante mais relevante ao abrir a plataforma ────
export type PopupVariant = 'levelup' | 'while_away' | 'results' | 'almost' | 'streak' | 'status'

export function choosePopup(d: ProgressData, ctx: { daysSinceVisit: number; lastSeenLeague: string | null; lastStreakSeen: number }): PopupVariant {
  // Subiu de liga desde a última vez que viu → celebra.
  if (ctx.lastSeenLeague && ctx.lastSeenLeague !== d.level.key) {
    const order = LEVELS.map(l => l.key)
    if (order.indexOf(d.level.key) > order.indexOf(ctx.lastSeenLeague)) return 'levelup'
  }
  if (d.levelPct >= 90 && d.nextLevel) return 'almost'           // quase lá → curiosidade
  if (ctx.daysSinceVisit >= 2 && d.actionsCount > 0) return 'while_away'
  if (d.gpEarnedSinceVisit >= 50) return 'results'               // resultado novo relevante
  if (d.streak >= 7 && d.streak !== ctx.lastStreakSeen) return 'streak'
  return 'status'                                                // só mostra onde está
}

// Ligas (substituem os níveis numéricos) — XP = Growth Points.
export const LEVELS: LevelInfo[] = [
  { level: 1, key: 'bronze',   name: 'Bronze',   icon: '🪨', minGp: 0,     maxGp: 2500,  identity: 'Starting Business', color: '#cd7f32' },
  { level: 2, key: 'silver',   name: 'Silver',   icon: '🥈', minGp: 2500,  maxGp: 7500,  identity: 'Growing Business',  color: '#cbd5e1' },
  { level: 3, key: 'gold',     name: 'Gold',     icon: '🥇', minGp: 7500,  maxGp: 15000, identity: 'Growth Business',   color: '#FBBF24' },
  { level: 4, key: 'platinum', name: 'Platinum', icon: '💎', minGp: 15000, maxGp: 30000, identity: 'Advanced Business', color: '#67e8f9' },
  { level: 5, key: 'diamond',  name: 'Diamond',  icon: '👑', minGp: 30000, maxGp: 60000, identity: 'Elite Business',    color: '#A78BFA' },
  { level: 6, key: 'master',   name: 'Master',   icon: '🚀', minGp: 60000, maxGp: null,  identity: 'Business Master',   color: '#FF6D29' },
]
export { LEVELS as LEAGUES }

// Jornada do negócio — estágios que acendem conforme o XP acumula.
const JOURNEY_STAGES: { key: string; label: string; at: number }[] = [
  { key: 'foundation', label: 'Foundation', at: 0 },
  { key: 'visibility', label: 'Visibility', at: 1500 },
  { key: 'audience', label: 'Audience', at: 3500 },
  { key: 'engagement', label: 'Engagement', at: 6000 },
  { key: 'leads', label: 'Leads', at: 9000 },
  { key: 'conversion', label: 'Conversion', at: 14000 },
  { key: 'growth', label: 'Growth', at: 22000 },
  { key: 'scale', label: 'Scale', at: 40000 },
  { key: 'mastery', label: 'Business Mastery', at: 60000 },
]

export const RARITY_META: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Comum', color: '#9ca3af' },
  rare: { label: 'Raro', color: '#60a5fa' },
  epic: { label: 'Épico', color: '#A78BFA' },
  legendary: { label: 'Lendário', color: '#FBBF24' },
}

export const HEALTH_META: Record<HealthStatus, { label: string; color: string; dot: string }> = {
  growing: { label: 'Crescendo', color: '#4ade80', dot: '🟢' },
  stable: { label: 'Estável', color: '#FBBF24', dot: '🟡' },
  at_risk: { label: 'Em risco', color: '#f87171', dot: '🔴' },
}

// GP por evento (padrão — espelha progress_gp_rules).
const GP: Record<string, number> = {
  lead_created: 5, lead_qualified: 10, lead_converted: 100, lead_recovered: 30,
  conversation_handled: 5, followup_sent: 8, content_created: 8, content_published: 15,
  campaign_created: 20, campaign_optimized: 50, opportunity_found: 12, review_replied: 10,
  competitor_scanned: 8, automation_completed: 20,
}

function levelForGp(gp: number): { level: LevelInfo; next: LevelInfo | null } {
  let level = LEVELS[0]
  for (const l of LEVELS) if (gp >= l.minGp) level = l
  const next = LEVELS.find(l => l.level === level.level + 1) ?? null
  return { level, next }
}

const PIN_DEFS: Omit<Pin, 'unlocked' | 'unlockedAt'>[] = [
  { key: 'growth_starter', name: 'Growth Starter', description: 'Primeiro lead convertido.', icon: '🥉', rarity: 'common' },
  { key: 'seven_day_streak', name: '7-Day Streak', description: 'Progresso por 7 dias seguidos.', icon: '🔥', rarity: 'rare' },
  { key: 'lead_hunter', name: 'Lead Hunter', description: '100 leads encontrados.', icon: '🎯', rarity: 'rare' },
  { key: 'revenue_builder', name: 'Revenue Builder', description: 'Primeira venda atribuída ao SalesBoost.', icon: '💰', rarity: 'epic' },
  { key: 'automation_master', name: 'Automation Master', description: '100 ações automáticas.', icon: '⚡', rarity: 'epic' },
  { key: 'growth_legend', name: 'Growth Legend', description: 'Atingiu Business Master.', icon: '👑', rarity: 'legendary' },
  { key: 'ultra_intelligence', name: 'Ultra Intelligence', description: 'Desbloqueou 24h de inteligência avançada.', icon: '🔮', rarity: 'epic', rewardKey: 'ultra_intelligence' },
]

const REWARD_DEFS: Omit<Reward, 'unlocked' | 'active' | 'expiresLabel'>[] = [
  { key: 'ultra_intelligence', category: 'ai_boost', name: 'Ultra Intelligence', description: 'Capacidades avançadas do agente por 24h.', icon: '🔮', durationHours: 24 },
  { key: 'advanced_reasoning', category: 'ai_boost', name: 'Advanced Reasoning', description: 'Raciocínio profundo por 24h.', icon: '🧠', durationHours: 24 },
  { key: 'deep_analysis', category: 'ai_boost', name: 'Deep Analysis', description: 'Análise profunda por 24h.', icon: '🔬', durationHours: 24 },
  { key: 'advanced_competitor_analysis', category: 'marketing', name: 'Advanced Competitor Analysis', description: 'Análise de concorrentes aprofundada.', icon: '🕵️', durationHours: null },
  { key: 'premium_campaign_intelligence', category: 'marketing', name: 'Premium Campaign Intelligence', description: 'Inteligência premium de campanhas.', icon: '🎯', durationHours: null },
  { key: 'advanced_content_generation', category: 'marketing', name: 'Advanced Content Generation', description: 'Geração de conteúdo avançada.', icon: '✍️', durationHours: null },
  { key: 'advanced_lead_discovery', category: 'sales', name: 'Advanced Lead Discovery', description: 'Descoberta de leads aprofundada.', icon: '🔎', durationHours: null },
  { key: 'lead_enrichment', category: 'sales', name: 'Lead Enrichment Boost', description: 'Enriquecimento de dados dos leads.', icon: '📇', durationHours: null },
  { key: 'advanced_qualification', category: 'sales', name: 'Advanced Qualification', description: 'Qualificação avançada de leads.', icon: '✅', durationHours: null },
  { key: 'advanced_reports', category: 'analytics', name: 'Advanced Reports', description: 'Relatórios avançados.', icon: '📑', durationHours: null },
  { key: 'deep_business_analysis', category: 'analytics', name: 'Deep Business Analysis', description: 'Análise profunda do negócio.', icon: '📊', durationHours: null },
  { key: 'extended_insights', category: 'analytics', name: 'Extended Insights', description: 'Insights estendidos.', icon: '💡', durationHours: null },
]

export const REWARD_CATEGORY_LABEL: Record<string, string> = {
  ai_boost: 'AI Boosts', marketing: 'Marketing', sales: 'Sales', analytics: 'Analytics',
}

const FUNIL = '/dashboard/marketing-ai/conversao'
const ATEND = '/dashboard/marketing-ai/conversao'
const POSTS = '/dashboard/marketing-ai/content'

// Compõe o payload completo. `real` traz contagens reais; o resto é derivado
// de forma determinística por empresa (estável entre reloads).
export function buildProgress(company: Pick<CompanyData, 'id' | 'business_name'>, real: RealSignals): ProgressData {
  const rng = seededRng((company.id || company.business_name || 'demo') + ':progress')
  const iB = (min: number, max: number) => Math.round(min + rng() * (max - min))

  // Sinais compostos: reais onde existem, projetados onde a integração não ligou.
  const leadsNew = iB(6, 20)
  const leadsQualified = iB(3, 10)
  const conversations = iB(3, 12)
  const conversions = iB(0, 3)
  const contentPublished = Math.max(real.postsPublished, iB(1, 6))
  const contentCreated = Math.max(real.posts, contentPublished + iB(1, 4))
  const opportunities = Math.max(real.opportunities, iB(1, 4))
  const campaigns = Math.max(real.campaigns, iB(0, 2))
  const automations = iB(8, 30)

  // "Enquanto você estava fora" — clicável leva ao módulo correspondente.
  const whileAway: WhileAwayItem[] = [
    { key: 'leads_analyzed', icon: '🔍', label: 'leads analisados', count: leadsNew + iB(2, 8), link: FUNIL },
    { key: 'leads_qualified', icon: '🎯', label: 'leads qualificados', count: leadsQualified, link: FUNIL },
    { key: 'content_published', icon: '📱', label: 'conteúdos publicados', count: contentPublished, link: POSTS },
    { key: 'conversations', icon: '💬', label: 'conversas atendidas', count: conversations, link: ATEND },
    { key: 'opportunities', icon: '✨', label: 'oportunidades identificadas', count: opportunities, link: '/dashboard/oportunidades' },
    { key: 'campaigns', icon: '📈', label: 'campanhas otimizadas', count: Math.max(1, campaigns), link: FUNIL },
  ]
  const actionsCount = whileAway.reduce((s, w) => s + w.count, 0) + automations

  // GP acumulado (derivado dos volumes × regra) + GP desde a última visita.
  const totalGp = Math.round(
    leadsNew * 4 * GP.lead_created + leadsQualified * 6 * GP.lead_qualified +
    conversions * 8 * GP.lead_converted + contentPublished * 5 * GP.content_published +
    campaigns * 4 * GP.campaign_optimized + automations * 3 * GP.automation_completed +
    opportunities * 5 * GP.opportunity_found + real.reviewsReplied * GP.review_replied,
  )
  const gpEarnedSinceVisit =
    leadsQualified * GP.lead_qualified + conversions * GP.lead_converted +
    contentPublished * GP.content_published + campaigns * GP.campaign_optimized +
    conversations * GP.conversation_handled + opportunities * GP.opportunity_found

  const { level, next } = levelForGp(totalGp)
  const span = (next ? next.minGp : (level.maxGp ?? totalGp + 1)) - level.minGp
  const into = totalGp - level.minGp
  const levelPct = next ? Math.min(100, Math.round((into / Math.max(span, 1)) * 100)) : 100
  const gpToNext = next ? Math.max(0, next.minGp - totalGp) : 0

  // Saúde: score composto + tendência (determinística).
  const healthTo = iB(58, 92)
  const trend = iB(-12, 16)
  const healthFrom = Math.max(20, Math.min(99, healthTo - trend))
  const declining = trend < 0

  const deltas: Delta[] = [
    { label: 'novos leads', value: `+${leadsNew}`, up: true },
    { label: 'leads qualificados', value: `+${leadsQualified}`, up: true },
    { label: 'oportunidades', value: `+${opportunities}`, up: true },
    { label: 'engajamento', value: `${trend >= 0 ? '+' : ''}${trend}%`, up: trend >= 0 },
  ]

  // Próximo milestone: o reward/level mais próximo.
  const milestone = {
    title: next ? `Subir para ${next.name}` : 'Ultra Intelligence — 24h',
    icon: next ? next.icon : '🔮',
    current: into, target: span, pct: levelPct, remaining: gpToNext,
    nextGoal: `${Math.max(1, Math.ceil(gpToNext / GP.lead_qualified))} leads qualificados`,
  }

  // Business Health metrics.
  const status: HealthStatus = trend >= 6 ? 'growing' : trend >= -3 ? 'stable' : 'at_risk'
  const hm = (label: string, v: string, d: number): HealthMetric => ({ label, value: v, delta: d })
  const health = {
    status,
    metrics: [
      hm('Leads', String(leadsNew), iB(-10, 30)), hm('Qualificados', String(leadsQualified), iB(-5, 25)),
      hm('Conversas', String(conversations), iB(-8, 20)), hm('Conversão', `${iB(3, 22)}%`, iB(-6, 14)),
      hm('Engajamento', `${iB(30, 80)}%`, trend), hm('Conteúdo', String(contentPublished), iB(-5, 40)),
      hm('Campanhas', String(campaigns), iB(0, 30)), hm('Automação', String(automations), iB(5, 40)),
    ],
  }

  const weekly: WeeklyRow[] = [
    { label: 'Leads', pct: iB(-10, 30) }, { label: 'Qualificados', pct: iB(-6, 26) },
    { label: 'Engajamento', pct: trend }, { label: 'Conversões', pct: iB(-8, 20) },
    { label: 'Receita', pct: iB(-6, 24) },
  ]

  // Pins — desbloqueio determinístico por marcos atingidos.
  const unlockedKeys = new Set<string>()
  if (conversions >= 1) unlockedKeys.add('growth_starter')
  if (leadsNew * 4 >= 40) unlockedKeys.add('lead_hunter')
  if (conversions >= 1) unlockedKeys.add('revenue_builder')
  if (automations * 3 >= 60) unlockedKeys.add('automation_master')
  if (level.level >= 3) unlockedKeys.add('ultra_intelligence')
  const streak = iB(2, 9)
  if (streak >= 7) unlockedKeys.add('seven_day_streak')
  if (level.level >= 5) unlockedKeys.add('growth_legend')

  const pins: Pin[] = PIN_DEFS.map(p => ({
    ...p, unlocked: unlockedKeys.has(p.key),
    unlockedAt: unlockedKeys.has(p.key) ? ['hoje', 'ontem', 'há 3 dias', 'esta semana'][iB(0, 3)] : undefined,
  }))

  const rewards: Reward[] = REWARD_DEFS.map(r => {
    const unlocked = r.category === 'ai_boost' ? unlockedKeys.has('ultra_intelligence') && r.key === 'ultra_intelligence'
      : level.level >= (r.category === 'analytics' ? 3 : 2)
    return { ...r, unlocked, active: false }
  })

  const timeline: TimelineItem[] = [
    { when: 'Hoje — 14:32', icon: '🎯', label: 'Lead qualificado', gp: GP.lead_qualified },
    { when: 'Hoje — 13:21', icon: '📱', label: 'Campanha otimizada', gp: GP.campaign_optimized },
    { when: 'Hoje — 11:03', icon: '💰', label: 'Nova conversão', gp: GP.lead_converted },
    { when: 'Ontem — 18:40', icon: '🏆', label: 'Conquista desbloqueada' },
    { when: 'Ontem — 09:12', icon: '✨', label: `${opportunities} oportunidades encontradas`, gp: opportunities * GP.opportunity_found },
  ]

  const nextBestAction = declining
    ? { title: `Criar campanha para recuperar o alcance perdido`, cta: 'Abrir Marketing AI', link: '/dashboard/marketing-ai/content' }
    : leadsQualified > 0
      ? { title: `Enviar proposta para ${Math.min(3, leadsQualified)} leads qualificados`, cta: 'Abrir Funil', link: FUNIL }
      : { title: `Fazer follow-up com ${conversations} conversas`, cta: 'Abrir Atendimento', link: ATEND }

  const recovery = declining ? {
    declining: true,
    metrics: [
      { label: 'Leads', value: `${weekly[0].pct}%` },
      { label: 'Engajamento', value: `${trend}%` },
      { label: 'Conversões', value: `${weekly[3].pct}%` },
    ],
    causes: [
      'Conteúdo teve menor alcance nos últimos dias.',
      'Concorrentes aumentaram a frequência de posts.',
      'Leads estão demorando mais para responder.',
    ],
  } : null

  const lastVisitLabel = real.daysSinceVisit <= 0 ? 'hoje'
    : real.daysSinceVisit === 1 ? 'ontem' : `há ${real.daysSinceVisit} dias`

  // Jornada do negócio: acende conforme o XP passa cada estágio.
  const curIdx = JOURNEY_STAGES.reduce((acc, s, i) => (s.at <= totalGp ? i : acc), 0)
  const journey: JourneyStage[] = JOURNEY_STAGES.map((s, i) => ({
    key: s.key, label: s.label, state: i < curIdx ? 'done' : i === curIdx ? 'current' : 'locked',
  }))

  const reachPct = Math.round(iB(-40, 260)) / 10 // ex.: +18.4% (uma casa decimal)
  const engagementPct = trend
  const firstUnlocked = pins.find(p => p.unlocked && p.unlockedAt === 'hoje')
  const newAchievement = firstUnlocked ? firstUnlocked.name : null

  return {
    lastVisitLabel, whileAway, actionsCount, gpEarnedSinceVisit, totalGp,
    level, nextLevel: next, gpToNext, levelPct, healthFrom, healthTo, deltas,
    milestone, health, weekly, pins, rewards, timeline, nextBestAction, recovery, streak,
    journey, reachPct, engagementPct, contentCreated, newAchievement,
  }
}
