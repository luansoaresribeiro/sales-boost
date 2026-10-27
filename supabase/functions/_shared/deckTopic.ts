// Carrossel educativo com fonte (PLANO-CRIATIVOS, decisão C da "Análise 2026-10-22").
// Funções PURAS (sem Deno, sem rede) — testáveis em Node. A orquestração (banco + IA) fica em deckGuard.ts.
//
// Três modos, decididos pelo TEMA da peça:
//  - regulado: tema que a ficha marca como regulado (jurídico, financiamento, documentação, impostos…)
//    COM dica liberada do dica_faq → o carrossel só repete o que as dicas dizem.
//  - geral: tema regulado SEM dica liberada → dica geral, sem número, prazo, taxa nem nome de lei.
//  - leve: qualquer outro tema → livre, com a trava de números de sempre + rede de segurança contra
//    termos regulados (ITBI, FGTS…) que escaparem.
// Tudo que é do setor (categorias, termos, termos regulados) vem da ficha (config.faq, regra 6).

import { isDue, isOfficial, isOfficiallyReleased, numberFacts, numbersIn, type FaqConfig, type FaqRow } from './faqCheck.ts'
import type { DeckSlide } from './deckSlides.ts'

export type DeckMode = 'regulado' | 'geral' | 'leve'
export interface TopicCfg {
  categories: { key: string; label: string }[]
  regulated_categories: string[]
  category_terms: Record<string, string[]>
  regulated_terms: string[]
}

/** Config de tema a partir da ficha (config.faq). Sem categorias regulamentadas e sem termos regulados = null (fluxo antigo). */
export function topicCfgOf(cfg: Partial<FaqConfig> | null | undefined): TopicCfg | null {
  if (!cfg) return null
  const t: TopicCfg = {
    categories: cfg.categories ?? [], regulated_categories: cfg.regulated_categories ?? [],
    category_terms: cfg.category_terms ?? {}, regulated_terms: cfg.regulated_terms ?? [],
  }
  return t.regulated_categories.length || t.regulated_terms.length ? t : null
}

/** minúsculas, sem acento. */
export const norm = (s: string): string => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** O termo aparece como palavra inteira (aceita plural simples) no texto já normalizado? */
export function hasTerm(normText: string, term: string): boolean {
  const t = norm(term).trim()
  if (!t) return false
  return new RegExp(`(?<![a-z0-9])${escRe(t)}(?:s|es)?(?![a-z0-9])`).test(normText)
}

// ── 1) Classificação do tema ───────────────────────────────────────────────────────────────
/** Categoria com mais termos (distintos) no texto; empate → a regulada (lado seguro), depois a ordem da ficha. Nada → null. */
export function classifyByTerms(text: string, cfg: TopicCfg): { category: string | null; regulated: boolean; hits: number } {
  const n = norm(text)
  let best: { key: string; hits: number } | null = null
  for (const c of cfg.categories) {
    const hits = new Set((cfg.category_terms[c.key] ?? []).filter(t => hasTerm(n, t)).map(norm)).size
    if (!hits) continue
    const reg = (k: string) => cfg.regulated_categories.includes(k)
    if (!best || hits > best.hits || (hits === best.hits && reg(c.key) && !reg(best.key))) best = { key: c.key, hits }
  }
  return best ? { category: best.key, regulated: cfg.regulated_categories.includes(best.key), hits: best.hits } : { category: null, regulated: false, hits: 0 }
}

/**
 * Texto que decide o TEMA da peça: só o que é assunto de verdade (ângulo/pilar/propósito da vaga, gancho, ideia do dono, gancho e
 * oferta do Diretor). O título da vaga só entra quando é a ideia do dono — numa vaga do calendário ele é o NOME DO FORMATO
 * ("Carrossel educativo (dicas conferidas; tema leve livre)"), que não diz nada do tema e tem palavras do catálogo ("dicas").
 */
export function topicText(a: { title?: string; titleIsFormat?: boolean; hook?: string; angle?: string; hookAngle?: unknown; offer?: unknown }): string {
  return [a.titleIsFormat ? '' : a.title, a.hook, a.angle, a.hookAngle, a.offer].filter(Boolean).join(' ')
}

/** Pergunta barata pra IA quando os termos não decidiram (≤ 200 tokens de resposta). */
export function topicPrompt(text: string, cfg: TopicCfg): string {
  return `Classifique o TEMA principal deste conteúdo de Instagram numa destas categorias, ou "leve" se não for nenhuma delas.
Categorias: ${cfg.categories.map(c => `${c.key} (${c.label})`).join('; ')}
Conteúdo: ${norm(text).trim() ? text.trim().slice(0, 600) : '(sem descrição)'}
Responda SÓ com a chave da categoria ou a palavra leve, sem mais nada.`
}
/** Resposta da IA validada: só vale chave da lista; qualquer outra coisa = "leve". */
export function parseTopicAnswer(raw: string, cfg: TopicCfg): string {
  const word = norm(String(raw ?? '')).replace(/[^a-z0-9_\s]/g, ' ').trim().split(/\s+/)[0] ?? ''
  return cfg.categories.some(c => c.key === word) ? word : 'leve'
}

// ── 2) Dicas liberadas ─────────────────────────────────────────────────────────────────────
const inCategory = (r: FaqRow, category: string) => r.meta?.category === category
/** Dicas da categoria que venceram a reconferência (a quem chama cabe reconferir, no máximo `max`). */
export const dueTips = (rows: FaqRow[], category: string, now = Date.now(), max = 2): FaqRow[] =>
  rows.filter(r => inCategory(r, category) && isDue(r.meta, now)).slice(0, max)
/** Até `max` dicas liberadas da categoria, as menos usadas primeiro. Pergunta e resposta precisam existir.
 *  Modo regulado = SÓ dica conferida em fonte oficial e não vencida (opção A, 2026-10-26): geral/aprovada_dono/revisar ficam de fora. */
export function pickTips(rows: FaqRow[], category: string, officialDomains: string[], now = Date.now(), max = 4): FaqRow[] {
  return rows.filter(r => inCategory(r, category) && isOfficiallyReleased(r.meta, officialDomains, now) && r.title?.trim() && r.content?.trim())
    .sort((a, b) => (a.meta?.used_count ?? 0) - (b.meta?.used_count ?? 0)).slice(0, max)
}
/** Números permitidos num carrossel regulado: SÓ os das dicas (nada de ficha, insight, ideia ou intenção). */
/** Cada número vira "valor|unidade" (ver numberFacts): 1500 = 1.500,00; 3% ≠ 30% ≠ 3 dias. */
export const tipNumbers = (tips: Pick<FaqRow, 'title' | 'content'>[]): Set<string> => new Set(numbersIn(tips.map(t => `${t.title} ${t.content}`).join(' ')))

export const hostOf = (url?: string): string => { try { return url ? new URL(url).hostname.replace(/^www\./, '') : '' } catch { return '' } }
/** Sites oficiais das dicas conferidas (aprovada pelo dono/geral não tem fonte → fora). Sem repetir. */
export function tipSources(tips: FaqRow[], officialDomains: string[]): string[] {
  const out: string[] = []
  for (const t of tips) {
    const c = t.meta?.check
    const h = c?.source_url && (c.status === 'conferida' || c.status === 'corrigida') && isOfficial(c.source_url, officialDomains) ? hostOf(c.source_url) : ''
    if (h && !out.includes(h)) out.push(h)
  }
  return out
}

// ── 3) Validadores (código, nunca a IA) ────────────────────────────────────────────────────
/** Texto "público" do slide (o CTA do fecho é decidido pelo código e fica de fora). */
export const slideText = (s: DeckSlide): string => [s.title, s.text, s.items, s.highlight].filter(Boolean).join('\n')

const NUM_WORD = '(?:dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|duzentas|trezentos|trezentas|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil|milhao|milhoes)'
const UNIT = '(?:dias?|mes(?:es)?|anos?|semanas?|horas?|reais|por cento|salarios? minimos?|parcelas?)'
// Fração de valor ("metade do valor", "o dobro da entrada", "um terço do preço").
const FRACTION_RE = /(?<![a-z0-9])(?:metade|dobro|triplo|quadruplo|quintuplo|(?:um|dois|tres)\s+(?:terco|tercos)|(?:um|tres)\s+(?:quarto|quartos)|um\s+quinto)\s+d[oae]s?\s+(?:valor|entrada|preco|parcela|renda|salario|financiamento|imovel|aluguel|custo)(?![a-z0-9])/g
// Fato "por extenso" (sem algarismo). Número pequeno SEM unidade ("três erros comuns") não entra.
const FACT_RES: RegExp[] = [
  new RegExp(`(?<![a-z0-9])${NUM_WORD}(?:\\s+e\\s+${NUM_WORD})?\\s+${UNIT}(?![a-z0-9])`, 'g'),
  /(?<![a-z0-9])(?:art\.|artigo)(?![a-z])/g,
  /(?<![a-z0-9])aliquotas?(?![a-z0-9])/g,
  /(?<![a-z0-9])lei\s+(?:n[o.]?\s*)?\d/g,
  /(?<![a-z0-9])lei\s+d[oae]s?\s+[a-z]{3,}/g,
  /(?<![a-z0-9])lei\s+(?:federal|estadual|municipal|complementar|ordinaria)(?![a-z0-9])/g,
  FRACTION_RE,
]
const LEI_NOME_RE = /(?<![\p{L}])Lei\s+\p{Lu}/gu // "Lei Geral…", "Lei Maria…" (maiúscula = nome próprio)
const DIGIT_RE = /\d+(?:[.,]\d+)*/g

/** Trechos "por extenso" que carregam fato (prazo/valor/lei), normalizados. */
function factPhrases(text: string): string[] {
  const n = norm(text), out: string[] = []
  for (const re of FACT_RES) for (const m of n.matchAll(re)) out.push(m[0].trim())
  for (const m of text.matchAll(LEI_NOME_RE)) out.push(norm(m[0]).trim())
  return out
}

/** Junta siglas pontuadas/espaçadas (já normalizadas): "i.t.b.i." / "i p t u" → "itbi" / "iptu". Exige 3+ letras isoladas (não mexe em "a matrícula").
 *  Uma letra-palavra colada na sigla ("o i p t u") também gera a sigla sem ela ("oiptu iptu oipt"). */
export const squash = (n: string): string => n.replace(/(?<![a-z0-9])[a-z](?:(?:\.\s?|\s)[a-z]){2,}\.?(?![a-z0-9])/g, m => { const j = m.replace(/[^a-z]/g, ''); return `${j} ${j.slice(1)} ${j.slice(0, -1)}` })

/** Termos regulados (da ficha) que aparecem no texto. */
export const regulatedHits = (text: string, terms: string[]): string[] => { const n = squash(norm(text)); return terms.filter(t => hasTerm(n, t)) }

/** Modo geral: nenhum fato. Devolve o que foi pego (vazio = ok). Permite "três erros comuns" e "visite em horários diferentes". */
export function validateGeneral(texts: string[], regulatedTerms: string[]): string[] {
  const t = texts.join('\n'), n = norm(t), out = new Set<string>()
  for (const d of t.match(DIGIT_RE) ?? []) out.add(`número ${d}`)
  if (/%/.test(t)) out.add('percentual')
  if (/r\$/.test(n)) out.add('valor em R$')
  if (/(?<![a-z0-9])reais(?![a-z0-9])/.test(n)) out.add('valor em reais')
  if (/por\s?cento/.test(n)) out.add('por cento')
  for (const p of factPhrases(t)) out.add(p)
  for (const r of regulatedHits(t, regulatedTerms)) out.add(r)
  return [...out]
}

/** Modo regulado: só números e termos que as dicas têm. Devolve o que sobrou fora das dicas (vazio = ok). */
export function validateRegulated(texts: string[], tips: Pick<FaqRow, 'title' | 'content'>[], regulatedTerms: string[]): string[] {
  const t = texts.join('\n'), allowed = tipNumbers(tips), tn = squash(norm(tips.map(x => `${x.title} ${x.content}`).join(' '))), out = new Set<string>()
  for (const f of numberFacts(t)) if (!allowed.has(f.key)) out.add(`número ${f.raw}`)
  for (const p of factPhrases(t)) if (!tn.includes(p)) out.add(p)
  for (const r of regulatedHits(t, regulatedTerms)) if (!hasTerm(tn, r)) out.add(r)
  return [...out]
}

/** Modo leve: só a rede de segurança — termos regulados da ficha (os números têm a trava de sempre). */
export const validateLight = (texts: string[], regulatedTerms: string[]): string[] => regulatedHits(texts.join('\n'), regulatedTerms)

// ── 4) Texto determinístico (quando a IA não acerta) ───────────────────────────────────────
/** Corta em fim de frase (nunca no meio): junta frases até `soft`; se a 1ª já passa, usa até `hard`; senão corta em palavra. */
export function cutAtSentence(s: string, soft = 150, hard = 220): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= soft) return t
  const parts = t.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [t]
  let acc = ''
  for (const p of parts) { if ((acc + p).trim().length > soft) break; acc += p }
  if (acc.trim()) return acc.trim()
  const first = parts[0].trim()
  if (first.length <= hard) return first
  const cut = first.slice(0, hard), sp = cut.lastIndexOf(' ')
  return (sp > hard * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, '') + '.'
}

const FALLBACK_TX = {
  pt: {
    tipsCover: (label: string) => `${label}: o que você precisa saber`, tipsCoverText: 'Deslize pra ver',
    end: 'Ficou com alguma dúvida?', endText: 'Fale com a gente.',
    genCover: (label: string) => `${label}: o que saber?`, genCoverText: 'Deslize pra ver',
    gen1: 'Cada caso tem as suas particularidades.', gen2: 'Antes de decidir, confira as regras com quem entende e em fonte oficial.',
    genEnd: 'Quer conversar sobre o seu caso?', label: 'Uma dica rápida',
    genCaption: (label: string) => `${label}: cada caso tem as suas particularidades. Antes de decidir, confira as regras com quem entende do assunto e em fonte oficial. Fale com a gente para conversar sobre o seu caso.`,
    source: 'Fonte',
  },
  en: {
    tipsCover: (label: string) => `${label}: what you need to know`, tipsCoverText: 'Swipe to see',
    end: 'Any questions left?', endText: 'Talk to us.',
    genCover: (label: string) => `${label}: what to know?`, genCoverText: 'Swipe to see',
    gen1: 'Every case has its own particularities.', gen2: 'Before deciding, check the rules with someone who knows the subject and in an official source.',
    genEnd: 'Want to talk about your case?', label: 'A quick tip',
    genCaption: (label: string) => `${label}: every case has its own particularities. Before deciding, check the rules with someone who knows the subject and in an official source. Talk to us about your case.`,
    source: 'Source',
  },
} as const
const tx = (lang?: string | null) => (lang === 'en' ? FALLBACK_TX.en : FALLBACK_TX.pt)
const slide = (layout: string, title: string, text: string, cta = ''): DeckSlide => ({ layout, title, text, items: '', highlight: '', cta })
const sourceLine = (hosts: string[], lang?: string | null) => (hosts.length ? `${tx(lang).source}: ${hosts.slice(0, 2).join(', ')}` : '')

/** Slide do meio = a resposta da dica, cortada em fim de frase. */
export const tipFallbackSlide = (tip: Pick<FaqRow, 'title' | 'content'>, label: string): DeckSlide =>
  slide('destaque', cutAtSentence(label, 24, 24), cutAtSentence(tip.content, 150, 220))
/** Carrossel inteiro só com as dicas (capa + 1 por dica + fecho com a fonte). */
export function tipFallbackDeck(tips: Pick<FaqRow, 'title' | 'content'>[], label: string, hosts: string[], ctaText: string, lang?: string | null): DeckSlide[] {
  const t = tx(lang)
  return [slide('capa', cutAtSentence(t.tipsCover(label), 70, 70), t.tipsCoverText),
    ...tips.map(x => tipFallbackSlide(x, label)),
    slide('fecho', t.end, [t.endText, sourceLine(hosts, lang)].filter(Boolean).join(' '), ctaText)]
}
export function tipFallbackCaption(tips: Pick<FaqRow, 'title' | 'content'>[], hosts: string[], lang?: string | null): string {
  const body = tips.map(x => `${x.title.trim()}\n${x.content.trim()}`).join('\n\n')
  return [body, sourceLine(hosts, lang)].filter(Boolean).join('\n\n').slice(0, 1800)
}
/** Dica geral: texto fixo, sem nenhum fato. `label` = nome da categoria na ficha (vazio = genérico). */
export function generalFallbackDeck(label: string, ctaText: string, lang?: string | null): DeckSlide[] {
  const t = tx(lang), l = label || t.label
  return [slide('capa', cutAtSentence(t.genCover(l), 70, 70), t.genCoverText), slide('destaque', '', t.gen1), slide('destaque', '', t.gen2), slide('fecho', t.genEnd, '', ctaText)]
}
export const generalFallbackCaption = (label: string, lang?: string | null): string => tx(lang).genCaption(label || tx(lang).label)
/** Põe "Fonte: <site>" no texto do fecho (se ainda não tem). */
export function withSource(slides: DeckSlide[], hosts: string[], lang?: string | null): DeckSlide[] {
  const line = sourceLine(hosts, lang)
  if (!line) return slides
  return slides.map(s => s.layout === 'fecho' && !norm(s.text).includes('fonte') && !norm(s.text).includes('source') ? { ...s, text: [s.text, line].filter(Boolean).join(' ').slice(0, 220) } : s)
}

// ── 5) Apelido de formato ──────────────────────────────────────────────────────────────────
/** carrossel_slides → carrossel_educativo (mapa da ficha, já validado por fetchFormatAliases). Sem apelido = a mesma chave. */
export const resolveAlias = (key: string, aliases?: Record<string, string> | null): string => (aliases && Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : key)
