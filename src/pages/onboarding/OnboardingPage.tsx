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
  // Entendimento do negócio (conversa estratégica)
  business_description: string
  ideal_customer: string
  business_stage: string
  main_challenges: string
  current_channels: string[]
}

const GOALS = [
  'Atrair mais clientes novos',
  'Aumentar frequência dos clientes atuais',
  'Recuperar clientes inativos',
  'Aumentar ticket médio',
  'Melhorar reputação online',
  'Construir minha marca',
  'Entender melhor meu negócio',
  'Outro',
]
const STAGES = ['Começando agora', 'Crescendo', 'Estabelecido', 'Escalando', 'Preciso dar a volta por cima']
const CHALLENGES = [
  'Poucos clientes novos', 'Vendas baixas', 'Redes sociais fracas', 'Não sei o que postar',
  'Trabalho manual demais', 'Não entendo meus dados', 'Retenção de clientes', 'Concorrência', 'Falta de estratégia', 'Outro',
]
const CHANNELS = ['Instagram', 'Facebook', 'WhatsApp', 'Google', 'Site', 'Indicações', 'Anúncios pagos', 'E-mail', 'Equipe de vendas', 'Ainda não sei']

const LOADING_MSGS = [
  'Entendendo seu negócio...', 'Montando seu perfil...', 'Verificando seu site...',
  'Analisando seu segmento...', 'Preparando seu diagnóstico...',
]

function Field({ label, value, onChange, placeholder, type = 'text', required = false, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}{required && <span style={{ color: ORANGE }}>*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '12px 16px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '12px', color: 'white', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit' }} />
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '12px 16px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '12px', color: 'white', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, required = false }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}{required && <span style={{ color: ORANGE }}>*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '12px 16px', boxSizing: 'border-box', background: '#1a1008', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '12px', color: value ? 'white' : MUTED, fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23BABABA' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}>
        <option value="" disabled style={{ color: MUTED }}>Selecione...</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#1a1008', color: 'white' }}>{o}</option>)}
      </select>
    </div>
  )
}

function MultiSelect({ label, values, options, onToggle, hint }: {
  label: string; values: string[]; options: string[]; onToggle: (v: string) => void; hint?: string
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '9px' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(o => {
          const on = values.includes(o)
          return (
            <button key={o} type="button" onClick={() => onToggle(o)}
              style={{ padding: '8px 13px', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: on ? 'rgba(255,109,41,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,109,41,0.5)' : BORDER}`, color: on ? ORANGE : 'white' }}>
              {on ? '✓ ' : ''}{o}
            </button>
          )
        })}
      </div>
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '7px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function BusinessTypeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [otherMode, setOtherMode] = useState(false)
  const known = options.includes(value)
  const showOther = otherMode || (value !== '' && !known && options.length > 0)
  return (
    <>
      <SelectField label="Tipo de negócio" required
        value={showOther ? OTHER_BUSINESS_TYPE : (known ? value : '')}
        onChange={v => { if (v === OTHER_BUSINESS_TYPE) { setOtherMode(true); onChange('') } else { setOtherMode(false); onChange(v) } }}
        options={[...options, OTHER_BUSINESS_TYPE]} />
      {showOther && <div style={{ marginTop: '-8px' }}><Field label="Qual?" value={value} onChange={onChange} placeholder="Digite o tipo do seu negócio" required /></div>}
    </>
  )
}

// Resumo estruturado + interpretação (composto localmente — sempre funciona,
// sem depender de API). Vira o Business Context que os agentes leem.
function buildContext(d: OnboardingData) {
  const chan = d.current_channels.join(', ') || 'ainda não definidos'
  const summary = [
    `Negócio: ${d.business_description || d.business_type || '—'}`,
    `Tipo: ${d.business_type || '—'}${d.city ? ` · ${d.city}` : ''}`,
    `Cliente ideal: ${d.ideal_customer || '—'}`,
    `Objetivo principal: ${d.goal || '—'}`,
    `Maior desafio: ${d.main_challenges || '—'}`,
    `Canais atuais: ${chan}`,
    `Estágio: ${d.business_stage || '—'}`,
  ].join('\n')
  const interpretation = `Este é um negócio do tipo "${d.business_type || 'não especificado'}"${d.city ? ` em ${d.city}` : ''}. ${d.business_description ? d.business_description.trim() + '. ' : ''}O cliente ideal é ${d.ideal_customer || 'não especificado'}. O objetivo principal agora é ${(d.goal || 'não especificado').toLowerCase()}, e o maior desafio é ${(d.main_challenges || 'não especificado').toLowerCase()}. Hoje traz clientes por ${chan.toLowerCase()}. Está na fase "${d.business_stage || 'não especificada'}".`
  return {
    business_description: d.business_description,
    ideal_customer: d.ideal_customer,
    business_stage: d.business_stage,
    primary_goals: d.goal,
    main_challenges: d.main_challenges,
    current_channels: chan,
    onboarding_summary: summary,
    agent_business_interpretation: interpretation,
  }
}

const STEPS = ['Seu negócio', 'Seu cliente', 'Objetivo', 'Canais', 'Finalizar']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    business_name: '', business_type: '', city: '', website_url: '', instagram_url: '', facebook_url: '',
    tiktok_url: '', google_maps_url: '', phone: '', contact_email: '', goal: '',
    business_description: '', ideal_customer: '', business_stage: '', main_challenges: '', current_channels: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0])
  const [error, setError] = useState('')
  const [businessTypes, setBusinessTypes] = useState<string[]>([])

  useEffect(() => { fetchBusinessTypes().then(setBusinessTypes) }, [])

  const set = (k: keyof OnboardingData) => (v: string) => setData(d => ({ ...d, [k]: v }))
  const toggleChannel = (v: string) => setData(d => ({ ...d, current_channels: d.current_channels.includes(v) ? d.current_channels.filter(x => x !== v) : [...d.current_channels, v] }))

  const isValidUrl = (url: string) => {
    const s = url.trim()
    if (!s) return false
    try { return new URL(s.startsWith('http') ? s : `https://${s}`).hostname.includes('.') } catch { return false }
  }

  const canNext = () => {
    if (step === 0) return !!(data.business_description.trim() && data.business_type)
    if (step === 1) return !!(data.ideal_customer.trim() && data.business_stage)
    if (step === 2) return !!data.goal
    if (step === 3) return isValidUrl(data.website_url)
    if (step === 4) return !!(data.business_name.trim() && data.city.trim() && data.contact_email.trim())
    return false
  }

  const handleSubmit = async () => {
    setSubmitting(true); setError('')
    let msgIdx = 0
    const interval = setInterval(() => { msgIdx = (msgIdx + 1) % LOADING_MSGS.length; setLoadingMsg(LOADING_MSGS[msgIdx]) }, 2500)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const onboarding_context = buildContext(data)
      const payload = {
        business_name: data.business_name, business_type: data.business_type, city: data.city,
        website_url: data.website_url, instagram_url: data.instagram_url, facebook_url: data.facebook_url,
        tiktok_url: data.tiktok_url, google_maps_url: data.google_maps_url, phone: data.phone,
        contact_email: data.contact_email, goal: data.goal, onboarding_context,
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/run-diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify(payload),
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
      <div style={{ padding: '20px 32px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: D, fontSize: '1.3rem', fontWeight: 900, color: 'white', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          <span style={{ color: ORANGE }}>Sales</span>Boost
        </a>
        <div style={{ fontSize: '13px', color: MUTED }}>Passo {step + 1} de {STEPS.length}</div>
      </div>

      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', background: ORANGE, width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.4s ease', borderRadius: '0 2px 2px 0' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '540px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: i < step ? ORANGE : i === step ? 'rgba(255,109,41,0.15)' : 'rgba(255,255,255,0.05)', border: i === step ? `1px solid ${ORANGE}` : i < step ? 'none' : `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: 900, color: i < step ? '#000' : i === step ? ORANGE : MUTED, flexShrink: 0 }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '11.5px', color: i === step ? 'white' : MUTED, fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
            ))}
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '32px' }}>
            {step === 0 && (
              <>
                <H t="Vamos começar pelo seu negócio" s="Conte com suas palavras — assim o SalesBoost entende quem você é antes de qualquer coisa." />
                <TextArea label="O que seu negócio faz?" value={data.business_description} onChange={set('business_description')} placeholder="Ex: Sou um estúdio de beleza que faz cabelo, unha e maquiagem para eventos..." hint="Pode escrever livre. Quanto mais claro, melhores as recomendações." />
                <BusinessTypeSelect value={data.business_type} onChange={set('business_type')} options={businessTypes} />
              </>
            )}
            {step === 1 && (
              <>
                <H t="Quem é seu cliente ideal?" s="Pra quem você mais quer vender? Não precisa de termos técnicos." />
                <TextArea label="Descreva seu cliente ideal" value={data.ideal_customer} onChange={set('ideal_customer')} placeholder="Ex: Mulheres de 25 a 45 anos, no Rio, que valorizam autocuidado..." />
                <SelectField label="Em que fase está seu negócio hoje?" value={data.business_stage} onChange={set('business_stage')} options={STAGES} required />
              </>
            )}
            {step === 2 && (
              <>
                <H t="O que você mais quer alcançar agora?" s="Isso guia tudo que os agentes vão priorizar pra você." />
                <SelectField label="Maior objetivo agora" value={data.goal} onChange={set('goal')} options={GOALS} required />
                <SelectField label="O que mais te trava hoje?" value={data.main_challenges} onChange={set('main_challenges')} options={CHALLENGES} />
              </>
            )}
            {step === 3 && (
              <>
                <H t="Como você traz clientes hoje?" s="Marque os canais que usa. O site é usado pro seu diagnóstico gratuito." />
                <MultiSelect label="Canais atuais" values={data.current_channels} options={CHANNELS} onToggle={toggleChannel} />
                <Field label="Site" value={data.website_url} onChange={set('website_url')} type="url" placeholder="https://seunegocio.com.br" required hint={data.website_url.trim() && !isValidUrl(data.website_url) ? '⚠️ URL inválida — use: https://seunegocio.com.br' : 'Analisamos performance, SEO e experiência do site (diagnóstico grátis).'} />
                <Field label="Instagram (opcional)" value={data.instagram_url} onChange={set('instagram_url')} placeholder="https://instagram.com/seuperfil" />
              </>
            )}
            {step === 4 && (
              <>
                <H t="É isso que entendemos?" s="Confira o resumo. Depois é só um último passo pra criar seu painel." />
                <div style={{ background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.18)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', fontSize: '12.5px', color: 'white', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {buildContext(data).onboarding_summary}
                </div>
                <Field label="Nome do negócio" value={data.business_name} onChange={set('business_name')} placeholder="Ex: Studio Beleza Carioca" required />
                <Field label="Cidade / UF" value={data.city} onChange={set('city')} placeholder="Ex: Rio de Janeiro, RJ" required />
                <Field label="Seu e-mail" value={data.contact_email} onChange={set('contact_email')} type="email" placeholder="voce@seunegocio.com.br" required hint="Usado pra acessar seu painel e receber alertas." />
                {error && <div style={{ padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', fontSize: '13px', color: '#f87171', marginBottom: '16px', lineHeight: 1.5 }}>{error}</div>}
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  style={{ flex: '0 0 auto', padding: '12px 20px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '14px', borderRadius: '12px', border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'inherit' }}>← Voltar</button>
              )}
              <button onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : handleSubmit} disabled={!canNext()}
                style={{ flex: 1, padding: '13px 24px', background: canNext() ? ORANGE : 'rgba(255,109,41,0.2)', color: canNext() ? '#000' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: '15px', borderRadius: '12px', border: 'none', cursor: canNext() ? 'pointer' : 'not-allowed', fontFamily: D, letterSpacing: '-0.01em', transition: 'all 0.2s', boxShadow: canNext() ? '0 8px 20px rgba(255,109,41,0.3)' : 'none' }}>
                {step < STEPS.length - 1 ? 'Continuar →' : 'Criar meu painel →'}
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: MUTED, marginTop: '20px', lineHeight: 1.6 }}>
            Ao continuar, você concorda com nossa <span style={{ color: ORANGE, cursor: 'pointer' }}>política de privacidade</span>. Seus dados são usados só pra entender seu negócio e gerar o diagnóstico.
          </p>
        </div>
      </div>
    </div>
  )
}

function H({ t, s }: { t: string; s: string }) {
  return (
    <>
      <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>{t}</h1>
      <p style={{ color: MUTED, fontSize: '14px', marginBottom: '26px', lineHeight: 1.6 }}>{s}</p>
    </>
  )
}
