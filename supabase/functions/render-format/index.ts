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
import { requirePaidAccess } from '../_shared/access.ts'
import { svgSlideSystem, SLIDE_LAYOUTS, type Measure, type LogoOpts } from '../_shared/slideSystem.ts'
import { usableLogoMeta, logoBackdrop, hexLuma } from '../_shared/logoPng.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// REGRA CRÍTICA (arquitetural): o gerador de imagem só desenha a CENA
// VISUAL — o texto de verdade (headline/CTA/legenda) é sempre impresso
// DEPOIS, pelo motor de cards (svgTweet/svgProduct/svgPhoto), nunca pela
// IA de imagem. Nunca manda copy real pro prompt de fundo — só o conceito
// visual — e sempre reforça pra IA deixar objetos-com-texto em branco.
const NO_TEXT_RULE = 'CRITICAL: this image must contain ONLY the visual scene — environment, people, products, objects, lighting, composition. Absolutely NO text of any kind anywhere in the image: no headlines, captions, CTAs, logos with text, signs, banners, posters, screens, labels, packaging text, watermarks, or simulated/gibberish lettering. If the scene naturally includes an object that would normally carry text (a sign, menu, screen, clipboard, label), render it completely blank — a clean empty surface. Never attempt to write, spell, or render any character.'

const FONT_REG = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Regular.ttf'
const FONT_BOLD = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf'

let wasmReady = false
let fontBuffers: Uint8Array[] | null = null
// Medição REAL do texto (largura da Poppins via opentype.js) — as mesmas fontes que o resvg usa.
// Se o opentype falhar (rede/CDN), cai na estimativa antiga (0,55·tamanho por letra) e loga:
// o render nunca falha por causa disso. Margem de 3% pra diferença de kerning entre os dois motores.
const estimateMeasure: Measure = (t, size) => t.length * size * 0.55
let measureFn: Measure = estimateMeasure
let measureReal = false
async function ensureEngine(): Promise<Uint8Array[]> {
  if (!wasmReady) { await initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm')); wasmReady = true }
  if (!fontBuffers) {
    const [r, b] = await Promise.all([fetch(FONT_REG).then(x => x.arrayBuffer()), fetch(FONT_BOLD).then(x => x.arrayBuffer())])
    fontBuffers = [new Uint8Array(r), new Uint8Array(b)]
    try {
      const ot = await import('https://esm.sh/opentype.js@1.3.4') as { parse: (b: ArrayBuffer) => { getAdvanceWidth: (t: string, s: number, o?: { kerning?: boolean }) => number } }
      const parse = ot.parse ?? (ot as unknown as { default: typeof ot }).default.parse
      const reg = parse(r), bold = parse(b)
      measureFn = (t, size, isBold) => (isBold ? bold : reg).getAdvanceWidth(t, size, { kerning: true }) * 1.03
      measureReal = true
    } catch (e) { console.error('render-format: opentype indisponível, usando estimativa de largura', e) }
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

// Logo que vai pro card (2026-10-23). Ordem: (1) logo_meta.kind 'foto' → NENHUMA logo (o card usa o
// nome da marca em texto); (2) logo_meta.src === logo atual E png_url → o PNG transparente preparado;
// (3) senão o logo de sempre (brand.logoUrl), idêntico a antes. logo_meta só vale se src === logo atual
// (anti logo velha) e a leitura é tolerante: sem a coluna/migration cai no (3).
interface ResolvedLogo { url: string | null; foto: boolean; prepared: boolean; luma: number | null; aspect: number | null }
async function resolveLogo(admin: ReturnType<typeof createClient>, companyId: string, brand: { logoUrl?: string }): Promise<ResolvedLogo> {
  const legacy: ResolvedLogo = { url: brand.logoUrl ?? null, foto: false, prepared: false, luma: null, aspect: null }
  try {
    if (!brand.logoUrl) return legacy
    const { data, error } = await admin.from('brand_dna').select('logo_meta').eq('company_id', companyId).maybeSingle()
    if (error || !data) return legacy
    const m = usableLogoMeta((data as { logo_meta?: unknown }).logo_meta, brand.logoUrl)
    if (!m) return legacy
    if (m.kind === 'foto') return { url: null, foto: true, prepared: false, luma: null, aspect: null }
    if (m.png_url) return { url: m.png_url, foto: false, prepared: true, luma: m.luma, aspect: m.w && m.h ? m.w / m.h : null }
    return legacy
  } catch (e) { console.error('render-format: resolveLogo falhou, usando o logo de sempre', e); return legacy }
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

// A fonte carregada no servidor (Poppins) não tem glifo de emoji — sem isso,
// um emoji no texto vira um quadrado/tofu visível no card (bug real visto
// pelo dono num Tweet Print). Rede de segurança final: tira qualquer emoji
// ANTES de virar SVG, independente de quem escreveu o texto (IA ou o dono
// digitando à mão) ter seguido a instrução de não usar emoji.
const stripEmoji = (s: string) => s
  .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]/gu, '')
  .replace(/[ \t]{2,}/g, ' ').trim()
const esc = (s: string) => stripEmoji(String(s ?? '')).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const initials = (n: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
// Quebra por número aproximado de caracteres por linha (Poppins ~0.55·fontSize).
function wrap(text: string, size: number, maxWidth: number): string[] {
  const max = Math.max(6, Math.floor(maxWidth / (size * 0.55)))
  const words = String(text ?? '').split(/\s+/); const lines: string[] = []; let cur = ''
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() }
  if (cur) lines.push(cur); return lines.length ? lines : ['']
}
// Rede de segurança final: wrap() já não corta no meio de uma palavra, mas
// nada limitava quantas LINHAS cabiam no card (altura do canvas é fixa).
// Texto longo demais — o dono digitando à mão em Formatos, ou a IA de
// "Preencher com IA" sem limite nenhum de tamanho — empurrava o resto pra
// fora do quadro; na prática parecia "a frase foi cortada". Cada card
// aplica isso com o número de linhas que cabe de verdade no seu layout.
function limitLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  kept[max - 1] = kept[max - 1].replace(/[.,;:!?…]*$/, '') + '…'
  return kept
}
function block(lines: string[], x: number, y: number, size: number, fill: string, weight: number, lh: number, anchor = 'start'): string {
  return `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">` +
    lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join('') + `</text>`
}
// Seta desenhada (triângulo), não caractere "→" — a fonte Poppins carregada
// no servidor não tem esse glifo (saia como um quadrado/tofu no CTA).
function arrowGlyph(cx: number, cy: number, size: number, color: string): string {
  return `<polygon points="${cx - size * 0.5},${cy - size} ${cx + size * 0.6},${cy} ${cx - size * 0.5},${cy + size}" fill="${color}"/>`
}
interface Brand { primary: string; name: string; primary2?: string; accent?: string; accent2?: string; text?: string; bg?: string; logoUrl?: string }
type F = Record<string, string>

// ── SVG por template ───────────────────────────────────────────────────────────────────────────────────
function svgTweet(f: F, b: Brand, logoData: string | null, prepared = false, backdrop: string | null = null, aspect: number | null = null): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080, dark = (f.theme || 'dark') === 'dark'
  const bg = dark ? '#15202b' : '#ffffff', fg = dark ? '#e7e9ea' : '#0f1419', muted = dark ? '#8b98a5' : '#536471', line = dark ? '#38444d' : '#eff3f4'
  const tl = limitLines(wrap(f.text || 'O texto do tweet aparece aqui.', 44, 900), 9)
  const bodyY = 340, afterBody = bodyY + tl.length * 60 + 30
  // Avatar = logo real da empresa (Estilos e Visuais → Kit da Marca), quando
  // existe. Sem logo, cai pras iniciais na cor primária — nunca inventa foto.
  // Avatar sem corte (meet); pílula atrás só no logo preparado com contraste baixo (backdrop).
  const preparedAvatar = () => {
    const dw = aspect && aspect > 0 ? Math.min(96, 96 * aspect) : 96, dh = aspect && aspect > 0 ? Math.min(96, 96 / aspect) : 96
    const pill = backdrop ? `<rect x="${Math.round(150 - dw / 2 - 8)}" y="${Math.round(185 - dh / 2 - 8)}" width="${Math.round(dw + 16)}" height="${Math.round(dh + 16)}" rx="16" fill="${backdrop}" fill-opacity="0.92"/>` : ''
    return `${pill}<image href="${logoData}" x="102" y="137" width="96" height="96" preserveAspectRatio="xMidYMid meet"/>`
  }
  // Logo (preparado ou antigo): sempre caixa sem corte (meet) — nunca círculo/slice (o dono: "nunca corta nem distorce a logo").
  const avatar = logoData
    ? preparedAvatar()
    : `<circle cx="150" cy="185" r="48" fill="${b.primary}"/><text x="150" y="200" font-family="Poppins" font-size="38" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials(f.name))}</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${bg}"/>
${avatar}
${block([f.name || 'Nome'], 226, 172, 36, fg, 700, 0)}
${block(['@' + (f.handle || 'usuario')], 226, 214, 30, muted, 400, 0)}
${block(tl, 90, bodyY, 44, fg, 500, 60)}
${f.time || f.date ? block([[f.time, f.date].filter(Boolean).join(' · ')], 90, afterBody, 26, muted, 400, 0) : ''}
${f.retweets || f.likes ? `<rect x="90" y="${afterBody + 26}" width="900" height="2" fill="${line}"/>${block([[f.retweets && `${f.retweets} Retuites`, f.likes && `${f.likes} Curtidas`].filter(Boolean).join('     ')], 90, afterBody + 78, 28, muted, 700, 0)}` : ''}
</svg>`
  return { svg, w: W, h: H }
}

// Pôster: produto centralizado, sombra de "estúdio" desfocada atrás dele,
// nome/preço/chamada embaixo. productImg já vem como data URI (a foto real
// sobe pela aba Produtos, em Estilos e Visuais). "meet" (não "slice") pra
// nunca cortar o produto — a foto inteira sempre aparece.
function svgProduct(f: F, b: Brand, productImg: string | null): { svg: string; w: number; h: number } {
  const W = 1080, H = 1350, cx = W / 2
  const parts: string[] = [`<defs><filter id="shadowBlur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="26"/></filter></defs>`]
  parts.push(`<ellipse cx="${cx}" cy="800" rx="290" ry="46" fill="rgba(0,0,0,0.55)" filter="url(#shadowBlur)"/>`)
  parts.push(productImg
    ? `<image href="${productImg}" x="${cx - 320}" y="120" width="640" height="700" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${cx - 260}" y="180" width="520" height="580" rx="24" fill="rgba(255,255,255,0.06)"/>`)
  let y = 900
  if (f.name) { parts.push(block([f.name], cx, y, 56, '#ffffff', 800, 0, 'middle')); y += 80 }
  if (f.price) { parts.push(block([f.price], cx, y, 46, b.primary, 800, 0, 'middle')); y += 90 }
  if (f.cta) {
    const cw = f.cta.length * 24 + 130
    parts.push(`<rect x="${cx - cw / 2}" y="${y}" width="${cw}" height="82" rx="41" fill="${b.primary}"/>`)
    parts.push(block([f.cta], cx - cw / 2 + 40, y + 54, 34, '#000000', 800, 0))
    parts.push(arrowGlyph(cx + cw / 2 - 48, y + 41, 13, '#000000'))
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${b.bg || '#0E0B0A'}"/>
${parts.join('')}
</svg>`
  return { svg, w: W, h: H }
}

interface Safe { top: number; right: number; bottom: number; left: number }

// Post com foto — composer ADAPTATIVO: recebe qualquer tamanho (W×H) e safe
// areas e RECOMPÕE (não estica) o mesmo conceito. Camadas: fundo (asset/IA) +
// scrim + componente (sticker) + logo + texto/selo/cta, tudo dentro do safe.
function svgPhoto(f: F, b: Brand, bg: string | null, logo: string | null, sticker: string | null, W: number, H: number, safe: Safe, lo: LogoOpts & { showName?: boolean } = {}): { svg: string; w: number; h: number } {
  // `scale` (opcional, 1 a 1,6): letras maiores pra chamar atenção (ex.: kit grátis).
  const s = (W / 1080) * Math.min(1.6, Math.max(1, Number(f.scale) || 1))
  const big = s > W / 1080 // letra maior → sombra de baixo mais forte (o texto continua legível)
  const leftX = safe.left, maxW = W - safe.left - safe.right
  const hs = Math.round(84 * s), lh = Math.round(hs * 1.14), es = Math.round(30 * s), ofs = Math.round(46 * s), cs = Math.round(32 * s)
  const hlLines = limitLines(wrap(f.headline || 'Sua chamada principal', hs, maxW), 3)
  const gap = Math.round(20 * s)
  const blocks: { h: number; draw: (y: number) => string }[] = []
  if (f.eyebrow) blocks.push({ h: es + gap, draw: y => block([f.eyebrow.toUpperCase()], leftX, y + es, es, b.primary, 700, 0) })
  blocks.push({ h: hlLines.length * lh + gap, draw: y => block(hlLines, leftX, y + hs, hs, '#ffffff', 700, lh) })
  // Pílulas nunca passam da margem: texto comprido encolhe a letra pra caber.
  const fit = (t: string, size: number, pad: number) => Math.min(size, Math.floor((maxW - pad) / Math.max(1, t.length * 0.62)))
  if (f.offer) { const ofs2 = fit(f.offer, ofs, 70 * s), oh = Math.round(86 * s), ow = Math.min(maxW, Math.round(f.offer.length * ofs2 * 0.62 + 70 * s)); blocks.push({ h: oh + gap, draw: y => `<rect x="${leftX}" y="${y}" width="${ow}" height="${oh}" rx="${Math.round(18 * s)}" fill="${b.accent || b.primary}"/>` + block([f.offer], leftX + Math.round(36 * s), y + Math.round(oh * 0.66), ofs2, '#000', 700, 0) }) }
  if (f.cta) { const cs2 = fit(f.cta, cs, 130 * s), ch = Math.round(72 * s), cw = Math.min(maxW, Math.round(f.cta.length * cs2 * 0.62 + 130 * s)); blocks.push({ h: ch, draw: y => `<rect x="${leftX}" y="${y}" width="${cw}" height="${ch}" rx="${Math.round(ch / 2)}" fill="#ffffff"/>` + block([f.cta], leftX + Math.round(38 * s), y + Math.round(ch * 0.66), cs2, '#000', 700, 0) + arrowGlyph(leftX + cw - Math.round(45 * s), y + Math.round(ch * 0.5), Math.round(12 * s), '#000') }) }
  const total = blocks.reduce((a, bl) => a + bl.h, 0)
  let y = H - safe.bottom - total
  const overlay = blocks.map(bl => { const svg = bl.draw(y); y += bl.h; return svg }).join('')
  const logoW = Math.round(W * 0.17), logoH = Math.round(logoW * 0.5)
  // Pílula atrás do logo PNG preparado quando ele some no fundo (a logo em si nunca é cortada nem distorcida).
  const lx = W - safe.right - logoW
  let logoPill = ''
  if (logo && lo.backdrop) {
    const dw = lo.aspect && lo.aspect > 0 ? Math.min(logoW, logoH * lo.aspect) : logoW, dh = lo.aspect && lo.aspect > 0 ? Math.min(logoH, logoW / lo.aspect) : logoH
    const pad = Math.round(14 * s)
    logoPill = `<rect x="${Math.round(lx + logoW / 2 - dw / 2 - pad)}" y="${Math.round(safe.top + logoH / 2 - dh / 2 - pad)}" width="${Math.round(dw + 2 * pad)}" height="${Math.round(dh + 2 * pad)}" rx="${Math.round(18 * s)}" fill="${lo.backdrop}" fill-opacity="0.92"/>`
  }
  // Sem logo (ou imagem de logo que é uma FOTO): o nome da marca em texto no canto, como no slide.
  const nm = lo.showName && !logo ? stripEmoji(String(b.name ?? '')).toUpperCase().slice(0, 28) : ''
  const nameSz = Math.max(18, Math.min(Math.round(34 * s), Math.floor((maxW * 0.55) / Math.max(1, nm.length * 0.68))))
  const nameSvg = nm ? `<text x="${W - safe.right}" y="${safe.top + nameSz}" font-family="Poppins" font-size="${nameSz}" font-weight="700" fill="#ffffff" stroke="#000000" stroke-opacity="0.35" stroke-width="${Math.max(2, Math.round(4 * s))}" stroke-linejoin="round" paint-order="stroke" text-anchor="end">${esc(nm)}</text>` : ''
  const logoSvg = logoPill + (logo ? `<image href="${logo}" x="${lx}" y="${safe.top}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>` : '') + nameSvg
  const stW = Math.round(W * 0.24)
  const stickerSvg = sticker ? `<image href="${sticker}" x="${safe.left}" y="${safe.top}" width="${stW}" height="${stW}" preserveAspectRatio="xMidYMid meet"/>` : ''
  // Selo no topo (opcional, ex.: kit grátis): pílula na cor da marca pra
  // chamar atenção no feed. Só sem sticker (os dois ocupam o mesmo canto).
  const ts = fit(f.tag ?? '', Math.round(28 * s), 64 * s), th = Math.round(64 * s), tw = Math.min(maxW, Math.round((f.tag ?? '').length * ts * 0.66 + 64 * s))
  const tagSvg = f.tag && !sticker
    ? `<rect x="${safe.left}" y="${safe.top}" width="${tw}" height="${th}" rx="${Math.round(th / 2)}" fill="${b.primary}"/>` + block([f.tag.toUpperCase()], safe.left + Math.round(32 * s), safe.top + Math.round(th * 0.66), ts, '#000', 700, 0)
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="${big ? 0.25 : 0.35}" stop-color="#000" stop-opacity="0"/><stop offset="${big ? 0.7 : 1}" stop-color="#000" stop-opacity="${big ? 0.8 : 0.9}"/><stop offset="1" stop-color="#000" stop-opacity="0.9"/></linearGradient></defs>
${bg ? `<image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${W}" height="${H}" fill="${b.bg || '#0E0B0A'}"/>`}
<rect width="${W}" height="${H}" fill="url(#scrim)"/>
${logoSvg}${stickerSvg}${tagSvg}
${overlay}
</svg>`
  return { svg, w: W, h: H }
}

// ── Formas SVG (o resvg só carrega Poppins → setas/estrelas viram tofu como
// glifo; desenhamos como shapes pra bater com o preview do cliente). ───────────
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
  const pl = limitLines(wrap(f.problem || '"Tenho muitos leads, mas poucas vendas."', 64, 880), 4)
  const rl = limitLines(wrap(f.reframe || 'Talvez o problema não seja tráfego.', 46, 880), 4)
  const il = f.insight ? limitLines(wrap(f.insight, 42, 880), 3) : []
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
  const ql = limitLines(wrap(f.question || '"Quanto tempo demora?"', 42, 620), 5)
  const al = limitLines(wrap(f.answer || 'Normalmente X dias — e a gente te avisa em cada etapa.', 40, 620), 5)
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
  const tl = limitLines(wrap(f.title || 'O que está transformando o seu mercado', 58, 880), 3)
  const parts: string[] = []
  let y = 300
  parts.push(block([(f.eyebrow || 'Tendência do setor').toUpperCase()], 100, y, 30, b.primary, 700, 0)); y += 62
  parts.push(block(tl, 100, y + 40, 58, text, 800, 70)); y += 40 + tl.length * 70 + 50
  for (let i = 0; i < items.length; i++) {
    const il = limitLines(wrap(items[i], 40, 760), 2)
    parts.push(block([String(i + 1).padStart(2, '0')], 100, y + 42, 40, b.primary, 800, 0))
    parts.push(block(il, 200, y + 42, 40, text, 600, 48))
    y += Math.max(70, il.length * 48 + 26)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, w: W, h: H }
}

function svgMarketWatch(f: F, b: Brand): { svg: string; w: number; h: number } {
  const W = 1080, H = 1080, text = b.text || '#ffffff', bg = b.bg || '#150E08'
  const hl = limitLines(wrap(f.headline || 'O que está mudando no seu mercado?', 56, 880), 3)
  const il = limitLines(wrap(f.insight || 'dos negócios do seu segmento já usam essa estratégia.', 40, 880), 3)
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
  const tl = limitLines(wrap('“' + (f.text || 'Atendimento impecável e resultado que superou a expectativa.') + '”', 50, 880), 5)
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

// 'tweet'/'product'/'photo'/'problem'/'faq'/'trend'/'market_watch'/'review'
// são os únicos templates válidos hoje (ver a regra em formatTemplates.tsx —
// TEMPLATES precisa espelhar exatamente isso). Sem match, cai em 'photo' —
// é o mais genérico/flexível. 'slide' é interno (carrossel de slides do
// creative-generate), não aparece na escolha de template do dono.
interface LogoCtx { prepared: boolean; luma: number | null; aspect: number | null; showName: boolean }
const NO_LOGO_CTX: LogoCtx = { prepared: false, luma: null, aspect: null, showName: false }
function buildSvg(template: string, f: F, b: Brand, bg: string | null, logo: string | null, sticker: string | null, productImg: string | null, W: number, H: number, safe: Safe, lc: LogoCtx = NO_LOGO_CTX): { svg: string; w: number; h: number; overflow?: boolean } {
  // Pílula atrás só com logo PNG preparado (luma conhecido); logo de sempre fica idêntica a antes.
  const pill = (bgLuma: number | null) => logo && lc.prepared ? logoBackdrop(lc.luma, bgLuma) : null
  const photoPill = (): string | null => {
    if (!logo || !lc.prepared || typeof lc.luma !== 'number') return null
    if (!bg) return pill(hexLuma(b.bg || '#0E0B0A'))
    return lc.luma > 0.75 ? '#111111' : lc.luma < 0.15 ? '#ffffff' : null   // foto de fundo: só os extremos (claro/escuro demais)
  }
  switch (template) {
    case 'tweet': return svgTweet(f, b, logo, lc.prepared, pill(hexLuma((f.theme || 'dark') === 'dark' ? '#15202b' : '#ffffff')), lc.aspect)
    case 'slide': { const r = svgSlideSystem(f, b, logo, measureFn, { backdrop: pill(hexLuma(b.bg || '#0E0B0A')), aspect: lc.aspect }); return { svg: r.svg, w: r.w, h: r.h, overflow: r.overflow } }
    case 'product': return svgProduct(f, b, productImg)
    case 'problem': return svgProblem(f, b)
    case 'faq': return svgFaq(f, b)
    case 'trend': return svgTrend(f, b)
    case 'market_watch': return svgMarketWatch(f, b)
    case 'review': return svgReview(f, b)
    case 'photo': return svgPhoto(f, b, bg, logo, sticker, W, H, safe, { backdrop: photoPill(), aspect: lc.aspect, showName: lc.showName })
    default: return svgPhoto(f, b, bg, logo, sticker, W, H, safe, { backdrop: photoPill(), aspect: lc.aspect, showName: lc.showName })
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
      const safe = { top: 60, right: 80, bottom: 90, left: 80 }
      const sizes: Record<string, number> = {}
      for (const t of ['tweet', 'slide', 'product', 'photo', 'problem', 'faq', 'trend', 'market_watch', 'review']) {
        const { svg, w } = buildSvg(t, { value: '42%', stars: '4', items: 'Um\nDois\nTrês', text: 'selftest', name: 'Test', handle: 'test' }, brand, null, null, null, null, 1080, 1080, safe)
        sizes[t] = renderPng(svg, w).length
      }
      // Layouts do sistema de slides (cada um com os campos que usa).
      const overflow: Record<string, boolean> = {}
      for (const layout of ['texto', ...SLIDE_LAYOUTS]) {
        const r = buildSvg('slide', { layout, title: 'Título de teste', text: 'Texto de teste', items: 'Um | A\nDois | B\nTrês | C', cta: 'Fale comigo', handle: 'test', page: '2', total: '5' }, brand, null, null, null, null, 1080, 1350, safe)
        sizes[`slide:${layout}`] = renderPng(r.svg, r.w).length; overflow[layout] = !!r.overflow
      }
      return json({ ok: true, sizes, overflow, measure: measureReal ? 'opentype' : 'estimativa' })
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
      // Desenhar o card (SVG→PNG) não custa nada e o kit grátis precisa disso pro
      // texto do criativo; só a imagem de FUNDO gerada por IA gasta provedor pago.
      if (body.generate_bg) {
        const noPlan = await requirePaidAccess(admin, companyId)
        if (noPlan) return noPlan
      }
    }

    const template = String(body.template ?? 'photo')
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
      // Só bg_prompt/subject (conceito visual) — NUNCA fields.headline: é o
      // texto que vai IMPRESSO no card depois (ver NO_TEXT_RULE), mandar
      // isso pro prompt de imagem ensina a IA a tentar desenhar a frase.
      const subj = String(body.bg_prompt ?? subject ?? 'the business')
      bgUrl = await generateBg(`Professional social media background photo. ${subj}. ${palette} Warm natural lighting, polished, room at the bottom for text overlay, no people. ${NO_TEXT_RULE}`, companyId)
    }
    const bgData = bgUrl ? await toDataUri(bgUrl) : null
    // Avatar do Tweet Print = logo real da empresa (mesmo asset do Kit da
    // Marca em Estilos e Visuais) — sem logo, cai pras iniciais na svgTweet.
    const wantsLogo = template === 'photo' || template === 'tweet' || template === 'slide'
    const rl: ResolvedLogo = wantsLogo ? await resolveLogo(admin, companyId, brand) : { url: null, foto: false, prepared: false, luma: null, aspect: null }
    let logoData = rl.url ? await toDataUri(rl.url) : null
    let prepared = rl.prepared
    if (!logoData && rl.prepared && brand.logoUrl) { logoData = await toDataUri(brand.logoUrl); prepared = false }   // PNG preparado indisponível → logo de sempre
    // Nome da marca em texto (card de foto sem logo): só quando o chamador mandou o nome de verdade (não o padrão "Marca").
    const showName = wantsLogo && !logoData && !!(body.brand as Partial<Brand> | undefined)?.name
    const logoCtx: LogoCtx = { prepared, luma: rl.luma, aspect: rl.aspect, showName }
    const stickerData = template === 'photo' && body.sticker ? await toDataUri(String(body.sticker)) : null
    // Foco no Produto: a foto vem de fields.productImage (URL real da aba
    // Produtos, escolhida no FormatStudio ou passada pelo Diretor Criativo).
    const productImgData = template === 'product' && fields.productImage ? await toDataUri(fields.productImage) : null

    // Tamanho/safe do formato (só o 'photo' é adaptativo; os demais têm tamanho fixo).
    const W = Math.max(200, Math.min(4000, Number(body.width) || 1080))
    const H = Math.max(200, Math.min(4000, Number(body.height) || 1350))
    const safe = (body.safe as Safe | undefined) ?? { top: Math.round(H * 0.06), right: Math.round(W * 0.08), bottom: Math.round(H * 0.09), left: Math.round(W * 0.08) }

    await ensureEngine()
    const { svg, w, overflow } = buildSvg(template, fields, brand, bgData, logoData, stickerData, productImgData, W, H, safe, logoCtx)
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

    return json({ ok: true, url: pub.publicUrl, id, bg_url: bgUrl, overflow: !!overflow })
  } catch (err) {
    console.error('render-format error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
