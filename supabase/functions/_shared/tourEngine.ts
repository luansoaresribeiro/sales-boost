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
// Kling 3.0 Standard (escolha do dono 2026-10-08). Era US$ 0,54 por 5 s no
// painel em 2026-10-08; o extrato da Higgsfield de 10–11/10 mostra US$ 0,42 por
// trecho de 5 s (conferido com os kits gerados nesses dias).
export const HF_ENDPOINT = Deno.env.get('HF_VIDEO_ENDPOINT') ?? '/kling-video/v3.0/std/image-to-video'
export const WALK_SECONDS = Number(Deno.env.get('HF_WALK_DURATION') ?? '6') || 6
// Estimativa por segundo (0,42 / 5 s, extrato de 2026-10-11) — usada pro teto mensal antes de gerar.
export const COST_PER_SECOND = Number(Deno.env.get('HF_COST_PER_SECOND') ?? '0.084') || 0.084
export const MAX_ATTEMPTS = 2
export const VIDEO_BUCKET = 'videos'

// Instruções de câmera padrão (a ficha pode trocar: config.clip_prompts.{room,pair,opening,drone}).
export const DEFAULT_PROMPTS = {
  room: 'Slow, smooth cinematic camera movement inside this room, steady gimbal, natural light, calm and premium feeling. ' +
    'Keep every object, wall, window and piece of furniture exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.',
  // Tour do imóvel inteiro (dono, 2026-11-11): UMA trajetória contínua, estilo voo suave de drone dentro da casa.
  // "Drone" orienta só o MOVIMENTO, nunca a reconstrução do imóvel (regra 4).
  pair: 'Smooth, continuous, stabilized camera glide through a real home, like a slow indoor drone flight at a calm pace. ' +
    'Start exactly on the first frame, move through the visible opening between the two spaces and end exactly on the final frame, with no cut and no jump. ' +
    'The camera may interpolate its movement, but must not invent geometry, architecture, rooms, furniture or landscape that is not supported by the two photos. ' +
    'Keep both spaces exactly as in the photos — do not add, remove or change any furniture, wall, door, window or object. No people, no text, no logos.',
  // A 1ª foto é DE FORA: a câmera vem da área externa e entra pela abertura visível (porta, vidro, varanda).
  pair_in: 'Smooth, continuous, stabilized aerial-style camera glide that starts outside exactly on the first frame and flies gently into the home ' +
    'through the opening that is visible in the photos (door, glass door or balcony), ending exactly on the final frame inside, with no cut and no jump. ' +
    'The camera may interpolate its movement, but must not invent geometry, architecture, rooms, furniture or landscape that is not supported by the two photos. ' +
    'Keep the outside and the inside exactly as in the photos — do not add, remove or change anything. No people, no text, no logos.',
  // Abertura de fora (Etapa 3, 2026-11-11): movimento de drone, mas SÓ dentro do quadro da foto real (regra 4).
  opening: 'Cinematic aerial drone shot of this exact real place: stabilized, a slow gentle rise with a slow push-in, golden natural light, premium real-estate film look. ' +
    'Stay strictly inside what the photo already shows — never reveal anything beyond the edges of the frame. ' +
    'Keep the building, the landscape and the view exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.',
  // Kit grátis (presente do diagnóstico): câmera "drone" que passeia pelo cômodo.
  drone: 'Smooth cinematic drone-style camera glide through this exact room, stabilized, slow and steady, revealing the whole space and ending on its best angle. ' +
    'Keep every object, wall, window and piece of furniture exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.',
}
export type ClipKind = keyof typeof DEFAULT_PROMPTS
// Segundos por trecho: 2 cômodos precisam de um pouco mais pra caminhada.
export const SECONDS: Record<ClipKind, number> = { room: 5, pair: WALK_SECONDS, pair_in: WALK_SECONDS, opening: 5, drone: 5 }
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
// prompt/seconds por trecho: só o tour completo usa (abertura de fora + caminhadas + cortes no mesmo vídeo);
// sem eles, vale a instrução e a duração do vídeo inteiro, como sempre.
// max_attempts: o tour completo usa 1 (dono, 2026-11-11: um trecho que falhou não é refeito sozinho — o dono decide).
export interface Clip { job_ref: string | null; status: string; attempts: number; from: number; to?: number; prompt?: string; seconds?: number; max_attempts?: number; error?: string }

/** Motivo da falha em português simples (pro dono), a partir do que a Higgsfield respondeu. Puro. */
export function failReason(raw: string | undefined | null): string {
  const t = String(raw ?? '').toLowerCase()
  if (!t) return 'o vídeo falhou no fornecedor'
  if (t.includes('credit') || t.includes('balance') || t.includes('top up')) return 'sem crédito no Higgsfield — recarregue o saldo para gerar'
  if (t.includes('nsfw') || t.includes('moderat') || t.includes('safety')) return 'o fornecedor recusou a foto (filtro de conteúdo)'
  return `o vídeo falhou no fornecedor: ${String(raw).slice(0, 160)}`
}

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

async function clipStatus(headers: Record<string, string>, jobRef: string): Promise<{ status: string; url: string | null; error?: string } | null> {
  const res = await fetch(`${HF_BASE}/requests/${encodeURIComponent(jobRef)}/status`, { headers, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) { console.log('[tour] status http', res.status); return null }
  const d = await res.json() as { status?: string; video?: { url?: string }; error?: unknown; detail?: unknown }
  // Falha: registra o motivo que a Higgsfield deu (saldo, moderação, foto…) —
  // sem isso só sobrava "passagem falhou 2x" (teste de 2026-10-14).
  if (['failed', 'nsfw', 'canceled'].includes(String(d.status))) {
    const why = (typeof d.error === 'string' ? d.error : JSON.stringify(d.error ?? d.detail ?? d.status)).slice(0, 400)
    console.log('[tour] higgsfield recusou', jobRef, String(d.status), why)
    return { status: String(d.status), url: null, error: String(d.status) === 'nsfw' ? 'nsfw' : why }
  }
  return { status: String(d.status ?? 'queued'), url: d.video?.url ?? null }
}

// Manda todos os trechos; o que não subir fica sem job_ref e tenta de novo na consulta.
export async function submitAll(headers: Record<string, string>, prompt: string, photos: string[], plan: Pick<Clip, 'from' | 'to' | 'prompt' | 'seconds' | 'max_attempts'>[], seconds?: number): Promise<Clip[]> {
  const refs = await Promise.all(plan.map(c => submitClip(headers, c.prompt ?? prompt, photos[c.from], c.to !== undefined ? photos[c.to] : undefined, c.seconds ?? seconds)))
  return refs.map((r, i) => ({ job_ref: r, status: 'processing', attempts: 1, ...plan[i] }))
}

// Atualiza cada passagem (mexe em `clips`). Devolve as URLs prontas, ou failed=true
// se alguma passagem falhou nas duas tentativas.
export async function pollClips(headers: Record<string, string>, prompt: string, photos: string[], clips: Clip[], seconds?: number):
  Promise<{ done: number; failed: boolean; urls: (string | null)[] }> {
  const urls: (string | null)[] = clips.map(() => null)
  await Promise.all(clips.map(async (c, i) => {
    // notAccepted: o pedido nunca foi aceito pela Higgsfield (nada cobrado) — pode reenviar até MAX_ATTEMPTS. Um trecho
    // que FOI gerado e falhou só é refeito até `max_attempts` (tour completo: 1 = nunca refaz sozinho).
    const resubmit = async (notAccepted = false) => {
      const max = notAccepted ? MAX_ATTEMPTS : (c.max_attempts ?? MAX_ATTEMPTS)
      if (c.attempts >= max) { c.status = 'failed'; return }
      c.attempts += 1
      c.job_ref = await submitClip(headers, c.prompt ?? prompt, photos[c.from ?? i], c.to !== undefined ? photos[c.to] : undefined, c.seconds ?? seconds)
      c.status = c.job_ref ? 'processing' : (c.attempts >= max ? 'failed' : 'processing')
    }
    if (!c.job_ref) { if (c.status !== 'failed') await resubmit(true); return }   // nunca subiu = nada cobrado; tenta enviar de novo
    const st = await clipStatus(headers, c.job_ref)
    if (!st) return
    if (st.status === 'completed' && st.url) { c.status = 'completed'; urls[i] = st.url; return }
    if (['failed', 'nsfw', 'canceled'].includes(st.status)) { c.error = st.error; await resubmit(); return }
    c.status = 'processing'
  }))
  return { done: clips.filter(c => c.status === 'completed').length, failed: clips.some(c => c.status === 'failed'), urls }
}

// ---------- colagem em partes ----------

export interface Output { path: string; from: number; to: number; nome?: string; upload_url?: string; total?: number; done?: boolean }
// mode 'vps': quem cola é o estúdio de vídeo na VPS (media_jobs.job_id), não esta função.
// Com `endcard` (tour automático do calendário, decisão do dono 2026-11-02) o vídeo SÓ sai pelo estúdio: 9:16 + encerramento
// de marca. Estúdio fora do ar → mode 'wait_studio' ("aguardando estúdio"), nunca a colagem antiga (4:5, sem encerramento).
export interface Endcard { url: string; seconds: number }
export interface Assembly {
  urls: string[]; metas: (ClipMeta | null)[]; outputs: Output[]; mode?: 'vps' | 'wait_studio'; job_id?: string; vps_since?: string
  endcard?: Endcard; wait_since?: string; vps_fails?: number
}

// ---------- acabamento na VPS (estúdio de vídeo, decisão do dono 2026-10-12) ----------
// Com o interruptor ligado e um servidor online, a colagem vai pra VPS: ela
// recodifica com ffmpeg (vídeo em pé 1080×1920 com fundo desfocado, entrada e
// saída suaves, áudio mudo AAC, capa). Se a VPS não pegar o trabalho a tempo
// ou falhar, o tour volta sozinho pra colagem antiga (mp4stream) — nunca trava.
const VPS_ONLINE_MS = 2 * 60_000
const VPS_IDLE_FALLBACK_MS = 3 * 60_000 // na fila e nenhum servidor online
const VPS_MAX_WAIT_MS = 20 * 60_000
const STUDIO_MAX_WAIT_MS = 48 * 3_600_000 // tour com encerramento espera o estúdio voltar até 48 h; depois falha (não solta sem encerramento)
const STUDIO_MAX_FAILS = 3 // o estúdio recusou o trabalho 3 vezes (ex.: arquivo do encerramento quebrado)
export const STUDIO_CAP = 'endcard' // o trabalhador informa em info.caps que sabe montar o encerramento

// deno-lint-ignore no-explicit-any
async function vpsOnline(admin: any): Promise<boolean> {
  const { data } = await admin.from('worker_nodes').select('id').eq('status', 'active')
    .gt('last_seen_at', new Date(Date.now() - VPS_ONLINE_MS).toISOString()).limit(1).maybeSingle()
  return !!data
}

// deno-lint-ignore no-explicit-any
async function vpsEnabled(admin: any): Promise<boolean> {
  const { data } = await admin.from('feature_flags').select('enabled').eq('key', 'vps_reel_finish').maybeSingle()
  return !!data?.enabled && await vpsOnline(admin)
}

// Estúdio pronto pra montar com encerramento: interruptor ligado + servidor online que sabe fazer o encerramento
// (um trabalhador antigo, sem a capacidade, ignoraria o encerramento — por isso não serve).
// deno-lint-ignore no-explicit-any
export async function studioReady(admin: any): Promise<boolean> {
  const { data: flag } = await admin.from('feature_flags').select('enabled').eq('key', 'vps_reel_finish').maybeSingle()
  if (!flag?.enabled) return false
  const { data } = await admin.from('worker_nodes').select('info').eq('status', 'active')
    .gt('last_seen_at', new Date(Date.now() - VPS_ONLINE_MS).toISOString()).limit(20)
  return ((data ?? []) as { info?: { caps?: unknown } | null }[]).some(n => Array.isArray(n.info?.caps) && (n.info!.caps as unknown[]).includes(STUDIO_CAP))
}

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
export type Advance = { status: 'processing'; done: number; total: number; waiting?: 'studio' } | { status: 'completed'; outputs: Output[] } | { status: 'failed'; reason: string }

// deno-lint-ignore no-explicit-any
export async function advanceTour(admin: any, supabaseUrl: string, key: string, headers: Record<string, string>, prompt: string,
  tour: TourRow, outputsFor: (urls: string[]) => Output[], seconds?: number, endcard?: Endcard | null): Promise<Advance> {
  const total = tour.clips.length
  const now = () => new Date().toISOString()
  // Entrega o trabalho de acabamento (com ou sem encerramento) pro estúdio. false = não deu pra criar o trabalho.
  // Troca wait_studio → vps com update CONDICIONAL: só quem pegou a linha cria o media_job (duas consultas ao mesmo tempo
  // não criam dois trabalhos). Se o insert falhar, devolve a linha pra "aguardando".
  const startJob = async (a: Assembly): Promise<boolean> => {
    const jobId = crypto.randomUUID()
    const { data: got } = await admin.from('video_tours').update({ assembly: { ...a, mode: 'vps', job_id: jobId, vps_since: now() }, updated_at: now() })
      .eq('id', tour.id).eq('status', 'assembling').eq('assembly->>mode', 'wait_studio').select('id').maybeSingle()
    if (!got) return false
    const { error } = await admin.from('media_jobs').insert({
      id: jobId, kind: 'reel_finish', video_tour_id: tour.id,
      input: { outputs: a.outputs.map(o => ({ path: o.path, clips: a.urls.slice(o.from, o.to), ...(a.endcard ? { endcard_url: a.endcard.url, endcard_seconds: a.endcard.seconds } : {}) })) },
    })
    if (error) {
      console.error('[tour] media_job não criado, volta a aguardar', tour.id, error.message)
      await admin.from('video_tours').update({ assembly: { ...a, mode: 'wait_studio' }, updated_at: now() }).eq('id', tour.id).eq('assembly->>job_id', jobId)
      return false
    }
    return true
  }
  const failStudio = async (a: Assembly, error: string): Promise<Advance> => {
    await admin.from('video_tours').update({ status: 'failed', assembly: a, error, updated_at: now() }).eq('id', tour.id)
    return { status: 'failed', reason: 'studio' }
  }

  if (tour.status === 'generating') {
    const { done, failed, urls } = await pollClips(headers, prompt, tour.photos, tour.clips, seconds)
    if (failed) {
      await admin.from('video_tours').update({ status: 'failed', clips: tour.clips, error: failReason(tour.clips.find(c => c.status === 'failed')?.error), updated_at: now() }).eq('id', tour.id)
      return { status: 'failed', reason: 'generation' }
    }
    if (done < total) {
      await admin.from('video_tours').update({ clips: tour.clips, updated_at: now() }).eq('id', tour.id)
      return { status: 'processing', done, total }
    }
    const assembly: Assembly = { urls: urls as string[], metas: urls.map(() => null), outputs: outputsFor(urls as string[]),
      ...(endcard ? { endcard, mode: 'wait_studio' as const, wait_since: now() } : {}) }  // com encerramento: já nasce "aguardando estúdio" (nunca cai na colagem antiga)
    const { data: locked } = await admin.from('video_tours').update({ status: 'assembling', clips: tour.clips, assembly, updated_at: now() })
      .eq('id', tour.id).eq('status', 'generating').select('id, updated_at').maybeSingle()
    if (!locked) return { status: 'processing', done, total }
    tour = { ...tour, status: 'assembling', assembly, updated_at: locked.updated_at }
    if (endcard) {
      if (await studioReady(admin) && await startJob(assembly)) return { status: 'processing', done, total }
      return { status: 'processing', done, total, waiting: 'studio' }
    }
    if (await vpsEnabled(admin)) {
      const { data: job } = await admin.from('media_jobs').insert({
        kind: 'reel_finish', video_tour_id: tour.id,
        input: { outputs: assembly.outputs.map(o => ({ path: o.path, clips: assembly.urls.slice(o.from, o.to) })) },
      }).select('id').single()
      if (job) {
        await admin.from('video_tours').update({ assembly: { ...assembly, mode: 'vps', job_id: job.id, vps_since: now() }, updated_at: now() }).eq('id', tour.id)
        return { status: 'processing', done, total }
      }
    }
  } else if (tour.status === 'assembling' && tour.assembly?.mode === 'wait_studio') {
    // Aguardando o estúdio (VPS) voltar; o resto do tempo só confere. Mexe no updated_at pra não travar a fila do tick.
    const a = tour.assembly
    if (Date.now() - new Date(a.wait_since ?? tour.updated_at).getTime() > STUDIO_MAX_WAIT_MS) return await failStudio(a, 'estúdio de vídeo não voltou em 48 h')
    if (await studioReady(admin) && await startJob(a)) return { status: 'processing', done: total, total }
    await admin.from('video_tours').update({ updated_at: now() }).eq('id', tour.id).eq('status', 'assembling')
    return { status: 'processing', done: total, total, waiting: 'studio' }
  } else if (tour.status === 'assembling' && tour.assembly?.mode === 'vps') {
    const a = tour.assembly
    const { data: job } = await admin.from('media_jobs').select('status').eq('id', a.job_id).maybeSingle()
    const waited = Date.now() - new Date(a.vps_since ?? tour.updated_at).getTime()
    const stuck = !job || job.status === 'failed' || waited > VPS_MAX_WAIT_MS ||
      (job.status === 'queued' && waited > VPS_IDLE_FALLBACK_MS && !await vpsOnline(admin))
    if (!stuck) return { status: 'processing', done: total, total }
    // Volta pra colagem antiga; a VPS não consegue mais entregar este trabalho (complete exige 'running').
    // Exceção (tour com encerramento): nunca cola sem encerramento — volta a "aguardando estúdio" (3 recusas = falha).
    console.log('[tour] VPS não entregou, voltando pra colagem antiga', tour.id, job?.status ?? 'sem trabalho')
    if (job && job.status !== 'failed' && job.status !== 'done') {
      await admin.from('media_jobs').update({ status: 'failed', error: 'tempo esgotado — tour voltou pra colagem antiga', updated_at: now() }).eq('id', a.job_id)
    }
    const { mode: _m, job_id: _j, vps_since: _s, ...rest } = a
    if (a.endcard) {
      const fails = (a.vps_fails ?? 0) + (job?.status === 'failed' || waited > VPS_MAX_WAIT_MS ? 1 : 0) // estourar o tempo também conta como recusa
      if (fails >= STUDIO_MAX_FAILS) return await failStudio({ ...rest, vps_fails: fails }, 'estúdio de vídeo recusou o trabalho 3 vezes')
      await admin.from('video_tours').update({ assembly: { ...rest, mode: 'wait_studio', vps_fails: fails }, updated_at: now() }).eq('id', tour.id).eq('status', 'assembling')
      return { status: 'processing', done: total, total, waiting: 'studio' }
    }
    await admin.from('video_tours').update({ assembly: rest, updated_at: new Date(Date.now() - LEASE_MS).toISOString() })
      .eq('id', tour.id).eq('status', 'assembling')
    return { status: 'processing', done: total, total }
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
