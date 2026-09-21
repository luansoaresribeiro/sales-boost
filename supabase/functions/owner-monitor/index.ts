/**
 * owner-monitor — Monitoramento de agentes por empresa para o painel do dono.
 * Retorna execuções recentes + estatísticas por empresa (últimos 7 dias).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Verify owner
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)
  const { data: roleData } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
  if (roleData?.role !== 'owner') return json({ error: 'Forbidden' }, 403)

  // Recent performance (last 7 days)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: perf } = await admin
    .from('agent_performance')
    .select('id, company_id, agent_role, success, error_message, latency_ms, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100)

  // Get company names for the IDs found
  const companyIds = [...new Set((perf ?? []).map((p: { company_id: string }) => p.company_id))]
  const { data: companies } = await admin
    .from('companies')
    .select('id, business_name')
    .in('id', companyIds.length > 0 ? companyIds : ['_none_'])

  const companyMap: Record<string, string> = Object.fromEntries(
    (companies ?? []).map((c: { id: string; business_name: string }) => [c.id, c.business_name])
  )

  // Compute per-company stats
  type Stat = { company_id: string; company_name: string; last_run: string; success: number; fail: number; last_error: string | null }
  const statsMap: Record<string, Stat> = {}
  for (const p of (perf ?? []) as { company_id: string; agent_role: string; success: boolean; error_message: string | null; created_at: string }[]) {
    if (!statsMap[p.company_id]) {
      statsMap[p.company_id] = {
        company_id: p.company_id,
        company_name: companyMap[p.company_id] ?? p.company_id,
        last_run: p.created_at,
        success: 0,
        fail: 0,
        last_error: null,
      }
    }
    if (p.success) {
      statsMap[p.company_id].success++
    } else {
      statsMap[p.company_id].fail++
      if (!statsMap[p.company_id].last_error) statsMap[p.company_id].last_error = p.error_message
    }
  }

  const recent = ((perf ?? []) as { company_id: string; [k: string]: unknown }[])
    .slice(0, 30)
    .map(p => ({ ...p, company_name: companyMap[p.company_id] ?? p.company_id }))

  // Sort: companies with failures first, then by last run
  const stats = Object.values(statsMap).sort(
    (a, b) => b.fail - a.fail || new Date(b.last_run).getTime() - new Date(a.last_run).getTime()
  )

  return json({ recent, stats })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
