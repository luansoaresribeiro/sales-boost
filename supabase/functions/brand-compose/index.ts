import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initWasm, Resvg } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

const W = 1080, H = 1350
const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf'

let wasmReady = false
async function ensureWasm() {
  if (wasmReady) return
  await initWasm(fetch('https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm'))
  wasmReady = true
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim()
    else { if (cur) lines.push(cur); cur = w }
    if (lines.length >= maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines.slice(0, maxLines)
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
    const type = res.headers.get('content-type') ?? 'image/png'
    return `data:${type};base64,${btoa(bin)}`
  } catch { return null }
}

function buildSvg(imgUri: string | null, primary: string, headlineLines: string[], cta: string, logoUri: string | null): string {
  const barY = H - 380
  const lineH = 78
  const headline = headlineLines.map((l, i) =>
    `<text x="64" y="${barY + 110 + i * lineH}" font-family="Poppins" font-weight="700" font-size="62" fill="#ffffff">${esc(l)}</text>`
  ).join('')
  const ctaY = barY + 130 + headlineLines.length * lineH
  const ctaW = Math.min(760, 120 + cta.length * 24)
  const logo = logoUri ? `<image href="${logoUri}" x="${W - 190}" y="56" width="130" height="130" preserveAspectRatio="xMidYMid meet"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#000000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.82"/>
  </linearGradient></defs>
  ${imgUri ? `<image href="${imgUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${W}" height="${H}" fill="#150E08"/>`}
  <rect x="0" y="${barY - 120}" width="${W}" height="${H - barY + 120}" fill="url(#fade)"/>
  <rect x="0" y="${barY}" width="120" height="10" fill="${primary}"/>
  ${headline}
  <rect x="64" y="${ctaY}" rx="34" ry="34" width="${ctaW}" height="68" fill="${primary}"/>
  <text x="${64 + ctaW / 2}" y="${ctaY + 45}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="30" fill="#000000">${esc(cta)}</text>
  ${logo}
</svg>`
}

async function upload(admin: SupaClient, bytes: Uint8Array): Promise<string> {
  const path = `branded/${crypto.randomUUID()}.png`
  const { error } = await admin.storage.from('post-images').upload(path, bytes, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(`storage: ${error.message}`)
  const { data } = admin.storage.from('post-images').getPublicUrl(path)
  return data.publicUrl
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const env = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'), ANON: Deno.env.get('SUPABASE_ANON_KEY'),
      SERVICE: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), CRON_SECRET: Deno.env.get('CRON_SECRET'),
    }
    const admin = createClient(env.SUPABASE_URL!, env.SERVICE ?? env.ANON!)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    const bearer = req.headers.get('Authorization') ?? ''
    const isCron = env.CRON_SECRET && body.cron_secret === env.CRON_SECRET
    const isService = env.SERVICE && bearer === `Bearer ${env.SERVICE}`
    if (!isCron && !isService) {
      const userClient = createClient(env.SUPABASE_URL!, env.ANON!, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
    }

    const imageUrl = body.image_url ? String(body.image_url) : null
    const headline = String(body.headline ?? '').trim()
    const cta = String(body.cta ?? 'Saiba mais').trim()
    const companyId = body.company_id ? String(body.company_id) : null
    if (!headline) return json({ error: 'headline obrigatório' }, 400)

    let primary = '#FF6D29', logoUrl: string | null = null
    if (companyId) {
      const { data: dna } = await admin.from('brand_dna').select('colors, logo_url').eq('company_id', companyId).maybeSingle()
      const d = dna as { colors?: string[]; logo_url?: string | null } | null
      if (d?.colors?.[0] && /^#?[0-9a-fA-F]{3,8}$/.test(d.colors[0])) primary = d.colors[0].startsWith('#') ? d.colors[0] : `#${d.colors[0]}`
      if (d?.logo_url) logoUrl = d.logo_url
    }

    const [imgUri, logoUri, fontRes] = await Promise.all([
      imageUrl ? toDataUri(imageUrl) : Promise.resolve(null),
      logoUrl ? toDataUri(logoUrl) : Promise.resolve(null),
      fetch(FONT_URL),
    ])
    const fontBytes = new Uint8Array(await fontRes.arrayBuffer())

    const svg = buildSvg(imgUri, primary, wrap(headline, 24, 3), cta, logoUri)

    await ensureWasm()
    const resvg = new Resvg(svg, { font: { fontBuffers: [fontBytes], defaultFontFamily: 'Poppins', loadSystemFonts: false } })
    const png = resvg.render().asPng()

    const url = await upload(admin, png)
    return json({ ok: true, url, primary, used_logo: !!logoUri, used_image: !!imgUri })
  } catch (err) {
    console.error('brand-compose error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
