import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { dist2d, dampAngle, rand, clamp } from '../core/math.js'
import { createCharacter } from '../render/character.js'
import { buildSpearProp, buildSwordProp, dressRig } from './gear.js'

/**
 * 동료 — 같이 싸우는 사람들.
 *
 * 『오디세이아』의 오디세우스는 한 번도 혼자 싸우지 않는다 — 열두 척의
 * 사람들과 함께였고, 그들이 하나씩 죽어서 혼자가 된다. 게임에서는 처음부터
 * 혼자라 판마다 줄어드는 동료 수(stage/voyage.js)가 숫자일 뿐이었다.
 * 곁에서 창을 찌르는 사람이 있어야 그 숫자가 사람이 된다.
 *
 * 규칙 넷 —
 *   · **적은 동료를 노리지 않는다.** 동료까지 맞으면 동료를 지키는 게 일이
 *     되어 판의 판단이 흐려진다. 예고를 읽고 피하는 건 오디세우스 몫이다.
 *   · **보스는 치지 않는다.** 파훼(눈을 쏜다, 머리를 끊는다)는 플레이어가
 *     해야 하는 동작이라 동료가 대신하면 안 된다. 보스가 부른 잡졸만 친다.
 *     딱 한 번 예외가 있다 — **함성**(main.js 의 rally). 그때만 다 같이
 *     보스에게 달려들고, 그게 육백 명이라는 숫자가 손에 잡히는 자리다.
 *   · 노려 맞지는 않아도 **장판에는 걸린다.** 보스의 후려치기·내려찍기 범위
 *     안에 있으면 주저앉는다 (knockDown). 죽는 건 아니고, 곁에 가서 서
 *     있으면 일어난다. 안 일으키면 그 사람을 따르던 사람들까지 잃는다.
 *   · 그래도 **칼에 맞아 죽지는 않는다.** 동료는 이야기가 정한 자리에서 죽고,
 *     장판은 그 숫자를 앞당길 뿐이다.
 *
 * 몸은 오디세우스와 같은 몸·같은 클립이고, 차림은 아마포에 청동을 덜 둘렀다.
 * 발밑에 청록 고리를 깔아 쿼터뷰에서 적(붉은 기)과 한눈에 갈리게 한다.
 */

const LOOK = {
  linen: '#cfc2a2', bronze: '#a67a3c', leather: '#5e4128',
}

export class Companion extends Actor {
  /**
   * @param o.name    이름표
   * @param o.weapon  'spear' | 'sword'
   * @param o.slot    따라갈 자리 (-1 왼쪽 뒤, 1 오른쪽 뒤)
   */
  constructor(world, fx, { name, weapon = 'spear', slot = 1, tint = null, height = 1.78 } = {}) {
    super({ hp: 999, radius: 0.44, mass: 1.4, team: 'player', fx })
    this.world = world
    this.name = name
    this.slot = slot
    this.isAlly = true
    this.animT = rand(0, 4)
    this._run = 0
    this._moved = 0
    this.cooldown = rand(0.3, 0.9)
    this.swing = null
    this.target = null
    this.down = 0        // 주저앉아 남은 시간. 0 이 되면 잃는다
    this.reviving = 0    // 오디세우스가 곁에 선 시간
    this.rally = null    // 함성에 응해 달려가는 중

    const rig = createCharacter({ height, tint, gear: [] })
    this.rig = rig
    if (rig) {
      // 오디세우스와 같은 결의 그리스 차림 (gear.js 의 dressRig).
      // 창잡이는 청동 흉갑에 가죽 술, 칼잡이는 아마포 키톤
      const d = dressRig(rig, weapon === 'spear'
        ? { body: LOOK.bronze, feet: LOOK.leather, skirt: LOOK.linen, strips: true, metal: ['body'] }
        : { body: LOOK.linen, feet: LOOK.leather, skirt: LOOK.linen })
      this.dressFollow = d.follow
      const prop = weapon === 'spear' ? buildSpearProp() : buildSwordProp()
      rig.attachTo('hand_r', prop.group, weapon === 'spear'
        ? { rotation: [-0.2, 0, 0], position: [0, -0.02, 0.02] }
        : { rotation: [-0.25, 0, 0.1], position: [0, -0.02, 0.02] })
      this.group.add(rig.root)
    }
    // 창은 찌르고 칼은 벤다 — 몸도 그렇게 움직여야 한다 (character.js SLASH)
    this.attackId = weapon === 'spear' ? 'ally_spear' : 'ally_sword'
    this.reach = weapon === 'spear' ? 2.6 : 1.9
    this.damage = weapon === 'spear' ? 7 : 6

    // 발밑 청록 고리 — 편이라는 표시
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.48, 28),
      new THREE.MeshBasicMaterial({ color: '#6fd0c0', transparent: true, opacity: 0.45, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    this.ring = ring
    this.group.add(ring)
    this.#nameTag(name)
  }

  /** 머리 위 이름. 동료가 '누군가' 여야 잃을 때 무게가 있다 */
  #nameTag(name) {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 64
    const x = c.getContext('2d')
    x.font = '600 30px "Song Myung", serif'
    x.textAlign = 'center'; x.textBaseline = 'middle'
    x.shadowColor = '#000'; x.shadowBlur = 8
    x.fillStyle = '#bfe8df'
    x.fillText(name, 128, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }))
    sp.scale.set(1.5, 0.375, 1)
    sp.position.y = 2.25
    this.group.add(sp)
    this._tag = { sprite: sp, ctx: x, canvas: c, tex, name }
  }

  /** 이름표를 다시 그린다 (쓰러졌을 때 색과 글씨가 바뀐다) */
  #retag(text, color) {
    const t = this._tag
    if (!t) return
    t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height)
    t.ctx.fillStyle = color
    t.ctx.fillText(text, 128, 34)
    t.tex.needsUpdate = true
  }

  /**
   * 장판에 걸렸다. 죽지 않고 주저앉는다.
   *
   * 여기가 '동료' 를 규칙으로 만드는 자리다. 전에는 동료가 그냥 옆에서
   * 칼질하는 장식이었다 — 안 죽고, 안 맞고, 없어도 그만이었다. 이제는
   * 보스의 큰 것이 지나가면 넘어지고, **일으키려면 그 위험한 자리에
   * 서 있어야 한다.** 무엇을 포기할지 묻는 것이 이 게임의 전부다.
   */
  knockDown(from) {
    if (this.down > 0 || this.dead) return
    this.down = 12
    this.reviving = 0
    this.swing = null
    this.rally = null
    this.ring.material.color.set('#d8594a')
    this.#retag(`${this.name} — 쓰러짐`, '#ffb4a4')
    this.fx?.ring(this.pos.x, this.pos.z, { color: '#d8594a', radius: 1.6, life: 0.5 })
    this.world.sfx?.thud?.()
    this.world.onAllyDown?.(this)
    if (from) this.facing = Math.atan2(from.x - this.pos.x, from.z - this.pos.z)
  }

  /** 다시 일어섰다 */
  standUp() {
    this.down = 0
    this.reviving = 0
    this.ring.material.color.set('#6fd0c0')
    this.#retag(this.name, '#bfe8df')
    this.fx?.ring(this.pos.x, this.pos.z, { color: '#9ff0c0', radius: 2.0, life: 0.5 })
  }

  /** 함성 — 저놈에게 달려들어 한 번 민다 */
  callTo(target, poise) {
    if (this.down > 0 || this.dead || !target) return false
    this.rally = { target, t: 0, hit: false, poise }
    this.swing = null
    return true
  }

  /** 가까운 잡졸 — 보스는 고르지 않는다 */
  #pickTarget() {
    const p = this.world.player
    let best = null, bd = Infinity
    for (const e of this.world.enemies) {
      if (e.dead || e.isBoss || e.isDummy) continue
      // 오디세우스에게서 너무 멀리 떨어진 놈은 쫓지 않는다 — 곁을 지킨다
      if (dist2d(e.pos, p.pos) > 11) continue
      const d = dist2d(e.pos, this.pos)
      if (d < bd) { bd = d; best = e }
    }
    return best
  }

  think(dt) {
    const p = this.world.player
    if (p.dead) return

    /* 주저앉아 있다. 오디세우스가 곁에 서 있으면 일어나고, 아니면 시간이
       다 되어 영영 못 일어난다 (main.js 의 onAllyLost). 누르는 키를 따로
       두지 않는다 — **그 자리에 서 있는 것** 자체가 값이다. 보스의 장판이
       지나가는 자리에 멈춰 서는 걸 고르게 만드는 게 이 규칙의 전부다. */
    if (this.down > 0) {
      const near = dist2d(this.pos, p.pos) < 2.2 && p.rolling <= 0
      if (near) {
        this.reviving += dt
        if (this.reviving % 0.3 < dt) {
          this.fx?.ring(this.pos.x, this.pos.z, { color: '#9ff0c0', radius: 1.2, life: 0.3 })
        }
        if (this.reviving >= 1.6) { this.standUp(); return }
      } else if (this.reviving > 0) this.reviving = Math.max(0, this.reviving - dt * 0.8)
      this.down -= dt
      if (this.down <= 0) this.world.onAllyLost?.(this)
      return
    }

    // 휘두르는 중 — 선딜 뒤에 한 번 맞히고, 후딜이 끝나면 풀린다
    if (this.swing) {
      const s = this.swing
      s.t += dt
      if (!s.hit && s.t >= 0.32) {
        s.hit = true
        const e = s.target
        if (e && !e.dead && dist2d(e.pos, this.pos) < this.reach + e.radius + 1.2) {
          const rally = s.rally ?? 0
          // 적의 경직·밀림은 작게. 동료가 적을 붙잡아 두면 플레이어의 판단이 사라진다
          e.hurt(this.damage * (rally ? 2.4 : 1), {
            from: this.pos, knockback: rally ? 5 : 2, hitstop: rally ? 0.04 : 0,
            stagger: rally ? 0.2 : 0.06, color: '#bfe8df',
          })
          if (rally) {
            e.breakPoise?.(rally, 'rally')
            this.fx?.ring(e.pos.x, e.pos.z, { color: '#9ff0c0', radius: 1.8, life: 0.35 })
          }
          this.world.sfx?.hit?.()
        }
      }
      if (s.t >= 0.95) this.swing = null
      return
    }

    /* 함성에 응했다. 보스든 뭐든 지금 부른 표적 하나에 달려들어 한 번 민다.
       동료가 보스를 치는 건 이때뿐이다 (맨 위 규칙). */
    if (this.rally) {
      const r = this.rally
      r.t += dt
      const e = r.target
      if (!e || e.dead) { this.rally = null; return }
      const want = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z)
      this.facing = dampAngle(this.facing, want, 0.06, dt)
      const d = dist2d(e.pos, this.pos)
      const stand = this.reach * 0.85 + e.radius
      if (d > stand) {
        const step = Math.min(d - stand, 9 * dt)      // 평소보다 빠르다 — 달려든다
        this.pos.x += Math.sin(want) * step
        this.pos.z += Math.cos(want) * step
        this._moved = 1
      } else this._moved = 0
      if (!r.hit && (d <= stand + 0.5 || r.t > 1.4)) {
        r.hit = true
        this._moved = 0
        this.swing = { t: 0, hit: false, target: e, rally: r.poise }
      }
      if (r.t > 2.4) this.rally = null
      return
    }

    /* 칠해진 자리에서 빠져나온다.
       예고를 읽고 피하는 건 오디세우스의 일이지만, 동료가 **아예 못 읽으면**
       거인의 장판마다 셋이 통째로 깔린다. 그러면 '못 일으켰다' 가 내 실수가
       아니라 그냥 세금이 된다. 피할 줄 알되 느리게 피한다 — 붙어 싸우던
       자세에서 빠져나오는 데 시간이 걸리니 늦게 반응한 만큼은 맞는다.
       **함성에 응해 달려가는 동안은 안 피한다** (위). 부르면 보스 품으로
       뛰어드는 것이고, 거기가 제일 위험한 자리다 — 그게 이 기술의 값이다.
       휘두르는 중에도 못 피한다 (위) — 한 번 내지른 창은 거두지 못한다. */
    const zone = this.world.fx?.telegraph?.dangerAt?.(this.pos.x, this.pos.z, this.radius)
    if (!zone) { this._zoneT = 0; this._react = null }
    else {
      // 반응이 한 박자 늦다. 사람마다 다르게 — 셋이 한 몸처럼 동시에 비키면
      // 그건 피하는 게 아니라 장판이 동료를 안 건드리는 것이다.
      this._react ??= rand(0.3, 0.72)
      this._zoneT = (this._zoneT ?? 0) + dt
    }
    if (zone && this._zoneT > this._react) {
      const dx = this.pos.x - zone.x, dz = this.pos.z - zone.z
      const d = Math.hypot(dx, dz) || 1
      // 도넛이면 안쪽으로, 나머지는 바깥으로
      const inward = zone.inner > 0 && d < (zone.inner + zone.range) / 2
      const s2 = (inward ? -1 : 1) * 5.6 * dt
      this.pos.x += (dx / d) * s2
      this.pos.z += (dz / d) * s2
      this.facing = dampAngle(this.facing, Math.atan2(dx / d * (inward ? -1 : 1), dz / d * (inward ? -1 : 1)), 0.1, dt)
      this._moved = 1
      this.swing = null
      return
    }


    this.cooldown -= dt
    const t = this.target && !this.target.dead ? this.target : (this.target = this.#pickTarget())
    let gx, gz, speed = 4.4
    if (t) {
      const d = dist2d(t.pos, this.pos)
      const want = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z)
      this.facing = dampAngle(this.facing, want, 0.08, dt)
      if (d < this.reach && this.cooldown <= 0) {
        this.swing = { t: 0, hit: false, target: t }
        this.cooldown = rand(0.9, 1.5)
        this._moved = 0
        return
      }
      // 창끝 거리에 선다
      const stand = this.reach * 0.8
      gx = t.pos.x - Math.sin(want) * stand
      gz = t.pos.z - Math.cos(want) * stand
    } else {
      // 싸울 게 없으면 오디세우스의 뒤, 한쪽으로
      const f = p.facing
      gx = p.pos.x - Math.sin(f) * 1.8 + Math.cos(f) * 1.4 * this.slot
      gz = p.pos.z - Math.cos(f) * 1.8 - Math.sin(f) * 1.4 * this.slot
      speed = 5.2
    }
    const dx = gx - this.pos.x, dz = gz - this.pos.z
    const d = Math.hypot(dx, dz)
    if (d > 0.35) {
      const step = Math.min(d, speed * dt)
      this.pos.x += (dx / d) * step
      this.pos.z += (dz / d) * step
      if (!t) this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 0.1, dt)
      this._moved = clamp(step / (speed * dt), 0, 1)
    } else this._moved = 0
    // 너무 뒤처지면 곁으로 붙인다 (컷신 뒤, 판 모양이 바뀐 뒤)
    if (dist2d(this.pos, p.pos) > 18) this.pos.set(p.pos.x + this.slot * 1.4, 0, p.pos.z + 1.6)
  }

  sync(camera) {
    super.sync(camera)
    if (!this.rig) return
    const dt = 1 / 60
    this.animT += dt
    this._run += (clamp(this._moved, 0, 1) - this._run) * 0.18
    let attack = null
    if (this.swing) {
      const k = this.swing.t
      attack = k < 0.32 ? { wind: k / 0.32, swing: 0 } : { wind: 0, swing: clamp(1 - (k - 0.32) / 0.63, 0, 1) }
    }
    this.dressFollow?.()
    // 주저앉은 동안은 죽는 자세를 빌려 쓴다 — 누워 있어야 '쓰러졌다' 로 읽힌다
    this.rig.pose({
      t: this.animT, run: this.down > 0 ? 0 : this._run, attack, draw: null, roll: 0,
      attackId: attack ? this.attackId : null, attackDuration: 0.95,
      dead: this.down > 0, flinch: 0,
    }, dt)
  }
}

/**
 * 판에 따라 누가 곁에 있는가.
 *
 *   이스마로스 ~ 메시나 — 에우릴로코스(창)와 폴리테스(칼). 호메로스가 이름을
 *     부르는 둘이다. 폴리테스는 "동료 중에 내가 가장 아끼고 믿던 사람".
 *   저승 — 혼자 구덩이로 간다
 *   트리나키아 이후 — 아무도 없다
 *   이타카 — 텔레마코스와 돼지치기 에우마이오스. 스무 해 만에 곁에 선 아들.
 */
export function companionsFor(stage, voyage) {
  if (!stage || stage.relic) return []
  if (stage.id === 'ithaca') return [
    { name: '텔레마코스', weapon: 'spear', slot: -1 },
    { name: '에우마이오스', weapon: 'sword', slot: 1, tint: '#c9b79a' },
  ]
  if (stage.endless) return []
  const crew = voyage?.crew ?? 0
  if (crew <= 0) return []
  /* 몇이 서는가는 **남은 수**가 정한다. 이게 육백이라는 숫자가 화면에
     나타나는 첫 자리다 — 키코네스에서 일흔둘을 잃으면 곁이 한 칸 빈다.
     셋은 호메로스가 이름을 부르는 사람들이다: 에우릴로코스(부관),
     폴리테스("동료 중에 내가 가장 아끼고 믿던 사람"), 페리메데스(저승의 제사). */
  const roster = [
    { name: '에우릴로코스', weapon: 'spear', slot: -1 },
    { name: '폴리테스', weapon: 'sword', slot: 1 },
    { name: '페리메데스', weapon: 'spear', slot: -2, tint: '#c2ad8c' },
  ]
  const n = crew >= 400 ? 3 : crew >= 120 ? 2 : 1
  return roster.slice(0, n)
}

/** 함성이 미는 무력화 — 남은 수가 그대로 힘이다 (main.js 의 rally) */
export function rallyPower(crew) {
  return Math.round(8 + (Math.min(crew, 600) / 600) * 26)
}
