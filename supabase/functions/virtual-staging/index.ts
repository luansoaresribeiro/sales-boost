/**
 * virtual-staging — "Mobiliar virtualmente" uma foto REAL de cômodo vazio
 * (Higgsfield, Qwen Image 3 Edit — o mesmo motor do criativo do kit grátis).
 * Pedido do dono, 2026-10-14. Ver migration 20261016120000_virtual_staging.sql.
 *
 * Regras:
 *  - Só a partir de uma foto que já está no item do catálogo (nunca imagem
 *    inventada do zero — regra 4); a instrução proíbe mexer na arquitetura.
 *  - Custa por foto → só com plano (402 na vitrine), teto mensal por
 *    empresa (VIRTUAL_STAGING_MONTHLY_CAP, padrão 10) e o teto ÚNICO de gasto
 *    do cliente em dólar (_shared/spendCap.ts).
 *  - Nunca grava a foto no item sozinho: a tela mostra o antes/depois e o
 *    dono escolhe "usar no imóvel".
 *
 * Ações (POST, JWT do dono):
 *   { action: 'start', item_id, photo_url, style } → { id }
 *   { action: 'status', id }                       → { status, ready }
 *   { action: 'result', id }                       → bytes da imagem pronta
 *     (o link da Higgsfield expira e não libera CORS; a tela recorta 4:5 e
 *     sobe no nosso Storage, igual a qualquer foto do catálogo)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requirePaidAccess } from '../_shared/access.ts'
import { HF_BASE, hfHeaders } from '../_shared/tourEngine.ts'
import { capMessage, fitsCap, HF_EDIT_COST_USD } from '../_shared/spendCap.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ENDPOINT = '/alibaba/qwen-image-3/edit'
const MONTHLY_CAP = Number(Deno.env.get('VIRTUAL_STAGING_MONTHLY_CAP') ?? '10') || 10
const MAX_ATTEMPTS = 2

interface StagingConfig { base: string; negative: string; styles: { key: string; prompt: string }[] }

async function submit(headers: Record<string, string>, cfg: StagingConfig, style: string, photo: string): Promise<string | null> {
  const st = cfg.styles.find(s => s.key === style)
  try {
    const res = await fetch(`${HF_BASE}${ENDPOINT}`, {
      method: 'POST', headers, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ prompt: `${cfg.base} ${st?.prompt ?? ''}`.trim().slice(0, 1500), negative_prompt: cfg.negative, image_urls: [photo], resolution: '2k', aspect_ratio: '3:4', enable_thinking: false, prompt_extend: false }),
    })
    const out = await res.json().catch(() => ({})) as { request_id?: string; detail?: unknown }
    if (!res.ok || !out.request_id) { console.log('[staging] higgsfield', res.status, JSON.stringify(out.detail ?? out).slice(0, 300)); return null }
    return out.request_id
  } catch (e) { console.log('[staging] envio falhou', String(e)); return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: company } = await admin.from('companies').select('id, vertical_key').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id as string)
    if (noPlan) return noPlan
    const headers = hfHeaders()
    if (!headers) return json({ error: 'Mobiliar está indisponível no momento.' }, 503)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', company.vertical_key ?? 'generico').eq('enabled', true).maybeSingle()
    const cfg = (pb?.config as { virtual_staging?: StagingConfig } | null)?.virtual_staging
    if (!cfg?.base || !Array.isArray(cfg.styles)) return json({ error: 'Este setor não tem "mobiliar" configurado.' }, 400)

    if (body.action === 'start') {
      const itemId = typeof body.item_id === 'string' ? body.item_id : ''
      const photoUrl = typeof body.photo_url === 'string' ? body.photo_url : ''
      const style = typeof body.style === 'string' && cfg.styles.some(s => s.key === body.style) ? body.style : cfg.styles[0].key
      const { data: item } = await admin.from('marketing_ai_knowledge').select('id, meta').eq('id', itemId).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
      if (!item) return json({ error: 'Item do catálogo não encontrado' }, 404)
      // Só foto REAL que já está no item (nunca uma já mobiliada, nunca link de fora).
      const photos = ((item.meta as { photos?: { url: string }[] } | null)?.photos ?? []).map(p => p.url)
      if (!photos.includes(photoUrl)) return json({ error: 'Escolha uma das fotos reais deste imóvel.' }, 400)

      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
      const { count } = await admin.from('virtual_staging').select('id', { count: 'exact', head: true }).eq('company_id', company.id).gte('created_at', monthStart)
      if ((count ?? 0) >= MONTHLY_CAP) return json({ error: `Você já usou as ${MONTHLY_CAP} fotos mobiliadas deste mês.`, code: 'cap' }, 429)
      const spend = await fitsCap(admin, company.id, HF_EDIT_COST_USD ?? 0)
      if (!spend.ok) return json({ error: capMessage(spend.spend.cap_usd), code: 'cap' }, 429)

      // Grava ANTES de enviar (e reconta): dois cliques ao mesmo tempo não
      // furam o teto do mês.
      const { data: row, error } = await admin.from('virtual_staging').insert({ company_id: company.id, item_id: item.id, source_url: photoUrl, style }).select('id').single()
      if (error) return json({ error: 'Não consegui começar agora.' }, 500)
      const { count: after } = await admin.from('virtual_staging').select('id', { count: 'exact', head: true }).eq('company_id', company.id).gte('created_at', monthStart)
      if ((after ?? 0) > MONTHLY_CAP) {
        await admin.from('virtual_staging').update({ status: 'failed' }).eq('id', row.id)
        return json({ error: `Você já usou as ${MONTHLY_CAP} fotos mobiliadas deste mês.`, code: 'cap' }, 429)
      }
      const jobRef = await submit(headers, cfg, style, photoUrl)
      if (!jobRef) {
        await admin.from('virtual_staging').update({ status: 'failed' }).eq('id', row.id)
        return json({ error: 'Não consegui começar agora. Tente de novo em alguns minutos.' }, 502)
      }
      await admin.from('virtual_staging').update({ job_ref: jobRef }).eq('id', row.id)
      return json({ ok: true, id: row.id })
    }

    const id = typeof body.id === 'string' ? body.id : ''
    const { data: row } = await admin.from('virtual_staging').select('*').eq('id', id).eq('company_id', company.id).maybeSingle()
    if (!row) return json({ error: 'Pedido não encontrado' }, 404)

    if (body.action === 'status') {
      if (row.status !== 'processing') return json({ ok: true, status: row.status, ready: row.status === 'completed' })
      const res = await fetch(`${HF_BASE}/requests/${encodeURIComponent(row.job_ref)}/status`, { headers, signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return json({ ok: true, status: 'processing', ready: false })
      const d = await res.json() as { status?: string; images?: { url?: string }[] }
      const url = d.images?.[0]?.url
      if (d.status === 'completed' && url) {
        await admin.from('virtual_staging').update({ status: 'completed', result_url: url }).eq('id', row.id)
        return json({ ok: true, status: 'completed', ready: true })
      }
      if (['failed', 'nsfw', 'canceled'].includes(String(d.status))) {
        if (row.attempts >= MAX_ATTEMPTS) {
          await admin.from('virtual_staging').update({ status: 'failed' }).eq('id', row.id)
          return json({ ok: true, status: 'failed', ready: false })
        }
        const again = await submit(headers, cfg, row.style, row.source_url)
        await admin.from('virtual_staging').update({ attempts: row.attempts + 1, job_ref: again ?? row.job_ref, status: again ? 'processing' : 'failed' }).eq('id', row.id)
      }
      return json({ ok: true, status: 'processing', ready: false })
    }

    if (body.action === 'result') {
      if (row.status !== 'completed' || !row.result_url) return json({ error: 'Ainda não ficou pronto.' }, 409)
      const img = await fetch(row.result_url, { signal: AbortSignal.timeout(60_000) })
      if (!img.ok) return json({ error: 'O link da imagem expirou — peça de novo.' }, 410)
      return new Response(new Uint8Array(await img.arrayBuffer()), { headers: { ...cors, 'Content-Type': img.headers.get('content-type') ?? 'image/png', 'Cache-Control': 'no-store' } })
    }

    return json({ error: 'Ação inválida' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
