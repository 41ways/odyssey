import * as THREE from 'three'
import { makeOcean } from '../render/ocean.js'
import { makeStorm } from '../render/storm.js'
import { models } from '../render/models.js'
import { buildIsle } from '../render/props.js'
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

const GOAL = 250          // 갈 섬이 이만큼 앞에 선다
const ARRIVE = 46         // 섬 밑동이 이 안에 들면 닿은 것으로 친다
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
    /* 안개는 옅게. 판에서 쓰던 만큼(0.008) 끼면 200m 앞의 섬이 통째로 묻혀서
       갈 곳이 안 보인다 — 바다에서 안개는 분위기가 아니라 눈가리개다. */
    w.setSeaMode(true, this.storm
      ? { bg: '#2b333c', fog: 0.005, fogColor: '#39434e' }
      : { bg: '#6d7f8c', fog: 0.0025, fogColor: '#7d8f9c' })

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

    /* 갈 곳과 떠나온 곳.
       바다만 있을 때는 어디로 가는지도, 뱃머리가 어디를 보는지도 알 수 없었다 —
       물은 사방이 같아서 배를 돌려도 화면이 똑같다. 섬을 둘 세우면 그제야
       방향이 생기고, 물이 흐르는 게 아니라 내가 나아가는 것으로 읽힌다.
       가려던 섬이 커지고 떠나온 섬이 작아지는 것이 곧 남은 거리다. */
    this.isle = buildIsle({ h: 58, r: 52, color: this.storm ? '#3b444c' : '#5c646a' })
    this.isle.position.set(0, -4, GOAL)
    w.scene.add(this.isle)
    this.behind = buildIsle({ h: 40, r: 44, color: this.storm ? '#333b42' : '#565e64', seed: 2.2 })
    this.behind.position.set(-18, -5, -95)
    w.scene.add(this.behind)
    // 섬이 안개에 먹히지 않게, 그리고 먼 수평선까지 보이게
    this._far = w.camera.far
    w.camera.far = 900
    w.camera.updateProjectionMatrix()

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

    /* 카메라는 배를 따라간다. 판에서 쓰는 쿼터뷰(30m·40°)를 그대로 가져오면
       두 가지가 한꺼번에 죽는다 —
         · 그 높이에서는 파고 1.3m 짜리 물결이 안 보여서 바다가 회색 판때기가 되고
         · 시선이 발치로 꽂혀 **수평선이 화면 밖으로 나간다**. 갈 섬이 저 앞에
           서 있어도 화면에 안 들어오니 어디로 가는지 알 길이 없었다.
       눈높이까지 내려앉힌다(17m·11°). 파도는 옆에서 봐야 파도고, 갈 곳은
       수평선에 있어야 보인다. */
    this._rig = { distance: CAMERA_RIG.distance, pitch: CAMERA_RIG.pitch, yaw: CAMERA_RIG.yaw, follow: CAMERA_RIG.follow, lead: CAMERA_RIG.lead }
    CAMERA_RIG.distance = 28
    CAMERA_RIG.pitch = THREE.MathUtils.degToRad(14)
    CAMERA_RIG.follow = 0.35
    CAMERA_RIG.lead = 0
    // 시선을 갑판 높이로 올린다. 수면(0)을 보면 화면이 물로 반쯤 찬다
    this.focus = new THREE.Vector3()
    g.camFocus = this.focus
    /* 땅에 서 있던 사람들을 치운다.
       오디세우스만 감추고 동료를 두었더니 에우릴로코스와 폴리테스가 배에서
       열 걸음 떨어진 **물 위에 서서** 같이 건넜다. 갑판 위 사람은 이 구간이
       따로 세운다 (아래 crew). */
    g.player.group.visible = false
    /* 적도 같이 치운다. 판을 막 끝내고 오는 길이라 **방금 쓰러뜨린 보스의
       시체가 그대로 남아 있다** — 키 6.4 짜리 폴리페모스가 허옇게 물 위에
       떠서 배를 따라왔다. */
    this._hidden = [...(g.allies ?? []), ...(g.enemies ?? [])].filter(a => a.group?.visible)
    for (const a of this._hidden) a.group.visible = false

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
    this.focus.set(s.x, s.y + 1.4, s.z)

    /* 카메라는 **뱃고물 뒤**에 선다.
       판의 카메라는 yaw 가 고정이다 — 방향키 축과 화면 축을 맞추려고 일부러
       그렇게 뒀다. 그 규칙을 바다로 그대로 들고 왔더니 카메라가 늘 월드
       한쪽에 박혀서, 배가 그쪽으로 갈 때는 뱃머리 너머가 아니라 **카메라
       뒤쪽**이 목적지가 됐다. 가려는 섬이 화면 밖에 있으니 어디로 가는지
       알 수가 없다. 여기서는 뱃머리가 보는 쪽이 화면 위가 되게 돌린다. */
    const wantYaw = s.heading + Math.PI
    const d = Math.atan2(Math.sin(wantYaw - CAMERA_RIG.yaw), Math.cos(wantYaw - CAMERA_RIG.yaw))
    CAMERA_RIG.yaw += d * Math.min(1, dt * 2.2)

    /* 도착은 **섬에 닿는 것**이다.
       전에는 나아간 거리(gone)만 셌다 — 뱃머리를 어디로 두든 같은 거리를 가면
       도착해서, 키를 잡는 일에 뜻이 없었다. 이제 섬까지의 거리로 잰다.
       빗나가면 그만큼 늦고, 돌아서 다시 와야 한다. */
    const dx = this.isle.position.x - s.x, dz = this.isle.position.z - s.z
    const left = Math.hypot(dx, dz)
    s.left = left
    if (left < ARRIVE) this.done = true

    /* 빗나갔을 때만 말해 준다.
       섬이 화면 밖으로 나가면 어느 쪽으로 돌려야 하는지 알 길이 없다. 다만
       제대로 가고 있을 때까지 계속 띄우면 잔소리가 된다 — 뱃머리가 섬을
       보고 있으면 조용하다. */
    const want = Math.atan2(dx, dz)
    const off = Math.atan2(Math.sin(want - s.heading), Math.cos(want - s.heading))
    this._say = (this._say ?? 2) - dt
    if (this._say <= 0 && Math.abs(off) > 0.5) {
      this._say = 3.2
      g.hud.toast(off > 0 ? '섬은 오른쪽 — D 로 돌려라' : '섬은 왼쪽 — A 로 돌려라', 2)
    }
  }

  leave() {
    const g = this.g, w = g.render3d
    w.scene.remove(this.ocean.mesh)
    this.ocean.mesh.geometry.dispose()
    this.ocean.mesh.material.dispose()
    if (this.stormFx) { w.scene.remove(this.stormFx.group); this.stormFx.dispose() }
    w.scene.remove(this.ship)
    for (const isle of [this.isle, this.behind]) {
      if (!isle) continue
      w.scene.remove(isle)
      isle.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
    }
    if (this._far) { w.camera.far = this._far; w.camera.updateProjectionMatrix() }
    w.setSeaMode(false)
    Object.assign(CAMERA_RIG, this._rig)
    g.camFocus = null
    g.player.group.visible = true
    for (const a of this._hidden ?? []) a.group.visible = true
  }
}
