import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * 다른 뼈대의 동작을 빌려 온다.
 *
 * 받아 온 보스 몸 중에는 뼈는 제대로 있는데 클립이 Idle 하나뿐인 것이 있다
 * (폴리페모스). 서 있기만 하면 언제 치는지가 몸에 없다. 그런데 오디세우스는
 * 칼 공격·조깅·죽기까지 다 가진 동작 묶음이 있다 (Quaternius, CC0).
 * 그걸 뼈 이름을 짝지어 옮겨 쓴다.
 *
 * ── 로컬 회전을 그대로 복사하지 않는 이유 ──
 * 두 뼈대는 뼈마다 로컬 축이 다르다 (한쪽은 언리얼 마네킹, 한쪽은 블렌더).
 * 같은 '팔을 드는' 회전이 로컬 값으로는 전혀 다른 숫자다. 그래서 **월드에서
 * 쉬는 자세로부터 얼마나 돌았는지**를 옮긴다:
 *
 *   받는 뼈의 월드 = (주는 뼈의 지금 월드 · 주는 뼈의 쉬는 월드⁻¹) · 받는 뼈의 쉬는 월드
 *
 * 그리고 부모의 지금 월드로 나눠 로컬로 되돌린다. 두 뼈대의 쉬는 자세가
 * 다르면(A자·T자) 그만큼 어긋나지만, 움직임의 모양은 그대로 따라간다.
 *
 * 매 프레임 계산하지 않는다. 불러올 때 30fps 로 한 번 구워 보통 클립으로 만든다.
 */

const boneMap = root => {
  const m = new Map()
  root.traverse(o => { if (o.isBone) m.set(o.name, o) })
  return m
}

/**
 * 쉬는 자세의 월드 회전.
 *
 * 노드에 저장된 자세를 쓰면 안 된다 — 폴리페모스 파일은 기본 자세가 이미
 * 웅크린 고릴라 자세라, 그 위에 'T자에서 돈 만큼' 을 얹으니 몸이 반으로
 * 접혔다. **스킨을 묶을 때의 자세(바인드 포즈)**를 쓴다. 두 모델 다 거기서는
 * 선 자세다. boneInverses 의 역행렬이 곧 그때의 뼈 월드다.
 */
const restWorld = (root, bones) => {
  const bind = new Map()
  root.traverse(o => {
    if (!o.isSkinnedMesh) return
    o.skeleton.bones.forEach((b, i) => {
      if (bind.has(b)) return
      const m = new THREE.Matrix4().copy(o.skeleton.boneInverses[i]).invert()
      m.premultiply(o.bindMatrixInverse).premultiply(o.matrixWorld)
      const q = new THREE.Quaternion()
      m.decompose(new THREE.Vector3(), q, new THREE.Vector3())
      bind.set(b, q)
    })
  })
  const out = new Map()
  for (const b of bones) out.set(b, bind.get(b) ?? b.getWorldQuaternion(new THREE.Quaternion()))
  return out
}

/** 부모부터 자식 순으로 — 부모가 먼저 자리를 잡아야 자식의 로컬을 구한다 */
const topo = (root, keep) => {
  const out = []
  root.traverse(o => { if (keep.has(o)) out.push(o) })
  return out
}

/**
 * @param dstScene  받는 몸 (gltf.scene) — 여기서 복제해 쓰므로 원본은 안 건드린다
 * @param srcScene  주는 몸 (hero-body 의 gltf.scene)
 * @param clips     주는 쪽 클립들
 * @param map       { 주는 뼈 이름: 받는 뼈 이름 }
 * @param o.hips    [주는 엉덩이, 받는 엉덩이] — 이 뼈는 위치도 옮긴다 (키 비율로)
 * @returns 받는 뼈대용 AnimationClip 배열 (이름은 원래 클립 이름)
 */
export function retargetClips(dstScene, srcScene, clips, map, { fps = 30, hips = null, feet = null } = {}) {
  const src = SkeletonUtils.clone(srcScene)
  const dst = SkeletonUtils.clone(dstScene)
  src.updateMatrixWorld(true)
  dst.updateMatrixWorld(true)
  const S = boneMap(src), D = boneMap(dst)

  // GLTFLoader 는 노드 이름의 점·공백을 지운다 ('Upperarm.L_32' → 'UpperarmL_32').
  // 표는 파일에 적힌 이름으로 쓰고 여기서 같은 규칙으로 맞춘다.
  const nm = THREE.PropertyBinding.sanitizeNodeName
  const pairs = Object.entries(map)
    .map(([s, d]) => [S.get(nm(s)), D.get(nm(d))])
    .filter(([s, d]) => s && d)
  const dstOf = new Map(pairs.map(([s, d]) => [d, s]))
  const order = topo(dst, new Set(dstOf.keys()))

  const srcRest = restWorld(src, pairs.map(p => p[0]))
  const dstRest = restWorld(dst, order)
  const dstRestLocal = new Map(order.map(b => [b, b.quaternion.clone()]))

  /* 엉덩이 높이 비율 — 걸음에서 몸이 오르내리는 폭을 다리 길이에 맞춘다.
     월드 높이끼리 나누면 안 된다. 두 파일의 원점이 달라서(한쪽은 발이 0 이
     아니다) 비율이 엉뚱하게 커지고, 쓰러지는 동작에서 폴리페모스가 땅속으로
     사라졌다. 엉덩이에서 발까지의 길이로 나눈다. */
  let hipK = 1, srcHip0 = null, dstHip0 = null, srcHip = null, dstHip = null, maxDrop = Infinity
  if (hips) {
    srcHip = S.get(nm(hips[0])); dstHip = D.get(nm(hips[1]))
    if (srcHip && dstHip) {
      srcHip0 = srcHip.getWorldPosition(new THREE.Vector3())
      dstHip0 = dstHip.getWorldPosition(new THREE.Vector3())
      const sf = feet && S.get(nm(feet[0])), df = feet && D.get(nm(feet[1]))
      if (sf && df) {
        const sLeg = srcHip0.y - sf.getWorldPosition(new THREE.Vector3()).y
        const dLeg = dstHip0.y - df.getWorldPosition(new THREE.Vector3()).y
        hipK = Math.abs(sLeg) > 1e-4 ? dLeg / sLeg : 1
        maxDrop = Math.abs(dLeg) * 0.7
      }
    }
  }

  const mixer = new THREE.AnimationMixer(src)
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qp = new THREE.Quaternion()
  const vp = new THREE.Vector3()
  const out = []

  for (const clip of clips) {
    mixer.stopAllAction()
    const act = mixer.clipAction(clip)
    act.reset().play()
    const n = Math.max(2, Math.round(clip.duration * fps) + 1)
    const times = new Float32Array(n)
    const vals = new Map(order.map(b => [b, new Float32Array(n * 4)]))
    const hipVals = dstHip ? new Float32Array(n * 3) : null

    for (let i = 0; i < n; i++) {
      const t = Math.min(clip.duration, i / fps)
      times[i] = t
      mixer.setTime(t)
      src.updateMatrixWorld(true)

      // 받는 쪽을 쉬는 자세로 되돌린 뒤 부모부터 채운다
      for (const b of order) b.quaternion.copy(dstRestLocal.get(b))
      dst.updateMatrixWorld(true)
      for (const b of order) {
        const s = dstOf.get(b)
        s.getWorldQuaternion(qa)                              // 주는 뼈 지금
        qb.copy(srcRest.get(s)).invert()                      // 주는 뼈 쉬는 자세⁻¹
        qa.multiply(qb)                                       // 쉬는 자세에서 돈 만큼 (월드)
        qa.multiply(dstRest.get(b))                           // 받는 뼈 쉬는 자세에 얹는다
        b.parent.getWorldQuaternion(qp).invert()
        b.quaternion.copy(qp.multiply(qa))                    // 로컬로
        b.updateMatrixWorld(true)
        b.quaternion.toArray(vals.get(b), i * 4)
      }
      if (hipVals) {
        // 엉덩이는 위아래만 옮긴다. 앞뒤로 나가는 건 게임이 몸을 옮기니까
        srcHip.getWorldPosition(vp)
        // 위로 튀는 건 그대로, 내려앉는 건 다리 길이의 70% 까지만 —
        // 받는 몸은 다리 비율이 달라서 끝까지 내리면 발보다 엉덩이가 먼저 땅에 박힌다
        const dy = Math.max((vp.y - srcHip0.y) * hipK, -maxDrop)
        const p = dstHip.parent.worldToLocal(dstHip0.clone().setY(dstHip0.y + dy))
        p.toArray(hipVals, i * 3)
      }
    }

    const tracks = order.map(b => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, vals.get(b)))
    if (hipVals) tracks.push(new THREE.VectorKeyframeTrack(`${dstHip.name}.position`, times, hipVals))
    out.push(new THREE.AnimationClip(clip.name, clip.duration, tracks))
  }
  mixer.stopAllAction()
  return out
}
