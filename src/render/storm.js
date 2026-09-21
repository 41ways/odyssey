import * as THREE from 'three'

/**
 * 폭풍 — 먹구름, 비, 돌풍, 번개.
 *
 * 바다만 거칠어서는 폭풍이 안 된다. 『오디세이아』의 바다는 늘 **하늘이 먼저**
 * 무너진다 — "구름이 바다와 땅을 한꺼번에 덮었고 하늘에서 밤이 내려왔다."
 * 그래서 네 겹으로 만든다:
 *
 *   1. **먹구름** — 머리 위를 덮고 흐르는 낮은 구름장. 하늘이 열려 있으면
 *      아무리 파도를 키워도 '바람 부는 맑은 날' 이다.
 *   2. **비** — 선(線)으로 긋는다. 점으로 뿌리면 눈이 오고, 선으로 그어야
 *      비가 온다. 바람에 기울고, 배를 따라다니며 같은 통 안에서 돈다.
 *   3. **돌풍** — 몇 초에 한 번 바람이 세지고 비가 눕는다. 계속 같은 세기면
 *      배경이 되고, 오르내려야 날씨가 된다.
 *   4. **번개** — 가끔 하늘 전체가 한 번 하얘지고 몇 초 뒤 천둥이 온다.
 *      빛과 소리 사이의 틈이 거리를 만든다.
 */

const RAIN_R = 34          // 배 둘레 이만큼만 뿌린다. 화면 밖의 비는 그리지 않는다
const RAIN_H = 26

export function makeStorm({ drops = 2600, color = '#9fb6c8' } = {}) {
  const group = new THREE.Group()

  /* ── 먹구름 ──────────────────────────────────────────────
     하늘 상자 대신 머리 위 한 장. 잡음 두 겹이 서로 다른 속도로 흘러서
     구름장이 뭉쳤다 흩어진다. 가장자리는 안개로 녹인다. */
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uFlash: { value: 0 },
      uDark: { value: new THREE.Color('#10151c') }, uLight: { value: new THREE.Color('#5d6b7a') },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vW;
      uniform float uTime; uniform float uFlash; uniform vec3 uDark; uniform vec3 uLight;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.07; a*=.5; } return v; }
      void main(){
        vec2 p = vW.xz * 0.012;
        float c = fbm(p + vec2(uTime * 0.035, uTime * 0.012))
                * 0.65 + fbm(p * 2.6 - vec2(uTime * 0.06, 0.0)) * 0.35;
        // 가운데는 두껍고 가장자리로 갈수록 성기게 — 판의 네 변이 안 보이게
        float edge = smoothstep(0.5, 0.18, length(vUv - 0.5));
        vec3 col = mix(uDark, uLight, smoothstep(0.35, 0.8, c));
        col += uFlash * vec3(0.9, 0.95, 1.0) * smoothstep(0.2, 0.9, c);
        gl_FragColor = vec4(col, smoothstep(0.15, 0.55, c) * edge * 0.95);
      }`,
  })
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), cloudMat)
  clouds.rotation.x = Math.PI / 2      // 아래에서 올려다본다
  clouds.position.y = 58
  clouds.renderOrder = -1
  group.add(clouds)

  /* ── 비 ──────────────────────────────────────────────────
     빗줄기 하나가 선분 하나다. 위치는 배 둘레의 통 안에서 돌고, 길이와
     기울기는 바람이 정한다 (update 에서 매 프레임 다시 긋는다). */
  const pos = new Float32Array(drops * 6)
  const seed = new Float32Array(drops * 3)      // x,z 자리와 낙하 속도
  for (let i = 0; i < drops; i++) {
    seed[i * 3] = (Math.random() - 0.5) * RAIN_R * 2
    seed[i * 3 + 1] = Math.random() * RAIN_H
    seed[i * 3 + 2] = (Math.random() - 0.5) * RAIN_R * 2
  }
  const speeds = Float32Array.from({ length: drops }, () => 28 + Math.random() * 22)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.5, depthWrite: false,
  }))
  rain.frustumCulled = false
  group.add(rain)

  /* ── 번개 ────────────────────────────────────────────────
     번쩍이는 방향광 하나. 그림자는 안 만든다 — 한 프레임 쓰고 꺼질 빛이다. */
  const bolt = new THREE.DirectionalLight('#dfe9ff', 0)
  bolt.position.set(30, 80, -40)
  group.add(bolt)

  const state = {
    wind: new THREE.Vector2(1, 0.25).normalize(),
    gust: 1, gustT: 0,
    flash: 0, nextBolt: 6 + Math.random() * 10, thunder: -1,
    t: 0,
  }

  return {
    group, rain, clouds,
    state,
    /**
     * @param focus   배 자리 — 비는 여기를 따라다닌다
     * @param onThunder 천둥이 칠 때 (소리)
     */
    update(dt, focus, onThunder) {
      state.t += dt
      // 돌풍 — 몇 초에 한 번 세졌다 잦아든다
      state.gustT -= dt
      if (state.gustT <= 0) {
        state.gustT = 3 + Math.random() * 5
        state._want = 0.7 + Math.random() * 1.5
      }
      state.gust += ((state._want ?? 1) - state.gust) * Math.min(1, dt * 0.8)

      // 번개
      state.flash = Math.max(0, state.flash - dt * 6)
      state.nextBolt -= dt
      if (state.nextBolt <= 0) {
        state.nextBolt = 7 + Math.random() * 14
        state.flash = 1
        state.thunder = 0.4 + Math.random() * 2.2     // 빛과 소리 사이 — 거리가 된다
      }
      if (state.thunder >= 0) {
        state.thunder -= dt
        if (state.thunder < 0) onThunder?.()
      }
      bolt.intensity = state.flash * 9
      cloudMat.uniforms.uTime.value += dt * state.gust
      cloudMat.uniforms.uFlash.value = state.flash * 0.8

      // 비 — 통 안에서 돌린다. 바람이 세면 더 눕는다
      const wx = state.wind.x * 13 * state.gust, wz = state.wind.y * 13 * state.gust
      const fx = focus?.x ?? 0, fz = focus?.z ?? 0
      const len = 0.9 + state.gust * 0.5
      for (let i = 0; i < drops; i++) {
        const j = i * 3
        seed[j + 1] -= speeds[i] * dt
        seed[j] += wx * dt
        seed[j + 2] += wz * dt
        if (seed[j + 1] < 0) {
          seed[j + 1] += RAIN_H
          seed[j] = (Math.random() - 0.5) * RAIN_R * 2
          seed[j + 2] = (Math.random() - 0.5) * RAIN_R * 2
        }
        // 배를 따라다니게 — 통 밖으로 나가면 반대편에서 다시 들어온다
        let x = seed[j], z = seed[j + 2]
        if (x > RAIN_R) seed[j] = x -= RAIN_R * 2
        if (x < -RAIN_R) seed[j] = x += RAIN_R * 2
        if (z > RAIN_R) seed[j + 2] = z -= RAIN_R * 2
        if (z < -RAIN_R) seed[j + 2] = z += RAIN_R * 2
        const y = seed[j + 1], k = i * 6
        pos[k] = fx + x; pos[k + 1] = y; pos[k + 2] = fz + z
        pos[k + 3] = fx + x - wx * len * 0.06
        pos[k + 4] = y + speeds[i] * len * 0.045
        pos[k + 5] = fz + z - wz * len * 0.06
      }
      geo.attributes.position.needsUpdate = true
      rain.material.opacity = 0.34 + state.gust * 0.16
    },
    dispose() {
      geo.dispose(); rain.material.dispose()
      clouds.geometry.dispose(); cloudMat.dispose()
    },
  }
}
