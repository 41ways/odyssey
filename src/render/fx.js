import * as THREE from 'three'
import { clamp } from '../core/math.js'

/* ── 바닥 예고 장판 ──────────────────────────────────────────────
   로스트아크식 가독성의 전부. 부채꼴/원을 바닥에 크게 깔고
   시전 시간 동안 안에서 바깥으로 차오르게 한다.
   판정이 뜨기 전에 "여기 맞는다"가 눈으로 읽혀야 회피가 성립한다. */
const TELEGRAPH_VERT = `
varying vec2 vP;
void main() {
  vP = (uv - 0.5) * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const TELEGRAPH_FRAG = `
varying vec2 vP;
uniform float uHalfAngle;   // 라디안. PI 면 온전한 원
uniform float uProgress;    // 0..1 차오름
uniform float uInner;       // 도넛 안쪽 반지름 비율
uniform float uAlpha;
uniform vec3  uColor;
void main() {
  float r = length(vP);
  if (r > 1.0 || r < uInner) discard;
  // 평면을 -90도로 눕히면 로컬 -Y 가 월드 +Z 가 된다. facing 0 이 곧 여기다.
  float a = abs(atan(vP.x, -vP.y));
  if (a > uHalfAngle) discard;

  float rn = (r - uInner) / max(1.0 - uInner, 1e-3);
  float band = min(0.055, uHalfAngle * 0.3);   // 좁은 부채꼴에서도 테두리가 안 뭉개지게

  // 테두리: 바깥 호 + 양 옆 날
  float rim = max(smoothstep(0.93, 1.0, rn),
                  uHalfAngle > 3.1 ? 0.0 : smoothstep(uHalfAngle - band, uHalfAngle, a));
  // 차오름: 안에서 바깥으로. 선단에 밝은 띠를 둔다
  float filled = step(rn, uProgress);
  float head = smoothstep(uProgress - 0.07, uProgress, rn) * filled;

  float alpha = 0.13 + filled * 0.20 + rim * 0.50 + head * 0.34;
  vec3  col   = uColor * (0.5 + filled * 0.3 + rim * 0.85 + head * 1.0);
  gl_FragColor = vec4(col, min(alpha, 0.62) * uAlpha);
}`

export class Telegraph {
  constructor(scene) {
    this.scene = scene
    this.pool = []
    this.live = []
  }
  #take() {
    const m = this.pool.pop()
    if (m) return m
    const mat = new THREE.ShaderMaterial({
      vertexShader: TELEGRAPH_VERT, fragmentShader: TELEGRAPH_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uHalfAngle: { value: Math.PI }, uProgress: { value: 0 },
        uInner: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: new THREE.Color('#ff3a2e') },
      },
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = 2
    return mesh
  }
  /** opts: { x, z, facing, range, halfAngle, inner, duration, color } */
  show(opts) {
    const mesh = this.#take()
    const u = mesh.material.uniforms
    u.uHalfAngle.value = opts.halfAngle ?? Math.PI
    u.uInner.value = (opts.inner ?? 0) / (opts.range || 1)
    u.uProgress.value = 0
    u.uAlpha.value = 1
    u.uColor.value.set(opts.color ?? '#ff3a2e')
    mesh.scale.setScalar(opts.range)
    mesh.position.set(opts.x, 0.03, opts.z)
    mesh.rotation.z = opts.facing ?? 0   // 평면을 눕혔으니 로컬 z 회전이 월드 yaw 가 된다
    mesh.visible = true
    this.scene.add(mesh)
    const rec = { mesh, t: 0, dur: opts.duration, fade: 0 }
    this.live.push(rec)
    return rec
  }
  /** 시전이 끊겼을 때. 장판이 그냥 사라지면 뭐가 일어난 건지 안 읽힌다. */
  cancel(rec) { if (rec && rec.fade === 0) rec.fade = 0.12 }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const r = this.live[i]
      r.t += dt
      const u = r.mesh.material.uniforms
      if (r.fade > 0) {
        r.fade -= dt
        u.uAlpha.value = clamp(r.fade / 0.12, 0, 1)
        if (r.fade <= 0) this.#free(i, r)
        continue
      }
      u.uProgress.value = clamp(r.t / r.dur, 0, 1)
      if (r.t >= r.dur) { r.fade = 0.12 }
    }
  }
  #free(i, r) {
    this.live.splice(i, 1)
    this.scene.remove(r.mesh)
    this.pool.push(r.mesh)
  }
}

/* ── 타격 연출 ───────────────────────────────────────────────── */

export class Fx {
  constructor(world, uiRoot) {
    this.world = world
    this.ui = uiRoot
    this.scene = world.scene
    this.telegraph = new Telegraph(world.scene)
    this.hitstop = 0
    this._rings = []
    this._numbers = []
    this._v = new THREE.Vector3()

    this._ringGeo = new THREE.RingGeometry(0.72, 1, 40)
    this._slashGeo = new THREE.RingGeometry(0.35, 1, 32, 1, -0.9, 1.8)
  }

  /** 프레임을 잠깐 얼린다. 타격감의 8할. */
  freeze(sec) { this.hitstop = Math.max(this.hitstop, sec) }

  shake(amount) { this.world.addShake(amount) }

  ring(x, z, { color = '#ffd08a', radius = 2.2, life = 0.26, y = 0.06 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    const m = new THREE.Mesh(this._ringGeo, mat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z)
    m.renderOrder = 3
    this.scene.add(m)
    this._rings.push({ m, t: 0, life, radius })
  }

  /** 칼이 지나간 자리의 궤적. 부채꼴을 통째로 칠하면 칼이 아니라 장판처럼 보인다. */
  slash(x, z, facing, range, halfAngle, color = '#fff0d0') {
    const geo = this.#arcGeo(range, halfAngle)
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })
    const m = new THREE.Mesh(geo, mat)
    m.rotation.x = -Math.PI / 2
    m.rotation.z = facing
    m.position.set(x, 0.75, z)
    m.renderOrder = 4
    this.scene.add(m)
    this._rings.push({ m, t: 0, life: 0.15, radius: 1, grow: 0.18, tilt: true })
  }

  /** (range, halfAngle) 조합이 몇 개 안 되니 만들어 두고 돌려 쓴다. */
  #arcGeo(range, halfAngle) {
    const key = `${range.toFixed(2)}:${halfAngle.toFixed(2)}`
    this._arcCache ??= new Map()
    let g = this._arcCache.get(key)
    if (!g) {
      g = new THREE.RingGeometry(range * 0.86, range * 1.02, 44, 1, -halfAngle - Math.PI / 2, halfAngle * 2)
      this._arcCache.set(key, g)
    }
    return g
  }

  number(worldPos, text, { color = '#fff', size = 30, crit = false } = {}) {
    const el = document.createElement('div')
    el.className = 'dmg'
    el.textContent = text
    el.style.color = color
    el.style.fontSize = `${crit ? size * 1.35 : size}px`
    this.ui.appendChild(el)
    this._numbers.push({
      el, t: 0, life: 0.85,
      pos: worldPos.clone(),
      vx: (Math.random() - 0.5) * 46, vy: -84 - Math.random() * 24,
    })
  }

  /** 히트스톱 중에도 도는 갱신. 실시간 dt 를 받는다. */
  update(dt) {
    if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - dt)
    this.telegraph.update(dt)

    for (let i = this._rings.length - 1; i >= 0; i--) {
      const r = this._rings[i]
      r.t += dt
      const k = r.t / r.life
      if (k >= 1) {
        this.scene.remove(r.m)
        r.m.material.dispose()
        this._rings.splice(i, 1)
        continue
      }
      if (r.grow) {          // 칼 궤적: 살짝 퍼지면서 빠르게 사라진다
        r.m.scale.setScalar(0.9 + k * r.grow)
        r.m.material.opacity = 0.5 * (1 - k)
      } else {               // 충격파 링: 크게 번지면서 사라진다
        r.m.scale.setScalar(r.radius * (0.35 + k * 0.85))
        r.m.material.opacity = (1 - k) * (1 - k)
      }
    }

    const cam = this.world.camera
    for (let i = this._numbers.length - 1; i >= 0; i--) {
      const n = this._numbers[i]
      n.t += dt
      const k = n.t / n.life
      if (k >= 1) { n.el.remove(); this._numbers.splice(i, 1); continue }
      this._v.copy(n.pos).project(cam)
      const sx = (this._v.x * 0.5 + 0.5) * innerWidth + n.vx * n.t
      const sy = (-this._v.y * 0.5 + 0.5) * innerHeight + n.vy * n.t + 140 * n.t * n.t
      n.el.style.transform = `translate(-50%,-50%) translate(${sx}px,${sy}px) scale(${1 + (1 - k) * 0.25})`
      n.el.style.opacity = k > 0.6 ? String((1 - k) / 0.4) : '1'
    }
  }
}
