// Tema repetido no calendário (PR B, 2026-11-02): "R$ 1,5 mi: Barra vs Leblon" saiu 4 semanas seguidas e 2x na mesma
// semana. O Diretor Criativo só via formato/template/framework dos últimos posts, nunca o TEMA. Aqui: (1) o bloco que
// lista os temas recentes pro prompt e (2) uma conferência em CÓDIGO (sobreposição de palavras) pra pegar o que passou.
// Função pura (sem Deno/rede) — teste em Node: scripts/test-theme-dedupe.mjs.

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'com', 'por', 'que', 'um', 'uma', 'uns', 'umas', 'os', 'as', 'ou', 'e', 'a', 'o', 'mais', 'menos', 'vs', 'versus', 'como', 'qual', 'quais', 'onde', 'seu', 'sua', 'seus', 'suas', 'ao', 'aos', 'se', 'sem', 'ser', 'tem', 'ter', 'e', 'the', 'and', 'for', 'with', 'of', 'in', 'to', 'a', 'an'])
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palavras que identificam o tema (sem acento, sem palavra vazia, 3+ letras ou número). */
export function themeTokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of fold(String(text ?? '')).split(/[^a-z0-9]+/)) if (w && !STOP.has(w) && (w.length >= 3 || /^\d+$/.test(w) && w.length >= 2)) out.add(w.replace(/(?<=[a-z]{4,})s$/, ''))
  return out
}

/** Quanto do tema menor está dentro do outro (0–1) e quantas palavras têm em comum. */
export function themeOverlap(a: string, b: string): { ratio: number; common: number } {
  const A = themeTokens(a), B = themeTokens(b)
  if (!A.size || !B.size) return { ratio: 0, common: 0 }
  let common = 0
  for (const t of A) if (B.has(t)) common++
  return { ratio: common / Math.min(A.size, B.size), common }
}

export const THEME_MIN_COMMON = 2
export const THEME_RATIO = 0.75

/** Devolve o tema recente que o novo repete (mesmo assunto/ângulo, mesmo com outras palavras), ou null. */
export function findRepeatedTheme(idea: string, recent: string[]): string | null {
  if (!idea || !idea.trim()) return null
  for (const r of recent) {
    if (!r || !r.trim()) continue
    const o = themeOverlap(idea, r)
    if (o.common >= THEME_MIN_COMMON && o.ratio >= THEME_RATIO) return r
  }
  return null
}

/** Temas já usados (últimas semanas + já agendados na semana), únicos, mais recentes primeiro, no máximo `max`. */
export function recentThemes(rows: { idea?: string | null }[], max = 30): string[] {
  const out: string[] = []
  for (const r of rows) {
    const t = String(r.idea ?? '').replace(/\s+/g, ' ').trim().slice(0, 140)
    if (t && !out.some(x => findRepeatedTheme(t, [x]))) out.push(t)
    if (out.length >= max) break
  }
  return out
}

/** Bloco do prompt do Diretor Criativo. Vazio quando não há tema recente. */
export function themeBlock(themes: string[]): string {
  if (!themes.length) return ''
  return `\nTEMAS JÁ USADOS (últimas 3 semanas e o que já está agendado nesta semana). NÃO repita o mesmo tema nem o mesmo ângulo — nem a mesma comparação, os mesmos bairros ou o mesmo valor com outras palavras. Escolha um assunto novo (mesmo que use o mesmo insight, mude o ângulo); só repita se o dono pediu esse tema:\n${themes.map(t => `- ${t}`).join('\n')}\n`
}

export const themeRetryNote = (repeated: string): string =>
  `\n\nATENÇÃO: o tema deste post repete uma peça recente ("${repeated}"). Escreva sobre OUTRO tema/ângulo (outro assunto, outra comparação, outros números do cadastro), mantendo as regras acima.\n`
