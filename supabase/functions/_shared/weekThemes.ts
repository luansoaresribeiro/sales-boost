// Reserva de temas da semana INTEIRA antes de disparar as vagas (2026-11-02). Cada vaga de post roda numa invocação
// própria e em paralelo — sem isto, duas vagas escolhem o mesmo tema sem se enxergar ("Barra ou Leblon acima de R$ 1,5 mi"
// saiu 2x na mesma semana). Aqui: 1 pedido curto ao Diretor Criativo pros temas de todas as vagas → conferência em CÓDIGO
// (themeDedupe: janela de N semanas da ficha + temas já reservados na semana) → o que repete pede outro tema 1x com a lista
// proibida → ainda repete: tema alternativo da ficha que não repita → senão fica sem reserva (a vaga escolhe e a conferência
// na geração segue valendo). Sem Deno/rede: `ask` é injetado, teste em Node (scripts/test-week-themes.mjs).
import { findRepeatedTheme, pickAlternative, parseThemeCfg, weekStartOf, DEFAULT_THEME_CFG, type ThemeCfg } from './themeDedupe.ts'
import { parseJson } from './faqCheck.ts'
import { marketPromptBlock, pickAliases, type MarketItem } from './marketContext.ts'

export interface ThemeSlot { key: string; date: string; hint: string }
export interface ThemeAssign { key: string; idea: string | null; source: 'diretor' | 'alternativa' | 'livre'; note?: string; /** códigos (S1/T1…) do contexto de mercado que o Diretor disse ter usado — já validados contra a lista enviada */ market?: string[] }
type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

/** Janela, limiar e alternativas da ficha (config.content_rules). Falhou/sem ficha = padrão genérico. */
export async function fetchThemeCfg(admin: Admin, verticalKey: string | null): Promise<ThemeCfg> {
  if (!verticalKey) return DEFAULT_THEME_CFG
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    return parseThemeCfg((data?.config as { content_rules?: unknown } | null)?.content_rules)
  } catch { return DEFAULT_THEME_CFG }
}

export const themeAskPrompt = (brand: string, slots: ThemeSlot[], forbidden: string[], market: MarketItem[] = []): string =>
  `Você é o Diretor Criativo de "${brand}". Escolha UM tema de post para cada vaga abaixo, todos DIFERENTES entre si.
Vagas:
${slots.map(s => `- ${s.key} (${s.date}): ${s.hint}`).join('\n')}
${forbidden.length ? `TEMAS PROIBIDOS (já usados nas últimas semanas ou já reservados — nem a mesma comparação, os mesmos bairros ou o mesmo valor com outras palavras):\n${forbidden.slice(0, 40).map(t => `- ${t}`).join('\n')}\n` : ''}${marketPromptBlock(market)}Regras: tema curto (até 12 palavras), sem inventar número, preço nem dado de mercado.
Responda SÓ em JSON: {"temas":[{"vaga":"<chave da vaga>","tema":""${market.length ? ',"fontes":["<código do contexto de mercado usado, se algum>"]' : ''}}]}`

const asked = (raw: string): Map<string, string> => {
  const out = new Map<string, string>()
  const j = parseJson<{ temas?: { vaga?: unknown; tema?: unknown }[] }>(raw, {})
  for (const t of Array.isArray(j.temas) ? j.temas : []) if (typeof t?.vaga === 'string' && typeof t?.tema === 'string' && t.tema.trim()) out.set(t.vaga, t.tema.replace(/\s+/g, ' ').trim().slice(0, 140))
  return out
}

/** Códigos de mercado que o Diretor apontou por vaga (só os da lista enviada). */
const askedSources = (raw: string, market: MarketItem[]): Map<string, string[]> => {
  const out = new Map<string, string[]>()
  if (!market.length) return out
  const j = parseJson<{ temas?: { vaga?: unknown; fontes?: unknown }[] }>(raw, {})
  for (const t of Array.isArray(j.temas) ? j.temas : []) if (typeof t?.vaga === 'string') { const f = pickAliases(t.fontes, market); if (f.length) out.set(t.vaga, f) }
  return out
}

export async function planWeekThemes(a: { slots: ThemeSlot[]; history: string[]; cfg: ThemeCfg; brand: string; market?: MarketItem[]; ask?: (prompt: string) => Promise<string>; timeoutMs?: number }): Promise<Map<string, ThemeAssign>> {
  const { cfg } = a
  const taken = [...a.history]
  const out = new Map<string, ThemeAssign>()
  const market = a.market ?? []
  const srcs = new Map<string, string[]>()
  const propose = async (slots: ThemeSlot[]): Promise<Map<string, string>> => {
    if (!a.ask || !slots.length) return new Map()
    for (const sl of slots) srcs.delete(sl.key)   // pedido novo = fonte antiga não vale mais
    // timeout de ~20 s por chamada: falhou/demorou → segue sem reservar (o despacho nunca trava)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const raw = await Promise.race([a.ask(themeAskPrompt(a.brand, slots, taken, market)), new Promise<string>((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), a.timeoutMs ?? 20_000) })])
      for (const [k, v] of askedSources(raw, market)) srcs.set(k, v)
      return asked(raw)
    } catch (e) { console.error('weekThemes: pedido de temas falhou', e); return new Map() } finally { if (timer) clearTimeout(timer) }
  }
  const settle = (slots: ThemeSlot[], proposals: Map<string, string>): { slot: ThemeSlot; why: string }[] => {
    const failed: { slot: ThemeSlot; why: string }[] = []
    for (const s of slots) {
      const idea = proposals.get(s.key)
      if (!idea) { failed.push({ slot: s, why: '' }); continue }
      const rep = findRepeatedTheme(idea, taken, cfg.similarity, cfg.places)
      if (rep) { failed.push({ slot: s, why: `“${idea}” repetia “${rep}”` }); continue }
      taken.push(idea); out.set(s.key, { key: s.key, idea, source: 'diretor', ...(srcs.get(s.key) ? { market: srcs.get(s.key) } : {}) })
    }
    return failed
  }
  const first = await propose(a.slots)
  let failed = settle(a.slots, first)
  // 1 nova tentativa só pras vagas que repetiram, com a lista proibida já atualizada (inclui o que as outras vagas reservaram)
  const again = failed.filter(f => f.why)
  if (again.length) {
    const second = await propose(again.map(f => f.slot))
    const left = settle(again.map(f => f.slot), second)
    failed = [...failed.filter(f => !f.why), ...left.map(l => ({ slot: l.slot, why: l.why || again.find(f => f.slot.key === l.slot.key)?.why || '' }))]
  }
  for (const { slot, why } of failed) {
    const alt = pickAlternative(cfg.alternatives, taken, cfg)
    if (alt) {
      taken.push(alt)
      out.set(slot.key, { key: slot.key, idea: alt, source: 'alternativa', note: `Tema trocado${why ? ` (${why} nas últimas ${cfg.cooldownWeeks} semanas)` : ''}: usei “${alt}”, que não repete nada recente.` })
    } else out.set(slot.key, { key: slot.key, idea: null, source: 'livre', note: why ? `Atenção: ${why} e não achei tema alternativo — confira antes de aprovar.` : undefined })
  }
  // Troca que o Diretor fez na 2ª tentativa também fica registrada
  for (const f of again) { const o = out.get(f.slot.key); if (o && o.source === 'diretor' && !o.note) o.note = `Tema trocado (${f.why} nas últimas ${cfg.cooldownWeeks} semanas): usei “${o.idea}”.` }
  return out
}

/** Receita (oferta) do MESMO imóvel não volta antes de N semanas, nem 2x na semana. `used` = linhas já criadas/agendadas. */
export function recipeBlocked(used: { item_id?: string | null; recipe?: string | null; date?: string | null }[], itemId: string, recipe: string, weekOf: string, cooldownWeeks: number): boolean {
  const ws = Date.parse(`${weekStartOf(weekOf)}T00:00:00Z`)
  return used.some(u => {
    if (u.item_id !== itemId || u.recipe !== recipe) return false
    const d = u.date ? Date.parse(`${String(u.date).slice(0, 10)}T00:00:00Z`) : NaN
    return !(Number.isFinite(d) && d <= ws - cooldownWeeks * 7 * 86400000)
  })
}
