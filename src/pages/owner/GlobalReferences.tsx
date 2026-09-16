import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const input = { padding: '8px 11px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: D } as const
const CATEGORIES = ['Minimalista', 'Editorial', 'Luxo', 'UGC', 'Tweet Print', 'Infográfico', 'Educativo', 'Tipografia forte', 'Foco no produto', 'Comparação', 'Meme']

interface Ref { id: string; title: string; image_url: string | null; meta: { category?: string; visual_style?: string; colors?: string; path?: string } | null }

// Referências Visuais Globais — curadoria da plataforma (owner). Ficam com
// company_id NULL: as MESMAS pra todo cliente, garantindo um bom design de base.
// Suba muitas (ex: Pinterest); componentes/DNA é que personalizam por cliente.
export default function GlobalReferences() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [refs, setRefs] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState<{ url: string; path: string } | null>(null)
  const [f, setF] = useState({ title: '', category: '', visual_style: '', colors: '', notes: '' })
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_knowledge').select('id, title, image_url, meta').is('company_id', null).eq('module', 'visual').eq('kind', 'layout').order('created_at', { ascending: false })
    setRefs((data ?? []) as Ref[]); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setErr('')
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `references/global/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('post-images').upload(path, file, { contentType: file.type || 'image/png', upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('post-images').getPublicUrl(path)
      setPending({ url: data.publicUrl, path }); setF(p => ({ ...p, title: p.title || file.name.replace(/\.[^.]+$/, '') }))
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Falha no upload') }
    setUploading(false); if (fileRef.current) fileRef.current.value = ''
  }

  const save = async () => {
    if (!pending || !f.title.trim()) return
    setErr('')
    const res = await fetch(`${SUPABASE_URL}/functions/v1/global-references`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', title: f.title.trim(), content: f.notes || null, image_url: pending.url, meta: { category: f.category, visual_style: f.visual_style, colors: f.colors, path: pending.path } }),
    })
    const r = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(r.error ?? 'Erro ao salvar'); return }
    setPending(null); setF({ title: '', category: '', visual_style: '', colors: '', notes: '' }); await load()
  }

  const remove = async (r: Ref) => {
    await fetch(`${SUPABASE_URL}/functions/v1/global-references`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: r.id, path: r.meta?.path }),
    })
    await load()
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '11px', fontSize: '12px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        🌐 <strong>Referências Visuais Globais.</strong> Curadoria da plataforma — as mesmas pra <strong>todos os clientes</strong>, pra garantir um bom design de base. Suba muitas (Pinterest etc). O que personaliza por cliente são os <strong>componentes</strong> e o <strong>DNA da marca</strong>. O Diretor Criativo consulta estas + as do cliente ao criar.
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '9px 17px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: D, marginBottom: '14px' }}>{uploading ? 'Enviando...' : '＋ Adicionar referência global'}</button>
      {err && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>{err}</div>}

      {pending && (
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '18px', padding: '14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
          <img src={pending.url} alt="" style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '8px' }} />
          <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Nome *" style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
              <input list="gcat" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="Categoria" style={input} />
              <datalist id="gcat">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
              <input value={f.visual_style} onChange={e => setF({ ...f, visual_style: e.target.value })} placeholder="Estilo visual" style={input} />
              <input value={f.colors} onChange={e => setF({ ...f, colors: e.target.value })} placeholder="Cores" style={input} />
              <input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Notas" style={input} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={!f.title.trim()} style={{ padding: '8px 18px', background: f.title.trim() ? ORANGE : 'rgba(255,255,255,0.08)', color: f.title.trim() ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: f.title.trim() ? 'pointer' : 'not-allowed', fontFamily: D }}>Salvar global</button>
              <button onClick={() => setPending(null)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: D }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div> : refs.length === 0 ? (
        <div style={{ padding: '26px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>Nenhuma referência global ainda. Suba as suas — elas aparecem pra todos os clientes.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {refs.map(r => (
            <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', overflow: 'hidden' }}>
              {r.image_url && <img src={r.image_url} alt="" style={{ width: '100%', height: '130px', objectFit: 'cover' }} />}
              <div style={{ padding: '10px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  <button onClick={() => remove(r)} title="Remover" style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>🗑</button>
                </div>
                {r.meta?.category && <span style={{ fontSize: '8.5px', fontWeight: 700, color: ORANGE }}>{r.meta.category}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
