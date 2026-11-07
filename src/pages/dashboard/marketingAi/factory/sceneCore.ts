// Núcleo da cena 3D da fábrica (C.2): renderizador, luzes, câmera, controles, desenho SOB DEMANDA, qualidade, automedição de fps e
// descarte completo. A ideia da cena (máquina procedural em three.js, sem modelos nem imagens) vem do template
// "agentic-factory-3d" (github.com/eugeneshilow/agentic-3d-templates). Licença/termos conferidos em 04/11/2026 — uso no próprio
// projeto permitido, sem redistribuir o template (ver docs/DECISIONS.md). Aqui está tudo reescrito: sem conteúdo do original, sem
// ids globais, nada em `window`. Este arquivo só é carregado dentro do pedaço (chunk) da cena — nunca pelo hub nem pela página.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Escada de desempenho (C.2.1), cada degrau só depois de uma janela de 1,5 s ruim:
//   1) qualidade baixa (sem sombras, pixelRatio 1)  2) robôs congelados (pose estática do estado, ainda mostra a verdade)  3) versão leve, lembrada no aparelho.
// Janela de interação (girar/aproximar): ruim = abaixo de 40 fps (degrau 1) / 30 fps (degraus 2 e 3). Janela de movimento ambiente
// (robôs, limitado a ~30 fps de propósito): ruim = abaixo de 20 fps de verdade.
export const FPS_LOW_BELOW = 40
export const FPS_LEAVE_BELOW = 30
export const AMBIENT_BAD_BELOW = 20
export const AMBIENT_FPS = 30        // teto do movimento ambiente (respiração/trabalho dos robôs)
const FPS_WINDOW_MS = 1500
const HOME_TARGET = new THREE.Vector3(0, 1.0, 0.8)
const BOUNDS = { x: 11, zMin: -6, zMax: 7, yMax: 4 }   // o alvo da câmera não sai da área da fábrica
const MAX_PIXEL_RATIO = 1.5
const SHADOW_SIZE = 1024
const BG = 0x0e0b0a

export interface CoreOptions {
  container: HTMLElement
  reduceMotion: boolean
  startLow: boolean
  onSlow: () => void          // degrau 3: continua ruim mesmo congelado → versão leve
  onFrozen: () => void        // degrau 2: robôs congelados
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
  onBeforeRender: (fn: (ts: number) => void) => void
  home: (instant?: boolean) => void
  flyTo: (target: THREE.Vector3, instant?: boolean, shift?: { right?: number; down?: number }) => void
  setAmbient: (want: boolean) => void   // há robô que se mexe? (laço ambiente só roda se sim)
  ambientOn: () => boolean              // querendo E não congelado E sem "reduzir movimento"
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

  // Câmera livre: arrastar gira, pinça/rodinha aproxima, dois dedos/botão direito desloca. Limites: não atravessa o chão
  // (maxPolarAngle < 90°), zoom mínimo/máximo, alvo preso na área da fábrica (clampTarget). O dedo no canvas NÃO rola a página
  // (touch-action none) — por isso a cortina aberta ocupa no máximo ~70% da altura da tela e a página rola pelo resto.
  const controls = new OrbitControls(camera, dom)
  controls.enableDamping = !o.reduceMotion
  controls.dampingFactor = 0.09
  controls.enablePan = true; controls.screenSpacePanning = false; controls.panSpeed = 0.8
  controls.minDistance = 4.5; controls.maxDistance = 60
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = Math.PI * 0.47
  controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
  dom.style.touchAction = 'none'
  const clampTarget = () => {
    const t = controls.target
    const d = new THREE.Vector3(THREE.MathUtils.clamp(t.x, -BOUNDS.x, BOUNDS.x) - t.x, THREE.MathUtils.clamp(t.y, 0, BOUNDS.yMax) - t.y, THREE.MathUtils.clamp(t.z, BOUNDS.zMin, BOUNDS.zMax) - t.z)
    if (d.lengthSq() > 0) { t.add(d); camera.position.add(d) }
  }

  // ---- desenho sob demanda: sem requestAnimationFrame com a cena parada ----
  // O laço só existe quando há motivo: interação/voo de câmera/estado novo (até assentar) OU movimento ambiente dos robôs (≤ 30 fps).
  // Cortina fechada = esta cena nem existe. Fora da tela ou aba oculta = nada roda.
  let raf = 0, timer = 0, paused = false, disposed = false, ambientWanted = false, frozen = false
  const hooks: ((ts: number) => void)[] = []
  let tween: { t0: number; dur: number; p0: THREE.Vector3; t1: THREE.Vector3; p1: THREE.Vector3; tg0: THREE.Vector3 } | null = null
  const ambientOn = () => ambientWanted && !frozen && !o.reduceMotion
  // medição de fps por tipo de janela; só intervalos < 400 ms contam
  const acc = { busy: { dt: 0, n: 0 }, amb: { dt: 0, n: 0 } }
  let lastTs = 0, phase: 1 | 2 | 3 | 4 = o.startLow ? 2 : 1   // 1 cheia · 2 qualidade baixa · 3 robôs congelados · 4 sem degrau (já foi pra versão leve)

  const schedule = () => {
    if (disposed || paused) return
    if (timer) { clearTimeout(timer); timer = 0 }
    if (!raf) raf = requestAnimationFrame(frame)
  }
  const stepDown = () => {
    if (phase === 1) { low = true; applyQuality(); phase = 2; o.onQualityLow() }
    else if (phase === 2) { frozen = true; phase = 3; schedule(); o.onFrozen() }
    else if (phase === 3) { phase = 4; o.onSlow() }
  }
  const sample = (ts: number, busy: boolean) => {
    if (phase === 4) return
    const a = busy ? acc.busy : acc.amb
    if (lastTs && ts - lastTs < 400) { a.dt += ts - lastTs; a.n++ }
    lastTs = ts
    if (a.dt < FPS_WINDOW_MS) return
    const fps = a.n / (a.dt / 1000)
    acc.busy = { dt: 0, n: 0 }; acc.amb = { dt: 0, n: 0 }
    const bad = busy ? fps < (phase === 1 ? FPS_LOW_BELOW : FPS_LEAVE_BELOW) : fps < AMBIENT_BAD_BELOW
    if (bad) stepDown()
  }
  function frame(ts: number) {
    raf = 0
    if (disposed || paused) return
    const w0 = performance.now()
    let busy = controls.update()
    if (tween) {
      const k = Math.min(1, (ts - tween.t0) / tween.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      camera.position.lerpVectors(tween.p0, tween.p1, e)
      controls.target.lerpVectors(tween.tg0, tween.t1, e)
      camera.lookAt(controls.target)
      if (k >= 1) tween = null
      busy = true
    }
    hooks.forEach(h => h(ts))
    renderer.render(scene, camera)
    sample(ts, busy)
    if (busy) schedule()
    else if (ambientOn() && !timer) timer = window.setTimeout(() => { timer = 0; schedule() }, Math.max(0, 1000 / AMBIENT_FPS - (performance.now() - w0) - 8))
  }
  controls.addEventListener('change', () => { clampTarget(); schedule() })

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
  const syncPause = () => {
    paused = !inView || document.hidden
    if (paused) { if (raf) cancelAnimationFrame(raf); raf = 0; if (timer) clearTimeout(timer); timer = 0 } else { lastTs = 0; schedule() }
  }
  const io = new IntersectionObserver(es => { inView = es[es.length - 1].isIntersecting; syncPause() })
  io.observe(container)
  document.addEventListener('visibilitychange', syncPause)
  const lost = (e: Event) => { e.preventDefault(); o.onContextLost() }
  dom.addEventListener('webglcontextlost', lost)

  const fit = () => Math.max(1.12, 1.8 / camera.aspect)
  const go = (p: THREE.Vector3, tg: THREE.Vector3, instant: boolean) => {
    if (o.reduceMotion || instant) { tween = null; camera.position.copy(p); controls.target.copy(tg); camera.lookAt(tg); schedule(); return }
    tween = { t0: performance.now(), dur: 650, p0: camera.position.clone(), p1: p, tg0: controls.target.clone(), t1: tg }
    schedule()
  }
  const home = (instant = false) => go(new THREE.Vector3(0, 10.5 * fit(), 15 * fit()), HOME_TARGET.clone(), instant)
  // Voo até uma estação: mantém o ângulo de giro atual, aproxima e olha de uma altura confortável.
  // shift: deixa a estação fora do painel (right = ela aparece à esquerda do centro; down = aparece mais acima, pra folha de baixo do celular).
  const flyTo = (target: THREE.Vector3, instant = false, shift: { right?: number; down?: number } = {}) => {
    const aim = target.clone().add(new THREE.Vector3(0, 1.3 - (shift.down ?? 0), 0))
    if (shift.right) { const r = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0); r.y = 0; aim.add(r.normalize().multiplyScalar(shift.right)) }
    const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    sph.radius = THREE.MathUtils.clamp(10.5 * Math.max(1, 1.15 / camera.aspect), controls.minDistance, controls.maxDistance)
    sph.phi = THREE.MathUtils.clamp(sph.phi, 0.95, 1.3)
    go(aim.clone().add(new THREE.Vector3().setFromSpherical(sph)), aim, instant)
  }
  resize()
  home(true)
  applyQuality()

  const dispose = () => {
    disposed = true
    if (raf) cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
    raf = 0; timer = 0
    ro.disconnect(); io.disconnect()
    document.removeEventListener('visibilitychange', syncPause)
    dom.removeEventListener('webglcontextlost', lost)
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
  return { scene, camera, dom, track, requestRender: schedule, onBeforeRender: fn => { hooks.push(fn) }, home, flyTo, setAmbient: w => { ambientWanted = w; schedule() }, ambientOn, dispose }
}
