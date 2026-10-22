import { useState } from 'react'
import { bi } from '../lib/verticalPlaybook'
import { REQUIRED_STAR } from '../lib/requiredFields'
import { allowedStates, isMeaningful, optionsFor, STATE_LABEL, type AnswerState, type FieldState, type V2Question } from '../lib/onboardingV2'

// Uma pergunta do onboarding v2 (ficha do setor), com "por que perguntamos"
// e as saídas honestas: "Não sei", "Não se aplica", "Preencher depois".
// Usado no diagnóstico curto, nas 5 etapas do /setup e em Configurações —
// mesma regra nas três telas (tela e código andam juntos).

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'
const GREEN = '#4ade80'
const BORDER = 'rgba(255,255,255,0.08)'

const TX = {
  pt: {
    required: 'obrigatório', why: 'Por que perguntamos: ', add: '+ Adicionar', typeEnter: 'Digite e aperte Enter', upTo: (n: number) => `até ${n}`,
    invalid: 'Não conseguimos identificar uma resposta válida para este campo. Você pode informar agora ou deixar para depois. Se essa informação for necessária para uma funcionalidade, avisaremos você e mostraremos onde completá-la.',
    autoHint: 'Lemos isso do seu Instagram. Está certo? Toque numa opção pra confirmar ou trocar.',
  },
  en: {
    required: 'required', why: 'Why we ask: ', add: '+ Add', typeEnter: 'Type and press Enter', upTo: (n: number) => `up to ${n}`,
    invalid: "We couldn't find a valid answer for this field. You can fill it in now or leave it for later. If a feature needs it, we'll let you know and show you where to complete it.",
    autoHint: 'We read this from your Instagram. Is it right? Tap an option to confirm or change it.',
  },
} as const

const chip = (on: boolean, tone: 'orange' | 'muted' = 'orange'): React.CSSProperties => ({
  minHeight: 36, padding: '7px 12px', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  background: on ? (tone === 'orange' ? 'rgba(255,109,41,0.14)' : 'rgba(255,255,255,0.10)') : 'rgba(255,255,255,0.03)',
  border: `1px solid ${on ? (tone === 'orange' ? 'rgba(255,109,41,0.55)' : 'rgba(255,255,255,0.35)') : BORDER}`,
  color: on ? (tone === 'orange' ? ORANGE : 'white') : 'white', textAlign: 'left',
})
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 13px', background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '16px', outline: 'none', fontFamily: 'inherit',
}

export default function QuestionField({ q, value, state, onChange, onState, lang, businessType = '', highlight = false }: {
  q: V2Question
  value: unknown
  state: FieldState
  onChange: (v: unknown) => void
  onState: (s: AnswerState | null) => void
  lang: 'pt' | 'en'
  businessType?: string
  highlight?: boolean
}) {
  const t = TX[lang]
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)
  const opts = optionsFor(q, businessType)
  const states = allowedStates(q)
  const arr = Array.isArray(value) ? value.map(String) : []
  const max = q.max ?? (q.type === 'multi_text' ? 5 : opts.length)

  // Qualquer resposta de verdade tira o estado ("Não sei" etc.) e confirma o "lido automaticamente".
  const setValue = (v: unknown) => { setInvalid(false); onChange(v); onState(null) }
  const pickState = (s: AnswerState) => { setInvalid(false); onChange(Array.isArray(value) ? [] : ''); onState(state === s ? null : s) }

  const addTag = () => {
    const v = draft.trim()
    if (!isMeaningful(v)) { if (v) { setInvalid(true); setDraft('') } return }
    if (arr.includes(v) || arr.length >= max) return
    setValue([...arr, v]); setDraft('')
  }
  const blurText = () => {
    const v = String(value ?? '')
    if (v && !isMeaningful(v)) {
      setInvalid(true)
      onChange('')
      onState(states.includes('later') ? 'later' : null)
    }
  }

  return (
    <div id={`q-${q.key}`} style={{ marginBottom: '20px', scrollMarginTop: '90px', ...(highlight ? { outline: `2px solid ${ORANGE}`, outlineOffset: '6px', borderRadius: '8px' } : {}) }}>
      <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'white', marginBottom: '4px', lineHeight: 1.4 }}>
        {bi(q.label, lang)}
        {states.length === 0 && <span aria-label={t.required} title={t.required} style={{ color: REQUIRED_STAR, marginLeft: 3 }}>*</span>}
        {q.type !== 'text' && q.type !== 'select' && q.max ? <span style={{ color: MUTED, fontWeight: 500, fontSize: '12px' }}> ({t.upTo(q.max)})</span> : null}
      </div>
      {q.why && <div style={{ fontSize: '12px', color: MUTED, marginBottom: '10px', lineHeight: 1.5 }}>{t.why}{bi(q.why, lang)}</div>}

      {(q.type === 'select' || q.type === 'multi_select') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {opts.map(o => {
            const on = q.type === 'select' ? String(value ?? '') === o.pt : arr.includes(o.pt)
            return (
              <button key={o.pt} type="button" aria-pressed={on} style={chip(on)}
                onClick={() => {
                  if (q.type === 'select') { setValue(on ? '' : o.pt); return }
                  if (on) { setValue(arr.filter(x => x !== o.pt)); return }
                  if (arr.length < max) setValue([...arr, o.pt])
                }}>
                {on ? '✓ ' : ''}{bi(o, lang)}
              </button>
            )
          })}
        </div>
      )}

      {q.type === 'text' && (
        <input value={String(value ?? '')} onChange={e => { setInvalid(false); onChange(e.target.value); if (state !== 'filled') onState(null) }}
          onBlur={blurText} placeholder={q.placeholder ? bi(q.placeholder, lang) : ''} style={input} />
      )}

      {q.type === 'multi_text' && (
        <div>
          {arr.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {arr.map(v => (
                <span key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '99px', fontSize: '12.5px', fontWeight: 600, background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', color: ORANGE }}>
                  {v}
                  <button type="button" aria-label="remover" onClick={() => setValue(arr.filter(x => x !== v))} style={{ background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1, minWidth: 20, minHeight: 20 }}>×</button>
                </span>
              ))}
            </div>
          )}
          {arr.length < max && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                onBlur={() => { if (draft.trim()) addTag() }}
                placeholder={q.placeholder ? bi(q.placeholder, lang) : t.typeEnter} style={{ ...input, flex: 1 }} />
              <button type="button" onClick={addTag} style={{ minHeight: 44, padding: '0 16px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', borderRadius: '10px', color: ORANGE, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>{t.add}</button>
            </div>
          )}
        </div>
      )}

      {states.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '9px' }}>
          {states.map(s => (
            <button key={s} type="button" aria-pressed={state === s} onClick={() => pickState(s)}
              style={{ ...chip(state === s, 'muted'), minHeight: 32, padding: '5px 11px', fontSize: '12px', color: state === s ? 'white' : MUTED }}>
              {state === s ? '✓ ' : ''}{STATE_LABEL[lang][s]}
            </button>
          ))}
        </div>
      )}

      {state === 'auto' && <div style={{ fontSize: '12px', color: GREEN, marginTop: '7px', lineHeight: 1.5 }}>{t.autoHint}</div>}
      {invalid && <div role="status" style={{ fontSize: '12.5px', color: ORANGE, marginTop: '8px', lineHeight: 1.5 }}>{t.invalid}</div>}
    </div>
  )
}
