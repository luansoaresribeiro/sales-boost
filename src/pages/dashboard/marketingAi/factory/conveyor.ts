// Esteira 1→5 (na frente das estações) e duto de retorno 5→3 (por cima, atrás). Tudo fixo e fundido no Kit (parado — C.2 não anima).
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Kit } from './sceneCore'
import type { Mats } from './stations'

export const BELT_Z = 3.2   // quanto a esteira fica na frente do centro de cada estação
type P = [number, number]   // x, z

export function buildConveyor(kit: Kit, m: Mats, pos: P[]) {
  for (let i = 0; i < pos.length - 1; i++) {
    const [x0, z0] = pos[i], [x1, z1] = pos[i + 1]
    const a = new THREE.Vector3(x0, 0, z0 + BELT_Z), b = new THREE.Vector3(x1, 0, z1 + BELT_Z)
    const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5), yaw = Math.atan2(b.x - a.x, b.z - a.z)
    const at = (dx: number, y: number, dz: number): [number, number, number] => [mid.x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, y, mid.z - Math.sin(yaw) * dx + Math.cos(yaw) * dz]
    kit.add(new RoundedBoxGeometry(0.62, 0.12, len, 2, 0.04), m.rubber, at(0, 0.5, 0), [0, yaw, 0])
    for (const s of [-1, 1]) kit.add(new THREE.BoxGeometry(0.06, 0.2, len), m.steel, at(s * 0.34, 0.54, 0), [0, yaw, 0])
    for (let k = 0; k <= 3; k++) { // pés
      const t = (k / 3 - 0.5) * (len - 0.4)
      for (const s of [-1, 1]) kit.add(new THREE.BoxGeometry(0.08, 0.44, 0.08), m.steel, at(s * 0.3, 0.22, t), [0, yaw, 0])
    }
    // setas de sentido (cones de 3 lados apontando 1→5)
    for (let k = 1; k <= 2; k++) {
      const t = (k / 3 - 0.5) * len
      kit.add(new THREE.ConeGeometry(0.16, 0.34, 3), m.edge, at(0, 0.62, t), [Math.PI / 2, yaw, 0])
    }
  }
}

// Duto de retorno: sai do topo da estação 5, passa por cima da 4 e entra na 3 (Resultados volta para a Estratégia).
export function buildReturnDuct(kit: Kit, m: Mats, from: P, to: P) {
  const mid = (from[0] + to[0]) / 2
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(from[0], 2.9, from[1] - 0.6), new THREE.Vector3(from[0], 4.7, from[1] - 1.6),
    new THREE.Vector3(mid, 5.2, Math.min(from[1], to[1]) - 2.0), new THREE.Vector3(to[0], 4.7, to[1] - 1.6), new THREE.Vector3(to[0], 3.0, to[1] - 0.6),
  ], false, 'catmullrom', 0.4)
  kit.add(new THREE.TubeGeometry(curve, 56, 0.17, 10, false), m.steel)
  for (const p of [curve.getPoint(0), curve.getPoint(1)]) kit.add(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 14), m.edge, [p.x, p.y, p.z])
  const mp = curve.getPoint(0.5), tan = curve.getTangent(0.5)
  kit.add(new THREE.ConeGeometry(0.26, 0.5, 3), m.edge, [mp.x, mp.y + 0.3, mp.z], [0, 0, Math.PI / 2 * Math.sign(-tan.x || 1)]) // seta de sentido (5 → 3)
  for (const t of [0.25, 0.75]) { // apoios
    const p = curve.getPoint(t)
    kit.add(new THREE.CylinderGeometry(0.07, 0.09, p.y, 8), m.dark, [p.x, p.y / 2, p.z])
  }
}
