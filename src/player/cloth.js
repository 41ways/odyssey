import * as THREE from 'three'

/**
 * 천 — 망토를 위한 verlet 시뮬레이션.
 *
 * 전에는 원통 마디 다섯을 스프링으로 흔들었다. 그건 천이 아니라 관절 달린
 * 튜브라서 접히지도, 늘어지지도, 등에 걸리지도 않는다 — 색종이를 붙인 것처럼
 * 보인 이유가 그거다. 천은 **점들의 격자**여야 한다. 점마다 중력을 받고,
 * 이웃과의 거리를 지키려 들고, 몸에 부딪히면 밀려난다. 그 셋이면 끝이다.
 *
 * verlet 을 쓰는 이유: 속도를 따로 들고 다니지 않고 (지금 위치 − 지난 위치)로
 * 대신하므로, 제약을 풀 때 위치만 고치면 속도가 저절로 따라온다. 천처럼
 * 제약이 많은 것에는 이게 제일 안정적이다.
 *
 * 좌표는 캐릭터 몸 기준(attachToBody 아래)이다. 몸이 움직이면 그 움직임을
 * 바람으로 바꿔 천에 먹인다 — 그래서 달리면 뒤로 날리고 멈추면 내려온다.
 */

const G = -9.8
const SUBSTEPS = 3          // 한 프레임에 제약을 몇 번 풀 것인가. 많을수록 덜 늘어난다
const DAMP = 0.985          // 공기 저항. 1 이면 영원히 출렁인다

export function buildClothCape({
  cols = 9, rows = 11,       // 격자. 가로 9 세로 11 이면 정점 99 — 싸다
  width = 0.42, height = 0.84,
  material,
  collider = { x: 0, y: -0.22, z: 0.06, r: 0.19 },   // 등. 천이 몸을 뚫지 않게
} = {}) {
  const n = cols * rows
  const pos = new Float32Array(n * 3)
  const prev = new Float32Array(n * 3)
  const pinned = new Uint8Array(n)

  // 격자를 어깨선(y=0)에서 아래로 늘어뜨린다. 맨 윗줄은 어깨에 박는다.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 3
      const u = c / (cols - 1) - 0.5
      // 어깨는 좁고 아래로 갈수록 퍼진다 — 사다리꼴이 망토다
      const flare = 1 + (r / (rows - 1)) * 0.55
      pos[i] = u * width * flare
      pos[i + 1] = -(r / (rows - 1)) * height
      pos[i + 2] = -0.02 - (r / (rows - 1)) * 0.03
      prev[i] = pos[i]; prev[i + 1] = pos[i + 1]; prev[i + 2] = pos[i + 2]
      if (r === 0) pinned[r * cols + c] = 1
    }
  }

  // 제약: 가로·세로 이웃(구조) + 대각선(전단). 대각선이 없으면 마름모로 무너진다.
  const cons = []
  const link = (a, b) => {
    const d = Math.hypot(pos[a*3]-pos[b*3], pos[a*3+1]-pos[b*3+1], pos[a*3+2]-pos[b*3+2])
    cons.push(a, b, d)
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c
    if (c + 1 < cols) link(i, i + 1)
    if (r + 1 < rows) link(i, i + cols)
    if (c + 1 < cols && r + 1 < rows) { link(i, i + cols + 1); link(i + 1, i + cols) }
  }
  const consF = new Float32Array(cons)

  // 메시. 격자를 삼각형으로 잇고, 앞뒤 다 보이게 한다.
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const uv = new Float32Array(n * 2)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    uv[(r * cols + c) * 2] = c / (cols - 1); uv[(r * cols + c) * 2 + 1] = 1 - r / (rows - 1)
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  const idx = []
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1
    idx.push(a, d, b, b, d, e)
  }
  geo.setIndex(idx)
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, material)
  mesh.material.side = THREE.DoubleSide   // 천은 앞뒤가 다 보인다. 여기서 직접 박아야 확실하다
  mesh.castShadow = true
  mesh.frustumCulled = false     // 경계 상자가 매 프레임 바뀐다. 잘못 잘리느니 그냥 그린다
  const group = new THREE.Group()
  group.add(mesh)

  const wind = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  let t = 0

  return {
    group, mesh,
    /**
     * @param s.run     0..1 달리는 정도 → 뒤로 날린다
     * @param s.turn    초당 회전 → 옆으로 쓸린다
     * @param s.rolling 구르는 중 → 위로 말린다
     * @param s.vel     월드 속도 (선택). 있으면 몸 움직임이 그대로 바람이 된다
     */
    update(dt, s = {}) {
      dt = Math.min(dt, 1 / 30)     // 탭 복귀 등으로 dt 가 튀면 천이 터진다
      t += dt
      const run = s.run ?? 0
      // 바람: 달리면 뒤로, 돌면 옆으로, 구르면 위로. 여기에 흔들림 한 줌.
      // 캐릭터의 앞이 +z 다 (player.#moveBy: z += cos(facing)). 그러니 뒤는 -z 고,
      // 바람은 -z 로 불어야 한다. 처음에 +z 로 뒀더니 망토가 어깨 앞으로 말려 올라왔다.
      //
      // 값은 **가속도**로 맞춘다 (아래 적분에서 x·z 에 30 을 곱한다).
      // 전에는 가만히 서 있어도 뒤로 3.5 × 30 = 105 — 중력(9.8)의 열 배라
      // 망토가 늘 깃발처럼 수평으로 뻗어 있었다. 기울기는 atan(뒤 가속 / 중력)이다:
      //   서 있을 때  0.09 × 30 ≈ 2.6  → 약 15°, 늘어져 있다
      //   달릴 때     0.57 × 30 ≈ 17   → 약 60°, 뒤로 날린다
      //   돌 때       초당 회전 12 에서 옆으로 약 30°
      wind.set(
        Math.sin(t * 1.7) * 0.03 + (s.turn ?? 0) * 0.016,
        (s.rolling ? 9 : 0) + Math.sin(t * 2.3) * 0.3,
        -(0.09 + run * 0.48 + Math.cos(t * 1.1) * 0.03),
      )

      const h = dt / SUBSTEPS
      for (let step = 0; step < SUBSTEPS; step++) {
        // 1) 적분
        for (let i = 0; i < n; i++) {
          if (pinned[i]) continue
          const k = i * 3
          const vx = (pos[k] - prev[k]) * DAMP
          const vy = (pos[k+1] - prev[k+1]) * DAMP
          const vz = (pos[k+2] - prev[k+2]) * DAMP
          prev[k] = pos[k]; prev[k+1] = pos[k+1]; prev[k+2] = pos[k+2]
          // 아랫자락일수록 바람을 더 받는다 — 위는 몸에 붙어 있다
          const row = (i / cols) | 0
          const catchWind = (row / (rows - 1)) * 0.9 + 0.1
          pos[k]   += vx + wind.x * catchWind * h * h * 30
          pos[k+1] += vy + (G + wind.y * catchWind) * h * h
          pos[k+2] += vz + wind.z * catchWind * h * h * 30
        }
        // 2) 거리 제약. 두 번 돌면 덜 늘어난다
        for (let pass = 0; pass < 2; pass++) {
          for (let c = 0; c < consF.length; c += 3) {
            const a = consF[c] * 3, b = consF[c+1] * 3, rest = consF[c+2]
            const dx = pos[b]-pos[a], dy = pos[b+1]-pos[a+1], dz = pos[b+2]-pos[a+2]
            const d = Math.hypot(dx, dy, dz) || 1e-6
            const diff = (d - rest) / d
            const pa = pinned[consF[c]], pb = pinned[consF[c+1]]
            const wa = pa ? 0 : (pb ? 1 : 0.5), wb = pb ? 0 : (pa ? 1 : 0.5)
            pos[a]   += dx * diff * wa; pos[a+1] += dy * diff * wa; pos[a+2] += dz * diff * wa
            pos[b]   -= dx * diff * wb; pos[b+1] -= dy * diff * wb; pos[b+2] -= dz * diff * wb
          }
        }
        // 3) 몸에 부딪히면 밀어낸다. 등 하나면 충분하다 — 다리는 천 아래에 없다
        for (let i = 0; i < n; i++) {
          if (pinned[i]) continue
          const k = i * 3
          tmp.set(pos[k] - collider.x, pos[k+1] - collider.y, pos[k+2] - collider.z)
          const d = tmp.length()
          if (d < collider.r && d > 1e-6) {
            tmp.multiplyScalar(collider.r / d)
            pos[k] = collider.x + tmp.x; pos[k+1] = collider.y + tmp.y; pos[k+2] = collider.z + tmp.z
          }
          // 앞(+z)으로 넘어와 몸을 뚫지 않게 — 천은 등 뒤(-z)에 있다
          if (pos[k+2] > -0.01) pos[k+2] = -0.01
        }
      }
      geo.attributes.position.needsUpdate = true
      geo.computeVertexNormals()
    },
  }
}
