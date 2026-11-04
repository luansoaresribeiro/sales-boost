// Configurações → "Sua conta" (2026-11-04, dono): mostra o e-mail do login e troca a senha de quem está logado.
// supabase.auth.updateUser({ password }) vale para a sessão atual; não mexe em configuração do Supabase Auth.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useLang } from '../../../contexts/LanguageContext'

const ORANGE = '#FF6D29', CARD = '#150E08', MUTED = '#BABABA', BORDER = 'rgba(255,255,255,0.1)'

const TX = {
  pt: {
    title: 'Sua conta', email: 'E-mail de login', passTitle: 'Trocar senha', change: 'Trocar senha',
    passSub: 'Escolha uma senha nova com pelo menos 8 caracteres.', p1: 'Senha nova', p2: 'Repita a senha nova',
    save: 'Salvar senha nova', saving: 'Salvando...', cancel: 'Cancelar',
    short: 'A senha precisa ter pelo menos 8 caracteres.', diff: 'As duas senhas não são iguais.',
    ok: 'Senha trocada. Use a senha nova no próximo login.',
    reauth: 'Por segurança, saia e entre de novo na sua conta e tente outra vez.',
    fail: 'Não foi possível trocar a senha. Sua senha antiga continua valendo.',
  },
  en: {
    title: 'Your account', email: 'Login email', passTitle: 'Change password', change: 'Change password',
    passSub: 'Choose a new password with at least 8 characters.', p1: 'New password', p2: 'Repeat new password',
    save: 'Save new password', saving: 'Saving...', cancel: 'Cancel',
    short: 'The password must have at least 8 characters.', diff: "The passwords don't match.",
    ok: 'Password changed. Use the new password next time you sign in.',
    reauth: 'For security, sign out and back in, then try again.',
    fail: "Couldn't change the password. Your old password still works.",
  },
}

const input: React.CSSProperties = { width: '100%', padding: '11px 13px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', marginBottom: '12px' }
const label: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }

export default function AccountTab() {
  const { lang } = useLang(); const t = TX[lang]
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [p1, setP1] = useState(''); const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null)
    if (p1.length < 8) { setMsg({ ok: false, text: t.short }); return }
    if (p1 !== p2) { setMsg({ ok: false, text: t.diff }); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: /reauth|nonce|recent/i.test(error.message) ? t.reauth : t.fail }); return }
    setP1(''); setP2(''); setOpen(false); setMsg({ ok: true, text: t.ok })
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', maxWidth: '520px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '16px' }}>{t.title}</div>
      <div style={label}>{t.email}</div>
      <div style={{ fontSize: '14px', color: 'white', marginBottom: '22px', wordBreak: 'break-all' }}>{user?.email ?? '—'}</div>

      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '18px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{t.passTitle}</div>
        {!open ? (
          <button type="button" onClick={() => { setOpen(true); setMsg(null) }}
            style={{ marginTop: '10px', padding: '10px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
            {t.change}
          </button>
        ) : (
          <form onSubmit={submit} style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '12px', color: MUTED, marginBottom: '12px' }}>{t.passSub}</div>
            <label style={label}>{t.p1}</label>
            <input type="password" value={p1} onChange={e => setP1(e.target.value)} autoComplete="new-password" style={input} />
            <label style={label}>{t.p2}</label>
            <input type="password" value={p2} onChange={e => setP2(e.target.value)} autoComplete="new-password" style={input} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="submit" disabled={busy}
                style={{ padding: '10px 18px', background: busy ? 'rgba(255,109,41,0.55)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '10px', border: 'none', cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy ? t.saving : t.save}
              </button>
              <button type="button" disabled={busy} onClick={() => { setOpen(false); setP1(''); setP2(''); setMsg(null) }}
                style={{ padding: '10px 18px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '13px', borderRadius: '10px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                {t.cancel}
              </button>
            </div>
          </form>
        )}
        {msg && <div style={{ fontSize: '12px', marginTop: '12px', color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</div>}
      </div>
    </div>
  )
}
