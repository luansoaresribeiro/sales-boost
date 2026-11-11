import logo from '../assets/logo.png'

// Carregamento com a marca (dono, 2026-11-10: "a logo deve aparecer em momentos de carregar"). Um componente só pra
// tela cheia (entrar no site, trocar de conta) e pra área de conteúdo (trocar de página dentro do painel).
// Leve de propósito: só CSS, sem biblioteca de animação. Movimento reduzido → logo parado.
const CSS = `
@keyframes sbLogoPulse{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1)}}
@keyframes sbLoadBar{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
.sb-loader-logo{animation:sbLogoPulse 1.4s ease-in-out infinite}
.sb-loader-bar{animation:sbLoadBar 1.1s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sb-loader-logo,.sb-loader-bar{animation:none}}
`

export default function BrandLoader({ fullScreen = false, label }: { fullScreen?: boolean; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label ?? 'Carregando'}
      style={{ minHeight: fullScreen ? '100vh' : '320px', height: fullScreen ? undefined : '100%', background: fullScreen ? '#0E0B0A' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
      <style>{CSS}</style>
      <img src={logo} alt="Sales Boost" className="sb-loader-logo" width={56} height={56} style={{ width: 56, height: 56, objectFit: 'contain' }} />
      <div style={{ width: 72, height: 3, borderRadius: 99, background: 'rgba(255,109,41,0.18)', overflow: 'hidden' }}>
        <div className="sb-loader-bar" style={{ width: '40%', height: '100%', borderRadius: 99, background: '#FF6D29' }} />
      </div>
      {label && <div style={{ color: '#BABABA', fontSize: '12.5px', fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>{label}</div>}
    </div>
  )
}
