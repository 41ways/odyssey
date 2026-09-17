import * as THREE from 'three'
import { rand } from '../core/math.js'

/**
 * 정예 — 웨이브 안에 이름이 붙은 한 마리.
 *
 * ── 왜 필요했나 ──
 * 웨이브가 하는 일은 "같은 적을 수만 늘려서 보내는 것" 이었다. 그러면 판이
 * 길어질 뿐 어려워지지 않는다. 플레이어가 하는 판단도 늘 같다 — 가까운
 * 것부터 벤다. 잡졸 열 마리가 한 마리보다 어려운 게 아니라 **오래 걸릴**
 * 뿐이라면, 그 판은 체력 자판기다.
 *
 * 로스트아크의 네임드나 몬헌의 특수개체가 푸는 방식은 같다. 무리 안에
 * **다르게 싸워야 하는 한 마리**를 섞는다. 그러면 표적 순서가 판단이 되고,
 * 판단이 생기면 같은 수의 적이 더 어려워진다.
 *
 * ── 세 가지 특성 ──
 * 수치만 올리면 (체력 세 배) 그건 그냥 오래 걸리는 잡졸이다. 그래서
 * 특성마다 **답이 달라야** 한다:
 *
 *   청동을 두른 · armored  — 화살이 거의 안 박힌다 → 칼로 붙어야 한다
 *   광포한      · frenzied — 행동이 1.5 배 빠르다   → 거리를 둬야 한다
 *   역병을 진   · plagued  — 죽은 자리가 불탄다     → 어디서 죽일지 골라야 한다
 *
 * 앞의 둘이 정반대인 게 중요하다. 한 웨이브에 둘이 같이 나오면 "붙어야
 * 하는 놈" 과 "떨어져야 하는 놈" 을 동시에 상대하게 된다 — 그때 처음으로
 * 표적 순서가 실력이 된다.
 *
 * ── 보상 ──
 * 경험치 세 배. 카드를 따로 떨구지 않는 건 레벨 곡선이 이미 경험치를
 * 카드로 바꿔 주기 때문이다 (player/level.js). 정예 하나가 레벨 한 칸을
 * 거의 채우므로, 잡을 값이 그 자리에서 손에 들어온다.
 */

export const TRAITS = {
  armored: {
    name: '청동을 두른',
    color: '#c8a44a',
    hint: '화살이 튕긴다 — 칼로',
    apply(e) {
      // 화살에만 단단하다. 어느 쪽으로 때렸는지는 화살이 들고 오는
      // draw 로 가른다 (projectile.js → hurt). 칼에는 draw 가 없다.
      const hurt = e.hurt.bind(e)
      e.hurt = (amount, opts = {}) => hurt(opts.draw != null ? amount * 0.32 : amount, opts)
    },
  },
  frenzied: {
    name: '광포한',
    color: '#e0603a',
    hint: '빠르다 — 거리를 둬라',
    apply(e) {
      e.actionRate *= 1.5
      e.speed *= 1.25
    },
  },
  plagued: {
    name: '역병을 진',
    color: '#7ac85a',
    hint: '죽은 자리가 불탄다',
    apply(e) {
      const die = e.die.bind(e)
      e.die = () => {
        die()
        const w = e.world
        w?.fx?.ring(e.pos.x, e.pos.z, { color: '#9ae06a', radius: 3.2, life: 0.6 })
        w?.particles?.burst({ x: e.pos.x, y: 0.5, z: e.pos.z, count: 24,
          color: '#9ae06a', speed: 5, size: 0.16, life: 0.8, gravity: 4 })
        // 제 자리에 불을 남긴다. 붙어서 잡으면 그 불을 내가 밟는다 —
        // '어디서 죽일지' 가 판단이 되는 건 이 한 줄 때문이다.
        w?.leaveFire?.(e.pos.x, e.pos.z, { radius: 2.6, seconds: 5, dps: 9 })
      }
    },
  },
}

const KEYS = Object.keys(TRAITS)

/**
 * 판이 깊어질수록 정예가 자주 나온다.
 * 첫 판은 0.06 — 스무 마리에 한 마리쯤이라 "가끔 센 놈" 으로 읽힌다.
 * 마지막 판은 0.27 — 넷에 하나라 무리를 보고 순서를 정해야 한다.
 */
export const eliteChance = deep => Math.min(0.27, 0.06 + Math.max(0, deep) * 0.035)

/**
 * 한 마리를 정예로 올린다.
 * @returns 붙은 특성 (이름과 색을 부르는 쪽이 쓴다) 또는 null
 */
export function promote(e, { trait = null } = {}) {
  if (!e || e.isBoss || e.elite) return null
  const key = trait ?? KEYS[Math.floor(rand(0, KEYS.length)) % KEYS.length]
  const t = TRAITS[key]
  if (!t) return null

  e.elite = key
  e.eliteTrait = t

  // 맷집과 덩치. 덩치를 같이 올리는 게 중요하다 — 체력만 올리면
  // 어느 놈이 센 놈인지 때려 보고 나서야 안다.
  e.maxHp = Math.round(e.maxHp * 2.6)
  e.hp = e.maxHp
  e.radius *= 1.18
  e.mass *= 1.5
  e.xpValue = (e.xpValue ?? 3) * 3
  e.group?.scale?.multiplyScalar(1.22)

  /**
   * 색으로 갈라 준다. 특성마다 다른 색이라 멀리서 보고 답을 고를 수 있다.
   *
   * 두 가지를 조심해야 했다 —
   *
   * 1. **emissive 로는 안 된다.** actor.js 가 매 프레임 emissive 를
   *    setRGB 로 덮어쓴다 (맞았을 때의 번쩍임과 화상). 거기에 색을 넣으면
   *    다음 프레임에 지워진다. 그래서 color 를 물들인다.
   *
   * 2. **재질을 복제해야 한다.** SkeletonUtils.clone 은 뼈대와 메시는
   *    복제하지만 재질은 참조로 공유한다 — 정예 하나를 칠하면 그 종
   *    전부가 같이 물든다. 무리 중 한 마리를 갈라 보여 주려던 것이
   *    무리 전체를 물들이는 일이 된다.
   */
  const painted = []
  e.group?.traverse?.(o => {
    if (!o.isMesh || !o.material) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    const copies = list.map(m => {
      if (!m) return m
      const c = m.clone()
      // 통째로 갈아엎지 않고 섞는다. 완전히 칠하면 그 종으로 안 보인다 —
      // '같은 놈인데 다른 놈' 이어야 무리 안에서 읽힌다.
      c.color?.lerp?.(new THREE.Color(t.color), 0.45)
      painted.push(c)
      return c
    })
    o.material = Array.isArray(o.material) ? copies : copies[0]
  })
  // 맞으면 번쩍이는 것도 이 복제본을 봐야 한다 (actor.js 의 hurtFlash)
  if (painted.length) e.bodyMats = painted
  if (e.bar?.material?.color) e.bar.material.color.set(t.color)

  /**
   * 발밑 고리.
   *
   * 쿼터뷰에서 제일 확실한 표시다. 몸 색은 조명과 판 색에 묻히는데,
   * 바닥에 깔린 고리는 위에서 내려보는 각도라 늘 보인다. 적의 자식으로
   * 붙이므로 따라다니는 코드가 따로 필요 없다.
   */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(e.radius * 1.5, e.radius * 1.95, 28),
    new THREE.MeshBasicMaterial({
      color: t.color, transparent: true, opacity: 0.75,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.06
  e.group?.add(ring)
  e.eliteRing = ring

  t.apply(e)
  return t
}
