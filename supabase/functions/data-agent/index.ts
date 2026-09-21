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
 * Contract mirrors shared/data-agent/domains.ts (the canonical schema). This
 * first version implements the 3 "rich" domains that need no new data —
 * COMPETITION, CONTENT, HISTORY — plus the Google / Instagram / LinkedIn
 * channel readers. Everything else is reported as an honest gap, never faked.
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
type DomainKey = 'competition' | 'content' | 'history'

const IMPLEMENTED: DomainKey[] = ['competition', 'content', 'history']

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

function readInstagram(company: CompanyRow): ChannelRead {
  const ig = (company.social_data ?? {})['instagram'] as Record<string, unknown> | undefined
  const connected = !!company.instagram_url && !!ig
  return {
    connected,
    note: connected ? undefined : 'Instagram não sincronizado — rode apify-sync.',
    data: connected ? {
      username: ig!.username, followers: ig!.followers,
      avg_likes: ig!.avg_likes, avg_comments: ig!.avg_comments,
      engagement_rate: ig!.engagement_rate,
      recent_posts: (ig!.recent_posts as unknown[] | undefined)?.length ?? 0,
      synced_at: ig!.synced_at,
    } : { instagram_url: company.instagram_url ?? null },
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
    instagram: readInstagram(company),
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

async function gatherDomain(admin: SupaClient, company: CompanyRow, d: DomainKey): Promise<DomainState> {
  if (d === 'competition') return gatherCompetition(admin, company)
  if (d === 'content') return gatherContent(admin, company)
  return gatherHistory(admin, company)
}

// ─── Company row ─────────────────────────────────────────────────────────────
interface CompanyRow {
  id: string; business_name: string; business_type: string | null
  google_rating: number | null; google_review_count: number | null
  google_maps_url: string | null; instagram_url: string | null
  social_data: Record<string, unknown> | null
}
const COMPANY_FIELDS = 'id, business_name, business_type, google_rating, google_review_count, google_maps_url, instagram_url, social_data'

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
