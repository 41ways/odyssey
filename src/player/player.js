import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { CURVE } from '../combat/action.js'
import { sectorHit } from '../combat/hit.js'
import { dist2d } from '../core/math.js'
import { clamp, damp, dampAngle, angleDelta } from '../core/math.js'
import { newStats } from './stats.js'
import { buildFigure, wrapFigure } from '../render/figure.js'
import { buildGear, buildWeapons, KIT, buildSwordProp, buildBowProp, buildHelmetProp, buildCapeProp } from './gear.js'
import { createCharacter } from '../render/character.js'
import { models } from '../render/models.js'

/**
 * 기본값은 일부러 느리다. 이동도 활도 처음엔 답답하고, 성장으로 풀어 나간다.
 * 여기 숫자를 올리기 전에 stats.js 의 선택지를 먼저 의심할 것.
 */
export const TUNING = {
  speed: 5.6,             // 기본 이동속도. 날랜 발을 모으면 빨라진다
  turnHalf: 0.035,        // 조준 추적 반감기. 작을수록 즉각적
  roll: {
    charges: 3,
    regen: 3.4,           // 충전 하나 차는 데 걸리는 시간. 가벼운 몸으로 줄인다
    // 거리와 시간은 같이 움직인다. 거리만 줄이면 걷는 것(5.6)보다 느려져서
    // 구르는 게 아니라 기어가는 느낌이 난다. 지금은 초속 9.7.
    duration: 0.38,
    distance: 3.7,        // 회피 거리는 성장으로 안 건드린다. 도망 수단은 일정해야 한다
    iframeStart: 0.03,
    iframeEnd: 0.25,      // 0.22초 무적. 짧게 잡아야 회피가 실력이 된다
    recovery: 0.08,
  },
  bow: {
    /**
     * ── 차징이 의미를 갖는 조건 ──
     * 전에는 최소 당김 0.34 + 후딜 0.42 로 한 발에 0.76초, 피해 9 → 12 dps.
     * 꽉 당기면 1.57초에 26 → 17 dps. 차이가 5 dps 뿐이라, 위험을 감수하고
     * 오래 서 있을 이유가 없었다. 그래서 톡톡 쏘는 게 최선이 됐다.
     *
     * 지금은 **난사를 명확히 손해로** 만든다. 최소 당김은 0.45 로 올리고
     * 후딜은 0.55 로 늘리고 최소 피해는 7 로 내렸다 → 1.0초에 7, 7 dps.
     * 대신 꽉 당기면 34 + 관통 → 1.6초에 34, 21 dps 에 여럿을 꿴다.
     * 세 배 차이가 나야 "기다릴까" 가 판단이 된다.
     */
    minDraw: 0.45,        // 여기까진 당겨야 나간다. 톡톡 쏘기를 막는 선
    fullDraw: 1.05,       // 꽉 채우기까지. 팽팽한 시위로 줄인다
    release: 0.55,        // 쏘고 난 후딜. 난사의 대가가 여기 있다
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
      if (cfg.id === 'slash3') {
        p.fx.shake(0.22)
        // 레전더리 — 3타가 불길이 되어 앞으로 뻗는다
        if (p.stats.burn >= 3) {
          p.projectiles.spawn({
            x: p.pos.x + Math.sin(p.facing) * 1.2,
            z: p.pos.z + Math.cos(p.facing) * 1.2,
            dir: p.facing, speed: 16, damage: 18 * p.stats.meleeDamage, kind: 'fire',
            team: 'player', pierce: 99, radius: 1.5, knockback: 5, hitstop: 0.04,
            color: '#ff6a2a', range: 13,
            ignite: { dps: 11 * p.stats.meleeDamage, seconds: 5, level: 3, from: p },
          })
          p.fx.ring(p.pos.x, p.pos.z, { color: '#ff6a2a', radius: 3.2, life: 0.4 })
        }
      }
    },
    onHitWindow(p, run) {
      const range = cfg.range * p.stats.meleeRange
      // 소용돌이 판에서는 몸통이 아니라 테두리 이빨을 깬다.
      // 칼이 닿는 자리에 이빨이 있으면 그쪽으로 들어간다.
      p.world.maelstrom?.hitAt(
        p.pos.x + Math.sin(p.facing) * range * 0.6,
        p.pos.z + Math.cos(p.facing) * range * 0.6,
        range * 0.7, cfg.damage * p.stats.meleeDamage,
      )
      for (const e of p.world.enemies) {
        if (e.dead || run.hitSet.has(e)) continue
        if (!sectorHit(p.pos, p.facing, range, cfg.halfAngle, e)) continue
        run.hitSet.add(e)
        e.hurt(cfg.damage * p.stats.meleeDamage, {
          from: p.pos, knockback: cfg.knockback, hitstop: cfg.hitstop,
          stagger: cfg.stagger, crit: cfg.id === 'slash3',
          color: cfg.id === 'slash3' ? '#ffd166' : '#ffe9a8',
        })
        if (p.stats.burn > 0) {
          e.ignite({ dps: 7 * p.stats.meleeDamage, seconds: 4, level: p.stats.burn, from: p })
        }
      }
    },
  }
}

/**
 * 칼 3타.
 *
 * ── 왜 이 숫자인가 ──
 * 한동안 훨씬 빨랐다. 그러면 '보고 피하는' 싸움이 아니라 '먼저 누르는'
 * 싸움이 되고, 활을 쥘 이유가 사라진다. 실제로 재 보니 이랬다:
 *
 *   칼 한 바퀴(1→2→3)  1.47초에 54  →  37 dps
 *   활 꽉 당겨 한 발    1.57초에 26  →  17 dps
 *
 * 칼이 두 배 이상이니 근접이 정답이 되고, 그래서 "그냥 칼로 휘두르는 게" 됐다.
 * 지금은 한 바퀴를 2.0초로 늘려 32 dps 로 내렸다. 그래도 활보다 높은데,
 * 그건 의도다 — **칼의 값은 dps 가 아니라 경직과 그로기**다. 그로기 중에는
 * 보스가 2배 넘게 맞으므로(groggyMult) 반격 창에서 칼이 폭발한다.
 * 안전한 활로 깎고, 창이 열리면 붙어서 3타를 박는 박자.
 *
 * 선딜을 0.13 → 0.20 으로 올린 건 '읽히게' 하려는 것이다. 0.13 초는
 * 사람 눈에 즉발이라 휘두른 게 아니라 스쳤다는 느낌이 난다.
 */
export const SLASH = {
  slash1: slash({ id: 'slash1', startup: 0.20, active: 0.08, recovery: 0.42, cancelAt: 0.36, next: 'slash2', move: 1.0, range: 3.0, halfAngle: 1.05, damage: 13, knockback: 3.5, hitstop: 0.07, stagger: 0.10 }),
  slash2: slash({ id: 'slash2', startup: 0.18, active: 0.08, recovery: 0.44, cancelAt: 0.38, next: 'slash3', move: 1.1, range: 3.1, halfAngle: 1.25, damage: 16, knockback: 4.0, hitstop: 0.075, stagger: 0.14 }),
  // 3타가 보상이다. 크게 묶이는 대신 크게 아프고 크게 흔든다.
  slash3: slash({ id: 'slash3', startup: 0.34, active: 0.13, recovery: 0.78, cancelAt: 0.70, next: null, move: 2.1, range: 3.9, halfAngle: 1.95, damage: 36, knockback: 13, hitstop: 0.14, stagger: 0.48 }),
}

/**
 * 전리품 단계 → 실제 장비 조각.
 * GLTF 파츠가 없는 투구·망토는 본에 매다는 프롭으로 채운다.
 */
const GEAR_PARTS = {
  pants: ['legs', 'feet'],
  tunic: ['body', 'arms'],
  pauldrons: ['pauldron'],
  helmet: [],
  cape: [],
}

/**
 * 프롭을 본에 거는 자리.
 * character.js 가 본 축을 캐릭터 축(+Y 위, +Z 앞)으로 맞춰 주므로 여기 값은 직관적이다.
 */
const MOUNT = {
  sword: { bone: 'hand_r', rotation: [-0.25, 0, 0.1], position: [0, -0.02, 0.02] },
  bow: { bone: 'hand_l', rotation: [Math.PI / 2, 0, 0], position: [0, -0.02, 0.02] },
  // 투구는 머리보다 크면 냄비가 된다. 모델 머리에 맞춰 줄이고 중심을 맞춘다.
  helmet: { bone: 'Head', rotation: [0, 0, 0], position: [0.075, 0.07, 0.02], scale: 0.55 },
  // 망토는 본이 아니라 몸통에 단다 — 전투 자세의 상체 비틀림까지 따라가면 옆으로 뻗는다.
  cape: { body: true, position: [0, 1.42, -0.08], scale: 0.95 },
}

/** 실제 모델로 만든 오디세우스. 모델이 없으면 null. */
function buildFromModel() {
  const rig = createCharacter({ height: 1.82 })
  if (!rig) return null

  const sword = buildSwordProp()
  const bow = buildBowProp()
  const helmet = buildHelmetProp()
  const cape = buildCapeProp()

  rig.attachTo(MOUNT.sword.bone, sword.group, MOUNT.sword)
  rig.attachTo(MOUNT.bow.bone, bow.group, MOUNT.bow)
  rig.attachTo(MOUNT.helmet.bone, helmet.group, MOUNT.helmet)
  rig.attachToBody(cape.group, MOUNT.cape)
  helmet.group.visible = false
  cape.group.visible = false

  // 발밑 표식
  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.56, 32),
    new THREE.MeshBasicMaterial({ color: '#8fc6ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  mark.rotation.x = -Math.PI / 2
  mark.position.y = 0.02
  rig.root.add(mark)

  const props = { helmet: helmet.group, cape: cape.group }
  const worn = new Set()

  return {
    rig,
    weapons: { sword: sword.group, bowHand: bow.group, bowBack: null },
    cape,
    capeSim: cape,
    gear: {
      equip(id) {
        worn.add(id)
        const shown = []
        for (const part of GEAR_PARTS[id] ?? []) shown.push(...rig.equip(part))
        if (props[id]) { props[id].visible = true; props[id].traverse(o => { if (o.isMesh) shown.push(o) }) }
        return shown           // 방금 붙은 것들. 연출이 여기에 빛을 준다
      },
      reset() { worn.clear(); rig.unequipAll(); for (const p of Object.values(props)) p.visible = false },
      has(id) { return worn.has(id) },
    },
    mats: [...rig.mats, ...sword.mats, ...bow.mats, ...helmet.mats, ...cape.mats],
  }
}

/** 코드로 만든 오디세우스. 모델이 없을 때의 대체품. */
function buildProcedural() {
  const fig = buildFigure({
    scale: 1.02, bulk: 1.05,
    palette: {
      skin: '#b07a4e', cloth: '#cdbfa0', leather: '#5e3f28',
      bronze: '#c08a3e', accent: '#9c3327', dark: '#2a2018',
    },
  })
  const gear = buildGear(fig)
  const weapons = buildWeapons(fig)

  // 시작 차림 — 난파해서 겨우 걸친 허리천 하나
  const loin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 0.26, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: '#8b7d66', roughness: 0.95, side: THREE.DoubleSide })
  )
  loin.position.y = -0.1
  loin.castShadow = true
  fig.j.hips.add(loin)

  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.56, 32),
    new THREE.MeshBasicMaterial({ color: '#8fc6ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  mark.rotation.x = -Math.PI / 2
  mark.position.y = 0.02
  fig.root.add(mark)

  return {
    fig, rig: wrapFigure(fig), gear, weapons,
    mats: [...fig.mats, ...gear.mats, ...weapons.mats],
  }
}

function buildOdysseus() {
  return buildFromModel() ?? buildProcedural()
}

export class Player extends Actor {
  constructor(world, input, fx, projectiles) {
    super({ hp: 120, radius: 0.48, mass: 2.2, team: 'player', fx })
    this.world = world
    this.input = input
    this.projectiles = projectiles
    this.isPlayer = true

    const built = buildOdysseus()
    this.fig = built.fig ?? null          // 코드 인체일 때만 있다
    this.rig = built.rig
    this.modelDriven = !built.fig         // 실제 모델이면 포즈를 클립이 맡는다
    this.gear = built.gear
    this.weapons = built.weapons
    this.capeSim = built.capeSim ?? null
    this._lastFacing = 0
    this._rollHits = new Set()
    this._rollFrom = { x: 0, z: 0 }
    this._echo = null
    this.hexed = 0
    this.slowed = 0          // 포효에 걸린 시간
    this.slowMul = 1         // 그동안의 이동속도 배수
    this.hexRig = null                    // 돼지로 변했을 때의 몸. 걸릴 때 한 번만 만든다
    this.vis = built.rig.root
    this.group.add(this.vis)
    this.bodyMats = built.mats
    this.kills = 0
    this.animT = 0
    this._run = 0

    this.stats = newStats()
    this.maxRollCharges = TUNING.roll.charges
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
    // 은총이 구르기 충전과 무적 길이를 건드린다
    this.maxRollCharges = Math.max(1, TUNING.roll.charges + (this.stats.rollChargeMod ?? 0))
    this.rollCharges = Math.min(this.rollCharges, this.maxRollCharges)
  }

  update(dt, aim) {
    if (this._echo && this.rolling <= 0) this.#updateEcho(dt)
    if (this.dead) { this.step(dt, this.world.arenaRadius); return }

    // 구르기 충전 회복 — 하나씩 순서대로 찬다
    if (this.rollCharges < (this.maxRollCharges ?? TUNING.roll.charges)) {
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
      const iEnd = R.iframeEnd * (this.stats.iframeMul ?? 1)
      this.invuln = (elapsed >= R.iframeStart && elapsed <= iEnd) ? 0.05 : 0
      const ease = 1 - Math.pow(1 - Math.min(t * 1.35, 1), 2.2)
      const prevEase = this._prevEase ?? 0
      const step = (ease - prevEase) * R.distance
      this._prevEase = ease
      this.pos.x += this.rollDir.x * step
      this.pos.z += this.rollDir.z * step
      this.#rollStrike()
      if (this.rolling <= 0) { this._prevEase = 0; this.releaseLock = R.recovery; this.#rollEnd() }
      this.#updateEcho(dt)
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

  /** 연출 중 — 시뮬레이션은 멈췄지만 포즈는 돌아야 한다. */
  updateVisualOnly(dt) { this.#visual(dt, false) }

  /**
   * 느려진다. 사자의 포효가 부른다.
   *
   * 겹쳐 걸면 더 세지는 게 아니라 **남은 시간만 갱신한다** — 사자 둘이 울면
   * 0.3배가 되어 못 움직이게 되는데, 그건 난이도가 아니라 정지다.
   */
  slow(seconds, mul = 0.55) {
    this.slowed = Math.max(this.slowed, seconds)
    this.slowMul = Math.min(this.slowMul === 1 ? mul : this.slowMul, mul)
    this.fx?.number(this.pos.clone().setY(2.0), '둔화', { color: '#ffb04a', size: 20 })
  }

  #moveBy(dt, scale) {
    if (this._move.lengthSq() === 0) return
    // 키르케의 변신 마법에 걸리면 몸이 무거워진다
    const hex = this.hexed > 0 ? 0.55 : 1
    // 포효. 변신(hexed)과 따로 둔다 — 둘은 원인도 연출도 다르고, 겹치면 겹쳐야 한다
    const slow = this.slowed > 0 ? this.slowMul : 1
    // 물에서는 느리다. 빠르면 소용돌이가 무섭지 않고, 너무 느리면
    // 빨려 들어가는 걸 못 막아서 판이 억울해진다.
    const swim = this.swimming ? 0.74 : 1
    const v = TUNING.speed * this.stats.moveSpeed * scale * hex * swim * slow
    this.pos.x += this._move.x * v * dt
    this.pos.z += this._move.z * v * dt
  }

  /** 벽력일섬 — 구르는 동안 몸에 스친 적을 벤다. 한 번 구를 때 적당 한 번. */
  #rollStrike() {
    if (this.stats.rollStrike <= 0) return
    const reach = this.radius + 0.9
    for (const e of this.world.enemies) {
      if (e.dead || this._rollHits.has(e)) continue
      if (dist2d(e.pos, this.pos) > reach + e.radius) continue
      this._rollHits.add(e)
      e.hurt(16 * this.stats.meleeDamage, {
        from: this.pos, knockback: 6, hitstop: 0.05, stagger: 0.14, color: '#9fd8ff',
      })
      this.fx.ring(e.pos.x, e.pos.z, { color: '#9fd8ff', radius: 1.6, life: 0.24 })
    }
  }

  /** 착지 충격파 (유니크) 와 잔상 예약 (레전더리). */
  #rollEnd() {
    const lv = this.stats.rollStrike
    if (lv >= 2) {
      this.fx.ring(this.pos.x, this.pos.z, { color: '#bfe4ff', radius: 3.4, life: 0.4 })
      this.fx.shake(0.18)
      for (const e of this.world.enemies) {
        if (e.dead || dist2d(e.pos, this.pos) > 2.9 + e.radius) continue
        e.hurt(24 * this.stats.meleeDamage, {
          from: this.pos, knockback: 11, hitstop: 0.07, stagger: 0.3, color: '#bfe4ff',
        })
      }
    }
    if (lv >= 3) {
      this._echo = { t: 0, from: { x: this._rollFrom.x, z: this._rollFrom.z }, dir: this.rollDir.clone(), hits: new Set() }
    }
  }

  /** 잔상 — 구른 자리를 한 박자 늦게 한 번 더 지나간다. */
  #updateEcho(dt) {
    const e = this._echo
    if (!e) return
    e.t += dt
    if (e.t < 0.2) return
    const k = Math.min((e.t - 0.2) / TUNING.roll.duration, 1)
    const x = e.from.x + e.dir.x * TUNING.roll.distance * k
    const z = e.from.z + e.dir.z * TUNING.roll.distance * k
    if (Math.random() < 0.6) this.fx.ring(x, z, { color: '#8fc6ff', radius: 1.0, life: 0.22, y: 0.3 })
    for (const en of this.world.enemies) {
      if (en.dead || e.hits.has(en)) continue
      if (dist2d(en.pos, { x, z }) > 1.3 + en.radius) continue
      e.hits.add(en)
      en.hurt(14 * this.stats.meleeDamage, {
        from: { x, z }, knockback: 5, hitstop: 0.04, stagger: 0.1, color: '#8fc6ff',
      })
    }
    if (k >= 1) this._echo = null
  }

  #startRoll() {
    const R = TUNING.roll
    this.rollCharges--
    this._rollHits = new Set()
    this._rollFrom = { x: this.pos.x, z: this.pos.z }
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
      dir: this.facing, kind: 'arrow',
      speed: 32 + t * 22,
      // 7 → 34. 꽉 당긴 값이 최소치의 다섯 배 가까이 되어야 기다릴 값이 있다
      damage: (7 + t * 27) * this.stats.rangedDamage,
      // 얼마나 당겼는지를 화살이 들고 간다. 안티노오스가 이걸 본다 —
      // 피해량만 넘기면 '활 피해 성장' 으로도 문턱을 넘어 버린다.
      draw: t,
      team: 'player',
      pierce: full ? 2 : 0,
      ricochet: this.stats.ricochet > 0 ? (this.stats.ricochet >= 2 ? 3 : 1) : 0,
      ricochetLevel: this.stats.ricochet,
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

  /** 전리품을 입힌다. 처치 수가 임계에 닿을 때 부른다. @returns 방금 붙은 메시들 */
  equip(id) { return this.gear.equip(id) ?? [] }

  #visual(dt, rolling) {
    this.animT += dt

    // 달리는 정도. 갑자기 켜고 끄면 다리가 튄다.
    const moving = !rolling && !this.action.active && this.drawing === 0 && this._move.lengthSq() > 0
    this._run += ((moving ? 1 : 0) - this._run) * Math.min(1, dt * 14)

    // 공격 스윙 — 치켜들었다(wind) 내려친다(swing)
    let attack = null
    const run = this.action
    if (run.active) {
      const d = run.def
      if (run.t < d.startup) {
        attack = { wind: Math.pow(run.t / d.startup, 0.6), swing: 0 }
      } else {
        const k = clamp((run.t - d.startup) / (d.active + d.recovery), 0, 1)
        const hit = Math.min(k / 0.38, 1)
        const out = 1 - clamp((k - 0.55) / 0.45, 0, 1)   // 후딜 동안 자세로 돌아온다
        attack = { wind: (1 - hit) * out, swing: Math.sin(hit * Math.PI / 2) * out }
      }
    }

    const drawK = this.drawing > 0
      ? clamp((this.drawing - TUNING.bow.minDraw) / (TUNING.bow.fullDraw - TUNING.bow.minDraw), 0, 1)
      : null

    const rollK = rolling ? 1 - this.rolling / TUNING.roll.duration : 0

    // 돼지로 변해 있으면 사람 몸은 숨기고 돼지가 대신 움직인다.
    // 느려지기만 하고 겉이 그대로면 무슨 일이 일어난 건지 알 수가 없다.
    const hexed = this.hexed > 0
    if (hexed && !this.hexRig) {
      this.hexRig = models.create('pig')
      if (this.hexRig) {
        this.hexRig.root.scale.setScalar(1.15)
        this.group.add(this.hexRig.root)
      }
    }
    if (this.hexRig) {
      this.hexRig.root.visible = hexed
      this.vis.visible = !hexed
      if (hexed) {
        this.hexRig.pose({ t: this.animT, run: this._run, attack: null, draw: null, roll: 0, dead: false }, dt)
        return
      }
    }

    this.rig.pose({
      t: this.animT,
      run: this._run,
      attack,
      attackId: run.def?.id,
      attackDuration: run.active ? run.total / (this.actionRate || 1) : 0.4,
      draw: attack ? null : drawK,
      roll: rollK,
      rollDuration: TUNING.roll.duration,
      dead: this.dead,
      flinch: this.stagger > 0 ? clamp(this.stagger / 0.3, 0, 1) : 0,
    }, dt)

    // 활은 당길 때만 손으로 온다 (코드 인체는 등에 매달아 둔 활이 따로 있다)
    const drawing = this.drawing > 0
    if (this.weapons.bowBack) {
      this.weapons.bowHand.visible = drawing
      this.weapons.bowBack.visible = !drawing
    } else if (this.weapons.bowHand) {
      this.weapons.bowHand.visible = true
    }

    // 망토 — 마디마다 윗마디를 뒤쫓는다
    const turn = angleDelta(this._lastFacing, this.facing) / Math.max(dt, 1e-4)
    this._lastFacing = this.facing
    if (this.capeSim) {
      this.capeSim.update(dt, { run: this._run, turn: clamp(turn, -12, 12), rolling })
    } else if (this.gear.cape) {
      const want = rolling ? 1.1 : this._run * 0.55
      this.gear.cape.rotation.x = damp(this.gear.cape.rotation.x, want, 0.07, dt)
    }

    // 활 조준선 — group 이 이미 facing 만큼 돌아있어서 로컬 +Z 가 곧 조준 방향이다
    this.aimLine.material.opacity = drawing ? 0.18 + (drawK ?? 0) * 0.5 : 0
    if (drawing) {
      const len = 8 + (drawK ?? 0) * 12
      this.aimLine.scale.set(1, len, 1)
      this.aimLine.position.set(0, 0.04, len / 2 + 0.6)
    }
  }

}
