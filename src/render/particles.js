import * as THREE from 'three'
import { rand } from '../core/math.js'

/**
 * 불티·물방울·돌조각.
 *
 * 하나짜리 점 스프라이트를 한 덩어리로 모아 그린다 (Points 하나).
 * 투사체마다 메시를 새로 만들면 탄막 서른 발에서 드로우콜이 터진다.
 */
const MAX = 900

const SPRITE = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.75)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class Particles {
  constructor(scene) {
    const geo = new THREE.BufferGeometry()
    this.pos = new Float32Array(MAX * 3)
    this.col = new Float32Array(MAX * 3)
    this.siz = new Float32Array(MAX)
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(this.siz, 1))
    geo.setDrawRange(0, 0)

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: SPRITE() } },
      vertexShader: `
        attribute float size;
        varying vec3 vCol;
        void main() {
          vCol = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 320.0 / max(-mv.z, 0.001);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vCol;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vCol * t.a, t.a);
        }`,
      vertexColors: true,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 6
    scene.add(this.points)
    this.geo = geo
    this.live = []
  }

  /**
   * @param o { x,y,z, count, color, speed, spread, size, life, gravity, drag, up }
   */
  burst(o) {
    const color = new THREE.Color(o.color ?? '#ffb066')
    for (let i = 0; i < (o.count ?? 8); i++) {
      if (this.live.length >= MAX) break
      const a = rand(0, Math.PI * 2)
      const el = rand(-0.4, o.up ?? 0.9)
      const sp = rand(0.35, 1) * (o.speed ?? 4)
      this.live.push({
        x: o.x + rand(-0.1, 0.1), y: (o.y ?? 0.8) + rand(-0.1, 0.1), z: o.z + rand(-0.1, 0.1),
        vx: Math.cos(a) * sp * (o.spread ?? 1),
        vy: el * sp,
        vz: Math.sin(a) * sp * (o.spread ?? 1),
        t: 0, life: (o.life ?? 0.5) * rand(0.7, 1.3),
        size: (o.size ?? 0.12) * rand(0.7, 1.4),
        r: color.r, g: color.g, b: color.b,
        gravity: o.gravity ?? 6, drag: o.drag ?? 2.4,
      })
    }
  }

  /**
   * 바깥에서 안으로 모여든다.
   * 터져 나가는 것과 방향이 반대라, 무언가 '붙는' 순간에 쓴다.
   */
  converge(o) {
    const color = new THREE.Color(o.color ?? '#ffd9a0')
    const R = o.radius ?? 2.2
    for (let i = 0; i < (o.count ?? 20); i++) {
      if (this.live.length >= MAX) break
      const a = rand(0, Math.PI * 2)
      const r = R * rand(0.75, 1.15)
      const y = (o.y ?? 0.9) + rand(-0.5, 1.1)
      const sp = r / (o.life ?? 0.55)
      this.live.push({
        x: o.x + Math.cos(a) * r, y, z: o.z + Math.sin(a) * r,
        vx: -Math.cos(a) * sp, vy: ((o.y ?? 0.9) - y) / (o.life ?? 0.55), vz: -Math.sin(a) * sp,
        t: 0, life: (o.life ?? 0.55) * rand(0.85, 1.05),
        size: (o.size ?? 0.13) * rand(0.7, 1.3),
        r: color.r, g: color.g, b: color.b,
        gravity: 0, drag: 0,          // 곧장 빨려 들어가야 한다
      })
    }
  }

  /** 날아가는 물체가 흘리는 것. 한두 알씩 계속 떨군다. */
  shed(x, y, z, color, size = 0.09) {
    if (this.live.length >= MAX) return
    const c = new THREE.Color(color)
    this.live.push({
      x, y, z, vx: rand(-0.5, 0.5), vy: rand(0.2, 1.1), vz: rand(-0.5, 0.5),
      t: 0, life: rand(0.22, 0.45), size: size * rand(0.6, 1.2),
      r: c.r, g: c.g, b: c.b, gravity: -1.2, drag: 3.2,
    })
  }

  update(dt) {
    const pos = this.pos, col = this.col, siz = this.siz
    let n = 0
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]
      p.t += dt
      if (p.t >= p.life) { this.live.splice(i, 1); continue }
      const d = Math.exp(-p.drag * dt)
      p.vx *= d; p.vz *= d
      p.vy = (p.vy - p.gravity * dt) * d
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7 }

      const k = 1 - p.t / p.life
      const f = k * k
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z
      col[n * 3] = p.r * f; col[n * 3 + 1] = p.g * f; col[n * 3 + 2] = p.b * f
      siz[n] = p.size * (0.5 + k * 0.5)
      n++
    }
    this.geo.setDrawRange(0, n)
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    this.geo.attributes.size.needsUpdate = true
  }

  clear() { this.live.length = 0; this.geo.setDrawRange(0, 0) }
}
