import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { useCompany, type CompanyData } from '../../../contexts/CompanyContext'
import { CARD, MUTED, BORDER, D, timeAgo } from './shared'
import { ImageModal } from './TestingArea'
import BrandKit from './BrandKit'
import ProductPhotos from './ProductPhotos'
import CatalogItems from './CatalogItems'
import { fetchCatalogSchema, type CatalogSchema } from '../../../lib/verticalPlaybook'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: { companyLang: '🗣️ Língua da empresa (usada em todo conteúdo gerado):',
    b1: '🎨 ', b2: 'Estilos e Visuais — a identidade visual da marca.', b3: ' ', b4: 'Kit', b5: ' = logo, cores, tipografia e voz · ', b6: 'Arquivo', b7: ' = tudo que você publica no Instagram (fotos, carrosséis ', b8: 'e vídeos/Reels', b9: ') + as fotos de produto que você subir. A geração filtra e monta as peças a partir daqui.',
    kit: '🎨 Kit da Marca', archive: '🗂️ Arquivo', published: '📷 Publicados', products: '📦 Produtos', loading: 'Carregando...',
    e1: 'Arquivo vazio. Ele enche automaticamente com seus posts e ', e2: 'vídeos/Reels', e3: ' quando o ', e4: 'Instagram', e5: ' estiver conectado e a aba ', e6: 'Performance', e7: ' sincronizar (é ela que importa as mídias).' },
  en: { companyLang: '🗣️ Company language (used in all generated content):',
    b1: '🎨 ', b2: 'Styles and Visuals — the brand visual identity.', b3: ' ', b4: 'Kit', b5: ' = logo, colors, typography and voice · ', b6: 'Archive', b7: ' = everything you publish on Instagram (photos, carousels ', b8: 'and videos/Reels', b9: ') + the product photos you upload. Generation filters and builds pieces from here.',
    kit: '🎨 Brand Kit', archive: '🗂️ Archive', published: '📷 Published', products: '📦 Products', loading: 'Loading...',
    e1: 'Archive is empty. It fills up automatically with your posts and ', e2: 'videos/Reels', e3: ' when ', e4: 'Instagram', e5: ' is connected and the ', e6: 'Performance', e7: ' tab syncs (it is the one that imports the media).' },
} as const

interface ArchivePost { id: string; caption: string | null; image_url: string | null; posted_at: string | null; likes_count: number | null; comments_count: number | null; media_type: string | null }

const VIDEO_TYPES = new Set(['reel', 'video', 'story', 'VIDEO', 'REELS'])
const LANGUAGES: { key: string; label: string }[] = [{ key: 'pt', label: '🇧🇷 Português' }, { key: 'en', label: '🇺🇸 English' }]

// Língua em que a empresa fala com o cliente — usada por todo conteúdo
// gerado (legenda, hooks, CTA). Fica junto de Estilos e Visuais porque é
// outro traço da identidade da marca, igual voz/tom no Kit da Marca.
function LanguageSelector({ company }: { company: CompanyData }) {
  const { refreshCompany } = useCompany()
  const tx = TX[useLang().lang]
  const [saving, setSaving] = useState(false)
  const current = company.language ?? 'pt'

  const setLanguage = async (lang: string) => {
    if (lang === current || saving) return
    setSaving(true)
    await supabase.from('companies').update({ language: lang }).eq('id', company.id)
    await refreshCompany()
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
      <span style={{ fontSize: '11px', color: MUTED }}>{tx.companyLang}</span>
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
        {LANGUAGES.map(l => (
          <button key={l.key} onClick={() => setLanguage(l.key)} disabled={saving}
            style={{ padding: '6px 12px', background: current === l.key ? 'rgba(167,139,250,0.15)' : 'transparent', border: `1px solid ${current === l.key ? 'rgba(167,139,250,0.4)' : 'transparent'}`, borderRadius: '6px', color: current === l.key ? '#A78BFA' : 'white', fontSize: '11.5px', fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: D }}>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Estilos e Visuais — hub da identidade visual. Kit personaliza por cliente;
// Arquivo mostra TODAS as mídias publicadas no Instagram (fotos, carrosséis E
// vídeos/Reels — via `instagram_content_performance`, que a função de
// Performance importa) + o que a própria plataforma publicou + fotos de produto.
export default function VisualLibrary({ company }: { company: CompanyData }) {
  const companyId = company.id
  const { lang } = useLang(); const tx = TX[lang]
  const [tab, setTab] = useState<'kit' | 'archive'>('kit')
  const [archiveTab, setArchiveTab] = useState<'publicados' | 'produtos' | 'catalogo'>('publicados')
  const [archive, setArchive] = useState<ArchivePost[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<string | null>(null)
  const [catalogSchema, setCatalogSchema] = useState<CatalogSchema | null>(null)

  // Catálogo só existe pra quem tem ficha de setor com catalog_fields
  // definido (ex: imoveis_rio). Sem ficha ou ficha vazia → aba nem aparece,
  // continua só "Produtos" como sempre foi.
  useEffect(() => {
    let alive = true
    fetchCatalogSchema(company.vertical_key ?? 'generico').then(s => { if (alive) setCatalogSchema(s) })
    return () => { alive = false }
  }, [company.vertical_key])

  const load = useCallback(async () => {
    // Fonte 1: mídia REAL do Instagram (inclui vídeos/Reels, com thumbnail).
    // Fonte 2: o que a plataforma publicou (imagens). Junta e tira duplicadas.
    const [{ data: perf }, { data: ig }] = await Promise.all([
      supabase.from('instagram_content_performance')
        .select('media_id, media_type, caption, thumbnail_url, permalink, posted_at, likes, comments')
        .eq('company_id', companyId).order('posted_at', { ascending: false }).limit(60),
      supabase.from('instagram_posts')
        .select('id, caption, image_url, posted_at, likes_count, comments_count')
        .eq('company_id', companyId).order('posted_at', { ascending: false }).limit(60),
    ])
    const fromPerf: ArchivePost[] = (perf ?? []).map(m => ({
      id: `perf_${m.media_id}`, caption: m.caption, image_url: m.thumbnail_url ?? null,
      posted_at: m.posted_at, likes_count: m.likes ?? 0, comments_count: m.comments ?? 0, media_type: m.media_type ?? 'post',
    }))
    const fromIg: ArchivePost[] = (ig ?? []).map(p => ({ ...(p as ArchivePost), media_type: 'post' }))
    const seen = new Set<string>()
    const merged = [...fromPerf, ...fromIg].filter(x => {
      const key = x.image_url ?? x.id
      if (!key || seen.has(key)) return false
      seen.add(key); return true
    }).sort((a, b) => new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime())
    setArchive(merged)
    setLoading(false)
  }, [companyId])
  useEffect(() => { load() }, [load])
  useRealtime('instagram_content_performance', companyId, load)
  useRealtime('instagram_posts', companyId, load)

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        {tx.b1}<strong>{tx.b2}</strong>{tx.b3}<strong>{tx.b4}</strong>{tx.b5}<strong>{tx.b6}</strong>{tx.b7}<strong>{tx.b8}</strong>{tx.b9}
      </div>

      <LanguageSelector company={company} />

      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([['kit', tx.kit], ['archive', tx.archive]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 13px', background: tab === k ? 'rgba(167,139,250,0.15)' : 'transparent', border: `1px solid ${tab === k ? 'rgba(167,139,250,0.4)' : 'transparent'}`, borderRadius: '7px', color: tab === k ? '#A78BFA' : 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{label}</button>
        ))}
      </div>

      {tab === 'kit' ? <BrandKit companyId={companyId} /> : (
        <>
          <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {([['publicados', tx.published], ['produtos', tx.products], ...(catalogSchema ? [['catalogo', `📋 ${catalogSchema.catalogLabel}`] as const] : [])] as const).map(([k, label]) => (
              <button key={k} onClick={() => setArchiveTab(k)} style={{ padding: '6px 12px', background: archiveTab === k ? 'rgba(255,109,41,0.14)' : 'transparent', border: `1px solid ${archiveTab === k ? 'rgba(255,109,41,0.4)' : 'transparent'}`, borderRadius: '7px', color: archiveTab === k ? '#FF6D29' : 'white', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{label}</button>
            ))}
          </div>

          {archiveTab === 'catalogo' && catalogSchema ? <CatalogItems companyId={companyId} schema={catalogSchema} verticalKey={company.vertical_key ?? 'generico'} /> : archiveTab === 'produtos' ? <ProductPhotos companyId={companyId} /> : (
            loading ? <div style={{ fontSize: '12px', color: MUTED }}>{tx.loading}</div> : archive.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>
                {tx.e1}<strong>{tx.e2}</strong>{tx.e3}<strong>{tx.e4}</strong>{tx.e5}<strong>{tx.e6}</strong>{tx.e7}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {archive.map(p => {
                  const isVideo = VIDEO_TYPES.has(p.media_type ?? '')
                  return (
                  <div key={p.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', overflow: 'hidden' }}>
                    <div style={{ position: 'relative' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" onClick={() => setZoom(p.image_url)} style={{ width: '100%', height: '160px', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '160px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>{isVideo ? '🎬' : '🖼️'}</div>
                      )}
                      {isVideo && (
                        <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 7px', borderRadius: '99px' }}>▶ {p.media_type === 'story' ? 'Story' : 'Reel'}</span>
                      )}
                    </div>
                    <div style={{ padding: '11px 12px' }}>
                      {p.caption && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.4, maxHeight: '48px', overflow: 'hidden', marginBottom: '6px' }}>{p.caption}</div>}
                      <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                        <span>❤️ {p.likes_count ?? 0}</span><span>💬 {p.comments_count ?? 0}</span>
                        {p.posted_at && <span style={{ marginLeft: 'auto' }}>{timeAgo(p.posted_at, lang)}</span>}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {zoom && <ImageModal images={[{ url: zoom }]} onClose={() => setZoom(null)} />}
    </div>
  )
}
