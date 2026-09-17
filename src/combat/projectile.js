import * as THREE from 'three'
import { circleHit } from './hit.js'
import { Trail } from './trail.js'
import { rand } from '../core/math.js'

/**
 * 날아가는 것들.
 *
 * 전부 같은 화살 메시를 쓰면 던지는 양도 파이어볼도 화살로 보인다.
 * 종류마다 모양·꼬리·흘리는 것·터지는 방식을 따로 준다.
 */

let GLOW_TEX = null
const glowTexture = () => {
  if (GLOW_TEX) return GLOW_TEX
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grd.addColorStop(0.6, 'rgba(255,255,255,0.14)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  GLOW_TEX = new THREE.CanvasTexture(c)
  GLOW_TEX.colorSpace = THREE.SRGBColorSpace
  return GLOW_TEX
}

const halo = (color, size) => {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  m.userData.isHalo = true      // 카메라를 향하게 돌린다
  return m
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o })

/* ── 종류별 생김새 ───────────────────────────────────────── */

const KINDS = {
  /** 화살 — 살대·청동 촉·깃. 얇고 빠르다. */
  arrow: {
    trail: { width: 0.075, opacity: 0.7 },
    build(color) {
      const g = new THREE.Group()
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.1, 6), mat('#c8a877'))
      shaft.rotation.x = Math.PI / 2
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 6), mat('#e8d9b8', { metalness: 0.7, roughness: 0.3, emissive: color, emissiveIntensity: 1.3 }))
      tip.rotation.x = Math.PI / 2
      tip.position.z = 0.66
      g.add(shaft, tip)
      for (let i = 0; i < 3; i++) {                     // 깃 셋
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), new THREE.MeshBasicMaterial({ color: '#d8c8a8', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }))
        f.position.z = -0.44
        f.rotation.z = (i / 3) * Math.PI * 2
        f.rotation.y = Math.PI / 2
        g.add(f)
      }
      const h = halo(color, 0.9); h.position.z = 0.6; g.add(h)
      return g
    },
    anim(g, t) { g.rotation.z = t * 9 },
    hit: { color: '#ffd9a0', count: 10, speed: 5, size: 0.1, life: 0.3, gravity: 7 },
  },

  /** 불덩이 — 속이 밝고 겉이 일렁인다. 계속 불티를 흘린다. */
  fire: {
    trail: { width: 0.33, opacity: 0.7 },
    shed: 0.022,
    build(color) {
      const g = new THREE.Group()
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: '#fff2c8' }))
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
      g.add(core, shell, halo(color, 1.9))
      g.userData.shell = shell
      return g
    },
    anim(g, t) {
      const s = g.userData.shell
      const w = 1 + Math.sin(t * 22) * 0.16
      s.scale.set(w, 1 / w, 1 + Math.cos(t * 17) * 0.14)
      s.rotation.set(t * 3.1, t * 2.3, 0)
    },
    hit: { color: '#ff8a3a', count: 22, speed: 7, size: 0.16, life: 0.55, gravity: 5, up: 1.2 },
  },

  /** 마법 구슬 — 매끈한 알에 고리가 돈다. 세이렌의 노래. */
  orb: {
    trail: { width: 0.3, opacity: 0.7 },
    shed: 0.05,
    build(color) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), new THREE.MeshBasicMaterial({ color: '#f0e8ff' })))
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.028, 6, 22),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }))
      g.add(ring, halo(color, 1.7))
      g.userData.ring = ring
      return g
    },
    anim(g, t) { const r = g.userData.ring; r.rotation.set(t * 2.4, t * 3.3, t * 1.1) },
    hit: { color: '#c6a8ff', count: 18, speed: 5.5, size: 0.14, life: 0.5, gravity: 1.5, up: 1 },
  },

  /** 물 — 물방울이 뒤로 늘어진다. 카리브디스. */
  water: {
    trail: { width: 0.3, opacity: 0.66 },
    shed: 0.04,
    build(color) {
      const g = new THREE.Group()
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12),
        new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88, emissive: color, emissiveIntensity: 0.6 }))
      drop.scale.set(1, 1, 1.7)
      g.add(drop, halo(color, 1.4))
      g.userData.drop = drop
      return g
    },
    anim(g, t) { const d = g.userData.drop; const w = 1 + Math.sin(t * 15) * 0.12; d.scale.set(w, 1 / w, 1.7) },
    hit: { color: '#9fd8ff', count: 20, speed: 5, size: 0.13, life: 0.55, gravity: 9, up: 1.3 },
  },

  /** 돌덩이 — 구르며 날아가 흙먼지를 낸다. */
  rock: {
    trail: { width: 0.2, opacity: 0.35 },
    build() {
      const g = new THREE.Group()
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), mat('#6b5c49', { roughness: 1 }))
      r.castShadow = true
      r.scale.set(1, rand(0.75, 1.1), rand(0.8, 1.15))
      g.add(r)
      return g
    },
    anim(g, t) { g.rotation.set(t * 5.1, t * 3.7, t * 4.3) },
    hit: { color: '#a08a6a', count: 16, speed: 4.5, size: 0.16, life: 0.6, gravity: 12 },
  },

  /**
   * 던져지는 양. 폴리페모스가 집어 던진다.
   * 살아 있는 짐승이므로 뻣뻣하게 돌면 안 된다 — 뒹굴면서 다리를 버둥거린다.
   */
  sheep: {
    trail: { width: 0.16, opacity: 0.22 },
    build() {
      const g = new THREE.Group()
      const wool = mat('#efe9dc', { roughness: 1 })
      const dark = mat('#3a322c', { roughness: 0.9 })
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 1), wool)
      body.scale.set(1.25, 0.95, 1)
      body.castShadow = true
      g.add(body)
      const head = new THREE.Group()
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), dark)
      skull.scale.set(1.2, 1, 0.9)
      head.add(skull)
      head.position.set(0.52, 0.06, 0)
      g.add(head)
      const legs = []
      for (const [sx, sz] of [[0.28, 0.24], [0.28, -0.24], [-0.3, 0.24], [-0.3, -0.24]]) {
        const pivot = new THREE.Group()
        pivot.position.set(sx, -0.24, sz)
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.34, 5), dark)
        leg.position.y = -0.18
        pivot.add(leg)
        g.add(pivot)
        legs.push(pivot)
      }
      g.userData.legs = legs
      g.userData.head = head
      return g
    },
    anim(g, t) {
      g.rotation.set(t * 2.2, t * 0.8, t * 1.4)             // 천천히 뒹군다
      const legs = g.userData.legs ?? []
      for (let i = 0; i < legs.length; i++) {                // 네 다리가 제각각 버둥거린다
        legs[i].rotation.x = Math.sin(t * 13 + i * 1.9) * 0.85
        legs[i].rotation.z = Math.cos(t * 11 + i * 2.4) * 0.5
      }
      const h = g.userData.head
      if (h) h.rotation.z = Math.sin(t * 9) * 0.35
    },
    hit: { color: '#efe9dc', count: 24, speed: 4.5, size: 0.19, life: 0.8, gravity: 9, up: 1.2 },
  },

  /** 던지는 창. */
  spear: {
    trail: { width: 0.1, opacity: 0.6 },
    build(color) {
      const g = new THREE.Group()
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6), mat('#6b4a2c'))
      shaft.rotation.x = Math.PI / 2
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 6), mat('#c08a3e', { metalness: 0.8, roughness: 0.3, emissive: color, emissiveIntensity: 0.8 }))
      head.rotation.x = Math.PI / 2
      head.position.z = 1.0
      g.add(shaft, head, halo(color, 1.0))
      return g
    },
    anim() {},
    hit: { color: '#ffd9a0', count: 12, speed: 5, size: 0.12, life: 0.35, gravity: 8 },
  },
}

export class Projectiles {
  constructor(scene, fx, particles) {
    this.scene = scene
    this.fx = fx
    this.particles = particles
    this.trails = new Trail(scene)
    this.live = []
    this.pools = new Map()
  }

  #take(kind, color) {
    const pool = this.pools.get(kind) ?? []
    let m = pool.pop()
    if (!m) m = (KINDS[kind] ?? KINDS.arrow).build(color)
    m.traverse(o => {
      if (o.userData?.isHalo || o.material?.emissive) {
        if (o.userData?.isHalo) o.material.color.set(color)
        else if (o.material.emissive) o.material.emissive.set(color)
      }
    })
    return m
  }

  #give(kind, mesh) {
    const pool = this.pools.get(kind) ?? []
    pool.push(mesh)
    this.pools.set(kind, pool)
  }

  /** opts: { x, z, y, dir, speed, damage, team, kind, color, pierce, ricochet, ignite, ... } */
  spawn(o) {
    const kind = o.kind ?? 'arrow'
    const spec = KINDS[kind] ?? KINDS.arrow
    const color = o.color ?? '#ff8c3a'
    const mesh = this.#take(kind, color)
    const y = o.y ?? 1.05
    mesh.position.set(o.x, y, o.z)
    mesh.rotation.set(0, o.dir, 0)
    this.scene.add(mesh)

    const trail = this.trails.take({ color, width: spec.trail.width, opacity: spec.trail.opacity })

    // 포물선으로 날아가는 것은 바닥에 그림자를 둔다 — 어디 떨어질지가 보여야 한다
    let shadow = null
    if (o.lob) {
      shadow = new THREE.Mesh(
        new THREE.CircleGeometry(o.radius ?? 0.6, 20),
        new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false })
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.position.set(o.x, 0.04, o.z)
      this.scene.add(shadow)
    }

    // 발사 섬광 — 어디서 날아왔는지 눈에 남는다
    this.particles?.burst({ x: o.x, y, z: o.z, count: 7, color, speed: 3.4, size: 0.11, life: 0.24, gravity: 2 })
    this.fx?.ring(o.x, o.z, { color, radius: 0.8, life: 0.16, y: 0.4 })

    this.live.push({
      kind, spec, mesh, trail, color, shadow,
      pos: new THREE.Vector3(o.x, y, o.z),
      dir: o.dir, speed: o.speed, damage: o.damage, team: o.team,
      draw: o.draw ?? null,           // 활을 얼마나 당겨 쏜 것인가 0..1 (안티노오스가 본다)
      radius: o.radius ?? 0.3, pierce: o.pierce ?? 0,
      knockback: o.knockback ?? 3, hitstop: o.hitstop ?? 0.04,
      traveled: 0, range: o.range ?? 34, t: rand(0, 6),
      ricochet: o.ricochet ?? 0, ricochetLevel: o.ricochetLevel ?? 0,
      ignite: o.ignite ?? null, shedAt: 0,
      // 포물선 — 목표 지점까지 정해진 시간에 날아가 떨어진다.
      // 직선으로 쏘면 로켓처럼 보인다. 던진 것은 던진 것처럼 날아야 한다.
      lob: o.lob ?? null,
      lobT: 0,
      onLand: o.onLand ?? null,
      homing: o.homing ?? 0,          // 초당 몇 라디안까지 꺾이는가
      parryable: !!o.parryable,       // 구르기 무적에 스치면 튕겨 나가는가
      onParry: o.onParry ?? null,
      onHitExtra: o.onHitExtra ?? null,
      hitSet: new Set(),
    })
  }

  /** 판 모양. main 이 판을 열 때 물려 준다. */
  setArena(arena) { this._arena = arena ?? null }

  /** 소용돌이 판이면 이빨도 과녁이다. */
  setMaelstrom(m) { this._maelstrom = m ?? null }

  update(dt, actors, arenaRadius, camera) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]
      p.t += dt

      // 포물선으로 던진 것은 따로 움직인다
      if (p.lob) {
        p.lobT += dt
        const k = Math.min(p.lobT / p.lob.time, 1)
        p.pos.x = p.lob.from.x + (p.lob.to.x - p.lob.from.x) * k
        p.pos.z = p.lob.from.z + (p.lob.to.z - p.lob.from.z) * k
        p.pos.y = 0.6 + Math.sin(k * Math.PI) * p.lob.height
        p.dir = Math.atan2(p.lob.to.x - p.lob.from.x, p.lob.to.z - p.lob.from.z)
        p.mesh.position.copy(p.pos)
        p.spec.anim?.(p.mesh, p.t)
        if (camera) this.trails.update(p.trail, p.pos, camera)
        if (p.shadow) {
          p.shadow.position.set(p.pos.x, 0.04, p.pos.z)
          const s = 1 - Math.sin(k * Math.PI) * 0.45
          p.shadow.scale.setScalar(s)
          p.shadow.material.opacity = 0.34 * s
        }
        if (k >= 1) {
          p.onLand?.(p.pos.x, p.pos.z)
          this.#impact(p)
          this.scene.remove(p.mesh)
          if (p.shadow) { this.scene.remove(p.shadow); p.shadow.material.dispose(); p.shadow.geometry.dispose() }
          this.#give(p.kind, p.mesh)
          this.trails.give(p.trail)
          this.live.splice(i, 1)
        }
        continue
      }

      const step = p.speed * dt

      // 유도 — 느리게 따라온다. 걸어서는 못 떨구고 구르기로 끊어야 한다.
      if (p.homing) {
        const target = actors.find(a => !a.dead && a.team !== p.team && a.isPlayer)
          ?? actors.find(a => !a.dead && a.team !== p.team)
        if (target) {
          const want = Math.atan2(target.pos.x - p.pos.x, target.pos.z - p.pos.z)
          let d = (want - p.dir) % (Math.PI * 2)
          if (d > Math.PI) d -= Math.PI * 2
          if (d < -Math.PI) d += Math.PI * 2
          p.dir += Math.max(-p.homing * dt, Math.min(p.homing * dt, d))
        }
      }

      p.pos.x += Math.sin(p.dir) * step
      p.pos.z += Math.cos(p.dir) * step
      p.traveled += step

      p.mesh.position.copy(p.pos)
      p.mesh.rotation.y = p.dir
      p.spec.anim?.(p.mesh, p.t)
      // 후광은 늘 카메라를 본다
      if (camera) p.mesh.traverse(o => { if (o.userData?.isHalo) o.quaternion.copy(camera.quaternion) })
      if (camera) this.trails.update(p.trail, p.pos, camera)

      if (p.spec.shed) {
        p.shedAt -= dt
        if (p.shedAt <= 0) { p.shedAt = p.spec.shed; this.particles?.shed(p.pos.x, p.pos.y, p.pos.z, p.color) }
      }

      // 판 모양 밖으로 나가면 지운다. 원으로만 재면 긴 갑판의 앞뒤에서는
      // 아직 갑판 위인 화살이 사라지고, 좁은 옆에서는 벽을 뚫고 더 난다.
      const beyond = this._arena
        ? !this._arena.contains(p.pos.x, p.pos.z, -1.5)
        : Math.hypot(p.pos.x, p.pos.z) > arenaRadius + 1.5
      let gone = p.traveled > p.range || beyond

      // 소용돌이의 테두리 이빨 — 화살로도 깬다
      if (!gone && p.team === 'player' && this._maelstrom
          && this._maelstrom.hitAt(p.pos.x, p.pos.z, p.radius + 0.9, p.damage)) {
        gone = true
      }

      if (!gone) {
        // 드러난 약점이 먼저다. 몸통보다 작고, 정해진 종류만 통한다.
        for (const a of actors) {
          if (a.dead || a.team === p.team) continue
          const w = a.getWeakPoint?.()
          if (!w) continue
          if (w.requires && p.kind !== w.requires) continue
          const d3 = Math.hypot(p.pos.x - w.x, p.pos.y - w.y, p.pos.z - w.z)
          if (d3 > w.r + p.radius) continue
          a.weakPointHit?.()
          a.hurt(p.damage * 2.5, { from: p.pos, knockback: 0, hitstop: 0.16, color: '#ffd166', crit: true, draw: p.draw })
          this.particles?.burst({ x: w.x, y: w.y, z: w.z, count: 34, color: '#ffe08a', speed: 9, size: 0.2, life: 0.7, gravity: 4, up: 1.3 })
          this.fx?.ring(p.pos.x, p.pos.z, { color: '#ffd166', radius: 3.4, life: 0.6 })
          gone = true
          break
        }
      }

      if (!gone) {
        for (const a of actors) {
          if (a.dead || a.team === p.team || p.hitSet.has(a)) continue
          if (!circleHit(p.pos.x, p.pos.z, p.radius, a)) continue
          p.hitSet.add(a)

          // 패링 — 구르기 무적에 스치면 맞는 대신 튕겨 나간다
          if (p.parryable && a.invuln > 0) {
            this.fx?.freeze(0.1)
            this.fx?.shake(0.3)
            this.fx?.number(p.pos.clone(), '쳐냄', { color: '#9fe0ff', size: 30, crit: true })
            this.particles?.burst({ x: p.pos.x, y: p.pos.y, z: p.pos.z, count: 24, color: '#bfe4ff', speed: 8, size: 0.16, life: 0.5, gravity: 2, up: 1.2 })
            p.onParry?.(a)
            gone = true
            break
          }
          a.hurt(p.damage, { from: p.pos, knockback: p.knockback, hitstop: p.hitstop, color: '#ffd27a', draw: p.draw })
          if (p.ignite) a.ignite(p.ignite)
          p.onHitExtra?.(a)
          this.#impact(p)
          if (p.pierce > 0) { p.pierce--; break }
          if (p.ricochet > 0 && this.#bounce(p, actors)) break
          gone = true
          break
        }
      }

      if (gone) {
        this.#impact(p)
        this.scene.remove(p.mesh)
        if (p.shadow) { this.scene.remove(p.shadow); p.shadow.material.dispose(); p.shadow.geometry.dispose() }
        this.#give(p.kind, p.mesh)
        this.trails.give(p.trail)
        this.live.splice(i, 1)
      }
    }
  }

  #impact(p) {
    const h = p.spec.hit
    this.particles?.burst({ x: p.pos.x, y: p.pos.y, z: p.pos.z, ...h, color: h.color ?? p.color })
    this.fx?.ring(p.pos.x, p.pos.z, { color: p.color, radius: 1.0, life: 0.22 })
  }

  /**
   * 다음 표적으로 튕긴다. 아직 안 맞은 적 중 가장 가까운 쪽.
   * 레벨 2 부터는 튕길 때마다 세지고, 3 이면 갈라져 둘이 된다.
   */
  #bounce(p, actors) {
    let best = null, bestD = 9
    for (const a of actors) {
      if (a.dead || a.team === p.team || p.hitSet.has(a)) continue
      const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z)
      if (d < bestD) { bestD = d; best = a }
    }
    if (!best) return false

    p.ricochet--
    p.dir = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z)
    p.traveled = 0
    p.range = 12
    if (p.ricochetLevel >= 2) { p.damage *= 1.45; p.ricochet++ }
    this.fx?.ring(p.pos.x, p.pos.z, { color: '#9fe0ff', radius: 1.2, life: 0.2 })
    this.particles?.burst({ x: p.pos.x, y: p.pos.y, z: p.pos.z, count: 10, color: '#9fe0ff', speed: 5, size: 0.11, life: 0.3, gravity: 2 })

    if (p.ricochetLevel >= 3 && p.ricochet > 0) {
      let second = null, secondD = 9
      for (const a of actors) {
        if (a.dead || a.team === p.team || p.hitSet.has(a) || a === best) continue
        const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z)
        if (d < secondD) { secondD = d; second = a }
      }
      if (second) {
        this.spawn({
          x: p.pos.x, z: p.pos.z, y: p.pos.y, kind: p.kind,
          dir: Math.atan2(second.pos.x - p.pos.x, second.pos.z - p.pos.z),
          speed: p.speed, damage: p.damage, team: p.team,
          knockback: p.knockback, hitstop: p.hitstop, color: '#bde4ff',
          range: 12, ricochet: p.ricochet - 1, ricochetLevel: p.ricochetLevel,
        })
      }
    }
    return true
  }

  clear() {
    for (const p of this.live) {
      this.scene.remove(p.mesh)
      if (p.shadow) { this.scene.remove(p.shadow); p.shadow.material.dispose(); p.shadow.geometry.dispose() }
      this.#give(p.kind, p.mesh); this.trails.give(p.trail)
    }
    this.live.length = 0
  }
}

export { KINDS }
