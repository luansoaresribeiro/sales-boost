import { supabase } from './supabase'
import { bi, type Bilingual } from './verticalPlaybook'

// Onboarding v2 (pedido do dono 2026-10-16): diagnóstico curto antes do
// cadastro + 5 etapas depois. As perguntas, etapas, perfis e textos vêm da
// ficha do setor (vertical_playbooks.config.onboarding_v2) — nunca código de
// setor (regra 6). Ficha sem `onboarding_v2` = fluxo antigo, sem mudança.
//
// Cada resposta tem um VALOR (companies.playbook_answers, só dado real) e,
// quando não há valor, um ESTADO (companies.answer_status):
//   unknown = "Não sei"   na = "Não se aplica"   later = "Preencher depois"
//   auto    = veio de integração (ex.: Instagram lido no diagnóstico) e o
//             dono ainda não confirmou — aí o valor existe E o estado também.
// Sem estado + com valor = preenchido pelo dono. Sem nada = pendente.

export type AnswerState = 'unknown' | 'na' | 'later' | 'auto'
export type AnswerStatus = Record<string, AnswerState>
export type V2QuestionType = 'select' | 'multi_select' | 'multi_text' | 'text'

export interface V2Option extends Bilingual {
  key?: string // só no "perfil": chave estável usada em `profiles`
  business_types?: string[] // só no "perfil": aparece pra esses tipos de negócio
  org?: boolean // só no "perfil": fala por uma empresa (pede o nome da empresa, não o pessoal)
}

export interface V2Question {
  key: string
  step: string
  type: V2QuestionType
  label: Bilingual
  why?: Bilingual
  placeholder?: Bilingual
  options?: V2Option[]
  max?: number
  profiles?: string[] // vazio/ausente = todos os perfis
  show_if?: { key: string; any: string[] }
  allow?: ('unknown' | 'na' | 'later')[] // estados aceitos; [] = obrigatória
  diagnostic?: boolean // também aparece no diagnóstico curto (antes do cadastro)
  needed_for?: string[] // funcionalidades que dependem da resposta (ex.: 'estrategia')
}

export interface V2Step { key: string; title: Bilingual; subtitle?: Bilingual }

export interface ReadinessCheck { key: string; label: string; short?: string; pattern: string; why?: string; use_answers?: string }
export interface DiagnosisReadiness {
  cta_example?: string // ex. de chamada do setor, usado na hipótese ("Comente VISITA")
  region_label?: string // como o setor chama a localização ("bairro ou região")
  cta_pattern?: string
  question_pattern?: string
  bio_checks?: ReadinessCheck[]
  region_terms?: string[]
}

export interface OnboardingV2 {
  steps: V2Step[]
  questions: V2Question[]
  priority_actions?: Record<string, string>
  audience_hypotheses?: { when: { key: string; any: string[] }; text: string }[]
  // Respostas antigas (onboarding_questions) calculadas das novas, pra não perguntar duas vezes.
  derive?: { to: string; from: string; rules: { all?: string[]; any?: string[]; value: string }[] }[]
  diagnosis_readiness?: DiagnosisReadiness
}

export const PROFILE_KEY = 'perfil'
export const SUMMARY_STEP = 'inteligencia' // etapa 5: resumo, sem perguntas
const MAX_TEXT_LEN = 200
const STATES: AnswerState[] = ['unknown', 'na', 'later', 'auto']

export async function fetchOnboardingV2(verticalKey: string): Promise<OnboardingV2 | null> {
  if (!verticalKey || verticalKey === 'generico') return null
  try {
    const { data } = await supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    return parseOnboardingV2((data?.config as { onboarding_v2?: unknown } | undefined)?.onboarding_v2)
  } catch { return null }
}

export function parseOnboardingV2(raw: unknown): OnboardingV2 | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<OnboardingV2>
  const steps = Array.isArray(r.steps) ? r.steps.filter(s => s && typeof s.key === 'string') : []
  const questions = Array.isArray(r.questions) ? r.questions.filter(q => q && typeof q.key === 'string' && typeof q.step === 'string') : []
  if (!steps.length || !questions.length) return null
  return { ...r, steps, questions } as OnboardingV2
}

/** "." / espaços / só pontuação não é resposta — o campo fica pendente, nunca vira dado. */
export function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.some(isMeaningful)
  return /[\p{L}\p{N}]/u.test(String(v))
}

export function allowedStates(q: V2Question): ('unknown' | 'na' | 'later')[] {
  return Array.isArray(q.allow) ? q.allow : ['unknown', 'later']
}

/** Chave do perfil escolhido (ex.: 'corretor_autonomo'), ou null. */
export function profileKeyOf(v2: OnboardingV2, answers: Record<string, unknown>): string | null {
  const pq = v2.questions.find(q => q.key === PROFILE_KEY)
  const val = String(answers[PROFILE_KEY] ?? '')
  return pq?.options?.find(o => o.pt === val)?.key ?? null
}

/** Opções da pergunta, filtradas pelo tipo de negócio (só o "perfil" usa isso). */
export function optionsFor(q: V2Question, businessType: string): V2Option[] {
  const opts = q.options ?? []
  if (q.key !== PROFILE_KEY || !businessType) return opts
  const fit = opts.filter(o => !o.business_types?.length || o.business_types.includes(businessType))
  return fit.length ? fit : opts
}

function matchesShowIf(q: V2Question, answers: Record<string, unknown>): boolean {
  if (!q.show_if) return true
  const v = answers[q.show_if.key]
  const vals = Array.isArray(v) ? v.map(String) : v != null && v !== '' ? [String(v)] : []
  // Ainda sem resposta na pergunta-mãe: mostra (melhor perguntar a mais que esconder).
  if (!vals.length) return true
  return vals.some(x => q.show_if!.any.includes(x))
}

/** Perguntas que se aplicam a este perfil/respostas (opcional: só de uma etapa). */
export function visibleQuestions(v2: OnboardingV2, answers: Record<string, unknown>, step?: string): V2Question[] {
  const profile = profileKeyOf(v2, answers)
  return v2.questions.filter(q => {
    if (step && q.step !== step) return false
    if (q.profiles?.length && profile && !q.profiles.includes(profile)) return false
    if (q.profiles?.length && !profile) return false // sem perfil, esconde o que é específico de perfil
    return matchesShowIf(q, answers)
  })
}

export type FieldState = 'filled' | 'auto' | 'unknown' | 'na' | 'later' | 'pending'

export function fieldState(q: V2Question, answers: Record<string, unknown>, status: AnswerStatus): FieldState {
  const has = isMeaningful(answers[q.key])
  const st = status[q.key]
  if (has) return st === 'auto' ? 'auto' : 'filled'
  if (st === 'unknown' || st === 'na' || st === 'later') return st
  return 'pending'
}

/** Passou pela pergunta (respondeu ou disse explicitamente que não sabe / não se aplica / depois). */
export function isResolved(q: V2Question, answers: Record<string, unknown>, status: AnswerStatus): boolean {
  const s = fieldState(q, answers, status)
  if (s === 'pending') return false
  if (s === 'later' || s === 'unknown' || s === 'na') return allowedStates(q).includes(s)
  return true
}

/** Ainda falta o dado de verdade (sem valor e não marcado "Não sei"/"Não se aplica"). Vai pro sino. */
export function isPendingData(q: V2Question, answers: Record<string, unknown>, status: AnswerStatus): boolean {
  const s = fieldState(q, answers, status)
  return s === 'pending' || s === 'later' || s === 'auto'
}

/** Limpa valores e estados contra a ficha antes de gravar (o que vai pro prompt da IA). */
export function sanitizeV2(v2: OnboardingV2, rawAnswers: Record<string, unknown>, rawStatus: AnswerStatus): { answers: Record<string, unknown>; status: AnswerStatus } {
  const byKey = new Map(v2.questions.map(q => [q.key, q]))
  const answers: Record<string, unknown> = {}
  const status: AnswerStatus = {}
  for (const [key, value] of Object.entries(rawAnswers ?? {})) {
    const q = byKey.get(key)
    if (!q) { answers[key] = value; continue } // chave de outra lista (ex.: perguntas antigas) — não é nossa, preserva
    const allowed = (q.options ?? []).map(o => o.pt)
    if (q.type === 'text') {
      const s = String(value ?? '').trim().slice(0, MAX_TEXT_LEN)
      if (isMeaningful(s)) answers[key] = s
    } else if (q.type === 'select') {
      const s = String(value ?? '').trim()
      if (s && allowed.includes(s)) answers[key] = s
    } else if (Array.isArray(value)) {
      const max = q.max ?? 10
      const items = value.map(v => String(v ?? '').trim().slice(0, MAX_TEXT_LEN))
        .filter(v => isMeaningful(v) && (q.type !== 'multi_select' || allowed.includes(v)))
      const uniq = [...new Set(items)].slice(0, max)
      if (uniq.length) answers[key] = uniq
    }
  }
  for (const [key, st] of Object.entries(rawStatus ?? {})) {
    const q = byKey.get(key)
    if (!q || !STATES.includes(st)) continue
    const has = isMeaningful(answers[key])
    if (st === 'auto') { if (has) status[key] = st; continue }
    if (!has && allowedStates(q).includes(st)) status[key] = st
  }
  for (const d of v2.derive ?? []) {
    const src = answers[d.from]
    const vals = Array.isArray(src) ? src.map(String) : src ? [String(src)] : []
    const rule = vals.length ? d.rules.find(r => (!r.all || r.all.every(x => vals.includes(x))) && (!r.any || r.any.some(x => vals.includes(x)))) : undefined
    if (rule) { answers[d.to] = rule.value; delete status[d.to] }
    else if (!vals.length && status[d.from] && status[d.from] !== 'auto') status[d.to] = status[d.from]
  }
  return { answers, status }
}

/** Texto legível de uma resposta (pra resumos). */
export function answerText(v: unknown): string {
  return Array.isArray(v) ? v.map(String).join(', ') : String(v ?? '')
}

export const STATE_LABEL: Record<'pt' | 'en', Record<FieldState, string>> = {
  pt: { filled: 'Preenchido', auto: 'Lido automaticamente — confirme', unknown: 'Não sei', na: 'Não se aplica', later: 'Preencher depois', pending: 'Pendente' },
  en: { filled: 'Filled', auto: 'Read automatically — please confirm', unknown: "I don't know", na: 'Not applicable', later: 'Fill in later', pending: 'Pending' },
}

export function qLabel(q: V2Question, lang: 'pt' | 'en'): string { return bi(q.label, lang) }

/** Link direto pro campo em Configurações (o card rola até ele e destaca). */
export function settingsLinkFor(key: string): string {
  return `/dashboard/settings?section=entendimento&q=${encodeURIComponent(key)}`
}

/** Prefill do 1º acesso: respostas e estados dados no diagnóstico curto (antes de existir conta). */
export async function loadDiagnosticAnswers(companyId: string): Promise<{ answers: Record<string, unknown>; status: AnswerStatus; instagram: Record<string, unknown> | null } | null> {
  try {
    const { data } = await supabase.from('diagnostics').select('onboarding_context, instagram_data, created_at')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!data) return null
    const oc = (data.onboarding_context ?? {}) as { playbook_answers?: Record<string, unknown>; answer_status?: AnswerStatus }
    const ig = (data.instagram_data ?? null) as Record<string, unknown> | null
    return { answers: oc.playbook_answers ?? {}, status: oc.answer_status ?? {}, instagram: ig && !ig.error ? ig : null }
  } catch { return null }
}

/** Sugestão de frequência a partir do Instagram lido (posts dos últimos 30 dias). Só sugere — o dono confirma. */
export function suggestedFrequency(q: V2Question | undefined, instagram: Record<string, unknown> | null): string | null {
  if (!q?.options?.length || !instagram) return null
  const posts = Array.isArray(instagram.posts) ? instagram.posts as { ts?: string | null }[] : []
  if (!posts.length) return null
  const since = Date.now() - 30 * 86400000
  const n = posts.filter(p => p.ts && new Date(p.ts).getTime() >= since).length
  // A amostra tem no máx. 12 posts: 12 em 30 dias pode ser mais — fica "3 a 5" no máximo, sem chutar "todo dia".
  const perWeek = n / 4.3
  const idx = perWeek >= 3 ? 1 : perWeek >= 1 ? 2 : n >= 1 ? 3 : 4
  return q.options[Math.min(idx, q.options.length - 1)]?.pt ?? null
}

// Campos "genéricos" da empresa que os agentes já leem (strategy-generate lê
// ideal_customer, primary_goals…): com v2, saem das respostas da ficha — só o
// que o dono disse, nada inventado. Chaves ausentes na ficha simplesmente não
// geram campo.
export function derivedCompanyFields(answers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  const txt = (k: string) => (isMeaningful(answers[k]) ? answerText(answers[k]) : '')
  const publico = [txt('cliente_tipico'), txt('publico')].filter(Boolean).join('; ')
  if (publico) out.ideal_customer = publico
  const prio = [txt('prioridade_principal'), txt('prioridades_secundarias')].filter(Boolean).join('; depois: ')
  if (prio) out.primary_goals = prio
  if (txt('prioridade_principal')) out.goal = txt('prioridade_principal')
  if (txt('canais_leads')) out.current_channels = txt('canais_leads')
  return out
}

/** Grava respostas + estados (mescla com o que já está no banco — nada respondido antes se perde). */
export async function saveV2Answers(companyId: string, v2: OnboardingV2, answers: Record<string, unknown>, status: AnswerStatus, touchedKeys?: string[]): Promise<boolean> {
  const { data: fresh } = await supabase.from('companies').select('playbook_answers, answer_status').eq('id', companyId).maybeSingle()
  const prevA = ((fresh?.playbook_answers as Record<string, unknown> | null) ?? {})
  const prevS = ((fresh as { answer_status?: AnswerStatus } | null)?.answer_status ?? {})
  const keys = touchedKeys ?? v2.questions.map(q => q.key)
  const mergedA = { ...prevA }
  const mergedS = { ...prevS }
  for (const k of keys) {
    if (k in answers) mergedA[k] = answers[k]; else delete mergedA[k]
    if (status[k]) mergedS[k] = status[k]; else delete mergedS[k]
  }
  const clean = sanitizeV2(v2, mergedA, mergedS)
  const { error } = await supabase.from('companies').update({
    playbook_answers: clean.answers, answer_status: clean.status, ...derivedCompanyFields(clean.answers), updated_at: new Date().toISOString(),
  }).eq('id', companyId)
  return !error
}

/**
 * 1º acesso ao painel: traz pra empresa o que a pessoa respondeu no diagnóstico
 * (antes de ter conta), sem sobrescrever nada que já esteja salvo. A frequência de
 * posts vem do Instagram lido, marcada "lido automaticamente — confirme".
 * Antes isso acontecia no /setup; a página saiu em 2026-10-19 (decisão do dono),
 * então roda no DashboardLayout. Já importado (tem perfil salvo) = não faz nada.
 */
export async function importDiagnosisAnswers(companyId: string, verticalKey: string): Promise<boolean> {
  try {
    const v2 = await fetchOnboardingV2(verticalKey)
    if (!v2) return false
    const { data: c } = await supabase.from('companies').select('playbook_answers, answer_status').eq('id', companyId).maybeSingle()
    const cur = ((c?.playbook_answers as Record<string, unknown> | null) ?? {})
    const curS = (((c as { answer_status?: AnswerStatus } | null)?.answer_status) ?? {})
    if (cur[PROFILE_KEY]) return false
    const diag = await loadDiagnosticAnswers(companyId)
    if (!diag) return false
    const answers: Record<string, unknown> = { ...diag.answers }
    const st: AnswerStatus = { ...diag.status }
    const freqQ = v2.questions.find(q => q.key === 'frequencia_posts')
    const freq = suggestedFrequency(freqQ, diag.instagram)
    if (freqQ && freq && !answers[freqQ.key]) { answers[freqQ.key] = freq; st[freqQ.key] = 'auto' }
    const keys = Object.keys({ ...answers, ...st }).filter(k => !(k in cur) && !(k in curS))
    if (!keys.length) return false
    return await saveV2Answers(companyId, v2, answers, st, keys)
  } catch { return false }
}
