import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { sectorHit } from '../combat/hit.js'
import { dist2d, dampAngle, rand } from '../core/math.js'

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
        duration: cfg.startup, color: cfg.color ?? '#ff3a2e',
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
      range: 22, halfAngle: 0.028, duration: 0.85, color: '#ffa032',
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

function greybox({ cloth, skin, weapon }) {
  const g = new THREE.Group()
  const mats = []
  const add = m => { m.castShadow = true; m.receiveShadow = true; g.add(m); mats.push(m.material); return m }
  const clothM = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 })
  const skinM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 })
  const wM = new THREE.MeshStandardMaterial({ color: '#7d6242', roughness: 0.6 })

  const torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 12), clothM)); torso.position.y = 0.98
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), skinM)); head.position.y = 1.66
  const brow = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.1), clothM)); brow.position.set(0, 1.72, 0.18)

  if (weapon === 'spear') {
    const shaft = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.1), wM))
    shaft.position.set(0.34, 1.1, 0.45); shaft.rotation.x = -0.25
  } else if (weapon === 'bow') {
    const bow = add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 18, Math.PI * 1.2), wM))
    bow.position.set(0.3, 1.15, 0.28); bow.rotation.set(0, Math.PI / 2, Math.PI / 2)
  }
  return { group: g, mats }
}

class Kikones extends Actor {
  constructor(world, fx, cfg) {
    super({ hp: cfg.hp, radius: cfg.radius, mass: cfg.mass, team: 'enemy', fx })
    this.world = world
    this.cfg = cfg
    const vis = greybox(cfg.look)
    this.group.add(vis.group)
    this.bodyMats = vis.mats
    this.attachBar(1.2, '#e0443a', cfg.barHeight)
    this.cooldown = rand(0.4, 1.6)
    this.strafe = Math.random() < 0.5 ? 1 : -1
    this.strafeTimer = rand(0.8, 2.0)
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
    this.pos.x += (Math.sin(want) * fwd + sx * 0.55) * speed * dt
    this.pos.z += (Math.cos(want) * fwd + sz * 0.55) * speed * dt
  }
}

export function kikonesWarrior(world, fx) {
  return new Kikones(world, fx, {
    hp: 58, radius: 0.46, mass: 1.6, speed: 4.2, keepRange: [2.4, 3.1], barHeight: 2.05,
    look: { cloth: '#6b2f2a', skin: '#9c7048', weapon: 'spear' },
    pickAction(e, d) {
      if (d < 3.1) return { def: WARRIOR_SWING, cooldown: rand(1.1, 1.9) }
      if (d < 5.2) return { def: WARRIOR_STAB, cooldown: rand(1.6, 2.4) }
      return null
    },
  })
}

export function kikonesArcher(world, fx) {
  return new Kikones(world, fx, {
    hp: 40, radius: 0.42, mass: 1.2, speed: 4.6, keepRange: [7.5, 10.5], barHeight: 1.95,
    look: { cloth: '#4a3a6b', skin: '#9c7048', weapon: 'bow' },
    pickAction(e, d) {
      if (d > 4.5 && d < 18) return { def: ARCHER_SHOT, cooldown: rand(1.8, 2.8) }
      return null
    },
  })
}

/** 허수아비 — 수치 확인용. 안 죽고 안 움직인다. */
export function dummy(world, fx, hp = 99999) {
  const d = new Kikones(world, fx, {
    hp, radius: 0.55, mass: 40, speed: 0, keepRange: [0, 0], barHeight: 2.1,
    look: { cloth: '#4a4237', skin: '#7a6a52', weapon: null },
    pickAction: () => null,
  })
  d.isDummy = true
  d.think = () => {}
  d.group.remove(d.bar)
  d.bar = null
  return d
}
