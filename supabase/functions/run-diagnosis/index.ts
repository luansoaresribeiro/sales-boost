import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OnboardingData {
  business_name: string
  business_type: string
  city: string
  website_url: string
  instagram_url?: string
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok', 200)

  try {
    const data: OnboardingData = await req.json()

    if (!data.business_name?.trim() || !data.website_url?.trim() || !data.contact_email?.trim()) {
      return json({ error: 'Campos obrigatórios: business_name, website_url, contact_email' }, 400)
    }

    // Normalise website URL
    let websiteUrl = data.website_url.trim()
    if (!websiteUrl.startsWith('http')) websiteUrl = `https://${websiteUrl}`

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pagespeedKey = Deno.env.get('PAGESPEED_API_KEY') ?? ''
    const apifyToken = Deno.env.get('APIFY_TOKEN') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Create diagnostics row immediately
    const { data: row, error: insertErr } = await supabase
      .from('diagnostics')
      .insert({
        business_name: data.business_name.trim(),
        business_type: data.business_type,
        city: data.city,
        website_url: websiteUrl,
        instagram_url: data.instagram_url || null,
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

    // 2. Call PageSpeed Insights API (mobile + desktop in parallel)
    const categories = ['PERFORMANCE', 'SEO', 'ACCESSIBILITY', 'BEST_PRACTICES']
      .map(c => `category=${c}`)
      .join('&')
    const keyParam = pagespeedKey ? `&key=${pagespeedKey}` : ''
    const psBase = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(websiteUrl)}&${categories}${keyParam}`

    const [mobileRes, desktopRes] = await Promise.allSettled([
      fetch(`${psBase}&strategy=mobile`),
      fetch(`${psBase}&strategy=desktop`),
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

    const [pagespeedMobile, pagespeedDesktop] = await Promise.all([
      parsePagespeed(mobileRes),
      parsePagespeed(desktopRes),
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
        fireApify('apify~website-content-crawler', { startUrls: [{ url: websiteUrl }], maxCrawlPages: 5 }, 'website'),
        data.google_maps_url
          ? fireApify('compass~google-maps-reviews-scraper', { startUrls: [{ url: data.google_maps_url }], maxReviews: 20 }, 'google_maps')
          : Promise.resolve(),
      ])
    }

    // 4. Update row with results
    const hasPagespeed = !!(pagespeedMobile || pagespeedDesktop)
    await supabase
      .from('diagnostics')
      .update({
        pagespeed_mobile: pagespeedMobile,
        pagespeed_desktop: pagespeedDesktop,
        apify_run_ids: apifyRunIds,
        status: hasPagespeed ? 'complete' : 'partial',
      })
      .eq('id', diagnosticId)

    return json({ id: diagnosticId, status: hasPagespeed ? 'complete' : 'partial' })

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
