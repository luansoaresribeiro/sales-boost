import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Posts de bairro (decisão do dono 2026-10-08, docs/DECISIONS.md):
// lugares perto do item via OpenStreetMap (Nominatim + Overpass, grátis) e
// foto REAL do lugar via Wikimedia Commons (só licença livre: CC0, domínio
// público, CC BY — nunca SA/NC/ND), com crédito do fotógrafo. Nenhuma IA
// gera imagem de lugar. Os tipos de lugar vêm da ficha do setor
// (vertical_playbooks.config.nearby_places — regra 6, nada de setor aqui).
//
// actions:
//  - search {item_id}: calcula e grava em marketing_ai_knowledge.meta.nearby
//  - import_photo {item_id, photo_url}: copia a foto escolhida (só
//    upload.wikimedia.org) pro storage, pra usar no post (render-format).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
// Nominatim/Wikimedia exigem User-Agent que identifique o app.
const UA = 'SalesBoost/1.0 (https://getsaleboost.com)'
const MAX_PLACES = 8
const PHOTOS_PER_PLACE = 4

interface Bilingual { pt: string; en?: string }
interface PlaceType { key: string; label: Bilingual; osm: string[] }
interface NearbyConfig { radius_m?: number; radius_bairro_m?: number; types?: PlaceType[] }
interface PhotoCandidate { url: string; thumb: string; page: string; author: string; license: string }
interface Place { type: string; label: Bilingual; name: string; lat: number; lon: number; distance_m: number | null; photos: PhotoCandidate[] }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

// Nominatim (OSM oficial) e, se falhar/bloquear, Photon (também dados OSM,
// grátis, sem chave).
async function geocode(q: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(15_000) })
    if (res.ok) {
      const arr = await res.json() as { lat: string; lon: string }[]
      if (arr[0]) return { lat: Number(arr[0].lat), lon: Number(arr[0].lon) }
    } else console.log('[nearby-places] nominatim', res.status)
  } catch (e) { console.log('[nearby-places] nominatim erro', String(e)) }
  try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) { console.log('[nearby-places] photon', res.status); return null }
    const data = await res.json() as { features?: { geometry?: { coordinates?: [number, number] } }[] }
    const c = data.features?.[0]?.geometry?.coordinates
    return c ? { lat: c[1], lon: c[0] } : null
  } catch (e) { console.log('[nearby-places] photon erro', String(e)); return null }
}

// "k=v" → ["k"="v"]; só letras/números/_:- pra não injetar nada na query.
function osmFilter(f: string): string | null {
  const m = /^([a-z0-9_:]+)=([a-z0-9_:-]+)$/i.exec(f.trim())
  return m ? `["${m[1]}"="${m[2]}"]` : null
}

async function overpass(types: PlaceType[], lat: number, lon: number, radius: number) {
  const parts: string[] = []
  for (const t of types) for (const f of t.osm ?? []) {
    const flt = osmFilter(f)
    if (flt) parts.push(`nwr${flt}["name"](around:${radius},${lat},${lon});`)
  }
  if (!parts.length) return []
  const q = `[out:json][timeout:25];(${parts.join('')});out center tags 200;`
  // Servidores públicos do Overpass (mesmos dados OSM); se um recusar, tenta o próximo.
  let data: { elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] } | null = null
  for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']) {
    try {
      const res = await fetch(ep, {
        method: 'POST', headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(40_000),
      })
      if (res.ok) { data = await res.json(); break }
      console.log('[nearby-places] overpass', ep, res.status)
    } catch (e) { console.log('[nearby-places] overpass erro', ep, String(e)) }
  }
  if (!data) throw new Error('Mapa indisponível agora. Tente de novo em alguns minutos.')
  return (data.elements ?? []).map(e => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags ?? {} }))
    .filter((e): e is { lat: number; lon: number; tags: Record<string, string> } => typeof e.lat === 'number' && typeof e.lon === 'number' && !!e.tags.name)
}

function matchesType(tags: Record<string, string>, t: PlaceType): boolean {
  return (t.osm ?? []).some(f => { const [k, v] = f.split('='); return tags[k] === v })
}

async function wiki(params: Record<string, string>) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${qs}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) { console.log('[nearby-places] wikimedia', res.status); return null }
  return await res.json()
}

// CC0, domínio público ou CC BY (qualquer versão). Fora: SA, NC, ND, GFDL...
function freeLicense(short: string): boolean {
  const s = norm(short)
  if (/\b(sa|nc|nd)\b/.test(s) || s.includes('gfdl')) return false
  return s.startsWith('cc0') || s.includes('public domain') || s === 'pd' || /^cc[ -]by[ -]?\d/.test(s) || s === 'cc by' || s === 'cc-by'
}

async function photosFor(name: string, city: string, lat: number, lon: number): Promise<PhotoCandidate[]> {
  const [geo, txt] = await Promise.all([
    wiki({ action: 'query', list: 'geosearch', gscoord: `${lat}|${lon}`, gsradius: '400', gsnamespace: '6', gslimit: '30' }),
    wiki({ action: 'query', list: 'search', srsearch: `${name} ${city}`, srnamespace: '6', srlimit: '15' }),
  ])
  const titles = new Map<string, number>() // título → ordem (geo primeiro)
  for (const g of (geo?.query?.geosearch ?? []) as { title: string }[]) if (!titles.has(g.title)) titles.set(g.title, titles.size)
  for (const s of (txt?.query?.search ?? []) as { title: string }[]) if (!titles.has(s.title)) titles.set(s.title, titles.size)
  if (!titles.size) return []
  const info = await wiki({ action: 'query', titles: [...titles.keys()].slice(0, 45).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1280' })
  const nameWords = norm(name).split(/\s+/).filter(w => w.length > 3)
  const out: (PhotoCandidate & { score: number })[] = []
  for (const p of (info?.query?.pages ?? []) as { title: string; imageinfo?: { url: string; thumburl?: string; descriptionurl: string; mime: string; width: number; extmetadata?: Record<string, { value: string }> }[] }[]) {
    const ii = p.imageinfo?.[0]
    if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime) || ii.width < 900) continue
    const md = ii.extmetadata ?? {}
    const license = stripHtml(md.LicenseShortName?.value ?? '')
    const author = stripHtml(md.Artist?.value ?? '').slice(0, 80)
    if (!license || !freeLicense(license)) continue
    if (!author && !norm(license).includes('public domain') && !norm(license).startsWith('cc0')) continue // CC BY exige crédito
    // Foto da busca por texto com GPS longe (> 2 km) é de outro lugar.
    const gLat = Number(md.GPSLatitude?.value), gLon = Number(md.GPSLongitude?.value)
    const far = Number.isFinite(gLat) && Number.isFinite(gLon) && haversine(lat, lon, gLat, gLon) > 2000
    if (far) continue
    const nameHit = nameWords.some(w => norm(p.title).includes(w))
    const fromGeo = (titles.get(p.title) ?? 99) < ((geo?.query?.geosearch ?? []).length || 0)
    if (!fromGeo && !nameHit) continue
    out.push({ url: ii.thumburl ?? ii.url, thumb: (ii.thumburl ?? ii.url), page: ii.descriptionurl, author: author || 'Domínio público', license, score: (nameHit ? 0 : 100) + (titles.get(p.title) ?? 99) })
  }
  return out.sort((a, b) => a.score - b.score).slice(0, PHOTOS_PER_PLACE).map(({ score: _s, ...c }) => c)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.json().catch(() => ({})) as { action?: string; item_id?: string; photo_url?: string }
    if (!body.item_id || !/^[0-9a-f-]{36}$/i.test(body.item_id)) return json({ error: 'item_id inválido' }, 400)

    const { data: company } = await admin.from('companies').select('id, city, vertical_key').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const { data: item } = await admin.from('marketing_ai_knowledge').select('id, meta')
      .eq('id', body.item_id).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
    if (!item) return json({ error: 'Item não encontrado.' }, 404)
    const meta = (item.meta ?? {}) as { fields?: Record<string, unknown>; nearby?: unknown }

    if (body.action === 'import_photo') {
      const url = String(body.photo_url ?? '')
      let host = ''
      try { host = new URL(url).hostname } catch { /* inválida */ }
      if (host !== 'upload.wikimedia.org') return json({ error: 'Foto fora da Wikimedia.' }, 400)
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
      const type = res.headers.get('content-type') ?? ''
      if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return json({ error: 'Não consegui baixar a foto.' }, 502)
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.length > 15_000_000) return json({ error: 'Foto grande demais.' }, 400)
      const path = `renders/${company.id}/bairro-${crypto.randomUUID()}.${type.includes('png') ? 'png' : 'jpg'}`
      const { error: upErr } = await admin.storage.from('post-images').upload(path, bytes, { contentType: type.split(';')[0], upsert: false })
      if (upErr) return json({ error: upErr.message }, 500)
      return json({ ok: true, url: admin.storage.from('post-images').getPublicUrl(path).data.publicUrl })
    }

    // action 'search'
    const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', company.vertical_key ?? 'generico').eq('enabled', true).maybeSingle()
    const cfg = ((pb?.config ?? {}) as { nearby_places?: NearbyConfig }).nearby_places
    const types = (cfg?.types ?? []).filter(t => t?.key && Array.isArray(t.osm))
    if (!types.length) return json({ error: 'Este setor ainda não tem lugares configurados.' }, 400)

    const f = meta.fields ?? {}
    const bairro = String(f.bairro ?? '').trim()
    const endereco = String(f.endereco ?? '').trim()
    const city = String(company.city ?? '').trim()
    if (!bairro && !endereco) return json({ error: 'Preencha o bairro do item.' }, 400)

    // Com endereço: distância real do item. Só bairro: centro do bairro,
    // SEM distância (não dá pra afirmar "a X m do imóvel" — regra 5).
    let origin = endereco ? await geocode([endereco, bairro, city, 'Brasil'].filter(Boolean).join(', ')) : null
    const precision: 'endereco' | 'bairro' = origin ? 'endereco' : 'bairro'
    if (!origin) origin = await geocode([bairro, city, 'Brasil'].filter(Boolean).join(', '))
    if (!origin) return json({ error: 'Não encontrei esse endereço/bairro no mapa.' }, 404)

    const radius = precision === 'endereco' ? (cfg?.radius_m ?? 1500) : (cfg?.radius_bairro_m ?? 2500)
    const elements = await overpass(types, origin.lat, origin.lon, Math.min(5000, radius))

    // Por tipo: os mais próximos com nome (sem repetir nome).
    const seen = new Set<string>()
    const candidates: Omit<Place, 'photos'>[] = []
    for (const t of types) {
      const ofType = elements.filter(e => matchesType(e.tags, t))
        .map(e => ({ ...e, d: haversine(origin!.lat, origin!.lon, e.lat, e.lon) }))
        .sort((a, b) => a.d - b.d)
      let n = 0
      for (const e of ofType) {
        const key = norm(e.tags.name)
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push({ type: t.key, label: t.label, name: e.tags.name, lat: e.lat, lon: e.lon, distance_m: precision === 'endereco' ? Math.round(e.d) : null })
        if (++n >= 2) break
      }
    }
    const picked = candidates.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0)).slice(0, MAX_PLACES)
    const places: Place[] = await Promise.all(picked.map(async p => ({ ...p, photos: await photosFor(p.name, city, p.lat, p.lon).catch(() => []) })))

    const nearby = { computed_at: new Date().toISOString(), precision, origin_label: precision === 'endereco' ? 'endereco' : bairro, places }
    // Relê o meta antes de gravar pra não apagar fotos/campos salvos no meio.
    const { data: fresh } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', item.id).single()
    await admin.from('marketing_ai_knowledge').update({ meta: { ...((fresh?.meta ?? {}) as object), nearby } }).eq('id', item.id)
    return json({ ok: true, nearby })
  } catch (err) {
    console.error('nearby-places error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
