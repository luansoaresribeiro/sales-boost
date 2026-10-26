// Carrossel educativo com fonte (decisão C) — a parte que fala com banco e IA. As regras puras
// (classificar, validar, texto de reserva) estão em deckTopic.ts. Aqui: decidir o modo da peça
// (decideTopic) e garantir, DEPOIS da IA escrever, que o texto respeita o modo (guardDeck).
// A IA é injetada (`ask`) pra isso rodar igual no Deno e num teste em Node.
import { checkAndSave, fetchFaqConfig, getTavilyKey, parseJson, type FaqConfig, type FaqRow } from './faqCheck.ts'
import { normalizeSlide, rewritePrompt, type DeckSlide } from './deckSlides.ts'
import {
  classifyByTerms, dueTips, generalFallbackCaption, generalFallbackDeck, norm, parseTopicAnswer, pickTips, slideText, tipFallbackCaption, tipFallbackDeck, tipSources,
  topicCfgOf, topicPrompt, validateGeneral, validateLight, validateRegulated, withSource, type DeckMode, type TopicCfg,
} from './deckTopic.ts'

type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
/** Chamada de IA: `cheap` = modelo mais barato (classificação e conferência de afirmações). */
export type Ask = (prompt: string, maxTokens: number, cheap?: boolean) => Promise<string>

export interface TopicDecision { mode: DeckMode; category: string | null; label: string; tips: FaqRow[]; hosts: string[] }

/** Config da ficha pro guarda (null = setor sem faq/termos → fluxo antigo, nada muda). */
export async function loadGuardCfg(admin: Admin, verticalKey: string | null): Promise<{ cfg: FaqConfig; tcfg: TopicCfg } | null> {
  const cfg = await fetchFaqConfig(admin, verticalKey)
  const tcfg = topicCfgOf(cfg)
  return cfg && tcfg ? { cfg, tcfg } : null
}

/**
 * Decide o modo da peça. `text` = o que diz o assunto (título/ângulo da vaga + gancho do Diretor).
 * Ordem: termos da ficha → (se não decidiu) pergunta barata à IA → tema regulado busca dica liberada.
 * `forceGeneral` = vaga de dica_faq que não achou dica (tudo geral).
 */
export async function decideTopic(a: { admin: Admin; cfg: FaqConfig; tcfg: TopicCfg; text: string; forceGeneral?: boolean; ask: Ask; anthropicKey: string; company: { id: string; city: string | null } }): Promise<TopicDecision> {
  const { admin, cfg, tcfg } = a
  if (a.forceGeneral) return { mode: 'geral', category: null, label: '', tips: [], hosts: [] }
  let category = classifyByTerms(a.text, tcfg).category
  if (!category && tcfg.categories.length) {
    try { const k = parseTopicAnswer(await a.ask(topicPrompt(a.text, tcfg), 200, true), tcfg); category = k === 'leve' ? null : k } catch (e) { console.error('deckGuard: classificação por IA falhou (tema leve)', e) }
  }
  if (!category || !tcfg.regulated_categories.includes(category)) return { mode: 'leve', category, label: tcfg.categories.find(c => c.key === category)?.label ?? '', tips: [], hosts: [] }
  const label = tcfg.categories.find(c => c.key === category)?.label ?? category
  // Dicas da categoria: reconfere até 2 vencidas (como o runFaqSlot) e pega até 4 liberadas, as menos usadas.
  const { data } = await admin.from('marketing_ai_knowledge').select('id, title, content, meta').eq('company_id', a.company.id).eq('module', 'dados').eq('kind', 'faq')
  const rows = (data ?? []) as FaqRow[]
  const due = dueTips(rows, category)
  if (due.length) {
    const ctx = { anthropicKey: a.anthropicKey, tavilyKey: await getTavilyKey(admin), cfg, city: a.company.city ?? '', companyId: a.company.id }
    for (const r of due) { try { Object.assign(r, await checkAndSave(admin, r, ctx)) } catch (e) { console.error('deckGuard: reconferência falhou', r.id, e) } }
  }
  const tips = pickTips(rows, category)
  if (!tips.length) return { mode: 'geral', category, label, tips: [], hosts: [] }
  return { mode: 'regulado', category, label, tips, hosts: tipSources(tips, cfg.official_domains) }
}

/** Bloco do prompt de escrita: as dicas são a ÚNICA fonte de fatos (regulado) ou a regra de dica geral. */
export function topicBlock(t: TopicDecision): string {
  if (t.mode === 'regulado') {
    return `\nMODO DICA CONFERIDA — tema regulado (${t.label}). As dicas abaixo foram conferidas em fonte oficial e são a ÚNICA fonte de fatos deste carrossel e da legenda:
${t.tips.map((x, i) => `Dica ${i + 1} — Pergunta: ${x.title}\nResposta: ${x.content}`).join('\n')}
${t.hosts.length ? `Fonte oficial: ${t.hosts.join(', ')}. No slide final, "text" termina com "Fonte: ${t.hosts[0]}"; a legenda termina com "Fonte: ${t.hosts[0]}".` : ''}
Regras: um slide do meio por dica, na ordem; explique com as palavras da resposta, sem acrescentar fato, exceção, número, prazo, taxa, lei, imposto ou programa que a resposta não diga. Se uma dica tem número ou nome de lei, copie exatamente. A legenda só explica o que as dicas dizem. Nada de números ou fatos vindos de outro lugar.\n`
  }
  if (t.mode === 'geral') return `\nMODO DICA GERAL — tema regulado${t.label ? ` (${t.label})` : ''} SEM dica conferida em fonte oficial. Escreva só conselho geral e prático: NENHUM número, prazo, taxa, valor, percentual, nome de lei, imposto ou programa, e nenhuma regra afirmada como fato. Pode incentivar a conferir em fonte oficial ou falar com quem entende.\n`
  return ''
}

const unitIdx = (u: string): number | 'c' | null => { const m = /slide\s*(\d+)/i.exec(u); if (m) return Number(m[1]) - 1; return /legenda/i.test(u) ? 'c' : null }

export interface GuardResult { slides: DeckSlide[]; caption: string; notes: string[]; unitOk: (i: number, s: DeckSlide) => boolean }

/**
 * Confere (e conserta) o carrossel e a legenda depois da IA escrever. Não usa a IA pra decidir se pode: o validador é código.
 * regulado: números e termos só os das dicas → reescreve 1x → texto da dica; depois um verificador barato de afirmações.
 * geral: nenhum fato → reescreve 1x → texto fixo sem fato. leve: só avisa termo regulado (reescreve 1x).
 */
export async function guardDeck(a: {
  topic: TopicDecision; tcfg: TopicCfg; slides: DeckSlide[]; caption: string; expectDeck: boolean; ctaText: string; lang?: string | null; brand: string
  ask: Ask; lockSlide: (s: DeckSlide) => DeckSlide; lockCaption: (c: string) => string
}): Promise<GuardResult> {
  const { topic, tcfg, ask, brand } = a
  const mode = topic.mode, tips = topic.tips, rt = tcfg.regulated_terms
  const notes: string[] = []
  let slides = a.slides.map(s => ({ ...s })), caption = a.caption

  const issuesOf = (texts: string[]): string[] => mode === 'regulado' ? validateRegulated(texts, tips, rt) : mode === 'geral' ? validateGeneral(texts, rt) : validateLight(texts, rt)
  const sIssues = (s: DeckSlide) => issuesOf([slideText(s)])
  const cIssues = (c: string) => (c ? issuesOf([c]) : [])
  const needsSource = (s: DeckSlide) => mode === 'regulado' && topic.hosts.length > 0 && s.layout === 'fecho' && !/fonte|source/.test(norm(s.text))
  const unitOk = (_i: number, s: DeckSlide) => mode === 'leve' || (!sIssues(s).length && !needsSource(s))

  // Texto de reserva (mode != leve): sempre código.
  const fb = (mode === 'regulado' ? withSource(tipFallbackDeck(tips, topic.label, topic.hosts, a.ctaText, a.lang), topic.hosts, a.lang) : generalFallbackDeck(topic.label, a.ctaText, a.lang)).map(s => a.lockSlide(s))
  const fbMiddle = fb.slice(1, -1)
  const fallbackSlide = (i: number, s: DeckSlide): DeckSlide => {
    if (s.layout === 'capa') return fb[0]
    if (s.layout === 'fecho') return fb[fb.length - 1]
    const k = slides.slice(0, i).filter(x => x.layout !== 'capa' && x.layout !== 'fecho').length
    return fbMiddle[k % fbMiddle.length]
  }
  const fbCaption = () => a.lockCaption(mode === 'regulado' ? tipFallbackCaption(tips, topic.hosts, a.lang) : generalFallbackCaption(topic.label, a.lang))

  if (mode !== 'leve' && a.expectDeck && !slides.length) { slides = fb.map(s => ({ ...s })); notes.push('A IA não devolveu slides aproveitáveis; o carrossel usa o texto das dicas.') }

  const reasonFor = (issues: string[]): string[] => mode === 'regulado'
    ? [`use SÓ o que estas dicas conferidas dizem, sem acrescentar fato, número, lei ou programa: ${tips.map(t => `"${t.title} → ${t.content.slice(0, 500)}"`).join(' | ')} (a versão atual traz algo fora delas: ${issues.join(', ')})`]
    : mode === 'geral'
      ? [`escreva dica GERAL: sem número, prazo, taxa, valor, percentual nem nome de lei, imposto ou programa (a versão atual traz: ${issues.join(', ')})`]
      : [`não cite estes termos de tema regulado: ${issues.join(', ')} — escreva de forma geral, sem eles`]

  const rewriteSlide = async (s: DeckSlide, issues: string[]): Promise<DeckSlide | null> => {
    try {
      const raw = parseJson<Record<string, unknown>>(await ask(rewritePrompt(brand, s, { tooLong: false, numbers: [], extra: reasonFor(issues) }), 600), {})
      if (!Object.keys(raw).length) return null
      const next = normalizeSlide(raw, s.layout === 'capa' || s.layout === 'fecho' ? s.layout : null, s.cta)
      next.layout = s.layout
      return a.lockSlide(withSourceOne(next))
    } catch (e) { console.error('deckGuard: reescrita do slide falhou', e); return null }
  }
  const withSourceOne = (s: DeckSlide): DeckSlide => (mode === 'regulado' ? withSource([s], topic.hosts, a.lang)[0] : s)
  const rewriteCaption = async (issues: string[]): Promise<string | null> => {
    try {
      const raw = parseJson<{ caption?: unknown }>(await ask(`Você reescreve a legenda de um post de Instagram de "${brand}". Motivo: ${reasonFor(issues).join('; ')}. Mantenha o tom e o idioma, sem emoji novo, sem inventar nada, sem recado pro corretor${mode === 'regulado' && topic.hosts.length ? `, e termine com "Fonte: ${topic.hosts[0]}"` : ''}.
Legenda atual:
${caption}
Responda SÓ em JSON: {"caption":""}`, 900), {})
      const c = String(raw.caption ?? '').trim()
      return c ? a.lockCaption(c) : null
    } catch (e) { console.error('deckGuard: reescrita da legenda falhou', e); return null }
  }

  // 1) Código acha o problema → 1 reescrita (em paralelo) → ainda ruim: texto de reserva (leve: só avisa).
  const first = slides.map(sIssues), firstCap = cIssues(caption)
  await Promise.all([
    ...slides.map(async (s, i) => {
      if (!first[i].length) return
      const r = await rewriteSlide(s, first[i])
      if (r && !sIssues(r).length) { slides[i] = r; return }
      if (mode === 'leve') { notes.push(`O slide ${i + 1} cita ${first[i].join(', ')} (tema regulado) — confira antes de aprovar`); return }
      slides[i] = fallbackSlide(i, s); notes.push(`O slide ${i + 1} foi trocado pelo texto seguro porque a IA acrescentou fato fora das dicas (${first[i].slice(0, 3).join(', ')})`)
    }),
    (async () => {
      if (!firstCap.length) return
      const r = await rewriteCaption(firstCap)
      if (r && !cIssues(r).length) { caption = r; return }
      if (mode === 'leve') { notes.push(`A legenda cita ${firstCap.join(', ')} (tema regulado) — confira antes de aprovar`); return }
      caption = fbCaption(); notes.push(`A legenda foi trocada pelo texto seguro porque a IA acrescentou fato fora das dicas (${firstCap.slice(0, 3).join(', ')})`)
    })(),
  ])

  // 2) Só no regulado: um verificador barato procura AFIRMAÇÃO fora das dicas (o código só vê número, prazo, lei e termos).
  if (mode === 'regulado') {
    const verify = async (idx: (number | 'c')[]): Promise<Set<number | 'c'> | null> => {
      try {
        const body = idx.map(u => (u === 'c' ? `[legenda]\n${caption}` : `[slide ${u + 1}]\n${slideText(slides[u])}`)).join('\n\n')
        const raw = parseJson<{ unsupported?: { unit?: string; claim?: string }[] }>(await ask(`Você confere um carrossel de Instagram contra as DICAS CONFERIDAS abaixo, que são a única fonte de fatos permitida.
DICAS:
${tips.map((t, i) => `${i + 1}. ${t.title}\n${t.content}`).join('\n')}

TEXTOS:
${body}

Liste os trechos que AFIRMAM algo (regra, prazo, valor, lei, imposto, programa, exceção, obrigação, condição) que NÃO está dito nas dicas. Conselho geral, convite ("fale com a gente") e a própria pergunta da dica NÃO contam. Responda SÓ em JSON: {"unsupported":[{"unit":"slide 2" ou "legenda","claim":"o trecho"}]}`, 500, true), {})
        const bad = new Set<number | 'c'>()
        for (const x of Array.isArray(raw.unsupported) ? raw.unsupported : []) { const u = unitIdx(String(x?.unit ?? '')); if (u !== null && idx.includes(u)) bad.add(u) }
        return bad
      } catch (e) { console.error('deckGuard: verificador de afirmações falhou', e); return null }
    }
    const all: (number | 'c')[] = [...slides.map((_, i) => i), ...(caption ? ['c' as const] : [])]
    const bad1 = await verify(all)
    if (!bad1) notes.push('A conferência extra de afirmações não rodou — confira o texto contra as dicas antes de aprovar')
    else if (bad1.size) {
      const redo = [...bad1]
      await Promise.all(redo.map(async u => {
        if (u === 'c') { const r = await rewriteCaption(['afirmação que a dica não diz']); if (r && !cIssues(r).length) caption = r; else caption = fbCaption(); return }
        const r = await rewriteSlide(slides[u], ['afirmação que a dica não diz']); slides[u] = r && unitOk(u, r) ? r : fallbackSlide(u, slides[u])
      }))
      const bad2 = await verify(redo)
      for (const u of bad2 ?? []) {
        if (u === 'c') caption = fbCaption(); else slides[u] = fallbackSlide(u, slides[u])
      }
      notes.push(`O verificador achou afirmação fora das dicas em ${redo.map(u => (u === 'c' ? 'legenda' : `slide ${u + 1}`)).join(', ')}; o texto foi reescrito ou trocado pelo da dica`)
    }
    slides = withSource(slides, topic.hosts, a.lang).map(s => a.lockSlide(s))
  }
  return { slides, caption, notes, unitOk }
}

/** Linha do reasoning pra o dono saber de onde veio o carrossel. */
export function topicNote(t: TopicDecision): string {
  if (t.mode === 'regulado') return `Carrossel educativo de ${t.label}: usa só ${t.tips.length === 1 ? 'a dica conferida' : `as ${t.tips.length} dicas conferidas`} (Dicas e FAQ)${t.hosts.length ? `, fonte: ${t.hosts.join(', ')}` : ''}.`
  if (t.mode === 'geral') return `Carrossel educativo de dica geral${t.label ? ` (${t.label})` : ''}: não há dica liberada desse tema em Dicas e FAQ, então sai sem número, prazo, taxa nem nome de lei.`
  return ''
}
