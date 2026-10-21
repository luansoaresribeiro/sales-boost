// Sistema de slides do carrossel (Fase 1 de PLANO-CRIATIVOS.md). Função PURA: recebe os
// campos, a marca, a logo (data URI) e um "medidor" de texto e devolve o SVG — por isso roda
// no Deno (render-format) e no Node (teste). Nada de rede, nada de Deno.* aqui.
//
// Regras do sistema:
//  - texto medido de verdade (Measure = largura real da Poppins); quebra por largura;
//  - cabe? reduz a letra até o mínimo; não coube mesmo assim → overflow=true (nunca
//    corta no meio, nunca "…") e quem chamou pede um texto mais curto;
//  - logo + @ no topo, contador "2/5" e barra de progresso embaixo, "arraste" com seta
//    DESENHADA (a Poppins não tem "→"); sem emoji (a Poppins não tem os glifos).
//  - capa com número fica fora desta fase (regra 5: número só com fonte).

export type Measure = (text: string, size: number, bold: boolean) => number
export interface SlideBrand { primary: string; name: string; bg?: string; text?: string; accent?: string }
export type SlideFields = Record<string, string>
export interface Tok { w: string; hl: boolean }
export interface DrawnLine { text: string; x0: number; x1: number; y: number; size: number; bold: boolean; box: [number, number] }
export interface SlideOut { svg: string; w: number; h: number; overflow: boolean; layout: string; drawn: DrawnLine[] }

export const SLIDE_W = 1080
export const SLIDE_H = 1350
export const SLIDE_LAYOUTS = ['capa', 'lista', 'passos', 'comparacao', 'destaque', 'fecho'] as const
export const COVER_STYLES = ['gancho', 'pergunta', 'lista'] as const

const M = 90, RIGHT = SLIDE_W - M, CW = SLIDE_W - 2 * M
const BODY_TOP = 230, BODY_BOT = 1150, BODY_H = BODY_BOT - BODY_TOP

// ── texto ──────────────────────────────────────────────────────────────────────────────────
// A Poppins carregada no servidor não tem emoji/setas/dingbats (viram quadrado).
export const clean = (s: string) => String(s ?? '')
  .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]/gu, '')
const esc = (s: string) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

/** Palavras com destaque: `*palavra*` no texto e/ou f.highlight ("palavra" ou "duas palavras", vírgula separa). */
export function tokenize(raw: string, highlight?: string): Tok[] {
  const text = clean(raw).replace(/[ \t\r\n]+/g, ' ').trim()
  const toks: Tok[] = []
  let hl = false, prev = ''
  for (const part of text.split('*')) {
    const words = part.split(' ').filter(Boolean)
    // pontuação colada no fim do trecho marcado ("*foo*,") continua parte da mesma palavra
    if (words.length && toks.length && prev !== '' && !/\s$/.test(prev) && !/^\s/.test(part)) toks[toks.length - 1].w += words.shift()!
    for (const w of words) toks.push({ w, hl })
    hl = !hl; prev = part
  }
  for (const phrase of String(highlight ?? '').split(/[,;|]/)) {
    const ws = phrase.split(/\s+/).map(norm).filter(Boolean)
    if (!ws.length) continue
    for (let i = 0; i + ws.length <= toks.length; i++) {
      if (ws.every((w, j) => norm(toks[i + j].w) === w)) for (let j = 0; j < ws.length; j++) toks[i + j].hl = true
    }
  }
  return toks
}

const lineText = (l: Tok[]) => l.map(t => t.w).join(' ')

function breakLines(toks: Tok[], size: number, maxW: number, bold: boolean, m: Measure): Tok[][] {
  const lines: Tok[][] = []
  let cur: Tok[] = []
  for (const t of toks) {
    const next = [...cur, t]
    if (cur.length && m(lineText(next), size, bold) > maxW) { lines.push(cur); cur = [t] } else cur = next
  }
  if (cur.length) lines.push(cur)
  return lines
}
const widest = (lines: Tok[][], size: number, bold: boolean, m: Measure) => lines.reduce((a, l) => Math.max(a, m(lineText(l), size, bold)), 0)

export interface Fit { lines: Tok[][]; size: number; lh: number; height: number; overflow: boolean }
export interface FitOpts { bold?: boolean; lh?: number; highlight?: string }

/**
 * Quebra por largura real e reduz a letra (de sizeMax até sizeMin) até caber em
 * maxLines linhas e/ou maxH de altura. Não coube mesmo no mínimo → overflow=true
 * (as linhas voltam no tamanho mínimo; nunca corta nem põe "…").
 */
export function fitText(text: string | Tok[], maxW: number, limits: { maxLines?: number; maxH?: number }, sizeMax: number, sizeMin: number, m: Measure, o: FitOpts = {}): Fit {
  const toks = typeof text === 'string' ? tokenize(text, o.highlight) : text
  const bold = o.bold !== false, ratio = o.lh ?? 1.2
  if (!toks.length) return { lines: [], size: sizeMin, lh: Math.round(sizeMin * ratio), height: 0, overflow: false }
  let last: Fit | null = null
  for (let size = sizeMax; size >= sizeMin; size -= 2) {
    const lines = breakLines(toks, size, maxW, bold, m)
    const lh = Math.round(size * ratio), height = lines.length * lh
    const ok = (!limits.maxLines || lines.length <= limits.maxLines) && (!limits.maxH || height <= limits.maxH) && widest(lines, size, bold, m) <= maxW
    last = { lines, size, lh, height, overflow: !ok }
    if (ok) return last
  }
  return last!
}

// ── desenho ────────────────────────────────────────────────────────────────────────────────
interface Ctx { m: Measure; drawn: DrawnLine[]; overflow: boolean; text: string; bg: string; primary: string; onPrimary: string }

function lum(hex: string): number {
  const h = String(hex ?? '').replace('#', '')
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(f)) return 0
  const c = [0, 2, 4].map(i => { const v = parseInt(f.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** Linha de texto (com tspans de destaque). `y` é a linha de base. */
function lineSvg(c: Ctx, line: Tok[], x: number, y: number, size: number, bold: boolean, fill: string, anchor: 'start' | 'middle' | 'end' = 'start', box: [number, number] = [M, RIGHT], hlFill = c.primary, opacity = 1): string {
  const txt = lineText(line)
  const wd = c.m(txt, size, bold)
  const x0 = anchor === 'middle' ? x - wd / 2 : anchor === 'end' ? x - wd : x
  c.drawn.push({ text: txt, x0, x1: x0 + wd, y, size, bold, box })
  const runs: { t: string; hl: boolean }[] = []
  line.forEach((t, i) => {
    const w = t.w + (i < line.length - 1 ? ' ' : '')
    const r = runs[runs.length - 1]
    if (r && r.hl === t.hl) r.t += w; else runs.push({ t: w, hl: t.hl })
  })
  return `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} text-anchor="${anchor}" xml:space="preserve">` +
    runs.map(r => `<tspan${r.hl ? ` fill="${hlFill}" fill-opacity="1"` : ''}>${esc(r.t)}</tspan>`).join('') + '</text>'
}

/** Bloco de linhas a partir de yTop (topo da caixa); devolve o SVG. */
function blockSvg(c: Ctx, fit: Fit, x: number, yTop: number, fill: string, bold: boolean, anchor: 'start' | 'middle' | 'end' = 'start', box: [number, number] = [M, RIGHT], opacity = 1): string {
  if (fit.overflow) c.overflow = true
  return fit.lines.map((l, i) => lineSvg(c, l, x, Math.round(yTop + i * fit.lh + fit.size * 0.95), fit.size, bold, fill, anchor, box, c.primary, opacity)).join('')
}

/** Seta desenhada (polígono) — nunca o caractere "→". (x,cy) = ponta de trás, centro vertical. */
function arrowShape(x: number, cy: number, len: number, fill: string): string {
  const k = len / 46
  const p = [[0, -3], [30, -3], [30, -13], [46, 0], [30, 13], [30, 3], [0, 3]].map(([a, b]) => `${(x + a * k).toFixed(1)},${(cy + b * k).toFixed(1)}`)
  return `<polygon points="${p.join(' ')}" fill="${fill}"/>`
}

function chrome(c: Ctx, f: SlideFields, b: SlideBrand, logo: string | null, page: number, total: number): string {
  const H = SLIDE_H
  let s = ''
  const handleRaw = String(f.handle ?? '').trim().replace(/^@/, '')
  const handle = /^[A-Za-z0-9._]{1,30}$/.test(handleRaw) ? '@' + handleRaw : ''
  let hBox: [number, number]
  if (logo) {
    s += `<image href="${logo}" x="${M}" y="64" width="260" height="76" preserveAspectRatio="xMinYMid meet"/>`
    hBox = [380, RIGHT]
  } else {
    const name = fitText(clean(f.name || b.name || '').toUpperCase().slice(0, 40), 480, { maxLines: 1 }, 34, 20, c.m)
    s += blockSvg(c, name, M, 78, c.primary, true, 'start', [M, 570])
    hBox = [600, RIGHT]
  }
  if (handle) {
    const hf = fitText(handle, hBox[1] - hBox[0], { maxLines: 1 }, 30, 18, c.m, { bold: false })
    if (!hf.overflow) s += blockSvg(c, hf, RIGHT, 78, c.text, false, 'end', hBox, 0.7)
  }
  const barY = H - 150
  s += `<rect x="${M}" y="${barY}" width="${CW}" height="6" rx="3" fill="${c.text}" fill-opacity="0.15"/>`
  s += `<rect x="${M}" y="${barY}" width="${Math.round(CW * page / total)}" height="6" rx="3" fill="${c.primary}"/>`
  s += lineSvg(c, [{ w: `${page}/${total}`, hl: false }], RIGHT, H - 90, 30, true, c.text, 'end', [M, RIGHT], c.primary, 0.9)
  if (page < total) {
    const wd = c.m('arraste', 30, true)
    s += lineSvg(c, [{ w: 'arraste', hl: false }], M, H - 90, 30, true, c.primary, 'start', [M, RIGHT])
    s += arrowShape(M + wd + 16, H - 90 - 11, 44, c.primary)
  }
  return s
}

// Lista de itens com o MESMO tamanho de letra (o maior que cabe em maxH).
interface ListFit { size: number; lh: number; cells: Tok[][][]; heights: number[]; total: number; overflow: boolean }
function fitList(items: string[], maxW: number, maxH: number, sizeMax: number, sizeMin: number, rowPad: number, minRow: number, gap: number, maxLinesEach: number, m: Measure, highlight?: string, bold = true): ListFit {
  const toks = items.map(i => tokenize(i, highlight))
  let last: ListFit | null = null
  for (let size = sizeMax; size >= sizeMin; size -= 2) {
    const lh = Math.round(size * 1.22)
    const cells = toks.map(t => breakLines(t, size, maxW, bold, m))
    const heights = cells.map(l => Math.max(minRow, l.length * lh + 2 * rowPad))
    const total = heights.reduce((a, h) => a + h, 0) + gap * Math.max(0, items.length - 1)
    const ok = total <= maxH && cells.every(l => l.length <= maxLinesEach && widest(l, size, bold, m) <= maxW)
    last = { size, lh, cells, heights, total, overflow: !ok }
    if (ok) return last
  }
  return last!
}

const splitItems = (s: string | undefined, max: number) => String(s ?? '').split('\n').map(x => clean(x).trim()).filter(Boolean).slice(0, max)

/** Centraliza um grupo de altura h dentro do corpo do slide. */
const centerY = (h: number) => Math.max(BODY_TOP, Math.round(BODY_TOP + (BODY_H - h) / 2))

// ── layouts ────────────────────────────────────────────────────────────────────────────────
function layoutCapa(c: Ctx, f: SlideFields): string {
  const title = f.title || f.text || ''
  const sub = f.title ? (f.text || '') : ''
  const style = (COVER_STYLES as readonly string[]).includes(f.cover_style) ? f.cover_style : 'gancho'
  const items = style === 'lista' ? splitItems(f.items, 5) : []
  const useList = style === 'lista' && items.length > 0
  const hlo = { highlight: f.highlight }
  let s = ''
  if (useList) {
    const t = fitText(title, CW, { maxLines: 4 }, 92, 52, c.m, hlo)
    const list = fitList(items, CW - 56, BODY_H - 60 - t.height - 70, 42, 30, 14, 0, 6, 3, c.m, undefined, false)
    const total = 10 + 36 + t.height + 40 + list.total
    let y = centerY(total)
    s += `<rect x="${M}" y="${y}" width="120" height="10" rx="5" fill="${c.primary}"/>`; y += 46
    s += blockSvg(c, t, M, y, c.text, true); y += t.height + 40
    if (list.overflow) c.overflow = true
    list.cells.forEach((cell, i) => {
      s += `<circle cx="${M + 14}" cy="${Math.round(y + 14 + list.lh / 2)}" r="11" fill="${c.primary}"/>`
      cell.forEach((l, j) => { s += lineSvg(c, l, M + 56, Math.round(y + 14 + j * list.lh + list.size * 0.95), list.size, false, c.text, 'start', [M + 56, RIGHT]) })
      y += list.heights[i] + 6
    })
    return s
  }
  const isQ = style === 'pergunta'
  const sb = sub ? fitText(sub, CW, { maxLines: 3 }, 40, 28, c.m, { bold: false }) : null
  const head = isQ ? 250 + 20 : 10 + 40
  const t = fitText(title, CW, { maxH: BODY_H - head - (sb ? 36 + sb.height : 0) }, isQ ? 96 : 108, 52, c.m, hlo)
  const total = head + t.height + (sb ? 36 + sb.height : 0)
  if (total > BODY_H) c.overflow = true
  let y = centerY(total)
  if (isQ) {
    c.drawn.push({ text: '?', x0: M, x1: M + c.m('?', 330, true), y: y + 250, size: 330, bold: true, box: [M, RIGHT] })
    s += `<text x="${M}" y="${y + 250}" font-family="Poppins" font-size="330" font-weight="700" fill="${c.primary}">?</text>`
  } else s += `<rect x="${M}" y="${y}" width="120" height="10" rx="5" fill="${c.primary}"/>`
  y += head
  s += blockSvg(c, t, M, y, c.text, true); y += t.height
  if (sb) s += blockSvg(c, sb, M, y + 36, c.text, false, 'start', [M, RIGHT], 0.75)
  return s
}

function layoutLista(c: Ctx, f: SlideFields, steps: boolean): string {
  const items = splitItems(f.items, 6)
  const hlo = { highlight: f.highlight }
  const t = fitText(f.title || f.text || '', CW, { maxLines: 3 }, 72, 44, c.m, hlo)
  const R = steps ? 34 : 30, tx = M + 2 * R + 30, tw = RIGHT - tx
  const avail = BODY_BOT - (BODY_TOP + t.height + 50)
  const list = fitList(items, tw, avail, 46, 32, steps ? 0 : 18, 2 * R, steps ? 38 : 0, 4, c.m, f.highlight, steps)
  const total = t.height + 50 + list.total
  let y = centerY(total)
  let s = blockSvg(c, t, M, y, c.text, true); y += t.height + 50
  if (list.overflow) c.overflow = true
  const nb = (n: number, cy: number) => `<circle cx="${M + R}" cy="${cy}" r="${R}" fill="${c.primary}"/>` + lineSvg(c, [{ w: String(n), hl: false }], M + R, cy + Math.round(R * 0.36), Math.round(R * 1.0), true, c.onPrimary, 'middle', [M, M + 2 * R])
  list.cells.forEach((cell, i) => {
    const h = list.heights[i], top = y
    const textH = cell.length * list.lh, ty = top + (h - textH) / 2
    const cy = steps ? top + R : top + h / 2
    s += nb(i + 1, cy)
    if (steps && i < list.cells.length - 1) s += `<rect x="${M + R - 2}" y="${top + 2 * R}" width="4" height="${h + 38 - 2 * R}" fill="${c.primary}" fill-opacity="0.35"/>`
    cell.forEach((l, j) => { s += lineSvg(c, l, tx, Math.round(ty + j * list.lh + list.size * 0.95), list.size, steps, c.text, 'start', [tx, RIGHT], c.primary) })
    if (!steps && i < list.cells.length - 1) s += `<rect x="${M}" y="${top + h}" width="${CW}" height="2" fill="${c.text}" fill-opacity="0.12"/>`
    y += h + (steps ? 38 : 0)
  })
  return s
}

function layoutComparacao(c: Ctx, f: SlideFields): string {
  const raw = splitItems(f.items, 8)
  let rows: [string, string][] = raw.filter(r => r.includes('|')).map(r => { const i = r.indexOf('|'); return [r.slice(0, i).trim(), r.slice(i + 1).trim()] as [string, string] })
  if (!rows.length) { const half = Math.ceil(raw.length / 2); rows = raw.slice(0, half).map((l, i) => [l, raw[half + i] ?? ''] as [string, string]) }
  rows = rows.slice(0, 4)
  const labels = String(f.text ?? '').includes('|') ? String(f.text).split('|').map(x => clean(x).trim()) : []
  const t = fitText(f.title || (labels.length ? '' : f.text || ''), CW, { maxLines: 3 }, 68, 42, c.m, { highlight: f.highlight })
  const colW = (CW - 30) / 2, padX = 24, tw = colW - 2 * padX, rx = [M, M + colW + 30]
  const labelH = labels.length ? 64 + 22 : 0
  const avail = BODY_BOT - (BODY_TOP + t.height + 44) - labelH
  const cells = rows.flatMap(r => [r[0], r[1]])
  const list = fitList(cells, tw, 1e9, 40, 30, 0, 0, 0, 6, c.m, undefined, false)
  let size = list.size
  // altura por linha de cards = maior das duas células; reduz a letra até o conjunto caber
  const rowH = (ls: ListFit) => rows.map((_, i) => Math.max(ls.cells[2 * i].length, ls.cells[2 * i + 1].length) * ls.lh + 56)
  let cur = list
  while ((rowH(cur).reduce((a, h) => a + h, 0) + 22 * Math.max(0, rows.length - 1)) > avail && size > 30) {
    size -= 2
    cur = fitList(cells, tw, 1e9, size, size, 0, 0, 0, 6, c.m, undefined, false)
  }
  const rh = rowH(cur), total = t.height + 44 + labelH + rh.reduce((a, h) => a + h, 0) + 22 * Math.max(0, rows.length - 1)
  if (total > BODY_BOT - BODY_TOP || cur.overflow) c.overflow = true
  let y = centerY(total)
  let s = blockSvg(c, t, M, y, c.text, true); y += t.height + 44
  if (labels.length) {
    const lf = labels.slice(0, 2).map(l => fitText(l, tw, { maxLines: 1 }, 30, 20, c.m))
    lf.forEach((fit, i) => {
      s += `<rect x="${rx[i]}" y="${y}" width="${colW}" height="64" rx="32" fill="${i ? c.primary : c.text}" fill-opacity="${i ? 1 : 0.14}"/>`
      s += blockSvg(c, fit, rx[i] + colW / 2, y + (64 - fit.lh) / 2, i ? c.onPrimary : c.text, true, 'middle', [rx[i] + 12, rx[i] + colW - 12])
    })
    y += labelH
  }
  rows.forEach((_, i) => {
    for (let k = 0; k < 2; k++) {
      s += `<rect x="${rx[k]}" y="${y}" width="${colW}" height="${rh[i]}" rx="24" fill="${k ? c.primary : c.text}" fill-opacity="${k ? 0.16 : 0.07}"/>`
      const cell = cur.cells[2 * i + k]
      cell.forEach((l, j) => { s += lineSvg(c, l, rx[k] + padX, Math.round(y + 28 + j * cur.lh + cur.size * 0.95), cur.size, false, c.text, 'start', [rx[k] + padX, rx[k] + colW - padX]) })
    }
    y += rh[i] + 22
  })
  return s
}

function layoutDestaque(c: Ctx, f: SlideFields): string {
  const eyebrow = f.title && f.text ? fitText(clean(f.title).toUpperCase(), CW, { maxLines: 1 }, 30, 20, c.m) : null
  const body = f.text || f.title || ''
  const t = fitText(body, CW - 44, { maxH: BODY_H - (eyebrow ? 90 : 0) }, 96, 44, c.m, { highlight: f.highlight })
  const total = (eyebrow ? 70 : 0) + t.height
  let y = centerY(total), s = ''
  if (eyebrow) { s += blockSvg(c, eyebrow, M, y, c.primary, true); y += 70 }
  s += `<rect x="${M}" y="${y + 6}" width="10" height="${Math.max(0, t.height - 12)}" rx="5" fill="${c.primary}"/>`
  s += blockSvg(c, t, M + 44, y, c.text, true, 'start', [M + 44, RIGHT])
  return s
}

function layoutFecho(c: Ctx, f: SlideFields): string {
  const t = fitText(f.title || f.text || '', CW, { maxLines: 5 }, 88, 48, c.m, { highlight: f.highlight })
  const sb = f.title && f.text ? fitText(f.text, CW, { maxLines: 3 }, 40, 26, c.m, { bold: false }) : null
  const btnH = 112, ctaTxt = clean(f.cta || '').trim()
  const btn = ctaTxt ? fitText(ctaTxt, CW - 2 * 48 - 80, { maxLines: 1 }, 44, 26, c.m) : null
  const total = t.height + (sb ? 30 + sb.height : 0) + (btn ? 64 + btnH : 0)
  if (total > BODY_H) c.overflow = true
  let y = centerY(total)
  let s = blockSvg(c, t, M, y, c.text, true); y += t.height
  if (sb) { s += blockSvg(c, sb, M, y + 30, c.text, false, 'start', [M, RIGHT], 0.75); y += 30 + sb.height }
  if (btn) {
    y += 64
    const bw = Math.min(CW, Math.round(c.m(lineText(btn.lines[0] ?? []), btn.size, true) + 2 * 48 + 80))
    s += `<rect x="${M}" y="${y}" width="${bw}" height="${btnH}" rx="${btnH / 2}" fill="${c.primary}"/>`
    s += blockSvg(c, btn, M + 48, y + (btnH - btn.lh) / 2, c.onPrimary, true, 'start', [M + 48, M + bw - 48 - 56])
    s += arrowShape(M + bw - 48 - 46, y + btnH / 2, 46, c.onPrimary)
  }
  return s
}

function layoutTexto(c: Ctx, f: SlideFields, first: boolean): string {
  const t = fitText(f.text || f.title || 'Seu texto aqui.', CW, { maxH: BODY_H }, first ? 76 : 62, 40, c.m, { highlight: f.highlight })
  return blockSvg(c, t, M, centerY(t.height), c.text, true)
}

/** Desenha 1 slide. `measure` = largura real da fonte (ver render-format); logo = data URI ou null. */
export function svgSlideSystem(f: SlideFields, b: SlideBrand, logo: string | null, measure: Measure): SlideOut {
  const bg = b.bg || '#0E0B0A'
  const text = b.text || (lum(bg) > 0.45 ? '#111111' : '#ffffff')
  const primary = b.primary || '#FF6D29'
  const c: Ctx = { m: measure, drawn: [], overflow: false, text, bg, primary, onPrimary: lum(primary) > 0.4 ? '#111111' : '#ffffff' }
  const page = Math.max(1, Number(f.page) || 1), total = Math.max(page, Number(f.total) || 1)
  const layout = (SLIDE_LAYOUTS as readonly string[]).includes(f.layout) ? f.layout : 'texto'
  let body = ''
  switch (layout) {
    case 'capa': body = layoutCapa(c, f); break
    case 'lista': body = layoutLista(c, f, false); break
    case 'passos': body = layoutLista(c, f, true); break
    case 'comparacao': body = layoutComparacao(c, f); break
    case 'destaque': body = layoutDestaque(c, f); break
    case 'fecho': body = layoutFecho(c, f); break
    default: body = layoutTexto(c, f, page === 1)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="${SLIDE_H}" viewBox="0 0 ${SLIDE_W} ${SLIDE_H}"><rect width="${SLIDE_W}" height="${SLIDE_H}" fill="${bg}"/>` +
    `<circle cx="${SLIDE_W}" cy="${SLIDE_H}" r="380" fill="${primary}" fill-opacity="0.07"/>` +
    chrome(c, f, b, logo, page, total) + body + '</svg>'
  return { svg, w: SLIDE_W, h: SLIDE_H, overflow: c.overflow, layout, drawn: c.drawn }
}
