import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { sectorHit, circleHit, ringHit } from '../combat/hit.js'
import { dist2d, dampAngle, rand, clamp } from '../core/math.js'
import { createCharacter } from '../render/character.js'
import { buildFigure, wrapFigure } from '../render/figure.js'

/**
 * 보스.
 *
 * 규칙은 잡몹과 같다 — 시전이 시작되면 그 자리에 장판을 깔고 위치도 방향도 잠근다.
 * 판정은 현재 위치가 아니라 잠긴 위치에서 본다. 보스라고 예외를 두면
 * "분명히 피했는데 맞았다"가 되고, 그 순간 소울라이크가 아니게 된다.
 *
 * 패턴은 전부 데이터다. 보스 하나를 만드는 건 패턴 목록을 쓰는 일이다.
 */

/* ── 패턴 만들기 ─────────────────────────────────────────── */

const base = (cfg, shape, onFire) => ({
  id: cfg.id,
  startup: cfg.startup, active: cfg.active ?? 0.1, recovery: cfg.recovery,
  pick: cfg.pick,                       // { min, max, cooldown, weight }
  groggy: cfg.groggy ?? 0,              // 끝나고 멍한 시간. 반격 창이다
  pulls: cfg.pulls ?? 0,                // 초당 몇 유닛으로 끌어당기는가
  onStart(b, run) {
    run.origin = { x: b.pos.x, z: b.pos.z }
    run.lockFacing = b.facing
    run.aim = { x: b.world.player.pos.x, z: b.world.player.pos.z }
    if (cfg.say) b.world.onBossSay?.(cfg.say)
    const t = shape(b, run)
    run.telegraph = b.fx.telegraph.show({
      ...t, duration: cfg.startup / (b.actionRate ?? 1), color: cfg.color ?? '#ff3a2e',
    })
    cfg.onStart?.(b, run)
  },
  onActive(b, run) {
    b.fx.shake(cfg.shake ?? 0.2)
    onFire(b, run)
  },
  onEnd(b, run) {
    if (cfg.groggy) b.setGroggy(cfg.groggy)
    cfg.onEnd?.(b, run)
  },
})

const landed = (b, run, cfg, x, z) => {
  const p = b.world.player
  if (p.dead || run.hitSet.has(p)) return
  run.hitSet.add(p)
  p.hurt(cfg.damage, {
    from: { x, z }, knockback: cfg.knockback ?? 9, hitstop: 0.09,
    stagger: cfg.stagger ?? 0.3, color: '#ff6b5a',
  })
}

/** 부채꼴 후려치기. 보스의 기본 공격. */
export const slam = cfg => base(cfg,
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: run.lockFacing, range: cfg.range, halfAngle: cfg.halfAngle }),
  (b, run) => {
    b.fx.slash(run.origin.x, run.origin.z, run.lockFacing, cfg.range, cfg.halfAngle, '#ff8c6a')
    if (sectorHit(run.origin, run.lockFacing, cfg.range, cfg.halfAngle, b.world.player)) {
      landed(b, run, cfg, run.origin.x, run.origin.z)
    }
  })

/** 원형 내려찍기. 발밑이 위험하다. */
export const stomp = cfg => base(cfg,
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0, range: cfg.radius, halfAngle: Math.PI }),
  (b, run) => {
    b.fx.ring(run.origin.x, run.origin.z, { color: '#ff7a4a', radius: cfg.radius * 1.4, life: 0.45 })
    if (circleHit(run.origin.x, run.origin.z, cfg.radius, b.world.player)) {
      landed(b, run, cfg, run.origin.x, run.origin.z)
    }
  })

/** 도넛. 붙어 있으면 안 맞는다 — 물러서는 습관을 깨는 패턴. */
export const ring = cfg => base(cfg,
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0, range: cfg.outer, inner: cfg.inner, halfAngle: Math.PI }),
  (b, run) => {
    b.fx.ring(run.origin.x, run.origin.z, { color: '#ffb02e', radius: cfg.outer * 1.3, life: 0.5 })
    if (ringHit(run.origin.x, run.origin.z, cfg.inner, cfg.outer, b.world.player)) {
      landed(b, run, cfg, run.origin.x, run.origin.z)
    }
  })

/** 조준선을 깔고 쏘는 직선기. */
export const lance = cfg => base(cfg,
  (b, run) => {
    run.lockFacing = Math.atan2(run.aim.x - b.pos.x, run.aim.z - b.pos.z)
    return { x: run.origin.x, z: run.origin.z, facing: run.lockFacing, range: cfg.range, halfAngle: cfg.halfAngle ?? 0.09 }
  },
  (b, run) => {
    if (sectorHit(run.origin, run.lockFacing, cfg.range, cfg.halfAngle ?? 0.09, b.world.player)) {
      landed(b, run, cfg, run.origin.x, run.origin.z)
    }
    b.fx.slash(run.origin.x, run.origin.z, run.lockFacing, cfg.range * 0.6, cfg.halfAngle ?? 0.09, '#ffd08a')
  })

/** 투사체 부채. 탄막의 기본. */
export const volley = cfg => base(cfg,
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: Math.atan2(run.aim.x - b.pos.x, run.aim.z - b.pos.z), range: cfg.range ?? 9, halfAngle: cfg.spread ?? 0.5 }),
  (b, run) => {
    const dir = Math.atan2(run.aim.x - run.origin.x, run.aim.z - run.origin.z)
    const n = cfg.count ?? 5
    for (let i = 0; i < n; i++) {
      const a = dir + (n === 1 ? 0 : ((i / (n - 1)) - 0.5) * (cfg.spread ?? 0.5) * 2)
      b.world.projectiles.spawn({
        x: run.origin.x + Math.sin(a) * 1.1, z: run.origin.z + Math.cos(a) * 1.1,
        dir: a, speed: cfg.speed ?? 12, damage: cfg.damage, team: 'enemy',
        knockback: 5, color: cfg.bullet ?? '#ff5a2e', range: cfg.range ?? 26,
        radius: cfg.bulletSize ?? 0.34, kind: cfg.kind ?? 'rock',
        homing: cfg.homing ?? 0, parryable: !!cfg.parryable,
        // 변신 마법은 맞으면 느려지고, 쳐내면 오히려 시전자가 휘청인다
        onHitExtra: cfg.hex ? (target => target.world?.onHex?.() ?? target.onHex?.()) : null,
        onParry: cfg.parryable ? () => { b.setGroggy(1.4) } : null,
      })
    }
  })

/** 사방으로 흩뿌리는 탄막. 세이렌·카리브디스용. */
export const spray = cfg => base(cfg,
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0, range: cfg.warn ?? 4, halfAngle: Math.PI }),
  (b, run) => {
    const n = cfg.count ?? 14
    const off = rand(0, Math.PI * 2)
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2
      b.world.projectiles.spawn({
        x: run.origin.x + Math.sin(a) * 1.0, z: run.origin.z + Math.cos(a) * 1.0,
        dir: a, speed: cfg.speed ?? 8, damage: cfg.damage, team: 'enemy',
        knockback: 4, color: cfg.bullet ?? '#b48cff', range: 30, radius: cfg.bulletSize ?? 0.36,
        kind: cfg.kind ?? 'orb',
      })
    }
  })

/**
 * 빨아들이기. 시전 동안 플레이어를 가운데로 끈다.
 * 걸어서는 못 벗어나고 구르기로 끊어야 한다. 끝나면 잠잠해지고, 그때가 근접 창이다.
 */
export const suck = cfg => base(cfg,
  (b, run) => ({ x: b.pos.x, z: b.pos.z, facing: 0, range: cfg.radius ?? 15, inner: cfg.eye ?? 2.2, halfAngle: Math.PI, color: cfg.color ?? '#6fa8ff' }),
  (b, run) => {
    b.fx.ring(b.pos.x, b.pos.z, { color: '#8fd6ff', radius: (cfg.radius ?? 15) * 0.5, life: 0.5 })
    const p = b.world.player
    if (circleHit(b.pos.x, b.pos.z, cfg.eye ?? 2.2, p)) landed(b, run, cfg, b.pos.x, b.pos.z)
  })

/** 잡졸 소환. */
export const summon = cfg => base(cfg,
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0, range: cfg.radius ?? 5, halfAngle: Math.PI, color: '#8fd06a' }),
  (b, run) => {
    for (let i = 0; i < (cfg.count ?? 2); i++) {
      const a = rand(0, Math.PI * 2)
      const r = rand(2.5, cfg.radius ?? 5)
      b.world.spawnMinion?.(cfg.kind, run.origin.x + Math.sin(a) * r, run.origin.z + Math.cos(a) * r)
    }
  })

/* ── 보스 ────────────────────────────────────────────────── */

export class Boss extends Actor {
  constructor(world, fx, cfg) {
    super({ hp: cfg.hp, radius: cfg.radius, mass: cfg.mass ?? 30, team: 'enemy', fx })
    this.world = world
    this.cfg = cfg
    this.isBoss = true
    this.phaseIndex = -1
    this.groggy = 0
    this.cooldowns = new Map()
    this.gap = cfg.gap ?? [3, 6]
    this.animT = rand(0, 4)
    this._run = 0
    this._moved = 0
    this.downed = null      // { weak: '약점 이름', hp } — 여기 맞아야 다음 페이즈로 간다
    this.fleeing = false

    const built = buildBossBody(cfg.look)
    this.rig = built.rig
    this.group.add(built.rig.root)
    this.bodyMats = built.mats
  }

  get phase() { return this.cfg.phases[Math.max(0, this.phaseIndex)] }

  /** 그로기 — 큰 기술 뒤의 반격 창. 여기서 몰아쳐야 보스가 넘어간다. */
  setGroggy(sec) {
    this.groggy = sec
    this.fx.number(this.pos.clone().setY(this.cfg.barHeight ?? 3), '그로기', { color: '#ffd166', size: 26 })
  }

  hurt(amount, opts = {}) {
    // 그로기 중에는 더 아프게 맞는다
    const mult = this.groggy > 0 ? (this.cfg.groggyMult ?? 1.8) : 1
    return super.hurt(amount * mult, { ...opts, knockback: 0, stagger: 0, crit: this.groggy > 0 })
  }

  think(dt) {
    const p = this.world.player
    if (this.dead || p.dead) return

    // 쓰러져 있는 동안은 아무것도 안 한다. 약점을 맞아야 일어난다.
    if (this.downed) {
      this.downedT = (this.downedT ?? 0) + dt
      if (this.downedT % 0.5 < dt) {
        this.fx.number(this.pos.clone().setY((this.cfg.barHeight ?? 3) + 0.6),
          this.downed.hint ?? '약점', { color: '#ffd166', size: 20 })
      }
      return
    }

    // 페이즈 전환
    const ratio = this.hp / this.maxHp
    let want = 0
    for (let i = 0; i < this.cfg.phases.length; i++) {
      if (ratio <= (this.cfg.phases[i].below ?? 1)) want = i
    }

    // 다음 페이즈가 '쓰러진 뒤 약점을 맞아야' 열리는 것이면 여기서 멈춘다
    const nextPhase = this.cfg.phases[want]
    if (want > this.phaseIndex && nextPhase?.needsWeakPoint && !this.weakPointDone) {
      this.#goDown(nextPhase)
      return
    }

    if (want !== this.phaseIndex) {
      this.phaseIndex = want
      this.action.stop()
      this.groggy = 0
      const ph = this.phase
      if (ph.say) this.world.onBossSay?.(ph.say)
      ph.onEnter?.(this)
      this.fx.ring(this.pos.x, this.pos.z, { color: '#ffd166', radius: this.radius * 4, life: 0.7 })
      this.fx.shake(0.5)
      this.nextAt = 0.9
    }

    // 빨아들이는 동안은 매 프레임 끌어당긴다. 구르기 무적 중엔 안 끌린다.
    const run = this.action
    if (run.active && run.def.pulls && run.phase !== 'recovery') {
      const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z
      const d0 = Math.hypot(dx, dz) || 1
      const force = run.def.pulls * (run.phase === 'active' ? 1 : 0.45)
      if (p.invuln <= 0 && p.rolling <= 0) {
        p.pos.x += (dx / d0) * force * dt
        p.pos.z += (dz / d0) * force * dt
      }
    }

    if (this.groggy > 0) { this.groggy -= dt; return }
    if (this.action.active) return

    for (const [k, v] of this.cooldowns) this.cooldowns.set(k, v - dt)

    this.nextAt = (this.nextAt ?? 0) - dt
    const d = dist2d(this.pos, p.pos)
    const want2 = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)
    this.facing = dampAngle(this.facing, want2, this.cfg.turnHalf ?? 0.16, dt)

    if (this.nextAt <= 0) {
      const pick = this.#choose(d)
      if (pick) {
        this.action.play(pick)
        this.cooldowns.set(pick.id, pick.pick?.cooldown ?? 3)
        this.nextAt = rand(this.gap[0], this.gap[1]) * (this.cfg.pace ?? 1)
        return
      }
    }

    // 간격 유지. 도망치는 보스는 가까워지면 더 세게 물러난다.
    const [near, far] = this.cfg.keepRange ?? [3, 6]
    let fwd = 0
    if (this.cfg.flees && d < near) fwd = -1.6
    else if (d > far) fwd = 1
    else if (d < near) fwd = -0.6
    const sp = this.cfg.speed ?? 2.6
    const dx = Math.sin(want2) * fwd * sp * dt
    const dz = Math.cos(want2) * fwd * sp * dt
    this.pos.x += dx; this.pos.z += dz
    this._moved = Math.hypot(dx, dz) / Math.max(dt, 1e-4) / Math.max(sp, 1e-4)
  }

  /**
   * 드러난 약점. 쓰러져 있을 때만 있다.
   * requires 가 있으면 그 종류의 투사체만 통한다 — 폴리페모스의 눈은 화살로만 찌른다.
   */
  getWeakPoint() {
    if (!this.downed) return null
    const w = this.cfg.weakPoint ?? {}
    return {
      x: this.pos.x + Math.sin(this.facing) * (w.z ?? 0.6),
      y: w.y ?? 1.6,
      z: this.pos.z + Math.cos(this.facing) * (w.z ?? 0.6),
      r: w.r ?? 0.9,
      requires: w.requires ?? null,
    }
  }

  /** 쓰러진다. 이제 약점이 드러나고, 그걸 맞혀야 일어난다. */
  #goDown(phase) {
    this.downed = { hint: phase.weakHint ?? '약점' }
    this.downedT = 0
    this.action.stop()
    this.groggy = 0
    this.hp = Math.max(this.hp, this.maxHp * (phase.below ?? 0.5))   // 더 안 깎이게
    this.world.onBossDown?.(this, phase)
    this.fx.shake(0.8)
    this.fx.ring(this.pos.x, this.pos.z, { color: '#ffd166', radius: this.radius * 5, life: 0.9 })
  }

  /** 약점이 맞았다. 일어나면서 다음 페이즈로 간다. */
  weakPointHit() {
    if (!this.downed) return false
    this.downed = null
    this.weakPointDone = true
    this.world.onBossWeakHit?.(this)
    this.fx.shake(1.0)
    this.fx.freeze(0.16)
    return true
  }

  #choose(d) {
    const options = this.phase.patterns.filter(a => {
      const r = a.pick ?? {}
      if ((this.cooldowns.get(a.id) ?? 0) > 0) return false
      if (r.min != null && d < r.min) return false
      if (r.max != null && d > r.max) return false
      return true
    })
    if (!options.length) return null
    const total = options.reduce((s, a) => s + (a.pick?.weight ?? 1), 0)
    let r = Math.random() * total
    for (const a of options) { r -= a.pick?.weight ?? 1; if (r <= 0) return a }
    return options[0]
  }

  sync(camera) {
    super.sync(camera)
    const dt = 1 / 60
    this.animT += dt
    this._run += (clamp(this._moved, 0, 1) - this._run) * 0.15
    this._moved *= 0.86
    let attack = null
    const run = this.action
    if (run.active) {
      const c = run.def
      if (run.t < c.startup) attack = { wind: Math.pow(run.t / c.startup, 0.5), swing: 0 }
      else {
        const k = clamp((run.t - c.startup) / (c.active + c.recovery), 0, 1)
        const hit = Math.min(k / 0.3, 1)
        const out = 1 - clamp((k - 0.5) / 0.5, 0, 1)
        attack = { wind: (1 - hit) * out, swing: Math.sin(hit * Math.PI / 2) * out }
      }
    }
    this.rig.pose({
      t: this.animT, run: this._run, attack, draw: null, roll: 0,
      attackId: run.def?.id, attackDuration: run.active ? run.total : 1,
      dead: this.dead,
      flinch: this.groggy > 0 ? 1 : 0,
    }, dt)
  }
}

function buildBossBody(look) {
  const rig = createCharacter({
    height: look.height, tint: look.tint, gear: look.gear ?? [], bulk: look.bulk ?? 1,
  })
  if (rig) return { rig, mats: rig.mats }
  const fig = buildFigure({ scale: look.height / 1.8, bulk: look.bulk ?? 1, palette: look.palette ?? {
    skin: '#8a6a4a', cloth: '#4a3a2a', leather: '#3a2f22', bronze: '#9c7434', accent: '#5a2a22', dark: '#241a14',
  } })
  return { rig: wrapFigure(fig), mats: fig.mats }
}
