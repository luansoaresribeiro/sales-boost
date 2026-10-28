// Opportunity Engine — PASSO B (redação pela IA) + validação + prioridade, tudo em CÓDIGO.
// Função PURA (sem Deno/rede): roda no Deno e no teste em Node (scripts/test-opportunity-engine.mjs).
//
// A IA só recebe a lista fechada de fatos e os candidatos montados em opportunityEngine.ts e
// devolve texto. O que ela escreve é conferido aqui, nunca confiado:
//  - evidência fact/data só vale se o id estiver na lista de entrada (e o TEXTO/FONTE/DATA que vai
//    pro banco é o do fato guardado, nunca o que a IA digitou);
//  - número no texto que não esteja nos fatos → a frase inteira sai (regra 5);
//  - termo de classe protegida (Fair Housing / antidiscriminação) → a frase sai; no público, vira vazio;
//  - confiança e prioridade são calculadas aqui, a IA não opina.
import { numberFacts } from './faqCheck.ts'
import { norm, type Candidate, type Evidence, type Fact, type Lang, type OppKind } from './opportunityEngine.ts'

export const MAX_OPPORTUNITIES = 3
export const MAX_CANDIDATES_TO_LLM = 5
export type Confidence = 'high' | 'medium' | 'low' | 'needs_validation'

export interface OpportunityDraft {
  kind: OppKind
  title: string
  description: string
  commercial_problem: string
  evidence: Evidence[]
  item_ids: string[]
  audience: string | null
  suggested_action: string
  how_to_measure: string
  confidence: Confidence
  needs_validation: boolean
  priority_rank: number
  priority_reasons: string[]
}

const tr = (lang: Lang, pt: string, en: string) => (lang === 'en' ? en : pt)

// Classes protegidas (Fair Housing / antidiscriminação): raça, cor, religião, sexo/gênero, deficiência,
// situação familiar, origem nacional. Compara em texto normalizado (sem acento). Falso positivo só custa
// uma frase; falso negativo seria discriminação publicada com a nossa assinatura.
const PROTECTED = new RegExp(
  '(^|[^a-z])(' + [
    'raca\\w*', 'racial\\w*', 'racis\\w*', 'etnia\\w*', 'etnic\\w*', 'ethnic\\w*', 'race', 'races', 'color', 'cor da pele', 'negr[oa]s?', 'pessoas pretas', 'black people', 'white people',
    'religi\\w*', 'catolic\\w*', 'evangelic\\w*', 'judeu\\w*', 'jewish', 'muculman\\w*', 'muslim\\w*', 'christian\\w*', 'cristao\\w*', 'cristas', 'islam\\w*',
    'sexo', 'sexual\\w*', 'genero', 'gender', 'homens?', 'mulher(?:es)?', 'men', 'women', 'male', 'female', 'gay', 'gays', 'lgbt\\w*', 'homossex\\w*', 'transgener\\w*',
    'deficien\\w*', 'deficiente\\w*', 'disabled', 'disabilit\\w*', 'handicap\\w*', 'wheelchair', 'cadeirante\\w*', 'autis\\w*',
    'situacao familiar', 'estado civil', 'familial status', 'solteir\\w*', 'casad\\w*', 'divorciad\\w*', 'single (?:mothers?|fathers?|parents?)', 'maes solo', 'familias? com (?:filhos|criancas)', 'families with (?:children|kids)', 'sem filhos', 'gravid\\w*', 'pregnan\\w*',
    'nacionalidade\\w*', 'nationalit\\w*', 'national origin', 'origem', 'imigrant\\w*', 'immigrant\\w*', 'estrangeir\\w*', 'foreigner\\w*',
  ].join('|') + ')($|[^a-z])',
)
export const hasProtectedTerm = (s: string): boolean => PROTECTED.test(norm(s))

const digitsOnly = (raw: string) => raw.replace(/[.,]/g, '')
export interface AllowedNumbers { values: Set<string>; digits: Set<string> }
export function allowedNumbers(texts: string[]): AllowedNumbers {
  const values = new Set<string>(), digits = new Set<string>()
  for (const t of texts) for (const n of numberFacts(t)) { values.add(n.key.split('|')[0]); digits.add(digitsOnly(n.raw)) }
  return { values, digits }
}
export function numbersAllowed(s: string, allowed: AllowedNumbers): boolean {
  return numberFacts(s).every(n => allowed.values.has(n.key.split('|')[0]) || allowed.digits.has(digitsOnly(n.raw)))
}

// Tira da frase o que não passa (número inventado / classe protegida). Frase = até . ! ? ou quebra de linha.
export function cleanText(s: unknown, allowed: AllowedNumbers, max: number): string {
  if (typeof s !== 'string') return ''
  const parts = s.replace(/[ \t]+/g, ' ').trim().split(/(?<=[.!?])\s+|\n+/)
  return parts.filter(p => p.trim() && numbersAllowed(p, allowed) && !hasProtectedTerm(p)).join(' ').trim().slice(0, max)
}

export interface LlmOpportunity {
  candidate_id?: unknown; title?: unknown; description?: unknown; commercial_problem?: unknown; audience?: unknown
  suggested_action?: unknown; how_to_measure?: unknown; cited_fact_ids?: unknown; hypotheses?: unknown
}
export function parseLlm(raw: string): LlmOpportunity[] | null {
  const tryParse = (t: string): unknown => { try { return JSON.parse(t) } catch { return undefined } }
  const m = raw.match(/\{[\s\S]*\}/)
  const obj = (tryParse(raw) ?? (m ? tryParse(m[0]) : undefined)) as { opportunities?: unknown } | undefined
  return obj && Array.isArray(obj.opportunities) ? obj.opportunities as LlmOpportunity[] : null
}

export function buildPrompt(opts: { lang: Lang; businessName: string; itemLabel: string; facts: Fact[]; candidates: Candidate[]; windowDays: number }): string {
  const { lang, facts, candidates } = opts
  const factLines = facts.map(f => `${f.id} [${f.type === 'fact' ? 'FATO' : 'DADO'}] ${f.text} (fonte: ${f.source}${f.date ? `; data: ${f.date}` : ''})`).join('\n')
  const candLines = candidates.map(c => `${c.id} · tipo=${c.kind} · fatos=${c.fact_ids.join(',')}${c.forceHypothesis ? ' · A CAUSA É SÓ HIPÓTESE (use o tom "pode ser…", nunca afirme a causa)' : ''}${c.validationReasons.length ? ` · ATENÇÃO: ${c.validationReasons.join(' ')}` : ''}`).join('\n')
  return `Você ajuda a equipe comercial de "${opts.businessName}" a decidir o que fazer a seguir. Abaixo há uma LISTA FECHADA de fatos (com id) e CANDIDATOS a oportunidade montados por regras do sistema (já contados do banco). Sua tarefa é só REDIGIR, para até ${MAX_OPPORTUNITIES} candidatos que tenham base, a oportunidade em linguagem simples e direta.

FATOS (a única fonte de verdade; "${opts.itemLabel}" = o item do catálogo):
${factLines}

CANDIDATOS:
${candLines}

REGRAS INEGOCIÁVEIS:
1. Use APENAS os fatos acima. Não invente fato, número, data, preço, métrica, notícia, bairro, empresa ou nome. Não escreva NENHUM dígito que não esteja nos fatos (para contagens, use palavras). Não escreva datas.
2. O que não está nos fatos é HIPÓTESE: coloque em "hypotheses" (frases curtas começando por "Pode ser…"/"May be…"), nunca nos outros campos como se fosse certo.
3. Nada de promessa: nunca "+X% de vendas", "vai vender", "garantido", "dobra". Preço anunciado não é preço de venda; interesse de busca não é comprador.
4. Público ("audience"): NUNCA segmente por raça, cor, religião, sexo/gênero, deficiência, situação familiar (ter ou não filhos, estado civil), idade ou origem/nacionalidade (Fair Housing / antidiscriminação). Descreva o público por NECESSIDADE, momento de vida profissional/de compra, bairro ou faixa do imóvel (ex.: "quem busca perto do trabalho", "quem quer trocar por algo maior"). Se não houver base, deixe "audience" vazio.
5. Nada é publicado ou enviado daqui: "suggested_action" é uma sugestão que o dono vai aprovar ou descartar. Máximo de 2 frases.
6. "how_to_measure": diga o que olhar (comentários, mensagens, visitas pedidas), sem meta numérica.
7. Idioma de TODOS os textos: ${lang === 'en' ? 'English' : 'português do Brasil'}.

Responda APENAS com JSON, sem markdown:
{"opportunities":[{"candidate_id":"C1","title":"até 90 caracteres","description":"2-3 frases","commercial_problem":"1-2 frases: o que isso custa ao comercial","audience":"","suggested_action":"","how_to_measure":"","cited_fact_ids":["F1"],"hypotheses":["Pode ser…"]}]}
Se nenhum candidato tiver base suficiente, responda {"opportunities":[]}.`
}

const hypSource = (lang: Lang) => tr(lang, 'Hipótese do Sales Boost — ainda não verificada', 'Sales Boost hypothesis — not verified yet')

export interface Scored { c: Candidate; evCount: number; independent: number; needs: boolean; confidence: Confidence }

export function score(c: Candidate, facts: Fact[]): Scored {
  const fs = c.fact_ids.map(id => facts.find(f => f.id === id)).filter((f): f is Fact => !!f)
  const evCount = fs.length
  const independent = new Set(fs.map(f => f.origin)).size
  const needs = c.forceHypothesis || evCount < 2 || c.validationReasons.length > 0
  const confidence: Confidence = needs ? 'needs_validation' : evCount >= 4 && independent >= 3 ? 'high' : evCount >= 2 && independent >= 2 ? 'medium' : 'low'
  return { c, evCount, independent, needs, confidence }
}
// (1) evidências com fonte, (2) itens ligados, (3) fontes independentes; (4) "precisa validar" sempre por último.
export function compareScored(a: Scored, b: Scored): number {
  if (a.needs !== b.needs) return a.needs ? 1 : -1
  return b.evCount - a.evCount || b.c.item_ids.length - a.c.item_ids.length || b.independent - a.independent || a.c.id.localeCompare(b.c.id, 'en', { numeric: true })
}
export function priorityReasons(s: Scored, next: Scored | null, lang: Lang): string[] {
  const out = [
    tr(lang, `${s.evCount} ${s.evCount === 1 ? 'evidência com fonte' : 'evidências com fonte'}`, `${s.evCount} sourced ${s.evCount === 1 ? 'piece of evidence' : 'pieces of evidence'}`),
  ]
  const n = s.c.item_ids.length
  if (n > 0) out.push(tr(lang, `ligada a ${n} ${n === 1 ? 'item' : 'itens'} do catálogo`, `tied to ${n} catalog ${n === 1 ? 'item' : 'items'}`))
  out.push(tr(lang, `${s.independent} ${s.independent === 1 ? 'fonte independente' : 'fontes independentes'}`, `${s.independent} independent ${s.independent === 1 ? 'source' : 'sources'}`))
  if (s.needs) out.push(tr(lang, 'precisa de validação, por isso fica depois das que têm base confirmada', 'needs validation, so it ranks after the ones with a confirmed basis'))
  else if (next && !next.needs) {
    if (s.evCount > next.evCount) out.push(tr(lang, 'tem mais evidências com fonte que a próxima da lista', 'has more sourced evidence than the next one on the list'))
    else if (s.c.item_ids.length > next.c.item_ids.length) out.push(tr(lang, 'afeta mais itens do catálogo que a próxima da lista', 'affects more catalog items than the next one on the list'))
    else if (s.independent > next.independent) out.push(tr(lang, 'tem mais fontes independentes que a próxima da lista', 'has more independent sources than the next one on the list'))
  }
  return out
}

// Junta a redação da IA com os candidatos do código, valida e ordena. Devolve no máximo 3.
export function finalize(opts: { lang: Lang; candidates: Candidate[]; facts: Fact[]; llm: LlmOpportunity[] }): OpportunityDraft[] {
  const { lang, candidates, facts } = opts
  const allowed = allowedNumbers(facts.map(f => f.text))
  const byId = new Map(facts.map(f => [f.id, f]))
  const drafts: { s: Scored; d: Omit<OpportunityDraft, 'priority_rank' | 'priority_reasons'> }[] = []
  const seen = new Set<string>()
  for (const raw of opts.llm) {
    const cid = typeof raw.candidate_id === 'string' ? raw.candidate_id : ''
    const c = candidates.find(x => x.id === cid)
    if (!c || seen.has(cid)) continue
    seen.add(cid)
    // Evidência fact/data: os do candidato (código) + os ids extras que a IA citou SE existirem na entrada.
    const cited = Array.isArray(raw.cited_fact_ids) ? raw.cited_fact_ids.filter((x): x is string => typeof x === 'string' && byId.has(x)) : []
    const factIds = [...new Set([...c.fact_ids, ...cited])].slice(0, 8)
    // A prioridade/confiança contam só as evidências do PRÓPRIO candidato (código): citar mais fatos não sobe a nota.
    const sc = score(c, facts)
    const evidence: Evidence[] = factIds.map(id => byId.get(id)!).map(f => ({ type: f.type, text: f.text, source: f.source, date: f.date }))
    const hyps = [...c.hypotheses, ...(Array.isArray(raw.hypotheses) ? raw.hypotheses : []).map(h => cleanText(h, allowed, 220))]
    for (const h of hyps) if (h && !evidence.some(e => e.type === 'hypothesis' && e.text === h) && evidence.filter(e => e.type === 'hypothesis').length < 4) evidence.push({ type: 'hypothesis', text: h, source: hypSource(lang), date: null })
    const audience = cleanText(raw.audience, allowed, 200)
    drafts.push({
      s: sc,
      d: {
        kind: c.kind,
        title: cleanText(raw.title, allowed, 120) || c.fallback.title,
        description: cleanText(raw.description, allowed, 600),
        commercial_problem: cleanText(raw.commercial_problem, allowed, 400) || c.fallback.problem,
        evidence,
        item_ids: c.item_ids,
        audience: audience || null,
        suggested_action: cleanText(raw.suggested_action, allowed, 400) || c.fallback.action,
        how_to_measure: cleanText(raw.how_to_measure, allowed, 300) || c.fallback.measure,
        confidence: sc.confidence,
        needs_validation: sc.needs,
      },
    })
  }
  drafts.sort((a, b) => compareScored(a.s, b.s))
  return drafts.slice(0, MAX_OPPORTUNITIES).map((x, i, arr) => ({ ...x.d, priority_rank: i + 1, priority_reasons: priorityReasons(x.s, arr[i + 1]?.s ?? null, lang) }))
}
