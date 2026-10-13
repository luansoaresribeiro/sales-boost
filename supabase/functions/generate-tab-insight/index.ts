import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hasPaidAccess, requirePaidAccess } from '../_shared/access.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SupaClient = ReturnType<typeof createClient>
type TabKey = 'avaliacoes' | 'opinioes' | 'concorrentes' | 'crescimento' | 'performance' | 'audiencia' | 'diagnostico'

const TAB_LABELS: Record<TabKey, string> = {
  avaliacoes: 'Avaliações do Google',
  opinioes: 'Opiniões da Internet (todas as fontes: Google, Facebook, TripAdvisor, Reclame Aqui, iFood, comentários do Instagram)',
  concorrentes: 'Concorrentes mapeados nas proximidades',
  crescimento: 'Desempenho dos posts publicados no Instagram',
  performance: 'Performance e SEO do site (diagnóstico técnico)',
  audiencia: 'Audiência e engajamento nas redes sociais',
  diagnostico: 'Saúde dos links e canais do negócio (site, redes sociais, Maps)',
}

interface CompanyRow {
  id: string; business_name: string; business_type: string | null
  google_rating: number | null; google_review_count: number | null
  website_url: string | null; instagram_url: string | null; facebook_url: string | null
  tiktok_url: string | null; google_maps_url: string | null; tripadvisor_url: string | null
  reclame_aqui_url: string | null; ifood_url: string | null
  social_data: Record<string, unknown> | null
}

async function checkUrlAlive(rawUrl: string): Promise<'ok' | 'broken'> {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalesBoostHealthCheck/1.0)' } })
    clearTimeout(timeout)
    return (res.ok || [405, 999].includes(res.status)) ? 'ok' : 'broken'
  } catch {
    clearTimeout(timeout)
    return 'broken'
  }
}

async function gatherContext(admin: SupaClient, company: CompanyRow, tabKey: TabKey): Promise<Record<string, unknown>> {
  if (tabKey === 'avaliacoes') {
    const { data } = await admin.from('reviews').select('rating, text, sentiment, review_date, owner_reply').eq('company_id', company.id).eq('source', 'google').order('review_date', { ascending: false }).limit(100)
    const revs = data ?? []
    return { google_rating: company.google_rating, total_reviews: company.google_review_count ?? revs.length, sample: revs.slice(0, 40), unanswered_count: revs.filter(r => !r.owner_reply).length, negative_count: revs.filter(r => (r.rating ?? 5) <= 2).length }
  }

  if (tabKey === 'opinioes') {
    const { data } = await admin.from('reviews').select('source, rating, sentiment, text').eq('company_id', company.id).limit(300)
    const revs = data ?? []
    const bySource: Record<string, number> = {}
    for (const r of revs) bySource[r.source] = (bySource[r.source] ?? 0) + 1
    return { total: revs.length, by_source: bySource, sample: revs.slice(0, 40) }
  }

  if (tabKey === 'concorrentes') {
    const { data } = await admin.from('competitors').select('name, rating, review_count, distance_m, price_level').eq('company_id', company.id).order('distance_m', { ascending: true }).limit(20)
    return { my_rating: company.google_rating, my_review_count: company.google_review_count, competitors: data ?? [] }
  }

  if (tabKey === 'crescimento') {
    const { data } = await admin.from('instagram_posts').select('caption, likes_count, comments_count, posted_at').eq('company_id', company.id).not('posted_at', 'is', null).order('posted_at', { ascending: false }).limit(60)
    return { posts: data ?? [] }
  }

  if (tabKey === 'performance') {
    const { data } = await admin.from('diagnostics').select('website_url, created_at, pagespeed_mobile, pagespeed_desktop, frontend_review').eq('company_id', company.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    return { diagnostic: data ?? null }
  }

  if (tabKey === 'audiencia') {
    return { instagram_url: company.instagram_url, social_data: company.social_data ?? null }
  }

  // diagnostico — live check, same rule as check-links-health, capped short
  const channels: Array<{ key: string; url: string | null }> = [
    { key: 'Site', url: company.website_url }, { key: 'Instagram', url: company.instagram_url },
    { key: 'Facebook', url: company.facebook_url }, { key: 'TikTok', url: company.tiktok_url },
    { key: 'Google Maps', url: company.google_maps_url }, { key: 'TripAdvisor', url: company.tripadvisor_url },
    { key: 'Reclame Aqui', url: company.reclame_aqui_url }, { key: 'iFood', url: company.ifood_url },
  ]
  const results = await Promise.all(channels.map(async c => c.url ? { ...c, status: await checkUrlAlive(c.url) } : { ...c, status: 'not_configured' }))
  return { channels: results }
}

async function callClaude(prompt: string, anthropicKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude API (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}

// Impressão digital do dado-fonte. Se não mudou, não vale gastar token
// reprocessando — memory-first: pensa de novo só quando algo muda.
function hashData(obj: unknown): string {
  const s = JSON.stringify(obj)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + ':' + s.length.toString(36)
}

async function generateReport(company: CompanyRow, tabKey: TabKey, anthropicKey: string, context: Record<string, unknown>): Promise<{ summary: string; suggestions: string[] }> {
  const prompt = `Você é o consultor de crescimento de "${company.business_name}" (${company.business_type ?? 'negócio'}).

Área: ${TAB_LABELS[tabKey]}

Dados reais desta área:
${JSON.stringify(context)}

Escreva uma interpretação curta e direta desses dados (2-3 frases, tom de conversa, sem jargão técnico) e 2 a 4 sugestões concretas e acionáveis do que fazer a respeito. Se não houver dados suficientes, diga isso claramente e sugira o próximo passo para conseguir dados.

Retorne APENAS um JSON válido, sem markdown:
{ "summary": "...", "suggestions": ["...", "..."] }`

  const raw = await callClaude(prompt, anthropicKey)
  let parsed: { summary?: string; suggestions?: string[] } | null = null
  try { parsed = JSON.parse(raw) } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) try { parsed = JSON.parse(match[0]) } catch { /* give up */ }
  }
  if (!parsed?.summary) throw new Error('Claude não retornou um relatório válido')
  return { summary: parsed.summary, suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [] }
}

const ALL_TAB_KEYS: TabKey[] = ['avaliacoes', 'opinioes', 'concorrentes', 'crescimento', 'performance', 'audiencia', 'diagnostico']
const COMPANY_FIELDS = 'id, business_name, business_type, google_rating, google_review_count, website_url, instagram_url, facebook_url, tiktok_url, google_maps_url, tripadvisor_url, reclame_aqui_url, ifood_url, social_data'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const cronSecretEnv = Deno.env.get('CRON_SECRET')

    if (!anthropicKey) return json({ error: 'Serviço indisponível.' }, 200)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = cronSecretEnv && body.cron_secret === cronSecretEnv

    // Modo cron: atualiza os relatórios de todas as empresas ativas, uma vez
    // por semana por aba — mesma janela usada por map-competitors, pra não
    // gastar chamadas de IA à toa em dados que não mudaram muito.
    if (isCron) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await admin.from('companies').select(COMPANY_FIELDS).eq('active', true)
      let generated = 0, skipped = 0
      for (const company of (companies ?? []) as CompanyRow[]) {
        if (!(await hasPaidAccess(admin, company.id))) continue // conta vitrine: cron não gasta IA
        for (const tabKey of ALL_TAB_KEYS) {
          try {
            // Junta o dado-fonte e tira a impressão digital ANTES de chamar a IA.
            const context = await gatherContext(admin, company, tabKey)
            const dataHash = hashData(context)
            const { data: existing } = await admin.from('insights_reports').select('created_at, data_hash').eq('company_id', company.id).eq('tab_key', tabKey).maybeSingle()
            // Dado não mudou desde o último relatório → reaproveita, não gasta token.
            const unchanged = existing?.data_hash != null && existing.data_hash === dataHash
            // Linhas antigas sem hash: mantém a janela de 7 dias até re-hashear.
            const legacyFresh = existing?.created_at && existing.data_hash == null && existing.created_at > sevenDaysAgo
            if (unchanged || legacyFresh) { skipped++; continue }
            const report = await generateReport(company, tabKey, anthropicKey, context)
            await admin.from('insights_reports').upsert({ company_id: company.id, tab_key: tabKey, summary: report.summary, suggestions: report.suggestions, data_hash: dataHash, created_at: new Date().toISOString() }, { onConflict: 'company_id,tab_key' })
            generated++
          } catch (e) { console.error(`generate-tab-insight cron ${company.id}/${tabKey}:`, e) }
        }
      }
      return json({ ok: true, cron: true, generated, skipped })
    }

    // Modo interativo: usuário logado pedindo pra (re)gerar o relatório de uma aba específica.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401)

    const tabKey = body.tab_key as TabKey
    if (!ALL_TAB_KEYS.includes(tabKey)) return json({ error: 'tab_key inválido' }, 400)

    const { data: company } = await admin.from('companies').select(COMPANY_FIELDS).eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id)
    if (noPlan) return noPlan

    // Interativo: o usuário clicou em "atualizar", então geramos na hora —
    // mas já guardamos a impressão digital pra o cron não refazer à toa depois.
    const context = await gatherContext(admin, company as CompanyRow, tabKey)
    const report = await generateReport(company as CompanyRow, tabKey, anthropicKey, context)
    const { data: saved, error: saveErr } = await admin.from('insights_reports')
      .upsert({ company_id: company.id, tab_key: tabKey, summary: report.summary, suggestions: report.suggestions, data_hash: hashData(context), created_at: new Date().toISOString() }, { onConflict: 'company_id,tab_key' })
      .select('summary, suggestions, created_at').single()
    if (saveErr) throw new Error(saveErr.message)

    return json({ ok: true, report: saved })
  } catch (err) {
    console.error('generate-tab-insight error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
