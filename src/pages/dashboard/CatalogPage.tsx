import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { MUTED, BORDER, D } from './marketingAi/shared'
import FeedbackWidget from './marketingAi/FeedbackWidget'
import CatalogItems from './marketingAi/CatalogItems'
import ProductPhotos from './marketingAi/ProductPhotos'
import { AvatarSoon } from './BusinessContextButton'
import { fetchCatalogSchema, type CatalogSchema } from '../../lib/verticalPlaybook'

const ORANGE = '#FF6D29'

// Catálogo (os imóveis/itens com fotos reais) — página própria desde 2026-11-01 (pedido do dono): saiu de
// dentro da Inteligência de Mercado, que ficou só com inteligência de mercado. Acesso pelo menu do botão "+"
// laranja (BusinessContextButton → "Adicionar <item>" abre com ?add=1 e o formulário de criação já aberto) e pelos
// atalhos do sino/pendências (?item=<id> destaca o item).
const TX = {
  pt: { back: '← Voltar', products: 'Produtos', loading: 'Carregando...', avatar: 'Meu avatar (em breve)', sub: 'Suba as fotos reais de cada item. São elas que viram carrosséis e vídeos — nunca imagem inventada.' },
  en: { back: '← Back', products: 'Products', loading: 'Loading...', avatar: 'My avatar (coming soon)', sub: 'Upload real photos of each item. They become carousels and videos — never made-up images.' },
} as const

export default function CatalogPage() {
  const t = TX[useLang().lang]
  const { company } = useCompany()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const verticalKey = company?.vertical_key ?? 'generico'
  const [schema, setSchema] = useState<CatalogSchema | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    fetchCatalogSchema(verticalKey).then(s => { if (alive) setSchema(s) })
    return () => { alive = false }
  }, [verticalKey])

  if (!company) return <div style={{ padding: '48px', color: MUTED, fontSize: '14px' }}>{t.loading}</div>
  const title = schema?.catalogLabel ?? t.products
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 32px', borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/dashboard'))}
          style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: D }}
          onMouseEnter={e => { e.currentTarget.style.color = ORANGE; e.currentTarget.style.borderColor = 'rgba(255,109,41,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER }}>
          {t.back}
        </button>
        <span style={{ fontFamily: D, fontSize: '14px', fontWeight: 700, color: 'white' }}>📸 {title}</span>
      </div>
      <div style={{ padding: '28px 32px' }}>
        {schema === undefined ? null : schema ? (
          <>
            <div style={{ fontSize: '12px', color: MUTED, marginBottom: '14px', maxWidth: '760px', lineHeight: 1.55 }}>{t.sub}</div>
            <CatalogItems companyId={company.id} schema={schema} verticalKey={verticalKey} focusItemId={params.get('item')}
              openCreate={params.get('add') === '1'}
              onCreateOpened={() => setParams(p => { const n = new URLSearchParams(p); n.delete('add'); return n }, { replace: true })} />
            {/* Avatar mora dentro dos itens (pedido do dono 2026-10-14). */}
            <div style={{ marginTop: '22px', maxWidth: '760px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{t.avatar}</div>
              <AvatarSoon companyId={company.id} verticalKey={verticalKey} />
            </div>
          </>
        ) : <ProductPhotos companyId={company.id} />}
      </div>
      <FeedbackWidget companyId={company.id} section="catalogo" />
    </div>
  )
}
