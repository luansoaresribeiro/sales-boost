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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (!resendKey) return json({ error: 'Email não configurado.' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: company } = await admin
      .from('companies')
      .select('business_name, city, business_type')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    const body = await req.json().catch(() => ({})) as { type?: string }
    const verificationType = body.type ?? 'Meta'
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Sales Boost <onboarding@resend.dev>',
        to: ['luan26ribeiro@gmail.com'],
        subject: `[Sales Boost] Verificação ${verificationType} — ${company.business_name}`,
        html: `
          <div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px">
            <h2 style="color:#FF6D29;margin:0 0 16px">Solicitação de Verificação</h2>
            <p style="margin:0 0 20px"><strong>${company.business_name}</strong>${company.city ? ` (${company.city})` : ''} solicitou verificação de <strong>${verificationType}</strong> via Sales Boost.</p>
            <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden">
              <tr><td style="padding:10px 16px;color:#666;width:130px;font-size:13px">Tipo</td><td style="padding:10px 16px;font-weight:700;font-size:13px">${verificationType}</td></tr>
              <tr style="background:#f0f0f0"><td style="padding:10px 16px;color:#666;font-size:13px">Negócio</td><td style="padding:10px 16px;font-size:13px">${company.business_name}</td></tr>
              <tr><td style="padding:10px 16px;color:#666;font-size:13px">Segmento</td><td style="padding:10px 16px;font-size:13px">${company.business_type ?? '—'}</td></tr>
              <tr style="background:#f0f0f0"><td style="padding:10px 16px;color:#666;font-size:13px">Cidade</td><td style="padding:10px 16px;font-size:13px">${company.city ?? '—'}</td></tr>
              <tr><td style="padding:10px 16px;color:#666;font-size:13px">Email</td><td style="padding:10px 16px;font-size:13px">${user.email}</td></tr>
              <tr style="background:#f0f0f0"><td style="padding:10px 16px;color:#666;font-size:13px">Data</td><td style="padding:10px 16px;font-size:13px">${now}</td></tr>
            </table>
            <p style="color:#999;font-size:11px;margin-top:24px">Sales Boost — Painel de Verificações</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Resend error:', emailRes.status, errText)
      return json({ error: 'Erro ao enviar solicitação.' }, 500)
    }

    return json({ ok: true })
  } catch (err) {
    console.error('request-verification error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
