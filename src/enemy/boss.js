import * as THREE from 'three'
import { models } from '../render/models.js'
import { attachBossParts, attachModelParts } from './bossparts.js'
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
  breakable: cfg.breakable ?? false,    // 맞으면 끊기는가 (Boss.hurt)
  breakSay: cfg.breakSay,               // 끊었을 때 한 줄
  breakBy: cfg.breakBy ?? 'any',        // 'any' 아무 타격 · 'draw' 꽉 당긴 화살만
  head: cfg.head ?? null,               // 이 패턴이 '머리' 하나인가 (Boss.#sever)
  onStart(b, run) {
    run.origin = { x: b.pos.x, z: b.pos.z }
    run.lockFacing = b.facing
    run.strikeAt = null
    // 머리가 따로 있는 보스는 그 머리 밑동에서 친다 (Boss.headOrigin)
    if (cfg.head != null) {
      // 5 는 촉수가 실제로 닿는 거리다 — 밑동이 갑판 아래라 길이 일부가
      // 세로로 먹혀서, 6 으로 두면 끝이 원 가장자리에 떨어졌다
      const h = b.headOrigin?.(cfg.head, cfg.at ?? 'base', cfg.reach ?? 5)
      if (h) {
        run.origin = { x: h.x, z: h.z }
        run.lockFacing = h.facing
        run.strikeAt = { x: h.tx, z: h.tz }
      }
    }
    run.aim = { x: b.world.player.pos.x, z: b.world.player.pos.z }
    if (cfg.say) b.world.onBossSay?.(cfg.say)
    const t = shape(b, run)
    run.telegraph = b.fx.telegraph.show({
      ...t, duration: cfg.startup / (b.actionRate ?? 1), color: cfg.color ?? '#ff3a2e',
    })
    cfg.onStart?.(b, run)
  },
  onActive(b, run) {
    // 흔들림이 큰 패턴에만 '쿵' 을 얹는다. 전부에 넣으면 소리가 벽이 되고,
    // 그러면 무엇이 큰 것인지 귀로 구분이 안 된다 — 흔들림이 곧 크기다.
    if ((cfg.shake ?? 0.2) >= 0.4) b.world.sfx?.boom()
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
export const stomp = cfg => base({ at: 'point', ...cfg },
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0, range: cfg.radius, halfAngle: Math.PI }),
  (b, run) => {
    b.fx.ring(run.origin.x, run.origin.z, { color: '#ff7a4a', radius: cfg.radius * 1.4, life: 0.45 })
    if (circleHit(run.origin.x, run.origin.z, cfg.radius, b.world.player)) {
      landed(b, run, cfg, run.origin.x, run.origin.z)
    }
  })

/** 도넛. 붙어 있으면 안 맞는다 — 물러서는 습관을 깨는 패턴.
 *  머리가 치는 도넛은 머리 밑동이 아니라 **내리친 자리**에서 퍼진다 —
 *  뒤쪽 머리의 밑동은 뱃전 밖이라 거기서 퍼지면 갑판에 반만 걸친다. */
export const ring = cfg => base({ at: 'point', ...cfg },
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0, range: cfg.outer, inner: cfg.inner, halfAngle: Math.PI }),
  (b, run) => {
    b.fx.ring(run.origin.x, run.origin.z, { color: '#ffb02e', radius: cfg.outer * 1.3, life: 0.5 })
    if (ringHit(run.origin.x, run.origin.z, cfg.inner, cfg.outer, b.world.player)) {
      landed(b, run, cfg, run.origin.x, run.origin.z)
    }
  })

/**
 * 노래 — 정면으로 퍼지고 등 뒤 한 조각만 조용하다.
 *
 * 왜 이 보스에게 이걸 주는가. 앞의 보스들은 정답이 각각 물러서기(거인),
 * 표적 바꾸기(왕), 들어가기(마녀)였다. 셋 다 **거리**에 관한 답이다.
 * 이것 하나는 **방향**에 관한 답으로 둔다 — 가까이 있어도 되고 멀리 있어도
 * 되는데, 등 뒤여야 한다.
 *
 * 부채꼴이 거의 다 덮이므로 장판에서 **안 칠해진 조각**이 정답이 된다.
 * 장판이 위험을 그리는 판에서, 안전한 데를 그려서 보여 주는 건 이것뿐이다.
 *
 * 노래는 안 아프다 — 붙잡는다. 맞으면 오래 느려진다. 그러면 그 다음 탄막이
 * 아픈 것이 된다. 아픈 걸 두 번 겹치면 즉사표가 되고, 즉사표는 배울 기회를
 * 안 준다.
 */
export const gaze = cfg => base(cfg,
  (b, run) => {
    // 시전이 시작되는 순간 나를 본다. 그 뒤로는 안 돈다 — 돌면 등 뒤가 없다.
    run.lockFacing = Math.atan2(run.aim.x - b.pos.x, run.aim.z - b.pos.z)
    return { x: run.origin.x, z: run.origin.z, facing: run.lockFacing,
      range: cfg.range ?? 26, halfAngle: cfg.halfAngle ?? Math.PI * 0.5,
      color: cfg.color ?? '#8fd6ff' }
  },
  (b, run) => {
    const p = b.world.player
    b.fx.meanderRing(run.origin.x, run.origin.z, { color: '#bfe4ff', radius: 4.5, life: 0.9, spin: 1.2 })
    if (!sectorHit(run.origin, run.lockFacing, cfg.range ?? 26, cfg.halfAngle ?? Math.PI * 0.5, p)) return
    p.hurt(cfg.damage ?? 12, { from: run.origin, knockback: 0, hitstop: 0.12,
      stagger: cfg.stagger ?? 0.2, color: '#8fd6ff' })
    p.slow?.(cfg.slowFor ?? 3.2, cfg.slowTo ?? 0.42)
    b.world.onBossSay?.(cfg.caughtSay ?? '노래가 발을 붙든다')
    b.world.particles?.converge({ x: p.pos.x, y: 1.1, z: p.pos.z, count: 26, radius: 4.0,
      color: '#bfe4ff', size: 0.15, life: 0.9 })
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
 * 던지기.
 *
 * 직선으로 쏘면 로켓처럼 보인다. 던진 것은 포물선으로 날아가 바닥에 떨어져야 한다.
 * 떨어질 자리에 미리 원을 깔아 두면 읽고 피할 수 있다 — 던지는 공격의 기본 문법이다.
 */
export const lob = cfg => base(cfg,
  (b, run) => {
    run.spots = []
    const n = cfg.count ?? 1
    for (let i = 0; i < n; i++) {
      const sx = n === 1 ? 0 : rand(-(cfg.scatter ?? 3.5), cfg.scatter ?? 3.5)
      const sz = n === 1 ? 0 : rand(-(cfg.scatter ?? 3.5), cfg.scatter ?? 3.5)
      const spot = { x: run.aim.x + sx, z: run.aim.z + sz }
      run.spots.push(spot)
      // 첫 자리는 base 가 그려 주고, 나머지는 여기서 직접 깐다
      if (i > 0) {
        b.fx.telegraph.show({
          x: spot.x, z: spot.z, facing: 0, range: cfg.radius ?? 2.4, halfAngle: Math.PI,
          duration: (cfg.startup + (cfg.flight ?? 0.9)) / (b.actionRate ?? 1),
          color: cfg.color ?? '#e8a860',
        })
      }
    }
    const first = run.spots[0]
    return { x: first.x, z: first.z, facing: 0, range: cfg.radius ?? 2.4, halfAngle: Math.PI,
      duration: cfg.startup + (cfg.flight ?? 0.9) }
  },
  (b, run) => {
    for (const spot of run.spots) {
      b.world.projectiles.spawn({
        x: run.origin.x, z: run.origin.z, y: 2.4,
        dir: Math.atan2(spot.x - run.origin.x, spot.z - run.origin.z),
        kind: cfg.kind ?? 'sheep', color: cfg.bullet ?? '#efe9dc',
        damage: 0, team: 'enemy', radius: cfg.bulletSize ?? 0.6,
        lob: { from: { x: run.origin.x, z: run.origin.z }, to: spot, time: cfg.flight ?? 0.9, height: cfg.height ?? 5.5 },
        onLand: (x, z) => {
          b.fx.ring(x, z, { color: '#e8a860', radius: (cfg.radius ?? 2.4) * 1.4, life: 0.5 })
          b.fx.shake(0.32)
          b.world.particles?.burst({ x, y: 0.4, z, count: 22, color: '#c9ad82', speed: 6, size: 0.18, life: 0.7, gravity: 11 })
          const p = b.world.player
          if (circleHit(x, z, cfg.radius ?? 2.4, p)) {
            p.hurt(cfg.damage, { from: { x, z }, knockback: cfg.knockback ?? 10, hitstop: 0.1,
              stagger: cfg.stagger ?? 0.32, color: '#ff6b5a' })
          }
        },
      })
    }
  })

/**
 * 빨아들이기. 시전 동안 플레이어를 가운데로 끈다.
 * 걸어서는 못 벗어나고 구르기로 끊어야 한다. 끝나면 잠잠해지고, 그때가 근접 창이다.
 */
/**
 * 빨아들이기. 소용돌이.
 *
 * 피해는 눈 안에 있는 매 순간 조금씩 들어간다 (Boss.think 에서 처리).
 * 여기서는 끝나는 순간 — 물이 잠잠해지며 뱉어 내는 것만 맡는다.
 * 순간이동처럼 튕기지 않게 위치를 옮기지 않고 속도만 준다.
 */
export const suck = cfg => base(cfg,
  (b, run) => ({ x: b.pos.x, z: b.pos.z, facing: 0, range: cfg.radius ?? 15, inner: cfg.eye ?? 2.2, halfAngle: Math.PI, color: cfg.color ?? '#6fa8ff' }),
  (b, run) => {
    b.fx.ring(b.pos.x, b.pos.z, { color: '#8fd6ff', radius: (cfg.radius ?? 15) * 0.5, life: 0.5 })
    const p = b.world.player
    if (!circleHit(b.pos.x, b.pos.z, (cfg.eye ?? 2.2) * 1.2, p)) return
    // 뱉어 낸다 — 밀어내는 힘만 주고 자리는 안 건드린다
    const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z
    const d = Math.hypot(dx, dz) || 1
    p.vel.x += (dx / d) * 16
    p.vel.z += (dz / d) * 16
    p.hurt(cfg.damage * 0.6, {
      from: b.pos, knockback: 0, hitstop: 0.12,
      stagger: cfg.stagger ?? 0.35, color: '#8fd6ff',
    })
    b.fx.shake(0.7)
    b.world.particles?.burst({
      x: p.pos.x, y: 0.7, z: p.pos.z, count: 26,
      color: '#bfe4ff', speed: 12, size: 0.2, life: 0.7, gravity: 6, up: 1.2,
    })
  })

/**
 * 잡졸 소환.
 * kind 하나로도 되고, mix 로 섞어 부를 수도 있다 —
 * { warrior: 3, archer: 2, shield: 1 } 처럼 가중치를 준다.
 * 한 종류만 몰려오면 대응이 하나뿐이라 그냥 수가 는 것에 그친다.
 */
const pickFrom = mix => {
  const rows = Object.entries(mix)
  let n = Math.random() * rows.reduce((a, [, w]) => a + w, 0)
  for (const [k, w] of rows) { n -= w; if (n <= 0) return k }
  return rows[0][0]
}

export const summon = cfg => base(cfg,
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0, range: cfg.radius ?? 5, halfAngle: Math.PI, color: '#8fd06a' }),
  (b, run) => {
    for (let i = 0; i < (cfg.count ?? 2); i++) {
      const a = rand(0, Math.PI * 2)
      const r = rand(2.5, cfg.radius ?? 5)
      const kind = cfg.mix ? pickFrom(cfg.mix) : cfg.kind
      const e = b.world.spawnMinion?.(kind, run.origin.x + Math.sin(a) * r, run.origin.z + Math.cos(a) * r)
      // 부름꾼. 이 표가 붙은 놈이 살아 있는 동안 보스는 안 깎인다 (Boss.#warded).
      // 잡졸이 그냥 수를 늘리는 게 아니라 **먼저 치워야 하는 것**이 된다.
      if (e && cfg.guards) e.guardsBoss = b
    }
    if (cfg.guards) b.fx.ring(b.pos.x, b.pos.z, { color: '#8fd06a', radius: b.radius * 3.2, life: 0.7 })
  })

/**
 * 끊어야 하는 시전.
 *
 * 긴 시전 동안 아무것도 안 하면 보스가 체력을 되찾는다. 때리면 끊긴다.
 * 이게 왜 다른 파훼인가 — 다른 패턴은 다 "피하는 것" 이라 정답이 물러서기다.
 * 이것 하나는 정답이 **들어가기**다. 한 판에 도망만 있으면 리듬이 하나뿐이다.
 *
 * @param cfg.heal  최대 체력의 몇 할을 되찾는가
 */
export const mend = cfg => base({ ...cfg, breakable: true },
  (b, run) => ({ x: run.origin.x, z: run.origin.z, facing: 0,
    range: cfg.radius ?? 3.2, halfAngle: Math.PI, color: cfg.color ?? '#7fe0a0' }),
  (b, run) => {
    // 여기까지 왔으면 못 끊은 것이다
    const back = b.maxHp * (cfg.heal ?? 0.14)
    b.hp = Math.min(b.maxHp, b.hp + back)
    b.fx.number(b.pos.clone().setY(b.cfg.barHeight ?? 3), `+${Math.round(back)}`, { color: '#7fe0a0', size: 26 })
    b.fx.ring(b.pos.x, b.pos.z, { color: '#7fe0a0', radius: (cfg.radius ?? 3.2) * 1.5, life: 0.7 })
    b.world.particles?.converge({ x: b.pos.x, y: 1.4, z: b.pos.z, count: 34, radius: 5.5,
      color: '#9ff0c0', size: 0.16, life: 0.7 })
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

    // 이름이 곧 파훼법인 보스들은 그게 몸에 보여야 한다 —
    // 외눈·여섯 머리·아가리. 공용 뼈대에 코드로 매단다 (enemy/bossparts.js)
    this.parts = built.own
      ? attachModelParts(cfg.id, this.rig.root)
      : attachBossParts(cfg.id, this.rig, cfg.look)

    // 갑판 아래로 몸을 내린다. 뱃전에 매달린 것은 몸이 다 보이면 안 된다 —
    // 물 밖으로 나온 만큼만 보여야 '올라온 것' 으로 읽힌다.
    if (cfg.look?.sink) this.rig.root.position.y -= cfg.look.sink
    // 매 프레임 쓰러짐 높이를 덮어쓰므로 기준 높이를 따로 쥔다.
    // 안 그러면 위의 sink 가 첫 프레임에 0 으로 지워진다.
    this._baseY = this.rig.root.position.y

    // 사람 몸을 아예 감춘다.
    //
    // 스킬라는 절벽에서 뻗는 돌이고 카리브디스는 소용돌이다 — 둘 다 사람
    // 형상이 아니다. 그런데 뼈대는 그대로 쓴다: 애니메이션·본·공격 프레임이
    // 전부 거기 걸려 있어서, 버리면 촉수를 움직일 축이 없어진다.
    // 그래서 **뼈는 두고 살만 숨긴다.** 촉수는 그 뼈에 매달려 같이 움직인다.
    //
    // 공용 사람 몸일 때만이다. 제 모델을 받아 온 보스(스킬라의 크라켄)에
    // 이걸 걸면 숨길 '사람 몸' 이 곧 그 모델이라 보스가 통째로 사라진다 —
    // 실제로 QA 빌드에서 스킬라가 안 보였다.
    if (cfg.look?.hideBody && !built.own) {
      this.rig.root.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) o.visible = false
      })
      // 붙여 둔 조각은 다시 켠다 — 위 traverse 가 같이 껐다
      this.parts?.group?.traverse?.(o => { o.visible = true })
    }
  }

  /**
   * 난간에 붙인다.
   *
   * 크라켄은 갑판 위를 걸어 다니지 않는다. 먼 쪽 뱃전에 매달려 좌우로
   * 옮겨 다니며 친다. 그래서 z 는 난간에 묶고 x 만 풀어 준다 —
   * 화면 위쪽을 가로지르는 한 줄 위에서만 움직인다.
   */
  #railed(dt) {
    const rail = this.cfg.rail
    if (!rail) return
    const arena = this.world?.arena
    const zHalf = arena ? arena.radiusAt(rail < 0 ? Math.PI : 0) : 8
    const want = Math.sign(rail) * (zHalf - (this.cfg.railInset ?? 1.1))
    this.pos.z += (want - this.pos.z) * Math.min(1, dt * 6)
    this.vel.z = 0
    // 늘 갑판 쪽을 본다
    this.facing = rail < 0 ? 0 : Math.PI
  }

  get phase() { return this.cfg.phases[Math.max(0, this.phaseIndex)] }

  /** 그로기 — 큰 기술 뒤의 반격 창. 여기서 몰아쳐야 보스가 넘어간다. */
  setGroggy(sec) {
    this.groggy = sec
    this.fx.number(this.pos.clone().setY(this.cfg.barHeight ?? 3), '그로기', { color: '#ffd166', size: 26 })
  }

  /**
   * 약점을 맞혀야 다음 페이즈가 열리는 보스는, 그 전까지 체력이 더 안 깎인다.
   * 안 그러면 쓰러뜨려 놓고 계속 두들겨서 눈 한 번 안 쏘고 끝난다 —
   * 파훼법이 있는 보스에게 파훼법을 안 써도 되는 길을 열어 주면 안 된다.
   */
  #hpFloor() {
    if (this.weakPointDone) return 0
    const ph = this.cfg.phases.find(p => p.needsWeakPoint)
    return ph ? this.maxHp * (ph.below ?? 0.5) : 0
  }

  /**
   * 부름꾼이 살아 있는가.
   *
   * 라이스트리고네스의 왕은 혼자 싸우지 않는다 — 항구 전체가 돌아섰다.
   * 그래서 왕을 때리는 게 답이 아니고, 부른 것들을 먼저 치우는 게 답이다.
   * 잡졸을 "무시하고 보스만 때리면 되는 것" 으로 두면 소환 패턴은
   * 그냥 화면이 지저분해지는 일에 그친다.
   */
  #warded() {
    if (!this.cfg.guarded) return null
    const g = this.world.enemies?.filter(e => e.guardsBoss === this && !e.dead) ?? []
    return g.length ? g : null
  }

  /**
   * 머리를 끊는다.
   *
   * 다른 파훼들이 요구하는 건 다 **공격 전**의 판단이다 — 장판을 보고
   * 피하거나(거인), 표적을 바꾸거나(왕), 시전 중에 들어가거나(마녀),
   * 등 뒤로 돌거나(세이렌). 이것 하나는 **공격 뒤**를 요구한다.
   * 머리가 내려찍고 나서 벽으로 돌아가기 전, 회복(recovery) 동안만
   * 끊긴다. 그러니 붙어서 기다려야 하고, 기다리는 동안은 맞는다.
   *
   * 보상이 값을 한다: 끊은 머리의 패턴이 판에서 사라진다 (#choose).
   * 여섯을 다 끊으면 그 판에 남는 공격이 없다 — 보스가 점점 순해지는
   * 것이 눈에 보이는 게 이 파훼의 값이다. 몬헌의 부위 파괴다.
   *
   * @returns 끊었으면 true
   */
  #sever(def) {
    this.severed ??= new Set()
    if (this.severed.has(def.id)) return false
    this.severed.add(def.id)
    // 몸이 어느 촉수를 지울지는 패턴 이름이 아니라 머리 번호로 안다
    this.severedHeads ??= new Set()
    if (def.head != null) this.severedHeads.add(def.head)
    const left = Math.max(0, (this.cfg.heads ?? 6) - this.severed.size)
    this.action.stop()
    this.fx?.number(this.pos.clone().setY(this.cfg.barHeight ?? 3),
      left ? `머리 ${left}` : '마지막 머리', { color: '#9fe0ff', size: 28 })
    this.fx?.ring(this.pos.x, this.pos.z, { color: '#9fe0ff', radius: this.radius * 3.6, life: 0.7 })
    this.world.sfx?.chime()
    this.fx?.shake(0.5)
    this.world.particles?.burst({ x: this.pos.x, y: (this.cfg.barHeight ?? 3) * 0.6, z: this.pos.z,
      count: 30, color: '#bfe4ff', speed: 9, size: 0.2, life: 0.7, gravity: 8, up: 1.1 })
    this.world.onBossSay?.(left ? `머리 하나가 떨어졌다 — ${left} 남았다` : '마지막 머리가 떨어졌다')
    // 그로기는 **이 타격이 끝난 뒤에** 건다. 여기서 바로 걸면 끊는 타격 자신이
    // 그로기 배수(2.0)를 또 먹어서 2.2 × 2.0 = 4.4 배가 된다 — 여섯 번 끊는
    // 장치에 그 배수가 붙으면 네 번째 머리에서 보스가 죽는다.
    // (키르케의 잔은 한 판에 한두 번이라 겹쳐도 되고, 겹치는 게 보상이다.)
    this._severGroggy = this.cfg.severGroggy ?? 1.8
    return true
  }

  hurt(amount, opts = {}) {
    if (this.dead) return 'dead'

    // 쓰러져 있는 동안은 몸통을 아무리 때려도 안 깎인다. 약점만 통한다.
    if (this.downed) {
      this.fx?.number(this.pos.clone().setY((this.cfg.barHeight ?? 3) * 0.6),
        this.downed.hint ?? '약점', { color: '#8fb6ff', size: 18 })
      this.world.sfx?.clang()
      return 'iframe'
    }

    // 끊어야 하는 시전은 몸이 열려 있다 — 맞으면 끊기고, 끊은 값으로 그로기를 준다.
    // 피해는 그대로 들어간다. 끊는 게 손해면 아무도 안 끊는다.
    const run = this.action
    if (run.active && run.def?.breakable && run.phase !== 'recovery') {
      /**
       * 무엇으로 끊어야 하는가.
       *
       * 'draw' 는 **꽉 당긴 화살만** 받는다. 아무도 못 당기는 활을 당겨서
       * 그 자를 쏘는 것이 이야기에서 이 장면의 전부다.
       *
       * 여기서 중요한 건 이게 **열쇠고 화력이 아니라는 것**이다. 처음에는
       * 이 보스가 늘 화살만 받게 짜 봤는데, 그러면 칼을 키운 사람은
       * 마지막 판에서 자기 빌드가 통째로 무효가 된다. 로그라이크에서
       * 그건 난이도가 아니라 벽이다.
       *
       * 그래서 이렇게 둔다 — 잔을 든 동안만 몸이 닫히고, 그걸 여는 건
       * 꽉 당긴 화살 하나뿐이다. 열리면 오래(breakGroggy) 멍해지니
       * 그 뒤는 칼이든 활이든 자기 빌드로 몰아치면 된다.
       * 활은 문을 여는 데만 필요하다. 문 안에서 하는 일은 자유다.
       *
       * 문턱을 피해량이 아니라 당긴 정도로 보는 이유: 피해량으로 보면
       * '활 피해 +20%' 를 쌓은 사람은 탭 사격으로도 넘는다 — 그건
       * 시험이 아니라 성장 검사다.
       */
      if (run.def.breakBy === 'draw' && (opts.draw ?? 0) < (this.cfg.bowMin ?? 0.72)) {
        this.fx?.number(this.pos.clone().setY((this.cfg.barHeight ?? 3) * 0.8),
          this.cfg.bowHint ?? '활을 꽉 당겨라', { color: '#8fb6ff', size: 18 })
        this.world.sfx?.deny()
        return 'iframe'
      }
      // stop() 이 def 를 비운다. 먼저 꺼내 둬야 한다 —
      // 안 그러면 끊는 순간마다 게임이 죽는다.
      const say = run.def.breakSay
      this.action.stop()
      this.world.sfx?.chime()
      this.fx?.number(this.pos.clone().setY(this.cfg.barHeight ?? 3), '끊었다', { color: '#ffd166', size: 26 })
      this.fx?.ring(this.pos.x, this.pos.z, { color: '#ffd166', radius: this.radius * 3.4, life: 0.6 })
      this.fx?.shake(0.35)
      if (say) this.world.onBossSay?.(say)
      this.setGroggy(this.cfg.breakGroggy ?? 2.4)
    }

    // 머리는 내려찍고 나서 거둬들이는 사이에만 끊긴다 (#sever).
    // 끊는 타격에는 배수를 얹는다 — 기다린 값이다.
    if (this.cfg.heads && run.active && run.def?.head != null && run.phase === 'recovery') {
      if (this.#sever(run.def)) amount *= this.cfg.severMult ?? 2.2
    }

    const guards = this.#warded()
    if (guards) {
      this.fx?.number(this.pos.clone().setY((this.cfg.barHeight ?? 3) * 0.7),
        `부름 ${guards.length}`, { color: '#8fd06a', size: 18 })
      this.world.sfx?.clang()
      return 'iframe'
    }

    const floor = this.#hpFloor()
    if (floor > 0) {
      const room = Math.max(0, this.hp - floor)
      if (room <= 0) return 'iframe'
      amount = Math.min(amount, room)
    }

    // 그로기 중에는 더 아프게 맞는다
    const mult = this.groggy > 0 ? (this.cfg.groggyMult ?? 1.8) : 1
    const out = super.hurt(amount * mult, { ...opts, knockback: 0, stagger: 0, crit: this.groggy > 0 })
    if (this._severGroggy) { this.setGroggy(this._severGroggy); this._severGroggy = 0 }
    return out
  }

  think(dt) {
    const p = this.world.player
    if (this.dead || p.dead) return

    // 쓰러져 있는 동안은 아무것도 안 한다. 약점을 맞아야 일어난다.
    if (this.downed) {
      this.downedT = (this.downedT ?? 0) + dt
      const w = this.getWeakPoint()
      if (this.downedT % 0.5 < dt && w) {
        this.fx.number(new THREE.Vector3(w.x, w.y + 0.5, w.z),
          this.downed.hint ?? '약점', { color: '#ffd166', size: 20 })
      }
      // 어디를 쏘라는 건지 바닥에도 표시한다
      if (w && this.downedT % 0.9 < dt) {
        this.fx.ring(w.x, w.z, { color: '#ffd166', radius: w.r * 1.2, life: 0.8 })
      }
      return
    }

    // 부름꾼이 살아 있으면 왕과 부름꾼을 실로 잇는다. 맞아 보고 나서야
    // "안 깎인다" 를 알게 되면 그건 파훼가 아니라 버그로 읽힌다.
    const guards = this.#warded()
    if (guards) {
      this.wardT = (this.wardT ?? 0) + dt
      if (this.wardT % 0.55 < dt) {
        this.fx.ring(this.pos.x, this.pos.z, { color: '#8fd06a', radius: this.radius * 2.6, life: 0.5 })
        for (const g of guards) {
          this.fx.ring(g.pos.x, g.pos.z, { color: '#8fd06a', radius: g.radius * 2.4, life: 0.5 })
        }
      }
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

      // 눈 안에 있는 동안은 계속 깎인다.
      // 전에는 기술이 끝날 때 한 번에 들어갔다 — 끌려 들어간 순간과 아픈 순간이
      // 어긋나서, 맞는 이유를 알 수가 없었다.
      const eye = run.def.eye ?? 0
      if (eye && run.phase === 'active' && d0 < eye && p.invuln <= 0 && p.rolling <= 0) {
        this._eyeT = (this._eyeT ?? 0) - dt
        if (this._eyeT <= 0) {
          this._eyeT = 0.34
          p.hurt((run.def.damage ?? 20) * 0.34, {
            from: this.pos, knockback: 0, hitstop: 0.03, color: '#8fd6ff',
          })
          this.world.particles?.burst({
            x: p.pos.x, y: 0.8, z: p.pos.z, count: 8,
            color: '#8fd6ff', speed: 5, size: 0.14, life: 0.4, gravity: 2,
          })
        }
      } else this._eyeT = 0
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
    const sp = (this.cfg.speed ?? 2.6) * 0.88
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

    // 눈은 머리에 붙어 있다. 서 있을 때와 무릎 꿇었을 때의 높이가 다르니
    // 좌표를 손으로 적어 두면 한쪽에서 반드시 어긋난다. 머리뼈를 따라간다.
    const head = this.#headBone()
    if (head) {
      const p = head.getWorldPosition(this._headAt ??= new THREE.Vector3())
      return {
        x: p.x + Math.sin(this.facing) * (w.face ?? 0.25),
        y: p.y,
        z: p.z + Math.cos(this.facing) * (w.face ?? 0.25),
        r: w.r ?? 0.9,
        requires: w.requires ?? null,
      }
    }

    return {
      x: this.pos.x + Math.sin(this.facing) * (w.z ?? 0.6),
      // 서 있을 때의 높이가 아니라 주저앉은 높이. 여기 안 맞추면 화살이 머리 위를 지나간다
      y: w.downY ?? w.y ?? 1.6,
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
    // 무너지는 무게 — 흔들림, 정지, 흙먼지
    this.fx.freeze(0.2)
    this.fx.shake(1.1)
    this.fx.ring(this.pos.x, this.pos.z, { color: '#e8c884', radius: this.radius * 5.5, life: 1.0 })
    this.world.particles?.burst({
      x: this.pos.x, y: 0.4, z: this.pos.z, count: 40,
      color: '#c9ad82', speed: 9, size: 0.22, life: 0.9, gravity: 10,
    })
  }

  /** 약점이 맞았다. 일어나면서 다음 페이즈로 간다. */
  weakPointHit() {
    if (!this.downed) return false
    this.downed = null
    this.weakPointDone = true
    this.nextAt = 1.1              // 일어나는 동안은 때리지 않는다
    this.world.onBossWeakHit?.(this)
    this.fx.shake(1.0)
    this.fx.freeze(0.16)
    return true
  }

  #choose(d) {
    const options = this.phase.patterns.filter(a => {
      const r = a.pick ?? {}
      // 끊긴 머리는 다시 안 뻗는다 (#sever). 여기 한 줄이 파훼의 보상이다 —
      // 머리를 끊으면 그 패턴이 판에서 **사라진다**.
      if (a.head != null && this.severed?.has(a.id)) return false
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
    // 머리마다 따로 치는 몸(크라켄)은 제가 친다. 여기서 attack 을 넘기면
    // 모델 전체가 앞으로 숙여져서, 촉수 하나가 아니라 몸통이 통째로 친다.
    if (this.parts?.ownsStrike) attack = null
    this.rig.pose({
      t: this.animT, run: this._run, attack, draw: null, roll: 0,
      attackId: run.def?.id, attackDuration: run.active ? run.total : 1,
      // 받아 온 몸의 치는 클립을 이 박자에 묶는다 (models.js)
      attackT: run.active ? { t: run.t, startup: run.def.startup, active: run.def.active, recovery: run.def.recovery } : null,
      dead: this.dead,
      down: !!this.downed,
      downHold: this.cfg.downHold ?? 0.3,
      flinch: this.groggy > 0 ? 1 : 0,
    }, dt)

    // 쓰러진 동안에는 정말로 무너져야 한다.
    //
    // 전에는 0.26 라디안 숙이고 0.45 내리는 게 전부였다. 키 6.4 짜리한테
    // 그건 고개를 까딱한 것이고, 눈은 여전히 4 위에 있었다 —
    // 화면 위로 잘려서 보이지도 않고, 1.05 높이로 날아가는 화살은
    // 그 아래로 지나가서 절대 안 맞았다. 파훼법이 아니라 벽이었다.
    const want = this.downed ? 1 : 0
    this._downLean = (this._downLean ?? 0) + (want - (this._downLean ?? 0)) * Math.min(1, dt * 4)
    this.rig.root.rotation.x = this._downLean * 0.62
    this.rig.root.position.y = (this._baseY ?? 0) - this._downLean * (this.cfg.look?.height ?? 2) * 0.22
    this.#railed(dt)
    this.#seatHead()

    // 조각은 장식이 아니라 상태 표시다. 지금 어느 페이즈인지, 쓰러졌는지,
    // 빨아들이는 중인지가 몸에 보여야 한다.
    this.parts?.update(dt, {
      t: this.animT,
      phase: Math.max(0, this.phaseIndex),
      downed: !!this.downed,
      blinded: !!this.weakPointDone,
      acting: this.action.active,
      sucking: this.action.active && /pull|suck/.test(this.action.def?.id ?? ''),
      // 끊긴 머리 수와 지금 때리는 머리 번호. 스킬라의 몸이 이걸 보고
      // 끊긴 팔을 지우고 때리는 팔만 Attack 을 돌린다 (bossparts.js).
      // 파훼의 보상이 눈에 보이는 자리가 여기다.
      severed: this.severed?.size ?? 0,
      severedHeads: this.severedHeads,
      // 지금 무는 머리가 어디까지 왔고 어디로 떨어지는가 (크라켄 촉수용)
      strike: this.#strikeState(),
      striking: this.action.active && this.action.phase !== 'recovery'
        ? (this.action.def?.head ?? 0) : 0,
      // 플레이어가 어느 쪽인가. 스킬라의 여섯 머리가 각자 이쪽으로 고개를
      // 돌린다 — 여섯이 제각각 돌아야 여섯 마리로 읽힌다.
      aimX: this.world.player?.pos?.x ?? 0,
      aimZ: this.world.player?.pos?.z ?? 0,
    })
  }

  /**
   * 무너진 높이를 머리로 맞춘다.
   *
   * 얼마나 내릴지를 숫자로 적어 두면 보스마다, 애니메이션 프레임마다 어긋난다.
   * 그래서 내리고 나서 머리뼈가 실제로 어디 있는지 재고, weakPoint.downY 까지
   * 모자란 만큼 한 번 더 내린다. 보스 키가 몇이든 눈은 늘 같은 높이에 온다 —
   * 그 높이가 곧 '화살이 날아가는 높이' 다.
   */
  #seatHead() {
    const target = this.cfg.weakPoint?.downY
    if (!target || this._downLean < 0.01) { this._headDrop = 0; return }
    const head = this.#headBone()
    if (!head) return
    this.rig.root.updateMatrixWorld(true)
    const at = head.getWorldPosition(this._seatAt ??= new THREE.Vector3())
    // 선 자세에서 잰 값이 섞이지 않게, 내려간 정도만큼만 따라간다
    const want = (target - at.y) * this._downLean
    this._headDrop = (this._headDrop ?? 0) + want
    this.rig.root.position.y += want
  }

  /** 머리뼈. 한 번 찾아 두고 계속 쓴다. */
  /**
   * 머리 하나가 무는 자리.
   *
   * 스킬라의 패턴은 전부 보스 한가운데서 났다. 그런데 머리는 좌우로 10
   * 넘게 벌어져 있다 — 맨 왼쪽 머리가 쳐들었다 내리치는데 붉은 원은
   * 가운데에 떴다. 예고와 몸이 따로 놀면 예고를 읽는 의미가 없다.
   * 그래서 머리가 있는 보스는 **그 머리 밑동에서** 친다.
   *
   * @param kind 'point' 면 밑동에서 플레이어 쪽으로 reach 만큼 나간 한 점
   *             (내리찍기), 'base' 면 밑동 자체 (휘두르기·찌르기·도넛)
   */
  headOrigin(n, kind = 'base', reach = 6) {
    const base = this.parts?.headBase?.(n)
    if (!base) return null
    const p = this.world.player.pos
    const dx = p.x - base.x, dz = p.z - base.z
    const d = Math.hypot(dx, dz) || 1
    const r = Math.min(d, reach)
    const tx = base.x + (dx / d) * r, tz = base.z + (dz / d) * r
    const facing = Math.atan2(dx, dz)
    return kind === 'point'
      ? { x: tx, z: tz, facing, tx, tz }
      : { x: base.x, z: base.z, facing, tx, tz }
  }

  /** 지금 무는 머리의 진행. 몸이 그 촉수만 쳐들었다 내리치게 한다. */
  #strikeState() {
    const run = this.action
    const h = run.active ? run.def?.head : null
    if (h == null || !run.strikeAt) return null
    const c = run.def
    let phase = 'startup', p = 0
    if (run.t < c.startup) p = run.t / c.startup
    else if (run.t < c.startup + c.active) { phase = 'active'; p = (run.t - c.startup) / c.active }
    else { phase = 'recovery'; p = (run.t - c.startup - c.active) / Math.max(1e-3, c.recovery) }
    return { head: h, phase, p: clamp(p, 0, 1), x: run.strikeAt.x, z: run.strikeAt.z }
  }

  #headBone() {
    this._head ??= (() => {
      let found = null
      this.rig?.root?.traverse(o => { if (!found && o.isBone && /head/i.test(o.name)) found = o })
      return found ?? false
    })()
    return this._head || null
  }
}

function buildBossBody(look) {
  // 제 몸이 있는 보스는 그걸 쓴다. 사이클롭스·오로치처럼 받아 온 모델이다.
  // 공용 사람 몸에 코드로 조각을 매다는 건 그 다음 수단이다 — 이름이 곧
  // 모양인 보스가 사람 실루엣이면 이름이 몸에 안 보인다.
  if (look.model) {
    const made = models.create(look.model)
    if (made) {
      // bossparts 가 붙일 자리(attachTo)를 안 준다 → 코드 조각을 안 붙인다.
      // 진짜 몸이 있는데 그 위에 코드 눈·촉수를 얹으면 둘이 싸운다.
      return { rig: { root: made.root, mats: made.mats, pose: made.pose, mixer: made.mixer, actions: made.actions }, mats: made.mats, own: true }
    }
    console.info(`[boss] 몸 없음: ${look.model} — 공용 몸으로 간다`)
  }
  const rig = createCharacter({
    height: look.height, tint: look.tint, gear: look.gear ?? [], bulk: look.bulk ?? 1,
    set: look.set ?? 'hero',
  })
  if (rig) return { rig, mats: rig.mats }
  const fig = buildFigure({ scale: look.height / 1.8, bulk: look.bulk ?? 1, palette: look.palette ?? {
    skin: '#8a6a4a', cloth: '#4a3a2a', leather: '#3a2f22', bronze: '#9c7434', accent: '#5a2a22', dark: '#241a14',
  } })
  return { rig: wrapFigure(fig), mats: fig.mats }
}
