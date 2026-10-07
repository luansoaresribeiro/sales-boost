import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const MUTED = '#BABABA'

// Esta página roda fora do LanguageProvider (rota pública de retorno do OAuth),
// então lê a preferência salva direto do localStorage.

const TX = {
  pt: {
    invalid: 'Parâmetros inválidos. Tente conectar novamente.', failed: 'Erro ao conectar. Tente novamente.',
    domain: (d: string) => `Conectado: ${d}`, ok: 'Google Search Console conectado!', unexpected: 'Erro inesperado. Tente novamente.',
    connecting: 'Conectando Google Search Console...', success: 'Conectado com sucesso!', redirecting: 'Redirecionando...',
    errTitle: 'Erro ao conectar', back: 'Voltar às Conexões',
  },
  en: {
    invalid: 'Invalid parameters. Please try connecting again.', failed: 'Error connecting. Please try again.',
    domain: (d: string) => `Connected: ${d}`, ok: 'Google Search Console connected!', unexpected: 'Unexpected error. Please try again.',
    connecting: 'Connecting Google Search Console...', success: 'Connected successfully!', redirecting: 'Redirecting...',
    errTitle: 'Connection error', back: 'Back to Connections',
  },
} as const
const getX = () => TX[localStorage.getItem('sb_lang') === 'en' ? 'en' : 'pt']

export default function GscCallbackPage() {
  const [searchParams] = useSearchParams()
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const X = getX()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (authLoading) return

    const code = searchParams.get('code')
    const state = searchParams.get('state') // company_id passed via state param

    if (!code || !state) {
      setStatus('error')
      setMessage(X.invalid)
      return
    }

    if (!session) {
      navigate(`/login?redirect=/auth/gsc/callback?code=${code}&state=${state}`)
      return
    }

    const exchange = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const res = await fetch(`${supabaseUrl}/functions/v1/gsc-oauth-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code, company_id: state }),
        })

        const data = await res.json() as { success?: boolean; domain?: string; error?: string }

        if (!res.ok || data.error) {
          setStatus('error')
          setMessage(data.error ?? X.failed)
        } else {
          setStatus('success')
          setMessage(data.domain ? X.domain(data.domain) : X.ok)
          setTimeout(() => navigate('/dashboard/marketing-ai/conexoes'), 2000)
        }
      } catch {
        setStatus('error')
        setMessage(X.unexpected)
      }
    }

    exchange()
  }, [authLoading, session, searchParams, navigate])

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        {status === 'loading' && (
          <>
            <div style={{ width: '48px', height: '48px', border: `3px solid rgba(255,109,41,0.2)`, borderTopColor: ORANGE, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 20px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <div style={{ fontSize: '15px', color: MUTED }}>{X.connecting}</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>{X.success}</div>
            <div style={{ fontSize: '13px', color: MUTED }}>{message}</div>
            <div style={{ fontSize: '12px', color: MUTED, marginTop: '8px' }}>{X.redirecting}</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>{X.errTitle}</div>
            <div style={{ fontSize: '13px', color: MUTED, marginBottom: '20px' }}>{message}</div>
            <button
              onClick={() => navigate('/dashboard/marketing-ai/conexoes')}
              style={{ padding: '10px 20px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
            >
              {X.back}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
