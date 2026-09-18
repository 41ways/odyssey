import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'

/**
 * 파도치는 바다.
 *
 * three.js 기본 Water 는 **평면**이다 — 물결 무늬(노멀맵)는 흐르는데 수면이
 * 솟지 않는다. 배를 띄워 항해하려면 배가 물결을 타고 오르내려야 하므로
 * 정점을 움직이는 파도를 얹는다.
 *
 * 거스트너 파도(Gerstner, GPU Gems 1장)를 몇 겹 겹친다. 사인파와 다른 점은
 * 정점이 위아래만이 아니라 **앞뒤로도** 움직여서 마루는 뾰족하게 모이고 골은
 * 넓게 퍼진다 — 진짜 바다의 윤곽이 그렇다.
 *
 * 같은 식을 자바스크립트(waveAt)에도 둔다. 배는 매 프레임 자기 자리의 수면
 * 높이와 기울기를 물어서 그만큼 오르내리고 기운다. 셰이더와 식이 한 글자라도
 * 다르면 배가 물에 잠기거나 뜬다 — 그래서 파도 표(WAVES)는 한 군데에만 둔다.
 */

/**
 * 파도 한 겹: 방향, 파장(m), 가파름(0~1, 합이 1 을 넘으면 마루가 뒤집힌다).
 * 속도는 파장에서 나온다 (깊은 물의 분산식 c = √(g/k)) — 긴 파도가 빠르다.
 */
export const SEAS = {
  // 잔잔한 바다 — 순풍
  calm: [
    { dir: [1, 0.2], len: 34, steep: 0.14 },
    { dir: [0.6, 1], len: 17, steep: 0.12 },
    { dir: [-0.4, 1], len: 9, steep: 0.1 },
    { dir: [1, -0.7], len: 5.5, steep: 0.08 },
  ],
  // 거친 바다 — 포세이돈이 노했을 때
  rough: [
    { dir: [1, 0.3], len: 46, steep: 0.24 },
    { dir: [0.7, 1], len: 23, steep: 0.2 },
    { dir: [-0.5, 1], len: 12, steep: 0.16 },
    { dir: [1, -0.6], len: 6.5, steep: 0.12 },
  ],
}

const G = 9.8
const prep = waves => waves.map(w => {
  const l = Math.hypot(w.dir[0], w.dir[1]) || 1
  const k = (2 * Math.PI) / w.len
  return { dx: w.dir[0] / l, dz: w.dir[1] / l, k, c: Math.sqrt(G / k), a: w.steep / k, steep: w.steep }
})

/**
 * 한 점의 수면 — 높이와 법선. (x,z) 는 **움직이기 전의** 자리를 기준으로 하지만
 * 배처럼 작은 물체에는 이 근사로 충분하다 (가로 밀림이 파장의 몇 %).
 */
export function waveAt(waves, x, z, t, out = { y: 0, n: new THREE.Vector3() }) {
  let y = 0
  let tx = 1, ty = 0, tz = 0          // 접선
  let bx = 0, by = 0, bz = 1          // 종접선
  for (const w of waves) {
    const f = w.k * (w.dx * x + w.dz * z - w.c * t)
    const s = Math.sin(f), c = Math.cos(f)
    y += w.a * s
    tx -= w.dx * w.dx * w.steep * s; ty += w.dx * w.steep * c; tz -= w.dx * w.dz * w.steep * s
    bx -= w.dx * w.dz * w.steep * s; by += w.dz * w.steep * c; bz -= w.dz * w.dz * w.steep * s
  }
  // 법선 = 종접선 × 접선
  out.n.set(by * tz - bz * ty, bz * tx - bx * tz, bx * ty - by * tx).normalize()
  out.y = y
  return out
}

/** 셰이더용 파도 식 — 표를 상수로 굽는다 */
const glslWaves = waves => {
  const lines = waves.map(w =>
    `wave(p, vec2(${w.dx.toFixed(4)}, ${w.dz.toFixed(4)}), ${w.k.toFixed(5)}, ${w.c.toFixed(4)}, ${w.a.toFixed(5)}, ${w.steep.toFixed(4)}, t, d, T, B);`)
  return `
    void wave(vec2 p, vec2 D, float k, float c, float a, float st, float t, inout vec3 d, inout vec3 T, inout vec3 B) {
      float f = k * (dot(D, p) - c * t);
      float s = sin(f), co = cos(f);
      d += vec3(D.x * a * co, a * s, D.y * a * co);
      T += vec3(-D.x * D.x * st * s, D.x * st * co, -D.x * D.y * st * s);
      B += vec3(-D.x * D.y * st * s, D.y * st * co, -D.y * D.y * st * s);
    }
    vec3 gerstner(vec2 p, float t, out vec3 N) {
      vec3 d = vec3(0.0), T = vec3(1.0, 0.0, 0.0), B = vec3(0.0, 0.0, 1.0);
      ${lines.join('\n      ')}
      N = normalize(cross(B, T));
      return d;
    }`
}

/**
 * @param o.size     바다 한 변 (m)
 * @param o.seg      한 변의 칸 수 — 파장(짧은 것 5.5m)보다 칸이 충분히 잘아야 물결이 선다
 * @param o.sea      SEAS 의 이름
 * @param o.sun      해 방향
 */
export function makeOcean({
  size = 420, seg = 256, sea = 'calm', sun = new THREE.Vector3(0.4, 0.6, -0.7).normalize(),
  waterColor = '#0e2a3a', sunColor = '#fff1d6', distortion = 2.6, textures = '/textures/waternormals.webp',
} = {}) {
  const waves = prep(SEAS[sea] ?? SEAS.calm)
  const normals = new THREE.TextureLoader().load(textures, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping })
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  const water = new Water(geo, {
    textureWidth: 512, textureHeight: 512,
    waterNormals: normals,
    sunDirection: sun.clone(),
    sunColor: new THREE.Color(sunColor),
    waterColor: new THREE.Color(waterColor),
    distortionScale: distortion,
    fog: true,
  })
  water.rotation.x = -Math.PI / 2

  const m = water.material
  // 정점: 월드 자리에서 파도만큼 옮긴다. 반사 좌표도 옮긴 자리에서 구한다
  m.vertexShader = m.vertexShader
    .replace('varying vec4 worldPosition;', `varying vec4 worldPosition;
      varying vec3 vWaveN;
      varying float vCrest;
      ${glslWaves(waves)}`)
    .replace(/mirrorCoord = modelMatrix \* vec4\( position, 1\.0 \);[\s\S]*?gl_Position = projectionMatrix \* mvPosition;/, `
      vec4 wp = modelMatrix * vec4( position, 1.0 );
      vec3 N;
      vec3 disp = gerstner(wp.xz, time, N);
      wp.xyz += disp;
      vWaveN = N;
      vCrest = disp.y;
      worldPosition = wp;
      mirrorCoord = textureMatrix * wp;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;`)
  // 조각: 파도 법선을 잔물결 법선에 섞고, 마루에 거품을 얹는다
  m.fragmentShader = m.fragmentShader
    .replace('varying vec4 worldPosition;', `varying vec4 worldPosition;
      varying vec3 vWaveN;
      varying float vCrest;
      uniform float crestHeight;`)
    .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
      `vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) + vec3( vWaveN.x, 0.0, vWaveN.z ) * 4.0 );`)
    .replace('vec3 outgoingLight = albedo;', `vec3 outgoingLight = albedo;
      // 마루 거품 — 파도가 가장 높이 솟은 자리만 하얗게, 잔물결로 부순다
      float foam = smoothstep(crestHeight * 0.55, crestHeight, vCrest) * smoothstep(0.35, 0.75, noise.y * 0.5 + 0.5);
      outgoingLight = mix(outgoingLight, vec3(0.85, 0.9, 0.92), foam * 0.6);`)
  const crest = waves.reduce((s, w) => s + w.a, 0)
  m.uniforms.crestHeight = { value: crest }
  m.needsUpdate = true

  const sample = { y: 0, n: new THREE.Vector3() }
  return {
    mesh: water,
    waves,
    /** @param dt 초 */
    update(dt) { m.uniforms.time.value += dt },
    get time() { return m.uniforms.time.value },
    /** 한 점의 수면 높이와 법선 (배가 쓴다) */
    at(x, z) { return waveAt(waves, x, z, m.uniforms.time.value, sample) },
  }
}
