import * as THREE from 'three'
import { dist2d } from '../core/math.js'

/**
 * 경험치 구슬. 적이 죽으면 떨어지고, 가까이 가면 빨려온다.
 * 줍는 맛이 있어야 앞으로 나가게 된다 — 뒤로 빼기만 하는 전투를 막는 장치이기도 하다.
 */
const MAGNET = 3.6      // 빨려오기 시작하는 거리
const GRAB = 0.8        // 먹는 거리

export class Pickups {
  constructor(scene, fx) {
    this.scene = scene
    this.fx = fx
    this.live = []
    this.pool = []
    this._geo = new THREE.IcosahedronGeometry(0.17, 0)
  }

  #take() {
    let m = this.pool.pop()
    if (!m) {
      m = new THREE.Mesh(this._geo, new THREE.MeshStandardMaterial({
        color: '#9fe0ff', emissive: '#2f8fd6', emissiveIntensity: 2.2, roughness: 0.3,
      }))
    }
    return m
  }

  drop(x, z, amount, count = 1) {
    for (let i = 0; i < count; i++) {
      const mesh = this.#take()
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 0.9
      const p = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r }
      mesh.position.set(p.x, 0.45, p.z)
      this.scene.add(mesh)
      this.live.push({ mesh, x: p.x, z: p.z, xp: amount, t: Math.random() * 6, vx: 0, vz: 0 })
    }
  }

  /** @returns 이번 프레임에 주운 경험치 총량 */
  update(dt, player) {
    let gained = 0
    for (let i = this.live.length - 1; i >= 0; i--) {
      const o = this.live[i]
      o.t += dt
      const d = dist2d({ x: o.x, z: o.z }, player.pos)

      if (d < MAGNET) {
        // 가까울수록 빠르게 — 끌려오는 느낌
        const pull = (1 - d / MAGNET) * 26 + 4
        const nx = (player.pos.x - o.x) / (d || 1), nz = (player.pos.z - o.z) / (d || 1)
        o.vx += nx * pull * dt
        o.vz += nz * pull * dt
      }
      o.vx *= Math.pow(0.02, dt); o.vz *= Math.pow(0.02, dt)
      o.x += o.vx * dt; o.z += o.vz * dt

      o.mesh.position.set(o.x, 0.42 + Math.sin(o.t * 3.4) * 0.1, o.z)
      o.mesh.rotation.y = o.t * 1.8
      o.mesh.rotation.x = o.t * 1.1

      if (d < GRAB) {
        gained += o.xp
        this.scene.remove(o.mesh)
        this.pool.push(o.mesh)
        this.live.splice(i, 1)
      }
    }
    return gained
  }

  clear() {
    for (const o of this.live) { this.scene.remove(o.mesh); this.pool.push(o.mesh) }
    this.live.length = 0
  }
}
