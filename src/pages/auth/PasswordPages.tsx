// "Esqueceu a senha?" (2026-11-04): o link do login apontava para /forgot-password, que não existia.
// ForgotPasswordPage pede o link por e-mail; ResetPasswordPage grava a senha nova (sessão de recuperação do Supabase).
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'

const ORANGE = '#FF6D29', BG = '#0E0B0A', CARD = '#150E08', MUTED = '#BABABA', BORDER = 'rgba(255,255,255,0.1)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

const TX = {
  pt: {
    forgotTitle: 'Esqueceu a senha?', forgotSub: 'Digite seu e-mail. Vamos mandar um link para você criar uma senha nova.',
    email: 'E-mail', emailPh: 'seu@email.com', send: 'Enviar link →', sending: 'Enviando...',
    sentTitle: 'Verifique seu e-mail', sent: 'Se existir uma conta com esse e-mail, o link chega em alguns minutos. Olhe também o spam.',
    back: '← Voltar para o login',
    resetTitle: 'Criar senha nova', resetSub: 'Escolha uma senha com pelo menos 8 caracteres.',
    pass: 'Senha nova', pass2: 'Repita a senha', save: 'Salvar senha →', saving: 'Salvando...',
    short: 'A senha precisa ter pelo menos 8 caracteres.', diff: 'As duas senhas não são iguais.',
    noSession: 'Este link expirou ou já foi usado. Peça um novo.', askNew: 'Pedir novo link',
    checking: 'Verificando o link...', done: 'Senha salva! Entrando...',
  },
  en: {
    forgotTitle: 'Forgot your password?', forgotSub: "Enter your email. We'll send a link to create a new password.",
    email: 'Email', emailPh: 'you@email.com', send: 'Send link →', sending: 'Sending...',
    sentTitle: 'Check your email', sent: 'If an account exists for that email, the link arrives in a few minutes. Check spam too.',
    back: '← Back to sign in',
    resetTitle: 'Create a new password', resetSub: 'Choose a password with at least 8 characters.',
    pass: 'New password', pass2: 'Repeat password', save: 'Save password →', saving: 'Saving...',
    short: 'The password must have at least 8 characters.', diff: "The passwords don't match.",
    noSession: 'This link expired or was already used. Request a new one.', askNew: 'Request new link',
    checking: 'Checking the link...', done: 'Password saved! Signing in...',
  },
} as const

const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', marginBottom: '16px' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }
const btnStyle = (busy: boolean): React.CSSProperties => ({ width: '100%', padding: '13px', background: busy ? 'rgba(255,109,41,0.55)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: busy ? 'not-allowed' : 'pointer' })

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '36px 32px' }}>
          <h1 style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 800, color: 'white', marginBottom: '6px', letterSpacing: '-0.03em' }}>{title}</h1>
          <p style={{ color: MUTED, fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>{sub}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#f87171' }}>{msg}</div>
}

export function ForgotPasswordPage() {
  const { lang } = useLang(); const t = TX[lang]
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false); const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    setBusy(false)
    if (error) setError(error.message); else setSent(true) // não diz se a conta existe (evita descobrir e-mails cadastrados)
  }
  return (
    <Shell title={sent ? t.sentTitle : t.forgotTitle} sub={sent ? t.sent : t.forgotSub}>
      {!sent && (
        <form onSubmit={submit}>
          <label style={labelStyle}>{t.email}</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t.emailPh} style={inputStyle} />
          {error && <ErrorBox msg={error} />}
          <button type="submit" disabled={busy} style={btnStyle(busy)}>{busy ? t.sending : t.send}</button>
        </form>
      )}
      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}><Link to="/login" style={{ color: ORANGE, textDecoration: 'none' }}>{t.back}</Link></p>
    </Shell>
  )
}

export function ResetPasswordPage() {
  const { lang } = useLang(); const t = TX[lang]
  const navigate = useNavigate()
  const [state, setState] = useState<'checking' | 'ready' | 'nosession' | 'done'>('checking')
  const [p1, setP1] = useState(''); const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    // O supabase-js lê o token do link na URL sozinho; dá um instante e confere se há sessão de recuperação.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (alive) setState(data.session ? 'ready' : 'nosession')
    }, 600)
    return () => { alive = false; clearTimeout(timer) }
  }, [])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (p1.length < 8) { setError(t.short); return }
    if (p1 !== p2) { setError(t.diff); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setBusy(false)
    if (error) { setError(error.message); return }
    setState('done'); setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
  }
  if (state === 'checking') return <Shell title={t.resetTitle} sub={t.checking}><span /></Shell>
  if (state === 'nosession') return (
    <Shell title={t.resetTitle} sub={t.noSession}>
      <Link to="/forgot-password" style={{ ...btnStyle(false), display: 'block', textAlign: 'center', textDecoration: 'none' }}>{t.askNew}</Link>
    </Shell>
  )
  if (state === 'done') return <Shell title={t.resetTitle} sub={t.done}><span /></Shell>
  return (
    <Shell title={t.resetTitle} sub={t.resetSub}>
      <form onSubmit={submit}>
        <label style={labelStyle}>{t.pass}</label>
        <input type="password" value={p1} onChange={e => setP1(e.target.value)} autoComplete="new-password" style={inputStyle} />
        <label style={labelStyle}>{t.pass2}</label>
        <input type="password" value={p2} onChange={e => setP2(e.target.value)} autoComplete="new-password" style={inputStyle} />
        {error && <ErrorBox msg={error} />}
        <button type="submit" disabled={busy} style={btnStyle(busy)}>{busy ? t.saving : t.save}</button>
      </form>
    </Shell>
  )
}
