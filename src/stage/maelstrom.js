import * as THREE from 'three'
import { makeVortex } from '../render/vortex.js'

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

    /**
     * 판 전체를 덮는 물살.
     *
     * 끌리는 힘은 코드에만 있었다. 가만히 서 있으면 가운데로 밀려 가는데
     * 화면에는 아무 일도 안 일어나니 조작이 고장 난 것처럼 읽혔다.
     * 규칙이 화면에 없으면 규칙이 아니다 — 끌리는 범위 전체에 안쪽이 더
     * 빨리 도는 물살을 깔아 둔다. 이 판의 유일한 규칙이 눈에 보이게.
     *
     * 판 밖까지 덮는다. 바닥은 갑판 텍스처를 푸르게 물들인 것이라 헤엄치는
     * 판인데 나뭇결이 보였다 — 물을 깔면 그 문제도 같이 없어진다.
     *
     * 평평하게 깐다 (depth 거의 0). 파이게 만들면 면이 바닥 아래로 내려가
     * 갑판에 가려지고, 반대로 띄우면 그 위를 헤엄치는 내가 물에 잠긴다.
     * 파인 모양은 가운데 보스가 제 깔때기로 낸다 — 여기는 수면이면 된다.
     * 그래서 한가운데는 비워 둔다 (throat). 보스의 깔때기가 그 구멍에
     * 정확히 들어앉아, 수면이 목구멍으로 떨어지는 그림이 된다.
     */
    this.field = makeVortex({
      radius: this.radius * 1.25, depth: 0.06, throat: 2.55,
      segments: 96, base: 0.95, edgeFade: 0.97, throatFade: 0.035,
      hole: false, order: 3,
    })
    this.field.group.position.y = 0.08
    grp.add(this.field.group)

    // 바닥은 치운다. 갑판이 남아 있으면 가운데 깔때기가 그 아래로 파여
    // 나무판에 가려진다 — 구멍 속을 들여다보면 나뭇결이 보였다.
    // 수면이 판을 다 덮으니 바닥이 없어도 딛는 데는 지장이 없다.
    const ground = this.g.render3d.ground
    if (ground) { this._groundWas = ground.visible; ground.visible = false }

    /**
     * 이빨.
     *
     * 매끈한 원뿔 여덟 개는 도로 고깔로 보였다. 이빨로 보이려면 세 가지가
     * 있어야 한다 — **뿌리**(잇몸에 박힌 굵은 밑동), **휜 끝**(안쪽으로 물고
     * 있는 모양), **제각각**(똑같이 생긴 이빨은 없다).
     */
    const enamel = new THREE.MeshStandardMaterial({
      color: '#e8e0cc', roughness: 0.34, metalness: 0.02,
      emissive: '#3a3020', emissiveIntensity: 0.3, flatShading: true,
    })
    const gum = new THREE.MeshStandardMaterial({
      color: '#5d4a52', roughness: 0.86, metalness: 0.02,
    })
    for (let i = 0; i < TEETH; i++) {
      const a = (i / TEETH) * Math.PI * 2
      const r = this.radius * 0.52
      const t = new THREE.Group()
      t.position.set(Math.sin(a) * r, 0, Math.cos(a) * r)
      // 안쪽으로 기울어 물고 있는 모양. 이빨마다 조금씩 다르게 선다.
      const jit = Math.sin(i * 12.9898) * 0.5 + 0.5      // 0..1, 이빨마다 고정
      t.rotation.y = a + (jit - 0.5) * 0.5
      t.rotation.x = 0.30 + jit * 0.16
      t.rotation.z = (jit - 0.5) * 0.22

      // 밑동 — 물 밖으로 드러난 잇몸. 이게 있어야 '박혀 있다' 로 읽힌다.
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.62, 0.7, 7), gum.clone())
      root.position.y = 0.3
      t.add(root)

      // 아래 마디는 굵고, 위 마디가 안쪽으로 더 휜다
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.44, 1.25, 6), enamel.clone())
      lower.position.y = 1.2
      lower.castShadow = true
      t.add(lower)

      const bend = new THREE.Group()
      bend.position.y = 1.82
      bend.rotation.x = 0.34 + jit * 0.2
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.19, 1.3 + jit * 0.45, 6), enamel.clone())
      tip.position.y = 0.62
      tip.castShadow = true
      bend.add(tip)
      t.add(bend)

      const scale = 0.85 + jit * 0.45
      t.scale.setScalar(scale)
      grp.add(t)

      this.teeth.push({
        group: t, parts: [root, lower, tip], mat: lower.material, tipMat: tip.material,
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
    for (const p of t.parts) p.visible = false
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

    // 빨아들이는 동안 물살이 거세진다 — 힘이 세지는 걸 눈으로 먼저 안다
    const sucking = this.boss.action?.active && /pull|suck/.test(this.boss.action?.def?.id ?? '')
    this.field.update(dt, sucking ? 1 : 0.45)

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
        const glow = 0.3 + Math.max(0, t.flash) * 12
        t.mat.emissiveIntensity = glow
        t.tipMat.emissiveIntensity = glow
      }
      if (!t.broken) {
        // 물에 잠겼다 드러났다 한다 — 칠 수 있는 때가 눈에 보여야 한다
        t.group.position.y = -0.35 + Math.sin(this.t * 1.6 + t.a * 2) * 0.35
      }
    }
  }

  dispose() {
    const ground = this.g.render3d.ground
    if (ground && this._groundWas !== undefined) ground.visible = this._groundWas
    this.field?.dispose()
    this.g.render3d.scene.remove(this.group)
    this.group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    this.teeth.length = 0
  }
}
