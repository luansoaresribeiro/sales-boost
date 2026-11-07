import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createCore, type ViewMode } from './sceneCore'
import { buildFactory, type Factory } from './stations'
import type { StateKind, StationKey } from './factoryState'
import { STATION_KEYS } from './factoryState'

// Cena 3D da fábrica (carregada à parte por FactorySection via React.lazy — por isso é export default). Parada: só redesenha com
// câmera, passar o mouse, seleção ou estado novo. Sem movimento por evento (isso é a C.3).
interface Props {
  lang: 'pt' | 'en'
  kinds: Record<StationKey, StateKind>
  selected: StationKey | null
  view: ViewMode
  viewNonce: number                     // muda a cada clique em "Visão geral/Lateral/Foco" (reaplica a mesma visão)
  startLow: boolean
  onSelect: (k: StationKey | null) => void
  onSlow: () => void
  onFail: () => void
  onQualityLow: () => void
}

export default function FactoryScene(p: Props) {
  const box = useRef<HTMLDivElement>(null)
  const api = useRef<{ f: Factory; setView: (m: ViewMode, t?: THREE.Vector3) => void } | null>(null)
  const cb = useRef(p)
  useEffect(() => { cb.current = p })

  useEffect(() => {
    const el = box.current
    if (!el) return
    let c: ReturnType<typeof createCore>
    try {
      c = createCore({
        container: el, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, startLow: cb.current.startLow,
        onSlow: () => cb.current.onSlow(), onContextLost: () => cb.current.onFail(), onQualityLow: () => cb.current.onQualityLow(),
      })
    } catch { cb.current.onFail(); return }
    let f: Factory
    try { f = buildFactory(c, cb.current.lang) } catch { c.dispose(); cb.current.onFail(); return }
    api.current = { f, setView: c.setView }
    f.setStates(cb.current.kinds); f.setSelected(cb.current.selected)
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    const pick = (e: PointerEvent): StationKey | null => {
      const r = c.dom.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, c.camera)
      const hit = ray.intersectObjects(f.hits, false)[0]
      const k = hit?.object.userData.station as StationKey | undefined
      return k && STATION_KEYS.includes(k) ? k : null
    }
    let down: { x: number; y: number } | null = null, hover: StationKey | null = null
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) cb.current.onSelect(pick(e))
      down = null
    }
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return
      const k = pick(e)
      if (k !== hover) { hover = k; f.setHover(k); c.dom.style.cursor = k ? 'pointer' : 'grab' }
    }
    const onLeave = () => { if (hover) { hover = null; f.setHover(null) } }
    c.dom.addEventListener('pointerdown', onDown); c.dom.addEventListener('pointerup', onUp)
    c.dom.addEventListener('pointermove', onMove); c.dom.addEventListener('pointerleave', onLeave)
    c.dom.setAttribute('role', 'img')
    c.dom.setAttribute('aria-label', cb.current.lang === 'en' ? '3D factory with the 5 agent stations' : 'Fábrica 3D com as 5 estações dos agentes')
    return () => {
      c.dom.removeEventListener('pointerdown', onDown); c.dom.removeEventListener('pointerup', onUp)
      c.dom.removeEventListener('pointermove', onMove); c.dom.removeEventListener('pointerleave', onLeave)
      api.current = null
      c.dispose()
    }
  }, [])

  const kindsKey = STATION_KEYS.map(k => p.kinds[k]).join()
  useEffect(() => { api.current?.f.setStates(p.kinds) }, [kindsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.f.setSelected(p.selected) }, [p.selected])
  useEffect(() => {
    const a = api.current
    if (!a) return
    a.setView(p.view, p.view === 'focus' && p.selected ? a.f.worldPos(p.selected) : undefined)
  }, [p.view, p.viewNonce, p.selected && p.view === 'focus' ? p.selected : null]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} style={{ width: '100%', height: '100%' }} />
}
