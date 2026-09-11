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
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    // Owner role check — user_roles não tem coluna user_id, só email (ver
    // owner-companies, que já usava o padrão certo).
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
    if (roleRow?.role !== 'owner') return json({ error: 'Forbidden' }, 403)

    const body = await req.json() as { company_id: string; limit?: number; action?: string; updates?: Record<string, unknown>; marketing_ai?: Record<string, unknown>; reason?: string }
    const { company_id, limit = 10, action, updates, marketing_ai } = body

    if (!company_id) return json({ error: 'company_id é obrigatório' }, 400)

    // Update company settings (owner edit)
    if (action === 'update' && updates) {
      const allowed = ['business_name', 'business_type', 'city', 'goal', 'plan', 'business_dna', 'agent_enabled', 'marketing_ai_enabled']
      const safe: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in updates) safe[key] = updates[key]
      }
      await admin.from('companies').update(safe).eq('id', company_id)
      return json({ ok: true })
    }

    // Update marketing_ai_config (owner edit, por empresa) — o cliente não
    // configura mais isso em /dashboard/settings. RLS de marketing_ai_config
    // só deixa o dono da empresa (client) gravar direto, então o owner passa
    // por aqui (service role) sempre. Só grava os campos operacionais vindos
    // da UI. target_audience é DERIVADO do Business DNA (ninguém mais grava
    // ali, então é seguro sempre sincronizar). brand_voice também nasce do
    // Business DNA, mas o cliente pode sobrescrever pelo Kit da Marca
    // (BrandKit.tsx grava direto em marketing_ai_config.brand_voice, com
    // base em fotos reais) — por isso só usamos o valor do Business DNA
    // como SEED inicial, nunca sobrescrevendo um valor real que o cliente já
    // tenha definido.
    if (action === 'update_marketing_ai' && marketing_ai) {
      const [{ data: company }, { data: existingCfg }] = await Promise.all([
        admin.from('companies').select('business_dna').eq('id', company_id).maybeSingle(),
        admin.from('marketing_ai_config').select('brand_voice').eq('company_id', company_id).maybeSingle(),
      ])
      const dna = (company?.business_dna as { brand_voice?: string; target_audience?: string } | null) ?? {}

      const operationalKeys = ['agent_name', 'posting_frequency', 'preferred_content_types', 'content_pillars', 'marketing_goals', 'competitors']
      const payload: Record<string, unknown> = { company_id }
      for (const key of operationalKeys) {
        if (key in marketing_ai) payload[key] = marketing_ai[key]
      }
      if (!existingCfg?.brand_voice) payload.brand_voice = dna.brand_voice ?? null
      payload.target_audience = dna.target_audience ?? null
      payload.updated_at = new Date().toISOString()

      const { error } = await admin.from('marketing_ai_config').upsert(payload)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    // Liberar/bloquear acesso manualmente (Access & Subscription na ficha).
    // "Liberar" só marca manual_access=true quando a empresa não teria acesso
    // por outro motivo (pago/trial válidos) — senão o botão só limpa um
    // bloqueio anterior, sem confundir a origem real do acesso (seção 8).
    if (action === 'grant_access' || action === 'block_access') {
      const reason = typeof body.reason === 'string' ? body.reason : null
      if (action === 'block_access') {
        await admin.from('companies').update({
          access_blocked_at: new Date().toISOString(), access_blocked_by: user.email, access_blocked_reason: reason,
        }).eq('id', company_id)
        await admin.from('access_audit_log').insert({ company_id, event: 'access_blocked', actor: 'owner', actor_email: user.email, detail: reason ?? 'Bloqueado manualmente pelo Owner.' })
      } else {
        const { data: co } = await admin.from('companies')
          .select('subscription_status, trial_expires_at, trial_cancelled_at')
          .eq('id', company_id).maybeSingle()
        const hasPaid = !!co && ['active', 'trialing'].includes(co.subscription_status ?? '')
        const hasTrial = !!co && !co.trial_cancelled_at && !!co.trial_expires_at && new Date(co.trial_expires_at) > new Date()
        const patch: Record<string, unknown> = { access_blocked_at: null, access_blocked_by: null, access_blocked_reason: null }
        if (!hasPaid && !hasTrial) {
          patch.manual_access = true
          patch.manual_access_granted_at = new Date().toISOString()
          patch.manual_access_granted_by = user.email
          patch.manual_access_reason = reason
        }
        await admin.from('companies').update(patch).eq('id', company_id)
        await admin.from('access_audit_log').insert({ company_id, event: 'access_granted', actor: 'owner', actor_email: user.email, detail: reason ?? (hasPaid || hasTrial ? 'Bloqueio removido pelo Owner.' : 'Liberado manualmente pelo Owner.') })
      }
      const { data: access } = await admin.rpc('company_access_status', { p_company_id: company_id }).maybeSingle()
      return json({ ok: true, access })
    }

    // Fetch company detail + agent messages + telegram conversations + client diary
    const [companyRes, messagesRes, telegramRes, marketingAiRes, activityRes, accessRes, accessLogRes] = await Promise.all([
      admin.from('companies')
        .select('id, business_name, business_type, city, goal, plan, instagram_url, website_url, google_rating, google_review_count, telegram_chat_id, business_dna, agent_enabled, marketing_ai_enabled, created_at, trial_started_at, trial_expires_at, trial_cancelled_at, subscription_status, current_period_start, current_period_end, subscription_cancelled_at, manual_access, manual_access_granted_at, manual_access_granted_by, manual_access_reason, access_blocked_at, access_blocked_by, access_blocked_reason')
        .eq('id', company_id)
        .single(),
      admin.from('agent_messages')
        .select('id, role, content, agent_role, created_at')
        .eq('company_id', company_id)
        .order('created_at', { ascending: false })
        .limit(limit),
      admin.from('telegram_conversations')
        .select('id, bot_type, telegram_chat_id, status, created_at')
        .eq('customer_id', company_id)
        .order('created_at', { ascending: false }),
      admin.from('marketing_ai_config').select('*').eq('company_id', company_id).maybeSingle(),
      admin.from('client_activity')
        .select('id, event, label, meta, created_at')
        .eq('company_id', company_id)
        .order('created_at', { ascending: false })
        .limit(Math.max(limit, 50)),
      admin.rpc('company_access_status', { p_company_id: company_id }).maybeSingle(),
      admin.from('access_audit_log')
        .select('id, event, actor, actor_email, detail, created_at')
        .eq('company_id', company_id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // Fetch last messages for each telegram conversation
    const convs = telegramRes.data ?? []
    const telegramMessages = convs.length > 0
      ? await Promise.all(convs.map(async (conv) => {
          const { data: msgs } = await admin.from('telegram_messages')
            .select('id, role, content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(10)
          return { ...conv, messages: msgs ?? [] }
        }))
      : []

    return json({
      ok: true,
      company: companyRes.data,
      messages: messagesRes.data ?? [],
      telegram: telegramMessages,
      marketing_ai: marketingAiRes.data ?? null,
      activity: activityRes.data ?? [],
      access: accessRes.data ?? null,
      access_log: accessLogRes.data ?? [],
    })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
