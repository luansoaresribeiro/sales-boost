// Notícias de mercado automáticas (Inteligência comercial, Etapa 3; v2 em 2026-11-01) — LÓGICA PURA (sem banco, sem rede), testada em
// scripts/test-market-news.mjs. O banco e a Tavily vivem em marketNewsRun.ts. Tudo de setor (tópicos, portais, limites)
// vem da ficha (`config.market_intel.news`, regra 6; limites em dólar e rotação em marketIntel.ts). Nada é inventado: o sinal guarda título, trecho, domínio, link e data
// da própria fonte; sem data válida, sem região no texto, portal de anúncio ou link não-https = descartado.

import { QUALITY_OFF, normalizeTitle, normalizeUrl, type IntelQuality, type SignalKind } from './marketIntel.ts'

export interface TavilyHit { title?: unknown; url?: unknown; content?: unknown; published_date?: unknown; score?: unknown }
export interface NewsMeta { provider: 'tavily'; topic: SignalKind; score?: number | null; quality_v?: number; quality_ok?: boolean; strength?: 'strong' | 'weak'; weak_reason?: WeakReason }
export interface NewsSignal { kind: SignalKind; region: string; title: string; summary: string | null; source_name: string; source_url: string; observed_at: string; collected_by: 'system'; meta: NewsMeta }

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

/** Termo com borda de palavra só nas letras (dígito colado vale: "435m²" casa "m²"; "cada venda" não casa "a venda"). `prefix`: só a borda da esquerda ("hotel" casa "hoteleira"). Texto e termo já normalizados. */
export function hasTerm(textNorm: string, termNorm: string, prefix = false): boolean {
  if (!termNorm) return false
  let from = 0
  for (;;) {
    const i = textNorm.indexOf(termNorm, from)
    if (i < 0) return false
    const before = i === 0 ? '' : textNorm[i - 1], after = textNorm[i + termNorm.length] ?? ''
    if (!/[a-z]/.test(before) && (prefix || !/[a-z]/.test(after))) return true
    from = i + 1
  }
}

export type QualityVerdict = 'ok' | 'block_url' | 'block_title' | 'short_summary' | 'kind_mismatch' | 'host_cap' | 'low_score'
export interface QualityInput { kind: string; title: string; summary: string | null; source_url: string; score?: number | null }

/** Qualidade do sinal pelas regras da ficha (pura). 'ok' ou o motivo. Fonte de confiança passa; regra desligada nunca reprova. `hostCount` = quantos do mesmo site já entraram na rodada. */
export function classifySignalQuality(s: QualityInput, q: IntelQuality, ctx: { hostCount?: number } = {}): QualityVerdict {
  if (q.mode === 'off') return 'ok'
  const host = httpsHost(s.source_url)
  if (host && isExcluded(host, q.trusted_domains)) return 'ok'
  let path = ''
  try { const u = new URL(s.source_url); path = (u.pathname + u.search).toLowerCase() } catch { /* sem caminho */ }
  if (path && q.block_url_patterns.some(p => path.includes(p))) return 'block_url'
  const title = normalize(s.title)
  const newsy = q.news_title_terms.some(t => hasTerm(title, normalize(t))) // título com cara de notícia (verbo de variação, fonte de índice): não é anúncio
  if (!newsy && (q.block_title_terms.some(t => hasTerm(title, normalize(t))) || q.block_title_all.some(g => g.every(t => hasTerm(title, normalize(t)))))) return 'block_title'
  if (q.min_summary_chars > 0 && (s.summary ?? '').length < q.min_summary_chars) return 'short_summary'
  const kt = q.kind_terms[s.kind]
  if (kt?.length) { const text = normalize(`${s.title} ${s.summary ?? ''}`); if (!kt.some(t => hasTerm(text, normalize(t), true))) return 'kind_mismatch' }
  if (q.max_per_host_per_run > 0 && (ctx.hostCount ?? 0) >= q.max_per_host_per_run) return 'host_cap'
  if (q.min_score != null && typeof s.score === 'number' && s.score < q.min_score) return 'low_score'
  return 'ok'
}

export type WeakReason = 'weak_url' | 'weak_title' | 'no_impact'
/** Força do sinal pelas regras da ficha (pura). Fraco = serviço, patrocinado, guia genérico ou sem impacto no mercado: serve de contexto, nunca de base de oportunidade.
 *  Diferente de classifySignalQuality, vale TAMBÉM para domínio de confiança (portal bom publica aviso de serviço e conteúdo de marca). Campo ausente na ficha = tudo forte. */
export function signalStrength(s: { kind: string; title: string; summary: string | null; source_url: string }, q: IntelQuality): { strength: 'strong' | 'weak'; reason?: WeakReason } {
  if (q.mode === 'off') return { strength: 'strong' }
  let path = ''
  try { const u = new URL(s.source_url); path = (u.pathname + u.search).toLowerCase() } catch { /* sem caminho */ }
  if (path && q.weak_url_patterns.some(p => p && path.includes(p))) return { strength: 'weak', reason: 'weak_url' }
  const title = normalize(s.title ?? '')
  if (q.weak_title_terms.some(t => hasTerm(title, normalize(t)))) return { strength: 'weak', reason: 'weak_title' }
  const it = q.impact_terms[s.kind]
  if (it?.length) { const text = normalize(`${s.title ?? ''} ${s.summary ?? ''}`); if (!it.some(t => hasTerm(text, normalize(t), true))) return { strength: 'weak', reason: 'no_impact' } }
  return { strength: 'strong' }
}

export interface FilterReport { signals: NewsSignal[]; rejected: Record<string, number>; flagged: Record<string, number>; samples: { title: string; host: string; reason: string }[] }
export interface FilterOpts { region: string; kind: SignalKind; days: number; excludeDomains: string[]; nowMs: number; seen?: Set<string>; seenTitles?: Set<string>; quality?: IntelQuality; hostCounts?: Map<string, number> }

/** Resultado da Tavily -> sinais aceitos (os filtros de verdade, em código) + contagem por motivo e até 5 amostras. `seen` evita repetir link; `seenTitles` repete título (mesma notícia em outro portal).
 *  Qualidade (ficha): enforce reprova; audit deixa passar e conta em `flagged` (meta.quality_ok=false); off não avalia. */
export function filterHitsReport(hits: TavilyHit[], o: FilterOpts): FilterReport {
  const rep: FilterReport = { signals: [], rejected: {}, flagged: {}, samples: [] }
  const seen = o.seen ?? new Set<string>()
  const seenTitles = o.seenTitles ?? new Set<string>()
  const q = o.quality ?? QUALITY_OFF
  const hostCounts = o.hostCounts ?? new Map<string, number>()
  const rej = (reason: string, h: TavilyHit, host: string | null, into = rep.rejected) => {
    into[reason] = (into[reason] ?? 0) + 1
    if (rep.samples.length < 5) rep.samples.push({ title: sanitizeText(h.title, 120), host: host ?? '', reason })
  }
  for (const h of hits) {
    const host = httpsHost(h.url)
    if (!host) { rej('bad_url', h, null); continue }
    if (isExcluded(host, o.excludeDomains)) { rej('excluded_domain', h, host); continue }
    const date = validSourceDate(h.published_date, o.nowMs, o.days)
    if (!date) { rej('no_date', h, host); continue }
    const title = sanitizeText(h.title, 200)
    if (!title || !mentionsRegion(o.region, title, h.content)) { rej('no_region', h, host); continue }
    const url = normalizeUrl(h.url)?.slice(0, 500)
    const tk = normalizeTitle(title)
    if (!url || seen.has(url) || (tk && seenTitles.has(tk))) { rej('duplicate', h, host); continue }
    const summary = sanitizeText(h.content, 300)
    const score = typeof h.score === 'number' && Number.isFinite(h.score) ? h.score : null
    let verdict: QualityVerdict = 'ok'
    if (q.mode !== 'off') {
      verdict = classifySignalQuality({ kind: o.kind, title, summary: summary || null, source_url: url, score }, q, { hostCount: hostCounts.get(host) ?? 0 })
      if (verdict !== 'ok' && q.mode === 'enforce') { rej(verdict, h, host); continue }
      if (verdict !== 'ok') rej(verdict, h, host, rep.flagged)
    }
    const st = q.mode !== 'off' ? signalStrength({ kind: o.kind, title, summary: summary || null, source_url: url }, q) : null
    if (st?.reason) { const k = 'weak_' + st.reason.replace(/^weak_/, ''); rep.flagged[k] = (rep.flagged[k] ?? 0) + 1 } // só conta: fraco nunca reprova
    seen.add(url); if (tk) seenTitles.add(tk)
    hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1)
    rep.signals.push({
      kind: o.kind, region: o.region, title, summary: summary || null, source_name: host.slice(0, 120), source_url: url, observed_at: date, collected_by: 'system',
      meta: { provider: 'tavily', topic: o.kind, score, ...(q.mode !== 'off' ? { quality_v: q.version, quality_ok: verdict === 'ok', strength: st!.strength, ...(st!.reason ? { weak_reason: st!.reason } : {}) } : {}) },
    })
  }
  return rep
}

/** Compatível com o uso antigo: só os sinais aceitos. */
export const filterHits = (hits: TavilyHit[], o: FilterOpts): NewsSignal[] => filterHitsReport(hits, o).signals
