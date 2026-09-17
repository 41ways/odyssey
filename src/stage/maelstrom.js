import * as THREE from 'three'

/**
 * 소용돌이 — 카리브디스의 판.
 *
 * 여기서는 걷지 않는다. **헤엄친다.**
 *
 * 걸어 다니면 이 판은 '가운데 큰 놈이 있는 원형 투기장' 이 된다. 그런데
 * 카리브디스의 무서움은 패턴이 아니라 **바다 자체**다 — 가만히 있으면
 * 빨려 들어간다. 그래서 규칙 하나를 판에 건다:
 *
 *   서 있으면 끌려간다.
 *
 * 그 한 줄이 모든 걸 바꾼다. 안전지대가 없고, 공격하려고 멈추는 것에
 * 값이 붙고, 물러나는 것조차 노를 저어야 한다.
 *
 * 치는 것도 몸통이 아니다. 소용돌이 테두리에 박힌 **이빨**을 깬다 —
 * 가운데로 다가갈수록 끌리는 힘이 세지므로, 어디까지 들어갈지가 곧 판단이다.
 */

/** 이빨 하나가 버티는 양. 여덟 개를 다 깨면 한 페이즈가 넘어간다. */
const TOOTH_HP = 90
const TEETH = 8

export class Maelstrom {
  /**
   * @param g     Game
   * @param boss  카리브디스
   * @param o.radius  소용돌이 반지름 — 이 안이 끌리는 범위
   */
  constructor(g, boss, { radius = 13, pull = 5.4 } = {}) {
    this.g = g
    this.boss = boss
    this.radius = radius
    this.pull = pull
    this.teeth = []
    this.t = 0
    this.#build()
  }

  /** 테두리 이빨. 깨는 것이 목표다. */
  #build() {
    const grp = new THREE.Group()
    grp.position.set(this.boss.pos.x, 0, this.boss.pos.z)
    const enamel = new THREE.MeshStandardMaterial({
      color: '#e4dcc6', roughness: 0.42, metalness: 0.04,
      emissive: '#3a3020', emissiveIntensity: 0.3,
    })
    for (let i = 0; i < TEETH; i++) {
      const a = (i / TEETH) * Math.PI * 2
      const r = this.radius * 0.52
      const t = new THREE.Group()
      t.position.set(Math.sin(a) * r, 0, Math.cos(a) * r)
      // 안쪽으로 기울어 물고 있는 모양
      t.rotation.y = a
      t.rotation.x = 0.34

      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.3, 6), enamel.clone())
      cone.position.y = 1.15
      cone.castShadow = true
      t.add(cone)
      grp.add(t)

      this.teeth.push({
        group: t, mesh: cone, mat: cone.material,
        x: this.boss.pos.x + Math.sin(a) * r,
        z: this.boss.pos.z + Math.cos(a) * r,
        hp: TOOTH_HP, max: TOOTH_HP, broken: false, flash: 0, a,
      })
    }
    this.g.render3d.scene.add(grp)
    this.group = grp
  }

  /** 아직 성한 이빨 수. */
  get standing() { return this.teeth.filter(t => !t.broken).length }

  /**
   * 플레이어의 칼·화살이 이빨에 닿았는지 본다.
   * @returns 맞은 이빨이 있으면 true
   */
  hitAt(x, z, reach, damage) {
    let any = false
    for (const t of this.teeth) {
      if (t.broken) continue
      if (Math.hypot(x - t.x, z - t.z) > reach + 0.6) continue
      t.hp -= damage
      t.flash = 0.14
      any = true
      this.g.fx.number(new THREE.Vector3(t.x, 2.2, t.z), Math.round(damage),
        { color: '#ffe6a8', size: 22 })
      if (t.hp <= 0) this.#breakTooth(t)
    }
    return any
  }

  #breakTooth(t) {
    t.broken = true
    t.mesh.visible = false
    const g = this.g
    g.fx.ring(t.x, t.z, { color: '#ffe6a8', radius: 2.4, life: 0.5 })
    g.fx.shake(0.4)
    g.particles?.burst({
      x: t.x, y: 1.2, z: t.z, count: 26, color: '#efe6cc',
      speed: 9, size: 0.2, life: 0.8, gravity: 10, up: 1.1,
    })
    // 이빨이 깨지면 본체가 아프다. 이게 이 보스를 깎는 유일한 길이다.
    this.boss.hurt?.(this.boss.maxHp / TEETH, { color: '#ffe6a8', crit: true, hitstop: 0.1 })
    g.hud.banner('이빨', `${this.standing} 남았다`, 1.4)
  }

  /**
   * 물살. 매 프레임 플레이어를 가운데로 끈다.
   *
   * 가운데로 갈수록 세진다 — 어디까지 들어갈지가 판단이 되려면
   * 대가가 거리에 따라 달라져야 한다.
   */
  update(dt) {
    this.t += dt
    const g = this.g
    const p = g.player
    if (p.dead) return

    const dx = this.boss.pos.x - p.pos.x
    const dz = this.boss.pos.z - p.pos.z
    const d = Math.hypot(dx, dz) || 1
    if (d < this.radius) {
      // 가장자리 0 → 한가운데 1
      const k = 1 - d / this.radius
      const f = this.pull * (0.35 + k * k * 1.6)
      p.pos.x += (dx / d) * f * dt
      p.pos.z += (dz / d) * f * dt
    }

    for (const t of this.teeth) {
      if (t.flash > 0) {
        t.flash -= dt
        t.mat.emissiveIntensity = 0.3 + Math.max(0, t.flash) * 12
      }
      if (!t.broken) {
        // 물에 잠겼다 드러났다 한다 — 칠 수 있는 때가 눈에 보여야 한다
        t.group.position.y = -0.35 + Math.sin(this.t * 1.6 + t.a * 2) * 0.35
      }
    }
  }

  dispose() {
    this.g.render3d.scene.remove(this.group)
    this.group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    this.teeth.length = 0
  }
}
