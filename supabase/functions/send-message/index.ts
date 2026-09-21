import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json()
  const { lead_message_id } = body
  if (!lead_message_id) return json({ error: 'lead_message_id é obrigatório' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: msg } = await admin
    .from('lead_messages')
    .select('id,content,channel,status,lead_id,company_id')
    .eq('id', lead_message_id)
    .maybeSingle()

  if (!msg) return json({ error: 'Mensagem não encontrada' }, 404)
  if (msg.status === 'enviado') return json({ error: 'Mensagem já foi enviada' }, 400)

  const { data: lead } = await admin
    .from('leads')
    .select('id,name,contact,company_id')
    .eq('id', msg.lead_id)
    .maybeSingle()

  if (!lead) return json({ error: 'Lead não encontrado' }, 404)

  const { data: company } = await admin
    .from('companies')
    .select('id,business_name,user_id')
    .eq('id', lead.company_id)
    .maybeSingle()

  if (!company || company.user_id !== user.id) return json({ error: 'Unauthorized' }, 401)

  if (msg.channel !== 'email') {
    return json({ error: `Canal '${msg.channel}' ainda não suportado para envio automático. Use 'email'.` }, 400)
  }

  const toEmail = lead.contact
  if (!toEmail || !toEmail.includes('@')) {
    return json({ error: 'O contato do lead não é um endereço de email válido. Atualize o contato para um email.' }, 400)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ error: 'RESEND_API_KEY não configurado no Supabase' }, 500)

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${company.business_name} <${fromEmail}>`,
      to: [toEmail],
      subject: `Mensagem de ${company.business_name}`,
      text: msg.content,
    }),
  })

  if (!emailRes.ok) {
    const errText = await emailRes.text()
    return json({ error: `Erro ao enviar: ${errText}` }, 500)
  }

  await Promise.all([
    admin.from('lead_messages').update({ status: 'enviado', sent_at: new Date().toISOString() }).eq('id', lead_message_id),
    admin.from('leads').update({ last_contact_at: new Date().toISOString() }).eq('id', lead.id),
  ])

  return json({ ok: true, message: `Email enviado para ${toEmail}` })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
