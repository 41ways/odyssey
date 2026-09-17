import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { sectorHit } from '../combat/hit.js'
import { dist2d, dampAngle, rand, clamp } from '../core/math.js'
import { buildFigure, wrapFigure } from '../render/figure.js'
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
      dir: run.lockFacing, speed: 26, damage: 12, team: 'enemy',
      knockback: 5, color: '#ff5a2e', range: 26,
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
    this.cooldown = rand(0.4, 1.6)
    this.strafe = Math.random() < 0.5 ? 1 : -1
    this.strafeTimer = rand(0.8, 2.0)
  }

  /** 렌더 시점 포즈. Actor.sync 를 확장한다. */
  sync(camera) {
    super.sync(camera)
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
    this.strafeTimer -= dt
    if (this.strafeTimer <= 0) { this.strafe *= -1; this.strafeTimer = rand(1.0, 2.4) }

    const d = dist2d(this.pos, p.pos)
    const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)
    this.facing = dampAngle(this.facing, want, 0.09, dt)

    const pick = this.cfg.pickAction?.(this, d)
    if (pick && this.cooldown <= 0) {
      this.action.play(pick.def)
      this.cooldown = pick.cooldown
      return
    }

    // 간격 유지: 너무 멀면 붙고, 너무 가까우면 물러난다
    const near = this.cfg.keepRange[0], far = this.cfg.keepRange[1]
    let fwd = 0
    if (d > far) fwd = 1
    else if (d < near) fwd = -0.85
    const sx = Math.cos(want) * this.strafe, sz = -Math.sin(want) * this.strafe
    const speed = this.cfg.speed
    const dx = (Math.sin(want) * fwd + sx * 0.55) * speed * dt
    const dz = (Math.cos(want) * fwd + sz * 0.55) * speed * dt
    this.pos.x += dx
    this.pos.z += dz
    this._moved = Math.hypot(dx, dz) / Math.max(dt, 1e-4) / Math.max(speed, 1e-4)
  }
}

export function kikonesWarrior(world, fx) {
  return new Kikones(world, fx, {
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
    hp: 34, radius: 0.44, mass: 1.3, speed: 5.6, keepRange: [1.6, 2.2], barHeight: 1.3, xp: 2,
    weapon: null, scale: 0.75, bulk: 1.25,
    gltf: { height: 1.05, bulk: 1.45, tint: '#e0a0a8', gear: [] },
    look: {
      weapon: null, scale: 0.75, bulk: 1.25,
      gltf: { height: 1.05, bulk: 1.45, tint: '#e0a0a8', gear: [] },
      palette: { skin: '#e0a0a8', cloth: '#c88890', leather: '#a06a70', bronze: '#9c7434', accent: '#b07078', dark: '#6a4448' },
    },
    pickAction(e, d) {
      if (d < 2.3) return { def: PIG_CHARGE, cooldown: rand(0.9, 1.5) }
      return null
    },
  })
}

const PIG_CHARGE = meleeAttack({
  id: 'gore', startup: 0.36, active: 0.08, recovery: 0.4,
  range: 2.3, halfAngle: 0.7, damage: 9, knockback: 5, stagger: 0.14, color: '#ff8aa0',
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
