import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

// Gera imagem com a OpenAI (gpt-image-1; fallback pra dall-e-3 se a conta não
// estiver verificada pro gpt-image-1) e devolve os bytes PNG. Função central:
// generate-posts, marketing-ai, Stories/Campanhas chamam esta.
function b64ToBytes(b64: string): Uint8Array { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }

async function callOpenAI(apiKey: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new Error(`${payload.model} ${res.status}: ${JSON.stringify(data).slice(0, 220)}`)
  return data
}

// Gera `n` imagens (1..4) numa única chamada. gpt-image-1 devolve n imagens
// em base64; se ele falhar, cai pro dall-e-3 (que só faz 1 por vez).
async function openaiImages(apiKey: string, prompt: string, size: string, n: number): Promise<{ images: Uint8Array[]; model: string }> {
  // 1) gpt-image-1 — devolve base64.
  try {
    const d = await callOpenAI(apiKey, { model: 'gpt-image-1', prompt, size, n, quality: 'medium' })
    const arr = (d.data as { b64_json?: string }[] | undefined) ?? []
    const images = arr.map(x => x.b64_json).filter((b): b is string => !!b).map(b64ToBytes)
    if (images.length === 0) throw new Error('gpt-image-1 sem b64')
    return { images, model: 'gpt-image-1' }
  } catch (e1) {
    // 2) dall-e-3 — devolve URL (sem response_format); só n=1.
    const dsize = size === '1024x1536' ? '1024x1792' : size === '1536x1024' ? '1792x1024' : '1024x1024'
    let d: Record<string, unknown>
    try { d = await callOpenAI(apiKey, { model: 'dall-e-3', prompt, size: dsize, n: 1 }) }
    catch (e2) { throw new Error(`gpt-image-1: ${e1 instanceof Error ? e1.message : e1} | dall-e-3: ${e2 instanceof Error ? e2.message : e2}`) }
    const url = (d.data as { url?: string }[] | undefined)?.[0]?.url
    if (!url) throw new Error('dall-e-3 sem url')
    const img = await fetch(url)
    return { images: [new Uint8Array(await img.arrayBuffer())], model: 'dall-e-3' }
  }
}

async function upload(admin: SupaClient, bytes: Uint8Array): Promise<string> {
  const path = `generated/${crypto.randomUUID()}.png`
  const { error } = await admin.storage.from('post-images').upload(path, bytes, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(`storage: ${error.message}`)
  const { data } = admin.storage.from('post-images').getPublicUrl(path)
  return data.publicUrl
}

// Hash determinístico do prompt+tamanho — mesma empresa + mesmo pedido exato
// = mesma imagem, sem pagar a OpenAI de novo. Nunca cacheia entre empresas
// diferentes (o prompt já carrega contexto da empresa, mas isolar por
// company_id evita qualquer chance de imagem de um negócio vazar pro outro).
async function cacheKeyFor(prompt: string, size: string): Promise<string> {
  const data = new TextEncoder().encode(`${prompt}|${size}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Estimativa — a OpenAI cobra gpt-image-1/dall-e-3 por token de saída (varia
// com tamanho/qualidade), não um preço fixo por imagem publicado. Ajuste este
// número aqui se a fatura real mostrar outro valor médio; é o único lugar que
// precisa mudar. Mesmo padrão de "estimativa clara" já usado pro custo de
// texto (ESTIMATED_COST_PER_1K_TOKENS, no hermes-proxy).
const ESTIMATED_COST_PER_IMAGE_USD: Record<string, number> = { 'gpt-image-1': 0.04, 'dall-e-3': 0.04 }

async function logImageCost(admin: SupaClient, companyId: string, model: string, latencyMs: number) {
  try {
    await admin.from('agent_performance').insert({
      company_id: companyId, agent_role: 'imagem', task_key: 'image_generation',
      task_description: `Geração de imagem (${model})`, success: true, latency_ms: Math.round(latencyMs),
      cost_usd: ESTIMATED_COST_PER_IMAGE_USD[model] ?? 0.04,
    })
  } catch { /* nunca derruba a geração por causa do log de custo */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const env = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'), ANON: Deno.env.get('SUPABASE_ANON_KEY'),
      SERVICE: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
      CRON_SECRET: Deno.env.get('CRON_SECRET'),
    }
    const admin = createClient(env.SUPABASE_URL!, env.SERVICE ?? env.ANON!)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    const bearer = req.headers.get('Authorization') ?? ''
    const isCron = env.CRON_SECRET && body.cron_secret === env.CRON_SECRET
    const isService = env.SERVICE && bearer === `Bearer ${env.SERVICE}`
    if (!isCron && !isService) {
      const userClient = createClient(env.SUPABASE_URL!, env.ANON!, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user.email ?? '').maybeSingle()
      if ((roleRow as { role?: string } | null)?.role !== 'owner') return json({ error: 'Forbidden' }, 403)
    }

    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) return json({ error: 'prompt obrigatório' }, 400)
    const size = ['1024x1024', '1024x1536', '1536x1024'].includes(String(body.size)) ? String(body.size) : '1024x1024'
    const n = Math.max(1, Math.min(4, Number(body.n) || 1))
    // company_id é opcional (compat com qualquer chamador antigo que ainda não
    // o envie), mas sem ele não dá pra cachear nem contar custo por empresa —
    // esses dois recursos só entram em ação quando informado.
    const companyId = body.company_id ? String(body.company_id) : null

    // Cache: mesmo pedido exato (mesma empresa) já gerado antes → reusa sem
    // chamar a OpenAI de novo. Só pra n=1 (o caso de todo chamador hoje) — um
    // lote de várias imagens não tem um "match" único pra cachear. force_new
    // pula a LEITURA do cache (mas ainda grava o resultado, substituindo a
    // entrada antiga) — usado quando o pedido é EXPLICITAMENTE "quero uma
    // imagem diferente pro mesmo texto" (ex: regenerar por nota baixa no QC),
    // onde devolver a mesma imagem de novo seria o oposto do pedido.
    const forceNew = body.force_new === true
    let cacheKey: string | null = null
    if (companyId && n === 1) {
      cacheKey = await cacheKeyFor(prompt, size)
      if (!forceNew) {
        const { data: cached } = await admin.from('generated_images')
          .select('id, image_url, model, reused_count').eq('company_id', companyId).eq('cache_key', cacheKey).maybeSingle()
        if (cached) {
          await admin.from('generated_images').update({ reused_count: (cached.reused_count ?? 0) + 1, last_used_at: new Date().toISOString() }).eq('id', cached.id)
          return json({ ok: true, url: cached.image_url, urls: [cached.image_url], model: cached.model, cached: true })
        }
      }
    }

    let apiKey = env.OPENAI_API_KEY
    if (!apiKey) {
      const { data: cfg } = await admin.from('_app_config').select('value').eq('key', 'openai_api_key').maybeSingle()
      apiKey = cfg?.value ? String(cfg.value) : undefined
    }
    if (!apiKey) return json({ error: 'OPENAI_API_KEY não configurada' }, 200)

    const genStart = Date.now()
    const { images, model } = await openaiImages(apiKey, prompt, size, n)
    const urls = await Promise.all(images.map(b => upload(admin, b)))

    if (companyId) {
      await logImageCost(admin, companyId, model, Date.now() - genStart)
      if (cacheKey) {
        try {
          await admin.from('generated_images').upsert(
            { company_id: companyId, cache_key: cacheKey, prompt, image_url: urls[0], model, reused_count: 0, last_used_at: new Date().toISOString() },
            { onConflict: 'company_id,cache_key' },
          )
        } catch { /* cache é bônus, nunca falha a geração */ }
      }
    }

    return json({ ok: true, url: urls[0], urls, model })
  } catch (err) {
    console.error('generate-image error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
