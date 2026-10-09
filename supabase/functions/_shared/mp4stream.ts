// Junta trechos MP4 (H.264) num vídeo só, SEM recodificar e SEM segurar o
// vídeo inteiro na memória (sucessor do mp4concat.ts, que estourou a memória
// da função com 33 MB — 2026-10-08). Funciona em duas etapas:
//  1. clipMeta(): lê só a "tabela de quadros" de cada trecho (tamanho, tempo,
//     onde fica cada quadro). Cabe em JSON — dá pra guardar no banco.
//  2. buildHeader() monta o cabeçalho do vídeo final a partir dessas tabelas e
//     streamBytes() entrega os bytes a partir de QUALQUER posição, baixando um
//     trecho por vez. Por isso o envio pode parar e continuar depois (TUS).
// Só o vídeo é copiado (o áudio dos trechos é descartado). Todos os trechos
// precisam ter a mesma configuração de codec e o mesmo timescale — senão
// recusa em vez de entregar vídeo quebrado. Sem dependências (sem mp4box).

export interface ClipMeta {
  timescale: number
  width: number // ponto fixo 16.16, copiado do tkhd
  height: number
  stsd: string // caixa stsd original em base64 (avc1 + avcC); a do 1º trecho vai pro vídeo final
  avcC: string // configuração do codec em base64 — é o que precisa ser igual entre os trechos
  stts: [number, number][] // [quantidade, duração]
  ctts: [number, number][] | null // [quantidade, deslocamento]
  stss: number[] | null // quadros-chave (1-based, dentro do trecho); null = todos
  sizes: number[]
  ranges: [number, number][] // [início no arquivo, tamanho] dos quadros, em ordem
  bytes: number // soma dos quadros
}

// ---------- leitura ----------

function u32(d: DataView, o: number) { return d.getUint32(o) }
function u64(d: DataView, o: number) { return d.getUint32(o) * 2 ** 32 + d.getUint32(o + 4) }
function type4(b: Uint8Array, o: number) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]) }

interface Box { type: string; start: number; head: number; end: number }
function boxes(b: Uint8Array, d: DataView, start: number, end: number): Box[] {
  const out: Box[] = []
  let o = start
  while (o + 8 <= end) {
    let size = u32(d, o), head = 8
    if (size === 1) { size = u64(d, o + 8); head = 16 } else if (size === 0) size = end - o
    if (size < head || o + size > end) throw new Error('mp4 inválido (caixa corrompida)')
    out.push({ type: type4(b, o + 4), start: o, head, end: o + size })
    o += size
  }
  return out
}
const child = (b: Uint8Array, d: DataView, p: Box, t: string) => boxes(b, d, p.start + p.head, p.end).find(x => x.type === t)

function b64(bytes: Uint8Array) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }
function unb64(s: string) { const r = atob(s); const u = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) u[i] = r.charCodeAt(i); return u }

export function clipMeta(buf: Uint8Array): ClipMeta {
  const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const moov = boxes(buf, d, 0, buf.length).find(x => x.type === 'moov')
  if (!moov) throw new Error('mp4 sem moov')
  const trak = boxes(buf, d, moov.start + 8, moov.end).filter(x => x.type === 'trak').find(t => {
    const mdia = child(buf, d, t, 'mdia'); const hdlr = mdia && child(buf, d, mdia, 'hdlr')
    return !!hdlr && type4(buf, hdlr.start + hdlr.head + 8) === 'vide'
  })
  if (!trak) throw new Error('trecho sem vídeo')
  const tkhd = child(buf, d, trak, 'tkhd')!
  const mdia = child(buf, d, trak, 'mdia')!
  const mdhd = child(buf, d, mdia, 'mdhd')!
  const stbl = child(buf, d, child(buf, d, mdia, 'minf')!, 'stbl')!
  const get = (t: string) => child(buf, d, stbl, t)
  const body = (x: Box) => x.start + x.head + 4 // depois de version/flags

  const mv = buf[mdhd.start + mdhd.head]
  const timescale = u32(d, mdhd.start + mdhd.head + (mv === 1 ? 20 : 12))
  const stsdBox = get('stsd')!
  if (u32(d, body(stsdBox)) !== 1) throw new Error('trecho com várias descrições de vídeo')
  const entryType = type4(buf, body(stsdBox) + 8)
  if (entryType !== 'avc1' && entryType !== 'avc3') throw new Error('trecho não é H.264')
  // A entrada avc1 tem 86 bytes fixos antes das caixas filhas (avcC, pasp, btrt...).
  // btrt (taxa de bits) muda de trecho pra trecho e não importa — só o avcC tem que bater.
  const entry = boxes(buf, d, body(stsdBox) + 4, stsdBox.end)[0]
  const avcCBox = boxes(buf, d, entry.start + 86, entry.end).find(x => x.type === 'avcC')
  if (!avcCBox) throw new Error('trecho sem configuração H.264')

  const stts: [number, number][] = []
  { const x = get('stts')!; const n = u32(d, body(x)); for (let i = 0; i < n; i++) stts.push([u32(d, body(x) + 4 + i * 8), u32(d, body(x) + 8 + i * 8)]) }
  let ctts: [number, number][] | null = null
  { const x = get('ctts'); if (x) { const v = buf[x.start + x.head]; const n = u32(d, body(x)); ctts = []
      for (let i = 0; i < n; i++) ctts.push([u32(d, body(x) + 4 + i * 8), v === 1 ? d.getInt32(body(x) + 8 + i * 8) : u32(d, body(x) + 8 + i * 8)]) } }
  let stss: number[] | null = null
  { const x = get('stss'); if (x) { const n = u32(d, body(x)); stss = []; for (let i = 0; i < n; i++) stss.push(u32(d, body(x) + 4 + i * 4)) } }
  const sizes: number[] = []
  { const x = get('stsz')!; const fixed = u32(d, body(x)), n = u32(d, body(x) + 4); for (let i = 0; i < n; i++) sizes.push(fixed || u32(d, body(x) + 8 + i * 4)) }
  const stsc: [number, number][] = []
  { const x = get('stsc')!; const n = u32(d, body(x)); for (let i = 0; i < n; i++) stsc.push([u32(d, body(x) + 4 + i * 12), u32(d, body(x) + 8 + i * 12)]) }
  const chunks: number[] = []
  { const x = get('stco') ?? get('co64'); if (!x) throw new Error('mp4 sem tabela de posições'); const big = x.type === 'co64'; const n = u32(d, body(x))
    for (let i = 0; i < n; i++) chunks.push(big ? u64(d, body(x) + 4 + i * 8) : u32(d, body(x) + 4 + i * 4)) }

  // Posição de cada quadro = início do bloco + tamanhos dos quadros anteriores no bloco.
  const ranges: [number, number][] = []
  let s = 0
  for (let c = 0; c < chunks.length && s < sizes.length; c++) {
    let e = stsc.length - 1
    while (e > 0 && stsc[e][0] > c + 1) e--
    let off = chunks[c]
    for (let k = 0; k < stsc[e][1] && s < sizes.length; k++, s++) {
      const last = ranges[ranges.length - 1]
      if (last && last[0] + last[1] === off) last[1] += sizes[s]; else ranges.push([off, sizes[s]])
      off += sizes[s]
    }
  }
  if (s !== sizes.length) throw new Error('mp4 inválido (tabela incompleta)')
  for (const [o, n] of ranges) if (o + n > buf.length) throw new Error('mp4 incompleto')
  return {
    timescale, width: u32(d, tkhd.end - 8), height: u32(d, tkhd.end - 4),
    stsd: b64(buf.subarray(stsdBox.start, stsdBox.end)), avcC: b64(buf.subarray(avcCBox.start, avcCBox.end)),
    stts, ctts, stss, sizes, ranges, bytes: sizes.reduce((a, b) => a + b, 0),
  }
}

// ---------- escrita ----------

function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const len = 8 + parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(len)
  new DataView(out.buffer).setUint32(0, len)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  let o = 8
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
function bytesOf(...nums: [number, 1 | 2 | 4 | 8][]): Uint8Array {
  const len = nums.reduce((a, [, w]) => a + w, 0)
  const out = new Uint8Array(len), d = new DataView(out.buffer)
  let o = 0
  for (const [v, w] of nums) {
    if (w === 1) d.setUint8(o, v); else if (w === 2) d.setUint16(o, v); else if (w === 4) d.setUint32(o, v >>> 0)
    else { d.setUint32(o, Math.floor(v / 2 ** 32)); d.setUint32(o + 4, v >>> 0) }
    o += w
  }
  return out
}
const ascii = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0))
const full = (v: number, flags: number) => bytesOf([v, 1], [flags >> 16 & 255, 1], [flags & 0xffff, 2])
const MATRIX = bytesOf([0x10000, 4], [0, 4], [0, 4], [0, 4], [0x10000, 4], [0, 4], [0, 4], [0, 4], [0x40000000, 4])

const sameCodec = (a: ClipMeta, b: ClipMeta) => a.avcC === b.avcC && a.timescale === b.timescale && a.width === b.width && a.height === b.height

// Cabeçalho (ftyp + moov + início do mdat) do vídeo que junta `clips` na ordem.
export function buildHeader(clips: ClipMeta[]): { header: Uint8Array; total: number } {
  if (!clips.length) throw new Error('nenhum trecho')
  const f = clips[0]
  for (const c of clips) if (!sameCodec(f, c)) throw new Error('trechos com formato de vídeo diferente — não dá pra juntar sem recodificar')

  const stts: [number, number][] = [], ctts: [number, number][] = [], stss: number[] = [], sizes: number[] = []
  const anyCtts = clips.some(c => c.ctts)
  let base = 0, duration = 0
  for (const c of clips) {
    for (const e of c.stts) { const l = stts[stts.length - 1]; if (l && l[1] === e[1]) l[0] += e[0]; else stts.push([...e]); duration += e[0] * e[1] }
    if (anyCtts) for (const e of c.ctts ?? [[c.sizes.length, 0]]) { const l = ctts[ctts.length - 1]; if (l && l[1] === e[1]) l[0] += e[0]; else ctts.push([...e] as [number, number]) }
    if (c.stss) for (const k of c.stss) stss.push(base + k); else for (let k = 1; k <= c.sizes.length; k++) stss.push(base + k)
    sizes.push(...c.sizes)
    base += c.sizes.length
  }
  const payload = sizes.reduce((a, b) => a + b, 0)
  const n = sizes.length
  const negCtts = ctts.some(e => e[1] < 0)

  const build = (dataStart: number) => {
    const offsets: [number, 8][] = []
    let o = dataStart
    for (const s of sizes) { offsets.push([o, 8]); o += s }
    const stbl = box('stbl',
      unb64(f.stsd),
      box('stts', full(0, 0), bytesOf([stts.length, 4], ...stts.flatMap(([a, b]) => [[a, 4], [b, 4]] as [number, 4][]))),
      ...(anyCtts ? [box('ctts', full(negCtts ? 1 : 0, 0), bytesOf([ctts.length, 4], ...ctts.flatMap(([a, b]) => [[a, 4], [b, 4]] as [number, 4][])))] : []),
      box('stss', full(0, 0), bytesOf([stss.length, 4], ...stss.map(k => [k, 4] as [number, 4]))),
      box('stsz', full(0, 0), bytesOf([0, 4], [n, 4], ...sizes.map(s => [s, 4] as [number, 4]))),
      box('stsc', full(0, 0), bytesOf([1, 4], [1, 4], [1, 4], [1, 4])),
      box('co64', full(0, 0), bytesOf([n, 4], ...offsets)),
    )
    const minf = box('minf',
      box('vmhd', full(0, 1), bytesOf([0, 2], [0, 2], [0, 2], [0, 2])),
      box('dinf', box('dref', full(0, 0), bytesOf([1, 4]), box('url ', full(0, 1)))),
      stbl)
    const mdia = box('mdia',
      box('mdhd', full(0, 0), bytesOf([0, 4], [0, 4], [f.timescale, 4], [duration, 4], [0x55c4, 2], [0, 2])),
      box('hdlr', full(0, 0), bytesOf([0, 4]), ascii('vide'), bytesOf([0, 4], [0, 4], [0, 4]), ascii('VideoHandler\0')),
      minf)
    const tkhd = box('tkhd', full(0, 3), bytesOf([0, 4], [0, 4], [1, 4], [0, 4], [duration, 4], [0, 4], [0, 4], [0, 2], [0, 2], [0, 2], [0, 2]), MATRIX, bytesOf([f.width, 4], [f.height, 4]))
    const mvhd = box('mvhd', full(0, 0), bytesOf([0, 4], [0, 4], [f.timescale, 4], [duration, 4], [0x10000, 4], [0x100, 2], [0, 2], [0, 4], [0, 4]), MATRIX, new Uint8Array(24), bytesOf([2, 4]))
    const ftyp = box('ftyp', ascii('isom'), bytesOf([512, 4]), ascii('isomiso2avc1mp41'))
    const moov = box('moov', mvhd, box('trak', tkhd, mdia))
    const mdatHead = new Uint8Array(16)
    const md = new DataView(mdatHead.buffer)
    md.setUint32(0, 1); mdatHead.set(ascii('mdat'), 4)
    md.setUint32(8, Math.floor((16 + payload) / 2 ** 32)); md.setUint32(12, (16 + payload) >>> 0)
    const out = new Uint8Array(ftyp.length + moov.length + 16)
    out.set(ftyp, 0); out.set(moov, ftyp.length); out.set(mdatHead, ftyp.length + moov.length)
    return out
  }
  // O tamanho do cabeçalho não depende dos valores das posições (co64 tem largura fixa).
  const header = build(build(0).length)
  return { header, total: header.length + payload }
}

// Entrega os bytes do vídeo final de `from` até o fim, um trecho por vez.
// fetchClip(i) baixa o trecho i de novo (não guarda nada entre os trechos).
export async function* streamBytes(
  header: Uint8Array, clips: ClipMeta[], fetchClip: (i: number) => Promise<Uint8Array>, from = 0,
): AsyncGenerator<Uint8Array> {
  let pos = 0
  if (from < header.length) yield header.subarray(from)
  pos = header.length
  for (let i = 0; i < clips.length; i++) {
    const end = pos + clips[i].bytes
    if (end <= from) { pos = end; continue }
    const buf = await fetchClip(i)
    for (const [o, n] of clips[i].ranges) {
      const a = Math.max(0, from - pos)
      if (a < n) yield buf.subarray(o + a, o + n)
      pos += n
    }
  }
}
