import * as THREE from 'three'

/**
 * 투사체 꼬리.
 *
 * 날아가는 물체는 궤적이 보여야 눈이 따라간다. 점 하나는 순간이동처럼 보인다.
 * 지나온 자리를 몇 점 기억했다가 카메라를 향한 띠로 잇고, 뒤로 갈수록 가늘고 옅게 만든다.
 */
const SEGMENTS = 18
const UP = new THREE.Vector3(0, 1, 0)

export class Trail {
  constructor(scene) {
    this.scene = scene
    this.pool = []
  }

  take({ color = '#ffb066', width = 0.16, opacity = 0.75 } = {}) {
    let t = this.pool.pop()
    if (!t) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEGMENTS * 2 * 3), 3))
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SEGMENTS * 2 * 3), 3))
      const idx = []
      for (let i = 0; i < SEGMENTS - 1; i++) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
      geo.setIndex(idx)
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
      t = { mesh: new THREE.Mesh(geo, mat), pts: [] }
      t.mesh.frustumCulled = false
      t.mesh.renderOrder = 5
    }
    t.color = new THREE.Color(color)
    t.width = width
    t.opacity = opacity
    t.pts.length = 0
    t.mesh.visible = false
    this.scene.add(t.mesh)
    return t
  }

  give(t) {
    if (!t) return
    this.scene.remove(t.mesh)
    this.pool.push(t)
  }

  /** 매 프레임 현재 위치를 넣고 띠를 다시 짠다. */
  update(t, pos, camera) {
    t.pts.unshift(pos.clone())
    if (t.pts.length > SEGMENTS) t.pts.length = SEGMENTS
    if (t.pts.length < 3) return

    const pa = t.mesh.geometry.attributes.position
    const ca = t.mesh.geometry.attributes.color
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    const dir = new THREE.Vector3()
    const side = new THREE.Vector3()

    for (let i = 0; i < SEGMENTS; i++) {
      const p = t.pts[Math.min(i, t.pts.length - 1)]
      const q = t.pts[Math.min(i + 1, t.pts.length - 1)]
      dir.subVectors(p, q)
      if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1)
      side.crossVectors(dir, fwd)
      // 카메라 쪽으로 곧장 날아오면 진행 방향과 시선이 나란해져 폭이 0 이 된다.
      // 그때는 위쪽을 기준으로 잡는다 — 띠가 사라지는 것보다 낫다.
      if (side.lengthSq() < 1e-6) side.crossVectors(dir, UP)
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
      side.normalize()

      const k = 1 - i / (SEGMENTS - 1)          // 머리 1 → 꼬리 0
      // 폭은 천천히 줄고 밝기는 빨리 죽는다. 선형으로 줄이면 쐐기처럼 딱딱해 보인다.
      const w = t.width * Math.pow(k, 0.55) * (t.pts.length > i ? 1 : 0)
      pa.setXYZ(i * 2, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w)
      pa.setXYZ(i * 2 + 1, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w)
      const f = Math.pow(k, 2.3) * t.opacity
      ca.setXYZ(i * 2, t.color.r * f, t.color.g * f, t.color.b * f)
      ca.setXYZ(i * 2 + 1, t.color.r * f, t.color.g * f, t.color.b * f)
    }
    pa.needsUpdate = true
    ca.needsUpdate = true
    t.mesh.visible = true
  }
}
