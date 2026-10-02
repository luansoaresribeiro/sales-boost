// P2 parte 1 — 80/20 determinístico (ver docs/LEARNING.md).
// computeEightyTwenty é PURA (sem I/O, sem relógio implícito: `now` vem do cfg)
// pra ser testável com `node --experimental-strip-types`. fetchLearning é a
// parte com I/O. Nada aqui conhece setor: os nomes de pilar/receita/formato
// vêm dos próprios dados (posts.pillar etc., que nascem da ficha).
// Regras: curtidas e alcance NUNCA entram no score; null = desconhecido, nunca 0.

export type PostRow = {
  id?: string
  instagram_media_id: string | null
  pillar: string | null
  recipe: string | null
  format: string | null
  published_at: string | null
}
export type PerfRow = { media_id: string; saves: number | null; shares: number | null }
export type EventRow = {
  media_ref: string | null
  intent_detected: string | null
  ig_user_id?: string | null
  ig_user?: string | null
  created_at?: string | null
}
export type LearningCfg = {
  now?: number              // ms; default Date.now() (só aqui, na borda)
  windowDays?: number       // 56 = 8 semanas
  minPosts?: number         // 3
  minDistinctDays?: number  // 2
  weightConversa?: number   // conversas pesam mais que saves+shares
  weightIntent?: number     // saves + shares
  maintainTargetPct?: number // 80
}
export type GroupKind = 'pillar' | 'recipe' | 'format'
export type GroupStatus = 'maintain' | 'test' | 'insufficient_data'
export type GroupResult = {
  key: string
  kind: GroupKind
  posts: number
  distinct_days: number
  conversas: number          // comentários-palavra-chave/DMs com intenção, 1 por usuário por post
  saves: number | null       // null = nenhum post do grupo tem medição
  shares: number | null
  score: number | null       // null = grupo sem dados suficientes pra pontuar
  rank: number | null
  status: GroupStatus
  suggested_share_pct: number | null
}
export type LearningResult = {
  status: 'ok' | 'insufficient_data'
  status_by_kind: Record<GroupKind, 'ok' | 'insufficient_data'>
  groups: GroupResult[]
  basis: {
    window_days: number
    posts_in_window: number
    posts_without_pillar: number
    posts_without_media_id: number
    events_attributed: number
    events_unattributed: number
    warnings: string[]
  }
}

const KINDS: GroupKind[] = ['pillar', 'recipe', 'format']
const DAY = 86400000

export function computeEightyTwenty(posts: PostRow[], events: EventRow[], perf: PerfRow[], cfg: LearningCfg = {}): LearningResult {
  const now = cfg.now ?? Date.now()
  const windowDays = cfg.windowDays ?? 56
  const minPosts = cfg.minPosts ?? 3
  const minDays = cfg.minDistinctDays ?? 2
  const wConv = cfg.weightConversa ?? 3
  const wIntent = cfg.weightIntent ?? 1
  const target = cfg.maintainTargetPct ?? 80
  const since = now - windowDays * DAY
  const warnings: string[] = []

  const inWindow = (posts ?? []).filter(p => {
    const t = p.published_at ? Date.parse(p.published_at) : NaN
    return Number.isFinite(t) && t >= since && t <= now
  })
  const perfBy = new Map<string, PerfRow>()
  for (const r of perf ?? []) perfBy.set(r.media_id, r)

  // conversas por media_id, deduplicadas por usuário do IG
  const convBy = new Map<string, Set<string>>()
  let evUnattributed = 0
  const mediaIds = new Set(inWindow.map(p => p.instagram_media_id).filter(Boolean) as string[])
  let evAttributed = 0
  for (const [i, e] of (events ?? []).entries()) {
    if (!e.intent_detected) continue
    const t = e.created_at ? Date.parse(e.created_at) : NaN
    if (Number.isFinite(t) && (t < since || t > now)) continue
    if (!e.media_ref || !mediaIds.has(e.media_ref)) { evUnattributed++; continue }
    const set = convBy.get(e.media_ref) ?? new Set<string>()
    set.add(String(e.ig_user_id ?? e.ig_user ?? `evt#${i}`))
    convBy.set(e.media_ref, set)
  }
  for (const s of convBy.values()) evAttributed += s.size

  type Acc = { posts: number; days: Set<string>; conv: number; saves: number; shares: number; hasSaves: boolean; hasShares: boolean }
  const accs = new Map<string, { key: string; kind: GroupKind; a: Acc }>()
  const withoutPillar = inWindow.filter(p => !p.pillar).length
  const withoutMedia = inWindow.filter(p => !p.instagram_media_id).length

  for (const p of inWindow) {
    const mid = p.instagram_media_id
    const pr = mid ? perfBy.get(mid) : undefined
    const conv = mid ? (convBy.get(mid)?.size ?? 0) : 0
    const day = String(p.published_at).slice(0, 10)
    for (const kind of KINDS) {
      const key = p[kind]
      if (!key) continue
      const id = `${kind}:${key}`
      const g = accs.get(id) ?? { key, kind, a: { posts: 0, days: new Set(), conv: 0, saves: 0, shares: 0, hasSaves: false, hasShares: false } }
      g.a.posts++; g.a.days.add(day); g.a.conv += conv
      if (pr && pr.saves != null) { g.a.saves += pr.saves; g.a.hasSaves = true }
      if (pr && pr.shares != null) { g.a.shares += pr.shares; g.a.hasShares = true }
      accs.set(id, g)
    }
  }

  const groups: GroupResult[] = []
  const statusBy = {} as Record<GroupKind, 'ok' | 'insufficient_data'>
  for (const kind of KINDS) {
    const ofKind = [...accs.values()].filter(g => g.kind === kind).map(({ key, a }) => {
      const eligible = a.posts >= minPosts && a.days.size >= minDays
      const saves = a.hasSaves ? a.saves : null
      const shares = a.hasShares ? a.shares : null
      const score = eligible ? a.conv * wConv + ((saves ?? 0) + (shares ?? 0)) * wIntent : null
      const r: GroupResult = {
        key, kind, posts: a.posts, distinct_days: a.days.size, conversas: a.conv, saves, shares,
        score, rank: null, status: eligible ? 'test' : 'insufficient_data', suggested_share_pct: null,
      }
      return r
    })
    const eligible = ofKind.filter(g => g.score !== null).sort((x, y) => (y.score! - x.score!) || x.key.localeCompare(y.key))
    const totalConv = eligible.reduce((s, g) => s + g.conversas, 0)
    const totalScore = eligible.reduce((s, g) => s + (g.score ?? 0), 0)
    if (eligible.length < 2 || totalConv === 0 || totalScore <= 0) {
      statusBy[kind] = 'insufficient_data'
      for (const g of ofKind) { g.status = 'insufficient_data'; g.score = null }
    } else {
      statusBy[kind] = 'ok'
      let prev: number | null = null, rank = 0
      eligible.forEach((g, i) => { if (g.score !== prev) { rank = i + 1; prev = g.score }; g.rank = rank })
      let cum = 0
      for (const g of eligible) { g.status = cum < totalScore * target / 100 ? 'maintain' : 'test'; cum += g.score! }
      const maintain = eligible.filter(g => g.status === 'maintain')
      const test = eligible.filter(g => g.status === 'test')
      const mTotal = test.length ? target : 100
      const mScore = maintain.reduce((s, g) => s + g.score!, 0)
      for (const g of maintain) g.suggested_share_pct = Math.round((g.score! / mScore) * mTotal)
      for (const g of test) g.suggested_share_pct = Math.round((100 - target) / test.length)
      // ajusta arredondamento no primeiro (maior) pra somar 100
      const sum = eligible.reduce((s, g) => s + (g.suggested_share_pct ?? 0), 0)
      if (sum !== 100) eligible[0].suggested_share_pct = (eligible[0].suggested_share_pct ?? 0) + (100 - sum)
    }
    groups.push(...ofKind.sort((x, y) => (x.rank ?? 1e9) - (y.rank ?? 1e9) || y.posts - x.posts || x.key.localeCompare(y.key)))
  }

  if (!inWindow.length) warnings.push('Nenhum post publicado na janela.')
  if (withoutPillar) warnings.push(`${withoutPillar} post(s) sem pilar gravado (publicados antes desta medição) ficaram fora do cálculo por pilar.`)
  if (withoutMedia) warnings.push(`${withoutMedia} post(s) sem id do Instagram — conversas não puderam ser ligadas a eles.`)
  if (evUnattributed) warnings.push(`${evUnattributed} conversa(s) não ligadas a nenhum post da janela.`)
  if (statusBy.pillar === 'insufficient_data') warnings.push('Dados insuficientes por pilar: trate como desconhecido, não invente ranking.')

  return {
    status: statusBy.pillar,
    status_by_kind: statusBy,
    groups,
    basis: {
      window_days: windowDays, posts_in_window: inWindow.length, posts_without_pillar: withoutPillar,
      posts_without_media_id: withoutMedia, events_attributed: evAttributed, events_unattributed: evUnattributed, warnings,
    },
  }
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchLearning(admin: any, companyId: string, cfg: LearningCfg = {}): Promise<LearningResult> {
  const windowDays = cfg.windowDays ?? 56
  const sinceIso = new Date((cfg.now ?? Date.now()) - windowDays * DAY).toISOString()
  const { data: posts } = await admin.from('posts')
    .select('id, instagram_media_id, pillar, recipe, format, published_at')
    .eq('company_id', companyId).not('instagram_media_id', 'is', null).gte('published_at', sinceIso)
  const ids = (posts ?? []).map((p: PostRow) => p.instagram_media_id).filter(Boolean)
  const [perf, ev] = await Promise.all([
    ids.length ? admin.from('instagram_content_performance').select('media_id, saves, shares').eq('company_id', companyId).in('media_id', ids) : { data: [] },
    admin.from('engagement_events').select('media_ref, intent_detected, ig_user_id, ig_user, created_at').eq('company_id', companyId).not('intent_detected', 'is', null).gte('created_at', sinceIso),
  ])
  return computeEightyTwenty(posts ?? [], ev.data ?? [], perf.data ?? [], cfg)
}

// Bloco ADITIVO pro prompt do strategy-generate (refresh).
export function learningPromptBlock(r: LearningResult): string {
  if (r.status !== 'ok') {
    return `\nAPRENDIZADO 80/20 (calculado de dados reais, janela ${r.basis.window_days} dias): dados insuficientes — trate como desconhecido, não afirme qual pilar/formato funciona melhor.\n`
  }
  const lines = r.groups.map(g => `- ${g.kind} "${g.key}": ${g.posts} posts, ${g.conversas} conversas, saves ${g.saves ?? 'desconhecido'}, shares ${g.shares ?? 'desconhecido'}, ${g.status === 'insufficient_data' ? 'dados insuficientes' : `rank ${g.rank}, ${g.status === 'maintain' ? 'MANTER' : 'TESTAR'}, fatia sugerida ${g.suggested_share_pct}%`}`)
  return `\nAPRENDIZADO 80/20 (calculado por código a partir de dados reais, janela ${r.basis.window_days} dias; conversas pesam mais que saves+shares; curtidas/alcance ignorados). Use estes números exatos, não invente outros:\n${lines.join('\n')}\n${r.basis.warnings.length ? 'Avisos: ' + r.basis.warnings.join(' ') + '\n' : ''}`
}
