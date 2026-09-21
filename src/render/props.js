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
 * @param o.h     봉우리 높이 (m)
 * @param o.r     밑동 반지름 (m)
 * @param o.color 바위 색 — 멀리 있을수록 하늘에 가깝게
 */
export function buildIsle({ h = 52, r = 46, color = '#5a5f62', seed = 0 } = {}) {
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
  return g
}

export const PROP_BUILDERS = {
  feastTable: buildFeastTable,
  brazier: buildBrazier,
}
