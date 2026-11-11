import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useShowcase } from '../../contexts/ShowcaseContext'
import MakeNowPicker from './marketingAi/MakeNowPicker'
import { BORDER, D, MUTED, ORANGE } from './marketingAi/shared'
import { LOOSE_PIECES_PATH, plusOptionStates, plusStateNote, type PlusOption } from './plusOptions'
import { invalidatePlusCache, usePlusOptions } from './usePlusOptions'

const TX = {
  pt: { menu: 'Ações rápidas', close: 'Fechar', seeLoose: 'Ver em Peças avulsas →', pieceTitle: 'Gerar peça agora' },
  en: { menu: 'Quick actions', close: 'Close', seeLoose: 'See in Loose pieces →', pieceTitle: 'Make a piece now' },
} as const

// Menu do botão "+" (Pacote B2). Abre acima do botão; só lista o que funciona (regra em plusOptions.ts).
export default function PlusMenu({ open, onClose, anchor }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLButtonElement | null> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const navigate = useNavigate()
  const { session } = useAuth()
  const { company } = useCompany()
  const { readOnly } = useShowcase()
  const token = session?.access_token ?? ''
  const { schema, check } = usePlusOptions(open, { companyId: company?.id ?? '', verticalKey: company?.vertical_key ?? 'generico', token, readOnly })
  const options = plusOptionStates({ readOnly, schema, check, lang })
  const [modal, setModal] = useState(false)
  const [requested, setRequested] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Esc e clique fora fecham o menu.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); anchor.current?.focus() } }
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node
      if (ref.current?.contains(n) || anchor.current?.contains(n)) return
      onClose()
    }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [open, onClose, anchor])

  useEffect(() => { if (open) ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus() }, [open, options.length])

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal])

  const pick = (o: PlusOption) => {
    if (o.state !== 'enabled') return
    onClose()
    if (o.key === 'piece') { setRequested(false); setModal(true); return }
    if (o.href) navigate(o.href)
  }

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus()
    e.preventDefault()
  }

  return (
    <>
      {open && (
        <div ref={ref} role="menu" aria-label={t.menu} onKeyDown={onMenuKey}
          style={{ position: 'fixed', right: '24px', bottom: '88px', zIndex: 61, minWidth: '230px', background: '#1a1512', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '6px', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', fontFamily: D }}>
          {options.map(o => {
            const off = o.state !== 'enabled'
            return (
              <button key={o.key} role="menuitem" disabled={off} onClick={() => pick(o)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '8px', color: off ? MUTED : 'white', cursor: off ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: D }}
                onMouseEnter={e => { if (!off) e.currentTarget.style.background = 'rgba(255,109,41,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                {o.label}
                {off && <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{plusStateNote(o.state, lang)}</span>}
              </button>
            )
          })}
        </div>
      )}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-label={t.pieceTitle} onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', background: '#14100e', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px' }}>
            <MakeNowPicker token={token} onRequested={() => { setRequested(true); invalidatePlusCache() }} />
            {requested && (
              <button onClick={() => { setModal(false); navigate(LOOSE_PIECES_PATH) }}
                style={{ background: 'none', border: 'none', color: ORANGE, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: D, padding: '4px 0', marginRight: '14px' }}>{t.seeLoose}</button>
            )}
            <button onClick={() => setModal(false)} autoFocus
              style={{ background: 'none', border: 'none', color: MUTED, fontSize: '12.5px', cursor: 'pointer', fontFamily: D, padding: '4px 0' }}>{t.close}</button>
          </div>
        </div>
      )}
    </>
  )
}
