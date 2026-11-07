// Núcleo da cena 3D da fábrica (C.2): renderizador, luzes, câmera, controles, desenho SOB DEMANDA, qualidade, automedição de fps e
// descarte completo. A ideia da cena (máquina procedural em three.js, sem modelos nem imagens) vem do template
// "agentic-factory-3d" (github.com/eugeneshilow/agentic-3d-templates). Licença/termos conferidos em 04/11/2026 — uso no próprio
// projeto permitido, sem redistribuir o template (ver docs/DECISIONS.md). Aqui está tudo reescrito: sem conteúdo do original, sem
// ids globais, nada em `window`. Este arquivo só é carregado dentro do pedaço (chunk) da cena — nunca pelo hub nem pela página.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type ViewMode = 'overview' | 'side' | 'focus'
export const FPS_LOW_BELOW = 40      // abaixo disso: qualidade baixa (sem sombras, pixelRatio 1)
export const FPS_LEAVE_BELOW = 30    // continua abaixo disso depois: versão simples
const FPS_WINDOW_MS = 1500           // 2 janelas de 1,5 s de interação = os "primeiros ~3 s"
const MAX_PIXEL_RATIO = 1.5
const SHADOW_SIZE = 1024
const BG = 0x0e0b0a

export interface CoreOptions {
  container: HTMLElement
  reduceMotion: boolean
  startLow: boolean
  onSlow: () => void          // fps continua baixo mesmo na qualidade baixa
  onContextLost: () => void
  onQualityLow: () => void
}

// Peças fixas fundidas: tudo que não se mexe vira UMA malha por material (poucas chamadas de desenho).
export class Kit {
  private groups = new Map<THREE.Material, THREE.BufferGeometry[]>()
  origin: [number, number, number] = [0, 0, 0]   // deslocamento aplicado a tudo que for adicionado (posição da estação)
  add(src: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0]) {
    // Algumas geometrias do three vêm indexadas e outras não; pra fundir, todas viram não-indexadas.
    const geo = src.index ? src.toNonIndexed() : src
    if (geo !== src) src.dispose()
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(pos[0] + this.origin[0], pos[1] + this.origin[1], pos[2] + this.origin[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1)))
    const list = this.groups.get(mat) ?? []
    list.push(geo); this.groups.set(mat, list)
  }
  build(scene: THREE.Scene, track: <T extends { dispose(): void }>(x: T) => T): THREE.Mesh[] {
    const out: THREE.Mesh[] = []
    for (const [mat, list] of this.groups) {
      const merged = mergeGeometries(list, false)
      list.forEach(g => g.dispose())
      if (!merged) continue
      const mesh = new THREE.Mesh(track(merged), mat)
      mesh.castShadow = true; mesh.receiveShadow = true
      scene.add(mesh); out.push(mesh)
    }
    this.groups.clear()
    return out
  }
}

export interface Core {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  dom: HTMLCanvasElement
  track: <T extends { dispose(): void }>(x: T) => T
  requestRender: () => void
  onBeforeRender: (fn: () => void) => void
  setView: (mode: ViewMode, target?: THREE.Vector3, instant?: boolean) => void
  dispose: () => void
}

export function createCore(o: CoreOptions): Core {
  const { container } = o
  const tracked: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(x: T): T => { tracked.push(x); return x }
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  const camera = new THREE.PerspectiveCamera(33, 1, 0.5, 200)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.type = THREE.PCFShadowMap
  let low = o.startLow
  const applyQuality = () => {
    renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
    renderer.shadowMap.enabled = !low
    key.castShadow = !low
    scene.traverse(n => { const m = (n as THREE.Mesh).material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.needsUpdate = true }) })
    resize()
  }
  const dom = renderer.domElement
  dom.style.display = 'block'; dom.style.width = '100%'; dom.style.height = '100%'
  container.appendChild(dom)

  // Luzes: sem luz pontual extra. Sombra única, 1024.
  scene.add(new THREE.HemisphereLight(0xdde3ec, 0x2e2620, 2.0))
  const key = new THREE.DirectionalLight(0xfff0dc, 3.0)
  key.position.set(-6, 14, 9)
  key.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE)
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 9, bottom: -9, near: 1, far: 40 })
  key.shadow.normalBias = 0.04
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xb9c6dc, 0.9)
  fill.position.set(7, 6, -8)
  scene.add(fill)

  const controls = new OrbitControls(camera, dom)
  controls.enableDamping = !o.reduceMotion
  controls.dampingFactor = 0.09
  controls.enablePan = false
  controls.minDistance = 7; controls.maxDistance = 60
  controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI * 0.49
  controls.rotateSpeed = 0.55
  if (matchMedia('(pointer:coarse)').matches) { // celular: o dedo rola a página; o 3D se muda pelos botões de visão
    controls.enableRotate = false; controls.enableZoom = false; dom.style.touchAction = 'pan-y'
  }

  // ---- desenho sob demanda: nenhum requestAnimationFrame contínuo ----
  let raf = 0, paused = false, disposed = false
  const hooks: (() => void)[] = []
  let tween: { t0: number; dur: number; p0: THREE.Vector3; t1: THREE.Vector3; p1: THREE.Vector3; tg0: THREE.Vector3 } | null = null
  // medição de fps: só frames consecutivos (intervalo < 400 ms) contam como "interação"
  let lastTs = 0, accDt = 0, accFrames = 0, phase: 0 | 1 | 2 = o.startLow ? 1 : 0

  const schedule = () => { if (!raf && !paused && !disposed) raf = requestAnimationFrame(frame) }
  const sample = (ts: number) => {
    if (phase === 2) return
    if (lastTs && ts - lastTs < 400) { accDt += ts - lastTs; accFrames++ }
    lastTs = ts
    if (accDt < FPS_WINDOW_MS) return
    const fps = accFrames / (accDt / 1000)
    accDt = 0; accFrames = 0
    if (phase === 0) {
      if (fps >= FPS_LOW_BELOW) { phase = 2; return }
      low = true; applyQuality(); phase = 1; o.onQualityLow()
    } else {
      phase = 2
      if (fps < FPS_LEAVE_BELOW) o.onSlow()
    }
  }
  function frame(ts: number) {
    raf = 0
    if (disposed || paused) return
    let busy = controls.update()
    if (tween) {
      const k = Math.min(1, (ts - tween.t0) / tween.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      camera.position.lerpVectors(tween.p0, tween.p1, e)
      controls.target.lerpVectors(tween.tg0, tween.t1, e)
      camera.lookAt(controls.target)
      if (k >= 1) tween = null
      busy = true
    }
    hooks.forEach(h => h())
    renderer.render(scene, camera)
    sample(ts)
    if (busy) schedule()
  }
  controls.addEventListener('change', schedule)

  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h; camera.updateProjectionMatrix()
    schedule()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  // Fora da tela ou aba oculta: não desenha nada. Ao voltar, desenha 1 quadro.
  let inView = true
  const syncPause = () => { paused = !inView || document.hidden; if (paused && raf) { cancelAnimationFrame(raf); raf = 0 } else if (!paused) { lastTs = 0; schedule() } }
  const io = new IntersectionObserver(es => { inView = es[es.length - 1].isIntersecting; syncPause() })
  io.observe(container)
  document.addEventListener('visibilitychange', syncPause)
  const lost = (e: Event) => { e.preventDefault(); o.onContextLost() }
  dom.addEventListener('webglcontextlost', lost)

  const setView = (mode: ViewMode, target?: THREE.Vector3, instant = false) => {
    const fit = Math.max(0.95, 1.8 / camera.aspect)
    const tg = mode === 'focus' && target ? target.clone().add(new THREE.Vector3(0, 1.2, 0)) : new THREE.Vector3(0, 1.0, 0.8)
    const p = mode === 'overview' ? new THREE.Vector3(0, 10.5 * fit, 15 * fit)
      : mode === 'side' ? new THREE.Vector3(0, 3.2 * fit, 19 * fit)
      : tg.clone().add(new THREE.Vector3(0, 4.2, 11))
    if (o.reduceMotion || instant) { camera.position.copy(p); controls.target.copy(tg); camera.lookAt(tg); schedule(); return }
    tween = { t0: performance.now(), dur: 650, p0: camera.position.clone(), p1: p, tg0: controls.target.clone(), t1: tg }
    schedule()
  }
  resize()
  setView('overview', undefined, true)
  applyQuality()

  const dispose = () => {
    disposed = true
    if (raf) cancelAnimationFrame(raf)
    ro.disconnect(); io.disconnect()
    document.removeEventListener('visibilitychange', syncPause)
    dom.removeEventListener('webglcontextlost', lost)
    controls.removeEventListener('change', schedule)
    controls.dispose()
    scene.traverse(n => {
      const m = n as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(x => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose() })
    })
    tracked.forEach(t => t.dispose())
    key.shadow.map?.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    dom.remove()
  }
  return { scene, camera, dom, track, requestRender: schedule, onBeforeRender: fn => { hooks.push(fn) }, setView, dispose }
}
