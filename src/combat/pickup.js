import * as THREE from 'three'
import { dist2d } from '../core/math.js'

/**
 * 전리품. 키코네스족을 잡으면 그 자리에 떨어지고, 반드시 플레이어에게 날아온다.
 *
 * 거리 제한을 두지 않는 건 의도다. "3마리 잡으면 바지"가 약속인데
 * 줍지 못해서 못 입는 일이 생기면 안 된다. 다만 날아오는 데 시간이 걸리니
 * 앞으로 나가면 더 빨리 받는다.
 */
const GRAB = 0.9

export class Pickups {
  constructor(scene, fx) {
    this.scene = scene
    this.fx = fx
    this.live = []
    this.pool = []
    this._geo = new THREE.OctahedronGeometry(0.2, 0)
  }

  #take(color) {
    let m = this.pool.pop()
    if (!m) {
      m = new THREE.Mesh(this._geo, new THREE.MeshStandardMaterial({
        roughness: 0.25, metalness: 0.6, emissiveIntensity: 2.4,
      }))
      m.castShadow = true
    }
    m.material.color.set(color)
    m.material.emissive.set(color)
    return m
  }

  /** payload 는 도착했을 때 그대로 돌려준다. */
  drop(x, z, payload, { color = '#e8b45c', delay = 0.35 } = {}) {
    const mesh = this.#take(color)
    mesh.position.set(x, 0.6, z)
    this.scene.add(mesh)
    this.live.push({ mesh, x, z, y: 0.6, payload, t: 0, delay, vx: 0, vz: 0 })
    this.fx?.ring(x, z, { color, radius: 1.4, life: 0.4 })
  }

  /** @returns 이번 프레임에 도착한 payload 배열 */
  update(dt, player) {
    const got = []
    for (let i = this.live.length - 1; i >= 0; i--) {
      const o = this.live[i]
      o.t += dt

      if (o.t > o.delay) {                    // 잠깐 떠 있다가 날아온다
        const d = dist2d({ x: o.x, z: o.z }, player.pos) || 1
        const pull = 9 + Math.min(o.t - o.delay, 1.6) * 26
        o.vx += ((player.pos.x - o.x) / d) * pull * dt
        o.vz += ((player.pos.z - o.z) / d) * pull * dt
        o.vx *= Math.pow(0.04, dt); o.vz *= Math.pow(0.04, dt)
        o.x += o.vx * dt; o.z += o.vz * dt
        if (d < GRAB) {
          got.push(o.payload)
          this.scene.remove(o.mesh)
          this.pool.push(o.mesh)
          this.live.splice(i, 1)
          continue
        }
      }

      o.mesh.position.set(o.x, 0.55 + Math.sin(o.t * 4.2) * 0.12, o.z)
      o.mesh.rotation.y = o.t * 2.4
      o.mesh.rotation.x = o.t * 1.5
    }
    return got
  }

  clear() {
    for (const o of this.live) { this.scene.remove(o.mesh); this.pool.push(o.mesh) }
    this.live.length = 0
  }
}
