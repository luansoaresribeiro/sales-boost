import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Claude não expõe saldo por chave — estimamos o gasto pelo que rastreamos
// (tokens_used em agent_performance). ~US$6 por milhão de tokens (blend Sonnet).
async function anthropicTracked(admin: SupaClient): Promise<Usage> {
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
  const { data } = await admin.from('agent_performance').select('tokens_used').gte('created_at', monthStart.toISOString())
  const tokens = (data as { tokens_used: number | null }[] | null ?? []).reduce((s, r) => s + (r.tokens_used ?? 0), 0)
  const usd = Math.round((tokens / 1_000_000) * 6 * 100) / 100
  return { label: 'Gasto estimado no mês', used: usd, limit: null, unit: 'USD', pct: null }
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
