import { Link } from 'react-router-dom'
import { LEGAL_COMPANY, type LegalDoc } from './legalContent'
import { LEGAL_UPDATED_EN } from './legalContent.en'
import { useLang } from '../../contexts/LanguageContext'

const D = "'Bricolage Grotesque', system-ui, sans-serif"
const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'

// Layout compartilhado das páginas legais — consistente com o tema escuro do
// site, sem tocar em nenhum componente existente. `other` é o link pro outro
// documento (privacidade ↔ termos).
export default function LegalPage({ doc, other }: { doc: LegalDoc; other: { label: string; to: string } }) {
  const en = useLang().lang === 'en'
  return (
    <div style={{ minHeight: '100vh', background: BG, color: 'white' }}>
      {/* Cabeçalho */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: 'rgba(14,11,10,0.85)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
        <div style={{ maxWidth: '820px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#000', fontWeight: 900, fontSize: '12px' }}>SB</span>
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em' }}>SalesBoost</span>
          </Link>
          <Link to="/" style={{ fontSize: '13px', color: MUTED, textDecoration: 'none', fontWeight: 600 }}>{en ? '← Back to site' : '← Voltar ao site'}</Link>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: D, fontSize: 'clamp(1.7rem, 5vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '10px' }}>{doc.title}</h1>
        <p style={{ color: MUTED, fontSize: '15px', lineHeight: 1.6, marginBottom: '8px', maxWidth: '640px' }}>{doc.subtitle}</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '36px' }}>{en ? `Last updated: ${LEGAL_UPDATED_EN}` : `Última atualização: ${LEGAL_COMPANY.updated}`}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {doc.sections.map((s, i) => (
            <section key={i}>
              <h2 style={{ fontFamily: D, fontSize: '1.15rem', fontWeight: 800, color: 'white', marginBottom: '10px', letterSpacing: '-0.01em' }}>{s.heading}</h2>
              {s.paragraphs?.map((p, j) => (
                <p key={j} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14.5px', lineHeight: 1.7, marginBottom: '10px' }}>{p}</p>
              ))}
              {s.bullets && (
                <ul style={{ margin: '4px 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {s.bullets.map((b, j) => (
                    <li key={j} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14.5px', lineHeight: 1.6 }}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Rodapé do documento */}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.35)' }}>© {new Date().getFullYear()} {LEGAL_COMPANY.brand}. {en ? 'All rights reserved.' : 'Todos os direitos reservados.'}</span>
          <Link to={other.to} style={{ fontSize: '13.5px', color: ORANGE, textDecoration: 'none', fontWeight: 700, background: 'rgba(255,109,41,0.08)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '9px', padding: '8px 15px' }}>
            {other.label} →
          </Link>
        </div>
      </div>
    </div>
  )
}
