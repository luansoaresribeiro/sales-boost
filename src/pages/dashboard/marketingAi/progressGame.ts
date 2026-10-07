// ── Business Progress Game — motor de progresso ──────────────────────────
// Compõe o payload da experiência SÓ com sinais REAIS (tabelas posts,
// opportunities, reviews, campaigns, leads, progress_events,
// instagram_performance_snapshots). Métrica sem fonte real = null e a tela
// mostra <BlurredValue/>. NUNCA sorteio/projeção (regra 5; ver docs/PITFALLS.md).
import { supabase } from '../../../lib/supabase'
import { mapStage, relTime } from './salesReal'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type HealthStatus = 'growing' | 'stable' | 'at_risk'

// Sinais reais lidos do banco. null = desconhecido (consulta falhou / sem fonte).
export interface RealSignals {
  posts: number | null
  postsPublished: number | null
  opportunities: number | null
  reviewsReplied: number | null
  campaigns: number | null
  leads: number | null
  leadsQualified: number | null
  leadsSales: number | null
  leadsSinceVisit: number | null
  totalGp: number | null          // soma de progress_events.gp
  gpSinceVisit: number | null
  eventsSinceVisit: number | null // eventos de trabalho desde a última visita
  workEvents: number | null       // eventos de trabalho no total
  recentEvents: { event_type: string; gp: number; created_at: string }[]
  streak: number | null
  engagementRate: number | null   // último snapshot do Instagram (%)
  daysSinceVisit: number
}

export interface WhileAwayItem { key: string; icon: string; label: string; count: number | null; link?: string }
export interface Delta { label: string; value: string | null; up: boolean }
export interface LevelInfo { level: number; key: string; name: string; icon: string; minGp: number; maxGp: number | null; identity: string; color: string }
export interface JourneyStage { key: string; label: string; state: 'done' | 'current' | 'locked' }
export interface Pin { key: string; name: string; description: string; icon: string; rarity: Rarity; unlocked: boolean; unlockedAt?: string; rewardKey?: string }
export interface Reward { key: string; category: string; name: string; description: string; icon: string; durationHours: number | null; unlocked: boolean; active: boolean; expiresLabel?: string }
export interface TimelineItem { when: string; icon: string; label: string; gp?: number }
export interface HealthMetric { label: string; value: string | null; delta: number | null }
export interface WeeklyRow { label: string; pct: number | null }

export interface ProgressData {
  lastVisitLabel: string
  whileAway: WhileAwayItem[]
  actionsCount: number | null
  gpEarnedSinceVisit: number | null
  totalGp: number | null
  level: LevelInfo
  nextLevel: LevelInfo | null
  gpToNext: number
  levelPct: number
  healthFrom: number | null
  healthTo: number | null
  deltas: Delta[]
  milestone: { title: string; icon: string; current: number; target: number; pct: number; remaining: number; nextGoal: string }
  health: { status: HealthStatus | null; metrics: HealthMetric[] }
  weekly: WeeklyRow[]
  pins: Pin[]
  rewards: Reward[]
  timeline: TimelineItem[]
  nextBestAction: { title: string; cta: string; link: string }
  recovery: { declining: boolean; metrics: { label: string; value: string }[]; causes: string[] } | null
  streak: number | null
  journey: JourneyStage[]
  reachPct: number | null
  engagementPct: number | null
  contentCreated: number | null
  newAchievement: string | null
  hasRealData: boolean // false = nenhum dado real de trabalho ainda
}

// ── Smart Popup: escolhe a variante mais relevante ao abrir a plataforma ────
export type PopupVariant = 'levelup' | 'while_away' | 'results' | 'almost' | 'streak' | 'status'

export function choosePopup(d: ProgressData, ctx: { daysSinceVisit: number; lastSeenLeague: string | null; lastStreakSeen: number }): PopupVariant {
  // Sem dado real de trabalho: só o status honesto (nada de celebrar).
  if (!d.hasRealData) return 'status'
  // Subiu de liga (por XP real) desde a última vez que viu → celebra.
  if (ctx.lastSeenLeague && ctx.lastSeenLeague !== d.level.key) {
    const order = LEVELS.map(l => l.key)
    if (order.indexOf(d.level.key) > order.indexOf(ctx.lastSeenLeague)) return 'levelup'
  }
  if (d.levelPct >= 90 && d.nextLevel) return 'almost'
  if (ctx.daysSinceVisit >= 2 && (d.actionsCount ?? 0) > 0) return 'while_away'
  if ((d.gpEarnedSinceVisit ?? 0) >= 50) return 'results'
  if ((d.streak ?? 0) >= 7 && d.streak !== ctx.lastStreakSeen) return 'streak'
  return 'status'
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

// Rótulos dos eventos reais do ledger (progress_events) — espelha progress_gp_rules.
const EVENT_LABEL: Record<string, { icon: string; label: string }> = {
  lead_created: { icon: '🔍', label: 'Novo lead capturado' }, lead_qualified: { icon: '🎯', label: 'Lead qualificado' },
  lead_converted: { icon: '💰', label: 'Conversão' }, lead_recovered: { icon: '♻️', label: 'Lead antigo recuperado' },
  conversation_handled: { icon: '💬', label: 'Conversa atendida' }, followup_sent: { icon: '📨', label: 'Follow-up enviado' },
  content_created: { icon: '📝', label: 'Conteúdo criado' }, content_published: { icon: '📱', label: 'Conteúdo publicado' },
  campaign_created: { icon: '📈', label: 'Campanha criada' }, campaign_optimized: { icon: '📈', label: 'Campanha otimizada' },
  opportunity_found: { icon: '✨', label: 'Oportunidade identificada' }, review_replied: { icon: '⭐', label: 'Avaliação respondida' },
  competitor_scanned: { icon: '🕵️', label: 'Concorrente monitorado' }, automation_completed: { icon: '⚡', label: 'Automação concluída' },
  trial_started: { icon: '🚀', label: 'Teste iniciado' }, trial_completed: { icon: '🏁', label: 'Teste concluído' },
  discovery_revealed: { icon: '🔓', label: 'Descoberta revelada' }, reward_activated: { icon: '🎁', label: 'Recompensa ativada' },
  goal_completed: { icon: '🎯', label: 'Meta atingida' }, first_customer: { icon: '🏆', label: 'Primeiro cliente conquistado' },
}
// Eventos que não são "trabalho da IA" (não contam como dado real suficiente).
const NON_WORK_EVENTS = new Set(['trial_started', 'trial_completed', 'reward_activated'])

// Lê os sinais REAIS do banco. Qualquer consulta que falhar vira null
// (desconhecido) — nunca 0 inventado nem sorteio. `sinceIso` = última visita.
export async function fetchRealSignals(companyId: string, sinceIso: string | null, daysSinceVisit: number): Promise<RealSignals> {
  const since = sinceIso ?? new Date(Date.now() - 7 * 86400000).toISOString()
  const cnt = async (q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> => {
    try { const { count, error } = await q; return error ? null : (count ?? 0) } catch { return null }
  }
  const head = (t: string) => supabase.from(t).select('id', { count: 'exact', head: true }).eq('company_id', companyId)
  const [posts, postsPublished, opportunities, reviewsReplied, campaigns, leadsRes, evRes, snapRes] = await Promise.all([
    cnt(head('posts')), cnt(head('posts').eq('status', 'publicado')), cnt(head('opportunities')),
    cnt(head('reviews').not('owner_reply', 'is', null)), cnt(head('campaigns')),
    supabase.from('leads').select('stage, created_at').eq('company_id', companyId),
    supabase.from('progress_events').select('event_type, gp, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1000),
    supabase.from('instagram_performance_snapshots').select('engagement_rate').eq('company_id', companyId).order('captured_for', { ascending: false }).limit(1).maybeSingle(),
  ])
  const leadRows = leadsRes.error ? null : (leadsRes.data ?? [])
  const events = evRes.error ? null : (evRes.data ?? [])
  const sinceMs = new Date(since).getTime()
  const evSince = events?.filter(e => new Date(e.created_at).getTime() >= sinceMs) ?? null

  // Streak real: dias consecutivos (até hoje/ontem) com algum evento de trabalho.
  let streak: number | null = null
  if (events) {
    const days = new Set(events.filter(e => !NON_WORK_EVENTS.has(e.event_type)).map(e => e.created_at.slice(0, 10)))
    const d = new Date(); let n = 0
    if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1)
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1) }
    streak = n
  }
  return {
    posts, postsPublished, opportunities, reviewsReplied, campaigns,
    leads: leadRows ? leadRows.length : null,
    leadsQualified: leadRows ? leadRows.filter(l => mapStage(l.stage) === 'qualificado').length : null,
    leadsSales: leadRows ? leadRows.filter(l => mapStage(l.stage) === 'venda').length : null,
    leadsSinceVisit: leadRows ? leadRows.filter(l => new Date(l.created_at).getTime() >= sinceMs).length : null,
    totalGp: events ? events.reduce((s, e) => s + (e.gp ?? 0), 0) : null,
    gpSinceVisit: evSince ? evSince.reduce((s, e) => s + (e.gp ?? 0), 0) : null,
    eventsSinceVisit: evSince ? evSince.filter(e => !NON_WORK_EVENTS.has(e.event_type)).length : null,
    workEvents: events ? events.filter(e => !NON_WORK_EVENTS.has(e.event_type)).length : null,
    recentEvents: events ? events.slice(0, 5).map(e => ({ event_type: e.event_type, gp: e.gp ?? 0, created_at: e.created_at })) : [],
    streak,
    engagementRate: snapRes.error ? null : (snapRes.data?.engagement_rate ?? null),
    daysSinceVisit,
  }
}

const n0 = (v: number | null) => v ?? 0

// Compõe o payload. REGRA (docs/PITFALLS.md): nada aqui é sorteado ou
// projetado. Métrica sem fonte real = null (a tela mostra BlurredValue).
export function buildProgress(real: RealSignals): ProgressData {
  const totalGp = real.totalGp
  const gpEarnedSinceVisit = real.gpSinceVisit
  const gp0 = n0(totalGp)
  const { level, next } = levelForGp(gp0)
  const span = (next ? next.minGp : (level.maxGp ?? gp0 + 1)) - level.minGp
  const into = gp0 - level.minGp
  const levelPct = next ? Math.min(100, Math.round((into / Math.max(span, 1)) * 100)) : 100
  const gpToNext = next ? Math.max(0, next.minGp - gp0) : 0

  const whileAway: WhileAwayItem[] = [
    { key: 'leads', icon: '🔍', label: 'leads no funil', count: real.leads, link: FUNIL },
    { key: 'leads_qualified', icon: '🎯', label: 'leads qualificados', count: real.leadsQualified, link: FUNIL },
    { key: 'content_published', icon: '📱', label: 'conteúdos publicados', count: real.postsPublished, link: POSTS },
    { key: 'conversations', icon: '💬', label: 'conversas atendidas', count: null, link: ATEND },
    { key: 'opportunities', icon: '✨', label: 'oportunidades identificadas', count: real.opportunities, link: '/dashboard/oportunidades' },
    { key: 'campaigns', icon: '📈', label: 'campanhas criadas', count: real.campaigns, link: FUNIL },
  ]
  const actionsCount = real.eventsSinceVisit

  const deltas: Delta[] = [
    { label: 'novos leads', value: real.leadsSinceVisit == null ? null : `+${real.leadsSinceVisit}`, up: true },
    { label: 'leads qualificados', value: real.leadsQualified == null ? null : String(real.leadsQualified), up: true },
    { label: 'oportunidades', value: real.opportunities == null ? null : String(real.opportunities), up: true },
    { label: 'engajamento', value: real.engagementRate == null ? null : `${real.engagementRate}%`, up: true },
  ]

  const milestone = {
    title: next ? `Subir para ${next.name}` : 'Ultra Intelligence — 24h',
    icon: next ? next.icon : '🔮',
    current: into, target: span, pct: levelPct, remaining: gpToNext,
    nextGoal: `${Math.max(1, Math.ceil(gpToNext / GP.lead_qualified))} leads qualificados`,
  }

  // Business Health: sem fonte real de "score"/tendência → status e score null.
  const conv = real.leads && real.leadsSales != null ? Number(((real.leadsSales / real.leads) * 100).toFixed(1)) : null
  const hm = (label: string, v: number | string | null): HealthMetric => ({ label, value: v == null ? null : String(v), delta: null })
  const health = {
    status: null as HealthStatus | null,
    metrics: [
      hm('Leads', real.leads), hm('Qualificados', real.leadsQualified), hm('Conversas', null),
      hm('Conversão', conv == null ? null : `${conv}%`), hm('Engajamento', real.engagementRate == null ? null : `${real.engagementRate}%`),
      hm('Conteúdo', real.postsPublished), hm('Campanhas', real.campaigns), hm('Automação', null),
    ],
  }
  // Semanal: sem série histórica real ainda → todas null (barras embaçadas).
  const weekly: WeeklyRow[] = ['Leads', 'Qualificados', 'Engajamento', 'Conversões', 'Receita'].map(label => ({ label, pct: null }))

  const streak = real.streak
  const unlockedKeys = new Set<string>()
  if (n0(real.leadsSales) >= 1) { unlockedKeys.add('growth_starter'); unlockedKeys.add('revenue_builder') }
  if (n0(real.leads) >= 100) unlockedKeys.add('lead_hunter')
  if (n0(real.workEvents) >= 100) unlockedKeys.add('automation_master')
  if (level.level >= 3) unlockedKeys.add('ultra_intelligence')
  if (n0(streak) >= 7) unlockedKeys.add('seven_day_streak')
  if (level.level >= 5) unlockedKeys.add('growth_legend')
  const pins: Pin[] = PIN_DEFS.map(p => ({ ...p, unlocked: unlockedKeys.has(p.key) }))

  const rewards: Reward[] = REWARD_DEFS.map(r => {
    const unlocked = r.category === 'ai_boost' ? unlockedKeys.has('ultra_intelligence') && r.key === 'ultra_intelligence'
      : level.level >= (r.category === 'analytics' ? 3 : 2)
    return { ...r, unlocked, active: false }
  })

  const timeline: TimelineItem[] = real.recentEvents.map(e => {
    const meta = EVENT_LABEL[e.event_type] ?? { icon: '✅', label: e.event_type }
    return { when: relTime(e.created_at), icon: meta.icon, label: meta.label, gp: e.gp > 0 ? e.gp : undefined }
  })

  const q = n0(real.leadsQualified)
  const nextBestAction = q > 0
    ? { title: `Enviar proposta para ${Math.min(3, q)} ${Math.min(3, q) === 1 ? 'lead qualificado' : 'leads qualificados'}`, cta: 'Abrir Funil', link: FUNIL }
    : n0(real.leads) > 0
      ? { title: 'Fazer follow-up com os leads do funil', cta: 'Abrir Funil', link: FUNIL }
      : { title: 'Criar o primeiro conteúdo com o Marketing AI', cta: 'Abrir Marketing AI', link: POSTS }

  const lastVisitLabel = real.daysSinceVisit <= 0 ? 'hoje'
    : real.daysSinceVisit === 1 ? 'ontem' : `há ${real.daysSinceVisit} dias`

  const curIdx = JOURNEY_STAGES.reduce((acc, s, i) => (s.at <= gp0 ? i : acc), 0)
  const journey: JourneyStage[] = JOURNEY_STAGES.map((s, i) => ({
    key: s.key, label: s.label, state: i < curIdx ? 'done' : i === curIdx ? 'current' : 'locked',
  }))

  const hasRealData = [real.posts, real.leads, real.opportunities, real.campaigns, real.reviewsReplied, real.workEvents].some(v => (v ?? 0) > 0)

  return {
    lastVisitLabel, whileAway, actionsCount, gpEarnedSinceVisit, totalGp,
    level, nextLevel: next, gpToNext, levelPct, healthFrom: null, healthTo: null, deltas,
    milestone, health, weekly, pins, rewards, timeline, nextBestAction, recovery: null, streak,
    journey, reachPct: null, engagementPct: real.engagementRate, contentCreated: real.posts,
    newAchievement: null, hasRealData,
  }
}
