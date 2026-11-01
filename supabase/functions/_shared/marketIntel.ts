// Inteligência de Mercado ampla — LÓGICA PURA (sem banco, sem rede), testada em scripts/test-market-intel.mjs.
// Estágio 1 (contador de dólar + teto), Estágio 2 (notícias v2). O banco e a Tavily vivem em marketNewsRun.ts.
// Decisão do dono (2026-11-01): teto de US$ 5 por cliente por mês para Apify + Tavily, CONTADO DENTRO dos US$ 40 de
// spendCap.ts. Tudo de setor (tópicos, portais, janela) vem da ficha (`config.market_intel`, regra 6).
//
// Livro-caixa: `agent_performance` (mesmo padrão de photo_retouch), uma linha por chamada paga, com `cost_usd`.
//   task_key 'market_news_search'  = Tavily (notícias)      · fonte "news"
//   task_key 'market_intel_apify'  = Apify (Instagram, estágio futuro) · fonte "instagram"
// Reserva-se o custo estimado ANTES de cada chamada paga e ajusta depois; falha ao gravar a reserva = não chama.

/** Fontes pagas que dividem o teto. */
export const MARKET_SOURCES = ['instagram', 'news'] as const
export type MarketSource = typeof MARKET_SOURCES[number]
export const MARKET_TASK_KEYS: Record<MarketSource, string> = { news: 'market_news_search', instagram: 'market_intel_apify' }
export const ALL_MARKET_TASK_KEYS: string[] = Object.values(MARKET_TASK_KEYS)

export const MARKET_INTEL_CAP_DEFAULT_USD = 5
// Teto máximo aprovado pelo dono (2026-11-01): ficha e variável de ambiente só APERTAM, nunca passam disto.
export const HARD_MAX_CAP_USD = 5
export const capUsdOf = (v: number): number => Math.min(Number.isFinite(v) && v > 0 ? v : MARKET_INTEL_CAP_DEFAULT_USD, HARD_MAX_CAP_USD)
/** Preço de 1 busca básica da Tavily (1 crédito). A CONFIRMAR com o extrato; troque pelo secret TAVILY_COST_USD. Valor conservador. */
export const TAVILY_COST_DEFAULT_USD = 0.008
export const SEARCH_TIMEOUT_MS = 12_000
export const PARALLEL_SEARCHES = 3
/** Tetos rígidos do código (a ficha só aperta, nunca passa disso). */
export const HARD_MAX_SEARCHES_PER_DAY = 20
export const HARD_MAX_RESULTS = 10

const positive = (v: unknown, def: number): number => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : def }
export const capFromEnv = (env: string | undefined | null): number => positive(env, MARKET_INTEL_CAP_DEFAULT_USD)
export const tavilyCostFromEnv = (env: string | undefined | null): number => positive(env, TAVILY_COST_DEFAULT_USD)
export const envGet = (k: string): string | undefined => (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined)

const clamp = (v: unknown, lo: number, hi: number, def: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def }

// ---------- ficha ----------
export type SignalKind = 'launch' | 'infrastructure' | 'economy' | 'tourism' | 'news' | 'other'
/** Valores permitidos pelo CHECK de market_signals.kind que a coleta de notícias pode usar. */
export const NEWS_KINDS: SignalKind[] = ['launch', 'infrastructure', 'economy', 'tourism', 'news', 'other']

export interface NewsTopic { kind: SignalKind; query: { pt?: string; en?: string } }
export interface IntelNewsConfig {
  city: string
  topics: NewsTopic[]
  exclude_domains: string[]
  days: number
  max_regions: number
  max_results: number
  max_searches_per_day: number
  max_searches_per_month: number
  max_new_per_day: number
}
export interface IntelConfig { cap_usd?: number; split: Record<MarketSource, number>; news: IntelNewsConfig | null }

const hasVar = (q: string) => q.includes('{region}') || q.includes('{city}')

export function parseIntelConfig(raw: unknown): IntelConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const sp = (r.split && typeof r.split === 'object' ? r.split : {}) as Record<string, unknown>
  const split = { instagram: Math.max(0, Number(sp.instagram) || 0), news: Math.max(0, Number(sp.news) || 0) }
  if (split.instagram === 0 && split.news === 0) { split.instagram = 3; split.news = 2 }
  const capN = Number(r.cap_usd)
  const out: IntelConfig = { split, cap_usd: Number.isFinite(capN) && capN > 0 ? capN : undefined, news: null }
  const n = r.news
  if (n && typeof n === 'object') {
    const nn = n as Record<string, unknown>
    const city = typeof nn.city === 'string' ? nn.city.trim().slice(0, 80) : ''
    const topics: NewsTopic[] = []
    for (const t of (Array.isArray(nn.topics) ? nn.topics : []).slice(0, 12)) {
      if (!t || typeof t !== 'object') continue
      const tt = t as Record<string, unknown>
      const kind = String(tt.kind ?? '') as SignalKind
      if (!NEWS_KINDS.includes(kind)) continue
      const q = typeof tt.query === 'string' ? { pt: tt.query } : (tt.query && typeof tt.query === 'object' ? tt.query as Record<string, unknown> : {})
      const query = {
        pt: typeof q.pt === 'string' && hasVar(q.pt) ? q.pt.slice(0, 300) : undefined,
        en: typeof q.en === 'string' && hasVar(q.en) ? q.en.slice(0, 300) : undefined,
      }
      if (!query.pt && !query.en) continue
      topics.push({ kind, query })
    }
    if (topics.length) {
      out.news = {
        city, topics,
        exclude_domains: (Array.isArray(nn.exclude_domains) ? nn.exclude_domains : []).map(d => String(d ?? '').toLowerCase().trim()).filter(d => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)).slice(0, 50),
        days: clamp(nn.days, 1, 90, 30), max_regions: clamp(nn.max_regions, 1, 6, 3), max_results: clamp(nn.max_results, 1, HARD_MAX_RESULTS, 5),
        max_searches_per_day: clamp(nn.max_searches_per_day, 1, HARD_MAX_SEARCHES_PER_DAY, 8),
        max_searches_per_month: clamp(nn.max_searches_per_month, 1, 1000, 250),
        max_new_per_day: clamp(nn.max_new_per_day, 1, 30, 10),
      }
    }
  }
  return out
}

// ---------- dólar ----------
/** Orçamento da fonte no mês: o que a ficha reserva, reduzido proporcionalmente se a soma passar do teto. */
export function sourceBudget(split: Record<MarketSource, number>, capUsd: number, source: MarketSource): number {
  const sum = MARKET_SOURCES.reduce((s, k) => s + (split[k] || 0), 0)
  if (sum <= 0 || capUsd <= 0) return 0
  const scale = sum > capUsd ? capUsd / sum : 1
  return (split[source] || 0) * scale
}

/** Dias que faltam no mês (UTC), contando hoje. */
export function daysLeftInMonth(nowMs: number): number {
  const d = new Date(nowMs)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return last - d.getUTCDate() + 1
}
export const monthStartIso = (nowMs: number): string => { const d = new Date(nowMs); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString() }
export const dayStartIso = (nowMs: number): string => { const d = new Date(nowMs); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString() }

/** Plano de gasto: dólares que restam ÷ dias que restam ÷ custo = buscas de hoje (o que não se gasta hoje sobra pros próximos dias). */
export function searchesToday(o: { remainingUsd: number; daysLeft: number; costUsd: number }): number {
  if (!(o.remainingUsd > 0) || !(o.costUsd > 0)) return 0
  const perDay = Math.floor(o.remainingUsd / Math.max(1, o.daysLeft) / o.costUsd + 1e-9)
  return Math.max(0, Math.min(perDay, Math.floor(o.remainingUsd / o.costUsd + 1e-9)))
}

export interface LedgerRow { task_key: string; cost_usd: number | string | null; created_at?: string }
/** Gasto do mês por fonte, a partir das linhas do livro-caixa. */
export function spentBySource(rows: LedgerRow[]): Record<MarketSource, number> & { total: number } {
  const out = { instagram: 0, news: 0, total: 0 }
  for (const r of rows) {
    const c = Number(r.cost_usd || 0); if (!Number.isFinite(c) || c <= 0) continue
    if (r.task_key === MARKET_TASK_KEYS.news) out.news += c
    else if (r.task_key === MARKET_TASK_KEYS.instagram) out.instagram += c
  }
  out.total = out.news + out.instagram
  return out
}
/** Sobra para a fonte: o menor entre o que resta da fatia dela e o que resta do teto total. */
export function remainingFor(source: MarketSource, o: { split: Record<MarketSource, number>; capUsd: number; spent: Record<MarketSource, number> & { total: number } }): number {
  return Math.max(0, Math.min(sourceBudget(o.split, o.capUsd, source) - o.spent[source], o.capUsd - o.spent.total))
}

// ---------- rotação ----------
/** Unidades de busca (tópico × região) e rotação diária: cada dia começa onde o anterior parou, até cobrir tudo. */
export interface SearchUnit { topic: NewsTopic; region: string; cityLevel: boolean }
export function buildUnits(topics: NewsTopic[], regions: string[], city: string, lang: 'pt' | 'en'): (SearchUnit & { query: string })[] {
  const out: (SearchUnit & { query: string })[] = []
  for (const topic of topics) {
    const tpl = (lang === 'en' ? topic.query.en : topic.query.pt) ?? topic.query.pt ?? topic.query.en
    if (!tpl) continue
    if (tpl.includes('{region}')) {
      for (const region of regions) out.push({ topic, region, cityLevel: false, query: tpl.replace(/\{region\}/g, region).replace(/\{city\}/g, city) })
    } else if (city) {
      out.push({ topic, region: city, cityLevel: true, query: tpl.replace(/\{city\}/g, city) })
    }
  }
  return out
}
export const dayNumber = (nowMs: number): number => Math.floor(nowMs / 86400_000)
export function rotate<T>(units: T[], n: number, day: number): T[] {
  if (!units.length || n <= 0) return []
  const take = Math.min(n, units.length)
  const start = (((day * take) % units.length) + units.length) % units.length
  return Array.from({ length: take }, (_, i) => units[(start + i) % units.length])
}

// ---------- dedupe ----------
/** URL sem rastreio (utm_*, fbclid, gclid…), sem #fragmento e sem "/" final; host em minúsculas e sem "www.". null se não for https. */
export function normalizeUrl(url: unknown): string | null {
  try {
    const u = new URL(String(url ?? '').trim())
    if (u.protocol !== 'https:') return null
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k) || ['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'igshid'].includes(k.toLowerCase())) u.searchParams.delete(k)
    u.searchParams.sort()
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : u.pathname
    return `https://${u.host}${path}${u.search}`
  } catch { return null }
}
/** Título comparável: sem acento/caixa/pontuação, espaços colapsados. */
export const normalizeTitle = (s: unknown): string => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
