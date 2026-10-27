// Logo em PNG transparente — lógica PURA de pixels (sem Deno, sem rede): roda no Deno
// (brand-kit-suggest) e no Node (teste). Quem decodifica/codifica PNG/JPEG é o adaptador
// `logoCodec.ts`; aqui só existe o algoritmo sobre {width,height,data RGBA}.
//
// Regras:
//  - reduz pra no máximo 1024 px no lado maior;
//  - tira só FUNDO LISO, e só a partir das BORDAS (flood-fill) — letra branca dentro do logo fica;
//  - cantos já transparentes → não mexe (bg_removed:false);
//  - cantos de cores diferentes (foto, gradiente, fundo ilustrado) → null: NÃO mexe;
//  - meanLuma = luminância relativa média dos pixels opacos (0 escuro … 1 claro), usada pelo
//    render-format pra saber se a logo some no fundo do card.

export interface Rgba { width: number; height: number; data: Uint8ClampedArray }

export const LOGO_MAX_SIDE = 1024
const PATCH = 8
const CORNER_TOL = 18      // diferença máxima (por canal) entre os 4 cantos pra contar como "mesma cor"
const PATCH_TOL = 26       // o próprio canto precisa ser liso (senão é foto)
const CORE_TOL = 16        // até aqui o pixel é fundo puro (ruído de JPEG incluso)
const SOLID = 60           // pixel a esta distância do fundo já é "logo de verdade"
const MAX_REMOVED = 0.97   // se o fundo cobriria quase a imagem toda, não mexe

export interface LogoResult { img: Rgba; bg_removed: boolean; luma: number | null; luma_lo: number | null; luma_hi: number | null }

// ── redução (média por caixa, com alpha pré-multiplicado) ──────────────────────────────────
export function downscale(img: Rgba, maxSide = LOGO_MAX_SIDE): Rgba {
  const { width: w, height: h } = img
  if (Math.max(w, h) <= maxSide) return img
  const k = maxSide / Math.max(w, h)
  const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k))
  const out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y / k), y1 = Math.max(y0 + 1, Math.min(h, Math.floor((y + 1) / k)))
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x / k), x1 = Math.max(x0 + 1, Math.min(w, Math.floor((x + 1) / k)))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * w + xx) * 4, al = img.data[i + 3]
        r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++
      }
      const o = (y * nw + x) * 4
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a }
      out[o + 3] = n ? a / n : 0
    }
  }
  return { width: nw, height: nh, data: out }
}

// ── amostras de borda ──────────────────────────────────────────────────────────────────────
interface Sample { r: number; g: number; b: number; a: number; spread: number }
function patchAt(img: Rgba, cx: number, cy: number): Sample {
  const { width: w, height: h, data } = img
  const half = Math.max(1, Math.min(PATCH, Math.floor(Math.min(w, h) / 4)))
  const x0 = Math.max(0, Math.min(w - half, cx)), y0 = Math.max(0, Math.min(h - half, cy))
  let r = 0, g = 0, b = 0, a = 0, n = 0
  for (let y = y0; y < y0 + half; y++) for (let x = x0; x < x0 + half; x++) { const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; n++ }
  r /= n; g /= n; b /= n; a /= n
  let spread = 0
  for (let y = y0; y < y0 + half; y++) for (let x = x0; x < x0 + half; x++) {
    const i = (y * w + x) * 4
    spread = Math.max(spread, Math.abs(data[i] - r), Math.abs(data[i + 1] - g), Math.abs(data[i + 2] - b))
  }
  return { r, g, b, a, spread }
}

const dist = (data: Uint8ClampedArray, i: number, r: number, g: number, b: number) =>
  Math.max(Math.abs(data[i] - r), Math.abs(data[i + 1] - g), Math.abs(data[i + 2] - b))

/** Luminância relativa (0..1) média dos pixels opacos (alpha ≥ 128). null se não há pixel opaco. */
export function meanLuma(img: Rgba): number | null {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  let sum = 0, n = 0
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue
    sum += 0.2126 * lin(img.data[i]) + 0.7152 * lin(img.data[i + 1]) + 0.0722 * lin(img.data[i + 2]); n++
  }
  return n ? Math.round((sum / n) * 1000) / 1000 : null
}

/** Luminância dos pixels opacos nos percentis 20 e 80: o "escuro" e o "claro" relevantes do logo (a média engana: ícone laranja + letras azul-escuras dá média média). */
export function lumaRange(img: Rgba): { lo: number; hi: number } | null {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  const hist = new Uint32Array(1001)
  let n = 0
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue
    hist[Math.round((0.2126 * lin(img.data[i]) + 0.7152 * lin(img.data[i + 1]) + 0.0722 * lin(img.data[i + 2])) * 1000)]++; n++
  }
  if (!n) return null
  const at = (q: number) => { let acc = 0; const target = Math.ceil(n * q); for (let b = 0; b <= 1000; b++) { acc += hist[b]; if (acc >= target) return b / 1000 } return 1 }
  return { lo: at(0.2), hi: at(0.8) }
}

/**
 * Tira o fundo liso. Devolve:
 *  - { bg_removed:false } com a MESMA imagem se os cantos já são transparentes;
 *  - { bg_removed:true } com o fundo transparente (e a borda "des-franjada") se os 4 cantos têm a mesma cor;
 *  - null se os cantos são diferentes / não lisos / o fundo cobriria quase tudo (não mexe).
 */
export function removeFlatBackground(src: Rgba): { img: Rgba; bg_removed: boolean } | null {
  const { width: w, height: h } = src
  if (w < 4 || h < 4) return null
  const half = Math.max(1, Math.min(PATCH, Math.floor(Math.min(w, h) / 4)))
  const corners = [patchAt(src, 0, 0), patchAt(src, w - half, 0), patchAt(src, 0, h - half), patchAt(src, w - half, h - half)]
  if (corners.every(c => c.a < 10)) return { img: src, bg_removed: false }
  if (corners.some(c => c.a < 200)) return null                  // mistura de transparente com opaco: não arrisca
  if (corners.some(c => c.spread > PATCH_TOL)) return null       // canto não liso = foto/ilustração
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = corners[i], b = corners[j]
    if (Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)) > CORNER_TOL) return null
  }
  const br = corners.reduce((s, c) => s + c.r, 0) / 4, bgc = corners.reduce((s, c) => s + c.g, 0) / 4, bb = corners.reduce((s, c) => s + c.b, 0) / 4

  const data = new Uint8ClampedArray(src.data)                   // cópia: a original não muda
  const N = w * h
  const state = new Uint8Array(N)                                // 0 = ainda não visto, 1 = fundo puro (core), 2 = anel de borda
  const stack: number[] = []
  const seed = (x: number, y: number) => { const p = y * w + x; if (!state[p] && dist(src.data, p * 4, br, bgc, bb) <= CORE_TOL) { state[p] = 1; stack.push(p) } }
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1) }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y) }
  let removed = 0
  while (stack.length) {
    const p = stack.pop()!; removed++
    const x = p % w, y = (p - x) / w
    if (x > 0) seed(x - 1, y)
    if (x < w - 1) seed(x + 1, y)
    if (y > 0) seed(x, y - 1)
    if (y < h - 1) seed(x, y + 1)
  }
  if (removed === 0) return { img: src, bg_removed: false }
  // (Rodada 1 do QA tentou apagar "furos de letra" aqui; foi REVERTIDO na rodada 2: apagava texto branco dentro de selo/retângulo coloridos.
  // Só o fundo ligado às bordas sai; o miolo de uma letra fica com a cor do fundo original.)
  if (removed / N > MAX_REMOVED) return null

  // fundo puro → transparente
  for (let p = 0; p < N; p++) if (state[p] === 1) { data[p * 4 + 3] = 0 }

  // anel de 2 px em volta do fundo: separa o logo do fundo (alpha parcial) e "des-franja"
  // (tira o resto de branco/cor do fundo da cor do pixel) usando a cor sólida mais próxima.
  const ring: number[] = []
  const nb = (p: number): number[] => {
    const x = p % w, y = (p - x) / w, o: number[] = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const xx = x + dx, yy = y + dy
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) o.push(yy * w + xx)
    }
    return o
  }
  for (let p = 0; p < N; p++) if (state[p] === 1) for (const q of nb(p)) if (state[q] === 0) { state[q] = 2; ring.push(q) }
  const ring2: number[] = []
  for (const p of ring) for (const q of nb(p)) if (state[q] === 0) { state[q] = 3; ring2.push(q) }
  const fixes: [number, number, number, number, number][] = []
  for (const p of [...ring, ...ring2]) {
    const i = p * 4, x = p % w, y = (p - x) / w
    const d = dist(src.data, i, br, bgc, bb)
    if (d <= CORE_TOL) { fixes.push([p, 0, 0, 0, 0]); continue }
    // cor sólida mais próxima (janela 7x7), longe do fundo e fora do fundo puro
    let best = -1, bestD = SOLID - 1
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      const q = yy * w + xx
      if (state[q] === 1) continue
      const dq = dist(src.data, q * 4, br, bgc, bb)
      if (dq > bestD) { bestD = dq; best = q }
    }
    if (best < 0) continue                                       // sem cor sólida por perto: pixel fica como está
    const fr = src.data[best * 4], fg = src.data[best * 4 + 1], fb = src.data[best * 4 + 2]
    const vr = fr - br, vg = fg - bgc, vb = fb - bb
    const den = vr * vr + vg * vg + vb * vb
    const t = den ? ((src.data[i] - br) * vr + (src.data[i + 1] - bgc) * vg + (src.data[i + 2] - bb) * vb) / den : 1
    const a = Math.max(0, Math.min(1, t))
    if (a >= 0.97) continue
    if (a < 0.04) fixes.push([p, 0, 0, 0, 0])
    else fixes.push([p, fr, fg, fb, Math.round(a * 255)])
  }
  for (const [p, r, g, b, a] of fixes) { const i = p * 4; if (a === 0) { data[i + 3] = 0 } else { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a } }
  return { img: { width: w, height: h, data }, bg_removed: true }
}

/** Pipeline puro: reduz, tira fundo liso (ou não), calcula a luminância. null = fundo NÃO liso (não mexe). */
export function processLogoPixels(src: Rgba): LogoResult | null {
  const small = downscale(src)
  const r = removeFlatBackground(small)
  if (!r) return null
  const rg = lumaRange(r.img)
  return { img: r.img, bg_removed: r.bg_removed, luma: meanLuma(r.img), luma_lo: rg?.lo ?? null, luma_hi: rg?.hi ?? null }
}

// ── metadados que vão pro banco (brand_dna.logo_meta) ──────────────────────────────────────
export interface LogoMeta { src: string; png_url: string | null; kind: 'logo' | 'foto'; luma: number | null; luma_lo?: number | null; luma_hi?: number | null; bg_removed: boolean; w?: number; h?: number }

/** O PNG só vale se foi feito PARA a logo que está no Kit agora (anti logo velha). */
export function usableLogoMeta(meta: unknown, currentLogoUrl: string | null | undefined): LogoMeta | null {
  const m = meta as Partial<LogoMeta> | null
  if (!m || typeof m !== 'object' || !currentLogoUrl || m.src !== currentLogoUrl) return null
  if (m.kind !== 'logo' && m.kind !== 'foto') return null
  return { src: m.src, png_url: typeof m.png_url === 'string' ? m.png_url : null, kind: m.kind, luma: typeof m.luma === 'number' ? m.luma : null, luma_lo: typeof m.luma_lo === 'number' ? m.luma_lo : null, luma_hi: typeof m.luma_hi === 'number' ? m.luma_hi : null, bg_removed: !!m.bg_removed, w: typeof m.w === 'number' ? m.w : undefined, h: typeof m.h === 'number' ? m.h : undefined }
}

// ── logo trocado por qualquer caminho → preparar sozinho (2026-10-26, "Tudo automático") ───────
// Marca de tentativa guardada no PRÓPRIO jsonb logo_meta (sem coluna nova): attempted_at, attempt_src,
// attempt_status ('started' | 'foto'). Sem `src`/`kind` válidos ela nunca vale como logo preparado
// (usableLogoMeta continua devolvendo null), então a peça segue com o logo de sempre.
export const LOGO_RETRY_MS = 60 * 60 * 1000

/** Devolve true quando vale disparar o preparo em segundo plano. Pura. */
export function shouldPrepareLogo(meta: unknown, currentLogoUrl: string | null | undefined, nowMs = Date.now()): boolean {
  if (!currentLogoUrl) return false
  if (usableLogoMeta(meta, currentLogoUrl)) return false                     // já preparado pra ESTE logo
  const m = (meta && typeof meta === 'object' ? meta : {}) as { attempted_at?: unknown; attempt_src?: unknown; attempt_status?: unknown }
  if (m.attempt_src !== currentLogoUrl) return true                          // nunca tentou este logo
  if (m.attempt_status === 'foto') return false                              // IA disse foto: não insiste neste link
  const t = typeof m.attempted_at === 'string' ? Date.parse(m.attempted_at) : NaN
  return !Number.isFinite(t) || nowMs - t >= LOGO_RETRY_MS                   // tentou há menos de 1 h → espera
}

// ── URL colada pelo dono: só https público (nada de IP, localhost, rede interna) ─────────────
export function isSafeLogoUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'https:' || u.username || u.password) return false
  const host = u.hostname.toLowerCase().replace(/\.+$/, '')   // "localhost." e "x.internal." são o mesmo host
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host.startsWith('[')) return false   // IP literal v4/v6
  if (/^\d+$/.test(host.replace(/\./g, '')) ) return false
  return true
}

// ── contraste logo × fundo (pra decidir a pílula atrás) ───────────────────────────────────
export function hexLuma(hex: string): number | null {
  const h = String(hex ?? '').replace('#', '')
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(f)) return null
  const c = [0, 2, 4].map(i => { const v = parseInt(f.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

const cr = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
/**
 * Cor da pílula discreta atrás da logo quando alguma parte relevante dela some no fundo; null = não precisa.
 * `logo` = { lo, hi } (percentis 20/80 da luminância dos pixels opacos) ou um número só (meta antigo, só a média).
 * A pílula é a cor (branca ou quase preta) que mais contrasta com o PIOR dos dois extremos do logo.
 */
export function logoBackdrop(logo: number | { lo?: number | null; hi?: number | null; mean?: number | null } | null | undefined, bgLuma: number | null): '#ffffff' | '#111111' | null {
  if (bgLuma == null || logo == null) return null
  let lo: number, hi: number
  if (typeof logo === 'number') { lo = hi = logo } else {
    const m = typeof logo.mean === 'number' ? logo.mean : null
    const a = typeof logo.lo === 'number' ? logo.lo : m, b = typeof logo.hi === 'number' ? logo.hi : m
    if (a == null || b == null) return null
    lo = a; hi = b
  }
  if (Math.min(cr(lo, bgLuma), cr(hi, bgLuma)) >= 2.2) return null
  const WHITE = 1, DARK = 0.006
  return Math.min(cr(lo, WHITE), cr(hi, WHITE)) >= Math.min(cr(lo, DARK), cr(hi, DARK)) ? '#ffffff' : '#111111'
}

// ── tamanho da imagem lido do CABEÇALHO (antes de decodificar): PNG 12000x12000 não pode derrubar a função ──
export const MAX_IMG_SIDE = 8000
export const MAX_IMG_PIXELS = 40_000_000
/** Largura x altura de PNG (IHDR) ou JPEG (SOF) sem decodificar. null = formato que não é PNG/JPEG ou cabeçalho quebrado. */
export function imageDims(b: Uint8Array): { w: number; h: number; type: 'png' | 'jpeg' } | null {
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { w: u32(16), h: u32(20), type: 'png' }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1]
      if (m === 0xff) { i++; continue }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue }
      const len = (b[i + 2] << 8) | b[i + 3]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], type: 'jpeg' }
      if (len < 2) return null
      i += 2 + len
    }
  }
  return null
}
export const dimsOk = (d: { w: number; h: number } | null): boolean => !!d && d.w > 0 && d.h > 0 && d.w <= MAX_IMG_SIDE && d.h <= MAX_IMG_SIDE && d.w * d.h <= MAX_IMG_PIXELS
