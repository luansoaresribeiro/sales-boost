// Notícias de mercado automáticas (Inteligência comercial, Etapa 3) — LÓGICA PURA (sem banco, sem rede), testada em
// scripts/test-market-news.mjs. O banco e a Tavily vivem em marketNewsRun.ts. Tudo de setor (busca, portais, limites)
// vem da ficha (`config.market_news`, regra 6). Nada é inventado: o sinal guarda título, trecho, domínio, link e data
// da própria fonte; sem data válida, sem região no texto, portal de anúncio ou link não-https = descartado.

export interface MarketNewsConfig {
  queries: { pt?: string; en?: string }
  exclude_domains: string[]
  days: number
  max_regions: number
  max_results: number
  max_new_per_week: number
}
export interface TavilyHit { title?: unknown; url?: unknown; content?: unknown; published_date?: unknown }
export interface NewsSignal { kind: 'news'; region: string; title: string; summary: string | null; source_name: string; source_url: string; observed_at: string; collected_by: 'system'; meta: { provider: 'tavily' } }

/** Limites rígidos (a ficha só pode apertar, nunca passar disso). */
export const MAX_SEARCHES_PER_WEEK = 3
export const MAX_NEW_PER_WEEK = 5
export const DEFAULT_MONTHLY_CAP = 120
export const SEARCH_TIMEOUT_MS = 12_000
export const WEEK_MS = 7 * 86400_000
export const MONTH_MS = 30 * 86400_000
export const TASK_KEY = 'market_news_search'

const clamp = (v: unknown, lo: number, hi: number, def: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def }

/** Lê a chave da ficha; sem busca definida = null (setor sem coleta). */
export function parseNewsConfig(raw: unknown): MarketNewsConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const q = (r.queries && typeof r.queries === 'object' ? r.queries : {}) as Record<string, unknown>
  const queries = {
    pt: typeof q.pt === 'string' && q.pt.includes('{region}') ? q.pt.slice(0, 300) : undefined,
    en: typeof q.en === 'string' && q.en.includes('{region}') ? q.en.slice(0, 300) : undefined,
  }
  if (!queries.pt && !queries.en) return null
  const domains = (Array.isArray(r.exclude_domains) ? r.exclude_domains : []).map(d => String(d ?? '').toLowerCase().trim()).filter(d => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)).slice(0, 50)
  return {
    queries, exclude_domains: domains,
    days: clamp(r.days, 1, 90, 30), max_regions: clamp(r.max_regions, 1, MAX_SEARCHES_PER_WEEK, 3),
    max_results: clamp(r.max_results, 1, 10, 5), max_new_per_week: clamp(r.max_new_per_week, 1, MAX_NEW_PER_WEEK, MAX_NEW_PER_WEEK),
  }
}

export const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Regiões do catálogo com mais itens (valor EXATO do catálogo; grafias que só mudam em caixa/acento somam juntas). */
export function pickRegions(values: unknown[], max: number): string[] {
  const groups = new Map<string, { count: number; spelled: Map<string, number> }>()
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s || s.length > 120) continue
    const k = normalize(s)
    const g = groups.get(k) ?? { count: 0, spelled: new Map() }
    g.count++; g.spelled.set(s, (g.spelled.get(s) ?? 0) + 1)
    groups.set(k, g)
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, max))
    .map(([, g]) => [...g.spelled.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0])
}

export const buildQuery = (template: string, region: string): string => template.replace(/\{region\}/g, region)

/** Domínio sem "www."; null se a URL não for https válida. */
export function httpsHost(url: unknown): string | null {
  try {
    const u = new URL(String(url ?? ''))
    return u.protocol === 'https:' ? u.hostname.toLowerCase().replace(/^www\./, '') : null
  } catch { return null }
}
export const isExcluded = (host: string, domains: string[]): boolean => domains.some(d => host === d || host.endsWith('.' + d))

/** Texto da fonte sem HTML/controle/link solto, em uma linha, cortado em `max` (sem inventar nada). */
export function sanitizeText(s: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  const t = String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

export function mentionsRegion(region: string, ...texts: unknown[]): boolean {
  const r = normalize(region).trim()
  if (!r) return false
  const re = new RegExp(`(^|[^a-z0-9])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`)
  return texts.some(t => re.test(normalize(String(t ?? ''))))
}

/** Data da fonte -> 'YYYY-MM-DD' (UTC); null se ausente/inválida/futura/mais velha que `days`. */
export function validSourceDate(v: unknown, nowMs: number, days: number): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const t = Date.parse(v)
  if (!Number.isFinite(t) || t > nowMs || nowMs - t > days * 86400_000) return null
  return new Date(t).toISOString().slice(0, 10)
}

/** Resultado da Tavily -> sinais aceitos (os filtros de verdade, em código). `seen` evita repetir link. */
export function filterHits(hits: TavilyHit[], o: { region: string; days: number; excludeDomains: string[]; nowMs: number; seen?: Set<string> }): NewsSignal[] {
  const out: NewsSignal[] = []
  const seen = o.seen ?? new Set<string>()
  for (const h of hits) {
    const host = httpsHost(h.url)
    if (!host || isExcluded(host, o.excludeDomains)) continue
    const date = validSourceDate(h.published_date, o.nowMs, o.days)
    if (!date) continue
    const title = sanitizeText(h.title, 200)
    if (!title || !mentionsRegion(o.region, title, h.content)) continue
    const url = String(h.url).trim().slice(0, 500)
    if (seen.has(url)) continue
    seen.add(url)
    const summary = sanitizeText(h.content, 300)
    out.push({ kind: 'news', region: o.region, title, summary: summary || null, source_name: host.slice(0, 120), source_url: url, observed_at: date, collected_by: 'system', meta: { provider: 'tavily' } })
  }
  return out
}

/** Quantas buscas ainda cabem agora (empresa/semana, teto global/mês, regiões da ficha). */
export function searchesAllowed(o: { usedWeek: number; maxRegions: number; monthUsed: number; monthlyCap: number }): number {
  return Math.max(0, Math.min(o.maxRegions, MAX_SEARCHES_PER_WEEK - o.usedWeek, o.monthlyCap - o.monthUsed))
}
export const newAllowed = (newThisWeek: number, maxPerWeek: number): number => Math.max(0, Math.min(MAX_NEW_PER_WEEK, maxPerWeek) - newThisWeek)
export const monthlyCapFrom = (env: string | undefined | null): number => { const n = Math.floor(Number(env)); return env != null && env !== '' && Number.isFinite(n) && n >= 0 ? n : DEFAULT_MONTHLY_CAP }
