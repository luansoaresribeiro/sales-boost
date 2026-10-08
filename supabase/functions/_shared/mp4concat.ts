// Junta vários MP4 (H.264) num só, SEM recodificar: copia os quadros de vídeo
// de cada trecho em sequência (o áudio é descartado — os trechos do tour são
// mudos/ambiente). Todos os trechos precisam ter a MESMA configuração de
// codec (mesmo modelo/resolução — o caso do tour, todos do Kling). Se vier
// diferente, recusa em vez de entregar vídeo corrompido. (Testado 2026-10-08:
// misturar codecs, seja com várias "sample descriptions" ou com SPS/PPS
// in-band, corrompe o decode.)
// Recebe o módulo mp4box por parâmetro (Deno usa esm.sh; o teste local usa npm).
// Testado em 2026-10-08: 6 trechos de 5 s → 30,2 s, ~1 s de CPU.

// deno-lint-ignore no-explicit-any
type MP4BoxModule = any

interface Parsed {
  timescale: number
  width: number
  height: number
  avcC: Uint8Array
  samples: { data: Uint8Array; duration: number; dts: number; cts: number; is_sync: boolean }[]
}

function toArrayBuffer(buf: Uint8Array): ArrayBuffer & { fileStart?: number } {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer & { fileStart?: number }
  ab.fileStart = 0
  return ab
}

function parse(MP4Box: MP4BoxModule, buf: Uint8Array): Parsed {
  const f = MP4Box.createFile()
  // deno-lint-ignore no-explicit-any
  let info: any = null
  // deno-lint-ignore no-explicit-any
  const samples: any[] = []
  f.onError = (e: unknown) => { throw new Error(`mp4 inválido: ${String(e)}`) }
  // deno-lint-ignore no-explicit-any
  f.onReady = (i: any) => {
    info = i
    const v = i.videoTracks[0]
    if (!v) throw new Error('trecho sem vídeo')
    f.setExtractionOptions(v.id, null, { nbSamples: 1e7 })
    f.start()
  }
  // deno-lint-ignore no-explicit-any
  f.onSamples = (_id: number, _u: unknown, s: any[]) => { samples.push(...s) }
  f.appendBuffer(toArrayBuffer(buf))
  f.flush()
  if (!info) throw new Error('mp4 incompleto')
  const v = info.videoTracks[0]
  const trak = f.getTrackById(v.id)
  const avcCBox = trak.mdia.minf.stbl.stsd.entries[0].avcC
  if (!avcCBox) throw new Error('trecho não é H.264')
  const ds = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN)
  avcCBox.write(ds)
  const avcC = new Uint8Array(ds.buffer, 8, ds.getPosition ? ds.getPosition() - 8 : ds.byteLength - 8) // sem o cabeçalho da box
  return {
    timescale: v.timescale, width: v.video.width, height: v.video.height, avcC: avcC.slice(),
    samples: samples.map(s => ({ data: s.data, duration: s.duration, dts: s.dts, cts: s.cts, is_sync: s.is_sync })),
  }
}

const key = (b: Uint8Array) => Array.from(b).join(',')

export function concatMp4(MP4Box: MP4BoxModule, inputs: Uint8Array[]): Uint8Array {
  if (!inputs.length) throw new Error('nenhum trecho')
  const parsed = inputs.map(b => parse(MP4Box, b))
  const first = parsed[0]
  const out = MP4Box.createFile()
  const tid = out.addTrack({ timescale: first.timescale, width: first.width, height: first.height, avcDecoderConfigRecord: first.avcC.buffer.slice(first.avcC.byteOffset, first.avcC.byteOffset + first.avcC.byteLength) })
  const firstKey = key(first.avcC)

  let offset = 0
  for (const p of parsed) {
    if (key(p.avcC) !== firstKey || p.width !== first.width || p.height !== first.height) {
      throw new Error('trechos com formato de vídeo diferente — não dá pra juntar sem recodificar')
    }
    const k = first.timescale / p.timescale
    let end = 0
    for (const s of p.samples) {
      const dts = Math.round(s.dts * k), cts = Math.round(s.cts * k), dur = Math.max(1, Math.round(s.duration * k))
      out.addSample(tid, s.data, { duration: dur, dts: dts + offset, cts: cts + offset, is_sync: s.is_sync })
      end = Math.max(end, dts + dur)
    }
    offset += end
  }
  const ds = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN)
  out.write(ds)
  return new Uint8Array(ds.buffer, 0, ds.getPosition ? ds.getPosition() : ds.byteLength).slice()
}
