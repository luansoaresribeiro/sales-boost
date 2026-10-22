import { useLang } from '../../../contexts/LanguageContext'

// Rótulo único da peça (PLANO-CRIATIVOS, fase 3): Família · Pilar de Social
// Selling · Tema. Peça/vaga sem rótulo (estratégia antiga, ou colunas ainda
// não criadas no banco) não mostra nada.
const FAMILIA: Record<string, { pt: string; en: string; color: string }> = {
  tour: { pt: 'Tour', en: 'Tour', color: '#60a5fa' },
  oferta: { pt: 'Oferta', en: 'Offer', color: '#FF6D29' },
  educativo: { pt: 'Educativo', en: 'Educational', color: '#A78BFA' },
  bairro: { pt: 'Bairro', en: 'Neighborhood', color: '#4ade80' },
  eventual: { pt: 'Eventual', en: 'One-off', color: '#BABABA' },
}
const humanize = (s: string) => { const t = s.replace(/_/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1) }

export function PieceChips({ familia, pilarSs, tema, ssNames }: { familia?: string | null; pilarSs?: string | null; tema?: string | null; ssNames: Record<string, string> }) {
  const { lang } = useLang()
  const fam = familia ? FAMILIA[familia] : undefined
  const ss = pilarSs ? (ssNames[pilarSs] ?? humanize(pilarSs)) : null
  const th = tema && tema !== 'qualquer' ? humanize(tema) : null
  if (!fam && !ss && !th) return null
  const chip = (color: string, text: string, key: string, title: string) => (
    <span key={key} title={title} style={{ fontSize: '8.5px', fontWeight: 700, color, border: `1px solid ${color}55`, background: `${color}14`, borderRadius: '99px', padding: '1px 6px', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
  )
  const T = lang === 'en' ? { f: 'Family: what it is', s: 'Social Selling pillar: what it is for', t: 'Theme: what it is about' } : { f: 'Família: o que é', s: 'Pilar de Social Selling: pra que serve', t: 'Tema: sobre o quê' }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {fam && chip(fam.color, fam[lang], 'f', T.f)}
      {ss && chip('#FBBF24', ss, 's', T.s)}
      {th && chip('#BABABA', th, 't', T.t)}
    </div>
  )
}
