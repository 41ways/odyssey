export const TAU = Math.PI * 2

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v
export const lerp = (a, b, t) => a + (b - a) * t
export const rand = (a, b) => a + Math.random() * (b - a)

/** 감쇠 보간. 프레임레이트에 독립적이다. half = 절반까지 가는 데 걸리는 초. */
export const damp = (a, b, half, dt) => lerp(a, b, 1 - Math.pow(2, -dt / half))

/** yaw 규약: 방향벡터 = (sin f, 0, cos f). three 메시의 rotation.y 와 같다. */
export const yawOf = (dx, dz) => Math.atan2(dx, dz)

/** 두 각의 최단 차이를 -PI..PI 로. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

export function dampAngle(a, b, half, dt) {
  return a + angleDelta(a, b) * (1 - Math.pow(2, -dt / half))
}

/** XZ 평면 거리. y 는 무시한다 — 전투는 전부 평면에서 일어난다. */
export function dist2d(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z
  return Math.hypot(dx, dz)
}
