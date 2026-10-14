import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { catalogMinPhotos } from '../../../lib/setupRules'
import { bi, sanitizeCatalogValues, titleFromFields, type CatalogSchema, type CatalogField } from '../../../lib/verticalPlaybook'
import { CARD, MUTED, BORDER, D, inputStyle } from './shared'
import { ImageModal } from './TestingArea'
import { useLang } from '../../../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const TX = {
  pt: {
    select: 'Selecione...', title: 'Editar', photos: 'Fotos', cover: 'Capa', makeCover: 'Usar como capa', removePhoto: 'Tirar esta foto',
    minWarn: (n: number) => `Precisa de pelo menos ${n} fotos.`, required: 'Preencha os campos obrigatórios.',
    save: 'Salvar alterações', saving: 'Salvando...', cancel: 'Cancelar', errSave: 'Não consegui salvar. Tente de novo.',
    hint: 'Clique numa foto pra ver grande. A primeira é a capa. As fotos tiradas daqui somem do imóvel quando você salvar.',
    del: '🗑 Excluir imóvel', details: 'Dados', moveLeft: 'Mover pra esquerda', moveRight: 'Mover pra direita',
  },
  en: {
    select: 'Select...', title: 'Edit', photos: 'Photos', cover: 'Cover', makeCover: 'Use as cover', removePhoto: 'Remove this photo',
    minWarn: (n: number) => `At least ${n} photos are needed.`, required: 'Fill in the required fields.',
    save: 'Save changes', saving: 'Saving...', cancel: 'Cancel', errSave: "Couldn't save. Please try again.",
    hint: 'Click a photo to see it large. The first one is the cover. Photos removed here leave the listing when you save.',
    del: '🗑 Delete listing', details: 'Details', moveLeft: 'Move left', moveRight: 'Move right',
  },
} as const

interface Photo { url: string; path: string }
export interface EditableItem { id: string; title: string; image_url: string | null; meta: { photos?: Photo[]; staged_photos?: Photo[]; fields?: Record<string, unknown> } | null }

// Campo do catálogo (ficha do setor). Texto com `max` acima de 200 vira caixa
// grande (ex.: a descrição do imóvel).
export function FieldInput({ field, value, onChange }: { field: CatalogField; value: unknown; onChange: (v: unknown) => void }) {
  const { lang } = useLang()
  const label = bi(field.label, lang)
  const lbl = <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</label>
  if (field.type === 'select') {
    return (
      <div style={{ marginBottom: '10px' }}>
        {lbl}
        <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">{TX[lang].select}</option>
          {(field.options ?? []).map(o => <option key={o.pt} value={o.pt}>{bi(o, lang)}</option>)}
        </select>
      </div>
    )
  }
  if (field.type === 'text' && (field.max ?? 0) > 200) {
    return (
      <div style={{ marginBottom: '10px' }}>
        {lbl}
        <textarea value={String(value ?? '')} maxLength={field.max} rows={5} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        <div style={{ fontSize: '9.5px', color: MUTED, textAlign: 'right' }}>{String(value ?? '').length}/{field.max}</div>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: '10px' }}>
      {lbl}
      <input type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  )
}

// Editar um item já cadastrado (pedido do dono 2026-10-14: "abrir as
// configurações e editar detalhes, descrição e fotos e ver todas as fotos").
// Ver todas as fotos (clique = tela cheia), escolher a capa, mudar a ordem,
// tirar foto e editar os dados da ficha. Adicionar foto continua no botão
// "＋ Adicionar fotos" do cartão (mesmo upload/tratamento de sempre).
export default function CatalogItemEditor({ item, companyId, schema, onClose, onSaved, onDelete }: { item: EditableItem; companyId: string; schema: CatalogSchema; onClose: () => void; onSaved: () => void; onDelete?: () => Promise<boolean> }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const minPhotos = catalogMinPhotos(schema)
  const formFields = [...schema.required, ...schema.optional].filter(f => f.type !== 'photos')
  const requiredKeys = schema.required.filter(f => f.type !== 'photos').map(f => f.key)
  const [photos, setPhotos] = useState<Photo[]>(item.meta?.photos ?? [])
  const [fields, setFields] = useState<Record<string, unknown>>(item.meta?.fields ?? {})
  const [zoomAt, setZoomAt] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const move = (i: number, d: number) => setPhotos(p => {
    const j = i + d
    if (j < 0 || j >= p.length) return p
    const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n
  })
  const cover = (i: number) => setPhotos(p => [p[i], ...p.filter((_, k) => k !== i)])
  const drop = (i: number) => setPhotos(p => p.filter((_, k) => k !== i))

  const missingRequired = requiredKeys.some(k => String(fields[k] ?? '').trim() === '')
  const tooFew = photos.length < minPhotos
  const canSave = !saving && !missingRequired && !tooFew

  const save = async () => {
    if (!canSave) return
    setSaving(true); setErr('')
    // Relê antes de gravar: não apaga foto adicionada/mobiliada em outra aba.
    const { data: fresh } = await supabase.from('marketing_ai_knowledge').select('meta').eq('id', item.id).eq('company_id', companyId).maybeSingle()
    const meta = { ...((fresh?.meta ?? item.meta ?? {}) as Record<string, unknown>) }
    const before = ((meta.photos as Photo[] | undefined) ?? [])
    const keep = new Set(photos.map(p => p.path))
    const kept = new Set(before.map(p => p.path))
    // Fotos que chegaram em outra aba enquanto esta janela estava aberta ficam no fim.
    const added = before.filter(p => !keep.has(p.path) && !(item.meta?.photos ?? []).some(o => o.path === p.path))
    const finalPhotos = [...photos.filter(p => kept.has(p.path)), ...added]
    const cleanFields = sanitizeCatalogValues(fields, schema)
    const { error } = await supabase.from('marketing_ai_knowledge').update({
      title: titleFromFields(cleanFields, schema.itemLabel),
      image_url: finalPhotos[0]?.url ?? null,
      meta: { ...meta, photos: finalPhotos, fields: cleanFields },
    }).eq('id', item.id).eq('company_id', companyId)
    if (error) { setErr(tx.errSave); setSaving(false); return }
    // Só apaga do armazenamento depois de salvar — e só o que o dono tirou.
    const removed = (item.meta?.photos ?? []).filter(p => !keep.has(p.path)).map(p => p.path)
    if (removed.length) await supabase.storage.from('post-images').remove(removed).catch(() => {})
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div onClick={e => e.stopPropagation()} role="dialog" aria-label={`${tx.title} ${item.title}`}
          style={{ width: '100%', maxWidth: '760px', maxHeight: '92vh', overflowY: 'auto', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✏️ {tx.title} · {item.title}</div>
            <button onClick={onClose} aria-label={tx.cancel} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{tx.photos} — {photos.length}</div>
          <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '8px' }}>{tx.hint}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px', marginBottom: '6px' }}>
            {photos.map((p, i) => (
              <div key={p.path} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${i === 0 ? ORANGE : BORDER}` }}>
                <img src={p.url} alt="" onClick={() => setZoomAt(i)} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />
                {i === 0 && <span style={{ position: 'absolute', top: '4px', left: '4px', fontSize: '9px', fontWeight: 800, color: '#000', background: ORANGE, borderRadius: '99px', padding: '1px 6px' }}>{tx.cover}</span>}
                <button onClick={() => drop(i)} title={tx.removePhoto} style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: `1px solid ${BORDER}`, color: 'white', fontSize: '11px', cursor: 'pointer' }}>×</button>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.6)' }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} title={tx.moveLeft} style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', padding: '3px', opacity: i === 0 ? 0.3 : 1 }}>‹</button>
                  {i > 0 && <button onClick={() => cover(i)} title={tx.makeCover} style={{ flex: 1, background: 'transparent', border: 'none', color: ORANGE, fontSize: '12px', cursor: 'pointer', padding: '3px' }}>★</button>}
                  <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} title={tx.moveRight} style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', padding: '3px', opacity: i === photos.length - 1 ? 0.3 : 1 }}>›</button>
                </div>
              </div>
            ))}
          </div>
          {tooFew && <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '8px' }}>{tx.minWarn(minPhotos)}</div>}

          <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>{tx.details}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', columnGap: '12px' }}>
            {formFields.filter(f => !(f.type === 'text' && (f.max ?? 0) > 200)).map(f => (
              <FieldInput key={f.key} field={f} value={fields[f.key]} onChange={v => setFields(p => ({ ...p, [f.key]: v }))} />
            ))}
          </div>
          {formFields.filter(f => f.type === 'text' && (f.max ?? 0) > 200).map(f => (
            <FieldInput key={f.key} field={f} value={fields[f.key]} onChange={v => setFields(p => ({ ...p, [f.key]: v }))} />
          ))}

          {missingRequired && <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '8px' }}>{tx.required}</div>}
          {err && <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '8px' }}>{err}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={save} disabled={!canSave} style={{ padding: '10px 18px', background: canSave ? ORANGE : 'rgba(255,255,255,0.08)', color: canSave ? '#000' : MUTED, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: D }}>{saving ? tx.saving : tx.save}</button>
            <button onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '12.5px', cursor: 'pointer', fontFamily: D }}>{tx.cancel}</button>
            {onDelete && <button onClick={async () => { if (await onDelete()) onClose() }} style={{ marginLeft: 'auto', padding: '10px 14px', background: 'transparent', border: '1px solid rgba(248,113,113,0.4)', borderRadius: '9px', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{tx.del}</button>}
          </div>
        </div>
      </div>
      {zoomAt != null && <ImageModal images={photos.map(p => ({ url: p.url }))} start={zoomAt} onClose={() => setZoomAt(null)} />}
    </>
  )
}
