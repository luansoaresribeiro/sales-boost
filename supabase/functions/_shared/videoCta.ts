// "Comente QUERO" só existe se a resposta do QUERO daquele imóvel foi aprovada
// (engagement_automations com item_id, active=true e message preenchida). Sem
// isso o público comentaria e ninguém responderia. A decisão é do CÓDIGO, não
// da IA: o prompt recebe a regra pronta e, depois da IA, uma trava confere o
// texto. Funções puras (testáveis fora do Deno). O CTA alternativo vem da
// ficha do setor (config.ctas.sem_automacao) — regra 6.

export const DEFAULT_CTA_SEM_AUTOMACAO = 'Me chama no direct'
/** Começo do aviso gravado em reasoning — o item-videos usa pra não apagá-lo. */
export const QUERO_NOTICE_PREFIX = 'Sem resposta do QUERO aprovada'

export interface VideoAutomation { active?: boolean | null; message?: string | null; keywords?: string[] | null }
export interface CtaDecision {
  /** true = há resposta aprovada pra este imóvel */
  approved: boolean
  keyword: string | null
  /** CTA que a peça deve ter ("Comente QUERO" ou o alternativo da ficha) */
  cta: string
  /** regra pronta pro prompt da legenda */
  promptRule: string
}

// Detector de "peça comentário com palavra-chave" (ver findCta). Verbos de pedido
// (comente/digite/escreva/mande/responda/envie) seguidos, em até 3 palavras, de
// uma palavra-chave: entre aspas, em MAIÚSCULAS (2+ letras) ou conhecida
// (quero/visita/simulação — só se só houver "enchimento" no meio, pra "comente o
// que achou da visita" não ser pego).
const CTA_VERB_RE = /(?<![\p{L}])(?:coment(?:a|e|ar|em|am)|digit(?:a|e|em)|escrev(?:a|e|em)|mand(?:a|e|em)|respond(?:a|e|am|em)|envi(?:a|e|em))(?![\p{L}])/giu
const KNOWN_KEYWORDS = new Set(['quero', 'visita', 'simulação', 'simulacao'])
const FILLERS = new Set(['palavra', 'aqui', 'aí', 'ai', 'abaixo', 'agora', 'só', 'so', 'apenas', 'mesmo', 'eu'])
const EDGE_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

interface CtaHit { start: number; end: number; words: string[] }

/** Acha a primeira frase de "comente PALAVRA" (qualquer variação). `except` = palavra aprovada (não conta). */
function findCta(text: string, except?: string, extra?: string): CtaHit | null {
  const known = new Set(KNOWN_KEYWORDS); if (extra) known.add(extra.toLowerCase())
  const exc = except?.toUpperCase()
  for (const v of text.matchAll(CTA_VERB_RE)) {
    const vEnd = (v.index ?? 0) + v[0].length
    const toks = [...text.slice(vEnd).matchAll(/\S+/g)].slice(0, 12).map(m => ({ raw: m[0], end: vEnd + (m.index ?? 0) + m[0].length, w: m[0].replace(EDGE_RE, '') }))
    let gap = 0, onlyFiller = true
    for (let i = 0; i < toks.length; i++) {
      const { raw, w } = toks[i]
      if (!w) continue
      if (gap > 3) break
      const quoted = /^["“”'‘«]/.test(raw) && w.length >= 2
      const caps = /^\p{Lu}{2,}$/u.test(w)
      const kw = quoted || caps || (onlyFiller && known.has(w.toLowerCase()))
      if (kw) {
        const words = [w.toUpperCase()]; let end = toks[i].end
        for (let j = i + 1; j < toks.length && /^\p{Lu}{2,}$/u.test(toks[j].w) && !/[.!?]$/.test(toks[j - 1].raw); j++) { words.push(toks[j].w.toUpperCase()); end = toks[j].end }
        if (exc && words.includes(exc)) break
        const before = text.slice(0, v.index ?? 0), cut = Math.max(before.search(/[.!?\n][^.!?\n]*$/) , -1)
        const start = cut >= 0 ? cut + 1 : (v.index ?? 0)
        const m = /[.!?\n]/.exec(text.slice(end))
        const stop = m ? end + (m.index ?? 0) + (m[0] === '\n' ? 0 : 1) : text.length
        return { start, end: stop, words }
      }
      const filler = FILLERS.has(w.toLowerCase()) || (w.toLowerCase() === 'a' && toks[i + 1]?.w.toLowerCase() === 'palavra')
      onlyFiller = onlyFiller && filler
      gap++
      if (/[.!?]$/.test(raw)) break
    }
  }
  return null
}

function fichaCta(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_CTA_SEM_AUTOMACAO
}

export function decideVideoCta(automation: VideoAutomation | null | undefined, ctas?: { sem_automacao?: unknown } | null): CtaDecision {
  const alt = fichaCta(ctas?.sem_automacao)
  const keyword = (automation?.keywords ?? []).map(k => String(k ?? '').trim()).find(Boolean) ?? null
  const approved = !!automation && automation.active === true && String(automation.message ?? '').trim() !== '' && !!keyword
  if (approved && keyword) {
    return { approved, keyword, cta: `Comente ${keyword}`, promptRule: `Regra de chamada final (decidida pelo sistema): use exatamente "Comente ${keyword}" como CTA — a resposta automática desta palavra já está aprovada.` }
  }
  return { approved: false, keyword: null, cta: alt, promptRule: `Regra de chamada final (decidida pelo sistema): NÃO peça comentário com palavra-chave (nada de "Comente QUERO", "Comente VISITA" etc.). Use este CTA: "${alt}".` }
}

/** Remove, da legenda, toda frase que pede comentário com palavra-chave (exceto a aprovada). */
function dropCtaPhrases(text: string, except?: string, extra?: string): string {
  let t = text
  for (let n = 0; n < 20; n++) {
    const h = findCta(t, except, extra); if (!h) break
    t = t.slice(0, h.start) + t.slice(h.end)
  }
  return t.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/[,;:–-][ \t]*$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
}
const hasKeywordCta = (s: string, except?: string, extra?: string) => !!findCta(s, except, extra)

/** Trava depois da IA: garante que legenda e CTA obedecem a decisão do código. */
export function sanitizeCaptionCta(caption: string | null, cta: string | null, d: CtaDecision): { caption: string | null; cta: string | null; changed: boolean } {
  let cap = caption, c = cta, changed = false
  const exc = d.approved ? d.keyword ?? undefined : undefined
  if (cap && hasKeywordCta(cap, exc, d.keyword ?? undefined)) {
    cap = dropCtaPhrases(cap, exc, d.keyword ?? undefined) || d.cta  // legenda esvaziou: o CTA vira a legenda mínima
    changed = true
  }
  if (!d.approved) {
    if (!c || hasKeywordCta(c, undefined, undefined)) { c = d.cta; changed = true }
  } else if (!c || !hasKeywordCta(c, undefined, d.keyword ?? undefined) || hasKeywordCta(c, exc, d.keyword ?? undefined)) { c = d.cta; changed = true }
  return { caption: cap, cta: c, changed }
}

/** Aviso pro dono (vai em reasoning) quando o QUERO não está aprovado. */
export const queroNotice = (cta: string) =>
  `${QUERO_NOTICE_PREFIX} pra este imóvel: usei '${cta}'. Aprove a resposta em '🎬 Vídeos e resposta do QUERO' no imóvel pra usar 'Comente QUERO'.`

/** Dado o reasoning atual, devolve só o aviso do QUERO (ou null) — pra ele sobreviver às trocas de reasoning. */
export const keepQueroNotice = (reasoning: string | null | undefined): string | null => {
  const i = (reasoning ?? '').indexOf(QUERO_NOTICE_PREFIX)
  return i >= 0 ? (reasoning as string).slice(i) : null
}
