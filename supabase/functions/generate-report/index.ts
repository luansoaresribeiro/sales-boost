import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const BG = '#0E0B0A'
const MUTED = '#BABABA'

function scoreColor(s: number): string {
  return s >= 75 ? '#4ade80' : s >= 50 ? '#FBBF24' : '#f87171'
}

function escapeHtml(s: string | undefined | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildReportHtml(businessName: string, periodLabel: string, data: ReportData): string {
  const hsColor = scoreColor(data.health_score)

  const strengthsHtml = data.strengths.map((s, i) => `
    <div style="display:flex;gap:14px;margin-bottom:14px;">
      <div style="width:26px;height:26px;border-radius:8px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#4ade80;">${i + 1}</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:white;margin-bottom:3px;">✓ ${escapeHtml(s.title)}</div>
        <div style="font-size:12px;color:${MUTED};">↳ ${escapeHtml(s.action)}</div>
      </div>
    </div>`).join('')

  const complaintsHtml = data.complaints.map((c) => `
    <div style="display:flex;gap:14px;margin-bottom:14px;">
      <span style="padding:3px 8px;border-radius:6px;background:${c.urgency === 'high' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.12)'};font-size:10px;font-weight:700;color:${c.urgency === 'high' ? '#f87171' : '#FBBF24'};white-space:nowrap;">${c.urgency === 'high' ? 'Urgente' : c.urgency === 'medium' ? 'Médio' : 'Baixo'}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:white;margin-bottom:3px;">${escapeHtml(c.title)}</div>
        <div style="font-size:12px;color:${MUTED};">↳ ${escapeHtml(c.action)}</div>
      </div>
    </div>`).join('')

  const actionsHtml = data.actions.map((a) => `
    <div style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:16px;">
      <div style="width:32px;height:32px;border-radius:9px;background:rgba(255,109,41,0.12);border:1px solid rgba(255,109,41,0.3);display:flex;align-items:center;justify-content:center;font-weight:900;color:${ORANGE};flex-shrink:0;">${String(a.priority).padStart(2, '0')}</div>
      <div>
        <div style="font-size:14px;font-weight:700;color:white;margin-bottom:4px;">${escapeHtml(a.title)} <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(255,109,41,0.12);color:${ORANGE};font-weight:700;">Impacto ${escapeHtml(a.impact)}</span></div>
        <div style="font-size:12px;color:${MUTED};">${escapeHtml(a.description)}</div>
      </div>
    </div>`).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:40px;background:${BG};font-family:'Helvetica Neue',Arial,sans-serif;color:white;">
  <div style="margin-bottom:28px;">
    <div style="font-size:11px;color:${ORANGE};font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Sales Boost · Relatório Mensal</div>
    <div style="font-size:24px;font-weight:800;margin-top:6px;">${escapeHtml(businessName)}</div>
    <div style="font-size:13px;color:${MUTED};margin-top:2px;">${escapeHtml(periodLabel)}</div>
  </div>

  <div style="background:${CARD};border-radius:16px;padding:28px;margin-bottom:18px;display:flex;gap:32px;">
    <div style="text-align:center;flex-shrink:0;">
      <div style="font-size:56px;font-weight:900;color:${hsColor};">${data.health_score}</div>
      <div style="font-size:11px;color:${MUTED};margin-top:2px;">Score de saúde</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Resumo executivo</div>
      <div style="font-size:13px;line-height:1.7;">${escapeHtml(data.executive_summary)}</div>
    </div>
  </div>

  <div style="background:${CARD};border-radius:14px;padding:22px;margin-bottom:18px;">
    <div style="font-size:14px;font-weight:700;margin-bottom:14px;">✦ O que amam em você</div>
    ${strengthsHtml || `<div style="font-size:12px;color:${MUTED};">Sem dados suficientes ainda.</div>`}
  </div>

  <div style="background:${CARD};border-radius:14px;padding:22px;margin-bottom:18px;">
    <div style="font-size:14px;font-weight:700;margin-bottom:14px;">⚠ O que afasta clientes</div>
    ${complaintsHtml || `<div style="font-size:12px;color:${MUTED};">Nenhuma reclamação relevante.</div>`}
  </div>

  <div style="background:${CARD};border-radius:14px;padding:22px;margin-bottom:18px;">
    <div style="font-size:14px;font-weight:700;margin-bottom:10px;">💰 Posicionamento de preço</div>
    <div style="font-size:12px;color:${MUTED};line-height:1.7;">${escapeHtml(data.pricing_recommendation)}</div>
  </div>

  <div style="background:${CARD};border-radius:14px;padding:22px;">
    <div style="font-size:14px;font-weight:700;margin-bottom:6px;">🎯 3 Ações do Mês</div>
    ${actionsHtml}
  </div>

  <div style="text-align:right;font-size:10px;color:rgba(255,255,255,0.3);margin-top:20px;">Gerado por IA (Claude) · Sales Boost</div>
</body></html>`
}

async function generatePdf(html: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://rest.apitemplate.io/v2/create-pdf-from-html', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: html,
        settings: {
          paper_size: 'A4',
          orientation: '1',
          margin_top: '0',
          margin_right: '0',
          margin_bottom: '0',
          margin_left: '0',
          print_background: '1',
        },
      }),
    })
    if (!res.ok) {
      console.error('apitemplate.io error:', await res.text())
      return null
    }
    const data = await res.json()
    return data.download_url ?? null
  } catch (e) {
    console.error('apitemplate.io exception:', e)
    return null
  }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: company, error: companyErr } = await userClient
      .from('companies')
      .select('id, business_name, telegram_chat_id')
      .eq('user_id', user.id)
      .single()

    if (companyErr || !company) return json({ error: `Empresa não encontrada: ${companyErr?.message}` }, 404)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada' }, 500)

    // Determine current period (YYYY-MM)
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const periodLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

    // Idempotency: return existing report if already generated this month
    const { data: existing } = await supabase
      .from('reports')
      .select('id, health_score, pdf_url')
      .eq('company_id', company.id)
      .eq('period', period)
      .single()

    if (existing) {
      return json({ report_id: existing.id, period, health_score: existing.health_score, pdf_url: existing.pdf_url, cached: true })
    }

    // Gather all data for this company
    const [reviewsRes, competitorsRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('rating, sentiment, themes, text, author, review_date')
        .eq('company_id', company.id)
        .order('review_date', { ascending: false })
        .limit(100),
      supabase
        .from('competitors')
        .select('name, rating, review_count, distance_m, price_level')
        .eq('company_id', company.id)
        .order('distance_m', { ascending: true })
        .limit(10),
    ])

    const reviews = reviewsRes.data ?? []
    const competitors = competitorsRes.data ?? []

    if (reviews.length === 0) {
      return json({ error: 'Importe reviews antes de gerar o relatório' }, 400)
    }

    // Compute basic stats
    const avgRating = (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    const positiveCount = reviews.filter(r => r.sentiment === 'positive').length
    const negativeCount = reviews.filter(r => r.sentiment === 'negative').length

    // Theme frequency
    const themeCounts: Record<string, { total: number; pos: number; neg: number }> = {}
    for (const r of reviews) {
      for (const t of (r.themes ?? [])) {
        if (!themeCounts[t]) themeCounts[t] = { total: 0, pos: 0, neg: 0 }
        themeCounts[t].total++
        if (r.sentiment === 'positive') themeCounts[t].pos++
        if (r.sentiment === 'negative') themeCounts[t].neg++
      }
    }

    // Sample reviews for Claude (top 20)
    const reviewSamples = reviews.slice(0, 20).map(r =>
      `(${r.rating}★ ${r.sentiment}) ${r.text}`
    ).join('\n')

    const competitorSummary = competitors.length > 0
      ? competitors.map(c =>
        `- ${c.name}: ${c.rating}★ (${c.review_count} reviews), ${c.distance_m}m de distância, nível de preço: ${'$'.repeat(c.price_level ?? 2)}`
      ).join('\n')
      : 'Nenhum concorrente mapeado ainda.'

    const themesSummary = Object.entries(themeCounts)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([t, c]) => `- ${t}: ${c.total} menções (${c.pos} positivas, ${c.neg} negativas)`)
      .join('\n')

    // Call Claude to generate insights
    const prompt = `Você é um consultor especialista em pequenos negócios. Analise os dados abaixo e gere um relatório mensal completo para "${company.business_name}".

## Dados do período (${periodLabel})

**Avaliações:** ${reviews.length} reviews | Nota média: ${avgRating}★ | ${positiveCount} positivas | ${negativeCount} negativas

**Temas mais citados:**
${themesSummary}

**Amostra de avaliações recentes:**
${reviewSamples}

**Concorrentes mapeados:**
${competitorSummary}

---

Gere um relatório JSON com EXATAMENTE esta estrutura:
{
  "health_score": <número 0-100 baseado nos dados>,
  "executive_summary": "<1 parágrafo executivo em PT-BR>",
  "strengths": [
    {"title": "<ponto forte>", "action": "<como usar no marketing>"},
    {"title": "<ponto forte>", "action": "<como usar no marketing>"}
  ],
  "complaints": [
    {"title": "<reclamação>", "action": "<ação corretiva concreta>", "urgency": "high|medium|low"},
    {"title": "<reclamação>", "action": "<ação corretiva concreta>", "urgency": "high|medium|low"}
  ],
  "pricing_recommendation": "<recomendação de posicionamento de preço vs concorrentes>",
  "actions": [
    {"priority": 1, "title": "<ação>", "description": "<detalhes>", "impact": "Muito alto|Alto|Médio"},
    {"priority": 2, "title": "<ação>", "description": "<detalhes>", "impact": "Muito alto|Alto|Médio"},
    {"priority": 3, "title": "<ação>", "description": "<detalhes>", "impact": "Muito alto|Alto|Médio"}
  ]
}

Responda SOMENTE com o JSON, sem texto adicional. As ações devem ser específicas, concretas e implementáveis amanhã.`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return json({ error: `Claude API error: ${err}` }, 500)
    }

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.[0]?.text ?? '{}'

    let reportData: ReportData
    try {
      reportData = JSON.parse(rawText)
    } catch {
      return json({ error: 'Claude retornou JSON inválido', raw: rawText }, 500)
    }

    // Generate PDF via apitemplate.io (best-effort — não bloqueia o relatório se falhar)
    let pdfUrl: string | null = null
    const apitemplateKey = Deno.env.get('APITEMPLATE_API_KEY')
    if (apitemplateKey) {
      const html = buildReportHtml(company.business_name, periodLabel, reportData)
      pdfUrl = await generatePdf(html, apitemplateKey)
    }

    // Save report to database
    const { data: reportRow, error: reportErr } = await supabase
      .from('reports')
      .insert({
        company_id: company.id,
        period,
        health_score: reportData.health_score,
        summary_json: reportData,
        pdf_url: pdfUrl,
      })
      .select('id')
      .single()

    if (reportErr) return json({ error: reportErr.message }, 500)

    // Save 3 actions
    const actionRows = reportData.actions.map((a) => ({
      report_id: reportRow.id,
      title: a.title,
      description: a.description,
      priority: a.priority,
      status: 'pending',
    }))

    await supabase.from('actions').insert(actionRows)

    notifyMarketing((company as Record<string, unknown>).telegram_chat_id as number | null, company.id, 'REPORT_READY', {
      period: periodLabel,
      health_score: reportData.health_score,
    })

    return json({
      report_id: reportRow.id,
      period,
      health_score: reportData.health_score,
      pdf_url: pdfUrl,
      data: reportData,
    })

  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

interface ReportData {
  health_score: number
  executive_summary: string
  strengths: Array<{ title: string; action: string }>
  complaints: Array<{ title: string; action: string; urgency: string }>
  pricing_recommendation: string
  actions: Array<{ priority: number; title: string; description: string; impact: string }>
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
