/**
 * diagnosis-gift — o presente do diagnóstico (decisão do dono 2026-10-11,
 * docs/DECISIONS.md). No cadastro a pessoa manda 2 fotos de cômodos + 1 foto de
 * destaque; junto com o diagnóstico já começamos o kit grátis (2 vídeos drone
 * + 1 criativo de design, _shared/freeKit.ts). A conta ainda não existe: o kit
 * fica preso ao diagnóstico e o trial-video liga à empresa quando ela é criada.
 *
 * actions (todas com {diagnostic_id}):
 *  - upload_urls: links temporários pra enviar as 3 fotos (gift/<id>/1..3.jpg).
 *    Só pra diagnóstico novo (até 30 min) e sem kit ainda.
 *  - start: confere as 3 fotos, as travas (1 presente por e-mail e por
 *    Instagram, teto do mês) e começa o kit.
 *  - status: avança e devolve {status, done, total, video_urls, creative}.
 *
 * Fotos sempre reais (regra 4); vídeo e tratamento nunca escrevem texto.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { advanceKit, KIT_CAP, KIT_PHOTOS, monthCount, startKit, type Creative } from '../_shared/freeKit.ts'
import type { TourRow } from '../_shared/tourEngine.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
// deno-lint-ignore no-explicit-any
type Any = any
const FRESH_MS = 30 * 60 * 1000
const START_MS = 60 * 60 * 1000
const BUCKET = 'post-images'
const MAX_BYTES = 15 * 1024 * 1024
const TOUR_COLS = 'id, status, photos, clips, video_path, assembly, updated_at, creative, company_id'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
const pathOf = (id: string, i: number) => `gift/${id}/${i + 1}.jpg`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { action, diagnostic_id } = await req.json().catch(() => ({})) as { action?: string; diagnostic_id?: string }
    if (typeof diagnostic_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(diagnostic_id)) return json({ error: 'diagnostic_id inválido' }, 400)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: diag } = await admin.from('diagnostics').select('id, created_at, business_type, contact_email, instagram_url').eq('id', diagnostic_id).maybeSingle()
    if (!diag) return json({ error: 'Diagnóstico não encontrado.' }, 404)
    const age = Date.now() - Date.parse(diag.created_at)
    const { data: tour } = await admin.from('video_tours').select(TOUR_COLS).eq('diagnostic_id', diag.id).maybeSingle()

    if (action === 'upload_urls') {
      if (age > FRESH_MS) return json({ error: 'Este diagnóstico é antigo. Faça um novo pra receber o presente.' }, 410)
      if (tour) return json({ error: 'O presente deste diagnóstico já foi iniciado.' }, 409)
      const urls: string[] = []
      for (let i = 0; i < KIT_PHOTOS; i++) {
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(pathOf(diag.id, i), { upsert: true })
        if (error || !data) return json({ error: 'Não consegui preparar o envio das fotos.' }, 500)
        urls.push(data.token)
      }
      return json({ bucket: BUCKET, paths: Array.from({ length: KIT_PHOTOS }, (_, i) => pathOf(diag.id, i)), tokens: urls })
    }

    if (action === 'start') {
      if (tour) return json({ status: 'started' })
      if (age > START_MS) return json({ error: 'Este diagnóstico é antigo.' }, 410)
      // As 3 fotos têm que estar lá (e não podem ser enormes).
      const { data: files } = await admin.storage.from(BUCKET).list(`gift/${diag.id}`)
      const byName = new Map((files ?? []).map((f: Any) => [f.name, f]))
      for (let i = 0; i < KIT_PHOTOS; i++) {
        const f = byName.get(`${i + 1}.jpg`) as Any
        if (!f) return json({ error: 'Faltam fotos.' }, 400)
        if (Number(f.metadata?.size ?? 0) > MAX_BYTES) return json({ error: 'Foto grande demais.' }, 400)
        if (!/^image\/(jpeg|png|webp)$/.test(String(f.metadata?.mimetype ?? ''))) return json({ error: 'Envie fotos em JPG ou PNG.' }, 400)
      }
      // 1 presente por e-mail e por Instagram (qualquer diagnóstico com kit).
      const email = String(diag.contact_email ?? '').trim().toLowerCase()
      const ig = String(diag.instagram_url ?? '').trim().toLowerCase()
      const esc = (v: string) => v.replace(/[\\%_]/g, '\\$&')
      const [{ data: byEmail }, { data: byIg }] = await Promise.all([
        email ? admin.from('diagnostics').select('id').ilike('contact_email', esc(email)).neq('id', diag.id).limit(100) : Promise.resolve({ data: [] }),
        ig ? admin.from('diagnostics').select('id').eq('instagram_url', diag.instagram_url).neq('id', diag.id).limit(100) : Promise.resolve({ data: [] }),
      ])
      const same = [...(byEmail ?? []), ...(byIg ?? [])]
      const ids = (same ?? []).map((d: Any) => d.id)
      if (ids.length) {
        const { count } = await admin.from('video_tours').select('id', { count: 'exact', head: true }).in('diagnostic_id', ids)
        if ((count ?? 0) > 0) return json({ status: 'already_used' }, 409)
      }
      if (await monthCount(admin) >= KIT_CAP) { console.log('[diagnosis-gift] teto mensal'); return json({ status: 'cap_reached' }, 429) }
      const { data: bt } = await admin.from('business_types').select('vertical_key').eq('label', diag.business_type ?? '').maybeSingle()
      const photos = Array.from({ length: KIT_PHOTOS }, (_, i) => admin.storage.from(BUCKET).getPublicUrl(pathOf(diag.id, i)).data.publicUrl)
      const r = await startKit(admin, { photos, verticalKey: bt?.vertical_key ?? null, diagnosticId: diag.id })
      if ('error' in r) return r.status === 409 ? json({ status: 'started' }) : json({ error: r.error }, r.status)
      return json({ status: 'started' })
    }

    if (action === 'status') {
      if (!tour) return json({ status: 'none' })
      const { data: bt } = await admin.from('business_types').select('vertical_key').eq('label', diag.business_type ?? '').maybeSingle()
      const view = await advanceKit(admin, supabaseUrl, serviceKey, tour as TourRow & { creative: Creative | null }, bt?.vertical_key ?? null, `gift-${diag.id}`)
      return json(view)
    }
    return json({ error: 'action inválida' }, 400)
  } catch (err) {
    console.error('diagnosis-gift error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
