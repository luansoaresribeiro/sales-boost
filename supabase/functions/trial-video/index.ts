import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import MP4Box from 'https://esm.sh/mp4box@0.5.2'
import { concatMp4 } from '../_shared/mp4concat.ts'

// Tour virtual grátis (decisões do dono 2026-10-08, docs/DECISIONS.md):
// o cliente envia TOUR_PHOTOS fotos reais na ordem da visita → um trecho de
// vídeo por foto (Kling 3.0 via Higgsfield) → os trechos são colados num
// Reel único (_shared/mp4concat, sem recodificar). 1 tour por conta, teto
// global de FREE_VIDEO_MONTHLY_CAP (30) por mês. A instrução de câmera vem da
// ficha do setor (vertical_playbooks.config.free_video.prompt, regra 6) com um
// padrão genérico. Nunca escreve texto no vídeo nem altera o imóvel (regra 4).
//
// Tabelas: trial_video_claims (trava 1 por empresa; job_ref = "tour:<id>") e
// video_tours (fotos, trechos, vídeo final). Falha de trecho: tenta de novo 1x;
// falhou de novo → tour 'failed' e a trava é liberada (cliente tenta de novo).
//
// actions:
//  - start {photo_urls: string[]}: valida, reserva e manda os trechos pra Higgsfield
//  - status: consulta os trechos; quando todos prontos, cola e devolve a URL
//  - coupon_seen: marca companies.coupon_offer_shown_at (1x) — conta os 7 dias do cupom

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const HF_BASE = 'https://api.higgsfield.ai'
const CAP = Number(Deno.env.get('FREE_VIDEO_MONTHLY_CAP') ?? '30') || 30
const TOUR_PHOTOS = Number(Deno.env.get('TOUR_PHOTOS_TRIAL') ?? '6') || 6
// Kling 3.0 Standard (escolha do dono 2026-10-08 depois do teste com o DoP turbo,
// que deixou uma mancha). US$ 0,54 por trecho de 5 s medido no painel da Higgsfield.
const HF_ENDPOINT = Deno.env.get('HF_VIDEO_ENDPOINT') ?? '/kling-video/v3.0/std/image-to-video'
const HF_DURATION = Number(Deno.env.get('HF_VIDEO_DURATION') ?? '5') || 5
const MAX_ATTEMPTS = 2
const DEFAULT_PROMPT = 'Slow, smooth cinematic camera movement through the room, natural light, calm and premium feeling. ' +
  'Keep every object, wall and piece of furniture exactly as in the photo — do not add, remove or change anything. ' +
  'No people, no text, no logos.'
// Bucket 'videos' (migration 20261008210000): post-images só aceita imagem.
const VIDEO_BUCKET = 'videos'

interface Clip { job_ref: string | null; status: string; attempts: number }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function hfHeaders(): Record<string, string> | null {
  const cred = (Deno.env.get('HF_CREDENTIALS') ?? '').trim()
  return cred ? { Authorization: `Key ${cred}`, 'Content-Type': 'application/json' } : null
}

async function submitClip(headers: Record<string, string>, photo: string, prompt: string): Promise<string | null> {
  const res = await fetch(`${HF_BASE}${HF_ENDPOINT}`, {
    method: 'POST', headers, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ prompt, image_url: photo, duration: HF_DURATION }),
  })
  const out = await res.json().catch(() => ({})) as { request_id?: string; detail?: unknown }
  if (!res.ok || !out.request_id) {
    console.log('[trial-video] higgsfield', res.status, JSON.stringify(out.detail ?? out).slice(0, 300))
    return null
  }
  return out.request_id
}

async function clipStatus(headers: Record<string, string>, jobRef: string): Promise<{ status: string; url: string | null } | null> {
  const res = await fetch(`${HF_BASE}/requests/${encodeURIComponent(jobRef)}/status`, { headers, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) { console.log('[trial-video] status http', res.status); return null }
  const d = await res.json() as { status?: string; video?: { url?: string } }
  return { status: String(d.status ?? 'queued'), url: d.video?.url ?? null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: company } = await admin.from('companies').select('id, plan, vertical_key, coupon_offer_shown_at').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const body = await req.json().catch(() => ({})) as { action?: string; photo_urls?: unknown }
    const { data: claim } = await admin.from('trial_video_claims').select('id, status, job_ref').eq('company_id', company.id).maybeSingle()
    const tourId = claim?.job_ref?.startsWith('tour:') ? claim.job_ref.slice(5) : null
    const publicVideo = (path: string) => admin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl

    if (body.action === 'coupon_seen') {
      if (claim?.status !== 'completed') return json({ error: 'Vídeo ainda não está pronto.' }, 400)
      if (!company.coupon_offer_shown_at) await admin.from('companies').update({ coupon_offer_shown_at: new Date().toISOString() }).eq('id', company.id).is('coupon_offer_shown_at', null)
      return json({ ok: true })
    }

    if (body.action === 'status') {
      if (!claim || !tourId) return json({ status: 'none' })
      const { data: tour } = await admin.from('video_tours').select('id, status, photos, clips, video_path').eq('id', tourId).maybeSingle()
      if (!tour) return json({ status: 'none' })
      if (tour.status === 'completed' && tour.video_path) return json({ status: 'completed', video_url: publicVideo(tour.video_path) })
      if (tour.status === 'assembling') return json({ status: 'processing', done: (tour.clips as Clip[]).length, total: (tour.clips as Clip[]).length })
      const headers = hfHeaders()
      if (!headers) return json({ status: 'processing' })

      // Atualiza cada trecho que ainda não terminou (em paralelo).
      const clips = tour.clips as Clip[]
      const photos = tour.photos as string[]
      const urls: (string | null)[] = clips.map(() => null)
      const prompt = await fichaPrompt(admin, company.vertical_key)
      await Promise.all(clips.map(async (c, i) => {
        if (!c.job_ref) return
        const st = await clipStatus(headers, c.job_ref)
        if (!st) return
        if (st.status === 'completed' && st.url) { c.status = 'completed'; urls[i] = st.url; return }
        if (['failed', 'nsfw', 'canceled'].includes(st.status)) {
          if (c.attempts < MAX_ATTEMPTS) {
            const ref = await submitClip(headers, photos[i], prompt)
            c.job_ref = ref; c.attempts += 1; c.status = ref ? 'processing' : 'failed'
          } else c.status = 'failed'
          return
        }
        c.status = 'processing'
      }))

      if (clips.some(c => c.status === 'failed')) {
        await admin.from('video_tours').update({ status: 'failed', clips, error: 'trecho falhou 2x', updated_at: new Date().toISOString() }).eq('id', tour.id)
        await admin.from('trial_video_claims').delete().eq('id', claim.id)
        return json({ status: 'failed', reason: 'generation' })
      }
      const done = clips.filter(c => c.status === 'completed').length
      if (done < clips.length) {
        await admin.from('video_tours').update({ clips, updated_at: new Date().toISOString() }).eq('id', tour.id)
        return json({ status: 'processing', done, total: clips.length })
      }

      // Todos prontos: só UMA chamada cola (troca generating → assembling atômica).
      const { data: locked } = await admin.from('video_tours').update({ status: 'assembling', clips, updated_at: new Date().toISOString() })
        .eq('id', tour.id).eq('status', 'generating').select('id').maybeSingle()
      if (!locked) return json({ status: 'processing', done, total: clips.length })
      try {
        const parts = await Promise.all(urls.map(async u => {
          const r = await fetch(u!, { signal: AbortSignal.timeout(60_000) })
          if (!r.ok) throw new Error(`download do trecho ${r.status}`)
          return new Uint8Array(await r.arrayBuffer())
        }))
        const mp4 = concatMp4(MP4Box, parts)
        const path = `trial/${company.id}/${tour.id}.mp4`
        const { error: upErr } = await admin.storage.from(VIDEO_BUCKET).upload(path, mp4, { contentType: 'video/mp4', upsert: true })
        if (upErr) throw new Error(upErr.message)
        await admin.from('video_tours').update({ status: 'completed', video_path: path, updated_at: new Date().toISOString() }).eq('id', tour.id)
        await admin.from('trial_video_claims').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', claim.id)
        console.log('[trial-video] tour concluído', company.id, tour.id, mp4.length)
        return json({ status: 'completed', video_url: publicVideo(path) })
      } catch (e) {
        // Volta pra 'generating' pra próxima consulta tentar colar de novo.
        console.error('[trial-video] colagem falhou', String(e))
        await admin.from('video_tours').update({ status: 'generating', error: String(e).slice(0, 300), updated_at: new Date().toISOString() }).eq('id', tour.id)
        return json({ status: 'processing', done, total: clips.length })
      }
    }

    // action 'start'
    if (company.plan && company.plan !== 'free') return json({ error: 'Seu plano já inclui tours todo mês.' }, 400)
    if (claim) return json({ error: 'O tour grátis desta conta já foi usado.', status: claim.status }, 409)
    const photos = Array.isArray(body.photo_urls) ? body.photo_urls.map(String) : []
    if (photos.length !== TOUR_PHOTOS) return json({ error: `Envie exatamente ${TOUR_PHOTOS} fotos.` }, 400)
    const prefix = `${supabaseUrl}/storage/v1/object/public/post-images/renders/${company.id}/`
    if (photos.some(p => !p.startsWith(prefix) || p.includes('..'))) return json({ error: 'Foto inválida.' }, 400)
    const headers = hfHeaders()
    if (!headers) return json({ error: 'Geração de vídeo indisponível no momento.' }, 503)

    // Teto global do mês (todas as contas grátis somadas).
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
    const { count } = await admin.from('trial_video_claims').select('id', { count: 'exact', head: true }).gte('created_at', monthStart)
    if ((count ?? 0) >= CAP) {
      console.log('[trial-video] teto mensal atingido', count, '/', CAP)
      return json({ status: 'cap_reached' }, 429)
    }

    const { data: ins, error: insErr } = await admin.from('trial_video_claims').insert({ company_id: company.id, status: 'claimed' }).select('id').single()
    if (insErr) return insErr.code === '23505' ? json({ error: 'O tour grátis desta conta já foi usado.' }, 409) : json({ error: insErr.message }, 500)

    const prompt = await fichaPrompt(admin, company.vertical_key)
    const refs = await Promise.all(photos.map(p => submitClip(headers, p, prompt)))
    if (refs.every(r => !r)) {
      await admin.from('trial_video_claims').delete().eq('id', ins.id)
      return json({ error: 'Não consegui iniciar o vídeo agora. Tente de novo em alguns minutos.' }, 502)
    }
    // Trecho que não subiu de primeira entra como 'failed' com 1 tentativa: o status reenvia.
    const clips: Clip[] = refs.map(r => ({ job_ref: r, status: r ? 'processing' : 'failed', attempts: 1 }))
    const { data: tour, error: tErr } = await admin.from('video_tours')
      .insert({ company_id: company.id, kind: 'trial', status: 'generating', photos, clips: clips.map(c => c.job_ref ? c : { ...c, status: 'processing', job_ref: null }) })
      .select('id').single()
    if (tErr) { await admin.from('trial_video_claims').delete().eq('id', ins.id); return json({ error: tErr.message }, 500) }
    await admin.from('trial_video_claims').update({ job_ref: `tour:${tour.id}`, updated_at: new Date().toISOString() }).eq('id', ins.id)
    // Reenvia agora os que não subiram (sem job_ref) — uma vez.
    if (refs.some(r => !r)) {
      const fixed = await Promise.all(clips.map(async (c, i) => c.job_ref ? c : { job_ref: await submitClip(headers, photos[i], prompt), status: 'processing', attempts: 2 }))
      await admin.from('video_tours').update({ clips: fixed.map(c => c.job_ref ? c : { ...c, status: 'failed' }) }).eq('id', tour.id)
    }
    console.log('[trial-video] tour iniciado', company.id, tour.id, refs.filter(Boolean).length, '/', photos.length)
    return json({ status: 'processing', done: 0, total: photos.length })
  } catch (err) {
    console.error('trial-video error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function fichaPrompt(admin: any, verticalKey: string | null): Promise<string> {
  if (!verticalKey) return DEFAULT_PROMPT
  const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
  return String(((data?.config ?? {}) as { free_video?: { prompt?: string } }).free_video?.prompt || DEFAULT_PROMPT).slice(0, 1500)
}
