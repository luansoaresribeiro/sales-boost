import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hasPaidAccess, requirePaidAccess } from '../_shared/access.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Company = {
  id: string
  business_name: string
  social_data: Record<string, unknown> | null
  telegram_chat_id?: number | null
  notification_prefs?: Record<string, boolean> | null
  avg_ticket?: number | null
}

// "Receita recuperável" só existe quando o dono informou o ticket médio real
// (Configurações → Sobre o negócio) — nunca inventamos um valor em R$. Os
// multiplicadores abaixo são uma estimativa de quantos "clientes equivalentes"
// cada tipo de oportunidade representa, não um cálculo exato.
function estimatedValue(avgTicket: number | null | undefined, multiplier: number): number | null {
  if (avgTicket == null || avgTicket <= 0) return null
  return Math.round(avgTicket * multiplier)
}

type NewOpportunity = { type: string; title: string }

const NEGATIVE_TYPES = new Set(['negative_review', 'unanswered_review'])

async function notifyMarketing(chatId: number | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  // Sempre grava na aba Atividades, mesmo sem Telegram conectado — o envio
  // ao Telegram (dentro de log-bot-event) é só um bônus quando existe chatId.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ?? null, data }),
  }).catch(() => {})
}

// Sends ONE consolidated message for whatever is genuinely new this run —
// never one message per item, and never re-announces items that were already
// open from a previous run. Respects the owner's notification_prefs toggles.
function notifyNewOpportunities(chatId: number | null | undefined, companyId: string, prefs: Record<string, boolean> | null | undefined, newOpportunities: NewOpportunity[]) {
  if (newOpportunities.length === 0) return
  const allowed = newOpportunities.filter(o =>
    NEGATIVE_TYPES.has(o.type) ? prefs?.negative_reviews !== false : prefs?.opportunities !== false
  )
  if (allowed.length === 0) return
  notifyMarketing(chatId, companyId, 'OPPORTUNITY_DETECTED', {
    description: `${allowed.length} nova(s) oportunidade(s) detectada(s)`,
    opportunities: allowed.map(o => ({ type: o.type, title: o.title })),
  })
}

// Opportunities without a ref_id (stale_draft, no_content, low_engagement) can't rely on
// the `company_id,type,ref_id` upsert conflict target — Postgres never treats two NULLs as
// equal, so every run was inserting a fresh duplicate instead of reusing the open one. This
// updates the existing open row in place instead, so there's ever only one per (company, type).
async function upsertSingletonOpportunity(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  type: string,
  fields: { title: string; description: string; estimated_impact: string; estimated_value: number | null; ref_type: string | null },
): Promise<boolean> {
  const { data: existing } = await admin
    .from('opportunities')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', type)
    .eq('status', 'open')
    .is('ref_id', null)
    .limit(1)
    .maybeSingle()

  if (existing) {
    await admin.from('opportunities').update(fields).eq('id', existing.id)
    return false
  }
  await admin.from('opportunities').insert({ company_id: companyId, type, status: 'open', ref_id: null, ...fields })
  return true
}

async function detectForCompany(company: Company, admin: ReturnType<typeof createClient>): Promise<NewOpportunity[]> {
  const newOpportunities: NewOpportunity[] = []
  const now = new Date()
  const day60ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const day14ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const day3ago  = new Date(now.getTime() -  3 * 24 * 60 * 60 * 1000).toISOString()
  const day7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

  const toUpsert: Record<string, unknown>[] = []

  // 1. Reviews negativos sem resposta (rating ≤ 2, últimos 60 dias)
  const { data: negativeReviews } = await admin
    .from('reviews')
    .select('id, author, rating, text, review_date')
    .eq('company_id', company.id)
    .lte('rating', 2)
    .is('owner_reply', null)
    .gte('review_date', day60ago.slice(0, 10))
    .order('review_date', { ascending: false })

  for (const r of negativeReviews ?? []) {
    toUpsert.push({
      company_id: company.id,
      type: 'negative_review',
      title: `Review ${r.rating}⭐ de ${r.author} sem resposta`,
      description: r.text ? `"${r.text.slice(0, 120)}..."` : 'Review negativa sem comentário.',
      estimated_impact: 'Responder reviews negativos pode aumentar a nota em até 0.3 pontos.',
      estimated_value: estimatedValue(company.avg_ticket, 1),
      status: 'open',
      ref_id: r.id,
      ref_type: 'review',
    })
  }

  // 2. Reviews sem resposta há mais de 14 dias (qualquer nota)
  const { data: unansweredReviews } = await admin
    .from('reviews')
    .select('id, author, rating, text, review_date')
    .eq('company_id', company.id)
    .is('owner_reply', null)
    .gt('rating', 2)
    .lte('review_date', day14ago.slice(0, 10))
    .order('review_date', { ascending: false })
    .limit(10)

  for (const r of unansweredReviews ?? []) {
    toUpsert.push({
      company_id: company.id,
      type: 'unanswered_review',
      title: `Review de ${r.author} sem resposta há +14 dias`,
      description: r.text ? `"${r.text.slice(0, 120)}..."` : 'Review sem comentário.',
      estimated_impact: 'Responder todas as avaliações aumenta confiança e melhora o ranking no Google.',
      estimated_value: estimatedValue(company.avg_ticket, 0.4),
      status: 'open',
      ref_id: r.id,
      ref_type: 'review',
    })
  }

  // 3. Rascunhos de posts parados — conta TODOS os pendentes, não só os com
  // +3 dias. Um acúmulo rápido (dezenas no mesmo dia, gerados por cron a cada
  // 30 min) também precisa travar a criação de mais conteúdo — se só olhar
  // idade, um acúmulo que nasce e cresce mais rápido do que 3 dias nunca é
  // pego, porque nenhum rascunho individual chega a ficar "velho" o bastante.
  const PENDING_DRAFT_LIMIT = 8
  const { data: pendingDrafts } = await admin
    .from('posts')
    .select('id, created_at')
    .eq('company_id', company.id)
    .eq('status', 'rascunho')
    .order('created_at', { ascending: true })

  const totalPending = (pendingDrafts ?? []).length
  const oldestPendingAt = pendingDrafts?.[0]?.created_at
  const hasOldDraft = !!oldestPendingAt && oldestPendingAt <= day3ago
  const isPileup = totalPending >= PENDING_DRAFT_LIMIT || hasOldDraft

  if (isPileup) {
    const title = `${totalPending} rascunho(s) aguardando aprovação`
    const created = await upsertSingletonOpportunity(admin, company.id, 'stale_draft', {
      title,
      description: 'Posts prontos que ainda não foram aprovados ou publicados.',
      estimated_impact: 'Publicar conteúdo regularmente aumenta o alcance orgânico.',
      estimated_value: estimatedValue(company.avg_ticket, 0.15 * Math.min(totalPending, 20)),
      ref_type: 'post',
    })
    if (created) newOpportunities.push({ type: 'stale_draft', title })
  } else {
    await admin.from('opportunities').update({ status: 'resolved' }).eq('company_id', company.id).eq('type', 'stale_draft').eq('status', 'open')
  }

  // 4. Sem posts publicados nos últimos 7 dias
  // Check updated_at (when marked as published), not created_at (when draft was created)
  // Also check instagram_posts table for auto-published content
  const [{ data: recentPublished }, { data: recentIgPosts }] = await Promise.all([
    admin.from('posts')
      .select('id')
      .eq('company_id', company.id)
      .eq('status', 'publicado')
      .gte('updated_at', day7ago)
      .limit(1),
    admin.from('instagram_posts')
      .select('id')
      .eq('company_id', company.id)
      .gte('posted_at', day7ago)
      .limit(1),
  ])

  const hasRecentContent = (recentPublished ?? []).length > 0 || (recentIgPosts ?? []).length > 0

  if (hasRecentContent) {
    // Posts published recently — resolve the no_content opportunity if it exists
    await admin.from('opportunities')
      .update({ status: 'resolved' })
      .eq('company_id', company.id)
      .eq('type', 'no_content')
      .eq('status', 'open')
  } else {
    const title = 'Nenhum post publicado nos últimos 7 dias'
    const created = await upsertSingletonOpportunity(admin, company.id, 'no_content', {
      title,
      description: 'A ausência de conteúdo reduz o alcance e o engajamento do seu perfil.',
      estimated_impact: 'Contas que postam 3–5x/semana crescem 2x mais rápido.',
      estimated_value: estimatedValue(company.avg_ticket, 1),
      ref_type: null,
    })
    if (created) newOpportunities.push({ type: 'no_content', title })
  }

  // 5. Baixo engajamento no Instagram
  const ig = (company.social_data as Record<string, unknown> | null)?.instagram as Record<string, unknown> | undefined
  if (ig && typeof ig.engagement_rate === 'number' && ig.engagement_rate < 1) {
    const title = `Engajamento no Instagram baixo: ${ig.engagement_rate}%`
    const created = await upsertSingletonOpportunity(admin, company.id, 'low_engagement', {
      title,
      description: `Média do setor é 1–3%. Seus posts têm em média ${ig.avg_likes ?? 0} curtidas e ${ig.avg_comments ?? 0} comentários.`,
      estimated_impact: 'Melhorar engajamento aumenta o alcance orgânico sem gastar em anúncios.',
      estimated_value: estimatedValue(company.avg_ticket, 0.5),
      ref_type: null,
    })
    if (created) newOpportunities.push({ type: 'low_engagement', title })
  } else {
    await admin.from('opportunities').update({ status: 'resolved' }).eq('company_id', company.id).eq('type', 'low_engagement').eq('status', 'open')
  }

  if (toUpsert.length > 0) {
    // ON CONFLICT DO NOTHING + RETURNING only gives back rows that were actually
    // inserted — rows that hit the conflict (already-open, same review) come back
    // empty. That's what lets us tell "new since last run" from "still open".
    const { data: inserted } = await admin.from('opportunities').upsert(toUpsert, {
      onConflict: 'company_id,type,ref_id',
      ignoreDuplicates: true,
    }).select('type, title')
    for (const row of inserted ?? []) {
      newOpportunities.push({ type: row.type as string, title: row.title as string })
    }
  }

  // Reviews antigos (já abertos antes desta execução) não passam pelo upsert
  // acima de novo — sem isso, um valor calculado com um ticket médio antigo
  // (ou o número fixo/falso de antes desta mudança) ficaria preso pra sempre.
  await admin.from('opportunities')
    .update({ estimated_value: estimatedValue(company.avg_ticket, 1) })
    .eq('company_id', company.id).eq('type', 'negative_review').eq('status', 'open')
  await admin.from('opportunities')
    .update({ estimated_value: estimatedValue(company.avg_ticket, 0.4) })
    .eq('company_id', company.id).eq('type', 'unanswered_review').eq('status', 'open')

  return newOpportunities
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey
    const cronSecretEnv = Deno.env.get('CRON_SECRET')

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = cronSecretEnv && body.cron_secret === cronSecretEnv

    const admin = createClient(supabaseUrl, serviceKey)

    // Cron mode: run for all active companies without user auth
    if (isCron) {
      const { data: companies } = await admin
        .from('companies')
        .select('id, business_name, social_data, telegram_chat_id, notification_prefs, avg_ticket')
        .eq('active', true)

      let total = 0
      for (const company of companies ?? []) {
        try {
          if (!(await hasPaidAccess(admin, company.id as string))) continue // conta vitrine: cron não roda
          const newOpportunities = await detectForCompany(company as Company, admin)
          total += newOpportunities.length
          // Only sends when something genuinely new shows up — a daily message
          // with nothing new to say was the main source of "mensagem repetitiva".
          notifyNewOpportunities((company as Company).telegram_chat_id, (company as Company).id, (company as Company).notification_prefs, newOpportunities)
        } catch (e) {
          console.error(`detect-opportunities: company ${company.id} error:`, e)
        }
      }
      return json({ ok: true, cron: true, companies: companies?.length ?? 0, opportunities_found: total })
    }

    // Normal user mode: validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: company } = await admin
      .from('companies')
      .select('id, business_name, social_data, telegram_chat_id, notification_prefs, avg_ticket')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id)
    if (noPlan) return noPlan

    const newOpportunities = await detectForCompany(company as Company, admin)
    // ONE consolidated message for whatever is new — no more one message per
    // review plus a duplicate summary on every "Salvar alterações".
    notifyNewOpportunities((company as Company).telegram_chat_id, (company as Company).id, (company as Company).notification_prefs, newOpportunities)

    // Return all open opportunities sorted by priority
    const { data: allOpen } = await admin
      .from('opportunities')
      .select('*')
      .eq('company_id', company.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    const priorityOrder = ['negative_review', 'unanswered_review', 'stale_draft', 'low_engagement', 'no_content']
    const sorted = (allOpen ?? []).sort((a: { type: string }, b: { type: string }) =>
      priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type)
    )

    return json({ ok: true, opportunities: sorted, total: sorted.length })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
