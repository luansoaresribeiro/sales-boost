import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OnboardingData {
  business_name: string
  business_type: string
  city: string
  website_url?: string // opcional (corretores muitas vezes não têm site)
  instagram_url: string // obrigatório: o Growth Score é centrado no Instagram
  facebook_url?: string
  tiktok_url?: string
  google_maps_url?: string
  phone?: string
  contact_email: string
  goal: string
  onboarding_context?: Record<string, unknown> // entendimento do negócio (onboarding conversacional)
}

interface PagespeedResult {
  scores: { performance: number; seo: number; accessibility: number; best_practices: number }
  metrics: { lcp?: string; tbt?: string; cls?: string; fcp?: string; si?: string }
  opportunities: Array<{ id: string; value?: string }>
}

const MAX_PER_EMAIL_PER_DAY = 3
// Teto mensal de leituras do Instagram na Apify (decisão do dono 2026-10-07:
// sempre Apify, dentro do crédito grátis). Padrão 50/mês; muda pelo secret
// APIFY_IG_MONTHLY_CAP sem novo deploy. Passou do teto: Instagram "não
// avaliado" no Growth Score, sem chamar a Apify.
const APIFY_IG_MONTHLY_CAP = Number(Deno.env.get('APIFY_IG_MONTHLY_CAP') ?? '50') || 50
const APIFY_BASE = 'https://api.apify.com/v2'
const IG_WAIT_SECS = 60 // Apify limita waitForFinish a 60s; cabe nos 150s do Supabase Free
const RESERVED_IG_PATHS = new Set(['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'direct'])

// Mesmo regex do scrape-social, com validação do formato do usuário.
function extractInstagramHandle(raw: string): string | null {
  let v = raw.trim()
  if (!v) return null
  const m = v.match(/instagram\.com\/([^/?#\s]+)/i)
  v = (m ? m[1] : v).replace(/^@/, '').replace(/\/$/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(v) || RESERVED_IG_PATHS.has(v.toLowerCase())) return null
  return v.toLowerCase()
}

interface LeanPost { ts: string | null; likes: number | null; comments: number | null; is_video: boolean | null }

// Guarda só o que o Growth Score usa: nada de foto/URL de mídia pesada.
// Campos do apify/instagram-profile-scraper: followersCount, biography,
// externalUrl, isBusinessAccount, highlightReelCount, postsCount,
// latestPosts[].timestamp/likesCount/commentsCount/type/videoUrl.
function leanInstagram(items: unknown[], handle: string): Record<string, unknown> {
  const p = items[0] as Record<string, unknown> | undefined
  const collected_at = new Date().toISOString()
  if (!p || typeof p.followersCount !== 'number') return { error: 'unavailable', collected_at }
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  const posts: LeanPost[] = ((p.latestPosts as Record<string, unknown>[] | undefined) ?? []).slice(0, 12).map(x => ({
    ts: typeof x.timestamp === 'string' ? x.timestamp : null,
    likes: num(x.likesCount),
    comments: num(x.commentsCount),
    is_video: typeof x.type === 'string' ? x.type === 'Video' : (x.videoUrl ? true : null),
  }))
  return {
    collected_at,
    username: typeof p.username === 'string' ? p.username : handle,
    followers: p.followersCount,
    biography: typeof p.biography === 'string' ? p.biography.slice(0, 300) : null,
    external_url: typeof p.externalUrl === 'string' && p.externalUrl ? p.externalUrl : null,
    is_business: typeof p.isBusinessAccount === 'boolean' ? p.isBusinessAccount : null,
    highlights: num(p.highlightReelCount),
    posts_total: num(p.postsCount),
    posts,
  }
}

// Coleta com espera limitada. Falha/timeout NUNCA derruba o diagnóstico:
// grava { error:'unavailable' } e o Growth Score sai parcial.
// Reusa coleta recente (24h) do mesmo @ — no máximo 1 coleta por handle/dia.
// deno-lint-ignore no-explicit-any
async function collectInstagram(supabase: any, handle: string, igUrl: string, token: string, since: string): Promise<Record<string, unknown>> {
  const unavailable = () => ({ error: 'unavailable', collected_at: new Date().toISOString() })
  try {
    const { data: recent } = await supabase
      .from('diagnostics')
      .select('instagram_data')
      .eq('instagram_url', igUrl)
      .not('instagram_data', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5)
    const hit = (recent ?? []).find((r: { instagram_data?: { error?: string } }) => r.instagram_data && !r.instagram_data.error)
    if (hit) return hit.instagram_data

    // Se a última tentativa de hoje falhou, não paga outra: respeita 1 coleta/handle/dia
    if ((recent ?? []).length > 0) return unavailable()
    if (!token) return unavailable()

    // Teto mensal: cada tentativa paga grava `apify_run` no instagram_data;
    // cópias reaproveitadas (cache 24h) repetem o mesmo id e não contam 2x.
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    const { data: monthRows } = await supabase
      .from('diagnostics')
      .select('instagram_data')
      .gte('created_at', monthStart.toISOString())
      .not('instagram_data', 'is', null)
      .limit(2000)
    const runs = new Set((monthRows ?? []).map((r: { instagram_data?: { apify_run?: string } }) => r.instagram_data?.apify_run).filter(Boolean))
    if (runs.size >= APIFY_IG_MONTHLY_CAP) {
      console.log('[run-diagnosis] teto mensal da Apify atingido', runs.size, '/', APIFY_IG_MONTHLY_CAP)
      return { error: 'monthly_cap', collected_at: new Date().toISOString() }
    }

    const res = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent('apify/instagram-profile-scraper')}/runs?token=${token}&waitForFinish=${IG_WAIT_SECS}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [handle] }), signal: AbortSignal.timeout((IG_WAIT_SECS + 15) * 1000) },
    )
    if (!res.ok) { console.log('[run-diagnosis] apify ig http', res.status); return unavailable() }
    const run = await res.json()
    const apify_run = run?.data?.id as string | undefined
    if (run?.data?.status !== 'SUCCEEDED' || !run?.data?.defaultDatasetId) {
      // ainda rodando depois da espera: aborta pra não gastar à toa
      if (apify_run) fetch(`${APIFY_BASE}/actor-runs/${apify_run}/abort?token=${token}`, { method: 'POST' }).catch(() => {})
      console.log('[run-diagnosis] apify ig status', run?.data?.status)
      return { ...unavailable(), apify_run }
    }
    const itemsRes = await fetch(`${APIFY_BASE}/datasets/${run.data.defaultDatasetId}/items?token=${token}&clean=true`, { signal: AbortSignal.timeout(20_000) })
    if (!itemsRes.ok) return { ...unavailable(), apify_run }
    const lean = { ...leanInstagram(await itemsRes.json(), handle), apify_run }
    // Registro de custo: não há tabela de uso padrão pra Apify nas functions; fica no log.
    console.log('[run-diagnosis] instagram coletado', handle, lean.error ?? 'ok', 'apify_run', run.data.id)
    return lean
  } catch (e) {
    console.log('[run-diagnosis] instagram falhou', String(e))
    return unavailable()
  }
}

const PERSONAL_PROFILE_NAME = 'Perfil pessoal'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok', 200)

  try {
    const data: OnboardingData = await req.json()

    if (!data.contact_email?.trim()) {
      return json({ error: 'Campos obrigatórios: contact_email, instagram_url' }, 400)
    }
    // Nome da empresa é opcional (decisão do dono 2026-10-09): sem nome, o
    // perfil é "pessoal" — só um rótulo pra organizar, nada muda no produto.
    const businessName = (data.business_name ?? '').trim().slice(0, 120) || PERSONAL_PROFILE_NAME

    // Instagram obrigatório no formulário novo (aceita @usuario ou link).
    // Compatibilidade: o formulário antigo (ainda no ar até o merge) manda
    // site obrigatório e Instagram opcional — se vier só o site, aceita e o
    // Instagram fica "não avaliado".
    const igRaw = (data.instagram_url ?? '').trim()
    const igHandle = extractInstagramHandle(igRaw)
    if (!igHandle && (igRaw || !(data.website_url ?? '').trim())) {
      return json({ error: 'Informe o Instagram do negócio (ex: @seuperfil ou instagram.com/seuperfil).' }, 400)
    }
    const igUrl = igHandle ? `https://instagram.com/${igHandle}` : null

    // Site opcional: só normaliza/valida se veio preenchido
    let websiteUrl = (data.website_url ?? '').trim()
    if (websiteUrl) {
      if (!websiteUrl.startsWith('http')) websiteUrl = `https://${websiteUrl}`
      try { if (!new URL(websiteUrl).hostname.includes('.')) throw new Error('x') } catch {
        return json({ error: 'O endereço do site parece inválido. Deixe em branco se não tiver site.' }, 400)
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pagespeedKey = Deno.env.get('PAGESPEED_API_KEY') ?? ''
    const apifyToken = Deno.env.get('APIFY_TOKEN') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const email = data.contact_email.trim()

    // Proteção de custo/abuso: no máximo 3 diagnósticos por e-mail por dia
    const { count: todayCount } = await supabase
      .from('diagnostics')
      .select('id', { count: 'exact', head: true })
      .ilike('contact_email', email.replace(/[\\%_]/g, '\\$&'))
      .gte('created_at', since)
    if ((todayCount ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
      return json({ error: 'Você já fez 3 diagnósticos hoje. Tente de novo amanhã.' }, 429)
    }

    // 1. Create diagnostics row immediately
    const { data: row, error: insertErr } = await supabase
      .from('diagnostics')
      .insert({
        business_name: businessName,
        business_type: data.business_type,
        city: data.city,
        website_url: websiteUrl, // '' quando não tem site
        instagram_url: igUrl,
        facebook_url: data.facebook_url || null,
        tiktok_url: data.tiktok_url || null,
        google_maps_url: data.google_maps_url || null,
        phone: data.phone || null,
        contact_email: data.contact_email.trim(),
        goal: data.goal,
        onboarding_context: data.onboarding_context ?? null,
        status: 'processing',
      })
      .select('id')
      .single()

    if (insertErr || !row) return json({ error: insertErr?.message ?? 'Erro ao criar diagnóstico' }, 500)

    const diagnosticId = row.id

    // 1b. Diagnóstico v2: a busca de concorrentes começa JÁ, em paralelo com a
    // leitura do Instagram (antes esperava a página abrir — ~30-60 s a mais).
    // A diagnosis-market responde na hora e continua sozinha; se falhar, a
    // página do diagnóstico toca a análise do mesmo jeito.
    fetch(`${supabaseUrl}/functions/v1/diagnosis-market`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ diagnostic_id: diagnosticId, drive: true }),
      signal: AbortSignal.timeout(10_000),
    }).catch(e => console.log('[run-diagnosis] diagnosis-market não disparou', String(e)))

    // 2. PageSpeed (só se houver site) e coleta do Instagram, em paralelo
    const categories = ['PERFORMANCE', 'SEO', 'ACCESSIBILITY', 'BEST_PRACTICES']
      .map(c => `category=${c}`)
      .join('&')
    const keyParam = pagespeedKey ? `&key=${pagespeedKey}` : ''
    const psBase = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(websiteUrl)}&${categories}${keyParam}`
    const psFetch = (strategy: string): Promise<Response> =>
      fetch(`${psBase}&strategy=${strategy}`, { signal: AbortSignal.timeout(70_000) })
    const skipped = Promise.reject(new Error('sem site'))
    skipped.catch(() => {})

    const igPromise = igHandle && igUrl
      ? collectInstagram(supabase, igHandle, igUrl, apifyToken, since)
      : Promise.resolve({ error: 'not_provided', collected_at: new Date().toISOString() })

    const [mobileRes, desktopRes] = await Promise.allSettled([
      websiteUrl ? psFetch('mobile') : skipped,
      websiteUrl ? psFetch('desktop') : skipped,
    ])

    const parsePagespeed = async (res: PromiseSettledResult<Response>): Promise<PagespeedResult | null> => {
      if (res.status !== 'fulfilled' || !res.value.ok) return null
      try {
        const raw = await res.value.json()
        const lr = raw?.lighthouseResult ?? {}
        const cats = lr?.categories ?? {}
        const audits = lr?.audits ?? {}

        const score = (key: string) => Math.round((cats[key]?.score ?? 0) * 100)
        const metric = (key: string) => audits[key]?.displayValue as string | undefined

        const opportunities = Object.entries(audits as Record<string, { score?: number; displayValue?: string; title?: string }>)
          .filter(([, v]) => typeof v.score === 'number' && v.score < 0.9 && v.displayValue)
          .slice(0, 6)
          .map(([k, v]) => ({ id: k, value: v.displayValue }))

        return {
          scores: {
            performance: score('performance'),
            seo: score('seo'),
            accessibility: score('accessibility'),
            best_practices: score('best-practices'),
          },
          metrics: {
            lcp: metric('largest-contentful-paint'),
            tbt: metric('total-blocking-time'),
            cls: metric('cumulative-layout-shift'),
            fcp: metric('first-contentful-paint'),
            si: metric('speed-index'),
          },
          opportunities,
        }
      } catch {
        return null
      }
    }

    const [pagespeedMobile, pagespeedDesktop, instagramData] = await Promise.all([
      parsePagespeed(mobileRes),
      parsePagespeed(desktopRes),
      igPromise,
    ])

    // 3. Fire Apify actors async (just kick off, don't wait for results)
    const apifyRunIds: Record<string, string> = {}

    if (apifyToken) {
      const fireApify = async (actor: string, input: Record<string, unknown>, key: string) => {
        try {
          const r = await fetch(
            `https://api.apify.com/v2/acts/${actor}/runs?token=${apifyToken}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
          )
          if (r.ok) {
            const body = await r.json()
            if (body?.data?.id) apifyRunIds[key] = body.data.id
          }
        } catch { /* silent */ }
      }

      await Promise.all([
        websiteUrl
          ? fireApify('apify~website-content-crawler', { startUrls: [{ url: websiteUrl }], maxCrawlPages: 5 }, 'website')
          : Promise.resolve(),
        data.google_maps_url
          ? fireApify('compass~google-maps-reviews-scraper', { startUrls: [{ url: data.google_maps_url }], maxReviews: 20 }, 'google_maps')
          : Promise.resolve(),
      ])
    }

    // 4. Update row with results
    const hasPagespeed = !!(pagespeedMobile || pagespeedDesktop)
    const hasInstagram = !instagramData.error
    const finalStatus = hasPagespeed || hasInstagram ? 'complete' : 'partial'
    await supabase
      .from('diagnostics')
      .update({
        pagespeed_mobile: pagespeedMobile,
        pagespeed_desktop: pagespeedDesktop,
        apify_run_ids: apifyRunIds,
        instagram_data: instagramData,
        status: finalStatus,
      })
      .eq('id', diagnosticId)

    return json({ id: diagnosticId, status: finalStatus })

  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
