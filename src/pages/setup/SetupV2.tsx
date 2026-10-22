import { useState } from 'react'
import QuestionField from '../../components/QuestionField'
import { useLang } from '../../contexts/LanguageContext'
import { bi } from '../../lib/verticalPlaybook'
import {
  answerText, fieldState, isResolved, saveV2Answers, SUMMARY_STEP, visibleQuestions,
  type AnswerState, type AnswerStatus, type OnboardingV2, type V2Question,
} from '../../lib/onboardingV2'

// As 5 etapas do onboarding v2 no /setup (e o mesmo resumo em Configurações).
// Perguntas e textos vêm da ficha; aqui só a mecânica (regra 6).

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'
const GREEN = '#4ade80'
const BORDER = 'rgba(255,255,255,0.08)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

const TX = {
  pt: {
    save: 'Salvar e continuar', saveDraft: 'Salvar o que já respondi', saving: 'Salvando...', err: 'Não consegui salvar. Tente de novo.',
    left: (n: number) => `Faltam ${n} — responda, ou marque "Não sei" / "Preencher depois".`,
    told: 'O que você nos contou', read: 'O que lemos automaticamente', readNote: 'Dado observado no seu Instagram público, no diagnóstico.',
    hyp: 'Hipóteses sobre o público (a confirmar)', hypNote: 'Não é fato: é um ponto de partida que o Sales Boost vai testar com os seus posts e conversas.',
    plan: 'Como o Sales Boost vai começar', gaps: 'O que ainda não sabemos', unknownTag: 'Você marcou "Não sei"', naTag: 'Não se aplica', laterTag: 'Pra preencher depois', pendingTag: 'Pendente', autoTag: 'Lido automaticamente — confirme',
    fill: 'Completar', usedIn: ' · usado na estratégia', noGaps: 'Nada pendente — o Hermes já tem o contexto completo.',
    followers: (n: number) => `${n.toLocaleString('pt-BR')} seguidores`, posts30: (n: number, of: number) => `${n} post(s) nos últimos 30 dias (dos ${of} mais recentes)`,
    videos: (n: number, of: number) => `${n} de ${of} posts recentes são vídeo/Reels`,
    stepsLeft: 'Termine as etapas acima pra ver o resumo completo.', nothingTold: 'Ainda nada respondido.',
  },
  en: {
    save: 'Save and continue', saveDraft: "Save what I've answered", saving: 'Saving...', err: "Couldn't save. Please try again.",
    left: (n: number) => `${n} left — answer, or mark "I don't know" / "Fill in later".`,
    told: 'What you told us', read: 'What we read automatically', readNote: 'Observed on your public Instagram during the diagnosis.',
    hyp: 'Audience hypotheses (to confirm)', hypNote: 'Not a fact: a starting point Sales Boost will test with your posts and conversations.',
    plan: 'How Sales Boost will start', gaps: "What we don't know yet", unknownTag: 'You marked "I don\'t know"', naTag: 'Not applicable', laterTag: 'To fill in later', pendingTag: 'Pending', autoTag: 'Read automatically — confirm',
    fill: 'Complete', usedIn: ' · used in the strategy', noGaps: 'Nothing pending — Hermes has the full context.',
    followers: (n: number) => `${n.toLocaleString('en-US')} followers`, posts30: (n: number, of: number) => `${n} post(s) in the last 30 days (of the ${of} most recent)`,
    videos: (n: number, of: number) => `${n} of ${of} recent posts are video/Reels`,
    stepsLeft: 'Finish the steps above to see the full summary.', nothingTold: 'Nothing answered yet.',
  },
} as const

export function stepOf(v2: OnboardingV2, key: string) { return v2.steps.find(s => s.key === key) }

export function EtapaForm({ companyId, v2, stepKey, initialAnswers, initialStatus, businessType, onSaved, focusKey }: {
  companyId: string; v2: OnboardingV2; stepKey: string
  initialAnswers: Record<string, unknown>; initialStatus: AnswerStatus; businessType: string
  onSaved: () => void; focusKey?: string | null
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const [answers, setAnswers] = useState(initialAnswers)
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const qs = visibleQuestions(v2, answers, stepKey)
  const left = qs.filter(q => !isResolved(q, answers, status)).length
  const step = stepOf(v2, stepKey)

  const setA = (k: string, v: unknown) => setAnswers(a => ({ ...a, [k]: v }))
  const setS = (k: string, st: AnswerState | null) => setStatus(m => { const n = { ...m }; if (st) n[k] = st; else delete n[k]; return n })

  const save = async () => {
    setSaving(true); setError('')
    // Grava as perguntas desta etapa (inclusive as que sumiram por condição — elas saem limpas).
    const keys = v2.questions.filter(q => q.step === stepKey).map(q => q.key)
    const ok = await saveV2Answers(companyId, v2, answers, status, keys)
    setSaving(false)
    if (!ok) return setError(t.err)
    onSaved()
  }

  return (
    <div>
      {step?.subtitle && <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.55, margin: '0 0 16px' }}>{bi(step.subtitle, lang)}</p>}
      {qs.map(q => (
        <QuestionField key={q.key} q={q} value={answers[q.key]} state={fieldState(q, answers, status)} highlight={focusKey === q.key}
          onChange={v => setA(q.key, v)} onState={s => setS(q.key, s)} lang={lang} businessType={businessType} />
      ))}
      {left > 0 && <div style={{ fontSize: '12.5px', color: MUTED, margin: '0 0 10px', lineHeight: 1.5 }}>{t.left(left)}</div>}
      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '10px' }}>{error}</div>}
      <button type="button" onClick={save} disabled={saving}
        style={{ width: '100%', minHeight: 44, background: left === 0 ? ORANGE : 'rgba(255,109,41,0.18)', color: left === 0 ? '#000' : 'white', fontWeight: 700, fontSize: '14px', border: left === 0 ? 'none' : '1px solid rgba(255,109,41,0.5)', borderRadius: '10px', cursor: saving ? 'wait' : 'pointer', fontFamily: D }}>
        {saving ? t.saving : left === 0 ? t.save : t.saveDraft}
      </button>
    </div>
  )
}

interface IgLite { followers?: number; posts?: { ts?: string | null; is_video?: boolean | null }[] }

// Etapa 5 — "Sua inteligência comercial". Separa: o que o dono contou, o que
// foi lido (observado), hipóteses (a confirmar) e lacunas. Nada inventado.
export function IntelligenceSummary({ v2, answers, status, instagram, onFill, complete }: {
  v2: OnboardingV2; answers: Record<string, unknown>; status: AnswerStatus
  instagram: IgLite | null; onFill: (q: V2Question) => void; complete: boolean
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const qs = visibleQuestions(v2, answers).filter(q => q.step !== SUMMARY_STEP)
  const byStep = v2.steps.filter(s => s.key !== SUMMARY_STEP).map(s => ({ s, items: qs.filter(q => q.step === s.key && ['filled', 'auto'].includes(fieldState(q, answers, status))) }))
  const gaps = qs.map(q => ({ q, st: fieldState(q, answers, status) })).filter(g => g.st !== 'filled')
  const hyps = (v2.audience_hypotheses ?? []).filter(h => {
    const v = answers[h.when.key]
    const vals = Array.isArray(v) ? v.map(String) : v ? [String(v)] : []
    return vals.some(x => h.when.any.includes(x))
  })
  const prios = [answers.prioridade_principal, ...(Array.isArray(answers.prioridades_secundarias) ? answers.prioridades_secundarias : [])]
    .map(x => String(x ?? '')).filter(Boolean)
  const actions = prios.map(p => ({ p, a: v2.priority_actions?.[p] })).filter(x => x.a)

  const posts = instagram?.posts ?? []
  const since = Date.now() - 30 * 86400000
  const p30 = posts.filter(p => p.ts && new Date(p.ts).getTime() >= since).length
  const vids = posts.filter(p => p.is_video === true).length

  const tag = (st: string) => st === 'unknown' ? t.unknownTag : st === 'na' ? t.naTag : st === 'later' ? t.laterTag : st === 'auto' ? t.autoTag : t.pendingTag
  const h3: React.CSSProperties = { fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '18px 0 8px' }
  const li: React.CSSProperties = { fontSize: '13px', color: 'white', lineHeight: 1.55, margin: '0 0 6px' }

  return (
    <div>
      {!complete && <p style={{ fontSize: '12.5px', color: MUTED, margin: '0 0 6px' }}>{t.stepsLeft}</p>}

      <div style={h3}>{t.told}</div>
      {byStep.every(x => !x.items.length) && <p style={{ ...li, color: MUTED }}>{t.nothingTold}</p>}
      {byStep.filter(x => x.items.length).map(({ s, items }) => (
        <div key={s.key} style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: MUTED, fontWeight: 700, marginBottom: '4px' }}>{bi(s.title, lang)}</div>
          {items.map(q => <p key={q.key} style={li}><span style={{ color: MUTED }}>{bi(q.label, lang)}:</span> {answerText(answers[q.key])}{status[q.key] === 'auto' ? <span style={{ color: GREEN }}> · {t.autoTag}</span> : null}</p>)}
        </div>
      ))}

      {instagram && posts.length > 0 && (
        <>
          <div style={h3}>{t.read}</div>
          <p style={{ fontSize: '11.5px', color: MUTED, margin: '0 0 6px' }}>{t.readNote}</p>
          {typeof instagram.followers === 'number' && <p style={li}>• {t.followers(instagram.followers)}</p>}
          <p style={li}>• {t.posts30(p30, posts.length)}</p>
          <p style={li}>• {t.videos(vids, posts.length)}</p>
        </>
      )}

      {hyps.length > 0 && (
        <>
          <div style={h3}>{t.hyp}</div>
          <p style={{ fontSize: '11.5px', color: MUTED, margin: '0 0 6px' }}>{t.hypNote}</p>
          {hyps.map(h => <p key={h.text} style={li}>• {h.text}</p>)}
        </>
      )}

      {actions.length > 0 && (
        <>
          <div style={h3}>{t.plan}</div>
          {actions.map(x => <p key={x.p} style={li}><strong>{x.p}:</strong> {x.a}</p>)}
        </>
      )}

      <div style={h3}>{t.gaps}</div>
      {gaps.length === 0 && <p style={{ ...li, color: GREEN }}>{t.noGaps}</p>}
      {gaps.map(({ q, st }) => (
        <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: 'white', lineHeight: 1.4 }}>{bi(q.label, lang)}</div>
            <div style={{ fontSize: '11.5px', color: st === 'na' ? MUTED : ORANGE }}>{tag(st)}{q.needed_for?.length ? t.usedIn : ''}</div>
          </div>
          {st !== 'na' && (
            <button type="button" onClick={() => onFill(q)} style={{ flexShrink: 0, minHeight: 36, padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,109,41,0.5)', color: ORANGE, borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.fill}</button>
          )}
        </div>
      ))}
    </div>
  )
}
