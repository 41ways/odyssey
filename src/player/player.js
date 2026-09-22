import * as THREE from 'three'
import { Actor } from '../combat/actor.js'
import { CURVE } from '../combat/action.js'
import { sectorHit } from '../combat/hit.js'
import { dist2d } from '../core/math.js'
import { clamp, damp, dampAngle, angleDelta } from '../core/math.js'
import { newStats } from './stats.js'
import { buildFigure, wrapFigure } from '../render/figure.js'
import { buildGear, buildWeapons, KIT, buildSwordProp, buildBowProp, buildShieldProp, buildHelmetProp, buildRealHelmetProp, buildCapeProp, buildSkirtProp } from './gear.js'
import { createCharacter } from '../render/character.js'
import { models } from '../render/models.js'

/**
 * 기본값은 일부러 느리다. 이동도 활도 처음엔 답답하고, 성장으로 풀어 나간다.
 * 여기 숫자를 올리기 전에 stats.js 의 선택지를 먼저 의심할 것.
 */
export const TUNING = {
  speed: 5.6,             // 기본 이동속도. 날랜 발을 모으면 빨라진다
  turnHalf: 0.035,        // 조준 추적 반감기. 작을수록 즉각적
  roll: {
    charges: 3,
    regen: 3.4,           // 충전 하나 차는 데 걸리는 시간. 가벼운 몸으로 줄인다
    // 거리와 시간은 같이 움직인다. 거리만 줄이면 걷는 것(5.6)보다 느려져서
    // 구르는 게 아니라 기어가는 느낌이 난다. 지금은 초속 9.7.
    duration: 0.38,
    distance: 3.7,        // 회피 거리는 성장으로 안 건드린다. 도망 수단은 일정해야 한다
    iframeStart: 0.03,
    iframeEnd: 0.25,      // 0.22초 무적. 짧게 잡아야 회피가 실력이 된다
    recovery: 0.08,
  },
  /**
   * 막기와 쳐내기 (세키로의 체간·쳐내기).
   *
   * ── 왜 넣었나 ──
   * 이 게임의 방어는 **구르기 하나**였다. 그러면 모든 예고의 정답이 같아진다 —
   * 옆으로 구른다. 보스마다 패턴을 다르게 짜 놔도 답이 하나면 다 같은 싸움이다.
   * 막기가 생기면 답이 둘이 된다: 피할 것인가, 받아칠 것인가.
   *
   * ── 세 층 ──
   *   · **막기**(누르고 있는다) — 피해 30%만 받고 나머지는 자세로 받는다.
   *     자세가 다 차면 무너진다. 그래서 계속 막고만 있을 수는 없다.
   *   · **쳐내기**(맞기 직전에 누른다) — 피해 0, 자세 0. 대신 **적의 무력화를
   *     크게 민다.** 방어가 공격이 되는 자리이고, 세키로의 전부가 여기 있다.
   *   · **자세 붕괴** — 자세가 다 차면 1.1초 굳는다. 그 사이에 맞으면 크게 아프다.
   *
   * 창은 0.18초다. 사람 눈이 예고를 보고 반응하는 데 0.2초쯤 걸리니,
   * **보고 나서 누르면 늦고 읽고 나서 눌러야 맞는** 폭이다.
   */
  guard: {
    window: 0.18,        // 이 안에 눌렀으면 쳐낸 것
    posture: 100,        // 자세 한도
    blockCut: 0.30,      // 막으면 피해가 이만큼만 들어온다
    postureCost: 0.85,   // 막은 피해 1당 자세 몇
    regen: 26,           // 초당 회복 (안 막고 안 맞을 때)
    regenGuard: 9,       // 막고 있는 동안의 회복
    hitPause: 0.7,       // 맞고 나서 회복이 멈추는 시간
    breakLock: 1.1,      // 무너지면 굳는 시간
    speed: 0.42,         // 막는 동안의 이동속도
    poise: 15,           // 쳐낼 때 적에게 미는 무력화
  },
  bow: {
    /**
     * ── 차징이 의미를 갖는 조건 ──
     * 전에는 최소 당김 0.34 + 후딜 0.42 로 한 발에 0.76초, 피해 9 → 12 dps.
     * 꽉 당기면 1.57초에 26 → 17 dps. 차이가 5 dps 뿐이라, 위험을 감수하고
     * 오래 서 있을 이유가 없었다. 그래서 톡톡 쏘는 게 최선이 됐다.
     *
     * 지금은 **난사를 명확히 손해로** 만든다. 최소 당김은 0.45 로 올리고
     * 후딜은 0.55 로 늘리고 최소 피해는 7 로 내렸다 → 1.0초에 7, 7 dps.
     * 대신 꽉 당기면 34 + 관통 → 1.6초에 34, 21 dps 에 여럿을 꿴다.
     * 세 배 차이가 나야 "기다릴까" 가 판단이 된다.
     */
    minDraw: 0.45,        // 여기까진 당겨야 나간다. 톡톡 쏘기를 막는 선
    fullDraw: 1.05,       // 꽉 채우기까지. 팽팽한 시위로 줄인다
    release: 0.55,        // 쏘고 난 후딜. 난사의 대가가 여기 있다
  },
  /**
   * 특수공격 (F) — 저승의 유물 셋 중 하나를 들면 열린다.
   * 유물 문구(`stages.js` 의 RELICS)가 이미 약속한 값들을 여기 숫자로 옮긴다.
   * 셋 다 같은 F 키를 쓰지만 유물마다 완전히 다른 일을 한다 — 그래서
   * 재사용 대기시간도 하는 일의 무게에 맞춰 따로 잡는다.
   */
  special: {
    wax: { duration: 3, cooldown: 8 },              // 밀랍 — 경직 무시 3초
    aegis: { radius: 4.6, freeze: 2.2, cooldown: 11 },  // 메두사 — 주위를 굳힌다
    spear: { damage: 70, speed: 30, cooldown: 3.6 },    // 청동 창 — 높은 피해, 짧은 쿨
  },
}

/* ── 칼 3타 ──────────────────────────────────────────────
   1·2타는 짧고 빠르게, 3타는 크게 휘두르고 후딜이 길다.
   "3타를 지를까 말까"가 고민이 되어야 근접전이 재미있다. */
function slash(cfg) {
  return {
    id: cfg.id,
    startup: cfg.startup, active: cfg.active, recovery: cfg.recovery,
    cancelAt: cfg.cancelAt,
    next: cfg.next,
    move: { distance: cfg.move, curve: CURVE.front },
    onActive(p, run) {
      // 기세는 **한 번 휘두를 때 한 칸**이다. 판정이 여러 프레임 열려 있고
      // 적도 여럿이라, 여기서 안 접어 두면 한 번에 네 칸이 찬다.
      // ActionRunner 는 한 사람당 하나뿐이라 켠 자리에서 끄지 않으면 영영 켜져 있다.
      run.gaveFocus = false
      const range = cfg.range * p.stats.meleeRange
      // 허공을 가르는 소리. 맞은 소리는 아래 onHitWindow 에서 따로 낸다 —
      // 이 둘이 같으면 맞았는지 빗맞았는지를 귀로 모른다.
      p.world.sfx?.swing(cfg.id === 'slash3')
      p.fx.slash(p.pos.x, p.pos.z, p.facing, range, cfg.halfAngle, cfg.id === 'slash3' ? '#ffd28a' : '#fff0d0')
      if (cfg.id === 'slash3') {
        p.fx.shake(0.22)
        // 레전더리 — 3타가 불길이 되어 앞으로 뻗는다
        if (p.stats.burn >= 3) {
          p.projectiles.spawn({
            x: p.pos.x + Math.sin(p.facing) * 1.2,
            z: p.pos.z + Math.cos(p.facing) * 1.2,
            dir: p.facing, speed: 16, damage: 18 * p.stats.meleeDamage, kind: 'fire',
            team: 'player', pierce: 99, radius: 1.5, knockback: 5, hitstop: 0.04,
            color: '#ff6a2a', range: 13,
            ignite: { dps: 11 * p.stats.meleeDamage, seconds: 5, level: 3, from: p },
          })
          p.fx.ring(p.pos.x, p.pos.z, { color: '#ff6a2a', radius: 3.2, life: 0.4 })
        }
      }
    },
    onHitWindow(p, run) {
      const range = cfg.range * p.stats.meleeRange
      // 소용돌이 판에서는 몸통이 아니라 테두리 이빨을 깬다.
      // 칼이 닿는 자리에 이빨이 있으면 그쪽으로 들어간다.
      p.world.maelstrom?.hitAt(
        p.pos.x + Math.sin(p.facing) * range * 0.6,
        p.pos.z + Math.cos(p.facing) * range * 0.6,
        range * 0.7, cfg.damage * p.stats.meleeDamage,
      )
      for (const e of p.world.enemies) {
        if (e.dead || run.hitSet.has(e)) continue
        if (!sectorHit(p.pos, p.facing, range, cfg.halfAngle, e)) continue
        run.hitSet.add(e)
        // 칼이 닿으면 기세가 한 칸 쌓인다 (Wukong 의 棍势). 한 번 휘둘러
        // 여럿을 맞혀도 한 칸이다 — 기세는 '맞힌 횟수' 가 아니라 '박자' 다.
        if (!run.gaveFocus) { run.gaveFocus = true; p.gainFocus(1) }
        // 3타는 무력화도 민다. 묶이는 값이 여기 있다.
        if (cfg.id === 'slash3') e.breakPoise?.(10)
        // 그로기 중인 적은 다르게 들려야 한다. 같은 타격인데 값이 다르다.
        if (e.groggy > 0 || cfg.id === 'slash3') p.world.sfx?.crit()
        else p.world.sfx?.hit(false)
        e.hurt(cfg.damage * p.stats.meleeDamage, {
          from: p.pos, knockback: cfg.knockback, hitstop: cfg.hitstop,
          stagger: cfg.stagger, crit: cfg.id === 'slash3',
          color: cfg.id === 'slash3' ? '#ffd166' : '#ffe9a8',
        })
        if (p.stats.burn > 0) {
          e.ignite({ dps: 7 * p.stats.meleeDamage, seconds: 4, level: p.stats.burn, from: p })
        }
      }
    },
  }
}

/**
 * 칼 3타.
 *
 * ── 왜 이 숫자인가 ──
 * 한동안 훨씬 빨랐다. 그러면 '보고 피하는' 싸움이 아니라 '먼저 누르는'
 * 싸움이 되고, 활을 쥘 이유가 사라진다. 실제로 재 보니 이랬다:
 *
 *   칼 한 바퀴(1→2→3)  1.47초에 54  →  37 dps
 *   활 꽉 당겨 한 발    1.57초에 26  →  17 dps
 *
 * 칼이 두 배 이상이니 근접이 정답이 되고, 그래서 "그냥 칼로 휘두르는 게" 됐다.
 * 지금은 한 바퀴를 2.0초로 늘려 32 dps 로 내렸다. 그래도 활보다 높은데,
 * 그건 의도다 — **칼의 값은 dps 가 아니라 경직과 그로기**다. 그로기 중에는
 * 보스가 2배 넘게 맞으므로(groggyMult) 반격 창에서 칼이 폭발한다.
 * 안전한 활로 깎고, 창이 열리면 붙어서 3타를 박는 박자.
 *
 * 선딜을 0.13 → 0.20 으로 올린 건 '읽히게' 하려는 것이다. 0.13 초는
 * 사람 눈에 즉발이라 휘두른 게 아니라 스쳤다는 느낌이 난다.
 */
export const SLASH = {
  slash1: slash({ id: 'slash1', startup: 0.20, active: 0.08, recovery: 0.42, cancelAt: 0.36, next: 'slash2', move: 1.0, range: 3.0, halfAngle: 1.05, damage: 13, knockback: 3.5, hitstop: 0.07, stagger: 0.10 }),
  slash2: slash({ id: 'slash2', startup: 0.18, active: 0.08, recovery: 0.44, cancelAt: 0.38, next: 'slash3', move: 1.1, range: 3.1, halfAngle: 1.25, damage: 16, knockback: 4.0, hitstop: 0.075, stagger: 0.14 }),
  // 3타가 보상이다. 크게 묶이는 대신 크게 아프고 크게 흔든다.
  slash3: slash({ id: 'slash3', startup: 0.34, active: 0.13, recovery: 0.78, cancelAt: 0.70, next: null, move: 2.1, range: 3.9, halfAngle: 1.95, damage: 36, knockback: 13, hitstop: 0.14, stagger: 0.48 }),
}

/**
 * 중격 — 기세를 태우는 한 방.
 *
 * ── 왜 필요했나 ──
 * 칼 3타와 활 차징은 둘 다 '기다렸다가 크게' 지만, 둘 다 **공짜로** 쓸 수
 * 있다. 그래서 보스전이 3타를 계속 돌리는 일이 된다. 쌓아야만 쓸 수 있는
 * 한 방이 하나 있어야 근접전에 계좌가 생긴다.
 *
 * 기세는 칼이 닿을 때마다 한 칸, 구르기로 아슬아슬하게 흘렸을 때 한 칸씩
 * 쌓인다(최대 4). 중격은 **쌓인 걸 전부 태운다** — 칸마다 피해와 무력화가
 * 같이 오른다. 4 칸이면 3타의 두 배를 넘고, 무력화가 절반 가까이 찬다.
 *
 * 대신 느리다. 선딜 0.44 는 보스가 한 번 휘두를 시간이다 — 언제 지를지를
 * 읽어야 하고, 그 자리가 곧 그로기 창이다.
 */
export const HEAVY = {
  id: 'heavy',
  startup: 0.44, active: 0.14, recovery: 0.66, cancelAt: 0.60, next: null,
  move: { distance: 2.4, curve: CURVE.front },
  onActive(p) {
    const n = p.spentFocus ?? 0
    p.world.sfx?.swing(true)
    p.fx.slash(p.pos.x, p.pos.z, p.facing, (3.6 + n * 0.22) * p.stats.meleeRange, 1.5, '#7fe6ff')
    p.fx.shake(0.26 + n * 0.05)
    p.fx.ring(p.pos.x, p.pos.z, { color: '#7fe6ff', radius: 2.2 + n * 0.5, life: 0.4 })
  },
  onHitWindow(p, run) {
    const n = p.spentFocus ?? 0
    const range = (3.6 + n * 0.22) * p.stats.meleeRange
    p.world.maelstrom?.hitAt(
      p.pos.x + Math.sin(p.facing) * range * 0.6,
      p.pos.z + Math.cos(p.facing) * range * 0.6,
      range * 0.8, (22 + n * 14) * p.stats.meleeDamage,
    )
    for (const e of p.world.enemies) {
      if (e.dead || run.hitSet.has(e)) continue
      if (!sectorHit(p.pos, p.facing, range, 1.5, e)) continue
      run.hitSet.add(e)
      p.world.sfx?.crit()
      e.hurt((22 + n * 14) * p.stats.meleeDamage, {
        from: p.pos, knockback: 9 + n * 2, hitstop: 0.1 + n * 0.02,
        stagger: 0.5, crit: true, color: '#9ff0ff',
      })
      // 무력화는 기세를 태운 만큼 들어간다. 한 번에 반쯤 미는 값이라
      // '모아서 지른다' 가 보스를 넘기는 길이 된다.
      e.breakPoise?.(16 + n * 9)
      if (p.stats.burn > 0) e.ignite({ dps: 9 * p.stats.meleeDamage, seconds: 4, level: p.stats.burn, from: p })
    }
  },
}

/**
 * 전리품 단계 → 실제 장비 조각.
 * GLTF 파츠가 없는 투구·망토는 본에 매다는 프롭으로 채운다.
 */
/**
 * 받아 온 옷 조각(Quaternius 판타지 의상)을 그리스식으로 칠해 쓴다.
 *
 * 원래 색 그대로면 검은 가죽 바지에 부츠, 긴소매 셔츠 — 중세 레인저였다.
 * 조각 모양은 그대로 두고 재질만 바꾼다:
 *   body  → 아마포 키톤 (흉갑을 얻으면 같은 조각이 청동으로 바뀐다)
 *   feet  → 가죽 샌들
 *   arms  → 청동 팔가리개
 *   legs  → 쓰지 않는다. 호메로스의 전사는 맨다리에 정강이받이다
 * 무늬 텍스처는 뗀다 — 판타지 옷의 바느질·단추가 남으면 다시 중세가 된다.
 */
const GREEK = {
  linen:   { color: '#d9ccae', metal: 0, rough: 0.95 },
  rags:    { color: '#6f6555', metal: 0, rough: 1.0 },    // 이타카의 거지 누더기
  leather: { color: '#6b4a2c', metal: 0, rough: 0.85 },
  bronze:  { color: '#b98a44', metal: 0.85, rough: 0.34 },
}
/** 늘 입고 있는 것 — 트로이에서 돌아가는 왕의 평상 차림 */
const BASE = { body: 'linen', feet: 'leather' }
/** 전리품이 켜는 조각 */
const GEAR_PARTS = {
  cuirass: [],          // body 를 청동으로 바꾼다 (paint)
  bracers: ['arms'],
  pauldrons: ['pauldron'],
  helmet: [],
  cape: [],
}

/**
 * 프롭을 본에 거는 자리.
 * character.js 가 본 축을 캐릭터 축(+Y 위, +Z 앞)으로 맞춰 주므로 여기 값은 직관적이다.
 */
const MOUNT = {
  sword: { bone: 'hand_r', rotation: [-0.25, 0, 0.1], position: [0, -0.02, 0.02] },
  /* 활은 **뒤집혀** 달려 있었다 — 활채가 궁수 쪽으로 휘고 시위가 바깥을
     보는, 실제로는 쏠 수 없는 모양이었다. 반 바퀴 돌려 시위를 몸 쪽에 둔다.
     (활 동작 클립이 없어 권총 조준을 빌려 쓰는 탓에 자세만으로는 활을 쏘는
     것처럼 안 보였는데, 방향을 바로잡으니 그쪽이 훨씬 크게 먹혔다.) */
  bow: { bone: 'hand_l', rotation: [Math.PI / 2, Math.PI, 0], position: [0, -0.02, 0.02] },
  /* 방패는 **왼팔 안쪽**에 끼운다 (활과 같은 손이지만 둘을 동시에 들 일은 없다).
     gear.js 의 buildShieldProp 이 손잡이를 방패 자신의 원점으로 옮겨 뒀으므로,
     여기서는 손목에서 살짝만 밀면 된다 — 칼·활과 같은 크기의 오프셋이다.
     처음엔 원점이 방패 한가운데였고 오프셋도 그걸 기준으로 잡아서, 방패가
     손목보다 반지름만큼 아래(무릎 쪽)로 늘어져 보였다. */
  shield: { bone: 'hand_l', rotation: [0, Math.PI / 2, 0.1], position: [0, 0.02, 0.02], scale: 0.85 },
  // 투구는 머리보다 크면 냄비가 된다. 모델 머리에 맞춰 줄이고 중심을 맞춘다.
  helmet: { bone: 'Head', rotation: [0, 0, 0], position: [0.075, 0.07, 0.02], scale: 0.55 },
  /* 받아 온 진짜 투구(Sketchfab, CC-BY) — 원본 좌표계가 코드 투구와 다르다.
     GLB 안의 메시가 이미 0.01 배로 들어 있어서(원본이 cm 단위) 여기 적는
     값은 "원본 단위 × 0.01" 기준이다. 그래서 0.55 같은 수가 아니라 0.009 다.

     자리와 크기는 눈대중이 아니라 재서 맞췄다. 이 모델은 원점이 투구
     바닥이고 볏이 위로 길어서, 통째 bbox 로 맞추면 투구가 머리 위에 뜬다.
     볏을 뺀 몸통과 Head 본에 매달린 정점들(=머리)을 머리 좌표계에서 각각
     재서 두 중심을 포갠 값이다. 머리 폭 0.181·높이 0.225·깊이 0.220 에
     투구 몸통 0.226·0.232·0.306 — 머리보다 한 뼘 크게. */
  helmetReal: { bone: 'Head', rotation: [0, 0, 0], position: [0, -0.051, 0.020], scale: 0.00911 },
  // 망토는 본이 아니라 몸통에 단다 — 전투 자세의 상체 비틀림까지 따라가면 옆으로 뻗는다.
  cape: { body: true, position: [0, 1.42, -0.08], scale: 0.95 },
  // 키톤 자락 — 망토처럼 몸통에 단다. 엉덩이 뼈에 달았더니 전투 자세에서
  // 골반이 비틀리는 만큼 치마가 비스듬히 떴다. 뼈는 고관절 높이(0.77)라서
  // 허리선(0.99)까지 올려야 속옷이 덮인다 — 실측으로 맞춘 값.
  skirt: { body: true, position: [0, 0.93, 0.02], scale: 1 },
}

/** 실제 모델로 만든 오디세우스. 모델이 없으면 null. */
function buildFromModel() {
  const rig = createCharacter({ height: 1.82 })
  if (!rig) return null

  const sword = buildSwordProp()
  const bow = buildBowProp()
  const shield = buildShieldProp()
  // 받아 온 투구가 있으면 그걸 쓴다. 없으면(파일이 안 실렸으면) 코드 투구로.
  const realHelmet = buildRealHelmetProp()
  const helmet = realHelmet ?? buildHelmetProp()
  const helmetMount = realHelmet ? MOUNT.helmetReal : MOUNT.helmet
  const cape = buildCapeProp()
  const skirt = buildSkirtProp()

  rig.attachTo(MOUNT.sword.bone, sword.group, MOUNT.sword)
  rig.attachTo(MOUNT.bow.bone, bow.group, MOUNT.bow)
  rig.attachTo(MOUNT.shield.bone, shield.group, MOUNT.shield)
  rig.attachTo(helmetMount.bone, helmet.group, helmetMount)
  rig.attachToBody(cape.group, MOUNT.cape)
  const skirtMount = rig.attachToBody(skirt.group, MOUNT.skirt)
  const pelvis = rig.bone?.('pelvis')
  const _v = new THREE.Vector3()
  /** 자락의 자리를 골반에 맞춘다. 방향은 몸통 그대로 — 골반이 비틀려도 치마는 안 기운다 */
  skirt.follow = () => {
    if (!pelvis) return
    pelvis.getWorldPosition(_v)
    rig.root.worldToLocal(_v)
    skirtMount.position.set(_v.x, _v.y + 0.165, _v.z)
  }
  helmet.group.visible = false
  cape.group.visible = false
  shield.group.visible = false     // 막는 동안에만 보인다 (player.js 의 guard)

  // 발밑 표식
  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.56, 32),
    new THREE.MeshBasicMaterial({ color: '#8fc6ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  mark.rotation.x = -Math.PI / 2
  mark.position.y = 0.02
  rig.root.add(mark)

  const props = { helmet: helmet.group, cape: cape.group }
  const worn = new Set()

  // 조각마다 재질을 따로 둔다 — 같은 파일을 쓰는 적(키코네스)의 옷까지 칠하면 안 된다
  const paint = (part, look) => {
    const L = GREEK[look]
    const meshes = rig.equip(part)
    for (const m of meshes) {
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(x => {
        const c = x.userData?.greek ? x : x.clone()
        c.userData.greek = true
        c.map = null
        c.color.set(L.color)
        c.metalness = L.metal
        c.roughness = L.rough
        c.needsUpdate = true
        return c
      })
      m.material = Array.isArray(m.material) ? mats : mats[0]
    }
    return meshes
  }
  const bronzePart = part => paint(part, 'bronze')
  const dressBase = (rags = false) => {
    paint('body', worn.has('cuirass') ? 'bronze' : rags ? 'rags' : 'linen')
    paint('feet', rags ? 'rags' : 'leather')
    skirt.rags(rags)
    skirt.armour(worn.has('cuirass'))
  }
  dressBase()

  return {
    rig,
    weapons: { sword: sword.group, bowHand: bow.group, bowBack: null, shield: shield.group },
    cape,
    capeSim: cape,
    skirt,
    gear: {
      equip(id) {
        worn.add(id)
        const shown = []
        if (id === 'cuirass') { shown.push(...bronzePart('body')); skirt.armour(true) }
        for (const part of GEAR_PARTS[id] ?? []) shown.push(...bronzePart(part))
        if (props[id]) { props[id].visible = true; props[id].traverse(o => { if (o.isMesh) shown.push(o) }) }
        return shown           // 방금 붙은 것들. 연출이 여기에 빛을 준다
      },
      /** 무장을 벗는다. 키톤과 샌들은 남는다 — 알몸으로 돌아가지 않는다. */
      reset() {
        worn.clear(); rig.unequipAll()
        for (const p of Object.values(props)) p.visible = false
        dressBase()
      },
      /** 이타카의 거지 누더기. 무장을 벗긴 뒤에 입힌다. */
      rags(on) { dressBase(on) },
      has(id) { return worn.has(id) },
    },
    mats: [...rig.mats, ...sword.mats, ...bow.mats, ...helmet.mats, ...cape.mats, ...skirt.mats],
  }
}

/** 코드로 만든 오디세우스. 모델이 없을 때의 대체품. */
function buildProcedural() {
  const fig = buildFigure({
    scale: 1.02, bulk: 1.05,
    palette: {
      skin: '#b07a4e', cloth: '#cdbfa0', leather: '#5e3f28',
      bronze: '#c08a3e', accent: '#9c3327', dark: '#2a2018',
    },
  })
  const gear = buildGear(fig)
  const weapons = buildWeapons(fig)

  // 시작 차림 — 난파해서 겨우 걸친 허리천 하나
  const loin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 0.26, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: '#8b7d66', roughness: 0.95, side: THREE.DoubleSide })
  )
  loin.position.y = -0.1
  loin.castShadow = true
  fig.j.hips.add(loin)

  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.56, 32),
    new THREE.MeshBasicMaterial({ color: '#8fc6ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  mark.rotation.x = -Math.PI / 2
  mark.position.y = 0.02
  fig.root.add(mark)

  return {
    fig, rig: wrapFigure(fig), gear, weapons,
    mats: [...fig.mats, ...gear.mats, ...weapons.mats],
  }
}

function buildOdysseus() {
  return buildFromModel() ?? buildProcedural()
}

export class Player extends Actor {
  constructor(world, input, fx, projectiles) {
    super({ hp: 120, radius: 0.48, mass: 2.2, team: 'player', fx })
    this.world = world
    this.input = input
    this.projectiles = projectiles
    this.isPlayer = true

    const built = buildOdysseus()
    this.fig = built.fig ?? null          // 코드 인체일 때만 있다
    this.rig = built.rig
    this.modelDriven = !built.fig         // 실제 모델이면 포즈를 클립이 맡는다
    this.gear = built.gear
    this.weapons = built.weapons
    this.capeSim = built.capeSim ?? null
    this.skirt = built.skirt ?? null
    this._lastFacing = 0
    this._rollHits = new Set()
    this._rollFrom = { x: 0, z: 0 }
    this._echo = null
    this.hexed = 0
    this.slowed = 0          // 포효에 걸린 시간
    this.slowMul = 1         // 그동안의 이동속도 배수
    this.hexRig = null                    // 돼지로 변했을 때의 몸. 걸릴 때 한 번만 만든다
    this.vis = built.rig.root
    this.group.add(this.vis)
    this.bodyMats = built.mats
    this.kills = 0
    this.animT = 0
    this._run = 0
    this._stridePhase = 0   // 발소리 — figure.js 의 걸음 주기(stride)와 같은 박자로 돈다

    this.stats = newStats()
    this.maxRollCharges = TUNING.roll.charges
    this.rollCharges = TUNING.roll.charges
    this.rollTimer = 0
    this.rolling = 0
    this.rollDir = new THREE.Vector3()
    this.drawing = 0          // 활 당긴 시간. 0 이면 안 당기는 중
    this.releaseLock = 0
    // 기세 — 칼이 닿을 때마다, 아슬아슬하게 흘렸을 때마다 한 칸 (위 HEAVY 주석)
    this.focus = 0
    this.maxFocus = 4
    this.spentFocus = 0       // 중격이 태운 칸 수. 그 한 판 동안만 쓴다
    this._focusIdle = 0
    this.rallyCd = 0          // 함성 재사용 대기 (main.js 의 rally)
    this.rallyMax = 20
    this.specialCd = 0        // 특수공격(F) 재사용 대기 — 유물 없으면 그냥 안 나간다
    this.staggerImmuneT = 0   // 밀랍 — 이 동안은 맞아도 경직이 안 걸린다
    // 막기·쳐내기 (위 TUNING.guard)
    this.guarding = false
    this.guardT = 99          // 막기를 누른 뒤 지난 시간. window 안이면 쳐낸다
    this.posture = 0
    this.maxPosture = TUNING.guard.posture
    this.postureHold = 0      // 맞고 나서 회복이 멈춘 시간
    this.broken = 0           // 자세가 무너져 굳은 시간
    this.comboNext = null
    this._move = new THREE.Vector3()

    // 활 조준선
    this.aimLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 1),
      new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    this.aimLine.rotation.x = -Math.PI / 2
    this.aimLine.position.y = 0.04
    this.group.add(this.aimLine)
  }

  get canAct() { return !this.dead && this.rolling <= 0 && this.stagger <= 0 && this.releaseLock <= 0 }

  /** 기세 한 칸. 꽉 차면 칼자루에 불이 든다 (HUD 의 구슬). */
  gainFocus(n = 1) {
    if (this.dead || n <= 0) return
    const was = this.focus
    this.focus = Math.min(this.maxFocus, this.focus + n)
    this._focusIdle = 0
    if (this.focus > was && this.focus === this.maxFocus) {
      this.world.sfx?.ready?.()
      this.fx?.number(this.pos.clone().setY(2.3), '기세 가득', { color: '#7fe6ff', size: 20 })
    }
  }

  /** 선택지를 먹은 뒤 부른다. 공격속도는 액션 시계에, 체력은 최대치에 바로 반영된다. */
  applyStats() {
    this.actionRate = this.stats.actionRate
    const want = 120 + this.stats.bonusHp
    if (want > this.maxHp) { this.hp += want - this.maxHp; this.maxHp = want }
    // 은총이 구르기 충전과 무적 길이를 건드린다
    this.maxRollCharges = Math.max(1, TUNING.roll.charges + (this.stats.rollChargeMod ?? 0))
    this.rollCharges = Math.min(this.rollCharges, this.maxRollCharges)
    /* 치명상 방지(메두사의 방패)는 한 번만 지급한다 — applyStats() 는
       장비를 새로 걸칠 때마다 다시 불리므로, 매번 그대로 더하면 유물
       하나로 몇 번이고 버티게 된다. 이미 준 만큼은 뺀다. */
    const wantLS = this.stats.lastStand ?? 0
    const grant = wantLS - (this._lastStandGranted ?? 0)
    if (grant > 0) this.lastStand += grant
    this._lastStandGranted = wantLS
  }

  update(dt, aim) {
    if (this._echo && this.rolling <= 0) this.#updateEcho(dt)
    if (this.dead) { this.step(dt, this.world.arenaRadius); return }

    // 기세는 가만히 있으면 샌다. 판 하나를 통째로 모아 뒀다가 보스방에서
    // 터뜨리는 게 아니라, 붙어 있는 동안에만 쌓이는 것이어야 한다.
    if (this.focus > 0) {
      this._focusIdle += dt
      if (this._focusIdle > 5) { this.focus--; this._focusIdle = 2.2 }
    }
    if (this.rallyCd > 0) this.rallyCd -= dt
    if (this.specialCd > 0) this.specialCd -= dt
    if (this.staggerImmuneT > 0) this.staggerImmuneT -= dt

    /* 막기와 자세.
       누르고 있는 동안만 막는다. 눌린 지 얼마나 됐는지(guardT)가 쳐내기의
       전부라, 여기서 시계를 돌리고 hurt() 가 그 값을 읽는다. */
    const G = TUNING.guard
    if (this.broken > 0) {
      this.broken -= dt
      this.guarding = false
    } else {
      const wantGuard = this.input.isHeld('guard') && this.rolling <= 0 && this.drawing <= 0 && !this.action.active
      if (wantGuard && !this.guarding) this.guardT = 0       // 이제 막 들었다 — 쳐내기 창이 열린다
      else if (wantGuard) this.guardT += dt
      this.guarding = wantGuard
      if (!wantGuard) this.guardT = 99
    }
    if (this.postureHold > 0) this.postureHold -= dt
    else if (this.posture > 0) {
      this.posture = Math.max(0, this.posture - (this.guarding ? G.regenGuard : G.regen) * dt)
    }

    // 구르기 충전 회복 — 하나씩 순서대로 찬다
    if (this.rollCharges < (this.maxRollCharges ?? TUNING.roll.charges)) {
      this.rollTimer += dt * this.stats.rollRegen
      if (this.rollTimer >= TUNING.roll.regen) { this.rollTimer -= TUNING.roll.regen; this.rollCharges++ }
    } else this.rollTimer = 0

    if (this.releaseLock > 0) this.releaseLock -= dt

    const R = TUNING.roll
    if (this.rolling > 0) {
      this.rolling -= dt
      const t = 1 - this.rolling / R.duration
      const elapsed = t * R.duration
      // 무적은 구르기 전체가 아니라 가운데 구간만. 여기가 실력의 자리다.
      const iEnd = R.iframeEnd * (this.stats.iframeMul ?? 1)
      this.invuln = (elapsed >= R.iframeStart && elapsed <= iEnd) ? 0.05 : 0
      const ease = 1 - Math.pow(1 - Math.min(t * 1.35, 1), 2.2)
      const prevEase = this._prevEase ?? 0
      const step = (ease - prevEase) * R.distance
      this._prevEase = ease
      this.pos.x += this.rollDir.x * step
      this.pos.z += this.rollDir.z * step
      this.#rollStrike()
      if (this.rolling <= 0) { this._prevEase = 0; this.releaseLock = R.recovery; this.#rollEnd() }
      this.#updateEcho(dt)
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, true)
      return
    }

    this.input.moveVector(this._move)

    // 구르기는 공격 '후딜'만 끊을 수 있다. 예고와 판정 구간은 책임진다.
    const rollOk = !this.action.active || this.action.phase === 'recovery'
    if (rollOk && this.input.peek('roll') && this.rollCharges > 0 && this.stagger <= 0 && this.releaseLock <= 0) {
      this.input.consume('roll')
      this.#startRoll()
      return
    }

    if (this.action.active) {
      // 후딜 중 캔슬 창이 열리면 버퍼에 든 다음 입력을 꺼낸다
      if (this.action.cancelable) {
        const def = this.action.def
        if (this.input.peek('heavy')) {
          // 3타까지 가지 않고 중격으로 끊는 길. 여기가 있어야 '언제 태울까' 가 판단이 된다
          this.input.consume('heavy')
          this.action.stop()
          this.#heavy()
        } else if (this.input.peek('slash') && def.next) {
          this.input.consume('slash')
          this.action.stop()
          this.action.play(SLASH[def.next])
        } else if (this.input.peek('bow')) {
          this.input.consume('bow')
          this.action.stop()
          this.drawing = 0.0001
        }
      }
      if (this.action.phase !== 'recovery') this.faceTo(aim.x, aim.z)
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, false)
      return
    }

    // 활: 누르는 동안 당기고 떼면 쏜다
    if (this.drawing > 0) {
      // 당기기 시작할 때 한 번. gap 0.2 초가 반복을 막는다 (core/sfx.js)
      if (this.drawing < 0.05) this.world.sfx?.draw()
      const was = this.drawing
      this.drawing += dt * this.stats.drawRate
      // 만작에 닿는 그 프레임에 '띵'. 조준하는 동안은 화살촉 색을 못 보므로
      // 놓을 때를 눈이 아니라 귀가 알려 줘야 한다.
      if (was < TUNING.bow.fullDraw && this.drawing >= TUNING.bow.fullDraw) this.world.sfx?.ready()
      this.facing = dampAngle(this.facing, Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z), TUNING.turnHalf * 2.4, dt)
      if (!this.input.isHeld('bow') && this.drawing >= TUNING.bow.minDraw) this.#release()
      else if (this.drawing > TUNING.bow.fullDraw + 1.2) this.#release()  // 무한 홀드 방지
      this.#moveBy(dt, 0.42)   // 당기는 중엔 느리게
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, false)
      return
    }
    if (this.input.consume('rally')) this.world.rally?.()
    if (this.input.consume('special')) this.#special(aim)
    /* 자세가 무너졌으면 아무것도 못 한다. 세키로가 여기서 무서운 이유는
       '막다가 무너지면 그 다음 한 방을 그대로 맞는다' 이기 때문이다. */
    if (this.broken > 0) {
      this.#moveBy(dt, 0.2)
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, false)
      return
    }
    // 막는 동안은 칼도 활도 안 나간다. 느리게 걸을 수는 있다
    if (this.guarding) {
      this.facing = dampAngle(this.facing, Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z), TUNING.turnHalf * 1.6, dt)
      this.#moveBy(dt, TUNING.guard.speed)
      this.step(dt, this.world.arenaRadius)
      this.#visual(dt, false)
      return
    }
    if (this.input.consume('bow')) { this.drawing = 0.0001; this.#visual(dt, false); this.step(dt, this.world.arenaRadius); return }
    if (this.input.consume('heavy')) { this.faceTo(aim.x, aim.z); this.#heavy(); this.step(dt, this.world.arenaRadius); this.#visual(dt, false); return }
    if (this.input.consume('slash')) { this.faceTo(aim.x, aim.z); this.action.play(SLASH.slash1); this.step(dt, this.world.arenaRadius); this.#visual(dt, false); return }

    this.facing = dampAngle(this.facing, Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z), TUNING.turnHalf, dt)
    this.#moveBy(dt, 1)
    this.step(dt, this.world.arenaRadius)
    this.#visual(dt, false)
  }

  /** 연출 중 — 시뮬레이션은 멈췄지만 포즈는 돌아야 한다. */
  updateVisualOnly(dt) { this.#visual(dt, false) }

  /**
   * 느려진다. 사자의 포효가 부른다.
   *
   * 겹쳐 걸면 더 세지는 게 아니라 **남은 시간만 갱신한다** — 사자 둘이 울면
   * 0.3배가 되어 못 움직이게 되는데, 그건 난이도가 아니라 정지다.
   */
  slow(seconds, mul = 0.55) {
    this.slowed = Math.max(this.slowed, seconds)
    this.slowMul = Math.min(this.slowMul === 1 ? mul : this.slowMul, mul)
    this.fx?.number(this.pos.clone().setY(2.0), '둔화', { color: '#ffb04a', size: 20 })
  }

  #moveBy(dt, scale) {
    if (this._move.lengthSq() === 0) return
    // 키르케의 변신 마법에 걸리면 몸이 무거워진다
    const hex = this.hexed > 0 ? 0.55 : 1
    // 포효. 변신(hexed)과 따로 둔다 — 둘은 원인도 연출도 다르고, 겹치면 겹쳐야 한다
    const slow = this.slowed > 0 ? this.slowMul : 1
    // 물에서는 느리다. 빠르면 소용돌이가 무섭지 않고, 너무 느리면
    // 빨려 들어가는 걸 못 막아서 판이 억울해진다.
    const swim = this.swimming ? 0.74 : 1
    const v = TUNING.speed * this.stats.moveSpeed * scale * hex * swim * slow
    this.pos.x += this._move.x * v * dt
    this.pos.z += this._move.z * v * dt
  }

  /** 벽력일섬 — 구르는 동안 몸에 스친 적을 벤다. 한 번 구를 때 적당 한 번. */
  #rollStrike() {
    if (this.stats.rollStrike <= 0) return
    const reach = this.radius + 0.9
    for (const e of this.world.enemies) {
      if (e.dead || this._rollHits.has(e)) continue
      if (dist2d(e.pos, this.pos) > reach + e.radius) continue
      this._rollHits.add(e)
      e.hurt(16 * this.stats.meleeDamage, {
        from: this.pos, knockback: 6, hitstop: 0.05, stagger: 0.14, color: '#9fd8ff',
      })
      this.fx.ring(e.pos.x, e.pos.z, { color: '#9fd8ff', radius: 1.6, life: 0.24 })
    }
  }

  /** 착지 충격파 (유니크) 와 잔상 예약 (레전더리). */
  #rollEnd() {
    const lv = this.stats.rollStrike
    if (lv >= 2) {
      this.fx.ring(this.pos.x, this.pos.z, { color: '#bfe4ff', radius: 3.4, life: 0.4 })
      this.fx.shake(0.18)
      for (const e of this.world.enemies) {
        if (e.dead || dist2d(e.pos, this.pos) > 2.9 + e.radius) continue
        e.hurt(24 * this.stats.meleeDamage, {
          from: this.pos, knockback: 11, hitstop: 0.07, stagger: 0.3, color: '#bfe4ff',
        })
      }
    }
    if (lv >= 3) {
      this._echo = { t: 0, from: { x: this._rollFrom.x, z: this._rollFrom.z }, dir: this.rollDir.clone(), hits: new Set() }
    }
  }

  /** 잔상 — 구른 자리를 한 박자 늦게 한 번 더 지나간다. */
  #updateEcho(dt) {
    const e = this._echo
    if (!e) return
    e.t += dt
    if (e.t < 0.2) return
    const k = Math.min((e.t - 0.2) / TUNING.roll.duration, 1)
    const x = e.from.x + e.dir.x * TUNING.roll.distance * k
    const z = e.from.z + e.dir.z * TUNING.roll.distance * k
    if (Math.random() < 0.6) this.fx.ring(x, z, { color: '#8fc6ff', radius: 1.0, life: 0.22, y: 0.3 })
    for (const en of this.world.enemies) {
      if (en.dead || e.hits.has(en)) continue
      if (dist2d(en.pos, { x, z }) > 1.3 + en.radius) continue
      e.hits.add(en)
      en.hurt(14 * this.stats.meleeDamage, {
        from: { x, z }, knockback: 5, hitstop: 0.04, stagger: 0.1, color: '#8fc6ff',
      })
    }
    if (k >= 1) this._echo = null
  }

  /**
   * 맞았다.
   *
   * 규칙은 Actor 에 그대로 두고 **소리만** 더한다. 내가 맞는 소리는
   * 적이 맞는 소리와 달라야 한다 — 같으면 화면 밖에서 뭔가 맞았을 때
   * 그게 나인지 적인지 모른다. 낮고 둔하게(thud) 낸다.
   *
   * 흘린 것(iframe)에도 소리를 준다. 구르기로 피한 게 눈에 안 보이는
   * 프레임이 있는데, 소리가 나면 "피했다" 가 손에 남는다.
   */
  hurt(amount, opts = {}) {
    // 밀랍(특수공격) — 맞아도 경직만 빠진다. 피해는 그대로 받는다.
    if (this.staggerImmuneT > 0 && opts.stagger) opts = { ...opts, stagger: 0 }
    const before = this.invuln > 0 || this.rolling > 0 || this.god
    // 구르기 무적이 먼저다 — 구르는 중이면 막기를 볼 것도 없다
    if (!before && this.guarding && this.broken <= 0 && !this.dead) {
      const G = TUNING.guard
      if (this.guardT <= G.window) return this.#deflect(amount, opts)
      return this.#block(amount, opts, G)
    }
    const out = super.hurt(amount, opts)
    if (out === 'hit') this.world.sfx?.thud()
    else if (out === 'iframe' && before) {
      this.world.sfx?.clang()
      /* 완벽 회피. 구르기 무적으로 실제 공격을 흘린 순간에만 준다 —
         아무 데나 구르는 것과 **맞을 것을 보고 구르는 것**을 값으로 가른다.
         한 박자 멈춰 주는 건 그게 눈에 보여야 다시 하고 싶어지기 때문이다. */
      if (this.rolling > 0 && !this.god) {
        this.gainFocus(1)
        this.fx?.freeze(0.07)
        this.fx?.ring(this.pos.x, this.pos.z, { color: '#7fe6ff', radius: 1.9, life: 0.34 })
      }
    }
    return out
  }

  /**
   * 쳐냈다.
   *
   * 피해도 자세도 0 이다. 대신 **친 쪽의 무력화를 크게 민다** — 방어가
   * 공격이 되는 자리이고, 이 게임에서 무력화는 그로기로, 그로기는 두 배
   * 피해로 이어진다 (enemy/boss.js). 그러니 쳐내기 셋이 중격 한 번과
   * 같은 값을 한다. 막는 것이 '버티는 일' 이 아니라 '이기는 길' 이어야
   * 방어에 손이 간다.
   */
  #deflect(amount, opts) {
    const G = TUNING.guard
    this.posture = Math.max(0, this.posture - 12)     // 잘 쳐내면 오히려 숨이 돌아온다
    this.gainFocus(1)
    this.world.sfx?.clang()
    this.world.sfx?.crit?.()
    this.fx?.freeze(0.09)
    this.fx?.shake(0.3)
    this.fx?.number(this.pos.clone().setY(2.1), '쳐냄', { color: '#bfe8ff', size: 26, crit: true })
    this.fx?.ring(this.pos.x, this.pos.z, { color: '#bfe8ff', radius: 2.2, life: 0.35 })
    // 친 쪽을 찾아 무력화를 민다. from 은 때린 자리라 거기서 가장 가까운 놈이다
    const from = opts.from
    if (from) {
      let best = null, bd = Infinity
      for (const e of this.world.enemies) {
        if (e.dead) continue
        const d = dist2d(e.pos, from)
        if (d < bd) { bd = d; best = e }
      }
      if (best) {
        best.breakPoise?.(G.poise)
        best.stagger = Math.max(best.stagger, 0.22)
        this.world.particles?.burst?.({
          x: from.x, y: 1.2, z: from.z, count: 12,
          color: '#cfefff', speed: 7, size: 0.1, life: 0.4, gravity: 3,
        })
      }
    }
    return 'iframe'
  }

  /**
   * 막았다.
   *
   * 피해의 30% 만 몸으로 받고 나머지는 자세로 받는다. 자세가 다 차면
   * 무너진다 — 그래서 계속 막고만 있을 수는 없고, 언젠가는 쳐내거나
   * 굴러야 한다. 그 '언젠가' 를 고르는 것이 이 규칙의 전부다.
   */
  #block(amount, opts, G) {
    this.postureHold = G.hitPause
    this.posture += amount * G.postureCost
    this.world.sfx?.clang()
    this.fx?.freeze(0.05)
    this.fx?.shake(0.16)
    this.fx?.ring(this.pos.x, this.pos.z, { color: '#c8973e', radius: 1.6, life: 0.26 })
    // 밀린다 — 막아도 큰 것은 몸을 밀어낸다
    if (opts.from) {
      const dx = this.pos.x - opts.from.x, dz = this.pos.z - opts.from.z
      const d = Math.hypot(dx, dz) || 1
      this.vel.x += (dx / d) * (opts.knockback ?? 6) * 0.5 / this.mass
      this.vel.z += (dz / d) * (opts.knockback ?? 6) * 0.5 / this.mass
    }
    const through = amount * G.blockCut
    const out = super.hurt(through, { ...opts, knockback: 0, stagger: 0, hitstop: 0 })
    if (this.posture >= this.maxPosture) this.#breakPosture()
    return out
  }

  /** 자세가 무너졌다. 굳는다 — 그 사이에 오는 것은 그대로 맞는다. */
  #breakPosture() {
    this.posture = this.maxPosture
    this.broken = TUNING.guard.breakLock
    this.guarding = false
    this.action.stop()
    this.world.sfx?.deny?.()
    this.fx?.shake(0.5)
    this.fx?.number(this.pos.clone().setY(2.2), '자세 무너짐', { color: '#ff8a5a', size: 24 })
    this.fx?.ring(this.pos.x, this.pos.z, { color: '#ff8a5a', radius: 2.8, life: 0.5 })
  }

  /** 기세를 전부 태워 한 번 내리친다. 빈손이어도 나가되, 값은 칸 수가 정한다. */
  #heavy() {
    this.spentFocus = this.focus
    this.focus = 0
    this._focusIdle = 0
    if (this.spentFocus > 0) {
      this.fx?.ring(this.pos.x, this.pos.z, { color: '#7fe6ff', radius: 1.4 + this.spentFocus * 0.3, life: 0.3 })
    }
    this.action.play(HEAVY)
  }

  #startRoll() {
    const R = TUNING.roll
    this.world.sfx?.roll()
    this.rollCharges--
    this._rollHits = new Set()
    this._rollFrom = { x: this.pos.x, z: this.pos.z }
    this.action.stop()
    this.drawing = 0
    this.rolling = R.duration
    this._prevEase = 0
    // 방향키를 안 누르고 있으면 보는 쪽으로 구른다
    if (this._move.lengthSq() > 0) this.rollDir.copy(this._move)
    else this.rollDir.set(Math.sin(this.facing), 0, Math.cos(this.facing))
    this.facing = Math.atan2(this.rollDir.x, this.rollDir.z)
    this.fx.ring(this.pos.x, this.pos.z, { color: '#79b7ff', radius: 1.3, life: 0.28 })
  }

  #release() {
    const t = clamp((this.drawing - TUNING.bow.minDraw) / (TUNING.bow.fullDraw - TUNING.bow.minDraw), 0, 1)
    const full = t >= 0.98
    this.projectiles.spawn({
      x: this.pos.x + Math.sin(this.facing) * 0.7,
      z: this.pos.z + Math.cos(this.facing) * 0.7,
      dir: this.facing, kind: 'arrow',
      speed: 32 + t * 22,
      // 7 → 34. 꽉 당긴 값이 최소치의 다섯 배 가까이 되어야 기다릴 값이 있다
      damage: (7 + t * 27) * this.stats.rangedDamage,
      // 얼마나 당겼는지를 화살이 들고 간다. 안티노오스가 이걸 본다 —
      // 피해량만 넘기면 '활 피해 성장' 으로도 문턱을 넘어 버린다.
      draw: t,
      team: 'player',
      pierce: full ? 2 : 0,
      ricochet: this.stats.ricochet > 0 ? (this.stats.ricochet >= 2 ? 3 : 1) : 0,
      ricochetLevel: this.stats.ricochet,
      knockback: 3 + t * 5,
      hitstop: full ? 0.07 : 0.035,
      color: full ? '#ffe08a' : '#ff9a4a',
      range: 30 + t * 12,
    })
    this.drawing = 0
    this.releaseLock = TUNING.bow.release
    this.world.sfx?.shoot(full)
    this.fx.shake(full ? 0.16 : 0.07)
    this.fx.ring(this.pos.x, this.pos.z, { color: full ? '#ffe08a' : '#ff9a4a', radius: 1.1, life: 0.2 })
  }

  /**
   * 특수공격 (F) — 저승에서 고른 유물 하나가 여기서 갈린다.
   * `stats.relic` 이 없으면(맨몸 시험이거나 아직 저승 전이면) 아무 일도
   * 안 일어난다 — 키를 눌렀는데 반응이 없는 것과, 애초에 못 여는 문 사이의
   * 차이는 F 를 아무 때나 눌러 봐도 무해하다는 것뿐이다.
   */
  #special(aim) {
    const relic = this.stats.relic
    if (!relic || this.dead) return
    if (this.specialCd > 0) {
      this.fx?.number(this.pos.clone().setY(2.0), '대기 중', { color: '#8a7c66', size: 16 })
      return
    }
    const T = TUNING.special
    if (relic === 'wax') {
      const cfg = T.wax
      this.specialCd = cfg.cooldown
      this.staggerImmuneT = cfg.duration
      this.world.sfx?.ready?.()
      this.fx.ring(this.pos.x, this.pos.z, { color: '#e8d6ae', radius: 1.6, life: 0.5 })
      this.fx.number(this.pos.clone().setY(2.2), '밀랍', { color: '#e8d6ae', size: 22, crit: true })
      this.world.hud?.toast('무엇을 들어도 흔들리지 않는다', 1.8)
    } else if (relic === 'aegis') {
      const cfg = T.aegis
      this.specialCd = cfg.cooldown
      this.world.sfx?.chime?.()
      this.fx.shake(0.3)
      this.fx.ring(this.pos.x, this.pos.z, { color: '#c9d6e0', radius: cfg.radius, life: 0.55 })
      let hit = 0
      for (const e of this.world.enemies) {
        if (e.dead || dist2d(e.pos, this.pos) > cfg.radius + e.radius) continue
        e.stagger = Math.max(e.stagger, cfg.freeze)
        e.action?.stop?.()
        hit++
      }
      if (hit) this.world.hud?.toast(`주위가 돌처럼 굳었다 — ${hit}`, 1.8)
    } else if (relic === 'spear') {
      const cfg = T.spear
      this.specialCd = cfg.cooldown
      this.faceTo(aim.x, aim.z)
      this.projectiles.spawn({
        x: this.pos.x + Math.sin(this.facing) * 0.7,
        z: this.pos.z + Math.cos(this.facing) * 0.7,
        dir: this.facing, kind: 'spear', speed: cfg.speed,
        damage: cfg.damage * this.stats.meleeDamage,
        team: 'player', pierce: 2, knockback: 10,
        hitstop: 0.09, color: '#ffd9a0', range: 26,
      })
      this.world.sfx?.shoot?.(true)
      this.fx.shake(0.18)
    }
  }

  /** 전리품을 입힌다. 처치 수가 임계에 닿을 때 부른다. @returns 방금 붙은 메시들 */
  equip(id) { return this.gear.equip(id) ?? [] }

  #visual(dt, rolling) {
    this.animT += dt

    // 달리는 정도. 갑자기 켜고 끄면 다리가 튄다.
    const moving = !rolling && !this.action.active && this.drawing === 0 && this._move.lengthSq() > 0
    this._run += ((moving ? 1 : 0) - this._run) * Math.min(1, dt * 14)

    /* 발소리 — figure.js 의 코드 인체가 다리를 흔드는 것과 같은 박자
       (`stride = t · (6.4 + run·3.4)`) 를 써서, 두 발이 번갈아 땅에
       닿는 반 바퀴(π)마다 한 번 운다. 실려 있는 rig 몸도 걷는 속도가
       거의 같게 맞춰져 있어서(character.js 의 `speed`) 크게 안 어긋난다.
       구르는 동안·죽었을 때는 안 운다 — 그건 각자 제 소리가 있다. */
    if (!rolling && !this.dead && this._run > 0.12) {
      const prev = this._stridePhase
      this._stridePhase += dt * (6.4 + this._run * 3.4)
      if (Math.floor(this._stridePhase / Math.PI) !== Math.floor(prev / Math.PI)) {
        this.world.sfx?.step?.()
      }
    }

    // 공격 스윙 — 치켜들었다(wind) 내려친다(swing)
    let attack = null
    const run = this.action
    if (run.active) {
      const d = run.def
      if (run.t < d.startup) {
        attack = { wind: Math.pow(run.t / d.startup, 0.6), swing: 0 }
      } else {
        const k = clamp((run.t - d.startup) / (d.active + d.recovery), 0, 1)
        const hit = Math.min(k / 0.38, 1)
        const out = 1 - clamp((k - 0.55) / 0.45, 0, 1)   // 후딜 동안 자세로 돌아온다
        attack = { wind: (1 - hit) * out, swing: Math.sin(hit * Math.PI / 2) * out }
      }
    }

    const drawK = this.drawing > 0
      ? clamp((this.drawing - TUNING.bow.minDraw) / (TUNING.bow.fullDraw - TUNING.bow.minDraw), 0, 1)
      : null

    const rollK = rolling ? 1 - this.rolling / TUNING.roll.duration : 0

    // 돼지로 변해 있으면 사람 몸은 숨기고 돼지가 대신 움직인다.
    // 느려지기만 하고 겉이 그대로면 무슨 일이 일어난 건지 알 수가 없다.
    const hexed = this.hexed > 0
    if (hexed && !this.hexRig) {
      this.hexRig = models.create('pig')
      if (this.hexRig) {
        this.hexRig.root.scale.setScalar(1.15)
        this.group.add(this.hexRig.root)
      }
    }
    if (this.hexRig) {
      this.hexRig.root.visible = hexed
      this.vis.visible = !hexed
      if (hexed) {
        this.hexRig.pose({ t: this.animT, run: this._run, attack: null, draw: null, roll: 0, dead: false }, dt)
        return
      }
    }

    this.rig.pose({
      t: this.animT,
      run: this._run,
      attack,
      attackId: run.def?.id,
      attackDuration: run.active ? run.total / (this.actionRate || 1) : 0.4,
      draw: attack ? null : drawK,
      roll: rollK,
      rollDuration: TUNING.roll.duration,
      dead: this.dead,
      flinch: this.stagger > 0 ? clamp(this.stagger / 0.3, 0, 1) : 0,
    }, dt)

    /* 손에 드는 것은 한 번에 하나.
       활은 두 손으로 당긴다 — 칼을 쥔 채로 시위를 당기면 칼날이 얼굴
       앞을 가로질러 조준선을 덮는다. 당기는 동안에는 칼을 치우고 활을
       꺼낸다. 코드 인체는 등에 맨 활이 따로 있어서 그쪽을 숨긴다. */
    const drawing = this.drawing > 0
    if (this.weapons.bowBack) {
      this.weapons.bowHand.visible = drawing
      this.weapons.bowBack.visible = !drawing
    } else if (this.weapons.bowHand) {
      this.weapons.bowHand.visible = drawing
    }
    if (this.weapons.sword) this.weapons.sword.visible = !drawing
    /* 방패는 막는 동안에만 든다. 늘 들고 있으면 왼손에 활과 겹치고,
       무엇보다 **막는 중인지 아닌지가 안 보인다** — 타이밍 기술은 상태가
       보여야 성립한다. 쳐내기 창(0.18초) 동안은 한 번 번쩍인다. */
    if (this.weapons.shield) {
      const sh = this.weapons.shield
      sh.visible = this.guarding
      if (sh.visible) {
        const flash = this.guardT <= TUNING.guard.window ? 1 : 0
        sh.traverse(o => {
          if (!o.isMesh || !o.material?.emissive) return
          o.material.emissive.setRGB(flash * 0.55, flash * 0.75, flash * 0.9)
        })
      }
    }

    // 망토 — 마디마다 윗마디를 뒤쫓는다
    const turn = angleDelta(this._lastFacing, this.facing) / Math.max(dt, 1e-4)
    this._lastFacing = this.facing
    this.skirt?.follow()
    if (this.capeSim) {
      this.capeSim.update(dt, { run: this._run, turn: clamp(turn, -12, 12), rolling })
    } else if (this.gear.cape) {
      const want = rolling ? 1.1 : this._run * 0.55
      this.gear.cape.rotation.x = damp(this.gear.cape.rotation.x, want, 0.07, dt)
    }

    // 활 조준선 — group 이 이미 facing 만큼 돌아있어서 로컬 +Z 가 곧 조준 방향이다
    this.aimLine.material.opacity = drawing ? 0.18 + (drawK ?? 0) * 0.5 : 0
    if (drawing) {
      const len = 8 + (drawK ?? 0) * 12
      this.aimLine.scale.set(1, len, 1)
      this.aimLine.position.set(0, 0.04, len / 2 + 0.6)
    }
  }

}
