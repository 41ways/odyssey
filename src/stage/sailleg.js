import * as THREE from 'three'
import { makeOcean } from '../render/ocean.js'
import { makeStorm } from '../render/storm.js'
import { models } from '../render/models.js'
import { CAMERA_RIG } from '../render/world.js'

/**
 * 뱃길 한 구간 — 판과 판 사이를 **직접 몰고** 건넌다.
 *
 * 전에는 판 사이가 박물관 액자였다. 지나온 일을 그림으로 돌아보는 장치라
 * 좋았지만, 열두 척으로 떠나 하나씩 잃는 이야기에서 **바다 자체가 겪는
 * 일**이어야 할 자리를 그림이 대신하고 있었다. 이제 배를 몰아 건넌다.
 *
 * 한 구간은 짧다 (기본 30초 안팎). 길면 판과 판 사이가 늘어지고, 짧으면
 * 건넜다는 느낌이 안 난다. 그 사이에 —
 *   · 막간에 있던 이야기 두 줄이 뱃길 위로 지나간다
 *   · 포세이돈이 노했으면 폭풍이다. 잔잔하면 순풍이고
 *   · 도착하면 다음 판의 막이 내려온다
 *
 * 조작은 판에서 쓰던 것을 그대로 쓴다 — W/S 돛, A/D 키.
 * 싸움이 없는 구간이라 칼과 활은 쉰다.
 */

const GOAL = 250          // 이만큼 나아가면 도착
const LEN = 3.2, BEAM = 1.1

export class SailLeg {
  /**
   * @param g Game
   * @param o.storm  폭풍인가 (포세이돈의 분노)
   * @param o.where  어디로 가는가 — 액자가 이미 말했으니 여기서는 안 쓴다
   */
  constructor(g, { storm = false, where = '' } = {}) {
    this.g = g
    this.storm = storm
    this.where = where
    this.t = 0
    this.done = false
    this.state = { x: 0, z: 0, heading: 0, speed: 3, sail: 0.45, rudder: 0, pitch: 0, roll: 0, y: 0, gone: 0 }
  }

  async enter() {
    const g = this.g
    const w = g.render3d
    w.setSeaMode(true, this.storm
      ? { bg: '#2b333c', fog: 0.014, fogColor: '#39434e' }
      : { bg: '#6d7f8c', fog: 0.008, fogColor: '#7d8f9c' })

    this.ocean = makeOcean({
      sea: this.storm ? 'storm' : 'calm',
      sun: new THREE.Vector3(0.3, 0.5, -0.8).normalize(),
      waterColor: this.storm ? '#0a1a24' : '#123247',
      sunColor: this.storm ? '#c9d6e4' : '#ffe9c4',
      distortion: this.storm ? 2.8 : 2.2,
    })
    w.scene.add(this.ocean.mesh)

    if (this.storm) {
      this.stormFx = makeStorm()
      // 비·구름은 물에 비추지 않는다 (층 1). 안 그러면 수면이 실로 덮인다
      this.stormFx.group.traverse(o => o.layers.set(1))
      w.camera.layers.enable(1)
      w.scene.add(this.stormFx.group)
    }

    await models.preload(['galley'])
    const made = models.create('galley')
    this.ship = new THREE.Group()
    if (made) this.ship.add(made.root)
    w.scene.add(this.ship)

    // 갑판 위의 사람들 — 남은 동료 수만큼 (많으면 여섯까지)
    this.crew = []
    const n = Math.min(6, Math.ceil((g.voyage?.crew ?? 0) / 90))
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11, 0.42, 4, 8),
        new THREE.MeshStandardMaterial({ color: '#cfc2a2', roughness: 0.95 }),
      )
      c.position.set((i % 2 ? 0.34 : -0.34), 0.62, -0.5 + (i >> 1) * 0.55)
      c.castShadow = true
      this.ship.add(c)
      this.crew.push(c)
    }

    // 카메라는 배를 따라간다. 판보다 멀리서, 바다가 보이게
    this._rig = { distance: CAMERA_RIG.distance, follow: CAMERA_RIG.follow, lead: CAMERA_RIG.lead }
    CAMERA_RIG.distance = 30
    CAMERA_RIG.follow = 0.35
    CAMERA_RIG.lead = 0
    this.focus = new THREE.Vector3()
    g.camFocus = this.focus
    g.player.group.visible = false

    // 어디로 가는지·분위기는 막간 액자가 이미 말했다 (녹아서 여기로 넘어왔다).
    // 조작법 한 줄만 짧게 띄운다.
    g.hud.toast(this.storm ? '비바람이 몰아친다 — W/S 돛, A/D 키' : 'W/S 돛, A/D 키', 3.2)
  }

  /** 뱃머리·고물·좌우현의 수면을 재서 배가 파도를 탄다 */
  #ride(dt) {
    const s = this.state
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading)
    const sx = fz, sz = -fx
    const h = (dx, dz) => this.ocean.at(s.x + dx, s.z + dz).y
    const bow = h(fx * LEN, fz * LEN), stern = h(-fx * LEN, -fz * LEN)
    const port = h(sx * BEAM, sz * BEAM), star = h(-sx * BEAM, -sz * BEAM)
    const k = Math.min(1, dt * 4)
    s.y += ((bow + stern + port + star) / 4 - s.y) * k
    s.pitch += (Math.atan2(stern - bow, LEN * 2) - s.pitch) * k
    s.roll += (Math.atan2(port - star, BEAM * 2) * 0.8 - s.roll) * k
  }

  update(dt) {
    if (this.done) return
    const g = this.g, s = this.state
    this.t += dt
    this.ocean.update(dt)
    this.stormFx?.update(dt, this.ship.position, () => { g.sfx?.boom?.(); g.fx?.shake?.(0.5) })

    // 조작 — 판에서 쓰던 이동 키를 그대로 (W/S 돛, A/D 키)
    const mv = g.input.moveVector(this._mv ??= new THREE.Vector3())
    const fwd = -mv.z, turn = -mv.x
    s.sail = Math.max(0, Math.min(1, s.sail + fwd * dt * 0.7))
    s.rudder += (turn - s.rudder) * Math.min(1, dt * 3)
    // 폭풍에서는 배가 덜 나가고 더 떠밀린다
    const push = this.storm ? 7.5 : 10
    s.speed += (s.sail * push - s.speed) * Math.min(1, dt * 0.7)
    s.heading += s.rudder * dt * 0.55 * Math.min(1, s.speed / 3 + 0.15)
    if (this.storm) s.heading += Math.sin(this.t * 0.7) * dt * 0.06      // 돌풍이 뱃머리를 민다
    const step = s.speed * dt
    s.x += Math.sin(s.heading) * step
    s.z += Math.cos(s.heading) * step
    s.gone += step
    this.#ride(dt)

    this.ship.position.set(s.x, s.y - 0.12, s.z)
    this.ship.rotation.set(0, 0, 0)
    this.ship.rotateY(s.heading)
    this.ship.rotateX(s.pitch)
    this.ship.rotateZ(s.roll - s.rudder * s.speed * 0.012)
    // 바다판은 배를 따라온다 — 파도 식이 월드 좌표라 이어 붙어도 티가 안 난다
    this.ocean.mesh.position.set(Math.round(s.x / 8) * 8, 0, Math.round(s.z / 8) * 8)
    this.focus.set(s.x, 0, s.z)

    if (s.gone / GOAL >= 1) this.done = true
  }

  leave() {
    const g = this.g, w = g.render3d
    w.scene.remove(this.ocean.mesh)
    this.ocean.mesh.geometry.dispose()
    this.ocean.mesh.material.dispose()
    if (this.stormFx) { w.scene.remove(this.stormFx.group); this.stormFx.dispose() }
    w.scene.remove(this.ship)
    w.setSeaMode(false)
    Object.assign(CAMERA_RIG, this._rig)
    g.camFocus = null
    g.player.group.visible = true
  }
}
