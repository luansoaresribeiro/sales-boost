import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useLang } from '../../../contexts/LanguageContext'
import { processImageTo4x5 } from '../../../lib/imageProcessing'
import { bi, type Bilingual } from '../../../lib/verticalPlaybook'
import { MUTED, BORDER, D, SUPABASE_URL } from './shared'

const ORANGE = '#FF6D29'
const PURPLE = '#A78BFA'

interface Photo { url: string; path: string; from?: string }
interface Style { key: string; label: Bilingual }

const TX = {
  pt: {
    open: '🛋️ Mobiliar cômodo vazio', pick: 'Escolha a foto real do cômodo vazio:', style: 'Estilo:',
    go: 'Mobiliar esta foto', working: 'Mobiliando... (leva 1–2 minutos)', failed: 'Não deu certo desta vez. Tente outra foto ou outro estilo.',
    before: 'Antes (real)', after: 'Depois (virtual)', use: '✅ Usar no imóvel', discard: 'Descartar', saving: 'Salvando...',
    note: 'Custa por foto (conta no limite do mês). A foto real nunca é trocada: a mobiliada fica separada e todo post que usar ela avisa na legenda que os móveis são ilustrativos.',
    staged: 'Mobiliadas (virtual)', remove: 'Remover', close: 'Fechar', planRequired: 'Disponível no plano.',
  },
  en: {
    open: '🛋️ Furnish an empty room', pick: 'Pick the real photo of the empty room:', style: 'Style:',
    go: 'Furnish this photo', working: 'Furnishing... (takes 1–2 minutes)', failed: "It didn't work this time. Try another photo or style.",
    before: 'Before (real)', after: 'After (virtual)', use: '✅ Use on the listing', discard: 'Discard', saving: 'Saving...',
    note: 'Paid per photo (counts toward the monthly limit). The real photo is never replaced: the furnished one is kept apart and every post that uses it says in the caption that the furniture is illustrative.',
    staged: 'Furnished (virtual)', remove: 'Remove', close: 'Close', planRequired: 'Available on the plan.',
  },
} as const

// "Mobiliar virtualmente" (virtual-staging). Só aparece se a ficha do setor
// tem config.virtual_staging. O resultado só entra no item quando o dono
// clica "Usar no imóvel" — e vai pra meta.staged_photos, nunca meta.photos.
export default function VirtualStaging({ itemId, companyId, verticalKey, photos, staged, onChanged }: {
  itemId: string; companyId: string; verticalKey: string; photos: Photo[]; staged: Photo[]; onChanged: () => void
}) {
  const { lang } = useLang(); const tx = TX[lang]
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [styles, setStyles] = useState<Style[]>([])
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [style, setStyle] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; preview: string } | null>(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle().then(({ data }) => {
      const st = (data?.config as { virtual_staging?: { styles?: Style[] } } | null)?.virtual_staging?.styles ?? []
      if (alive) { setStyles(st); setStyle(s => s || st[0]?.key || '') }
    })
    return () => { alive = false }
  }, [verticalKey])

  const call = (body: Record<string, unknown>) => fetch(`${SUPABASE_URL}/functions/v1/virtual-staging`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  // Acompanha o pedido até ficar pronto; aí baixa e recorta 4:5 (igual a
  // qualquer foto do catálogo) só pra mostrar — ainda não salva nada.
  useEffect(() => {
    if (!jobId) return
    let alive = true
    const tick = async () => {
      try {
        const r = await (await call({ action: 'status', id: jobId })).json() as { status?: string; ready?: boolean }
        if (!alive) return
        if (r.ready) {
          const res = await call({ action: 'result', id: jobId })
          if (!res.ok) throw new Error()
          const blob = await processImageTo4x5(new File([await res.blob()], 'mobiliada.png'))
          if (alive) { setResult({ blob, preview: URL.createObjectURL(blob) }); setJobId(null) }
          return
        }
        if (r.status === 'failed') { setErr(tx.failed); setJobId(null); return }
      } catch { if (alive) { setErr(tx.failed); setJobId(null) } return }
      if (alive) timer = setTimeout(tick, 6000)
    }
    let timer = setTimeout(tick, 6000)
    return () => { alive = false; clearTimeout(timer) }
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!styles.length || !photos.length) return null

  const start = async () => {
    if (!photo) return
    setErr(''); setResult(null)
    const res = await call({ action: 'start', item_id: itemId, photo_url: photo, style })
    const r = await res.json().catch(() => ({})) as { id?: string; error?: string; code?: string }
    if (res.status === 402 || r.code === 'plan_required') { setErr(tx.planRequired); return }
    if (!res.ok || !r.id) { setErr(r.error ?? tx.failed); return }
    setJobId(r.id)
  }

  const use = async () => {
    if (!result || !photo) return
    setSaving(true)
    try {
      const path = `renders/${companyId}/staged-${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('post-images').upload(path, result.blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      const url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
      const { data: fresh } = await supabase.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
      const meta = (fresh?.meta ?? {}) as { staged_photos?: Photo[] }
      await supabase.from('marketing_ai_knowledge').update({ meta: { ...meta, staged_photos: [...(meta.staged_photos ?? []), { url, path, from: photo }] } }).eq('id', itemId).eq('company_id', companyId)
      setResult(null); setPhoto(null); onChanged()
    } catch { setErr(tx.failed) }
    setSaving(false)
  }

  const removeStaged = async (p: Photo) => {
    const { data: fresh } = await supabase.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
    const meta = (fresh?.meta ?? {}) as { staged_photos?: Photo[] }
    await supabase.from('marketing_ai_knowledge').update({ meta: { ...meta, staged_photos: (meta.staged_photos ?? []).filter(x => x.path !== p.path) } }).eq('id', itemId).eq('company_id', companyId)
    await supabase.storage.from('post-images').remove([p.path]).catch(() => {})
    onChanged()
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {staged.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{tx.staged}</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {staged.map(p => (
              <div key={p.path} style={{ position: 'relative' }}>
                <img src={p.url} alt="" style={{ width: '44px', height: '55px', objectFit: 'cover', borderRadius: '5px', border: `1px solid ${PURPLE}` }} />
                <button onClick={() => removeStaged(p)} title={tx.remove} style={{ position: 'absolute', top: '-5px', right: '-5px', width: '16px', height: '16px', borderRadius: '50%', background: '#000', border: `1px solid ${BORDER}`, color: 'white', fontSize: '9px', cursor: 'pointer', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '7px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: PURPLE, fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: D }}>{tx.open}</button>
      ) : (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '10.5px', color: 'white', fontWeight: 700 }}>{tx.pick}</span>
            <button onClick={() => setOpen(false)} disabled={!!jobId} style={{ background: 'none', border: 'none', color: MUTED, fontSize: '10.5px', cursor: 'pointer', fontFamily: D }}>{tx.close}</button>
          </div>
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '6px' }}>
            {photos.map(p => (
              <img key={p.url} src={p.url} alt="" onClick={() => !jobId && setPhoto(p.url)} style={{ width: '44px', height: '55px', objectFit: 'cover', borderRadius: '5px', cursor: 'pointer', flexShrink: 0, outline: photo === p.url ? `2px solid ${ORANGE}` : 'none' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: MUTED }}>{tx.style}</span>
            {styles.map(s => (
              <button key={s.key} onClick={() => setStyle(s.key)} disabled={!!jobId} style={{ padding: '3px 8px', borderRadius: '99px', border: `1px solid ${style === s.key ? ORANGE : BORDER}`, background: 'transparent', color: style === s.key ? ORANGE : 'white', fontSize: '10px', cursor: 'pointer', fontFamily: D }}>{bi(s.label, lang)}</button>
            ))}
          </div>
          {result && photo ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '6px' }}>
                <div><img src={photo} alt="" style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '5px' }} /><div style={{ fontSize: '9px', color: MUTED }}>{tx.before}</div></div>
                <div><img src={result.preview} alt="" style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '5px' }} /><div style={{ fontSize: '9px', color: PURPLE }}>{tx.after}</div></div>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={use} disabled={saving} style={{ flex: 1, padding: '6px', background: ORANGE, color: '#000', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '10.5px', cursor: 'pointer', fontFamily: D }}>{saving ? tx.saving : tx.use}</button>
                <button onClick={() => setResult(null)} disabled={saving} style={{ padding: '6px 8px', background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: '6px', fontSize: '10.5px', cursor: 'pointer', fontFamily: D }}>{tx.discard}</button>
              </div>
            </div>
          ) : (
            <button onClick={start} disabled={!photo || !!jobId} style={{ width: '100%', padding: '6px', background: photo && !jobId ? 'rgba(167,139,250,0.15)' : 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE, borderRadius: '6px', fontWeight: 700, fontSize: '10.5px', cursor: photo && !jobId ? 'pointer' : 'default', fontFamily: D }}>
              {jobId ? tx.working : tx.go}
            </button>
          )}
          {err && <div style={{ color: '#f87171', fontSize: '10px', marginTop: '5px' }}>{err}</div>}
          <div style={{ fontSize: '9.5px', color: MUTED, marginTop: '6px', lineHeight: 1.45 }}>{tx.note}</div>
        </div>
      )}
    </div>
  )
}
