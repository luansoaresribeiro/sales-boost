import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, timeAgo } from './shared'
import { ImageModal } from './TestingArea'
import BrandKit from './BrandKit'
import ProductPhotos from './ProductPhotos'

interface ArchivePost { id: string; caption: string | null; image_url: string | null; posted_at: string | null; likes_count: number | null; comments_count: number | null; media_type: string | null }

const VIDEO_TYPES = new Set(['reel', 'video', 'story', 'VIDEO', 'REELS'])

// Estilos e Visuais — hub da identidade visual. Kit personaliza por cliente;
// Arquivo mostra TODAS as mídias publicadas no Instagram (fotos, carrosséis E
// vídeos/Reels — via `instagram_content_performance`, que a função de
// Performance importa) + o que a própria plataforma publicou + fotos de produto.
export default function VisualLibrary({ companyId }: { companyId: string }) {
  const [tab, setTab] = useState<'kit' | 'archive'>('kit')
  const [archiveTab, setArchiveTab] = useState<'publicados' | 'produtos'>('publicados')
  const [archive, setArchive] = useState<ArchivePost[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<string | null>(null)

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

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        🎨 <strong>Estilos e Visuais — a identidade visual da marca.</strong> <strong>Kit</strong> = logo, cores, tipografia e voz · <strong>Arquivo</strong> = tudo que você publica no Instagram (fotos, carrosséis <strong>e vídeos/Reels</strong>) + as fotos de produto que você subir. A geração filtra e monta as peças a partir daqui.
      </div>

      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([['kit', '🎨 Kit da Marca'], ['archive', '🗂️ Arquivo']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 13px', background: tab === k ? 'rgba(167,139,250,0.15)' : 'transparent', border: `1px solid ${tab === k ? 'rgba(167,139,250,0.4)' : 'transparent'}`, borderRadius: '7px', color: tab === k ? '#A78BFA' : 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{label}</button>
        ))}
      </div>

      {tab === 'kit' ? <BrandKit companyId={companyId} /> : (
        <>
          <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {([['publicados', '📷 Publicados'], ['produtos', '📦 Produtos']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setArchiveTab(k)} style={{ padding: '6px 12px', background: archiveTab === k ? 'rgba(255,109,41,0.14)' : 'transparent', border: `1px solid ${archiveTab === k ? 'rgba(255,109,41,0.4)' : 'transparent'}`, borderRadius: '7px', color: archiveTab === k ? '#FF6D29' : 'white', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{label}</button>
            ))}
          </div>

          {archiveTab === 'produtos' ? <ProductPhotos companyId={companyId} /> : (
            loading ? <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div> : archive.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>
                Arquivo vazio. Ele enche automaticamente com seus posts e <strong>vídeos/Reels</strong> quando o <strong>Instagram</strong> estiver conectado e a aba <strong>Performance</strong> sincronizar (é ela que importa as mídias).
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
                        {p.posted_at && <span style={{ marginLeft: 'auto' }}>{timeAgo(p.posted_at)}</span>}
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
