import * as THREE from 'three'

/**
 * 인체 리그. 플레이어도 적도 같은 뼈대를 쓴다.
 * 관절 계층만 맞춰 두면 나중에 GLTF 로 갈아끼울 때 포즈 코드를 그대로 쓸 수 있다.
 *
 *   root
 *    └ hips ── legL/R ── shin ── foot
 *         └ chest ── armL/R ── forearm ── hand
 *                 └ neck ── head
 *
 * 전부 +Z 를 정면으로 본다 (facing 규약과 같다).
 */

const SEG = { rs: 4, hs: 8 }   // 캡슐 분할. 로우폴리로 유지한다

function limb(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, SEG.rs, SEG.hs), mat)
  m.position.y = -(len / 2 + r)          // 관절에서 아래로 늘어뜨린다
  m.castShadow = m.receiveShadow = true
  return m
}

function box(w, h, d, mat, y = 0, z = 0, x = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  return m
}

export function makeMaterials(palette) {
  const mk = (color, rough = 0.85, metal = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
  return {
    skin: mk(palette.skin, 0.72),
    cloth: mk(palette.cloth, 0.92),
    leather: mk(palette.leather, 0.7),
    bronze: mk(palette.bronze, 0.34, 0.8),
    accent: mk(palette.accent, 0.85),
    dark: mk(palette.dark ?? '#241c16', 0.9),
  }
}

/**
 * @param {object} o  { scale, palette, bulk }  bulk 가 크면 두껍고 육중해진다
 * @returns { root, j(관절), mats, materials }
 */
export function buildFigure(o = {}) {
  const S = o.scale ?? 1
  const B = o.bulk ?? 1
  const M = makeMaterials(o.palette)
  const mats = Object.values(M)

  const root = new THREE.Group()
  root.scale.setScalar(S)

  const hips = new THREE.Group(); hips.position.y = 0.95
  root.add(hips)
  hips.add(box(0.27 * B, 0.20, 0.19 * B, M.leather, -0.04))

  // 다리
  const legs = {}
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1
    const thigh = new THREE.Group()
    thigh.position.set(0.105 * B * s, -0.08, 0)
    thigh.add(limb(0.085 * B, 0.30, M.skin))
    const shin = new THREE.Group()
    shin.position.y = -0.46
    shin.add(limb(0.072 * B, 0.28, M.skin))
    const foot = new THREE.Group()
    foot.position.y = -0.42
    foot.add(box(0.13, 0.07, 0.26, M.leather, -0.03, 0.05))
    shin.add(foot)
    thigh.add(shin)
    hips.add(thigh)
    legs[side] = { thigh, shin, foot }
  }

  // 몸통
  const chest = new THREE.Group()
  hips.add(chest)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.155 * B, 0.32, SEG.rs, 10), M.skin)
  torso.position.y = 0.26
  torso.scale.set(1.22, 1, 0.8)      // 가슴은 넓고 납작하게 — 원통이면 통나무로 보인다
  torso.castShadow = torso.receiveShadow = true
  chest.add(torso)

  // 팔
  const arms = {}
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1
    const upper = new THREE.Group()
    upper.position.set(0.245 * B * s, 0.45, 0)   // 어깨를 몸 밖으로 빼야 팔이 읽힌다
    upper.add(limb(0.068 * B, 0.20, M.skin))
    const fore = new THREE.Group()
    fore.position.y = -0.32
    fore.add(limb(0.058 * B, 0.20, M.skin))
    const hand = new THREE.Group()
    hand.position.y = -0.30
    hand.add(box(0.09, 0.10, 0.08, M.skin, -0.04))
    fore.add(hand)
    upper.add(fore)
    chest.add(upper)
    arms[side] = { upper, fore, hand }
  }

  // 목·머리
  const neck = new THREE.Group()
  neck.position.y = 0.52
  chest.add(neck)
  neck.add(limb(0.055, 0.06, M.skin))
  const head = new THREE.Group()
  head.position.y = 0.06
  neck.add(head)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), M.skin)
  skull.position.y = 0.10
  skull.scale.set(0.95, 1.08, 1)
  skull.castShadow = skull.receiveShadow = true
  head.add(skull)
  // 수염 — 머리 방향이 실루엣으로 읽혀야 한다
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), M.dark)
  beard.position.set(0, 0.03, 0.055)
  beard.scale.set(1, 0.95, 0.85)
  head.add(beard)

  return {
    root,
    j: { hips, chest, neck, head, legs, arms },
    materials: M,
    mats,
  }
}

/* ── 포즈 ────────────────────────────────────────────────
   진짜 애니메이션이 붙기 전까지 쓰는 절차적 포즈.
   걷기·달리기·공격·구르기가 전부 여기서 나온다. */

export function poseFigure(f, s) {
  const j = f.j
  const t = s.t
  const run = s.run ?? 0        // 0..1 이동 강도
  const idle = 1 - run

  // 달리기 — 다리 교차와 팔 반대 스윙
  const stride = t * (6.4 + run * 3.4)
  const sw = Math.sin(stride) * run
  const sw2 = Math.sin(stride + Math.PI) * run

  j.legs.L.thigh.rotation.x = sw * 0.85
  j.legs.R.thigh.rotation.x = sw2 * 0.85
  j.legs.L.shin.rotation.x = Math.max(0, -sw) * 1.5
  j.legs.R.shin.rotation.x = Math.max(0, -sw2) * 1.5
  j.legs.L.foot.rotation.x = -j.legs.L.shin.rotation.x * 0.45
  j.legs.R.foot.rotation.x = -j.legs.R.shin.rotation.x * 0.45

  // 숨쉬기 — 가만히 있어도 살아있어 보이게
  const breath = Math.sin(t * 1.9) * 0.02 * idle
  j.hips.position.y = 0.95 + Math.abs(Math.sin(stride)) * 0.045 * run + breath
  j.chest.rotation.x = -run * 0.16 + breath * 0.8
  j.chest.rotation.y = sw * 0.12

  // 왼팔은 항상 달리기 스윙 (오른팔은 공격이 덮어쓴다)
  j.arms.L.upper.rotation.x = sw2 * 0.7 - run * 0.2
  j.arms.L.fore.rotation.x = -0.35 - Math.max(0, sw2) * 0.6
  j.arms.L.upper.rotation.z = 0.2

  // 오른팔 — 공격 스윙이 있으면 그쪽이 우선
  const a = s.attack
  if (a) {
    // a.wind 0..1 은 치켜드는 정도, a.swing 0..1 은 내려치는 정도
    j.arms.R.upper.rotation.x = -2.4 * a.wind + 2.0 * a.swing
    j.arms.R.upper.rotation.z = -0.5 - 0.5 * a.wind + 1.1 * a.swing
    j.arms.R.fore.rotation.x = -1.5 + 1.2 * a.swing
    j.chest.rotation.y += -0.45 * a.wind + 0.7 * a.swing
  } else if (s.draw != null) {
    // 활 당기기 — 왼팔로 활을 밀고 오른손을 얼굴 옆까지 당긴다
    const d = s.draw
    j.arms.L.upper.rotation.x = -1.55
    j.arms.L.upper.rotation.z = 0.06
    j.arms.L.fore.rotation.x = -0.1
    j.arms.R.upper.rotation.x = -1.35
    j.arms.R.upper.rotation.z = -0.55
    j.arms.R.fore.rotation.x = -1.5 - d * 0.9
    j.chest.rotation.y = -0.3 - d * 0.18
  } else {
    j.arms.R.upper.rotation.x = sw * 0.7 - run * 0.2
    j.arms.R.upper.rotation.z = -0.2
    j.arms.R.fore.rotation.x = -0.35 - Math.max(0, sw) * 0.6
  }

  // 구르기 — 몸을 말고 앞으로 한 바퀴
  const r = s.roll ?? 0
  if (r > 0) {
    const k = Math.sin(Math.min(r, 1) * Math.PI)
    j.hips.position.y = 0.95 - 0.42 * k
    j.chest.rotation.x = -1.2 * k
    j.legs.L.thigh.rotation.x = 1.9 * k
    j.legs.R.thigh.rotation.x = 1.9 * k
    j.legs.L.shin.rotation.x = 2.0 * k
    j.legs.R.shin.rotation.x = 2.0 * k
    j.arms.L.upper.rotation.x = 1.4 * k
    j.arms.R.upper.rotation.x = 1.4 * k
    f.root.rotation.x = Math.min(r, 1) * Math.PI * 2
  } else {
    f.root.rotation.x = 0
  }

  // 경직 — 맞으면 젖혀진다
  if (s.flinch) {
    j.chest.rotation.x += s.flinch * 0.5
    j.head.rotation.x = s.flinch * 0.4
  } else {
    j.head.rotation.x = 0
  }
}

/** models.create() 와 같은 모양으로 감싼다. 호출부는 둘을 구분할 필요가 없다. */
export function wrapFigure(fig) {
  return {
    root: fig.root,
    mats: fig.mats,
    figure: fig,
    pose(state) { poseFigure(fig, state) },
  }
}
