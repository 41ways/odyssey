import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { sectorHit } from '../combat/hit.js'
import { dist2d, dampAngle, rand, clamp } from '../core/math.js'
import { buildFigure, wrapFigure } from '../render/figure.js'

/** 잡몹이 붙는 속도. 1보다 작으면 판이 느려진다. */
export const TEMPO = 0.84
import { models } from '../render/models.js'
import { createCharacter } from '../render/character.js'
import { buildSpearProp, buildBowProp } from '../player/gear.js'

/**
 * 키코네스족 — 이스마로스의 첫 적.
 *
 * 규칙 하나: 적은 예고에 몸을 맡긴다.
 * 시전이 시작되면 그 자리에 장판을 깔고 위치도 방향도 잠근다.
 * 판정은 현재 위치가 아니라 잠긴 위치에서 본다.
 * "빨간 데 서 있으면 맞는다"가 지켜져야 회피가 실력이 된다.
 */
function meleeAttack(cfg) {
  return {
    id: cfg.id,
    startup: cfg.startup, active: cfg.active, recovery: cfg.recovery,
    onStart(e, run) {
      run.origin = { x: e.pos.x, z: e.pos.z }
      run.lockFacing = e.facing
      run.telegraph = e.fx.telegraph.show({
        x: e.pos.x, z: e.pos.z, facing: e.facing,
        range: cfg.range, halfAngle: cfg.halfAngle, inner: cfg.inner ?? 0,
        duration: cfg.startup / (e.actionRate ?? 1), color: cfg.color ?? '#ff3a2e',
      })
    },
    onActive(e, run) {
      e.fx.slash(run.origin.x, run.origin.z, run.lockFacing, cfg.range, cfg.halfAngle, '#ff8c6a')
      e.fx.shake(0.1)
    },
    onHitWindow(e, run) {
      const p = e.world.player
      if (p.dead || run.hitSet.has(p)) return
      if (!sectorHit(run.origin, run.lockFacing, cfg.range, cfg.halfAngle, p)) return
      run.hitSet.add(p)
      p.hurt(cfg.damage, { from: run.origin, knockback: cfg.knockback ?? 6, hitstop: 0.08, stagger: cfg.stagger ?? 0.22, color: '#ff6b5a' })
    },
  }
}

/**
 * 돌진 — 차징하고 나서 몸으로 밀고 들어온다.
 *
 * 지금까지 적은 전부 제자리에서 휘둘렀다. 그러면 거리만 지키면 다 피해지고,
 * 잡몹은 "가까이 오면 때리는 것" 하나로 통일된다. **자리를 옮기며 때리는 것**이
 * 하나 있어야 옆으로 도는 게 의미를 갖는다.
 *
 * 규칙은 지킨다: 시전이 시작되면 방향을 잠그고 장판을 깐다. 돌진 경로가
 * 미리 보이므로 옆으로 빠지면 안 맞는다 — 빨간 데 서 있으면 맞는다.
 */
function dashAttack(cfg) {
  return {
    id: cfg.id,
    startup: cfg.startup, active: cfg.active, recovery: cfg.recovery,
    onStart(e, run) {
      run.lockFacing = e.facing
      run.origin = { x: e.pos.x, z: e.pos.z }
      run.travelled = 0
      // 지나갈 길을 통째로 깐다. 부채가 아니라 긴 통로다.
      run.telegraph = e.fx.telegraph.show({
        x: e.pos.x, z: e.pos.z, facing: e.facing,
        range: cfg.distance + cfg.range, halfAngle: cfg.halfAngle ?? 0.28,
        duration: cfg.startup / (e.actionRate ?? 1), color: cfg.color ?? '#ff5a3a',
      })
    },
    onActive(e, run) {
      e.fx.shake(cfg.shake ?? 0.2)
      e.fx.slash(e.pos.x, e.pos.z, run.lockFacing, cfg.range, cfg.halfAngle ?? 0.28, cfg.color ?? '#ff8c6a')
    },
    /** 판정 구간 동안 실제로 앞으로 간다. 닿으면 한 번만 때리고 계속 달린다. */
    onHitWindow(e, run, dt) {
      const step = (cfg.distance / Math.max(cfg.active, 1e-3)) * (dt ?? 1 / 60)
      if (run.travelled < cfg.distance) {
        const go = Math.min(step, cfg.distance - run.travelled)
        e.pos.x += Math.sin(run.lockFacing) * go
        e.pos.z += Math.cos(run.lockFacing) * go
        run.travelled += go
        e._moved = 1
      }
      const p = e.world.player
      if (p.dead || run.hitSet.has(p)) return
      if (!sectorHit(e.pos, run.lockFacing, cfg.range, cfg.halfAngle ?? 0.28, p)) return
      run.hitSet.add(p)
      p.hurt(cfg.damage, {
        from: e.pos, knockback: cfg.knockback ?? 12, hitstop: 0.09,
        stagger: cfg.stagger ?? 0.3, color: '#ff6b5a',
      })
      e.fx.shake(0.4)
    },
  }
}

/**
 * 도약 — 뛰어올라 떨어진다.
 *
 * 돌진이 '길을 깔고 밀고 오는 것' 이라면 도약은 '지금 서 있는 자리로 오는 것' 이다.
 * 뜨는 순간 착지점을 잠그므로, 예고를 보고 **움직이면** 피해진다.
 * 서서 막을 수 없는 공격이 하나 있어야 발이 놀 이유가 생긴다.
 */
function leapAttack(cfg) {
  return {
    id: cfg.id,
    startup: cfg.startup, active: cfg.active, recovery: cfg.recovery,
    onStart(e, run) {
      const p = e.world.player
      // 착지점은 뜨는 순간의 플레이어 자리. 공중에서 따라오지 않는다.
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z
      const d = Math.hypot(dx, dz) || 1
      const reach = Math.min(d, cfg.distance)
      run.land = { x: e.pos.x + dx / d * reach, z: e.pos.z + dz / d * reach }
      run.from = { x: e.pos.x, z: e.pos.z }
      run.lockFacing = Math.atan2(dx, dz)
      run.telegraph = e.fx.telegraph.show({
        x: run.land.x, z: run.land.z, facing: 0,
        range: cfg.radius, halfAngle: Math.PI, inner: 0,
        duration: cfg.startup / (e.actionRate ?? 1), color: cfg.color ?? '#9fb8ff',
      })
    },
    /** 선딜 동안 포물선으로 난다. 뜬 동안은 몸이 없다 — 지나가는 것이다. */
    onWindup(e, run, k) {
      e.pos.x = run.from.x + (run.land.x - run.from.x) * k
      e.pos.z = run.from.z + (run.land.z - run.from.z) * k
      // 높이는 actor 에 적어 두고 sync 가 마지막에 얹는다.
      // Actor.sync 가 group.position 을 pos 로 통째로 덮어쓰기 때문에
      // 여기서 직접 group.position.y 를 넣으면 다음 렌더에 지워진다.
      e.hopY = Math.sin(k * Math.PI) * (cfg.height ?? 2.2)
      e._moved = 1
    },
    onActive(e, run) {
      e.pos.x = run.land.x; e.pos.z = run.land.z
      e.hopY = 0
      e.fx.ring(run.land.x, run.land.z, { color: cfg.color ?? '#9fb8ff', radius: cfg.radius, life: 0.4 })
      e.fx.shake(cfg.shake ?? 0.35)
    },
    onHitWindow(e, run) {
      const p = e.world.player
      if (p.dead || run.hitSet.has(p)) return
      if (Math.hypot(p.pos.x - run.land.x, p.pos.z - run.land.z) > cfg.radius + p.radius) return
      run.hitSet.add(p)
      p.hurt(cfg.damage, {
        from: run.land, knockback: cfg.knockback ?? 9, hitstop: 0.08,
        stagger: cfg.stagger ?? 0.26, color: '#c8d0ff',
      })
    },
  }
}

/**
 * 포효 — 맞으면 느려진다.
 *
 * 피해가 목적이 아니다. 발을 묶어서 **다음 공격이 맞게 만드는** 기술이다.
 * 사자 하나가 울면 뒤의 늑대와 돼지가 값이 오른다 — 적 하나가 다른 적을
 * 강하게 만드는 자리가 있어야 무리가 무리로 읽힌다.
 */
function roarAttack(cfg) {
  return {
    id: cfg.id,
    startup: cfg.startup, active: cfg.active, recovery: cfg.recovery,
    onStart(e, run) {
      run.origin = { x: e.pos.x, z: e.pos.z }
      run.telegraph = e.fx.telegraph.show({
        x: e.pos.x, z: e.pos.z, facing: 0,
        range: cfg.radius, halfAngle: Math.PI, inner: 0,
        duration: cfg.startup / (e.actionRate ?? 1), color: cfg.color ?? '#ffb04a',
      })
    },
    onActive(e, run) {
      e.fx.ring(run.origin.x, run.origin.z, { color: cfg.color ?? '#ffb04a', radius: cfg.radius, life: 0.6 })
      e.fx.shake(cfg.shake ?? 0.5)
      e.world.particles?.burst({
        x: run.origin.x, y: 1.1, z: run.origin.z, count: 22,
        color: '#ffd08a', speed: 11, size: 0.18, life: 0.5, gravity: 2, up: 0.4,
      })
    },
    onHitWindow(e, run) {
      const p = e.world.player
      if (p.dead || run.hitSet.has(p)) return
      if (Math.hypot(p.pos.x - run.origin.x, p.pos.z - run.origin.z) > cfg.radius + p.radius) return
      run.hitSet.add(p)
      p.hurt(cfg.damage, { from: run.origin, knockback: 3, hitstop: 0.06, stagger: 0.1, color: '#ffd08a' })
      // 이게 본론이다
      p.slow(cfg.slowFor ?? 2.6, cfg.slowTo ?? 0.55)
    },
  }
}

const WARRIOR_SWING = meleeAttack({
  id: 'swing', startup: 0.58, active: 0.10, recovery: 0.72,
  range: 3.4, halfAngle: 0.85, damage: 14, knockback: 7, stagger: 0.24,
})

const WARRIOR_STAB = meleeAttack({
  id: 'stab', startup: 0.72, active: 0.09, recovery: 0.55,
  range: 5.4, halfAngle: 0.20, damage: 18, knockback: 9, stagger: 0.28, color: '#ff5a2e',
})

const ARCHER_SHOT = {
  id: 'shot', startup: 0.85, active: 0.05, recovery: 0.85,
  onStart(e, run) {
    run.lockFacing = e.facing
    run.origin = { x: e.pos.x, z: e.pos.z }
    run.telegraph = e.fx.telegraph.show({
      x: e.pos.x, z: e.pos.z, facing: e.facing,
      range: 22, halfAngle: 0.028, duration: 0.85 / (e.actionRate ?? 1), color: '#ffa032',
    })
  },
  onActive(e, run) {
    e.world.projectiles.spawn({
      x: run.origin.x + Math.sin(run.lockFacing) * 0.8,
      z: run.origin.z + Math.cos(run.lockFacing) * 0.8,
      dir: run.lockFacing, speed: 26, damage: 12, team: 'enemy', kind: 'arrow',
      knockback: 5, color: '#ff8a4a', range: 26,
    })
    e.fx.shake(0.06)
  },
}

/** 프롭을 거는 자리. character.js 가 본 축을 캐릭터 축으로 맞춰 준다. */
const ENEMY_MOUNT = {
  spear: { bone: 'hand_r', rotation: [-0.15, 0, 0.12], position: [0, -0.02, 0.02] },
  bow: { bone: 'hand_l', rotation: [Math.PI / 2, 0, 0], position: [0, -0.02, 0.02] },
}

function buildKikones({ palette, weapon, scale, bulk, model, gltf }) {
  // 사람이 아닌 것 — 돼지처럼 제 뼈대와 제 클립을 가진 모델은 그걸 그대로 쓴다.
  // 사람 몸을 줄여 쓰면 아무리 색을 칠해도 작은 사람으로 보인다.
  if (model) {
    const own = models.create(model)
    if (own) return { rig: own, mats: own.mats }
  }
  // 플레이어와 같은 몸·같은 애니메이션을 쓴다. 색과 차림만 다르다.
  if (gltf) {
    const rig = createCharacter({ height: gltf.height, tint: gltf.tint, gear: gltf.gear, bulk: gltf.bulk ?? 1 })
    if (rig) {
      const mats = [...rig.mats]
      if (weapon === 'spear') {
        const sp = buildSpearProp()
        rig.attachTo(ENEMY_MOUNT.spear.bone, sp.group, ENEMY_MOUNT.spear)
        mats.push(...sp.mats)
      } else if (weapon === 'bow') {
        const bw = buildBowProp()
        rig.attachTo(ENEMY_MOUNT.bow.bone, bw.group, ENEMY_MOUNT.bow)
        mats.push(...bw.mats)
      }
      return { rig, mats }
    }
  }

  // 별도 모델 파일이 지정돼 있으면 그것도 본다
  const rig = model && models.create(model)
  if (rig) return { rig, mats: rig.mats }

  const fig = buildFigure({ scale, bulk, palette })
  const mats = [...fig.mats]
  const mk = (c, r, m = 0) => { const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); mats.push(x); return x }
  const wood = mk('#6b4a2c', 0.8)
  const bronze = mk('#9c7434', 0.4, 0.7)
  const cloth = mk(palette.cloth, 0.93)
  const add = (p, m) => { m.castShadow = m.receiveShadow = true; p.add(m); return m }

  // 튜닉 — 약탈당할 그 옷이다
  const body = add(fig.j.chest, new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 12), cloth))
  body.position.y = 0.26; body.scale.z = 0.8
  const skirt = add(fig.j.hips, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.3, 12, 1, true), cloth))
  skirt.position.y = -0.12
  skirt.material.side = THREE.DoubleSide

  if (weapon === 'spear') {
    const g = new THREE.Group()
    fig.j.arms.R.hand.add(g)
    g.position.y = -0.06
    const shaft = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.9, 6), wood))
    shaft.position.y = -0.55
    const tip = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), bronze))
    tip.position.y = -1.58; tip.rotation.x = Math.PI
    g.rotation.x = -0.2
  } else if (weapon === 'bow') {
    const g = new THREE.Group()
    fig.j.arms.L.hand.add(g)
    g.position.y = -0.1
    const arc = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.017, 6, 18, Math.PI * 1.15), wood))
    arc.rotation.z = Math.PI * 0.42
    g.rotation.set(Math.PI / 2, 0, 0)
  }

  return { rig: wrapFigure(fig), mats }
}

class Kikones extends Actor {
  constructor(world, fx, cfg) {
    super({ hp: cfg.hp, radius: cfg.radius, mass: cfg.mass, team: 'enemy', fx })
    this.world = world
    this.cfg = cfg
    const built = buildKikones(cfg.look)
    this.rig = built.rig
    this.group.add(built.rig.root)
    this.bodyMats = built.mats
    this.animT = Math.random() * 4
    this._run = 0
    this._moved = 0
    this.attachBar(1.2, '#e0443a', cfg.barHeight)
    this.xpValue = cfg.xp ?? 3
    this.label = cfg.label ?? '것'      // 정예 이름에 쓴다 (enemy/elite.js)
    this.cooldown = rand(0.4, 1.6)
    this.strafe = Math.random() < 0.5 ? 1 : -1
    this.strafeTimer = rand(0.8, 2.0)
  }

  /** 렌더 시점 포즈. Actor.sync 를 확장한다. */
  sync(camera) {
    super.sync(camera)
    // 도약으로 뜬 높이. super.sync 가 자리를 덮은 뒤에 얹어야 남는다.
    if (this.hopY) this.group.position.y += this.hopY
    const dt = 1 / 60
    this.animT += dt
    this._run += (clamp(this._moved, 0, 1) - this._run) * 0.18
    this._moved *= 0.86
    let attack = null
    if (this.action.active) {
      const run = this.action
      const d = run.def
      if (run.t < d.startup) attack = { wind: Math.pow(run.t / d.startup, 0.5), swing: 0 }
      else {
        const k = clamp((run.t - d.startup) / (d.active + d.recovery), 0, 1)
        const hit = Math.min(k / 0.3, 1)
        const out = 1 - clamp((k - 0.5) / 0.5, 0, 1)
        attack = { wind: (1 - hit) * out, swing: Math.sin(hit * Math.PI / 2) * out }
      }
    }
    const run = this.action
    this.rig.pose({
      t: this.animT, run: this._run, attack, draw: null, roll: 0,
      attackId: run.def?.id,
      attackDuration: run.active ? run.total : 0.5,
      dead: this.dead,
      flinch: this.stagger > 0 ? clamp(this.stagger / 0.3, 0, 1) : 0,
    }, dt)
  }

  think(dt) {
    const p = this.world.player
    if (this.dead || p.dead) return
    if (this.stagger > 0) return

    // 시전 중엔 위치도 방향도 잠긴다. 예고한 대로만 때린다.
    if (this.action.active) return

    this.cooldown -= dt
    if (this.cooldown2 != null) this.cooldown2 -= dt
    this.strafeTimer -= dt
    if (this.strafeTimer <= 0) { this.strafe *= -1; this.strafeTimer = rand(1.0, 2.4) }

    const d = dist2d(this.pos, p.pos)
    const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)
    this.facing = dampAngle(this.facing, want, 0.09, dt)

    // 기술이 둘인 적은 쿨이 따로 돈다 — 포효는 길게, 앞발은 짧게.
    // 하나로 묶으면 긴 쿨 하나에 발이 묶여서 사자가 멍하니 서 있게 된다.
    const pick = this.cfg.pickAction?.(this, d)
    if (pick && this.cooldown <= 0) {
      this.action.play(pick.def)
      this.cooldown = pick.cooldown
      return
    }
    const second = this.cfg.pickSecond?.(this, d)
    if (second && (this.cooldown2 ?? 0) <= 0) {
      this.action.play(second.def)
      this.cooldown2 = second.cooldown
      return
    }

    // 간격 유지: 너무 멀면 붙고, 너무 가까우면 물러난다
    const near = this.cfg.keepRange[0], far = this.cfg.keepRange[1]
    let fwd = 0
    if (d > far) fwd = 1
    else if (d < near) fwd = -0.85
    const sx = Math.cos(want) * this.strafe, sz = -Math.sin(want) * this.strafe
    // 판 전체의 박자를 한 군데서 잡는다. 적이 빠르면 플레이어의 후딜이
    // 그대로 처벌이 되어, 늦춘 칼이 '느린 칼' 이 아니라 '못 쓰는 칼' 이 된다.
    const speed = this.cfg.speed * TEMPO
    const dx = (Math.sin(want) * fwd + sx * 0.55) * speed * dt
    const dz = (Math.cos(want) * fwd + sz * 0.55) * speed * dt
    this.pos.x += dx
    this.pos.z += dz
    this._moved = Math.hypot(dx, dz) / Math.max(dt, 1e-4) / Math.max(speed, 1e-4)
  }
}

export function kikonesWarrior(world, fx) {
  return new Kikones(world, fx, {
    label: '전사',
    hp: 58, radius: 0.46, mass: 1.6, speed: 4.2, keepRange: [2.4, 3.1], barHeight: 2.05, xp: 4,
    look: {
      weapon: 'spear', scale: 0.98, bulk: 1.0, model: 'kikonesWarrior',
      gltf: { height: 1.78, bulk: 1.04, tint: '#c2705e', gear: ['legs', 'feet', 'body', 'arms'] },
      palette: { skin: '#9c7048', cloth: '#7d3a2e', leather: '#4a3526', bronze: '#9c7434', accent: '#5a2a22', dark: '#241a14' },
    },
    pickAction(e, d) {
      if (d < 3.1) return { def: WARRIOR_SWING, cooldown: rand(1.1, 1.9) }
      if (d < 5.2) return { def: WARRIOR_STAB, cooldown: rand(1.6, 2.4) }
      return null
    },
  })
}

export function kikonesArcher(world, fx) {
  return new Kikones(world, fx, {
    label: '활잡이',
    hp: 40, radius: 0.42, mass: 1.2, speed: 4.6, keepRange: [7.5, 10.5], barHeight: 1.95, xp: 5,
    look: {
      weapon: 'bow', scale: 0.95, bulk: 0.92, model: 'kikonesArcher',
      gltf: { height: 1.72, bulk: 0.94, tint: '#7f86c8', gear: ['legs', 'feet', 'body'] },
      palette: { skin: '#9c7048', cloth: '#4a3a6b', leather: '#3a2f22', bronze: '#9c7434', accent: '#2f2648', dark: '#1e1a24' },
    },
    pickAction(e, d) {
      if (d > 4.5 && d < 18) return { def: ARCHER_SHOT, cooldown: rand(1.8, 2.8) }
      return null
    },
  })
}

/** 키르케가 부르는 돼지. 약하고 빠르고 자꾸 몸으로 민다. */
export function circePig(world, fx) {
  return new Kikones(world, fx, {
    // keepRange 를 넓힌다. 전에는 [1.6, 2.2] 로 몸에 붙어 살아서
    // 돌진 조건(3.6 이상)이 한 번도 안 열렸다 — 기술을 넣어도 안 나가면 없는 것이다.
    // 이제 밖에서 맴돌다 돌진으로 들어오고, 치고 나서 다시 빠진다.
    //
    // xp 는 2 였다. 짐승 판(아이아이에)은 처치 목표가 제일 높은데 마리당 값이
    // 제일 낮아서, 같은 수를 잡고도 레벨이 한 번 덜 올랐다 — 판마다 두 번이
    // 안 되면 곡선이 어긋난다. 돼지·늑대·사자를 한 칸씩 올려 사람 판과 맞췄다.
    label: '돼지',
    hp: 34, radius: 0.44, mass: 1.3, speed: 5.6, keepRange: [4.2, 6.4], barHeight: 1.3, xp: 3,
    weapon: null, scale: 0.75, bulk: 1.25,
    look: {
      model: 'pig',
      weapon: null, scale: 0.75, bulk: 1.25,
      gltf: { height: 1.05, bulk: 1.45, tint: '#e0a0a8', gear: [] },
      palette: { skin: '#e0a0a8', cloth: '#c88890', leather: '#a06a70', bronze: '#9c7434', accent: '#b07078', dark: '#6a4448' },
    },
    pickAction(e, d) {
      // 멀면 돌진, 붙으면 물기. 거리마다 다른 답이 있어야 거리 조절이 실력이 된다.
      if (d > 3.6 && d < 9.5) return { def: PIG_RUSH, cooldown: rand(2.6, 4.0) }
      if (d < 2.3) return { def: PIG_CHARGE, cooldown: rand(0.9, 1.5) }
      return null
    },
  })
}

/**
 * 키르케의 늑대. 돼지보다 빠르고 먼저 문다.
 * 돼지는 밀고 들어오는 덩치, 늑대는 붙었다 떨어지는 쪽 — 둘이 같이 나와야
 * '짐승이 된 사람들' 이 무리로 읽힌다.
 */
export function circeWolf(world, fx) {
  return new Kikones(world, fx, {
    // 늑대도 같은 이유로 물린다. 뛰어서 붙는 놈이 걸어와 붙으면 안 된다.
    label: '늑대',
    hp: 44, radius: 0.42, mass: 1.1, speed: 6.4, keepRange: [4.0, 6.2], barHeight: 1.4, xp: 4,
    weapon: null, scale: 0.8, bulk: 1.0,
    look: {
      model: 'wolf',
      weapon: null, scale: 0.8, bulk: 1.0,
      gltf: { height: 1.05, bulk: 1.1, tint: '#8a8276', gear: [] },
      palette: { skin: '#8a8276', cloth: '#6a6258', leather: '#4a443c', bronze: '#7c6a44', accent: '#5a5248', dark: '#2a2620' },
    },
    pickAction(e, d) {
      // 뛰어서 붙고, 붙으면 문다. 걸어오는 늑대는 늑대가 아니다.
      if (d > 3.4 && d < 9.0) return { def: WOLF_LEAP, cooldown: rand(2.2, 3.4) }
      if (d < 2.6) return { def: WOLF_BITE, cooldown: rand(0.7, 1.2) }
      return null
    },
  })
}

/**
 * 키르케의 사자. 느리고 질기고, 울어서 판을 만든다.
 *
 * 혼자 있으면 별로 안 무섭다 — 둔화가 값을 하는 건 뒤에 늑대와 돼지가
 * 있을 때다. 이 적의 설계는 "다른 적을 강하게 만드는 것" 이다.
 */
export function circeLion(world, fx) {
  return new Kikones(world, fx, {
    label: '사자',
    hp: 96, radius: 0.54, mass: 2.2, speed: 4.0, keepRange: [2.6, 4.2], barHeight: 1.7, xp: 8,
    weapon: null, scale: 0.95, bulk: 1.35,
    look: {
      // 사자 모델이 없다. 늑대 몸에 황금 색조로 대역을 쓴다 —
      // 크기와 색이 다르면 실루엣으로는 구분된다.
      model: 'wolf',
      weapon: null, scale: 0.95, bulk: 1.35,
      gltf: { height: 1.45, bulk: 1.4, tint: '#d8a850', gear: [] },
      palette: { skin: '#d8a850', cloth: '#b08838', leather: '#8a6a2a', bronze: '#c89a44', accent: '#e8c070', dark: '#4a3818' },
    },
    pickAction(e, d) {
      if (d < 9.0) return { def: LION_ROAR, cooldown: rand(7.5, 11) }
      return null
    },
    // 두 기술을 거리로 나눈다. 포효는 쿨이 길고, 가까우면 앞발로 친다.
    pickSecond(e, d) {
      if (d < 3.0) return { def: LION_MAUL, cooldown: rand(1.4, 2.2) }
      return null
    },
  })
}

const WOLF_BITE = meleeAttack({
  id: 'bite', startup: 0.3, active: 0.07, recovery: 0.38,
  range: 2.6, halfAngle: 0.6, damage: 11, knockback: 4, stagger: 0.12, color: '#c8d0ff',
})

/**
 * 방패를 든 구혼자. 느리고 질기다.
 * 앞에서 막아 주는 놈이 하나 있으면 뒤의 활잡이를 먼저 칠지, 방패를 돌아갈지
 * 고를 거리가 생긴다. 정면으로는 거의 안 깎이고 옆·뒤는 그대로 맞는다.
 */
export function kikonesShield(world, fx) {
  const e = new Kikones(world, fx, {
    label: '방패병',
    hp: 96, radius: 0.5, mass: 3.2, speed: 3.2, keepRange: [2.0, 2.6], barHeight: 2.1, xp: 6,
    weapon: 'spear', scale: 1.02, bulk: 1.2,
    look: {
      weapon: 'spear', scale: 1.02, bulk: 1.2,
      gltf: { height: 1.84, bulk: 1.18, tint: '#9aa0a8', gear: ['legs', 'feet', 'body', 'arms', 'pauldron'] },
      palette: { skin: '#a08466', cloth: '#4a5058', leather: '#3a3e44', bronze: '#9c8a5c', accent: '#5a6068', dark: '#22262a' },
    },
    pickAction(e2, d) {
      if (d < 2.7) return { def: SHIELD_BASH, cooldown: rand(1.3, 2.0) }
      return null
    },
  })
  // 정면은 방패가 받는다. 돌아 들어가야 제대로 들어간다.
  const hurt = e.hurt.bind(e)
  e.hurt = (amount, opts = {}) => {
    const from = opts.from
    if (from) {
      const a = Math.atan2(from.x - e.pos.x, from.z - e.pos.z)
      const front = Math.abs(((a - e.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      if (front > Math.PI - 1.0) {        // 앞 약 115도
        e.fx?.number(e.pos.clone().setY(2.2), '막았다', { color: '#9fb6d0', size: 17 })
        return hurt(amount * 0.18, opts)
      }
    }
    return hurt(amount, opts)
  }
  return e
}

const SHIELD_BASH = meleeAttack({
  id: 'bash', startup: 0.5, active: 0.08, recovery: 0.5,
  range: 2.8, halfAngle: 0.8, damage: 14, knockback: 9, stagger: 0.3, color: '#cfe0ff',
})

const PIG_CHARGE = meleeAttack({
  id: 'gore', startup: 0.36, active: 0.08, recovery: 0.4,
  range: 2.3, halfAngle: 0.7, damage: 9, knockback: 5, stagger: 0.14, color: '#ff8aa0',
})

/** 돼지의 돌진. 멀리서 머리를 숙이고 길을 깔고 밀고 들어온다. */
const PIG_RUSH = dashAttack({
  id: 'rush', startup: 0.72, active: 0.34, recovery: 0.66,
  distance: 7.2, range: 2.0, halfAngle: 0.30,
  damage: 16, knockback: 16, stagger: 0.34, shake: 0.3, color: '#ff7a90',
})

/** 늑대의 도약. 뜨는 순간의 자리로 떨어진다. */
const WOLF_LEAP = leapAttack({
  id: 'leap', startup: 0.52, active: 0.12, recovery: 0.52,
  distance: 7.5, radius: 1.9, height: 2.4,
  damage: 14, knockback: 10, stagger: 0.28, shake: 0.3, color: '#9fb8ff',
})

/**
 * 사자의 포효. 피해는 적고 둔화가 본론이다.
 *
 * 키르케의 집 둘레에는 이리와 사자가 돌아다닌다 — 약에 걸려 짐승이 된
 * 사람들이다. 늑대·돼지가 '붙는 쪽' 이라면 사자는 **판을 만드는 쪽**이다.
 */
const LION_ROAR = roarAttack({
  id: 'roar', startup: 0.88, active: 0.14, recovery: 0.82,
  radius: 8.5, damage: 6, slowFor: 2.8, slowTo: 0.52, shake: 0.55, color: '#ffb04a',
})

const LION_MAUL = meleeAttack({
  id: 'maul', startup: 0.44, active: 0.10, recovery: 0.50,
  range: 3.0, halfAngle: 0.85, damage: 19, knockback: 9, stagger: 0.30, color: '#ffa04a',
})

/** 허수아비 — 수치 확인용. 안 죽고 안 움직인다. */
export function dummy(world, fx, hp = 99999) {
  const d = new Kikones(world, fx, {
    hp, radius: 0.55, mass: 40, speed: 0, keepRange: [0, 0], barHeight: 2.1,
    look: {
      weapon: null, scale: 1.0, bulk: 1.15,
      gltf: { height: 1.8, bulk: 1.2, tint: '#7d7566', gear: ['legs', 'feet', 'body', 'arms'] },
      palette: { skin: '#7a6a52', cloth: '#4a4237', leather: '#3d352c', bronze: '#6f6252', accent: '#4a4237', dark: '#2a251e' },
    },
    pickAction: () => null,
  })
  d.isDummy = true
  d.think = () => {}
  d.group.remove(d.bar)
  d.bar = null
  return d
}
