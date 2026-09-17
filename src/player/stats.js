/**
 * 성장 스탯과 선택지.
 *
 * 기본값을 일부러 느리게 잡아 뒀다. 이동속도도 공격속도도 처음엔 답답하고,
 * 모아서 올리는 게 이 게임의 성장이다. 기본값이 이미 쾌적하면 레벨업이 의미가 없다.
 */
export function newStats() {
  return {
    moveSpeed: 1,       // 이동속도
    actionRate: 1,      // 공격속도 — 액션 프레임 전체가 이 배수로 빨라진다
    drawRate: 1,        // 활 당기는 속도
    rollRegen: 1,       // 구르기 충전 속도
    meleeDamage: 1,
    rangedDamage: 1,
    meleeRange: 1,
    bonusHp: 0,

    // 등급이 오르면 켜지는 것들. 수치가 아니라 규칙이 바뀐다.
    burn: 0,            // 1 화상 · 2 옮아붙음 · 3 화염 파도
    ricochet: 0,        // 1 튕김 · 2 튕길수록 강해짐 · 3 갈라짐
    rollStrike: 0,      // 1 벽력일섬 · 2 착지 충격파 · 3 잔상
  }
}

/* ── 계열과 등급 ─────────────────────────────────────────────
   같은 계열을 두 번 고르면 윗등급이 열린다.
   수치가 오르다가 어느 순간 규칙이 바뀌고, 거기서부터 빌드가 갈린다. */

export const TIERS = [
  { key: 'common', label: '일반', color: '#9a8f7e' },
  { key: 'rare', label: '레어', color: '#5aa8ff' },
  { key: 'unique', label: '유니크', color: '#c77dff' },
  { key: 'legendary', label: '레전더리', color: '#ffb02e' },
]

export const LINEAGES = {
  blade: '칼',
  arrow: '활',
  step: '발',
}

/**
 * 등급이 열리는 조건 — 계열을 몇 번 골랐는지, 그리고 아랫등급을 갖고 있는지.
 * 한 계열을 계속 파면 2 · 4 · 6 번째에 한 칸씩 올라간다.
 */
export const UNLOCK = [
  null,                              // 일반은 조건 없음
  { picks: 2 },                      // 레어
  { picks: 4, needsTier: 1 },        // 유니크
  { picks: 6, needsTier: 2 },        // 레전더리
]

const U = (o) => ({ tier: 0, weight: 3, ...o })

export const UPGRADES = [
  /* ── 일반 ── 수치가 오른다 ─────────────────────────────── */
  U({
    id: 'hephaistos', lineage: 'blade', name: '헤파이스토스의 벼림', tag: '대장간',
    desc: '칼 피해 +16%',
    flavor: '절름발이 신의 망치는 한 번도 헛치지 않는다',
    apply: s => { s.meleeDamage *= 1.16 },
  }),
  U({
    id: 'ares', lineage: 'blade', name: '아레스의 광기', tag: '전쟁',
    desc: '공격속도 +13%',
    flavor: '피 냄새가 손을 재촉한다. 생각하기 전에 팔이 먼저 움직인다',
    apply: s => { s.actionRate *= 1.13 },
  }),
  U({
    id: 'herakles', lineage: 'blade', name: '헤라클레스의 팔', tag: '완력', weight: 2,
    desc: '칼 사거리 +12%',
    flavor: '한 뼘이 생사를 가른다. 그 한 뼘을 빌린다',
    apply: s => { s.meleeRange *= 1.12 },
  }),
  U({
    id: 'artemis', lineage: 'arrow', name: '아르테미스의 숨', tag: '사냥',
    desc: '활 차징 속도 +22%',
    flavor: '사냥꾼은 숨을 멈추지 않는다. 숨결에 맞춰 시위를 당긴다',
    apply: s => { s.drawRate *= 1.22 },
  }),
  U({
    id: 'apollo', lineage: 'arrow', name: '아폴론의 화살', tag: '역병',
    desc: '활 피해 +20%',
    flavor: '아흐레 동안 진영에 내리꽂히던 그 화살',
    apply: s => { s.rangedDamage *= 1.20 },
  }),
  U({
    id: 'hermes', lineage: 'step', name: '헤르메스의 발', tag: '전령',
    desc: '이동속도 +14%',
    flavor: '발목에 날개가 돋는다. 길 위의 신은 서두르는 자를 좋아한다',
    apply: s => { s.moveSpeed *= 1.14 },
  }),
  U({
    id: 'athena', lineage: 'step', name: '아테나의 인도', tag: '지혜',
    desc: '구르기 충전 +24%',
    flavor: '그 여신은 창을 주지 않는다. 언제 물러설지를 알려 줄 뿐이다',
    apply: s => { s.rollRegen *= 1.24 },
  }),
  U({
    id: 'ambrosia', lineage: null, name: '암브로시아 한 모금', tag: '신찬', weight: 2,
    desc: '최대 체력 +25, 즉시 회복',
    flavor: '죽지 않는 자들의 음식. 인간에게는 하루치 숨이다',
    apply: s => { s.bonusHp += 25 },
  }),
  U({
    id: 'nobody', lineage: null, name: '“아무도 아니다”', tag: '꾀', weight: 1,
    desc: '공격속도 +9%, 칼 피해 +9%',
    flavor: '이름을 버리고 살아 나온 자의 수법',
    apply: s => { s.actionRate *= 1.09; s.meleeDamage *= 1.09 },
  }),

  /* ── 레어 ── 여기서부터 규칙이 바뀐다 ───────────────────── */
  U({
    id: 'blade_burn', lineage: 'blade', tier: 1, name: '헤파이스토스의 불씨', tag: '화염', weight: 4,
    desc: '칼에 맞은 적이 4초간 불탄다',
    flavor: '대장간의 불은 쇠에 옮겨 붙어 꺼지지 않는다',
    apply: s => { s.burn = Math.max(s.burn, 1) },
  }),
  U({
    id: 'arrow_ricochet', lineage: 'arrow', tier: 1, name: '아르테미스의 되울림', tag: '도약', weight: 4,
    desc: '화살이 다음 적에게 튕긴다',
    flavor: '숲에서는 화살이 나무를 스쳐 짐승을 찾아간다',
    apply: s => { s.ricochet = Math.max(s.ricochet, 1) },
  }),
  U({
    id: 'step_bolt', lineage: 'step', tier: 1, name: '벽력일섬', tag: '섬전', weight: 4,
    desc: '구르며 스친 적을 베고 지나간다',
    flavor: '제우스가 던진 것은 창이 아니라 한 줄기 빛이었다',
    apply: s => { s.rollStrike = Math.max(s.rollStrike, 1) },
  }),

  /* ── 유니크 ─────────────────────────────────────────────── */
  U({
    id: 'blade_spread', lineage: 'blade', tier: 2, name: '옮아붙는 불', tag: '화염', weight: 4,
    desc: '불타는 적이 죽으면 주위로 불이 번진다',
    flavor: '이스마로스의 집들이 그렇게 탔다',
    apply: s => { s.burn = Math.max(s.burn, 2) },
  }),
  U({
    id: 'arrow_gather', lineage: 'arrow', tier: 2, name: '쌓이는 원한', tag: '도약', weight: 4,
    desc: '화살이 튕길 때마다 피해 +45%, 튕김 +1',
    flavor: '한 번 빗나간 화살은 더 성이 나서 돌아온다',
    apply: s => { s.ricochet = Math.max(s.ricochet, 2) },
  }),
  U({
    id: 'step_quake', lineage: 'step', tier: 2, name: '내딛는 천둥', tag: '섬전', weight: 4,
    desc: '구르기가 끝나는 자리에 충격파가 터진다',
    flavor: '번개가 지나간 자리에 소리가 뒤따른다',
    apply: s => { s.rollStrike = Math.max(s.rollStrike, 2) },
  }),

  /* ── 레전더리 ───────────────────────────────────────────── */
  U({
    id: 'blade_wave', lineage: 'blade', tier: 3, name: '불의 파도', tag: '화염', weight: 5,
    desc: '3타를 지르면 불길이 앞으로 뻗어 나간다',
    flavor: '신들의 대장간이 통째로 쏟아진다',
    apply: s => { s.burn = Math.max(s.burn, 3) },
  }),
  U({
    id: 'arrow_split', lineage: 'arrow', tier: 3, name: '갈라지는 화살', tag: '도약', weight: 5,
    desc: '튕길 때마다 화살이 둘로 갈라진다',
    flavor: '하나를 쏘았는데 열이 날아갔다',
    apply: s => { s.ricochet = Math.max(s.ricochet, 3) },
  }),
  U({
    id: 'step_echo', lineage: 'step', tier: 3, name: '남는 잔상', tag: '섬전', weight: 5,
    desc: '구른 자리를 잔상이 한 번 더 지나간다',
    flavor: '그가 지나간 뒤에도 빛이 한 번 더 지나갔다',
    apply: s => { s.rollStrike = Math.max(s.rollStrike, 3) },
  }),
]

const BY_ID = new Map(UPGRADES.map(u => [u.id, u]))

/** 그 계열을 통틀어 몇 번 골랐는지. */
function lineagePicks(taken, lineage) {
  let n = 0
  for (const [id, count] of taken) {
    const u = BY_ID.get(id)
    if (u && u.lineage === lineage) n += count
  }
  return n
}

/** 그 계열의 해당 등급을 이미 가졌는지. */
function hasTier(taken, lineage, tier) {
  for (const id of taken.keys()) {
    const u = BY_ID.get(id)
    if (u && u.lineage === lineage && u.tier === tier) return true
  }
  return false
}

/**
 * 지금 고를 수 있는 선택지.
 * 윗등급은 같은 계열 아랫등급을 UNLOCK_AT 번 이상 골라야 열린다.
 * 특수 효과는 한 번만 먹으면 되므로 이미 가진 건 빠진다.
 */
export function availableUpgrades(taken = new Map(), ease = 0) {
  return UPGRADES.filter(u => {
    if (u.tier === 0) return true
    if (taken.has(u.id)) return false                      // 특수는 중복해서 먹을 게 없다
    const rule = UNLOCK[u.tier]
    // 아테나의 조언이 문턱을 한 계단 낮춘다
    if (lineagePicks(taken, u.lineage) < Math.max(1, rule.picks - ease)) return false
    if (rule.needsTier != null && !hasTier(taken, u.lineage, rule.needsTier)) return false
    return true
  })
}

/** 이번 레벨업에 새로 열린 등급이 있으면 알려 준다 (연출용). */
export function newlyUnlocked(before, after) {
  const had = new Set(availableUpgrades(before).map(u => u.id))
  return availableUpgrades(after).filter(u => u.tier > 0 && !had.has(u.id))
}

/** 가중 추첨으로 서로 다른 n 개. 새로 열린 등급은 반드시 한 장 끼워 준다. */
export function rollChoices(n = 3, taken = new Map(), forced = [], ease = 0) {
  const pool = availableUpgrades(taken, ease)
  const out = []
  for (const f of forced) {
    const u = pool.find(p => p.id === f.id)
    if (u && !out.includes(u)) out.push(u)
    if (out.length >= n) return out
  }
  const left = pool.filter(u => !out.includes(u))
  while (out.length < n && left.length) {
    const total = left.reduce((a, u) => a + u.weight, 0)
    let r = Math.random() * total
    let i = 0
    while (i < left.length - 1 && (r -= left[i].weight) > 0) i++
    out.push(left.splice(i, 1)[0])
  }
  return out
}

export { BY_ID }
