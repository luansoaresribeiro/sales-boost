import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createCore } from './sceneCore'
import { buildFactory, type Factory } from './stations'
import type { StateKind, StationKey } from './factoryState'
import { STATION_KEYS } from './factoryState'

// Cena 3D da fábrica (carregada à parte por FactorySection via React.lazy SÓ depois de a cortina abrir — por isso é export default).
// Câmera livre (sceneCore), robôs com a pose do estado real (robots.ts). Sem movimento por evento (isso é a C.3).
interface Props {
  lang: 'pt' | 'en'
  kinds: Record<StationKey, StateKind>
  selected: StationKey | null
  flyNonce: number                      // muda a cada pedido de "voar até a estação selecionada" (mesmo clicando na mesma de novo)
  homeNonce: number                     // muda a cada "voltar à visão inicial"
  startLow: boolean
  sheet: boolean                        // painel sobe de baixo (celular) em vez de abrir do lado
  onSelect: (k: StationKey | null) => void
  onSlow: () => void
  onFrozen: () => void
  onFail: () => void
  onQualityLow: () => void
}

export default function FactoryScene(p: Props) {
  const box = useRef<HTMLDivElement>(null)
  const api = useRef<{ f: Factory; fly: (k: StationKey) => void; home: () => void } | null>(null)
  const cb = useRef(p)
  useEffect(() => { cb.current = p })

  useEffect(() => {
    const el = box.current
    if (!el) return
    let c: ReturnType<typeof createCore>
    try {
      c = createCore({
        container: el, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, startLow: cb.current.startLow,
        onSlow: () => cb.current.onSlow(), onFrozen: () => { api.current?.f.freeze(); cb.current.onFrozen() }, onContextLost: () => cb.current.onFail(), onQualityLow: () => cb.current.onQualityLow(),
      })
    } catch { cb.current.onFail(); return }
    let f: Factory
    try { f = buildFactory(c, cb.current.lang) } catch { c.dispose(); cb.current.onFail(); return }
    api.current = { f, fly: k => c.flyTo(f.worldPos(k), false, cb.current.sheet ? { down: 3.4 } : { right: 1.7 }), home: () => c.home() }
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
    // toque simples (sem arrastar e sem 2º dedo) seleciona; tocar fora de estação fecha o painel
    let down: { x: number; y: number } | null = null, hover: StationKey | null = null, touches = 0, multi = false
    const onDown = (e: PointerEvent) => { touches++; if (touches > 1) multi = true; down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (down && !multi && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) cb.current.onSelect(pick(e))
      touches = Math.max(0, touches - 1); if (!touches) multi = false
      down = null
    }
    const onCancel = () => { touches = 0; multi = false; down = null }
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return
      const k = pick(e)
      if (k !== hover) { hover = k; f.setHover(k); c.dom.style.cursor = k ? 'pointer' : 'grab' }
    }
    const onLeave = () => { if (hover) { hover = null; f.setHover(null) } }
    c.dom.addEventListener('pointerdown', onDown); c.dom.addEventListener('pointerup', onUp)
    c.dom.addEventListener('pointermove', onMove); c.dom.addEventListener('pointerleave', onLeave); c.dom.addEventListener('pointercancel', onCancel)
    c.dom.setAttribute('role', 'img')
    c.dom.setAttribute('aria-label', cb.current.lang === 'en' ? '3D factory with the 5 agent stations, one robot each. Drag to rotate, pinch or scroll to zoom.' : 'Fábrica 3D com as 5 estações dos agentes, um robô em cada. Arraste para girar, pinça ou rodinha para aproximar.')
    return () => {
      c.dom.removeEventListener('pointerdown', onDown); c.dom.removeEventListener('pointerup', onUp)
      c.dom.removeEventListener('pointermove', onMove); c.dom.removeEventListener('pointerleave', onLeave); c.dom.removeEventListener('pointercancel', onCancel)
      api.current = null
      c.dispose()
    }
  }, [])

  const kindsKey = STATION_KEYS.map(k => p.kinds[k]).join()
  useEffect(() => { api.current?.f.setStates(p.kinds) }, [kindsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.f.setSelected(p.selected) }, [p.selected])
  useEffect(() => { if (p.selected) api.current?.fly(p.selected) }, [p.selected, p.flyNonce])
  const firstHome = useRef(p.homeNonce)
  useEffect(() => { if (p.homeNonce !== firstHome.current) api.current?.home() }, [p.homeNonce])

  return <div ref={box} style={{ width: '100%', height: '100%' }} />
}
