import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { NAO_MEDIDO, summarize, type CostRow, type FixedCost } from '../_shared/costLedger.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

interface Provider {
  key: string; name: string; category: string; secret_name: string
  usage_type: string; billing_url: string | null; enabled: boolean; manual_note: string | null
}
interface Usage { label: string; used: number; limit: number | null; unit: string; pct: number | null }
interface Report extends Provider {
  configured: boolean
  status: 'ok' | 'nokey' | 'error'
  usage: Usage | null
  note: string | null
}

// Busca com timeout curto — um provedor lento não pode travar o painel inteiro.
async function timedFetch(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) }
  finally { clearTimeout(t) }
}

// Saldo/uso ao vivo do Apify: quanto já gastou no mês vs. o teto do plano.
async function apifyUsage(token: string): Promise<Usage> {
  const res = await timedFetch('https://api.apify.com/v2/users/me/limits', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Apify ${res.status}`)
  const d = await res.json()
  const c = d?.data?.current ?? {}
  const l = d?.data?.limits ?? {}
  const used = Number(c.monthlyUsageUsd ?? 0)
  const limit = l.maxMonthlyUsageUsd != null ? Number(l.maxMonthlyUsageUsd) : null
  return { label: 'Uso no mês', used: Math.round(used * 100) / 100, limit, unit: 'USD', pct: limit ? Math.min(100, Math.round((used / limit) * 100)) : null }
}

// ElevenLabs: caracteres de voz usados vs. cota do plano.
async function elevenUsage(key: string): Promise<Usage> {
  const res = await timedFetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
  const d = await res.json()
  const used = Number(d.character_count ?? 0)
  const limit = d.character_limit != null ? Number(d.character_limit) : null
  return { label: 'Caracteres no ciclo', used, limit, unit: 'caracteres', pct: limit ? Math.min(100, Math.round((used / limit) * 100)) : null }
}

// APITemplate: créditos de PDF restantes no plano.
async function apitemplateUsage(key: string): Promise<Usage> {
  const res = await timedFetch('https://rest.apitemplate.io/v2/account-information', { headers: { 'X-API-KEY': key } })
  if (!res.ok) throw new Error(`APITemplate ${res.status}`)
  const d = await res.json()
  const used = Number(d.current_usage ?? d.current_pdf_count ?? 0)
  const limit = d.plan_limit != null ? Number(d.plan_limit) : (d.credits != null ? Number(d.credits) + used : null)
  return { label: 'Documentos gerados', used, limit, unit: 'PDFs', pct: limit ? Math.min(100, Math.round((used / limit) * 100)) : null }
}

// DataForSEO expõe o saldo em dinheiro da conta (Basic auth login:senha).
async function dataforseoUsage(login: string, password: string): Promise<Usage> {
  const auth = btoa(`${login}:${password}`)
  const res = await timedFetch('https://api.dataforseo.com/v3/appendix/user_data', { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}`)
  const d = await res.json()
  const money = d?.tasks?.[0]?.result?.[0]?.money ?? {}
  const balance = Number(money.balance ?? 0)
  return { label: 'Saldo da conta', used: Math.round(balance * 100) / 100, limit: null, unit: 'USD', pct: null }
}

// Claude não expõe saldo por chave. Etapa A (22/11): mostra o gasto MEDIDO no mês (tokens reais × tabela, linhas
// classificadas pelo costLedger), sem a estimativa antiga de US$ 6 por milhão de tokens (que contava estimativa e real juntos).
async function anthropicTracked(admin: SupaClient): Promise<Usage> {
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
  const rows = await perfRows(admin, monthStart.toISOString())
  const s = summarize(rows.filter(r => !r.provider || r.provider === 'anthropic'))
  return { label: 'Gasto medido no mês', used: Math.round(s.variable.kinds.medido * 100) / 100, limit: null, unit: 'USD', pct: null }
}

const PERF_COLS = 'id, company_id, agent_role, task_key, cost_usd, tokens_used, created_at, operation_id, ref_id, cost_kind, provider, calls'
// Lê em páginas (o limite padrão é 1000 linhas). Sem as colunas da etapa A (migration pendente), lê as antigas.
async function perfRows(admin: SupaClient, since: string, until?: string): Promise<CostRow[]> {
  const out: CostRow[] = []
  let cols = PERF_COLS
  for (let from = 0; from < 50_000; from += 1000) {
    let q = admin.from('agent_performance').select(cols).gte('created_at', since).order('created_at').range(from, from + 999)
    if (until) q = q.lt('created_at', until)
    const { data, error } = await q
    if (error && cols === PERF_COLS) { cols = 'id, company_id, agent_role, task_key, cost_usd, tokens_used, created_at'; from -= 1000; continue }
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as CostRow[]
    out.push(...page.map(r => ({ ...r, source: 'agent_performance' as const })))
    if (page.length < 1000) break
  }
  return out
}

/** Etapa A2: a visão central de custos do Owner (variável por tipo/cliente/funcionalidade/operação + fixo separado). */
async function costsReport(admin: SupaClient, body: Record<string, unknown>) {
  const now = new Date()
  let since: Date, until: Date | null = null, label: string
  const month = typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null
  if (month) {
    since = new Date(`${month}-01T00:00:00Z`); until = new Date(since); until.setUTCMonth(until.getUTCMonth() + 1); label = month
  } else {
    const days = [7, 30, 90].includes(Number(body.days)) ? Number(body.days) : 30
    since = new Date(now.getTime() - days * 86_400_000); label = `${days} dias`
  }
  const sinceIso = since.toISOString(), untilIso = until?.toISOString()
  const perf = await perfRows(admin, sinceIso, untilIso)
  let tq = admin.from('video_tours').select('id, company_id, kind, cost_usd, created_at').gte('created_at', sinceIso).gt('cost_usd', 0)
  if (untilIso) tq = tq.lt('created_at', untilIso)
  const { data: tours } = await tq
  const tourRows: CostRow[] = ((tours ?? []) as { id: string; company_id: string; kind: string | null; cost_usd: number; created_at: string }[])
    .map(t => ({ id: t.id, company_id: t.company_id, agent_role: 'tour', task_key: `video_tour_${t.kind ?? 'tour'}`, cost_usd: t.cost_usd, tokens_used: 0, created_at: t.created_at, source: 'video_tours', kind: t.kind, provider: 'higgsfield' }))
  // Fixos: os meses que o período toca. Sem tabela (migration pendente) = "não informado".
  const firstMonth = `${sinceIso.slice(0, 7)}-01`, lastMonth = `${(untilIso ? new Date(until!.getTime() - 1).toISOString() : now.toISOString()).slice(0, 7)}-01`
  const { data: fx } = await admin.from('platform_fixed_costs').select('month, item, provider, amount_usd, source, note').gte('month', firstMonth).lte('month', lastMonth).order('month')
  const ids = [...new Set([...perf, ...tourRows].map(r => r.company_id).filter(Boolean))] as string[]
  const names: Record<string, string> = {}
  if (ids.length) {
    const { data: cs } = await admin.from('companies').select('id, business_name').in('id', ids)
    for (const c of (cs ?? []) as { id: string; business_name: string | null }[]) names[c.id] = c.business_name ?? c.id
  }
  const summary = summarize([...perf, ...tourRows], (fx ?? []) as FixedCost[], names)
  return { ok: true, period: { label, since: sinceIso, until: untilIso ?? now.toISOString() }, summary, fixed_rows: fx ?? [], not_measured: NAO_MEDIDO, generated_at: now.toISOString() }
}

async function keyFor(_admin: SupaClient, secretName: string, cfg: Record<string, string>): Promise<string | null> {
  const fromEnv = Deno.env.get(secretName)
  if (fromEnv) return fromEnv
  return cfg[secretName.toLowerCase()] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const env = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'), ANON: Deno.env.get('SUPABASE_ANON_KEY'),
      SERVICE: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), CRON_SECRET: Deno.env.get('CRON_SECRET'),
    }
    const admin = createClient(env.SUPABASE_URL!, env.SERVICE ?? env.ANON!)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    // Só o dono (owner), o service role ou um cron autenticado veem este painel.
    const bearer = req.headers.get('Authorization') ?? ''
    const isService = env.SERVICE && bearer === `Bearer ${env.SERVICE}`
    const isCron = env.CRON_SECRET && body.cron_secret === env.CRON_SECRET
    if (!isService && !isCron) {
      const userClient = createClient(env.SUPABASE_URL!, env.ANON!, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email ?? '').maybeSingle()
      if ((roleRow as { role?: string } | null)?.role !== 'owner') return json({ error: 'Forbidden' }, 403)
    }

    if (body.action === 'costs') return json(await costsReport(admin, body))
    if (body.action === 'set_fixed') {
      // Custo fixo do mês informado pelo dono (só Owner chega aqui). Mesmo mês + item = atualiza; nada é apagado.
      const month = String(body.month ?? ''), item = String(body.item ?? '').trim().slice(0, 80), amount = Number(body.amount_usd)
      if (!/^\d{4}-\d{2}$/.test(month) || !item || !Number.isFinite(amount) || amount < 0 || amount > 100_000) return json({ error: 'Informe mês (AAAA-MM), item e valor em US$ (>= 0).' }, 400)
      const { error } = await admin.from('platform_fixed_costs').upsert({ month: `${month}-01`, item, provider: body.provider ? String(body.provider).slice(0, 40) : null, amount_usd: Math.round(amount * 100) / 100, note: body.note ? String(body.note).slice(0, 200) : null }, { onConflict: 'month,item' })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    const { data: providers } = await admin.from('api_providers').select('*').eq('enabled', true).order('sort')
    const { data: cfgRows } = await admin.from('_app_config').select('key, value')
    const cfg: Record<string, string> = {}
    for (const r of (cfgRows as { key: string; value: string }[] | null ?? [])) cfg[r.key] = r.value

    const reports: Report[] = await Promise.all((providers as Provider[] | null ?? []).map(async (p) => {
      const key = await keyFor(admin, p.secret_name, cfg)
      const base: Report = { ...p, configured: !!key, status: key ? 'ok' : 'nokey', usage: null, note: null }
      if (!key && p.usage_type !== 'anthropic_tracked') return base

      try {
        if (p.usage_type === 'apify') base.usage = await apifyUsage(key!)
        else if (p.usage_type === 'elevenlabs') base.usage = await elevenUsage(key!)
        else if (p.usage_type === 'apitemplate') base.usage = await apitemplateUsage(key!)
        else if (p.usage_type === 'dataforseo') {
          const pwd = Deno.env.get('DATAFORSEO_PASSWORD') ?? cfg['dataforseo_password']
          if (!pwd) throw new Error('Senha do DataForSEO não configurada.')
          base.usage = await dataforseoUsage(key!, pwd)
        }
        else if (p.usage_type === 'anthropic_tracked') base.usage = await anthropicTracked(admin)
        else if (p.usage_type === 'manual') base.note = 'Sem API de saldo — veja no painel do provedor.'
        else base.note = 'Chave configurada.' // status
      } catch (e) {
        base.status = 'error'
        base.note = e instanceof Error ? e.message : String(e)
      }
      return base
    }))

    return json({ ok: true, providers: reports, generated_at: new Date().toISOString() })
  } catch (err) {
    console.error('api-usage error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
