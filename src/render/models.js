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
 *
 * **판마다 따로 받는다.** 전에는 시작할 때 전부 내려받아서, 좋은 모델 하나가
 * 첫 화면이 뜨는 시간을 통째로 잡아먹었다. 이제 판에 들어갈 때 그 판에 나오는
 * 것만 받는다 (STAGE_MODELS) — 스킬라의 촉수는 메시나에 닿기 전에는 없어도 된다.
 */
export const MANIFEST = {
  odysseus: { url: '/models/odysseus.glb', height: 1.82 },
  kikonesWarrior: { url: '/models/kikones-warrior.glb', height: 1.78 },
  kikonesArcher: { url: '/models/kikones-archer.glb', height: 1.74 },
  cyclops: { url: '/models/cyclops.glb', height: 5.2 },
  sheep: { url: '/models/sheep.glb', height: 0.95 },
  pig: { url: '/models/pig.glb', height: 1.0 },
  wolf: { url: '/models/wolf.glb', height: 1.05 },
  // 소품 — 뼈대가 없다. 무대에 세워 두기만 한다.
  ship: { url: '/models/ship.glb', height: 6.5 },
  column: { url: '/models/column.glb', height: 3.4 },
  columnRound: { url: '/models/column-round.glb', height: 2.9 },
  tree: { url: '/models/tree.glb', height: 3.4 },
  jar: { url: '/models/jar.glb', height: 0.75 },
  pedestal: { url: '/models/pedestal.glb', height: 0.85 },
  // 돌 뱀 머리 — 스킬라의 여섯 머리에 돌려 쓴다 (tools/prep-gen.mjs 로 깎았다)
  serpentHead: { url: '/models/serpent-head.glb', height: 1.0 },
  // ── 스케치팹에서 받은 보스 몸 (CREDITS.md 참고) ──
  // 폴리페모스. 리깅 + Idle 애니 포함. 공용 사람 몸 대신 이걸 쓴다.
  cyclopsBody: { url: '/models/cyclops.glb', height: 6.4 },
  // 스킬라. 머리 여덟 달린 뱀 — 스킬라 여섯 머리의 대역이다. 정적 메시.
  orochi: { url: '/models/orochi.glb', height: 5.5 },
  // 받아 온 보스 몸. 판에 들어갈 때만 내려받는다 (STAGE_MODELS).
  skylla: { url: '/models/skylla.glb', height: 5.0, center: false },
  // 헤엄치는 자세로 누워 있다. 꼬리를 아래로 세운다.
  siren: { url: '/models/siren.glb', height: 2.4, rotate: [-Math.PI / 2, 0, 0] },
  antiphates: { url: '/models/antiphates.glb', height: 4.6 },
  // 절벽 바위. 스킬라 절벽과 동굴 판에 뿌린다.
  cliffRock: { url: '/models/cliff-rock.glb', height: 2.2 },
  /**
   * 촉수 — 뼈대 21 마디에 Attack · Attack2 · Idle · Poke 네 클립.
   * Quaternius (CC0), poly.pizza 경유. 이것 하나가 스킬라의 여섯 머리와
   * 카리브디스의 촉수를 **둘 다** 대신한다. 전에는 둘 다 코드로 만든
   * 원통 마디였다 (bossparts.js 의 tentacle()).
   *
   * +z 로 누운 막대라 z 축으로 키를 맞추고(axis), 뿌리를 원점에 두려고
   * 중심 맞추기를 끈다(center). 뿌리가 원점이어야 벽에 심을 수 있다.
   */
  tentacle: { url: '/models/tentacle.glb', scale: 0.165, center: false },
  /**
   * 거인 — Attack · Idle · Run · Walk · Jump · HitRecieve · Death 일곱 클립.
   * Quaternius (CC0), poly.pizza 경유. 안티파테스가 여태 **사람 몸을 4.6 미터로
   * 늘린 것**이었다 — 실루엣이 사람이면 '식인 거인의 왕' 이 몸에 안 보인다.
   */
  giant: { url: '/models/giant.glb', height: 4.6 },
  /**
   * 돌 뱀 — Attack · Idle · Walk · Jump 네 클립, 뼈 열다섯 (Body·Neck·Head·Tail·Mouth·Tongue).
   * Quaternius (CC0), poly.pizza 경유.
   *
   * 스킬라의 여섯 머리가 이것이다. 촉수 여섯을 부챗살로 뻗어 봤는데
   * 한 마리 오징어 팔로 읽혔다 — 여섯이 **각자 따로 움직이고 각자 물어야**
   * 메두사 머리처럼 보인다. 그래서 한 마리씩 제 뼈대와 제 시간을 갖는
   * 이 모델로 갈았다 (bossparts.js 의 skyllaWall).
   *
   * 촉수와 같은 단위 어긋남이 있어 scale 을 박는다 (MANIFEST.scale 주석 참고).
   */
  snake: { url: '/models/snake.glb', scale: 0.4, center: false },
  /**
   * 구혼자들의 우두머리와 오디세우스의 아들.
   *
   * 둘이 여태 **똑같이 생겼다.** 공용 사람 몸에 같은 장비를 입히고 색만
   * 달랐으니, 마지막 두 보스가 잡졸과도 구분이 안 됐다. 이름이 다르면
   * 몸도 달라야 한다.
   *
   * 같은 모듈러 팩의 두 캐릭터라 뼈대가 같고 (Quaternius, CC0) 클립
   * 스물넷을 공유한다 — Idle_Sword · Sword_Slash · Run · Roll · HitRecieve ·
   * Death 가 다 있어서, 공용 사람 몸보다 오히려 동작이 많다.
   *   왕(금·청동을 두른 귀족)  → 안티노오스, 남의 집에서 왕처럼 굴던 자
   *   후드를 쓴 자             → 텔레고노스, 바다에서 온 모르는 아들
   */
  king: { url: '/models/king.glb', height: 1.88 },
  hooded: { url: '/models/hooded.glb', height: 1.84 },
}

/** 클립 이름이 제각각이라 느슨하게 맞춘다. 앞에 있는 후보일수록 우선. */
const CLIP_HINTS = {
  idle: ['idle', 'stand', 'breath', 'tpose'],
  run: ['gallop', 'run', 'walk', 'jog', 'move'],
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

/**
 * 판마다 필요한 모델.
 *
 * 여기 없는 것은 시작할 때 다 받는다 (플레이어·잡몹처럼 어느 판에나 나오는 것).
 * 보스와 그 판에만 나오는 소품만 여기로 미룬다.
 */
export const STAGE_MODELS = {
  ismaros: ['cyclops', 'cyclopsBody', 'sheep'],
  telepylos: ['antiphates', 'giant', 'cliffRock'],
  aiaia: ['hooded', 'pig', 'wolf', 'tree'],
  underworld: [],
  sirens: ['siren', 'ship'],
  messina: ['skylla', 'tentacle', 'serpentHead', 'snake', 'ship'],
  ithaca: ['king', 'column', 'jar'],
  death: [],
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

  /**
   * 한 판에 필요한 것만 받는다. 이미 받은 것은 건너뛴다.
   * @returns 새로 받은 개수 (0 이면 로딩 화면을 띄울 필요가 없다)
   */
  async loadStage(id) {
    const want = (STAGE_MODELS[id] ?? []).filter(k => !this.cache.has(k))
    if (!want.length) return 0
    await this.preload(want)
    return want.length
  }

  /** 시작할 때 받을 것 — 어느 판에나 나오는 것만. */
  baseKeys() {
    const perStage = new Set(Object.values(STAGE_MODELS).flat())
    return Object.keys(MANIFEST).filter(k => !perStage.has(k))
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
    // 눕혀 놓고 만든 모델이 있다 (헤엄치는 인어처럼). 재기 전에 먼저 세운다 —
    // 재고 나서 돌리면 키를 엉뚱한 축으로 맞추게 된다.
    if (cfg.rotate) model.rotation.set(cfg.rotate[0] ?? 0, cfg.rotate[1] ?? 0, cfg.rotate[2] ?? 0)

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
    /**
     * 어느 축으로 키를 맞출 것인가.
     *
     * 기본은 y 다 — 사람이든 짐승이든 서 있는 것은 키로 잰다. 그런데
     * **누워 있는 것**은 y 가 거의 0 이다. 촉수는 +z 로 뻗은 막대라
     * y 두께가 0.021 밖에 안 되고, 그걸로 키를 맞추면 배수가 47 배가 되어
     * 촉수 하나가 판을 덮는다. 그런 모델은 뻗은 축으로 재야 한다.
     */
    const axis = cfg.axis ?? 'y'
    const along = size[axis]
    /**
     * `scale` 을 박아 두면 자동 맞추기를 건너뛴다.
     *
     * 자동 맞추기는 **바인드 포즈**를 잰다. 대개는 그게 맞는데, 받아 온
     * 파일 중에는 바인드 포즈와 애니메이션 트랙의 단위가 어긋난 게 있다 —
     * 촉수 모델이 그랬다. 바인드 포즈는 0.197 인데 애니메이션이 뼈를
     * 20 단위 밖으로 보낸다 (FBX 의 센티미터 단위가 트랙에만 남은 것이다).
     * 그러면 바인드 포즈로 잰 배수가 100 배쯤 어긋나서, 가만히 있을 때는
     * 맞고 움직이기 시작하면 촉수 하나가 투기장을 덮는다.
     *
     * 이럴 때는 재지 말고 숫자를 박는 게 맞다. 재는 것이 틀린 걸
     * 더 정교하게 재서 고칠 수는 없다.
     */
    const s = cfg.scale ?? (along > 1e-4 ? cfg.height / along : 1)
    model.scale.setScalar(s)

    // 발을 바닥에, 중심을 원점에.
    // center: false 면 원점을 그대로 둔다 — 촉수처럼 **뿌리가 원점이어야**
    // 하는 것은 중심을 맞추면 뿌리가 허공으로 간다.
    const box2 = measure()
    if (cfg.center !== false) {
      model.position.y -= box2.min.y
      model.position.x -= (box2.min.x + box2.max.x) / 2
      model.position.z -= (box2.min.z + box2.max.z) / 2
    }

    if (cfg.rotationY) model.rotation.y = cfg.rotationY
    const baseY = model.position.y

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

    // 달리기 클립이 없는 모델(받아 온 동물 대부분)은 가만히 서서 미끄러진다.
    // 클립을 만들 수는 없으니 몸통을 위아래로 흔들고 앞으로 기울여 흉내만 낸다.
    const trot = { t: 0, baseY }
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
        const running = state.run > 0.12
        if (mixer) {
          if (state.roll > 0) play('roll')
          else if (state.attack) play('attack', 0.08)
          else if (state.draw != null) play('aim')
          else if (running) play('run')
          else play('idle')
          mixer.update(dt)
        }
        if (!actions.run) {
          // 걸음 시늉 — 있는 클립이 달리기를 맡고 있으면 건드리지 않는다
          trot.t += dt * (running ? 9 : 0)
          const k = running ? 1 : 0
          trot.k = (trot.k ?? 0) + ((k - (trot.k ?? 0)) * Math.min(1, dt * 8))
          model.position.y = trot.baseY + Math.abs(Math.sin(trot.t)) * 0.09 * trot.k
          model.rotation.x = -0.12 * trot.k + Math.sin(trot.t * 2) * 0.03 * trot.k
        }
      },
    }
  }
}

export const models = new Models()
