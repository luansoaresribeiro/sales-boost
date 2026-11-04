// Pacote B2 item 9 — tendência ignorada pelo dono não volta na varredura semanal.
// Puro (sem Deno/rede) pra ser testado por scripts/test-trend-ignore.mjs.

/** Minúsculas, sem acento, espaços colapsados. */
export function normTrendTitle(s: string): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Tira as linhas cujo título (normalizado) é igual ao de uma tendência que o dono ignorou. */
export function dropIgnoredTitles<T extends { title: string }>(rows: T[], ignoredTitles: string[]): T[] {
  const blocked = new Set(ignoredTitles.map(normTrendTitle).filter(Boolean))
  return rows.filter(r => !blocked.has(normTrendTitle(r.title)))
}
