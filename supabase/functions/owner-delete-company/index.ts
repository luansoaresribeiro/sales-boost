import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Exclusão de cadastro pelo painel do Owner: apaga a empresa E o login da
// pessoa (antes o login ficava e a linha voltava como "sem perfil" — correção
// pedida pelo dono em 2026-10-11). Dois jeitos:
//  - uma por vez: {company_id, confirm_name} (digitar o nome do negócio);
//  - em lote: {company_ids, user_ids, confirm_phrase} — user_ids são logins
//    sem empresa ("sem perfil") — com a frase exata "EXCLUIR N CADASTROS"
//    (N = total enviado), até 25.
// Travas (conferidas AQUI, não só na tela): empresa com delete_protected
// (cliente real, conta do Sales Boost), com assinatura paga ou com acesso
// manual nunca é excluída; login de dono/admin (user_roles) e o de quem está
// excluindo nunca são apagados. No lote, o que é travado volta em "skipped".

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MAX_BATCH = 25
const UUID = /^[0-9a-f-]{36}$/i
// deno-lint-ignore no-explicit-any
type Any = any

const bulkPhrase = (n: number) => `EXCLUIR ${n} ${n === 1 ? 'CADASTRO' : 'CADASTROS'}`

// Apaga o login (e o papel 'client') — nunca de dono/admin nem o próprio.
async function deleteLogin(admin: Any, userId: string | null, callerId: string): Promise<string | null> {
  if (!userId) return null
  if (userId === callerId) return 'é a sua própria conta'
  const { data: { user } } = await admin.auth.admin.getUserById(userId)
  if (!user) return null
  const { data: role } = await admin.from('user_roles').select('role').eq('email', user.email ?? '').maybeSingle()
  if (role?.role && role.role !== 'client') return 'login de dono/admin'
  const { data: other } = await admin.from('companies').select('id').eq('user_id', userId).limit(1).maybeSingle()
  if (other) return 'login ainda tem outra empresa'
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return error.message
  if (user.email) await admin.from('user_roles').delete().eq('email', user.email).eq('role', 'client')
  return null
}

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

    const body = await req.json() as { company_id?: string; confirm_name?: string; company_ids?: unknown; user_ids?: unknown; confirm_phrase?: string }
    const cols = 'id, user_id, business_name, delete_protected, stripe_subscription_id, subscription_status, manual_access'
    const list = (v: unknown) => Array.isArray(v) ? [...new Set(v.map(String))] : []

    // ── Em lote ──
    if (body.company_ids !== undefined || body.user_ids !== undefined) {
      const ids = list(body.company_ids)
      const userIds = list(body.user_ids)
      const total = ids.length + userIds.length
      if (!total || [...ids, ...userIds].some(id => !UUID.test(id))) return json({ error: 'Lista de cadastros inválida.' }, 400)
      if (total > MAX_BATCH) return json({ error: `No máximo ${MAX_BATCH} cadastros por vez.` }, 400)
      if ((body.confirm_phrase ?? '').trim() !== bulkPhrase(total)) {
        return json({ error: `Frase de confirmação errada. Digite exatamente: ${bulkPhrase(total)}` }, 400)
      }
      const { data: rows } = ids.length ? await admin.from('companies').select(cols).in('id', ids) : { data: [] }
      const found = new Map((rows ?? []).map((c: Any) => [c.id, c]))
      const deleted: string[] = []
      const skipped: { id: string; name: string | null; reason: string }[] = []
      for (const id of ids) {
        const c = found.get(id)
        if (!c) { skipped.push({ id, name: null, reason: 'não encontrada' }); continue }
        const lock = lockReason(c)
        if (lock) { skipped.push({ id, name: c.business_name, reason: lock }); continue }
        const { error } = await admin.from('companies').delete().eq('id', id).eq('delete_protected', false)
        if (error) { skipped.push({ id, name: c.business_name, reason: error.message }); continue }
        deleted.push(id)
        const loginErr = await deleteLogin(admin, c.user_id, user.id)
        if (loginErr) skipped.push({ id, name: `${c.business_name} (login)`, reason: `empresa excluída, login mantido: ${loginErr}` })
      }
      // Logins sem empresa ("sem perfil").
      for (const uid of userIds) {
        const { data: { user: u } } = await admin.auth.admin.getUserById(uid)
        if (!u) { skipped.push({ id: uid, name: null, reason: 'não encontrado' }); continue }
        const err = await deleteLogin(admin, uid, user.id)
        if (err) skipped.push({ id: uid, name: u.email ?? null, reason: err })
        else deleted.push(uid)
      }
      console.log('[owner-delete-company] lote por', user.email, 'excluídos', deleted.length, 'pulados', skipped.length)
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
    const loginErr = await deleteLogin(admin, company.user_id, user.id)

    return json({ ok: true, login_kept: loginErr })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
