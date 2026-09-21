import * as THREE from 'three'
import { rand, dist2d, dampAngle } from '../core/math.js'
import { models } from '../render/models.js'

/**
 * 폴리페모스의 양.
 *
 * ── 왜 양인가 ──
 * 『오디세이아』의 동굴은 빈 방이 아니다. 거인은 **목자**고, 그 방은 그의
 * 우리다 — 오디세우스가 살아 나오는 것도 양 배에 매달려서다. 그런데 게임의
 * 동굴에는 양이 한 마리도 없었다. 있어야 할 것이 없으면 판이 비어 보인다.
 *
 * ── 규칙 ──
 * 양은 **때리는 것도 아니고 때려도 되는 것도 아니다.** 적이 아니라 지형이다.
 * 다만 살아 있는 지형이라 제자리에 안 있는다. 그래서 이 판에 조심해서
 * 움직일 이유가 하나 생긴다 —
 *
 *   **부딪히면 운다. 그리고 그 소리가 거인에게 내 자리를 알려 준다.**
 *
 * 거인은 평소 마지막으로 본 자리를 향해 친다 (enemy/boss.js 의 aim).
 * 양이 울면 그 자리가 **지금 내 자리로 갱신되고, 다음 기술이 즉시 나간다.**
 * 멀리 돌아가는 길과 양 사이를 지나는 지름길 중에 고르는 것이 이 판의
 * 작은 판단이 된다. 소울라이크의 '공짜 이동이 없다' 를 잡몹이 아니라
 * 지형으로 만든 것이다.
 *
 * 밀치기는 한다 (actor 의 separate 가 아니라 여기서 직접). 몸을 통과하면
 * 양이 아니라 유령이고, 유령한테 부딪혔다고 우는 건 안 읽힌다.
 */

const R = 0.55          // 몸 반지름
const TOUCH = 0.55      // 이만큼 겹치면 부딪힌 것이다
const CALM = 4.5        // 한 번 울면 이만큼은 다시 안 운다

export class Sheep {
  /**
   * @param world  Game
   * @param x,z    처음 서는 자리
   */
  constructor(world, x, z) {
    this.world = world
    this.pos = new THREE.Vector3(x, 0, z)
    this.facing = rand(0, Math.PI * 2)
    this.radius = R
    this.isSheep = true
    this.quiet = rand(0, 2)      // 울고 난 뒤의 침묵 시간
    this.animT = rand(0, 4)
    this._run = 0
    this._flee = 0

    // 다음에 갈 자리. 양은 목적 없이 몇 걸음 옮기고 오래 선다
    this.goal = new THREE.Vector3(x, 0, z)
    this.wait = rand(1.5, 5)

    const made = models.create('sheep')
    this.group = new THREE.Group()
    if (made) {
      made.root.scale.multiplyScalar(0.9)
      this.group.add(made.root)
      this.rig = made
      this.mats = made.mats ?? []
    }
    this.group.position.copy(this.pos)
  }

  /** 울었다. 거인이 이쪽을 본다. */
  #cry(by) {
    if (this.quiet > 0) return
    this.quiet = CALM
    this._flee = rand(1.4, 2.2)
    const w = this.world
    w.sfx?.bleat?.()
    w.fx?.ring(this.pos.x, this.pos.z, { color: '#ffd9a0', radius: 2.2, life: 0.6 })
    // 소리가 퍼지는 그림 — 소리는 안 보이니 한 번은 보여 줘야 규칙으로 읽힌다
    w.particles?.burst?.({
      x: this.pos.x, y: 0.9, z: this.pos.z, count: 10,
      color: '#ffe6b8', speed: 4, size: 0.1, life: 0.5, gravity: -1,
    })
    w.onSheepCry?.(this, by)
  }

  think(dt) {
    const p = this.world.player
    if (this.quiet > 0) this.quiet -= dt
    if (this._flee > 0) this._flee -= dt

    // ── 부딪힘 ── 사람이든 동료든 몸이 닿으면 운다
    const bump = a => {
      if (!a || a.dead) return false
      const d = dist2d(a.pos, this.pos)
      if (d > R + (a.radius ?? 0.45) + TOUCH - 0.55) return false
      // 서로 밀어낸다. 양이 가볍다
      const nx = (this.pos.x - a.pos.x) / (d || 1), nz = (this.pos.z - a.pos.z) / (d || 1)
      const push = (R + (a.radius ?? 0.45) - d) * 0.9
      this.pos.x += nx * push
      this.pos.z += nz * push
      return true
    }
    if (bump(p) && !p.dead) this.#cry(p)
    for (const a of this.world.allies ?? []) bump(a)

    // ── 걷기 ──
    let speed = 1.5
    if (this._flee > 0) {
      // 놀라서 사람 반대쪽으로 종종걸음
      speed = 5.4
      const a = Math.atan2(this.pos.x - p.pos.x, this.pos.z - p.pos.z)
      this.goal.set(this.pos.x + Math.sin(a) * 4, 0, this.pos.z + Math.cos(a) * 4)
    } else if (this.wait > 0) {
      this.wait -= dt
      this._run += (0 - this._run) * Math.min(1, dt * 6)
      return
    }

    const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 0.3) {
      // 다음 자리를 고른다. 가운데(보스가 서고 장판이 깔리는 자리)는 피한다
      const arena = this.world.render3d?.arena
      for (let i = 0; i < 6; i++) {
        const a = rand(0, Math.PI * 2), r = rand(6, (this.world.arenaRadius ?? 20) - 3)
        const gx = Math.sin(a) * r, gz = Math.cos(a) * r
        const lim = arena ? arena.radiusAt(a) - 2 : (this.world.arenaRadius ?? 20) - 2
        if (r <= lim) { this.goal.set(gx, 0, gz); break }
      }
      this.wait = this._flee > 0 ? 0 : rand(2, 6)
      this._run += (0 - this._run) * Math.min(1, dt * 6)
      return
    }
    const step = Math.min(d, speed * dt)
    this.pos.x += (dx / d) * step
    this.pos.z += (dz / d) * step
    this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 0.12, dt)
    this._run += ((this._flee > 0 ? 1 : 0.4) - this._run) * Math.min(1, dt * 6)
  }

  sync() {
    this.group.position.copy(this.pos)
    this.group.rotation.y = this.facing
    const dt = 1 / 60
    this.animT += dt
    // 클립이 없는 모델이라 몸통을 흔들어 걷는 티를 낸다 (models.js 의 돼지와 같은 수법)
    if (this.rig?.pose) {
      this.rig.pose({ t: this.animT, run: this._run, attack: null, draw: null, roll: 0, dead: false }, dt)
    } else if (this.rig?.root) {
      const k = this._run
      this.rig.root.position.y = Math.abs(Math.sin(this.animT * 9)) * 0.06 * k
      this.rig.root.rotation.z = Math.sin(this.animT * 9) * 0.07 * k
    }
  }

  dispose() {
    this.rig?.dispose?.()
  }
}

/** 판 하나에 풀어 놓을 양들 */
export function spawnFlock(world, count = 6) {
  const out = []
  const R0 = world.arenaRadius ?? 20
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand(-0.4, 0.4)
    const r = rand(7, R0 - 4)
    out.push(new Sheep(world, Math.sin(a) * r, Math.cos(a) * r))
  }
  return out
}
