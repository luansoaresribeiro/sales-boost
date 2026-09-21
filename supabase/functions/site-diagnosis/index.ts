import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function notifyMarketing(chatId: number | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  // Sempre grava na aba Atividades, mesmo sem Telegram conectado — o envio
  // ao Telegram (dentro de log-bot-event) e so um bonus quando existe chatId.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ?? null, data }),
  }).catch(() => {})
}

async function claudeReview(
  websiteUrl: string,
  company: { business_name: string; business_type: string | null; city: string | null; goal: string | null },
  anthropicKey: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: `Você é um especialista em UX, SEO e marketing digital para pequenos negócios brasileiros.

Site a analisar: ${websiteUrl}
Negócio: ${company.business_name} (${company.business_type ?? 'serviço'} em ${company.city ?? 'Brasil'})
Objetivo: ${company.goal ?? 'crescer e atrair mais clientes'}

Analise a presença digital deste negócio com base no URL e tipo de negócio. Responda APENAS com JSON válido:
{
  "score": <número 0-100 estimado de qualidade geral da presença digital>,
  "summary": "<2-3 frases sobre a presença digital e oportunidades principais>",
  "strengths": ["<ponto forte 1>", "<ponto forte 2>", "<ponto forte 3>"],
  "improvements": ["<melhoria prioritária 1>", "<melhoria prioritária 2>", "<melhoria prioritária 3>"]
}`,
        }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.content?.[0]?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : text)
  } catch { return null }
}

type CompanyRow = { id: string; website_url: string | null; business_name: string; business_type: string | null; city: string | null; contact_email: string | null; goal: string | null }

// Núcleo do diagnóstico — usado tanto pelo clique manual quanto pelo ciclo
// autônomo. Roda PageSpeed + análise de IA e salva um novo registro em diagnostics.
async function runDiagnosis(
  admin: ReturnType<typeof createClient>,
  pagespeedKey: string,
  anthropicKey: string,
  company: CompanyRow,
): Promise<{ id: string; status: string; score: number | null }> {
  let websiteUrl = (company.website_url as string).trim()
  if (!websiteUrl.startsWith('http')) websiteUrl = `https://${websiteUrl}`

  const { data: row, error: insertErr } = await admin
    .from('diagnostics')
    .insert({
      company_id: company.id,
      business_name: company.business_name,
      business_type: company.business_type,
      city: company.city,
      website_url: websiteUrl,
      contact_email: company.contact_email ?? '',
      goal: company.goal ?? '',
      status: 'processing',
    })
    .select('id')
    .single()

  if (insertErr || !row) throw new Error(insertErr?.message ?? 'Erro ao criar diagnóstico')

  const diagnosticId = row.id

  const cats = ['PERFORMANCE', 'SEO', 'ACCESSIBILITY', 'BEST_PRACTICES'].map(c => `category=${c}`).join('&')
  const keyParam = pagespeedKey ? `&key=${pagespeedKey}` : ''
  const psBase = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(websiteUrl)}&${cats}${keyParam}`

  const [mobileSettled, desktopSettled, review] = await Promise.all([
    fetch(`${psBase}&strategy=mobile`).catch(() => null),
    fetch(`${psBase}&strategy=desktop`).catch(() => null),
    anthropicKey ? claudeReview(websiteUrl, company, anthropicKey) : Promise.resolve(null),
  ])

  const parse = async (res: Response | null) => {
    if (!res || !res.ok) return null
    try {
      const raw = await res.json()
      const lr = raw?.lighthouseResult ?? {}
      const audits = lr?.audits ?? {}
      const categories = lr?.categories ?? {}
      const score = (k: string) => Math.round((categories[k]?.score ?? 0) * 100)
      const ms = (k: string): number | undefined => {
        const v = audits[k]?.numericValue
        return v != null ? Math.round(v) : undefined
      }
      const opps = Object.entries(audits as Record<string, { score?: number; displayValue?: string; title?: string }>)
        .filter(([, v]) => typeof v.score === 'number' && v.score < 0.9 && v.displayValue)
        .slice(0, 6)
        .map(([k, v]) => ({ id: k, title: v.title ?? k, displayValue: v.displayValue! }))
      return {
        performance: score('performance'),
        seo: score('seo'),
        accessibility: score('accessibility'),
        best_practices: score('best-practices'),
        lcp: ms('largest-contentful-paint'),
        fcp: ms('first-contentful-paint'),
        si: ms('speed-index'),
        tbt: ms('total-blocking-time'),
        cls: audits['cumulative-layout-shift']?.numericValue != null
          ? Number(Number(audits['cumulative-layout-shift'].numericValue).toFixed(3)) : undefined,
        opportunities: opps,
      }
    } catch { return null }
  }

  const [mobile, desktop] = await Promise.all([parse(mobileSettled), parse(desktopSettled)])
  const hasPagespeed = !!(mobile || desktop)
  const finalStatus = hasPagespeed ? 'complete' : 'partial'

  await admin.from('diagnostics').update({
    pagespeed_mobile: mobile,
    pagespeed_desktop: desktop,
    frontend_review: review,
    status: finalStatus,
  }).eq('id', diagnosticId)

  return { id: diagnosticId, status: finalStatus, score: mobile?.performance ?? desktop?.performance ?? null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey
    const pagespeedKey = Deno.env.get('PAGESPEED_API_KEY') ?? ''
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
    const cronSecretEnv = Deno.env.get('CRON_SECRET')

    const admin = createClient(supabaseUrl, serviceKey)

    const rawBody = req.method === 'POST' ? await req.json().catch(() => ({})) as Record<string, unknown> : {}
    const isCron = cronSecretEnv && rawBody.cron_secret === cronSecretEnv

    // Modo cron: reavalia o site só se mudou desde o último diagnóstico OU já
    // faz 30+ dias — performance de site muda mesmo sem o dono editar nada
    // (hospedagem, terceiros, etc.), mas não vale a pena rodar isso toda hora.
    if (isCron) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await admin
        .from('companies')
        .select('id, website_url, business_name, business_type, city, contact_email, goal, telegram_chat_id, notification_prefs')
        .eq('active', true)
        .not('website_url', 'is', null)

      let ran = 0, skipped = 0
      for (const company of (companies ?? []) as (CompanyRow & { telegram_chat_id: number | null; notification_prefs: Record<string, boolean> | null })[]) {
        try {
          const { data: lastDiag } = await admin
            .from('diagnostics')
            .select('website_url, created_at')
            .eq('company_id', company.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const websiteChanged = lastDiag?.website_url !== company.website_url
          const isStale = !lastDiag || lastDiag.created_at < thirtyDaysAgo
          if (!websiteChanged && !isStale) { skipped++; continue }

          const result = await runDiagnosis(admin, pagespeedKey, anthropicKey, company)
          ran++

          const prefs = company.notification_prefs ?? {}
          if (prefs.agent_actions !== false) {
            notifyMarketing(company.telegram_chat_id, company.id, 'AGENT_ACTION', {
              action: 'diagnostic_updated',
              count: 1,
              reason: websiteChanged
                ? 'Endereço do site mudou desde o último diagnóstico'
                : 'Já fazia 30+ dias desde a última análise do site',
              sample: result.score != null ? `Nota de performance: ${result.score}/100` : null,
            })
          }
        } catch (e) {
          console.error(`site-diagnosis cron: company ${company.id} error:`, e)
        }
      }
      return json({ ok: true, cron: true, ran, skipped })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: company } = await admin
      .from('companies')
      .select('id, website_url, business_name, business_type, city, contact_email, goal')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Configure seu perfil nas Configurações primeiro.' }, 404)
    if (!company.website_url) return json({ error: 'URL do site não configurada. Adicione nas Configurações.' }, 400)

    const result = await runDiagnosis(admin, pagespeedKey, anthropicKey, company as CompanyRow)
    return json({ ok: true, id: result.id, status: result.status, has_pagespeed: result.status === 'complete', has_ai_review: true })

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
