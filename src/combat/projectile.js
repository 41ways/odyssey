import * as THREE from 'three'
import { circleHit } from './hit.js'

/** 화살·투사체. 풀링해서 돌려 쓴다. */
export class Projectiles {
  constructor(scene, fx) {
    this.scene = scene
    this.fx = fx
    this.live = []
    this.pool = []
    this._geo = new THREE.CylinderGeometry(0.045, 0.045, 1.25, 6)
    this._geo.rotateX(Math.PI / 2)
    this._tipGeo = new THREE.ConeGeometry(0.1, 0.3, 6)
    this._tipGeo.rotateX(Math.PI / 2)
  }

  #take(color) {
    let m = this.pool.pop()
    if (!m) {
      m = new THREE.Group()
      const shaft = new THREE.Mesh(this._geo, new THREE.MeshStandardMaterial({ color: '#c8a877', roughness: 0.6, emissive: '#000' }))
      const tip = new THREE.Mesh(this._tipGeo, new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff8c3a', emissiveIntensity: 1.4 }))
      tip.position.z = 0.75
      m.add(shaft, tip)
      m.userData.tip = tip
    }
    m.userData.tip.material.emissive.set(color)
    return m
  }

  /** opts: { x, z, y, dir(rad), speed, damage, team, pierce, knockback, range, color, hitstop } */
  spawn(o) {
    const mesh = this.#take(o.color ?? '#ff8c3a')
    mesh.position.set(o.x, o.y ?? 1.05, o.z)
    mesh.rotation.y = o.dir
    this.scene.add(mesh)
    this.live.push({
      mesh,
      pos: new THREE.Vector3(o.x, o.y ?? 1.05, o.z),
      dir: o.dir,
      speed: o.speed,
      damage: o.damage,
      team: o.team,
      radius: o.radius ?? 0.3,
      pierce: o.pierce ?? 0,
      knockback: o.knockback ?? 3,
      hitstop: o.hitstop ?? 0.04,
      traveled: 0,
      range: o.range ?? 34,
      hitSet: new Set(),
    })
  }

  update(dt, actors, arenaRadius) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]
      const step = p.speed * dt
      p.pos.x += Math.sin(p.dir) * step
      p.pos.z += Math.cos(p.dir) * step
      p.traveled += step
      p.mesh.position.copy(p.pos)

      let gone = p.traveled > p.range || Math.hypot(p.pos.x, p.pos.z) > arenaRadius + 1.5

      if (!gone) {
        for (const a of actors) {
          if (a.dead || a.team === p.team || p.hitSet.has(a)) continue
          if (!circleHit(p.pos.x, p.pos.z, p.radius, a)) continue
          p.hitSet.add(a)
          a.hurt(p.damage, { from: p.pos, knockback: p.knockback, hitstop: p.hitstop, color: '#ffd27a' })
          if (p.pierce > 0) p.pierce--
          else { gone = true }
          break
        }
      }

      if (gone) {
        this.fx?.ring(p.pos.x, p.pos.z, { color: '#ffb066', radius: 0.9, life: 0.18 })
        this.scene.remove(p.mesh)
        this.pool.push(p.mesh)
        this.live.splice(i, 1)
      }
    }
  }
}
