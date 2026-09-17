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
async function generateBg(prompt: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !key) return null
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024' }),
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
function shade(hex: string, amt: number): string {
  const h = (hex || '#000').replace('#', ''); const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0'), 16)
  const cl = (v: number) => Math.max(0, Math.min(255, v)); const r = cl((num >> 16) + amt), g = cl(((num >> 8) & 0xff) + amt), b = cl((num & 0xff) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

interface Brand { primary: string; name: string; primary2?: string; accent?: string; accent2?: string; text?: string; bg?: string; logoUrl?: string }
type F = Record<string, string>

// ── SVG por template ────────────────────────────────────────────────────────
function svgTweet(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080, dark = (f.theme || 'dark') === 'dark'
  const bg = dark ? '#15202b' : '#ffffff', fg = dark ? '#e7e9ea' : '#0f1419', muted = dark ? '#8b98a5' : '#536471', line = dark ? '#38444d' : '#eff3f4'
  const tl = wrap(f.text || 'O texto do tweet aparece aqui.', 44, 900)
  const bodyY = 340, afterBody = bodyY + tl.length * 60 + 30
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${bg}"/>
<circle cx="150" cy="185" r="48" fill="${b.primary}"/>
<text x="150" y="200" font-family="Poppins" font-size="38" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials(f.name))}</text>
${block([f.name || 'Nome'], 226, 172, 36, fg, 700, 0)}
${block(['@' + (f.handle || 'usuario')], 226, 214, 30, muted, 400, 0)}
${block(tl, 90, bodyY, 44, fg, 500, 60)}
${block([`${f.time || '14:22'} · ${f.date || 'hoje'}`], 90, afterBody, 26, muted, 400, 0)}
<rect x="90" y="${afterBody + 26}" width="900" height="2" fill="${line}"/>
${block([`${f.retweets || '128'} Retuites     ${f.likes || '1.204'} Curtidas`], 90, afterBody + 78, 28, muted, 700, 0)}
</svg>`
  return { svg, w: W, h: H }
}

function svgQuote(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080
  const ql = wrap(f.quote || 'A frase de efeito que resume a sua marca vai aqui.', 58, 860)
  const startY = 470 - (ql.length * 74) / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.primary}"/><stop offset="1" stop-color="${shade(b.primary, -30)}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<text x="110" y="300" font-family="Poppins" font-size="200" font-weight="700" fill="#ffffff" opacity="0.3">&#8220;</text>
${block(ql, 110, startY, 58, '#ffffff', 700, 74)}
<circle cx="146" cy="900" r="40" fill="#ffffff" fill-opacity="0.2"/>
<text x="146" y="913" font-family="Poppins" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials(f.author || b.name))}</text>
${block([f.author || b.name], 206, 892, 32, '#ffffff', 700, 0)}
${f.role ? block([f.role], 206, 928, 24, '#ffffff', 400, 0) : ''}
</svg>`
  return { svg, w: W, h: H }
}

function svgAnnouncement(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350, text = b.text || '#ffffff', bg = b.bg || '#0E0B0A'
  const hl = wrap(f.headline || 'Sua chamada principal', 88, 880)
  let y = 470
  const parts: string[] = []
  if (f.eyebrow) { parts.push(block([f.eyebrow.toUpperCase()], 100, y, 30, b.primary, 700, 0)); y += 56 }
  parts.push(block(hl, 100, y + 20, 88, text, 700, 100)); y += 20 + hl.length * 100 + 20
  if (f.subtext) { const sl = wrap(f.subtext, 38, 880); parts.push(block(sl, 100, y + 20, 38, '#BABABA', 400, 52)); y += 20 + sl.length * 52 + 20 }
  if (f.offer) { const ow = (f.offer.length * 27) + 80; parts.push(`<rect x="100" y="${y}" width="${ow}" height="86" rx="18" fill="${b.accent || b.primary}"/>` + block([f.offer], 140, y + 58, 46, '#000', 700, 0)); y += 130 }
  if (f.cta) { const cw = (f.cta.length * 20) + 90; parts.push(`<rect x="100" y="${y}" width="${cw}" height="76" rx="38" fill="none" stroke="${b.primary}" stroke-width="3"/>` + block([f.cta + '  →'], 140, y + 50, 34, text, 700, 0)) }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function svgStat(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080, text = b.text || '#ffffff', bg = b.bg || '#150E08'
  const cl = wrap(f.context || '', 42, 820)
  const parts: string[] = []
  if (f.label) parts.push(block([f.label], 540, 360, 38, '#BABABA', 700, 0, 'middle'))
  parts.push(block([f.value || '87%'], 540, 620, 200, b.primary, 700, 0, 'middle'))
  if (cl[0]) parts.push(block(cl, 540, 720, 42, text, 400, 54, 'middle'))
  if (f.source) parts.push(block([f.source], 540, 720 + cl.length * 54 + 50, 24, '#7a7a7a', 400, 0, 'middle'))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
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
  if (f.cta) { const ch = Math.round(72 * s), cw = Math.round(f.cta.length * cs * 0.62 + 90 * s); blocks.push({ h: ch, draw: y => `<rect x="${leftX}" y="${y}" width="${cw}" height="${ch}" rx="${Math.round(ch / 2)}" fill="#ffffff"/>` + block([f.cta + '  →'], leftX + Math.round(38 * s), y + Math.round(ch * 0.66), cs, '#000', 700, 0) }) }
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

// ── Formas SVG (o resvg só carrega Poppins → setas/estrelas viram tofu como
// glifo; desenhamos como shapes pra bater com o preview do cliente). ──────────
function starShape(cx: number, cy: number, r: number, fill: string): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2; const rad = i % 2 ? r * 0.42 : r; pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`) }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`
}
function starsRow(x: number, y: number, n: number, r: number, fill: string): string {
  let s = ''; for (let i = 0; i < n; i++) s += starShape(x + r + i * (r * 2.5), y, r, fill); return s
}
function downArrow(cx: number, y: number, size: number, fill: string): string {
  return `<path d="M${cx} ${y} L${cx} ${y + size} M${cx - size * 0.42} ${y + size * 0.58} L${cx} ${y + size} L${cx + size * 0.42} ${y + size * 0.58}" stroke="${fill}" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
}
function upRightArrow(x: number, y: number, size: number, fill: string): string {
  return `<path d="M${x} ${y + size} L${x + size} ${y} M${x + size * 0.34} ${y} L${x + size} ${y} L${x + size} ${y + size * 0.66}" stroke="${fill}" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
}

function svgProblem(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350, text = b.text || '#ffffff', bg = b.bg || '#0E0B0A'
  const pl = wrap(f.problem || '"Tenho muitos leads, mas poucas vendas."', 64, 880)
  const rl = wrap(f.reframe || 'Talvez o problema não seja tráfego.', 46, 880)
  const il = f.insight ? wrap(f.insight, 42, 880) : []
  let y = 360
  const parts: string[] = []
  parts.push(block([(f.eyebrow || 'Um problema comum').toUpperCase()], 100, y, 30, b.primary, 700, 0)); y += 66
  parts.push(block(pl, 100, y + 40, 64, text, 700, 78)); y += 40 + pl.length * 78 + 20
  parts.push(downArrow(140, y + 20, 84, b.primary)); y += 130
  parts.push(block(rl, 100, y + 40, 46, '#BABABA', 600, 60)); y += 40 + rl.length * 60
  if (il.length) parts.push(block(il, 100, y + 44, 42, text, 800, 54))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function svgFaq(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350, text = b.text || '#ffffff', bg = b.bg || '#0E0B0A'
  const ql = wrap(f.question || '"Quanto tempo demora?"', 42, 620)
  const al = wrap(f.answer || 'Normalmente X dias — e a gente te avisa em cada etapa.', 40, 620)
  const parts: string[] = []
  parts.push(block([(f.eyebrow || 'Você perguntou').toUpperCase()], 100, 300, 30, b.primary, 700, 0))
  // Bolha do cliente (esquerda)
  const qBoxH = 70 + ql.length * 52 + 30
  let y = 360
  parts.push(`<rect x="100" y="${y}" width="720" height="${qBoxH}" rx="30" fill="#ffffff" fill-opacity="0.08"/>`)
  parts.push(block(['CLIENTE'], 140, y + 54, 22, '#BABABA', 700, 0))
  parts.push(block(ql, 140, y + 108, 42, text, 700, 52))
  y += qBoxH + 40
  // Bolha da marca (direita)
  const aBoxH = 70 + al.length * 50 + 30
  const ax = W - 100 - 720
  parts.push(`<rect x="${ax}" y="${y}" width="720" height="${aBoxH}" rx="30" fill="${b.primary}"/>`)
  parts.push(block([(b.name || 'A GENTE').toUpperCase()], ax + 40, y + 54, 22, '#ffffff', 700, 0))
  parts.push(block(al, ax + 40, y + 108, 40, '#ffffff', 700, 50))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function svgTrend(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350, text = b.text || '#ffffff', bg = b.bg || '#0E0B0A'
  const items = (f.items || 'Personalização\nAtendimento imediato\nBusca por experiência').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5)
  const tl = wrap(f.title || 'O que está transformando o seu mercado', 58, 880)
  const parts: string[] = []
  let y = 300
  parts.push(block([(f.eyebrow || 'Tendência do setor').toUpperCase()], 100, y, 30, b.primary, 700, 0)); y += 62
  parts.push(block(tl, 100, y + 40, 58, text, 800, 70)); y += 40 + tl.length * 70 + 50
  for (let i = 0; i < items.length; i++) {
    parts.push(block([String(i + 1).padStart(2, '0')], 100, y + 42, 40, b.primary, 800, 0))
    parts.push(block(wrap(items[i], 40, 760), 200, y + 42, 40, text, 600, 48))
    y += Math.max(70, wrap(items[i], 40, 760).length * 48 + 26)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function svgMarketWatch(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080, text = b.text || '#ffffff', bg = b.bg || '#150E08'
  const hl = wrap(f.headline || 'O que está mudando no seu mercado?', 56, 880)
  const il = wrap(f.insight || 'dos negócios do seu segmento já usam essa estratégia.', 40, 880)
  const parts: string[] = []
  let y = 250
  parts.push(block([(f.eyebrow || 'Market Watch').toUpperCase()], 100, y, 30, b.primary, 700, 0)); y += 60
  parts.push(block(hl, 100, y + 30, 56, text, 800, 68)); y += 30 + hl.length * 68 + 20
  parts.push(upRightArrow(100, y + 10, 90, b.primary))
  parts.push(block([f.value || '42%'], 230, y + 110, 140, b.primary, 800, 0)); y += 170
  parts.push(block(il, 100, y + 40, 40, '#BABABA', 600, 52)); y += 40 + il.length * 52
  if (f.source) parts.push(block([f.source], 100, y + 40, 24, '#7a7a7a', 400, 0))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function svgReview(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080, text = b.text || '#ffffff', bg = b.bg || '#0E0B0A'
  const n = Math.max(1, Math.min(5, parseInt(f.stars || '5') || 5))
  const tl = wrap('“' + (f.text || 'Atendimento impecável e resultado que superou a expectativa.') + '”', 50, 880)
  const parts: string[] = []
  let y = 250
  parts.push(block([(f.eyebrow || 'O que dizem de nós').toUpperCase()], 100, y, 30, b.primary, 700, 0)); y += 50
  parts.push(starsRow(112, y + 40, n, 28, '#FBBF24')); y += 90
  parts.push(block(tl, 100, y + 40, 50, text, 700, 64)); y += 40 + tl.length * 64 + 40
  parts.push(`<circle cx="140" cy="${y + 30}" r="40" fill="${b.primary}"/>`)
  parts.push(`<text x="140" y="${y + 43}" font-family="Poppins" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials(f.author || 'Cliente'))}</text>`)
  parts.push(block([f.author || 'João, cliente'], 202, y + 22, 30, text, 800, 0))
  if (f.source) parts.push(block([f.source], 202, y + 58, 22, '#BABABA', 400, 0))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function buildSvg(template: string, f: F, b: Brand, bg: string | null, logo: string | null, sticker: string | null, W: number, H: number, safe: Safe): { svg: string; w: number; h: number } {
  switch (template) {
    case 'tweet': return svgTweet(f, b)
    case 'quote': return svgQuote(f, b)
    case 'announcement': return svgAnnouncement(f, b)
    case 'stat': return svgStat(f, b)
    case 'problem': return svgProblem(f, b)
    case 'faq': return svgFaq(f, b)
    case 'trend': return svgTrend(f, b)
    case 'market_watch': return svgMarketWatch(f, b)
    case 'review': return svgReview(f, b)
    case 'photo': return svgPhoto(f, b, bg, logo, sticker, W, H, safe)
    default: return svgQuote(f, b)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    // Autoteste (sem empresa): valida que wasm + fontes + resvg funcionam aqui.
    if (body.selftest) {
      await ensureEngine()
      const brand = { primary: '#FF6D29', name: 'Test' }
      const sizes: Record<string, number> = {}
      for (const t of ['stat', 'problem', 'faq', 'trend', 'market_watch', 'review', 'quote', 'announcement', 'tweet']) {
        const { svg, w } = buildSvg(t, { value: '42%', stars: '4', items: 'Um\nDois\nTrês' }, brand, null, null, null, 1080, 1080, { top: 60, right: 80, bottom: 90, left: 80 })
        sizes[t] = renderPng(svg, w).length
      }
      return json({ ok: true, sizes })
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

    const template = String(body.template ?? 'quote')
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
      bgUrl = await generateBg(`Professional social media background photo. ${subj}. ${palette} Warm natural lighting, appetizing, room at the bottom for text overlay, no people, no text, no logos, no watermark.`)
    }
    const bgData = bgUrl ? await toDataUri(bgUrl) : null
    const logoData = template === 'photo' && brand.logoUrl ? await toDataUri(brand.logoUrl) : null
    const stickerData = template === 'photo' && body.sticker ? await toDataUri(String(body.sticker)) : null

    // Tamanho/safe do formato (só o 'photo' é adaptativo; os demais têm tamanho fixo).
    const W = Math.max(200, Math.min(4000, Number(body.width) || 1080))
    const H = Math.max(200, Math.min(4000, Number(body.height) || 1350))
    const safe = (body.safe as Safe | undefined) ?? { top: Math.round(H * 0.06), right: Math.round(W * 0.08), bottom: Math.round(H * 0.09), left: Math.round(W * 0.08) }

    await ensureEngine()
    const { svg, w } = buildSvg(template, fields, brand, bgData, logoData, stickerData, W, H, safe)
    const png = renderPng(svg, w)

    const path = `renders/${companyId}/${crypto.randomUUID()}.png`
    const { error: upErr } = await admin.storage.from('post-images').upload(path, png, { contentType: 'image/png', upsert: false })
    if (upErr) return json({ error: upErr.message }, 500)
    const { data: pub } = admin.storage.from('post-images').getPublicUrl(path)

    let id: string | null = null
    if (body.save !== false) {
      // Guarda a RECEITA de render (concept) — permite re-renderizar em qualquer
      // formato depois SEM nova IA (o background já resolvido é reusado).
      const concept = { template, fields, brand, background: bgUrl, sticker: body.sticker ? String(body.sticker) : null, format: String(body.format ?? template), width: W, height: H, safe,
        content_type: body.content_type ? String(body.content_type) : null, objective: body.objective ? String(body.objective) : null }
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
