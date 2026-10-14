import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { advanceKit, KIT_CAP, KIT_PHOTOS, monthCount, startKit, type Creative } from '../_shared/freeKit.ts'
import type { TourRow } from '../_shared/tourEngine.ts'

// Kit grátis da conta (decisões do dono 2026-10-09, 2026-10-11 e 2026-10-14,
// docs/DECISIONS.md): 1 foto de destaque → foto real tratada pela Higgsfield
// (1 chamada paga) → 3 artes com o texto e o tamanho de cada variação da ficha
// (config.gift_creative.variants), impressas pelo nosso render-format. Kits
// antigos (2 vídeos drone + 1 criativo) continuam aparecendo. Motor em
// _shared/freeKit.ts. 1 kit por conta, teto global FREE_VIDEO_MONTHLY_CAP
// (30) por mês somando os kits do diagnóstico.
//
// O kit pode ter nascido no DIAGNÓSTICO (diagnosis-gift, antes da conta): na
// primeira consulta da conta, ele é ligado à empresa aqui.
//
// Tabelas: trial_video_claims (trava 1 por empresa; job_ref = "tour:<id>") e
// video_tours (fotos, trechos, gravação, criativo).
//
// actions:
//  - start {photo_urls: string[1]}: a foto de destaque; valida, reserva e começa
//  - status: avança; devolve as artes (e os vídeos dos kits antigos) quando prontos
//  - coupon_seen: marca companies.coupon_offer_shown_at (1x) — conta os 7 dias do cupom

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
// deno-lint-ignore no-explicit-any
type Any = any
const TOUR_COLS = 'id, status, photos, clips, video_path, assembly, updated_at, creative'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Texto e tamanho de cada arte: da ficha (regra 6), nunca da IA (regra 4), sem
// números (regra 5). Ficha sem `variants`: 1 arte com o texto antigo.
// Stories: o Instagram cobre o topo (barra de progresso/perfil) e o rodapé
// (caixa de resposta) — o texto fica no meio.
const storySafe = (w: number, h: number) => ({ top: Math.round(h * 0.14), right: Math.round(w * 0.08), bottom: Math.round(h * 0.2), left: Math.round(w * 0.08) })
interface Variant { fields: Record<string, string>; width: number; height: number }
async function creativeVariants(admin: Any, verticalKey: string | null, city: string | null): Promise<Variant[]> {
  const { data } = verticalKey ? await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).maybeSingle() : { data: null }
  type Raw = { tag?: string; eyebrow?: string; headline?: string; offer?: string; cta?: string; width?: number; height?: number; scale?: number }
  const g = ((data?.config ?? {}) as { gift_creative?: Raw & { variants?: Raw[] } }).gift_creative ?? {}
  const cidade = String(city ?? '').split(/[/,]/)[0].trim()
  const fill = (v?: string) => String(v ?? '').replace('{cidade}', cidade).replace(/\s+/g, ' ').trim()
  const size = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 600 && Number(v) <= 1920 ? Number(v) : d)
  const raw = Array.isArray(g.variants) && g.variants.length ? g.variants.slice(0, 3) : [g]
  return raw.map(r => ({
    fields: { tag: fill(r.tag), eyebrow: fill(r.eyebrow), headline: fill(r.headline), offer: fill(r.offer), cta: fill(r.cta), scale: String(Number(r.scale) || 1) },
    width: size(r.width, 1080), height: size(r.height, 1350),
  })).filter(v => v.fields.headline)
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

    const { data: company } = await admin.from('companies').select('id, plan, vertical_key, city, coupon_offer_shown_at').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const body = await req.json().catch(() => ({})) as { action?: string; photo_urls?: unknown }
    let { data: claim } = await admin.from('trial_video_claims').select('id, status, job_ref').eq('company_id', company.id).maybeSingle()

    // Kit que nasceu no diagnóstico (antes da conta): liga à empresa agora.
    if (!claim) {
      const { data: diags } = await admin.from('diagnostics').select('id').eq('company_id', company.id).limit(20)
      const ids = (diags ?? []).map((d: Any) => d.id)
      const { data: gift } = ids.length
        ? await admin.from('video_tours').select('id, status').in('diagnostic_id', ids).is('company_id', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
        : { data: null }
      if (gift) {
        const { data: ins } = await admin.from('trial_video_claims')
          .insert({ company_id: company.id, status: gift.status === 'completed' ? 'completed' : 'claimed', job_ref: `tour:${gift.id}` }).select('id, status, job_ref').single()
        if (ins) {
          await admin.from('video_tours').update({ company_id: company.id }).eq('id', gift.id).is('company_id', null)
          claim = ins
          console.log('[trial-video] kit do diagnóstico ligado à empresa', company.id, gift.id)
        }
      }
    }
    const tourId = claim?.job_ref?.startsWith('tour:') ? claim.job_ref.slice(5) : null

    if (body.action === 'coupon_seen') {
      if (claim?.status !== 'completed') return json({ error: 'Vídeo ainda não está pronto.' }, 400)
      if (!company.coupon_offer_shown_at) await admin.from('companies').update({ coupon_offer_shown_at: new Date().toISOString() }).eq('id', company.id).is('coupon_offer_shown_at', null)
      return json({ ok: true })
    }

    if (body.action === 'status') {
      if (!claim || !tourId) return json({ status: 'none' })
      const { data: tour } = await admin.from('video_tours').select(TOUR_COLS).eq('id', tourId).maybeSingle()
      if (!tour) return json({ status: 'none' })
      // Pasta dos vídeos: a que o kit já usa (do diagnóstico ou da empresa).
      const prefix = (tour.assembly?.outputs?.[0]?.path as string | undefined)?.split('/')[1] ?? company.id
      const view = await advanceKit(admin, supabaseUrl, serviceKey, tour as TourRow & { creative: Creative | null }, company.vertical_key, prefix)

      // Foto tratada pronta → imprime as artes (render-format, com o login da
      // própria pessoa). Kit antigo (com vídeos) que já tem a arte: nada a fazer.
      let creative = view.creative
      const artKit = (tour.clips ?? []).length === 0
      if (creative?.status === 'completed' && creative.enhanced_url && !creative.final_url) {
        try {
          const variants = await creativeVariants(admin, company.vertical_key, company.city)
          const urls = (creative.final_urls ?? []).slice(0, variants.length)
          // Setor sem texto na ficha: entrega a foto tratada sem texto (nada de texto genérico).
          if (!variants.length) creative = { ...creative, final_url: creative.enhanced_url, final_urls: [creative.enhanced_url] }
          else {
            const enhanced = creative.enhanced_url
            const done = await Promise.all(variants.map(async (v, i) => {
              if (urls[i]) return urls[i]
              try {
                const r = await fetch(`${supabaseUrl}/functions/v1/render-format`, {
                  method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ template: 'photo', background: enhanced, fields: v.fields, width: v.width, height: v.height, save: false, ...(v.height / v.width > 1.6 ? { safe: storySafe(v.width, v.height) } : {}) }),
                })
                const out = await r.json().catch(() => ({})) as { url?: string; error?: string }
                if (!out.url) console.log('[trial-video] arte: render falhou', i, r.status, out.error ?? '')
                return out.url ?? null
              } catch (e) { console.log('[trial-video] arte: render falhou', i, String(e)); return null }
            }))
            // 6 rodadas com falha (~1 min de consultas): a arte que faltar vira a
            // foto tratada sem texto (melhor que esperar pra sempre). Queda de
            // rede também conta como rodada.
            const tries = (creative.render_attempts ?? 0) + (done.some(u => !u) ? 1 : 0)
            const final = tries >= 6 ? done.map(u => u ?? enhanced) : done
            creative = { ...creative, render_attempts: tries, final_urls: final, ...(final.every(Boolean) ? { final_url: final[0] } : {}) }
          }
          await admin.from('video_tours').update({ creative }).eq('id', tour.id)
        } catch (e) { console.log('[trial-video] arte: render falhou', String(e)) }
      }
      const creativeUrls = creative?.final_url ? ((creative.final_urls?.length ? creative.final_urls : [creative.final_url]).filter(Boolean) as string[]) : []
      const creativeOut = { creative_status: creative?.status ?? null, creative_url: creativeUrls[0] ?? null, creative_urls: creativeUrls }

      if (view.status === 'failed') {
        await admin.from('trial_video_claims').delete().eq('id', claim.id)
        return json({ status: 'failed', reason: 'generation' })
      }
      // Kit de artes: só fica pronto quando as artes estão impressas.
      if (view.status === 'completed' && (!artKit || creativeUrls.length)) {
        if (claim.status !== 'completed') {
          await admin.from('trial_video_claims').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', claim.id)
          console.log('[trial-video] kit pronto', company.id, tour.id, artKit ? 'artes' : 'vídeos', view.total)
        }
        return json({ status: 'completed', video_urls: view.video_urls, ...creativeOut })
      }
      return json({ status: 'processing', done: artKit ? 0 : view.done, total: view.total, ...creativeOut })
    }

    // action 'start'
    if (company.plan && company.plan !== 'free') return json({ error: 'Seu plano já inclui criativos todo mês.' }, 400)
    if (claim) return json({ error: 'O kit grátis desta conta já foi usado.', status: claim.status }, 409)
    const photos = Array.isArray(body.photo_urls) ? body.photo_urls.map(String) : []
    if (photos.length !== KIT_PHOTOS) return json({ error: KIT_PHOTOS === 1 ? 'Escolha 1 foto.' : `Escolha exatamente ${KIT_PHOTOS} fotos.` }, 400)
    const prefix = `${supabaseUrl}/storage/v1/object/public/post-images/renders/${company.id}/`
    if (photos.some(p => !p.startsWith(prefix) || p.includes('..'))) return json({ error: 'Foto inválida.' }, 400)

    if (await monthCount(admin) >= KIT_CAP) {
      console.log('[trial-video] teto mensal atingido', KIT_CAP)
      return json({ status: 'cap_reached' }, 429)
    }

    const { data: ins, error: insErr } = await admin.from('trial_video_claims').insert({ company_id: company.id, status: 'claimed' }).select('id').single()
    if (insErr) return insErr.code === '23505' ? json({ error: 'O kit grátis desta conta já foi usado.' }, 409) : json({ error: insErr.message }, 500)
    const r = await startKit(admin, { photos, companyId: company.id })
    if ('error' in r) { await admin.from('trial_video_claims').delete().eq('id', ins.id); return json({ error: r.error }, r.status) }
    await admin.from('trial_video_claims').update({ job_ref: `tour:${r.id}`, updated_at: new Date().toISOString() }).eq('id', ins.id)
    return json({ status: 'processing', done: 0, total: 1 })
  } catch (err) {
    console.error('trial-video error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
