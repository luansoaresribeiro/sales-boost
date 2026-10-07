import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER } from './shared'

const ORANGE = '#FF6D29'

const TX = {
  pt: { title: '🏷️ Marca', logo: 'Logo', noLogo: 'Sem logo — adicione no DNA da marca.', palette: 'Paleta de cores', notSetF: 'Não definida ainda.', icp: 'ICP (cliente ideal)', notSet: 'Não definido ainda.' },
  en: { title: '🏷️ Brand', logo: 'Logo', noLogo: 'No logo — add it in the brand DNA.', palette: 'Color palette', notSetF: 'Not set yet.', icp: 'ICP (ideal customer)', notSet: 'Not set yet.' },
} as const

// Card de Marca no topo da Biblioteca: ICP, paleta de cores e logo — a base
// visual/estratégica que orienta toda criação. Lê brand_dna (cores, logo) e
// marketing_ai_config (público-alvo/ICP).
export default function BrandCard({ companyId }: { companyId: string }) {
  const { lang } = useLang()
  const X = TX[lang]
  const [colors, setColors] = useState<string[]>([])
  const [logo, setLogo] = useState<string | null>(null)
  const [icp, setIcp] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const [{ data: dna }, { data: cfg }] = await Promise.all([
        supabase.from('brand_dna').select('colors, logo_url').eq('company_id', companyId).maybeSingle(),
        supabase.from('marketing_ai_config').select('target_audience, brand_colors').eq('company_id', companyId).maybeSingle(),
      ])
      const d = dna as { colors?: string[]; logo_url?: string | null } | null
      const c = cfg as { target_audience?: string | null; brand_colors?: string[] | null } | null
      setColors((d?.colors?.length ? d.colors : c?.brand_colors) ?? [])
      setLogo(d?.logo_url ?? null)
      setIcp(c?.target_audience ?? null)
    })()
  }, [companyId])

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: '11px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div style={{ width: '260px', flexShrink: 0, background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>{X.title}</div>

      <Row label={X.logo}>
        {logo
          ? <img src={logo} alt={X.logo} style={{ maxHeight: '46px', maxWidth: '100%', objectFit: 'contain', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '4px' }} />
          : <div style={{ fontSize: '10.5px', color: MUTED }}>{X.noLogo}</div>}
      </Row>

      <Row label={X.palette}>
        {colors.length > 0
          ? <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {colors.slice(0, 8).map((col, i) => (
                <div key={i} title={col} style={{ width: '22px', height: '22px', borderRadius: '5px', background: col, border: '1px solid rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          : <div style={{ fontSize: '10.5px', color: MUTED }}>{X.notSetF}</div>}
      </Row>

      <Row label={X.icp}>
        <div style={{ fontSize: '10.5px', color: icp ? 'white' : MUTED, lineHeight: 1.5, maxHeight: '96px', overflow: 'auto' }}>
          {icp || X.notSet}
        </div>
      </Row>
    </div>
  )
}
