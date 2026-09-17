import { dist2d } from '../core/math.js'

/**
 * 전투 판정은 전부 XZ 평면에서 본다. 바닥이 평평한 투기장이라
 * 물리엔진 없이 원-원, 원-부채꼴 거리 계산으로 충분하다.
 */

/** 부채꼴 판정. 칼질, 보스 후려치기 전부 이걸 쓴다. */
export function sectorHit(origin, facing, range, halfAngle, target) {
  const dx = target.pos.x - origin.x
  const dz = target.pos.z - origin.z
  const d = Math.hypot(dx, dz)
  if (d > range + target.radius) return false
  if (d < 1e-4) return true
  // 대상의 몸 반지름만큼 각도 여유를 준다. 안 그러면 코앞의 적을 흘린다.
  const slack = Math.atan2(target.radius, Math.max(d, 0.001))
  const a = Math.atan2(dx, dz)
  let diff = Math.abs(a - facing) % (Math.PI * 2)
  if (diff > Math.PI) diff = Math.PI * 2 - diff
  return diff <= halfAngle + slack
}

export function circleHit(x, z, radius, target) {
  return dist2d({ x, z }, target.pos) <= radius + target.radius
}

/** 도넛 판정. 근접하면 안 맞는 장판에 쓴다. */
export function ringHit(x, z, inner, outer, target) {
  const d = dist2d({ x, z }, target.pos)
  return d <= outer + target.radius && d >= inner - target.radius
}
