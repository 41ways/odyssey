import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { heroKit } from './character.js'
import { retargetClips } from './retarget.js'

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
  // 숲 바닥 — 나무는 판 가장자리에만 있어 싸우는 동안 화면에 안 들어온다.
  // 발밑에 덤불·풀이 있어야 '숲 속' 이 된다 (Quaternius, CC0)
  bush: { url: '/models/bush.glb', height: 1.25 },
  flowerbush: { url: '/models/flowerbush.glb', height: 0.9 },
  grass: { url: '/models/grass.glb', height: 0.38 },
  pedestal: { url: '/models/pedestal.glb', height: 0.85 },
  // 돌 뱀 머리 — 스킬라의 여섯 머리에 돌려 쓴다 (tools/prep-gen.mjs 로 깎았다)
  serpentHead: { url: '/models/serpent-head.glb', height: 1.0 },
  // ── 스케치팹에서 받은 보스 몸 (CREDITS.md 참고) ──
  // 폴리페모스. 리깅 + Idle 애니 포함. 공용 사람 몸 대신 이걸 쓴다.
  cyclopsBody: { url: '/models/cyclops.glb', height: 6.4, impact: 0.45,
    /* Idle 하나뿐이라 서 있기만 했다 ("움직임이 없던데"). 뼈는 제대로 있으니
       오디세우스의 동작을 빌려 온다 (retarget.js). 몽둥이 대신 맨손이지만
       내려치는 궤적은 같다. 손가락·사슬·IK 뼈는 짝을 안 지어 쉬는 자세로 둔다. */
    borrow: {
      clips: ['Sword_Attack', 'Jog_Fwd_Loop', 'Death01', 'Hit_Chest'],
      hips: ['pelvis', 'Pelvis_108'],
      feet: ['foot_l', 'Foot.L_80'],
      map: {
        pelvis: 'Pelvis_108', spine_01: 'Spine_77', spine_03: 'Torso_76',
        neck_01: 'Neck_8', Head: 'Head_7',
        clavicle_l: 'Shoulder.L_33', upperarm_l: 'Upperarm.L_32', lowerarm_l: 'Forearm.L_22', hand_l: 'Hand.L_20',
        clavicle_r: 'Shoulder.R_58', upperarm_r: 'Upperarm.R_57', lowerarm_r: 'Forearm.R_56', hand_r: 'Hand.R_45',
        thigh_l: 'Thigh.L_82', calf_l: 'Shin.L_81', foot_l: 'Foot.L_80',
        thigh_r: 'Thigh.R_97', calf_r: 'Shin.R_87', foot_r: 'Foot.R_86',
      },
    } },
  // 스킬라. 머리 여덟 달린 뱀 — 스킬라 여섯 머리의 대역이다. 정적 메시.
  orochi: { url: '/models/orochi.glb', height: 5.5 },
  // 받아 온 보스 몸. 판에 들어갈 때만 내려받는다 (STAGE_MODELS).
  skylla: { url: '/models/skylla.glb', height: 5.0, center: false },
  /* 인어. 파일 안의 메시가 이미 스스로 세워져 있다 (Object_2 에 -90° 가 들어 있다).
     예전에 여기서 한 번 더 -90° 로 눕혔는데, 그러면 두께(1.33)로 키를 맞춰
     배율이 1.8 이 되고 — 아래 흔들기가 rotation.x 를 덮어써 도로 서는 순간
     키 15.7 짜리 기둥이 갑판을 덮었다 (QA 에서 머리가 화면 밖이었다).
     돌리지 않는다. 꼬리로 선 채 키 4.2 — 사람의 두 배 남짓, 올려다보는 높이. */
  siren: { url: '/models/siren.glb', height: 4.2 },
  antiphates: { url: '/models/antiphates.glb', height: 4.6 },
  // 절벽 바위. 스킬라 절벽과 동굴 판에 뿌린다.
  cliffRock: { url: '/models/cliff-rock.glb', height: 2.2 },
  // 층이 진 큰 바위 (Quaternius, CC0). 저승 벽을 쌓는다 — 잡석 파일은 각진
  // 상자 모양이라 벽 크기로 키우면 상자 무더기로 읽혔다
  crag: { url: '/models/crag.glb', height: 2.0 },
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
  aiaia: ['hooded', 'pig', 'wolf', 'tree', 'bush', 'flowerbush', 'grass'],
  // 저승: 바위 벽(잡석 파일), 페르세포네의 검은 나무, 잿빛 아스포델
  underworld: ['crag', 'tree', 'flowerbush'],
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
  /**
   * 이 모델이 쓸 클립 — 제 것에 빌려 온 것을 더한다. 한 번 구우면 캐시한다.
   * 오디세우스의 동작 묶음이 아직 없으면 제 것만 쓰고, 다음 번에 다시 시도한다.
   */
  #animationsFor(key, gltf) {
    const own = gltf.animations ?? []
    const borrow = MANIFEST[key]?.borrow
    if (!borrow) return own
    if (gltf.userData.borrowed) return gltf.userData.borrowed
    const kit = heroKit()
    if (!kit) return own
    try {
      const want = kit.clips.filter(c => borrow.clips.includes(c.name))
      const made = retargetClips(gltf.scene, kit.scene, want, borrow.map, { hips: borrow.hips, feet: borrow.feet })
      gltf.userData.borrowed = [...own, ...made]
      console.info(`[models] ${key}: 빌려 온 동작 ${made.map(c => c.name).join(', ')}`)
    } catch (err) {
      console.warn(`[models] ${key} 동작 빌리기 실패:`, err.message)
      gltf.userData.borrowed = own
    }
    return gltf.userData.borrowed
  }

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

    const anims = this.#animationsFor(key, gltf)
    const clips = matchClips(anims)
    const mixer = anims.length ? new THREE.AnimationMixer(model) : null
    const actions = {}
    if (mixer) for (const [k, clip] of Object.entries(clips)) actions[k] = mixer.clipAction(clip)

    /**
     * 받아 온 모델에 그 동작이 없으면 몸으로 흉내 낸다.
     *
     * 클립이 하나도 없는 모델(정지 조각)이 적지 않다. 그대로 두면 보스가
     * 얼어붙은 채로 장판만 깔아서, 때리는 건지 서 있는 건지 알 수가 없다.
     * 클립을 만들 수는 없으니 **몸통 하나를 움직인다** —
     *   숨: 늘 조금 오르내린다. 이것만 있어도 '살아 있는 것' 이 된다
     *   걸음: 위아래로 튀고 앞으로 기운다
     *   치기: 선딜에 뒤로 젖혔다가 맞는 순간 앞으로 꽂는다
     * 몸 전체가 한 덩어리로 움직이니 클립만큼은 아니지만, 멈춰 있는 것보다
     * 훨씬 많은 것을 말한다.
     */
    // 흔들기는 모델이 원래 가진 기울기 **위에** 얹는다. 덮어쓰면 manifest 의
    // rotate 가 첫 프레임에 지워진다 (세이렌이 그렇게 거인이 됐다).
    const fake = { t: 0, breath: 0, baseY, baseRX: model.rotation.x, lean: 0, drop: 0 }
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
          const die = actions.die
          if ((state.dead || state.down) && die) {
            // 쓰러짐. 한 번만 틀고 멈춘다. 무너진 채(down)면 클립 중간에서 세운다 —
            // 다 누우면 머리가 바닥에 붙어 약점을 못 맞힌다 (character.js 와 같은 규칙).
            if (current !== die) {
              die.setLoop(THREE.LoopOnce, 1)
              die.clampWhenFinished = true
              play('die', 0.22)
            }
            if (state.down && !state.dead) {
              const stopAt = die.getClip().duration * (state.downHold ?? 0.3)
              if (die.time >= stopAt) { die.time = stopAt; die.paused = true }
            }
          } else {
            if (die?.paused) die.paused = false
            if (state.roll > 0) play('roll')
            else if (state.attack) {
              play('attack', 0.08)
              /* 치는 클립을 보스의 박자에 묶는다.
                 그냥 틀면 클립이 제 속도로 돌아서, 주먹이 내려오는 순간과
                 붉은 판정이 뜨는 순간이 어긋난다 — 예고를 보고 피하는 게임에서
                 그건 거짓말이다. 예고(startup) 동안 클립의 impact 지점까지,
                 판정 이후 나머지를 편다. */
              const a = actions.attack, at = state.attackT
              if (a && at) {
                const dur = a.getClip().duration, imp = cfg.impact ?? 0.42
                const k = at.t < at.startup
                  ? (at.t / Math.max(1e-3, at.startup)) * imp
                  : imp + Math.min(1, (at.t - at.startup) / Math.max(1e-3, at.active + at.recovery)) * (1 - imp)
                a.time = dur * Math.min(0.999, k)
                a.paused = true
              }
            }
            else if (state.draw != null) play('aim')
            else if (running) play('run')
            else play('idle')
          }
          mixer.update(dt)
        }
        // 없는 동작만 몸으로 메운다. 클립이 맡고 있는 건 건드리지 않는다.
        const needRun = !actions.run
        const needAtk = !actions.attack
        const needIdle = !actions.idle
        if (!needRun && !needAtk && !needIdle) return

        fake.t += dt * (running ? 9 : 0)
        fake.breath += dt * 1.25
        const k = running ? 1 : 0
        fake.k = (fake.k ?? 0) + ((k - (fake.k ?? 0)) * Math.min(1, dt * 8))

        // 치기 — 보스가 넘겨 주는 wind(선딜)·swing(휘두름) 을 그대로 쓴다
        let lean = 0, drop = 0
        if (needAtk && state.attack) {
          const w = state.attack.wind ?? 0, sw = state.attack.swing ?? 0
          lean = w * 0.30 - sw * 0.52      // 젖혔다가 꽂는다
          drop = sw * 0.16                  // 내리치며 몸이 내려간다
        }
        fake.lean += (lean - fake.lean) * Math.min(1, dt * 16)
        fake.drop += (drop - fake.drop) * Math.min(1, dt * 16)

        // 숨 — 클립이 없을 때만. 있으면 그쪽이 이미 숨을 쉰다.
        const breathe = needIdle ? Math.sin(fake.breath) * 0.02 : 0

        const bob = needRun ? Math.abs(Math.sin(fake.t)) * 0.09 * fake.k : 0
        const runLean = needRun ? -0.12 * fake.k + Math.sin(fake.t * 2) * 0.03 * fake.k : 0
        model.position.y = fake.baseY + bob + breathe - fake.drop
        model.rotation.x = fake.baseRX + runLean + fake.lean
      },
    }
  }
}

export const models = new Models()
