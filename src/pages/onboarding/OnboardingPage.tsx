import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchBusinessTypes, OTHER_BUSINESS_TYPE } from '../../lib/businessTypes'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#1A1008'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

interface OnboardingData {
  business_name: string
  business_type: string
  city: string
  website_url: string
  instagram_url: string
  facebook_url: string
  tiktok_url: string
  google_maps_url: string
  phone: string
  contact_email: string
  goal: string
}

const GOALS = [
  'Atrair mais clientes novos',
  'Aumentar frequência dos clientes atuais',
  'Recuperar clientes inativos',
  'Aumentar ticket médio',
  'Melhorar reputação online',
  'Melhorar performance do meu site',
  'Outro',
]

const LOADING_MSGS = [
  'Verificando performance do site...',
  'Analisando SEO técnico...',
  'Checando Core Web Vitals...',
  'Mapeando presença digital...',
  'Calculando seu diagnóstico...',
]

function Field({
  label, value, onChange, placeholder, type = 'text', required = false, hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}
        {required && <span style={{ color: ORANGE }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 16px', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`,
          borderRadius: '12px', color: 'white', fontSize: '15px',
          outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit',
        }}
      />
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function SelectField({
  label, value, onChange, options, required = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: string[]; required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}
        {required && <span style={{ color: ORANGE }}>*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 16px', boxSizing: 'border-box',
          background: '#1a1008',
          border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`,
          borderRadius: '12px', color: value ? 'white' : MUTED,
          fontSize: '15px', outline: 'none', transition: 'border-color 0.2s',
          fontFamily: 'inherit', cursor: 'pointer', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23BABABA' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 16px center',
        }}
      >
        <option value="" disabled style={{ color: MUTED }}>Selecione...</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#1a1008', color: 'white' }}>{o}</option>)}
      </select>
    </div>
  )
}

// Tipo de estabelecimento: opções do banco (geridas pelo dono) + "Outro
// (especifique)" com campo livre, pra ninguém ficar travado.
function BusinessTypeSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
  const [otherMode, setOtherMode] = useState(false)
  const known = options.includes(value)
  const showOther = otherMode || (value !== '' && !known && options.length > 0)
  return (
    <>
      <SelectField
        label="Tipo de estabelecimento" required
        value={showOther ? OTHER_BUSINESS_TYPE : (known ? value : '')}
        onChange={v => { if (v === OTHER_BUSINESS_TYPE) { setOtherMode(true); onChange('') } else { setOtherMode(false); onChange(v) } }}
        options={[...options, OTHER_BUSINESS_TYPE]}
      />
      {showOther && (
        <div style={{ marginTop: '-8px' }}>
          <Field label="Qual?" value={value} onChange={onChange} placeholder="Digite o tipo do seu negócio" required />
        </div>
      )}
    </>
  )
}

const STEPS = ['Seu negócio', 'Presença digital', 'Seu objetivo']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    business_name: '', business_type: '', city: '',
    website_url: '', instagram_url: '', facebook_url: '',
    tiktok_url: '', google_maps_url: '', phone: '',
    contact_email: '', goal: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0])
  const [error, setError] = useState('')
  const [businessTypes, setBusinessTypes] = useState<string[]>([])

  useEffect(() => { fetchBusinessTypes().then(setBusinessTypes) }, [])

  const set = (k: keyof OnboardingData) => (v: string) => setData(d => ({ ...d, [k]: v }))

  const isValidUrl = (url: string) => {
    const s = url.trim()
    if (!s) return false
    try {
      const u = new URL(s.startsWith('http') ? s : `https://${s}`)
      return u.hostname.includes('.')
    } catch {
      return false
    }
  }

  const canNext = () => {
    if (step === 0) return !!(data.business_name.trim() && data.business_type && data.city.trim())
    if (step === 1) return isValidUrl(data.website_url)
    if (step === 2) return !!(data.contact_email.trim() && data.goal)
    return false
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    let msgIdx = 0
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MSGS.length
      setLoadingMsg(LOADING_MSGS[msgIdx])
    }, 2500)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

      const res = await fetch(`${supabaseUrl}/functions/v1/run-diagnosis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Erro ao processar diagnóstico')

      clearInterval(interval)
      navigate(`/diagnostico/${result.id}`)
    } catch (e) {
      clearInterval(interval)
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  if (submitting) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ marginBottom: '32px', position: 'relative' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', border: `3px solid rgba(255,109,41,0.15)`, borderTopColor: ORANGE, animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
        <div style={{ fontFamily: D, fontSize: '1.4rem', fontWeight: 800, color: 'white', marginBottom: '12px', textAlign: 'center' }}>Analisando seu negócio</div>
        <div style={{ fontSize: '14px', color: MUTED, textAlign: 'center', transition: 'opacity 0.5s' }}>{loadingMsg}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: D, fontSize: '1.3rem', fontWeight: 900, color: 'white', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          <span style={{ color: ORANGE }}>Sales</span>Boost
        </a>
        <div style={{ fontSize: '13px', color: MUTED }}>
          Passo {step + 1} de {STEPS.length}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', background: ORANGE, width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.4s ease', borderRadius: '0 2px 2px 0' }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>

          {/* Step label */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: i < step ? ORANGE : i === step ? 'rgba(255,109,41,0.15)' : 'rgba(255,255,255,0.05)',
                  border: i === step ? `1px solid ${ORANGE}` : i < step ? 'none' : `1px solid ${BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 900,
                  color: i < step ? '#000' : i === step ? ORANGE : MUTED,
                  flexShrink: 0, transition: 'all 0.3s',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '12px', color: i === step ? 'white' : MUTED, fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
                {i < STEPS.length - 1 && <div style={{ width: '20px', height: '1px', background: BORDER, margin: '0 4px' }} />}
              </div>
            ))}
          </div>

          {/* Form card */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '32px' }}>

            {step === 0 && (
              <>
                <h1 style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>Sobre seu negócio</h1>
                <p style={{ color: MUTED, fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
                  Conte o básico para personalizarmos seu diagnóstico.
                </p>
                <Field label="Nome do negócio" value={data.business_name} onChange={set('business_name')} placeholder="Ex: Studio Beleza Carioca" required />
                <BusinessTypeSelect value={data.business_type} onChange={set('business_type')} options={businessTypes} />
                <Field label="Cidade / UF" value={data.city} onChange={set('city')} placeholder="Ex: Rio de Janeiro, RJ" required />
              </>
            )}

            {step === 1 && (
              <>
                <h1 style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>Sua presença digital</h1>
                <p style={{ color: MUTED, fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
                  Quanto mais canais você preencher, mais completo será o diagnóstico.
                </p>
                <Field label="Site" value={data.website_url} onChange={set('website_url')} placeholder="https://seunegocio.com.br" type="url" required hint={data.website_url.trim() && !isValidUrl(data.website_url) ? '⚠️ URL inválida — use o formato: https://seunegocio.com.br' : 'Analisaremos a performance, SEO e experiência do usuário'} />
                <Field label="Instagram" value={data.instagram_url} onChange={set('instagram_url')} placeholder="https://instagram.com/seuperfil" hint="Coletamos engajamento e menções" />
                <Field label="Facebook" value={data.facebook_url} onChange={set('facebook_url')} placeholder="https://facebook.com/suapagina" />
                <Field label="TikTok" value={data.tiktok_url} onChange={set('tiktok_url')} placeholder="https://tiktok.com/@seuperfil" />
                <Field label="Google Maps" value={data.google_maps_url} onChange={set('google_maps_url')} placeholder="Link do seu negócio no Google Maps" hint="Coletamos suas avaliações e nota" />
                <Field label="Telefone / WhatsApp" value={data.phone} onChange={set('phone')} placeholder="(21) 99999-9999" type="tel" />
              </>
            )}

            {step === 2 && (
              <>
                <h1 style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>Seu objetivo</h1>
                <p style={{ color: MUTED, fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
                  Isso guia a IA para gerar um plano de ação relevante para você.
                </p>
                <SelectField label="Principal meta do negócio" value={data.goal} onChange={set('goal')} options={GOALS} required />
                <Field label="Seu e-mail de contato" value={data.contact_email} onChange={set('contact_email')} placeholder="voce@seunegocio.com.br" type="email" required hint="Usado para acessar seu painel e receber alertas importantes" />

                {error && (
                  <div style={{ padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', fontSize: '13px', color: '#f87171', marginBottom: '16px', lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}
              </>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{ flex: '0 0 auto', padding: '12px 20px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '14px', borderRadius: '12px', border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ← Voltar
                </button>
              )}
              <button
                onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : handleSubmit}
                disabled={!canNext()}
                style={{
                  flex: 1, padding: '13px 24px', background: canNext() ? ORANGE : 'rgba(255,109,41,0.2)',
                  color: canNext() ? '#000' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: '15px',
                  borderRadius: '12px', border: 'none', cursor: canNext() ? 'pointer' : 'not-allowed',
                  fontFamily: D, letterSpacing: '-0.01em', transition: 'all 0.2s',
                  boxShadow: canNext() ? '0 8px 20px rgba(255,109,41,0.3)' : 'none',
                }}
              >
                {step < STEPS.length - 1 ? 'Continuar →' : 'Analisar meu negócio →'}
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: MUTED, marginTop: '20px', lineHeight: 1.6 }}>
            Ao continuar, você concorda com nossa{' '}
            <span style={{ color: ORANGE, cursor: 'pointer' }}>política de privacidade</span>.
            Seus dados são usados exclusivamente para gerar o diagnóstico.
          </p>
        </div>
      </div>
    </div>
  )
}
