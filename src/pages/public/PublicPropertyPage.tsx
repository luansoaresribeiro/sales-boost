// Página pública do imóvel (Etapa 5) — rota /p/:code, sem login. É SÓ destino de link: sem listagem, sem busca, noindex.
// Só existe se o dono aprovou ("Aprovar e publicar" no card do imóvel). Tudo vem do servidor (marketing-ai → public_page_*):
// campos da lista branca da ficha, fotos reais, botões de contato e o texto de consentimento. Qualquer problema (link
// errado, página desligada, plano vencido) mostra a MESMA tela de "não encontrada". Idioma = idioma da empresa.
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'

const BG = '#0E0B0A'
const CARD = '#150E08'
const ORANGE = '#FF6D29'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.1)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

interface PageData {
  lang: 'pt' | 'en'; title: string; company: { name: string; logo_url: string | null }
  fields: { key: string; label: string; value: string }[]; photos: string[]
  buttons: { whatsapp: boolean; dm: boolean }; consent_text: string
}

const TX = {
  pt: {
    loading: 'Carregando…', notFoundTitle: 'Página não encontrada', notFoundBody: 'Este link não está mais disponível. Fale com quem te enviou o link.',
    photo: (i: number, n: number) => `Foto ${i} de ${n}`, details: 'Detalhes', talk: 'Fale com a gente', whatsapp: 'Chamar no WhatsApp', dm: 'Mandar mensagem no Instagram',
    or: 'ou deixe seu contato e responderemos', name: 'Seu nome', contact: 'Seu WhatsApp ou e-mail', message: 'Mensagem (opcional)', send: 'Enviar', sending: 'Enviando…',
    sentTitle: 'Recebemos seu contato', sentBody: 'Quem cuida deste imóvel vai responder por aqui o quanto antes.',
    privacy: 'Política de Privacidade', whyData: 'Usamos seus dados só para responder sobre este imóvel.',
    errName: 'Escreva seu nome (de 2 a 80 letras).', errContact: 'Informe um WhatsApp com DDD ou um e-mail válido.', errMessage: 'A mensagem passa de 500 caracteres.', errConsent: 'Marque a autorização para enviar.',
    errLimit: 'Muitas tentativas. Tente de novo mais tarde.', errGeneric: 'Não deu certo agora. Tente de novo em alguns minutos.',
  },
  en: {
    loading: 'Loading…', notFoundTitle: 'Page not found', notFoundBody: 'This link is no longer available. Please contact whoever sent it to you.',
    photo: (i: number, n: number) => `Photo ${i} of ${n}`, details: 'Details', talk: 'Talk to us', whatsapp: 'Chat on WhatsApp', dm: 'Message us on Instagram',
    or: 'or leave your contact and we will reply', name: 'Your name', contact: 'Your WhatsApp or email', message: 'Message (optional)', send: 'Send', sending: 'Sending…',
    sentTitle: 'We got your contact', sentBody: 'Whoever looks after this property will reply as soon as possible.',
    privacy: 'Privacy Policy', whyData: 'We use your data only to reply about this property.',
    errName: 'Enter your name (2 to 80 characters).', errContact: 'Enter a WhatsApp number with area code or a valid email.', errMessage: 'The message is over 500 characters.', errConsent: 'Tick the permission to send.',
    errLimit: 'Too many attempts. Please try again later.', errGeneric: "That didn't work right now. Please try again in a few minutes.",
  },
} as const

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function call(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/marketing-ai`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

const field = { width: '100%', boxSizing: 'border-box', padding: '12px 13px', background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '16px', fontFamily: D } as const

export default function PublicPropertyPage() {
  const { code = '' } = useParams()
  const fallbackLang = useLang().lang
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const [data, setData] = useState<PageData | null>(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot: pessoa não vê nem preenche
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const lang = data?.lang ?? fallbackLang
  const tx = TX[lang]

  // noindex: a página é só destino de link (o cabeçalho X-Robots-Tag em public/_headers cobre quem não roda JavaScript).
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [])
  useEffect(() => { if (data?.title) document.title = `${data.title} — ${data.company.name}` }, [data])

  const load = useCallback(async () => {
    setState('loading')
    try {
      const { status, data: d } = await call({ action: 'public_page_get', code })
      if (status === 200 && d.ok) { setData(d as unknown as PageData); setState('ok') } else setState('notfound')
    } catch { setState('notfound') }
  }, [code])
  useEffect(() => { void load() }, [load])

  const open = async (event: 'click_whatsapp' | 'click_dm') => {
    setErr('')
    try {
      const { status, data: d } = await call({ action: 'public_page_event', code, event })
      if (status === 200 && typeof d.url === 'string' && /^https:\/\/(wa\.me|ig\.me)\//.test(d.url)) window.location.href = d.url
      else setErr(tx.errGeneric)
    } catch { setErr(tx.errGeneric) }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!consent) { setErr(tx.errConsent); return }
    setBusy(true); setErr('')
    try {
      const { status, data: d } = await call({ action: 'public_page_lead', code, name, contact, message, consent: true, website })
      if (status === 200 && d.ok) setSent(true)
      else if (status === 400 && d.field === 'name') setErr(tx.errName)
      else if (status === 400 && d.field === 'contact') setErr(tx.errContact)
      else if (status === 400 && d.field === 'message') setErr(tx.errMessage)
      else if (status === 400 && d.field === 'consent') setErr(tx.errConsent)
      else if (status === 429) setErr(tx.errLimit)
      else setErr(tx.errGeneric)
    } catch { setErr(tx.errGeneric) }
    setBusy(false)
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: BG, color: 'white', fontFamily: D, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{children}</div>
  )

  if (state === 'loading') return shell(<div style={{ padding: '80px 20px', color: MUTED, fontSize: '14px' }}>{tx.loading}</div>)
  if (state === 'notfound' || !data) {
    return shell(
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px' }}>{tx.notFoundTitle}</div>
        <p style={{ color: MUTED, fontSize: '14.5px', lineHeight: 1.6 }}>{tx.notFoundBody}</p>
      </div>,
    )
  }

  const n = data.photos.length
  const goTo = (i: number) => setPhotoIdx(Math.min(Math.max(i, 0), n - 1))
  const nav = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '18px', cursor: 'pointer' } as const

  return shell(
    <div style={{ width: '100%', maxWidth: '480px', paddingBottom: '40px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px' }}>
        {data.company.logo_url && <img src={data.company.logo_url} alt="" style={{ height: '32px', maxWidth: '110px', objectFit: 'contain' }} />}
        <span style={{ fontSize: '14px', fontWeight: 700, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.company.name}</span>
      </header>

      <div style={{ position: 'relative', background: '#000' }}>
        <img src={data.photos[photoIdx]} alt={tx.photo(photoIdx + 1, n)} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', display: 'block' }} />
        {n > 1 && <>
          <button type="button" aria-label="‹" onClick={() => goTo(photoIdx - 1)} disabled={photoIdx === 0} style={{ ...nav, left: '8px', opacity: photoIdx === 0 ? 0.3 : 1 }}>‹</button>
          <button type="button" aria-label="›" onClick={() => goTo(photoIdx + 1)} disabled={photoIdx === n - 1} style={{ ...nav, right: '8px', opacity: photoIdx === n - 1 ? 0.3 : 1 }}>›</button>
          <span style={{ position: 'absolute', bottom: '8px', right: '10px', background: 'rgba(0,0,0,0.6)', borderRadius: '10px', padding: '3px 9px', fontSize: '12px' }}>{photoIdx + 1}/{n}</span>
        </>}
      </div>
      {n > 1 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '8px 16px' }}>
          {data.photos.map((u, i) => (
            <button key={u} type="button" onClick={() => goTo(i)} aria-label={tx.photo(i + 1, n)} style={{ flex: '0 0 auto', width: '56px', padding: 0, border: `2px solid ${i === photoIdx ? ORANGE : 'transparent'}`, borderRadius: '8px', overflow: 'hidden', background: 'none', cursor: 'pointer' }}>
              <img src={u} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      <main style={{ padding: '8px 16px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25, margin: '8px 0 14px' }}>{data.title}</h1>

        {data.fields.length > 0 && (
          <section aria-label={tx.details} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '4px 14px', marginBottom: '18px' }}>
            <dl style={{ margin: 0 }}>
              {data.fields.map((f, i) => (
                <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '11px 0', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
                  <dt style={{ color: MUTED, fontSize: '14px', flex: '0 0 auto' }}>{f.label}</dt>
                  <dd style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 10px' }}>{tx.talk}</h2>
        {(data.buttons.whatsapp || data.buttons.dm) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {data.buttons.whatsapp && <button type="button" onClick={() => open('click_whatsapp')} style={{ padding: '14px', background: '#25D366', color: '#000', fontWeight: 800, fontSize: '15px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: D }}>{tx.whatsapp}</button>}
            {data.buttons.dm && <button type="button" onClick={() => open('click_dm')} style={{ padding: '14px', background: 'transparent', color: 'white', fontWeight: 800, fontSize: '15px', border: `1px solid ${ORANGE}`, borderRadius: '12px', cursor: 'pointer', fontFamily: D }}>{tx.dm}</button>}
            <p style={{ textAlign: 'center', color: MUTED, fontSize: '13px', margin: '6px 0 0' }}>{tx.or}</p>
          </div>
        )}

        {sent ? (
          <div role="status" style={{ background: CARD, border: '1px solid rgba(74,222,128,0.4)', borderRadius: '14px', padding: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#4ade80', marginBottom: '6px' }}>✓ {tx.sentTitle}</div>
            <p style={{ color: MUTED, fontSize: '14px', lineHeight: 1.55, margin: 0 }}>{tx.sentBody}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={tx.name} aria-label={tx.name} autoComplete="name" maxLength={80} required style={field} />
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder={tx.contact} aria-label={tx.contact} autoComplete="email tel" maxLength={120} required style={field} />
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={tx.message} aria-label={tx.message} maxLength={500} rows={3} style={{ ...field, resize: 'vertical' }} />
            {/* Armadilha para robô: fora da tela, sem foco, sem leitor de tela. Pessoa nunca preenche. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} name="website" /></label>
            </div>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: '20px', height: '20px', marginTop: '1px', flex: '0 0 auto', accentColor: ORANGE }} />
              <span>{data.consent_text} {tx.whyData}{' '}<Link to="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>{tx.privacy}</Link></span>
            </label>
            {err && <p role="alert" style={{ color: '#f87171', fontSize: '13.5px', margin: 0 }}>{err}</p>}
            <button type="submit" disabled={busy || !consent} style={{ padding: '14px', background: consent ? ORANGE : 'rgba(255,255,255,0.1)', color: consent ? '#000' : MUTED, fontWeight: 800, fontSize: '15px', border: 'none', borderRadius: '12px', cursor: busy ? 'wait' : consent ? 'pointer' : 'not-allowed', fontFamily: D }}>{busy ? tx.sending : tx.send}</button>
          </form>
        )}
      </main>
    </div>,
  )
}
