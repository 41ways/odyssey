import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * 뼈 없는 모델에 오디세우스의 뼈대를 입힌다.
 *
 * 안티파테스(오우거)는 멋있는 정적 조각이다. 뼈가 없어서 몸통째 흔드는 것
 * 말고는 움직일 수가 없었다. Mixamo 자동 리깅은 세 번 다 서버에서 떨어졌다
 * (갑옷·가시가 따로 떨어진 껍데기라 그런 걸로 본다). 그래서 직접 묶는다.
 *
 * ── 원리 ──
 * 1) 영웅 뼈대를 복제해서, 마디마다 **오우거의 관절 자리로 돌리고 늘린다.**
 *    영웅은 T자로 서 있고 오우거는 A자로 서 있다. 뼈 하나하나를 "영웅에서
 *    다음 관절로 가던 방향 → 오우거에서 다음 관절로 가는 방향" 만큼 월드에서
 *    돌린다(q). 이 자세가 바인드 포즈다 — 메시가 생긴 그대로의 자세.
 * 2) 그렇게 만들면 각 뼈의 **로컬 좌표에서 자식으로 가는 방향이 영웅과 같다.**
 *    (부모도 같은 q 만큼 돌아 있어서 서로 상쇄된다.) 그래서 영웅의 동작 클립
 *    회전값을 **그대로** 틀면 오우거의 팔다리가 영웅이 가리키는 쪽을 가리킨다.
 *    리타깃이 필요 없다. 위치 트랙만 걷어낸다 — 그건 영웅의 뼈 길이다.
 * 3) 정점은 가장 가까운 뼈 마디 셋에 거리의 네제곱 역수로 묶는다. 갑옷판은
 *    어차피 단단해서 가까운 뼈 하나를 따라가는 게 맞다.
 *
 * 관절 자리는 손으로 적는다 (정면에서 잰 비율 — models.js 의 autoskin).
 */

/** 무게를 나눠 가질 뼈. 손가락·꼬임 뼈는 뺀다 — 괜히 끼면 살이 찢어진다 */
const BODY = [
  'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l',
  'thigh_r', 'calf_r', 'foot_r', 'ball_r',
]
/** 뼈마다 '다음 관절' — 이 방향이 오우거의 몸을 따라가게 돌린다 */
const NEXT = {
  pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head',
  clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l',
  clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r',
  thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l',
  thigh_r: 'calf_r', calf_r: 'foot_r', foot_r: 'ball_r',
}

const bindWorld = skinned => {
  const out = new Map()
  skinned.skeleton.bones.forEach((b, i) => {
    const m = new THREE.Matrix4().copy(skinned.skeleton.boneInverses[i]).invert()
      .premultiply(skinned.bindMatrixInverse).premultiply(skinned.matrixWorld)
    out.set(b.name, m)
  })
  return out
}

/** 점과 선분 사이 거리 */
const segDist = (p, a, b) => {
  const ab = _ab.subVectors(b, a), ap = _ap.subVectors(p, a)
  const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(ab.lengthSq(), 1e-9)))
  return _q.copy(a).addScaledVector(ab, t).distanceTo(p)
}
const _ab = new THREE.Vector3(), _ap = new THREE.Vector3(), _q = new THREE.Vector3()

/**
 * @param src       정적 모델 (gltf.scene) — 메시 하나
 * @param hero      영웅 gltf.scene (뼈대 + 스킨)
 * @param clips     영웅 동작 클립들
 * @param marks     { 뼈 이름: [x,y,z] } — 오우거 관절 자리 (src 좌표)
 * @param keepClips 쓸 클립 이름들
 * @returns { scene, animations }
 */
export function autoSkin(src, hero, clips, marks, keepClips) {
  src.updateMatrixWorld(true)
  let mesh = null
  src.traverse(o => { if (o.isMesh && !mesh) mesh = o })
  if (!mesh) throw new Error('메시가 없다')
  const geo = mesh.geometry.clone()
  geo.applyMatrix4(mesh.matrixWorld)

  // 영웅 뼈대 한 벌 — 메시는 버리고 뼈만 쓴다
  const hc = SkeletonUtils.clone(hero)
  hc.updateMatrixWorld(true)
  let hs = null
  hc.traverse(o => { if (o.isSkinnedMesh && !hs) hs = o })
  const heroW = bindWorld(hs)
  const bones = hs.skeleton.bones
  const heroLocal = new Map(bones.map(b => [b.name, b.position.clone()]))
  const byName = new Map(bones.map(b => [b.name, b]))
  const rootBone = bones.find(b => !b.parent?.isBone)

  // 영웅 바인드의 관절 자리·회전
  const hp = new Map(), hq = new Map()
  for (const [n, m] of heroW) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion()
    m.decompose(p, q, new THREE.Vector3())
    hp.set(n, p); hq.set(n, q)
  }

  // 키 비율 — 표에 없는 뼈(손가락·발끝)는 이 배율로 늘린다
  const k = (marks.Head[1] - marks.foot_l[1]) / (hp.get('Head').y - hp.get('foot_l').y)

  /* 부모부터 한 번에 — 월드 자리(P), 돌림(Q), 월드 행렬(W).
     돌림 Q 는 "영웅의 바인드 회전에 얹는 월드 회전" 이다.
     · 다음 관절이 표에 있으면: 영웅에서 그 관절로 가던 방향 → 오우거에서 가는 방향
     · 없으면: 부모의 돌림을 그대로 (손은 팔뚝을, 손가락은 손을 따라간다)
     자리는 표에 있으면 표대로, 없으면 부모의 돌림으로 영웅 오프셋을 돌려 늘린다.
     그래야 뼈마다 '로컬에서 자식으로 가는 방향' 이 영웅과 같다 — 클립을 그대로 쓰는 조건. */
  const P = new Map(), W = new Map(), Q = new Map()
  const order = []
  rootBone.traverse(o => { if (o.isBone) order.push(o) })
  for (const b of order) {
    const n = b.name, par = b.parent?.isBone ? b.parent.name : null
    const qp = par ? Q.get(par) : new THREE.Quaternion()
    if (marks[n]) P.set(n, new THREE.Vector3().fromArray(marks[n]))
    else if (par) P.set(n, hp.get(n).clone().sub(hp.get(par)).multiplyScalar(k).applyQuaternion(qp).add(P.get(par)))
    else P.set(n, hp.get(n).clone().multiplyScalar(k))
    const c = NEXT[n]
    if (c && marks[c]) {
      const hd = hp.get(c).clone().sub(hp.get(n)).normalize()
      const td = new THREE.Vector3().fromArray(marks[c]).sub(P.get(n)).normalize()
      Q.set(n, new THREE.Quaternion().setFromUnitVectors(hd, td))
    } else Q.set(n, qp.clone())
    W.set(n, new THREE.Matrix4().compose(P.get(n), Q.get(n).clone().multiply(hq.get(n)), new THREE.Vector3(1, 1, 1)))
  }

  // 월드 → 로컬. 뼈대를 바인드 포즈로 세운다
  rootBone.removeFromParent()
  for (const b of order) {
    const wm = W.get(b.name)
    const local = b.parent?.isBone ? W.get(b.parent.name).clone().invert().multiply(wm) : wm.clone()
    local.decompose(b.position, b.quaternion, b.scale)
  }
  rootBone.updateMatrixWorld(true)
  const inverses = bones.map(b => b.matrixWorld.clone().invert())
  const skeleton = new THREE.Skeleton(bones, inverses)

  // 살 붙이기 — 가까운 뼈 마디 셋
  const segs = BODY.filter(n => byName.has(n)).map(n => {
    const a = P.get(n)
    const c = NEXT[n]
    let e = c ? P.get(c) : null
    if (!e) {                      // 끝 뼈: 머리는 위로, 손·발끝은 부모 방향으로 조금
      const par = byName.get(n).parent?.name
      const dir = par ? a.clone().sub(P.get(par)).normalize() : new THREE.Vector3(0, 1, 0)
      e = a.clone().addScaledVector(n === 'Head' ? new THREE.Vector3(0, 1, 0) : dir, (n === 'Head' ? 0.35 : 0.15) * k)
    }
    return { i: bones.indexOf(byName.get(n)), a, e }
  })
  const pos = geo.attributes.position
  const si = new Uint16Array(pos.count * 4), sw = new Float32Array(pos.count * 4)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const ds = segs.map(s => ({ i: s.i, d: segDist(v, s.a, s.e) })).sort((x, y) => x.d - y.d).slice(0, 3)
    const ws = ds.map(x => 1 / (Math.pow(x.d, 4) + 1e-6))
    const sum = ws.reduce((a, b) => a + b, 0)
    ds.forEach((x, j) => { si[i * 4 + j] = x.i; sw[i * 4 + j] = ws[j] / sum })
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))

  const skinned = new THREE.SkinnedMesh(geo, mesh.material)
  skinned.name = mesh.name || 'body'
  const scene = new THREE.Group()
  scene.add(rootBone)
  scene.add(skinned)
  scene.updateMatrixWorld(true)
  skinned.bind(skeleton, new THREE.Matrix4())

  /* 클립 — 회전만 쓴다. 위치 트랙은 영웅의 뼈 길이라 걷어낸다.
     엉덩이만 위아래 움직임을 키 비율로 옮긴다 (걸음의 오르내림·주저앉기). */
  const pelvis = byName.get('pelvis')
  const hPel = heroLocal.get('pelvis')
  const rest = pelvis.position.clone()
  const animations = clips.filter(c => keepClips.includes(c.name)).map(c => {
    const tracks = []
    for (const t of c.tracks) {
      if (t.name.endsWith('.quaternion')) { tracks.push(t.clone()); continue }
      if (t.name === `${pelvis.name}.position`) {
        const vals = t.values.slice()
        for (let j = 0; j < vals.length; j += 3) {
          vals[j] = rest.x + (vals[j] - hPel.x) * k
          vals[j + 1] = rest.y + (vals[j + 1] - hPel.y) * k
          vals[j + 2] = rest.z + (vals[j + 2] - hPel.z) * k
        }
        tracks.push(new THREE.VectorKeyframeTrack(t.name, t.times, vals))
      }
    }
    return new THREE.AnimationClip(c.name, c.duration, tracks)
  })
  return { scene, animations }
}
