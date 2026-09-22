import * as THREE from 'three'
import { rand } from '../core/math.js'

/**
 * 코드로 세우는 무대 소품.
 *
 * 받아 온 모델(models.js)로 안 되는 것들이 있다. 이타카의 홀이 그랬다 —
 * 구혼자 백여 명이 스무 해를 먹어 치운 자리인데, 있는 것이라고는 벽을
 * 두른 기둥과 항아리 몇 개뿐이라 **빈 대리석 마당**으로 보였다. 이야기의
 * 절정이 벌어지는 방이 제일 휑했다.
 *
 * 먹던 자리를 놓아야 하는데 연회상 모델이 없다. 받아 오는 대신 짠다 —
 * 상판 하나에 다리 넷, 그 위에 그릇 몇. 쿼터뷰에서 작게 읽히는 물건이라
 * 이 정도면 '먹던 상' 으로 읽힌다.
 *
 * **방 한가운데는 비워 둔다.** 소품에 충돌 판정이 없어서 가운데 두면 몸이
 * 뚫고 지나가는 게 보인다 (world.js #setProps 의 주석). 벽을 두르는 자리만
 * 쓰는데, 마침 그리스의 연회방(안드론)이 그렇게 생겼다 — 벽을 따라 긴
 * 의자를 두르고 가운데는 비운다. 제약과 고증이 같은 답을 가리킨다.
 */

const WOOD = () => new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.85 })
const CLOTH = () => new THREE.MeshStandardMaterial({ color: '#7d6a4e', roughness: 0.95 })
const CLAY = () => new THREE.MeshStandardMaterial({ color: '#8a5f3c', roughness: 0.9 })
const BRONZE = () => new THREE.MeshStandardMaterial({ color: '#8a6a2e', roughness: 0.45, metalness: 0.7 })

/**
 * 연회상 — 긴 상과 그 뒤의 자리.
 * 상 위에는 그릇이 흩어져 있다. 몇 개는 쓰러져 있다 (스무 해째 먹는 중이다).
 */
export function buildFeastTable() {
  const g = new THREE.Group()
  const wood = WOOD(), cloth = CLOTH(), clay = CLAY()
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    g.add(m)
    return m
  }

  const L = 2.2, W = 0.72, H = 0.62
  add(new THREE.BoxGeometry(L, 0.08, W), wood, 0, H, 0)
  const leg = new THREE.BoxGeometry(0.1, H, 0.1)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(leg, wood, sx * (L / 2 - 0.14), H / 2, sz * (W / 2 - 0.12))
  }

  // 상 뒤의 긴 자리 — 기대 앉는 자리라 상보다 낮고 길다
  add(new THREE.BoxGeometry(L * 1.05, 0.14, 0.5), cloth, 0, 0.36, -W / 2 - 0.42)
  const bench = new THREE.BoxGeometry(0.1, 0.3, 0.1)
  for (const sx of [-1, 1]) add(bench, wood, sx * (L / 2 - 0.1), 0.15, -W / 2 - 0.42)

  // 그릇과 잔 — 몇은 엎어져 있다
  const bowl = new THREE.CylinderGeometry(0.11, 0.08, 0.07, 10)
  const cup = new THREE.CylinderGeometry(0.045, 0.035, 0.1, 8)
  for (let i = 0; i < 5; i++) {
    const x = rand(-L / 2 + 0.2, L / 2 - 0.2), z = rand(-W / 2 + 0.16, W / 2 - 0.16)
    const tipped = Math.random() < 0.35
    const m = add(i % 2 ? cup : bowl, clay, x, H + (tipped ? 0.06 : 0.08), z)
    if (tipped) m.rotation.z = rand(1.2, 1.9)
    m.rotation.y = rand(0, Math.PI)
  }
  return g
}

/**
 * 화로 — 홀을 밝히는 불.
 *
 * 기둥과 상만 세우면 방이 어둡고 죽어 있다. 불은 흔들려서, 가만히 있는
 * 방에 유일하게 움직이는 것이 된다. 빛도 같이 준다 — 다만 그림자는 끄고
 * 거리도 짧게 잡는다. 홀에 네 개가 서므로 값이 싸야 한다.
 */
export function buildBrazier() {
  const g = new THREE.Group()
  const bronze = BRONZE()
  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.y = y
    m.castShadow = true
    g.add(m)
    return m
  }
  add(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 8), bronze, 0.45)
  add(new THREE.CylinderGeometry(0.34, 0.2, 0.22, 12), bronze, 1.0)

  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.85 }),
  )
  fire.position.y = 1.14
  fire.scale.y = 1.35
  g.add(fire)

  const light = new THREE.PointLight('#ffa64a', 2.6, 7, 2)
  light.position.y = 1.25
  g.add(light)

  // 불은 흔들린다 — 판이 도는 동안 계속 산다
  const seed = rand(0, 10)
  g.userData.tick = t => {
    const f = 0.82 + Math.sin(t * 7.3 + seed) * 0.1 + Math.sin(t * 13.1 + seed * 2) * 0.06
    fire.scale.set(f, f * 1.35, f)
    light.intensity = 2.2 + f * 0.9
  }
  return g
}

/**
 * 바다 한가운데의 섬 — 갈 곳과 떠나온 곳.
 *
 * 항해 구간에 바다밖에 없을 때는 **어디로 가는지 알 수가 없었다.** 물은
 * 사방이 같고, 배를 돌려도 화면이 똑같으니 뱃머리가 어디를 보는지조차
 * 읽히지 않는다. 나아간 거리만 세고 있어서 아무 쪽으로 가도 도착했다 —
 * 조작은 있는데 뜻이 없는 구간이었다.
 *
 * 수평선에 섬을 둔다. 갈 곳이 앞에 서고 떠나온 곳이 뒤로 멀어지면 그제야
 * 방향이 생기고, 물이 흐르는 게 아니라 **내가 나아가는** 것으로 읽힌다.
 *
 * 멀리서 실루엣으로만 보이므로 안은 비워도 된다 — 능선 하나와 그 앞의
 * 낮은 곶 몇. 다가갈수록 커지는 것만으로 남은 거리가 읽힌다.
 *
 * ── 실루엣이 실제로 실루엣이 되게 ──
 * 처음 만들었을 때는 바위 색(#5a5f62)이 안개·하늘색(#6d7f8c 대·#7d8f9c 안개)과
 * 명도가 거의 같았다 — 그러면 "실루엣으로 보인다" 가 아니라 그냥 **안 보인다**
 * 가 된다. 실제로 항해 중 화면을 캡처해서 확인해 보니 목적지 섬이 통째로
 * 안 보이고 있었다. 그래서 두 가지를 더한다 —
 *   1. 바위 색을 하늘보다 확실히 어둡게 낸다 (기본값을 훨씬 짙게 바꿨다).
 *   2. 밑동에 **흰 파도띠**를 두른다 — 색이 아무리 어두워도 물과 맞닿는
 *      선 하나는 밝게 남아야, 섬 전체가 화면 위로 잘려 나가 봉우리가
 *      안 보이는 거리에서도 "저기 뭍이 있다" 는 한 줄이 남는다.
 *
 * @param o.h     봉우리 높이 (m)
 * @param o.r     밑동 반지름 (m)
 * @param o.color 바위 색 — 하늘·안개보다 뚜렷이 어두워야 실루엣으로 읽힌다
 */
export function buildIsle({ h = 52, r = 46, color = '#252c33', seed = 0 } = {}) {
  const g = new THREE.Group()
  const rock = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })
  const add = (geo, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(geo, rock)
    m.position.set(x, y, z)
    m.rotation.y = ry
    g.add(m)
    return m
  }
  // 봉우리 — 여덟 면이면 능선이 진다. 더 매끈하면 종처럼 보인다
  add(new THREE.ConeGeometry(r, h, 8, 1), 0, h / 2 - 2, 0, seed)
  // 어깨와 곶 — 밑동이 물에 잠기는 선을 흩어 준다
  add(new THREE.ConeGeometry(r * 0.62, h * 0.52, 7, 1), r * 0.62, h * 0.26 - 2, -r * 0.34, seed + 1.1)
  add(new THREE.ConeGeometry(r * 0.48, h * 0.34, 6, 1), -r * 0.7, h * 0.17 - 2, r * 0.3, seed + 2.3)
  add(new THREE.ConeGeometry(r * 0.34, h * 0.2, 6, 1), r * 0.15, h * 0.1 - 2, r * 0.78, seed + 3.7)

  /* 흰 파도띠 — 산자락 네 개 밑동을 따로따로 두른다. 색과 무관하게(안개
     낀 밤이든 폭풍이든) 밝기 하나로 "뭍의 가장자리" 를 읽게 하려는 것이라
     발광(emissive)로 낸다 — 조명 방향에 기대면 역광일 때 죽는다. */
  const foam = new THREE.MeshBasicMaterial({ color: '#dce8ec', transparent: true, opacity: 0.55 })
  const ring = (rr, x, y, z) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(rr, rr * 0.05, 6, 24), foam)
    m.position.set(x, y, z)
    m.rotation.x = Math.PI / 2
    g.add(m)
  }
  ring(r * 0.98, 0, -1.6, 0)
  ring(r * 0.6, r * 0.62, 0.26 * h * 0.06 - 1.7, -r * 0.34)
  ring(r * 0.46, -r * 0.7, 0.17 * h * 0.06 - 1.7, r * 0.3)
  return g
}


/* ── 동굴 ──────────────────────────────────────────────────

   "동굴은 전혀 동굴같지가 않다" 는 말이 맞았다. 폴리페모스의 방은 어두운
   둥근 마당에 바위 몇 개가 굴러다니는 곳이었다. 어둡게 한다고 동굴이 되지
   않는다 — **머리 위에 무언가 있어야** 안에 있는 것이 된다.

   쿼터뷰에서는 천장을 통째로 덮을 수 없다 (카메라가 위에 있어서 다 가린다).
   대신 셋으로 짠다:
     · 위에서 내려오는 종유석 — 먼 쪽 것이 화면 윗변에 걸려 틀을 닫는다
     · 바닥에서 솟은 석순 — 발밑에 굴곡을 준다
     · 입구를 막은 바위 — 이야기가 말하는 그 바위다 (나갈 길이 없다)
*/

const STONE = (c = '#3d372f') => new THREE.MeshStandardMaterial({ color: c, roughness: 0.96, flatShading: true })

/** 뿔 하나를 울퉁불퉁하게 흔든다. 매끈한 원뿔은 종유석이 아니라 고깔이다. */
function jaggedCone(rTop, rBot, h, seg = 7) {
  /* 매끈한 원뿔은 종유석이 아니라 고깔이다. 두 가지를 흔든다 —
     **둘레**(마디마다 다른 굵기)와 **기울기**(위아래가 조금 어긋난 축).
     굵기만 흔들면 여전히 원뿔이고, 축을 눕혀야 자란 것처럼 보인다. */
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg, 6, true)
  const pos = geo.attributes.position
  const lean = new THREE.Vector2(rand(-0.16, 0.16), rand(-0.16, 0.16))
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const t = (y + h / 2) / h                       // 0 아래 → 1 위
    const ring = Math.sin(t * 9.1 + i * 0.7) * 0.16 + Math.sin(i * 12.9898) * 0.1
    const k = 1 + ring
    pos.setX(i, pos.getX(i) * k + lean.x * y)
    pos.setZ(i, pos.getZ(i) * k + lean.y * y)
    pos.setY(i, y + Math.sin(i * 78.233) * h * 0.025)
  }
  geo.computeVertexNormals()
  return geo
}

/** 종유석 — 위에 매달린다. 원점이 천장 쪽이라 아래로 뻗는다. */
export function buildStalactite() {
  const h = rand(3.4, 7.2)
  const m = new THREE.Mesh(jaggedCone(rand(0.5, 0.95), 0.04, h), STONE('#39332c'))
  m.position.y = -h / 2
  m.castShadow = true
  const g = new THREE.Group()
  g.add(m)
  // 작은 것 하나를 옆에 더 단다 — 하나만 있으면 고드름이고 둘이면 동굴이다
  if (Math.random() < 0.7) {
    const h2 = h * rand(0.35, 0.6)
    const s = new THREE.Mesh(jaggedCone(rand(0.22, 0.4), 0.03, h2), STONE('#332e28'))
    s.position.set(rand(-0.9, 0.9), -h2 / 2, rand(-0.9, 0.9))
    s.castShadow = true
    g.add(s)
  }
  return g
}

/** 석순 — 바닥에서 솟는다. 종유석을 뒤집은 것이되 더 뭉툭하다. */
export function buildStalagmite() {
  const h = rand(1.1, 2.8)
  const m = new THREE.Mesh(jaggedCone(0.08, rand(0.4, 0.8), h), STONE('#453e35'))
  m.position.y = h / 2
  m.castShadow = m.receiveShadow = true
  const g = new THREE.Group()
  g.add(m)
  return g
}

/**
 * 입구를 막은 바위.
 *
 * 이야기가 "입구를 바위가 막았다" 로 시작하는데 화면에는 그 바위가 없었다.
 * 판에서 제일 먼저 눈에 들어와야 하는 물건이다 — 저것 때문에 못 나간다.
 * 둘레에 빛을 한 줄 새 넣는다: 막힌 틈으로 새어드는 바깥 빛이다.
 */
export function buildDoorStone() {
  const g = new THREE.Group()
  const r = 4.6
  const geo = new THREE.SphereGeometry(r, 14, 10)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + (Math.sin(i * 45.164) * 0.5 + 0.5) * 0.22 - 0.11
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 1.12, pos.getZ(i) * k * 0.72)
  }
  geo.computeVertexNormals()
  const rock = new THREE.Mesh(geo, STONE('#2e2a24'))
  rock.position.y = r * 0.72
  rock.castShadow = rock.receiveShadow = true
  g.add(rock)

  // 바위 뒤로 새는 빛 — 바깥이 있다는 유일한 표시다
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2.4, r * 2.2),
    new THREE.MeshBasicMaterial({
      color: '#ffd9a0', transparent: true, opacity: 0.16,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }),
  )
  glow.position.set(0, r * 0.8, -0.9)
  g.add(glow)
  const lamp = new THREE.PointLight('#ffc98a', 7, 22, 2)
  lamp.position.set(0, r * 0.7, -1.6)
  g.add(lamp)
  return g
}

/**
 * 횃불 — 벽에 꽂힌 것처럼 세운다.
 *
 * 화로(brazier)는 방 가운데를 밝히는 서 있는 불이고, 이것은 **벽을 따라
 * 죽 박힌** 것이다. 동굴처럼 화로 두 개로는 다 못 덮는 넓은 방에서, 벽선을
 * 따라 여러 개 세우면 그 자체로 '벽이 있다' 는 걸 불빛으로 그린다 —
 * 어두운 동굴에서 벽의 굴곡이 안 보여도 횃불이 죽 늘어선 줄이 그 자리를
 * 대신 말해 준다.
 *
 * 자루는 가늘고 길게, 불은 화로보다 작게 — 여러 개를 세울 것이므로
 * 하나하나가 시선을 끌면 안 된다. 벽에 박힌 모양이라 밑동에 받침이 없다.
 */
export function buildTorch() {
  const g = new THREE.Group()
  const wood = WOOD()
  const dark = new THREE.MeshStandardMaterial({ color: '#241a10', roughness: 0.9 })
  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.y = y
    m.castShadow = true
    g.add(m)
    return m
  }
  add(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 6), wood, 0.75)
  // 기름 먹인 천 머리 — 자루보다 살짝 굵게, 거뭇하게
  add(new THREE.CylinderGeometry(0.075, 0.06, 0.26, 8), dark, 1.52)

  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 7),
    new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0.88 }),
  )
  fire.position.y = 1.72
  fire.scale.y = 1.5
  g.add(fire)

  const light = new THREE.PointLight('#ff9a4a', 1.7, 5.5, 2)
  light.position.y = 1.8
  g.add(light)

  const seed = rand(0, 10)
  g.userData.tick = t => {
    const f = 0.8 + Math.sin(t * 8.7 + seed) * 0.12 + Math.sin(t * 15.4 + seed * 2) * 0.07
    fire.scale.set(f, f * 1.5, f)
    light.intensity = 1.3 + f * 0.7
  }
  return g
}

export const PROP_BUILDERS = {
  feastTable: buildFeastTable,
  brazier: buildBrazier,
  stalactite: buildStalactite,
  stalagmite: buildStalagmite,
  doorStone: buildDoorStone,
  torch: buildTorch,
}
