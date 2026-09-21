/**
 * owner-companies — Lista TODOS os usuários registrados (com ou sem empresa)
 * Usado pelo painel do dono para monitorar cadastros e conceder trial.
 */
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

    const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
    if (roleRow?.role !== 'owner') return json({ error: 'Forbidden' }, 403)

    const { data: { users }, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 200 })
    if (usersErr) return json({ error: usersErr.message }, 500)

    const { data: companies } = await admin
      .from('companies')
      .select('id, user_id, business_name, business_type, city, website_url, plan, active, created_at, trial_expires_at, trial_cancelled_at, stripe_subscription_id, subscription_status, current_period_end, manual_access, access_blocked_at, agent_enabled')

    const companyByUserId = Object.fromEntries((companies ?? []).map(c => [c.user_id, c]))

    // Mesma prioridade de company_access_status (SQL): bloqueio > pago >
    // trial > manual. Calculado aqui em vez de N chamadas RPC porque já
    // temos todas as empresas em memória (lista completa, não por id).
    const result = users
      .filter(u => u.email !== user.email)
      .map(u => {
        const co = companyByUserId[u.id]
        const trialExp = co?.trial_expires_at ? new Date(co.trial_expires_at) : null
        const trialActive = !!trialExp && !co?.trial_cancelled_at && trialExp > new Date()
        const hasPaid = !!co && ['active', 'trialing'].includes(co.subscription_status ?? '')
        const blocked = !!co?.access_blocked_at
        const source = blocked ? 'blocked' : hasPaid ? 'paid' : trialActive ? 'trial' : co?.manual_access ? 'manual' : 'none'
        const statusLabel = !co ? null
          : blocked ? 'Suspended'
          : hasPaid ? 'Active'
          : trialActive ? 'Trial'
          : co.manual_access ? 'Active'
          : co.trial_cancelled_at ? 'Cancelled'
          : 'Expired'
        return {
          user_id: u.id,
          user_email: u.email ?? '',
          user_created_at: u.created_at,
          id: co?.id ?? null,
          business_name: co?.business_name ?? null,
          business_type: co?.business_type ?? null,
          city: co?.city ?? null,
          website_url: co?.website_url ?? null,
          plan: co?.plan ?? null,
          active: co?.active ?? null,
          created_at: co?.created_at ?? u.created_at,
          health_score: null,
          has_company: !!co,
          trial_expires_at: co?.trial_expires_at ?? null,
          current_period_end: co?.current_period_end ?? null,
          trial_active: trialActive,
          has_paid: hasPaid,
          access: source !== 'blocked' && source !== 'none',
          access_source: source,
          access_status_label: statusLabel,
          agent_enabled: co?.agent_enabled ?? false,
        }
      })
      .sort((a, b) => new Date(b.user_created_at).getTime() - new Date(a.user_created_at).getTime())

    return json({ companies: result })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
