/**
 * portal-import — lê o XML de anúncios que o sistema do corretor (CRM) já
 * gera pros portais (padrão VRSync, o do ZAP/VivaReal/Grupo OLX) e devolve
 * os anúncios normalizados pra tela do Catálogo importar.
 *
 * Grátis: não usa API paga nenhuma — é o mesmo link público que o portal lê.
 * Nunca grava item do catálogo sozinho: a tela mostra a lista, o dono escolhe
 * o que importar, e as fotos passam pelo MESMO processamento do upload
 * manual (corte 4:5 no navegador). Foto é sempre a real do anúncio (regra 4)
 * e nenhum número é inventado: campo que o XML não traz fica vazio (regra 5).
 *
 * Ações (POST, JWT do dono; conta vitrine recebe 402 plan_required):
 *   { action: 'preview', feed_url }  → { listings, total } e guarda o link
 *                                      em company_integrations (type 'portal_feed')
 *   { action: 'photo', url }         → bytes da foto (proxy — o CDN do CRM
 *                                      não libera CORS pro navegador)
 *
 * O mapeamento "anúncio → campos do catálogo" NÃO mora aqui: fica na ficha
 * do setor (vertical_playbooks.config.catalog_import), regra 6.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requirePaidAccess } from '../_shared/access.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_FEED_BYTES = 25 * 1024 * 1024
const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const MAX_LISTINGS = 300
const MAX_PHOTOS = 20

export interface Listing {
  id: string
  title: string
  transaction: 'sale' | 'rent' | null
  property_type: string
  price: number | null
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  hoa: number | null
  tax: number | null
  neighborhood: string
  city: string
  description: string
  photos: string[]
}

// ── Proteção do proxy: só https, nada de endereço interno, poucos redirects
// validados um a um (evita usar a function pra bater em rede privada). ────
function isSafeUrl(raw: string): URL | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const h = u.hostname.toLowerCase()
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return null
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null
  }
  if (h.startsWith('[') || h.includes(':')) return null // IPv6 literal: não precisa, não aceita
  return u
}

async function safeFetch(raw: string, timeoutMs: number): Promise<Response> {
  let url = isSafeUrl(raw)
  for (let hop = 0; hop < 4 && url; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'SalesBoost-Catalog/1.0' } })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      await res.body?.cancel()
      url = loc ? isSafeUrl(new URL(loc, url).toString()) : null
      continue
    }
    return res
  }
  throw new Error('Link inválido ou bloqueado (use o link https do XML).')
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > max) throw new Error('Arquivo grande demais.')
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) { await reader.cancel(); throw new Error('Arquivo grande demais.') }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.byteLength }
  return out
}

// ── Leitura do VRSync (estrutura simples e estável — regex por bloco basta,
// sem precisar de um parser XML inteiro no edge). ─────────────────────────
function decode(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&').trim()
}
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? decode(m[1]) : ''
}
// Número só se o XML trouxer um número de verdade (nunca inventa).
function num(s: string): number | null {
  if (!s) return null
  const clean = s.replace(/[^\d.,]/g, '')
  if (!clean) return null
  // "1.250.000,00" → 1250000 ; "1.250.000" → 1250000 ; "1250000.00" → 1250000
  const normalized = /,\d{1,2}$/.test(clean) ? clean.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(clean) ? clean.replace(/\./g, '') // "1.250.000"
    : clean.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseVrsync(xml: string): Listing[] {
  const out: Listing[] = []
  const re = /<Listing\b[^>]*>([\s\S]*?)<\/Listing>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) && out.length < MAX_LISTINGS) {
    const b = m[1]
    const id = tag(b, 'ListingID')
    if (!id) continue
    const details = b.match(/<Details\b[^>]*>([\s\S]*?)<\/Details>/i)?.[1] ?? ''
    const location = b.match(/<Location\b[^>]*>([\s\S]*?)<\/Location>/i)?.[1] ?? ''
    const tt = tag(b, 'TransactionType').toLowerCase()
    const transaction: Listing['transaction'] = tt.includes('rent') && !tt.includes('sale') ? 'rent' : tt.includes('sale') ? 'sale' : null
    const listPrice = num(tag(details, 'ListPrice'))
    const rentPrice = num(tag(details, 'RentalPrice'))
    const photos: string[] = []
    const mediaBlock = b.match(/<Media\b[^>]*>([\s\S]*?)<\/Media>/i)?.[1] ?? ''
    const itemRe = /<Item\b([^>]*)>([\s\S]*?)<\/Item>/gi
    let it: RegExpExecArray | null
    while ((it = itemRe.exec(mediaBlock)) && photos.length < MAX_PHOTOS) {
      const attrs = it[1]
      const medium = attrs.match(/medium\s*=\s*"([^"]*)"/i)?.[1]?.toLowerCase() ?? 'image'
      const url = decode(it[2])
      if (medium !== 'image' || !isSafeUrl(url)) continue
      if (/primary\s*=\s*"true"/i.test(attrs)) photos.unshift(url); else photos.push(url)
    }
    out.push({
      id: id.slice(0, 80),
      title: tag(b, 'Title').slice(0, 160),
      transaction,
      property_type: tag(details, 'PropertyType').slice(0, 80),
      price: transaction === 'rent' ? (rentPrice ?? listPrice) : (listPrice ?? rentPrice),
      area: num(tag(details, 'LivingArea')) ?? num(tag(details, 'LotArea')),
      bedrooms: num(tag(details, 'Bedrooms')),
      bathrooms: num(tag(details, 'Bathrooms')),
      parking: num(tag(details, 'Garage')),
      hoa: num(tag(details, 'PropertyAdministrationFee')),
      tax: num(tag(details, 'YearlyTax')),
      neighborhood: tag(location, 'Neighborhood').slice(0, 80),
      city: tag(location, 'City').slice(0, 80),
      description: tag(details, 'Description').slice(0, 1200),
      photos,
    })
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: company } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id as string)
    if (noPlan) return noPlan

    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    if (body.action === 'photo') {
      const url = typeof body.url === 'string' ? body.url : ''
      if (!isSafeUrl(url)) return json({ error: 'Link de foto inválido.' }, 400)
      const res = await safeFetch(url, 20000)
      const type = res.headers.get('content-type') ?? ''
      // Só foto de verdade (jpg/png/webp/avif) — SVG pode carregar script.
      if (!res.ok || !/^image\/(jpeg|png|webp|avif|gif)/.test(type)) { await res.body?.cancel(); return json({ error: 'Não consegui baixar essa foto.' }, 502) }
      const bytes = await readCapped(res, MAX_PHOTO_BYTES)
      return new Response(bytes, { headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'no-store' } })
    }

    if (body.action === 'preview') {
      const feedUrl = typeof body.feed_url === 'string' ? body.feed_url.trim() : ''
      if (!isSafeUrl(feedUrl)) return json({ error: 'Cole o link completo do XML (começando com https://).' }, 400)
      const res = await safeFetch(feedUrl, 30000)
      if (!res.ok) { await res.body?.cancel(); return json({ error: `O link respondeu com erro (${res.status}). Confira se ele está certo.` }, 502) }
      const xml = new TextDecoder().decode(await readCapped(res, MAX_FEED_BYTES))
      const listings = parseVrsync(xml)
      if (!listings.length) return json({ error: 'Não encontrei anúncios nesse link. Ele precisa ser o XML no padrão ZAP/VivaReal (VRSync).' }, 422)

      // Guarda o link pra próxima vez (e pra uma futura sincronização).
      const meta = { feed_url: feedUrl, last_preview_at: new Date().toISOString(), listings: listings.length }
      const { data: existing } = await admin.from('company_integrations').select('id').eq('company_id', company.id).eq('type', 'portal_feed').maybeSingle()
      if (existing) await admin.from('company_integrations').update({ domain: new URL(feedUrl).hostname, metadata: meta }).eq('id', existing.id)
      else await admin.from('company_integrations').insert({ company_id: company.id, type: 'portal_feed', domain: new URL(feedUrl).hostname, metadata: meta, connected_at: new Date().toISOString() })

      return json({ ok: true, total: listings.length, listings })
    }

    return json({ error: 'Ação inválida' }, 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('portal-import erro:', msg)
    // Mensagem nossa (link inválido / arquivo grande) passa; erro interno não vaza.
    const known = /^(Link inválido|Arquivo grande)/.test(msg)
    return json({ error: /timed? ?out|aborted/i.test(msg) ? 'O link demorou demais pra responder. Tente de novo.' : known ? msg : 'Não consegui ler esse link agora. Tente de novo.' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
