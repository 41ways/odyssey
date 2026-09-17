import * as THREE from 'three'
import { damp, rand } from '../core/math.js'
import { LOOKS } from './looks.js'
import { models } from './models.js'

/** 로스트아크식 쿼터뷰 리그. 스테이지마다 값만 갈아끼우면 된다. */
export const CAMERA_RIG = {
  pitch: THREE.MathUtils.degToRad(40),  // 수평에서 올려다본 각
  yaw: 0,                                // 고정. 방향키 축이 화면 축과 그대로 맞는다
  distance: 20.5,
  fov: 30,                               // 좁게 → 원근이 눌려서 장판이 잘 읽힌다
  lead: 0.18,                            // 마우스 쪽으로 시선이 끌려가는 정도
  leadMax: 3.2,
  follow: 0.10,                          // 추적 감쇠 반감기(초)
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
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(R + 2, 96),
      new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    this.ground = ground

    // 투기장 테두리 — 경계가 눈에 보여야 몰리는 느낌이 난다
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 2, R + 2.4, 3.2, 96, 1, true),
      new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1, side: THREE.BackSide })
    )
    wall.position.y = 1.6
    wall.receiveShadow = true
    this.scene.add(wall)
    this.wall = wall

    // 잡석 — 이동 속도를 눈으로 가늠할 기준점
    const rockGeo = new THREE.DodecahedronGeometry(1, 0)
    const rockMat = new THREE.MeshStandardMaterial({ color: '#544738', roughness: 1 })
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 46)
    rocks.castShadow = rocks.receiveShadow = true
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    for (let i = 0; i < 46; i++) {
      const a = rand(0, Math.PI * 2), r = rand(6, R + 1.2)
      const s = rand(0.2, 0.65)
      e.set(rand(0, 3), rand(0, 3), rand(0, 3)); q.setFromEuler(e)
      m.compose(new THREE.Vector3(Math.cos(a) * r, s * 0.35, Math.sin(a) * r), q, new THREE.Vector3(s, s * 0.6, s))
      rocks.setMatrixAt(i, m)
    }
    this.scene.add(rocks)
    this.rocks = rocks
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
    if (look.rockColor) a.rockColor = look.rockColor

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
    CAMERA_RIG.distance = e.camDistance ?? 20.5
    CAMERA_RIG.pitch = THREE.MathUtils.degToRad(e.camPitch ?? 40)
    this.camera.fov = CAMERA_RIG.fov = e.camFov ?? 30
    this.camera.updateProjectionMatrix()

    this.setArenaRadius(a.radius ?? 16)
    this.wall.material.color.set(a.wallColor ?? '#2a2018')
    this.ground.material.color.set(a.groundTint ?? '#ffffff')
    this.rocks.visible = a.rocks !== false
    this.rocks.material.color.set(a.rockColor ?? '#544738')

    this.#setProps(a.props)
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
        const r = R * rand(r0, r1)
        o.position.set(Math.cos(a) * r, spec.y ?? 0, Math.sin(a) * r)
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

  #setPost(e) {
    if (!this.bloom) return
    this.bloom.intensity = e.bloom ?? 0.85
    this.bloom.luminanceMaterial.threshold = e.threshold ?? 0.62
    this.vignette.darkness = e.vignette ?? 0.55
  }

  async #setGround(name, repeat) {
    let tex = this._texCache.get(name)
    if (!tex) {
      try {
        tex = await new THREE.TextureLoader().loadAsync(`/textures/${name}.webp`)
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
        this._texCache.set(name, tex)
      } catch {
        console.info(`[world] 바닥 텍스처 없음: ${name} — 절차 생성으로 간다`)
        return
      }
    }
    tex.repeat.set(repeat, repeat)
    this.ground.material.map = tex
    this.ground.material.needsUpdate = true
  }

  /** 투기장 크기는 스테이지마다 다르다. 보스방은 넓고 잡몹방은 좁다. */
  setArenaRadius(R) {
    if (this.arenaRadius === R) return
    this.arenaRadius = R
    this.ground.geometry.dispose()
    this.ground.geometry = new THREE.CircleGeometry(R + 2, 96)
    this.wall.geometry.dispose()
    this.wall.geometry = new THREE.CylinderGeometry(R + 2, R + 2.4, 3.2, 96, 1, true)
    const d = R + 8
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

  /** focus = 플레이어 위치, aim = 마우스 지점. 시선이 조준 쪽으로 살짝 끌려간다. */
  updateCamera(focus, aim, dt) {
    const rig = CAMERA_RIG
    const want = this._want ??= new THREE.Vector3()
    want.copy(focus)
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
