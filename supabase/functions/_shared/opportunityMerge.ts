// Opportunity Engine — Correção 3 (2026-11-06): junta o que se repete. Módulo PURO (sem banco, sem rede).
//  1) planUpserts: oportunidade nova equivalente a uma ABERTA (mesmo tipo + mesmos itens [+ mesmo sinal externo no
//     market_change]) atualiza a linha aberta em vez de inserir outra. Nunca compara título nem texto de descrição.
//  2) consolidateByAction: várias oportunidades com a MESMA ação (itens diferentes) viram uma tarefa só, com todos os itens.
import { norm, type Evidence, type Lang } from './opportunityEngine.ts'
import type { Confidence, OpportunityDraft } from './opportunityOutput.ts'

export const MAX_EVIDENCE = 12
export const CONF_RANK: Record<string, number> = { high: 3, medium: 2, low: 1, needs_validation: 0 }
export const confRank = (c: unknown): number => CONF_RANK[String(c)] ?? 0

const lc = (s: unknown) => norm(String(s ?? '')).replace(/\s+/g, ' ').trim()
const evKey = (e: Evidence) => `${e.type}|${lc(e.text)}|${lc(e.source)}`

/** União de evidências: as antigas primeiro (nada antigo se perde), sem repetir; fatos/dados antes das hipóteses; teto de 12. */
export function mergeEvidence(oldEv: Evidence[], newEv: Evidence[], cap = MAX_EVIDENCE): Evidence[] {
  const seen = new Set<string>(), all: Evidence[] = []
  for (const e of [...(oldEv ?? []), ...(newEv ?? [])]) {
    if (!e || typeof e.text !== 'string') continue
    const k = evKey(e)
    if (seen.has(k)) continue
    seen.add(k); all.push(e)
  }
  return [...all.filter(e => e.type !== 'hypothesis'), ...all.filter(e => e.type === 'hypothesis')].slice(0, Math.max(cap, all.filter(e => e.type !== 'hypothesis').length))
}

/** URL normalizada (sem www, sem ?query/#hash, sem barra final). */
function normUrl(u: string): string {
  try {
    const x = new URL(u)
    return `${x.hostname.replace(/^www\./, '').toLowerCase()}${x.pathname.replace(/\/+$/, '')}`
  } catch { return lc(u) }
}
/** Chaves de sinal externo da evidência: URL entre parênteses da fonte ("host (https://...)"), ou a fonte normalizada. Só tipo 'data'. */
export function signalKeys(ev: Evidence[]): Set<string> {
  const out = new Set<string>()
  for (const e of ev ?? []) {
    if (e?.type !== 'data' || !e.source) continue
    const m = /\((https?:\/\/[^)\s]+)\)/.exec(e.source)
    const k = m ? normUrl(m[1]) : lc(e.source)
    if (k) out.add(k)
  }
  return out
}

export interface OpenRow {
  id: string; kind: string; item_ids: string[] | null; evidence: Evidence[] | null; confidence: string | null; needs_validation: boolean | null
  title: string; description: string | null; commercial_problem: string | null; audience: string | null; suggested_action: string | null; how_to_measure: string | null
  status: string; plan_generated_at?: string | null; decided_at?: string | null
}
const itemKey = (ids: string[] | null | undefined) => [...new Set(ids ?? [])].sort().join(',')
const isOpen = (r: OpenRow) => r.status === 'suggested' && !r.plan_generated_at && !r.decided_at

export interface Upsert { id: string; patch: Record<string, unknown>; reason: string; draft: OpportunityDraft }

/** Decide o que vira UPDATE de linha aberta e o que ainda é INSERT. Cada linha aberta é atualizada no máximo uma vez por rodada. */
export function planUpserts(drafts: OpportunityDraft[], openRows: OpenRow[], opts: { runId: string; lang?: Lang; validIds?: Set<string> }): { inserts: OpportunityDraft[]; updates: Upsert[] } {
  const lang = opts.lang ?? 'pt'
  const cands = (openRows ?? []).filter(isOpen)
  const used = new Set<string>()
  const inserts: OpportunityDraft[] = [], updates: Upsert[] = []
  for (const d of drafts) {
    const ids = opts.validIds ? d.item_ids.filter(i => opts.validIds!.has(i)) : d.item_ids
    const dKey = itemKey(ids)
    const dSig = d.kind === 'market_change' ? signalKeys(d.evidence) : null
    const row = cands.find(r => !used.has(r.id) && r.kind === d.kind && itemKey(r.item_ids) === dKey &&
      (!dSig || [...signalKeys(r.evidence ?? [])].some(k => dSig.has(k))))
    if (!row) { inserts.push(d); continue }
    used.add(row.id)
    const stronger = confRank(d.confidence) >= confRank(row.confidence)
    const patch: Record<string, unknown> = {
      evidence: mergeEvidence(row.evidence ?? [], d.evidence), run_id: opts.runId, priority_rank: d.priority_rank,
      ...(stronger ? {
        title: d.title, description: d.description || null, commercial_problem: d.commercial_problem, audience: d.audience,
        suggested_action: d.suggested_action, how_to_measure: d.how_to_measure, confidence: d.confidence, needs_validation: d.needs_validation, priority_reasons: d.priority_reasons,
      } : {}),
    }
    updates.push({ id: row.id, patch, draft: d, reason: stronger ? (lang === 'en' ? 'same kind and items: updated with the new reading' : 'mesmo tipo e itens: atualizada com a leitura nova') : (lang === 'en' ? 'same kind and items: kept the stronger old text, merged evidence' : 'mesmo tipo e itens: manteve o texto antigo (mais forte), evidência juntada') })
  }
  return { inserts, updates }
}

// ── Mesma ação, itens diferentes → uma tarefa só ──────────────────────────────────────────────────────────────────
export const normAction = (s: string): string => lc(s).replace(/[\s.!?;:,]+$/, '').trim()

type DraftBody = Omit<OpportunityDraft, 'priority_rank' | 'priority_reasons'>
export interface Item<S> { s: S & { c: { id: string; item_ids: string[] }; evCount: number; independent: number; needs: boolean; confidence: Confidence }; d: DraftBody }

/** Agrupa pela ação idêntica (sem juntar item_ids vazios). Devolve os itens (base já fundida) e quem foi absorvido por quem (id do candidato base). */
export function consolidateByAction<S>(items: Item<S>[], lang: Lang, photoActions: Set<string>): { items: Item<S>[]; absorbed: { id: string; kind: DraftBody['kind']; into: string }[] } {
  const groups = new Map<string, Item<S>[]>()
  for (const x of items) {
    if (!x.d.item_ids.length) continue
    const k = normAction(x.d.suggested_action)
    if (k) groups.set(k, [...(groups.get(k) ?? []), x])
  }
  const absorbed: { id: string; kind: DraftBody['kind']; into: string }[] = []
  const drop = new Set<Item<S>>(), swap = new Map<Item<S>, Item<S>>()
  for (const [k, g] of groups) {
    if (g.length < 2) continue
    const base = g[0], n0 = new Set<string>()
    const ids = g.flatMap(x => x.d.item_ids).filter(i => (n0.has(i) ? false : (n0.add(i), true)))
    const n = ids.length
    const titles = g.map(x => x.d.title.trim().replace(/[.\s]+$/, ''))
    const lowest = g.reduce((m, x) => (confRank(x.d.confidence) < confRank(m) ? x.d.confidence : m), base.d.confidence)
    const needs = g.some(x => x.d.needs_validation)
    const isPhoto = photoActions.has(k)
    const title = isPhoto
      ? (lang === 'en' ? `Add real photos to ${n} catalog items` : `Adicionar fotos reais a ${n} itens do catálogo`)
      : (lang === 'en' ? `Same action for ${n} catalog items` : `Mesma ação para ${n} itens do catálogo`)
    const evidence = g.reduce<Evidence[]>((acc, x) => mergeEvidence(acc, x.d.evidence), [])
    const nonHyp = evidence.filter(e => e.type !== 'hypothesis').length
    const merged: Item<S> = {
      d: { ...base.d, title, item_ids: ids, evidence, confidence: lowest, needs_validation: needs, description: `${lang === 'en' ? 'Includes' : 'Inclui'}: ${titles.join('; ')}.`.slice(0, 600) },
      s: { ...base.s, c: { ...base.s.c, item_ids: ids }, evCount: Math.max(base.s.evCount, nonHyp), independent: Math.max(...g.map(x => x.s.independent)), needs: needs || base.s.needs, confidence: lowest },
    }
    swap.set(base, merged)
    for (const x of g.slice(1)) { drop.add(x); absorbed.push({ id: x.s.c.id, kind: x.d.kind, into: base.s.c.id }) }
  }
  return { items: items.filter(x => !drop.has(x)).map(x => swap.get(x) ?? x), absorbed }
}
