import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const STORAGE_KEY = 'sb_cookie_consent' // 'all' | 'essential'

// Banner de consentimento de cookies (LGPD). Aparece na primeira visita e
// guarda a preferência no navegador. Não altera nenhuma tela existente — é
// montado por cima, fixo no rodapé, e some depois da escolha.
const TX = {
  pt: { title: '🍪 Nós usamos cookies', body: 'Usamos cookies essenciais para o funcionamento do site e, com sua autorização, cookies de análise para melhorar sua experiência. Saiba mais na', policy: 'Política de Privacidade', essential: 'Só essenciais', all: 'Aceitar todos' },
  en: { title: '🍪 We use cookies', body: 'We use essential cookies for the site to work and, with your permission, analytics cookies to improve your experience. Learn more in our', policy: 'Privacy Policy', essential: 'Essential only', all: 'Accept all' },
}

export default function CookieConsent() {
  const { lang } = useLang()
  const t = TX[lang]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch { /* localStorage indisponível — não mostra */ }
  }, [])

  const choose = (value: 'all' | 'essential') => {
    try { localStorage.setItem(STORAGE_KEY, value) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', padding: '16px', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: '760px', background: CARD, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', fontFamily: D }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{t.title}</div>
          <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.55 }}>
            {t.body}{' '}
            <Link to="/privacidade" style={{ color: ORANGE, textDecoration: 'none', fontWeight: 600 }}>{t.policy}</Link>.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '9px', flexShrink: 0 }}>
          <button onClick={() => choose('essential')}
            style={{ padding: '9px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', color: MUTED, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
            {t.essential}
          </button>
          <button onClick={() => choose('all')}
            style={{ padding: '9px 18px', background: ORANGE, border: 'none', borderRadius: '10px', color: '#000', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', fontFamily: D }}>
            {t.all}
          </button>
        </div>
      </div>
    </div>
  )
}
