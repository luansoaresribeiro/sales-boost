import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { useShowcase } from '../../../contexts/ShowcaseContext'
import { supabase } from '../../../lib/supabase'
import { isValidBrokerPhone } from '../resultsBrokers'

// Corretores (Etapa 7 mínima): CONTATO de encaminhamento, sem login. O lead que chega pela página pública é distribuído em rodízio
// entre os ativos; o dono encaminha por WhatsApp no Funil. Escrita direta pela RLS (só a dona da empresa); vitrine = cadeado.

const ORANGE = '#FF6D29', CARD = '#150E08', MUTED = '#BABABA', BORDER = 'rgba(255,255,255,0.06)'
const TX = {
  pt: {
    title: 'Corretores', intro: 'Quem recebe os leads que chegam pela página pública do imóvel, em rodízio. O corretor não tem login: é só um contato — você encaminha o lead por WhatsApp pelo Funil.',
    warn: 'Atenção: o número do corretor pode aparecer para quem clicar no WhatsApp da página pública do imóvel.',
    name: 'Nome', phone: 'WhatsApp (com DDD)', email: 'E-mail (opcional)', add: 'Adicionar corretor', save: 'Salvar', saving: 'Salvando…', cancel: 'Cancelar', edit: 'Editar',
    deactivate: 'Desativar', activate: 'Ativar', inactive: 'inativo', none: 'Nenhum corretor ainda. Sem corretor, o lead fica sem encaminhamento e o botão da página usa o WhatsApp da empresa.',
    errName: 'Informe o nome.', errPhone: 'WhatsApp inválido: use pelo menos 10 dígitos (DDD + número).', errEmail: 'E-mail inválido.', errSave: 'Não consegui salvar. Tente de novo.', loading: 'Carregando…',
  },
  en: {
    title: 'Brokers', intro: 'Who receives the leads that arrive through the property public page, in rotation. A broker has no login: just a contact — you forward the lead by WhatsApp from the Pipeline.',
    warn: 'Heads-up: the broker number may be shown to anyone who taps the WhatsApp button on the property public page.',
    name: 'Name', phone: 'WhatsApp (with area code)', email: 'Email (optional)', add: 'Add broker', save: 'Save', saving: 'Saving…', cancel: 'Cancel', edit: 'Edit',
    deactivate: 'Deactivate', activate: 'Activate', inactive: 'inactive', none: 'No brokers yet. Without a broker the lead is not routed and the page button uses the company WhatsApp.',
    errName: 'Enter the name.', errPhone: 'Invalid WhatsApp: use at least 10 digits (area code + number).', errEmail: 'Invalid email.', errSave: 'Could not save. Try again.', loading: 'Loading…',
  },
} as const

interface Broker { id: string; name: string; phone: string; email: string | null; active: boolean }
const EMPTY = { name: '', phone: '', email: '' }
const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '13px', outline: 'none' } as const
const small = (primary?: boolean) => ({ padding: '7px 13px', background: primary ? ORANGE : 'transparent', color: primary ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: primary ? 'none' : `1px solid ${BORDER}`, cursor: 'pointer' }) as const

export default function BrokersCard({ companyId }: { companyId: string }) {
  const { lang } = useLang()
  const t = TX[lang]
  const { readOnly, openPlanModal } = useShowcase()
  const [rows, setRows] = useState<Broker[] | null>(null)
  const [form, setForm] = useState<{ id: string | null; v: typeof EMPTY } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('brokers').select('id, name, phone, email, active').eq('company_id', companyId).order('created_at', { ascending: true })
    setRows(error ? [] : (data ?? []) as Broker[])
  }, [companyId])
  useEffect(() => { void load() }, [load])

  const guard = () => { if (readOnly) { openPlanModal(); return true } return false }
  const submit = async () => {
    if (!form || guard()) return
    const name = form.v.name.trim(), phone = form.v.phone.trim(), email = form.v.email.trim()
    if (!name) return setErr(t.errName)
    if (!isValidBrokerPhone(phone)) return setErr(t.errPhone)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr(t.errEmail)
    setBusy(true); setErr(null)
    const row = { name: name.slice(0, 120), phone: phone.slice(0, 40), email: email ? email.slice(0, 160) : null }
    const { error } = form.id
      ? await supabase.from('brokers').update(row).eq('id', form.id).eq('company_id', companyId)
      : await supabase.from('brokers').insert({ ...row, company_id: companyId })
    setBusy(false)
    if (error) return setErr(t.errSave)
    setForm(null); void load()
  }
  const toggle = async (b: Broker) => {
    if (guard()) return
    setBusy(true); setErr(null)
    const { error } = await supabase.from('brokers').update({ active: !b.active }).eq('id', b.id).eq('company_id', companyId)
    setBusy(false)
    if (error) setErr(t.errSave); else void load()
  }
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => (f ? { ...f, v: { ...f.v, [k]: e.target.value } } : f))

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', marginBottom: '20px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}><span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{t.title}</span></div>
      <div style={{ padding: '22px' }}>
        <p style={{ fontSize: '12px', color: MUTED, marginBottom: '12px', lineHeight: 1.6 }}>{t.intro}</p>
        <div role="note" style={{ fontSize: '12px', color: '#FBBF24', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '9px', padding: '8px 11px', marginBottom: '14px', lineHeight: 1.5 }}>{t.warn}</div>
        {rows === null && <div style={{ fontSize: '12px', color: MUTED }}>{t.loading}</div>}
        {rows !== null && rows.length === 0 && !form && <div style={{ fontSize: '12px', color: MUTED, marginBottom: '12px', lineHeight: 1.5 }}>{t.none}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {(rows ?? []).map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', opacity: b.active ? 1 : 0.6 }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', overflowWrap: 'anywhere' }}>{b.name}{!b.active && <span style={{ fontSize: '10px', color: MUTED, marginLeft: '8px' }}>({t.inactive})</span>}</div>
                <div style={{ fontSize: '11px', color: MUTED, overflowWrap: 'anywhere' }}>{b.phone}{b.email ? ` · ${b.email}` : ''}</div>
              </div>
              <button disabled={busy} onClick={() => { setErr(null); setForm({ id: b.id, v: { name: b.name, phone: b.phone, email: b.email ?? '' } }) }} style={small()}>{t.edit}</button>
              <button disabled={busy} onClick={() => toggle(b)} style={small()}>{b.active ? t.deactivate : t.activate}</button>
            </div>
          ))}
        </div>
        {form ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input aria-label={t.name} placeholder={t.name} value={form.v.name} onChange={set('name')} maxLength={120} style={inp} />
            <input aria-label={t.phone} placeholder={t.phone} value={form.v.phone} onChange={set('phone')} inputMode="tel" maxLength={40} style={inp} />
            <input aria-label={t.email} placeholder={t.email} value={form.v.email} onChange={set('email')} type="email" maxLength={160} style={inp} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button disabled={busy} onClick={submit} style={small(true)}>{busy ? t.saving : t.save}</button>
              <button disabled={busy} onClick={() => { setForm(null); setErr(null) }} style={small()}>{t.cancel}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { if (guard()) return; setErr(null); setForm({ id: null, v: EMPTY }) }} style={small(true)}>{t.add}</button>
        )}
        {err && <div role="alert" style={{ fontSize: '12px', color: '#f87171', marginTop: '10px' }}>{err}</div>}
      </div>
    </div>
  )
}
