// Carrossel de slides (sistema de slides, Fase 1 de PLANO-CRIATIVOS.md): o que a IA pode pedir,
// validação em código e as regras do prompt. Puro (sem Deno/rede) — testável em Node.
// O DESENHO fica em slideSystem.ts; aqui só se decide o conteúdo de cada slide.

import { COVER_STYLES, SLIDE_LAYOUTS, clean } from './slideSystem.ts'
import { sanitizeCaptionCta, type CtaDecision } from './videoCta.ts'

export interface DeckSlide { layout: string; title: string; text: string; items: string; highlight: string; cta: string }

const MIDDLE = ['lista', 'passos', 'comparacao', 'destaque'] as const
export const MAX_SLIDES = 7

// Tetos de segurança (corte em limite de palavra, sem "…"). Os limites "de verdade" vão no prompt;
// o que estoura o quadro é pego pelo overflow do render e vira pedido de texto mais curto.
const CAP = { title: 110, text: 220, item: 130, items: 6, highlight: 60, cta: 28 }

function capText(s: string, max: number): string {
  const t = clean(s).replace(/[ \t]+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max), sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim()
}

/** Rodízio da capa: 1 estilo por carrossel (conta os carrosséis já feitos pela empresa). */
export const pickCoverStyle = (previousDecks: number): string => COVER_STYLES[Math.max(0, previousDecks) % COVER_STYLES.length]

type Raw = Record<string, unknown>
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function normItems(v: unknown): string {
  const arr = Array.isArray(v) ? v.map(str) : str(v).split('\n')
  return arr.map(x => capText(x.replace(/^\s*[-–•*]\s+/, ''), CAP.item)).filter(Boolean).slice(0, CAP.items).join('\n')
}

/** 1 slide validado. `forced` = layout que o sistema impõe (capa/fecho nas pontas). */
export function normalizeSlide(raw: Raw, forced: 'capa' | 'fecho' | null, postCta = ''): DeckSlide {
  const title = capText(str(raw.title), CAP.title), text = capText(str(raw.text), CAP.text)
  const items = normItems(raw.items), given = str(raw.layout).trim().toLowerCase()
  let layout: string
  if (forced) layout = forced
  else if (!given) layout = !title && !items ? 'texto' : (items ? 'lista' : 'destaque')   // resposta antiga (só "text") → texto simples
  else layout = (MIDDLE as readonly string[]).includes(given) ? given : 'destaque'          // layout inválido (inclui capa/fecho no meio) → destaque
  const cta = layout === 'fecho' ? capText(str(raw.cta) || postCta, CAP.cta) : ''
  return { layout, title, text, items, highlight: capText(str(raw.highlight), CAP.highlight), cta }
}

/** Valida o carrossel inteiro: 1º = capa, último = fecho, meio entre os layouts do sistema. */
export function normalizeDeck(rawSlides: unknown[], postCta = ''): DeckSlide[] {
  const rows = rawSlides.filter((x): x is Raw => !!x && typeof x === 'object')
    .filter(x => str(x.title).trim() || str(x.text).trim() || str(x.items).trim()).slice(0, MAX_SLIDES)
  return rows.map((x, i) => normalizeSlide(x, i === 0 ? 'capa' : i === rows.length - 1 ? 'fecho' : null, postCta))
}

/**
 * Trava do QUERO no slide (o texto vira IMAGEM, então a legenda sozinha não basta): título, texto,
 * itens e botão passam pela mesma trava da legenda. No fecho, o botão é sempre o CTA decidido pelo código
 * (sem resposta aprovada, nunca "Comente QUERO"). Fora do fecho o botão fica vazio.
 */
export function lockSlide(sl: DeckSlide, d: CtaDecision): DeckSlide {
  const f = (v: string) => { if (!v) return v; const r = sanitizeCaptionCta(v, null, d); return r.changed ? (r.caption ?? '') : v }
  const items = sl.items.split('\n').map(f).filter(Boolean).join('\n')
  const cta = sl.layout === 'fecho' ? capText(sanitizeCaptionCta(null, sl.cta || d.cta, d).cta ?? d.cta, CAP.cta) : ''
  return { ...sl, title: f(sl.title), text: f(sl.text), items, highlight: f(sl.highlight) === sl.highlight ? sl.highlight : '', cta }
}
export const lockDeck = (slides: DeckSlide[], d: CtaDecision): DeckSlide[] => slides.map(x => lockSlide(x, d))

/** Texto corrido do slide (vai em slides[].text, que as telas já leem). */
export const slideSummary = (s: DeckSlide) => [s.title, s.text, s.items.split('\n').join(' · ')].filter(Boolean).join(' — ')

const numRe = /\d+(?:[.,]\d+)*/g
/** Números do slide que NÃO estão nos dados fornecidos (regra 5). */
export function inventedNumbers(s: DeckSlide, allowed: Set<string>): string[] {
  const all = [s.title, s.text, s.items, s.cta].join(' ')
  return (all.match(numRe) ?? []).filter(n => !allowed.has(n.replace(/[.,]/g, '')))
}
export const numbersOf = (txt: string): Set<string> => new Set((txt.match(numRe) ?? []).map(n => n.replace(/[.,]/g, '')))

/** Regras do prompt do carrossel (limites curtos por campo — o render mede o resto). */
/** Modo do tema (deckTopic.ts): regulado = só dicas conferidas; geral = sem fato; leve/ausente = como sempre foi. */
export interface DeckTopicRules { mode: 'regulado' | 'geral' | 'leve'; tipCount?: number }
export function deckPromptRules(coverStyle: string, brandCta: string, topic?: DeckTopicRules): string {
  const capa = coverStyle === 'pergunta' ? '"title" = uma PERGUNTA que o público se faz (até 70 caracteres)'
    : coverStyle === 'lista' ? '"title" = promessa curta (até 60 caracteres) e "items" = 3 a 4 linhas (até 45 caracteres cada) com o que vem nos próximos slides'
    : '"title" = gancho: afirmação forte (até 70 caracteres)'
  return `- ESTE é um CARROSSEL DE SLIDES (design da marca, só texto na arte — sem foto): "slides" com ${topic?.mode === 'regulado' && topic.tipCount ? `${topic.tipCount + 2} itens (capa + ${topic.tipCount} slide${topic.tipCount > 1 ? 's' : ''} do meio, UM por dica, na ordem das dicas + fecho)` : '4 a 7 itens'}. Cada slide: {"layout","title","text","items","highlight","cta"}, em frases completas e curtas, NUNCA cortadas no meio, sem emoji, sem hashtag, sem setas.
  • 1º slide: "layout":"capa" — ${capa}; "text" = apoio opcional (até 100 caracteres).
  • slides do MEIO: um destes layouts por slide, variando entre eles:
      "lista" — "title" até 60 caracteres + "items" com 3 a 5 linhas separadas por \\n (até 80 caracteres cada);
      "passos" — igual a lista, mas as linhas são ações em ordem;
      "comparacao" — "title" até 60; "text" = "Rótulo A | Rótulo B" (até 14 caracteres cada); "items" = 2 a 3 linhas "lado A | lado B" (até 50 caracteres cada lado);
      "destaque" — "text" = uma frase de até 110 caracteres; "title" opcional = rótulo de até 24 caracteres.
  • último slide: "layout":"fecho" — "title" = chamada final (até 60 caracteres); "text" = apoio opcional (até 100); "cta" = texto do botão (até 28 caracteres${brandCta ? `, ex.: "${brandCta}"` : ''}).
  • "highlight": 1 a 3 palavras do title/text, copiadas exatamente, pra pintar na cor da marca (ou vazio).
${topic?.mode === 'regulado'
    ? '  • FATOS: use SÓ o que as DICAS CONFERIDAS abaixo dizem, sem acrescentar fato, número, prazo, taxa, lei, imposto nem programa. Números e nomes (leis, impostos, programas) exatamente como nas dicas.'
    : topic?.mode === 'geral'
      ? '  • SEM FATOS: dica GERAL e prática, sem número, prazo, taxa, valor, percentual nem nome de lei, imposto ou programa, e sem afirmar nenhuma regra.'
      : '  • NÚMEROS: só use número, preço, prazo ou estatística que esteja nos dados fornecidos acima. Na dúvida, escreva sem número.'}
  Deixe "image" vazio.
`
}

export const DECK_SLIDE_JSON = '[{"layout":"","title":"","text":"","items":"","highlight":"","cta":"","image":""}]'

export function rewritePrompt(brandName: string, s: DeckSlide, reasons: { tooLong: boolean; numbers: string[]; extra?: string[] }): string {
  const why = [
    reasons.tooLong ? 'o texto não coube no quadro: escreva uma versão BEM mais curta (cerca de 60% do tamanho), com frases completas' : '',
    reasons.numbers.length ? `estes números não estão nos dados cadastrados e NÃO podem aparecer: ${reasons.numbers.join(', ')} — escreva sem número` : '',
    ...(reasons.extra ?? []),
  ].filter(Boolean).join('; ')
  return `Você reescreve 1 slide de um carrossel de Instagram de "${brandName}". Motivo: ${why}.
Slide atual (layout "${s.layout}"): ${JSON.stringify({ title: s.title, text: s.text, items: s.items, highlight: s.highlight, cta: s.cta })}
Mantenha o layout, o sentido e o formato dos campos ("items" com linhas separadas por \\n; em "comparacao", linhas "lado A | lado B"). Sem emoji, sem inventar nada. Responda SÓ em JSON: {"title":"","text":"","items":"","highlight":"","cta":""}`
}

export { SLIDE_LAYOUTS }
