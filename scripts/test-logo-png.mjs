// Roda: node --experimental-strip-types scripts/test-logo-png.mjs
// Testa a lógica PURA de _shared/logoPng.ts com pixels sintéticos (sem biblioteca de imagem).
import assert from 'node:assert/strict'
import { processLogoPixels, meanLuma, isSafeLogoUrl, usableLogoMeta, logoBackdrop, hexLuma, downscale } from '../supabase/functions/_shared/logoPng.ts'

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
t('miolo branco de um anel (como a letra "O") não vira buraco', () => {
  const ring = img(120, 120, WHITE, [{ x: 20, y: 20, w: 80, h: 80, c: [200, 0, 0] }, { x: 45, y: 45, w: 30, h: 30, c: WHITE }])
  const r = processLogoPixels(ring)
  assert.ok(r.bg_removed); assert.equal(px(r.img, 60, 60)[3], 255); assert.equal(px(r.img, 4, 4)[3], 0)
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
  for (const u of ['http://exemplo.com/a.png', 'https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://10.0.0.5/a.png', 'https://[::1]/a.png', 'https://169.254.169.254/x', 'https://user:pw@exemplo.com/a.png', 'ftp://x.com/a', 'nao-url', 'https://intranet/a.png', 'https://2130706433/a.png', 'https://foo.local/a.png']) assert.ok(!isSafeLogoUrl(u), u)
})
t('usableLogoMeta: só vale pro logo atual (anti logo velha)', () => {
  const m = { src: 'https://a/x.png', png_url: 'https://a/p.png', kind: 'logo', luma: 0.3, bg_removed: true }
  assert.ok(usableLogoMeta(m, 'https://a/x.png')); assert.equal(usableLogoMeta(m, 'https://a/outra.png'), null)
  assert.equal(usableLogoMeta(null, 'x'), null); assert.equal(usableLogoMeta({ ...m, kind: 'x' }, m.src), null)
})
console.log(`\n${n} grupos OK`)
