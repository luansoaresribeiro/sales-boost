import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { company_id, confirm_name } = await req.json() as { company_id?: string; confirm_name?: string }
    if (!company_id || !confirm_name) return json({ error: 'company_id e confirm_name são obrigatórios' }, 400)

    const { data: company } = await admin.from('companies').select('id, business_name').eq('id', company_id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

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
