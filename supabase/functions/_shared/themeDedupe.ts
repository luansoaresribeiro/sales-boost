// Tema repetido no calendário (PR B, 2026-11-02): "R$ 1,5 mi: Barra vs Leblon" saiu 4 semanas seguidas e 2x na mesma
// semana. O Diretor Criativo só via formato/template/framework dos últimos posts, nunca o TEMA. Aqui: (1) o bloco que
// lista os temas recentes pro prompt e (2) uma conferência em CÓDIGO (sobreposição de palavras) pra pegar o que passou.
// Função pura (sem Deno/rede) — teste em Node: scripts/test-carousel-quality.mjs.

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'com', 'por', 'que', 'um', 'uma', 'uns', 'umas', 'os', 'as', 'ou', 'e', 'a', 'o', 'mais', 'menos', 'vs', 'versus', 'como', 'qual', 'quais', 'onde', 'seu', 'sua', 'seus', 'suas', 'ao', 'aos', 'se', 'sem', 'ser', 'tem', 'ter', 'e', 'the', 'and', 'for', 'with', 'of', 'in', 'to', 'a', 'an'])
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palavras que identificam o tema (sem acento, sem palavra vazia, 3+ letras ou número). */
export function themeTokens(text: string): Set<string> {
  const out = new Set<string>()
  // "R$ 1,5 mi" e "R$1.5 mi" viram o mesmo token ("1p5"): o valor do tema conta (decisão do dono, 2026-11-02)
  for (const w of fold(String(text ?? '')).replace(/(\d)[.,](\d)/g, '$1p$2').split(/[^a-z0-9]+/)) if (w && !STOP.has(w) && (w.length >= 3 || /^\d+$/.test(w))) out.add(w.replace(/(?<=[a-z]{4,})s$/, ''))
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

/** Devolve o tema recente que o novo repete (mesmo assunto/ângulo, mesmo com outras palavras), ou null. `ratio` = limiar da ficha. */
export function findRepeatedTheme(idea: string, recent: string[], ratio: number = THEME_RATIO): string | null {
  if (!idea || !idea.trim()) return null
  for (const r of recent) {
    if (!r || !r.trim()) continue
    const o = themeOverlap(idea, r)
    if (o.common >= THEME_MIN_COMMON && o.ratio >= ratio) return r
  }
  return null
}

// ── Trava de tema em CÓDIGO (2026-11-02): janela de N semanas (ficha) e nunca 2x na mesma semana ─────────────────
export interface ThemeCfg { cooldownWeeks: number; similarity: number; alternatives: string[] }
/** Sem ficha (setor genérico): 4 semanas, mesmo limiar de antes, nenhuma alternativa pronta. */
export const DEFAULT_THEME_CFG: ThemeCfg = { cooldownWeeks: 4, similarity: THEME_RATIO, alternatives: [] }
/** Lê config.content_rules da ficha (theme_cooldown_weeks, theme_similarity, theme_alternatives). Valor ruim = padrão. Mínimo 1 semana: "nunca 2x na mesma semana" não se desliga. */
export function parseThemeCfg(rules: unknown): ThemeCfg {
  const r = (rules && typeof rules === 'object' ? rules : {}) as Record<string, unknown>
  const weeks = Number(r.theme_cooldown_weeks), sim = Number(r.theme_similarity)
  const alts = Array.isArray(r.theme_alternatives) ? r.theme_alternatives.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim().slice(0, 140)).slice(0, 40) : []
  return {
    cooldownWeeks: Number.isFinite(weeks) && weeks >= 1 ? Math.min(Math.floor(weeks), 12) : DEFAULT_THEME_CFG.cooldownWeeks,
    similarity: Number.isFinite(sim) && sim >= 0.5 && sim <= 1 ? sim : DEFAULT_THEME_CFG.similarity,
    alternatives: alts,
  }
}

const DAY = 86400000
const dayNum = (iso: string): number => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) / DAY
/** Segunda-feira (ISO yyyy-mm-dd) da semana da data. */
export function weekStartOf(iso: string): string {
  const d = dayNum(iso)
  if (!Number.isFinite(d)) return ''
  const dow = (new Date(d * DAY).getUTCDay() + 6) % 7 // seg=0
  return new Date((d - dow) * DAY).toISOString().slice(0, 10)
}
export interface ThemeRow { idea?: string | null; date?: string | null }
/** Temas que BLOQUEIAM a semana `weekOf`: tudo de menos de N semanas atrás, da própria semana e do que já está agendado depois. Linha sem data conta (na dúvida, bloqueia). */
export function blockingThemes(rows: ThemeRow[], weekOf: string, cfg: ThemeCfg = DEFAULT_THEME_CFG): string[] {
  const ws = dayNum(weekStartOf(weekOf))
  const out: string[] = []
  for (const r of rows) {
    const t = String(r.idea ?? '').replace(/\s+/g, ' ').trim().slice(0, 140)
    if (!t) continue
    const d = r.date ? dayNum(r.date) : NaN
    if (Number.isFinite(d) && d <= ws - cfg.cooldownWeeks * 7) continue
    if (!out.includes(t)) out.push(t)
  }
  return out
}
/** Primeiro tema alternativo (da ficha/estratégia) que não repete nada de `taken`. */
export function pickAlternative(alternatives: string[], taken: string[], cfg: ThemeCfg = DEFAULT_THEME_CFG): string | null {
  for (const a of alternatives) if (a && !findRepeatedTheme(a, taken, cfg.similarity)) return a
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
export function themeBlock(themes: string[], weeks = 3): string {
  if (!themes.length) return ''
  return `\nTEMAS JÁ USADOS (últimas ${weeks} semanas e o que já está agendado). NÃO repita o mesmo tema nem o mesmo ângulo — nem a mesma comparação, os mesmos bairros ou o mesmo valor com outras palavras. Escolha um assunto novo (mesmo que use o mesmo insight, mude o ângulo); só repita se o dono pediu esse tema:\n${themes.map(t => `- ${t}`).join('\n')}\n`
}

export const themeRetryNote = (repeated: string): string =>
  `\n\nATENÇÃO: o tema deste post repete uma peça recente ("${repeated}"). Escreva sobre OUTRO tema/ângulo (outro assunto, outra comparação, outros números do cadastro), mantendo as regras acima.\n`
