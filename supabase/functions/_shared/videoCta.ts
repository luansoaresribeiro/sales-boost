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

// "Comente QUERO", "comenta VISITA", "COMENTE SIMULAÇÃO". Palavra-chave em
// MAIÚSCULAS (3+ letras) — "comente abaixo" não é palavra-chave.
const COMMENT_KEYWORD_RE = /(?:[Cc]oment|COMENT)[eaEA]r?\s+["“'‘]?([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})(?![A-Za-zÀ-ÿ])["”'’]?/g

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

function dropSentences(text: string, bad: (s: string) => boolean): string {
  return text.split('\n').map(line => {
    const parts = line.split(/(?<=[.!?])\s+/)
    return parts.filter(p => !bad(p)).join(' ').trim()
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
const hasKeywordCta = (s: string, except?: string) => {
  for (const m of s.matchAll(COMMENT_KEYWORD_RE)) if (!except || m[1].toUpperCase() !== except.toUpperCase()) return true
  return false
}

/** Trava depois da IA: garante que legenda e CTA obedecem a decisão do código. */
export function sanitizeCaptionCta(caption: string | null, cta: string | null, d: CtaDecision): { caption: string | null; cta: string | null; changed: boolean } {
  let cap = caption, c = cta, changed = false
  if (!d.approved) {
    if (cap && hasKeywordCta(cap)) { cap = dropSentences(cap, s => hasKeywordCta(s)) || null; changed = true }
    if (!c || hasKeywordCta(c)) { c = d.cta; changed = true }
  } else {
    if (cap && hasKeywordCta(cap, d.keyword ?? undefined)) { cap = dropSentences(cap, s => hasKeywordCta(s, d.keyword ?? undefined)) || null; changed = true }
    if (!c || !hasKeywordCta(c) || hasKeywordCta(c, d.keyword ?? undefined)) { c = d.cta; changed = true }
  }
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
