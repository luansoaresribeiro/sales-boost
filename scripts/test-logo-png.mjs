// Roda: node --experimental-strip-types scripts/test-logo-png.mjs
// Testa a lógica PURA de _shared/logoPng.ts com pixels sintéticos (sem biblioteca de imagem).
import assert from 'node:assert/strict'
import { processLogoPixels, meanLuma, lumaRange, imageDims, dimsOk, isSafeLogoUrl, usableLogoMeta, logoBackdrop, hexLuma, downscale } from '../supabase/functions/_shared/logoPng.ts'

// imagem sintética: fundo `bg` (com ruído leve tipo JPEG) + retângulos {x,y,w,h,c}
let seed = 7
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
function img(w, h, bg, rects = [], noise = 0) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    let c = bg
    for (const r of rects) if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) c = r.c
    const nz = noise ? Math.round((rnd() - 0.5) * 2 * noise) : 0
    data[i] = c[0] + nz; data[i + 1] = c[1] + nz; data[i + 2] = c[2] + nz; data[i + 3] = c.length > 3 ? c[3] : 255
  }
  return { width: w, height: h, data }
}
const px = (im, x, y) => Array.from(im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 4))
const WHITE = [255, 255, 255], NAVY = [30, 58, 95]
let n = 0
const t = (name, fn) => { fn(); n++; console.log('ok -', name) }

// quadrado azul com barra BRANCA dentro, sobre fundo branco com ruído de JPEG
const logo = () => img(200, 200, WHITE, [{ x: 30, y: 30, w: 140, h: 140, c: NAVY }, { x: 55, y: 90, w: 90, h: 20, c: WHITE }], 3)

t('fundo branco liso some; barra branca interna fica', () => {
  const r = processLogoPixels(logo())
  assert.ok(r && r.bg_removed)
  assert.equal(px(r.img, 3, 3)[3], 0); assert.equal(px(r.img, 196, 196)[3], 0); assert.equal(px(r.img, 100, 8)[3], 0)
  const inner = px(r.img, 100, 100); assert.equal(inner[3], 255); assert.ok(inner[0] > 240 && inner[1] > 240 && inner[2] > 240, 'barra branca continua branca')
  assert.deepEqual(px(r.img, 60, 60).slice(3), [255])
  assert.ok(r.luma > 0 && r.luma < 0.3, 'luma ' + r.luma)
})
t('preenchimento branco GRANDE dentro do logo fica (anel com miolo de 6% da imagem)', () => {
  const ring = img(120, 120, WHITE, [{ x: 20, y: 20, w: 80, h: 80, c: [200, 0, 0] }, { x: 45, y: 45, w: 30, h: 30, c: WHITE }])
  const r = processLogoPixels(ring)
  assert.ok(r.bg_removed); assert.equal(px(r.img, 60, 60)[3], 255); assert.equal(px(r.img, 4, 4)[3], 0)
})
t('furo pequeno de letra ("O", "P") sai; preenchimento grande fica', () => {
  const o = img(200, 200, WHITE, [{ x: 30, y: 30, w: 140, h: 140, c: NAVY }, { x: 90, y: 90, w: 10, h: 10, c: WHITE }, { x: 120, y: 120, w: 40, h: 25, c: WHITE }], 2)
  const r = processLogoPixels(o)
  assert.equal(px(r.img, 95, 95)[3], 0, 'furo de 10x10 (0,25%) vira transparente')
  assert.equal(px(r.img, 140, 132)[3], 255, 'barra branca de 40x25 (2,5%) fica')
  assert.equal(px(r.img, 60, 60)[3], 255)
})
t('QA: 1x1, 3x3 e 0x0 não quebram', () => { for (const [w, h] of [[1, 1], [3, 3], [0, 0], [4, 4]]) processLogoPixels(img(w, h, WHITE)) })
t('contraste por percentil: casinha laranja + letras azul-escuras no slide ESCURO ganha pílula clara', () => {
  const logo = img(300, 100, WHITE, [{ x: 10, y: 10, w: 60, h: 80, c: [255, 109, 41] }, { x: 90, y: 30, w: 190, h: 40, c: [30, 58, 95] }])
  const r = processLogoPixels(logo)
  const dark = hexLuma('#0E0B0A'), light = hexLuma('#F5F1EA')
  assert.equal(logoBackdrop({ lo: r.luma_lo, hi: r.luma_hi, mean: r.luma }, dark), '#ffffff')
  assert.equal(logoBackdrop({ lo: r.luma_lo, hi: r.luma_hi, mean: r.luma }, light), null)
  assert.equal(logoBackdrop({ lo: null, hi: null, mean: 0.5 }, dark), null, 'meta antigo (só média) segue a regra antiga')
  const rg = lumaRange(r.img); assert.ok(rg.lo < rg.hi)
})
t('cabeçalho: tamanho de PNG/JPEG lido sem decodificar; gigante é recusado', () => {
  const png = new Uint8Array(33); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); png.set([0, 0, 0x2e, 0xe0], 16); png.set([0, 0, 0x2e, 0xe0], 20)   // 12000x12000
  assert.deepEqual(imageDims(png), { w: 12000, h: 12000, type: 'png' }); assert.equal(dimsOk(imageDims(png)), false)
  png.set([0, 0, 0x01, 0x00], 16); png.set([0, 0, 0x00, 0x80], 20); assert.equal(dimsOk(imageDims(png)), true)
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x27, 0x10, 0x27, 0x10, 3, 0, 0, 0])   // SOF0 10000x10000
  assert.deepEqual(imageDims(jpg), { w: 10000, h: 10000, type: 'jpeg' }); assert.equal(dimsOk(imageDims(jpg)), false)
  assert.equal(imageDims(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24])), null)
  assert.equal(dimsOk(null), false)
})
t('cantos de cores diferentes → null (não mexe)', () => {
  const im = img(100, 100, WHITE); for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) { const i = (y * 100 + x) * 4; im.data[i] = x * 2.5; im.data[i + 1] = 40; im.data[i + 2] = 255 - x * 2.5 }
  assert.equal(processLogoPixels(im), null)
})
t('foto (ruído forte) → null', () => { assert.equal(processLogoPixels(img(120, 120, [128, 128, 128], [], 70)), null) })
t('PNG já transparente: devolve igual, bg_removed=false', () => {
  const src = img(100, 100, [0, 0, 0, 0], [{ x: 20, y: 20, w: 60, h: 60, c: NAVY }])
  const r = processLogoPixels(src)
  assert.equal(r.bg_removed, false); assert.deepEqual(Array.from(r.img.data), Array.from(src.data))
})
t('imagem toda lisa → null (nada sobraria)', () => { assert.equal(processLogoPixels(img(80, 80, WHITE)), null) })
t('reduz pra no máximo 1024 px mantendo a proporção', () => {
  const d = downscale(img(2400, 1200, WHITE, [{ x: 600, y: 300, w: 1200, h: 600, c: NAVY }]))
  assert.equal(d.width, 1024); assert.equal(d.height, 512)
})
t('fundo preto liso também sai; logo clara → luma alta', () => {
  const r = processLogoPixels(img(100, 100, [0, 0, 0], [{ x: 25, y: 25, w: 50, h: 50, c: WHITE }]))
  assert.ok(r.bg_removed && r.luma > 0.9); assert.equal(px(r.img, 2, 2)[3], 0)
  assert.equal(logoBackdrop(r.luma, hexLuma('#ffffff')), '#111111'); assert.equal(logoBackdrop(r.luma, hexLuma('#0E0B0A')), null)
  assert.equal(logoBackdrop(0.02, hexLuma('#0E0B0A')), '#ffffff'); assert.equal(logoBackdrop(null, 0.5), null)
})
t('meanLuma ignora pixels transparentes', () => { assert.equal(meanLuma(img(10, 10, [255, 255, 255, 0])), null) })
t('isSafeLogoUrl: só https público', () => {
  for (const u of ['https://exemplo.com/logo.png', 'https://cdn.exemplo.com.br/a/b.svg?x=1']) assert.ok(isSafeLogoUrl(u), u)
  for (const u of ['http://exemplo.com/a.png', 'https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://10.0.0.5/a.png', 'https://[::1]/a.png', 'https://169.254.169.254/x', 'https://user:pw@exemplo.com/a.png', 'ftp://x.com/a', 'nao-url', 'https://intranet/a.png', 'https://2130706433/a.png', 'https://foo.local/a.png', 'https://localhost./x', 'https://x.internal./y', 'https://foo.local./x', 'https://127.1/x', 'https://0x7f.1/x', 'https://metadata.google.internal/x']) assert.ok(!isSafeLogoUrl(u), u)
})
t('usableLogoMeta: só vale pro logo atual (anti logo velha)', () => {
  const m = { src: 'https://a/x.png', png_url: 'https://a/p.png', kind: 'logo', luma: 0.3, bg_removed: true }
  assert.ok(usableLogoMeta(m, 'https://a/x.png')); assert.equal(usableLogoMeta(m, 'https://a/outra.png'), null)
  assert.equal(usableLogoMeta(null, 'x'), null); assert.equal(usableLogoMeta({ ...m, kind: 'x' }, m.src), null)
})
console.log(`\n${n} grupos OK`)
