// Varredura em LOTES (dono, 2026-10-15: "prospectar todos de uma vez
// possíveis, e se tiver mais na próxima rodada, pega mais").
//
// Cada chamada da função tem ~150s (Supabase). Então a busca guarda a fila no
// próprio registro da varredura (prospect_scan_log.queue: buscas pendentes +
// candidatos achados) e, se ainda sobrou fila e não bateu o teto
// (max_per_night = máximo de leads por varredura), chama a si mesma de novo
// (continue_scan) — até acabar. Quem já foi analisado nunca é reanalisado
// (prospect_checked_places), então a PRÓXIMA rodada só pega negócio novo.
//
// Bairros (prospect_settings.search_areas): com lista, busca "palavra em
// Bairro, Cidade" (1 página do Google por busca, a mais generalista das
// palavras de cada categoria) — cobre a cidade inteira em vez dos 60
// resultados que o Google dá pra "Rio de Janeiro" inteiro.
import type { IgSignals } from './igSignals.ts'

type SupaClient = any // eslint-disable-line @typescript-eslint/no-explicit-any

export interface SearchTask { city: string; area: string | null; businessType: string; keyword: string }
export interface CandidateTask { place_id: string; name: string; city: string; businessType: string; keyword: string }
export interface ScanQueue { searches: SearchTask[]; candidates: CandidateTask[] }

export const SCAN_BUDGET_MS = 95_000     // por chamada; o resto vira a próxima chamada
export const CONCURRENCY = 3             // candidatos analisados ao mesmo tempo
export const MAX_CHAIN = 200             // trava de segurança: no máx. 200 chamadas por varredura

export function buildSearches(cities: string[], areas: string[], types: string[], keywordsByType: Map<string, string[]>): SearchTask[] {
  const out: SearchTask[] = []
  for (const city of cities) {
    for (const businessType of types) {
      const kws = keywordsByType.get(businessType) ?? []
      if (!kws.length) continue
      if (areas.length) {
        // Bairro a bairro: só a palavra mais curta (mais genérica) da categoria.
        const kw = [...kws].sort((a, b) => a.length - b.length)[0]
        for (const area of areas) out.push({ city, area, businessType, keyword: kw })
      } else {
        for (const keyword of kws) out.push({ city, area: null, businessType, keyword })
      }
    }
  }
  return out
}

export type ProcessResult = 'accepted' | 'rejected' | 'error'

// Laço de uma chamada: processa candidatos (3 por vez) e, quando acaba a lista,
// executa a próxima busca do Google. Para no prazo, no teto, ou sem fila.
export async function runBatch(opts: {
  queue: ScanQueue; known: Set<string>; deadline: number; cap: number; foundSoFar: number
  search: (t: SearchTask) => Promise<{ place_id: string; name: string }[]>
  process: (c: CandidateTask) => Promise<ProcessResult>
  onProgress: (processedDelta: number, found: number) => Promise<void>
}): Promise<{ found: number; processed: number }> {
  const { queue, known, deadline, cap } = opts
  let found = opts.foundSoFar, processed = 0
  while (Date.now() < deadline && found < cap) {
    if (queue.candidates.length) {
      const batch = queue.candidates.splice(0, Math.min(CONCURRENCY, cap - found))
      const res = await Promise.all(batch.map(c => opts.process(c).catch(() => 'error' as ProcessResult)))
      found += res.filter(r => r === 'accepted').length
      processed += batch.length
      await opts.onProgress(batch.length, found)
      continue
    }
    const task = queue.searches.shift()
    if (!task) break
    for (const r of await opts.search(task)) {
      if (known.has(r.place_id)) continue
      known.add(r.place_id)
      queue.candidates.push({ place_id: r.place_id, name: r.name, city: task.city, businessType: task.businessType, keyword: task.area ? `${task.keyword} (${task.area})` : task.keyword })
    }
  }
  return { found, processed }
}

export type { IgSignals }
