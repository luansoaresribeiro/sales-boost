import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })

  const secret = req.headers.get('x-bot-secret')
  const envSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (!envSecret || secret !== envSecret) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const notifyUrl = Deno.env.get('MARKETING_BOT_NOTIFY_URL')
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!

  if (!notifyUrl) return json({ error: 'MARKETING_BOT_NOTIFY_URL not configured' }, 500)

  const admin = createClient(supabaseUrl, serviceKey)

  // All companies with Telegram connected
  const { data: companies, error } = await admin.from('companies')
    .select('id, business_name, telegram_chat_id')
    .not('telegram_chat_id', 'is', null)

  if (error) return json({ error: error.message }, 500)
  if (!companies?.length) return json({ ok: true, sent: 0 })

  let sent = 0
  const errors: string[] = []

  for (const company of companies.slice(0, 50)) {
    try {
      const chatId = Number(company.telegram_chat_id)
      if (!Number.isFinite(chatId)) continue

      // Fetch company stats. "posts" é o fluxo antigo; marketing_ai_content
      // (Ideias/calendário) e o Vault (marketing_ai_test_content status=vault,
      // já aprovado no controle de qualidade) são o fluxo novo — sem contar os
      // três, o resumo dizia "0 posts" mesmo com coisa real esperando aprovação.
      const [postsRes, contentRes, vaultRes, oppsRes, reviewsRes] = await Promise.all([
        admin.from('posts').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).eq('status', 'rascunho'),
        admin.from('marketing_ai_content').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).in('status', ['idea', 'draft']),
        admin.from('marketing_ai_test_content').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).eq('status', 'vault'),
        admin.from('opportunities').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).eq('status', 'open'),
        admin.from('reviews').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).is('owner_reply', null),
      ])

      const drafts = (postsRes.count ?? 0) + (contentRes.count ?? 0)
      const vaultReady = vaultRes.count ?? 0
      const opps = oppsRes.count ?? 0
      const unansweredReviews = reviewsRes.count ?? 0

      if (drafts === 0 && vaultReady === 0 && opps === 0 && unansweredReviews === 0) continue

      const lines = [`Bom dia! Resumo de hoje para ${company.business_name}:`]
      if (drafts > 0) lines.push(`📝 ${drafts} post(s) aguardando sua aprovação`)
      if (vaultReady > 0) lines.push(`⭐ ${vaultReady} post(s) prontos no Vault, esperando você aprovar e publicar`)
      if (opps > 0) lines.push(`💰 ${opps} oportunidade(s) de receita em aberto`)
      if (unansweredReviews > 0) lines.push(`⭐ ${unansweredReviews} avaliação(ões) do Google sem resposta`)
      lines.push(`\nAcesse o dashboard para resolver.`)

      await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-webhook-secret': webhookSecret },
        body: JSON.stringify({ event: 'DAILY_BRIEFING', chat_id: chatId, message: lines.join('\n') }),
      })
      sent++
    } catch (e) {
      errors.push(`${company.id}: ${String(e)}`)
    }
  }

  return json({ ok: true, sent, errors })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
