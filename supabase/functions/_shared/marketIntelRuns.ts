// Inteligência de Mercado — Fase 2 (2026-11-04): registro por rodada (`market_intel_runs`), reclassificação dos sinais já gravados
// pelo filtro de qualidade da ficha e impressão digital do que vai à IA ("não reinterpretar sem mudança").
// Regras: o registro NUNCA derruba a coleta/análise (try/catch com await); contador nulo = "não medido" (nunca 0 fingido);
// a reclassificação nunca apaga evidência (só marca meta.ignored) e nunca ignora o que o dono restaurou. Tudo de setor vem da ficha.
import { classifySignalQuality, type QualityVerdict } from './marketNews.ts'
import type { IntelQuality } from './marketIntel.ts'
import type { Candidate, Fact, OppTexts } from './opportunityEngine.ts'

type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export type RunPhase = 'collect' | 'reclassify' | 'interpret'
export interface RunInput {
  searched?: number | null; collected?: number | null; filtered?: number | null; accepted?: number | null; interpreted?: number | null; discarded?: number | null
  ignored_by_system?: number | null; unchanged?: boolean; fingerprint?: string | null; cost_usd?: number | null; month_cost_usd?: number | null; tokens?: number | null
  details?: Record<string, unknown>
}
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)
const usd = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 1e6) / 1e6 : null)

/** Grava 1 linha em market_intel_runs. Devolve false (e loga) se falhar — quem chama segue normalmente. */
export async function recordRun(admin: Admin, companyId: string, phase: RunPhase, r: RunInput): Promise<boolean> {
  try {
    const { error } = await admin.from('market_intel_runs').insert({
      company_id: companyId, phase, searched: int(r.searched), collected: int(r.collected), filtered: int(r.filtered), accepted: int(r.accepted),
      interpreted: int(r.interpreted), discarded: int(r.discarded), ignored_by_system: int(r.ignored_by_system), unchanged: r.unchanged === true,
      fingerprint: r.fingerprint ?? null, cost_usd: usd(r.cost_usd), month_cost_usd: usd(r.month_cost_usd), tokens: int(r.tokens), details: r.details ?? {},
    })
    if (error) { console.error(`[market_intel_runs] ${companyId} ${phase}: ${error.message}`); return false }
    return true
  } catch (e) {
    console.error(`[market_intel_runs] ${companyId} ${phase}:`, String(e))
    return false
  }
}

// ---------- reclassificação dos sinais já gravados ----------
export const RECLASSIFY_PER_COMPANY = 150
export const RECLASSIFY_UNTIL_MS = 40_000
const NOT_IGNORED_OR = 'meta->>ignored.is.null,meta->>ignored.neq.true'

export interface StoredSignal { id: string; kind: string; title: string | null; summary: string | null; source_url: string | null; source_name?: string | null; meta: Record<string, unknown> | null }
export interface ReclassifyResult { mode: string; version: number; examined: number; passed: number; failed: number; ignored: number; reasons: Record<string, number>; samples: { title: string; host: string; reason: string }[]; partial: boolean; error?: string }

/** Precisa de nova avaliação? Sem carimbo ou carimbo antigo; em enforce, também o que o modo audit marcou como ruim. Sinal que o dono restaurou nunca. */
export function needsReclassify(meta: Record<string, unknown> | null, q: IntelQuality): boolean {
  const m = meta ?? {}
  if (m.owner_restored === true) return false
  const v = Number(m.quality_v)
  if (m.quality_v == null || !Number.isFinite(v) || v < q.version) return true
  return q.mode === 'enforce' && m.quality_ok === false && v === q.version
}

export async function reclassifySignals(admin: Admin, companyId: string, q: IntelQuality, o: { started?: number; untilMs?: number; limit?: number; now?: () => number } = {}): Promise<ReclassifyResult> {
  const res: ReclassifyResult = { mode: q.mode, version: q.version, examined: 0, passed: 0, failed: 0, ignored: 0, reasons: {}, samples: [], partial: false }
  if (q.mode === 'off') return res
  const nowMs = o.now ?? Date.now
  const started = o.started ?? nowMs()
  const untilMs = o.untilMs ?? RECLASSIFY_UNTIL_MS
  const limit = o.limit ?? RECLASSIFY_PER_COMPANY
  const { data, error } = await admin.from('market_signals').select('id, kind, title, summary, source_url, source_name, meta')
    .eq('company_id', companyId).eq('collected_by', 'system').or(NOT_IGNORED_OR).order('created_at', { ascending: false }).limit(500)
  if (error) { res.error = String(error.message ?? error); return res }
  const todo = ((data ?? []) as StoredSignal[]).filter(s => needsReclassify(s.meta, q)).slice(0, limit)
  const iso = new Date(nowMs()).toISOString()
  for (const s of todo) {
    if (nowMs() - started >= untilMs) { res.partial = true; break }
    const meta = s.meta ?? {}
    const score = typeof meta.score === 'number' ? meta.score : null
    const verdict: QualityVerdict = classifySignalQuality({ kind: s.kind, title: s.title ?? '', summary: s.summary, source_url: s.source_url ?? '', score }, q)
    res.examined++
    if (verdict === 'ok') res.passed++
    else {
      res.failed++; res.reasons[verdict] = (res.reasons[verdict] ?? 0) + 1
      if (res.samples.length < 5) { let host = ''; try { host = new URL(s.source_url ?? '').hostname.replace(/^www\./, '') } catch { /* sem host */ } res.samples.push({ title: String(s.title ?? '').slice(0, 120), host, reason: verdict }) }
    }
    if (q.mode !== 'enforce') continue // audit: só conta; nada é escrito no sinal
    const next = verdict === 'ok'
      ? { ...meta, quality_v: q.version, quality_ok: true }
      : { ...meta, ignored: true, ignored_at: iso, ignored_by: 'system', ignored_reason: verdict, quality_v: q.version, quality_ok: false }
    const up = await admin.from('market_signals').update({ meta: next }).eq('id', s.id).eq('company_id', companyId)
    if (up.error) { res.error = String(up.error.message ?? up.error); break }
    if (verdict !== 'ok') res.ignored++
  }
  return res
}

/** Resultado igual ao da última linha `reclassify`? (audit repete a mesma leitura todo dia: só grava quando muda.) Erro de leitura = diferente (grava). */
export async function sameAsLastReclassify(admin: Admin, companyId: string, rc: ReclassifyResult): Promise<boolean> {
  try {
    const { data, error } = await admin.from('market_intel_runs').select('collected, filtered, accepted, details').eq('company_id', companyId).eq('phase', 'reclassify').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error || !data) return false
    const sig = (e: number, f: number, a: number, reasons: unknown) => JSON.stringify([e, f, a, Object.entries((reasons ?? {}) as Record<string, number>).sort()])
    return sig(Number(data.collected), Number(data.filtered), Number(data.accepted), data.details?.reasons) === sig(rc.examined, rc.failed, rc.passed, rc.reasons)
  } catch { return false }
}

// ---------- impressão digital do que vai à IA ----------
export const sha256Hex = async (s: string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('')

/** Texto canônico do que a IA recebe: conteúdo dos fatos e dos candidatos, idioma, versão do prompt. SEM datas e SEM ids sequenciais (F1/C1), então o mesmo
 *  conteúdo em outro dia dá a mesma impressão. Candidatos e fatos entram em ordem canônica (não depende da ordem de inserção). */
export function fingerprintPayload(o: { lang: string; promptVersion: number; businessName: string; itemLabel: string; facts: Fact[]; candidates: Candidate[]; photoCounts?: Record<string, number>; texts?: OppTexts }): string {
  const key = (f: Fact) => [f.type, f.origin, f.text, f.source].join('␟')
  const byId = new Map(o.facts.map(f => [f.id, key(f)]))
  const cands = o.candidates.map(c => JSON.stringify({
    kind: c.kind, region: c.region, force: c.forceHypothesis, hyp: c.hypotheses, why: c.validationReasons,
    items: [...c.item_ids].sort(), photos: [...c.item_ids].sort().map(id => o.photoCounts?.[id] ?? 0),
    facts: c.fact_ids.map(id => byId.get(id) ?? '').sort(),
  })).sort()
  return JSON.stringify({ lang: o.lang, pv: o.promptVersion, biz: o.businessName, item: o.itemLabel, texts: o.texts ?? null, facts: o.facts.map(key).sort(), cands })
}
export const interpretFingerprint = async (o: Parameters<typeof fingerprintPayload>[0]): Promise<string> => sha256Hex(fingerprintPayload(o))
