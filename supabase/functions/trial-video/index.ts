import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { advanceTour, DEFAULT_WALK_PROMPT, hfHeaders, submitAll, VIDEO_BUCKET, walkClips, type TourRow } from '../_shared/tourEngine.ts'

// Tour virtual grátis (decisões do dono 2026-10-08, docs/DECISIONS.md):
// o cliente envia TOUR_PHOTOS fotos reais na ordem da visita → passagens em
// caminhada (Kling 3.0 via Higgsfield; cada uma começa numa foto e termina na
// seguinte) → coladas num Reel único (_shared/tourEngine). 1 tour por conta,
// teto global de FREE_VIDEO_MONTHLY_CAP (30) por mês. A instrução de câmera vem
// da ficha (vertical_playbooks.config.free_video.walk_prompt, regra 6), com um
// padrão genérico. Nunca escreve texto no vídeo (regra 4).
//
// Tabelas: trial_video_claims (trava 1 por empresa; job_ref = "tour:<id>") e
// video_tours (fotos, passagens, colagem, vídeo final). Passagem que falha tenta
// de novo 1x; falhou de novo → tour 'failed' e a trava é liberada.
//
// actions:
//  - start {photo_urls: string[]}: valida, reserva e manda as passagens pra Higgsfield
//  - status: consulta as passagens; quando todas prontas, cola (em partes) e devolve a URL
//  - coupon_seen: marca companies.coupon_offer_shown_at (1x) — conta os 7 dias do cupom

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const CAP = Number(Deno.env.get('FREE_VIDEO_MONTHLY_CAP') ?? '30') || 30
const TOUR_PHOTOS = Number(Deno.env.get('TOUR_PHOTOS_TRIAL') ?? '6') || 6

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, serviceKey)

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
      const { data: tour } = await admin.from('video_tours').select('id, status, photos, clips, video_path, assembly, updated_at').eq('id', tourId).maybeSingle()
      if (!tour) return json({ status: 'none' })
      if (tour.status === 'completed' && tour.video_path) return json({ status: 'completed', video_url: publicVideo(tour.video_path) })
      const headers = hfHeaders()
      if (!headers) return json({ status: 'processing' })
      const r = await advanceTour(admin, supabaseUrl, serviceKey, headers, await walkPrompt(admin, company.vertical_key), tour as TourRow,
        () => [{ path: `trial/${company.id}/${tour.id}.mp4`, from: 0, to: (tour.clips as unknown[]).length }])
      if (r.status === 'failed') {
        await admin.from('trial_video_claims').delete().eq('id', claim.id)
        return json({ status: 'failed', reason: r.reason })
      }
      if (r.status === 'completed') {
        await admin.from('trial_video_claims').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', claim.id)
        console.log('[trial-video] tour concluído', company.id, tour.id)
        return json({ status: 'completed', video_url: publicVideo(r.outputs[0].path) })
      }
      return json(r)
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

    const clips = await submitAll(headers, await walkPrompt(admin, company.vertical_key), photos, walkClips(photos.length))
    if (clips.every(c => !c.job_ref)) {
      await admin.from('trial_video_claims').delete().eq('id', ins.id)
      return json({ error: 'Não consegui iniciar o vídeo agora. Tente de novo em alguns minutos.' }, 502)
    }
    const { data: tour, error: tErr } = await admin.from('video_tours')
      .insert({ company_id: company.id, kind: 'trial', status: 'generating', photos, clips }).select('id').single()
    if (tErr) { await admin.from('trial_video_claims').delete().eq('id', ins.id); return json({ error: tErr.message }, 500) }
    await admin.from('trial_video_claims').update({ job_ref: `tour:${tour.id}`, updated_at: new Date().toISOString() }).eq('id', ins.id)
    console.log('[trial-video] tour iniciado', company.id, tour.id, clips.filter(c => c.job_ref).length, '/', clips.length)
    return json({ status: 'processing', done: 0, total: clips.length })
  } catch (err) {
    console.error('trial-video error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// Instrução de câmera da ficha (regra 6): config.free_video.walk_prompt.
// deno-lint-ignore no-explicit-any
async function walkPrompt(admin: any, verticalKey: string | null): Promise<string> {
  if (!verticalKey) return DEFAULT_WALK_PROMPT
  const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
  return String(((data?.config ?? {}) as { free_video?: { walk_prompt?: string } }).free_video?.walk_prompt || DEFAULT_WALK_PROMPT).slice(0, 1500)
}
