// C7 — Auditoria do conteúdo, etapa 1 (dono, 23/11: "tudo sim"; docs/AUDITORIA-CONTEUDO.md, seções 2, 6 e 11).
// Regras puras (sem banco/rede), testadas em scripts/test-editorial-rules.mjs. Tudo de setor vem da ficha
// (config.content_rules e config.ctas, regra 6). Sem ficha = nada muda.
//  (a) sem dica liberada → a vaga troca de assunto (texto fixo vazio nunca vira peça);
//  (b) teto de educativos por semana + trava de ASSUNTO (theme_topics) na janela de semanas da ficha;
//  (c) CTA escolhido pelo objetivo, lista na ficha, o mesmo CTA no máximo N vezes por semana;
//  (d) honestidade ampliada: frase em primeira pessoa experiencial sem informação do corretor sai do texto;
//  (e) modelos de card desligados por setor ("trend", "problem" fora de imóveis).

export type Objective = 'visita' | 'desejo' | 'bairro' | 'decisao' | 'captar' | 'confianca'
export const OBJECTIVES: Objective[] = ['visita', 'desejo', 'bairro', 'decisao', 'captar', 'confianca']

export interface EditorialRules {
  disabledTemplates: string[]
  educationalFormats: string[]
  educationalMaxPerWeek: number | null
  ctaByObjective: Partial<Record<Objective, string[]>>
  ctaMaxPerWeek: number | null
  experientialPhrases: string[]
}

const strs = (v: unknown, max = 40): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim().slice(0, 160)).slice(0, max) : [])
const posInt = (v: unknown, lo: number, hi: number): number | null => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.floor(n) : null }

/** Lê a ficha (config inteiro). Campo ausente/ruim = regra desligada. */
export function editorialRulesFrom(config: unknown): EditorialRules {
  const c = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>
  const r = (c.content_rules && typeof c.content_rules === 'object' ? c.content_rules : {}) as Record<string, unknown>
  const ctas = (c.ctas && typeof c.ctas === 'object' ? c.ctas : {}) as Record<string, unknown>
  const byObj = (ctas.by_objective && typeof ctas.by_objective === 'object' ? ctas.by_objective : {}) as Record<string, unknown>
  const ctaByObjective: Partial<Record<Objective, string[]>> = {}
  for (const k of OBJECTIVES) { const l = strs(byObj[k], 12); if (l.length) ctaByObjective[k] = l }
  return {
    disabledTemplates: strs(r.disabled_templates, 20).map(x => x.toLowerCase()),
    educationalFormats: strs(r.educational_formats, 20),
    educationalMaxPerWeek: posInt(r.educational_max_per_week, 0, 7),
    ctaByObjective,
    ctaMaxPerWeek: posInt(ctas.max_same_per_week, 1, 7),
    experientialPhrases: strs(r.experiential_phrases, 40),
  }
}

// ── (e) modelos de card ──────────────────────────────────────────────────────────────────
/** Tira os modelos desligados pela ficha (nunca deixa a lista vazia). */
export function allowedTemplates<T>(desc: Record<string, T>, rules: EditorialRules): Record<string, T> {
  if (!rules.disabledTemplates.length) return desc
  const out = Object.fromEntries(Object.entries(desc).filter(([k]) => !rules.disabledTemplates.includes(k.toLowerCase())))
  return Object.keys(out).length ? out : desc
}

// ── (b) teto do educativo na semana ──────────────────────────────────────────────────────
/** Índices das vagas educativas que passam do teto (as últimas da semana). Sem teto na ficha = nenhuma. */
export function educationalOverflow(formats: string[], rules: EditorialRules): number[] {
  if (rules.educationalMaxPerWeek == null || !rules.educationalFormats.length) return []
  const edu = formats.map((f, i) => (rules.educationalFormats.includes(f) ? i : -1)).filter(i => i >= 0)
  return edu.slice(rules.educationalMaxPerWeek)
}

// ── (c) CTA pelo objetivo, com teto de repetição ─────────────────────────────────────────
const foldCta = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** Quantas vezes cada CTA já aparece na semana (comparação sem acento/pontuação). */
export function ctaCounts(weekCtas: (string | null | undefined)[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of weekCtas) { const k = foldCta(String(c ?? '')); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  return m
}
/**
 * Decide o CTA da peça. `current` = o que a trava do QUERO deixou. `locked` = CTA com resposta automática aprovada (não troca).
 * Mantém o atual se ainda cabe no teto; senão o primeiro da lista do objetivo que caiba; nada cabe = o menos usado da lista.
 */
export function chooseCta(a: { current: string | null; objective: Objective; weekCtas: (string | null | undefined)[]; rules: EditorialRules; locked?: boolean }): { cta: string | null; changed: boolean; reason: string | null } {
  const { rules } = a
  const list = rules.ctaByObjective[a.objective] ?? []
  if (a.locked || rules.ctaMaxPerWeek == null || !a.current) return { cta: a.current, changed: false, reason: null }
  const counts = ctaCounts(a.weekCtas)
  const used = (c: string) => counts.get(foldCta(c)) ?? 0
  if (used(a.current) < rules.ctaMaxPerWeek) return { cta: a.current, changed: false, reason: null }
  const fits = list.find(c => used(c) < rules.ctaMaxPerWeek!)
  const pick = fits ?? [...list].sort((x, y) => used(x) - used(y))[0]
  if (!pick || foldCta(pick) === foldCta(a.current)) return { cta: a.current, changed: false, reason: null }
  return { cta: pick, changed: true, reason: `CTA trocado: "${a.current}" já aparece ${used(a.current)}× nesta semana (máx. ${rules.ctaMaxPerWeek}); usei "${pick}", do objetivo da peça.` }
}
/** Troca o CTA antigo pelo novo dentro de um texto (legenda/slide), sem mexer no resto. */
export function swapCtaText(text: string, from: string, to: string): string {
  if (!text || !from || from === to) return text
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(esc, 'gi'), to)
}

// ── (d) honestidade ampliada ─────────────────────────────────────────────────────────────
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
/** Tira as frases com experiência atribuída ao corretor ("na minha experiência", "já vi muitos clientes"…). */
export function stripExperiential(text: string, rules: EditorialRules): { text: string; removed: string[] } {
  if (!text || !rules.experientialPhrases.length) return { text, removed: [] }
  const pats = rules.experientialPhrases.map(p => fold(p))
  const removed: string[] = []
  const lines = text.split('\n').map(line => {
    const parts = line.match(/[^.!?…]+[.!?…]*\s*/g) ?? [line]
    return parts.filter(s => { const hit = pats.some(p => fold(s).includes(p)); if (hit) removed.push(s.trim()); return !hit }).join('').trim()
  })
  return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), removed }
}
/** Regra extra do prompt (vazia sem lista na ficha). */
export function experientialRule(rules: EditorialRules): string {
  return rules.experientialPhrases.length
    ? ` Nunca escreva experiência pessoal do corretor que ele não informou (ex.: ${rules.experientialPhrases.slice(0, 3).map(p => `"${p}"`).join(', ')}).`
    : ''
}

// ── (a) sem dica liberada → outro assunto ────────────────────────────────────────────────
/** Primeiro tema alternativo da ficha que NÃO é de tema regulado e não repete nada (quem chama passa `isRegulated` e `repeats`). */
export function pickUnregulatedAlternative(alternatives: string[], isRegulated: (t: string) => boolean, repeats: (t: string) => boolean): string | null {
  for (const a of alternatives) if (a && !isRegulated(a) && !repeats(a)) return a
  return null
}
