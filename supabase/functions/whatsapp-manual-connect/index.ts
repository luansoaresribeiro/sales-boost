/**
 * whatsapp-manual-connect — conexão manual do WhatsApp (número próprio do dono).
 *
 * Alternativa ao Embedded Signup (que exige o app ser Tech Provider verificado):
 * o dono pega, no painel da Meta (WhatsApp → Configuração da API), o
 * Phone Number ID, o WhatsApp Business Account ID (WABA) e um token de acesso,
 * cola no formulário e a gente valida + salva. Funciona hoje, sem App Review.
 *
 * O token chega por HTTPS do formulário e é guardado SÓ no servidor (coluna da
 * empresa) — nunca volta pro frontend, nunca vai pra log.
 *
 * POST autenticado (JWT do dono) — body: { waba_id, phone_number_id, access_token }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const FB = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({})) as { waba_id?: string; phone_number_id?: string; access_token?: string }
    const wabaId = (body.waba_id ?? '').trim()
    const phoneNumberId = (body.phone_number_id ?? '').trim()
    const accessToken = (body.access_token ?? '').trim()
    if (!wabaId || !phoneNumberId || !accessToken) {
      return json({ error: 'Preencha o ID do número (Phone Number ID), o ID da conta (WABA) e o token de acesso.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: company } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

    // 1. Valida token + número: busca os detalhes do número. Se falhar, os dados
    //    estão errados ou o token não tem permissão — erro honesto, nada salvo.
    const phoneRes = await fetch(`${FB}/${phoneNumberId}?` + new URLSearchParams({
      fields: 'verified_name,display_phone_number', access_token: accessToken,
    }))
    if (!phoneRes.ok) {
      const detail = await phoneRes.text()
      return json({ error: 'Não consegui validar o número com esses dados. Confira o Phone Number ID e o token (o token precisa ter as permissões de WhatsApp).', detail }, 400)
    }
    const phoneJson = await phoneRes.json() as { verified_name?: string; display_phone_number?: string }

    // 2. Inscreve o app no WABA — sem isso as mensagens desse número não chegam
    //    no webhook. Best-effort: se falhar, conexão continua (só loga).
    const subRes = await fetch(`${FB}/${wabaId}/subscribed_apps`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    })
    if (!subRes.ok) console.error('whatsapp-manual-connect: falha ao inscrever app no WABA:', await subRes.text())

    // 3. Salva na empresa (token só no servidor).
    const { error: updateErr } = await admin.from('companies').update({
      whatsapp_business_account_id: wabaId,
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_access_token: accessToken,
      whatsapp_verified_name: phoneJson.verified_name ?? null,
      whatsapp_number: phoneJson.display_phone_number ?? null,
      whatsapp_connected_at: new Date().toISOString(),
    }).eq('id', company.id)
    if (updateErr) return json({ error: updateErr.message }, 500)

    return json({ ok: true, verified_name: phoneJson.verified_name ?? null, display_phone_number: phoneJson.display_phone_number ?? null })
  } catch (err) {
    console.error('whatsapp-manual-connect error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
