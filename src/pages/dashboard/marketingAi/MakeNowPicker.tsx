import { useEffect, useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { MUTED, BORDER, D, SUPABASE_URL } from './shared'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const SURFACE_ICON: Record<string, string> = { feed: '📝', stories: '📖', reels: '🎬' }
const TX = {
  pt: {
    title: '⚡ Gerar uma peça agora', desc: 'Escolha o tipo de criativo. Sai uma peça só, fora do calendário, com nota — e ela aparece aqui embaixo e em Aprovações. Nada vai ao ar sem você aprovar.',
    type: 'Tipo de criativo', item: 'Imóvel', auto: 'Escolher sozinho (o menos usado)', go: 'Gerar agora', going: 'Pedindo...',
    ok: '✅ Pedido feito! A peça aparece aqui em 1–2 minutos (vídeo pode levar mais).', err: 'Não deu pra gerar agora.',
    video: 'Vídeo usa o teto mensal de IA (cerca de US$ 0,42 por vídeo).', loading: 'Carregando tipos...',
  },
  en: {
    title: '⚡ Make one piece now', desc: 'Pick the creative type. One piece is made, outside the calendar, with a score — it shows up below and in Approvals. Nothing goes live without your approval.',
    type: 'Creative type', item: 'Listing', auto: 'Pick for me (least used)', go: 'Make now', going: 'Requesting...',
    ok: '✅ Requested! The piece shows up here in 1–2 minutes (video may take longer).', err: 'Could not make it now.',
    video: 'Video uses the monthly AI cap (about US$ 0.42 per video).', loading: 'Loading types...',
  },
} as const

interface Opt { key: string; name: string; producer: string; surface: string }

export default function MakeNowPicker({ token, onRequested }: { token: string; onRequested: () => void }) {
  const { lang } = useLang()
  const t = TX[lang]
  const [formats, setFormats] = useState<Opt[] | null>(null)
  const [items, setItems] = useState<{ id: string; title: string }[]>([])
  const [format, setFormat] = useState('')
  const [itemId, setItemId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const call = (body: Record<string, unknown>) => fetch(`${SUPABASE_URL}/functions/v1/creative-generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  useEffect(() => {
    if (!token) return
    call({ action: 'make_now_options' }).then(r => r.json()).then((r: { formats?: Opt[]; items?: { id: string; title: string }[] }) => {
      const f = Array.isArray(r.formats) ? r.formats : []
      setFormats(f); setItems(Array.isArray(r.items) ? r.items : [])
      if (f[0]) setFormat(f[0].key)
    }).catch(() => setFormats([]))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = formats?.find(f => f.key === format)
  const needsItem = !!sel && sel.producer !== 'post'

  const go = async () => {
    setBusy(true); setMsg(''); setErr('')
    try {
      const res = await call({ action: 'make_now', format, item_id: needsItem && itemId ? itemId : undefined })
      const r = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(r.error ?? t.err)
      setMsg(t.ok); onRequested()
    } catch (e) { setErr(e instanceof Error ? e.message : t.err) }
    setBusy(false)
  }

  const box = { padding: '7px 9px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12px', fontFamily: D, maxWidth: '100%' } as const
  return (
    <div style={{ padding: '12px 14px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: 'rgba(255,255,255,0.02)', marginBottom: '12px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{t.title}</div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '10px' }}>{t.desc}</div>
      {formats === null ? <div style={{ fontSize: '11px', color: MUTED }}>{t.loading}</div> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: MUTED, minWidth: 0 }}>
            {t.type}
            <select value={format} onChange={e => setFormat(e.target.value)} style={box}>
              {formats.map(f => <option key={f.key} value={f.key} style={{ color: '#000' }}>{SURFACE_ICON[f.surface] ?? '📝'} {f.name}</option>)}
            </select>
          </label>
          {needsItem && items.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: MUTED, minWidth: 0 }}>
              {t.item}
              <select value={itemId} onChange={e => setItemId(e.target.value)} style={box}>
                <option value="" style={{ color: '#000' }}>{t.auto}</option>
                {items.map(i => <option key={i.id} value={i.id} style={{ color: '#000' }}>{i.title}</option>)}
              </select>
            </label>
          )}
          <button onClick={go} disabled={busy || !format || !token}
            style={{ padding: '8px 14px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: busy ? 'default' : 'pointer', fontFamily: D, opacity: busy || !format ? 0.7 : 1 }}>
            {busy ? t.going : t.go}
          </button>
        </div>
      )}
      {sel?.producer === 'item_video' && <div style={{ fontSize: '10px', color: MUTED, marginTop: '6px' }}>{t.video}</div>}
      {msg && <div style={{ fontSize: '11px', color: GREEN, marginTop: '8px' }}>{msg}</div>}
      {err && <div style={{ fontSize: '11px', color: '#f87171', marginTop: '8px' }}>{err}</div>}
    </div>
  )
}
