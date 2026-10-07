import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, inputStyle } from './shared'
import { ImageModal } from './TestingArea'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: { b1: '📦 ', b2: 'Produtos.', b3: ' Suba fotos reais do seu produto — além das que já vêm automaticamente do Instagram. A geração de conteúdo passa a poder usar essas fotos também.',
    uploading: 'Enviando...', add: '＋ Adicionar foto de produto', namePh: 'Nome do produto *', save: 'Salvar', cancel: 'Cancelar', loading: 'Carregando...',
    empty: 'Nenhuma foto de produto ainda. Suba as fotos que você quer que a IA use na hora de criar conteúdo.', remove: 'Remover' },
  en: { b1: '📦 ', b2: 'Products.', b3: ' Upload real photos of your product — in addition to the ones that already come automatically from Instagram. Content generation can use these photos too.',
    uploading: 'Uploading...', add: '＋ Add product photo', namePh: 'Product name *', save: 'Save', cancel: 'Cancel', loading: 'Loading...',
    empty: 'No product photos yet. Upload the photos you want the AI to use when creating content.', remove: 'Remove' },
} as const

const ORANGE = '#FF6D29'

interface Product { id: string; title: string; image_url: string | null; meta: { path?: string } | null; created_at: string }

// Fotos de produto — enviadas manualmente pelo cliente, complementando o que
// vem automático do Instagram/Meta em "Publicados". A geração de conteúdo
// passa a poder usar fotos reais do produto, não só o que foi postado antes.
export default function ProductPhotos({ companyId }: { companyId: string }) {
  const tx = TX[useLang().lang]
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState<{ url: string; path: string } | null>(null)
  const [name, setName] = useState('')
  const [zoom, setZoom] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_knowledge').select('id, title, image_url, meta, created_at').eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false })
    setItems((data ?? []) as Product[])
    setLoading(false)
  }, [companyId])
  useEffect(() => { load() }, [load])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `renders/${companyId}/product-${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('post-images').upload(path, file, { contentType: file.type || 'image/png', upsert: false })
      if (!error) { const { data } = supabase.storage.from('post-images').getPublicUrl(path); setPending({ url: data.publicUrl, path }); setName(n => n || file.name.replace(/\.[^.]+$/, '')) }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const save = async () => {
    if (!pending || !name.trim()) return
    await supabase.from('marketing_ai_knowledge').insert({ company_id: companyId, module: 'visual', kind: 'product', title: name.trim(), image_url: pending.url, meta: { path: pending.path } })
    setPending(null); setName(''); await load()
  }
  const remove = async (p: Product) => {
    if (p.meta?.path) await supabase.storage.from('post-images').remove([p.meta.path]).catch(() => {})
    await supabase.from('marketing_ai_knowledge').delete().eq('id', p.id); await load()
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        {tx.b1}<strong>{tx.b2}</strong>{tx.b3}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '8px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: D, marginBottom: '16px' }}>{uploading ? tx.uploading : tx.add}</button>

      {pending && (
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '18px', padding: '14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
          <img src={pending.url} alt="" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={tx.namePh} style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={!name.trim()} style={{ padding: '8px 18px', background: name.trim() ? ORANGE : 'rgba(255,255,255,0.08)', color: name.trim() ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: D }}>{tx.save}</button>
              <button onClick={() => setPending(null)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: D }}>{tx.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div style={{ fontSize: '12px', color: MUTED }}>{tx.loading}</div> : items.length === 0 ? (
        <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{tx.empty}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {items.map(p => (
            <div key={p.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', overflow: 'hidden' }}>
              {p.image_url && <img src={p.image_url} alt="" onClick={() => setZoom(p.image_url)} style={{ width: '100%', height: '150px', objectFit: 'cover', cursor: 'zoom-in' }} />}
              <div style={{ padding: '10px 11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <button onClick={() => remove(p)} title={tx.remove} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {zoom && <ImageModal images={[{ url: zoom }]} onClose={() => setZoom(null)} />}
    </div>
  )
}
