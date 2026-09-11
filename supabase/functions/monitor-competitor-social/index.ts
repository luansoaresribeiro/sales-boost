import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApifyPost {
  timestamp?: string
  likesCount?: number
  commentsCount?: number
  caption?: string
}

interface ApifyProfile {
  followersCount?: number
  postsCount?: number
  latestPosts?: ApifyPost[]
}

interface MoveClassification { move: string; moveType: 'preco' | 'conteudo' | 'promocao' | 'crescimento' }

function avgEngagement(posts: ApifyPost[], followers: number | undefined): number | null {
  if (!followers || followers <= 0) return null
  const rates = posts
    .filter(p => typeof p.likesCount === 'number' || typeof p.commentsCount === 'number')
    .map(p => ((p.likesCount ?? 0) + (p.commentsCount ?? 0)) / followers * 100)
  if (rates.length === 0) return null
  return Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100
}

// Resume e classifica o que o concorrente andou fazendo, só com base nas
// legendas reais dos posts coletados — sem legenda nenhuma, não classifica
// (fica sem dado em vez de inventar).
async function classifyMove(anthropicKey: string, competitorName: string, businessType: string, captions: string[]): Promise<MoveClassification | null> {
  if (captions.length === 0) return null
  const prompt = `Você é um analista de inteligência de mercado para negócios locais (segmento: ${businessType}).
Abaixo estão as legendas reais dos posts mais recentes do concorrente "${competitorName}" no Instagram.

Legendas:
${captions.map((c, i) => `[${i + 1}] "${c}"`).join('\n')}

Com base SOMENTE nessas legendas (não invente nada que não esteja nelas), resuma em UMA frase curta (até 140 caracteres, em português) o que esse concorrente andou fazendo, e classifique em uma categoria.

Responda SOMENTE com um JSON: {"move": "...", "moveType": "preco"|"conteudo"|"promocao"|"crescimento"}
- "preco": mudou preço ou fez comparação de preço
- "promocao": oferta, desconto, campanha promocional
- "crescimento": expansão, nova unidade, contratação, marco de seguidores
- "conteudo": qualquer outra coisa (conteúdo educativo, bastidores, engajamento)`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const rawText = (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
  try {
    const parsed = JSON.parse(rawText)
    if (!parsed.move || !parsed.moveType) return null
    return { move: String(parsed.move).slice(0, 200), moveType: parsed.moveType }
  } catch {
    return null
  }
}

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

async function runApifyActor(token: string, actorId: string, input: Record<string, unknown>, timeoutSecs = 60): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&memory=256`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  if (!res.ok) throw new Error(`Apify error (${actorId}): ${await res.text()}`)
  return res.json()
}

function postingFrequencyDays(posts: ApifyPost[]): number | null {
  const dates = posts.map(p => p.timestamp ? new Date(p.timestamp).getTime() : null).filter((t): t is number => t !== null).sort((a, b) => b - a)
  if (dates.length < 2) return null
  const spanDays = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24)
  return Math.round((spanDays / (dates.length - 1)) * 10) / 10
}

async function monitorCompanyCompetitors(
  admin: ReturnType<typeof createClient>,
  apifyToken: string,
  companyId: string,
  anthropicKey: string | undefined,
): Promise<{ monitored: number; total: number; results: Array<{ name: string; ok: boolean; error?: string }> }> {
  const { data: competitors } = await admin
    .from('competitors')
    .select('id, name, instagram_url')
    .eq('company_id', companyId)
    .not('instagram_url', 'is', null)
    .limit(10) // bound cost — each one is a real Apify run

  if (!competitors || competitors.length === 0) return { monitored: 0, total: 0, results: [] }

  const { data: companyRow } = await admin.from('companies').select('business_type').eq('id', companyId).maybeSingle()
  const businessType = (companyRow?.business_type as string | null) ?? 'negócio local'

  const results: Array<{ name: string; ok: boolean; error?: string }> = []

  for (const comp of competitors) {
    try {
      const igUrl = (comp.instagram_url as string).replace(/\/$/, '')
      const items = await runApifyActor(apifyToken, 'apify~instagram-scraper', {
        directUrls: [igUrl], resultsType: 'details', resultsLimit: 12,
      }, 90) as ApifyProfile[]

      const profile = items[0]
      if (!profile) { results.push({ name: comp.name, ok: false, error: 'perfil não encontrado' }); continue }

      const posts = profile.latestPosts ?? []
      const captions = posts.map(p => p.caption?.trim()).filter((c): c is string => !!c).slice(0, 5)
      const move = anthropicKey ? await classifyMove(anthropicKey, comp.name, businessType, captions).catch(() => null) : null

      await admin.from('competitor_snapshots').insert({
        competitor_id: comp.id,
        instagram_followers: profile.followersCount ?? null,
        instagram_posts_count: profile.postsCount ?? null,
        instagram_posting_freq_days: postingFrequencyDays(posts),
        avg_engagement: avgEngagement(posts, profile.followersCount),
        latest_move: move?.move ?? null,
        latest_move_type: move?.moveType ?? null,
      })
      results.push({ name: comp.name, ok: true })
    } catch (e) {
      results.push({ name: comp.name, ok: false, error: String(e) })
    }
  }

  return { monitored: results.filter(r => r.ok).length, total: competitors.length, results }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey
    const apifyToken = Deno.env.get('APIFY_TOKEN')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    if (!apifyToken) return json({ error: 'APIFY_TOKEN não configurado.' }, 503)

    const admin = createClient(supabaseUrl, serviceKey)

    const rawBody = req.method === 'POST' ? await req.json().catch(() => ({})) as Record<string, unknown> : {}
    const isCron = cronSecretEnv && rawBody.cron_secret === cronSecretEnv

    // Modo cron: só reprocessa concorrentes cujas redes sociais não foram
    // checadas nos últimos 7 dias — cada checagem é uma chamada real ao Apify,
    // então não faz sentido repetir isso a cada 30 minutos.
    if (isCron) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await admin
        .from('companies')
        .select('id, telegram_chat_id, notification_prefs')
        .eq('active', true)

      let scanned = 0, skipped = 0
      for (const company of companies ?? []) {
        try {
          const { data: recentSnap } = await admin
            .from('competitor_snapshots')
            .select('collected_at, competitors!inner(company_id)')
            .eq('competitors.company_id', company.id)
            .not('instagram_followers', 'is', null)
            .order('collected_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (recentSnap?.collected_at && recentSnap.collected_at > sevenDaysAgo) { skipped++; continue }

          const r = await monitorCompanyCompetitors(admin, apifyToken, company.id, anthropicKey)
          if (r.total > 0) {
            await logSync(admin, company.id, r.monitored === r.total
              ? { ok: true, status: 'healthy', recordsSynced: r.monitored }
              : { ok: false, status: 'error', error: `${r.total - r.monitored} de ${r.total} concorrentes falharam`, recordsSynced: r.monitored })
          }
          if (r.monitored > 0) {
            scanned++
            const prefs = (company.notification_prefs as Record<string, boolean> | null) ?? {}
            if (prefs.agent_actions !== false) {
              notifyMarketing(company.telegram_chat_id as number | null, company.id, 'AGENT_ACTION', {
                action: 'competitor_social_checked',
                count: r.monitored,
                reason: 'Verificação periódica de redes sociais dos concorrentes mapeados (a cada 7 dias)',
              })
            }
          }
        } catch (e) {
          console.error(`monitor-competitor-social cron: company ${company.id} error:`, e)
        }
      }
      return json({ ok: true, cron: true, scanned, skipped })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: company } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    const result = await monitorCompanyCompetitors(admin, apifyToken, company.id, anthropicKey)
    if (result.total === 0) {
      return json({ monitored: 0, message: 'Nenhum concorrente com Instagram identificado ainda. Rode "Mapear concorrentes" primeiro.' })
    }
    await logSync(admin, company.id, result.monitored === result.total
      ? { ok: true, status: 'healthy', recordsSynced: result.monitored }
      : { ok: false, status: 'error', error: `${result.total - result.monitored} de ${result.total} concorrentes falharam`, recordsSynced: result.monitored })

    return json({ monitored: result.monitored, total: result.total, results: result.results })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Fase 1 do plano de arquitetura de sincronização — grava saúde/freshness
// central (integration_sync_status). last_success_at só é tocado quando
// ok=true, preservando a última sincronização boa mesmo quando esta falhou.
async function logSync(admin: ReturnType<typeof createClient>, companyId: string, result: { ok: boolean; status: 'healthy' | 'error' | 'disconnected'; error?: string | null; recordsSynced?: number }) {
  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
    company_id: companyId, integration: 'competitor_social',
    last_synced_at: now, status: result.status, last_error: result.error ?? null,
    records_synced: result.recordsSynced ?? null, updated_at: now,
  }
  if (result.ok) row.last_success_at = now
  try { await admin.from('integration_sync_status').upsert(row, { onConflict: 'company_id,integration' }) } catch { /* nunca derruba a sync por causa do log */ }
}
