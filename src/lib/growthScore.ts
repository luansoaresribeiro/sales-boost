import type { PlaybookQuestion } from './verticalPlaybook'
import { hasAnswer, itemHasEnoughPhotos, type ItemMetaLike } from './setupRules'

type Lang = 'pt' | 'en'
type Tr = (pt: string, en: string) => string
const trOf = (lang: Lang): Tr => (pt, en) => (lang === 'en' ? en : pt)

// Growth Score (etapa 2b, fatia 1). Função PURA: sem rede, sem relógio global.
// Centrado no Instagram coletado por scraper; site e Google são adendo.
// Regra 5: critério sem dado = "não avaliado" e SAI da conta (não penaliza).
// Os campos de `instagram_data` são gravados por supabase/functions/run-diagnosis.

export type CriterionKey = 'frequency' | 'engagement' | 'format' | 'profile' | 'addon' | 'setup'

/** Pesos (soma 100). Exportado pra tela "Como calculamos". */
export const CRITERIA_WEIGHTS: Record<CriterionKey, number> = {
  frequency: 25, engagement: 25, format: 15, profile: 15, addon: 10, setup: 10,
}

export interface CriterionInfo { label: string; rule: string }
export const CRITERIA_INFO: Record<CriterionKey, CriterionInfo> = {
  frequency: { label: 'Frequência de posts', rule: '0 posts em 30 dias = 0 pontos; 8 ou mais = pontuação cheia; entre os dois, proporcional.' },
  engagement: { label: 'Engajamento', rule: 'Média de curtidas + comentários dos posts recentes ÷ seguidores. 0% = 0 pontos; 3% ou mais = pontuação cheia.' },
  format: { label: 'Formato (vídeos e Reels)', rule: 'Fração de vídeos/Reels nos posts recentes. 0% = 0 pontos; 50% ou mais = pontuação cheia.' },
  profile: { label: 'Perfil pronto pra vender', rule: 'Partes iguais: bio preenchida, link na bio, conta comercial/profissional e destaques (só entram as partes que conseguimos ver).' },
  addon: { label: 'Site e Google (adendo)', rule: 'Média das notas de velocidade do site e da nota no Google, quando existirem. Sem site e sem Google, não entra na conta.' },
  setup: { label: 'Dados preenchidos', rule: 'Só depois do cadastro: perguntas do seu negócio respondidas e itens com fotos suficientes.' },
}

export const CRITERIA_INFO_EN: Record<CriterionKey, CriterionInfo> = {
  frequency: { label: 'Posting frequency', rule: '0 posts in 30 days = 0 points; 8 or more = full score; in between, proportional.' },
  engagement: { label: 'Engagement', rule: 'Average likes + comments on recent posts ÷ followers. 0% = 0 points; 3% or more = full score.' },
  format: { label: 'Format (videos and Reels)', rule: 'Share of videos/Reels in recent posts. 0% = 0 points; 50% or more = full score.' },
  profile: { label: 'Profile ready to sell', rule: 'Equal parts: filled-in bio, link in bio, business/professional account and highlights (only the parts we can see count).' },
  addon: { label: 'Website and Google (add-on)', rule: 'Average of the website speed scores and the Google rating, when they exist. With no website and no Google, it does not count.' },
  setup: { label: 'Data filled in', rule: 'Only after sign-up: your business questions answered and items with enough photos.' },
}

export const VERDICT_BANDS_EN = [
  { verdict: 'ready', label: 'Growth Ready', range: '70 to 100' },
  { verdict: 'potential', label: 'Growth Potential', range: '40 to 69' },
  { verdict: 'blocked', label: 'Growth Blocked', range: '0 to 39' },
] as const

export const VERDICT_BANDS = [
  { verdict: 'ready', label: 'Growth Ready', range: '70 a 100' },
  { verdict: 'potential', label: 'Growth Potential', range: '40 a 69' },
  { verdict: 'blocked', label: 'Growth Blocked', range: '0 a 39' },
] as const

export const MIN_COVERAGE = 40 // abaixo disso: "Análise parcial"
export const FREQ_FULL_POSTS = 8
export const ENGAGEMENT_FULL_PCT = 3
export const FORMAT_FULL_FRACTION = 0.5
export const WINDOW_DAYS = 30

export interface IgPost { ts: string | null; likes: number | null; comments: number | null; is_video: boolean | null }

/** Formato enxuto gravado em diagnostics.instagram_data. */
export interface InstagramData {
  collected_at?: string
  error?: string
  username?: string | null
  followers?: number | null
  biography?: string | null
  external_url?: string | null
  is_business?: boolean | null
  highlights?: number | null
  posts_total?: number | null
  posts?: IgPost[]
}

interface PagespeedLike { scores?: { performance: number; seo: number; accessibility: number; best_practices: number } }

export interface SetupInput {
  questions: PlaybookQuestion[]
  answers: Record<string, unknown> | null | undefined
  items: ItemMetaLike[]
  minPhotos: number
  minItems: number
}

export interface GrowthScoreInput {
  instagram_data?: InstagramData | null
  pagespeed_mobile?: PagespeedLike | null
  pagespeed_desktop?: PagespeedLike | null
  google_rating?: number | null // 0-5; hoje o diagnóstico ainda não guarda isso
  setup?: SetupInput | null
}

export interface CriterionResult {
  key: CriterionKey
  label: string
  weight: number
  evaluated: boolean
  points: number // 0..weight (0 se não avaliado)
  value: string // valor real usado, ex.: "5 posts em 30 dias"
  reason: string // por que avaliado/não avaliado
}

export type Verdict = 'ready' | 'potential' | 'blocked'
export interface GrowthScoreResult {
  state: 'scored' | 'partial'
  score: number | null // null quando parcial
  verdict: Verdict | null
  verdictLabel: string | null
  coverage: number // 0..100
  rawScore: number | null // nota dos critérios avaliados, mesmo se parcial
  criteria: CriterionResult[]
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const round1 = (n: number) => Math.round(n * 10) / 10
const NE = (key: CriterionKey, reason: string, lang: Lang = 'pt'): CriterionResult =>
  ({ key, label: (lang === 'en' ? CRITERIA_INFO_EN : CRITERIA_INFO)[key].label, weight: CRITERIA_WEIGHTS[key], evaluated: false, points: 0, value: lang === 'en' ? 'Not evaluated' : 'Não avaliado', reason })
const OK = (key: CriterionKey, fraction: number, value: string, reason: string, lang: Lang = 'pt'): CriterionResult => {
  const w = CRITERIA_WEIGHTS[key]
  return { key, label: (lang === 'en' ? CRITERIA_INFO_EN : CRITERIA_INFO)[key].label, weight: w, evaluated: true, points: round1(clamp01(fraction) * w), value, reason }
}

function validIg(d: InstagramData | null | undefined): d is InstagramData {
  return !!d && !d.error && typeof d.followers === 'number' && Array.isArray(d.posts)
}

function plural(n: number, s: string, p: string) { return `${n} ${n === 1 ? s : p}` }
const numFmt = (n: string, lang: Lang) => (lang === 'en' ? n : n.replace('.', ','))

function frequency(d: InstagramData | null | undefined, lang: Lang = 'pt'): CriterionResult {
  const L = trOf(lang)
  if (!validIg(d)) return NE('frequency', L('Não conseguimos ler os posts do Instagram.', 'We could not read the Instagram posts.'), lang)
  const ref = d.collected_at ? new Date(d.collected_at).getTime() : NaN
  if (Number.isNaN(ref)) return NE('frequency', L('Sem data da coleta.', 'No collection date.'), lang)
  const posts = d.posts ?? []
  if (posts.length === 0) {
    // Perfil privado também devolve lista vazia: só vale 0 se o perfil declara 0 posts.
    if (d.posts_total === 0) return OK('frequency', 0, L('0 posts em 30 dias', '0 posts in 30 days'), L('Perfil sem posts.', 'Profile with no posts.'), lang)
    return NE('frequency', L('Não conseguimos ler os posts (perfil privado ou sem acesso).', 'We could not read the posts (private profile or no access).'), lang)
  }
  const from = ref - WINDOW_DAYS * 86400000
  const dated = posts.filter(p => p.ts && !Number.isNaN(new Date(p.ts).getTime()))
  if (dated.length === 0) return NE('frequency', L('Os posts vieram sem data.', 'The posts came without dates.'), lang)
  const n = dated.filter(p => { const t = new Date(p.ts as string).getTime(); return t >= from && t <= ref + 86400000 }).length
  return OK('frequency', n / FREQ_FULL_POSTS, lang === 'en' ? plural(n, 'post', 'posts') + ' in 30 days' : plural(n, 'post', 'posts') + ' em 30 dias', L('Posts dos últimos 30 dias.', 'Posts from the last 30 days.'), lang)
}

function engagement(d: InstagramData | null | undefined, lang: Lang = 'pt'): CriterionResult {
  const L = trOf(lang)
  if (!validIg(d)) return NE('engagement', L('Não conseguimos ler os posts do Instagram.', 'We could not read the Instagram posts.'), lang)
  if (!d.followers || d.followers <= 0) return NE('engagement', L('Sem seguidores, não dá pra calcular a taxa.', 'With no followers, the rate cannot be calculated.'), lang)
  // curtidas ocultas vêm como -1 (ou ausentes): esse post não entra
  const usable = (d.posts ?? []).filter(p => typeof p.likes === 'number' && p.likes >= 0)
  if (usable.length === 0) return NE('engagement', L('Sem posts com curtidas visíveis.', 'No posts with visible likes.'), lang)
  const avg = usable.reduce((s, p) => s + (p.likes as number) + Math.max(0, p.comments ?? 0), 0) / usable.length
  const pct = (avg / d.followers) * 100
  return OK('engagement', pct / ENGAGEMENT_FULL_PCT, L(`${pct.toFixed(1).replace('.', ',')}% (média de ${Math.round(avg)} interações por post)`, `${pct.toFixed(1)}% (average of ${Math.round(avg)} interactions per post)`), L(`Em ${plural(usable.length, 'post', 'posts')} recentes.`, `Across ${plural(usable.length, 'recent post', 'recent posts')}.`), lang)
}

function format(d: InstagramData | null | undefined, lang: Lang = 'pt'): CriterionResult {
  const L = trOf(lang)
  if (!validIg(d)) return NE('format', L('Não conseguimos ler os posts do Instagram.', 'We could not read the Instagram posts.'), lang)
  const known = (d.posts ?? []).filter(p => typeof p.is_video === 'boolean')
  if (known.length === 0) return NE('format', L('Não conseguimos identificar o tipo dos posts.', 'We could not identify the type of the posts.'), lang)
  const vids = known.filter(p => p.is_video).length
  const frac = vids / known.length
  return OK('format', frac / FORMAT_FULL_FRACTION, L(`${vids} de ${known.length} posts são vídeo/Reels (${Math.round(frac * 100)}%)`, `${vids} of ${known.length} posts are video/Reels (${Math.round(frac * 100)}%)`), L('Posts recentes.', 'Recent posts.'), lang)
}

function profile(d: InstagramData | null | undefined, lang: Lang = 'pt'): CriterionResult {
  const L = trOf(lang)
  if (!validIg(d)) return NE('profile', L('Não conseguimos ler o perfil do Instagram.', 'We could not read the Instagram profile.'), lang)
  const parts: { name: string; ok: boolean }[] = [
    { name: L('bio', 'bio'), ok: !!d.biography && d.biography.trim() !== '' },
    { name: L('link na bio', 'link in bio'), ok: !!d.external_url && d.external_url.trim() !== '' },
  ]
  if (typeof d.is_business === 'boolean') parts.push({ name: L('conta comercial', 'business account'), ok: d.is_business })
  if (typeof d.highlights === 'number') parts.push({ name: L('destaques', 'highlights'), ok: d.highlights > 0 })
  const okN = parts.filter(p => p.ok).length
  const missing = parts.filter(p => !p.ok).map(p => p.name)
  return OK('profile', okN / parts.length, L(`${okN} de ${parts.length} itens (${missing.length ? 'falta: ' + missing.join(', ') : 'tudo certo'})`, `${okN} of ${parts.length} items (${missing.length ? 'missing: ' + missing.join(', ') : 'all good'})`), L('Bio, link, conta comercial e destaques, quando visíveis.', 'Bio, link, business account and highlights, when visible.'), lang)
}

function psAvg(p: PagespeedLike | null | undefined): number | null {
  const s = p?.scores
  if (!s) return null
  const v = [s.performance, s.seo, s.accessibility, s.best_practices]
  if (v.some(x => typeof x !== 'number')) return null
  return v.reduce((a, b) => a + b, 0) / 4
}

function addon(i: GrowthScoreInput, lang: Lang = 'pt'): CriterionResult {
  const L = trOf(lang)
  const fr: number[] = []
  const bits: string[] = []
  const ps = [psAvg(i.pagespeed_mobile), psAvg(i.pagespeed_desktop)].filter((x): x is number => x !== null)
  if (ps.length) {
    const a = ps.reduce((x, y) => x + y, 0) / ps.length
    fr.push(a / 100)
    bits.push(L(`site ${Math.round(a)}/100`, `website ${Math.round(a)}/100`))
  }
  if (typeof i.google_rating === 'number' && i.google_rating > 0) {
    fr.push(clamp01(i.google_rating / 5))
    bits.push(`Google ${numFmt(i.google_rating.toFixed(1), lang)}/5`)
  }
  if (!fr.length) return NE('addon', L('Sem site analisado nem nota no Google. Isso não tira pontos.', 'No website analyzed and no Google rating. This does not cost points.'), lang)
  return OK('addon', fr.reduce((a, b) => a + b, 0) / fr.length, bits.join(' · '), L('Média das notas disponíveis.', 'Average of the available scores.'), lang)
}

function setup(s: SetupInput | null | undefined, lang: Lang = 'pt'): CriterionResult {
  const L = trOf(lang)
  if (!s) return NE('setup', L('Entra na conta só depois do cadastro.', 'Counts only after sign-up.'), lang)
  const q = s.questions.length
  const answered = q - s.questions.filter(x => !hasAnswer(s.answers?.[x.key])).length
  const okItems = s.items.filter(m => itemHasEnoughPhotos(m, s.minPhotos)).length
  const qFrac = q > 0 ? answered / q : 1
  const iFrac = s.minItems > 0 ? Math.min(1, okItems / s.minItems) : 1
  return OK('setup', (qFrac + iFrac) / 2, L(`${answered} de ${q} perguntas respondidas · ${okItems} de ${s.minItems} itens com fotos`, `${answered} of ${q} questions answered · ${okItems} of ${s.minItems} items with photos`), L('Perguntas da ficha e itens com fotos reais.', 'Playbook questions and items with real photos.'), lang)
}

export function computeGrowthScore(input: GrowthScoreInput, lang: Lang = 'pt'): GrowthScoreResult {
  const ig = input.instagram_data
  const criteria: CriterionResult[] = [
    frequency(ig, lang), engagement(ig, lang), format(ig, lang), profile(ig, lang), addon(input, lang), setup(input.setup, lang),
  ]
  const ev = criteria.filter(c => c.evaluated)
  const weights = ev.reduce((s, c) => s + c.weight, 0)
  const pts = ev.reduce((s, c) => s + c.points, 0)
  const coverage = Math.round(weights) // pesos somam 100
  const raw = weights > 0 ? Math.round((pts / weights) * 100) : null
  const igEvaluated = ev.some(c => ['frequency', 'engagement', 'format', 'profile'].includes(c.key))
  if (raw === null || !igEvaluated || coverage < MIN_COVERAGE) {
    return { state: 'partial', score: null, verdict: null, verdictLabel: null, coverage, rawScore: raw, criteria }
  }
  const bands = lang === 'en' ? VERDICT_BANDS_EN : VERDICT_BANDS
  const band = raw >= 70 ? bands[0] : raw >= 40 ? bands[1] : bands[2]
  return { state: 'scored', score: raw, verdict: band.verdict, verdictLabel: band.label, coverage, rawScore: raw, criteria }
}

// ── Maior gargalo e maior oportunidade (2026-10-08) ──────────────────────
// Regra fixa e explicável (sem IA, sem número inventado): o gargalo é o
// critério do Instagram AVALIADO com a menor fração de pontos; a
// oportunidade é a ação ligada a ele. Texto genérico (regra 6: nada de setor
// no código). Se tudo avaliado está cheio, não há gargalo.
type GapKey = 'frequency' | 'engagement' | 'format' | 'profile'
const GAP_TEXT: Record<'pt' | 'en', Record<GapKey, { why: string; action: string }>> = {
  pt: {
    frequency: { why: 'Você publica pouco: quem te segue quase não vê seu perfil no feed.', action: 'Publicar com constância (a nota considera 8 posts em 30 dias como cheio). O Sales Boost prepara os posts e você só aprova.' },
    engagement: { why: 'Poucas pessoas interagem com seus posts, então o Instagram mostra menos o seu perfil.', action: 'Posts que puxam conversa (perguntas, bastidores, dicas) e responder rápido cada comentário e mensagem.' },
    format: { why: 'Você usa pouco vídeo/Reels, o formato que mais leva seu perfil a gente nova.', action: 'Transformar as fotos reais dos seus itens em vídeos curtos. É o vídeo grátis que o Sales Boost gera pra você.' },
    profile: { why: 'Quem chega no seu perfil não entende rápido o que você oferece nem como falar com você.', action: 'Bio clara (o que você faz e onde atende), link na bio para o WhatsApp e conta profissional.' },
  },
  en: {
    frequency: { why: 'You post rarely: your followers barely see your profile in their feed.', action: 'Post consistently (the score counts 8 posts in 30 days as full). Sales Boost prepares the posts and you just approve.' },
    engagement: { why: 'Few people interact with your posts, so Instagram shows your profile less.', action: 'Posts that start conversations (questions, behind the scenes, tips) and fast replies to every comment and message.' },
    format: { why: 'You use little video/Reels, the format that best reaches new people.', action: 'Turn real photos of your listings into short videos. That is the free video Sales Boost generates for you.' },
    profile: { why: 'People who land on your profile cannot quickly see what you offer or how to reach you.', action: 'A clear bio (what you do and where), a link to WhatsApp in the bio and a professional account.' },
  },
}

export interface GapInfo { key: GapKey; label: string; why: string; action: string }

export function biggestGap(result: GrowthScoreResult, lang: Lang = 'pt'): GapInfo | null {
  return topGaps(result, lang, 1)[0]?.gap ?? null
}

// ── Principais problemas + potencial (2026-10-08) ─────────────────────────
// Até `max` critérios do Instagram AVALIADOS e incompletos, do mais fraco pro
// mais forte. `gain` = quantos pontos da NOSSA nota (0-100) aquele critério
// devolve se ficar cheio — mesma fórmula do computeGrowthScore, nada de
// número de mercado (regra 5). Potencial = nota atual + ganhos (máx. 100).
export interface GapWithGain { gap: GapInfo; gain: number }

export function topGaps(result: GrowthScoreResult, lang: Lang = 'pt', max = 3): GapWithGain[] {
  const keys: GapKey[] = ['frequency', 'engagement', 'format', 'profile']
  const evWeights = result.criteria.filter(c => c.evaluated).reduce((s, c) => s + c.weight, 0)
  if (evWeights <= 0) return []
  const text = GAP_TEXT[lang === 'en' ? 'en' : 'pt']
  return result.criteria
    .filter(c => c.evaluated && (keys as string[]).includes(c.key) && c.weight > 0 && c.points < c.weight)
    .sort((a, b) => a.points / a.weight - b.points / b.weight || (b.weight - b.points) - (a.weight - a.points))
    .slice(0, max)
    .map(c => ({
      gap: { key: c.key as GapKey, label: c.label, ...text[c.key as GapKey] },
      gain: Math.round(((c.weight - c.points) / evWeights) * 100),
    }))
    .filter(g => g.gain > 0)
}

/** Nota possível corrigindo os gargalos de topGaps; null sem nota (análise parcial). */
export function potentialScore(result: GrowthScoreResult, gaps: GapWithGain[]): number | null {
  if (result.score === null) return null
  return Math.min(100, result.score + gaps.reduce((s, g) => s + g.gain, 0))
}
