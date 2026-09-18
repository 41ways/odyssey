import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { dist2d, dampAngle, rand, clamp } from '../core/math.js'
import { createCharacter } from '../render/character.js'
import { buildSpearProp, buildSwordProp } from './gear.js'

/**
 * 동료 — 같이 싸우는 사람들.
 *
 * 『오디세이아』의 오디세우스는 한 번도 혼자 싸우지 않는다 — 열두 척의
 * 사람들과 함께였고, 그들이 하나씩 죽어서 혼자가 된다. 게임에서는 처음부터
 * 혼자라 판마다 줄어드는 동료 수(stage/voyage.js)가 숫자일 뿐이었다.
 * 곁에서 창을 찌르는 사람이 있어야 그 숫자가 사람이 된다.
 *
 * 규칙 셋 —
 *   · **적은 동료를 노리지 않는다.** 동료까지 맞으면 동료를 지키는 게 일이
 *     되어 판의 판단이 흐려진다. 예고를 읽고 피하는 건 오디세우스 몫이다.
 *   · **보스는 치지 않는다.** 파훼(눈을 쏜다, 머리를 끊는다)는 플레이어가
 *     해야 하는 동작이라 동료가 대신하면 안 된다. 보스가 부른 잡졸만 친다.
 *   · 싸움에서 죽지 않는다. 동료는 **이야기가 정한 자리에서** 죽는다.
 *
 * 몸은 오디세우스와 같은 몸·같은 클립이고, 차림은 아마포에 청동을 덜 둘렀다.
 * 발밑에 청록 고리를 깔아 쿼터뷰에서 적(붉은 기)과 한눈에 갈리게 한다.
 */

const LOOK = {
  linen: '#cfc2a2', bronze: '#a67a3c', leather: '#5e4128',
}

export class Companion extends Actor {
  /**
   * @param o.name    이름표
   * @param o.weapon  'spear' | 'sword'
   * @param o.slot    따라갈 자리 (-1 왼쪽 뒤, 1 오른쪽 뒤)
   */
  constructor(world, fx, { name, weapon = 'spear', slot = 1, tint = null, height = 1.78 } = {}) {
    super({ hp: 999, radius: 0.44, mass: 1.4, team: 'player', fx })
    this.world = world
    this.name = name
    this.slot = slot
    this.isAlly = true
    this.animT = rand(0, 4)
    this._run = 0
    this._moved = 0
    this.cooldown = rand(0.3, 0.9)
    this.swing = null
    this.target = null

    const rig = createCharacter({ height, tint, gear: ['body', 'feet'] })
    this.rig = rig
    if (rig) {
      // 오디세우스와 같은 결의 그리스 차림. 무늬를 떼고 재질만 칠한다
      const paint = (part, color, metal = 0, rough = 0.92) => {
        for (const m of rig.equip(part)) {
          const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(x => {
            const c = x.clone(); c.map = null; c.color.set(color); c.metalness = metal; c.roughness = rough; return c
          })
          m.material = Array.isArray(m.material) ? mats : mats[0]
        }
      }
      paint('body', weapon === 'spear' ? LOOK.bronze : LOOK.linen, weapon === 'spear' ? 0.8 : 0, weapon === 'spear' ? 0.4 : 0.92)
      paint('feet', LOOK.leather)
      const prop = weapon === 'spear' ? buildSpearProp() : buildSwordProp()
      rig.attachTo('hand_r', prop.group, weapon === 'spear'
        ? { rotation: [-0.2, 0, 0], position: [0, -0.02, 0.02] }
        : { rotation: [-0.25, 0, 0.1], position: [0, -0.02, 0.02] })
      this.group.add(rig.root)
    }
    this.reach = weapon === 'spear' ? 2.6 : 1.9
    this.damage = weapon === 'spear' ? 7 : 6

    // 발밑 청록 고리 — 편이라는 표시
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.48, 28),
      new THREE.MeshBasicMaterial({ color: '#6fd0c0', transparent: true, opacity: 0.45, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    this.group.add(ring)
    this.#nameTag(name)
  }

  /** 머리 위 이름. 동료가 '누군가' 여야 잃을 때 무게가 있다 */
  #nameTag(name) {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 64
    const x = c.getContext('2d')
    x.font = '600 30px "Song Myung", serif'
    x.textAlign = 'center'; x.textBaseline = 'middle'
    x.shadowColor = '#000'; x.shadowBlur = 8
    x.fillStyle = '#bfe8df'
    x.fillText(name, 128, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }))
    sp.scale.set(1.5, 0.375, 1)
    sp.position.y = 2.25
    this.group.add(sp)
  }

  /** 가까운 잡졸 — 보스는 고르지 않는다 */
  #pickTarget() {
    const p = this.world.player
    let best = null, bd = Infinity
    for (const e of this.world.enemies) {
      if (e.dead || e.isBoss || e.isDummy) continue
      // 오디세우스에게서 너무 멀리 떨어진 놈은 쫓지 않는다 — 곁을 지킨다
      if (dist2d(e.pos, p.pos) > 11) continue
      const d = dist2d(e.pos, this.pos)
      if (d < bd) { bd = d; best = e }
    }
    return best
  }

  think(dt) {
    const p = this.world.player
    if (p.dead) return

    // 휘두르는 중 — 선딜 뒤에 한 번 맞히고, 후딜이 끝나면 풀린다
    if (this.swing) {
      const s = this.swing
      s.t += dt
      if (!s.hit && s.t >= 0.32) {
        s.hit = true
        const e = s.target
        if (e && !e.dead && dist2d(e.pos, this.pos) < this.reach + e.radius + 0.4) {
          // 적의 경직·밀림은 작게. 동료가 적을 붙잡아 두면 플레이어의 판단이 사라진다
          e.hurt(this.damage, { from: this.pos, knockback: 2, hitstop: 0, stagger: 0.06, color: '#bfe8df' })
          this.world.sfx?.hit?.()
        }
      }
      if (s.t >= 0.95) this.swing = null
      return
    }

    this.cooldown -= dt
    const t = this.target && !this.target.dead ? this.target : (this.target = this.#pickTarget())
    let gx, gz, speed = 4.4
    if (t) {
      const d = dist2d(t.pos, this.pos)
      const want = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z)
      this.facing = dampAngle(this.facing, want, 0.08, dt)
      if (d < this.reach && this.cooldown <= 0) {
        this.swing = { t: 0, hit: false, target: t }
        this.cooldown = rand(0.9, 1.5)
        this._moved = 0
        return
      }
      // 창끝 거리에 선다
      const stand = this.reach * 0.8
      gx = t.pos.x - Math.sin(want) * stand
      gz = t.pos.z - Math.cos(want) * stand
    } else {
      // 싸울 게 없으면 오디세우스의 뒤, 한쪽으로
      const f = p.facing
      gx = p.pos.x - Math.sin(f) * 1.8 + Math.cos(f) * 1.4 * this.slot
      gz = p.pos.z - Math.cos(f) * 1.8 - Math.sin(f) * 1.4 * this.slot
      speed = 5.2
    }
    const dx = gx - this.pos.x, dz = gz - this.pos.z
    const d = Math.hypot(dx, dz)
    if (d > 0.35) {
      const step = Math.min(d, speed * dt)
      this.pos.x += (dx / d) * step
      this.pos.z += (dz / d) * step
      if (!t) this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 0.1, dt)
      this._moved = clamp(step / (speed * dt), 0, 1)
    } else this._moved = 0
    // 너무 뒤처지면 곁으로 붙인다 (컷신 뒤, 판 모양이 바뀐 뒤)
    if (dist2d(this.pos, p.pos) > 18) this.pos.set(p.pos.x + this.slot * 1.4, 0, p.pos.z + 1.6)
  }

  sync(camera) {
    super.sync(camera)
    if (!this.rig) return
    const dt = 1 / 60
    this.animT += dt
    this._run += (clamp(this._moved, 0, 1) - this._run) * 0.18
    let attack = null
    if (this.swing) {
      const k = this.swing.t
      attack = k < 0.32 ? { wind: k / 0.32, swing: 0 } : { wind: 0, swing: clamp(1 - (k - 0.32) / 0.63, 0, 1) }
    }
    this.rig.pose({
      t: this.animT, run: this._run, attack, draw: null, roll: 0,
      attackId: attack ? 'ally' : null, attackDuration: 0.95, dead: false, flinch: 0,
    }, dt)
  }
}

/**
 * 판에 따라 누가 곁에 있는가.
 *
 *   이스마로스 ~ 메시나 — 에우릴로코스(창)와 폴리테스(칼). 호메로스가 이름을
 *     부르는 둘이다. 폴리테스는 "동료 중에 내가 가장 아끼고 믿던 사람".
 *   저승 — 혼자 구덩이로 간다
 *   트리나키아 이후 — 아무도 없다
 *   이타카 — 텔레마코스와 돼지치기 에우마이오스. 스무 해 만에 곁에 선 아들.
 */
export function companionsFor(stage, voyage) {
  if (!stage || stage.relic) return []
  if (stage.id === 'ithaca') return [
    { name: '텔레마코스', weapon: 'spear', slot: -1 },
    { name: '에우마이오스', weapon: 'sword', slot: 1, tint: '#c9b79a' },
  ]
  if (stage.endless) return []
  if ((voyage?.crew ?? 0) <= 0) return []
  return [
    { name: '에우릴로코스', weapon: 'spear', slot: -1 },
    { name: '폴리테스', weapon: 'sword', slot: 1 },
  ]
}
