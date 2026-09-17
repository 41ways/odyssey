/**
 * 판의 모양.
 *
 * 전에는 어디서나 `Math.hypot(x, z) > R` 하나로 막았다. 그래서 이타카의 홀은
 * 네모로 지어 놓고도 걷다 보면 보이지 않는 둥근 벽에 막혔다 — 눈에 보이는 방과
 * 실제로 갇히는 방이 달랐고, 그 순간 "지은 곳" 이 아니라 "동그란 무대에 기둥을
 * 세워 둔 것" 이 된다.
 *
 * 그래서 모양마다 **그 방향의 반지름** 하나만 준다. 바닥도 벽도 이동 제한도
 * 스폰 자리도 소품 배치도 전부 이 함수 하나를 본다. 보이는 벽과 막히는 벽이
 * 같은 식에서 나오므로 어긋날 수가 없다.
 *
 * 각도 규약은 코드 나머지와 같다 — `a = atan2(x, z)`, 즉 a=0 이 +z 방향이고
 * `sin a` 가 x, `cos a` 가 z 다.
 */

/**
 * 직사각형. 반폭 ax(x축) · az(z축) 안에서 그 방향 반지름.
 *
 * 꼭짓점 각도를 같이 들고 다닌다. 이게 없으면 벽선을 그릴 때 어디를 밟아야
 * 모서리인지 알 수 없어서, 네 점을 45도마다 찍게 된다 — 그러면 직사각형이
 * 마름모(=정사각형)로 그려진다. 실제로 그렇게 나왔었다: 갑판의 이동 경계는
 * 17.7 × 7.9 인데 눈에 보이는 벽은 19.8 × 19.8 정사각이었다.
 */
const box = (ax, az) => ({
  r: a => {
    const sx = Math.abs(Math.sin(a)), sz = Math.abs(Math.cos(a))
    // 0 으로 나누지 않게. 축에 나란한 방향은 그 축의 반폭이 그대로 답이다.
    const rx = sx < 1e-6 ? Infinity : ax / sx
    const rz = sz < 1e-6 ? Infinity : az / sz
    return Math.min(rx, rz)
  },
  corners: [[ax, az], [ax, -az], [-ax, -az], [-ax, az]].map(([x, z]) => Math.atan2(x, z)),
})

/** 고른 굴곡. 진폭이 작은 사인 몇 개를 겹치면 손으로 그린 것처럼 울퉁불퉁해진다. */
const wobble = (...waves) => a => {
  let k = 1
  for (const [amp, freq, phase] of waves) k += amp * Math.sin(freq * a + phase)
  return k
}

/** 모양 하나를 {r, corners} 로 고른다. 함수만 준 모양은 모서리가 없다. */
const norm = v => (typeof v === 'function' ? { r: v, corners: null } : v)

/**
 * 모양별 반지름 배수 — 반환값에 R 을 곱하면 그 방향의 반지름이 된다.
 * 배수의 평균이 1 근처여야 `radius` 숫자가 판끼리 비교 가능한 채로 남는다.
 */
const SHAPES = {
  /** 둥근 판. 해안·저승처럼 사람이 짓지 않은 곳. */
  round: () => 1,

  /** 정사각 방. 사람이 지은 곳은 모서리가 있어야 한다. */
  square: box(1, 1),

  /**
   * 긴 홀. 이타카의 큰 방은 정사각형이 아니라 안쪽으로 긴 방이다 —
   * 구혼자들이 양쪽으로 늘어앉고 가운데가 트인 모양.
   */
  hall: box(0.82, 1.2),

  /** 배 갑판. 좁고 길다. 옆으로 피할 데가 없어야 갑판 위 싸움이 된다. */
  deck: box(0.6, 1.3),

  /**
   * 뱃전을 옆에서 본 갑판. 가로로 길고 앞뒤로 얕다.
   *
   * 스킬라는 갑판 위를 걸어 다니는 것이 아니라 **뱃전에 매달려** 친다.
   * 그러려면 배가 화면 가로로 누워 있어야 한다 — 그래야 먼 쪽 난간이
   * 화면 위를 가로지르는 한 줄이 되고, 거기 머리들이 죽 늘어선다.
   */
  // 가로:세로 = 대략 1.6:1. 더 납작하게 만들면 카메라가 갑판 앞뒤를
  // 넘겨다봐서 화면 아래가 통째로 허공이 된다.
  deckWide: box(1.3, 0.8),

  /** 동굴. 벽이 들고 나서 구석이 생긴다 — 숨을 데가 있어야 동굴이다. */
  cave: wobble([0.14, 3, 0.7], [0.085, 5, 2.1], [-0.055, 7, 4.3]),

  /** 숲. 동굴만큼 각지지는 않게, 그러나 완전한 원도 아니게. */
  grove: wobble([0.075, 4, 1.3], [0.045, 6, 3.4]),

  /**
   * 절벽 항구. 한쪽은 바다로 열리고 반대쪽은 바위로 막힌 좁은 만.
   * 앞뒤가 다른 모양이라 어느 쪽이 '바다' 인지가 서 있기만 해도 읽힌다.
   */
  cove: a => 1 + 0.2 * Math.cos(a) + 0.07 * Math.sin(3 * a + 1.1),
}

export const SHAPE_NAMES = Object.keys(SHAPES)

/**
 * 경계 하나.
 *
 * @param shape SHAPES 의 이름. 모르는 이름이면 조용히 둥글게 간다 —
 *              오타 하나로 판이 안 열리는 것보다는 낫다.
 * @param R     기준 반지름. 모양 배수를 여기에 곱한다.
 */
export function makeArena(shape = 'round', R = 16) {
  const def = norm(SHAPES[shape] ?? SHAPES.round)
  const f = def.r
  const known = !!SHAPES[shape]

  return {
    shape: known ? shape : 'round',
    R,
    /** 이 방향으로 중심에서 벽까지. */
    radiusAt(a) { return R * f(a) },

    /** (x, z) 가 안쪽인가. inset 만큼 여유를 두고 본다. */
    contains(x, z, inset = 0) {
      const d = Math.hypot(x, z)
      return d <= this.radiusAt(Math.atan2(x, z)) - inset
    },

    /**
     * 밖이면 가장 가까운 안쪽으로 당긴다. 당겼으면 true.
     * 같은 방향을 유지한 채 길이만 줄인다 — 벽에 붙어 미끄러지는 느낌이 난다.
     */
    clamp(pos, inset = 0) {
      const d = Math.hypot(pos.x, pos.z)
      if (d < 1e-6) return false
      const lim = Math.max(0.5, this.radiusAt(Math.atan2(pos.x, pos.z)) - inset)
      if (d <= lim) return false
      const k = lim / d
      pos.x *= k; pos.z *= k
      return true
    },

    /** 그 방향 가장자리의 한 점. 적이 들어오는 자리. */
    edge(a, inset = 0) {
      const r = Math.max(0.5, this.radiusAt(a) - inset)
      return { x: Math.sin(a) * r, z: Math.cos(a) * r }
    },

    /**
     * 벽선을 이루는 점들. 바닥과 벽 메시가 이걸 그대로 쓴다 —
     * 보이는 벽과 막히는 벽이 같은 식에서 나와야 어긋나지 않는다.
     * 모서리가 있는 모양은 꼭짓점을 정확히 밟도록 표본을 맞춘다.
     */
    outline(segments = 128) {
      // 모서리가 있는 모양은 꼭짓점을 정확히 밟는다. 고르게 표본하면
      // 모서리가 잘려서 직사각형이 마름모가 된다.
      const angles = def.corners
        ? def.corners.slice()
        : Array.from({ length: segments }, (_, i) => (i / segments) * Math.PI * 2)
      return angles.map(a => {
        const r = this.radiusAt(a)
        return { x: Math.sin(a) * r, z: Math.cos(a) * r, a }
      })
    },

    /** 가장 먼 벽까지. 그림자 카메라와 투사체 정리 범위가 쓴다. */
    maxRadius() {
      let m = 0
      for (let i = 0; i < 64; i++) m = Math.max(m, this.radiusAt((i / 64) * Math.PI * 2))
      return m
    },
  }
}
