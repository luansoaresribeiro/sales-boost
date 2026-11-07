// Os 5 robôs da fábrica (C.2.1): um por estação, procedurais e low-poly (caixas e poucas esferas; ~120 triângulos cada), sem modelo externo.
// A POSE vem de robotState.ts (estado real → pose); aqui só se desenha. Cada robô tem um gesto de trabalho próprio:
// Mercado gira a antena · Oportunidades separa peças no funil · Estratégia mexe na mesa · Ativação opera a prensa · Resultados olha os medidores.
// animate(t) com t em segundos = movimento (respiração/trabalho); animate(null) = pose ESTÁTICA do estado (escada de desempenho, reduzir movimento):
// continua mostrando a verdade (luz acesa de "Trabalhando", cabeça baixa de "Com problema"), só sem se mexer.
import * as THREE from 'three'
import type { Core } from './sceneCore'
import { STATION_KEYS, type StateKind, type StationKey } from './factoryState'
import { robotPose, type RobotPose } from './robotState'

const ORANGE = 0xff6d29
// Onde o robô fica em relação ao centro da estação [x, z] (em cima da base, y = 0.36).
const SPOT: Record<StationKey, [number, number]> = { data: [0.95, 0.7], opportunities: [0, 1.15], strategy: [1.0, 1.25], content: [1.45, 0.3], conversion: [0, 0.95] }
const SCALE = 1.25
const STATIC_PHASE = 0.9   // fase fixa da pose estática de "Trabalhando" (meio do gesto)

interface Robot {
  key: StationKey
  root: THREE.Group; torso: THREE.Mesh; head: THREE.Group; armL: THREE.Group; armR: THREE.Group
  extra: THREE.Object3D            // peça do gesto (parabólica da antena / alavanca da prensa)
  bodyMat: THREE.MeshStandardMaterial; lightMat: THREE.MeshStandardMaterial
  pose: RobotPose
}

const LIGHT: Record<RobotPose, { color: number; glow: number }> = {
  working: { color: ORANGE, glow: 2.4 }, waiting: { color: ORANGE, glow: 0.9 }, resting: { color: 0xe8e2d8, glow: 0.35 }, problem: { color: 0xa32a22, glow: 1.3 }, off: { color: 0x2a2a2a, glow: 0 },
}

export interface Robots {
  group: THREE.Group
  setKinds: (k: Record<StationKey, StateKind>) => void
  animate: (t: number | null) => void
  needsMotion: () => boolean       // algum robô descansando/trabalhando (os únicos que se mexem)
}

export function buildRobots(core: Core, stationPos: Record<StationKey, [number, number]>): Robots {
  const { track } = core
  const group = new THREE.Group()
  const box = (w: number, h: number, d: number) => track(new THREE.BoxGeometry(w, h, d))
  const G = { leg: box(0.14, 0.42, 0.15), torso: box(0.5, 0.52, 0.34), head: box(0.4, 0.3, 0.34), visor: box(0.3, 0.08, 0.02), chest: box(0.14, 0.1, 0.02), arm: box(0.11, 0.4, 0.11), hand: box(0.14, 0.1, 0.14),
    mast: track(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6)), dish: track(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4)), cube: box(0.16, 0.16, 0.16), lever: box(0.06, 0.62, 0.06), knob: track(new THREE.SphereGeometry(0.07, 8, 6)) }
  const dark = track(new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.3, roughness: 0.6 }))
  const accent = track(new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.2, roughness: 0.5 }))
  const pale = track(new THREE.MeshStandardMaterial({ color: 0xdad4c8, metalness: 0.1, roughness: 0.6 }))
  const robots: Robot[] = []

  for (const key of STATION_KEYS) {
    const bodyMat = track(new THREE.MeshStandardMaterial({ color: 0xaab3bd, metalness: 0.35, roughness: 0.5 }))
    const lightMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0x2a2a2a, emissiveIntensity: 0, metalness: 0, roughness: 0.4 }))
    const root = new THREE.Group()
    const [sx, sz] = stationPos[key], [ox, oz] = SPOT[key]
    root.position.set(sx + ox, 0.36, sz + oz); root.scale.setScalar(SCALE)
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m }
    for (const x of [-0.12, 0.12]) add(G.leg, dark, root, x, 0.21, 0)
    const torso = add(G.torso, bodyMat, root, 0, 0.68, 0)
    add(G.chest, lightMat, torso, 0, 0.06, 0.18)
    const head = new THREE.Group(); head.position.set(0, 1.0, 0); root.add(head)
    add(G.head, bodyMat, head, 0, 0.15, 0); add(G.visor, lightMat, head, 0, 0.17, 0.18)
    const mkArm = (x: number) => { const a = new THREE.Group(); a.position.set(x, 0.88, 0); root.add(a); add(G.arm, bodyMat, a, 0, -0.2, 0); add(G.hand, dark, a, 0, -0.43, 0); return a }
    const armL = mkArm(-0.34), armR = mkArm(0.34)
    let extra: THREE.Object3D = new THREE.Group()
    if (key === 'data') { // antena na cabeça: a parabólica gira quando trabalha
      const g = new THREE.Group(); g.position.set(0, 0.3, 0); head.add(g); add(G.mast, dark, g, 0, 0.11, 0)
      const dish = add(G.dish, accent, g, 0, 0.24, 0); dish.rotation.x = -0.9; extra = g
    } else if (key === 'opportunities') { // uma peça clara e uma escura nas mãos (separa as peças)
      add(G.cube, pale, armL, 0, -0.55, 0.02); add(G.cube, accent, armR, 0, -0.55, 0.02)
    } else if (key === 'content') { // alavanca da prensa ao lado do robô
      const lv = new THREE.Group(); lv.position.set(0.62, 0.55, 0.05); root.add(lv)
      add(G.lever, dark, lv, 0, 0.26, 0); add(G.knob, accent, lv, 0, 0.6, 0); extra = lv
    }
    group.add(root)
    robots.push({ key, root, torso, head, armL, armR, extra, bodyMat, lightMat, pose: 'off' })
  }
  core.scene.add(group)

  const setLook = (r: Robot) => {
    const L = LIGHT[r.pose]
    r.lightMat.color.setHex(L.color); r.lightMat.emissive.setHex(L.color); r.lightMat.emissiveIntensity = L.glow
    r.bodyMat.color.setHex(r.pose === 'off' ? 0x3a3d42 : 0xaab3bd)    // desligado = acinzentado e escuro
    r.bodyMat.emissive.setHex(0x000000)
  }

  // Pose do robô em função do tempo (t = null → estática).
  const apply = (r: Robot, t: number | null) => {
    const { head, armL, armR, torso, extra } = r
    torso.scale.set(1, 1, 1); torso.rotation.x = 0; head.rotation.set(0, 0, 0); head.position.y = 1.0
    armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0); extra.rotation.set(0, 0, 0)
    if (r.pose === 'off') { head.rotation.x = 0.12; return }
    if (r.pose === 'problem') { head.rotation.x = 0.75; torso.rotation.x = 0.12; armL.rotation.z = 0.12; armR.rotation.z = -0.12; return }
    if (r.pose === 'waiting') { head.rotation.x = 0.35; return }  // parado, olhando pra baixo/frente, pro anel laranja
    if (r.pose === 'resting') {
      const b = t == null ? 0 : Math.sin(t * 1.7)                   // respiração: movimento pequeno
      torso.scale.y = 1 + 0.02 * b; head.position.y = 1.0 + 0.012 * b; armL.rotation.z = 0.02 * b; armR.rotation.z = -0.02 * b
      return
    }
    const ph = t == null ? STATIC_PHASE : t
    const s = (f: number, o = 0) => Math.sin(ph * f + o)
    switch (r.key) {
      case 'data': { // braço levantado, a parabólica gira
        armR.rotation.x = -2.4; armR.rotation.z = -0.25; head.rotation.y = 0.25 * s(1.1)
        extra.rotation.y = ph * 3.2; break
      }
      case 'opportunities': // uma mão sobe enquanto a outra desce, peças de lados separados
        armL.rotation.x = -1.0 + 0.5 * s(5); armR.rotation.x = -1.0 - 0.5 * s(5); head.rotation.y = 0.2 * s(2.5); break
      case 'strategy': // mãos tamborilando na mesa, cabeça acompanha
        armL.rotation.x = -1.05 + 0.22 * s(6); armR.rotation.x = -1.05 + 0.22 * s(6, Math.PI); head.rotation.y = 0.25 * s(1.4); head.rotation.x = 0.2; break
      case 'content': { // puxa a alavanca da prensa
        const k = 0.5 + 0.5 * s(3)
        armR.rotation.x = -0.35 - 1.0 * k; armR.rotation.z = -0.55; extra.rotation.x = -0.1 - 0.9 * k; torso.rotation.x = 0.1 * k; head.rotation.x = 0.1; break
      }
      case 'conversion': // olha os medidores: cabeça varre da esquerda pra direita, olhando um pouco pra cima
        head.rotation.y = 0.7 * s(1.4); head.rotation.x = -0.22; armR.rotation.x = -1.25 + 0.08 * s(2); break
    }
  }

  let t0 = 0
  const refresh = (t: number | null) => robots.forEach(r => apply(r, t))
  return {
    group,
    setKinds: kinds => { robots.forEach(r => { r.pose = robotPose(r.key, kinds[r.key]); setLook(r) }); refresh(null); core.requestRender() },
    animate: t => {
      if (t == null) { refresh(null); return }
      if (!t0) t0 = t
      refresh(t - t0)
    },
    needsMotion: () => robots.some(r => r.pose === 'resting' || r.pose === 'working'),
  }
}
