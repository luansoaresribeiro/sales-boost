import type { PlaybookQuestion } from './verticalPlaybook'
import { hasAnswer, itemHasEnoughPhotos, type ItemMetaLike } from './setupRules'

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
const NE = (key: CriterionKey, reason: string): CriterionResult =>
  ({ key, label: CRITERIA_INFO[key].label, weight: CRITERIA_WEIGHTS[key], evaluated: false, points: 0, value: 'Não avaliado', reason })
const OK = (key: CriterionKey, fraction: number, value: string, reason: string): CriterionResult => {
  const w = CRITERIA_WEIGHTS[key]
  return { key, label: CRITERIA_INFO[key].label, weight: w, evaluated: true, points: round1(clamp01(fraction) * w), value, reason }
}

function validIg(d: InstagramData | null | undefined): d is InstagramData {
  return !!d && !d.error && typeof d.followers === 'number' && Array.isArray(d.posts)
}

function plural(n: number, s: string, p: string) { return `${n} ${n === 1 ? s : p}` }

function frequency(d: InstagramData | null | undefined): CriterionResult {
  if (!validIg(d)) return NE('frequency', 'Não conseguimos ler os posts do Instagram.')
  const ref = d.collected_at ? new Date(d.collected_at).getTime() : NaN
  if (Number.isNaN(ref)) return NE('frequency', 'Sem data da coleta.')
  const posts = d.posts ?? []
  if (posts.length === 0) {
    // Perfil privado também devolve lista vazia: só vale 0 se o perfil declara 0 posts.
    if (d.posts_total === 0) return OK('frequency', 0, '0 posts em 30 dias', 'Perfil sem posts.')
    return NE('frequency', 'Não conseguimos ler os posts (perfil privado ou sem acesso).')
  }
  const from = ref - WINDOW_DAYS * 86400000
  const dated = posts.filter(p => p.ts && !Number.isNaN(new Date(p.ts).getTime()))
  if (dated.length === 0) return NE('frequency', 'Os posts vieram sem data.')
  const n = dated.filter(p => { const t = new Date(p.ts as string).getTime(); return t >= from && t <= ref + 86400000 }).length
  return OK('frequency', n / FREQ_FULL_POSTS, plural(n, 'post', 'posts') + ' em 30 dias', 'Posts dos últimos 30 dias.')
}

function engagement(d: InstagramData | null | undefined): CriterionResult {
  if (!validIg(d)) return NE('engagement', 'Não conseguimos ler os posts do Instagram.')
  if (!d.followers || d.followers <= 0) return NE('engagement', 'Sem seguidores, não dá pra calcular a taxa.')
  // curtidas ocultas vêm como -1 (ou ausentes): esse post não entra
  const usable = (d.posts ?? []).filter(p => typeof p.likes === 'number' && p.likes >= 0)
  if (usable.length === 0) return NE('engagement', 'Sem posts com curtidas visíveis.')
  const avg = usable.reduce((s, p) => s + (p.likes as number) + Math.max(0, p.comments ?? 0), 0) / usable.length
  const pct = (avg / d.followers) * 100
  return OK('engagement', pct / ENGAGEMENT_FULL_PCT, `${pct.toFixed(1).replace('.', ',')}% (média de ${Math.round(avg)} interações por post)`, `Em ${plural(usable.length, 'post', 'posts')} recentes.`)
}

function format(d: InstagramData | null | undefined): CriterionResult {
  if (!validIg(d)) return NE('format', 'Não conseguimos ler os posts do Instagram.')
  const known = (d.posts ?? []).filter(p => typeof p.is_video === 'boolean')
  if (known.length === 0) return NE('format', 'Não conseguimos identificar o tipo dos posts.')
  const vids = known.filter(p => p.is_video).length
  const frac = vids / known.length
  return OK('format', frac / FORMAT_FULL_FRACTION, `${vids} de ${known.length} posts são vídeo/Reels (${Math.round(frac * 100)}%)`, 'Posts recentes.')
}

function profile(d: InstagramData | null | undefined): CriterionResult {
  if (!validIg(d)) return NE('profile', 'Não conseguimos ler o perfil do Instagram.')
  const parts: { name: string; ok: boolean }[] = [
    { name: 'bio', ok: !!d.biography && d.biography.trim() !== '' },
    { name: 'link na bio', ok: !!d.external_url && d.external_url.trim() !== '' },
  ]
  if (typeof d.is_business === 'boolean') parts.push({ name: 'conta comercial', ok: d.is_business })
  if (typeof d.highlights === 'number') parts.push({ name: 'destaques', ok: d.highlights > 0 })
  const okN = parts.filter(p => p.ok).length
  const missing = parts.filter(p => !p.ok).map(p => p.name)
  return OK('profile', okN / parts.length, `${okN} de ${parts.length} itens (${missing.length ? 'falta: ' + missing.join(', ') : 'tudo certo'})`, 'Bio, link, conta comercial e destaques, quando visíveis.')
}

function psAvg(p: PagespeedLike | null | undefined): number | null {
  const s = p?.scores
  if (!s) return null
  const v = [s.performance, s.seo, s.accessibility, s.best_practices]
  if (v.some(x => typeof x !== 'number')) return null
  return v.reduce((a, b) => a + b, 0) / 4
}

function addon(i: GrowthScoreInput): CriterionResult {
  const fr: number[] = []
  const bits: string[] = []
  const ps = [psAvg(i.pagespeed_mobile), psAvg(i.pagespeed_desktop)].filter((x): x is number => x !== null)
  if (ps.length) {
    const a = ps.reduce((x, y) => x + y, 0) / ps.length
    fr.push(a / 100)
    bits.push(`site ${Math.round(a)}/100`)
  }
  if (typeof i.google_rating === 'number' && i.google_rating > 0) {
    fr.push(clamp01(i.google_rating / 5))
    bits.push(`Google ${i.google_rating.toFixed(1).replace('.', ',')}/5`)
  }
  if (!fr.length) return NE('addon', 'Sem site analisado nem nota no Google. Isso não tira pontos.')
  return OK('addon', fr.reduce((a, b) => a + b, 0) / fr.length, bits.join(' · '), 'Média das notas disponíveis.')
}

function setup(s: SetupInput | null | undefined): CriterionResult {
  if (!s) return NE('setup', 'Entra na conta só depois do cadastro.')
  const q = s.questions.length
  const answered = q - s.questions.filter(x => !hasAnswer(s.answers?.[x.key])).length
  const okItems = s.items.filter(m => itemHasEnoughPhotos(m, s.minPhotos)).length
  const qFrac = q > 0 ? answered / q : 1
  const iFrac = s.minItems > 0 ? Math.min(1, okItems / s.minItems) : 1
  return OK('setup', (qFrac + iFrac) / 2, `${answered} de ${q} perguntas respondidas · ${okItems} de ${s.minItems} itens com fotos`, 'Perguntas da ficha e itens com fotos reais.')
}

export function computeGrowthScore(input: GrowthScoreInput): GrowthScoreResult {
  const ig = input.instagram_data
  const criteria: CriterionResult[] = [
    frequency(ig), engagement(ig), format(ig), profile(ig), addon(input), setup(input.setup),
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
  const band = raw >= 70 ? VERDICT_BANDS[0] : raw >= 40 ? VERDICT_BANDS[1] : VERDICT_BANDS[2]
  return { state: 'scored', score: raw, verdict: band.verdict, verdictLabel: band.label, coverage, rawScore: raw, criteria }
}
