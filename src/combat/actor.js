import * as THREE from 'three'
import { ActionRunner } from './action.js'
import { clamp, dist2d } from '../core/math.js'

function makeBar(width, color) {
  const g = new THREE.Group()
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.13),
    new THREE.MeshBasicMaterial({ color: '#100c0c', transparent: true, opacity: 0.8, depthTest: false })
  )
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.13),
    new THREE.MeshBasicMaterial({ color, depthTest: false })
  )
  fill.position.z = 0.001
  g.add(bg, fill)
  g.renderOrder = 9
  g.userData.fill = fill
  g.userData.width = width
  return g
}

export class Actor {
  constructor({ hp = 100, radius = 0.5, mass = 1, team = 'enemy', fx = null } = {}) {
    this.pos = new THREE.Vector3()
    this.vel = new THREE.Vector3()      // 넉백·구르기 같은 외력. 이동 입력과는 따로 둔다
    this.facing = 0
    this.hp = hp
    this.maxHp = hp
    this.radius = radius
    this.mass = mass
    this.team = team
    this.fx = fx
    this.dead = false
    this.invuln = 0        // 무적 시간
    this.stagger = 0       // 경직. 남아있으면 행동 불가
    this.actionRate = 1    // 공격속도 배수. 액션 프레임 전체가 이 비율로 빨라진다
    this.takeMul = 1       // 받는 피해 배수. 난이도가 여기를 건드린다
    this.god = false       // 시험용 무적. 배포 전에 끈다 (main.js 의 GOD 주석 참고)
    this.hurtFlash = 0
    this.burn = null       // { left, dps, tick, level, from }
    this.action = new ActionRunner(this)
    this.group = new THREE.Group()
    this.bodyMats = []
  }

  attachBar(width = 1.3, color = '#e0443a', height = 2.2) {
    this.bar = makeBar(width, color)
    this.bar.position.y = height
    this.group.add(this.bar)
  }

  get alive() { return !this.dead }

  /** 드러난 약점. 있으면 투사체가 몸통보다 먼저 여기를 본다. */
  getWeakPoint() { return null }

  /** 화상. 같은 불이 겹치면 시간만 갱신하고 더 센 불이면 갈아탄다. */
  ignite({ dps, seconds, level = 1, from = null }) {
    if (this.dead) return
    if (!this.burn || dps >= this.burn.dps) this.burn = { left: seconds, dps, tick: 0, level, from }
    else this.burn.left = Math.max(this.burn.left, seconds)
  }
  get busy() { return this.action.active || this.stagger > 0 }

  faceTo(x, z) { this.facing = Math.atan2(x - this.pos.x, z - this.pos.z) }

  /** @returns {'hit'|'iframe'|'dead'} */
  hurt(amount, { from = null, knockback = 0, hitstop = 0.05, stagger = 0, color = '#ffe9a8', crit = false } = {}) {
    if (this.dead) return 'dead'
    if (this.god) {
      this.fx?.number(this.group.position.clone().setY(1.9), '무적', { color: '#7fe0a0', size: 18 })
      return 'iframe'
    }
    if (this.invuln > 0) {
      this.fx?.number(this.group.position.clone().setY(1.9), '흘림', { color: '#8fb6ff', size: 20 })
      return 'iframe'
    }
    amount *= this.takeMul
    const dealt = Math.min(amount, this.hp)
    this.hp = Math.max(0, this.hp - amount)
    this.onHurt?.(dealt, this)
    this.hurtFlash = 0.14
    this.stagger = Math.max(this.stagger, stagger)
    if (stagger > 0) this.action.stop()

    if (knockback && from) {
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z
      const d = Math.hypot(dx, dz) || 1
      this.vel.x += (dx / d) * knockback / this.mass
      this.vel.z += (dz / d) * knockback / this.mass
    }

    if (this.fx) {
      this.fx.freeze(hitstop)
      this.fx.shake(hitstop * 2.2)
      this.fx.number(this.pos.clone().setY(1.5 + Math.random() * 0.4), Math.round(amount), { color, crit })
      this.fx.ring(this.pos.x, this.pos.z, { radius: this.radius * 2.4, life: 0.22 })
    }

    if (this.hp <= 0) { this.die(); return 'dead' }
    return 'hit'
  }

  die() {
    this.dead = true
    this.action.stop()
    this.fx?.ring(this.pos.x, this.pos.z, { color: '#ff7a4a', radius: this.radius * 5, life: 0.5 })
  }

  /** 넉백 감쇠 + 투기장 경계 + 액션 진행. dt 는 고정 스텝. */
  step(dt, arenaRadius) {
    if (this.invuln > 0) this.invuln -= dt
    if (this.stagger > 0) this.stagger -= dt
    if (this.hurtFlash > 0) this.hurtFlash -= dt

    this.action.update(dt)

    // 화상 — 0.5초마다 한 번씩 깎는다. 매 프레임 깎으면 숫자가 폭포처럼 쏟아진다.
    if (this.burn) {
      this.burn.left -= dt
      this.burn.tick += dt
      if (this.burn.tick >= 0.5) {
        this.burn.tick -= 0.5
        const dealt = Math.min(this.burn.dps * 0.5, this.hp)
        this.hp = Math.max(0, this.hp - dealt)
        this.onHurt?.(dealt, this)
        this.fx?.number(this.pos.clone().setY(1.7), Math.round(dealt), { color: '#ff8a3a', size: 22 })
        if (this.hp <= 0) { this.burnedOut = true; this.die(); return }
      }
      if (this.burn.left <= 0) this.burn = null
    }

    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    const drag = Math.pow(0.0005, dt)
    this.vel.x *= drag
    this.vel.z *= drag
    if (Math.abs(this.vel.x) < 0.02) this.vel.x = 0
    if (Math.abs(this.vel.z) < 0.02) this.vel.z = 0

    const d = Math.hypot(this.pos.x, this.pos.z)
    const lim = arenaRadius - this.radius
    if (d > lim) {
      const k = lim / d
      this.pos.x *= k; this.pos.z *= k
      this.vel.multiplyScalar(0.3)
    }
  }

  /** 시각 갱신. 렌더 시점에 부른다. */
  sync(camera) {
    this.group.position.copy(this.pos)
    this.group.rotation.y = this.facing
    if (this.bar) {
      this.bar.quaternion.copy(camera.quaternion)
      this.bar.rotation.z = 0
      const f = this.bar.userData.fill
      const k = clamp(this.hp / this.maxHp, 0, 1)
      f.scale.x = Math.max(k, 0.0001)
      f.position.x = -this.bar.userData.width * (1 - k) / 2
      this.bar.visible = !this.dead && this.hp < this.maxHp
    }
    const flash = this.hurtFlash > 0 ? clamp(this.hurtFlash / 0.14, 0, 1) : 0
    // 불타는 동안은 벌겋게 달아오른다. 맞았을 때의 번쩍임과 섞인다.
    const heat = this.burn ? 0.35 + Math.sin(performance.now() * 0.012) * 0.12 : 0
    for (const m of this.bodyMats) {
      if (!m.emissive) continue
      m.emissive.setRGB(flash * 1.6 + heat, flash * 0.7 + heat * 0.35, flash * 0.5 + heat * 0.05)
    }
  }
}

/** 겹쳐 서는 걸 막는다. 적이 한 점에 뭉치면 전투가 읽히지 않는다. */
export function separate(actors, dt) {
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i]
    if (a.dead) continue
    for (let j = i + 1; j < actors.length; j++) {
      const b = actors[j]
      if (b.dead) continue
      const min = a.radius + b.radius
      const d = dist2d(a.pos, b.pos)
      if (d >= min || d < 1e-5) continue
      const push = (min - d) * 0.5
      const nx = (a.pos.x - b.pos.x) / d, nz = (a.pos.z - b.pos.z) / d
      const ta = b.mass / (a.mass + b.mass), tb = 1 - ta
      a.pos.x += nx * push * ta * 2; a.pos.z += nz * push * ta * 2
      b.pos.x -= nx * push * tb * 2; b.pos.z -= nz * push * tb * 2
    }
  }
}
