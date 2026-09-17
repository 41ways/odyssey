import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * 외부 모델(.glb) 파이프라인.
 *
 * public/models/ 에 파일을 넣으면 자동으로 잡아 쓰고, 없으면 코드로 만든 인체(figure.js)로 돌아간다.
 * 그래서 모델이 하나도 없어도 게임은 항상 돌아간다 — 모델은 교체 가능한 껍데기일 뿐이다.
 *
 * 크기는 선언한 height 에 맞춰 자동으로 맞춘다. "모델이 100배 크게 나온다" 류의 사고를 원천봉쇄한다.
 */
export const MANIFEST = {
  odysseus: { url: '/models/odysseus.glb', height: 1.82 },
  kikonesWarrior: { url: '/models/kikones-warrior.glb', height: 1.78 },
  kikonesArcher: { url: '/models/kikones-archer.glb', height: 1.74 },
  cyclops: { url: '/models/cyclops.glb', height: 5.2 },
  sheep: { url: '/models/sheep.glb', height: 0.95 },
  pig: { url: '/models/pig.glb', height: 1.0 },
  // 소품 — 뼈대가 없다. 무대에 세워 두기만 한다.
  ship: { url: '/models/ship.glb', height: 6.5 },
  column: { url: '/models/column.glb', height: 3.4 },
  columnRound: { url: '/models/column-round.glb', height: 2.9 },
  tree: { url: '/models/tree.glb', height: 3.4 },
  jar: { url: '/models/jar.glb', height: 0.75 },
  pedestal: { url: '/models/pedestal.glb', height: 0.85 },
}

/** 클립 이름이 제각각이라 느슨하게 맞춘다. 앞에 있는 후보일수록 우선. */
const CLIP_HINTS = {
  idle: ['idle', 'stand', 'breath', 'tpose'],
  run: ['run', 'walk', 'jog', 'move'],
  attack: ['headbutt', 'gore', 'attack', 'swing', 'slash', 'punch', 'hit', 'strike'],
  aim: ['aim', 'draw', 'bow', 'shoot'],
  roll: ['roll', 'dodge', 'dive'],
  hurt: ['hurt', 'damage', 'flinch', 'impact'],
  die: ['die', 'death', 'dead'],
}

function matchClips(clips) {
  const out = {}
  for (const [key, hints] of Object.entries(CLIP_HINTS)) {
    for (const h of hints) {
      const found = clips.find(c => c.name.toLowerCase().includes(h))
      if (found) { out[key] = found; break }
    }
  }
  return out
}

class Models {
  constructor() {
    this.loader = new GLTFLoader()
    // prep 단계에서 draco 로 눌러 내보낸다. 디코더가 없으면 파일은 있는데
    // 조용히 '없는 모델' 로 처리돼 무대가 텅 빈 채로 돌아간다.
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    this.loader.setDRACOLoader(draco)
    this.cache = new Map()      // key -> gltf | null
    this.missing = new Set()
  }

  /** 있는 것만 조용히 불러온다. 없으면 null 로 기억하고 넘어간다. */
  async preload(keys = Object.keys(MANIFEST)) {
    await Promise.all(keys.map(async key => {
      const cfg = MANIFEST[key]
      if (!cfg || this.cache.has(key)) return
      try {
        const head = await fetch(cfg.url, { method: 'HEAD' })
        if (!head.ok) throw new Error(String(head.status))
        const gltf = await this.loader.loadAsync(cfg.url)
        this.cache.set(key, gltf)
      } catch (err) {
        this.cache.set(key, null)
        this.missing.add(key)
        this._why ??= new Map()
        this._why.set(key, String(err?.message ?? err))
      }
    }))
    if (this.missing.size) {
      console.info('[models] 못 불러온 것:',
        [...this.missing].map(k => `${k} (${this._why?.get(k) ?? '파일 없음'})`).join(', '))
    }
    return this
  }

  has(key) { return !!this.cache.get(key) }

  /**
   * 모델 한 벌을 만들어 준다. 없으면 null.
   * @returns {{ root: THREE.Group, mats: THREE.Material[], pose(state, dt): void } | null}
   */
  create(key) {
    const gltf = this.cache.get(key)
    if (!gltf) return null
    const cfg = MANIFEST[key]

    const root = new THREE.Group()
    const model = cloneRigged(gltf.scene)

    // 크기 맞추기 — 선언한 키에 자동으로 맞춘다.
    // Box3.setFromObject 는 스킨드 메시에서 뼈대까지 싸잡아 재는 일이 있어
    // (돼지 한 마리가 203 단위로 나왔다) 지오메트리의 바인드 포즈만 잰다.
    const measure = () => {
      const box = new THREE.Box3()
      model.updateWorldMatrix(true, true)
      const tmp = new THREE.Box3()
      model.traverse(o => {
        if (!o.isMesh || !o.geometry) return
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)
        box.union(tmp)
      })
      return box
    }
    const box = measure()
    const size = new THREE.Vector3()
    box.getSize(size)
    const s = size.y > 1e-4 ? cfg.height / size.y : 1
    model.scale.setScalar(s)

    // 발을 바닥에, 중심을 원점에
    const box2 = measure()
    model.position.y -= box2.min.y
    model.position.x -= (box2.min.x + box2.max.x) / 2
    model.position.z -= (box2.min.z + box2.max.z) / 2

    if (cfg.rotationY) model.rotation.y = cfg.rotationY

    const mats = []
    model.traverse(o => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      o.frustumCulled = false     // 스키닝된 메시는 바운딩이 어긋나 사라지는 일이 있다
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && !mats.includes(m)) mats.push(m)
      }
    })
    root.add(model)

    const clips = matchClips(gltf.animations ?? [])
    const mixer = gltf.animations?.length ? new THREE.AnimationMixer(model) : null
    const actions = {}
    if (mixer) for (const [k, clip] of Object.entries(clips)) actions[k] = mixer.clipAction(clip)

    let current = null
    const play = (name, fade = 0.16) => {
      const next = actions[name] ?? actions.idle
      if (!next || next === current) return
      next.reset().setEffectiveWeight(1).fadeIn(fade).play()
      current?.fadeOut(fade)
      current = next
    }

    return {
      root, mats, mixer, actions,
      /** figure.js 의 poseFigure 와 같은 자리에서 불린다. */
      pose(state, dt) {
        if (!mixer) return
        if (state.roll > 0) play('roll')
        else if (state.attack) play('attack', 0.08)
        else if (state.draw != null) play('aim')
        else if (state.run > 0.12) play('run')
        else play('idle')
        mixer.update(dt)
      },
    }
  }
}

export const models = new Models()
