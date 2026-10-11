// Escolha das fotos do kit grátis: 2 cômodos (viram vídeos "drone") + 1 foto
// de destaque (vira o criativo de design). Usado no cadastro do diagnóstico e
// no painel (/gratis). Fotos sempre reais (regra 4).
import { useEffect, useMemo, useRef } from 'react'
import { useLang } from '../contexts/LanguageContext'
import { KIT_PHOTOS } from '../lib/giftKit'

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'

const TX = {
  pt: { slots: ['Cômodo 1', 'Cômodo 2', 'Foto de destaque'], hints: ['vira um vídeo', 'vira um vídeo', 'vira um criativo'], pick: '+ Escolher foto', remove: 'Tirar foto' },
  en: { slots: ['Room 1', 'Room 2', 'Highlight photo'], hints: ['becomes a video', 'becomes a video', 'becomes a creative'], pick: '+ Choose photo', remove: 'Remove photo' },
}

export default function KitPhotoPicker({ files, onChange, disabled = false }: {
  files: (File | null)[]; onChange: (files: (File | null)[]) => void; disabled?: boolean
}) {
  const tx = TX[useLang().lang]
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const previews = useMemo(() => files.map(f => (f ? URL.createObjectURL(f) : null)), [files])
  useEffect(() => () => previews.forEach(p => p && URL.revokeObjectURL(p)), [previews])

  const setAt = (i: number, f: File | null) => {
    const next = Array.from({ length: KIT_PHOTOS }, (_, j) => files[j] ?? null)
    next[i] = f
    onChange(next)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${KIT_PHOTOS}, minmax(0, 1fr))`, gap: 8, maxWidth: 420 }}>
      {Array.from({ length: KIT_PHOTOS }, (_, i) => (
        <div key={i} style={{ minWidth: 0 }}>
          <input ref={el => { inputs.current[i] = el }} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setAt(i, f); e.target.value = '' }} />
          <div style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: previews[i] ? `1px solid rgba(255,109,41,0.5)` : '1px dashed rgba(255,255,255,0.2)' }}>
            {previews[i] ? (
              <>
                <img src={previews[i]!} alt={tx.slots[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {!disabled && (
                  <button type="button" onClick={() => setAt(i, null)} aria-label={`${tx.remove}: ${tx.slots[i]}`}
                    style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 12, cursor: 'pointer' }}>✕</button>
                )}
              </>
            ) : (
              <button type="button" disabled={disabled} onClick={() => inputs.current[i]?.click()}
                style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: ORANGE, fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', padding: 6, fontFamily: 'inherit' }}>
                {tx.pick}
              </button>
            )}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'white', marginTop: 5, lineHeight: 1.3 }}>{tx.slots[i]}</div>
          <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.3 }}>{tx.hints[i]}</div>
        </div>
      ))}
    </div>
  )
}
