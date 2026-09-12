import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

interface ContentRow { id: string; company_id: string; idea: string | null; caption: string | null; image_url: string | null }
interface Company { id: string; user_id: string; business_type: string | null; business_description: string | null }

// Monta o prompt visual a partir da ideia do post + o que o negócio
// realmente faz (onboarding — sempre real, não depende do Marketing AI
// estar configurado).
function imagePrompt(content: ContentRow, businessType: string | null, businessDescription: string | null): string {
  const evoke = [content.idea, content.caption].filter(Boolean).join('. ').slice(0, 600) || 'foto do negócio'
  return `Professional social media photo for a Brazilian small business${businessDescription ? ` (${businessDescription})` : businessType ? ` (${businessType})` : ''}. Commercial photography, warm natural lighting, polished and inviting, no text, no logos, no watermark. The photo must clearly and specifically depict this exact post concept, not a generic stock photo: ${evoke}`
}

// Chama a generate-image (OpenAI) com a service key. Devolve URLs.
async function genImages(supabaseUrl: string, serviceKey: string, prompt: string, n: number, companyId: string): Promise<string[]> {
  const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, n, size: '1024x1024', company_id: companyId }),
  })
  const data = await res.json().catch(() => ({})) as { urls?: string[]; url?: string; error?: string }
  if (!res.ok || data.error) throw new Error(data.error ?? `generate-image ${res.status}`)
  return data.urls ?? (data.url ? [data.url] : [])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const admin = createClient(supabaseUrl, serviceKey)

    const cronSecret = Deno.env.get('CRON_SECRET')
    const bearer = req.headers.get('Authorization') ?? ''
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isService = serviceKey && bearer === `Bearer ${serviceKey}`
    const isCron = cronSecret && body.cron_secret === cronSecret
    const trusted = isService || isCron

    let user: { id: string; email?: string } | null = null
    if (!trusted) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
      user = (await userClient.auth.getUser()).data.user
      if (!user) return json({ error: 'Unauthorized' }, 401)
    }

    const action = String(body.action ?? '')
    const contentId = String(body.content_id ?? '')
    if (!contentId) return json({ error: 'content_id obrigatório' }, 400)

    const { data: contentRow } = await admin.from('marketing_ai_content').select('id, company_id, idea, caption, image_url').eq('id', contentId).maybeSingle()
    const content = contentRow as ContentRow | null
    if (!content) return json({ error: 'Conteúdo não encontrado' }, 404)

    // Autorização: o dono do negócio (user_id da empresa) ou um owner da plataforma.
    const { data: companyRow } = await admin.from('companies').select('id, user_id, business_type, business_description').eq('id', content.company_id).maybeSingle()
    const company = companyRow as Company | null
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    if (!trusted && company.user_id !== user!.id) {
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('email', user!.email ?? '').maybeSingle()
      if ((roleRow as { role?: string } | null)?.role !== 'owner') return json({ error: 'Forbidden' }, 403)
    }

    if (action === 'select') {
      const url = String(body.url ?? '')
      if (!url) return json({ error: 'url obrigatório' }, 400)
      await admin.from('marketing_ai_content').update({ image_url: url, image_options: null, updated_at: new Date().toISOString() }).eq('id', contentId)
      return json({ ok: true, image_url: url })
    }

    const prompt = imagePrompt(content, company.business_type, company.business_description)

    if (action === 'generate') {
      const [url] = await genImages(supabaseUrl, serviceKey, prompt, 1, company.id)
      if (!url) return json({ error: 'Nenhuma imagem gerada' }, 502)
      await admin.from('marketing_ai_content').update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', contentId)
      return json({ ok: true, image_url: url })
    }

    if (action === 'variations') {
      const n = Math.max(2, Math.min(4, Number(body.n) || 3))
      const urls = await genImages(supabaseUrl, serviceKey, prompt, n, company.id)
      if (urls.length === 0) return json({ error: 'Nenhuma variação gerada' }, 502)
      await admin.from('marketing_ai_content').update({ image_options: urls, updated_at: new Date().toISOString() }).eq('id', contentId)
      return json({ ok: true, options: urls })
    }

    return json({ error: 'action inválida. Use generate, variations ou select.' }, 400)
  } catch (err) {
    console.error('content-image error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
