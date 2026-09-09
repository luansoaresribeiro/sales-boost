import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>
type Status = 'ok' | 'degraded' | 'down' | 'unknown'

const COST_PER_1K = 0.006

interface ServiceRow { key: string; name: string; category: string; critical: boolean; check_type: string; target: string | null }
interface Config {
  enabled: boolean; auto_recovery: boolean; notify_telegram: boolean; admin_telegram_chat_id: string | null
  latency_warn_ms: number; latency_crit_ms: number; error_rate_warn: number; error_rate_crit: number
  daily_cost_alert_usd: number; incident_retention_days: number
}
interface CheckResult { status: Status; latency: number | null; detail: string }

async function timedFetch(url: string, init: RequestInit, timeoutMs = 6000): Promise<{ res: Response | null; ms: number; err?: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const start = Date.now()
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    clearTimeout(t)
    return { res, ms: Date.now() - start }
  } catch (e) {
    clearTimeout(t)
    return { res: null, ms: Date.now() - start, err: e instanceof Error ? e.message : String(e) }
  }
}

function fromLatency(ms: number, cfg: Config): Status {
  if (ms >= cfg.latency_crit_ms) return 'degraded'
  if (ms >= cfg.latency_warn_ms) return 'degraded'
  return 'ok'
}

async function runCheck(admin: SupaClient, svc: ServiceRow, cfg: Config, env: Record<string, string | undefined>): Promise<CheckResult> {
  const t = svc.check_type

  if (t === 'manual') return { status: 'unknown', latency: null, detail: 'Não verificado automaticamente (aguardando conexão).' }

  if (t === 'ai_cost') {
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0)
    const { data } = await admin.from('agent_performance').select('tokens_used').gte('created_at', dayStart.toISOString())
    const tokens = (data ?? []).reduce((s: number, r: { tokens_used: number | null }) => s + (Number(r.tokens_used) || 0), 0)
    const cost = (tokens / 1000) * COST_PER_1K
    if (cost >= cfg.daily_cost_alert_usd) return { status: 'degraded', latency: null, detail: `Custo de IA hoje US$ ${cost.toFixed(2)} ≥ alerta US$ ${cfg.daily_cost_alert_usd}.` }
    return { status: 'ok', latency: null, detail: `Custo de IA hoje US$ ${cost.toFixed(2)}.` }
  }

  if (t === 'agent_errors') {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data } = await admin.from('agent_performance').select('success').eq('agent_role', svc.target ?? '').gte('created_at', since)
    const rows = data ?? []
    if (rows.length === 0) return { status: 'ok', latency: null, detail: 'Sem execuções na última hora.' }
    const fails = rows.filter((r: { success: boolean | null }) => r.success === false).length
    const rate = fails / rows.length
    const detail = `${fails}/${rows.length} execuções falharam na última hora (${(rate * 100).toFixed(0)}%).`
    if (rate >= cfg.error_rate_crit) return { status: 'down', latency: null, detail }
    if (rate >= cfg.error_rate_warn) return { status: 'degraded', latency: null, detail }
    return { status: 'ok', latency: null, detail }
  }

  // Checks HTTP (edge functions, worker, APIs) e Hermes.
  let url = ''
  let init: RequestInit = { method: 'GET' }
  if (t === 'http' && svc.target?.startsWith('FN:')) {
    url = `${env.SUPABASE_URL}/functions/v1/${svc.target.slice(3)}`
    init = { method: 'OPTIONS' } // não dispara lógica; edge functions respondem 200 no CORS
  } else if (t === 'http' && svc.target === 'https://api.anthropic.com/v1/models') {
    url = svc.target
    init = { method: 'GET', headers: { 'x-api-key': env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' } }
  } else if (t === 'hermes') {
    url = env.HERMES_URL ?? ''
    if (!url) return { status: 'unknown', latency: null, detail: 'HERMES_URL não configurado.' }
  } else {
    url = svc.target ?? ''
  }
  if (!url) return { status: 'unknown', latency: null, detail: 'Sem alvo de checagem.' }

  const { res, ms, err } = await timedFetch(url, init)
  if (!res) return { status: 'down', latency: ms, detail: `Sem resposta (${err ?? 'timeout'}).` }
  if (res.status === 401 || res.status === 403) {
    // Serviço no ar, mas pediu autenticação — para reachability isso é "ok".
    return { status: fromLatency(ms, cfg), latency: ms, detail: `HTTP ${res.status} (autenticação) · ${ms}ms.` }
  }
  if (res.status === 429) return { status: 'degraded', latency: ms, detail: `HTTP 429 — rate limit · ${ms}ms.` }
  if (res.status >= 500) return { status: 'down', latency: ms, detail: `HTTP ${res.status} · ${ms}ms.` }
  return { status: fromLatency(ms, cfg), latency: ms, detail: `HTTP ${res.status} · ${ms}ms.` }
}

// Diagnóstico: transforma um status ruim numa explicação acionável.
function diagnose(svc: ServiceRow, r: CheckResult, recurring: number): {
  severity: string; title: string; what: string; affected: string; impact: string
  root_cause: string; suggested_fix: string; preventive: string; priority: string; auto_recoverable: boolean
} {
  const down = r.status === 'down'
  const severity = down ? (svc.critical ? 'critical' : 'warning') : 'warning'
  const priority = severity === 'critical' ? 'critica' : (svc.critical ? 'alta' : 'media')

  let root_cause = r.detail
  let suggested_fix = 'Verificar o serviço e os logs recentes.'
  let preventive = 'Acompanhar as tendências de erro/latência no painel.'
  let auto_recoverable = false

  if (svc.check_type === 'http' && svc.target?.startsWith('FN:')) {
    root_cause = down ? 'A Edge Function não respondeu (deploy quebrado, erro de runtime ou indisponibilidade do Supabase).' : `Latência alta na Edge Function (${r.detail}).`
    suggested_fix = 'Conferir se houve deploy recente com erro; checar os logs da função no Supabase e reimplantar se necessário.'
    preventive = 'Rodar o build/checagem antes de publicar; manter verify_jwt e secrets consistentes.'
    auto_recoverable = true // re-checagem segura
  } else if (svc.check_type === 'hermes') {
    root_cause = 'A VPS externa do Hermes não respondeu — instabilidade conhecida (502/timeout).'
    suggested_fix = 'Conferir a VPS do Hermes (só quem administra vê os logs). O Telegram segue funcionando por ter cérebro próprio.'
    preventive = 'Considerar fallback do Jarvis/chat pra Claude direto quando o Hermes cair.'
    auto_recoverable = true
  } else if (svc.check_type === 'http' && svc.key === 'ai_anthropic') {
    root_cause = r.detail.includes('401') ? 'Falha de autenticação com a Anthropic (ANTHROPIC_API_KEY inválida/ausente).' : r.detail.includes('429') ? 'Rate limit da Anthropic.' : 'Provedor de IA indisponível ou lento.'
    suggested_fix = r.detail.includes('401') ? 'Revisar a secret ANTHROPIC_API_KEY.' : 'Reduzir a frequência do ciclo temporariamente; tentar novamente.'
    preventive = 'Monitorar custo/limite e usar o modelo mais leve pra tarefas simples.'
    auto_recoverable = false
  } else if (svc.check_type === 'agent_errors') {
    root_cause = `Taxa alta de falha no agente (${r.detail}). Pode ser dependência externa (Hermes/Apify/IA) ou dado inconsistente.`
    suggested_fix = 'Abrir os últimos registros de agent_performance com success=false e ver a mensagem de erro comum.'
    preventive = 'Adicionar ret/backoff nas chamadas externas e validar entrada.'
    auto_recoverable = false
  } else if (svc.check_type === 'ai_cost') {
    root_cause = `Custo de IA acima do alerta (${r.detail}).`
    suggested_fix = 'Revisar orçamentos por empresa no Controle de Custo e a frequência de raciocínio.'
    preventive = 'Manter modo Economia em contas pequenas e o cache memory-first ligado.'
    auto_recoverable = false
  } else if (svc.category === 'worker') {
    root_cause = down ? 'O site (Cloudflare Worker) não respondeu — deploy quebrado ou incidente no Cloudflare.' : `Latência alta no site (${r.detail}).`
    suggested_fix = 'Conferir o último deploy (npx wrangler deploy) e o status do Cloudflare.'
    preventive = 'Automatizar o deploy com checagem de build antes de publicar.'
    auto_recoverable = false
  }

  const title = `${svc.name}: ${down ? 'fora do ar' : 'desempenho degradado'}`
  const what = `${svc.name} apresentou status "${r.status}" na checagem. ${r.detail}`
  const affected = svc.name + (svc.critical ? ' (serviço crítico)' : '')
  const impact = down ? (svc.critical ? 'Alto — funcionalidade crítica pode estar indisponível.' : 'Médio — recurso secundário afetado.') : 'Baixo/médio — mais lento que o normal.'
  const recPrefix = recurring > 1 ? `Recorrente: ${recurring} incidentes deste serviço nos últimos 7 dias. ` : ''
  return { severity, title, what: recPrefix + what, affected, impact, root_cause, suggested_fix, preventive, priority, auto_recoverable }
}

async function sendTelegram(token: string, chatId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch { /* best effort */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const env = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'), ANON: Deno.env.get('SUPABASE_ANON_KEY'),
      SERVICE: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'),
      HERMES_URL: Deno.env.get('HERMES_URL'), TELEGRAM_BOT_TOKEN: Deno.env.get('TELEGRAM_BOT_TOKEN'),
      CRON_SECRET: Deno.env.get('CRON_SECRET'),
    }
    const admin = createClient(env.SUPABASE_URL!, env.SERVICE ?? env.ANON!)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = env.CRON_SECRET && body.cron_secret === env.CRON_SECRET

    // Auth: cron_secret OU owner logado (pra "verificar agora" no painel).
    if (!isCron) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(env.SUPABASE_URL!, env.ANON!, { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email ?? '').maybeSingle()
      if ((roleRow as { role?: string } | null)?.role !== 'owner') return json({ error: 'Forbidden' }, 403)
    }

    const { data: cfgRow } = await admin.from('monitor_config').select('*').eq('id', true).maybeSingle()
    const cfg = (cfgRow ?? {}) as Config & { enabled?: boolean }
    if (isCron && cfg.enabled === false) return json({ ok: true, skipped: true, reason: 'Monitor desligado no Control Center.' })

    const { data: services } = await admin.from('platform_services').select('*').eq('enabled', true)
    const now = new Date().toISOString()
    let opened = 0, resolved = 0, checked = 0
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    for (const svc of (services ?? []) as ServiceRow[]) {
      let result = await runCheck(admin, svc, cfg as Config, env)
      checked++
      await admin.from('platform_health_checks').insert({ service_key: svc.key, status: result.status, latency_ms: result.latency, detail: result.detail })

      const { data: openInc } = await admin.from('platform_incidents').select('id, severity').eq('service_key', svc.key).eq('status', 'open').maybeSingle()
      const bad = result.status === 'down' || result.status === 'degraded'

      if (bad && !openInc) {
        const { count: recurring } = await admin.from('platform_incidents').select('id', { count: 'exact', head: true }).eq('service_key', svc.key).gte('created_at', sevenDaysAgo)
        const d = diagnose(svc, result, (recurring ?? 0) + 1)

        // Auto-recuperação segura: só re-checagem, sem ação destrutiva.
        let recovery_status = 'none'
        if (cfg.auto_recovery && d.auto_recoverable) {
          const retry = await runCheck(admin, svc, cfg as Config, env)
          if (retry.status === 'ok') { recovery_status = 'recovered'; result = retry }
          else recovery_status = 'failed'
        } else if (d.auto_recoverable) {
          recovery_status = 'manual'
        }

        if (result.status === 'ok') {
          // Recuperou na retentativa — registra e resolve na hora.
          await admin.from('platform_incidents').insert({ service_key: svc.key, severity: 'info', title: `${svc.name}: recuperado automaticamente`, what_happened: d.what, affected: d.affected, impact: 'Resolvido', root_cause: d.root_cause, suggested_fix: d.suggested_fix, preventive: d.preventive, priority: 'baixa', auto_recoverable: true, recovery_status: 'recovered', status: 'resolved', resolved_at: now })
        } else {
          await admin.from('platform_incidents').insert({ service_key: svc.key, severity: d.severity, title: d.title, what_happened: d.what, affected: d.affected, impact: d.impact, root_cause: d.root_cause, suggested_fix: d.suggested_fix, preventive: d.preventive, priority: d.priority, auto_recoverable: d.auto_recoverable, recovery_status, correlated_change: svc.category === 'edge_function' || svc.category === 'worker' ? 'Verificar deploy recente.' : null })
          opened++
          // Alerta de ops (bypassa gate de cliente — é alerta do admin).
          if (d.severity === 'critical' && cfg.notify_telegram && cfg.admin_telegram_chat_id && env.TELEGRAM_BOT_TOKEN) {
            await sendTelegram(env.TELEGRAM_BOT_TOKEN, cfg.admin_telegram_chat_id, `🛡️ INCIDENTE CRÍTICO\n${d.title}\n\nO que houve: ${d.what}\nCausa provável: ${d.root_cause}\nAção sugerida: ${d.suggested_fix}\nRecuperação automática: ${recovery_status}`)
          }
        }
      } else if (!bad && openInc) {
        await admin.from('platform_incidents').update({ status: 'resolved', resolved_at: now, recovery_status: 'recovered' }).eq('id', (openInc as { id: string }).id)
        resolved++
        // Avisa no Telegram que o serviço crítico VOLTOU (espelha o alerta de
        // queda — só pra quem recebeu o "INCIDENTE CRÍTICO" também saber que
        // normalizou, sem precisar ficar checando).
        if ((openInc as { severity?: string }).severity === 'critical' && cfg.notify_telegram && cfg.admin_telegram_chat_id && env.TELEGRAM_BOT_TOKEN) {
          await sendTelegram(env.TELEGRAM_BOT_TOKEN, cfg.admin_telegram_chat_id, `✅ SERVIÇO RECUPERADO\n${svc.name} voltou a funcionar normalmente.\n\nStatus atual: ${result.detail ?? 'OK'}${result.latency ? ` (${result.latency}ms)` : ''}`)
        }
      }
    }

    // Retenção: limpa incidentes resolvidos antigos e checagens antigas.
    if (cfg.incident_retention_days) {
      const cutoff = new Date(Date.now() - cfg.incident_retention_days * 24 * 60 * 60 * 1000).toISOString()
      await admin.from('platform_incidents').delete().eq('status', 'resolved').lt('resolved_at', cutoff)
      await admin.from('platform_health_checks').delete().lt('checked_at', cutoff)
    }

    await admin.from('monitor_config').update({ last_run_at: now, updated_at: now }).eq('id', true)
    return json({ ok: true, checked, opened, resolved })
  } catch (err) {
    console.error('platform-monitor error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
