import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { markProfileSaved } from '../../../lib/profileConfirm'
import { useLang } from '../../../contexts/LanguageContext'
import { fetchOnboardingQuestions, sanitizePlaybookAnswers, bi, type PlaybookQuestion } from '../../../lib/verticalPlaybook'
import { useSearchParams } from 'react-router-dom'
import QuestionField from '../../../components/QuestionField'
import { IntelligenceSummary } from '../../setup/SetupV2'
import {
  fetchOnboardingV2, fieldState, loadDiagnosticAnswers, saveV2Answers, SUMMARY_STEP, visibleQuestions,
  type AnswerState, type AnswerStatus, type OnboardingV2,
} from '../../../lib/onboardingV2'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

// Entendimento do negócio — o que o onboarding conversacional captou. É o
// Business Context que alimenta os agentes. Card auto-contido: carrega e salva
// seus próprios campos, sem depender do save do resto da página.
interface Understanding {
  business_description: string
  ideal_customer: string
  business_stage: string
  primary_goals: string
  main_challenges: string
  current_channels: string
  agent_business_interpretation: string
}
const EMPTY: Understanding = {
  business_description: '', ideal_customer: '', business_stage: '', primary_goals: '',
  main_challenges: '', current_channels: '', agent_business_interpretation: '',
}

const FIELDS: { key: keyof Understanding; area?: boolean }[] = [
  { key: 'business_description', area: true },
  { key: 'ideal_customer', area: true },
  { key: 'business_stage' },
  { key: 'primary_goals' },
  { key: 'main_challenges' },
  { key: 'current_channels' },
]

const TX = {
  pt: {
    labels: { business_description: 'O que seu negócio faz', ideal_customer: 'Cliente ideal', business_stage: 'Fase do negócio', primary_goals: 'Objetivo principal', main_challenges: 'Maior desafio', current_channels: 'Canais atuais' } as Record<string, string>,
    title: '🧠 Entendimento do negócio',
    introA: 'O que captamos no seu cadastro. Isso é o ', introB: 'contexto que os agentes usam', introC: ' pra decidir e recomendar. Pode ajustar quando quiser.',
    select: 'Selecione...', sectorQs: 'Perguntas específicas do seu setor',
    ficha: (n: string) => `Ficha: ${n}. Tudo aqui é opcional.`, aiSummary: 'Como a IA resume seu negócio',
    saved: '✓ Salvo', saving: 'Salvando...', save: 'Salvar entendimento',
    v2intro: 'Tudo que o Sales Boost sabe da sua operação — é o contexto que o Hermes usa pra montar a estratégia. Complete ou corrija quando quiser; não precisa refazer o cadastro.',
    v2summary: 'Resumo e pendências',
  },
  en: {
    labels: { business_description: 'What your business does', ideal_customer: 'Ideal customer', business_stage: 'Business stage', primary_goals: 'Main goal', main_challenges: 'Biggest challenge', current_channels: 'Current channels' } as Record<string, string>,
    title: '🧠 Business understanding',
    introA: 'What we captured at signup. This is the ', introB: 'context the agents use', introC: ' to decide and recommend. You can adjust it anytime.',
    select: 'Select...', sectorQs: 'Questions specific to your industry',
    ficha: (n: string) => `Profile: ${n}. Everything here is optional.`, aiSummary: 'How the AI summarizes your business',
    saved: '✓ Saved', saving: 'Saving...', save: 'Save understanding',
    v2intro: "Everything Sales Boost knows about your operation — the context Hermes uses to build your strategy. Complete or fix it anytime; no need to redo signup.",
    v2summary: 'Summary and pending items',
  },
} as const

// Campo "digite e vira pílula" — versão compacta do mesmo componente do
// onboarding (src/pages/onboarding/OnboardingPage.tsx), pro estilo deste card.
export function SettingsTagInput({ values, onChange, max }: { values: string[]; onChange: (v: string[]) => void; max: number }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v || values.includes(v) || values.length >= max) return
    onChange([...values, v]); setDraft('')
  }
  return (
    <div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {values.map(v => (
            <span key={v} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', color: ORANGE }}>
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} style={{ background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', padding: 0, fontSize: '12px', lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      {values.length < max && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            style={{ flex: 1, boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit' }} />
          <button type="button" onClick={add} style={{ padding: '0 14px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', borderRadius: '10px', color: ORANGE, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
        </div>
      )}
    </div>
  )
}

export default function BusinessUnderstandingCard({ companyId }: { companyId: string }) {
  const { lang } = useLang()
  const X = TX[lang]
  const [u, setU] = useState<Understanding>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [verticalKey, setVerticalKey] = useState('generico')
  const [fichaName, setFichaName] = useState('')
  const [fichaQuestions, setFichaQuestions] = useState<PlaybookQuestion[]>([])
  const [playbookAnswers, setPlaybookAnswers] = useState<Record<string, unknown>>({})
  // Onboarding v2 (ficha com config.onboarding_v2): perguntas por etapa + estados ("Não sei" etc.).
  const [v2, setV2] = useState<OnboardingV2 | null>(null)
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>({})
  const [businessType, setBusinessType] = useState('')
  const [instagram, setInstagram] = useState<Record<string, unknown> | null>(null)
  const [searchParams] = useSearchParams()
  const focusKey = searchParams.get('q')

  const loadFicha = async (vk: string) => {
    const { name, questions } = await fetchOnboardingQuestions(vk)
    setFichaName(name); setFichaQuestions(questions)
  }

  useEffect(() => {
    let alive = true
    supabase.from('companies')
      .select('business_description, ideal_customer, business_stage, primary_goals, main_challenges, current_channels, agent_business_interpretation, vertical_key, playbook_answers, business_type')
      .eq('id', companyId).maybeSingle()
      .then(async ({ data }) => {
        if (!alive || !data) { setLoading(false); return }
        const { vertical_key, playbook_answers, business_type, ...understanding } = data as Record<string, unknown>
        setBusinessType((business_type as string | null) ?? '')
        const cfg = await fetchOnboardingV2((vertical_key as string | null) ?? 'generico')
        if (cfg && alive) {
          setV2(cfg)
          const { data: st } = await supabase.from('companies').select('answer_status').eq('id', companyId).maybeSingle()
          setAnswerStatus(((st as { answer_status?: AnswerStatus } | null)?.answer_status) ?? {})
          void loadDiagnosticAnswers(companyId).then(d => { if (alive && d) setInstagram(d.instagram) })
        }
        setU({ ...EMPTY, ...Object.fromEntries(Object.entries(understanding).map(([k, v]) => [k, v ?? ''])) } as Understanding)
        const vk = (vertical_key as string | null) ?? 'generico'
        setVerticalKey(vk)
        setPlaybookAnswers((playbook_answers as Record<string, unknown> | null) ?? {})
        await loadFicha(vk)
        setLoading(false)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const set = (k: keyof Understanding) => (v: string) => { setU(p => ({ ...p, [k]: v })); setSaved(false) }
  const setAnswer = (k: string, v: unknown) => { setPlaybookAnswers(p => ({ ...p, [k]: v })); setSaved(false) }

  // Se o dono trocou o tipo de negócio noutra parte de Configurações desde
  // que este card carregou, recarrega a ficha certa na hora de salvar —
  // evita mostrar/gravar perguntas do setor antigo.
  const setV2State = (k: string, st: AnswerState | null) => { setAnswerStatus(m => { const n = { ...m }; if (st) n[k] = st; else delete n[k]; return n }); setSaved(false) }

  // Veio de um aviso ("falta a faixa de preço") com ?q=<campo>: rola até ele.
  useEffect(() => {
    if (!focusKey || loading) return
    const timer = setTimeout(() => document.getElementById(`q-${focusKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 600)
    return () => clearTimeout(timer)
  }, [focusKey, loading])

  const saveV2 = async () => {
    if (!v2) return
    setSaving(true)
    const ok = await saveV2Answers(companyId, v2, playbookAnswers, answerStatus)
    if (ok) void markProfileSaved(companyId)
    setSaving(false); setSaved(ok); if (ok) setTimeout(() => setSaved(false), 2500)
  }

  const save = async () => {
    setSaving(true)
    const { data: fresh } = await supabase.from('companies').select('vertical_key').eq('id', companyId).maybeSingle()
    const currentVk = (fresh?.vertical_key as string | null) ?? 'generico'
    if (currentVk !== verticalKey) { setVerticalKey(currentVk); await loadFicha(currentVk) }
    const { questions } = await fetchOnboardingQuestions(currentVk)
    const sanitized = sanitizePlaybookAnswers(playbookAnswers, questions)
    // Recompõe a interpretação pros agentes a partir do que o dono editou.
    const interpretation = `Negócio "${u.business_description || '—'}". Cliente ideal: ${u.ideal_customer || '—'}. Objetivo: ${u.primary_goals || '—'}. Desafio: ${u.main_challenges || '—'}. Canais: ${u.current_channels || '—'}. Fase: ${u.business_stage || '—'}.`
    await supabase.from('companies').update({ ...u, playbook_answers: sanitized, agent_business_interpretation: interpretation, updated_at: new Date().toISOString() }).eq('id', companyId)
    void markProfileSaved(companyId)
    setPlaybookAnswers(sanitized)
    setU(p => ({ ...p, agent_business_interpretation: interpretation }))
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return null

  if (v2) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px 24px', marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{X.title}</div>
        <p style={{ fontSize: '12px', color: MUTED, marginBottom: '14px', lineHeight: 1.6 }}>{X.v2intro}</p>
        <details style={{ marginBottom: '16px', background: 'rgba(255,109,41,0.04)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '10px', padding: '10px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: ORANGE }}>{X.v2summary}</summary>
          <IntelligenceSummary v2={v2} answers={playbookAnswers} status={answerStatus} instagram={instagram} complete
            onFill={q => document.getElementById(`q-${q.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        </details>
        {v2.steps.filter(st => st.key !== SUMMARY_STEP).map(st => {
          const qs = visibleQuestions(v2, playbookAnswers, st.key)
          if (!qs.length) return null
          return (
            <div key={st.key} style={{ paddingTop: '14px', borderTop: `1px solid ${BORDER}`, marginTop: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>{bi(st.title, lang)}</div>
              {qs.map(q => (
                <QuestionField key={q.key} q={q} value={playbookAnswers[q.key]} state={fieldState(q, playbookAnswers, answerStatus)} highlight={focusKey === q.key}
                  onChange={v => setAnswer(q.key, v)} onState={s => setV2State(q.key, s)} lang={lang} businessType={businessType} />
              ))}
            </div>
          )
        })}
        <button onClick={saveV2} disabled={saving}
          style={{ padding: '10px 20px', minHeight: 44, background: saved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: D }}>
          {saved ? X.saved : saving ? X.saving : X.save}
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px 24px', marginBottom: '20px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{X.title}</div>
      <p style={{ fontSize: '12px', color: MUTED, marginBottom: '18px', lineHeight: 1.6 }}>
        {X.introA}<strong style={{ color: 'white' }}>{X.introB}</strong>{X.introC}
      </p>

      {FIELDS.map(f => (
        <div key={f.key} style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{X.labels[f.key]}</label>
          {f.area ? (
            <textarea value={u[f.key]} onChange={e => set(f.key)(e.target.value)} rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
          ) : (
            <input value={u[f.key]} onChange={e => set(f.key)(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit' }} />
          )}
        </div>
      ))}

      {fichaQuestions.length > 0 && (
        <div style={{ margin: '4px 0 18px', paddingTop: '16px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{X.sectorQs}</div>
          {fichaName && <p style={{ fontSize: '11.5px', color: MUTED, marginBottom: '12px', lineHeight: 1.5 }}>{X.ficha(fichaName)}</p>}
          {fichaQuestions.map(q => (
            <div key={q.key} style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{bi(q.label, lang)}</label>
              {q.type === 'select' && (
                <select value={String(playbookAnswers[q.key] ?? '')} onChange={e => setAnswer(q.key, e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: '#1a1008', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <option value="">{X.select}</option>
                  {(q.options ?? []).map(o => <option key={o.pt} value={o.pt}>{bi(o, lang)}</option>)}
                </select>
              )}
              {q.type === 'text' && (
                <input value={String(playbookAnswers[q.key] ?? '')} onChange={e => setAnswer(q.key, e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit' }} />
              )}
              {q.type === 'multi_text' && (
                <SettingsTagInput values={(playbookAnswers[q.key] as string[] | undefined) ?? []} onChange={v => setAnswer(q.key, v)} max={q.max ?? 5} />
              )}
            </div>
          ))}
        </div>
      )}

      {u.agent_business_interpretation && (
        <div style={{ margin: '4px 0 16px', padding: '12px 14px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '10px', fontSize: '12px', color: 'white', lineHeight: 1.6 }}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{X.aiSummary}</div>
          {u.agent_business_interpretation}
        </div>
      )}

      <button onClick={save} disabled={saving}
        style={{ padding: '10px 20px', background: saved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: D }}>
        {saved ? X.saved : saving ? X.saving : X.save}
      </button>
    </div>
  )
}
