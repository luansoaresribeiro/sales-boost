// Diagnóstico grátis v2 — "você vs. a concorrência da sua região" + trends.
// Roda em etapas (a página do diagnóstico chama `advanceMarket` a cada
// poucos segundos), porque as buscas da Apify levam de 30 s a 2 min e não
// cabem numa chamada só:
//   queued → scanning (posts das hashtags da região) → profiling (perfis dos
//   3 concorrentes) → thinking (IA escreve descobertas/ideias) → done
// Nenhum número é inventado: tudo que aparece vem dos dados lidos aqui; a IA
// só escreve texto em cima deles (regra 5). Hashtags por setor vêm da ficha
// (`config.market_hashtags`), nunca hardcoded por setor (regra 6).

// deno-lint-ignore no-explicit-any
type Any = any

const APIFY = 'https://api.apify.com/v2'
const POSTS_ACTOR = 'apidojo~instagram-scraper' // US$ 0,0005 por post (2026-10-09)
const PROFILES_ACTOR = 'apify~instagram-profile-scraper' // ~US$ 0,0026 por perfil
const MAX_POSTS = 60
const MAX_COMPETITORS = 3
const RUN_TIMEOUT_MS = 4 * 60 * 1000
const DAY = 864e5

export const MARKET_SCAN_MONTHLY_CAP = Number(Deno.env.get('MARKET_SCAN_MONTHLY_CAP') ?? '150') || 150

export interface MarketPost { url: string | null; owner: string | null; likes: number | null; comments: number | null; is_video: boolean | null; ts: string | null; caption: string; hashtags: string[] }
export interface Competitor { username: string; followers: number | null; posts_30d: number | null; avg_engagement_pct: number | null; video_share_pct: number | null; seen_posts: number }
export interface MarketData {
  v: number
  status: 'queued' | 'scanning' | 'profiling' | 'thinking' | 'done' | 'unavailable'
  reason?: string
  hashtags: string[]
  runs: { posts?: string; posts_started?: string; profiles?: string; profiles_started?: string }
  posts?: MarketPost[]
  competitors?: Competitor[]
  trends?: { top: MarketPost[]; video_share_pct: number | null; top_hashtags: string[] }
  insights?: { descobertas: { titulo: string; texto: string }[]; ideias: { titulo: string; gancho: string; formato: string; base: string }[] }
  updated_at: string
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Hashtags da região: modelos da ficha ("imoveis{local}") × bairros/cidade.
export function marketHashtags(templates: string[] | null, businessType: string | null, city: string | null, bairros: unknown): string[] {
  const locals: string[] = []
  for (const b of Array.isArray(bairros) ? bairros.slice(0, 2) : []) { const s = slug(String(b)); if (s.length >= 3) locals.push(s) }
  // Cidade: o nome ("Rio de Janeiro / RJ" → riodejaneiro); se só vier a
  // sigla ("Rj", "SP"), usa a sigla — #imoveisrj é hashtag comum. Antes, sigla
  // era descartada e o diagnóstico ficava sem hashtag nenhuma (bug 2026-10-10).
  const parts = String(city ?? '').split(/[/,\-–|]/).map(x => slug(x)).filter(Boolean)
  const c = parts.find(x => x.length >= 3) ?? parts.find(x => x.length >= 2)
  if (c && !locals.includes(c)) locals.push(c)
  const tpls = templates?.length ? templates : [`${slug(String(businessType ?? '').split(/[/\s]/)[0]) || 'negocio'}{local}`]
  const out: string[] = []
  for (const t of tpls) for (const l of locals) { const h = slug(t.replace('{local}', l)); if (h.length >= 4 && !out.includes(h)) out.push(h) }
  return out.slice(0, 4)
}

const num = (...vs: unknown[]) => { for (const v of vs) if (typeof v === 'number' && Number.isFinite(v)) return v; return null }
const str = (...vs: unknown[]) => { for (const v of vs) if (typeof v === 'string' && v) return v; return null }

// Formato dos itens do ator barato não é documentado — lê vários nomes possíveis.
export function normalizePost(x: Any): MarketPost {
  const cap = typeof x?.caption === 'string' ? x.caption : (x?.caption?.text ?? x?.text ?? '')
  const code = str(x?.shortCode, x?.shortcode, x?.code)
  const rawTs = x?.timestamp ?? x?.takenAt ?? x?.taken_at ?? x?.createdAt
  const ts = typeof rawTs === 'number' ? new Date(rawTs < 1e12 ? rawTs * 1000 : rawTs).toISOString() : (typeof rawTs === 'string' ? rawTs : null)
  const type = String(x?.type ?? x?.media_type ?? x?.productType ?? '').toLowerCase()
  const isVideo = typeof x?.isVideo === 'boolean' ? x.isVideo : typeof x?.is_video === 'boolean' ? x.is_video : (type ? /video|reel|clip/.test(type) : (x?.videoUrl || x?.video_url ? true : null))
  return {
    url: str(x?.url, x?.postUrl, x?.permalink) ?? (code ? `https://www.instagram.com/p/${code}/` : null),
    owner: (str(x?.ownerUsername, x?.owner?.username, x?.user?.username, x?.username) ?? '').toLowerCase() || null,
    likes: num(x?.likesCount, x?.likeCount, x?.like_count, x?.likes),
    comments: num(x?.commentsCount, x?.commentCount, x?.comment_count, x?.comments),
    is_video: isVideo, ts,
    caption: String(cap ?? '').slice(0, 280),
    hashtags: Array.isArray(x?.hashtags) ? x.hashtags.map((h: unknown) => slug(String(h))).filter(Boolean).slice(0, 10)
      : (String(cap ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? []).map(h => slug(h)).slice(0, 10),
  }
}

const eng = (p: MarketPost) => (p.likes ?? 0) + (p.comments ?? 0)

// Candidatos a concorrente: quem mais aparece/engaja nas hashtags da região.
export function pickCompetitors(posts: MarketPost[], ownHandle: string | null): string[] {
  const by = new Map<string, { n: number; e: number }>()
  const since = Date.now() - 45 * DAY
  for (const p of posts) {
    if (!p.owner || p.owner === ownHandle || (p.ts && Date.parse(p.ts) < since)) continue
    const a = by.get(p.owner) ?? { n: 0, e: 0 }; a.n++; a.e += eng(p); by.set(p.owner, a)
  }
  return [...by.entries()].sort((a, b) => (b[1].n - a[1].n) || (b[1].e - a[1].e)).slice(0, MAX_COMPETITORS).map(([u]) => u)
}

export function buildTrends(posts: MarketPost[], ownHandle: string | null = null): MarketData['trends'] {
  const since = Date.now() - 30 * DAY
  const recent = posts.filter(p => (!p.ts || Date.parse(p.ts) >= since) && p.owner !== ownHandle)
  // No máximo 2 posts do mesmo perfil, pra mostrar o nicho e não um perfil só.
  const perOwner = new Map<string, number>()
  const top = [...recent].sort((a, b) => eng(b) - eng(a)).filter(p => {
    const k = p.owner ?? p.url ?? ''; const n = perOwner.get(k) ?? 0
    if (n >= 2) return false; perOwner.set(k, n + 1); return true
  }).slice(0, 5)
  const withType = recent.filter(p => p.is_video !== null)
  const video_share_pct = withType.length >= 5 ? Math.round(100 * withType.filter(p => p.is_video).length / withType.length) : null
  const count = new Map<string, number>()
  for (const p of recent) for (const h of p.hashtags) count.set(h, (count.get(h) ?? 0) + 1)
  const top_hashtags = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([h]) => h)
  return { top, video_share_pct, top_hashtags }
}

export function competitorFromProfile(p: Any): Competitor | null {
  const username = str(p?.username)?.toLowerCase()
  if (!username) return null
  const followers = num(p?.followersCount)
  const posts = Array.isArray(p?.latestPosts) ? p.latestPosts : []
  const since = Date.now() - 30 * DAY
  const ts = posts.map((x: Any) => Date.parse(String(x?.timestamp ?? ''))).filter(Number.isFinite)
  const posts_30d = ts.length ? ts.filter((t: number) => t >= since).length : null
  const engs = posts.map((x: Any) => (num(x?.likesCount) ?? 0) + (num(x?.commentsCount) ?? 0))
  const avg = engs.length ? engs.reduce((a: number, b: number) => a + b, 0) / engs.length : null
  const avg_engagement_pct = avg !== null && followers ? Math.round(1000 * avg / followers) / 10 : null
  const vids = posts.filter((x: Any) => x?.type === 'Video' || x?.videoUrl).length
  return { username, followers, posts_30d, avg_engagement_pct, video_share_pct: posts.length ? Math.round(100 * vids / posts.length) : null, seen_posts: posts.length }
}

async function apifyStart(actor: string, input: unknown, token: string): Promise<string | null> {
  const r = await fetch(`${APIFY}/acts/${actor}/runs?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(20_000) })
  if (!r.ok) { console.log('[market] apify start', actor, r.status, (await r.text()).slice(0, 200)); return null }
  return (await r.json())?.data?.id ?? null
}

async function apifyPoll(runId: string, token: string): Promise<{ status: string; items?: Any[] }> {
  const r = await fetch(`${APIFY}/actor-runs/${runId}?token=${token}`, { signal: AbortSignal.timeout(15_000) })
  if (!r.ok) return { status: 'UNKNOWN' }
  const d = (await r.json())?.data
  if (d?.status !== 'SUCCEEDED') return { status: String(d?.status ?? 'UNKNOWN') }
  const items = await fetch(`${APIFY}/datasets/${d.defaultDatasetId}/items?token=${token}&clean=true&limit=200`, { signal: AbortSignal.timeout(20_000) })
  return { status: 'SUCCEEDED', items: items.ok ? await items.json() : [] }
}

const abort = (runId: string, token: string) => fetch(`${APIFY}/actor-runs/${runId}/abort?token=${token}`, { method: 'POST' }).catch(() => {})
const tooOld = (iso?: string) => !!iso && Date.now() - Date.parse(iso) > RUN_TIMEOUT_MS

export interface AdvanceCtx { token: string; anthropicKey: string | null; templates: string[] | null; ownHandle: string | null; own: Any; business: string }

// Um passo da máquina de estados. Devolve o próximo estado (o chamador grava
// com trava otimista por `v`).
export async function advanceMarket(m: MarketData, ctx: AdvanceCtx): Promise<MarketData> {
  const now = new Date().toISOString()
  const next = (patch: Partial<MarketData>): MarketData => ({ ...m, ...patch, v: m.v + 1, updated_at: now })
  if (m.status === 'queued') {
    if (!m.hashtags.length) return next({ status: 'unavailable', reason: 'sem_hashtags' })
    const until = new Date(Date.now() - 45 * DAY).toISOString().slice(0, 10)
    const id = await apifyStart(POSTS_ACTOR, { startUrls: m.hashtags.map(h => `https://www.instagram.com/explore/tags/${h}/`), maxItems: MAX_POSTS, until }, ctx.token)
    return id ? next({ status: 'scanning', runs: { ...m.runs, posts: id, posts_started: now } }) : next({ status: 'unavailable', reason: 'apify_start' })
  }
  if (m.status === 'scanning' && m.runs.posts) {
    const r = await apifyPoll(m.runs.posts, ctx.token)
    if (r.status !== 'SUCCEEDED') {
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(r.status)) return next({ status: 'unavailable', reason: `posts_${r.status}` })
      if (tooOld(m.runs.posts_started)) { abort(m.runs.posts, ctx.token); return next({ status: 'unavailable', reason: 'posts_timeout' }) }
      return m
    }
    const posts = (r.items ?? []).map(normalizePost).filter(p => p.url || p.owner)
    const trends = buildTrends(posts, ctx.ownHandle)
    const cands = pickCompetitors(posts, ctx.ownHandle)
    if (!cands.length) return next({ status: 'thinking', posts, trends, competitors: [] })
    const id = await apifyStart(PROFILES_ACTOR, { usernames: cands }, ctx.token)
    return next({ status: id ? 'profiling' : 'thinking', posts, trends, competitors: [], runs: { ...m.runs, profiles: id ?? undefined, profiles_started: now } })
  }
  if (m.status === 'profiling' && m.runs.profiles) {
    const r = await apifyPoll(m.runs.profiles, ctx.token)
    if (r.status !== 'SUCCEEDED') {
      const failed = ['FAILED', 'ABORTED', 'TIMED-OUT'].includes(r.status) || tooOld(m.runs.profiles_started)
      if (failed) { if (tooOld(m.runs.profiles_started)) abort(m.runs.profiles, ctx.token); return next({ status: 'thinking' }) }
      return m
    }
    const competitors = (r.items ?? []).map(competitorFromProfile).filter((c): c is Competitor => !!c)
    return next({ status: 'thinking', competitors })
  }
  if (m.status === 'thinking') {
    const insights = ctx.anthropicKey ? await writeInsights(m, ctx) : null
    return next({ status: 'done', insights: insights ?? undefined, posts: undefined })
  }
  return m
}

async function writeInsights(m: MarketData, ctx: AdvanceCtx): Promise<MarketData['insights'] | null> {
  const op: Any[] = ctx.own?.posts ?? []
  const lastTs = op.map(p => Date.parse(String(p.ts ?? ''))).filter(Number.isFinite).sort((a, b) => b - a)[0]
  const own = ctx.own && !ctx.own.error ? {
    usuario: ctx.own.username ?? null, seguidores: ctx.own.followers, posts_no_perfil: ctx.own.posts_total ?? null,
    bio: ctx.own.biography ?? '', link_na_bio: ctx.own.external_url ?? null, conta_comercial: ctx.own.is_business ?? null, destaques: ctx.own.highlights ?? null,
    posts_vistos: op.length, dias_desde_o_ultimo_post: lastTs ? Math.floor((Date.now() - lastTs) / DAY) : null,
    posts_30d: op.filter(p => p.ts && Date.parse(p.ts) >= Date.now() - 30 * DAY).length,
    video_pct: op.length ? Math.round(100 * op.filter(p => p.is_video).length / op.length) : null,
    curtidas_mais_comentarios_medio: op.length ? Math.round(op.reduce((a, p) => a + (p.likes ?? 0) + (p.comments ?? 0), 0) / op.length) : null,
  } : null
  const data = { negocio: ctx.business, voce: own, concorrentes: m.competitors ?? [], em_alta: { posts: (m.trends?.top ?? []).map(p => ({ dono: p.owner, curtidas: p.likes, comentarios: p.comments, video: p.is_video, legenda: p.caption.slice(0, 160) })), video_pct_de_todos_os_posts_recentes_das_hashtags: m.trends?.video_share_pct, hashtags_mais_usadas: m.trends?.top_hashtags } }
  const prompt = `Você é analista de Instagram de um negócio local. Abaixo estão DADOS REAIS lidos agora do Instagram (o perfil do dono, 3 concorrentes da região e os posts que mais engajaram nas hashtags da região nos últimos 30 dias).

${JSON.stringify(data)}

Escreva em português simples, pro dono (não especialista):
- 3 "descobertas": os PONTOS FRACOS do perfil do dono ("voce") que estão fazendo ele perder clientes — o que um cliente vê de errado ao abrir o perfil dele. Olhe frequência (dias desde o último post, posts em 30 dias), formato (vídeo), engajamento, a bio (diz o que ele faz, onde atende e como falar com ele?), link na bio, destaques e conta comercial. Seja direto e honesto, sem ofender: o dono precisa perceber que precisa melhorar. Sempre que der, compare com um concorrente ou com o que está em alta ("você X, enquanto @fulano Y"). Comece pelo ponto mais grave. Se "voce" for null, escreva descobertas sobre a concorrência da região.
Cite os números EXATAMENTE como estão nos dados (nunca invente número, nunca arredonde pra cima, nunca estime, nunca prometa resultado). Se um dado não existe ou é null, não fale dele. Se o perfil for bom num ponto, não invente defeito.
- 3 "ideias" de post prontas pra ele, cada uma apoiada em algo que está em alta ou que funciona pros concorrentes (diga em "base" qual dado sustenta a ideia).
Se os dados forem poucos, faça menos itens — nunca preencha com coisa genérica.
Tamanhos: "titulo" até 80 caracteres; "texto" até 350; "gancho" é a PRIMEIRA FRASE do post, do jeito que o dono falaria pro cliente (até 120); "base" até 220.

Responda SÓ JSON: {"descobertas":[{"titulo":"","texto":""}],"ideias":[{"titulo":"","gancho":"","formato":"reels|carrossel|foto|stories","base":""}]}`
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': ctx.anthropicKey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(60_000),
    })
    if (!r.ok) { console.log('[market] claude', r.status); return null }
    const t = String((await r.json())?.content?.[0]?.text ?? '')
    const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))
    // Corta em fim de palavra (com reticências) se o modelo passar do tamanho pedido.
    const s = (v: unknown, n: number) => { const t = String(v ?? '').trim(); if (t.length <= n) return t; const c = t.slice(0, n - 1); return `${c.slice(0, c.lastIndexOf(' ') > n / 2 ? c.lastIndexOf(' ') : c.length).replace(/[\s,.;:—-]+$/, '')}…` }
    return {
      descobertas: (Array.isArray(j.descobertas) ? j.descobertas : []).slice(0, 3).map((d: Any) => ({ titulo: s(d.titulo, 100), texto: s(d.texto, 450) })),
      ideias: (Array.isArray(j.ideias) ? j.ideias : []).slice(0, 3).map((d: Any) => ({ titulo: s(d.titulo, 100), gancho: s(d.gancho, 180), formato: s(d.formato, 20), base: s(d.base, 300) })),
    }
  } catch (e) { console.log('[market] insights falhou', String(e)); return null }
}

export function initialMarket(hashtags: string[], reason?: string): MarketData {
  return { v: 0, status: reason ? 'unavailable' : 'queued', reason, hashtags, runs: {}, updated_at: new Date().toISOString() }
}

// Quando o diagnóstico vira cliente: concorrentes e trends entram nas tabelas
// que o agente de dados e a estratégia já leem (marketing_ai_competitors /
// marketing_ai_trends). Idempotente.
export async function feedCompany(admin: Any, companyId: string, m: MarketData) {
  for (const c of m.competitors ?? []) {
    const url = `https://instagram.com/${c.username}`
    const { data: ex } = await admin.from('marketing_ai_competitors').select('id').eq('company_id', companyId).eq('instagram_url', url).maybeSingle()
    const row = { company_id: companyId, name: `@${c.username}`, instagram_url: url, followers: c.followers, avg_engagement: c.avg_engagement_pct, posting_frequency_days: c.posts_30d ? Math.round(300 / c.posts_30d) / 10 : null, notes: 'Encontrado no diagnóstico grátis (hashtags da região).', last_analyzed_at: new Date().toISOString() }
    const { error } = ex ? await admin.from('marketing_ai_competitors').update(row).eq('id', ex.id) : await admin.from('marketing_ai_competitors').insert(row)
    if (error) console.log('[market] concorrente não gravado', c.username, error.message)
  }
  const top = m.trends?.top ?? []
  if (top.length) {
    await admin.from('marketing_ai_trends').delete().eq('company_id', companyId).eq('source', 'diagnostico')
    const { error } = await admin.from('marketing_ai_trends').insert(top.slice(0, 5).map(p => ({
      company_id: companyId, source: 'diagnostico', category: p.is_video ? 'reels' : 'post',
      title: (p.caption.split('\n')[0] || 'Post em alta na região').slice(0, 120),
      description: `${p.likes ?? '?'} curtidas e ${p.comments ?? '?'} comentários${p.owner ? ` (@${p.owner})` : ''}${p.url ? ` — ${p.url}` : ''}`,
      relevance: 'high', // a tabela só aceita high|medium|low
    })))
    if (error) console.log('[market] trends não gravadas', error.message)
  }
}
