// "O que mudou" da Inteligência de Mercado (Fase 2, 2026-11-04) — parte PURA (sem banco), testada em scripts/test-market-runs.mjs.
// Lê as linhas de `market_intel_runs` (uma por rodada: coleta, reclassificação, análise) e monta frases. Regra 5: contador nulo =
// "não medido" (nunca 0 fingido); sem rodada registrada = "Ainda não há rodada registrada".
export interface RunRow {
  phase: string; searched: number | null; collected: number | null; filtered: number | null; accepted: number | null; interpreted: number | null; discarded: number | null
  ignored_by_system: number | null; unchanged: boolean | null; fingerprint?: string | null; details?: { error?: unknown; cap_usd?: unknown } | null; cost_usd: number | string | null; month_cost_usd: number | string | null; tokens: number | null; created_at: string
}
export interface Changes {
  collect: { at: string; collected: number | null; accepted: number | null; filtered: number | null; cost: number | null } | null
  monthCost: number | null // acumulado do mês (da última coleta DESTE mês); null = não medido
  capUsd: number | null // teto mensal gravado pela própria rodada (details.cap_usd); null = não medido
  interpret: { at: string; failed: boolean; unchanged: boolean; tokens: number | null; interpreted: number | null; accepted: number | null; changedAt: string | null } | null
}
/** Análise que falhou: a função grava a linha sem impressão digital e com details.error. Só rodada com impressão digital conta como "análise feita". */
const failedRun = (r: RunRow) => r.phase === 'interpret' && (!r.fingerprint || !!r.details?.error)

const num = (v: unknown): number | null => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }

export function deriveChanges(rows: RunRow[], nowMs: number = Date.now()): Changes {
  const sorted = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const c = sorted.find(r => r.phase === 'collect')
  const i = sorted.find(r => r.phase === 'interpret')
  const ch = sorted.find(r => r.phase === 'interpret' && !failedRun(r) && r.unchanged !== true)
  const sameMonth = (iso: string) => { const a = new Date(iso), b = new Date(nowMs); return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() }
  const mc = sorted.find(r => r.phase === 'collect' && sameMonth(r.created_at) && num(r.month_cost_usd) != null)
  return {
    collect: c ? { at: c.created_at, collected: num(c.collected), accepted: num(c.accepted), filtered: num(c.filtered), cost: num(c.cost_usd) } : null,
    monthCost: mc ? num(mc.month_cost_usd) : null,
    capUsd: mc ? num(mc.details?.cap_usd) : null,
    interpret: i ? { at: i.created_at, failed: failedRun(i), unchanged: i.unchanged === true && !failedRun(i), tokens: num(i.tokens), interpreted: num(i.interpreted), accepted: num(i.accepted), changedAt: ch?.created_at ?? null } : null,
  }
}

const TXT = {
  pt: {
    nm: 'não medido', collect: 'Última coleta', kept: 'notícias novas guardadas', dropped: 'descartadas pelo filtro', noCollect: 'Coleta: nenhuma registrada ainda',
    analysis: 'Análise', ran: 'rodou', cands: 'candidatos analisados', opps: 'oportunidades geradas', same: 'nada mudou desde', sameNoDate: 'nada mudou desde a análise anterior', noAnalysis: 'Análise: nenhuma registrada ainda', failed: 'A última análise falhou',
    cost: 'Custo da coleta', est: 'estimado', month: 'acumulado no mês', of: 'de', tokens: 'tokens da análise', noCall: 'sem chamada à IA',
    ignored: (n: number) => `O sistema ignorou ${n} ${n === 1 ? 'notícia' : 'notícias'} por qualidade`, ignoredNm: 'Ignoradas pelo sistema: não medido', seeIgnored: 'Ver e restaurar',
    loading: 'Carregando…', error: 'Não foi possível verificar o que mudou.', empty: 'Ainda não há rodada registrada.', title: 'O que mudou', example: 'exemplo',
  },
  en: {
    nm: 'not measured', collect: 'Last collection', kept: 'new news kept', dropped: 'dropped by the filter', noCollect: 'Collection: none recorded yet',
    analysis: 'Analysis', ran: 'ran', cands: 'candidates analyzed', opps: 'opportunities generated', same: 'nothing changed since', sameNoDate: 'nothing changed since the previous analysis', noAnalysis: 'Analysis: none recorded yet', failed: 'The last analysis failed',
    cost: 'Collection cost', est: 'estimated', month: 'month to date', of: 'of', tokens: 'analysis tokens', noCall: 'no AI call',
    ignored: (n: number) => `The system ignored ${n} ${n === 1 ? 'news item' : 'news items'} for quality`, ignoredNm: 'Ignored by the system: not measured', seeIgnored: 'View and restore',
    loading: 'Loading…', error: 'Could not check what changed.', empty: 'No round recorded yet.', title: 'What changed', example: 'example',
  },
} as const
export const changesText = (lang: 'pt' | 'en') => TXT[lang]

const dayMonth = (iso: string, lang: 'pt' | 'en') => { const d = new Date(iso); const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'); return lang === 'en' ? `${mm}/${dd}` : `${dd}/${mm}` }
const money = (n: number, lang: 'pt' | 'en') => `US$ ${n.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`

/** Frases do bloco (sem a linha dos ignorados, que tem botão). */
export function describeChanges(ch: Changes, lang: 'pt' | 'en'): string[] {
  const t = TXT[lang], v = (n: number | null) => (n == null ? t.nm : String(n))
  const out: string[] = []
  out.push(ch.collect
    ? `${t.collect} (${dayMonth(ch.collect.at, lang)}): ${t.kept}: ${v(ch.collect.accepted)} · ${t.dropped}: ${v(ch.collect.filtered)}`
    : t.noCollect)
  if (!ch.interpret) out.push(t.noAnalysis)
  else if (ch.interpret.failed) out.push(`${t.failed} (${dayMonth(ch.interpret.at, lang)})`)
  else if (ch.interpret.unchanged) out.push(`${t.analysis} (${dayMonth(ch.interpret.at, lang)}): ${ch.interpret.changedAt ? `${t.same} ${dayMonth(ch.interpret.changedAt, lang)}` : t.sameNoDate}`)
  else out.push(`${t.analysis} (${dayMonth(ch.interpret.at, lang)}): ${t.ran} — ${t.cands}: ${v(ch.interpret.interpreted)} · ${t.opps}: ${v(ch.interpret.accepted)}`)
  const costBits = [
    `${t.cost}: ${ch.collect?.cost == null ? t.nm : `${money(ch.collect.cost, lang)} (${t.est})`}`,
    `${t.month}: ${ch.monthCost == null ? t.nm : `${money(ch.monthCost, lang)}${ch.capUsd == null ? '' : ` ${t.of} ${money(ch.capUsd, lang)}`}`}`,
    `${t.tokens}: ${ch.interpret == null || ch.interpret.failed || ch.interpret.tokens == null ? t.nm : ch.interpret.unchanged ? `0 (${t.noCall})` : String(ch.interpret.tokens)}`,
  ]
  out.push(costBits.join(' · '))
  return out
}
export const ignoredLine = (n: number | null, lang: 'pt' | 'en'): string => (n == null ? TXT[lang].ignoredNm : TXT[lang].ignored(n))

/** Exemplo do modo demonstração (sempre com a etiqueta "exemplo" na tela). */
export function demoChanges(nowMs: number = Date.now()): { changes: Changes; systemIgnored: number } {
  const d = (days: number) => new Date(nowMs - days * 86400_000).toISOString()
  return { changes: { collect: { at: d(0), collected: 12, accepted: 4, filtered: 8, cost: 0.064 }, monthCost: 0.7, capUsd: 5, interpret: { at: d(0), failed: false, unchanged: true, tokens: 0, interpreted: 3, accepted: 0, changedAt: d(3) } }, systemIgnored: 5 }
}
