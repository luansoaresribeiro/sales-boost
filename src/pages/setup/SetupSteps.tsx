import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { bi, sanitizePlaybookAnswers, type PlaybookQuestion } from '../../lib/verticalPlaybook'
import { hasAnswer } from '../../lib/setupRules'
import { businessDataValid, phoneDigits, type BusinessData } from '../../lib/useSetupStatus'
import { SettingsTagInput } from '../dashboard/settings/BusinessUnderstandingCard'
import { useLang } from '../../contexts/LanguageContext'

const TX = {
  pt: {
    done: 'Pronto', errName: 'Informe o nome do negócio.', errCity: 'Informe a cidade.',
    errPhone: 'Informe o telefone com DDD, ex.: (21) 99999-9999.', errSave: 'Não consegui salvar. Tente de novo.',
    nameL: 'Nome do negócio', nameP: 'Ex: Imobiliária Silva', cityL: 'Cidade / UF', cityP: 'Ex: Rio de Janeiro, RJ',
    phoneL: 'Telefone / WhatsApp', saving: 'Salvando...', saveData: 'Salvar dados',
    select: 'Selecione...', saveAnswers: 'Salvar respostas', answerAll: 'Responda todas pra salvar',
  },
  en: {
    done: 'Done', errName: 'Enter the business name.', errCity: 'Enter the city.',
    errPhone: 'Enter the phone number with area code, e.g. (21) 99999-9999.', errSave: "Couldn't save. Please try again.",
    nameL: 'Business name', nameP: 'E.g.: Silva Realty', cityL: 'City / State', cityP: 'E.g.: Rio de Janeiro, RJ',
    phoneL: 'Phone / WhatsApp', saving: 'Saving...', saveData: 'Save details',
    select: 'Select...', saveAnswers: 'Save answers', answerAll: 'Answer all to save',
  },
} as const

export const ORANGE = '#FF6D29'
export const BG = '#0E0B0A'
export const CARD = '#150E08'
export const MUTED = '#BABABA'
export const GREEN = '#4ade80'
export const BORDER = 'rgba(255,255,255,0.08)'
export const D = "'Bricolage Grotesque', system-ui, sans-serif"

// 16px evita o zoom automático do iPhone ao focar o campo.
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: '44px', padding: '10px 13px', background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '16px', outline: 'none', fontFamily: 'inherit',
}
const label: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }
const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  minHeight: '44px', padding: '0 22px', background: enabled ? ORANGE : 'rgba(255,255,255,0.08)', color: enabled ? '#000' : MUTED,
  fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '10px', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: D,
})

// Cartão numerado: círculo vira verde com ✓ quando pronto.
export function StepShell({ n, title, hint, done, open, onToggle, children }: {
  n: number; title: string; hint: string; done: boolean; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  const tx = TX[useLang().lang]
  return (
    <section style={{ background: CARD, border: `1px solid ${done ? 'rgba(74,222,128,0.35)' : BORDER}`, borderRadius: '16px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', background: done ? GREEN : 'transparent', color: done ? '#000' : ORANGE, border: `2px solid ${done ? GREEN : ORANGE}` }}>
          {done ? '✓' : n}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: D, fontSize: '16px', fontWeight: 800, color: 'white', overflowWrap: 'anywhere' }}>{title}</span>
          <span style={{ display: 'block', fontSize: '12.5px', color: done ? GREEN : MUTED, marginTop: '2px', lineHeight: 1.4 }}>{done ? tx.done : hint}</span>
        </span>
        <span style={{ color: MUTED, fontSize: '14px' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div style={{ padding: '0 16px 18px' }}>{children}</div>}
    </section>
  )
}

// 1 — Dados do negócio (mesmos campos de Configurações: nome, cidade, telefone).
export function DadosForm({ companyId, initial, onSaved }: { companyId: string; initial: BusinessData; onSaved: () => void }) {
  const tx = TX[useLang().lang]
  const [b, setB] = useState<BusinessData>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const valid = businessDataValid(b)
  const save = async () => {
    setError('')
    if (b.business_name.trim().length < 2) return setError(tx.errName)
    if (b.city.trim().length < 2) return setError(tx.errCity)
    if (phoneDigits(b.phone).length < 10) return setError(tx.errPhone)
    setSaving(true)
    const { error: e } = await supabase.from('companies').update({
      business_name: b.business_name.trim(), city: b.city.trim(), phone: b.phone.trim(), updated_at: new Date().toISOString(),
    }).eq('id', companyId)
    setSaving(false)
    if (e) return setError(tx.errSave)
    onSaved()
  }
  const f = (k: keyof BusinessData, l: string, ph: string, type = 'text') => (
    <div style={{ marginBottom: '14px' }}>
      <label style={label}>{l}</label>
      <input type={type} value={b[k]} onChange={e => setB(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={input} />
    </div>
  )
  return (
    <div>
      {f('business_name', tx.nameL, tx.nameP)}
      {f('city', tx.cityL, tx.cityP)}
      {f('phone', tx.phoneL, '(21) 99999-9999', 'tel')}
      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '10px' }}>{error}</div>}
      <button type="button" onClick={save} disabled={saving} style={{ ...primaryBtn(valid && !saving), width: '100%' }}>{saving ? tx.saving : tx.saveData}</button>
    </div>
  )
}

// 2 — Perguntas da ficha: todas obrigatórias aqui. Mescla com as respostas que
// já existem (nada que o dono respondeu antes se perde).
export function PerguntasForm({ companyId, questions, initial, onSaved }: {
  companyId: string; questions: PlaybookQuestion[]; initial: Record<string, unknown>; onSaved: () => void
}) {
  const { lang } = useLang()
  const tx = TX[lang]
  const [answers, setAnswers] = useState<Record<string, unknown>>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const complete = questions.every(q => hasAnswer(answers[q.key]))
  const save = async () => {
    if (!complete) return
    setSaving(true); setError('')
    const { data: fresh } = await supabase.from('companies').select('playbook_answers').eq('id', companyId).maybeSingle()
    const merged = { ...((fresh?.playbook_answers as Record<string, unknown> | null) ?? {}), ...sanitizePlaybookAnswers(answers, questions) }
    const { error: e } = await supabase.from('companies').update({ playbook_answers: merged, updated_at: new Date().toISOString() }).eq('id', companyId)
    setSaving(false)
    if (e) return setError(tx.errSave)
    onSaved()
  }
  const set = (k: string, v: unknown) => setAnswers(p => ({ ...p, [k]: v }))
  return (
    <div>
      {questions.map(q => (
        <div key={q.key} style={{ marginBottom: '14px' }}>
          <label style={label}>{bi(q.label, lang)}</label>
          {q.type === 'select' && (
            <select value={String(answers[q.key] ?? '')} onChange={e => set(q.key, e.target.value)} style={{ ...input, background: '#1a1008', cursor: 'pointer' }}>
              <option value="">{tx.select}</option>
              {(q.options ?? []).map(o => <option key={o.pt} value={o.pt}>{bi(o, lang)}</option>)}
            </select>
          )}
          {q.type === 'text' && <input value={String(answers[q.key] ?? '')} onChange={e => set(q.key, e.target.value)} style={input} />}
          {q.type === 'multi_text' && <SettingsTagInput values={(answers[q.key] as string[] | undefined) ?? []} onChange={v => set(q.key, v)} max={q.max ?? 5} />}
        </div>
      ))}
      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '10px' }}>{error}</div>}
      <button type="button" onClick={save} disabled={!complete || saving} style={{ ...primaryBtn(complete && !saving), width: '100%' }}>
        {saving ? tx.saving : complete ? tx.saveAnswers : tx.answerAll}
      </button>
    </div>
  )
}
