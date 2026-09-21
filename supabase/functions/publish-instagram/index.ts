/**
 * publish-instagram — publica no Instagram via Instagram Business Login.
 * O token e da propria conta do Instagram, entao as chamadas de midia vao para
 * graph.instagram.com (nao graph.facebook.com / Pagina).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IG_API = 'https://graph.instagram.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const { company_id, caption: providedCaption, image_prompt: providedPrompt, auto_generate } = body
    if (!company_id) return json({ error: 'company_id is required' }, 400)

    const { data: company, error: compErr } = await admin
      .from('companies')
      .select('id, business_name, business_type, city, goal, instagram_user_id, instagram_access_token, instagram_token_expires_at, instagram_auto_post, instagram_post_style')
      .eq('id', company_id)
      .single()

    if (compErr || !company) return json({ error: 'Company not found' }, 404)
    if (!company.instagram_user_id || !company.instagram_access_token) {
      return json({ error: 'Instagram not connected. Go to Integrations to connect.' }, 400)
    }

    if (company.instagram_token_expires_at) {
      const expiresAt = new Date(company.instagram_token_expires_at)
      const daysLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      if (daysLeft < 0) return json({ error: 'Instagram token expired. Reconnect in Integrations.' }, 401)
      if (daysLeft < 7) await refreshToken(company.id, company.instagram_access_token, admin)
    }

    let caption = providedCaption
    let imagePrompt = providedPrompt

    if (auto_generate || !caption) {
      const generated = await generateContent(company, admin)
      caption = caption ?? generated.caption
      imagePrompt = imagePrompt ?? generated.imagePrompt

      if (generated.reasoning) {
        await admin.from('agent_messages').insert({
          company_id: company.id,
          role: 'assistant',
          agent_role: 'cmo',
          content: `[Agente de Marketing - Raciocinio] ${generated.reasoning}`,
        })
      }
    }

    const imageUrl = await getImageUrl(imagePrompt ?? `${company.business_type ?? 'business'} ${company.business_name}`)

    const mediaId = await createMediaContainer(company.instagram_user_id, company.instagram_access_token, imageUrl, caption)
    await publishMedia(company.instagram_user_id, company.instagram_access_token, mediaId)

    await admin.from('instagram_posts').insert({
      company_id: company.id,
      instagram_media_id: mediaId,
      caption,
      image_url: imageUrl,
      status: 'published',
      posted_at: new Date().toISOString(),
    })

    await admin.from('agent_messages').insert({
      company_id: company.id,
      role: 'assistant',
      agent_role: 'cmo',
      content: `[Publicado automaticamente no Instagram] ${caption.slice(0, 120)}...`,
    })

    return json({ ok: true, media_id: mediaId, caption, image_url: imageUrl })
  } catch (err) {
    console.error('publish-instagram error:', err)
    return json({ error: String(err) }, 500)
  }
})

async function generateContent(company, admin) {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const companyId = company.id
  const name = company.business_name
  const type = company.business_type ?? 'negocio'
  const city = company.city ?? 'Brasil'
  const goal = company.goal ?? 'crescer'

  const [reviewsRes, postsRes, messagesRes] = await Promise.all([
    admin.from('reviews').select('rating, text, review_date, sentiment').eq('company_id', companyId).order('review_date', { ascending: false }).limit(8),
    admin.from('instagram_posts').select('caption, posted_at, likes_count').eq('company_id', companyId).order('posted_at', { ascending: false }).limit(5),
    admin.from('agent_messages').select('content').eq('company_id', companyId).eq('agent_role', 'cmo').order('created_at', { ascending: false }).limit(3),
  ])

  const reviews = reviewsRes.data ?? []
  const pastPosts = postsRes.data ?? []
  const pastReasoning = messagesRes.data ?? []

  const today = new Date()
  const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const month = today.getMonth() + 1

  const seasonHints = {
    1: 'Janeiro: verao, festas de inicio de ano',
    2: 'Fevereiro: Carnaval, calor',
    3: 'Marco: pos-Carnaval, outono, Dia da Mulher (8/3)',
    4: 'Abril: Pascoa, Tiradentes',
    5: 'Maio: Dia das Maes, Dia do Trabalho (1/5)',
    6: 'Junho: Festas Juninas, Sao Joao, inverno',
    7: 'Julho: ferias escolares, inverno',
    8: 'Agosto: Dia dos Pais',
    9: 'Setembro: Independencia (7/9), primavera',
    10: 'Outubro: Outubro Rosa, Halloween, Dia das Criancas (12/10)',
    11: 'Novembro: Black Friday, Finados',
    12: 'Dezembro: Natal, Reveillon, alta temporada',
  }

  const reviewSummary = reviews.length > 0
    ? reviews.map(r => `[${r.rating}] "${r.text?.slice(0, 100) ?? ''}"`).join('\n')
    : 'Nenhuma avaliacao recente.'

  const postHistory = pastPosts.length > 0
    ? pastPosts.map(p => `- "${p.caption?.slice(0, 80) ?? ''}" (${p.posted_at?.split('T')[0] ?? ''})`).join('\n')
    : 'Nenhum post anterior.'

  const previousReasoning = pastReasoning.length > 0 ? pastReasoning.map(m => m.content).join('\n').slice(0, 400) : ''

  const systemPrompt = `Voce e o Agente de Marketing autonomo do ${name} (${type} em ${city}). Objetivo: ${goal}. Voce analisa o contexto real antes de criar conteudo.`

  const userPrompt = `# Dia: ${dateStr}\n${seasonHints[month] ?? ''}\n\n# Avaliacoes:\n${reviewSummary}\n\n# Ultimos posts:\n${postHistory}\n\n${previousReasoning ? `# Raciocinio anterior:\n${previousReasoning}\n` : ''}\n# Tarefa: decida o post mais estrategico para HOJE.\nResponda em JSON valido:\n{\n  "reasoning": "2-3 frases",\n  "caption": "legenda com emojis e hashtags (max 2200)",\n  "image_prompt": "descricao em ingles para imagem fotorrealista"\n}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  })

  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  const text = data.content?.[0]?.text ?? '{}'
  const match = text.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(match ? match[0] : text)

  return { caption: parsed.caption ?? '', imagePrompt: parsed.image_prompt ?? type, reasoning: parsed.reasoning ?? '' }
}

async function getImageUrl(prompt) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard' }),
      })
      if (res.ok) { const d = await res.json(); return d.data[0].url }
    } catch { /* fall through */ }
  }

  const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY')
  if (unsplashKey) {
    const query = prompt.split(' ').slice(0, 4).join('+')
    const res = await fetch(`https://api.unsplash.com/photos/random?query=${query}&orientation=squarish&content_filter=high`, {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
    })
    if (res.ok) { const d = await res.json(); return d.urls.regular }
  }

  throw new Error('No image source configured. Add OPENAI_API_KEY or UNSPLASH_ACCESS_KEY.')
}

async function createMediaContainer(igUserId, token, imageUrl, caption) {
  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Instagram media container failed: ${err.error?.message ?? JSON.stringify(err)}`)
  }
  const d = await res.json()
  return d.id
}

async function publishMedia(igUserId, token, creationId) {
  const res = await fetch(`${IG_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Instagram publish failed: ${err.error?.message ?? JSON.stringify(err)}`)
  }
}

async function refreshToken(companyId, currentToken, admin) {
  try {
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`)
    if (!res.ok) return
    const { access_token, expires_in } = await res.json()
    const expiresAt = new Date(Date.now() + (expires_in ?? 5184000) * 1000).toISOString()
    await admin.from('companies').update({ instagram_access_token: access_token, instagram_token_expires_at: expiresAt }).eq('id', companyId)
  } catch { /* silent */ }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
