// Trava de afirmação de mercado nas peças do calendário (PR B, 2026-11-02). Função em CÓDIGO, sem Deno/rede:
// roda no Deno e no teste em Node (scripts/test-claim-lock.mjs).
//
// Problema real (Tespon, calendário): carrossel saiu com "acima de R$ 1,5 mi", "um dos m² mais valorizados",
// "vale cada centavo", "endereços mais desejados" — comparativo/superlativo de mercado sem dado nenhum. A trava que já
// existia (opportunityOutput.claimGuard) só valia nas peças de oportunidade; aqui ela vale em legenda, CTA, hashtags
// e em TODO campo de slide.
//
// Regras (decisão do dono, 2026-11-02):
//  - Termo da ficha (opportunity_texts.market_claims) só passa se a MESMA palavra está nos fatos permitidos
//    (cadastro do imóvel citado; no modo regulado, também as dicas conferidas). "luxo", "nobre", "premium",
//    "exclusivo" valem só quando o cadastro traz a palavra.
//  - Faixa de preço ("acima de R$ X", "a partir de R$ X") só vale se o valor, com unidade, está nos fatos.
//  - Disparou: reescreve 1x (IA, com a lista barrada no pedido) → persistiu: corta SÓ a frase → avisa em reasoning
//    ("Tirei afirmação sem fonte: …"). NUNCA troca por outro adjetivo.
import { allowedNumbers, claimGuard, claimRe, numbersAllowed, type AllowedNumbers, type ClaimGuard } from './opportunityOutput.ts'
import { norm, type Lang } from './opportunityEngine.ts'
import { normalizeSlide, rewritePrompt, type DeckSlide } from './deckSlides.ts'
import { parseJson } from './faqCheck.ts'

export const PRICE_RANGE_ISSUE = 'valor em dinheiro sem fonte'

/**
 * Linha de reforço pro prompt de escrita (a trava em código é quem decide; isto só reduz o retrabalho). Os exemplos vêm
 * da FICHA (market_claims) — regra 6. Ficha sem a lista (setor genérico) = '' e o prompt fica idêntico ao de antes.
 */
export function claimPromptRule(fichaTerms: string[] | null | undefined, bullet = '- '): string {
  const terms = (fichaTerms ?? []).filter(t => typeof t === 'string' && t.trim()).slice(0, 10)
  if (!terms.length) return ''
  return `${bullet}AFIRMAÇÃO DE MERCADO: nada de comparativo nem superlativo de mercado sem dado, e nenhum valor em dinheiro nem faixa de preço que não esteja nos dados cadastrados. Estes termos só valem se estiverem escritos nos dados cadastrados: ${terms.join(', ')}. Descreva só o que os dados dizem, sem qualificar o local, o valor nem a demanda.\n`
}

export interface ClaimCtx { guard: ClaimGuard; allowed: AllowedNumbers; ctxTerms: string[]; ctxWords: string[] }
/** Comparativos que só são afirmação de mercado COM complemento de lugar/mercado na frase ("bairro mais procurado"); ficha: opportunity_texts.market_claims_ctx. */
export interface CtxCfg { terms: string[]; context: string[] }
type NumSource = string | { text: string; numTags?: { value: string; unit: 'cur' | 'bed' }[] }

/** Monta a trava: termos (ficha ou genéricos) + fatos permitidos (texto e números com unidade). */
export function claimCtx(lang: Lang, factTexts: string[], numSources: NumSource[], fichaTerms?: string[] | null, extra?: { ctx?: CtxCfg | null; places?: string[] }): ClaimCtx {
  return {
    guard: claimGuard(lang, factTexts, fichaTerms), allowed: allowedNumbers(numSources.map(s => (typeof s === 'string' ? s : { text: s.text, numTags: s.numTags }))),
    ctxTerms: extra?.ctx?.terms ?? [],
    // complemento = palavras de lugar/mercado da ficha + nome do bairro/região do cadastro do imóvel (sem hard-code de setor)
    ctxWords: [...(extra?.ctx?.context ?? []), ...(extra?.places ?? [])].filter(w => typeof w === 'string' && w.trim()),
  }
}

/** Fatos de UM imóvel do catálogo (título + campos). Preço e quartos entram com unidade quando a ficha diz qual campo é (opportunity_fields). */
export function itemFacts(title: string, fields: Record<string, unknown> | null | undefined, map?: { price?: string; bedrooms?: string; location?: string } | null): { texts: string[]; nums: NumSource[]; places: string[] } {
  const f = fields ?? {}
  const texts = [title, ...Object.values(f).filter(v => typeof v === 'string' || typeof v === 'number').map(String)].filter(t => t.trim())
  const nums: NumSource[] = texts.map(t => ({ text: t }))
  const priceRaw = map?.price ? f[map.price] : undefined
  if (priceRaw !== undefined && priceRaw !== null && String(priceRaw).trim()) nums.push({ text: '', numTags: [{ value: String(priceRaw), unit: 'cur' }] })
  const bedRaw = map?.bedrooms ? f[map.bedrooms] : undefined
  if (bedRaw !== undefined && bedRaw !== null && String(bedRaw).trim()) nums.push({ text: '', numTags: [{ value: String(bedRaw), unit: 'bed' }] })
  const loc = map?.location ? String(f[map.location] ?? '').trim() : ''
  return { texts, nums, places: loc ? [loc] : [] }
}

// Valor em dinheiro solto ("R$ 1,5 mi", "850 mil reais", "1.5 million"): em peça do calendário só vale se o valor, com unidade, está
// nos fatos cadastrados (regra 5) — com ou sem "acima de/a partir de". Confere só os trechos de dinheiro, não os outros números da frase.
const MONEY_G = /(?:r\$|us\$|\$)\s*\d[\d.,]*(?:\s*(?:milhoes|milhao|millions?|mil|mi|k)(?![a-z]))?|\d[\d.,]*\s*(?:milhoes|milhao|millions?|(?:mil|mi|k)?\s*reais)(?![a-z])/g

/** O que a frase afirma sem fonte: termos da ficha que não estão nos fatos e/ou valor em dinheiro sem valor nos fatos. */
export function claimIssues(sentence: string, ctx: ClaimCtx): string[] {
  const n = norm(sentence)
  if (!n) return []
  const out = ctx.guard.terms.filter(t => { const re = claimRe(t); return re.test(n) && !re.test(ctx.guard.factsNorm) })
  // Comparativo (ctxTerms) só conta com complemento de lugar/mercado na frase, ou na forma "mais caro QUE <X>":
  // "financiamento mais barato" e "O mais caro é errar o prazo" passam; "bairro mais procurado" e "mais barato que Ipanema" não.
  for (const t of ctx.ctxTerms) {
    const re = claimRe(t)
    if (!re.test(n) || re.test(ctx.guard.factsNorm)) continue
    const compare = new RegExp(norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(?:que|than)(?:$|[^a-z])').test(n)
    const place = ctx.ctxWords.some(w => new RegExp('(?:^|[^a-z0-9])' + norm(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\w*)').test(n))
    if (compare || place) out.push(t)
  }
  const money = n.match(MONEY_G) ?? []
  if (money.some(m => !numbersAllowed(m, ctx.allowed))) out.push(PRICE_RANGE_ISSUE)
  return out
}

const splitSentences = (line: string): string[] => line.replace(/[ \t]+/g, ' ').trim().split(/(?<=[.!?])\s+/)

/** Tira só as frases com afirmação sem fonte (linha a linha: parágrafos da legenda ficam). */
export function cutClaims(text: string, ctx: ClaimCtx): { text: string; removed: string[] } {
  const removed: string[] = []
  const lines = String(text ?? '').split('\n').map(line => {
    if (!line.trim()) return ''
    return splitSentences(line).filter(p => { if (!p.trim()) return false; if (claimIssues(p, ctx).length) { removed.push(p.trim()); return false } return true }).join(' ')
  })
  // junta parágrafos: linha que sumiu não deixa buraco duplo
  const kept = lines.filter((l, i) => l || (i > 0 && lines[i - 1] && lines.slice(i + 1).some(Boolean)))
  return { text: kept.join('\n').trim(), removed }
}

/** Termos/aviso de todas as frases de um texto (sem cortar). */
export function textIssues(text: string, ctx: ClaimCtx): string[] {
  const out = new Set<string>()
  for (const line of String(text ?? '').split('\n')) for (const s of splitSentences(line)) for (const i of claimIssues(s, ctx)) out.add(i)
  return [...out]
}

/** Hashtags: sai a tag cujo texto contém termo barrado (ex.: #luxo) — sem fato que a sustente. */
export function cutHashtags(tags: string, ctx: ClaimCtx): { text: string; removed: string[] } {
  const removed: string[] = []
  const kept = String(tags ?? '').split(/\s+/).filter(Boolean).filter(tag => {
    const flat = norm(tag).replace(/[^a-z0-9]/g, '')
    const bad = ctx.guard.terms.some(t => { const k = norm(t).replace(/[^a-z0-9]/g, ''); return k.length >= 4 && flat.includes(k) && !ctx.guard.factsNorm.replace(/[^a-z0-9]/g, '').includes(k) })
    if (bad) removed.push(tag)
    return !bad
  })
  return { text: kept.join(' '), removed }
}

/** "Tirei afirmação sem fonte: …" — o dono vê o que saiu antes de aprovar. */
export function claimNotice(removed: string[]): string | null {
  const uniq = [...new Set(removed.map(r => r.replace(/\s+/g, ' ').trim()).filter(Boolean))]
  if (!uniq.length) return null
  const shown = uniq.slice(0, 3).map(r => `“${r.length > 90 ? `${r.slice(0, 89).trimEnd()}…` : r}”`).join('; ')
  return `Tirei afirmação sem fonte: ${shown}${uniq.length > 3 ? ` (+${uniq.length - 3})` : ''}.`
}

export const claimWhy = (issues: string[]): string =>
  `a versão atual traz afirmação de mercado sem dado cadastrado (${issues.join(', ')}). NÃO use esses termos nem comparativo/superlativo/faixa de preço; escreva só o que os dados dizem, sem trocar por outro adjetivo de mercado`

/** Texto solto (legenda/CTA): reescreve 1x via `rewrite` (devolve o texto novo ou null) → ainda ruim: corta a frase. */
export async function lockText(text: string, ctx: ClaimCtx, rewrite?: (issues: string[]) => Promise<string | null>): Promise<{ text: string; removed: string[] }> {
  if (!text || !textIssues(text, ctx).length) return { text, removed: [] }
  let cur = text
  if (rewrite) {
    try { const r = await rewrite(textIssues(text, ctx)); if (r && r.trim()) cur = r } catch (e) { console.error('claimLock: reescrita falhou', e) }
  }
  return cutClaims(cur, ctx)
}

export const captionRewritePrompt = (brand: string, caption: string, issues: string[]): string =>
  `Você reescreve a legenda de um post de Instagram de "${brand}". Motivo: ${claimWhy(issues)}. Mantenha o tom, o idioma e a estrutura, sem emoji novo, sem inventar nada, sem recado pro corretor.
Legenda atual:
${caption}
Responda SÓ em JSON: {"caption":""}`

const slideTexts = (s: DeckSlide): string[] => [s.title, s.text, ...s.items.split('\n'), s.cta]
export const slideIssues = (s: DeckSlide, ctx: ClaimCtx): string[] => [...new Set(slideTexts(s).flatMap(t => textIssues(t, ctx)))]

/** Corta (sem IA) as frases barradas de cada campo do slide. Slide vazio fica vazio — quem chama decide o que fazer. */
export function cutSlide(s: DeckSlide, ctx: ClaimCtx, ctaFallback = ''): { slide: DeckSlide; removed: string[] } {
  const removed: string[] = []
  const cut = (v: string) => { const r = cutClaims(v, ctx); removed.push(...r.removed); return r.text }
  const title = cut(s.title), text = cut(s.text)
  const items = s.items.split('\n').map(cut).filter(Boolean).join('\n')
  const cta = s.cta && textIssues(s.cta, ctx).length ? ctaFallback : s.cta
  const highlight = s.highlight && textIssues(s.highlight, ctx).length ? '' : s.highlight
  return { slide: { ...s, title, text, items, highlight, cta }, removed }
}
const isEmpty = (s: DeckSlide) => !s.title.trim() && !s.text.trim() && !s.items.trim()

export interface LockDeckIn {
  slides: DeckSlide[]; caption: string; hashtags: string; cta: string; ctx: ClaimCtx
  /** Pergunta à IA (rápida). Ausente = só corta. */
  ask?: (prompt: string, maxTokens: number) => Promise<string>
  brand: string
  /** Texto neutro quando o corte esvazia capa/fecho (ex.: nome da marca) — nunca texto novo da IA. */
  neutral: string
  /** CTA seguro da ficha (decideVideoCta) pro botão do fecho quando o dele sai ou vem vazio. */
  ctaFallback?: string
  /** Trava do QUERO etc. aplicada ao slide reescrito. */
  post?: (s: DeckSlide) => DeckSlide
}
export interface LockDeckOut { slides: DeckSlide[]; caption: string; hashtags: string; cta: string; removed: string[] }

/** Legenda + CTA + hashtags + todo campo de slide: reescreve 1x (em paralelo) → corta a frase → avisa. */
export async function lockDeckClaims(a: LockDeckIn): Promise<LockDeckOut> {
  const { ctx, ask } = a
  const removed: string[] = []
  const post = a.post ?? ((s: DeckSlide) => s)
  const slides = await Promise.all(a.slides.map(async (s): Promise<DeckSlide | null> => {
    let cur = s
    const issues = slideIssues(cur, ctx)
    if (issues.length && ask) {
      try {
        const raw = parseJson<Record<string, unknown>>(await ask(rewritePrompt(a.brand, cur, { tooLong: false, numbers: [], extra: [claimWhy(issues)] }), 600), {})
        if (Object.keys(raw).length) {
          const next = normalizeSlide(raw, cur.layout === 'capa' || cur.layout === 'fecho' ? cur.layout : null, cur.cta)
          next.layout = cur.layout
          cur = post(next)
        }
      } catch (e) { console.error('claimLock: reescrita do slide falhou', e) }
    }
    const c = cutSlide(cur, ctx, a.ctaFallback || a.cta)
    removed.push(...c.removed)
    let out = c.slide
    if (out.layout === 'fecho' && !out.cta) out = { ...out, cta: a.ctaFallback || a.cta }   // fecho sem botão: CTA da ficha
    if (isEmpty(out)) {
      if (out.layout === 'capa' || out.layout === 'fecho') out = { ...out, title: a.neutral }
      else return null
    }
    return out
  }))
  // Slide do meio que esvaziou sai do carrossel (nunca vira um slide só com o nome da marca). Sobram capa e fecho no mínimo.
  const finalSlides = slides.filter((x): x is DeckSlide => !!x)
  const cap = await lockText(a.caption, ctx, ask ? async (iss) => { const r = parseJson<{ caption?: unknown }>(await ask(captionRewritePrompt(a.brand, a.caption, iss), 900), {}); return String(r.caption ?? '').trim() || null } : undefined)
  removed.push(...cap.removed)
  const cta = cutClaims(a.cta, ctx); removed.push(...cta.removed)
  const tags = cutHashtags(a.hashtags, ctx); removed.push(...tags.removed)
  return { slides: finalSlides, caption: cap.text, hashtags: tags.text, cta: cta.text, removed }
}

// ── Ficha do setor (regra 6): termos de mercado, campos de preço/quartos, capa com foto ────────────────────────────
export interface ClaimCfg { terms: string[] | null; fieldMap: { price?: string; bedrooms?: string; location?: string } | null; photoWhenItem: boolean; ctx: CtxCfg | null }
type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
/** Lê da ficha: market_claims (pt/en), opportunity_fields e carousel_cover.educativo.photo_when_item. Falhou/sem ficha = genéricos, sem foto. */
export async function loadClaimCfg(admin: Admin, verticalKey: string | null, lang: Lang): Promise<ClaimCfg> {
  const none: ClaimCfg = { terms: null, fieldMap: null, photoWhenItem: false, ctx: null }
  if (!verticalKey) return none
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const c = (data?.config ?? {}) as { opportunity_texts?: { market_claims?: Record<string, unknown>; market_claims_ctx?: Record<string, { terms?: unknown; context?: unknown }> }; opportunity_fields?: { price?: string; bedrooms?: string; location?: string }; carousel_cover?: { educativo?: { photo_when_item?: unknown } } }
    const raw = c.opportunity_texts?.market_claims?.[lang]
    const terms = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []
    const cx = c.opportunity_texts?.market_claims_ctx?.[lang]
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [])
    const ctx: CtxCfg | null = cx && strs(cx.terms).length ? { terms: strs(cx.terms), context: strs(cx.context) } : null
    return { ctx, terms: terms.length ? terms : null, fieldMap: c.opportunity_fields && typeof c.opportunity_fields === 'object' ? c.opportunity_fields : null, photoWhenItem: c.carousel_cover?.educativo?.photo_when_item === true }
  } catch (e) { console.error('claimLock: ficha não lida (segue com os termos genéricos)', e); return none }
}

// ── Nota: motivos de nota baixa decididos em CÓDIGO (sem chamada de IA) ──────────────────────────────────────────
export const QUALITY_PENALTY = 25
export interface QualityFlag { key: 'afirmacao_sem_fonte' | 'capa_fraca'; label: string }
/** "Tirei afirmação sem fonte" no reasoning = a IA tentou afirmar sem dado (a frase já saiu, mas a peça precisa de olho). Capa-índice (itens na capa) = capa fraca. */
export function qualityFlags(p: { reasoning?: string | null; slides?: unknown }): QualityFlag[] {
  const out: QualityFlag[] = []
  if (/Tirei afirmação sem fonte/.test(String(p.reasoning ?? ''))) out.push({ key: 'afirmacao_sem_fonte', label: 'a IA tentou afirmar algo de mercado sem fonte (a frase foi retirada)' })
  const first = Array.isArray(p.slides) ? (p.slides[0] as { layout?: string; text?: string } | undefined) : undefined
  if (first && first.layout === 'capa' && /( · .+){2,}/.test(String(first.text ?? ''))) out.push({ key: 'capa_fraca', label: 'a capa parece um índice dos slides, não um gancho' })
  return out
}
