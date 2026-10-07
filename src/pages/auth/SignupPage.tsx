import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'

const TX = {
  pt: {
    errLen: 'Senha deve ter pelo menos 6 caracteres.',
    errMatch: 'As senhas não coincidem.',
    errTerms: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.',
    title: 'Criar sua conta',
    subClaim: 'Crie sua conta para salvar seu diagnóstico e ter acesso ao painel.',
    sub: 'Comece a entender seus clientes em minutos.',
    claim1: 'Seu ',
    claimB: 'diagnóstico gratuito',
    claim2: ' será vinculado à sua conta automaticamente.',
    email: 'E-mail',
    emailPh: 'seu@email.com',
    password: 'Senha',
    passwordPh: 'Mínimo 6 caracteres',
    confirm: 'Confirmar senha',
    accept1: 'Li e aceito os',
    terms: 'Termos de Uso',
    and: 'e a',
    privacy: 'Política de Privacidade',
    creating: 'Criando conta...',
    create: 'Criar conta →',
    have: 'Já tem conta?',
    signIn: 'Entrar →',
  },
  en: {
    errLen: 'Password must be at least 6 characters.',
    errMatch: "Passwords don't match.",
    errTerms: 'You must accept the Terms of Use and the Privacy Policy.',
    title: 'Create your account',
    subClaim: 'Create your account to save your diagnostic and access the dashboard.',
    sub: 'Start understanding your customers in minutes.',
    claim1: 'Your ',
    claimB: 'free diagnostic',
    claim2: ' will be linked to your account automatically.',
    email: 'Email',
    emailPh: 'you@email.com',
    password: 'Password',
    passwordPh: 'At least 6 characters',
    confirm: 'Confirm password',
    accept1: 'I have read and accept the',
    terms: 'Terms of Use',
    and: 'and the',
    privacy: 'Privacy Policy',
    creating: 'Creating account...',
    create: 'Create account →',
    have: 'Already have an account?',
    signIn: 'Sign in →',
  },
} as const

const D = "'Bricolage Grotesque', system-ui, sans-serif"
const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#150E08'
const MUTED = '#BABABA'

function Field({ label, type = 'text', value, onChange, placeholder }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 14px', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s',
        }}
      />
    </div>
  )
}

export default function SignupPage() {
  const { lang } = useLang()
  const t = TX[lang]
  const [searchParams] = useSearchParams()
  const claimId = searchParams.get('claim')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError(t.errLen)
    if (password !== confirm) return setError(t.errMatch)
    if (!accepted) return setError(t.errTerms)
    setLoading(true)

    const { error: signUpErr } = await signUp(email, password)
    if (signUpErr) { setLoading(false); setError(signUpErr); return }

    // If we came from a diagnostic, claim it now (need fresh session)
    if (claimId) {
      // Wait a tick for auth state to propagate, then claim
      await new Promise(r => setTimeout(r, 800))
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        await fetch(`${supabaseUrl}/functions/v1/claim-diagnostic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ diagnostic_id: claimId }),
        })
      }
    }

    // Cadastro concluído → sempre leva para o login. Encerra qualquer sessão
    // criada automaticamente para que a pessoa entre de forma limpa.
    await signOut()
    setLoading(false)
    navigate('/login?created=1')
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', width: '700px', height: '500px', background: 'radial-gradient(ellipse, rgba(255,109,41,0.1) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '40px', textDecoration: 'none' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#000', fontWeight: 900, fontSize: '13px' }}>SB</span>
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>SalesBoost</span>
        </Link>

        <div style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '36px 40px' }}>
          <h1 style={{ fontFamily: D, fontSize: '1.7rem', fontWeight: 800, color: 'white', marginBottom: '6px', letterSpacing: '-0.03em' }}>
            {t.title}
          </h1>
          <p style={{ color: MUTED, fontSize: '14px', marginBottom: claimId ? '16px' : '28px', lineHeight: 1.5 }}>
            {claimId ? t.subClaim : t.sub}
          </p>

          {claimId && (
            <div style={{ background: 'rgba(255,109,41,0.08)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '16px' }}>🔗</span>
              <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>
                {t.claim1}<strong style={{ color: ORANGE }}>{t.claimB}</strong>{t.claim2}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Field label={t.email} type="email" value={email} onChange={setEmail} placeholder={t.emailPh} />
            <Field label={t.password} type="password" value={password} onChange={setPassword} placeholder={t.passwordPh} />
            <Field label={t.confirm} type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" />

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '4px 0 16px', cursor: 'pointer' }}>
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: ORANGE, marginTop: '2px', flexShrink: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.5 }}>
                {t.accept1}{' '}
                <Link to="/termos" target="_blank" style={{ color: ORANGE, textDecoration: 'none', fontWeight: 600 }}>{t.terms}</Link>
                {' '}{t.and}{' '}
                <Link to="/privacidade" target="_blank" style={{ color: ORANGE, textDecoration: 'none', fontWeight: 600 }}>{t.privacy}</Link>.
              </span>
            </label>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{ width: '100%', padding: '13px', background: loading ? 'rgba(255,109,41,0.55)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px' }}
            >
              {loading ? t.creating : t.create}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: MUTED }}>
          {t.have}{' '}
          <Link to="/login" style={{ color: ORANGE, textDecoration: 'none', fontWeight: 600 }}>{t.signIn}</Link>
        </p>
      </div>
    </div>
  )
}
