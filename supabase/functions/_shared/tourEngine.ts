// Motor dos vídeos curtos do imóvel (grátis e plano). Decisões do dono
// 2026-10-08/09 em docs/DECISIONS.md: o vídeo é ISCA — 1 cômodo, no máximo 2
// cômodos vizinhos (caminhada de uma foto até a outra) ou a abertura "de fora"
// mostrando a vista. Nunca o imóvel inteiro. Três partes:
//  - Higgsfield (Kling 3.0): trecho a partir de foto real (com last_image_url
//    quando são 2 cômodos). Sem som (o áudio não entra no vídeo final).
//  - Consulta dos trechos, com 1 nova tentativa por trecho que falhar.
//  - Gravação em partes (mp4stream + envio TUS): cada chamada trabalha até um
//    prazo e guarda onde parou em video_tours.assembly; a próxima continua.
import { buildHeader, clipMeta, streamBytes, type ClipMeta } from './mp4stream.ts'
import { tusCreate, tusOffset, tusSend } from './tusUpload.ts'

export const HF_BASE = 'https://api.higgsfield.ai'
// Kling 3.0 Standard (escolha do dono 2026-10-08). US$ 0,54 por 5 s medido no painel.
export const HF_ENDPOINT = Deno.env.get('HF_VIDEO_ENDPOINT') ?? '/kling-video/v3.0/std/image-to-video'
export const WALK_SECONDS = Number(Deno.env.get('HF_WALK_DURATION') ?? '6') || 6
// Estimativa por segundo (0,54 / 5 s) — usada pro teto mensal antes de gerar.
export const COST_PER_SECOND = Number(Deno.env.get('HF_COST_PER_SECOND') ?? '0.108') || 0.108
export const MAX_ATTEMPTS = 2
export const VIDEO_BUCKET = 'videos'

// Instruções de câmera padrão (a ficha pode trocar: config.clip_prompts.{room,pair,opening}).
export const DEFAULT_PROMPTS = {
  room: 'Slow, smooth cinematic camera movement inside this room, steady gimbal, natural light, calm and premium feeling. ' +
    'Keep every object, wall, window and piece of furniture exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.',
  pair: 'Smooth first-person walkthrough of a real place, steady gimbal at eye level, walking pace. ' +
    'The camera moves forward from the first room into the next room through the natural opening between them and ends exactly on the final frame. ' +
    'Keep both rooms exactly as in the photos — do not add, remove or change any furniture, wall, window or object. No people, no text, no logos.',
  opening: 'Cinematic establishing shot from outside, slow smooth camera movement that reveals the view and the surroundings, golden natural light. ' +
    'Keep the building, the landscape and the view exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.',
}
export type ClipKind = keyof typeof DEFAULT_PROMPTS
// Segundos por trecho: 2 cômodos precisam de um pouco mais pra caminhada.
export const SECONDS: Record<ClipKind, number> = { room: 5, pair: WALK_SECONDS, opening: 5 }
export const estimateUsd = (kind: ClipKind) => SECONDS[kind] * COST_PER_SECOND

// Instrução de câmera da ficha do setor (regra 6), com o padrão acima.
// deno-lint-ignore no-explicit-any
export async function clipPrompt(admin: any, verticalKey: string | null, kind: ClipKind): Promise<string> {
  if (!verticalKey) return DEFAULT_PROMPTS[kind]
  const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
  const p = ((data?.config ?? {}) as { clip_prompts?: Partial<Record<ClipKind, string>> }).clip_prompts?.[kind]
  return String(p || DEFAULT_PROMPTS[kind]).slice(0, 1500)
}

// from/to: índices das fotos de começo e fim (to ausente = trecho de uma foto só).
export interface Clip { job_ref: string | null; status: string; attempts: number; from: number; to?: number }

export function hfHeaders(): Record<string, string> | null {
  const cred = (Deno.env.get('HF_CREDENTIALS') ?? '').trim()
  return cred ? { Authorization: `Key ${cred}`, 'Content-Type': 'application/json' } : null
}

export async function submitClip(headers: Record<string, string>, prompt: string, photo: string, lastPhoto?: string, seconds = WALK_SECONDS): Promise<string | null> {
  const body = lastPhoto
    ? { prompt, image_url: photo, last_image_url: lastPhoto, duration: seconds, sound: 'off' }
    : { prompt, image_url: photo, duration: seconds, sound: 'off' }
  const res = await fetch(`${HF_BASE}${HF_ENDPOINT}`, { method: 'POST', headers, signal: AbortSignal.timeout(30_000), body: JSON.stringify(body) })
  const out = await res.json().catch(() => ({})) as { request_id?: string; detail?: unknown }
  if (!res.ok || !out.request_id) {
    console.log('[tour] higgsfield', res.status, JSON.stringify(out.detail ?? out).slice(0, 300))
    return null
  }
  return out.request_id
}

async function clipStatus(headers: Record<string, string>, jobRef: string): Promise<{ status: string; url: string | null } | null> {
  const res = await fetch(`${HF_BASE}/requests/${encodeURIComponent(jobRef)}/status`, { headers, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) { console.log('[tour] status http', res.status); return null }
  const d = await res.json() as { status?: string; video?: { url?: string } }
  return { status: String(d.status ?? 'queued'), url: d.video?.url ?? null }
}

// Manda todos os trechos; o que não subir fica sem job_ref e tenta de novo na consulta.
export async function submitAll(headers: Record<string, string>, prompt: string, photos: string[], plan: Pick<Clip, 'from' | 'to'>[], seconds?: number): Promise<Clip[]> {
  const refs = await Promise.all(plan.map(c => submitClip(headers, prompt, photos[c.from], c.to !== undefined ? photos[c.to] : undefined, seconds)))
  return refs.map((r, i) => ({ job_ref: r, status: 'processing', attempts: 1, ...plan[i] }))
}

// Atualiza cada passagem (mexe em `clips`). Devolve as URLs prontas, ou failed=true
// se alguma passagem falhou nas duas tentativas.
export async function pollClips(headers: Record<string, string>, prompt: string, photos: string[], clips: Clip[], seconds?: number):
  Promise<{ done: number; failed: boolean; urls: (string | null)[] }> {
  const urls: (string | null)[] = clips.map(() => null)
  await Promise.all(clips.map(async (c, i) => {
    const resubmit = async () => {
      if (c.attempts >= MAX_ATTEMPTS) { c.status = 'failed'; return }
      c.attempts += 1
      c.job_ref = await submitClip(headers, prompt, photos[c.from ?? i], c.to !== undefined ? photos[c.to] : undefined, seconds)
      c.status = c.job_ref ? 'processing' : (c.attempts >= MAX_ATTEMPTS ? 'failed' : 'processing')
    }
    if (!c.job_ref) { if (c.status !== 'failed') await resubmit(); return }
    const st = await clipStatus(headers, c.job_ref)
    if (!st) return
    if (st.status === 'completed' && st.url) { c.status = 'completed'; urls[i] = st.url; return }
    if (['failed', 'nsfw', 'canceled'].includes(st.status)) { await resubmit(); return }
    c.status = 'processing'
  }))
  return { done: clips.filter(c => c.status === 'completed').length, failed: clips.some(c => c.status === 'failed'), urls }
}

// ---------- colagem em partes ----------

export interface Output { path: string; from: number; to: number; nome?: string; upload_url?: string; total?: number; done?: boolean }
export interface Assembly { urls: string[]; metas: (ClipMeta | null)[]; outputs: Output[] }

async function download(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!r.ok) throw new Error(`download da passagem ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

// Trabalha até `deadline`. Devolve o estado novo (gravar em video_tours.assembly)
// e finished=true quando todos os vídeos estão no Storage.
export async function assembleStep(supabaseUrl: string, key: string, a: Assembly, deadline: number): Promise<{ a: Assembly; finished: boolean }> {
  // 1) tabela de quadros de cada passagem (guardada; não precisa baixar de novo depois).
  for (let i = 0; i < a.urls.length; i++) {
    if (a.metas[i]) continue
    if (Date.now() > deadline) return { a, finished: false }
    a.metas[i] = clipMeta(await download(a.urls[i]))
  }
  // 2) cada saída (completo + recortes), retomando de onde o Storage parou.
  for (const o of a.outputs) {
    if (o.done) continue
    if (Date.now() > deadline) return { a, finished: false }
    const metas = a.metas.slice(o.from, o.to) as ClipMeta[]
    const { header, total } = buildHeader(metas)
    if (!o.upload_url || o.total !== total) { o.upload_url = await tusCreate(supabaseUrl, key, VIDEO_BUCKET, o.path, total, 'video/mp4'); o.total = total }
    const start = await tusOffset(o.upload_url, key)
    const urls = a.urls.slice(o.from, o.to)
    const end = await tusSend(o.upload_url, key, streamBytes(header, metas, i => download(urls[i]), start), start, total, deadline)
    if (end === total) o.done = true
  }
  return { a, finished: a.outputs.every(o => o.done) }
}

// ---------- avanço de um tour (usado pelo status do grátis e do plano) ----------

const LEASE_MS = 70_000 // uma chamada por vez cola; se ela morrer, outra assume depois disso
const STEP_MS = 40_000 // trabalho por chamada (o resto do tempo da função fica de folga)
const MAX_ASSEMBLY_ERRORS = 6 // as passagens já foram pagas: insiste antes de desistir

export interface TourRow {
  id: string; status: string; photos: string[]; clips: Clip[]; updated_at: string
  assembly: (Assembly & { errors?: number }) | null
}
export type Advance = { status: 'processing'; done: number; total: number } | { status: 'completed'; outputs: Output[] } | { status: 'failed'; reason: string }

// deno-lint-ignore no-explicit-any
export async function advanceTour(admin: any, supabaseUrl: string, key: string, headers: Record<string, string>, prompt: string,
  tour: TourRow, outputsFor: (urls: string[]) => Output[], seconds?: number): Promise<Advance> {
  const total = tour.clips.length
  const now = () => new Date().toISOString()

  if (tour.status === 'generating') {
    const { done, failed, urls } = await pollClips(headers, prompt, tour.photos, tour.clips, seconds)
    if (failed) {
      await admin.from('video_tours').update({ status: 'failed', clips: tour.clips, error: 'passagem falhou 2x', updated_at: now() }).eq('id', tour.id)
      return { status: 'failed', reason: 'generation' }
    }
    if (done < total) {
      await admin.from('video_tours').update({ clips: tour.clips, updated_at: now() }).eq('id', tour.id)
      return { status: 'processing', done, total }
    }
    const assembly: Assembly = { urls: urls as string[], metas: urls.map(() => null), outputs: outputsFor(urls as string[]) }
    const { data: locked } = await admin.from('video_tours').update({ status: 'assembling', clips: tour.clips, assembly, updated_at: now() })
      .eq('id', tour.id).eq('status', 'generating').select('id, updated_at').maybeSingle()
    if (!locked) return { status: 'processing', done, total }
    tour = { ...tour, status: 'assembling', assembly, updated_at: locked.updated_at }
  } else if (tour.status === 'assembling') {
    // Só continua se ninguém está colando agora (trava otimista pelo updated_at).
    if (Date.now() - new Date(tour.updated_at).getTime() < LEASE_MS) return { status: 'processing', done: total, total }
    const { data: got } = await admin.from('video_tours').update({ updated_at: now() })
      .eq('id', tour.id).eq('status', 'assembling').eq('updated_at', tour.updated_at).select('updated_at').maybeSingle()
    if (!got) return { status: 'processing', done: total, total }
  } else {
    return { status: 'processing', done: 0, total }
  }

  const a = tour.assembly!
  try {
    const { a: next, finished } = await assembleStep(supabaseUrl, key, a, Date.now() + STEP_MS)
    if (finished) {
      await admin.from('video_tours').update({ status: 'completed', assembly: next, video_path: next.outputs[0].path, error: null, updated_at: now() }).eq('id', tour.id)
      return { status: 'completed', outputs: next.outputs }
    }
    // Solta a vez: a próxima consulta continua sem esperar o LEASE inteiro.
    await admin.from('video_tours').update({ assembly: next, updated_at: new Date(Date.now() - LEASE_MS).toISOString() }).eq('id', tour.id)
  } catch (e) {
    const errors = (a.errors ?? 0) + 1
    console.error('[tour] colagem falhou', tour.id, errors, String(e))
    if (errors >= MAX_ASSEMBLY_ERRORS) {
      await admin.from('video_tours').update({ status: 'failed', error: `colagem: ${String(e).slice(0, 250)}`, updated_at: now() }).eq('id', tour.id)
      return { status: 'failed', reason: 'assembly' }
    }
    await admin.from('video_tours').update({ assembly: { ...a, errors }, error: String(e).slice(0, 300), updated_at: new Date(Date.now() - LEASE_MS).toISOString() }).eq('id', tour.id)
  }
  return { status: 'processing', done: total, total }
}
