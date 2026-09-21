import * as THREE from 'three'
import { makeArena } from '../stage/arena.js'
import { damp, rand } from '../core/math.js'
import { LOOKS } from './looks.js'
import { models } from './models.js'

/** 로스트아크식 쿼터뷰 리그. 스테이지마다 값만 갈아끼우면 된다. */
/**
 * 전장 카메라를 통째로 뒤로 무르는 배수.
 *
 * 얼굴이 읽히는 거리에서는 그레이박스 티가 난다 — 인물은 실루엣으로
 * 읽혀야 하고, 대신 바닥에 깔리는 예고 장판이 다 들어와야 한다.
 * 판마다 잡아 둔 거리(stages.js 의 camDistance)는 서로의 비율이 이미 맞춰져
 * 있으므로, 개별 숫자를 건드리지 않고 여기 하나로 같이 민다.
 */
export const CAM_PULL = 1.12

/** 보스 쪽으로 시선을 끄는 비율과, 아무리 멀어도 넘지 않는 한계. */
const BOSS_LOOK = 0.36
const BOSS_LOOK_MAX = 4.6

export const CAMERA_RIG = {
  pitch: THREE.MathUtils.degToRad(40),  // 수평에서 올려다본 각
  yaw: 0,                                // 고정. 방향키 축이 화면 축과 그대로 맞는다
  distance: 20.5 * CAM_PULL,
  fov: 30,                               // 좁게 → 원근이 눌려서 장판이 잘 읽힌다
  lead: 0.18,                            // 마우스 쪽으로 시선이 끌려가는 정도
  leadMax: 3.2,
  follow: 0.10,                          // 추적 감쇠 반감기(초)
}

/**
 * 바닥. 경계선을 그대로 부채꼴로 채운다.
 *
 * UV 는 월드 좌표에서 바로 뽑는다 — 모양이 바뀌어도 바닥 결의 크기가
 * 그대로 남아야 한다. 도형 크기에 맞춰 늘리면 좁은 갑판에서 돌결이
 * 고무처럼 늘어난다.
 */
function groundFan(edge, uvScale = 1 / 24) {
  const pts = edge.outline(128)
  const n = pts.length
  const pos = new Float32Array((n + 1) * 3)
  const uv = new Float32Array((n + 1) * 2)
  const idx = []
  pos[0] = 0; pos[1] = 0; pos[2] = 0
  uv[0] = 0.5; uv[1] = 0.5
  for (let i = 0; i < n; i++) {
    const p = pts[i], j = i + 1
    pos[j * 3] = p.x; pos[j * 3 + 1] = 0; pos[j * 3 + 2] = p.z
    uv[j * 2] = p.x * uvScale + 0.5
    uv[j * 2 + 1] = p.z * uvScale + 0.5
    idx.push(0, j, i === n - 1 ? 1 : j + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  // 법선은 위로 못 박는다. 부채꼴 감는 방향에 따라 아래를 볼 수 있는데,
  // 그러면 바닥이 통째로 검어진다.
  const nrm = new Float32Array((n + 1) * 3)
  for (let i = 0; i <= n; i++) nrm[i * 3 + 1] = 1
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  return g
}

/**
 * 벽. 같은 경계선을 위로 세운 치마.
 * 안쪽에서 보므로 면이 안을 향해야 한다 — 바깥으로 감으면 통째로 사라진다.
 */
function wallSkirt(edge, height = 3.4, flare = 0.4) {
  const pts = edge.outline(128)
  const n = pts.length
  const pos = new Float32Array(n * 2 * 3)
  const uv = new Float32Array(n * 2 * 2)
  const idx = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const k = 1 + flare / Math.max(Math.hypot(p.x, p.z), 1e-3)
    // 아래(0) · 위(1)
    pos[i * 6] = p.x; pos[i * 6 + 1] = 0; pos[i * 6 + 2] = p.z
    pos[i * 6 + 3] = p.x * k; pos[i * 6 + 4] = height; pos[i * 6 + 5] = p.z * k
    const u = i / n
    uv[i * 4] = u; uv[i * 4 + 1] = 0
    uv[i * 4 + 2] = u; uv[i * 4 + 3] = 1
    const a0 = i * 2, a1 = i * 2 + 1
    const b0 = ((i + 1) % n) * 2, b1 = b0 + 1
    idx.push(a0, b0, a1, a1, b0, b1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function stoneTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#3b3129'
  g.fillRect(0, 0, 512, 512)
  // 얼룩 — 바닥에 결이 없으면 이동이 미끄러지는 느낌이 난다
  for (let i = 0; i < 2600; i++) {
    const r = rand(2, 26)
    g.fillStyle = `rgba(${rand(20, 90) | 0},${rand(16, 74) | 0},${rand(12, 58) | 0},${rand(0.05, 0.3)})`
    g.beginPath(); g.arc(rand(0, 512), rand(0, 512), r, 0, Math.PI * 2); g.fill()
  }
  // 돌 틈
  g.strokeStyle = 'rgba(12,9,7,0.45)'
  for (let i = 0; i < 90; i++) {
    g.lineWidth = rand(0.6, 2.4)
    g.beginPath()
    const x = rand(0, 512), y = rand(0, 512)
    g.moveTo(x, y)
    g.lineTo(x + rand(-70, 70), y + rand(-70, 70))
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(7, 7)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, powerPreference: 'high-performance',
      preserveDrawingBuffer: import.meta.env?.DEV ?? false,   // 개발 중 화면 캡처용
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.localClippingEnabled = true    // 저승에서 땅 위로 올라오는 연출이 쓴다
    container.appendChild(this.renderer.domElement)
    this.canvas = this.renderer.domElement

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0a0a10')
    this.scene.fog = new THREE.FogExp2('#0d0b12', 0.018)

    this.camera = new THREE.PerspectiveCamera(CAMERA_RIG.fov, 1, 0.5, 220)
    this.camTarget = new THREE.Vector3()
    this.shake = 0
    this._shakeOff = new THREE.Vector3()

    this.#lights()
    this.arenaRadius = 16
    this.#arena()
    this._texCache = new Map()
    this.#composer()

    addEventListener('resize', () => this.resize())
    this.resize()
  }

  #lights() {
    this.hemi = new THREE.HemisphereLight('#3a4a74', '#140f0a', 0.55)
    this.scene.add(this.hemi)

    // 이스마로스 — 불타는 해안. 따뜻한 주광 + 차가운 역광으로 실루엣을 딴다.
    const key = new THREE.DirectionalLight('#ffb478', 2.4)
    key.position.set(10, 17, 7)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    const d = 24
    key.shadow.camera.left = -d; key.shadow.camera.right = d
    key.shadow.camera.top = d; key.shadow.camera.bottom = -d
    key.shadow.camera.near = 1; key.shadow.camera.far = 60
    key.shadow.bias = -0.0008
    key.shadow.normalBias = 0.02
    this.scene.add(key)
    this.keyLight = key

    const rim = new THREE.DirectionalLight('#6f8cff', 1.1)
    rim.position.set(-9, 6, -11)
    this.scene.add(rim)
    this.rimLight = rim
  }

  #arena() {
    const R = 16
    // 바닥과 벽은 setArenaRadius 가 판 모양에 맞춰 다시 만든다.
    // 여기서는 자리만 잡아 둔다 — XZ 평면에 바로 짓기 때문에 회전이 없다.
    const ground = new THREE.Mesh(
      groundFan(makeArena('round', R + 2)),
      new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, metalness: 0 })
    )
    ground.receiveShadow = true
    this.scene.add(ground)
    this.ground = ground

    // 투기장 테두리 — 경계가 눈에 보여야 몰리는 느낌이 난다
    const wall = new THREE.Mesh(
      wallSkirt(makeArena('round', R + 2), 3.4),
      // 치마를 감는 방향이 모양마다 달라질 수 있으므로 양면으로 둔다.
      // 한 겹짜리 띠라 양면이어도 비용이 없다.
      new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1, side: THREE.DoubleSide })
    )
    wall.receiveShadow = true
    this.scene.add(wall)
    this.wall = wall

    // 잡석 — 이동 속도를 눈으로 가늠할 기준점
    const rockGeo = new THREE.DodecahedronGeometry(1, 0)
    const rockMat = new THREE.MeshStandardMaterial({ color: '#544738', roughness: 1 })
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 110)
    rocks.castShadow = rocks.receiveShadow = true
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    for (let i = 0; i < 110; i++) {
      const a = rand(0, Math.PI * 2), r = rand(6, R + 1.2)
      const s = rand(0.2, 0.65)
      e.set(rand(0, 3), rand(0, 3), rand(0, 3)); q.setFromEuler(e)
      m.compose(new THREE.Vector3(Math.cos(a) * r, s * 0.35, Math.sin(a) * r), q, new THREE.Vector3(s, s * 0.6, s))
      rocks.setMatrixAt(i, m)
    }
    this.scene.add(rocks)
    this.rocks = rocks
  }

  /**
   * 저승의 벽. 무너진 돌덩이들이 길을 만든다.
   *
   * 하나씩 메시를 만들면 스무 개 남짓에 드로우콜이 그만큼 는다.
   * 판마다 개수가 달라지므로 InstancedMesh 를 필요한 만큼만 다시 만든다.
   */
  setMaze(walls) {
    this._mist = null
    if (this.mazeMesh) {
      this.scene.remove(this.mazeMesh)
      this.mazeMesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
      this.mazeMesh = null
    }
    this.mazeWalls = walls ?? null
    if (!walls?.length) return

    /**
     * 벽을 바위 무더기로 세운다.
     *
     * 전에는 칸마다 BoxGeometry 하나에 보라색 단색이었다. 위에서 내려다보면
     * 무늬 없는 판자가 늘어선 세트장이었고, 저승이 아니라 창고였다.
     * 충돌은 그대로 상자(maze.js 의 hw·hd)로 두고, 보이는 것만 그 발자국을
     * 덮는 층진 바위 다섯 덩이로 쌓는다 (crag, 인스턴스라 드로우콜 하나).
     * 처음엔 잡석 파일을 썼는데 그건 각진 상자 모양이라 벽 크기로 키우니
     * 상자 무더기가 됐다. 모델이 없으면 예전 상자로 돌아간다.
     */
    const group = new THREE.Group()
    const basalt = new THREE.MeshStandardMaterial({ color: '#3a3444', roughness: 0.95, metalness: 0 })
    // 층진 큰 바위(crag) 한 덩이의 지오메트리를 뽑는다. 없으면 상자로 간다.
    let rockGeo = null
    const crag = models.create('crag')
    crag?.root.traverse(o => { if (o.isMesh && !rockGeo) rockGeo = o.geometry })
    if (rockGeo) {
      let geo = rockGeo.clone()
      geo.computeBoundingBox()
      const bb0 = geo.boundingBox
      geo.translate(-(bb0.min.x + bb0.max.x) / 2, -bb0.min.y, -(bb0.min.z + bb0.max.z) / 2)
      const span = Math.max(bb0.max.x - bb0.min.x, bb0.max.z - bb0.min.z) || 1
      geo.scale(2 / span, 2 / span, 2 / span)     // 가로가 2 가 되게 — 아래 배수는 반폭 기준
      geo.computeVertexNormals()
      geo.computeBoundingBox()
      const gh = geo.boundingBox.max.y - geo.boundingBox.min.y || 1
      const per = 5
      const m = new THREE.InstancedMesh(geo, basalt, walls.length * per)
      m.castShadow = m.receiveShadow = true
      const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
      let k = 0
      // 씨앗 고정 난수 — 같은 미로는 늘 같은 바위
      let seed = 1337
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (const w of walls) {
        const c = Math.cos(w.turn ?? 0), sn = Math.sin(w.turn ?? 0)
        for (let i = 0; i < per; i++) {
          // 넷은 네 귀퉁이, 하나는 가운데 위에 얹어 윤곽을 들쭉날쭉하게
          const top = i === per - 1
          const lx = top ? (rnd() - 0.5) * w.hw * 0.5 : (i % 2 ? 0.5 : -0.5) * w.hw
          const lz = top ? (rnd() - 0.5) * w.hd * 0.5 : (i < 2 ? 0.5 : -0.5) * w.hd
          const x = w.x + lx * c + lz * sn, z = w.z - lx * sn + lz * c
          const sx = w.hw * (0.62 + rnd() * 0.3), sz = w.hd * (0.62 + rnd() * 0.3)
          const sy = (w.h * (top ? 1.0 : 0.62 + rnd() * 0.3)) / gh
          e.set((rnd() - 0.5) * 0.25, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.25)
          q.setFromEuler(e)
          mx.compose(new THREE.Vector3(x, top ? w.h * 0.2 : 0, z), q, new THREE.Vector3(sx, sy, sz))
          m.setMatrixAt(k++, mx)
        }
      }
      m.count = k
      m.instanceMatrix.needsUpdate = true
      group.add(m)
    } else {
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basalt, walls.length)
      m.castShadow = m.receiveShadow = true
      const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
      walls.forEach((w, i) => {
        e.set(0, w.turn ?? 0, 0); q.setFromEuler(e)
        mx.compose(new THREE.Vector3(w.x, w.h * 0.5, w.z), q, new THREE.Vector3(w.hw * 2, w.h, w.hd * 2))
        m.setMatrixAt(i, mx)
      })
      m.instanceMatrix.needsUpdate = true
      group.add(m)
    }

    /**
     * 페르세포네의 숲과 아스포델.
     *
     * 호메로스가 그린 저승의 문턱은 '높은 포플러와 열매를 떨구는 버드나무의
     * 숲' 이고, 망자들이 거니는 곳은 '아스포델의 들판' 이다. 바위만 있으면
     * 그냥 동굴이다. 잎이 없는 검은 나무를 벽 사이사이에, 잿빛 꽃을 길가에 둔다.
     * 나무는 벽 위(길이 아닌 자리)에만 세운다 — 길 위에 서면 걸리적거린다.
     */
    let seed2 = 4242
    const rnd2 = () => ((seed2 = (seed2 * 16807) % 2147483647) / 2147483647)
    walls.forEach((w, i) => {
      if (i % 3 !== 0) return
      const t = models.create('tree')
      if (!t) return
      t.root.position.set(w.x + (rnd2() - 0.5) * w.hw, 0, w.z + (rnd2() - 0.5) * w.hd)
      t.root.rotation.y = rnd2() * Math.PI * 2
      t.root.scale.multiplyScalar(0.9 + rnd2() * 0.5)
      for (const mat of t.mats) {
        const c = mat.clone(); c.color?.set?.('#15131a'); c.map = null
        t.root.traverse(o => { if (o.isMesh && o.material === mat) o.material = c })
      }
      group.add(t.root)
    })
    group.add(this.#underMist())
    this.mazeMesh = group
    this.scene.add(group)
  }

  /**
   * 바닥에 깔려 흐르는 안개.
   *
   * 호메로스의 저승은 '안개와 구름에 덮여 해가 한 번도 비치지 않는 곳' 이다.
   * 바닥 가까이 넓은 판 몇 장에 잡음을 흘려 둔다 — 벽 발치가 흐려지고
   * 길이 안개 속으로 이어진다. 가산 합성이 아니라 보통 합성이라 밝아지지 않고
   * 탁해진다. 판마다 흐르는 방향과 속도가 달라야 한 장으로 안 보인다.
   */
  #underMist() {
    const g = new THREE.Group()
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#8f86a8') } },
      vertexShader: `varying vec2 vUv; varying vec3 vW;
        void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform vec3 uColor;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vW.xz * 0.16;
          float a = n(p + vec2(uTime*0.05, uTime*0.02)) * 0.6 + n(p*2.3 - vec2(uTime*0.07, 0.)) * 0.4;
          float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x)
                     * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          gl_FragColor = vec4(uColor, smoothstep(0.35, 0.9, a) * 0.42 * edge);
        }`,
    })
    for (const [y, s] of [[0.25, 1], [0.7, 1.15]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(40 * s, 40 * s), mat)
      m.rotation.x = -Math.PI / 2
      m.position.y = y
      m.renderOrder = 5
      g.add(m)
    }
    g.userData.tick = dt => { mat.uniforms.uTime.value += dt }
    this._mist = g
    return g
  }

  /**
   * 길가의 아스포델. 미로가 선 뒤 Underworld 가 길 칸을 넘겨 준다.
   * 잿빛으로 칠한다 — 저승의 꽃은 색이 빠져 있다.
   */
  setAsphodel(spots) {
    if (!this.mazeMesh || !spots?.length) return
    let seed = 99
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (const s of spots) {
      const n = 2 + ((rnd() * 3) | 0)
      for (let i = 0; i < n; i++) {
        const f = models.create('flowerbush')
        if (!f) return
        // 길 한가운데는 비운다 — 가장자리로 밀어 둔다
        const a = rnd() * Math.PI * 2, r = 1.0 + rnd() * 0.8
        f.root.position.set(s.x + Math.cos(a) * r, 0, s.z + Math.sin(a) * r)
        f.root.rotation.y = rnd() * Math.PI * 2
        f.root.scale.multiplyScalar(0.6 + rnd() * 0.4)
        for (const mat of f.mats) mat.color?.set?.('#9a95a4')
        this.mazeMesh.add(f.root)
      }
    }
  }

  /**
   * 바다 모드 — 판을 통째로 치우고 물만 남긴다 (항해 구간, stage/sailleg.js).
   *
   * 판을 새로 만들지 않고 있는 것을 감춘다. 땅·벽·잡석·소품·미로가 사라지면
   * 남는 건 빛과 안개뿐이고, 그 위에 바다를 얹으면 배 한 척이 뜬다.
   * 돌아올 때 원래대로 켜야 하므로 무엇을 껐는지 기억해 둔다.
   */
  setSeaMode(on, { bg = '#4a5560', fog = 0.012, fogColor = '#5c6a76' } = {}) {
    const parts = [this.ground, this.wall, this.rocks, this.propGroup, this.mazeMesh, this.cliff].filter(Boolean)
    if (on) {
      this._seaSaved = { vis: parts.map(p => p.visible), bg: this.scene.background, fog: this.scene.fog }
      for (const p of parts) p.visible = false
      this.scene.background = new THREE.Color(bg)
      this.scene.fog = new THREE.FogExp2(fogColor, fog)
    } else if (this._seaSaved) {
      parts.forEach((p, i) => { p.visible = this._seaSaved.vis[i] ?? true })
      this.scene.background = this._seaSaved.bg
      this.scene.fog = this._seaSaved.fog
      this._seaSaved = null
    }
  }

  /**
   * 절벽. 판 한쪽 끝에 바위벽을 세운다.
   *
   * 스킬라는 배에 올라타는 짐승이 아니라 절벽 그 자체다. 벽이 없으면
   * 돌 촉수가 허공에서 자라는 꼴이 된다 — 뻗어 나올 데가 있어야 한다.
   */
  setCliff(spec) {
    if (this.cliff) {
      this.scene.remove(this.cliff)
      this.cliff.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() })
      this.cliff = null
    }
    if (!spec) return
    const arena = this.arena
    const z = -(arena?.radiusAt(Math.PI) ?? 12) - (spec.back ?? 1.6)
    const w = (arena?.radiusAt(Math.PI / 2) ?? 20) * 2.3
    const g = new THREE.Group()
    const rock = new THREE.MeshStandardMaterial({
      color: spec.color ?? '#5e646c', roughness: 0.98, flatShading: true,
    })
    // 덩어리를 겹쳐 세운다. 판 하나로 세우면 벽지처럼 보인다.
    const n = spec.count ?? 13
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const h = (spec.height ?? 11) * (0.62 + Math.sin(t * 7.3) * 0.2 + Math.random() * 0.24)
      const bw = w / n * (1.15 + Math.random() * 0.5)
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rock)
      m.scale.set(bw * 0.5, h * 0.5, (spec.depth ?? 5) * (0.6 + Math.random() * 0.5))
      m.position.set(-w / 2 + w * t, h * 0.28, z - Math.random() * 2)
      m.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3)
      m.castShadow = m.receiveShadow = true
      g.add(m)
    }
    this.scene.add(g)
    this.cliff = g
  }

  async #composer() {
    this.composer = null
    try {
      const pp = await import('postprocessing')
      const composer = new pp.EffectComposer(this.renderer, { multisampling: 4 })
      composer.addPass(new pp.RenderPass(this.scene, this.camera))
      this.bloom = new pp.BloomEffect({ intensity: 0.85, luminanceThreshold: 0.62, luminanceSmoothing: 0.25, mipmapBlur: true })
      this.vignette = new pp.VignetteEffect({ darkness: 0.55, offset: 0.32 })
      composer.addPass(new pp.EffectPass(this.camera, this.bloom, this.vignette))
      this.composer = composer
      this.resize()
    } catch (err) {
      console.warn('[world] 포스트프로세싱 없이 간다:', err)
    }
  }

  /**
   * 스테이지 환경을 통째로 갈아끼운다.
   * 땅 텍스처는 필요할 때만 받아 온다 — 아홉 장을 한꺼번에 내려받을 이유가 없다.
   */
  /** 톤 시안을 바꾼다. 다음 applyStage 부터 반영된다. */
  setLook(name) {
    this.look = LOOKS[name] ? name : 'marble'
    if (this._lastStage) this.applyStage(this._lastStage)
  }

  async applyStage(stage) {
    this._lastStage = stage
    // 저승처럼 어둠 자체가 내용인 곳은 톤을 덮지 않는다.
    // '정오의 대리석'을 씌우면 망자의 나라가 대낮 마당이 된다.
    const look = stage.keepEnv ? {} : (LOOKS[this.look ?? 'marble'] ?? {})
    // 스테이지가 정한 것 위에 톤을 덮는다. 톤이 말 안 한 건 스테이지 것을 쓴다.
    const e = { ...(stage.env ?? {}), ...look }
    const a = { ...(stage.arena ?? {}) }
    if (look.groundTint) a.groundTint = look.groundTint
    if (look.wallColor) a.wallColor = look.wallColor
    /* 바위는 톤을 덮지 않고 섞는다.
       대리석 톤의 바위 색(#cfc4b0)을 그대로 덮으면 동굴의 검은 흙, 눈 내린
       항구의 젖은 땅 위에 흰 덩어리가 110 개 깔린다 — 어느 판을 찍어도
       '흰 주사위' 가 제일 먼저 보였다. 판이 정한 돌 색을 바탕에 두고 톤은
       30% 만 얹는다. 톤이 판 전체 색을 맞추는 역할은 그대로 한다. */
    if (look.rockColor) {
      a.rockColor = a.rockColor
        ? '#' + new THREE.Color(a.rockColor).lerp(new THREE.Color(look.rockColor), 0.3).getHexString()
        : look.rockColor
    }

    this.scene.background = new THREE.Color(e.bg ?? '#0a0a10')
    this.scene.fog = new THREE.FogExp2(e.fogColor ?? e.bg ?? '#0d0b12', e.fog ?? 0.018)
    // 판이 열릴 때 빛이 서서히 드는 연출이 이 값을 기준으로 올라간다
    this.exposure = e.exposure ?? 1.05
    this.renderer.toneMappingExposure = this.exposure

    this.hemi.color.set(e.hemiSky ?? '#3a4a74')
    this.hemi.groundColor.set(e.hemiGround ?? '#140f0a')
    this.hemi.intensity = e.hemiIntensity ?? 0.55

    this.keyLight.color.set(e.key ?? '#ffb478')
    this.keyLight.intensity = e.keyIntensity ?? 2.4
    this.rimLight.color.set(e.rim ?? '#6f8cff')
    this.rimLight.intensity = e.rimIntensity ?? 1.1

    // 보스는 크다. 5m 짜리를 잡몹과 같은 거리에서 보면 화면에 안 들어온다.
    // 판이 정한 거리에 CAM_PULL 을 곱한다 — 판끼리의 비율은 그대로 두고 통째로 물린다.
    CAMERA_RIG.distance = (e.camDistance ?? 20.5) * CAM_PULL
    CAMERA_RIG.pitch = THREE.MathUtils.degToRad(e.camPitch ?? 40)
    this.camera.fov = CAMERA_RIG.fov = e.camFov ?? 30
    this.camera.updateProjectionMatrix()

    // 판이 바뀌면 이전 판의 벽은 사라져야 한다. 저승을 지나온 뒤
    // 바다 한가운데 돌덩이가 서 있으면 안 된다.
    this.setMaze(null)
    this.setArenaRadius(a.radius ?? 16, a.shape ?? 'round')
    this.setCliff(a.cliff ?? null)
    this.wall.material.color.set(a.wallColor ?? '#2a2018')
    this.ground.material.color.set(a.groundTint ?? '#ffffff')
    this.rocks.visible = a.rocks !== false
    this.rocks.material.color.set(a.rockColor ?? '#544738')
    this.#scatterRocks(a.rockScale ?? [0.2, 0.65], a.rockCount ?? 46)

    this.#setProps(a.props)
    this.#setSnow(!!e.snow)
    this.#setPost(e)
    if (a.ground) await this.#setGround(a.ground, a.repeat ?? 8)
  }

  /**
   * 무대 소품 — 기둥·나무·항아리 같은 것들.
   *
   * 싸우는 자리에는 아무것도 두지 않는다. 걸리적거리는 순간 장식이 아니라
   * 장애물이 되고, 충돌 처리가 없으니 뚫고 지나가는 게 보인다.
   * 그래서 발이 닿는 반지름(R)과 벽(R+2) 사이 두 칸 띠에만 둘러 세운다 —
   * 화면에는 들어오고 몸에는 안 닿는다. 그보다 밖으로 보내면 벽에 가려 안 보인다.
   */
  #setProps(list) {
    if (this.propGroup) {
      this.scene.remove(this.propGroup)
      this.propGroup.traverse(o => { if (o.isMesh) o.geometry?.dispose?.() })
      this.propGroup = null
    }
    if (!list?.length) return
    const g = new THREE.Group()
    const R = this.arenaRadius
    for (const spec of list) {
      for (let i = 0; i < (spec.count ?? 1); i++) {
        const made = models.create(spec.key)
        if (!made) break                       // 파일이 없으면 그냥 소품이 없는 무대다
        const o = made.root
        const [r0, r1] = spec.ring ?? [1.03, 1.12]
        const a = spec.spread === false
          ? (i / (spec.count ?? 1)) * Math.PI * 2 + (spec.offset ?? 0)
          : rand(0, Math.PI * 2)
        // 벽을 따라 세운다. 원 반지름으로 두면 네모난 홀에서 기둥이
        // 벽을 뚫고 나가거나 방 한가운데 둥글게 모여 선다.
        const rr = this.arena ? this.arena.radiusAt(a) : R
        const r = rr * rand(r0, r1)
        o.position.set(Math.sin(a) * r, spec.y ?? 0, Math.cos(a) * r)
        o.rotation.y = rand(0, Math.PI * 2)
        const sc = spec.scale ? rand(spec.scale[0], spec.scale[1]) : 1
        o.scale.multiplyScalar(sc)
        // 받아 온 소품은 제 색이 따로 있다. 그대로 두면 판의 색과 따로 논다.
        // 재질은 같은 키끼리 공유되므로 판을 바꿀 때마다 다시 칠하면 된다.
        if (spec.tint) for (const m of made.mats) m.color?.set?.(spec.tint)
        g.add(o)
      }
    }
    this.propGroup = g
    this.scene.add(g)
  }

  /**
   * 잡석을 다시 뿌린다. 판마다 크기와 밀도가 다르다 —
   * 동굴 바닥은 크고 촘촘해야 울퉁불퉁해 보이고, 해안은 작고 성겨야 한다.
   */
  /**
   * 잡석의 모양을 받아 온 바위로 바꾼다.
   *
   * 원래는 DodecahedronGeometry(1, 0) — 면 열두 개짜리 다면체였다. 한 번의
   * 드로우콜로 110 개를 그릴 수 있어서 싼데, **열두 면이라 돌로 안 보인다.**
   * 어느 판을 찍어도 화면에 흰 주사위가 흩어져 있는 게 제일 먼저 눈에 들어왔다.
   *
   * 그런데 비싼 걸로 바꿀 필요는 없었다. 받아 온 바위가 516 삼각형이라
   * InstancedMesh 의 **지오메트리만 갈아 끼우면** 드로우콜은 그대로 하나고
   * 모양만 진짜가 된다. 110 × 516 = 5.7 만 삼각형 — 감당된다.
   *
   * 모델이 없으면 다면체로 남는다. 한 번만 갈아 끼우고 그 뒤로는 안 건드린다.
   */
  #useRockModel() {
    if (this._rockSwapped) return
    // 층진 바위(crag)가 먼저다. 잡석 파일(cliffRock)은 각진 상자 모양이라
    // 어느 판에서든 흰 상자가 흩어진 것처럼 보였다
    const made = models.create('crag') ?? models.create('cliffRock')
    if (!made) { this._rockSwapped = 'none'; return }
    let geo = null
    made.root.traverse(o => { if (o.isMesh && o.geometry && !geo) geo = o.geometry })
    if (!geo) { this._rockSwapped = 'none'; return }
    /**
     * 크기를 **가장 긴 변이 2** 가 되게 맞춘다.
     *
     * 처음에는 높이를 1 로 맞췄는데, 그러면 갈아 끼우는 순간 잡석이 통째로
     * 작아진다 — 원래 쓰던 DodecahedronGeometry(1, 0) 은 반지름이 1 이라
     * 지름이 2 였고, 흩뿌리는 쪽의 배수(0.2~0.65)가 그 2 를 기준으로
     * 맞춰져 있었다. 받아 온 바위는 납작해서 높이로 맞추면 더 줄어들어,
     * 바위가 아니라 부스러기가 깔린다.
     *
     * 잡석은 장식이 아니라 **이동 속도를 눈으로 가늠하는 기준점**이다.
     * 너무 작으면 지나가는 게 안 보여서 그 값을 못 한다.
     */
    geo = geo.clone()
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const span = Math.max(
      bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z, 1e-4)
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)
    geo.scale(2 / span, 2 / span, 2 / span)
    geo.computeVertexNormals()
    this.rocks.geometry.dispose()
    this.rocks.geometry = geo
    this._rockSwapped = 'model'
  }

  #scatterRocks([lo, hi], count) {
    this.#useRockModel()
    const rocks = this.rocks
    const R = this.arenaRadius
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    const n = Math.min(count, rocks.instanceMatrix.count)
    for (let i = 0; i < rocks.instanceMatrix.count; i++) {
      if (i >= n) { m.makeScale(0, 0, 0); rocks.setMatrixAt(i, m); continue }
      const a = rand(0, Math.PI * 2)
      const rr = this.arena ? this.arena.radiusAt(a) : R
      const r = rand(4, rr + 1.2)
      const s = rand(lo, hi)
      e.set(rand(0, 3), rand(0, 3), rand(0, 3)); q.setFromEuler(e)
      m.compose(new THREE.Vector3(Math.sin(a) * r, s * 0.32, Math.cos(a) * r), q, new THREE.Vector3(s, s * 0.6, s))
      rocks.setMatrixAt(i, m)
    }
    rocks.instanceMatrix.needsUpdate = true
  }

  /**
   * 눈. 텔레필로스는 북쪽 끝이라 눈이 와야 한다.
   * 파티클 하나로 돌리면 전투 이펙트와 예산을 다투므로 따로 작은 Points 를 쓴다.
   */
  #setSnow(on) {
    if (!on) { if (this.snow) this.snow.visible = false; return }
    if (!this.snow) {
      const N = 900
      const pos = new Float32Array(N * 3)
      const spd = new Float32Array(N)
      for (let i = 0; i < N; i++) {
        pos[i * 3] = rand(-30, 30)
        pos[i * 3 + 1] = rand(0, 22)
        pos[i * 3 + 2] = rand(-30, 30)
        spd[i] = rand(0.7, 2.0)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({
        color: '#dfe8f2', size: 0.13, transparent: true, opacity: 0.75,
        depthWrite: false, sizeAttenuation: true,
      })
      const pts = new THREE.Points(geo, mat)
      pts.frustumCulled = false
      pts.userData.spd = spd
      this.scene.add(pts)
      this.snow = pts
    }
    this.snow.visible = true
  }

  /** draw() 가 매 프레임 부른다. 눈은 카메라를 따라다니며 내린다. */
  updateSnow(dt, focus) {
    const s = this.snow
    if (!s || !s.visible) return
    const p = s.geometry.attributes.position
    const spd = s.userData.spd
    for (let i = 0; i < spd.length; i++) {
      let y = p.array[i * 3 + 1] - spd[i] * dt
      p.array[i * 3] += Math.sin((y + i) * 0.5) * dt * 0.25
      if (y < 0) {
        y = 22
        p.array[i * 3] = focus.x + rand(-30, 30)
        p.array[i * 3 + 2] = focus.z + rand(-30, 30)
      }
      p.array[i * 3 + 1] = y
    }
    p.needsUpdate = true
  }

  #setPost(e) {
    if (!this.bloom) return
    this.bloom.intensity = e.bloom ?? 0.85
    this.bloom.luminanceMaterial.threshold = e.threshold ?? 0.62
    this.vignette.darkness = e.vignette ?? 0.55
  }

  /**
   * 판 바닥.
   *
   * 색(map)만 깔면 바닥이 납작하다. 빛이 스쳐도 돌이 돌처럼 안 보인다 —
   * 사진을 바닥에 눕혀 놓은 것과 같아서, 쿼터뷰에서는 그게 바로 보인다.
   * 그래서 **노멀맵과 거칠기맵을 같이** 깐다. 노멀이 요철을 만들고
   * 거칠기가 어디가 젖었고 어디가 말랐는지를 만든다.
   *
   * 셋은 같은 이름 규칙으로 찾는다 — `<판>.webp`, `<판>-n.webp`, `<판>-r.webp`.
   * 노멀·거칠기가 없는 판은 색만 깔고 지나간다 (없다고 판이 안 열리면 안 된다).
   * 출처는 ambientCG 의 CC0 자료다 (public/textures/CREDITS.txt).
   *
   * 노멀은 **NormalGL** 을 쓴다. DX 쪽은 초록 채널이 뒤집혀 있어서 그대로
   * 깔면 요철이 반대로 파인다 — 빛이 위에서 오는데 그림자가 위에 생긴다.
   */
  async #setGround(name, repeat) {
    const load = async (suffix, srgb) => {
      const key = name + suffix
      if (this._texCache.has(key)) return this._texCache.get(key)
      try {
        const t = await new THREE.TextureLoader().loadAsync(`/textures/${name}${suffix}.webp`)
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        if (srgb) t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
        this._texCache.set(key, t)
        return t
      } catch {
        this._texCache.set(key, null)     // 한 번 없으면 다시 찾지 않는다
        return null
      }
    }

    const [tex, nrm, rgh] = await Promise.all([load('', true), load('-n', false), load('-r', false)])
    if (!tex) {
      console.info(`[world] 바닥 텍스처 없음: ${name} — 절차 생성으로 간다`)
      return
    }
    const m = this.ground.material
    for (const t of [tex, nrm, rgh]) if (t) t.repeat.set(repeat, repeat)
    m.map = tex
    m.normalMap = nrm ?? null
    m.roughnessMap = rgh ?? null
    // 노멀 세기. 1 로 두면 요철이 과해서 바닥이 자갈밭으로 읽힌다 —
    // 쿼터뷰는 바닥을 비스듬히 보므로 각도가 과장돼 보인다.
    if (nrm) m.normalScale.set(0.7, 0.7)
    // 거칠기맵이 있으면 스칼라는 1 이어야 한다 (곱해지기 때문).
    if (rgh) m.roughness = 1
    m.needsUpdate = true
  }

  /**
   * 투기장 크기와 모양. 보스방은 넓고 잡몹방은 좁다.
   *
   * 모양도 곳에 따라 다르다 — 이타카의 홀은 사람이 지은 방이라 네모여야 하고,
   * 동굴이나 해안은 둥근 게 맞다. 원통을 네모로만 바꿔도 '지은 곳' 으로 읽힌다.
   */
  setArenaRadius(R, shape = 'round') {
    if (this.arenaRadius === R && this._shape === shape) return
    this.arenaRadius = R
    this._shape = shape

    // 경계 하나를 만들어 두고 바닥·벽·이동 제한·스폰이 전부 이걸 본다.
    // 벽을 눈으로 그리는 식과 몸으로 막는 식이 다르면, 네모난 방에서
    // 보이지 않는 둥근 벽에 막히는 일이 생긴다.
    this.arena = makeArena(shape, R)
    const E = R + 2
    const edge = makeArena(shape, E)      // 벽은 판보다 두 걸음 밖에 선다

    this.ground.geometry.dispose()
    this.ground.geometry = groundFan(edge)
    this.wall.geometry.dispose()
    this.wall.geometry = wallSkirt(edge, 3.4)
    this.wall.rotation.y = 0
    this.wall.position.y = 0

    const d = edge.maxRadius() + 6
    const c = this.keyLight.shadow.camera
    c.left = -d; c.right = d; c.top = d; c.bottom = -d
    c.updateProjectionMatrix()
  }

  resize() {
    const w = innerWidth, h = innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer?.setSize(w, h)
  }

  addShake(amount) { this.shake = Math.min(this.shake + amount, 1.4) }

  /**
   * 지금 화면이 누구를 보고 있는지. 보스가 서 있는 동안에는 이쪽으로 시선을 끈다.
   * null 이면 평소대로 플레이어만 본다.
   */
  setBossFocus(actor) {
    this.bossFocus = actor ?? null
    /* 큰 보스는 머리가 화면 위로 잘린다.
       세이렌(키 4.2)은 상체가 화면 꼭대기에 붙어 체력바에 겹쳤다 — 노래하는
       입도, 쏘아야 할 자리도 화면 밖이라 '보고 친다' 가 성립하지 않았다.
       시선을 보스 키만큼 올린다. 사람 크기(1.8)면 0 이라 잡졸에는 영향이 없다.
       키는 등장할 때 한 번만 잰다 — 매 프레임 재면 뼈가 움직일 때마다 시선이
       출렁인다. */
    this.bossLift = 0
    if (!actor) return
    const box = new THREE.Box3().setFromObject(actor.group)
    const h = box.max.y - box.min.y
    // 너무 올리면 이번엔 플레이어가 화면 아래 HUD 뒤로 밀린다. 1.8 에서 끊는다
    if (Number.isFinite(h)) this.bossLift = THREE.MathUtils.clamp(h - 2, 0, 1.8)
  }

  /** focus = 플레이어 위치, aim = 마우스 지점. 시선이 조준 쪽으로 살짝 끌려간다. */
  updateCamera(focus, aim, dt) {
    const rig = CAMERA_RIG
    const want = this._want ??= new THREE.Vector3()
    want.copy(focus)

    // 보스는 크고, 늘 플레이어 반대편에 선다. 시선을 플레이어에만 묶어 두면
    // 머리가 화면 위로 잘려 나간다 — 예고도 약점도 화면 밖에서 벌어지고,
    // 그러면 '보고 피한다' 도 '눈을 쏜다' 도 성립하지 않는다.
    // 둘 사이로 조금 끌어 오되, 플레이어가 화면 가운데를 잃지 않을 만큼만.
    const b = this.bossFocus
    if (b && !b.dead) {
      const bx = b.pos.x - focus.x, bz = b.pos.z - focus.z
      const len = Math.hypot(bx, bz)
      if (len > 0.01) {
        // 난간 보스는 조금만 더 당긴다. 난간이 화면 위쪽을 가로지르고
        // 그 아래 갑판에 플레이어가 서는 그림이라야 하는데, 너무 당기면
        // 이번엔 플레이어가 화면 아래 HUD 뒤로 밀린다. 나머지는 판의
        // camDistance 가 맡는다 — 넓은 배에는 넓은 샷.
        const pull = b.cfg?.rail ? 1.1 : 1
        const shift = Math.min(len * BOSS_LOOK * pull, BOSS_LOOK_MAX * pull)
        want.x += bx / len * shift
        want.z += bz / len * shift
      }
      want.y += this.bossLift ?? 0
    }

    if (aim) {
      const dx = (aim.x - focus.x) * rig.lead
      const dz = (aim.z - focus.z) * rig.lead
      const len = Math.hypot(dx, dz)
      const k = len > rig.leadMax ? rig.leadMax / len : 1
      want.x += dx * k; want.z += dz * k
    }
    this.camTarget.x = damp(this.camTarget.x, want.x, rig.follow, dt)
    this.camTarget.y = damp(this.camTarget.y, want.y, rig.follow, dt)
    this.camTarget.z = damp(this.camTarget.z, want.z, rig.follow, dt)

    // 연출용 클로즈업. zoom 0 이면 평소, 1 이면 바짝.
    const zoom = this.zoom ?? 0
    const dist = rig.distance * (1 - zoom) + 9.5 * zoom
    const hor = Math.cos(rig.pitch) * dist
    const off = this._off ??= new THREE.Vector3()
    off.set(Math.sin(rig.yaw) * hor, Math.sin(rig.pitch) * dist, Math.cos(rig.yaw) * hor)

    // 흔들림은 카메라 위치에만 준다. 타겟까지 흔들면 화면이 멀미난다.
    this.shake = Math.max(0, this.shake - dt * 3.2)
    const s = this.shake * this.shake * 0.9
    this._shakeOff.set(rand(-s, s), rand(-s, s) * 0.6, rand(-s, s))

    this.camera.position.copy(this.camTarget).add(off).add(this._shakeOff)
    this.camera.lookAt(this.camTarget)
    this.keyLight.position.copy(this.camTarget).add(this._keyOffset ??= new THREE.Vector3(10, 17, 7))
    this.keyLight.target.position.copy(this.camTarget)
    this.keyLight.target.updateMatrixWorld()
  }

  render() {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }
}
