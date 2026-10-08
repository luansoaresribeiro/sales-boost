import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Vídeo grátis do acesso grátis (decisões do dono 2026-10-08, docs/DECISIONS.md):
// 1 vídeo por empresa, a partir de UMA foto real que o cliente envia; teto
// global de 30/mês (FREE_VIDEO_MONTHLY_CAP); Higgsfield só anima a foto — a
// instrução vem da ficha do setor (vertical_playbooks.config.free_video.prompt,
// regra 6) com um padrão genérico. Nunca escreve texto no vídeo (regra 4).
//
// Trava: trial_video_claims (unique por company_id). Linha 'claimed' ANTES de
// chamar a Higgsfield; falha/moderação → apaga a linha (cliente tenta de novo).
//
// actions:
//  - start {photo_url}: valida, reserva e manda pra Higgsfield
//  - status: consulta; quando pronto copia o vídeo pro storage e devolve a URL
//  - coupon_seen: marca companies.coupon_offer_shown_at (1x) — conta os 7 dias do cupom

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const HF_BASE = 'https://api.higgsfield.ai'
const CAP = Number(Deno.env.get('FREE_VIDEO_MONTHLY_CAP') ?? '30') || 30
const HF_ENDPOINT = Deno.env.get('HF_VIDEO_ENDPOINT') ?? '/v1/image2video/dop'
const HF_MODEL = Deno.env.get('HF_VIDEO_MODEL') ?? 'dop-turbo'
const DEFAULT_PROMPT = 'Slow, smooth cinematic camera movement through the scene, natural light, calm and premium feeling. ' +
  'Keep every object, wall and piece of furniture exactly as in the photo — do not add, remove or change anything. ' +
  'No people, no text, no logos.'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function hfHeaders() {
  const cred = (Deno.env.get('HF_CREDENTIALS') ?? '').trim()
  if (!cred) return null
  return { Authorization: `Key ${cred}`, 'Content-Type': 'application/json' }
}

// job_ref = "v1:<job-set id>" ou "v2:<request id>". Devolve status
// normalizado (queued/in_progress/completed/failed/nsfw/canceled) + URL do vídeo.
async function hfStatus(jobRef: string, headers: Record<string, string>): Promise<{ status: string; url: string | null } | null> {
  const [ver, id] = jobRef.includes(':') ? jobRef.split(':', 2) : ['v2', jobRef]
  const url = ver === 'v1' ? `${HF_BASE}/v1/job-sets/${encodeURIComponent(id)}` : `${HF_BASE}/requests/${encodeURIComponent(id)}/status`
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) { console.log('[trial-video] status http', res.status); return null }
  if (ver === 'v1') {
    const d = await res.json() as { jobs?: { status?: string; results?: { raw?: { url?: string } } }[] }
    const job = d.jobs?.[0]
    if (!job) console.log('[trial-video] job-set sem jobs', JSON.stringify(d).slice(0, 300))
    return job ? { status: String(job.status ?? 'queued'), url: job.results?.raw?.url ?? null } : null
  }
  const d = await res.json() as { status?: string; video?: { url?: string } }
  return { status: String(d.status ?? 'queued'), url: d.video?.url ?? null }
}

// Bucket 'videos' (migration 20261008210000): post-images só aceita imagem.
const VIDEO_BUCKET = 'videos'
const videoPath = (companyId: string, claimId: string) => `trial/${companyId}/${claimId}.mp4`

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
    const body = await req.json().catch(() => ({})) as { action?: string; photo_url?: string }
    const { data: claim } = await admin.from('trial_video_claims').select('id, status, job_ref, created_at').eq('company_id', company.id).maybeSingle()
    const publicVideo = (id: string) => admin.storage.from(VIDEO_BUCKET).getPublicUrl(videoPath(company.id, id)).data.publicUrl

    if (body.action === 'coupon_seen') {
      if (claim?.status !== 'completed') return json({ error: 'Vídeo ainda não está pronto.' }, 400)
      if (!company.coupon_offer_shown_at) await admin.from('companies').update({ coupon_offer_shown_at: new Date().toISOString() }).eq('id', company.id).is('coupon_offer_shown_at', null)
      return json({ ok: true })
    }

    if (body.action === 'status') {
      if (!claim) return json({ status: 'none' })
      if (claim.status === 'completed') return json({ status: 'completed', video_url: publicVideo(claim.id) })
      if (!claim.job_ref) return json({ status: 'processing' })
      const headers = hfHeaders()
      if (!headers) return json({ status: 'processing' })
      const st = await hfStatus(claim.job_ref, headers)
      if (!st) return json({ status: 'processing' })
      if (st.status === 'completed' && st.url) {
        const vid = await fetch(st.url, { signal: AbortSignal.timeout(60_000) })
        if (!vid.ok) return json({ status: 'processing' })
        const bytes = new Uint8Array(await vid.arrayBuffer())
        const { error: upErr } = await admin.storage.from(VIDEO_BUCKET).upload(videoPath(company.id, claim.id), bytes, { contentType: 'video/mp4', upsert: true })
        if (upErr) { console.log('[trial-video] upload', upErr.message); return json({ status: 'processing' }) }
        await admin.from('trial_video_claims').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', claim.id)
        console.log('[trial-video] concluído', company.id, claim.job_ref)
        return json({ status: 'completed', video_url: publicVideo(claim.id) })
      }
      if (st.status === 'failed' || st.status === 'nsfw' || st.status === 'canceled') {
        // Créditos devolvidos pela Higgsfield; libera a trava pro cliente tentar de novo.
        await admin.from('trial_video_claims').delete().eq('id', claim.id)
        return json({ status: 'failed', reason: st.status === 'nsfw' ? 'moderation' : 'generation' })
      }
      return json({ status: 'processing', stage: st.status })
    }

    // action 'start'
    if (company.plan && company.plan !== 'free') return json({ error: 'Seu plano já inclui vídeos todo mês.' }, 400)
    if (claim) return json({ error: 'O vídeo grátis desta conta já foi usado.', status: claim.status }, 409)
    const photo = String(body.photo_url ?? '')
    const prefix = `${supabaseUrl}/storage/v1/object/public/post-images/renders/${company.id}/`
    if (!photo.startsWith(prefix) || photo.includes('..')) return json({ error: 'Foto inválida.' }, 400)
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
    if (insErr) return insErr.code === '23505' ? json({ error: 'O vídeo grátis desta conta já foi usado.' }, 409) : json({ error: insErr.message }, 500)

    const { data: pb } = company.vertical_key
      ? await admin.from('vertical_playbooks').select('config').eq('key', company.vertical_key).eq('enabled', true).maybeSingle()
      : { data: null }
    const prompt = String(((pb?.config ?? {}) as { free_video?: { prompt?: string } }).free_video?.prompt || DEFAULT_PROMPT).slice(0, 1500)

    // API v1 (/v1/...) recebe { params } e devolve um job-set { id }; a v2
    // recebe o input direto e devolve { request_id }.
    const isV1 = HF_ENDPOINT.startsWith('/v1/')
    const input = { model: HF_MODEL, prompt, input_images: [{ type: 'image_url', image_url: photo }] }
    const res = await fetch(`${HF_BASE}${HF_ENDPOINT}`, {
      method: 'POST', headers, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify(isV1 ? { params: input } : input),
    })
    const out = await res.json().catch(() => ({})) as { request_id?: string; id?: string; detail?: unknown }
    const jobId = isV1 ? out.id : out.request_id
    if (!res.ok || !jobId) {
      await admin.from('trial_video_claims').delete().eq('id', ins.id)
      console.log('[trial-video] higgsfield', res.status, JSON.stringify(out.detail ?? out).slice(0, 300))
      const msg = res.status === 403 ? 'Sem créditos de vídeo no momento.' : res.status === 401 ? 'Credencial de vídeo inválida.' : 'Não consegui iniciar o vídeo agora.'
      return json({ error: msg }, 502)
    }
    const jobRef = `${isV1 ? 'v1' : 'v2'}:${jobId}`
    await admin.from('trial_video_claims').update({ job_ref: jobRef, updated_at: new Date().toISOString() }).eq('id', ins.id)
    console.log('[trial-video] iniciado', company.id, jobRef)
    return json({ status: 'processing' })
  } catch (err) {
    console.error('trial-video error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
