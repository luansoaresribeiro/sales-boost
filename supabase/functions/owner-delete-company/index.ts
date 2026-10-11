import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Exclusão de empresa pelo painel do Owner. Dois jeitos:
//  - uma por vez: {company_id, confirm_name} (digitar o nome do negócio);
//  - em lote (pedido do dono 2026-10-11): {company_ids, confirm_phrase} com a
//    frase exata "EXCLUIR N EMPRESAS" (N = quantas foram enviadas), até 25.
// Travas (conferidas AQUI, não só na tela): empresa com delete_protected
// (cliente real, conta do Sales Boost), com assinatura paga ou com acesso
// manual nunca é excluída — no lote, ela é pulada e volta na lista "skipped".

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MAX_BATCH = 25
const UUID = /^[0-9a-f-]{36}$/i
// deno-lint-ignore no-explicit-any
type Any = any

const bulkPhrase = (n: number) => `EXCLUIR ${n} ${n === 1 ? 'EMPRESA' : 'EMPRESAS'}`

function lockReason(c: Any): string | null {
  if (c.delete_protected) return 'protegida'
  if (c.stripe_subscription_id || ['active', 'trialing', 'past_due'].includes(c.subscription_status ?? '')) return 'tem assinatura paga'
  if (c.manual_access) return 'tem acesso manual'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(url, serviceKey)
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
    if (roleRow?.role !== 'owner') return json({ error: 'Forbidden' }, 403)

    const body = await req.json() as { company_id?: string; confirm_name?: string; company_ids?: unknown; confirm_phrase?: string }
    const cols = 'id, business_name, delete_protected, stripe_subscription_id, subscription_status, manual_access'

    // ── Em lote ──
    if (body.company_ids !== undefined) {
      const ids = Array.isArray(body.company_ids) ? [...new Set(body.company_ids.map(String))] : []
      if (!ids.length || ids.some(id => !UUID.test(id))) return json({ error: 'Lista de empresas inválida.' }, 400)
      if (ids.length > MAX_BATCH) return json({ error: `No máximo ${MAX_BATCH} empresas por vez.` }, 400)
      if ((body.confirm_phrase ?? '').trim() !== bulkPhrase(ids.length)) {
        return json({ error: `Frase de confirmação errada. Digite exatamente: ${bulkPhrase(ids.length)}` }, 400)
      }
      const { data: rows } = await admin.from('companies').select(cols).in('id', ids)
      const found = new Map((rows ?? []).map((c: Any) => [c.id, c]))
      const deleted: string[] = []
      const skipped: { id: string; name: string | null; reason: string }[] = []
      for (const id of ids) {
        const c = found.get(id)
        if (!c) { skipped.push({ id, name: null, reason: 'não encontrada' }); continue }
        const lock = lockReason(c)
        if (lock) { skipped.push({ id, name: c.business_name, reason: lock }); continue }
        const { error } = await admin.from('companies').delete().eq('id', id).eq('delete_protected', false)
        if (error) skipped.push({ id, name: c.business_name, reason: error.message })
        else deleted.push(id)
      }
      console.log('[owner-delete-company] lote por', user.email, 'excluídas', deleted.length, 'puladas', skipped.length)
      return json({ ok: true, deleted, skipped })
    }

    // ── Uma por vez ──
    const { company_id, confirm_name } = body
    if (!company_id || !confirm_name) return json({ error: 'company_id e confirm_name são obrigatórios' }, 400)

    const { data: company } = await admin.from('companies').select(cols).eq('id', company_id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    if (company.delete_protected) return json({ error: 'Esta empresa está protegida contra exclusão.' }, 403)

    const expected = (company.business_name ?? '').trim().toLowerCase()
    if (confirm_name.trim().toLowerCase() !== expected) {
      return json({ error: 'Nome não confere. Digite exatamente o nome do negócio pra confirmar.' }, 400)
    }

    const { error: deleteErr } = await admin.from('companies').delete().eq('id', company_id)
    if (deleteErr) return json({ error: deleteErr.message }, 500)

    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
