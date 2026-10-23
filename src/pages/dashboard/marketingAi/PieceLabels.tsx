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
// A ficha guarda os pilares de conteúdo só como chave (config.pillars = chave → peso; sem nome de tela),
// então o nome bonito vem deste mapa genérico (sem setor); chave fora dele cai no humanize.
const TEMA: Record<string, { pt: string; en: string }> = {
  imovel: { pt: 'Imóvel', en: 'Property' }, local: { pt: 'Local', en: 'Local area' }, mercado: { pt: 'Mercado', en: 'Market' },
  educacao: { pt: 'Educação', en: 'Education' }, marca_pessoal: { pt: 'Marca pessoal', en: 'Personal brand' },
  prova_social: { pt: 'Prova social', en: 'Social proof' }, produto: { pt: 'Produto', en: 'Product' }, bastidores: { pt: 'Bastidores', en: 'Behind the scenes' },
}
const temaLabel = (tema: string, lang: 'pt' | 'en'): string => TEMA[tema.trim().toLowerCase()]?.[lang] ?? humanize(tema)

export function PieceChips({ familia, pilarSs, tema, ssNames }: { familia?: string | null; pilarSs?: string | null; tema?: string | null; ssNames: Record<string, string> }) {
  const { lang } = useLang()
  const fam = familia ? FAMILIA[familia] : undefined
  const ss = pilarSs ? (ssNames[pilarSs] ?? humanize(pilarSs)) : null
  // Tema sozinho não aparece: peça antiga tem `pillar` preenchido sem ter rótulo (só vale junto de família/pilar).
  const th = tema && tema !== 'qualquer' && (fam || ss) ? temaLabel(tema, lang) : null
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
