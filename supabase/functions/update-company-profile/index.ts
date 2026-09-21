import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmt(n: number | undefined | null): string {
  if (n == null) return '?'
  return n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const db = createClient(supabaseUrl, serviceKey)

    // 1. Empresa
    const { data: co } = await db
      .from('companies')
      .select('id, business_name, business_type, city, phone, contact_email, goal, plan, website_url, instagram_url, facebook_url, tiktok_url, google_maps_url, google_place_id, google_rating, google_review_count, social_data')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!co) return json({ error: 'Empresa não encontrada' }, 404)

    // 2. Diagnóstico mais recente
    const { data: diag } = await db
      .from('diagnostics')
      .select('pagespeed_mobile, pagespeed_desktop, website_url, created_at')
      .eq('company_id', co.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const mob = diag?.pagespeed_mobile as Record<string,number> | null
    const desk = diag?.pagespeed_desktop as Record<string,number> | null

    // 3. Reviews — resumo de temas
    const { data: reviews } = await db
      .from('reviews')
      .select('sentiment, themes, rating')
      .eq('company_id', co.id)
      .limit(200)

    const revs = (reviews ?? []) as { sentiment: string|null; themes: string[]|null; rating: number|null }[]
    const themeCounts: Record<string, { pos: number; neg: number; total: number }> = {}
    for (const r of revs) {
      for (const t of r.themes ?? []) {
        if (!themeCounts[t]) themeCounts[t] = { pos: 0, neg: 0, total: 0 }
        themeCounts[t].total++
        if (r.sentiment === 'positive') themeCounts[t].pos++
        if (r.sentiment === 'negative') themeCounts[t].neg++
      }
    }
    const withRating = revs.filter(r => r.rating)
    const avgRating = withRating.length
      ? (withRating.reduce((s, r) => s + (r.rating ?? 0), 0) / withRating.length).toFixed(1)
      : null
    const positive = revs.filter(r => r.sentiment === 'positive').length
    const negative = revs.filter(r => r.sentiment === 'negative').length
    const topPos = Object.entries(themeCounts)
      .sort((a, b) => b[1].pos - a[1].pos).slice(0, 5)
      .filter(([, c]) => c.pos > 0)
    const topNeg = Object.entries(themeCounts)
      .sort((a, b) => b[1].neg - a[1].neg).slice(0, 3)
      .filter(([, c]) => c.neg > 0)

    // 4. Concorrentes
    const { data: competitors } = await db
      .from('competitors')
      .select('name, rating, review_count, distance_m, price_level')
      .eq('company_id', co.id)
      .order('distance_m', { ascending: true })
      .limit(5)

    // 5. Social data
    const sd = (co.social_data ?? {}) as Record<string, Record<string,unknown>>
    const ig = sd['instagram'] as Record<string,unknown> | undefined
    const tt = sd['tiktok']   as Record<string,unknown> | undefined
    const fb = sd['facebook'] as Record<string,unknown> | undefined

    // ---- BUILD PROFILE ----
    const now = new Date().toLocaleDateString('pt-BR')

    let profile = `# Perfil da Empresa — ${co.business_name}
> Atualizado em ${now}

## Identidade
- **Nome:** ${co.business_name}
- **Segmento:** ${co.business_type ?? 'N/A'}
- **Cidade:** ${co.city ?? 'N/A'}
- **Objetivo principal:** ${co.goal ?? 'crescimento geral'}
`

    // Site
    profile += `
## Site
- **URL:** ${co.website_url ?? 'N/A'}
`
    if (mob) {
      profile += `- **Performance mobile:** ${mob.performance ?? '?'}/100\n`
      profile += `- **SEO:** ${mob.seo ?? '?'}/100\n`
      profile += `- **Acessibilidade:** ${mob.accessibility ?? '?'}/100\n`
    } else {
      profile += `- Diagnóstico de site ainda não realizado\n`
    }
    if (desk?.performance) {
      profile += `- **Performance desktop:** ${desk.performance}/100\n`
    }

    // Google
    profile += `
## Google Meu Negócio
`
    if (co.google_place_id) {
      profile += `- **Nota:** ${co.google_rating ?? '?'}★ (${fmt(co.google_review_count)} avaliações)\n`
    } else {
      profile += `- Não vinculado ao Google\n`
    }

    // Instagram
    profile += `
## Instagram
- **URL:** ${co.instagram_url ?? 'N/A'}
`
    if (ig && !ig.error) {
      profile += `- **Seguidores:** ${fmt(ig.followers as number)}\n`
      if (ig.posts_count) profile += `- **Posts:** ${ig.posts_count}\n`
      if (ig.engagement_rate) profile += `- **Taxa de engajamento:** ${ig.engagement_rate}%${(ig.engagement_rate as number) >= 3 ? ' (acima da média)' : ' (abaixo da média — focar em Reels)'}\n`
      if (ig.posting_freq_days) profile += `- **Frequência de postagem:** a cada ${ig.posting_freq_days} dias${(ig.posting_freq_days as number) > 7 ? ' (pouca freqüência — aumentar para 3x/semana)' : ''}\n`
      if (ig.avg_likes) profile += `- **Média de curtidas:** ${fmt(ig.avg_likes as number)}\n`
      if (ig.bio) profile += `- **Bio atual:** "${ig.bio}"\n`
    } else if (co.instagram_url) {
      profile += `- Dados não analisados ainda (clique em Analisar redes sociais)\n`
    } else {
      profile += `- Não possui Instagram\n`
    }

    // TikTok
    profile += `
## TikTok
- **URL:** ${co.tiktok_url ?? 'N/A'}
`
    if (tt && !tt.error) {
      profile += `- **Seguidores:** ${fmt(tt.followers as number)}\n`
      if (tt.videos_count) profile += `- **Vídeos publicados:** ${tt.videos_count}\n`
      if (tt.avg_views) profile += `- **Média de views:** ${fmt(tt.avg_views as number)} por vídeo\n`
      if (tt.hearts) profile += `- **Total de curtidas:** ${fmt(tt.hearts as number)}\n`
    } else if (co.tiktok_url) {
      profile += `- Dados não analisados ainda\n`
    } else {
      profile += `- Não possui TikTok\n`
    }

    // Facebook
    profile += `
## Facebook
- **URL:** ${co.facebook_url ?? 'N/A'}
`
    if (fb && !fb.error) {
      profile += `- **Seguidores:** ${fmt(fb.followers as number ?? fb.likes as number)}\n`
      if (fb.category) profile += `- **Categoria:** ${fb.category}\n`
    } else if (co.facebook_url) {
      profile += `- Dados não analisados ainda\n`
    } else {
      profile += `- Não possui Facebook\n`
    }

    // Avaliações
    if (revs.length > 0) {
      profile += `
## Avaliações dos Clientes
- **Total analisado:** ${revs.length} avaliações
- **Nota média:** ${avgRating ?? co.google_rating ?? '?'}★
- **Positivas:** ${positive} | **Negativas:** ${negative}
`
      if (topPos.length > 0) {
        profile += `
### O que os clientes amam (use no marketing)
`
        for (const [t, c] of topPos) {
          profile += `- **${t}**: ${c.pos} menções positivas\n`
        }
      }
      if (topNeg.length > 0) {
        profile += `
### Principais reclamações (NÃO mencionar nos posts)
`
        for (const [t, c] of topNeg) {
          profile += `- **${t}**: ${c.neg} menções negativas\n`
        }
      }
    } else {
      profile += `
## Avaliações dos Clientes
- Nenhuma avaliação importada ainda\n`
    }

    // Concorrentes
    if ((competitors ?? []).length > 0) {
      profile += `
## Concorrentes Próximos (raio 2km)
`
      for (const c of competitors ?? []) {
        const comp = c as { name: string; rating: number|null; review_count: number; distance_m: number|null; price_level: number|null }
        const priceStr = comp.price_level ? '$'.repeat(comp.price_level) : ''
        profile += `- **${comp.name}**: ${comp.rating ?? '?'}★ (${fmt(comp.review_count)} aval.) — ${comp.distance_m ?? '?'}m${priceStr ? ` — ${priceStr}` : ''}\n`
      }
    }

    // Instruções
    profile += `
## Diretrizes para Conteúdo
- **Idioma:** Português brasileiro, tom acessível e autêntico
- **Objetivo atual:** ${co.goal ?? 'crescimento geral'}
- **Segmento:** ${co.business_type ?? 'negócio local'} em ${co.city ?? 'Brasil'}
${topPos.length > 0 ? `- **Destacar sempre:** ${topPos.slice(0,3).map(([t]) => t).join(', ')}` : ''}
${topNeg.length > 0 ? `- **Nunca mencionar diretamente:** ${topNeg.map(([t]) => t).join(', ')} (estamos melhorando)` : ''}
- Sem clichês como "Venha nos visitar!", "Qualidade garantida!", "Atendimento de excelência!"
- CTA claro em cada post alinhado ao objetivo principal
`

    const { error: updateErr } = await db
      .from('companies')
      .update({ ai_profile: profile, updated_at: new Date().toISOString() })
      .eq('id', co.id)

    if (updateErr) throw updateErr

    return json({ success: true, company_id: co.id, profile_length: profile.length })

  } catch (err) {
    console.error('update-company-profile error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
