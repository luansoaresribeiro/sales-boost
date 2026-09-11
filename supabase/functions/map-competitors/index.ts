import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BTEntry {
  types: string[]
  keyword: string
  aiLabel: string
  excludeGoogleTypes: string[]
}

const BT_CONFIG: Record<string, BTEntry> = {
  'Restaurante / Food':    { types: ['restaurant', 'bar'],  keyword: 'restaurante bar comida lanchonete', aiLabel: 'restaurant, bar, or food establishment', excludeGoogleTypes: ['lodging', 'hotel'] },
  'Bar & Pub':             { types: ['bar', 'restaurant'],  keyword: 'bar pub cerveja drinks bebidas',    aiLabel: 'bar, pub, or nightlife venue',           excludeGoogleTypes: ['lodging', 'hotel'] },
  'Varejo / E-commerce':   { types: ['store'],              keyword: 'loja varejo comércio',              aiLabel: 'retail store or shop',                   excludeGoogleTypes: ['lodging', 'hotel'] },
  'Beleza & Estética':     { types: ['beauty_salon'],       keyword: 'salão beleza estética spa barbearia', aiLabel: 'beauty salon, spa, barbershop, or aesthetics', excludeGoogleTypes: ['lodging', 'hotel'] },
  'Barbearia':             { types: ['hair_care'],          keyword: 'barbearia barbeiro corte cabelo',   aiLabel: 'barbershop or men\'s hair salon',        excludeGoogleTypes: ['lodging', 'hotel'] },
  'Saúde & Bem-estar':     { types: ['health'],             keyword: 'saúde bem-estar clínica',          aiLabel: 'health or wellness service',             excludeGoogleTypes: ['lodging', 'hotel'] },
  'Clínica / Consultório': { types: ['doctor'],             keyword: 'clínica médico dentista',           aiLabel: 'clinic or medical office',               excludeGoogleTypes: ['lodging', 'hotel'] },
  'Academia / Fitness':    { types: ['gym'],                keyword: 'academia fitness crossfit',         aiLabel: 'gym or fitness center',                  excludeGoogleTypes: ['lodging', 'hotel'] },
  'Serviços':              { types: ['establishment'],      keyword: 'serviços',                          aiLabel: 'service business',                       excludeGoogleTypes: ['lodging', 'hotel'] },
  'Serviços Gerais':       { types: ['establishment'],      keyword: 'serviços',                          aiLabel: 'general service business',               excludeGoogleTypes: ['lodging', 'hotel'] },
  'Outro':                 { types: ['establishment'],      keyword: '',                                  aiLabel: 'local business',                         excludeGoogleTypes: ['lodging', 'hotel'] },
}

interface PlaceDetails {
  place_id: string
  name: string
  rating?: number
  user_ratings_total?: number
  price_level?: number
  geometry: { location: { lat: number; lng: number } }
  types?: string[]
  website?: string
  formatted_phone_number?: string
  formatted_address?: string
  editorial_summary?: { overview?: string }
  opening_hours?: { weekday_text?: string[]; open_now?: boolean }
  business_status?: string
}

async function notifyMarketing(adminDb: ReturnType<typeof createClient>, companyId: string, event: string, data?: Record<string, unknown>) {
  // Sempre grava na aba Atividades, mesmo sem Telegram conectado — o envio
  // ao Telegram (dentro de log-bot-event) é só um bônus quando existe chat.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  const { data: chat } = await adminDb.from('telegram_conversations').select('telegram_chat_id').eq('customer_id', companyId).eq('bot_type', 'marketing').limit(1).maybeSingle()
  try {
    await fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chat?.telegram_chat_id ?? null, data }),
    })
  } catch { /* fire-and-forget */ }
}

async function runApifyActor(token: string, actorId: string, input: Record<string, unknown>, timeoutSecs = 45): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&memory=256`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  if (!res.ok) throw new Error(`Apify error (${actorId}): ${await res.text()}`)
  return res.json()
}

interface GoogleSearchResultItem { organicResults?: { url?: string }[] }

// O Google Places só traz Instagram quando o próprio dono cadastrou o link
// como "website" do negócio — raro na prática. Pra achar de verdade sem
// depender do cliente colar o link, busca "<nome> <endereço> instagram" e
// pega o primeiro resultado que é um perfil (não post/reel/explore/login).
function extractInstagramProfileUrl(results: { url?: string }[] | undefined): string | null {
  if (!results) return null
  const skip = new Set(['p', 'explore', 'accounts', 'reel', 'reels', 'stories', 'tv', 'direct'])
  for (const r of results) {
    const m = r.url?.match(/^https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?(?:\?.*)?$/i)
    if (m && !skip.has(m[1].toLowerCase())) return `https://www.instagram.com/${m[1]}/`
  }
  return null
}

async function findInstagramViaSearch(apifyToken: string, name: string, addressHint: string): Promise<string | null> {
  try {
    const items = await runApifyActor(apifyToken, 'apify~google-search-scraper', {
      queries: `${name} ${addressHint} instagram`.trim(),
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
    }) as GoogleSearchResultItem[]
    return extractInstagramProfileUrl(items[0]?.organicResults)
  } catch {
    return null
  }
}

// null = a Google genuinely não tem esse place (ex: place_id inválido).
// undefined = a chamada falhou (rede/timeout/rate limit) — diferente de "não
// existe", nunca deve ser tratado como evidência de que o concorrente sumiu.
async function getPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails | null | undefined> {
  const fields = 'name,place_id,geometry,rating,user_ratings_total,price_level,types,website,formatted_phone_number,formatted_address,editorial_summary,opening_hours,business_status'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=pt-BR&key=${apiKey}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK') return data.result as PlaceDetails
    if (data.status === 'NOT_FOUND') return null
    return undefined // OVER_QUERY_LIMIT, UNKNOWN_ERROR, etc — falha, não ausência
  } catch {
    return undefined // erro de rede/timeout — falha, não ausência
  }
}

async function verifyCompetitors(
  places: PlaceDetails[],
  businessType: string,
  businessName: string,
  anthropicKey: string,
): Promise<Set<string>> {
  if (!anthropicKey || places.length === 0) return new Set(places.map(p => p.place_id))

  const cfg = BT_CONFIG[businessType] ?? BT_CONFIG['Outro']
  const list = places.map(p => ({
    id: p.place_id,
    name: p.name,
    types: p.types?.join(', ') ?? '',
    summary: p.editorial_summary?.overview ?? '',
  }))

  const prompt = `You are classifying whether nearby businesses are DIRECT competitors.

The registered business "${businessName}" is of type: "${businessType}" (${cfg.aiLabel}).

STRICT EXCLUSION RULES — automatically exclude:
- Hotels, pousadas, hostels, or any accommodation, even if they have a restaurant inside
- Hospitals, clinics, pharmacies (unless the business itself is a clinic)
- Gas stations, parking lots, banks
- Businesses in clearly different sectors from "${cfg.aiLabel}"

INCLUDE only businesses that compete for the EXACT same customer as "${businessName}".

Return ONLY a JSON array of place_ids that ARE direct competitors. No explanation.

Places:
${JSON.stringify(list, null, 2)}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return new Set(places.map(p => p.place_id))
    const d = await res.json()
    const text = (d.content?.[0]?.text ?? '').trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const ids: string[] = JSON.parse(match[0])
      return new Set(ids)
    }
  } catch { /* fall through — places is already pre-filtered, safe to use as fallback */ }

  return new Set(places.map(p => p.place_id))
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type CompanyRow = { id: string; business_name: string; business_type: string | null; google_place_id: string | null; notification_prefs?: Record<string, boolean> | null }

// Núcleo do mapeamento — usado tanto pelo clique manual (aba Concorrentes) quanto
// pelo ciclo autônomo. Faz a varredura completa e devolve quantos concorrentes
// ficaram registrados; quem chama decide se vale notificar/logar o motivo.
async function scanCompetitors(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  anthropicKey: string,
  apifyToken: string,
  company: CompanyRow,
  radiusKm: number,
): Promise<{ mapped: number; newCompetitorNames: string[] }> {
  if (!company.google_place_id) return { mapped: 0, newCompetitorNames: [] }

  const radiusM = radiusKm * 1000

  const detailsRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${company.google_place_id}&fields=geometry&key=${apiKey}`)
  const details = await detailsRes.json()
  if (details.status !== 'OK') throw new Error(`Google Places error: ${details.status}`)

  const { lat, lng } = details.result.geometry.location
  const cfg = BT_CONFIG[company.business_type ?? ''] ?? BT_CONFIG['Outro']
  const keywordParam = cfg.keyword ? `&keyword=${encodeURIComponent(cfg.keyword)}` : ''

  // Cada busca por tipo marca se REALMENTE funcionou (OK/ZERO_RESULTS) ou se
  // falhou (rate limit, erro de rede, status inesperado) — uma falha parcial
  // nunca pode virar "esses concorrentes não existem mais" (ver uso de
  // anyTypeSearchFailed abaixo, na hora de decidir o que apagar).
  const searchResults = await Promise.all(
    cfg.types.map(searchType =>
      fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusM}&type=${searchType}${keywordParam}&language=pt-BR&key=${apiKey}`)
        .then(r => r.json())
        .then((d: { status: string; results?: { place_id: string; business_status?: string }[] }) =>
          (d.status === 'OK' || d.status === 'ZERO_RESULTS') ? { ok: true, results: d.results ?? [] } : { ok: false, results: [] as { place_id: string; business_status?: string }[] }
        )
        .catch(() => ({ ok: false, results: [] as { place_id: string; business_status?: string }[] }))
    )
  )
  const anyTypeSearchFailed = searchResults.some(r => !r.ok)

  const seen = new Set<string>()
  const nearby = searchResults
    .flatMap(r => r.results)
    .filter((p: { place_id: string; business_status?: string }) => {
      if (seen.has(p.place_id) || p.place_id === company.google_place_id || p.business_status === 'CLOSED_PERMANENTLY') return false
      seen.add(p.place_id)
      return true
    })
    .slice(0, 20)

  if (nearby.length === 0) return { mapped: 0, newCompetitorNames: [] }

  const detailsResults = await Promise.all(nearby.map(async (p: { place_id: string }) => ({ placeId: p.place_id, details: await getPlaceDetails(p.place_id, apiKey) })))
  // undefined = a chamada de detalhes falhou pra esse lugar específico — não
  // é evidência de que ele sumiu, só não temos dado novo dele nesta rodada.
  const detailsFailedPlaceIds = new Set(detailsResults.filter(r => r.details === undefined).map(r => r.placeId))
  const detailedPlaces = detailsResults
    .map(r => r.details)
    .filter((p): p is PlaceDetails => !!p && p.business_status !== 'CLOSED_PERMANENTLY')

  const preFiltered = detailedPlaces.filter(p => {
    const placeTypes = p.types ?? []
    return !cfg.excludeGoogleTypes.some(et => placeTypes.includes(et))
  })

  const verifiedIds = await verifyCompetitors(preFiltered, company.business_type ?? '', company.business_name, anthropicKey)
  const verifiedPlaces = detailedPlaces.filter(p => verifiedIds.has(p.place_id))

  const igFromWebsite = (url: string | null | undefined): string | null => {
    if (!url) return null
    return /instagram\.com/i.test(url) ? url : null
  }

  const { data: existing } = await admin.from('competitors').select('id, google_place_id, instagram_url').eq('company_id', company.id)
  const existingPlaceIds = new Set((existing ?? []).map(e => e.google_place_id))
  const existingInstagramByPlaceId = new Map((existing ?? []).map(e => [e.google_place_id, e.instagram_url as string | null]))

  // Acha o Instagram sozinho quando o Google não trouxe (o normal — o campo
  // "website" raramente é o próprio Instagram). Limita a busca a 10 por
  // rodada pra não estourar custo do Apify; quem não achar essa semana tenta
  // de novo na próxima (o cron só re-varre a cada 7 dias).
  let searchBudget = 10
  const rows = await Promise.all(verifiedPlaces.map(async p => {
    let instagram = igFromWebsite(p.website) ?? existingInstagramByPlaceId.get(p.place_id) ?? null
    if (!instagram && apifyToken && searchBudget > 0) {
      searchBudget--
      instagram = await findInstagramViaSearch(apifyToken, p.name, p.formatted_address ?? '')
    }
    return {
      company_id: company.id,
      google_place_id: p.place_id,
      name: p.name,
      rating: p.rating ?? null,
      review_count: p.user_ratings_total ?? 0,
      distance_m: Math.round(haversine(lat, lng, p.geometry.location.lat, p.geometry.location.lng)),
      price_level: p.price_level ?? null,
      website: p.website ?? null,
      instagram_url: instagram,
      phone: p.formatted_phone_number ?? null,
      address: p.formatted_address ?? null,
      opening_hours: p.opening_hours
        ? { weekday_text: p.opening_hours.weekday_text ?? [], open_now: p.opening_hours.open_now ?? null }
        : null,
      google_types: p.types ?? [],
      editorial_summary: p.editorial_summary?.overview ?? null,
      is_verified_competitor: true,
    }
  }))

  let upserted: { id: string; google_place_id: string | null }[] = []
  if (rows.length > 0) {
    const { data } = await admin
      .from('competitors')
      .upsert(rows, { onConflict: 'company_id,google_place_id' })
      .select('id, google_place_id')
    upserted = data ?? []
  }

  // Só apaga concorrente "sumido" quando a varredura desta rodada foi
  // completa e confiável: nenhuma busca por tipo falhou, e o lugar em
  // questão não é um que só não tivemos detalhes por falha transitória.
  // Falha parcial de API nunca deve apagar dado real (bug corrigido).
  if (!anyTypeSearchFailed) {
    const keepPlaceIds = new Set(rows.map(r => r.google_place_id))
    const staleIds = (existing ?? [])
      .filter(e => !keepPlaceIds.has(e.google_place_id ?? '') && !detailsFailedPlaceIds.has(e.google_place_id ?? ''))
      .map(e => e.id)
    if (staleIds.length > 0) await admin.from('competitors').delete().in('id', staleIds)
  }

  if (upserted.length > 0) {
    const byPlaceId = new Map(rows.map(r => [r.google_place_id, r]))
    const snapshots = upserted
      .map(u => {
        const src = byPlaceId.get(u.google_place_id ?? '')
        if (!src) return null
        return { competitor_id: u.id, price_level: src.price_level, rating: src.rating, review_count: src.review_count }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
    if (snapshots.length > 0) await admin.from('competitor_snapshots').insert(snapshots)
  }

  const newRows = rows.filter(r => !existingPlaceIds.has(r.google_place_id))
  const prefs = (company.notification_prefs as Record<string, boolean> | null) ?? {}
  if (newRows.length > 0 && prefs.new_competitor !== false) {
    notifyMarketing(admin, company.id, 'NEW_COMPETITOR', {
      count: newRows.length,
      competitors: newRows.map(r => r.name),
    })
  }

  return { mapped: rows.length, newCompetitorNames: newRows.map(r => r.name) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
    const apifyToken = Deno.env.get('APIFY_TOKEN') ?? ''
    const cronSecretEnv = Deno.env.get('CRON_SECRET')

    if (!apiKey) return json({ error: 'GOOGLE_PLACES_API_KEY não configurada no servidor.' }, 503)

    const admin = createClient(supabaseUrl, serviceKey)

    const rawBody = req.method === 'POST' ? await req.json().catch(() => ({})) as Record<string, unknown> : {}
    const isCron = cronSecretEnv && rawBody.cron_secret === cronSecretEnv

    // Modo cron: roda pra todas as empresas com Google vinculado, mas só re-varre
    // quem não foi escaneado nos últimos 7 dias — evita gastar cota do Google
    // Places e chamadas de IA verificando os mesmos concorrentes a cada 30 min.
    if (isCron) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await admin
        .from('companies')
        .select('id, business_name, business_type, google_place_id, notification_prefs')
        .eq('active', true)
        .not('google_place_id', 'is', null)

      let scanned = 0, skipped = 0
      for (const company of (companies ?? []) as CompanyRow[]) {
        try {
          const { data: recentSnap } = await admin
            .from('competitor_snapshots')
            .select('collected_at, competitors!inner(company_id)')
            .eq('competitors.company_id', company.id)
            .order('collected_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (recentSnap?.collected_at && recentSnap.collected_at > sevenDaysAgo) { skipped++; continue }

          const result = await scanCompetitors(admin, apiKey, anthropicKey, apifyToken, company, 3)
          await logSync(admin, company.id, { ok: true, status: 'healthy', recordsSynced: result.mapped })
          scanned++
        } catch (e) {
          console.error(`map-competitors cron: company ${company.id} error:`, e)
          await logSync(admin, company.id, { ok: false, status: 'error', error: e instanceof Error ? e.message : String(e) })
        }
      }
      return json({ ok: true, cron: true, scanned, skipped })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: company } = await admin.from('companies').select('id, business_name, business_type, google_place_id, notification_prefs').eq('user_id', user.id).maybeSingle()

    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    if (!company.google_place_id) return json({ error: 'Vincule seu negócio ao Google nas Configurações primeiro.' }, 400)

    // Google's Nearby Search caps the radius at 50km (50000m) — requests above
    // that are clamped, not rejected, so we clamp here too to keep it honest.
    const radiusKm = Math.min(50, Math.max(1, Math.round((rawBody.radius_km as number) ?? 3)))

    let result: { mapped: number; newCompetitorNames: string[] }
    try {
      result = await scanCompetitors(admin, apiKey, anthropicKey, apifyToken, company as CompanyRow, radiusKm)
      await logSync(admin, company.id, { ok: true, status: 'healthy', recordsSynced: result.mapped })
    } catch (e) {
      await logSync(admin, company.id, { ok: false, status: 'error', error: e instanceof Error ? e.message : String(e) })
      throw e
    }

    return json({ mapped: result.mapped, verified_competitors: result.mapped, radius_km: radiusKm })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Fase 1 do plano de arquitetura de sincronização — grava saúde/freshness
// central (integration_sync_status). last_success_at só é tocado quando
// ok=true, preservando a última sincronização boa mesmo quando esta falhou.
async function logSync(admin: ReturnType<typeof createClient>, companyId: string, result: { ok: boolean; status: 'healthy' | 'error' | 'disconnected'; error?: string | null; recordsSynced?: number }) {
  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
    company_id: companyId, integration: 'competitors',
    last_synced_at: now, status: result.status, last_error: result.error ?? null,
    records_synced: result.recordsSynced ?? null, updated_at: now,
  }
  if (result.ok) row.last_success_at = now
  try { await admin.from('integration_sync_status').upsert(row, { onConflict: 'company_id,integration' }) } catch { /* nunca derruba a sync por causa do log */ }
}
