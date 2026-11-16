import { useLocation } from 'react-router-dom'
import { useLang } from '../contexts/LanguageContext'

// Troca PT | EN nas páginas que não têm a própria (pedido do dono, 16/11: "em tudo tem a opção de tradução").
// A página inicial (Navbar) e o painel (menu lateral) já têm a troca; o Owner é área interna.
// A escolha vale para o site inteiro (LanguageContext grava em 'sb_lang').
const HAS_OWN_SWITCH = [/^\/$/, /^\/dashboard(\/|$)/, /^\/owner(\/|$)/, /^\/auth\//]

function showsFloatingLangSwitch(pathname: string): boolean {
  return !HAS_OWN_SWITCH.some(r => r.test(pathname))
}

export default function FloatingLangSwitch() {
  const { pathname } = useLocation()
  const { lang, setLang } = useLang()
  if (!showsFloatingLangSwitch(pathname)) return null
  return (
    <div role="group" aria-label={lang === 'pt' ? 'Idioma' : 'Language'}
      style={{ position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', right: 12, zIndex: 900, display: 'flex', gap: 2, padding: 3, borderRadius: 8, background: 'rgba(20,14,8,0.85)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)' }}>
      {(['pt', 'en'] as const).map(l => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          style={{ minWidth: 36, minHeight: 32, padding: '4px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: lang === l ? '#FF6D29' : 'transparent', color: lang === l ? '#000' : 'rgba(255,255,255,0.7)' }}>
          {l}
        </button>
      ))}
    </div>
  )
}
