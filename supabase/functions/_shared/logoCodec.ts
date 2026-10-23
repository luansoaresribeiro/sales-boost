// Adaptador de IMAGEM do pipeline de logo (Deno / Supabase Edge): decodifica PNG/JPEG,
// codifica PNG e rasteriza SVG. O algoritmo de pixels vive em `logoPng.ts` (puro, testado em
// Node). Tudo aqui usa import DINÂMICO e devolve null/erro tratável: se a lib não carregar
// (CDN fora), o logo simplesmente fica como estava — nunca derruba a função que chamou.
//
// Libs: imagescript@1.3.0 (decodifica PNG/JPEG, codifica PNG — sem custo) e o mesmo
// resvg-wasm@2.6.2 que o render-format já usa (SVG → PNG).
import { isSafeLogoUrl, type Rgba } from './logoPng.ts'

export const MAX_LOGO_BYTES = 5 * 1024 * 1024   // mesmo teto do bucket post-images
export const MAX_SVG_BYTES = 500 * 1024

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
let imageLib: Any = null
async function lib(): Promise<Any> {
  return imageLib ??= await import('https://deno.land/x/imagescript@1.3.0/mod.ts')
}

/** PNG/JPEG → pixels RGBA. null se o formato não decodifica (ex.: WebP, GIF animado, arquivo quebrado). */
export async function decodeImage(bytes: Uint8Array): Promise<Rgba | null> {
  try {
    const { decode, Image } = await lib()
    const img = await decode(bytes, true)
    if (!(img instanceof Image)) return null
    return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.bitmap) }
  } catch (e) { console.error('logoCodec.decodeImage falhou:', e); return null }
}

export async function encodePng(img: Rgba): Promise<Uint8Array> {
  const { Image } = await lib()
  const out = new Image(img.width, img.height)
  out.bitmap.set(img.data)
  return await out.encode()
}

let resvgReady: Promise<Any> | null = null
async function resvg(): Promise<Any> {
  return resvgReady ??= (async () => {
    const mod = await import('https://esm.sh/@resvg/resvg-wasm@2.6.2')
    await mod.initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm'))
    return mod
  })()
}

/** SVG (texto) → PNG com fundo transparente, 1024 px de largura. Sem fonte instalada: texto do SVG não aparece (use "converter texto em curvas"). */
export async function svgToPng(svg: string, width = 1024): Promise<Uint8Array | null> {
  try {
    const { Resvg } = await resvg()
    return new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render().asPng()
  } catch (e) { resvgReady = null; console.error('logoCodec.svgToPng falhou:', e); return null }
}

export interface Fetched { bytes: Uint8Array; mime: string; isSvg: boolean }

/** Baixa o logo colado pelo dono: só https público, até 5 MB (500 KB se SVG), 15 s, no máx. 3 redirecionamentos (cada um revalidado). */
export async function fetchLogoBytes(rawUrl: string): Promise<Fetched | { error: string }> {
  let url = rawUrl
  for (let hop = 0; hop < 4; hop++) {
    if (!isSafeLogoUrl(url)) return { error: 'Endereço do logo não permitido (use um link https público).' }
    let res: Response
    try { res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { Accept: 'image/png,image/jpeg,image/svg+xml,image/*' } }) }
    catch { return { error: 'Não consegui baixar o logo desse link.' } }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return { error: 'Link do logo redireciona pra lugar nenhum.' }
      try { url = new URL(loc, url).toString() } catch { return { error: 'Link do logo inválido.' } }
      continue
    }
    if (!res.ok) return { error: `O link do logo respondeu ${res.status}.` }
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const isSvg = mime === 'image/svg+xml' || /\.svg(\?|$)/i.test(url)
    if (!isSvg && !mime.startsWith('image/')) return { error: 'O link não é uma imagem.' }
    const limit = isSvg ? MAX_SVG_BYTES : MAX_LOGO_BYTES
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > limit) return { error: 'Arquivo do logo grande demais (máximo 5 MB; SVG 500 KB).' }
    // lê em pedaços e aborta ao passar do teto (content-length pode mentir ou não existir)
    const chunks: Uint8Array[] = []
    let total = 0
    const reader = res.body?.getReader()
    if (!reader) return { error: 'Resposta vazia.' }
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > limit) { await reader.cancel(); return { error: 'Arquivo do logo grande demais (máximo 5 MB; SVG 500 KB).' } }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total); let o = 0
    for (const c of chunks) { bytes.set(c, o); o += c.length }
    return { bytes, mime, isSvg }
  }
  return { error: 'Redirecionamentos demais.' }
}

export const toBase64 = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
