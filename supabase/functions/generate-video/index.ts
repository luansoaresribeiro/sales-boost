/**
 * generate-video — gera um vídeo (Reel) pro post de teste via fal.ai.
 *
 * Usa a imagem já gerada do post como base (image-to-video). A chave do fal.ai
 * vem de FAL_KEY (secret) ou de _app_config('fal_api_key'). O modelo é
 * configurável (body.model ou FAL_VIDEO_MODEL); padrão: LTX (rápido).
 * Salva o video_url no post. Nada publica sozinho — é pra teste/QC.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requirePaidAccess } from '../_shared/access.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    let falKey = Deno.env.get('FAL_KEY') ?? Deno.env.get('FAL_API_KEY')
    if (!falKey) {
      const { data } = await admin.from('_app_config').select('value').eq('key', 'fal_api_key').maybeSingle()
      falKey = (data as { value?: string } | null)?.value
    }
    if (!falKey) return json({ error: 'A chave do fal.ai ainda não foi configurada (FAL_KEY).' }, 200)

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: companyRow } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
    const company = companyRow as { id: string } | null
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id)
    if (noPlan) return noPlan

    const contentId = String(body.content_id ?? '')
    if (!contentId) return json({ error: 'content_id é obrigatório' }, 400)
    const { data: row } = await admin.from('marketing_ai_test_content')
      .select('id, idea, caption, image_url').eq('id', contentId).eq('company_id', company.id).maybeSingle()
    const post = row as { id: string; idea: string | null; caption: string | null; image_url: string | null } | null
    if (!post) return json({ error: 'Post de teste não encontrado' }, 404)

    const model = String(body.model ?? Deno.env.get('FAL_VIDEO_MODEL') ?? 'fal-ai/ltx-video/image-to-video')
    const prompt = (post.idea ?? post.caption ?? 'social media reel').slice(0, 500)
    const input: Record<string, unknown> = { prompt }
    if (post.image_url) input.image_url = post.image_url

    // 1) Submete o job na fila do fal.
    const sub = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST', headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const subData = await sub.json().catch(() => ({})) as { status_url?: string; response_url?: string }
    if (!sub.ok || !subData.status_url) return json({ error: `fal submit ${sub.status}: ${JSON.stringify(subData).slice(0, 200)}` }, 502)

    // 2) Aguarda concluir (poll ~108s no máximo — vídeo é mais lento que imagem).
    let done = false
    for (let i = 0; i < 36; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const st = await fetch(subData.status_url, { headers: { Authorization: `Key ${falKey}` } })
      const sd = await st.json().catch(() => ({})) as { status?: string }
      if (sd.status === 'COMPLETED') { done = true; break }
      if (sd.status && sd.status !== 'IN_QUEUE' && sd.status !== 'IN_PROGRESS') break
    }
    if (!done) return json({ error: 'O vídeo demorou mais que o esperado. Tente de novo em instantes.' }, 202)

    // 3) Pega o resultado.
    const resR = await fetch(subData.response_url ?? subData.status_url, { headers: { Authorization: `Key ${falKey}` } })
    const out = await resR.json().catch(() => ({})) as Record<string, unknown>
    const video = out.video as { url?: string } | undefined
    const videos = out.videos as { url?: string }[] | undefined
    const videoUrl = video?.url ?? (out.video_url as string | undefined) ?? (videos?.[0]?.url)
    if (!videoUrl) return json({ error: `fal não retornou URL de vídeo: ${JSON.stringify(out).slice(0, 200)}` }, 502)

    await admin.from('marketing_ai_test_content').update({ video_url: videoUrl }).eq('id', contentId)
    return json({ ok: true, video_url: videoUrl })
  } catch (err) {
    console.error('generate-video error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
