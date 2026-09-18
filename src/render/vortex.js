import * as THREE from 'three'

/**
 * 소용돌이.
 *
 * 고리 몇 개를 겹쳐 돌리면 '도는 고리' 로 보이지 '빨려 드는 물' 로는 안 보인다.
 * 물이 구멍으로 빨려 드는 건 **안쪽이 더 빨리 도는 것** 하나로 읽힌다 —
 * 가장자리는 느리게, 목구멍은 급하게. 고리를 여러 개 두는 대신 면 하나에
 * 각도를 반지름으로 나눠 흘려 준다.
 *
 * 그래서 이건 모델로 받아 올 수 있는 물건이 아니다. 모양이 아니라 움직임이다.
 *
 * 만드는 것 —
 *   · 깔때기 면 하나 (LatheGeometry — 옆에서 본 곡선을 돌린 것)
 *   · 그 위를 도는 물살 줄무늬와 거품 (셰이더)
 *   · 목구멍의 어둠
 */

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSpin;     // 도는 속도
  uniform float uOpen;     // 0 = 잠잠, 1 = 활짝 열림
  uniform vec3  uDeep;     // 목구멍 쪽 색
  uniform vec3  uShallow;  // 가장자리 색
  uniform vec3  uFoam;
  uniform float uFade;    // 전체 진하기
  uniform float uBase;    // 물 자체의 불투명도 (0 이면 거품 줄무늬만 보인다)
  uniform float uEdge;    // 가장자리가 녹기 시작하는 지점
  uniform float uThroatFade; // 목구멍 쪽이 녹는 폭

  #define TAU 6.28318530718

  /**
   * 각도로 도는 잡음.
   *
   * 보통 쓰는 해시 잡음은 각도 0 과 2π 에서 값이 안 맞아 **이음매**가 생긴다 —
   * 화면 한가운데 직선 하나가 세로로 그어진다. 그래서 정수 배음만 쓴다.
   * 정수 배음은 한 바퀴에 정확히 맞아떨어져서 이음매가 없다.
   */
  float wobble(float ang, float t) {
    float w = 0.0;
    w += 0.55 * sin(ang *  3.0 + uTime * 1.10 + t *  5.0);
    w += 0.30 * sin(ang *  7.0 - uTime * 0.80 + t * 11.0);
    w += 0.15 * sin(ang * 17.0 + uTime * 1.70 + t * 23.0);
    return w;
  }

  void main() {
    // vUv.x = 각도(0..1), vUv.y = 가장자리(1) → 목구멍(0)
    float t = clamp(vUv.y, 0.0, 1.0);
    float a = vUv.x * TAU;

    // 안쪽일수록 빠르게. 이 차이 하나가 '빨려 든다' 를 만든다.
    float speed = 0.55 + 2.6 * pow(1.0 - t, 1.6);
    float ang = a + uTime * uSpin * speed;

    /* 나선이 감기는 정도.
       거리에 비례해 감으면 바깥에서 동심원처럼 보인다. 실제 소용돌이의 팔은
       **로그 나선**이라 안쪽으로 갈수록 급하게 감긴다 — 그 차이가 '돌면서
       빨려 든다' 와 '고리가 돈다' 를 가른다.

       계수가 관건이다. 작으면 팔이 거의 안 휘어 바퀴살이 되고, 크면 반지름
       방향으로만 촘촘해져 도로 동심원이 된다. 팔 하나가 반지름을 가로지르며
       한 바퀴 반쯤 도는 값이 물처럼 보인다. */
    float wind = -log(max(t, 0.03)) * 16.0;

    // 굵은 팔 여섯 + 그 위의 잔결. 잔결도 같은 감김을 타야 나선이 유지된다.
    float arms = sin(ang *  6.0 + wind);
    float fine = sin(ang * 17.0 + wind - uTime * 1.3);
    float w = wobble(ang, t);

    float band = arms * 0.62 + fine * 0.20 + w * 0.40;
    float streak = smoothstep(0.18, 0.72, band);

    // 거품은 목구멍 가까이가 짙다 — 거기가 제일 빠르니까. 다만 가장자리에서
    // 0 이 되면 안 된다. 판 전체를 덮는 물살은 바깥에서도 흘러야 한다.
    float foam = streak * mix(0.50, 1.0, pow(1.0 - t, 1.8)) * mix(0.5, 1.0, uOpen);

    vec3 col = mix(uDeep, uShallow, pow(t, 0.7));
    col = mix(col, uFoam, foam * 0.8);

    // 가장자리는 바다에 녹아들고, 목구멍은 어둠으로 떨어진다
    float edge = smoothstep(1.0, uEdge, t);
    float throat = smoothstep(0.0, uThroatFade, t);
    float alpha = edge * throat * uFade *
                  clamp(uBase * mix(0.85, 1.1, uOpen) + foam * 0.55, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`

/**
 * @param o.radius  가장자리 반지름
 * @param o.depth   목구멍 깊이
 * @param o.throat  목구멍 반지름
 */
export function makeVortex({
  radius = 3.0, depth = 3.4, throat = 0.34, segments = 64,
  opacity = 1, hole = true, base = 0.45, edgeFade = 0.82, throatFade = 0.22, order = 6,
} = {}) {
  // 옆에서 본 곡선. 가장자리는 완만하고 목구멍으로 갈수록 가파르다 —
  // 실제로 물이 파이는 모양이 그렇다 (1/r 에 가깝다).
  const steps = 26
  const profile = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps                     // 0 = 목구멍, 1 = 가장자리
    const r = throat + (radius - throat) * t
    const y = -depth * Math.pow(1 - t, 2.1)
    profile.push(new THREE.Vector2(r, y))
  }

  const geo = new THREE.LatheGeometry(profile, segments)
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSpin: { value: 1.0 },
      uOpen: { value: 0.35 },
      uDeep: { value: new THREE.Color('#071a2a') },
      uShallow: { value: new THREE.Color('#2f6d96') },
      uFoam: { value: new THREE.Color('#dff1ff') },
      uFade: { value: opacity },
      uBase: { value: base },
      uEdge: { value: edgeFade },
      uThroatFade: { value: throatFade },
    },
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = order

  const group = new THREE.Group()
  group.add(mesh)

  // 목구멍의 어둠 — 바닥이 안 보여야 깊어 보인다
  let dark = null
  if (hole) {
    dark = new THREE.Mesh(
      new THREE.CircleGeometry(throat * 1.6, 24),
      new THREE.MeshBasicMaterial({ color: '#03080e', transparent: true, opacity: 0.92, depthWrite: false }),
    )
    dark.rotation.x = -Math.PI / 2
    dark.position.y = -depth + 0.02
    group.add(dark)
  }

  return {
    group, mesh, mat,
    /** @param open 0 = 잠잠(근접 가능), 1 = 빨아들이는 중 */
    update(dt, open = 0.35) {
      mat.uniforms.uTime.value += dt
      const u = mat.uniforms.uOpen
      u.value += (open - u.value) * Math.min(1, dt * 2.6)
      // 활짝 열릴수록 빨리 돈다. 크기는 건드리지 않는다 — 수면에 뚫어 둔
      // 구멍에 맞춰 놓은 물건이라 커지고 작아지면 틈으로 바닥이 보인다.
      mat.uniforms.uSpin.value = 0.7 + u.value * 1.6
    },
    dispose() { geo.dispose(); mat.dispose(); dark?.geometry.dispose(); dark?.material.dispose() },
  }
}
