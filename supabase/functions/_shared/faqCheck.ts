// Dicas e FAQ (Agente de Dados, etapa 2 — decisão do dono 2026-10-14:
// "sobre as dicas jurídicas, tem como a IA aprovar por a gente?").
//
// - Dica geral (sem número, prazo, taxa ou regra) → aprovada sozinha.
// - Dica com número/prazo/taxa/regra → a IA busca na web (Tavily) SÓ em
//   fonte oficial (lista de domínios na ficha) e confere. Confirmou ou
//   corrigiu → selo "Conferida pela IA em [data], fonte: [link]". Não achou
//   fonte oficial → "precisa revisar" e só o dono libera.
// - Reconfere a cada N dias (ficha, padrão 60): vencida não vai pra post.
// - O POST feito com a dica continua precisando da aprovação do dono (regra 1).
// Tudo que é de setor (categorias, temas, domínios oficiais) vive na ficha
// (`config.faq`, regra 6).
type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export interface FaqConfig {
  categories: { key: string; label: string }[]
  official_domains: string[]
  recheck_days: number
  topics: string
  // Carrossel educativo (decisão C): categorias que só usam dica liberada, termos que
  // classificam o tema e termos que carregam fato regulado. Tudo da ficha (regra 6);
  // ficha sem eles = tudo "leve" como antes.
  regulated_categories?: string[]
  category_terms?: Record<string, string[]>
  regulated_terms?: string[]
}
export type FaqStatus = 'geral' | 'conferida' | 'corrigida' | 'revisar' | 'aprovada_dono'
export interface FaqCheck {
  status: FaqStatus; has_facts: boolean; checked_at: string; next_check_at: string | null
  source_url?: string; source_title?: string; evidence?: string; note?: string; original_answer?: string
}
export interface FaqMeta { category?: string; origin?: 'ia' | 'dono'; check?: FaqCheck; used_count?: number }
export interface FaqRow { id: string; title: string; content: string; meta: FaqMeta | null }

const MODEL = 'claude-sonnet-4-6'

export async function fetchFaqConfig(admin: Admin, verticalKey: string | null): Promise<FaqConfig | null> {
  if (!verticalKey || verticalKey === 'generico') return null
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const raw = (data?.config as Record<string, unknown> | undefined)?.faq as Partial<FaqConfig> | undefined
    if (!raw || !Array.isArray(raw.official_domains) || !raw.official_domains.length) return null
    const domains = raw.official_domains.map(d => String(d).toLowerCase().trim()).filter(d => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))
    const categories = (Array.isArray(raw.categories) ? raw.categories : [])
      .filter(c => c && typeof c.key === 'string').map(c => ({ key: c.key, label: String(c.label ?? c.key) }))
    const list = (v: unknown, max = 80) => (Array.isArray(v) ? v : []).map(x => String(x ?? '').trim()).filter(x => x.length >= 2 && x.length <= 60).slice(0, max)
    const rawTerms = raw.category_terms && typeof raw.category_terms === 'object' ? raw.category_terms as Record<string, unknown> : {}
    const category_terms: Record<string, string[]> = {}
    for (const c of categories) { const t = list(rawTerms[c.key]); if (t.length) category_terms[c.key] = t }
    return {
      categories, official_domains: domains,
      recheck_days: Math.min(365, Math.max(7, Number(raw.recheck_days) || 60)),
      topics: String(raw.topics ?? '').slice(0, 1000),
      regulated_categories: list(raw.regulated_categories, 20).filter(k => categories.some(c => c.key === k)),
      category_terms, regulated_terms: list(raw.regulated_terms, 200),
    }
  } catch { return null }
}

export function isOfficial(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return domains.some(d => host === d || host.endsWith('.' + d))
  } catch { return false }
}

// Pode ir pra post? Geral e aprovada pelo dono sempre; conferida/corrigida
// só dentro do prazo de reconferência.
export function isPublishable(meta: FaqMeta | null | undefined, now = Date.now()): boolean {
  const c = meta?.check
  if (!c) return false
  if (c.status === 'geral' || c.status === 'aprovada_dono') return true
  if (c.status === 'conferida' || c.status === 'corrigida') return !c.next_check_at || Date.parse(c.next_check_at) > now
  return false
}
export function isDue(meta: FaqMeta | null | undefined, now = Date.now()): boolean {
  const c = meta?.check
  return !!c && (c.status === 'conferida' || c.status === 'corrigida') && !!c.next_check_at && Date.parse(c.next_check_at) <= now
}

export const CHEAP_MODEL = 'claude-haiku-4-5-20251001'
export async function callClaude(anthropicKey: string, prompt: string, maxTokens = 1200, model = MODEL): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}
export function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T } catch { /* */ }
  const m = raw.match(/[[{][\s\S]*[\]}]/)
  if (m) { try { return JSON.parse(m[0]) as T } catch { /* */ } }
  return fallback
}

interface Hit { title: string; url: string; content: string }
async function searchOfficial(tavilyKey: string, query: string, domains: string[]): Promise<Hit[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: tavilyKey, query, search_depth: 'advanced', max_results: 5, include_answer: false, include_domains: domains }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`Tavily ${res.status}`)
  const data = await res.json() as { results?: Record<string, unknown>[] }
  // Confere de novo o domínio: só fonte oficial conta, mesmo se a busca devolver outra.
  return (data.results ?? []).map(r => ({ title: String(r.title ?? '').slice(0, 200), url: String(r.url ?? ''), content: String(r.content ?? '').slice(0, 1500) }))
    .filter(h => isOfficial(h.url, domains))
}

// Chave da Tavily: secret do ambiente ou, se não tiver, o _app_config (mesmo
// fallback do insights-collect — em produção ela mora só no _app_config).
export async function getTavilyKey(admin: Admin): Promise<string | undefined> {
  const env = Deno.env.get('TAVILY_API_KEY')
  if (env) return env
  try {
    const { data } = await admin.from('_app_config').select('value').eq('key', 'tavily_api_key').maybeSingle()
    return data?.value ? String(data.value) : undefined
  } catch { return undefined }
}

const addDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString()

// Confere uma dica. Nunca lança: falha vira "revisar" com o motivo.
export async function checkTip(opts: { anthropicKey: string; tavilyKey: string | undefined; cfg: FaqConfig; city: string; question: string; answer: string }): Promise<{ check: FaqCheck; answer: string }> {
  const now = new Date().toISOString()
  const { cfg, question, answer } = opts
  let triage: { has_facts?: boolean; query?: string }
  try {
    triage = parseJson(await callClaude(opts.anthropicKey, `Uma dica de imóveis vai pro Instagram de um corretor em ${opts.city || 'Rio de Janeiro'}.
Pergunta: ${question}
Resposta: ${answer}

Ela afirma algum NÚMERO, PRAZO, TAXA, PERCENTUAL, VALOR, NOME DE LEI/IMPOSTO/PROGRAMA ou REGRA que pode estar certa ou errada (ex.: "ITBI no Rio é 3%", "FGTS pode ser usado se…", "a escritura é obrigatória acima de…")? Se for só conselho geral ("visite o imóvel em horários diferentes"), has_facts=false.
Se has_facts=true, escreva a melhor busca (em português) pra achar isso num site oficial do governo.
Responda SÓ JSON: {"has_facts": true|false, "query": "..."}`, 300), {})
  } catch (e) {
    return { answer, check: { status: 'revisar', has_facts: true, checked_at: now, next_check_at: null, note: `Não consegui analisar agora (${e instanceof Error ? e.message : e}). Tente "Conferir de novo".` } }
  }
  if (triage.has_facts === false) return { answer, check: { status: 'geral', has_facts: false, checked_at: now, next_check_at: null, note: 'Dica geral, sem número nem regra — aprovada sozinha.' } }

  if (!opts.tavilyKey) return { answer, check: { status: 'revisar', has_facts: true, checked_at: now, next_check_at: null, note: 'Busca na web indisponível agora — precisa da sua revisão.' } }
  let hits: Hit[] = []
  try { hits = await searchOfficial(opts.tavilyKey, String(triage.query || question).slice(0, 300), cfg.official_domains) } catch (e) {
    return { answer, check: { status: 'revisar', has_facts: true, checked_at: now, next_check_at: null, note: `A busca falhou (${e instanceof Error ? e.message : e}). Tente "Conferir de novo".` } }
  }
  if (!hits.length) return { answer, check: { status: 'revisar', has_facts: true, checked_at: now, next_check_at: null, note: 'Não achei fonte oficial que confirme. Revise e aprove só se tiver certeza.' } }

  let v: { verdict?: string; source_index?: number; corrected_answer?: string; evidence?: string; note?: string }
  try {
    v = parseJson(await callClaude(opts.anthropicKey, `Você confere uma dica de imóveis contra FONTES OFICIAIS. Seja rigoroso: só confirme o que o texto da fonte diz de verdade.
Pergunta: ${question}
Resposta da dica: ${answer}

Fontes oficiais encontradas:
${hits.map((h, i) => `[${i}] ${h.title} (${h.url})\n${h.content}`).join('\n\n')}

Decida:
- "confirmada": uma fonte confirma TODOS os números/regras da resposta.
- "corrigida": uma fonte mostra que algo está errado ou desatualizado E traz o dado certo — reescreva a resposta inteira com o dado certo, mesmo tom, mesmo tamanho, sem acrescentar nada que a fonte não diga.
- "sem_fonte": as fontes não falam disso com clareza.
"evidence" = trecho curto (até 200 caracteres) copiado da fonte que sustenta o veredito.
Responda SÓ JSON: {"verdict": "confirmada"|"corrigida"|"sem_fonte", "source_index": número, "corrected_answer": "...", "evidence": "...", "note": "1 frase pro dono"}`, 900), {})
  } catch (e) {
    return { answer, check: { status: 'revisar', has_facts: true, checked_at: now, next_check_at: null, note: `Não consegui conferir agora (${e instanceof Error ? e.message : e}).` } }
  }
  const hit = typeof v.source_index === 'number' ? hits[v.source_index] : undefined
  const evidence = String(v.evidence ?? '').slice(0, 300)
  // Veredito sem fonte válida ou sem trecho que exista na fonte → não confia.
  const evidenceOk = !!hit && evidence.length >= 10 && hit.content.replace(/\s+/g, ' ').includes(evidence.replace(/\s+/g, ' ').slice(0, 60))
  if (!hit || !evidenceOk || (v.verdict !== 'confirmada' && v.verdict !== 'corrigida')) {
    return { answer, check: { status: 'revisar', has_facts: true, checked_at: now, next_check_at: null, note: String(v.note ?? 'As fontes oficiais não confirmam com clareza. Revise antes de usar.').slice(0, 300), ...(hit ? { source_url: hit.url, source_title: hit.title } : {}) } }
  }
  const base = { has_facts: true, checked_at: now, next_check_at: addDays(cfg.recheck_days), source_url: hit.url, source_title: hit.title, evidence, note: String(v.note ?? '').slice(0, 300) }
  if (v.verdict === 'corrigida') {
    const fixed = String(v.corrected_answer ?? '').trim().slice(0, 1200)
    if (fixed.length < 10) return { answer, check: { ...base, status: 'revisar', next_check_at: null, note: 'A fonte oficial indica um erro, mas não consegui reescrever. Revise.' } }
    return { answer: fixed, check: { ...base, status: 'corrigida', original_answer: answer } }
  }
  return { answer, check: { ...base, status: 'conferida' } }
}

// Confere e grava (relê a meta antes pra não apagar uso/categoria).
export async function checkAndSave(admin: Admin, row: FaqRow, opts: { anthropicKey: string; tavilyKey: string | undefined; cfg: FaqConfig; city: string; companyId: string }): Promise<FaqRow> {
  const { check, answer } = await checkTip({ ...opts, question: row.title, answer: row.content })
  const { data: latest } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', row.id).maybeSingle()
  const meta: FaqMeta = { ...((latest?.meta ?? row.meta ?? {}) as FaqMeta), check }
  await admin.from('marketing_ai_knowledge').update({ content: answer, meta }).eq('id', row.id).eq('company_id', opts.companyId)
  return { ...row, content: answer, meta }
}

// Números que aparecem num texto — pra garantir que o card/carrossel não inventa número que a dica
// conferida não tem. Compara VALOR + UNIDADE, não dígitos soltos: "R$ 1500" = "R$ 1.500,00"; "3,0%" = "3%";
// mas "30%" ≠ "3%" ≠ "30 dias" e "R$ 150.000" ≠ "R$ 1.500". Unidades: % (inclui "por cento"), R$ (inclui "reais"),
// dia, mês, ano, semana, m². "150 mil" = 150000. Sem unidade = só o valor (não casa com número que tem unidade).
/** Valor numérico no formato BR: "1.500,00" → "1500", "3,0" → "3", "1.500" → "1500", "2.5" → "2.5". */
export function brNumber(raw: string): string {
  let t = raw
  const dots = (t.match(/\./g) ?? []).length, commas = (t.match(/,/g) ?? []).length
  if (dots && commas) { const dec = Math.max(t.lastIndexOf('.'), t.lastIndexOf(',')); t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1) }
  else if (commas) t = commas === 1 ? t.replace(',', '.') : t.replace(/,/g, '')
  else if (dots) t = t.split('.').slice(1).every(g => g.length === 3) ? t.replace(/\./g, '') : dots === 1 ? t : t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? String(n) : t
}
const normTxt = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const UNIT_AFTER: [RegExp, string][] = [
  [/^\s*(?:%|por\s?cento(?![a-z]))/, '%'], [/^\s*reais?(?![a-z])/, 'R$'], [/^\s*dias?(?![a-z])/, 'dia'], [/^\s*(?:mes|meses)(?![a-z])/, 'mes'],
  [/^\s*anos?(?![a-z])/, 'ano'], [/^\s*semanas?(?![a-z])/, 'semana'], [/^\s*(?:m\u00b2|m2|metros?\s+quadrados?)(?![a-z0-9])/, 'm2'],
]
/** Cada número do texto como { raw: o que está escrito, key: "valor|unidade" }. */
export function numberFacts(s: string): { raw: string; key: string }[] {
  const n = normTxt(s), out: { raw: string; key: string }[] = []
  for (const m of n.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const end = m.index! + m[0].length
    let value = Number(brNumber(m[0])), rest = n.slice(end)
    const mult = /^\s*(milhao|milhoes|mil)(?![a-z])/.exec(rest)
    if (mult) { value *= mult[1] === 'mil' ? 1000 : 1e6; rest = rest.slice(mult[0].length) }
    let unit = ''
    if (/r\$\s*$/.test(n.slice(0, m.index))) unit = 'R$'
    else for (const [re, u] of UNIT_AFTER) if (re.test(rest)) { unit = u; break }
    out.push({ raw: m[0], key: `${Number.isFinite(value) ? String(value) : m[0]}|${unit}` })
  }
  return out
}
export const numbersIn = (s: string): string[] => numberFacts(s).map(f => f.key)
