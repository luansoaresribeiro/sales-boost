import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APIFY_BASE = 'https://api.apify.com/v2'

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractHandle(url: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1].replace(/\/$/, '')
  }
  return null
}

function extractInstagram(url: string) {
  return extractHandle(url, [/instagram\.com\/([^/?\s]+)/])
}

function extractTikTok(url: string) {
  return extractHandle(url, [/tiktok\.com\/@?([^/?\s]+)/])
}

function extractFacebook(url: string) {
  return extractHandle(url, [
    /facebook\.com\/pages\/[^/]+\/([^/?\s]+)/,
    /facebook\.com\/([^/?\s]+)/,
  ])
}

async function runActor(actorId: string, input: unknown, token: string, waitSecs = 90): Promise<unknown[]> {
  // Start run and wait for completion
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}&waitForFinish=${waitSecs}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  )
  if (!runRes.ok) {
    const txt = await runRes.text()
    throw new Error(`Apify run (${actorId}): ${runRes.status} — ${txt.slice(0, 200)}`)
  }
  const run = await runRes.json()
  const datasetId = run?.data?.defaultDatasetId
  if (!datasetId) throw new Error(`Apify: sem datasetId na resposta do actor ${actorId}`)

  // Fetch items
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&clean=true`,
    { method: 'GET' }
  )
  if (!itemsRes.ok) throw new Error(`Apify dataset (${datasetId}): ${itemsRes.status}`)
  return itemsRes.json()
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeInstagram(items: unknown[]): Record<string, unknown> {
  const p = items[0] as Record<string, unknown> | undefined
  if (!p) return { error: 'Sem dados retornados' }
  const posts = (p.latestPosts as unknown[] | undefined) ?? []
  const withLikes = (posts as Record<string, unknown>[]).filter(x => typeof x.likesCount === 'number')
  const avgLikes = withLikes.length
    ? Math.round(withLikes.reduce((s, x) => s + (x.likesCount as number), 0) / withLikes.length)
    : null
  const avgComments = withLikes.length
    ? Math.round((posts as Record<string, unknown>[]).reduce((s, x) => s + ((x.commentsCount as number) ?? 0), 0) / posts.length)
    : null
  const followers = (p.followersCount as number | undefined) ?? 0
  const engRate = avgLikes && followers > 0 ? parseFloat(((avgLikes / followers) * 100).toFixed(2)) : null

  // Posting frequency (days between last N posts)
  const dates = (posts as Record<string, unknown>[]).map(x => x.timestamp).filter(Boolean).slice(0, 10)
  let freqDays: number | null = null
  if (dates.length >= 2) {
    const ms = (new Date(dates[0] as string).getTime() - new Date(dates[dates.length - 1] as string).getTime())
    freqDays = parseFloat((ms / 1000 / 86400 / (dates.length - 1)).toFixed(1))
  }

  return {
    platform: 'instagram',
    username: p.username,
    full_name: p.fullName,
    bio: p.biography,
    followers: p.followersCount,
    following: p.followingCount,
    posts_count: p.postsCount,
    avg_likes: avgLikes,
    avg_comments: avgComments,
    engagement_rate: engRate,
    posting_freq_days: freqDays,
    last_post: dates[0] ?? null,
    profile_pic: p.profilePicUrl,
    scraped_at: new Date().toISOString(),
  }
}

function normalizeTikTok(items: unknown[]): Record<string, unknown> {
  const p = items[0] as Record<string, unknown> | undefined
  if (!p) return { error: 'Sem dados retornados' }

  // clockworks/free-tiktok-scraper returns profile at root or nested
  const profile = (p.authorMeta as Record<string, unknown> | undefined) ?? p
  const videos = (p.videos ?? items) as Record<string, unknown>[]

  const avgViews = videos.length
    ? Math.round(videos.reduce((s, v) => s + ((v.playCount as number) ?? (v.stats as Record<string, number> | undefined)?.playCount ?? 0), 0) / videos.length)
    : null
  const avgLikes = videos.length
    ? Math.round(videos.reduce((s, v) => s + ((v.diggCount as number) ?? (v.stats as Record<string, number> | undefined)?.diggCount ?? 0), 0) / videos.length)
    : null

  return {
    platform: 'tiktok',
    username: profile.name ?? profile.uniqueId ?? p.authorMeta,
    nickname: profile.nickName ?? profile.nickname,
    followers: profile.fans ?? profile.followerCount,
    following: profile.following ?? profile.followingCount,
    hearts: profile.heart ?? profile.heartCount,
    videos_count: profile.video ?? profile.videoCount ?? videos.length,
    avg_views: avgViews,
    avg_likes: avgLikes,
    scraped_at: new Date().toISOString(),
  }
}

function normalizeFacebook(items: unknown[]): Record<string, unknown> {
  const p = items[0] as Record<string, unknown> | undefined
  if (!p) return { error: 'Sem dados retornados' }
  return {
    platform: 'facebook',
    page_name: p.title ?? p.name,
    likes: p.likes ?? p.likesCount,
    followers: p.followers ?? p.followersCount,
    category: p.category,
    scraped_at: new Date().toISOString(),
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apifyToken = Deno.env.get('APIFY_TOKEN')
    if (!apifyToken) return json({ error: 'APIFY_TOKEN não configurado' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const serviceClient = createClient(supabaseUrl, serviceKey)

    const { data: company } = await serviceClient
      .from('companies')
      .select('id, business_type, instagram_url, tiktok_url, facebook_url')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

    const tasks: Promise<[string, Record<string, unknown>]>[] = []

    // Instagram
    if (company.instagram_url) {
      const handle = extractInstagram(company.instagram_url)
      if (handle) {
        tasks.push(
          runActor('apify/instagram-profile-scraper', { usernames: [handle] }, apifyToken, 90)
            .then(items => ['instagram', normalizeInstagram(items)])
            .catch(e => ['instagram', { error: String(e), platform: 'instagram' }])
        )
      }
    }

    // TikTok
    if (company.tiktok_url) {
      const handle = extractTikTok(company.tiktok_url)
      if (handle) {
        tasks.push(
          runActor('clockworks/free-tiktok-scraper', { profiles: [`@${handle}`], resultsPerPage: 10 }, apifyToken, 90)
            .then(items => ['tiktok', normalizeTikTok(items)])
            .catch(e => ['tiktok', { error: String(e), platform: 'tiktok' }])
        )
      }
    }

    // Facebook
    if (company.facebook_url) {
      const handle = extractFacebook(company.facebook_url)
      if (handle) {
        tasks.push(
          runActor('apify/facebook-pages-scraper', { startUrls: [{ url: company.facebook_url }] }, apifyToken, 90)
            .then(items => ['facebook', normalizeFacebook(items)])
            .catch(e => ['facebook', { error: String(e), platform: 'facebook' }])
        )
      }
    }

    if (tasks.length === 0) {
      return json({ error: 'Nenhuma rede social configurada. Adicione os links nas Configurações.' }, 400)
    }

    const results = await Promise.all(tasks)
    const socialData: Record<string, Record<string, unknown>> = {}
    for (const [platform, data] of results) {
      socialData[platform] = data
    }

    await serviceClient
      .from('companies')
      .update({ social_data: socialData, social_scraped_at: new Date().toISOString() })
      .eq('id', company.id)

    const platforms_ok = results.filter(([, d]) => !d.error).map(([p]) => p)
    const platforms_err = results.filter(([, d]) => d.error).map(([p]) => p)

    return json({
      scraped: platforms_ok,
      errors: platforms_err.length > 0 ? platforms_err : undefined,
      data: socialData,
    })

  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
