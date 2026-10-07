import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// Esta página roda fora do LanguageProvider (rota pública de retorno do OAuth),
// então lê a preferência salva direto do localStorage.

const TX = {
  pt: {
    denied: (e: string) => `Google recusou o acesso: ${e}`, invalid: 'Parâmetros inválidos na URL de callback', unknown: 'Erro desconhecido',
    ok: (a: string) => `Google Business Profile conectado! Conta: ${a}`, connecting: 'Conectando Google Business Profile...',
    connected: 'Conectado!', redirecting: 'Redirecionando...', errTitle: 'Erro na conexão', back: 'Voltar para Conexões',
  },
  en: {
    denied: (e: string) => `Google denied access: ${e}`, invalid: 'Invalid parameters in the callback URL', unknown: 'Unknown error',
    ok: (a: string) => `Google Business Profile connected! Account: ${a}`, connecting: 'Connecting Google Business Profile...',
    connected: 'Connected!', redirecting: 'Redirecting...', errTitle: 'Connection error', back: 'Back to Connections',
  },
} as const
const getX = () => TX[localStorage.getItem('sb_lang') === 'en' ? 'en' : 'pt']

export default function GbpCallbackPage() {
  const { session, user } = useAuth()
  const navigate = useNavigate()
  const X = getX()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state') // company_id
    const error = params.get('error')

    if (error) {
      setStatus('error')
      setMessage(X.denied(error))
      return
    }

    if (!code || !state) {
      setStatus('error')
      setMessage(X.invalid)
      return
    }

    if (!session) return

    const exchange = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gbp-oauth-callback`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, company_id: state }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? X.unknown)
        setStatus('success')
        setMessage(X.ok(data.account_name || 'OK'))
        setTimeout(() => navigate('/dashboard/marketing-ai/conexoes'), 2000)
      } catch (e: unknown) {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : String(e))
      }
    }

    exchange()
  }, [session])

  // Also handle company_id from state if user just signed in
  useEffect(() => {
    if (!user && status === 'loading') {
      // redirect to login with return URL
      const params = new URLSearchParams(window.location.search)
      if (!params.get('code')) {
        navigate('/login')
      }
    }
  }, [user])

  return (
    <div style={{ minHeight: '100vh', background: '#0E0B0A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '0 24px' }}>
        {status === 'loading' && (
          <>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,109,41,0.2)', borderTopColor: '#FF6D29', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 20px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <div style={{ color: '#BABABA', fontSize: '14px' }}>{X.connecting}</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✓</div>
            <div style={{ color: '#4ade80', fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{X.connected}</div>
            <div style={{ color: '#BABABA', fontSize: '13px' }}>{message}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '8px' }}>{X.redirecting}</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✗</div>
            <div style={{ color: '#f87171', fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{X.errTitle}</div>
            <div style={{ color: '#BABABA', fontSize: '13px', marginBottom: '24px' }}>{message}</div>
            <button onClick={() => navigate('/dashboard/marketing-ai/conexoes')}
              style={{ padding: '10px 24px', background: '#FF6D29', color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
              {X.back}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
