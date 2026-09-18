import * as THREE from 'three'
import { buildClothCape } from './cloth.js'
import { clamp } from '../core/math.js'

/**
 * 전리품 장비.
 *
 * 키코네스족을 잡고 그 자리에서 벗겨 입는다 — 이스마로스 약탈 그 자체다.
 * 몇 마리째에 무엇이 붙는지가 곧 이 스테이지의 진행도다. 숫자는 여기 하나만 고치면 된다.
 *
 * 전에는 샅바 하나만 걸친 알몸으로 시작해서 **가죽 바지**부터 얻었다.
 * 트로이를 함락하고 돌아가는 이타카의 왕이 알몸일 이유가 없고, 가죽 바지는
 * 청동기 그리스에 없던 옷이다. 이제 아마포 키톤에 샌들 차림으로 시작하고
 * (player.js 의 BASE), 약탈하는 것은 **청동 무장**이다 — 호메로스의 전사가
 * 전투 뒤에 쓰러진 적에게서 벗겨 가던 바로 그것.
 */
export const KIT = [
  { id: 'cuirass',   kills: 3,  name: '청동 흉갑',     line: '키코네스 전사의 가슴에서 벗겨 냈다' },
  { id: 'bracers',   kills: 5,  name: '청동 팔가리개', line: '피가 덜 마른 채로 찼다' },
  { id: 'pauldrons', kills: 10, name: '청동 견갑',     line: '어깨를 덮으니 어깨가 무겁다' },
  { id: 'helmet',    kills: 15, name: '코린토스 투구', line: '볏이 꺾인 채로도 쓸 만하다' },
  { id: 'cape',      kills: 20, name: '붉은 망토',     line: '이제 왕처럼 보인다' },
]

/** 다음 장비까지 남은 처치 수와 진행도. */
export function kitProgress(kills) {
  const next = KIT.find(k => kills < k.kills)
  if (!next) return { done: true, next: null, from: KIT[KIT.length - 1].kills, to: KIT[KIT.length - 1].kills, ratio: 1 }
  const prev = KIT.filter(k => k.kills <= kills).pop()
  const from = prev ? prev.kills : 0
  return { done: false, next, from, to: next.kills, ratio: (kills - from) / (next.kills - from) }
}

/**
 * 장비를 뼈대에 달아 둔다. 전부 숨겨진 채로 시작하고, 얻을 때 켠다.
 * 관절에 붙이므로 포즈를 따라 같이 움직인다.
 */
export function buildGear(fig) {
  const j = fig.j
  const M = fig.materials
  const mats = []
  const mk = (color, rough = 0.85, metal = 0, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...opts })
    mats.push(m)
    return m
  }
  const leather = mk('#7a5334', 0.74)
  const linen = mk('#cdbfa0', 0.94)
  const trim = mk('#9c3327', 0.9)
  const bronze = mk('#c08a3e', 0.3, 0.85)
  const crest = mk('#a8322a', 0.92)
  const wool = mk('#8e2b22', 0.95, 0, { side: THREE.DoubleSide })

  const add = (parent, mesh) => { mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh }
  const group = parent => { const g = new THREE.Group(); g.visible = false; parent.add(g); return g }

  /* 바지 — 허리에 두르고 허벅지를 따라 내려간다 */
  const pants = group(j.hips)
  const waist = add(pants, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 12), leather))
  waist.position.y = -0.04
  const pantLegs = []
  for (const side of ['L', 'R']) {
    const g = new THREE.Group(); g.visible = false
    j.legs[side].thigh.add(g)
    const leg = add(g, new THREE.Mesh(new THREE.CapsuleGeometry(0.098, 0.26, 4, 8), leather))
    leg.position.y = -0.21
    pantLegs.push(g)
  }

  /* 상의 — 가슴을 덮고 허리 아래로 자락이 떨어진다 */
  const tunic = group(j.chest)
  const body = add(tunic, new THREE.Mesh(new THREE.CapsuleGeometry(0.168, 0.32, 4, 12), linen))
  body.position.y = 0.26; body.scale.set(1.22, 1, 0.82)
  const collar = add(tunic, new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.02, 6, 16), trim))
  collar.position.y = 0.47; collar.rotation.x = Math.PI / 2; collar.scale.set(1.2, 0.82, 1)
  const skirt = group(j.hips)
  const linenOpen = mk('#cdbfa0', 0.94, 0, { side: THREE.DoubleSide })
  const skirtMesh = add(skirt, new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.29, 0.34, 14, 1, true), linenOpen))
  skirtMesh.position.y = -0.14
  const belt = add(skirt, new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.06, 14), leather))
  belt.position.y = 0.02

  /* 견갑 — 어깨를 덮는 청동판 */
  const pauldrons = []
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1
    const g = new THREE.Group(); g.visible = false
    j.arms[side].upper.add(g)
    const cap = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), bronze))
    cap.position.y = 0.025
    cap.scale.set(1.2, 0.52, 1.1)          // 납작하게 눌러야 갑옷판으로 보인다
    const rim = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.014, 6, 18), bronze))
    rim.position.y = -0.015; rim.rotation.x = Math.PI / 2; rim.scale.set(1.2, 1.1, 1)
    g.rotation.z = 0.16 * s
    pauldrons.push(g)
  }

  /* 투구 — 코린토스식. 돔 + 코가리개 + 볼가리개 + 볏 */
  const helmet = group(j.head)
  const dome = add(helmet, new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), bronze))
  dome.position.y = 0.105; dome.scale.set(1, 1.12, 1.05)
  const band = add(helmet, new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 6, 18), bronze))
  band.position.y = 0.075; band.rotation.x = Math.PI / 2; band.scale.z = 1.05
  const nose = add(helmet, new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.14, 0.03), bronze))
  nose.position.set(0, 0.035, 0.142)
  for (const s of [-1, 1]) {
    const cheek = add(helmet, new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.13, 0.09), bronze))
    cheek.position.set(0.115 * s, 0.03, 0.075)
    cheek.rotation.y = -0.35 * s
  }
  const fin = add(helmet, new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.05, 0.3), bronze))
  fin.position.set(0, 0.225, -0.005)
  // 말총 볏 — 앞뒤로 길게 눕는다. 위로 선 뿔이 아니다.
  const plume = add(helmet, new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.135, 0.34), crest))
  plume.position.set(0, 0.29, -0.01)
  const front = add(helmet, new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.062, 8), crest))
  front.position.set(0, 0.29, 0.16); front.rotation.z = Math.PI / 2; front.scale.y = 1
  const tail = add(helmet, new THREE.Mesh(new THREE.CapsuleGeometry(0.031, 0.2, 4, 8), crest))
  tail.position.set(0, 0.23, -0.24); tail.rotation.x = 1.15

  /* 망토 — 등 뒤에 걸린 천 */
  const cape = group(j.chest)
  const cloth = add(cape, new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.46, 1.0, 16, 2, true, Math.PI * 0.42, Math.PI * 1.16), wool))
  cloth.position.set(0, 0.02, -0.03)
  const clasp = add(cape, new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), bronze))
  clasp.position.set(0.16, 0.46, 0.04)

  const parts = {
    cuirass: [tunic, skirt],
    bracers: [pants, ...pantLegs],
    pauldrons,
    helmet: [helmet],
    cape: [cape],
  }

  return {
    mats,
    cape: cloth,
    /** 얻은 장비를 켠다. */
    equip(id) { for (const g of parts[id] ?? []) g.visible = true },
    reset() { for (const list of Object.values(parts)) for (const g of list) g.visible = false },
    has(id) { return !!parts[id]?.[0]?.visible },
  }
}

/** 무기. 손 관절에 붙어서 포즈를 따라간다. */
export function buildWeapons(fig) {
  const j = fig.j
  const mats = []
  const mk = (c, r, m) => { const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); mats.push(x); return x }
  const steel = mk('#efe9dc', 0.22, 0.95)
  const bronze = mk('#c08a3e', 0.32, 0.85)
  const wood = mk('#6b4a2c', 0.8, 0)
  const add = (p, m) => { m.castShadow = true; p.add(m); return m }

  // 칼 — 오른손
  const sword = new THREE.Group()
  j.arms.R.hand.add(sword)
  sword.position.y = -0.08
  // 쿼터뷰에서 위에서 내려다보므로 날이 얇으면 통째로 사라진다. 두껍게 간다.
  const blade = add(sword, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.66, 0.032), steel))
  blade.position.y = -0.38
  const tip = add(sword, new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), steel))
  tip.position.y = -0.77; tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4
  const guard = add(sword, new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.032, 0.05), bronze))
  guard.position.y = -0.05
  const grip = add(sword, new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.11, 8), wood))
  const pommel = add(sword, new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), bronze))
  pommel.position.y = 0.06
  sword.rotation.set(-0.2, 0, -0.22)   // 다리에 가리지 않게 살짝 바깥으로

  // 활 — 안 쏠 땐 등에, 당길 땐 왼손에
  const makeBow = () => {
    const g = new THREE.Group()
    const arc = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 6, 20, Math.PI * 1.15), wood))
    arc.rotation.z = Math.PI * 0.42
    const string = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 4),
      new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.9 })))
    string.position.x = 0.11
    return g
  }
  const bowHand = makeBow()
  j.arms.L.hand.add(bowHand)
  bowHand.position.y = -0.1
  bowHand.rotation.set(Math.PI / 2, 0, 0)
  bowHand.visible = false

  const bowBack = makeBow()
  j.chest.add(bowBack)
  bowBack.position.set(-0.06, 0.24, -0.17)
  bowBack.rotation.set(0.2, 0, 0.5)

  return { mats, sword, bowHand, bowBack }
}


/* ── 본에 매다는 프롭 ─────────────────────────────────────────
   GLTF 캐릭터에는 무기도 투구도 망토도 없다. 관절에 직접 걸어 준다.
   코드 인체와 같은 조각을 쓰므로 모양이 어긋나지 않는다. */

function propMaterials() {
  const mats = []
  const mk = (c, r, m = 0, o = {}) => {
    const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o })
    mats.push(x)
    return x
  }
  return {
    mats,
    steel: mk('#efe9dc', 0.22, 0.95),
    bronze: mk('#c08a3e', 0.32, 0.85),
    wood: mk('#6b4a2c', 0.8),
    crest: mk('#a8322a', 0.92),
    wool: mk('#8e2b22', 0.95, 0, { side: THREE.DoubleSide }),
    string: mk('#e8dcc0', 0.9),
  }
}

/** 칼 한 자루. 손 관절에 건다. */
export function buildSwordProp() {
  const M = propMaterials()
  const g = new THREE.Group()
  const add = m => { m.castShadow = true; g.add(m); return m }
  const blade = add(new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.62, 0.05), M.steel))
  blade.position.y = -0.36
  const tip = add(new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.14, 4), M.steel))
  tip.position.y = -0.73; tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4
  const guard = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.06), M.bronze))
  guard.position.y = -0.05
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.11, 8), M.wood))
  const pommel = add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), M.bronze))
  pommel.position.y = 0.06
  return { group: g, mats: M.mats }
}

/** 활. */
export function buildBowProp() {
  const M = propMaterials()
  const g = new THREE.Group()
  const add = m => { m.castShadow = true; g.add(m); return m }
  const arc = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 22, Math.PI * 1.15), M.wood))
  arc.rotation.z = Math.PI * 0.42
  const str = add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.62, 4), M.string))
  str.position.x = 0.125
  return { group: g, mats: M.mats }
}

/**
 * 코린토스식 투구.
 *
 * 반구에 박스를 얹으면 냄비가 된다. 진짜 실루엣은 옆에서 본 윤곽에서 나온다 —
 * 정수리에서 둥글게 내려오다 볼 쪽에서 한 번 벌어지고 목덜미로 떨어진다.
 * 그래서 돔은 라스(회전체)로 뽑는다.
 */
export function buildHelmetProp() {
  const M = propMaterials()
  const dark = new THREE.MeshStandardMaterial({ color: '#171008', roughness: 0.95 })
  const deep = new THREE.MeshStandardMaterial({ color: '#8a5f26', roughness: 0.42, metalness: 0.8 })
  M.mats.push(dark, deep)

  const g = new THREE.Group()
  const add = (m, mat) => { m.castShadow = m.receiveShadow = true; g.add(m); return m }

  // 옆에서 본 윤곽 (반지름, 높이). 아래가 살짝 벌어져 목덜미를 덮는다.
  const profile = [
    [0.000, -0.175], [0.092, -0.180], [0.150, -0.168], [0.170, -0.130],
    [0.172, -0.060], [0.170, 0.010], [0.164, 0.080], [0.150, 0.140],
    [0.124, 0.192], [0.086, 0.232], [0.045, 0.256], [0.000, 0.264],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const dome = add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), M.bronze))
  dome.material.side = THREE.DoubleSide

  // 얼굴 구멍 — 코린토스 투구의 T 자 트임
  const socket = (x) => {
    const e = add(new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.046, 0.06), dark))
    e.position.set(x, 0.022, 0.138)
    e.rotation.x = -0.12
  }
  socket(-0.055); socket(0.055)
  const gap = add(new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.075, 0.05), dark))
  gap.position.set(0, -0.098, 0.128)

  // 코가리개 — 두 눈 사이를 세로로 가른다
  const nose = add(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.135, 0.042), M.bronze))
  nose.position.set(0, -0.032, 0.152)
  // 눈썹 능선
  for (const sx of [-1, 1]) {
    const brow = add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.03), deep))
    brow.position.set(0.058 * sx, 0.055, 0.15)
    brow.rotation.z = -0.22 * sx
  }
  // 아래 테두리
  const rim = add(new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.015, 6, 24), deep))
  rim.position.y = -0.162; rim.rotation.x = Math.PI / 2

  // 볏 받침 — 앞뒤로 낮게 누운 청동 날
  const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.33), deep))
  fin.position.set(0, 0.24, -0.01)

  // 말총 볏. 토막을 호를 따라 늘어놓고 끝으로 갈수록 가늘게 —
  // 상자 하나로 만들면 벽돌처럼 보인다.
  const crest = new THREE.Group()
  const N = 14
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const a = (t - 0.5) * 2.3                      // 앞에서 뒤로 넘어가는 호
    const taper = Math.sin(t * Math.PI) * 0.75 + 0.25
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.1 * taper, 0.05), M.crest)
    seg.position.set(0, Math.cos(a) * 0.1 + 0.245, -Math.sin(a) * 0.17 - 0.01)
    seg.rotation.x = a * 0.5
    seg.castShadow = true
    crest.add(seg)
  }
  g.add(crest)

  // 목덜미로 흘러내리는 꼬리
  const tail = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.2, 4, 8), M.crest))
  tail.position.set(0, 0.16, -0.21); tail.rotation.x = 1.15
  tail.scale.set(1.5, 1, 1)

  return { group: g, mats: M.mats }
}

/**
 * 붉은 망토.
 *
 * 전에는 원통 마디 다섯을 스프링으로 흔들었다. 관절 달린 튜브라 접히지도
 * 늘어지지도 않아서 색종이를 붙인 것처럼 보였다. 이제 천 자체를 시뮬레이션한다
 * (player/cloth.js) — 점 격자에 중력과 거리 제약과 몸 충돌. 달리면 뒤로
 * 날리고, 멈추면 내려오고, 돌면 옆으로 쓸린다. 바람은 몸 움직임에서 나온다.
 */
export function buildCapeProp() {
  const M = propMaterials()
  M.wool.side = THREE.DoubleSide        // 천은 앞뒤가 다 보인다
  const g = new THREE.Group()

  const cloth = buildClothCape({ material: M.wool })
  g.add(cloth.group)

  // 어깨 걸쇠 두 개 — 망토가 어디에 걸려 있는지 보이게
  for (const sx of [-1, 1]) {
    const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), M.bronze)
    clasp.position.set(0.135 * sx, 0.035, 0.045)
    clasp.scale.set(1, 1, 0.7)
    clasp.castShadow = true
    g.add(clasp)
  }

  return {
    group: g,
    mats: M.mats,
    /** @param {object} s  { run 0..1, turn 초당 회전(rad), rolling } */
    update(dt, s = {}) { cloth.update(dt, s) },
  }
}

/** 창. 키코네스 전사가 든다. */
export function buildSpearProp() {
  const M = propMaterials()
  const g = new THREE.Group()
  const add = m => { m.castShadow = true; g.add(m); return m }
  const shaft = add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.95, 6), M.wood))
  shaft.position.y = -0.55
  const head = add(new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.26, 6), M.bronze))
  head.position.y = -1.6; head.rotation.x = Math.PI
  const collar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.07, 6), M.bronze))
  collar.position.y = -1.45
  const butt = add(new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.12, 6), M.bronze))
  butt.position.y = 0.46
  return { group: g, mats: M.mats }
}

/**
 * 키톤 자락과 가죽 술(프테루게스).
 *
 * 받아 온 몸은 속옷이 텍스처에 그려져 있고 옷 조각은 허리에서 끝난다.
 * 그래서 키톤을 입혀도 허리 아래로 검은 속옷이 드러났다. 그리스 전사의
 * 허리 아래는 무릎 위까지 오는 **아마포 자락**이고, 흉갑을 입으면 그 위로
 * **가죽 띠를 늘어뜨린 술**이 덮인다 — 조각상과 도기 그림에서 늘 보이는 윤곽이다.
 *
 * 자락은 회전체(라스)로 뽑는다 — 위는 허리에 붙고 아래로 벌어진다.
 * 술은 띠 열네 개. 하나의 원통으로 만들면 치마가 두 겹일 뿐 술로 안 읽힌다.
 */
export function buildSkirtProp({ color = '#d9ccae' } = {}) {
  const M = propMaterials()
  const linen = new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide })
  const rags = new THREE.Color('#6f6555'), plain = new THREE.Color(color)
  const hide = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.8 })
  M.mats.push(linen, hide)

  const g = new THREE.Group()
  const profile = [
    [0.155, 0.06], [0.165, 0.0], [0.19, -0.1], [0.215, -0.2], [0.235, -0.29], [0.24, -0.31],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), linen)
  skirt.castShadow = skirt.receiveShadow = true
  skirt.scale.set(1, 1, 0.82)            // 앞뒤로 납작하게 — 몸통은 둥근 기둥이 아니다
  g.add(skirt)

  // 가죽 술 — 흉갑을 얻을 때 같이 켜진다
  const strips = new THREE.Group()
  strips.visible = false
  const N = 14
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.012), hide)
    s.position.set(Math.sin(a) * 0.205, -0.1, Math.cos(a) * 0.205 * 0.82)
    s.rotation.y = a
    s.rotation.x = 0.18                    // 바깥으로 살짝 벌어진다
    s.castShadow = true
    strips.add(s)
  }
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.018, 6, 24), M.bronze)
  belt.rotation.x = Math.PI / 2
  belt.scale.set(1, 0.82, 1)
  belt.position.y = 0.035
  strips.add(belt)
  g.add(strips)

  return {
    group: g, mats: M.mats,
    armour(on) { strips.visible = on },
    rags(on) { linen.color.copy(on ? rags : plain) },
  }
}

/**
 * 받아 온 사람 몸에 그리스 차림을 입힌다 — 적·동료가 같이 쓴다.
 *
 * 받아 온 옷 조각(Quaternius 판타지 의상)은 원래 색이면 바지·부츠·긴소매라
 * 중세가 된다. 조각 모양은 두고 재질만 칠하고(무늬 텍스처는 뗀다), 바지는
 * 안 입히고, 허리에 자락을 두른다. 자락은 매 프레임 골반 위치를 따라가야
 * 하므로 follow() 를 돌려준다 — 부르는 쪽이 sync 에서 부른다.
 *
 * @param dress { body, feet, arms, pauldron, skirt, metal: [부위…] }
 *              값은 색. 없는 부위는 입히지 않는다.
 */
export function dressRig(rig, dress) {
  const mats = []
  const metal = new Set(dress.metal ?? [])
  for (const part of ['body', 'feet', 'arms', 'pauldron']) {
    if (!dress[part]) continue
    for (const m of rig.equip(part)) {
      const list = (Array.isArray(m.material) ? m.material : [m.material]).map(x => {
        const c = x.clone()
        c.map = null
        c.color.set(dress[part])
        c.metalness = metal.has(part) ? 0.8 : 0
        c.roughness = metal.has(part) ? 0.38 : 0.93
        mats.push(c)
        return c
      })
      m.material = Array.isArray(m.material) ? list : list[0]
    }
  }
  let follow = () => {}
  if (dress.skirt && rig.attachToBody && rig.bone) {
    const sk = buildSkirtProp({ color: dress.skirt })
    if (dress.strips) sk.armour(true)
    mats.push(...sk.mats)
    const mount = rig.attachToBody(sk.group, { position: [0, 0.93, 0.02] })
    const pelvis = rig.bone('pelvis')
    const v = new THREE.Vector3()
    follow = () => {
      if (!pelvis) return
      pelvis.getWorldPosition(v)
      rig.root.worldToLocal(v)
      mount.position.set(v.x, v.y + 0.165, v.z)
    }
  }
  return { mats, follow }
}
