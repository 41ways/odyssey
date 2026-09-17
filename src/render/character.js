import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { clamp } from '../core/math.js'

/**
 * 모듈형 캐릭터.
 *
 * 몸 하나에 뼈대 하나. 장비는 같은 뼈대에 스킨된 별개 메시라서,
 * 붙일 때 플레이어의 뼈대에 다시 묶어 주기만 하면 포즈를 그대로 따라온다.
 * 전리품을 입는 게 곧 메시 하나 추가하는 일이 된다.
 *
 * 에셋: Quaternius (CC0) — tools/prep-models.mjs 가 원본에서 뽑아 최적화한다.
 */
const FILES = {
  body: '/models/hero-body.glb',
  anims: '/models/anims.glb',
  gear: {
    legs: '/models/gear-legs.glb',
    feet: '/models/gear-feet.glb',
    body: '/models/gear-body.glb',
    arms: '/models/gear-arms.glb',
    pauldron: '/models/gear-pauldron.glb',
  },
}

/** 게임 상태 → 클립. 이름은 원본 팩 것을 그대로 쓴다. */
const CLIP = {
  idle: 'Sword_Idle',
  run: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  attack: 'Sword_Attack',
  roll: 'Roll',
  aim: 'Pistol_Aim_Neutral',   // 활 조준으로 전용한다
  shoot: 'Pistol_Shoot',
  hurt: 'Hit_Chest',
  die: 'Death01',
}

const ONE_SHOT = new Set([CLIP.attack, CLIP.roll, CLIP.hurt, CLIP.die, CLIP.shoot])

let cache = null

export async function preloadCharacter() {
  if (cache !== null) return cache
  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  loader.setDRACOLoader(draco)

  const get = async url => {
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok) throw new Error(`${url} ${head.status}`)
    return loader.loadAsync(url)
  }

  try {
    const [body, anims, ...gearList] = await Promise.all([
      get(FILES.body), get(FILES.anims),
      ...Object.values(FILES.gear).map(get),
    ])
    const gear = {}
    Object.keys(FILES.gear).forEach((k, i) => { gear[k] = gearList[i] })
    cache = { body, clips: anims.animations, gear }
    console.info(`[character] 모델 준비됨 — 클립 ${anims.animations.length}종`)
  } catch (err) {
    cache = false
    console.info('[character] 모델이 없어 코드 인체로 간다:', err.message)
  }
  return cache
}

export const hasCharacter = () => !!cache

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
 */
export function createCharacter({ height = 1.82, facing = 0, tint = null, gear: initialGear = [], bulk = 1 } = {}) {
  if (!cache) return null

  const root = new THREE.Group()
  const model = cloneRigged(cache.body.scene)

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
  for (const [key, gltf] of Object.entries(cache.gear)) {
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
  for (const clip of cache.clips) {
    const a = mixer.clipAction(clip)
    if (ONE_SHOT.has(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true }
    actions[clip.name] = a
  }

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

    /** 본 목록. 붙일 자리를 찾을 때 콘솔에서 본다. */
    boneNames() { return [...boneByName.keys()] },

    equip(id) { for (const m of gearMeshes[id] ?? []) m.visible = true },
    unequipAll() { for (const list of Object.values(gearMeshes)) for (const m of list) m.visible = false },

    pose(s, dt) {
      if (s.dead) play(CLIP.die, { fade: 0.2, speed: 1 })
      else if (s.roll > 0) {
        if (lastOneShot !== 'roll') { play(CLIP.roll, { fade: 0.06, speed: fitSpeed(CLIP.roll, s.rollDuration ?? 0.44), restart: true }); lastOneShot = 'roll' }
      } else if (s.attack) {
        const key = `atk${s.attackId ?? ''}`
        if (lastOneShot !== key) {
          play(CLIP.attack, { fade: 0.05, speed: fitSpeed(CLIP.attack, s.attackDuration ?? 0.4), restart: true })
          lastOneShot = key
        }
      } else if (s.draw != null) { play(CLIP.aim, { fade: 0.12 }); lastOneShot = null }
      else if (s.run > 0.12) { play(s.run > 0.85 ? CLIP.sprint : CLIP.run, { fade: 0.16, speed: 0.85 + s.run * 0.35 }); lastOneShot = null }
      else { play(CLIP.idle, { fade: 0.2 }); lastOneShot = null }

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
