// Contexto de mercado pros TEMAS da semana (Fase 3, 2026-11-04). Montado em CÓDIGO (sem chamada de IA nova): até 5 sinais do
// sistema (não ignorados, qualidade não reprovada, últimos 14 dias) + tendências ativas. Vai no pedido de temas que já existe
// (weekThemes.ts); o Diretor diz quais usou; ids que não estavam na lista são descartados; o que foi usado fica gravado na peça
// (intent.market_context) como cópia da evidência no momento do plano. Funções PURAS + 1 leitor tolerante (sem Deno/rede nos testes).

export const MAX_SIGNALS = 5
export const MAX_TRENDS = 3
export const WINDOW_DAYS = 14
const MAX_EVIDENCE = MAX_SIGNALS + MAX_TRENDS

export interface MarketItem { alias: string; id: string; kind: 'signal' | 'trend'; title: string; summary: string; source_name: string | null; source_url: string | null; observed_at: string | null; quality_version: number | null }
export interface EvidenceItem { id: string; title: string; source_name: string | null; source_url: string | null; observed_at: string | null; quality_version: number | null }
export interface MarketContext { signal_ids: string[]; trend_ids: string[]; evidence: EvidenceItem[] }

interface SignalRow { id: string; title: string | null; summary: string | null; source_name: string | null; source_url: string | null; observed_at: string | null; meta: Record<string, unknown> | null }
interface TrendRow { id: string | number; title: string | null; description: string | null; detected_at: string | null; source: string | null; status?: string | null }

const t = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const httpUrl = (v: unknown): string | null => { const u = t(v, 500); return /^https?:\/\/\S+$/i.test(u) ? u : null }

/** Sinais elegíveis → itens com apelido curto (S1..S5; T1..T3) que o Diretor usa pra apontar a fonte. Sem nada elegível = []. */
export function buildMarketItems(signals: SignalRow[] | null | undefined, trends: TrendRow[] | null | undefined, now: number = Date.now()): MarketItem[] {
  const since = now - WINDOW_DAYS * 86400000
  const out: MarketItem[] = []
  const sigs = (signals ?? []).filter(s => {
    if (!s || !SAFE_ID.test(String(s.id ?? '')) || !t(s.title, 10)) return false
    const m = s.meta ?? {}
    if (m.ignored === true || m.ignored === 'true') return false
    if (m.quality_ok === false) return false
    const d = Date.parse(String(s.observed_at ?? ''))
    return Number.isFinite(d) && d >= since && d <= now + 86400000
  }).sort((a, b) => Date.parse(String(b.observed_at)) - Date.parse(String(a.observed_at))).slice(0, MAX_SIGNALS)
  sigs.forEach((s, i) => {
    const q = Number(s.meta?.quality_v)
    out.push({ alias: `S${i + 1}`, id: String(s.id), kind: 'signal', title: t(s.title, 200), summary: t(s.summary, 160), source_name: t(s.source_name, 120) || null, source_url: httpUrl(s.source_url), observed_at: t(s.observed_at, 40) || null, quality_version: Number.isFinite(q) && s.meta?.quality_v != null ? q : null })
  })
  const trs = (trends ?? []).filter(x => x && SAFE_ID.test(String(x.id ?? '')) && t(x.title, 10) && (x.status == null || x.status === 'active')).slice(0, MAX_TRENDS)
  trs.forEach((x, i) => out.push({ alias: `T${i + 1}`, id: String(x.id), kind: 'trend', title: t(x.title, 200), summary: t(x.description, 160), source_name: t(x.source, 120) || null, source_url: null, observed_at: t(x.detected_at, 40) || null, quality_version: null }))
  return out
}

/** Bloco de texto do pedido de temas. Sem itens = '' (o pedido fica IDÊNTICO ao de antes). */
export function marketPromptBlock(items: MarketItem[]): string {
  if (!items.length) return ''
  const lines = items.map(m => `- ${m.alias} (${m.kind === 'signal' ? 'sinal' : 'tendência'}${m.observed_at ? `, ${m.observed_at.slice(0, 10)}` : ''}): ${m.title}${m.summary ? ` — ${m.summary}` : ''}`)
  return `Contexto de mercado (opcional): use só se encaixar no pilar da vaga; nunca cite número que não esteja no sinal. Se usar, informe o código em "fontes".\n${lines.join('\n')}\n`
}

/** Códigos que o Diretor devolveu → só os que estavam na lista (desconhecido some; repetido conta 1x). */
export function pickAliases(raw: unknown, items: MarketItem[]): string[] {
  if (!Array.isArray(raw)) return []
  const valid = new Set(items.map(m => m.alias))
  const out: string[] = []
  for (const a of raw) { const k = typeof a === 'string' ? a.trim().toUpperCase() : ''; if (valid.has(k) && !out.includes(k)) out.push(k) }
  return out
}

/** Cópia da evidência usada (o que a peça gravou no momento do plano). Nada usado = null. */
export function buildMarketContext(aliases: string[], items: MarketItem[]): MarketContext | null {
  const used = aliases.map(a => items.find(m => m.alias === a)).filter((m): m is MarketItem => !!m)
  if (!used.length) return null
  return {
    signal_ids: used.filter(m => m.kind === 'signal').map(m => m.id),
    trend_ids: used.filter(m => m.kind === 'trend').map(m => m.id),
    evidence: used.map(m => ({ id: m.id, title: m.title, source_name: m.source_name, source_url: m.source_url, observed_at: m.observed_at, quality_version: m.quality_version })),
  }
}

/** Revalida um market_context que viajou por JSON (plan_slot) ou veio do banco: forma fixa, limites, ids só os da evidência. */
export function cleanMarketContext(x: unknown): MarketContext | null {
  const r = (x && typeof x === 'object' ? x : null) as Record<string, unknown> | null
  if (!r || !Array.isArray(r.evidence)) return null
  const evidence: EvidenceItem[] = []
  for (const e of r.evidence.slice(0, MAX_EVIDENCE)) {
    const o = (e && typeof e === 'object' ? e : null) as Record<string, unknown> | null
    const id = typeof o?.id === 'string' && SAFE_ID.test(o.id) ? o.id : ''
    const title = t(o?.title, 200)
    if (!o || !id || !title || evidence.some(v => v.id === id)) continue
    const q = Number(o.quality_version)
    evidence.push({ id, title, source_name: t(o.source_name, 120) || null, source_url: httpUrl(o.source_url), observed_at: t(o.observed_at, 40) || null, quality_version: o.quality_version != null && Number.isFinite(q) ? q : null })
  }
  if (!evidence.length) return null
  const ids = (v: unknown, max: number) => (Array.isArray(v) ? v : []).filter((i): i is string => typeof i === 'string' && evidence.some(e => e.id === i)).filter((i, k, a) => a.indexOf(i) === k).slice(0, max)
  const signal_ids = ids(r.signal_ids, MAX_SIGNALS), trend_ids = ids(r.trend_ids, MAX_TRENDS)
  const kept = new Set([...signal_ids, ...trend_ids])
  const ev = evidence.filter(e => kept.has(e.id))
  return ev.length ? { signal_ids, trend_ids, evidence: ev } : null
}

type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
const NOT_IGNORED_OR = 'meta->>ignored.is.null,meta->>ignored.neq.true' // nunca `.neq` sozinho (docs/PITFALLS.md)

/** Lê sinais + tendências da empresa. Qualquer falha = [] (o plano segue exatamente como sempre). */
export async function fetchMarketItems(admin: Admin, companyId: string, now: number = Date.now()): Promise<MarketItem[]> {
  try {
    const since = new Date(now - WINDOW_DAYS * 86400000).toISOString()
    const [s, tr] = await Promise.all([
      admin.from('market_signals').select('id, title, summary, source_name, source_url, observed_at, meta').eq('company_id', companyId).eq('collected_by', 'system').or(NOT_IGNORED_OR).gte('observed_at', since).order('observed_at', { ascending: false }).limit(30),
      admin.from('marketing_ai_trends').select('id, title, description, detected_at, source, status').eq('company_id', companyId).eq('status', 'active').order('detected_at', { ascending: false }).limit(MAX_TRENDS),
    ])
    if (s.error || tr.error) { console.error('marketContext: leitura falhou', s.error?.message ?? tr.error?.message); return [] }
    return buildMarketItems(s.data, tr.data, now)
  } catch (e) { console.error('marketContext: falhou (segue sem contexto)', e); return [] }
}
