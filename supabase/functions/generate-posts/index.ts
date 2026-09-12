import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_LIMITS: Record<string, number> = {
  free: 5, basic: 15, pro: 35, ultra: 50,
}

const OWNER_EMAIL = 'luancontasecundaria22@gmail.com'

interface PostDraft {
  legenda: string; hashtags: string; image_suggestion: string
  best_time: string; platform: string; type: string; reasoning: string
}

interface ImageResult {
  post_id: string
  step: string
  error: string | null
  url: string | null
}

async function notifyMarketing(chatId: number | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ?? null, data }),
  }).catch(() => {})
}

async function buildProfile(db: ReturnType<typeof createClient>, authHeader: string, supabaseUrl: string): Promise<void> {
  await fetch(`${supabaseUrl}/functions/v1/update-company-profile`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
  })
}

async function callClaude(prompt: string, anthropicKey: string): Promise<string> {
  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 6000, messages: [{ role: 'user', content: prompt }] }),
    })
    if (res.ok) {
      const data = await res.json()
      return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
    }
    lastError = await res.text()
    const retryable = res.status >= 500 || res.status === 429
    if (!retryable || attempt === 3) throw new Error(`Claude API (${res.status}): ${lastError}`)
    await new Promise(r => setTimeout(r, attempt * 800))
  }
  throw new Error(`Claude API: ${lastError}`)
}

// Gera a imagem do post pela função central generate-image (OpenAI, com
// fallback de chave no _app_config). Antes usava Replicate (desativado).
async function generateImage(
  imageSuggestion: string,
  companyId: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey) return { url: null, error: 'SUPABASE env ausente' }
  try {
    const prompt = [
      'Professional Instagram marketing photo for a Brazilian small business.',
      'Commercial photography style, high quality, warm lighting, vibrant colors, clean composition.',
      'Absolutely NO people, NO faces, NO children in the image.',
      'Focus only on objects, props, scenery, and atmosphere that evoke:', imageSuggestion,
      'No text overlays. No logos. Square format.',
    ].join(' ')

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024', company_id: companyId }),
    })
    const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
    if (!res.ok || !data.url) return { url: null, error: data.error ?? `generate-image ${res.status}` }
    return { url: data.url, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('generateImage exception:', msg)
    return { url: null, error: msg.slice(0, 200) }
  }
}

async function countMonthlyPosts(db: ReturnType<typeof createClient>, companyId: string): Promise<number> {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { count } = await db.from('posts').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).gte('created_at', start)
  return count ?? 0
}

const PENDING_DRAFT_LIMIT = 12

async function countPendingDrafts(db: ReturnType<typeof createClient>, companyId: string): Promise<number> {
  const { count } = await db.from('posts').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('status', 'rascunho')
  return count ?? 0
}

async function runForCompany(
  db: ReturnType<typeof createClient>,
  companyId: string,
  anthropicKey: string,
  replicateKey: string | null,
  unlimited = false
): Promise<{ generated: number; quota_reached: boolean; monthly_count: number; limit: number; image_results?: ImageResult[]; sample?: string | null; pileup_blocked?: boolean }> {
  const { data: co } = await db.from('companies').select('ai_profile, plan').eq('id', companyId).single()
  if (!co?.ai_profile) throw new Error('Perfil vazio')

  const plan = (co.plan ?? 'free') as string
  const limit = unlimited ? Infinity : (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free)
  const monthlyCount = await countMonthlyPosts(db, companyId)
  const remaining = Math.max(0, limit - monthlyCount)

  if (remaining === 0) return { generated: 0, quota_reached: true, monthly_count: monthlyCount, limit }

  const pendingCount = await countPendingDrafts(db, companyId)
  if (pendingCount >= PENDING_DRAFT_LIMIT) {
    return { generated: 0, quota_reached: false, monthly_count: monthlyCount, limit, pileup_blocked: true }
  }

  const toGenerate = Math.min(4, remaining)

  const prompt = `Você é o Agente de Marketing especialista em marketing digital para pequenos negócios brasileiros.

Abaixo está o perfil completo da empresa. Use TODOS os dados disponíveis para criar conteúdo específico e personalizado — nunca genérico.

---
${co.ai_profile}
---

Crie exatamente ${toGenerate} post${toGenerate > 1 ? 's' : ''} para Instagram com legendas completas e prontas para copiar e publicar.

Retorne APENAS um array JSON válido, sem markdown:
[
  {
    "type": "educativo",
    "legenda": "legenda completa com emojis, pronta para publicar",
    "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5",
    "image_suggestion": "image description in English, ONLY objects and scenery, NO people or children",
    "best_time": "Segunda-feira às 19h",
    "platform": "instagram",
    "reasoning": "por que este post é estratégico"
  }
]
Regras: legenda pronta (sem colchetes), dados reais, tom natural, CTA alinhado, image_suggestion SEMPRE em inglês e NUNCA com pessoas.`

  let posts: PostDraft[] | undefined
  for (let attempt = 1; attempt <= 2 && !posts; attempt++) {
    const raw = await callClaude(prompt, anthropicKey)
    try { posts = JSON.parse(raw) } catch {
      const match = raw.match(/\[\s*\{[\s\S]*?\}\s*\]/)
      if (match) try { posts = JSON.parse(match[0]) } catch { /* retry */ }
    }
  }
  if (!posts || !Array.isArray(posts) || posts.length === 0) throw new Error('Claude não gerou posts')
  posts = posts.slice(0, toGenerate)

  const rows = posts.map((p: PostDraft) => ({
    company_id: companyId,
    content: `${p.legenda}\n\n${p.hashtags}`.trim(),
    image_suggestion: p.image_suggestion ?? null,
    image_url: null,
    best_time: p.best_time ?? null,
    platform: p.platform ?? 'instagram',
    status: 'rascunho',
    agent_notes: p.reasoning ?? null,
  }))

  const { data: inserted, error: insertError } = await db.from('posts').insert(rows).select('id, image_suggestion')
  if (insertError) throw new Error(`DB: ${insertError.message}`)

  const imageResults: ImageResult[] = []

  if (inserted && inserted.length > 0) {
    await Promise.allSettled(
      inserted.map(async (row: { id: string; image_suggestion: string | null }) => {
        if (!row.image_suggestion) {
          imageResults.push({ post_id: row.id, step: 'skipped', error: 'no image_suggestion', url: null })
          return
        }
        const { url, error } = await generateImage(row.image_suggestion, companyId)
        imageResults.push({ post_id: row.id, step: url ? 'done' : 'image_failed', error, url })
        if (!url) return
        const { error: updErr } = await db.from('posts').update({ image_url: url }).eq('id', row.id)
        if (updErr) console.error('update image_url:', updErr.message)
      })
    )
  }

  return { generated: rows.length, quota_reached: false, monthly_count: monthlyCount + rows.length, limit, image_results: imageResults, sample: rows[0]?.content ?? null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const replicateKey = Deno.env.get('REPLICATE_API_KEY') ?? null
    const cronSecretEnv = Deno.env.get('CRON_SECRET')

    if (!anthropicKey) return json({ error: 'Serviço indisponível.', generated: 0 }, 200)

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const isCron = cronSecretEnv && (body as Record<string, string>)?.cron_secret === cronSecretEnv

    const db = createClient(supabaseUrl, serviceKey)

    if (isCron) {
      const { data: companies } = await db.from('companies')
        .select('id, telegram_chat_id, notification_prefs')
        .not('ai_profile', 'is', null)
      let total = 0, skipped = 0
      for (const c of (companies ?? [])) {
        try {
          const { data: openOpps } = await db.from('opportunities')
            .select('type')
            .eq('company_id', c.id)
            .eq('status', 'open')
            .in('type', ['no_content', 'stale_draft'])

          const needsContent = (openOpps ?? []).some(o => o.type === 'no_content')
          const alreadyPilingUp = (openOpps ?? []).some(o => o.type === 'stale_draft')
          if (!needsContent || alreadyPilingUp) continue

          const r = await runForCompany(db, c.id, anthropicKey, replicateKey)
          total += r.generated
          if (r.quota_reached) skipped++

          if (r.generated > 0) {
            const prefs = (c.notification_prefs as Record<string, boolean> | null) ?? {}
            if (prefs.agent_actions !== false) {
              notifyMarketing(c.telegram_chat_id as number | null, c.id as string, 'AGENT_ACTION', {
                action: 'posts_created',
                count: r.generated,
                reason: 'Nenhum conteúdo havia sido publicado nos últimos 7 dias',
                sample: r.sample ?? null,
              })
            }
          }
        } catch (e) { console.error('cron company error:', e) }
      }
      return json({ generated: total, quota_reached_count: skipped })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado', generated: 0 }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Não autorizado', generated: 0 }, 401)

    const { data: company } = await db.from('companies').select('id, ai_profile, plan').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada', generated: 0 }, 404)

    if (!company.ai_profile) {
      await buildProfile(db, authHeader, supabaseUrl)
      const { data: co2 } = await db.from('companies').select('ai_profile').eq('id', company.id).single()
      if (!co2?.ai_profile) return json({ generated: 0, message: 'Perfil incompleto. Preencha as Configurações.' })
    } else {
      buildProfile(db, authHeader, supabaseUrl)
    }

    const result = await runForCompany(db, company.id, anthropicKey, replicateKey, user.email === OWNER_EMAIL)
    const message = result.pileup_blocked ? 'Você já tem muitos rascunhos esperando aprovação. Aprove ou recuse alguns antes de gerar mais.' : undefined
    return json({ ...result, images_configured: true, message })

  } catch (err) {
    console.error('top-level error:', err)
    return json({ error: friendlyError(err), generated: 0 }, 200)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function friendlyError(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  if (msg.includes('credit') || msg.includes('balance')) return 'Agente de Marketing temporariamente indisponível. Tente novamente.'
  if (msg.includes('rate') || msg.includes('429') || msg.includes('overload')) return 'Agente de Marketing muito ocupado. Tente em alguns minutos.'
  return 'Agente de Marketing não conseguiu gerar posts agora. Tente novamente.'
}
