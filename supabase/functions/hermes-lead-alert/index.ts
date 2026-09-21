import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runTool, TOOLS_ALL } from '../_shared/tools.ts'
import type { Company } from '../_shared/tools.ts'

const OPENAI_TOOLS = TOOLS_ALL.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  const secret = req.headers.get('x-webhook-secret')
  const envKey = Deno.env.get('HERMES_API_KEY') ?? ''
  if (!envKey || secret !== envKey) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json() as {
    type?: string
    record?: {
      id: string; company_id: string; name: string; contact?: string
      channel?: string; stage?: string; value_estimate?: number; notes?: string
    }
  }

  if (body.type !== 'INSERT' || !body.record) {
    return json({ ok: true, skipped: true })
  }

  const lead = body.record
  if (!lead.company_id) return json({ error: 'company_id ausente' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const hermesUrl = Deno.env.get('HERMES_URL')
  const hermesKey = Deno.env.get('HERMES_API_KEY') ?? ''
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

  if (!hermesUrl) return json({ error: 'HERMES_URL não configurado' }, 500)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: company } = await admin
    .from('companies')
    .select('id, business_name, business_type, city, instagram_url, goal, plan, telegram_chat_id')
    .eq('id', lead.company_id)
    .single()

  if (!company) return json({ error: 'Empresa não encontrada' }, 404)

  const details = [
    `Nome: ${lead.name}`,
    lead.contact ? `Contato: ${lead.contact}` : null,
    lead.channel ? `Canal: ${lead.channel}` : null,
    lead.value_estimate ? `Valor estimado: R$${lead.value_estimate}` : null,
    lead.notes ? `Observações: ${lead.notes}` : null,
  ].filter(Boolean).join('\n')

  const task = `Novo lead chegou agora! Crie imediatamente um rascunho de follow-up personalizado e convincente para:\n\n${details}\n\nUse a ferramenta draft_followup com lead_id "${lead.id}" e canal "${lead.channel ?? 'whatsapp'}". O tom deve ser caloroso e profissional.`

  const messages: unknown[] = [
    { role: 'system', content: `Você é Hermes, assistente de "${company.business_name}". Um novo lead chegou — crie um follow-up imediato e personalizado para maximizar as chances de conversão. Nunca envie sem aprovação.` },
    { role: 'user', content: task },
  ]

  let followupCreated = false
  const start = Date.now()

  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${hermesUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${hermesKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'hermes', messages, tools: OPENAI_TOOLS, max_tokens: 512 }),
    })
    if (!res.ok) break

    const data = await res.json() as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
    }
    const choice = data.choices?.[0]?.message
    const toolCalls = choice?.tool_calls ?? []
    if (toolCalls.length === 0) break

    messages.push({ role: 'assistant', content: choice?.content ?? null, tool_calls: toolCalls })
    for (const tc of toolCalls) {
      let input: unknown = {}
      try { input = JSON.parse(tc.function.arguments) } catch { /* empty */ }
      const { result } = await runTool(
        { name: tc.function.name, id: tc.id, input },
        company.id, 'hermes-lead-alert', admin, company as Company, 0,
      )
      if (tc.function.name === 'draft_followup') followupCreated = true
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
    if (followupCreated) break
  }

  await admin.from('agent_performance').insert({
    company_id: company.id, agent_role: 'hermes-lead-alert',
    latency_ms: Date.now() - start, tokens_used: 0, success: followupCreated,
    task_description: `Novo lead: ${lead.name} via ${lead.channel ?? 'manual'}`,
  })

  if (botToken && company.telegram_chat_id) {
    const msg = followupCreated
      ? `\u{1F4AC} Novo lead de ${lead.name}! Preparei um follow-up. Acesse o dashboard para aprovar e enviar.`
      : `\u{1F4AC} Novo lead: ${lead.name} via ${lead.channel ?? 'manual'}. Acesse o dashboard.`
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: company.telegram_chat_id, text: msg }),
    })
  }

  return json({ ok: true, followupCreated })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
