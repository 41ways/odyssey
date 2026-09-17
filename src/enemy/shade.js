import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { dist2d, dampAngle, rand, clamp } from '../core/math.js'
import { createCharacter } from '../render/character.js'
import { buildFigure, wrapFigure } from '../render/figure.js'

/**
 * 저승의 망자.
 *
 * 이들은 적이 아니다 — **밀어내는 것**이다. 죽일 수도 없고, 죽이러 오지도
 * 않는다. 다만 왔던 길로 계속 밀고 내려온다. 그래서:
 *
 * - 체력이 없다. 때려도 안 죽는다 (`immortal`). 잡으라고 두면 판이
 *   또 하나의 전투가 되고, 저승은 싸우는 곳이 아니다.
 * - 닿으면 조금 깎고 뒤로 민다. 아프기보다 **거슬려야** 한다 —
 *   맞으면서 뚫는 것보다 뛰는 게 낫다는 판단이 서야 쫓기는 맛이 난다.
 * - 느리다. 플레이어보다 느려야 도망이 성립한다.
 *
 * 몸은 플레이어와 같은 뼈대에 푸른 색조만 입힌다. 저승은 다른 종족이
 * 사는 곳이 아니라 **먼저 간 사람들이 있는 곳**이다.
 */

const SPEED = 3.4          // 플레이어 기본 6.1 보다 한참 느리다
const TOUCH = 1.05         // 이만큼 붙으면 민다
const HURT = 6             // 닿을 때마다. 죽이려는 게 아니다
const HURT_GAP = 0.9       // 같은 망자에게 연달아 깎이지 않게

function buildShade() {
  const rig = createCharacter({ height: 1.76, tint: '#6f9fd8', gear: ['legs'], bulk: 0.94 })
  if (rig) return { rig, mats: rig.mats }
  const fig = buildFigure({
    scale: 0.97,
    palette: {
      skin: '#7fa8d8', cloth: '#3a4a6a', leather: '#2a3550',
      bronze: '#5a7098', accent: '#8fb6e8', dark: '#161e2e',
    },
  })
  return { rig: wrapFigure(fig), mats: fig.mats ?? [] }
}

class Shade extends Actor {
  constructor(world, fx) {
    super({ hp: 1, radius: 0.44, mass: 1.1, team: 'enemy', fx })
    this.world = world
    const built = buildShade()
    this.rig = built.rig
    this.group.add(built.rig.root)
    this.bodyMats = built.mats

    // 반투명하고, 스스로 빛난다.
    //
    // 색조(tint)만 주면 저승의 어두운 조명 아래서 그냥 검은 실루엣이 된다 —
    // 실제로 처음에 그렇게 나왔다. 망자는 빛을 받는 게 아니라 제가 내는 것이라
    // emissive 로 띄워야 '푸른 망자' 로 읽힌다.
    for (const m of this.bodyMats) {
      m.transparent = true
      m.opacity = 0.7
      m.emissive?.set?.('#3f78c8')
      if ('emissiveIntensity' in m) m.emissiveIntensity = 1.25
      if ('roughness' in m) m.roughness = 0.8
    }

    this.immortal = true      // 때려도 안 죽는다
    this.xpValue = 0
    this.animT = Math.random() * 4
    this._run = 0
    this._moved = 0
    this.hurtGap = 0
    this.bob = Math.random() * Math.PI * 2
  }

  /** 망자는 죽지 않는다. 맞으면 잠깐 흐려질 뿐이다. */
  hurt() {
    this.hurtFlash = 0.12
    return 'iframe'
  }

  think(dt) {
    const p = this.world.player
    if (p.dead) return
    this.hurtGap = Math.max(0, this.hurtGap - dt)

    const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)
    this.facing = dampAngle(this.facing, want, 0.12, dt)

    const d = dist2d(this.pos, p.pos)
    if (d > TOUCH) {
      // 곧장 온다. 길은 벽이 알아서 막아 준다 (actor.step 의 pushOut).
      this.pos.x += Math.sin(this.facing) * SPEED * dt
      this.pos.z += Math.cos(this.facing) * SPEED * dt
      this._moved = 1
    } else if (this.hurtGap <= 0) {
      // 붙었다. 깎고 뒤로 민다 — 뚫고 지나가려는 걸 막는 게 목적이다.
      this.hurtGap = HURT_GAP
      p.hurt?.(HURT, { from: this.pos, knockback: 9, hitstop: 0.05, color: '#8fc0ff' })
      this.fx?.ring(this.pos.x, this.pos.z, { color: '#8fc0ff', radius: 1.3, life: 0.4 })
    }
  }

  sync(camera) {
    super.sync(camera)
    const dt = 1 / 60
    this.animT += dt
    this._run += (clamp(this._moved, 0, 1) - this._run) * 0.18
    this._moved *= 0.86
    // 땅에 붙어 걷지 않는다. 조금 떠서 흔들린다.
    this.bob += dt * 1.7
    this.group.position.y = 0.12 + Math.sin(this.bob) * 0.06
    this.rig.pose({
      t: this.animT, run: this._run, attack: null, draw: null, roll: 0,
      dead: false, flinch: 0,
    }, dt)
  }
}

export function makeShade(world, fx) {
  const s = new Shade(world, fx)
  s.facing = rand(0, Math.PI * 2)
  return s
}
