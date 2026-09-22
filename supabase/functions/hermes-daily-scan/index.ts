import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runTool, TOOLS_ALL } from '../_shared/tools.ts'
import type { Company } from '../_shared/tools.ts'

const OPENAI_TOOLS = TOOLS_ALL.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  const secret = req.headers.get('x-cron-secret')
  const envKey = Deno.env.get('HERMES_API_KEY') ?? ''
  if (!envKey || secret !== envKey) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const hermesUrl = Deno.env.get('HERMES_URL')
  const hermesKey = Deno.env.get('HERMES_API_KEY') ?? ''
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

  if (!hermesUrl) return json({ error: 'HERMES_URL não configurado' }, 500)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: companies } = await admin
    .from('companies')
    .select('id, business_name, business_type, city, instagram_url, goal, plan, telegram_chat_id, google_rating, google_review_count')
    .not('business_name', 'is', null)
    .limit(30)

  if (!companies?.length) return json({ ok: true, processed: 0 })

  const results: { company: string; drafts: number; notified: boolean }[] = []
  const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  for (const company of companies) {
    try {
      const [revRes, leadRes] = await Promise.all([
        admin.from('reviews').select('id').eq('company_id', company.id).is('owner_reply', null).limit(1),
        admin.from('leads').select('id').eq('company_id', company.id)
          .in('stage', ['novo', 'contatado'])
          .or(`last_contact_at.is.null,last_contact_at.lt.${staleDate}`)
          .limit(1),
      ])

      const hasReviews = (revRes.data?.length ?? 0) > 0
      const hasLeads = (leadRes.data?.length ?? 0) > 0
      if (!hasReviews && !hasLeads) continue

      const task = `Faça uma varredura rápida agora.${hasReviews ? ' Há avaliações do Google sem resposta.' : ''}${hasLeads ? ' Há leads sem contato há mais de 48 horas.' : ''} Para cada caso, crie os rascunhos necessários usando as ferramentas disponíveis. Seja direto e eficiente.`

      const systemPrompt = `Você é Hermes, assistente autônomo de "${company.business_name}" — ${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}. Objetivo: ${company.goal ?? 'gerar receita'}. Execute as tarefas de forma autônoma e crie rascunhos para aprovação do dono. Nunca publique sem aprovação.`

      const messages: unknown[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task },
      ]

      let postsCreated = 0
      const start = Date.now()

      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${hermesUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hermesKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'hermes', messages, tools: OPENAI_TOOLS, max_tokens: 1024 }),
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
          const { result, posts } = await runTool(
            { name: tc.function.name, id: tc.id, input },
            company.id, 'hermes-cron', admin, company as Company, 0,
          )
          postsCreated += posts
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
        }
      }

      await admin.from('agent_performance').insert({
        company_id: company.id, agent_role: 'hermes-cron',
        latency_ms: Date.now() - start, tokens_used: 0, success: true,
        task_description: `Varredura diária: ${[hasReviews && 'reviews', hasLeads && 'leads'].filter(Boolean).join(', ')}`,
      })

      // Só avisa quando tem post de verdade pra aprovar — nunca manda "tudo
      // concluído" quando não houve nada (pedido do dono: nada de relatório
      // diário só pra avisar que rodou, só post pra aprovar ou acontecimento
      // importante).
      let notified = false
      if (botToken && company.telegram_chat_id && postsCreated > 0) {
        const msg = `\u{1F916} O agente fez a varredura e preparou ${postsCreated} rascunho(s). Acesse o dashboard para aprovar.`
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: company.telegram_chat_id, text: msg }),
        })
        notified = true
      }

      results.push({ company: company.business_name, drafts: postsCreated, notified })
    } catch (err) {
      console.error(`Erro empresa ${company.id}:`, err)
    }
  }

  return json({ ok: true, processed: results.length, results })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
