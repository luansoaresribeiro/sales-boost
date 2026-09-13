/**
 * render-format — renderizador de formatos NO SERVIDOR (sem navegador).
 *
 * Monta a imagem do formato (Print de Tweet, Card de Citação, Anúncio,
 * Estatística) como SVG e rasteriza pra PNG com resvg-wasm — 100% no servidor,
 * então funciona no piloto automático (cron), não só quando alguém está na tela.
 * NÃO usa a IA de imagem: é montagem, custo de crédito = 0.
 *
 * Fluxo: {template, fields, brand, kind, caption} → SVG → PNG → Storage → grava
 * rascunho em marketing_ai_test_content (cai na Área de Testes; nada publica).
 * `selftest:true` renderiza uma amostra e devolve o tamanho (pra validar wasm+fontes).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resvg, initWasm } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const FONT_REG = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Regular.ttf'
const FONT_BOLD = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf'

let wasmReady = false
let fontBuffers: Uint8Array[] | null = null
async function ensureEngine(): Promise<Uint8Array[]> {
  if (!wasmReady) { await initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm')); wasmReady = true }
  if (!fontBuffers) {
    const [r, b] = await Promise.all([fetch(FONT_REG).then(x => x.arrayBuffer()), fetch(FONT_BOLD).then(x => x.arrayBuffer())])
    fontBuffers = [new Uint8Array(r), new Uint8Array(b)]
  }
  return fontBuffers
}

function renderPng(svg: string, width: number): Uint8Array {
  const resvg = new Resvg(svg, { font: { fontBuffers: fontBuffers!, defaultFontFamily: 'Poppins', loadSystemFonts: false }, fitTo: { mode: 'width', value: width } })
  return resvg.render().asPng()
}

// Baixa uma imagem e embute como data URI (resvg não busca href remoto).
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url); if (!res.ok) return null
    const ct = res.headers.get('content-type') || 'image/png'
    return `data:${ct};base64,${encodeBase64(new Uint8Array(await res.arrayBuffer()))}`
  } catch { return null }
}

// Gera 1 imagem de fundo com a IA (generate-image) — só quando NÃO há asset.
async function generateBg(prompt: string, companyId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !key) return null
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024', company_id: companyId }),
    })
    const d = await res.json().catch(() => ({})) as { url?: string }
    return res.ok && d.url ? d.url : null
  } catch { return null }
}

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const initials = (n: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
// Quebra por número aproximado de caracteres por linha (Poppins ~0.55·fontSize).
function wrap(text: string, size: number, maxWidth: number): string[] {
  const max = Math.max(6, Math.floor(maxWidth / (size * 0.55)))
  const words = String(text ?? '').split(/\s+/); const lines: string[] = []; let cur = ''
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() }
  if (cur) lines.push(cur); return lines.length ? lines : ['']
}
function block(lines: string[], x: number, y: number, size: number, fill: string, weight: number, lh: number, anchor = 'start'): string {
  return `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">` +
    lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join('') + `</text>`
}
// Seta desenhada (triângulo), não caractere "→" — a fonte Poppins carregada
// no servidor não tem esse glifo (saía como um quadrado/tofu no CTA).
function arrowGlyph(cx: number, cy: number, size: number, color: string): string {
  return `<polygon points="${cx - size * 0.5},${cy - size} ${cx + size * 0.6},${cy} ${cx - size * 0.5},${cy + size}" fill="${color}"/>`
}
function shade(hex: string, amt: number): string {
  const h = (hex || '#000').replace('#', ''); const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0'), 16)
  const cl = (v: number) => Math.max(0, Math.min(255, v)); const r = cl((num >> 16) + amt), g = cl(((num >> 8) & 0xff) + amt), b = cl((num & 0xff) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
// Preto ou branco — o que tiver mais contraste contra a cor primária. Usado
// nos cards de texto puro (fundo = cor primária cheia): nunca assume que
// branco vai ler bem, já que a primária pode ser clara (ex: amarelo).
function contrastColor(hex: string): string {
  const h = (hex || '#000').replace('#', ''); const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0'), 16)
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#000000' : '#ffffff'
}
const mutedInk = (ink: string, alpha: number) => (ink === '#000000' ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`)
// Fundo cheio na cor primária (gradiente sutil) — padrão dos cards de texto
// puro (stat/announcement/mistakes). Tweet fica fiel ao tema real do X;
// beforeafter tem o fundo coberto pelas 2 fotos.
const primaryBgDef = (id: string, b: Brand) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.primary}"/><stop offset="1" stop-color="${shade(b.primary, -30)}"/></linearGradient></defs>`

interface Brand { primary: string; name: string; primary2?: string; accent?: string; accent2?: string; text?: string; bg?: string; logoUrl?: string }
type F = Record<string, string>

// ── SVG por template ────────────────────────────────────────────────────────
function svgTweet(f: F, b: Brand, logoData: string | null): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080, dark = (f.theme || 'dark') === 'dark'
  const bg = dark ? '#15202b' : '#ffffff', fg = dark ? '#e7e9ea' : '#0f1419', muted = dark ? '#8b98a5' : '#536471', line = dark ? '#38444d' : '#eff3f4'
  const tl = wrap(f.text || 'O texto do tweet aparece aqui.', 44, 900)
  const bodyY = 340, afterBody = bodyY + tl.length * 60 + 30
  // Avatar = logo real da empresa (Estilos e Visuais → Kit da Marca), quando
  // existe. Sem logo, cai pras iniciais na cor primária — nunca inventa foto.
  const avatar = logoData
    ? `<defs><clipPath id="avatarClip"><circle cx="150" cy="185" r="48"/></clipPath></defs><image href="${logoData}" x="102" y="137" width="96" height="96" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="150" cy="185" r="48" fill="${b.primary}"/><text x="150" y="200" font-family="Poppins" font-size="38" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials(f.name))}</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${bg}"/>
${avatar}
${block([f.name || 'Nome'], 226, 172, 36, fg, 700, 0)}
${block(['@' + (f.handle || 'usuario')], 226, 214, 30, muted, 400, 0)}
${block(tl, 90, bodyY, 44, fg, 500, 60)}
${block([`${f.time || '14:22'} · ${f.date || 'hoje'}`], 90, afterBody, 26, muted, 400, 0)}
<rect x="90" y="${afterBody + 26}" width="900" height="2" fill="${line}"/>
${block([`${f.retweets || '128'} Retuites     ${f.likes || '1.204'} Curtidas`], 90, afterBody + 78, 28, muted, 700, 0)}
</svg>`
  return { svg, w: W, h: H }
}

// Comparação lado a lado — ANTES (esquerda) / DEPOIS (direita), com legenda
// do resultado embaixo. beforeImg/afterImg já vêm como data URI (resvg não
// busca href remoto), pode faltar uma das duas (mostra placeholder escuro).
function svgBeforeAfter(f: F, b: Brand, beforeImg: string | null, afterImg: string | null): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350, halfW = W / 2
  const badge = (label: string, cx: number): string =>
    `<rect x="${cx - 140}" y="40" width="280" height="76" rx="38" fill="${b.primary}"/>` + block([label.toUpperCase()], cx, 90, 30, '#000', 800, 0, 'middle')
  const capLines = f.caption ? wrap(f.caption, 42, 900) : []
  const capStartY = H - 60 - (Math.max(capLines.length, 1) - 1) * 54
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${b.bg || '#0E0B0A'}"/>
${beforeImg ? `<image href="${beforeImg}" x="0" y="0" width="${halfW}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="0" y="0" width="${halfW}" height="${H}" fill="#1a1a1a"/>`}
${afterImg ? `<image href="${afterImg}" x="${halfW}" y="0" width="${halfW}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="${halfW}" y="0" width="${halfW}" height="${H}" fill="#1a1a1a"/>`}
<rect x="${halfW - 2}" y="0" width="4" height="${H}" fill="${b.primary}"/>
${badge(f.beforeLabel || 'Antes', halfW / 2)}
${badge(f.afterLabel || 'Depois', halfW + halfW / 2)}
${capLines.length ? `<defs><linearGradient id="capg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.92"/></linearGradient></defs><rect x="0" y="${H - 280}" width="${W}" height="280" fill="url(#capg)"/>${block(capLines, W / 2, capStartY, 42, '#ffffff', 800, 54, 'middle')}` : ''}
</svg>`
  return { svg, w: W, h: H }
}

// Lista educativa: 3 erros comuns do cliente ideal (icp), numerados. Puro
// texto — sem dado fabricado, o que vem de fora é sempre real (ICP da
// empresa + os 3 erros escritos pela IA de conteúdo, nunca um número solto).
function svgMistakes(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350
  const ink = contrastColor(b.primary)
  const icp = f.icp || 'cliente'
  const hl = wrap(`3 erros que todo(a) ${icp} comete`.toUpperCase(), 40, 880)
  const items = [f.mistake1, f.mistake2, f.mistake3].filter((m): m is string => !!m)
  const parts: string[] = [block(hl, 100, 160, 40, ink, 800, 54)]
  let y = 160 + hl.length * 54 + 70
  items.forEach((m, i) => {
    const lines = wrap(m, 34, 760)
    parts.push(`<text x="100" y="${y + 50}" font-family="Poppins" font-size="64" font-weight="800" fill="${mutedInk(ink, 0.55)}">${String(i + 1).padStart(2, '0')}</text>`)
    parts.push(block(lines, 220, y + 44, 34, ink, 600, 44))
    y += Math.max(lines.length * 44, 70) + 60
    if (i < items.length - 1) parts.push(`<rect x="100" y="${y - 30}" width="880" height="2" fill="${mutedInk(ink, 0.18)}"/>`)
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${primaryBgDef('mg', b)}
<rect width="${W}" height="${H}" fill="url(#mg)"/>
${parts.join('')}
</svg>`
  return { svg, w: W, h: H }
}

function svgAnnouncement(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350
  const ink = contrastColor(b.primary), chipText = ink === '#000000' ? '#ffffff' : '#000000'
  const hl = wrap(f.headline || 'Sua chamada principal', 88, 880)
  let y = 470
  const parts: string[] = []
  if (f.eyebrow) { parts.push(block([f.eyebrow.toUpperCase()], 100, y, 30, mutedInk(ink, 0.8), 700, 0)); y += 56 }
  parts.push(block(hl, 100, y + 20, 88, ink, 700, 100)); y += 20 + hl.length * 100 + 20
  if (f.subtext) { const sl = wrap(f.subtext, 38, 880); parts.push(block(sl, 100, y + 20, 38, mutedInk(ink, 0.75), 400, 52)); y += 20 + sl.length * 52 + 20 }
  if (f.offer) { const ow = (f.offer.length * 27) + 80; parts.push(`<rect x="100" y="${y}" width="${ow}" height="86" rx="18" fill="${ink}"/>` + block([f.offer], 140, y + 58, 46, chipText, 700, 0)); y += 130 }
  if (f.cta) { const cw = (f.cta.length * 20) + 130; parts.push(`<rect x="100" y="${y}" width="${cw}" height="76" rx="38" fill="none" stroke="${ink}" stroke-width="3"/>` + block([f.cta], 140, y + 50, 34, ink, 700, 0) + arrowGlyph(100 + cw - 55, y + 37, 14, ink)) }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${primaryBgDef('ag', b)}<rect width="${W}" height="${H}" fill="url(#ag)"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function svgStat(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080
  const ink = contrastColor(b.primary)
  const cl = wrap(f.context || '', 42, 820)
  const parts: string[] = []
  if (f.label) parts.push(block([f.label], 540, 360, 38, mutedInk(ink, 0.75), 700, 0, 'middle'))
  parts.push(block([f.value || '87%'], 540, 620, 200, ink, 700, 0, 'middle'))
  if (cl[0]) parts.push(block(cl, 540, 720, 42, ink, 400, 54, 'middle'))
  if (f.source) parts.push(block([f.source], 540, 720 + cl.length * 54 + 50, 24, mutedInk(ink, 0.6), 400, 0, 'middle'))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${primaryBgDef('sg', b)}<rect width="${W}" height="${H}" fill="url(#sg)"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

interface Safe { top: number; right: number; bottom: number; left: number }

// Post com foto — composer ADAPTATIVO: recebe qualquer tamanho (W×H) e safe
// areas e RECOMPÕE (não estica) o mesmo conceito. Camadas: fundo (asset/IA) +
// scrim + componente (sticker) + logo + texto/selo/cta, tudo dentro do safe.
function svgPhoto(f: F, b: Brand, bg: string | null, logo: string | null, sticker: string | null, W: number, H: number, safe: Safe): { svg: string; w: number; h: number } {
  const s = W / 1080
  const leftX = safe.left, maxW = W - safe.left - safe.right
  const hs = Math.round(84 * s), lh = Math.round(hs * 1.14), es = Math.round(30 * s), ofs = Math.round(46 * s), cs = Math.round(32 * s)
  const hlLines = wrap(f.headline || 'Sua chamada principal', hs, maxW)
  const gap = Math.round(20 * s)
  const blocks: { h: number; draw: (y: number) => string }[] = []
  if (f.eyebrow) blocks.push({ h: es + gap, draw: y => block([f.eyebrow.toUpperCase()], leftX, y + es, es, b.primary, 700, 0) })
  blocks.push({ h: hlLines.length * lh + gap, draw: y => block(hlLines, leftX, y + hs, hs, '#ffffff', 700, lh) })
  if (f.offer) { const oh = Math.round(86 * s), ow = Math.round(f.offer.length * ofs * 0.62 + 70 * s); blocks.push({ h: oh + gap, draw: y => `<rect x="${leftX}" y="${y}" width="${ow}" height="${oh}" rx="${Math.round(18 * s)}" fill="${b.accent || b.primary}"/>` + block([f.offer], leftX + Math.round(36 * s), y + Math.round(oh * 0.66), ofs, '#000', 700, 0) }) }
  if (f.cta) { const ch = Math.round(72 * s), cw = Math.round(f.cta.length * cs * 0.62 + 130 * s); blocks.push({ h: ch, draw: y => `<rect x="${leftX}" y="${y}" width="${cw}" height="${ch}" rx="${Math.round(ch / 2)}" fill="#ffffff"/>` + block([f.cta], leftX + Math.round(38 * s), y + Math.round(ch * 0.66), cs, '#000', 700, 0) + arrowGlyph(leftX + cw - Math.round(45 * s), y + Math.round(ch * 0.5), Math.round(12 * s), '#000') }) }
  const total = blocks.reduce((a, bl) => a + bl.h, 0)
  let y = H - safe.bottom - total
  const overlay = blocks.map(bl => { const svg = bl.draw(y); y += bl.h; return svg }).join('')
  const logoW = Math.round(W * 0.17), logoH = Math.round(logoW * 0.5)
  const logoSvg = logo ? `<image href="${logo}" x="${W - safe.right - logoW}" y="${safe.top}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>` : ''
  const stW = Math.round(W * 0.24)
  const stickerSvg = sticker ? `<image href="${sticker}" x="${safe.left}" y="${safe.top}" width="${stW}" height="${stW}" preserveAspectRatio="xMidYMid meet"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.9"/></linearGradient></defs>
${bg ? `<image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${W}" height="${H}" fill="${b.bg || '#0E0B0A'}"/>`}
<rect width="${W}" height="${H}" fill="url(#scrim)"/>
${logoSvg}${stickerSvg}
${overlay}
</svg>`
  return { svg, w: W, h: H }
}

function buildSvg(template: string, f: F, b: Brand, bg: string | null, logo: string | null, sticker: string | null, beforeImg: string | null, afterImg: string | null, W: number, H: number, safe: Safe): { svg: string; w: number; h: number } {
  switch (template) {
    case 'tweet': return svgTweet(f, b, logo)
    case 'beforeafter': return svgBeforeAfter(f, b, beforeImg, afterImg)
    case 'mistakes': return svgMistakes(f, b)
    case 'announcement': return svgAnnouncement(f, b)
    case 'stat': return svgStat(f, b)
    case 'photo': return svgPhoto(f, b, bg, logo, sticker, W, H, safe)
    default: return svgStat(f, b)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    // Autoteste (sem empresa): valida que wasm + fontes + resvg funcionam aqui.
    if (body.selftest) {
      await ensureEngine()
      const { svg, w } = svgStat({ value: 'OK', label: 'selftest', context: 'render server' }, { primary: '#FF6D29', name: 'Test' })
      const png = renderPng(svg, w)
      return json({ ok: true, bytes: png.length })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const admin = createClient(supabaseUrl, serviceKey)

    // Autenticação: JWT do dono (interativo) ou cron_secret (automático).
    let companyId = ''
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret && body.cron_secret === cronSecret && body.company_id) {
      companyId = String(body.company_id)
    } else {
      const bearer = req.headers.get('Authorization') ?? ''
      if (!bearer) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data: comp } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
      if (!comp) return json({ error: 'Empresa não encontrada.' }, 404)
      companyId = comp.id as string
    }

    const template = String(body.template ?? 'stat')
    const fields = (body.fields ?? {}) as F
    const brand = { primary: '#FF6D29', name: 'Marca', ...(body.brand as Partial<Brand> ?? {}) } as Brand
    const kind = ['organico', 'stories', 'campanhas'].includes(String(body.kind)) ? String(body.kind) : 'organico'
    const caption = body.caption ? String(body.caption) : null
    const subject = body.subject ? String(body.subject) : template

    // Camada de FUNDO (só pro template 'photo'): usa asset (reusa, grátis) OU
    // gera 1x com IA quando não há asset. A regra "tem asset? reusa : gera".
    let bgUrl: string | null = body.background ? String(body.background) : null
    if (template === 'photo' && !bgUrl && body.generate_bg) {
      const palette = (brand.primary ? `Brand colors ${[brand.primary, brand.primary2, brand.accent].filter(Boolean).join(', ')}.` : '')
      const subj = String(body.bg_prompt ?? subject ?? fields.headline ?? 'the business')
      bgUrl = await generateBg(`Professional social media background photo. ${subj}. ${palette} Warm natural lighting, polished, room at the bottom for text overlay, no people, no text, no logos, no watermark.`, companyId)
    }
    const bgData = bgUrl ? await toDataUri(bgUrl) : null
    // Avatar do Tweet Print = logo real da empresa (mesmo asset do Kit da
    // Marca em Estilos e Visuais) — sem logo, cai pras iniciais na svgTweet.
    const logoData = (template === 'photo' || template === 'tweet') && brand.logoUrl ? await toDataUri(brand.logoUrl) : null
    const stickerData = template === 'photo' && body.sticker ? await toDataUri(String(body.sticker)) : null
    // Antes/Depois: as 2 fotos vêm em fields.beforeImage/afterImage (URL —
    // asset real do Arquivo/Produtos, ou já geradas pela IA por quem chamou).
    const [beforeImgData, afterImgData] = template === 'beforeafter'
      ? await Promise.all([fields.beforeImage ? toDataUri(fields.beforeImage) : null, fields.afterImage ? toDataUri(fields.afterImage) : null])
      : [null, null]

    // Tamanho/safe do formato (só o 'photo' é adaptativo; os demais têm tamanho fixo).
    const W = Math.max(200, Math.min(4000, Number(body.width) || 1080))
    const H = Math.max(200, Math.min(4000, Number(body.height) || 1350))
    const safe = (body.safe as Safe | undefined) ?? { top: Math.round(H * 0.06), right: Math.round(W * 0.08), bottom: Math.round(H * 0.09), left: Math.round(W * 0.08) }

    await ensureEngine()
    const { svg, w } = buildSvg(template, fields, brand, bgData, logoData, stickerData, beforeImgData, afterImgData, W, H, safe)
    const png = renderPng(svg, w)

    const path = `renders/${companyId}/${crypto.randomUUID()}.png`
    const { error: upErr } = await admin.storage.from('post-images').upload(path, png, { contentType: 'image/png', upsert: false })
    if (upErr) return json({ error: upErr.message }, 500)
    const { data: pub } = admin.storage.from('post-images').getPublicUrl(path)

    let id: string | null = null
    if (body.save !== false) {
      // Guarda a RECEITA de render (concept) — permite re-renderizar em qualquer
      // formato depois SEM nova IA (o background já resolvido é reusado).
      const concept = { template, fields, brand, background: bgUrl, sticker: body.sticker ? String(body.sticker) : null, format: String(body.format ?? template), width: W, height: H, safe }
      const row: Record<string, unknown> = {
        company_id: companyId, kind, idea: subject, caption, format: String(body.format ?? template), image_url: pub.publicUrl, concept,
        source_id: body.source_id ? String(body.source_id) : null, origin: body.origin ? String(body.origin) : null,
      }
      if (body.status) row.status = String(body.status)
      const { data: ins, error: insErr } = await admin.from('marketing_ai_test_content').insert(row).select('id').single()
      if (insErr) return json({ error: insErr.message }, 500)
      id = ins.id as string
    }

    return json({ ok: true, url: pub.publicUrl, id, bg_url: bgUrl })
  } catch (err) {
    console.error('render-format error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
