/**
 * data-agent — the Data Agent read API
 * ====================================
 *
 * The persistent intelligence layer's query surface. Hermes (and the
 * dashboard) never touch the 14 raw tables directly — they ask this function
 * one of three questions and get back normalized SIGNALS with evidence and
 * confidence:
 *
 *   { kind: 'state',    domain? }          → current state of a domain (or all)
 *   { kind: 'delta',    since, domain? }   → what changed since a timestamp
 *   { kind: 'evidence', signalKey }        → the raw rows that justify a signal
 *
 * Contract mirrors shared/data-agent/domains.ts (the canonical schema) — kept
 * as a separate, self-contained copy here on purpose: this function runs on
 * Deno and is bundled/deployed in isolation, so it never imports across the
 * frontend/edge-function boundary (same "duplicated on purpose" convention
 * already used elsewhere in this project for image-prompt rules etc).
 *
 * All 9 domains are implemented now. BUSINESS/CUSTOMER/MARKET/DIGITAL/
 * RESOURCES/PERFORMANCE only emit the signals that real data already
 * supports (see domains.ts's own `gaps` field for what's honestly missing —
 * things like structured pricing/margins or transactional LTV/CAC still
 * aren't collected anywhere in the product, so those specific signals stay
 * absent rather than fabricated) — same discipline the original 3 domains
 * (COMPETITION, CONTENT, HISTORY) already followed.
 *
 * Auth: an owner/client JWT (scoped to their own company) OR an internal call
 * carrying CRON_SECRET (Hermes / autonomous cycle), which may pass company_id.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>
type Confidence = 'high' | 'medium' | 'low'
type Relevance = 'high' | 'medium' | 'low'
type DomainKey = 'business' | 'customer' | 'market' | 'competition' | 'digital' | 'content' | 'history' | 'resources' | 'performance'

const IMPLEMENTED: DomainKey[] = ['business', 'customer', 'market', 'competition', 'digital', 'content', 'history', 'resources', 'performance']

/** Canonical signal record — richer than a table row (see domains.ts). */
interface SignalRecord {
  key: string
  domain: DomainKey
  subject_id: string | null
  event_type: string
  observed_at: string
  old_value: unknown
  new_value: unknown
  evidence: string[]
  confidence: Confidence
  business_relevance: Relevance
}

interface DomainState {
  domain: DomainKey
  summary: string
  metrics: Record<string, unknown>
  signals: SignalRecord[]
  sources: string[]
}

const now = () => new Date().toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5)

function sig(p: Partial<SignalRecord> & Pick<SignalRecord, 'key' | 'domain' | 'event_type'>): SignalRecord {
  return {
    subject_id: null, observed_at: now(), old_value: null, new_value: null,
    evidence: [], confidence: 'medium', business_relevance: 'medium', ...p,
  }
}

// ─── Channel readers (Google / Instagram / LinkedIn) ────────────────────────
// Normalized, connection-aware. Never invent data — report connected:false.

interface ChannelRead { connected: boolean; data: Record<string, unknown>; note?: string }

async function readGoogle(admin: SupaClient, company: CompanyRow): Promise<ChannelRead> {
  const { data: reviews } = await admin.from('reviews')
    .select('rating, sentiment, owner_reply, review_date')
    .eq('company_id', company.id).eq('source', 'google')
    .order('review_date', { ascending: false }).limit(200)
  const revs = reviews ?? []
  const connected = company.google_rating != null || revs.length > 0
  return {
    connected,
    note: connected ? undefined : 'Google não conectado — sem rating nem reviews.',
    data: {
      rating: company.google_rating,
      review_count: company.google_review_count ?? revs.length,
      unanswered: revs.filter(r => !r.owner_reply).length,
      negative: revs.filter(r => (r.rating ?? 5) <= 2).length,
      maps_url: company.google_maps_url,
      // Search Console é live via gsc-metrics (OAuth) — não persistido aqui.
      search_console: 'fetch via gsc-metrics quando conectado',
    },
  }
}

// Conectado de verdade = tem instagram_access_token + instagram_user_id
// (mesmo critério que a edge function instagram-performance usa). O
// histórico real fica em instagram_performance_snapshots (NÃO
// marketing_ai_tracking_snapshots — tabela parecida de nome mas vazia/não
// usada; era aí que o bug original estava). company.social_data.instagram
// (cache do apify-sync) só entra como complemento quando existir.
async function readInstagram(admin: SupaClient, company: CompanyRow): Promise<ChannelRead> {
  const connected = !!company.instagram_access_token && !!company.instagram_user_id
  if (!connected) {
    return {
      connected: false,
      note: 'Instagram não conectado — conecte em Configurações → Conexões.',
      data: { instagram_url: company.instagram_url ?? null },
    }
  }
  const { data: snap } = await admin.from('instagram_performance_snapshots')
    .select('followers, reach, impressions, engagement, engagement_rate, captured_for')
    .eq('company_id', company.id).order('captured_for', { ascending: false }).limit(1).maybeSingle()
  const ig = (company.social_data ?? {})['instagram'] as Record<string, unknown> | undefined
  return {
    connected: true,
    note: snap ? undefined : 'Conectado, mas ainda sem snapshot de performance coletado.',
    data: {
      followers: snap?.followers ?? ig?.followers ?? null,
      reach: snap?.reach ?? null, impressions: snap?.impressions ?? null,
      engagement: snap?.engagement ?? null, engagement_rate: snap?.engagement_rate ?? ig?.engagement_rate ?? null,
      synced_at: snap?.captured_for ?? ig?.synced_at ?? null,
    },
  }
}

function readLinkedIn(_company: CompanyRow): ChannelRead {
  // Sem integração de LinkedIn no produto ainda (nenhuma tabela/coluna/função).
  // Slot pronto: quando existir companies.linkedin_url + coletor, preencher aqui.
  return { connected: false, data: {}, note: 'LinkedIn ainda não é integrado — gap conhecido.' }
}

async function readChannels(admin: SupaClient, company: CompanyRow) {
  return {
    google: await readGoogle(admin, company),
    instagram: await readInstagram(admin, company),
    linkedin: readLinkedIn(company),
  }
}

// ─── Domain gatherers ───────────────────────────────────────────────────────

async function gatherCompetition(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const [{ data: comp }, { data: mac }] = await Promise.all([
    admin.from('competitors').select('id, name, rating, review_count, distance_m, price_level').eq('company_id', company.id).order('distance_m', { ascending: true }).limit(30),
    admin.from('marketing_ai_competitors').select('id, name, posting_frequency_days, avg_engagement, followers, last_analyzed_at').eq('company_id', company.id).limit(30),
  ])
  const competitors = comp ?? []
  const social = mac ?? []
  const signals: SignalRecord[] = []

  // reputation_gap — nota / volume de reviews vs. média dos concorrentes
  const rated = competitors.filter(c => c.rating != null)
  if (company.google_rating != null && rated.length) {
    const avg = rated.reduce((s, c) => s + (c.rating as number), 0) / rated.length
    if (company.google_rating < avg - 0.05) {
      signals.push(sig({
        key: 'reputation_gap', domain: 'competition', event_type: 'rating_below_peers',
        old_value: company.google_rating, new_value: Number(avg.toFixed(2)),
        evidence: rated.slice(0, 5).map(c => `${c.name}: ${c.rating}★ (${c.review_count ?? 0} reviews)`),
        confidence: 'high', business_relevance: 'high',
      }))
    }
  }

  // pricing_gap — posição de preço vs. concorrentes com price_level conhecido
  const priced = competitors.filter(c => c.price_level != null)
  if (priced.length >= 2) {
    const avgPrice = priced.reduce((s, c) => s + (c.price_level as number), 0) / priced.length
    signals.push(sig({
      key: 'pricing_gap', domain: 'competition', event_type: 'price_positioning',
      new_value: { peer_avg_price_level: Number(avgPrice.toFixed(1)), sample: priced.length },
      evidence: priced.slice(0, 5).map(c => `${c.name}: nível de preço ${c.price_level}`),
      confidence: 'medium', business_relevance: 'medium',
    }))
  }

  // content_gap — cadência de postagem dos concorrentes (quanto menor, mais postam)
  const cadence = social.filter(c => c.posting_frequency_days != null)
  if (cadence.length) {
    const fastest = cadence.reduce((a, b) => ((a.posting_frequency_days as number) <= (b.posting_frequency_days as number) ? a : b))
    signals.push(sig({
      key: 'content_gap', domain: 'competition', event_type: 'peer_posting_cadence',
      subject_id: fastest.id as string,
      new_value: { fastest: fastest.name, every_days: fastest.posting_frequency_days },
      evidence: cadence.slice(0, 5).map(c => `${c.name}: 1 post a cada ${c.posting_frequency_days}d, engaj. ${c.avg_engagement ?? '—'}`),
      confidence: 'medium', business_relevance: 'medium',
    }))
  }

  return {
    domain: 'competition',
    summary: competitors.length
      ? `${competitors.length} concorrente(s) mapeado(s), ${social.length} com dados sociais. ${signals.length} gap(s) detectado(s).`
      : 'Nenhum concorrente mapeado ainda — rode map-competitors.',
    metrics: {
      competitors_mapped: competitors.length,
      my_rating: company.google_rating,
      peer_avg_rating: rated.length ? Number((rated.reduce((s, c) => s + (c.rating as number), 0) / rated.length).toFixed(2)) : null,
    },
    signals,
    sources: ['competitors', 'marketing_ai_competitors', 'map-competitors', 'monitor-competitor-social'],
  }
}

async function gatherContent(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const [{ data: postRows }, { data: mac }] = await Promise.all([
    admin.from('posts').select('id, status, platform, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(100),
    admin.from('marketing_ai_content').select('id, format, status, performance, created_at, published_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(100),
  ])
  const posts = postRows ?? []
  const content = mac ?? []
  const ig = (company.social_data ?? {})['instagram'] as Record<string, unknown> | undefined
  const recentIg = (ig?.recent_posts as Array<Record<string, unknown>> | undefined) ?? []
  const signals: SignalRecord[] = []

  // no_content — sem post publicado / IG há 7+ dias
  const lastPublished = posts.find(p => p.status === 'publicado')?.created_at
  const lastIg = recentIg.map(p => p.timestamp as string).filter(Boolean).sort().at(-1)
  const lastActivity = [lastPublished, lastIg].filter(Boolean).sort().at(-1)
  if (!lastActivity || new Date(lastActivity) < daysAgo(7)) {
    signals.push(sig({
      key: 'no_content', domain: 'content', event_type: 'stale_publishing',
      old_value: lastActivity ?? null,
      evidence: [lastActivity ? `Última atividade: ${lastActivity}` : 'Nenhuma publicação registrada'],
      confidence: 'high', business_relevance: 'high',
    }))
  }

  // stale_draft — pilha de rascunhos parados esperando aprovação
  const drafts = posts.filter(p => p.status === 'rascunho').length
    + content.filter(c => c.status === 'idea' || c.status === 'draft').length
  if (drafts >= 3) {
    signals.push(sig({
      key: 'stale_draft', domain: 'content', event_type: 'approval_backlog',
      old_value: drafts, evidence: [`${drafts} rascunho(s) aguardando aprovação`],
      confidence: 'high', business_relevance: drafts >= 8 ? 'high' : 'medium',
    }))
  }

  // winning_format — post/formato de maior engajamento
  const engaged = recentIg
    .map(p => ({ likes: (p.likes as number) ?? 0, comments: (p.comments as number) ?? 0, caption: (p.caption as string) ?? '', url: p.url }))
    .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
  if (engaged.length) {
    const top = engaged[0]
    signals.push(sig({
      key: 'winning_format', domain: 'content', event_type: 'top_engagement_post',
      new_value: { likes: top.likes, comments: top.comments },
      evidence: [`"${top.caption.slice(0, 80)}" — ${top.likes} likes / ${top.comments} comentários`, String(top.url ?? '')].filter(Boolean),
      confidence: 'medium', business_relevance: 'medium',
    }))
  }

  return {
    domain: 'content',
    summary: `${posts.length} post(s) internos, ${content.length} em marketing_ai_content, ${recentIg.length} posts recentes no IG. ${signals.length} sinal(is).`,
    metrics: {
      total_posts: posts.length, drafts_pending: drafts,
      last_activity: lastActivity ?? null, ig_recent_posts: recentIg.length,
    },
    signals,
    sources: ['posts', 'marketing_ai_content', 'companies.social_data.instagram', 'content-intelligence', 'generate-posts'],
  }
}

async function gatherHistory(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const [{ data: nodes }, { data: log }, { data: exps }] = await Promise.all([
    admin.from('marketing_ai_brain_nodes').select('id, node_type, title, body, confidence, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(100),
    admin.from('marketing_ai_strategy_log').select('id, recommendation, status, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(50),
    admin.from('marketing_ai_experiments').select('id, hypothesis, winner, status, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(50),
  ])
  const brainNodes = nodes ?? []
  const strategyLog = log ?? []
  const experiments = exps ?? []
  const signals: SignalRecord[] = []

  // already_tried — estratégias implementadas + nós de estratégia
  const tried = [
    ...strategyLog.filter(s => s.status === 'implemented' || s.status === 'approved'),
    ...brainNodes.filter(n => n.node_type === 'successful_strategy' || n.node_type === 'failed_strategy'),
  ]
  if (tried.length) {
    signals.push(sig({
      key: 'already_tried', domain: 'history', event_type: 'prior_strategies',
      old_value: tried.length,
      evidence: tried.slice(0, 6).map(t => ('recommendation' in t ? `${t.recommendation} [${t.status}]` : `${(t as Record<string, unknown>).title}`)),
      confidence: 'high', business_relevance: 'high',
    }))
  }

  // failed_pattern — o que já deu errado (evita repetir)
  const failed = brainNodes.filter(n => n.node_type === 'failed_strategy')
  if (failed.length) {
    signals.push(sig({
      key: 'failed_pattern', domain: 'history', event_type: 'known_failure',
      new_value: failed.length,
      evidence: failed.slice(0, 5).map(f => `${f.title}: ${(f.body as string ?? '').slice(0, 100)}`),
      confidence: failed.some(f => f.confidence === 'high') ? 'high' : 'medium',
      business_relevance: 'high',
    }))
  }

  return {
    domain: 'history',
    summary: `Memória: ${brainNodes.length} nós, ${strategyLog.length} decisões registradas, ${experiments.length} experimento(s).`,
    metrics: {
      brain_nodes: brainNodes.length, decisions_logged: strategyLog.length,
      experiments_done: experiments.filter(e => e.status === 'completed').length,
    },
    signals,
    sources: ['marketing_ai_brain_nodes', 'marketing_ai_strategy_log', 'marketing_ai_experiments'],
  }
}

// BUSINESS — "O que essa empresa é e como ela ganha dinheiro?" Dado
// estruturado de preço/margem/economia unitária ainda não existe em lugar
// nenhum do produto — fica de fora do lugar de inventar.
async function gatherBusiness(_admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const filled = [company.business_description, company.ideal_customer, company.business_dna].filter(Boolean).length
  const signals: SignalRecord[] = []
  if (company.business_description && company.ideal_customer) {
    signals.push(sig({
      key: 'positioning_defined', domain: 'business', event_type: 'profile_complete',
      new_value: { has_description: true, has_ideal_customer: true },
      evidence: [company.business_description!.slice(0, 140)],
      confidence: 'high', business_relevance: 'medium',
    }))
  }
  return {
    domain: 'business',
    summary: filled >= 2
      ? `Perfil do negócio preenchido (${filled}/3 campos-chave).`
      : 'Perfil do negócio ainda incompleto — falta descrição e/ou cliente ideal.',
    metrics: {
      profile_completeness: filled, business_stage: company.business_stage, main_challenges: company.main_challenges,
      margin_headroom: null,
    },
    signals,
    sources: ['companies.business_dna', 'companies.business_description', 'companies.ideal_customer'],
  }
}

// CUSTOMER — "Quem gera valor, e por que compra?"
async function gatherCustomer(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const [{ data: revRows }, { data: leadRows }] = await Promise.all([
    admin.from('reviews').select('id, sentiment, themes, rating, review_date').eq('company_id', company.id).order('review_date', { ascending: false }).limit(200),
    admin.from('leads').select('id, stage, status, last_contact_at, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(200),
  ])
  const reviews = revRows ?? []
  const leads = leadRows ?? []
  const signals: SignalRecord[] = []

  const themeCount = (sentiment: string) => {
    const counts = new Map<string, number>()
    for (const r of reviews) {
      if (r.sentiment !== sentiment) continue
      for (const t of (r.themes as string[] | null) ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }
  const negTop = themeCount('negative')
  if (negTop.length && negTop[0][1] >= 2) {
    signals.push(sig({
      key: 'recurring_objection', domain: 'customer', event_type: 'repeated_negative_theme',
      new_value: negTop[0][0],
      evidence: [`"${negTop[0][0]}" aparece em ${negTop[0][1]} reviews negativos`],
      confidence: 'high', business_relevance: 'high',
    }))
  }
  const posTop = themeCount('positive')
  if (posTop.length && posTop[0][1] >= 2) {
    signals.push(sig({
      key: 'praise_theme', domain: 'customer', event_type: 'repeated_positive_theme',
      new_value: posTop[0][0],
      evidence: [`"${posTop[0][0]}" aparece em ${posTop[0][1]} reviews positivos`],
      confidence: 'high', business_relevance: 'medium',
    }))
  }
  const unanswered = leads.filter(l => l.status !== 'closed' && (!l.last_contact_at || new Date(l.last_contact_at) < daysAgo(2)))
  if (unanswered.length) {
    signals.push(sig({
      key: 'unanswered_leads', domain: 'customer', event_type: 'stale_lead',
      new_value: unanswered.length,
      evidence: unanswered.slice(0, 5).map(l => `lead ${l.id} — estágio ${l.stage}`),
      confidence: 'high', business_relevance: unanswered.length >= 5 ? 'high' : 'medium',
    }))
  }

  return {
    domain: 'customer',
    summary: `${reviews.length} review(s), ${leads.length} lead(s). ${signals.length} sinal(is).`,
    metrics: { review_count: reviews.length, lead_count: leads.length, unanswered_leads: unanswered.length, ltv: null, aov: null },
    signals,
    sources: ['reviews', 'leads', 'lead_messages'],
  }
}

// MARKET — "O que está acontecendo no ambiente externo?"
async function gatherMarket(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const { data: trendRows } = await admin.from('marketing_ai_trends')
    .select('id, title, category, relevance, detected_at').eq('company_id', company.id)
    .order('detected_at', { ascending: false }).limit(50)
  const trends = trendRows ?? []
  const signals: SignalRecord[] = []
  const highRelevance = trends.filter(t => t.relevance === 'high' && new Date(t.detected_at) >= daysAgo(30))
  for (const t of highRelevance.slice(0, 3)) {
    signals.push(sig({
      key: 'emerging_trend', domain: 'market', event_type: 'high_relevance_trend',
      subject_id: t.id, observed_at: t.detected_at,
      new_value: t.title,
      evidence: [`[${t.category ?? 'geral'}] ${t.title}`],
      confidence: 'medium', business_relevance: 'medium',
    }))
  }
  return {
    domain: 'market',
    summary: trends.length ? `${trends.length} tendência(s) detectada(s), ${highRelevance.length} de alta relevância nos últimos 30 dias.` : 'Nenhuma tendência detectada ainda.',
    metrics: { active_trends: highRelevance.length, market_size: null },
    signals,
    sources: ['marketing_ai_trends'],
  }
}

// DIGITAL — "Como a empresa existe digitalmente, e como converte?"
async function gatherDigital(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const [{ data: diagRows }, { data: snapRows }] = await Promise.all([
    admin.from('diagnostics').select('id, pagespeed_mobile, pagespeed_desktop, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(5),
    admin.from('instagram_performance_snapshots').select('reach, captured_for').eq('company_id', company.id).order('captured_for', { ascending: false }).limit(10),
  ])
  const diagnostics = diagRows ?? []
  const snaps = snapRows ?? []
  const signals: SignalRecord[] = []

  if (diagnostics.length >= 2) {
    const [latest, prev] = diagnostics
    const drop = (prev.pagespeed_mobile ?? 0) - (latest.pagespeed_mobile ?? 0)
    if (drop >= 10) {
      signals.push(sig({
        key: 'site_regression', domain: 'digital', event_type: 'pagespeed_drop',
        old_value: prev.pagespeed_mobile, new_value: latest.pagespeed_mobile, observed_at: latest.created_at,
        evidence: [`PageSpeed mobile caiu de ${prev.pagespeed_mobile} pra ${latest.pagespeed_mobile}`],
        confidence: 'high', business_relevance: 'medium',
      }))
    }
  }
  if (snaps.length >= 2) {
    const latest = snaps[0].reach ?? 0
    const older = snaps[snaps.length - 1].reach ?? 0
    if (older > 0) {
      const deltaPct = ((latest - older) / older) * 100
      if (Math.abs(deltaPct) >= 15) {
        signals.push(sig({
          key: 'reach_trend', domain: 'digital', event_type: deltaPct > 0 ? 'reach_up' : 'reach_down',
          old_value: older, new_value: latest,
          evidence: [`Alcance foi de ${Math.round(older)} pra ${Math.round(latest)} (${deltaPct.toFixed(0)}%)`],
          confidence: 'medium', business_relevance: deltaPct < 0 ? 'high' : 'medium',
        }))
      }
    }
  }
  return {
    domain: 'digital',
    summary: `${diagnostics.length} diagnóstico(s) de site, ${snaps.length} snapshot(s) de alcance. ${signals.length} sinal(is).`,
    metrics: { site_health: diagnostics[0]?.pagespeed_mobile ?? null, reach_latest: snaps[0]?.reach ?? null, funnel_conversion: null },
    signals,
    sources: ['diagnostics', 'instagram_performance_snapshots', 'check-links-health'],
  }
}

// RESOURCES — "O que dá pra usar pra executar?"
async function gatherResources(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const [{ data: cfg }, { data: toolRows }, { data: proofRevs }] = await Promise.all([
    admin.from('marketing_ai_config').select('brand_assets').eq('company_id', company.id).maybeSingle(),
    admin.from('marketing_ai_tool_config').select('tool_id, enabled, health').eq('company_id', company.id),
    admin.from('reviews').select('id').eq('company_id', company.id).gte('rating', 4).not('text', 'is', null).limit(5),
  ])
  const tools = toolRows ?? []
  const brandAssets = (cfg?.brand_assets ?? {}) as Record<string, unknown>
  const hasProof = (proofRevs ?? []).length > 0 || Object.keys(brandAssets).length > 0
  const signals: SignalRecord[] = []
  if (hasProof) {
    signals.push(sig({
      key: 'has_proof_assets', domain: 'resources', event_type: 'proof_available',
      new_value: { reviews_with_text: (proofRevs ?? []).length, brand_assets: Object.keys(brandAssets).length },
      evidence: ['Reviews positivos com texto e/ou brand_assets disponíveis pra usar em campanha'],
      confidence: 'medium', business_relevance: 'medium',
    }))
  }
  const disconnected = tools.filter(t => t.enabled && t.health && t.health !== 'ok')
  if (disconnected.length) {
    signals.push(sig({
      key: 'tool_disconnected', domain: 'resources', event_type: 'tool_unhealthy',
      new_value: disconnected.length,
      evidence: disconnected.map(t => `${t.tool_id}: ${t.health}`),
      confidence: 'high', business_relevance: 'high',
    }))
  }
  return {
    domain: 'resources',
    summary: `${tools.filter(t => t.enabled).length} ferramenta(s) ativa(s), ${disconnected.length} com problema. ${hasProof ? 'Tem prova social disponível.' : 'Sem prova social/criativos catalogados ainda.'}`,
    metrics: { connected_tools: tools.filter(t => t.enabled && t.health === 'ok').length, creative_inventory: null },
    signals,
    sources: ['marketing_ai_config.brand_assets', 'marketing_ai_tool_config', 'reviews'],
  }
}

// PERFORMANCE — "Que resultado de negócio está sendo produzido AGORA?"
// KPI comercial real (receita/CAC/ROAS/LTV) ainda não é coletado em lugar
// nenhum — fica como gap honesto, igual o próprio domains.ts já documenta.
async function gatherPerformance(admin: SupaClient, company: CompanyRow): Promise<DomainState> {
  const { data: snapRows } = await admin.from('instagram_performance_snapshots')
    .select('engagement_rate, captured_for').eq('company_id', company.id).order('captured_for', { ascending: false }).limit(10)
  const snaps = snapRows ?? []
  const signals: SignalRecord[] = []
  if (snaps.length >= 2) {
    const latest = snaps[0].engagement_rate ?? 0
    const older = snaps[snaps.length - 1].engagement_rate ?? 0
    if (older > 0) {
      const deltaPct = ((latest - older) / older) * 100
      if (deltaPct <= -15) {
        signals.push(sig({
          key: 'engagement_drop', domain: 'performance', event_type: 'engagement_down',
          old_value: older, new_value: latest,
          evidence: [`Engajamento caiu de ${older.toFixed(2)}% pra ${latest.toFixed(2)}%`],
          confidence: 'high', business_relevance: 'high',
        }))
      }
    }
  }
  return {
    domain: 'performance',
    summary: snaps.length ? `Engajamento atual: ${(snaps[0].engagement_rate ?? 0).toFixed(2)}%.` : 'Sem dado de engajamento ainda.',
    metrics: { engagement_now: snaps[0]?.engagement_rate ?? null, revenue: null, cac: null, roas: null },
    signals,
    sources: ['instagram_performance_snapshots', 'marketing_ai_campaigns', 'marketing_ai_reports'],
  }
}

async function gatherDomain(admin: SupaClient, company: CompanyRow, d: DomainKey): Promise<DomainState> {
  if (d === 'business') return gatherBusiness(admin, company)
  if (d === 'customer') return gatherCustomer(admin, company)
  if (d === 'market') return gatherMarket(admin, company)
  if (d === 'competition') return gatherCompetition(admin, company)
  if (d === 'digital') return gatherDigital(admin, company)
  if (d === 'content') return gatherContent(admin, company)
  if (d === 'resources') return gatherResources(admin, company)
  if (d === 'performance') return gatherPerformance(admin, company)
  return gatherHistory(admin, company)
}

// ─── Company row ─────────────────────────────────────────────────────────────
interface CompanyRow {
  id: string; business_name: string; business_type: string | null
  google_rating: number | null; google_review_count: number | null
  google_maps_url: string | null; instagram_url: string | null
  instagram_user_id: string | null; instagram_access_token: string | null
  social_data: Record<string, unknown> | null
  business_dna: Record<string, unknown> | null; business_description: string | null
  ideal_customer: string | null; business_stage: string | null; main_challenges: string | null
}
const COMPANY_FIELDS = 'id, business_name, business_type, google_rating, google_review_count, google_maps_url, instagram_url, instagram_user_id, instagram_access_token, social_data, business_dna, business_description, ideal_customer, business_stage, main_challenges'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const cronSecret = Deno.env.get('CRON_SECRET')
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isInternal = !!cronSecret && body.cron_secret === cronSecret

    // Resolve company: internal caller passes company_id; a user is scoped to their own.
    let company: CompanyRow | null = null
    if (isInternal && body.company_id) {
      const { data } = await admin.from('companies').select(COMPANY_FIELDS).eq('id', body.company_id).maybeSingle()
      company = data as CompanyRow | null
    } else {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Não autorizado' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: { user }, error } = await userClient.auth.getUser()
      if (error || !user) return json({ error: 'Não autorizado' }, 401)
      const { data } = await admin.from('companies').select(COMPANY_FIELDS).eq('user_id', user.id).maybeSingle()
      company = data as CompanyRow | null
    }
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

    const kind = (body.kind as string) ?? 'state'
    const requested = body.domain as DomainKey | undefined
    const domains = requested ? [requested].filter((d): d is DomainKey => IMPLEMENTED.includes(d)) : IMPLEMENTED
    if (requested && !domains.length) {
      return json({ error: `Domínio "${requested}" ainda não implementado. Disponíveis: ${IMPLEMENTED.join(', ')}` }, 400)
    }

    const states = await Promise.all(domains.map(d => gatherDomain(admin, company!, d)))

    if (kind === 'state') {
      return json({ ok: true, company: company.business_name, channels: await readChannels(admin, company), domains: states, generated_at: now() })
    }

    if (kind === 'delta') {
      const since = body.since ? new Date(body.since as string) : daysAgo(7)
      const changed = states.map(s => ({ ...s, signals: s.signals.filter(sg => new Date(sg.observed_at) >= since) }))
      return json({ ok: true, since: since.toISOString(), domains: changed, generated_at: now() })
    }

    if (kind === 'evidence') {
      const signalKey = body.signalKey as string | undefined
      if (!signalKey) return json({ error: 'signalKey é obrigatório para evidence' }, 400)
      const matches = states.flatMap(s => s.signals).filter(sg => sg.key === signalKey)
      return json({ ok: true, signalKey, matches, generated_at: now() })
    }

    return json({ error: `kind inválido: ${kind}. Use state | delta | evidence.` }, 400)
  } catch (err) {
    console.error('data-agent error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
