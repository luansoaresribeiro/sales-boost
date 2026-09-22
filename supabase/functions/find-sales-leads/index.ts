import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SupaClient = ReturnType<typeof createClient>

// Só a taxonomia de categorias (rótulos) — as palavras-chave de busca de
// verdade vêm de prospect_search_keywords (configurável, sem precisar mexer
// aqui pra adicionar uma nova). Usado só como fallback "busca tudo" quando o
// dono não restringiu nenhuma categoria em Configurações.
const ALL_BUSINESS_TYPES = ['Moda & Vestuário', 'Beleza & Cosméticos', 'Acessórios', 'Produtos de Consumo', 'Alimentos & Bebidas', 'E-commerce', 'Serviços Profissionais']

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

interface ScoringWeights {
  rating_in_range: number
  reviews_in_range: number
  instagram_active: number
  has_website: number
  no_online_ordering: number
  has_phone: number
  independent_business: number
  recent_review: number
  likely_chain_penalty: number
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
async function textSearch(apiKey: string, keyword: string, city: string): Promise<PlaceCandidate[]> {
  const query = encodeURIComponent(`${keyword} em ${city}`)
  const results: PlaceCandidate[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 3; page++) {
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

interface ApifyProfile { followersCount?: number; postsCount?: number; latestPosts?: { likesCount?: number; commentsCount?: number; timestamp?: string }[] }

async function scanInstagram(apifyToken: string, instagramUrl: string): Promise<{ followers: number; posts: number; avgEngagement: number; lastPostDate: string | null } | null> {
  try {
    const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=60&memory=256`
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directUrls: [instagramUrl.replace(/\/$/, '')], resultsType: 'details', resultsLimit: 6 }),
    })
    if (!res.ok) return null
    const items = await res.json() as ApifyProfile[]
    const profile = items[0]
    if (!profile) return null
    const posts = profile.latestPosts ?? []
    const avgEngagement = posts.length
      ? Math.round(posts.reduce((s, p) => s + (p.likesCount ?? 0) + (p.commentsCount ?? 0), 0) / posts.length)
      : 0
    return { followers: profile.followersCount ?? 0, posts: profile.postsCount ?? 0, avgEngagement, lastPostDate: posts[0]?.timestamp ?? null }
  } catch (e) {
    console.error('scanInstagram exception:', e)
    return null
  }
}

// ── Parte 2: validação de ICP + Parte 3: dados pra pontuação, numa única
// chamada de IA (mantém o padrão consciente de custo já usado aqui — uma
// chamada por candidato, não várias). A IA só decide o que precisa de
// julgamento qualitativo (é rede? bate com a categoria de verdade?); o score
// numérico é calculado depois, em código, com pesos configuráveis — não é a
// IA que "inventa" o número.
interface LeadAudit {
  ai_summary: string
  ai_cold_call_notes: string
  is_likely_chain: boolean
  icp_confidence: number
  icp_reasons: string[]
}

async function auditLead(anthropicKey: string, input: {
  name: string; city: string; targetBusinessType: string; googleTypes: string[]
  rating: number | null; reviewCount: number | null
  hasWebsite: boolean; hasInstagram: boolean; hasFacebook: boolean; hasWhatsapp: boolean
  hasOnlineOrdering: boolean; priceLevel: number | null; daysSinceLastReview: number | null
  igFollowers: number | null; igAvgEngagement: number | null; igLastPostDate: string | null
  customInstructions: string | null
}): Promise<LeadAudit | null> {
  const prompt = `Você é um analista de vendas do Sales Boost, uma plataforma de marketing/vendas automatizado por IA pra pequenos negócios locais no Brasil.

Avalie este negócio, com base nos sinais reais coletados (nunca invente dado que não foi passado):

Nome: ${input.name}
Cidade: ${input.city}
Categoria que a busca tinha como alvo: ${input.targetBusinessType}
Categorias que o próprio Google atribuiu a esse lugar: ${input.googleTypes.length ? input.googleTypes.join(', ') : 'não informado'}
Nota Google: ${input.rating ?? 'sem nota'} (${input.reviewCount ?? 0} avaliações)
Avaliação mais recente no Google: ${input.daysSinceLastReview != null ? `há ${input.daysSinceLastReview} dias` : 'desconhecido'}
Tem site: ${input.hasWebsite ? 'sim' : 'não'}
Pedido online no site (ifood/rappi/cardápio digital): ${input.hasOnlineOrdering ? 'sim' : 'não detectado'}
Faixa de preço no Google (0=barato a 4=alto padrão): ${input.priceLevel ?? 'não informado'}
Tem Instagram: ${input.hasInstagram ? 'sim' : 'não'}${input.igFollowers != null ? ` (${input.igFollowers} seguidores, engajamento médio ${input.igAvgEngagement}, último post: ${input.igLastPostDate ?? 'desconhecido'})` : ''}
Tem Facebook: ${input.hasFacebook ? 'sim' : 'não'}
Tem WhatsApp visível no site: ${input.hasWhatsapp ? 'sim' : 'não'}

O Sales Boost é um sistema de aquisição de clientes com IA: cria demanda nas redes sociais e cuida de toda a jornada, da atração até a venda. O cliente ideal (ICP principal) é uma marca própria ou e-commerce tocado pelo dono — moda, beleza, acessórios, produtos de consumo ou alimentos & bebidas — pequeno ou médio porte, decisão rápida do dono/fundador, com Instagram ativo e um produto com potencial real de crescimento, mas com conteúdo inconsistente, marketing manual e sem um sistema de aquisição integrado. ICP secundário: serviços profissionais tocados pelo dono (escritórios de advocacia, contabilidade) que precisam de geração de demanda pelas redes e um fluxo constante de clientes novos. O produto NÃO serve bem redes/franquias grandes nem negócios sem dono/decisor acessível — o ideal é um negócio independente, de dono único ou poucas unidades.
${input.customInstructions ? `\nInstrução adicional do dono do Sales Boost sobre o que priorizar ao pontuar leads:\n"${input.customInstructions}"\n` : ''}
Responda com um JSON válido, sem markdown, com exatamente estes campos:
- "icp_confidence" (0-100): o quanto você tem certeza de que esse lugar É DE VERDADE um "${input.targetBusinessType}" (use as categorias do Google e o nome pra decidir — a busca por palavra-chave às vezes traz resultado errado, tipo uma loja de produtos de barbearia aparecendo numa busca por "barbearia"). 100 = com certeza é. 0 = quase certeza que não é.
- "icp_reasons": lista curta (2-4 itens) de frases curtas em português explicando essa confiança (ex: "Categoria do Google confirma: barbearia", "Nome sugere fornecedor, não prestador de serviço").
- "is_likely_chain": true/false — só pelo nome e endereço, parece uma unidade de rede/franquia grande (marca nacional/internacional conhecida) ou um negócio independente/local? Estimativa, não certeza.
- "ai_summary": 2-3 frases em português explicando o diagnóstico de presença digital (pontos fortes e fracos).
- "ai_cold_call_notes": 2-3 frases práticas para quem for ligar/abordar esse negócio.

{"icp_confidence": 0, "icp_reasons": ["..."], "is_likely_chain": false, "ai_summary": "...", "ai_cold_call_notes": "..."}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : text)
    return {
      ai_summary: String(parsed.ai_summary ?? ''),
      ai_cold_call_notes: String(parsed.ai_cold_call_notes ?? ''),
      is_likely_chain: !!parsed.is_likely_chain,
      icp_confidence: Math.round(Math.max(0, Math.min(100, parsed.icp_confidence ?? 0))),
      icp_reasons: Array.isArray(parsed.icp_reasons) ? parsed.icp_reasons.map(String) : [],
    }
  } catch (e) {
    console.error('auditLead exception:', e)
    return null
  }
}

// ── Parte 3: pontuação modular — calculada em código com pesos
// configuráveis (prospect_settings.scoring_weights), não decidida pela IA.
// Fácil de ajustar sem mexer no prompt nem reimplantar a lógica de IA.
interface ScoreInput {
  ratingInRange: boolean
  reviewsInRange: boolean
  instagramActive: boolean
  hasWebsite: boolean
  hasOnlineOrdering: boolean
  hasPhone: boolean
  isLikelyChain: boolean
  daysSinceLastReview: number | null
}

interface ScoreBreakdownItem { label: string; points: number; passed: boolean }

function computeLeadScore(input: ScoreInput, weights: ScoringWeights): { score: number; breakdown: ScoreBreakdownItem[] } {
  const breakdown: ScoreBreakdownItem[] = [
    { label: 'Nota do Google dentro da faixa configurada', points: weights.rating_in_range, passed: input.ratingInRange },
    { label: 'Volume de avaliações dentro da faixa configurada', points: weights.reviews_in_range, passed: input.reviewsInRange },
    { label: 'Instagram ativo', points: weights.instagram_active, passed: input.instagramActive },
    { label: 'Site próprio configurado', points: weights.has_website, passed: input.hasWebsite },
    { label: 'Sem pedido online (oportunidade clara pro Sales Boost)', points: weights.no_online_ordering, passed: !input.hasOnlineOrdering },
    { label: 'Telefone público disponível', points: weights.has_phone, passed: input.hasPhone },
    { label: 'Parece negócio independente (não rede/franquia)', points: weights.independent_business, passed: !input.isLikelyChain },
    { label: 'Avaliação recente no Google (últimos 60 dias)', points: weights.recent_review, passed: input.daysSinceLastReview != null && input.daysSinceLastReview <= 60 },
  ]
  if (input.isLikelyChain && weights.likely_chain_penalty < 0) {
    breakdown.push({ label: 'Penalidade: parece rede/franquia grande', points: weights.likely_chain_penalty, passed: true })
  }
  const raw = breakdown.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0)
  const score = Math.max(0, Math.min(100, Math.round(raw)))
  return { score, breakdown }
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

async function runScan(admin: SupaClient, logId: string, keys: { googleKey: string; apifyToken: string; anthropicKey: string; telegramToken?: string }): Promise<{ found: number; error?: string }> {
  const { data: settingsRow } = await admin.from('prospect_settings')
    .select('cities, business_types, max_per_night, min_rating, max_rating, min_reviews, max_reviews, require_active_instagram, require_phone, exclude_chains, telegram_chat_id, icp_custom_instructions, scoring_weights, icp_confidence_threshold')
    .eq('id', true).maybeSingle()
  const ownerChatId = settingsRow?.telegram_chat_id as string | null
  const customInstructions = (settingsRow?.icp_custom_instructions as string | null) || null
  const weights = (settingsRow?.scoring_weights as ScoringWeights) ?? {
    rating_in_range: 30, reviews_in_range: 15, instagram_active: 15, has_website: 10,
    no_online_ordering: 10, has_phone: 10, independent_business: 10, recent_review: 5, likely_chain_penalty: -40,
  }
  const cities = (settingsRow?.cities ?? []) as string[]
  const businessTypes = ((settingsRow?.business_types ?? []) as string[])
  const maxPerNight = (settingsRow?.max_per_night as number) ?? 10
  const icp: IcpConfig = {
    minRating: (settingsRow?.min_rating as number) ?? 4.0,
    maxRating: (settingsRow?.max_rating as number) ?? 4.8,
    minReviews: (settingsRow?.min_reviews as number) ?? 50,
    maxReviews: (settingsRow?.max_reviews as number) ?? 500,
    requireActiveInstagram: (settingsRow?.require_active_instagram as boolean) ?? true,
    requirePhone: (settingsRow?.require_phone as boolean) ?? true,
    excludeChains: (settingsRow?.exclude_chains as boolean) ?? true,
    confidenceThreshold: (settingsRow?.icp_confidence_threshold as number) ?? 60,
  }

  if (cities.length === 0) {
    return { found: 0, error: 'Configure ao menos uma região (cidade) que você atende antes de rodar a busca.' }
  }
  // Sem tipo escolhido = busca ampla em todas as categorias, o ICP já filtra o que não serve.
  const typesToSearch = businessTypes.length > 0 ? businessTypes : ALL_BUSINESS_TYPES

  const [{ data: existingProspects }, { data: existingCompanies }, { data: checkedPlaces }, { data: keywordRows }] = await Promise.all([
    admin.from('sales_prospects').select('google_place_id'),
    admin.from('companies').select('google_place_id').not('google_place_id', 'is', null),
    admin.from('prospect_checked_places').select('google_place_id'),
    admin.from('prospect_search_keywords').select('business_type, keyword').eq('active', true).in('business_type', typesToSearch),
  ])
  const known = new Set<string>([
    ...(existingProspects ?? []).map(p => p.google_place_id as string),
    ...(existingCompanies ?? []).map(c => c.google_place_id as string),
    ...(checkedPlaces ?? []).map(c => c.google_place_id as string),
  ])

  const keywordsByType = new Map<string, string[]>()
  for (const row of (keywordRows ?? []) as { business_type: string; keyword: string }[]) {
    const list = keywordsByType.get(row.business_type) ?? []
    list.push(row.keyword)
    keywordsByType.set(row.business_type, list)
  }

  const candidates: { place: PlaceCandidate; city: string; businessType: string; keyword: string }[] = []
  const seen = new Set<string>()
  const queryStats = new Map<string, QueryStats>()

  for (const city of cities) {
    for (const businessType of typesToSearch) {
      const keywordList = keywordsByType.get(businessType) ?? []
      for (const keyword of keywordList) {
        const statKey = `${city}|${businessType}|${keyword}`
        const t0 = Date.now()
        const results = await textSearch(keys.googleKey, keyword, city)
        const searchTimeMs = Date.now() - t0
        queryStats.set(statKey, { city, businessType, keyword, found: results.length, rejected: 0, accepted: 0, scores: [], searchTimeMs })

        for (const r of results) {
          if (seen.has(r.place_id) || known.has(r.place_id)) continue
          seen.add(r.place_id)
          candidates.push({ place: r, city, businessType, keyword })
        }
        if (candidates.length >= maxPerNight * 4) break // margem — boa parte dos candidatos vai cair no filtro de ICP
      }
    }
  }

  await admin.from('prospect_scan_log').update({ candidates_total: candidates.length }).eq('id', logId)

  const logRejection = async (candidate: PlaceCandidate, city: string, businessType: string, keyword: string, reason: string, icpConfidence?: number, leadScore?: number) => {
    const statKey = `${city}|${businessType}|${keyword}`
    const stat = queryStats.get(statKey)
    if (stat) { stat.rejected++; if (leadScore != null) stat.scores.push(leadScore) }
    await admin.from('prospect_candidate_log').insert({
      scan_log_id: logId, google_place_id: candidate.place_id, business_name: candidate.name,
      search_keyword: keyword, business_type: businessType, city, status: 'rejected',
      rejection_reason: reason, icp_confidence: icpConfidence ?? null, lead_score: leadScore ?? null,
    })
  }

  let found = 0
  let processed = 0

  for (const { place: candidate, city, businessType, keyword } of candidates) {
    if (found >= maxPerNight) break
    processed++
    await admin.from('prospect_scan_log').update({ candidates_processed: processed }).eq('id', logId)
    try {
      // Marca como checado já de cara — pass ou fail, nunca mais reprocessa
      // esse lugar (senão o Google devolve os mesmos resultados toda busca
      // e o scan fica reavaliando pra sempre os mesmos negócios rejeitados).
      await admin.from('prospect_checked_places').upsert({ google_place_id: candidate.place_id }, { onConflict: 'google_place_id' })

      const details = await getPlaceDetails(keys.googleKey, candidate.place_id)
      if (!details) { await logRejection(candidate, city, businessType, keyword, 'Não foi possível carregar detalhes no Google Places'); continue }

      // Must have: nota dentro da faixa
      if (details.rating == null || details.rating < icp.minRating || details.rating > icp.maxRating) {
        await logRejection(candidate, city, businessType, keyword, `Nota fora da faixa (${icp.minRating}-${icp.maxRating}): ${details.rating ?? 'sem nota'}`)
        continue
      }
      // Must have: volume de avaliações dentro da faixa
      if (details.user_ratings_total == null || details.user_ratings_total < icp.minReviews || details.user_ratings_total > icp.maxReviews) {
        await logRejection(candidate, city, businessType, keyword, `Nº de avaliações fora da faixa (${icp.minReviews}-${icp.maxReviews}): ${details.user_ratings_total ?? 0}`)
        continue
      }
      // Must have: telefone disponível
      if (icp.requirePhone && !details.formatted_phone_number) {
        await logRejection(candidate, city, businessType, keyword, 'Sem telefone público disponível')
        continue
      }
      // Must have: pelo menos um endereço físico (localização real)
      if (!details.formatted_address) {
        await logRejection(candidate, city, businessType, keyword, 'Sem endereço físico')
        continue
      }

      const signals: SiteSignals = details.website
        ? await scanWebsite(details.website)
        : { instagram_url: null, facebook_url: null, has_whatsapp: false, has_online_ordering: false }

      // Must have: Instagram ativo — sem link nenhum já reprova antes de gastar Apify.
      if (icp.requireActiveInstagram && !signals.instagram_url) {
        await logRejection(candidate, city, businessType, keyword, 'Sem Instagram vinculado no site')
        continue
      }

      const igStats = signals.instagram_url ? await scanInstagram(keys.apifyToken, signals.instagram_url) : null
      if (icp.requireActiveInstagram && igStats?.lastPostDate && daysSinceIso(igStats.lastPostDate) > 120) {
        await logRejection(candidate, city, businessType, keyword, 'Instagram parece abandonado (sem post há mais de 120 dias)')
        continue
      }

      const daysSinceLastReview = daysSinceLatestReview(details.reviews)

      const audit = await auditLead(keys.anthropicKey, {
        name: details.name, city, targetBusinessType: businessType, googleTypes: details.types ?? [],
        rating: details.rating ?? null, reviewCount: details.user_ratings_total ?? null,
        hasWebsite: !!details.website, hasInstagram: !!signals.instagram_url, hasFacebook: !!signals.facebook_url,
        hasWhatsapp: signals.has_whatsapp, hasOnlineOrdering: signals.has_online_ordering,
        priceLevel: details.price_level ?? null, daysSinceLastReview,
        igFollowers: igStats?.followers ?? null, igAvgEngagement: igStats?.avgEngagement ?? null, igLastPostDate: igStats?.lastPostDate ?? null,
        customInstructions,
      })
      if (!audit) { await logRejection(candidate, city, businessType, keyword, 'Falha ao gerar diagnóstico com IA'); continue }

      // Parte 2 — validação de ICP: se a confiança de que isso É de verdade
      // a categoria buscada for baixa, rejeita mesmo que os filtros duros
      // tenham passado (ex: busca por "barbearia" achou uma loja de produtos
      // de barbearia, não um prestador de serviço).
      if (audit.icp_confidence < icp.confidenceThreshold) {
        await logRejection(candidate, city, businessType, keyword,
          `Confiança de ICP baixa (${audit.icp_confidence}%): ${audit.icp_reasons.join('; ')}`, audit.icp_confidence)
        continue
      }

      // Must have: independente, não rede grande — só se o dono exigir isso
      // (senão vira só penalidade de score, calculada abaixo).
      if (icp.excludeChains && audit.is_likely_chain) {
        await logRejection(candidate, city, businessType, keyword, 'Parece ser rede/franquia grande', audit.icp_confidence)
        continue
      }

      const { score: leadScore, breakdown } = computeLeadScore({
        ratingInRange: true, // já passou no must-have acima
        reviewsInRange: true,
        instagramActive: !!igStats,
        hasWebsite: !!details.website,
        hasOnlineOrdering: signals.has_online_ordering,
        hasPhone: !!details.formatted_phone_number,
        isLikelyChain: audit.is_likely_chain,
        daysSinceLastReview,
      }, weights)

      await admin.from('sales_prospects').upsert({
        google_place_id: details.place_id,
        business_name: details.name,
        city,
        address: details.formatted_address ?? null,
        phone: details.formatted_phone_number ?? null,
        website_url: details.website ?? null,
        instagram_url: signals.instagram_url,
        facebook_url: signals.facebook_url,
        has_whatsapp: signals.has_whatsapp,
        has_online_ordering: signals.has_online_ordering,
        google_rating: details.rating ?? null,
        google_review_count: details.user_ratings_total ?? null,
        days_since_last_review: daysSinceLastReview,
        price_level: details.price_level ?? null,
        is_likely_chain: audit.is_likely_chain,
        lat: details.geometry?.location.lat ?? null,
        lng: details.geometry?.location.lng ?? null,
        lead_score: leadScore,
        icp_confidence: audit.icp_confidence,
        score_breakdown: breakdown,
        ai_summary: audit.ai_summary,
        ai_cold_call_notes: audit.ai_cold_call_notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'google_place_id' })

      const statKey = `${city}|${businessType}|${keyword}`
      const stat = queryStats.get(statKey)
      if (stat) { stat.accepted++; stat.scores.push(leadScore) }

      await admin.from('prospect_candidate_log').insert({
        scan_log_id: logId, google_place_id: details.place_id, business_name: details.name,
        search_keyword: keyword, business_type: businessType, city, status: 'accepted',
        lead_score: leadScore, icp_confidence: audit.icp_confidence, score_breakdown: breakdown,
      })

      found++

      if (leadScore >= 80 && keys.telegramToken && ownerChatId) {
        await sendOwnerAlert(keys.telegramToken, ownerChatId,
          `🎯 Lead quente encontrado!\n${details.name} (nota ${details.rating ?? '—'}⭐, ${details.user_ratings_total ?? 0} avaliações)\nScore: ${leadScore}/100 (confiança ICP: ${audit.icp_confidence}%)\n${audit.ai_summary}`)
      }
    } catch (e) {
      console.error(`find-sales-leads: candidate ${candidate.place_id} error:`, e)
    }
  }

  // Parte 5 — grava as estatísticas por busca individual (query), pro Modo Debug.
  const queryLogRows = Array.from(queryStats.values()).map(s => ({
    scan_log_id: logId, city: s.city, business_type: s.businessType, keyword: s.keyword,
    companies_found: s.found, companies_rejected: s.rejected, companies_accepted: s.accepted,
    avg_lead_score: s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null,
    search_time_ms: s.searchTimeMs,
  }))
  if (queryLogRows.length > 0) {
    await admin.from('prospect_search_query_log').insert(queryLogRows)
  }

  return { found }
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

    if (!isCron) {
      // Modo manual — só o dono pode disparar.
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: { user }, error: userErr } = await userClient.auth.getUser()
      if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

      const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
      if (roleRow?.role !== 'owner') return json({ error: 'Forbidden' }, 403)
    }

    const { data: logRow, error: logErr } = await admin.from('prospect_scan_log').insert({ status: 'running' }).select('id').single()
    if (logErr || !logRow) return json({ error: 'Erro ao iniciar a varredura.' }, 500)
    const logId = logRow.id as string

    const runInBackground = async () => {
      try {
        const result = await runScan(admin, logId, { googleKey, apifyToken, anthropicKey, telegramToken })
        await admin.from('prospect_scan_log').update({
          status: result.error ? 'error' : 'done', found_count: result.found, error_message: result.error ?? null,
          finished_at: new Date().toISOString(),
        }).eq('id', logId)
      } catch (e) {
        await admin.from('prospect_scan_log').update({
          status: 'error', error_message: String(e), finished_at: new Date().toISOString(),
        }).eq('id', logId)
      }
    }

    // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
    EdgeRuntime.waitUntil(runInBackground())

    return json({ ok: true, scan_id: logId })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
