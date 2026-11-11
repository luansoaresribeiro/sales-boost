// As 5 estações da fábrica (C.2), em arco na ordem do fluxo: 1 antena/radar · 2 funil · 3 mesa de controle · 4 prensa · 5 painel de
// medidores. Peças fixas vão pro Kit (fundidas por material). Cores: grafite/aço escuro; laranja SÓ na luz de estado e no anel de
// aprovação; vermelho fosco só na falha. Placas têm só número + nome real. Nenhum número ou texto inventado na cena.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Core } from './sceneCore'
import { Kit } from './sceneCore'
import { buildConveyor, buildReturnDuct } from './conveyor'
import { STATION_KEYS, type StateKind, type StationKey } from './factoryState'
import { buildRobots } from './robots'

export const ORANGE = 0xff6d29
const RED = 0xa32a22

export const STATION_POS: Record<StationKey, [number, number]> = (() => {
  const o = {} as Record<StationKey, [number, number]>
  STATION_KEYS.forEach((k, i) => { const d = i - 2; o[k] = [d * 3.9, 0.3 * d * d - 0.8] })   // arco aberto pra câmera
  return o
})()

export interface Mats { graphite: THREE.MeshStandardMaterial; graphiteDS: THREE.MeshStandardMaterial; steel: THREE.MeshStandardMaterial; edge: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; floor: THREE.MeshStandardMaterial }
const std = (color: number, metalness: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra })

// Luz de estado: cor + intensidade por estado. Parado: só muda quando o estado muda.
const LAMP: Record<StateKind, { color: number; glow: number }> = {
  unknown: { color: 0x5b5b5b, glow: 0 }, unavailable: { color: 0x3a3a3a, glow: 0 }, standby: { color: 0x7a6f66, glow: 0.12 },
  approval: { color: ORANGE, glow: 1.4 }, processing: { color: ORANGE, glow: 2 }, scheduled: { color: ORANGE, glow: 0.6 },
  queued: { color: ORANGE, glow: 1 }, late: { color: ORANGE, glow: 1.7 }, recent: { color: 0xe8e2d8, glow: 0.7 }, failed: { color: RED, glow: 0.3 },
}

export const STATION_NAMES = { pt: ['Inteligência de Mercado', 'Motor de Oportunidades', 'Agente de Estratégia', 'Ativação', 'Resultados e Aprendizado'], en: ['Market Intelligence', 'Opportunity Engine', 'Strategy Agent', 'Activation', 'Results & Learning'] }

function plateTexture(n: number, name: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 640; c.height = 170
  const g = c.getContext('2d')!
  g.fillStyle = '#1b1816'; g.fillRect(0, 0, 640, 170)
  g.strokeStyle = '#5a544d'; g.lineWidth = 6; g.strokeRect(5, 5, 630, 160)
  g.fillStyle = '#f4f1ea'; g.font = '800 100px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(String(n), 34, 88)
  g.fillStyle = '#6b655e'; g.fillRect(118, 26, 4, 118)
  g.fillStyle = '#e9e5de'; g.font = '700 44px system-ui, sans-serif'
  const words = name.split(' '); let l1 = name, l2 = ''
  if (g.measureText(name).width > 470) { const h = Math.ceil(words.length / 2); l1 = words.slice(0, h).join(' '); l2 = words.slice(h).join(' ') }
  if (l2) { g.fillText(l1, 146, 58); g.fillText(l2, 146, 114) } else g.fillText(l1, 146, 88)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

function addStationBody(kit: Kit, m: Mats, key: StationKey) {
  const B = (w: number, h: number, d: number, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3))
  const C = (rt: number, rb: number, h: number, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s)
  kit.add(B(3.1, 0.3, 2.7, 0.1), m.steel, [0, 0.15, 0]); kit.add(B(2.7, 0.06, 2.3, 0.02), m.dark, [0, 0.33, 0])
  if (key === 'data') { // antena/radar
    kit.add(B(1.2, 0.8, 0.9), m.graphite, [-0.7, 0.75, 0.5]); kit.add(C(0.1, 0.14, 2.6), m.edge, [0, 1.65, -0.2]); kit.add(C(0.3, 0.3, 0.3), m.graphite, [0, 0.5, -0.2])
    kit.add(new THREE.SphereGeometry(1.1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 3), m.graphiteDS, [0, 3.1, -0.2], [-1.0, 0, 0])
    kit.add(C(0.04, 0.04, 0.9, 8), m.edge, [0, 3.45, 0.2], [-1.0, 0, 0]); kit.add(new THREE.SphereGeometry(0.1, 10, 8), m.edge, [0, 3.85, 0.58])
  } else if (key === 'opportunities') { // funil
    for (const [x, z] of [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]]) kit.add(C(0.06, 0.07, 1.9, 8), m.edge, [x, 1.28, z])
    kit.add(new THREE.CylinderGeometry(1.2, 0.3, 1.15, 28, 1, true), m.graphiteDS, [0, 2.3, 0]); kit.add(new THREE.TorusGeometry(1.2, 0.07, 8, 32), m.edge, [0, 2.88, 0], [Math.PI / 2, 0, 0])
    kit.add(C(0.2, 0.2, 0.6, 14), m.steel, [0, 1.4, 0]); kit.add(B(1.2, 0.5, 0.9), m.graphite, [0, 0.62, 0])
  } else if (key === 'strategy') { // mesa de controle
    kit.add(B(2.6, 0.9, 1.2), m.graphite, [0, 0.78, 0.3]); kit.add(B(2.5, 0.1, 1.0, 0.03), m.dark, [0, 1.3, 0.3], [-0.3, 0, 0])
    for (const [x, ry] of [[-0.85, 0.3], [0, 0], [0.85, -0.3]] as const) { kit.add(C(0.04, 0.04, 0.7, 8), m.edge, [x, 1.65, -0.35]); kit.add(B(0.78, 0.5, 0.06, 0.02), m.dark, [x, 2.1, -0.4], [-0.1, ry, 0]) }
    kit.add(B(2.8, 0.14, 0.2), m.edge, [0, 2.7, -0.85])
  } else if (key === 'content') { // prensa
    for (const x of [-0.95, 0.95]) kit.add(B(0.28, 2.5, 0.3), m.graphite, [x, 1.55, -0.3])
    kit.add(B(2.4, 0.42, 0.7), m.graphite, [0, 2.7, -0.3]); kit.add(C(0.2, 0.2, 0.9), m.edge, [0, 2.0, -0.3]); kit.add(B(1.1, 0.26, 0.8), m.steel, [0, 1.45, -0.3]); kit.add(B(1.7, 0.5, 1.0), m.steel, [0, 0.6, -0.3])
  } else { // painel com medidores
    kit.add(B(1.5, 0.9, 0.9), m.graphite, [0, 0.78, -0.3]); kit.add(B(2.7, 1.9, 0.26), m.dark, [0, 1.95, -0.65])
    for (const x of [-0.85, 0, 0.85]) {
      kit.add(C(0.38, 0.38, 0.06, 28), m.edge, [x, 2.15, -0.5], [Math.PI / 2, 0, 0]); kit.add(new THREE.TorusGeometry(0.4, 0.05, 8, 28), m.steel, [x, 2.15, -0.48])
      kit.add(B(0.04, 0.3, 0.02, 0.005), m.dark, [x - 0.1, 2.05, -0.46], [0, 0, 0.9]) // ponteiros em repouso (sem valor)
    }
    kit.add(B(2.2, 0.16, 0.06, 0.02), m.edge, [0, 1.35, -0.5])
  }
}

export interface Factory {
  hits: THREE.Mesh[]
  setStates: (s: Record<StationKey, StateKind>) => void
  setSelected: (k: StationKey | null) => void
  setHover: (k: StationKey | null) => void
  worldPos: (k: StationKey) => THREE.Vector3
  freeze: () => void      // escada de desempenho: robôs param na pose estática do estado (continua mostrando a verdade)
}

export function buildFactory(core: Core, lang: 'pt' | 'en'): Factory {
  const { scene, track } = core
  const m: Mats = {
    graphite: std(0x3b4149, 0.3, 0.55), graphiteDS: std(0x3b4149, 0.3, 0.55, { side: THREE.DoubleSide }), steel: std(0x59616b, 0.45, 0.45),
    edge: std(0x8b929c, 0.5, 0.38), dark: std(0x1a1d22, 0.3, 0.6), rubber: std(0x0b0c0e, 0.1, 0.7), floor: std(0x2a2421, 0.2, 0.8),
  }
  Object.values(m).forEach(x => track(x))
  const kit = new Kit()
  kit.add(new RoundedBoxGeometry(24, 0.3, 12.5, 2, 0.12), m.floor, [0, -0.15, 0.6])
  STATION_KEYS.forEach(k => { kit.origin = [STATION_POS[k][0], 0, STATION_POS[k][1]]; addStationBody(kit, m, k) })
  kit.origin = [0, 0, 0]
  const pos = STATION_KEYS.map(k => STATION_POS[k])
  buildConveyor(kit, m, pos)
  buildReturnDuct(kit, m, STATION_POS.conversion, STATION_POS.strategy)
  kit.build(scene, track)

  // Parte dinâmica por estação: luz de estado, anel de aprovação, placa e área de clique.
  const lamps = new Map<StationKey, THREE.Mesh>(), rings = new Map<StationKey, THREE.Mesh>(), hits: THREE.Mesh[] = []
  const lampMats = new Map<StateKind, THREE.MeshStandardMaterial>()
  const lampMat = (k: StateKind) => {
    let x = lampMats.get(k)
    if (!x) { x = track(std(LAMP[k].color, k === 'failed' ? 0.0 : 0.2, k === 'failed' ? 0.9 : 0.35, { emissive: LAMP[k].color, emissiveIntensity: LAMP[k].glow })); lampMats.set(k, x) }
    return x
  }
  const lampGeo = track(new THREE.SphereGeometry(0.34, 18, 12)), stalkGeo = track(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8))
  const ringGeo = track(new THREE.TorusGeometry(1.95, 0.06, 8, 56)), approvalMat = track(std(ORANGE, 0.2, 0.4, { emissive: ORANGE, emissiveIntensity: 1.2 }))
  const selMat = track(std(0xf4f1ea, 0.1, 0.5, { emissive: 0xf4f1ea, emissiveIntensity: 0.45 })), hoverMat = track(std(0x8c867e, 0.1, 0.6, { emissive: 0x8c867e, emissiveIntensity: 0.25 }))
  const hitGeo = track(new THREE.BoxGeometry(3.3, 3.8, 3.0)), hitMat = track(new THREE.MeshBasicMaterial({ visible: false }))
  const plateGeo = track(new THREE.PlaneGeometry(3.0, 0.8))
  const topY: Record<StationKey, number> = { data: 4.1, opportunities: 3.3, strategy: 3.2, content: 3.2, conversion: 3.4 }
  STATION_KEYS.forEach((k, i) => {
    const [x, z] = STATION_POS[k]
    const stalk = new THREE.Mesh(stalkGeo, m.edge); stalk.position.set(x + 1.3, topY[k] - 0.55, z + 1.0); scene.add(stalk)
    const lamp = new THREE.Mesh(lampGeo, lampMat('unknown')); lamp.position.set(x + 1.3, topY[k] - 0.1, z + 1.0); scene.add(lamp); lamps.set(k, lamp)
    const ring = new THREE.Mesh(ringGeo, approvalMat); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.42, z); ring.visible = false; scene.add(ring); rings.set(k, ring)
    const plate = new THREE.Mesh(plateGeo, track(new THREE.MeshBasicMaterial({ map: track(plateTexture(i + 1, STATION_NAMES[lang][i])), toneMapped: false })))
    plate.position.set(x, 0.62, z + 1.85); plate.rotation.x = -0.9; plate.userData.station = k; scene.add(plate); hits.push(plate)
    const hit = new THREE.Mesh(hitGeo, hitMat); hit.position.set(x, 1.7, z); hit.userData.station = k; scene.add(hit); hits.push(hit)
  })
  const marker = (mat: THREE.Material, r: number) => { const me = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.05, 8, 56)), mat); me.rotation.x = Math.PI / 2; me.visible = false; scene.add(me); return me }
  const selRing = marker(selMat, 2.2), hoverRing = marker(hoverMat, 2.2)
  const place = (me: THREE.Mesh, k: StationKey | null) => { if (!k) { me.visible = false; return }; const [x, z] = STATION_POS[k]; me.position.set(x, 0.38, z); me.visible = true }

  // Robôs (C.2.1): pose vem do estado real (robotState). O movimento ambiente só roda se algum robô descansa/trabalha.
  const robots = buildRobots(core, STATION_POS)
  core.onBeforeRender(ts => { if (core.ambientOn()) robots.animate(ts / 1000) })
  return {
    hits,
    setStates: s => {
      STATION_KEYS.forEach(k => { lamps.get(k)!.material = lampMat(s[k]); rings.get(k)!.visible = s[k] === 'approval' })
      robots.setKinds(s); core.setAmbient(robots.needsMotion()); core.requestRender()
    },
    freeze: () => { robots.animate(null); core.requestRender() },
    setSelected: k => { place(selRing, k); core.requestRender() },
    setHover: k => { place(hoverRing, k); core.requestRender() },
    worldPos: k => new THREE.Vector3(STATION_POS[k][0], 0, STATION_POS[k][1]),
  }
}
