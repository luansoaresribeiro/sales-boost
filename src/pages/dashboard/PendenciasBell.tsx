import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Pendencia, PendenciaTone } from '../../lib/usePendencias'

const ORANGE = '#FF6D29'
const BELL_BG = '#0D0A07'
const PANEL_BG = '#150E08'
const BORDER = 'rgba(255,255,255,0.06)'
const MAX_LINES = 6

const TONE: Record<PendenciaTone, { color: string; bg: string }> = {
  amber: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  red: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  orange: { color: ORANGE, bg: 'rgba(255,109,41,0.12)' },
  muted: { color: '#7A6A5A', bg: 'rgba(255,255,255,0.06)' },
}

const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function KindIcon({ kind }: { kind: Pendencia['kind'] }) {
  const s = { width: 17, height: 17 }
  if (kind === 'aprovacoes') return <svg {...svgProps} style={s}><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
  if (kind === 'instagram') return <svg {...svgProps} style={s}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.6" /></svg>
  if (kind === 'fotos') return <svg {...svgProps} style={s}><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
  if (kind === 'ficha') return <svg {...svgProps} style={s}><path d="M8 4h8l3 3v13H5V4h3ZM8 11h8M8 15h5" /></svg>
  return <svg {...svgProps} style={s}><path d="m21 4-9.5 9.5M21 4l-6.5 16-3-6.5L5 10.5 21 4Z" /></svg>
}

function Row({ p, onPick }: { p: Pendencia; onPick: (p: Pendencia) => void }) {
  const t = TONE[p.tone]
  return (
    <button onClick={() => onPick(p)}
      style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 14px', background: 'transparent', border: 'none', borderTop: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
      <span style={{ width: '32px', height: '32px', borderRadius: '9px', background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <KindIcon kind={p.kind} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{p.title}</span>
        <span style={{ display: 'block', fontSize: '11px', color: '#9A8C7E', marginTop: '2px', lineHeight: 1.35 }}>{p.hint}</span>
        <span style={{ display: 'block', fontSize: '10.5px', color: ORANGE, marginTop: '3px' }}>→ {p.destino}</span>
      </span>
      <span style={{ color: ORANGE, fontSize: '16px', flexShrink: 0 }}>›</span>
    </button>
  )
}

// Sino de pendências. A lista vem pronta do hook (usePendencias, montado uma
// vez no layout). Tocar numa linha fecha o painel (e a gaveta no celular) e
// leva direto ao lugar certo.
export default function PendenciasBell({ items, count, isMobile, onOpen }: { items: Pendencia[]; count: number; isMobile: boolean; onOpen?: () => void }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const toggle = () => { if (!open) onOpen?.(); setOpen(o => !o); setShowAll(false) }
  const pick = (p: Pendencia) => {
    setOpen(false)
    if (p.openAdd) window.dispatchEvent(new CustomEvent('sb:open-add', { detail: p.openAdd }))
    else if (p.to) navigate(p.to)
  }
  const visible = showAll ? items : items.slice(0, MAX_LINES)

  const panelBase: React.CSSProperties = { position: 'fixed', zIndex: 80, background: PANEL_BG, border: `1px solid ${BORDER}`, overflowY: 'auto', boxShadow: '0 18px 48px rgba(0,0,0,0.6)' }
  const panelStyle: React.CSSProperties = isMobile
    ? { ...panelBase, left: 0, right: 0, bottom: 0, maxHeight: '75vh', borderRadius: '18px 18px 0 0' }
    : { ...panelBase, top: '62px', right: '20px', width: '360px', maxHeight: '70vh', borderRadius: '14px' }

  return (
    <>
      <button onClick={toggle} aria-label={count > 0 ? `Pendências: ${count}` : 'Pendências'}
        style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '50%', background: BELL_BG, border: `1px solid ${BORDER}`, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
        <svg {...svgProps} style={{ width: 18, height: 18 }}><path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
        {count > 0 && (
          <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', padding: '0 4px', boxSizing: 'border-box', borderRadius: '9px', background: '#EF4444', color: 'white', fontSize: '10.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Portal no body: a barra do topo (sticky, z 30) criava um contexto de
          empilhamento e o botão "+" (z 60) ficava por cima do painel. */}
      {open && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 79, background: isMobile ? 'rgba(0,0,0,0.6)' : 'transparent' }} />
          <div style={panelStyle} role="dialog" aria-label="Pendências">
            <div style={{ padding: '14px 14px 12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>Pendências</div>
              <div style={{ fontSize: '11px', color: '#9A8C7E', marginTop: '2px' }}>O que falta pro Sales Boost trabalhar melhor por você</div>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: '18px 14px 22px', borderTop: `1px solid ${BORDER}`, fontSize: '12.5px', fontWeight: 700, color: '#4ade80' }}>
                ✓ Tudo em dia. O Hermes está trabalhando.
              </div>
            ) : (
              <>
                {visible.map(p => <Row key={p.id} p={p} onPick={pick} />)}
                {!showAll && items.length > MAX_LINES && (
                  <button onClick={() => setShowAll(true)}
                    style={{ width: '100%', minHeight: '44px', background: 'transparent', border: 'none', borderTop: `1px solid ${BORDER}`, color: ORANGE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ver mais ({items.length - MAX_LINES})
                  </button>
                )}
              </>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
