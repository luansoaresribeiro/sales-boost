// Kit grátis. Hoje (decisão do dono 2026-10-14, docs/DECISIONS.md): 1 foto
// de destaque → 3 artes. A FOTO REAL é tratada 1 vez pela Higgsfield (Qwen
// Image 3 Edit: luz, cor, nitidez — sem mudar nada do imóvel) e o nosso
// render-format imprime 3 artes diferentes por cima (regra 4: IA de imagem
// nunca escreve texto; os textos e tamanhos vêm da ficha). Antes (2026-10-11)
// eram 2 vídeos "drone" + 1 criativo — kits antigos com vídeos continuam
// funcionando aqui. Usado por:
//  - diagnosis-gift: o kit nasce antes da conta, preso ao diagnóstico;
//  - trial-video: kit de quem já tem conta + liga o kit do diagnóstico à empresa.
// Teto mensal único (FREE_VIDEO_MONTHLY_CAP, padrão 30) somando os dois.
import { advanceTour, clipPrompt, HF_BASE, hfHeaders, SECONDS, VIDEO_BUCKET, type TourRow } from './tourEngine.ts'

// deno-lint-ignore no-explicit-any
type Any = any

export const KIT_PHOTOS = 1 // 1 foto de destaque → 3 artes
export const KIT_CAP = Number(Deno.env.get('FREE_VIDEO_MONTHLY_CAP') ?? '30') || 30
const CREATIVE_ENDPOINT = '/alibaba/qwen-image-3/edit'
const CREATIVE_BUCKET = 'post-images'
const MAX_CREATIVE_ATTEMPTS = 2
// Tratamento que não termina nunca (job preso na Higgsfield) vira falha: a
// trava é liberada e a pessoa pode tentar de novo (a tela não espera pra sempre).
const KIT_MAX_MS = 20 * 60 * 1000

// Tratamento da foto real (testado no ensaio em 2026-10-11: mesmo cômodo,
// mesmos móveis, só luz/cor/nitidez/verticais).
const CREATIVE_PROMPT = 'Professional real-estate photo retouch of this exact place. Improve exposure and white balance, brighten the shadows, ' +
  'make the natural light warm and inviting, increase clarity and sharpness, straighten vertical lines. Keep everything else identical: ' +
  'do not add, remove, move or change any furniture, object, wall, floor, window, door, view or architecture. No text, no letters, no logos, no watermark.'
const CREATIVE_NEGATIVE = 'added furniture, removed objects, changed layout, extra windows, text, letters, logo, watermark, people, distortion'

export interface Creative {
  photo: string; job_ref: string | null; status: 'processing' | 'completed' | 'failed'; attempts: number
  enhanced_url?: string | null; render_attempts?: number
  started_at?: string // kit de artes: quando começou (prazo máximo, ver KIT_MAX_MS)
  final_url?: string | null // kit antigo: 1 arte só
  final_urls?: (string | null)[] // kit de 3 artes (uma por variação da ficha)
}

export async function monthCount(admin: Any): Promise<number> {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const { count } = await admin.from('video_tours').select('id', { count: 'exact', head: true }).eq('kind', 'trial').gte('created_at', monthStart)
  return count ?? 0
}

async function submitCreative(headers: Record<string, string>, photo: string): Promise<string | null> {
  try {
    const res = await fetch(`${HF_BASE}${CREATIVE_ENDPOINT}`, {
      method: 'POST', headers, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ prompt: CREATIVE_PROMPT, negative_prompt: CREATIVE_NEGATIVE, image_urls: [photo], resolution: '2k', aspect_ratio: '3:4', enable_thinking: false, prompt_extend: false }),
    })
    const out = await res.json().catch(() => ({})) as { request_id?: string; detail?: unknown }
    if (!res.ok || !out.request_id) { console.log('[kit] criativo higgsfield', res.status, JSON.stringify(out.detail ?? out).slice(0, 300)); return null }
    return out.request_id
  } catch (e) { console.log('[kit] criativo falhou ao enviar', String(e)); return null }
}

// Começa o kit: trata a foto de destaque (1 chamada paga). Grava a linha em
// video_tours (company_id OU diagnostic_id), sem trechos de vídeo. Devolve o
// id ou um erro pra mostrar.
export async function startKit(admin: Any, opts: { photos: string[]; companyId?: string | null; diagnosticId?: string | null }):
  Promise<{ id: string } | { error: string; status: number }> {
  const headers = hfHeaders()
  if (!headers) return { error: 'Geração indisponível no momento.', status: 503 }
  const hero = opts.photos[0]
  if (!hero) return { error: 'Falta a foto.', status: 400 }
  const jobRef = await submitCreative(headers, hero)
  if (!jobRef) return { error: 'Não consegui começar agora. Tente de novo em alguns minutos.', status: 502 }
  const creative: Creative = { photo: hero, job_ref: jobRef, status: 'processing', attempts: 1, started_at: new Date().toISOString() }
  const { data, error } = await admin.from('video_tours').insert({
    company_id: opts.companyId ?? null, diagnostic_id: opts.diagnosticId ?? null, kind: 'trial', status: 'generating',
    photos: [hero], clips: [], creative,
  }).select('id').single()
  if (error) return { error: error.message, status: error.code === '23505' ? 409 : 500 }
  console.log('[kit] iniciado', data.id, opts.companyId ?? `diag:${opts.diagnosticId}`)
  return { id: data.id }
}

// Avança o criativo (tratamento da foto). Quando pronto, guarda a imagem no
// nosso Storage (o link da Higgsfield expira).
async function advanceCreative(admin: Any, headers: Record<string, string>, tourId: string, c: Creative): Promise<Creative> {
  if (c.status !== 'processing') return c
  if (!c.job_ref) {
    if (c.attempts >= MAX_CREATIVE_ATTEMPTS) return { ...c, status: 'failed' }
    return { ...c, attempts: c.attempts + 1, job_ref: await submitCreative(headers, c.photo) }
  }
  try {
    const res = await fetch(`${HF_BASE}/requests/${encodeURIComponent(c.job_ref)}/status`, { headers, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return c
    const d = await res.json() as { status?: string; images?: { url?: string }[] }
    const url = d.images?.[0]?.url
    if (d.status === 'completed' && url) {
      const img = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!img.ok) return c
      const path = `kit/${tourId}-tratada.png`
      const { error } = await admin.storage.from(CREATIVE_BUCKET).upload(path, new Uint8Array(await img.arrayBuffer()), { contentType: 'image/png', upsert: true })
      // Não coube no nosso Storage (limite do bucket em produção: 5 MB): usa o
      // link da Higgsfield — o texto é impresso logo em seguida, no painel.
      if (error) { console.log('[kit] criativo: upload falhou, usando o link da Higgsfield', error.message); return { ...c, status: 'completed', enhanced_url: url } }
      return { ...c, status: 'completed', enhanced_url: admin.storage.from(CREATIVE_BUCKET).getPublicUrl(path).data.publicUrl }
    }
    if (['failed', 'nsfw', 'canceled'].includes(String(d.status))) {
      if (c.attempts >= MAX_CREATIVE_ATTEMPTS) return { ...c, status: 'failed' }
      return { ...c, attempts: c.attempts + 1, job_ref: await submitCreative(headers, c.photo) }
    }
  } catch (e) { console.log('[kit] criativo: consulta falhou', String(e)) }
  return c
}

export type KitView = { status: 'processing' | 'completed' | 'failed'; done: number; total: number; video_urls: string[]; creative: Creative | null }

// Avança o kit inteiro (tratamento da foto + vídeos dos kits antigos) e
// devolve o que a tela mostra.
// `prefix` decide a pasta dos vídeos (empresa ou "gift-<diagnóstico>").
export async function advanceKit(admin: Any, supabaseUrl: string, serviceKey: string, tour: TourRow & { creative: Creative | null; video_path?: string | null },
  verticalKey: string | null, prefix: string): Promise<KitView> {
  const publicVideo = (path: string) => admin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl
  const total = tour.clips.length
  const headers = hfHeaders()
  let creative = tour.creative
  if (headers && creative && creative.status === 'processing') {
    const next = await advanceCreative(admin, headers, tour.id, creative)
    if (JSON.stringify(next) !== JSON.stringify(creative)) {
      creative = next
      await admin.from('video_tours').update({ creative }).eq('id', tour.id)
    }
  }
  // Kit de 3 artes (sem vídeo): o andamento é o do tratamento da foto.
  if (total === 0) {
    if (creative?.status === 'processing' && creative.started_at && Date.now() - Date.parse(creative.started_at) > KIT_MAX_MS) {
      console.log('[kit] tratamento passou do prazo', tour.id)
      creative = { ...creative, status: 'failed' }
      await admin.from('video_tours').update({ creative }).eq('id', tour.id)
    }
    const st = creative?.status ?? 'failed'
    const row = st === 'completed' ? 'completed' : st === 'failed' ? 'failed' : null
    if (row && tour.status !== row) await admin.from('video_tours').update({ status: row }).eq('id', tour.id)
    return { status: st, done: st === 'completed' ? 1 : 0, total: 1, video_urls: [], creative }
  }
  if (tour.status === 'completed' && tour.video_path) {
    const outs = (tour.assembly?.outputs ?? [{ path: tour.video_path }]) as { path: string }[]
    return { status: 'completed', done: total, total, video_urls: outs.map(o => publicVideo(o.path)), creative }
  }
  if (tour.status === 'failed') return { status: 'failed', done: 0, total, video_urls: [], creative }
  if (!headers) return { status: 'processing', done: 0, total, video_urls: [], creative }
  const outputsFor = () => Array.from({ length: total }, (_, i) => ({ path: `trial/${prefix}/${tour.id}-${i + 1}.mp4`, from: i, to: i + 1 }))
  const r = await advanceTour(admin, supabaseUrl, serviceKey, headers, await clipPrompt(admin, verticalKey, 'drone'), tour, outputsFor, SECONDS.drone)
  if (r.status === 'completed') return { status: 'completed', done: total, total, video_urls: r.outputs.map(o => publicVideo(o.path)), creative }
  if (r.status === 'failed') return { status: 'failed', done: 0, total, video_urls: [], creative }
  return { status: 'processing', done: r.done, total, video_urls: [], creative }
}
