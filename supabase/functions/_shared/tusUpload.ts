// Envio retomável pro Storage do Supabase (protocolo TUS), em pedaços de 6 MB
// (tamanho exigido pelo Supabase). Usado pra subir vídeos grandes sem segurar o
// arquivo inteiro na memória: quem chama entrega os bytes aos poucos
// (mp4stream.streamBytes) e, se o tempo acabar, para num limite de pedaço —
// a próxima chamada pergunta ao Storage onde parou (tusOffset) e continua.

export const TUS_CHUNK = 6 * 1024 * 1024

const enc = (s: string) => btoa(unescape(encodeURIComponent(s)))
// Mesmos cabeçalhos do supabase-js: `apikey` + Authorization. Sem o `apikey`, a
// chave de serviço no formato novo (sb_secret_...) é recusada com "Invalid
// Compact JWS" (achado no ensaio 2026-10-09).
const auth = (key: string): Record<string, string> => ({ apikey: key, authorization: `Bearer ${key}` })

export async function tusCreate(supabaseUrl: string, key: string, bucket: string, path: string, total: number, contentType: string): Promise<string> {
  const res = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      ...auth(key), 'x-upsert': 'true', 'tus-resumable': '1.0.0',
      'upload-length': String(total),
      'upload-metadata': `bucketName ${enc(bucket)},objectName ${enc(path)},contentType ${enc(contentType)},cacheControl ${enc('3600')}`,
    },
  })
  const loc = res.headers.get('location')
  if (res.status !== 201 || !loc) throw new Error(`envio: não abriu (${res.status} ${(await res.text()).slice(0, 200)})`)
  return new URL(loc, supabaseUrl).toString()
}

export async function tusOffset(uploadUrl: string, key: string): Promise<number> {
  const res = await fetch(uploadUrl, { method: 'HEAD', headers: { ...auth(key), 'tus-resumable': '1.0.0' } })
  if (!res.ok) throw new Error(`envio: não achei o envio (${res.status})`)
  return Number(res.headers.get('upload-offset') ?? '0')
}

async function patch(uploadUrl: string, key: string, offset: number, data: Uint8Array): Promise<number> {
  const res = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: { ...auth(key), 'tus-resumable': '1.0.0', 'upload-offset': String(offset), 'content-type': 'application/offset+octet-stream' },
    body: data as BodyInit,
  })
  if (res.status !== 204) throw new Error(`envio: pedaço recusado (${res.status} ${(await res.text()).slice(0, 200)})`)
  return Number(res.headers.get('upload-offset') ?? offset + data.length)
}

// Manda os bytes de `source` (que começa em `offset`) até o fim ou até passar
// de `deadline` (Date.now()). Devolve onde parou; === total quando terminou.
export async function tusSend(uploadUrl: string, key: string, source: AsyncIterable<Uint8Array>, offset: number, total: number, deadline: number): Promise<number> {
  const buf = new Uint8Array(TUS_CHUNK)
  let fill = 0
  for await (let piece of source) {
    while (piece.length) {
      const take = Math.min(piece.length, TUS_CHUNK - fill)
      buf.set(piece.subarray(0, take), fill)
      fill += take; piece = piece.subarray(take)
      if (fill === TUS_CHUNK) {
        offset = await patch(uploadUrl, key, offset, buf)
        fill = 0
        if (Date.now() > deadline && offset < total) return offset
      }
    }
  }
  if (fill) offset = await patch(uploadUrl, key, offset, buf.subarray(0, fill))
  return offset
}
