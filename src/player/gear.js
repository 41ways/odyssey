import * as THREE from 'three'

/**
 * 전리품 장비.
 *
 * 키코네스족을 잡고 그 자리에서 벗겨 입는다 — 이스마로스 약탈 그 자체다.
 * 몇 마리째에 무엇이 붙는지가 곧 이 스테이지의 진행도다. 숫자는 여기 하나만 고치면 된다.
 */
export const KIT = [
  { id: 'pants',     kills: 3,  name: '가죽 바지',   line: '키코네스 전사에게서 벗겨 입었다' },
  { id: 'tunic',     kills: 5,  name: '아마포 상의', line: '피가 덜 마른 채로 걸쳤다' },
  { id: 'pauldrons', kills: 10, name: '청동 견갑',   line: '어깨를 덮으니 어깨가 무겁다' },
  { id: 'helmet',    kills: 15, name: '투구',        line: '볏이 꺾인 채로도 쓸 만하다' },
  { id: 'cape',      kills: 20, name: '붉은 망토',   line: '이제 왕처럼 보인다' },
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
    pants: [pants, ...pantLegs],
    tunic: [tunic, skirt],
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

/** 코린토스식 투구. 머리 관절에 건다. */
export function buildHelmetProp() {
  const M = propMaterials()
  const g = new THREE.Group()
  const add = m => { m.castShadow = m.receiveShadow = true; g.add(m); return m }
  const dome = add(new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), M.bronze))
  dome.position.y = 0.02; dome.scale.set(1, 1.12, 1.05)
  const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 6, 18), M.bronze))
  band.position.y = -0.01; band.rotation.x = Math.PI / 2; band.scale.z = 1.05
  const nose = add(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.14, 0.03), M.bronze))
  nose.position.set(0, -0.05, 0.142)
  for (const s of [-1, 1]) {
    const cheek = add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.13, 0.09), M.bronze))
    cheek.position.set(0.115 * s, -0.055, 0.075)
    cheek.rotation.y = -0.35 * s
  }
  const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.04, 0.26), M.bronze))
  fin.position.set(0, 0.135, -0.01)
  const plume = add(new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.09, 0.27), M.crest))
  plume.position.set(0, 0.185, -0.015)
  const tail = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.14, 4, 8), M.crest))
  tail.position.set(0, 0.145, -0.19); tail.rotation.x = 1.3
  return { group: g, mats: M.mats }
}

/** 붉은 망토. 등 관절에 건다. */
export function buildCapeProp() {
  const M = propMaterials()
  const g = new THREE.Group()
  // 어깨에서 허리 아래까지. 넓게 펴면 판때기로 보인다.
  const cloth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.28, 0.72, 18, 3, true, Math.PI * 0.55, Math.PI * 0.9), M.wool)
  cloth.castShadow = true
  cloth.position.set(0, -0.3, -0.02)
  g.add(cloth)
  const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.bronze)
  clasp.position.set(0.13, 0.03, 0.05)
  g.add(clasp)
  return { group: g, cloth, mats: M.mats }
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
