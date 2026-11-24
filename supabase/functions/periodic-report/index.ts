/**
 * periodic-report
 * Relatório executivo semanal/mensal/anual — mesma ideia do enzo-daily-report
 * (agrega a atividade real do período e escreve um resumo com a Claude),
 * só que com a janela de tempo maior e frequência configurável.
 *
 * Body: { cron_secret, period: 'weekly' | 'monthly' | 'annual', company_id? }
 *
 * Dois portões, sempre os dois: (1) o interruptor geral da plataforma
 * (report_config.<period>_enabled, o dono liga no Agents Control Center) e
 * (2) o interruptor da própria empresa (companies.notification_prefs.
 * <period>_report, em Configurações > Notificações). Se qualquer um dos
 * dois estiver desligado, essa empresa não recebe nada naquele ciclo.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { claudeBody, MODEL_WRITE, textOf } from '../_shared/aiModels.ts'
import { buildReportEmail, emailsReport, factLines, reportCompanies, type ReportFacts } from '../_shared/clientReport.ts'
import { sendOwnerEmail } from '../_shared/ownerEmail.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Period = 'weekly' | 'monthly' | 'annual'

const PERIOD_DAYS: Record<Period, number> = { weekly: 7, monthly: 30, annual: 365 }
const PERIOD_LABEL: Record<Period, string> = { weekly: 'Semanal', monthly: 'Mensal', annual: 'Anual' }
const PREF_KEY: Record<Period, string> = { weekly: 'weekly_report', monthly: 'monthly_report', annual: 'annual_report' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({})) as { cron_secret?: string; period?: Period; company_id?: string }
    if (!cronSecretEnv || body.cron_secret !== cronSecretEnv) return json({ error: 'Unauthorized' }, 401)

    const period = body.period
    if (!period || !PERIOD_DAYS[period]) return json({ error: 'period deve ser weekly, monthly ou annual' }, 400)

    const { data: reportConfig } = await admin.from('report_config').select('*').eq('id', true).maybeSingle()
    const enabledKey = `${period}_enabled` as 'weekly_enabled' | 'monthly_enabled' | 'annual_enabled'
    if (reportConfig && reportConfig[enabledKey] === false) {
      return json({ ok: true, skipped: true, reason: `Relatório ${PERIOD_LABEL[period]} está desligado no Agents Control Center.` })
    }

    // Dono, 24/11: "pode parar de gerar relatório para as outras contas". Só as contas da lista (opt-in) — a Liga dos
    // Sonhos e qualquer conta fora dela nunca são lidas. Um company_id fora da lista também é ignorado.
    const list = reportCompanies((reportConfig as { email_owner_companies?: unknown } | null)?.email_owner_companies, body.company_id)
    if (!list.length) return json({ ok: true, processed: 0, reason: 'Nenhuma conta na lista de relatórios.' })
    const { data: companies } = await admin.from('companies').select('id, business_name, business_type, city, goal, telegram_chat_id, notification_prefs').in('id', list)
    if (!companies || companies.length === 0) return json({ ok: true, processed: 0 })

    const windowStart = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString()
    const results: { company_id: string; ok: boolean; skipped?: boolean; error?: string }[] = []

    for (const company of companies) {
      try {
        const prefs = (company.notification_prefs as Record<string, boolean> | null) ?? {}
        if (prefs[PREF_KEY[period]] === false) {
          results.push({ company_id: company.id, ok: true, skipped: true })
          continue
        }
        await generateReport(company, period, windowStart, admin, supabaseUrl, (reportConfig as { email_owner_companies?: unknown } | null)?.email_owner_companies)
        results.push({ company_id: company.id, ok: true })
      } catch (err) {
        results.push({ company_id: company.id, ok: false, error: String(err) })
      }
    }

    return json({ ok: true, period, processed: results.length, results })
  } catch (err) {
    console.error('periodic-report error:', err)
    return json({ error: String(err) }, 500)
  }
})

async function generateReport(company: Record<string, unknown>, period: Period, windowStart: string, admin: ReturnType<typeof createClient>, supabaseUrl: string, emailList?: unknown) {
  const companyId = company.id as string
  const name = company.business_name as string
  const type = (company.business_type as string | null) ?? 'negócio'
  const city = (company.city as string | null) ?? 'Brasil'
  const goal = (company.goal as string | null) ?? 'crescer'
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  // Dados reais do período (dono 24/11): tabelas que o produto usa hoje. Contagem só (head:true), nada inventado.
  const cnt = (q: any) => q.then((r: { count: number | null }) => r.count ?? 0)
  const [published, generated, waitingApproval, overdue, opportunitiesNew, leads, visits] = await Promise.all([
    cnt(admin.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('instagram_media_id', 'is', null).gte('created_at', windowStart)),
    cnt(admin.from('marketing_ai_test_content').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('source_id', null).gte('created_at', windowStart)),
    cnt(admin.from('marketing_ai_test_content').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'vault')),
    cnt(admin.from('marketing_ai_test_content').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'vault').lt('planned_for', todayIso)),
    cnt(admin.from('growth_opportunities').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', windowStart)),
    cnt(admin.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', windowStart)),
    cnt(admin.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('visit_at', windowStart)),
  ])
  const facts: ReportFacts = { published, generated, waitingApproval, overdue, opportunitiesNew, leads, visits }

  const periodLabelPt: Record<Period, string> = { weekly: 'da última semana', monthly: 'do último mês', annual: 'do último ano' }
  const dateStr = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const systemPrompt = `Você escreve, em nome da equipe Sales Boost, o relatório periódico para o cliente ${name} (${type} em ${city}). Objetivo do cliente: ${goal}.
O relatório vai ser lido pelo cliente: tom próximo, claro e profissional, sem jargão técnico.`

  const userPrompt = `# Relatório ${PERIOD_LABEL[period]} — ${dateStr}

Dados reais ${periodLabelPt[period]}:
${factLines(facts).map(l => `- ${l}`).join('\n')}

# Sua tarefa:
Escreva um relatório ${PERIOD_LABEL[period].toLowerCase()} CONCISO (no máximo 5 parágrafos curtos), só com base nos dados reais acima — nunca invente número, prazo ou resultado que não está aqui. Se um número é zero, diga o que fazer para mudar (sem culpar o cliente).
Inclua:
1. Resumo do período (1–2 frases)
2. O que os números significam
3. O que precisa da atenção do cliente (ex.: peças esperando aprovação)
4. Uma recomendação concreta para o próximo período
5. Assinatura: "— Equipe Sales Boost"`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(claudeBody(MODEL_WRITE, { max_tokens: 900, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  const report = textOf(data)

  await admin.from('agent_messages').insert({
    company_id: companyId, role: 'assistant', agent_role: 'ceo',
    content: `[Relatório ${PERIOD_LABEL[period]} • ${dateStr}]\n\n${report}`,
  })

  // Passo 1 (dono, 24/11): o relatório chega ao e-mail do DONO, pronto para encaminhar ao cliente. Só as contas listadas.
  if (report && emailsReport(emailList, companyId)) {
    const mail = buildReportEmail({ company: name, periodLabel: PERIOD_LABEL[period], dateStr, report, facts })
    const sent = await sendOwnerEmail(admin, mail.subject, mail.text)
    if (!sent.ok) console.error('periodic-report: e-mail ao dono falhou', companyId, sent.reason)
  }

  const chatId = company.telegram_chat_id as number | null
  if (chatId) {
    const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
    fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: secret ?? '', bot_name: 'marketing', event_type: `${period.toUpperCase()}_REPORT`, company_id: companyId, telegram_chat_id: chatId,
        message: `📋 Relatório ${PERIOD_LABEL[period]} • ${dateStr}\n\n${report}`,
      }),
    }).catch(() => { /* non-fatal */ })
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
