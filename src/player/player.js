import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { CURVE } from '../combat/action.js'
import { sectorHit } from '../combat/hit.js'
import { clamp, dampAngle } from '../core/math.js'
import { newStats } from './stats.js'

/**
 * 기본값은 일부러 느리다. 이동도 활도 처음엔 답답하고, 성장으로 풀어 나간다.
 * 여기 숫자를 올리기 전에 stats.js 의 선택지를 먼저 의심할 것.
 */
export const TUNING = {
  speed: 6.1,             // 기본 이동속도. 날랜 발을 모으면 빨라진다
  turnHalf: 0.035,        // 조준 추적 반감기. 작을수록 즉각적
  roll: {
    charges: 3,
    regen: 2.5,           // 충전 하나 차는 데 걸리는 시간. 가벼운 몸으로 줄인다
    duration: 0.44,
    distance: 6.0,        // 회피 거리는 성장으로 안 건드린다. 도망 수단은 일정해야 한다
    iframeStart: 0.04,
    iframeEnd: 0.32,      // 0.28초 무적. 짧게 잡아야 회피가 실력이 된다
    recovery: 0.10,
  },
  bow: {
    minDraw: 0.28,        // 여기까진 당겨야 나간다. 연사 방지
    fullDraw: 1.05,       // 꽉 채우기까지. 팽팽한 시위로 줄인다
    release: 0.36,        // 쏘고 난 후딜
  },
}

/* ── 칼 3타 ──────────────────────────────────────────────
   1·2타는 짧고 빠르게, 3타는 크게 휘두르고 후딜이 길다.
   "3타를 지를까 말까"가 고민이 되어야 근접전이 재미있다. */
function slash(cfg) {
  return {
    id: cfg.id,
    startup: cfg.startup, active: cfg.active, recovery: cfg.recovery,
    cancelAt: cfg.cancelAt,
    next: cfg.next,
    move: { distance: cfg.move, curve: CURVE.front },
    onActive(p) {
      const range = cfg.range * p.stats.meleeRange
      p.fx.slash(p.pos.x, p.pos.z, p.facing, range, cfg.halfAngle, cfg.id === 'slash3' ? '#ffd28a' : '#fff0d0')
      if (cfg.id === 'slash3') p.fx.shake(0.22)
    },
    onHitWindow(p, run) {
      const range = cfg.range * p.stats.meleeRange
      for (const e of p.world.enemies) {
        if (e.dead || run.hitSet.has(e)) continue
        if (!sectorHit(p.pos, p.facing, range, cfg.halfAngle, e)) continue
        run.hitSet.add(e)
        e.hurt(cfg.damage * p.stats.meleeDamage, {
          from: p.pos, knockback: cfg.knockback, hitstop: cfg.hitstop,
          stagger: cfg.stagger, crit: cfg.id === 'slash3',
          color: cfg.id === 'slash3' ? '#ffd166' : '#ffe9a8',
        })
      }
    },
  }
}

export const SLASH = {
  slash1: slash({ id: 'slash1', startup: 0.09, active: 0.07, recovery: 0.25, cancelAt: 0.21, next: 'slash2', move: 1.0, range: 3.0, halfAngle: 1.05, damage: 12, knockback: 3.5, hitstop: 0.055, stagger: 0.10 }),
  slash2: slash({ id: 'slash2', startup: 0.08, active: 0.07, recovery: 0.26, cancelAt: 0.21, next: 'slash3', move: 1.1, range: 3.1, halfAngle: 1.25, damage: 14, knockback: 4.0, hitstop: 0.06, stagger: 0.12 }),
  slash3: slash({ id: 'slash3', startup: 0.17, active: 0.10, recovery: 0.46, cancelAt: 0.42, next: null, move: 2.0, range: 3.8, halfAngle: 1.95, damage: 28, knockback: 11, hitstop: 0.11, stagger: 0.42 }),
}

function greybox() {
  const g = new THREE.Group()
  const mats = []
  const add = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); mats.push(mesh.material); return mesh }

  const cloth = new THREE.MeshStandardMaterial({ color: '#4a63a8', roughness: 0.8 })
  const skin = new THREE.MeshStandardMaterial({ color: '#b9885a', roughness: 0.7 })
  const bronze = new THREE.MeshStandardMaterial({ color: '#c89a54', roughness: 0.35, metalness: 0.75 })

  const torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.78, 6, 14), cloth))
  torso.position.y = 1.05
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skin))
  head.position.y = 1.78
  // 투구 볏 — 어느 쪽을 보는지 실루엣으로 읽히게
  const crest = add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.52), bronze))
  crest.position.set(0, 1.98, -0.02)
  const nose = add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 8), bronze))
  nose.rotation.x = Math.PI / 2
  nose.position.set(0, 1.74, 0.26)

  // 칼 — 오른손
  const sword = new THREE.Group()
  const blade = add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.25), bronze))
  blade.position.z = 0.55
  sword.add(blade)
  sword.position.set(0.4, 1.15, 0.1)
  sword.rotation.x = -0.5
  g.add(sword)

  // 발밑 표식 — 쿼터뷰에서 내 위치를 놓치지 않게
  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.56, 32),
    new THREE.MeshBasicMaterial({ color: '#8fc6ff', transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  mark.rotation.x = -Math.PI / 2
  mark.position.y = 0.02
  g.add(mark)

  return { group: g, mats, sword }
}

export class Player extends Actor {
  constructor(world, input, fx, projectiles) {
    super({ hp: 120, radius: 0.48, mass: 2.2, team: 'player', fx })
    this.world = world
    this.input = input
    this.projectiles = projectiles

    const vis = greybox()
    this.vis = vis.group
    this.group.add(vis.group)
    this.bodyMats = vis.mats
    this.sword = vis.sword

    this.stats = newStats()
    this.rollCharges = TUNING.roll.charges
    this.rollTimer = 0
    this.rolling = 0
    this.rollDir = new THREE.Vector3()
    this.drawing = 0          // 활 당긴 시간. 0 이면 안 당기는 중
    this.releaseLock = 0
    this.comboNext = null
    this._move = new THREE.Vector3()

    // 활 조준선
    this.aimLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 1),
      new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    this.aimLine.rotation.x = -Math.PI / 2
    this.aimLine.position.y = 0.04
    this.group.add(this.aimLine)
  }

  get canAct() { return !this.dead && this.rolling <= 0 && this.stagger <= 0 && this.releaseLock <= 0 }

  /** 선택지를 먹은 뒤 부른다. 공격속도는 액션 시계에, 체력은 최대치에 바로 반영된다. */
  applyStats() {
    this.actionRate = this.stats.actionRate
    const want = 120 + this.stats.bonusHp
    if (want > this.maxHp) { this.hp += want - this.maxHp; this.maxHp = want }
  }

  update(dt, aim) {
    if (this.dead) { this.step(dt, this.world.arenaRadius); return }

    // 구르기 충전 회복 — 하나씩 순서대로 찬다
    if (this.rollCharges < TUNING.roll.charges) {
      this.rollTimer += dt * this.stats.rollRegen
      if (this.rollTimer >= TUNING.roll.regen) { this.rollTimer -= TUNING.roll.regen; this.rollCharges++ }
    } else this.rollTimer = 0

    if (this.releaseLock > 0) this.releaseLock -= dt

    const R = TUNING.roll
    if (this.rolling > 0) {
      this.rolling -= dt
      const t = 1 - this.rolling / R.duration
      const elapsed = t * R.duration
      // 무적은 구르기 전체가 아니라 가운데 구간만. 여기가 실력의 자리다.
      this.invuln = (elapsed >= R.iframeStart && elapsed <= R.iframeEnd) ? 0.05 : 0
      const ease = 1 - Math.pow(1 - Math.min(t * 1.35, 1), 2.2)
      const prevEase = this._prevEase ?? 0
      const step = (ease - prevEase) * R.distance
      this._prevEase = ease
      this.pos.x += this.rollDir.x * step
      this.pos.z += this.rollDir.z * step
      if (this.rolling <= 0) { this._prevEase = 0; this.releaseLock = R.recovery }
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, true)
      return
    }

    this.input.moveVector(this._move)

    // 구르기는 공격 '후딜'만 끊을 수 있다. 예고와 판정 구간은 책임진다.
    const rollOk = !this.action.active || this.action.phase === 'recovery'
    if (rollOk && this.input.peek('roll') && this.rollCharges > 0 && this.stagger <= 0 && this.releaseLock <= 0) {
      this.input.consume('roll')
      this.#startRoll()
      return
    }

    if (this.action.active) {
      // 후딜 중 캔슬 창이 열리면 버퍼에 든 다음 입력을 꺼낸다
      if (this.action.cancelable) {
        const def = this.action.def
        if (this.input.peek('slash') && def.next) {
          this.input.consume('slash')
          this.action.stop()
          this.action.play(SLASH[def.next])
        } else if (this.input.peek('bow')) {
          this.input.consume('bow')
          this.action.stop()
          this.drawing = 0.0001
        }
      }
      if (this.action.phase !== 'recovery') this.faceTo(aim.x, aim.z)
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, false)
      return
    }

    // 활: 누르는 동안 당기고 떼면 쏜다
    if (this.drawing > 0) {
      this.drawing += dt * this.stats.drawRate
      this.facing = dampAngle(this.facing, Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z), TUNING.turnHalf * 2.4, dt)
      if (!this.input.isHeld('bow') && this.drawing >= TUNING.bow.minDraw) this.#release()
      else if (this.drawing > TUNING.bow.fullDraw + 1.2) this.#release()  // 무한 홀드 방지
      this.#moveBy(dt, 0.42)   // 당기는 중엔 느리게
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, false)
      return
    }
    if (this.input.consume('bow')) { this.drawing = 0.0001; this.#visual(dt, false); this.step(dt, this.world.arenaRadius); return }
    if (this.input.consume('slash')) { this.faceTo(aim.x, aim.z); this.action.play(SLASH.slash1); this.step(dt, this.world.arenaRadius); this.#visual(dt, false); return }

    this.facing = dampAngle(this.facing, Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z), TUNING.turnHalf, dt)
    this.#moveBy(dt, 1)
    this.step(dt, this.world.arenaRadius)
    this.#visual(dt, false)
  }

  #moveBy(dt, scale) {
    if (this._move.lengthSq() === 0) return
    const v = TUNING.speed * this.stats.moveSpeed * scale
    this.pos.x += this._move.x * v * dt
    this.pos.z += this._move.z * v * dt
  }

  #startRoll() {
    const R = TUNING.roll
    this.rollCharges--
    this.action.stop()
    this.drawing = 0
    this.rolling = R.duration
    this._prevEase = 0
    // 방향키를 안 누르고 있으면 보는 쪽으로 구른다
    if (this._move.lengthSq() > 0) this.rollDir.copy(this._move)
    else this.rollDir.set(Math.sin(this.facing), 0, Math.cos(this.facing))
    this.facing = Math.atan2(this.rollDir.x, this.rollDir.z)
    this.fx.ring(this.pos.x, this.pos.z, { color: '#79b7ff', radius: 1.3, life: 0.28 })
  }

  #release() {
    const t = clamp((this.drawing - TUNING.bow.minDraw) / (TUNING.bow.fullDraw - TUNING.bow.minDraw), 0, 1)
    const full = t >= 0.98
    this.projectiles.spawn({
      x: this.pos.x + Math.sin(this.facing) * 0.7,
      z: this.pos.z + Math.cos(this.facing) * 0.7,
      dir: this.facing,
      speed: 32 + t * 20,
      damage: (9 + t * 17) * this.stats.rangedDamage,
      team: 'player',
      pierce: full ? 2 : 0,
      knockback: 3 + t * 5,
      hitstop: full ? 0.07 : 0.035,
      color: full ? '#ffe08a' : '#ff9a4a',
      range: 30 + t * 12,
    })
    this.drawing = 0
    this.releaseLock = TUNING.bow.release
    this.fx.shake(full ? 0.16 : 0.07)
    this.fx.ring(this.pos.x, this.pos.z, { color: full ? '#ffe08a' : '#ff9a4a', radius: 1.1, life: 0.2 })
  }

  #visual(dt, rolling) {
    // 칼 자세 — 액션 단계에 따라 대충 흔들어준다. 진짜 애니메이션 붙기 전까지의 임시.
    const run = this.action
    let swing = 0
    if (run.active) {
      const k = run.t / run.total
      swing = run.phase === 'startup' ? -0.9 * (run.t / run.def.startup) : Math.sin(clamp((k - 0.2) * 3.4, 0, 1) * Math.PI) * 2.3 - 0.9
    }
    this.sword.rotation.x = -0.5 + swing
    this.sword.rotation.z = rolling ? 1.2 : swing * 0.3
    // 구르는 동안 몸을 앞으로 한 바퀴 굴린다
    this.vis.rotation.x = rolling ? (1 - this.rolling / TUNING.roll.duration) * Math.PI * 2 : 0
    this.vis.position.y = rolling ? -0.18 : 0

    const drawK = this.drawing > 0 ? clamp((this.drawing - TUNING.bow.minDraw) / (TUNING.bow.fullDraw - TUNING.bow.minDraw), 0, 1) : 0
    this.aimLine.material.opacity = this.drawing > 0 ? 0.18 + drawK * 0.5 : 0
    if (this.drawing > 0) {
      // group 이 이미 facing 만큼 돌아있어서 로컬 +Z 가 곧 조준 방향이다
      const len = 8 + drawK * 12
      this.aimLine.scale.set(1, len, 1)
      this.aimLine.position.set(0, 0.04, len / 2 + 0.6)
    }
  }
}
