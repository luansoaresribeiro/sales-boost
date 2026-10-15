// Lugares e Programas Próximos (Agente de Dados, etapa 1 — decisão do dono
// 2026-10-14). Busca grátis no OpenStreetMap: Nominatim acha o ponto do
// imóvel (endereço, ou o centro do bairro se não tiver endereço) e o
// Overpass lista o que tem em volta. A distância é CALCULADA em linha reta
// a partir das coordenadas — nunca escrita pela IA (regra 5). As categorias
// e as tags do OSM vivem na ficha (`config.nearby_places`, regra 6).
//
// Uma busca por imóvel, guardada em meta.nearby; só busca de novo quando o
// endereço/bairro muda ou o dono pede. O endereço nunca vai pra legenda.
type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

// name_pattern (opcional): o nome tem que bater (ex.: praia começa com
// "Praia" — no mapa tem parquinho marcado como praia).
export interface NearbyCategory { key: string; label: string; emoji: string; osm: string[]; name_pattern?: string }
export interface NearbyConfig { address_field: string; area_field: string; radius_m: number; max_per_category: number; categories: NearbyCategory[] }
export interface NearbyPlace { cat: string; name: string; distance_m: number; osm: string; hidden?: boolean }
export interface NearbyData {
  source: 'openstreetmap'; fetched_at: string; precision: 'endereco' | 'bairro'
  query: string; places: NearbyPlace[]; error?: string
}

const UA = 'SalesBoost/1.0 (+https://getsaleboost.com)'

function validPattern(p: unknown): string | undefined {
  if (typeof p !== 'string' || !p || p.length > 100) return undefined
  try { new RegExp(p, 'i'); return p } catch { return undefined }
}
function nameOk(c: NearbyCategory, name: string): boolean {
  return !c.name_pattern || new RegExp(c.name_pattern, 'i').test(name)
}

export async function fetchNearbyConfig(admin: Admin, verticalKey: string | null): Promise<NearbyConfig | null> {
  if (!verticalKey || verticalKey === 'generico') return null
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const raw = (data?.config as Record<string, unknown> | undefined)?.nearby_places as Partial<NearbyConfig> | undefined
    if (!raw || !Array.isArray(raw.categories) || !raw.categories.length) return null
    const categories = raw.categories
      .filter(c => c && typeof c.key === 'string' && Array.isArray(c.osm))
      .map(c => ({ key: c.key, label: String(c.label ?? c.key), emoji: String(c.emoji ?? '📍'), osm: c.osm.filter(t => /^[a-z_:]+=[A-Za-z0-9_|;:-]+$/.test(t)), name_pattern: validPattern(c.name_pattern) }))
      .filter(c => c.osm.length)
    const key = (v: unknown, d: string) => typeof v === 'string' && /^[a-z_]{1,40}$/.test(v) ? v : d
    return {
      address_field: key(raw.address_field, 'endereco'), area_field: key(raw.area_field, 'bairro'),
      radius_m: Math.min(3000, Math.max(200, Number(raw.radius_m) || 1500)),
      max_per_category: Math.min(10, Math.max(1, Number(raw.max_per_category) || 3)),
      categories,
    }
  } catch { return null }
}

// Texto da busca: o que muda aqui invalida o cache.
export function nearbyQuery(cfg: NearbyConfig, fields: Record<string, unknown>, city: string): { query: string; precision: 'endereco' | 'bairro' } | null {
  const endereco = String(fields[cfg.address_field] ?? '').trim().slice(0, 200)
  const bairro = String(fields[cfg.area_field] ?? '').trim().slice(0, 80)
  const cidade = city.trim().slice(0, 80) || 'Rio de Janeiro'
  if (endereco) return { query: [endereco, bairro, cidade].filter(Boolean).join(', '), precision: 'endereco' }
  if (bairro) return { query: `${bairro}, ${cidade}`, precision: 'bairro' }
  return null
}

function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const arr = await res.json() as { lat: string; lon: string }[]
  if (!arr.length) return null
  const lat = Number(arr[0].lat), lon = Number(arr[0].lon)
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}

// Servidores públicos do Overpass (grátis). Se um estiver ocupado (429/504),
// tenta o próximo.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
async function overpass(q: string): Promise<Response> {
  let last = 'sem resposta'
  for (const base of OVERPASS) {
    try {
      const res = await fetch(`${base}?data=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
      if (res.ok) return res
      last = `${base} ${res.status}`
    } catch (e) { last = `${base} ${e instanceof Error ? e.message : e}` }
  }
  throw new Error(`Overpass: ${last}`)
}

function tagFilter(tag: string): string {
  const [k, v] = tag.split('=')
  return v.includes('|') ? `["${k}"~"^(${v})$"]` : `["${k}"="${v}"]`
}

export async function searchNearby(cfg: NearbyConfig, query: string, precision: 'endereco' | 'bairro'): Promise<NearbyData> {
  const base = { source: 'openstreetmap' as const, fetched_at: new Date().toISOString(), precision, query }
  const center = await geocode(query)
  if (!center) return { ...base, places: [], error: 'Não achei esse endereço no mapa. Confira o endereço ou o bairro do imóvel.' }
  // Caixa em volta do ponto (bem mais leve pro servidor do que "around") e
  // uma saída por filtro, com limite próprio — senão uma categoria densa
  // (restaurantes) ocupa o espaço das outras. Quem passar do raio sai depois,
  // pela distância calculada.
  const dLat = cfg.radius_m / 111320, dLon = cfg.radius_m / (111320 * Math.cos(center.lat * Math.PI / 180))
  const bbox = [center.lat - dLat, center.lon - dLon, center.lat + dLat, center.lon + dLon].map(n => n.toFixed(5)).join(',')
  const parts = cfg.categories.flatMap(c => c.osm.map(t => `nwr${tagFilter(t)}["name"];out center tags 250;`))
  // timeout/maxsize pequenos de propósito: o servidor público recusa (504
  // "too busy") pedidos que declaram orçamento grande.
  const q = `[out:json][timeout:10][maxsize:16000000][bbox:${bbox}];${parts.join('')}`
  const res = await overpass(q)
  const data = await res.json() as { elements?: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] }
  const byCat: Record<string, NearbyPlace[]> = {}
  const seen = new Set<string>()
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {}
    const name = String(tags.name ?? '').trim().slice(0, 80)
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon
    if (!name || lat == null || lon == null) continue
    const cat = cfg.categories.find(c => nameOk(c, name) && c.osm.some(t => { const [k, v] = t.split('='); return v.split('|').includes(tags[k] ?? '') }))
    if (!cat) continue
    const dedupe = `${cat.key}|${name.toLowerCase()}`
    const distance_m = haversine(center.lat, center.lon, lat, lon)
    if (distance_m > cfg.radius_m) continue
    const place = { cat: cat.key, name, distance_m, osm: `${el.type}/${el.id}` }
    const list = (byCat[cat.key] ??= [])
    if (seen.has(dedupe)) {
      // Mesmo nome (ex.: praia em vários trechos): fica o mais perto.
      const i = list.findIndex(p => p.name.toLowerCase() === name.toLowerCase())
      if (i >= 0 && list[i].distance_m > distance_m) list[i] = place
      continue
    }
    seen.add(dedupe); list.push(place)
  }
  const places = cfg.categories.flatMap(c => (byCat[c.key] ?? []).sort((a, b) => a.distance_m - b.distance_m).slice(0, cfg.max_per_category))
  return { ...base, places }
}

// Lê o cache do item ou busca (e guarda). Devolve null se o setor não usa
// lugares ou o item não tem bairro/endereço. Nunca lança — falha vira `error`.
export async function ensureNearby(admin: Admin, opts: { itemId: string; companyId: string; verticalKey: string | null; city: string; refresh?: boolean }): Promise<NearbyData | null> {
  const cfg = await fetchNearbyConfig(admin, opts.verticalKey)
  if (!cfg) return null
  const { data: item } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', opts.itemId).eq('company_id', opts.companyId).maybeSingle()
  if (!item) return null
  const meta = (item.meta ?? {}) as { fields?: Record<string, unknown>; nearby?: NearbyData }
  const q = nearbyQuery(cfg, meta.fields ?? {}, opts.city)
  if (!q) return null
  const cached = meta.nearby
  if (!opts.refresh && cached && cached.query === q.query && !cached.error) return cached
  let fresh: NearbyData
  try { fresh = await searchNearby(cfg, q.query, q.precision) } catch (e) {
    console.error('nearbyPlaces: busca falhou', opts.itemId, e)
    return cached?.query === q.query ? cached : { source: 'openstreetmap', fetched_at: new Date().toISOString(), precision: q.precision, query: q.query, places: [], error: 'O mapa não respondeu agora. Tente de novo em alguns minutos.' }
  }
  // O que o dono escondeu continua escondido depois de buscar de novo.
  const hidden = new Set((cached?.places ?? []).filter(p => p.hidden).map(p => p.osm))
  fresh.places = fresh.places.map(p => hidden.has(p.osm) ? { ...p, hidden: true } : p)
  // Relê a meta logo antes de gravar pra não apagar uma edição feita no meio.
  const { data: latest } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', opts.itemId).maybeSingle()
  await admin.from('marketing_ai_knowledge').update({ meta: { ...((latest?.meta ?? meta) as object), nearby: fresh } }).eq('id', opts.itemId).eq('company_id', opts.companyId)
  return fresh
}

// "400 m" / "1,2 km" — sempre em linha reta (a legenda diz isso).
export function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

// Pro post: o lugar visível mais perto de cada categoria, na ORDEM da ficha
// (a ficha põe primeiro o que mais vende: praia, metrô, parque…).
export function topPlaces(data: NearbyData | null, cfg: NearbyConfig | null, n = 3): (NearbyPlace & { label: string; emoji: string })[] {
  if (!data || !cfg) return []
  const visible = data.places.filter(p => !p.hidden)
  const out: (NearbyPlace & { label: string; emoji: string })[] = []
  for (const c of cfg.categories) {
    const best = visible.filter(p => p.cat === c.key).sort((a, b) => a.distance_m - b.distance_m)[0]
    if (best) out.push({ ...best, label: c.label, emoji: c.emoji })
    if (out.length >= n) break
  }
  return out
}

// Campos marcados "private" na ficha (ex.: endereço): servem pra buscar no
// mapa, nunca vão pro prompt de legenda.
export async function privateFieldKeys(admin: Admin, verticalKey: string | null): Promise<Set<string>> {
  if (!verticalKey || verticalKey === 'generico') return new Set()
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).maybeSingle()
    const cf = ((data?.config ?? {}) as { catalog_fields?: { required?: { key: string; private?: boolean }[]; optional?: { key: string; private?: boolean }[] } }).catalog_fields
    return new Set([...(cf?.required ?? []), ...(cf?.optional ?? [])].filter(f => f?.private).map(f => f.key))
  } catch { return new Set() }
}
