import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { clamp } from '../core/math.js'
import { retargetClips } from './retarget.js'

/**
 * 모듈형 캐릭터.
 *
 * 몸 하나에 뼈대 하나. 장비는 같은 뼈대에 스킨된 별개 메시라서,
 * 붙일 때 플레이어의 뼈대에 다시 묶어 주기만 하면 포즈를 그대로 따라온다.
 * 전리품을 입는 게 곧 메시 하나 추가하는 일이 된다.
 *
 * 에셋: Quaternius (CC0) — tools/prep-models.mjs 가 원본에서 뽑아 최적화한다.
 */
const ANIMS = '/models/anims.glb'

/**
 * 몸 한 벌 = 뼈대 하나 + 그 뼈대에 스킨된 조각들.
 * 뼈 이름이 같아서 어느 벌이든 같은 클립으로 움직인다.
 */
const SETS = {
  hero: {
    body: '/models/hero-body.glb',
    gear: {
      legs: '/models/gear-legs.glb',
      feet: '/models/gear-feet.glb',
      body: '/models/gear-body.glb',
      arms: '/models/gear-arms.glb',
      pauldron: '/models/gear-pauldron.glb',
    },
  },
  // 키르케. 받아 올 수 있는 CC0 마녀는 전부 정적 모델이라 보스가 서 있기만 한다.
  // 후드 쓴 여자 몸으로 만들면 오디세우스와 같은 클립을 그대로 쓴다.
  witch: {
    body: '/models/witch-body.glb',
    gear: {
      legs: '/models/witch-legs.glb',
      feet: '/models/witch-feet.glb',
      body: '/models/witch-body-cloth.glb',
      arms: '/models/witch-arms.glb',
      pauldron: '/models/witch-pauldron.glb',
      hood: '/models/witch-hood.glb',
    },
  },
}

/** 게임 상태 → 클립. 이름은 원본 팩 것을 그대로 쓴다. */
const CLIP = {
  idle: 'Sword_Idle',
  run: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  attack: 'Sword_Attack',
  roll: 'Roll',
  aim: 'Bow_Draw',   // 받아 온 활 (없으면 pick 이 권총 조준으로 되돌린다)
  shoot: 'Bow_Shoot',
  hurt: 'Hit_Chest',
  die: 'Death01',
}
/** 위 서기·걷기·뛰기의 "팔 없는" 사본 이름 (stripArmTracks 가 만든다) */
const CORE = { idle: `${CLIP.idle}__core`, run: `${CLIP.run}__core`, sprint: `${CLIP.sprint}__core` }

/* 치는 동작 → 클립.
   전에는 누가 뭘 하든 Sword_Attack 하나였다. 오디세우스의 3 타는 프레임
   데이터가 타마다 다른데(13/16/36 데미지, 범위도 넉백도) 몸은 같은 클립을
   속도만 바꿔 세 번 틀었고, 적도 베든 찌르든 활을 쏘든 같은 동작이었다 —
   **궁수가 칼 휘두르는 몸짓으로 화살을 쐈다.**
   이름이 뜻하는 대로 붙인다. 없는 것은 pick 이 한 종류로 되돌린다. */
const SLASH = {
  slash1: 'Sword_A', slash2: 'Sword_B', slash3: 'Sword_C',   // 오디세우스 3 타
  swing: 'Sword_A', stab: 'Sword_C',                          // 적 — 베기 · 찌르기
  shot: 'Bow_Shoot',                                          // 적 궁수
  ally_spear: 'Sword_C', ally_sword: 'Sword_B',               // 동료 — 창은 찌르고 칼은 벤다
  heavy: 'Sword_A',                                           // 중격 — 크게 내려찍는다
}

const ONE_SHOT = new Set([CLIP.attack, CLIP.roll, CLIP.hurt, CLIP.die, CLIP.shoot,
  ...Object.values(SLASH)])

/* 활 동작은 애니메이션 묶음(Quaternius UAL)에 없다 — 43 개를 다 뒤져도
   칼·주먹·권총·마법뿐이라 권총 조준(Pistol_Aim_Neutral)을 빌려 쓴다.
   팔 마디를 덧돌려 시위 당기는 자세를 흉내 내 봤지만, 권총 조준이 이미
   두 팔을 앞으로 모으고 있어서 덧돌린 각도가 거의 티가 나지 않았다.
   대신 활 자체를 바로 끼우는 쪽이 훨씬 크게 먹혔다 — player.js MOUNT.bow. */

/**
 * 묶음에 없는 동작을 밖에서 받아 온다 (gameasset.net, CC0 — CREDITS.md).
 *
 * 활이 없어서 권총 조준을 빌려 쓰고 있었고, 칼 3 타는 한 클립을 속도만 바꿔
 * 세 번 틀고 있었다 — 프레임 데이터는 타마다 다른데 몸은 세 번 같았다.
 *
 * ── 팔만 옮긴다 ──
 * 처음엔 뼈대를 통째로 옮겼다. 그랬더니 오디세우스가 **공중에 수평으로
 * 누웠다.** 엉덩이 보정을 꺼도, 파일을 나눠도, 스킨을 떼도 똑같았다.
 * 골반을 빼니 다리는 제자리를 찾았는데 이번엔 허리에서 90° 접혔다.
 *
 * 받아 온 파일은 BVH 에서 변환된 것이라 몸통 뼈들의 **쉬는 자세가 우리와
 * 직각으로 다르다.** retarget 은 '쉬는 자세로부터 얼마나 돌았나' 를 옮기므로
 * 기준이 직각으로 어긋난 뼈에서는 결과도 직각으로 어긋난다. 골반도 척추도
 * 거기 해당한다.
 *
 * 팔은 다르다 — 어깨 아래로는 두 뼈대가 같은 방향으로 쉬고 있어서 그대로
 * 옮겨진다. 그리고 **우리에게 필요한 건 팔이다.** 활을 당기는 것도 칼을
 * 휘두르는 것도 팔이 하는 일이고, 몸통과 다리는 게임이 이미 잘 다룬다
 * (서 있기·달리기·구르기). 하체는 하던 동작 그대로, 팔만 활을 당긴다 —
 * 달리면서 겨누는 것도 이쪽이 자연스럽다.
 */
const EXTRA = ['Bow_Draw', 'Bow_Shoot', 'Sword_A', 'Sword_B', 'Sword_C']
const EXTRA_MAP = {
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
}

/** EXTRA_MAP 이 옮기는 목적지 뼈 — 팔 쪽. 이 이름들의 트랙만 빼면 "팔 없는" 클립이 된다. */
const ARM_BONES = new Set(Object.values(EXTRA_MAP))

/**
 * 걷기·서기 클립에서 팔 트랙만 뺀 사본을 만든다.
 *
 * 활을 당기거나 칼을 휘두르는 동안 **다리와 몸통은 하던 동작을 계속해야**
 * 자연스럽다(위 EXTRA 주석의 원래 뜻). 그런데 빌려 온 팔 동작(Sword_A 등)은
 * 팔 여덟 뼈만 담고 있어서, 이걸 단독 재생하면 나머지 뼈(척추·골반·다리)는
 * **아무도 안 돌본다** — Three.js 믹서는 가중치가 0 이 된 트랙의 뼈를 그
 * 순간 값에 얼려 버린다. 방금 전 달리기 동작의 한 프레임(허리가 앞으로
 * 굽은 순간일 수도 있다)에 몸이 그대로 굳는다. 칼을 휘두를 때마다 허리가
 * 꺾여 보이던 게 이것이다.
 *
 * 그래서 **두 켜**로 돌린다 — 이 "팔 없는" 클립이 아래에서 계속 돌고,
 * 빌려 온 팔 클립이 위에 얹힌다. 서로 다른 뼈를 담당하므로 안 겹친다.
 */
function stripArmTracks(clip) {
  const tracks = clip.tracks.filter(t => !ARM_BONES.has(t.name.split('.')[0]))
  if (tracks.length === clip.tracks.length) return null   // 팔 트랙이 없던 클립이면 만들 이유가 없다
  return new THREE.AnimationClip(`${clip.name}__core`, clip.duration, tracks)
}

async function borrowExtra(get) {
  let body
  try { body = await get(SETS.hero.body) } catch { return [] }
  const out = []
  for (const name of EXTRA) {
    try {
      const src = await get(`/models/anim/${name}.glb`)
      const made = retargetClips(body.scene, src.scene, src.animations, EXTRA_MAP)
      for (const c of made) { c.name = name; out.push(c) }
    } catch (err) {
      // 하나가 없어도 나머지는 쓴다. 빠진 것은 CLIP 이 예전 것으로 되돌린다
      console.info(`[character] '${name}' 없음:`, err.message)
    }
  }
  if (out.length) console.info(`[character] 받아 온 동작 ${out.length}종: ${out.map(c => c.name).join(', ')}`)
  return out
}

/** 벌 이름 → { body, clips, gear } · 못 불러온 벌은 false */
const cache = {}

export async function preloadCharacter() {
  if (cache.hero !== undefined) return cache.hero
  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  loader.setDRACOLoader(draco)

  const get = async url => {
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok) throw new Error(`${url} ${head.status}`)
    return loader.loadAsync(url)
  }

  // 클립은 한 벌만 받아 전부 돌려 쓴다. 뼈대가 같으니 그래도 된다.
  let clips = []
  try { clips = (await get(ANIMS)).animations } catch (err) {
    console.info('[character] 애니메이션이 없어 코드 인체로 간다:', err.message)
    for (const k of Object.keys(SETS)) cache[k] = false
    return false
  }

  // 묶음에 없는 것을 밖에서 받아 와 상체에 얹는다 (위 EXTRA 참고)
  const extra = await borrowExtra(get)
  clips = [...clips, ...extra]

  // 팔만 도는 동작이 하나라도 실렸으면, 그 밑에 깔 "팔 없는" 걷기·서기 사본을 만든다.
  // 하나도 안 실렸으면(EXTRA 를 하나도 못 받았으면) 만들 이유가 없다 — 그때는
  // 예전처럼 Sword_Attack 같은 완전한 몸 클립 하나로 돌아간다.
  if (extra.length) {
    const cores = []
    for (const name of [CLIP.idle, CLIP.run, CLIP.sprint]) {
      const base = clips.find(c => c.name === name)
      const core = base && stripArmTracks(base)
      if (core) cores.push(core)
    }
    clips = [...clips, ...cores]
  }

  await Promise.all(Object.entries(SETS).map(async ([name, spec]) => {
    try {
      const [body, ...gearList] = await Promise.all([
        get(spec.body), ...Object.values(spec.gear).map(get),
      ])
      const gear = {}
      Object.keys(spec.gear).forEach((k, i) => { gear[k] = gearList[i] })
      cache[name] = { body, clips, gear }
    } catch (err) {
      cache[name] = false
      console.info(`[character] '${name}' 벌 없음 — 코드 인체로 간다:`, err.message)
    }
  }))
  const ok = Object.entries(cache).filter(([, v]) => v).map(([k]) => k)
  console.info(`[character] 준비된 몸: ${ok.join(', ') || '없음'} · 클립 ${clips.length}종`)
  return cache.hero
}

export const hasCharacter = (set = 'hero') => !!cache[set]

/** 오디세우스의 뼈대와 동작 묶음. 다른 몸이 동작을 빌려 갈 때 쓴다 (retarget.js). */
export const heroKit = () => (cache.hero ? { scene: cache.hero.body.scene, clips: cache.hero.clips } : null)

/** 장비 메시를 몸의 뼈대에 다시 묶는다. 뼈 이름이 같아야 한다 (66개 일치 확인됨). */
function rebind(scene, boneByName) {
  const meshes = []
  scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o) })
  for (const m of meshes) {
    const bones = m.skeleton.bones.map(b => boneByName.get(b.name) ?? b)
    m.skeleton = new THREE.Skeleton(bones, m.skeleton.boneInverses)
  }
  return meshes
}

/**
 * @param {object} o
 *   height  키. 원본이 몇 미터든 여기 맞춰진다
 *   tint    몸·장비 색조. 적을 부족색으로 물들일 때 쓴다
 *   gear    처음부터 입고 시작할 조각들
 *   bulk    가로 비율. 1보다 크면 육중해 보인다
 *   set     몸 한 벌 — 'hero' 아니면 'witch'
 */
export function createCharacter({ height = 1.82, facing = 0, tint = null, gear: initialGear = [], bulk = 1, set = 'hero' } = {}) {
  const kit = cache[set] || cache.hero
  if (!kit) return null

  const root = new THREE.Group()
  const model = cloneRigged(kit.body.scene)

  // 키 맞추기 — 원본이 몇 미터든 선언한 키로 맞춘다
  const box = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3(); box.getSize(size)
  const scale = size.y > 1e-4 ? height / size.y : 1
  model.scale.set(scale * bulk, scale, scale * bulk)
  const box2 = new THREE.Box3().setFromObject(model)
  model.position.y -= box2.min.y
  model.rotation.y = facing

  // 재질은 캐릭터마다 따로 갖는다.
  // 공유하면 한 마리가 맞을 때 같은 재질을 쓰는 전부가 같이 번쩍인다.
  // 텍스처는 클론끼리 공유되므로 메모리는 거의 안 늘어난다.
  const mats = []
  const clonedBySource = new Map()
  const ownMaterial = src => {
    if (!src) return src
    let m = clonedBySource.get(src)
    if (!m) {
      m = src.clone()
      if (tint && m.color) m.color.multiply(new THREE.Color(tint))
      clonedBySource.set(src, m)
      mats.push(m)
    }
    return m
  }
  const collect = o => {
    if (!o.isMesh) return
    o.castShadow = true
    o.receiveShadow = true
    o.frustumCulled = false     // 스키닝 메시는 바운딩이 어긋나 사라지는 일이 있다
    o.material = Array.isArray(o.material) ? o.material.map(ownMaterial) : ownMaterial(o.material)
  }
  model.traverse(collect)
  root.add(model)

  const boneByName = new Map()
  model.traverse(o => { if (o.isBone) boneByName.set(o.name, o) })
  const skinHost = model.getObjectByProperty('isSkinnedMesh', true)

  // 장비 — 미리 붙여 두고 숨긴다. 얻을 때 켜기만 하면 된다.
  const gearMeshes = {}
  for (const [key, gltf] of Object.entries(kit.gear)) {
    const piece = cloneRigged(gltf.scene)
    const meshes = rebind(piece, boneByName)
    gearMeshes[key] = meshes
    for (const m of meshes) {
      m.visible = false
      collect(m)
      skinHost.parent.add(m)
      m.bind(m.skeleton, m.bindMatrix)
    }
  }

  for (const id of initialGear) for (const m of gearMeshes[id] ?? []) m.visible = true

  const mixer = new THREE.AnimationMixer(model)
  const actions = {}
  for (const clip of kit.clips) {
    const a = mixer.clipAction(clip)
    if (ONE_SHOT.has(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true }
    actions[clip.name] = a
  }

  /* 받아 온 동작이 안 실렸으면 묶음 안의 대역으로 조용히 되돌아간다 */
  const FALLBACK = { Bow_Draw: 'Pistol_Aim_Neutral', Bow_Shoot: 'Pistol_Shoot' }
  const pick = name => (actions[name] ? name : (FALLBACK[name] ?? CLIP.attack))

  let current = null
  const play = (name, { fade = 0.14, speed = 1, restart = false } = {}) => {
    const next = actions[name] ?? actions[CLIP.idle]
    if (!next) return
    next.setEffectiveTimeScale(speed)
    if (next === current && !restart) return
    if (next === current && restart) { next.reset().play(); return }
    next.reset().setEffectiveWeight(1).fadeIn(fade).play()
    current?.fadeOut(fade)
    current = next
  }

  /**
   * 아래 켜 — 팔 없는 걷기·서기. `play()` 와 똑같이 생겼지만 독립된
   * 슬롯(`currentCore`)을 쓴다. 팔 동작(EXTRA)이 도는 동안만 켜 두고,
   * 몸 전체를 쓰는 동작으로 돌아가면 꺼서 같은 뼈를 두 번 모는 일이
   * 없게 한다 (stripArmTracks 주석 참고).
   */
  let currentCore = null
  const playCore = (name, { fade = 0.14, speed = 1 } = {}) => {
    const next = actions[name]
    if (!next) return
    next.setEffectiveTimeScale(speed)
    if (next !== currentCore) {
      next.reset().setEffectiveWeight(1).fadeIn(fade).play()
      currentCore?.fadeOut(fade)
      currentCore = next
    }
  }
  const stopCore = (fade = 0.15) => {
    if (!currentCore) return
    currentCore.fadeOut(fade)
    currentCore = null
  }
  /** 한 번짜리 동작은 게임의 지속시간에 맞춰 재생 속도를 바꾼다. */
  const fitSpeed = (name, seconds) => {
    const d = actions[name]?.getClip().duration
    return d && seconds > 0 ? d / seconds : 1
  }

  let lastOneShot = null

  return {
    root, mats, mixer, actions, boneByName,

    /**
     * 관절에 직접 매단다 (무기·투구·망토).
     *
     * 본의 축은 엔진마다 제각각이다 (UE 릭은 뼈가 X 축을 따라 뻗는다).
     * 그대로 붙이면 프롭이 눕거나 뒤집힌다. 그래서 바인드 포즈에서 본의 회전을
     * 한 번 상쇄해 캐릭터 기준 축(+Y 위, +Z 앞)으로 맞춘 뒤, 그 위에 내 오프셋을 얹는다.
     * 상쇄값은 고정 로컬 오프셋이라 애니메이션이 돌면 프롭도 같이 따라간다.
     */
    attachTo(boneName, object3d, { scale = 1, position, rotation } = {}) {
      const bone = boneByName.get(boneName)
      if (!bone) { console.warn(`[character] 본 없음: ${boneName}`); return null }
      bone.updateWorldMatrix(true, false)
      root.updateWorldMatrix(true, false)

      const bq = new THREE.Quaternion(); bone.getWorldQuaternion(bq)
      const rq = new THREE.Quaternion(); root.getWorldQuaternion(rq)
      const ws = new THREE.Vector3().setFromMatrixScale(bone.matrixWorld)

      const holder = new THREE.Group()          // 본 축 → 캐릭터 축 보정
      holder.quaternion.copy(bq).invert().multiply(rq)
      holder.scale.setScalar(1 / (ws.x || 1))
      bone.add(holder)

      const mount = new THREE.Group()           // 여기서부터는 직관적인 축
      if (position) mount.position.fromArray(position)
      if (rotation) mount.rotation.fromArray(rotation)
      mount.scale.setScalar(scale)
      mount.add(object3d)
      holder.add(mount)
      return mount
    },

    /**
     * 본이 아니라 캐릭터 몸통 기준으로 단다.
     * 망토처럼 "등에 걸려 있되 전투 자세의 상체 비틀림까지 따라가면 곤란한" 것에 쓴다.
     * 위치가 예측 가능해서 흔들림을 전부 코드로 통제할 수 있다.
     */
    attachToBody(object3d, { position = [0, 0, 0], rotation, scale = 1 } = {}) {
      const mount = new THREE.Group()
      mount.position.fromArray(position)
      if (rotation) mount.rotation.fromArray(rotation)
      mount.scale.setScalar(scale)
      mount.add(object3d)
      root.add(mount)
      return mount
    },

    /** 본 목록. 붙일 자리를 찾을 때 콘솔에서 본다. */
    boneNames() { return [...boneByName.keys()] },
    /** 이름으로 뼈 하나 */
    bone(name) { return boneByName.get(name) ?? null },

    equip(id) { const ms = gearMeshes[id] ?? []; for (const m of ms) m.visible = true; return ms },
    unequipAll() { for (const list of Object.values(gearMeshes)) for (const m of list) m.visible = false },

    pose(s, dt) {
      // 쓰러져 있는 동안 — 죽는 동작을 쓰되 끝까지 가지 않는다.
      // 끝까지 가면 완전히 엎어져서 '죽었다'로 읽히고, 드러난 약점도 바닥에 묻힌다.
      const die = actions[CLIP.die]
      if (s.down) {
        if (lastOneShot !== 'down') {
          play(CLIP.die, { fade: 0.22, speed: 1, restart: true })
          lastOneShot = 'down'
          if (die) die.paused = false
        }
        if (die) {
          // 끝까지 가면 등을 대고 완전히 눕는다. 그러면 '죽었다' 로 읽히고
          // 드러난 약점(눈)도 바닥에 붙어 맞히기가 어려워진다. 무릎 꿇는 자리에서 멈춘다.
          const stopAt = die.getClip().duration * (s.downHold ?? 0.3)
          if (die.time >= stopAt) { die.time = stopAt; die.paused = true }
        }
        mixer.update(dt)
        return
      }
      if (die?.paused) die.paused = false

      /* 팔만 도는 동작(EXTRA)을 골랐으면, 그 밑에 다리·몸통용 "팔 없는" 동작을
         같이 깐다 — 지금 움직이는 정도(s.run)에 맞춰 서기/걷기/뛰기 중 하나.
         몸 전체를 쓰는 동작(죽음·구르기·완전한 칼질 대역)일 때는 꺼 둔다 —
         안 그러면 같은 뼈를 두 켜가 동시에 몰아서 되레 어긋난다.
         `fade` 는 팔 쪽(`play()`)에 준 값과 맞춰서 받는다 — 처음 켜질 때
         (currentCore 가 비어 있을 때) 팔은 0.05초 만에 확 바뀌는데 몸통이
         기본값(0.16초)으로 천천히 따라오면, 그 사이 팔은 이미 새 동작인데
         몸통은 아직 직전 자세에 걸려 있는 구간이 110ms 가까이 생긴다.
         칼을 휘두르는 순간 몸이 두 자세로 겹쳐 보인 게 이것이었다 — 켜는
         순간만 팔과 같은 속도로 맞추고, 이미 돌고 있는 core 끼리(서기→
         걷기→뛰기) 바뀌는 자연스러운 전환은 원래 속도(0.16초)를 그대로 쓴다. */
      const layerCore = (fade = 0.16) => {
        const name = s.run > 0.85 ? CORE.sprint : s.run > 0.12 ? CORE.run : CORE.idle
        if (actions[name]) playCore(name, { fade: currentCore ? fade : Math.min(fade, 0.05), speed: 0.85 + s.run * 0.35 })
        else stopCore()
      }

      if (s.dead) { play(CLIP.die, { fade: 0.2, speed: 1 }); stopCore() }
      else if (s.roll > 0) {
        if (lastOneShot !== 'roll') { play(CLIP.roll, { fade: 0.06, speed: fitSpeed(CLIP.roll, s.rollDuration ?? 0.44), restart: true }); lastOneShot = 'roll' }
        stopCore()
      } else if (s.attack) {
        const key = `atk${s.attackId ?? ''}`
        if (lastOneShot !== key) {
          // 타마다 다른 동작. 없으면 한 종류로 돌아간다
          const name = pick(SLASH[s.attackId] ?? CLIP.attack)
          play(name, { fade: 0.05, speed: fitSpeed(name, s.attackDuration ?? 0.4), restart: true })
          lastOneShot = key
        }
        // 대역(Sword_Attack)은 몸 전체 클립이라 밑에 깔 필요가 없다 — 팔만 도는 것일 때만
        if (EXTRA.includes(current?.getClip().name)) layerCore(0.05); else stopCore()
      } else if (s.draw != null) {
        const name = pick(CLIP.aim)
        play(name, { fade: 0.12 })
        lastOneShot = null
        if (EXTRA.includes(name)) layerCore(0.12); else stopCore()
      }
      else if (s.run > 0.12) { play(s.run > 0.85 ? CLIP.sprint : CLIP.run, { fade: 0.16, speed: 0.85 + s.run * 0.35 }); lastOneShot = null; stopCore() }
      else { play(CLIP.idle, { fade: 0.2 }); lastOneShot = null; stopCore() }

      mixer.update(dt)
    },

    setTint(color, amount) {
      for (const m of mats) {
        if (!m.emissive) continue
        m.emissive.setRGB(color.r * amount, color.g * amount, color.b * amount)
      }
    },

    dispose() { mixer.stopAllAction() },
  }
}

export { CLIP, clamp }
