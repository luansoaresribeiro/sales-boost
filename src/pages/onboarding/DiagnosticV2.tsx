import QuestionField from '../../components/QuestionField'
import {
  answerText, fieldState, isResolved, PROFILE_KEY, profileKeyOf, visibleQuestions,
  type AnswerState, type AnswerStatus, type OnboardingV2, type V2Question,
} from '../../lib/onboardingV2'

// Diagnóstico curto do onboarding v2 (antes do cadastro, ~2 minutos). Só as
// perguntas marcadas `diagnostic: true` na ficha; o resto fica em Configurações
// e o sino de pendências cobra (o /setup saiu — decisão do dono 2026-10-19).
//   passo 0: tipo de negócio + perfil + nome + cidade (o DiagnosticFlow monta)
//   passo 1: perguntas de diagnóstico da etapa "operacao"
//   passo 2: perguntas de diagnóstico das demais etapas (mercado, prioridade)
//   passo 3: Instagram e contato (o DiagnosticFlow monta)

// Etapa 1 = operação; etapa 2 = mercado + prioridade (essenciais do mercado entraram
// no diagnóstico quando o /setup saiu — decisão do dono 2026-10-19).
const FIRST_STEPS = ['operacao']

export function diagnosticQuestions(v2: OnboardingV2, answers: Record<string, unknown>, step: 1 | 2): V2Question[] {
  return visibleQuestions(v2, answers).filter(q =>
    q.diagnostic && q.key !== PROFILE_KEY && (step === 1 ? FIRST_STEPS.includes(q.step) : !FIRST_STEPS.includes(q.step)))
}

export function profileQuestion(v2: OnboardingV2): V2Question | undefined {
  return v2.questions.find(q => q.key === PROFILE_KEY)
}

export function stepResolved(v2: OnboardingV2, answers: Record<string, unknown>, status: AnswerStatus, step: 1 | 2): boolean {
  return diagnosticQuestions(v2, answers, step).every(q => isResolved(q, answers, status))
}

export function V2QuestionList({ questions, answers, status, onAnswer, onState, lang, businessType }: {
  questions: V2Question[]
  answers: Record<string, unknown>
  status: AnswerStatus
  onAnswer: (k: string, v: unknown) => void
  onState: (k: string, s: AnswerState | null) => void
  lang: 'pt' | 'en'
  businessType: string
}) {
  return (
    <>
      {questions.map(q => (
        <QuestionField key={q.key} q={q} value={answers[q.key]} state={fieldState(q, answers, status)}
          onChange={v => onAnswer(q.key, v)} onState={s => onState(q.key, s)} lang={lang} businessType={businessType} />
      ))}
    </>
  )
}

/** Perfil que fala por uma empresa (ficha: opção com org=true) pede o nome da empresa; os outros, o nome profissional. */
export function isCompanyProfile(v2: OnboardingV2, answers: Record<string, unknown>): boolean {
  const pq = profileQuestion(v2)
  const key = profileKeyOf(v2, answers)
  const opt = pq?.options?.find(o => o.key === key)
  return !!opt?.org
}

// Contexto salvo no diagnóstico (vira o da empresa no cadastro). Os agentes
// leem: só o que foi dito, e o que ficou "Não sei" aparece como tal.
export function buildContextV2(v2: OnboardingV2, answers: Record<string, unknown>, status: AnswerStatus, businessType: string, city: string) {
  const qs = visibleQuestions(v2, answers)
  const said = qs.filter(q => fieldState(q, answers, status) === 'filled')
  const unknown = qs.filter(q => ['unknown', 'na'].includes(fieldState(q, answers, status)))
  const lines = said.map(q => `${q.label.pt}: ${answerText(answers[q.key])}`)
  const perfil = String(answers[PROFILE_KEY] ?? '')
  const prioridade = String(answers.prioridade_principal ?? '')
  const description = [businessType, perfil && `(${perfil.toLowerCase()})`, city && `em ${city}`].filter(Boolean).join(' ')
  return {
    business_description: description,
    primary_goals: prioridade,
    current_channels: 'Instagram',
    onboarding_summary: [`Negócio: ${description}`, ...lines, ...(unknown.length ? [`Ainda não sabe: ${unknown.map(q => q.label.pt).join('; ')}`] : [])].join('\n'),
    agent_business_interpretation: `${description}.${prioridade ? ` Prioridade agora: ${prioridade.toLowerCase()}.` : ''}`,
    playbook_answers: answers,
    answer_status: status,
    onboarding_version: 2,
  }
}
