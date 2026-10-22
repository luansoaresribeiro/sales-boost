import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { scanInstagram, fetchThumbs, contentFacts, type IgSignals } from './igSignals.ts'
import { auditLead, computeLeadScore, contentFlags, type ScoringWeights, type WeakPresence } from './audit.ts'
import { buildSearches, runBatch, SCAN_BUDGET_MS, MAX_CHAIN, type ScanQueue, type CandidateTask, type ProcessResult } from './scan.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SupaClient = ReturnType<typeof createClient>

// Só a taxonomia de categorias (rótulos) — as palavras-chave de busca de
// verdade vêm de prospect_search_keywords (configurável, sem precisar mexer
// aqui pra adicionar uma nova). Usado só como fallback "busca tudo" quando o
// dono não restringiu nenhuma categoria em Configurações.
const ALL_BUSINESS_TYPES = ['Imobiliárias', 'Corretores de imóveis', 'Aluguel por temporada (Airbnb)']

interface IcpConfig {
  minRating: number
  maxRating: number
  minReviews: number
  maxReviews: number
  requireActiveInstagram: boolean
  requirePhone: boolean
  excludeChains: boolean
  confidenceThreshold: number
}


interface PlaceCandidate {
  place_id: string
  name: string
  business_status?: string
  types?: string[]
}

interface PlaceDetails {
  place_id: string
  name: string
  rating?: number
  user_ratings_total?: number
  website?: string
  formatted_phone_number?: string
  formatted_address?: string
  geometry?: { location: { lat: number; lng: number } }
  business_status?: string
  price_level?: number
  reviews?: { time: number }[]
  types?: string[]
}

// Busca até 3 páginas (o máximo que o Google Places permite) — até 60
// resultados por busca em vez de 20, pra não esgotar o pool tão rápido. O
// token de próxima página só fica válido ~2s depois de emitido.
async function textSearch(apiKey: string, keyword: string, city: string, pages = 3): Promise<PlaceCandidate[]> {
  const query = encodeURIComponent(`${keyword} em ${city}`)
  const results: PlaceCandidate[] = []
  let pageToken: string | undefined
  for (let page = 0; page < pages; page++) {
    const url = pageToken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${apiKey}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=pt-BR&key=${apiKey}`
    try {
      const res = await fetch(url)
      const data = await res.json() as { status: string; results?: PlaceCandidate[]; next_page_token?: string }
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places textsearch error:', data.status)
        break
      }
      results.push(...(data.results ?? []).filter(r => r.business_status !== 'CLOSED_PERMANENTLY'))
      if (!data.next_page_token) break
      pageToken = data.next_page_token
      await new Promise(r => setTimeout(r, 2000))
    } catch (e) {
      console.error('textSearch exception:', e)
      break
    }
  }
  return results
}

async function getPlaceDetails(apiKey: string, placeId: string): Promise<PlaceDetails | null> {
  const fields = 'place_id,name,rating,user_ratings_total,website,formatted_phone_number,formatted_address,geometry,business_status,price_level,reviews,types'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&reviews_sort=newest&language=pt-BR&key=${apiKey}`
  try {
    const res = await fetch(url)
    const data = await res.json() as { status: string; result?: PlaceDetails }
    if (data.status !== 'OK' || !data.result) return null
    return data.result
  } catch (e) {
    console.error('getPlaceDetails exception:', e)
    return null
  }
}

function daysSinceLatestReview(reviews?: { time: number }[]): number | null {
  if (!reviews || reviews.length === 0) return null
  const latest = Math.max(...reviews.map(r => r.time))
  return Math.floor((Date.now() / 1000 - latest) / 86400)
}

function daysSinceIso(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

interface SiteSignals { instagram_url: string | null; facebook_url: string | null; has_whatsapp: boolean; has_online_ordering: boolean }

// Leitura simples do HTML da home — sem custo de API, só um fetch com timeout
// curto. Não é um crawler completo, é só pra achar links de redes sociais,
// WhatsApp e sinais de pedido online na própria página inicial.
async function scanWebsite(websiteUrl: string): Promise<SiteSignals> {
  const empty: SiteSignals = { instagram_url: null, facebook_url: null, has_whatsapp: false, has_online_ordering: false }
  try {
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalesBoostProspector/1.0)' } })
    clearTimeout(timeout)
    if (!res.ok) return empty
    const html = await res.text()
    const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/)
    const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/)
    const hasWhatsapp = /wa\.me\/|api\.whatsapp\.com/.test(html)
    const hasOnlineOrdering = /ifood\.com\.br|rappi\.com|ubereats\.com|goomer\.app|anota\.ai|cardápio digital|pedido online|peça (?:agora|já)|adicionar ao carrinho|comprar agora|loja virtual|nuvemshop|lojaintegrada|tray\.com\.br|vtex|woocommerce|shopify/i.test(html)
    return { instagram_url: igMatch?.[0] ?? null, facebook_url: fbMatch?.[0] ?? null, has_whatsapp: hasWhatsapp, has_online_ordering: hasOnlineOrdering }
  } catch {
    return empty
  }
}


// Pesos padrão: metade POTENCIAL (até 50) + metade OPORTUNIDADE (até 50) —
// ICP do dono 2026-10-15 (ver audit.ts). Config salva sobrepõe.
const DEFAULT_WEIGHTS: ScoringWeights = {
  rating_in_range: 15, reviews_in_range: 10, recent_review: 5, has_phone: 5, independent_business: 10, has_audience: 5,
  no_recent_video: 20, low_engagement: 15, poor_quality: 15, weak_presence_opportunity: 25,
  likely_chain_penalty: -40, instagram_active: 0, has_website: 0, no_online_ordering: 0,
}

async function sendOwnerAlert(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch { /* non-fatal */ }
}

interface QueryStats {
  city: string; businessType: string; keyword: string
  found: number; rejected: number; accepted: number; scores: number[]; searchTimeMs: number
}

// Registro "running" sem sinal de vida (heartbeat) há 10 min = morreu no meio.
const STALE_SCAN_MS = 10 * 60_000

type Keys = { googleKey: string; apifyToken: string; anthropicKey: string; telegramToken?: string }

// O banco só aceita running/done/error no status — "parada pelo dono" vira done + esta nota.
const STOPPED_NOTE = 'Parada por você'

// O banco devolve no máx. 1000 linhas por leitura — e a lista de "já analisados"
// passou disso (2026-10-15: 1236), o que fazia a busca reanalisar (e pagar de novo)
// quem já tinha visto. Lê em páginas até acabar.
async function allPlaceIds(admin: SupaClient, table: string): Promise<string[]> {
  const out: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select('google_place_id').not('google_place_id', 'is', null).order('google_place_id').range(from, from + 999)
    if (error) throw new Error(`Falha ao ler ${table}: ${error.message}`)
    out.push(...((data ?? []) as { google_place_id: string }[]).map(r => r.google_place_id))
    if (!data || data.length < 1000) return out
  }
}

// Uma chamada da varredura (ver scan.ts). resume=true continua a fila salva.
async function runScan(admin: SupaClient, logId: string, keys: Keys, resume: boolean): Promise<{ found: number; done: boolean; error?: string }> {
  const deadline = Date.now() + SCAN_BUDGET_MS
  const { data: settingsRow } = await admin.from('prospect_settings')
    .select('cities, search_areas, business_types, max_per_night, min_rating, max_rating, min_reviews, max_reviews, require_active_instagram, require_phone, exclude_chains, telegram_chat_id, icp_custom_instructions, scoring_weights, icp_confidence_threshold')
    .eq('id', true).maybeSingle()
  const ownerChatId = settingsRow?.telegram_chat_id as string | null
  const customInstructions = (settingsRow?.icp_custom_instructions as string | null) || null
  const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, ...((settingsRow?.scoring_weights as Partial<ScoringWeights>) ?? {}) }
  const cities = (settingsRow?.cities ?? []) as string[]
  const areas = ((settingsRow?.search_areas ?? []) as string[]).map(a => a.trim()).filter(Boolean)
  const businessTypes = ((settingsRow?.business_types ?? []) as string[])
  // max_per_night = máximo de leads aceitos por varredura (somando todas as chamadas).
  const cap = (settingsRow?.max_per_night as number) ?? 10
  const icp: IcpConfig = {
    minRating: (settingsRow?.min_rating as number) ?? 4.0,
    maxRating: (settingsRow?.max_rating as number) ?? 4.8,
    minReviews: (settingsRow?.min_reviews as number) ?? 50,
    maxReviews: (settingsRow?.max_reviews as number) ?? 500,
    requireActiveInstagram: (settingsRow?.require_active_instagram as boolean) ?? false,
    requirePhone: (settingsRow?.require_phone as boolean) ?? true,
    excludeChains: (settingsRow?.exclude_chains as boolean) ?? true,
    confidenceThreshold: (settingsRow?.icp_confidence_threshold as number) ?? 60,
  }
  if (cities.length === 0) {
    return { found: 0, done: true, error: 'Configure ao menos uma região (cidade) que você atende antes de rodar a busca.' }
  }
  const typesToSearch = businessTypes.length > 0 ? businessTypes : ALL_BUSINESS_TYPES

  const [{ data: logRow }, existingProspects, existingCompanies, checkedPlaces, { data: keywordRows }] = await Promise.all([
    admin.from('prospect_scan_log').select('status, queue, found_count, candidates_processed').eq('id', logId).single(),
    allPlaceIds(admin, 'sales_prospects'),
    allPlaceIds(admin, 'companies'),
    allPlaceIds(admin, 'prospect_checked_places'),
    admin.from('prospect_search_keywords').select('business_type, keyword').eq('active', true).in('business_type', typesToSearch),
  ])
  if (logRow?.status !== 'running') return { found: logRow?.found_count ?? 0, done: true }
  const known = new Set<string>([...existingProspects, ...existingCompanies, ...checkedPlaces])
  let queue: ScanQueue
  if (resume && logRow?.queue) {
    queue = logRow.queue as ScanQueue
  } else {
    const keywordsByType = new Map<string, string[]>()
    for (const row of (keywordRows ?? []) as { business_type: string; keyword: string }[]) {
      const list = keywordsByType.get(row.business_type) ?? []
      list.push(row.keyword)
      keywordsByType.set(row.business_type, list)
    }
    queue = { searches: buildSearches(cities, areas, typesToSearch, keywordsByType), candidates: [] }
  }
  for (const c of queue.candidates) known.add(c.place_id)

  const queryStats = new Map<string, QueryStats>()
  const statOf = (c: CandidateTask) => queryStats.get(`${c.city}|${c.businessType}|${c.keyword}`)

  const logRejection = async (c: CandidateTask, reason: string, icpConfidence?: number, leadScore?: number) => {
    const stat = statOf(c)
    if (stat) { stat.rejected++; if (leadScore != null) stat.scores.push(leadScore) }
    await admin.from('prospect_candidate_log').insert({
      scan_log_id: logId, google_place_id: c.place_id, business_name: c.name,
      search_keyword: c.keyword, business_type: c.businessType, city: c.city, status: 'rejected',
      rejection_reason: reason, icp_confidence: icpConfidence ?? null, lead_score: leadScore ?? null,
    })
  }

  const processCandidate = async (c: CandidateTask): Promise<ProcessResult> => {
    // Marca como checado já de cara — pass ou fail, nunca mais reprocessa.
    await admin.from('prospect_checked_places').upsert({ google_place_id: c.place_id }, { onConflict: 'google_place_id' })
    const details = await getPlaceDetails(keys.googleKey, c.place_id)
    if (!details) { await logRejection(c, 'Não foi possível carregar detalhes no Google Places'); return 'rejected' }
    if (details.rating == null || details.rating < icp.minRating || details.rating > icp.maxRating) {
      await logRejection(c, `Nota fora da faixa (${icp.minRating}-${icp.maxRating}): ${details.rating ?? 'sem nota'}`); return 'rejected'
    }
    if (details.user_ratings_total == null || details.user_ratings_total < icp.minReviews || details.user_ratings_total > icp.maxReviews) {
      await logRejection(c, `Nº de avaliações fora da faixa (${icp.minReviews}-${icp.maxReviews}): ${details.user_ratings_total ?? 0}`); return 'rejected'
    }
    if (icp.requirePhone && !details.formatted_phone_number) { await logRejection(c, 'Sem telefone público disponível'); return 'rejected' }
    if (!details.formatted_address) { await logRejection(c, 'Sem endereço físico'); return 'rejected' }

    // Corretor muitas vezes cadastra o próprio Instagram como "site" no Google.
    const igAsSite = details.website?.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/)?.[0] ?? null
    const signals: SiteSignals = igAsSite
      ? { instagram_url: igAsSite, facebook_url: null, has_whatsapp: false, has_online_ordering: false }
      : details.website
      ? await scanWebsite(details.website)
      : { instagram_url: null, facebook_url: null, has_whatsapp: false, has_online_ordering: false }
    if (icp.requireActiveInstagram && !signals.instagram_url) { await logRejection(c, 'Sem Instagram vinculado no site'); return 'rejected' }

    const ig: IgSignals | null = signals.instagram_url ? await scanInstagram(keys.apifyToken, signals.instagram_url) : null
    const igStale = !!ig?.lastPostDate && daysSinceIso(ig.lastPostDate) > 120
    if (icp.requireActiveInstagram && igStale) { await logRejection(c, 'Instagram parece abandonado (sem post há mais de 120 dias)'); return 'rejected' }
    const weakPresence: WeakPresence = !signals.instagram_url ? 'sem_instagram' : igStale ? 'instagram_parado' : null
    // Capas dos últimos posts pra IA dar nota de produção (só se o perfil está vivo).
    const thumbs = ig && !igStale ? await fetchThumbs(ig.thumbs) : []

    const daysSinceLastReview = daysSinceLatestReview(details.reviews)
    const audit = await auditLead(keys.anthropicKey, {
      name: details.name, city: c.city, targetBusinessType: c.businessType, googleTypes: details.types ?? [],
      rating: details.rating ?? null, reviewCount: details.user_ratings_total ?? null,
      hasWebsite: !!details.website, hasInstagram: !!signals.instagram_url, hasFacebook: !!signals.facebook_url,
      hasWhatsapp: signals.has_whatsapp, priceLevel: details.price_level ?? null, daysSinceLastReview,
      ig, thumbs, customInstructions, weakPresence,
    })
    if (!audit) { await logRejection(c, 'Falha ao gerar diagnóstico com IA'); return 'rejected' }
    if (audit.icp_confidence < icp.confidenceThreshold) {
      await logRejection(c, `Confiança de ICP baixa (${audit.icp_confidence}%): ${audit.icp_reasons.join('; ')}`, audit.icp_confidence); return 'rejected'
    }
    if (icp.excludeChains && audit.is_likely_chain) { await logRejection(c, 'Parece ser rede/franquia grande', audit.icp_confidence); return 'rejected' }
    const flags = contentFlags(weakPresence ? null : ig, audit.content_quality)
    // Instagram já forte (vídeo recente + bom engajamento + boa produção) = pouca dor.
    if (!weakPresence && flags.strong) {
      await logRejection(c, `Instagram já forte (vídeo recente, engajamento ${ig?.engagementRate ?? '—'}%, produção ${audit.content_quality}/10) — menos dor`, audit.icp_confidence); return 'rejected'
    }

    const { score: leadScore, breakdown } = computeLeadScore({
      ratingInRange: true, reviewsInRange: true, hasPhone: !!details.formatted_phone_number,
      isLikelyChain: audit.is_likely_chain, daysSinceLastReview, weakPresence, flags,
    }, weights)

    await admin.from('sales_prospects').upsert({
      google_place_id: details.place_id, business_name: details.name, city: c.city,
      address: details.formatted_address ?? null, phone: details.formatted_phone_number ?? null,
      website_url: details.website ?? null, instagram_url: signals.instagram_url, facebook_url: signals.facebook_url,
      has_whatsapp: signals.has_whatsapp, has_online_ordering: signals.has_online_ordering,
      google_rating: details.rating ?? null, google_review_count: details.user_ratings_total ?? null,
      days_since_last_review: daysSinceLastReview, price_level: details.price_level ?? null,
      is_likely_chain: audit.is_likely_chain,
      lat: details.geometry?.location.lat ?? null, lng: details.geometry?.location.lng ?? null,
      lead_score: leadScore, icp_confidence: audit.icp_confidence, score_breakdown: breakdown,
      ai_summary: audit.ai_summary, ai_cold_call_notes: audit.ai_cold_call_notes,
      digital_presence: weakPresence ?? 'ativa',
      ig_followers: ig?.followers ?? null, ig_last_video_days: weakPresence ? null : ig?.lastVideoDays ?? null,
      ig_engagement_rate: weakPresence ? null : ig?.engagementRate ?? null,
      content_quality: audit.content_quality, content_issues: audit.content_issues,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'google_place_id' })

    const stat = statOf(c)
    if (stat) { stat.accepted++; stat.scores.push(leadScore) }
    await admin.from('prospect_candidate_log').insert({
      scan_log_id: logId, google_place_id: details.place_id, business_name: details.name,
      search_keyword: c.keyword, business_type: c.businessType, city: c.city, status: 'accepted',
      lead_score: leadScore, icp_confidence: audit.icp_confidence, score_breakdown: breakdown,
    })
    if (leadScore >= 80 && keys.telegramToken && ownerChatId) {
      await sendOwnerAlert(keys.telegramToken, ownerChatId,
        `🎯 Lead quente encontrado!\n${details.name} (nota ${details.rating ?? '—'}⭐, ${details.user_ratings_total ?? 0} avaliações)\nScore: ${leadScore}/100\n${ig && !weakPresence ? contentFacts(ig) + '\n' : ''}${audit.ai_summary}`)
    }
    return 'accepted'
  }

  let processedTotal = (logRow?.candidates_processed as number) ?? 0
  const result = await runBatch({
    queue, known, deadline, cap, foundSoFar: (logRow?.found_count as number) ?? 0,
    search: async t => {
      const where = t.area ? `${t.area}, ${t.city}` : t.city
      const t0 = Date.now()
      const results = await textSearch(keys.googleKey, t.keyword, where, t.area ? 1 : 3)
      const kw = t.area ? `${t.keyword} (${t.area})` : t.keyword
      queryStats.set(`${t.city}|${t.businessType}|${kw}`, { city: t.city, businessType: t.businessType, keyword: kw, found: results.length, rejected: 0, accepted: 0, scores: [], searchTimeMs: Date.now() - t0 })
      return results
    },
    process: c => processCandidate(c).catch(async e => { console.error('find-sales-leads: candidato falhou', c.place_id, e); return 'error' as ProcessResult }),
    onProgress: async (delta, found) => {
      processedTotal += delta
      await admin.from('prospect_scan_log').update({ candidates_processed: processedTotal, found_count: found, heartbeat_at: new Date().toISOString() }).eq('id', logId)
    },
  })

  await admin.from('prospect_scan_log').update({
    queue, found_count: result.found, candidates_processed: processedTotal,
    candidates_total: processedTotal + queue.candidates.length, heartbeat_at: new Date().toISOString(),
  }).eq('id', logId)

  const queryLogRows = Array.from(queryStats.values()).map(s => ({
    scan_log_id: logId, city: s.city, business_type: s.businessType, keyword: s.keyword,
    companies_found: s.found, companies_rejected: s.rejected, companies_accepted: s.accepted,
    avg_lead_score: s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null,
    search_time_ms: s.searchTimeMs,
  }))
  if (queryLogRows.length > 0) await admin.from('prospect_search_query_log').insert(queryLogRows)

  const more = (queue.searches.length > 0 || queue.candidates.length > 0) && result.found < cap
  return { found: result.found, done: !more }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    const apifyToken = Deno.env.get('APIFY_TOKEN')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    if (!googleKey || !apifyToken || !anthropicKey) {
      return json({ error: 'GOOGLE_PLACES_API_KEY, APIFY_TOKEN ou ANTHROPIC_API_KEY não configurados.' }, 503)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = cronSecretEnv && body.cron_secret === cronSecretEnv
    const keys: Keys = { googleKey, apifyToken, anthropicKey, telegramToken }

    // Uma chamada da varredura; se sobrou fila, agenda a próxima (continue_scan).
    const runChain = async (logId: string, resume: boolean) => {
      try {
        const result = await runScan(admin, logId, keys, resume)
        const { data: cur } = await admin.from('prospect_scan_log').select('status, chain').eq('id', logId).single()
        const chain = ((cur?.chain as number) ?? 0) + 1
        if (cur?.status !== 'running') return // parada pelo dono
        if (!result.done && !result.error && chain < MAX_CHAIN && cronSecretEnv) {
          await admin.from('prospect_scan_log').update({ chain, heartbeat_at: new Date().toISOString() }).eq('id', logId)
          const r = await fetch(`${supabaseUrl}/functions/v1/find-sales-leads`, {
            method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ cron_secret: cronSecretEnv, continue_scan: logId }),
            signal: AbortSignal.timeout(20_000),
          }).catch(e => { console.error('continue_scan falhou', e); return null })
          await r?.body?.cancel()
          if (r?.ok) return
        }
        await admin.from('prospect_scan_log').update({
          status: result.error ? 'error' : 'done', found_count: result.found, error_message: result.error ?? null,
          finished_at: new Date().toISOString(), queue: null,
        }).eq('id', logId)
      } catch (e) {
        await admin.from('prospect_scan_log').update({
          status: 'error', error_message: String(e), finished_at: new Date().toISOString(),
        }).eq('id', logId)
      }
    }

    // Continuação de uma varredura em andamento (chamada interna).
    if (isCron && typeof body.continue_scan === 'string') {
      // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
      EdgeRuntime.waitUntil(runChain(body.continue_scan, true))
      return json({ ok: true, continued: body.continue_scan }, 202)
    }

    if (!isCron) {
      // Modo manual — só o dono pode disparar.
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: { user }, error: userErr } = await userClient.auth.getUser()
      if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

      const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
      if (roleRow?.role !== 'owner') return json({ error: 'Forbidden' }, 403)

      // Botão "Parar busca": a próxima chamada da fila vê o status e para.
      if (body.action === 'stop') {
        await admin.from('prospect_scan_log').update({ status: 'done', error_message: STOPPED_NOTE, finished_at: new Date().toISOString(), queue: null }).eq('status', 'running')
        return json({ ok: true, stopped: true })
      }
    }

    // Busca antiga cortada pelo limite de tempo nunca chegou a fechar o registro.
    await admin.from('prospect_scan_log').update({
      status: 'error', error_message: 'Interrompida: a função ficou sem tempo no meio da busca.', finished_at: new Date().toISOString(),
    }).eq('status', 'running')
      // sem sinal de vida há 10 min (registro antigo, sem heartbeat: conta o início)
      .or(`heartbeat_at.lt.${new Date(Date.now() - STALE_SCAN_MS).toISOString()},and(heartbeat_at.is.null,started_at.lt.${new Date(Date.now() - STALE_SCAN_MS).toISOString()})`)
    // Já tem uma varredura viva: não abre outra em paralelo (gastaria em dobro).
    const { data: alive } = await admin.from('prospect_scan_log').select('id').eq('status', 'running').limit(1).maybeSingle()
    if (alive) return json({ ok: true, scan_id: alive.id, already_running: true })

    const { data: logRow, error: logErr } = await admin.from('prospect_scan_log').insert({ status: 'running', heartbeat_at: new Date().toISOString() }).select('id').single()
    if (logErr || !logRow) return json({ error: 'Erro ao iniciar a varredura.' }, 500)
    const logId = logRow.id as string

    // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
    EdgeRuntime.waitUntil(runChain(logId, false))

    return json({ ok: true, scan_id: logId })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
