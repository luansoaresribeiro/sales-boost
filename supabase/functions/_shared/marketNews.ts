// Notícias de mercado automáticas (Inteligência comercial, Etapa 3; v2 em 2026-11-01) — LÓGICA PURA (sem banco, sem rede), testada em
// scripts/test-market-news.mjs. O banco e a Tavily vivem em marketNewsRun.ts. Tudo de setor (tópicos, portais, limites)
// vem da ficha (`config.market_intel.news`, regra 6; limites em dólar e rotação em marketIntel.ts). Nada é inventado: o sinal guarda título, trecho, domínio, link e data
// da própria fonte; sem data válida, sem região no texto, portal de anúncio ou link não-https = descartado.

import { normalizeTitle, normalizeUrl, type SignalKind } from './marketIntel.ts'

export interface TavilyHit { title?: unknown; url?: unknown; content?: unknown; published_date?: unknown }
export interface NewsSignal { kind: SignalKind; region: string; title: string; summary: string | null; source_name: string; source_url: string; observed_at: string; collected_by: 'system'; meta: { provider: 'tavily'; topic: SignalKind } }

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

/** Resultado da Tavily -> sinais aceitos (os filtros de verdade, em código). `seen` evita repetir link; `seenTitles` repete título (mesma notícia em outro portal). */
export function filterHits(hits: TavilyHit[], o: { region: string; kind: SignalKind; days: number; excludeDomains: string[]; nowMs: number; seen?: Set<string>; seenTitles?: Set<string> }): NewsSignal[] {
  const out: NewsSignal[] = []
  const seen = o.seen ?? new Set<string>()
  const seenTitles = o.seenTitles ?? new Set<string>()
  for (const h of hits) {
    const host = httpsHost(h.url)
    if (!host || isExcluded(host, o.excludeDomains)) continue
    const date = validSourceDate(h.published_date, o.nowMs, o.days)
    if (!date) continue
    const title = sanitizeText(h.title, 200)
    if (!title || !mentionsRegion(o.region, title, h.content)) continue
    const url = normalizeUrl(h.url)?.slice(0, 500)
    const tk = normalizeTitle(title)
    if (!url || seen.has(url) || (tk && seenTitles.has(tk))) continue
    seen.add(url); if (tk) seenTitles.add(tk)
    const summary = sanitizeText(h.content, 300)
    out.push({ kind: o.kind, region: o.region, title, summary: summary || null, source_name: host.slice(0, 120), source_url: url, observed_at: date, collected_by: 'system', meta: { provider: 'tavily', topic: o.kind } })
  }
  return out
}
