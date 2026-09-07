/**
 * instagram-performance — centro de inteligência do Instagram (dados REAIS).
 *
 * Body: { company_id, force? }.
 *  - Sem conexão → { connected: false }.
 *  - Token vencido → { connected: false, expired: true }.
 *  - Conectado → { connected: true, ...PerformanceData } no MESMO shape que o
 *    frontend usa. Métrica que a API não entrega vem `null` → a UI mostra
 *    "Não disponível" (nunca inventamos número).
 *
 * Também historiza snapshots (isolados por company_id) pra comparar períodos.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const IG = 'https://graph.instagram.com/v21.0'
const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const round1 = (v: number) => Math.round(v * 10) / 10
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

// deno-lint-ignore no-explicit-any
async function safeGet(url: string): Promise<any | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}
// deno-lint-ignore no-explicit-any
function igMetric(insights: any, name: string): number | null {
  const row = insights?.data?.find((d: any) => d.name === name)
  const v = row?.total_value?.value ?? row?.values?.[0]?.value
  return v == null ? null : Number(v)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { company_id } = await req.json().catch(() => ({}))
    if (!company_id) return json({ error: 'company_id obrigatório' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: company } = await admin.from('companies')
      .select('id, user_id, business_name, instagram_user_id, instagram_access_token, instagram_token_expires_at')
      .eq('id', company_id).maybeSingle()
    if (!company || company.user_id !== user.id) return json({ error: 'Forbidden' }, 403)
    if (!company.instagram_user_id || !company.instagram_access_token) return json({ connected: false })
    if (company.instagram_token_expires_at && new Date(company.instagram_token_expires_at) < new Date()) {
      return json({ connected: false, expired: true })
    }

    const token = company.instagram_access_token as string
    const today = new Date().toISOString().slice(0, 10)

    // 1. Perfil
    const profile = await safeGet(`${IG}/me?fields=user_id,username,account_type,media_count,followers_count,follows_count,profile_picture_url&access_token=${token}`)
    if (!profile || profile.error) return json({ connected: true, error: profile?.error?.message ?? 'Falha ao ler o perfil' })
    const followers = num(profile.followers_count)

    // 2. Insights da conta (best-effort — depende de permissão/tamanho da conta)
    const accIns = await safeGet(`${IG}/me/insights?metric=reach,profile_views,website_clicks,accounts_engaged,total_interactions&period=days_28&metric_type=total_value&access_token=${token}`)
    const reachAcc = igMetric(accIns, 'reach')
    const profileVisits = igMetric(accIns, 'profile_views')
    const websiteClicks = igMetric(accIns, 'website_clicks')

    // 3. Mídias recentes + insights por mídia
    const mediaRes = await safeGet(`${IG}/me/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,like_count,comments_count&limit=25&access_token=${token}`)
    const media = (mediaRes?.data ?? []) as any[]
    const content: any[] = []
    for (const m of media) {
      const type = classifyType(m)
      const metrics = type === 'reel'
        ? 'reach,saved,shares,likes,comments,views'
        : type === 'story' ? 'reach,replies,shares' : 'reach,saved,shares,total_interactions'
      const ins = await safeGet(`${IG}/${m.id}/insights?metric=${metrics}&access_token=${token}`)
      const reach = igMetric(ins, 'reach')
      const saves = igMetric(ins, 'saved')
      const shares = igMetric(ins, 'shares')
      const likes = num(m.like_count) ?? 0
      const comments = num(m.comments_count) ?? 0
      const total = likes + comments + (shares ?? 0) + (saves ?? 0)
      content.push({
        id: m.id, type, date: m.timestamp, caption: (m.caption ?? '').slice(0, 90) || 'Sem legenda',
        thumb: m.thumbnail_url ?? null, permalink: m.permalink ?? null,
        reach, impressions: null, likes, comments, shares, saves,
        engagementRate: reach ? round1((total / reach) * 100) : 0,
        followersGained: null, pillar: pillarOf(m.caption ?? ''), funnel: funnelOf(type),
      })
    }

    // 4. Derivados a partir das mídias reais
    const publishedCount = content.length
    const reachSum = content.reduce((s, c) => s + (c.reach ?? 0), 0)
    const engSum = content.reduce((s, c) => s + c.likes + c.comments + (c.shares ?? 0) + (c.saves ?? 0), 0)
    const reach30 = reachAcc ?? (reachSum || null)
    const engRate = reachSum ? round1((engSum / reachSum) * 100) : 0
    const avgReach = publishedCount ? Math.round(reachSum / publishedCount) : null

    // 5. Histórico → deltas reais (compara com snapshot ~30 dias atrás)
    const { data: hist } = await admin.from('instagram_performance_snapshots')
      .select('captured_for, followers, reach, engagement, published, profile_visits, website_clicks, engagement_rate')
      .eq('company_id', company_id).order('captured_for', { ascending: true }).limit(200)
    const history = hist ?? []
    const prevSnap = history.find(h => daysBetween(h.captured_for, today) >= 27 && daysBetween(h.captured_for, today) <= 33)
      ?? history[0]

    // 6. Score (normalizado)
    const nonFollowerPct = null // requer breakdown follower_type (nem toda conta entrega)
    const growthComp = prevSnap?.followers && followers ? clamp(50 + ((followers - prevSnap.followers) / Math.max(1, prevSnap.followers)) * 800) : 55
    const reachComp = avgReach && followers ? clamp((avgReach / followers) * 130) : 50
    const engComp = clamp(35 + engRate * 7)
    const contentComp = clamp(publishedCount ? 55 + Math.min(30, publishedCount * 2) : 40)
    const consistencyComp = clamp(35 + recentPerWeek(content) * 12)
    const total = clamp(growthComp * 0.22 + reachComp * 0.24 + engComp * 0.26 + contentComp * 0.16 + consistencyComp * 0.12)
    const scoreLabel = total >= 80 ? 'Desempenho forte' : total >= 60 ? 'Desempenho bom' : total >= 40 ? 'Precisa de atenção' : 'Desempenho crítico'
    const health = total >= 80 ? 'excellent' : total >= 60 ? 'good' : total >= 40 ? 'attention' : 'critical'

    // 7. Persiste snapshots (upsert, idempotente por dia) — só service role escreve
    await admin.from('instagram_performance_snapshots').upsert({
      company_id, captured_for: today, followers, reach: reach30, impressions: null,
      profile_visits: profileVisits, website_clicks: websiteClicks, engagement: engSum,
      engagement_rate: engRate, published: publishedCount,
      raw: { followers_count: followers, media_count: profile.media_count },
    }, { onConflict: 'company_id,captured_for' })
    await admin.from('instagram_performance_scores').upsert({
      company_id, captured_for: today, total,
      growth: growthComp, reach: reachComp, engagement: engComp, content: contentComp, consistency: consistencyComp,
    }, { onConflict: 'company_id,captured_for' })
    if (content.length) {
      await admin.from('instagram_content_performance').upsert(content.map(c => ({
        company_id, media_id: c.id, media_type: c.type, caption: c.caption, thumbnail_url: c.thumb,
        permalink: c.permalink, posted_at: c.date, reach: c.reach, likes: c.likes, comments: c.comments,
        shares: c.shares, saves: c.saves, engagement_rate: c.engagementRate, pillar: c.pillar, funnel_stage: c.funnel,
        updated_at: new Date().toISOString(),
      })), { onConflict: 'company_id,media_id' })
    }

    // 8. Monta o trend a partir do histórico real (dias que já temos)
    const trend = history.map(h => ({
      date: new Date(h.captured_for as string).toISOString(),
      followers: h.followers ?? 0, reach: h.reach ?? 0, impressions: null,
      engagement: h.engagement ?? 0, engagementRate: h.engagement_rate ?? 0,
      profileVisits: h.profile_visits, websiteClicks: h.website_clicks, published: h.published ?? 0,
    }))
    // garante o ponto de hoje no fim
    trend.push({ date: new Date().toISOString(), followers: followers ?? 0, reach: reach30 ?? 0, impressions: null, engagement: engSum, engagementRate: engRate, profileVisits, websiteClicks, published: publishedCount })

    const enoughForTime = content.length >= 8
    const delta = (cur: number | null, prev: number | null | undefined) =>
      cur != null && prev != null && prev !== 0 ? round1(((cur - prev) / Math.abs(prev)) * 100) : null

    const payload = {
      connected: true,
      demo: false,
      username: profile.username ?? company.business_name,
      profilePic: profile.profile_picture_url ?? null,
      followers,
      lastSync: new Date().toISOString(),
      health: { level: health, score: total },
      score: {
        total, label: scoreLabel,
        components: [
          { key: 'growth', label: 'Crescimento', value: growthComp, note: 'Velocidade de novos seguidores vs seu histórico.' },
          { key: 'reach', label: 'Alcance', value: reachComp, note: 'Alcance médio por conteúdo relativo ao tamanho da conta.' },
          { key: 'engagement', label: 'Engajamento', value: engComp, note: 'Interações sobre alcance, com peso pra salvamentos e compartilhamentos.' },
          { key: 'content', label: 'Conteúdo', value: contentComp, note: 'Volume e desempenho recente dos conteúdos.' },
          { key: 'consistency', label: 'Consistência', value: consistencyComp, note: 'Regularidade de publicação nas últimas semanas.' },
        ],
      },
      kpis: buildKpis({ followers, reach30, engSum, engRate, profileVisits, websiteClicks, publishedCount, avgReach, prevSnap, delta }),
      trend,
      audience: buildAudience(followers, prevSnap, content),
      reach: {
        total: reach30, nonFollowers: null, followers: null, impressions: null,
        avgPerContent: avgReach, growth: delta(reach30, prevSnap?.reach), nonFollowerPct,
        insight: reach30 ? `Seu alcance nos últimos 28 dias foi de ${reach30.toLocaleString('pt-BR')} contas. A divisão seguidores/não-seguidores depende de permissão adicional da API — quando disponível, aparece aqui.` : 'Alcance da conta ainda não disponível pela API para o tamanho atual do perfil.',
      },
      engagement: buildEngagement(content, engSum, engRate, reachSum, publishedCount),
      content,
      contentTypes: buildTypes(content),
      contentTypeConclusion: typeConclusion(content),
      consistency: buildConsistency(content),
      bestTime: buildBestTime(content, enoughForTime),
      funnel: buildFunnel(content, reach30 ?? reachSum, engSum),
      funnelNote: 'Classificação por etapa baseada no formato do conteúdo. Conforme acumulamos histórico, refinamos com dados de conversão reais.',
      pillars: buildPillars(content),
      anomalies: buildAnomalies(content, avgReach),
      aiAnalysis: buildAiAnalysis(content, engRate, scoreLabel),
      competitor: { hasData: false, rows: [], you: { postsPerWeek: recentPerWeek(content), engagement: engRate } },
      recommendations: buildRecs(content),
      game: buildGame(followers, prevSnap, reach30, total, recentPerWeek(content)),
      sync: { status: 'connected', lastSync: new Date().toISOString(), error: null },
    }
    return json(payload)
  } catch (err) {
    console.error('instagram-performance error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// ── Helpers de classificação ──────────────────────────────────────────────
function classifyType(m: any): 'reel' | 'post' | 'carousel' | 'story' {
  if (m.media_product_type === 'STORY') return 'story'
  if (m.media_product_type === 'REELS' || m.media_type === 'VIDEO') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  return 'post'
}
function funnelOf(type: string): 'tof' | 'mof' | 'bof' {
  return type === 'reel' || type === 'story' ? 'tof' : type === 'carousel' ? 'mof' : 'bof'
}
const PILLAR_KEYS: [string, string[]][] = [
  ['Educação', ['como', 'dica', 'passo', 'aprenda', 'guia', 'tutorial', 'saiba']],
  ['Prova social', ['cliente', 'depoimento', 'avaliação', 'resultado', 'antes', 'depois']],
  ['Produto', ['novidade', 'lançamento', 'promo', 'oferta', 'produto', 'desconto']],
  ['Bastidores', ['bastidor', 'rotina', 'time', 'equipe', 'dia a dia', 'making']],
]
function pillarOf(caption: string): string {
  const c = (caption ?? '').toLowerCase()
  for (const [name, keys] of PILLAR_KEYS) if (keys.some(k => c.includes(k))) return name
  return 'Entretenimento'
}
function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}
function recentPerWeek(content: any[]): number {
  const cutoff = Date.now() - 28 * 86400000
  const recent = content.filter(c => new Date(c.date).getTime() >= cutoff).length
  return round1(recent / 4)
}

// ── Builders de seção ─────────────────────────────────────────────────────
function buildKpis(x: any) {
  const { followers, reach30, engSum, engRate, profileVisits, websiteClicks, publishedCount, avgReach, prevSnap, delta } = x
  void delta
  const mk = (key: string, label: string, value: number | null, prev: number | null, format: string, meaning: string, calc: string, matters: string, ifDown: string) =>
    ({ key, label, value, prev, format, meaning, calc, matters, ifDown })
  return [
    mk('followers', 'Seguidores', followers, prevSnap?.followers ?? null, 'int', 'Total de contas que seguem seu perfil.', 'Valor atual reportado pelo Instagram.', 'É a base que você pode reengajar sem pagar mídia.', 'Reforce conteúdo de descoberta (Reels).'),
    mk('reach', 'Alcance (28d)', reach30, prevSnap?.reach ?? null, 'int', 'Contas únicas que viram seu conteúdo.', 'Métrica de alcance da conta (28 dias).', 'É o topo do funil — sem alcance, não há novos clientes.', 'Priorize Reels e o melhor horário.'),
    mk('engagement', 'Engajamento', engSum, prevSnap?.engagement ?? null, 'int', 'Total de interações no conteúdo recente.', 'Soma de curtidas, comentários, salvamentos e compartilhamentos.', 'Sinaliza pro algoritmo distribuir seu conteúdo.', 'Use CTAs e conteúdo salvável.'),
    mk('engagementRate', 'Taxa de engajamento', engRate, prevSnap?.engagement_rate ?? null, 'pct', 'Interações sobre alcance.', 'Engajamento ÷ alcance × 100.', 'Mede qualidade, não só volume.', 'Melhore ganchos e chamadas pra ação.'),
    mk('profileVisits', 'Visitas ao perfil (28d)', profileVisits, prevSnap?.profile_visits ?? null, 'int', 'Aberturas do seu perfil.', 'Métrica de visitas ao perfil da conta.', 'Passo entre descoberta e conversão.', 'Reforce a proposta de valor na bio.'),
    mk('websiteClicks', 'Cliques no link (28d)', websiteClicks, prevSnap?.website_clicks ?? null, 'int', 'Cliques no link da bio.', 'Métrica de cliques no site da conta.', 'Sinal mais próximo de conversão.', 'Direcione conteúdo pro link.'),
    mk('published', 'Conteúdos recentes', publishedCount, prevSnap?.published ?? null, 'int', 'Publicações analisadas (últimas 25).', 'Contagem de mídias retornadas pela API.', 'Consistência alimenta o alcance.', 'Mantenha um ritmo sustentável.'),
    mk('avgReach', 'Alcance médio / post', avgReach, null, 'int', 'Alcance médio por conteúdo.', 'Alcance somado ÷ conteúdos.', 'Isola a eficiência do conteúdo do volume.', 'Menos posts, mais qualidade.'),
  ]
}
function buildAudience(followers: number | null, prevSnap: any, content: any[]) {
  const start = prevSnap?.followers ?? followers ?? 0
  const net = (followers ?? 0) - start
  const velocity = Math.round(net / 4)
  const momentum = net > 0 ? 'accelerating' : net < 0 ? 'declining' : 'stable'
  return {
    start, current: followers ?? 0, net, gained: net > 0 ? net : 0, lost: net < 0 ? -net : 0,
    growthRate: start ? round1((net / start) * 100) : 0, velocityPerWeek: velocity, momentum,
    note: prevSnap ? (net >= 0 ? `Você ganhou ${net.toLocaleString('pt-BR')} seguidores desde a última medição.` : `Você perdeu ${(-net).toLocaleString('pt-BR')} seguidores — vale revisar o conteúdo recente.`)
      : 'Ainda estamos acumulando histórico. A partir da próxima sincronização, o crescimento aparece comparado.',
    _c: content.length,
  }
}
function buildEngagement(content: any[], engSum: number, engRate: number, reachSum: number, published: number) {
  const sum = (k: string) => content.reduce((s, c) => s + (c[k] ?? 0), 0)
  const shares = content.some(c => c.shares != null) ? sum('shares') : null
  const saves = content.some(c => c.saves != null) ? sum('saves') : null
  const strongest = (saves ?? 0) >= (shares ?? 0) ? 'salvamentos' : 'compartilhamentos'
  return {
    likes: sum('likes'), comments: sum('comments'), shares, saves, total: engSum, rate: engRate,
    perReach: reachSum ? round1((engSum / reachSum) * 100) : null,
    avgPerPost: published ? Math.round(engSum / published) : 0,
    strongest,
    note: `Priorizamos salvamentos, compartilhamentos e comentários por serem sinais de intenção mais alta que curtidas. Hoje seu sinal mais forte são os ${strongest}.`,
    breakdownDelta: { likes: 0, comments: 0, shares: 0, saves: 0 },
  }
}
function buildTypes(content: any[]) {
  const FMT: Record<string, string> = { reel: 'Reels', post: 'Posts', carousel: 'Carrosséis', story: 'Stories' }
  return (['reel', 'carousel', 'post', 'story']).map(f => {
    const rows = content.filter(c => c.type === f)
    const n = rows.length || 1
    const avg = (k: string, present = true) => present && rows.length ? Math.round(rows.reduce((s, c) => s + (c[k] ?? 0), 0) / n) : (rows.length ? Math.round(rows.reduce((s, c) => s + (c[k] ?? 0), 0) / n) : 0)
    const avgReach = rows.length ? Math.round(rows.reduce((s, c) => s + (c.reach ?? 0), 0) / n) : null
    const avgEng = avg('likes') + avg('comments') + avg('shares') + avg('saves')
    return {
      type: f, label: FMT[f], count: rows.length, avgReach, avgEng,
      avgRate: rows.length && avgReach ? round1((avgEng / avgReach) * 100) : 0,
      avgShares: content.some(c => c.shares != null) ? avg('shares') : null,
      avgSaves: content.some(c => c.saves != null) ? avg('saves') : null,
      delta: 0,
    }
  })
}
function typeConclusion(content: any[]): string {
  const byReach: Record<string, number[]> = {}
  content.forEach(c => { (byReach[c.type] ??= []).push(c.reach ?? 0) })
  const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
  const best = Object.entries(byReach).sort((a, b) => avg(b[1]) - avg(a[1]))[0]
  const FMT: Record<string, string> = { reel: 'Reels', post: 'Posts', carousel: 'Carrosséis', story: 'Stories' }
  return best ? `${FMT[best[0]] ?? best[0]} são hoje seu formato de maior alcance. Vale dobrar nele enquanto está performando.` : 'Ainda sem conteúdo suficiente para comparar formatos.'
}
function buildConsistency(content: any[]) {
  const weeks = 12
  const heatmap: number[][] = Array.from({ length: weeks }, () => Array(7).fill(0))
  const now = Date.now()
  content.forEach(c => {
    const t = new Date(c.date).getTime()
    const w = Math.floor((now - t) / (7 * 86400000))
    if (w >= 0 && w < weeks) heatmap[weeks - 1 - w][new Date(c.date).getDay()]++
  })
  const published = content.length
  const perWeek = recentPerWeek(content)
  const daysActive = heatmap.flat().filter(v => v > 0).length
  return {
    published, perWeek, daysActive, currentStreak: streak(heatmap), longestStreak: longestStreak(heatmap),
    recommendedPerWeek: 4, heatmap,
    note: perWeek < 3 ? 'Você está publicando abaixo do ritmo recomendado (4/semana). Mais consistência tende a aumentar o alcance acumulado.'
      : 'Bom ritmo de publicação. Foque em manter a qualidade em vez de só aumentar o volume.',
  }
}
function streak(h: number[][]): number { let s = 0; for (let i = h.length - 1; i >= 0; i--) { if (h[i].some(v => v > 0)) s++; else break } return s }
function longestStreak(h: number[][]): number { let best = 0, cur = 0; for (const w of h) { if (w.some(v => v > 0)) { cur++; best = Math.max(best, cur) } else cur = 0 } return best }
function buildBestTime(content: any[], enough: boolean) {
  const heat: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0))
  content.forEach(c => {
    const d = new Date(c.date); const slot = Math.min(5, Math.max(0, Math.floor((d.getHours() - 6) / 3)))
    if (slot >= 0) heat[d.getDay()][slot] += Math.max(1, c.likes + c.comments + (c.shares ?? 0) + (c.saves ?? 0))
  })
  const DAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; const SLOT = ['6–9h', '9–12h', '12–15h', '15–18h', '18–21h', '21–24h']
  let bd = 0, bs = 0, bv = -1
  heat.forEach((row, d) => row.forEach((v, s) => { if (v > bv) { bv = v; bd = d; bs = s } }))
  return { enough, heatmap: heat, best: `${DAY[bd]} — ${SLOT[bs]}`, window: `${DAY[bd]} ${SLOT[bs]}` }
}
function buildFunnel(content: any[], reach: number, eng: number) {
  const stageReach = (st: string) => content.filter(c => c.funnel === st).reduce((s, c) => s + (c.reach ?? 0), 0)
  const stageEng = (st: string) => content.filter(c => c.funnel === st).reduce((s, c) => s + c.likes + c.comments + (c.shares ?? 0) + (c.saves ?? 0), 0)
  const mk = (stage: string, label: string) => {
    const r = stageReach(stage), e = stageEng(stage)
    const score = clamp((reach ? (r / reach) * 60 : 0) + (eng ? (e / eng) * 40 : 0) + 40)
    return { stage, label, score, reach: r, engagement: e }
  }
  return [mk('tof', 'Topo — Descoberta'), mk('mof', 'Meio — Consideração'), mk('bof', 'Fundo — Conversão')]
}
function buildPillars(content: any[]) {
  const names = ['Educação', 'Bastidores', 'Prova social', 'Produto', 'Entretenimento']
  return names.map(name => {
    const rows = content.filter(c => c.pillar === name)
    const n = rows.length || 1
    const avgReach = rows.length ? Math.round(rows.reduce((s, c) => s + (c.reach ?? 0), 0) / n) : null
    const avgEng = rows.length ? Math.round(rows.reduce((s, c) => s + c.likes + c.comments + (c.shares ?? 0) + (c.saves ?? 0), 0) / n) : 0
    return {
      name, posts: rows.length, avgReach, avgEng,
      rate: rows.length && avgReach ? round1((avgEng / avgReach) * 100) : 0,
      shares: content.some(c => c.shares != null) ? Math.round(rows.reduce((s, c) => s + (c.shares ?? 0), 0) / n) : null,
      saves: content.some(c => c.saves != null) ? Math.round(rows.reduce((s, c) => s + (c.saves ?? 0), 0) / n) : null,
      delta: 0,
    }
  }).filter(p => p.posts > 0)
}
function buildAnomalies(content: any[], avgReach: number | null) {
  const out: any[] = []
  if (avgReach) {
    const top = [...content].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0]
    if (top && top.reach && top.reach > avgReach * 1.8) {
      out.push({ kind: 'breakout', icon: '🔥', title: 'Conteúdo em destaque', body: `"${top.caption}" alcançou ${Math.round((top.reach / avgReach) * 100)}% do seu alcance médio. Considere transformá-lo em campanha.` })
    }
  }
  const perWeek = recentPerWeek(content)
  if (perWeek < 2) out.push({ kind: 'attention', icon: '⚠️', title: 'Frequência baixa', body: `Você publicou cerca de ${perWeek}/semana no último mês. Aumentar a consistência tende a recuperar alcance.` })
  if (out.length === 0) out.push({ kind: 'opportunity', icon: '🚀', title: 'Tudo sob controle', body: 'Nenhuma anomalia relevante detectada no período. Continue no ritmo atual e observe os melhores formatos.' })
  return out
}
function buildAiAnalysis(content: any[], engRate: number, scoreLabel: string) {
  const byReach: Record<string, number[]> = {}
  content.forEach(c => { (byReach[c.type] ??= []).push(c.reach ?? 0) })
  const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
  const best = Object.entries(byReach).sort((a, b) => avg(b[1]) - avg(a[1]))[0]?.[0] ?? 'reel'
  const FMT: Record<string, string> = { reel: 'Reels', post: 'posts estáticos', carousel: 'carrosséis', story: 'stories' }
  return {
    working: `${FMT[best]} são seu formato de maior alcance no período.`,
    notWorking: 'Formatos com menor alcance estão puxando a média pra baixo — vale reduzir ou repensar.',
    why: 'O algoritmo prioriza conteúdo salvável e compartilhável; os formatos de descoberta entregam isso melhor.',
    opportunity: `Produzir mais ${FMT[best]} sobre seus temas de melhor desempenho deve acelerar o crescimento.`,
    risk: engRate < 2 ? 'Sua taxa de engajamento está baixa — reforce chamadas pra ação e conteúdo salvável.' : 'Manter o ritmo é o principal risco: quedas de frequência derrubam o alcance acumulado.',
    nextAction: `Publique 3 ${FMT[best]} esta semana baseados nos temas que mais engajaram e agende no seu melhor horário. (${scoreLabel})`,
  }
}
function buildRecs(content: any[]) {
  const byReach: Record<string, number[]> = {}
  content.forEach(c => { (byReach[c.type] ??= []).push(c.reach ?? 0) })
  const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
  const best = Object.entries(byReach).sort((a, b) => avg(b[1]) - avg(a[1]))[0]?.[0] ?? 'reel'
  const FMT: Record<string, string> = { reel: 'Reels', post: 'posts', carousel: 'carrosséis', story: 'stories' }
  return [
    { id: 'rec1', priority: 'high', title: `Aumente os ${FMT[best]}`, impact: 'Alto', reason: `${FMT[best]} são hoje seu formato de maior alcance.`, action: `Crie 3 ${FMT[best]} esta semana sobre os temas que mais engajaram.`, objective: 'Aumentar descoberta e novos seguidores.', prompt: `Crie 3 ${FMT[best]} curtos sobre os temas que mais engajaram no meu perfil, com ganchos fortes no início.` },
    { id: 'rec2', priority: 'medium', title: 'Reforce conteúdo salvável', impact: 'Médio', reason: 'Salvamentos são sinal de alta intenção que o algoritmo valoriza.', action: 'Transforme seu melhor conteúdo em um carrossel passo a passo salvável.', objective: 'Aumentar salvamentos e engajamento de qualidade.', prompt: 'Transforme meu conteúdo de melhor desempenho em um carrossel passo a passo, salvável, com CTA final.' },
    { id: 'rec3', priority: 'medium', title: 'Mantenha a consistência', impact: 'Médio', reason: 'Frequência regular sustenta o alcance acumulado.', action: 'Monte um calendário com 4 publicações por semana.', objective: 'Estabilizar e crescer o alcance.', prompt: 'Monte um calendário de conteúdo com 4 publicações por semana equilibrando descoberta e conversão.' },
  ]
}
function buildGame(followers: number | null, prevSnap: any, reach: number | null, total: number, perWeek: number) {
  const gained = (followers ?? 0) - (prevSnap?.followers ?? followers ?? 0)
  return [
    { label: '+100 seguidores no período', xp: 100, kind: 'xp', done: gained >= 100 },
    { label: 'Marco de alcance (10k)', xp: 150, kind: 'xp', done: (reach ?? 0) >= 10000 },
    { label: 'Melhor conteúdo do período', xp: null, kind: 'achievement', done: true },
    { label: 'Sequência de consistência', xp: null, kind: 'achievement', done: perWeek >= 4 },
    { label: 'Score de performance forte', xp: 80, kind: 'xp', done: total >= 70 },
    { label: 'Crescimento positivo no período', xp: null, kind: 'reward', done: gained > 0 },
  ]
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
