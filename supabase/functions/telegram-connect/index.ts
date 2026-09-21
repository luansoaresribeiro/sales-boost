import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Accept either webhook secret (from Cloudflare Worker) or JWT auth
    const secret = req.headers.get('x-webhook-secret')
    const envSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    const authHeader = req.headers.get('Authorization')

    const isWebhook = envSecret && secret === envSecret
    const isJwt = !!authHeader

    if (!isWebhook && !isJwt) return json({ error: 'Unauthorized' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)

    const body = await req.json() as { code: string; chat_id: number; bot_type?: string }
    const { code, chat_id, bot_type = 'marketing' } = body

    if (!code || !chat_id) return json({ error: 'code e chat_id são obrigatórios' }, 400)
    const normalizedCode = code.toUpperCase().trim()

    // Find unused code (cliente)
    const { data: row, error: findErr } = await admin.from('telegram_connect_codes')
      .select('id, company_id')
      .eq('code', normalizedCode)
      .eq('used', false)
      .single()

    if (!findErr && row) {
      // Link chat_id to company
      await admin.from('companies').update({ telegram_chat_id: chat_id }).eq('id', row.company_id)

      // Mark code as used
      await admin.from('telegram_connect_codes').update({ used: true }).eq('id', row.id)

      // Upsert conversation record
      await admin.from('telegram_conversations').upsert({
        customer_id: row.company_id,
        bot_type,
        telegram_chat_id: String(chat_id),
        status: 'active',
        context: {},
      }, { onConflict: 'telegram_chat_id,bot_type' })

      // Conexão é sempre no chat privado com o bot principal — nenhum grupo é criado.
      return json({ ok: true, company_id: row.company_id })
    }

    // Não achou como código de cliente — tenta como código do dono (aviso de
    // leads quentes da prospecção, gravado em prospect_settings em vez de companies).
    const { data: ownerSettings } = await admin.from('prospect_settings')
      .select('telegram_connect_code, telegram_connect_code_used')
      .eq('id', true)
      .eq('telegram_connect_code', normalizedCode)
      .eq('telegram_connect_code_used', false)
      .maybeSingle()

    if (ownerSettings) {
      await admin.from('prospect_settings').update({
        telegram_chat_id: String(chat_id), telegram_connect_code_used: true,
      }).eq('id', true)
      return json({ ok: true, owner: true })
    }

    return json({ error: 'Código inválido ou já utilizado' }, 404)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
