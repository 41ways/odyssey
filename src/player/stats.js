/**
 * 성장 스탯.
 *
 * 기본값을 일부러 느리게 잡아 뒀다. 이동속도도 공격속도도 처음엔 답답하고,
 * 모아서 올리는 게 이 게임의 성장이다. 기본값이 이미 쾌적하면 레벨업이 의미가 없다.
 *
 * 전부 배수(1.0 = 기본). 곱해서 쌓인다.
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
  }
}

/**
 * 레벨업 선택지 풀.
 * apply 는 스탯을 직접 만진다. weight 가 클수록 자주 뜬다.
 */
export const UPGRADES = [
  { id: 'swift', name: '날랜 발', desc: '이동속도 +14%', tag: '이동', weight: 3,
    apply: s => { s.moveSpeed *= 1.14 } },
  { id: 'honed', name: '벼린 날', desc: '공격속도 +13%', tag: '속도', weight: 3,
    apply: s => { s.actionRate *= 1.13 } },
  { id: 'string', name: '팽팽한 시위', desc: '활 차징 속도 +22%', tag: '활', weight: 2,
    apply: s => { s.drawRate *= 1.22 } },
  { id: 'bronze', name: '청동 날', desc: '칼 피해 +16%', tag: '칼', weight: 3,
    apply: s => { s.meleeDamage *= 1.16 } },
  { id: 'barb', name: '미늘 화살촉', desc: '활 피해 +20%', tag: '활', weight: 2,
    apply: s => { s.rangedDamage *= 1.20 } },
  { id: 'light', name: '가벼운 몸', desc: '구르기 충전 +24%', tag: '회피', weight: 2,
    apply: s => { s.rollRegen *= 1.24 } },
  { id: 'reach', name: '긴 팔', desc: '칼 사거리 +12%', tag: '칼', weight: 2,
    apply: s => { s.meleeRange *= 1.12 } },
  { id: 'breath', name: '여벌 숨', desc: '최대 체력 +25, 즉시 회복', tag: '생존', weight: 2,
    apply: s => { s.bonusHp += 25 } },
]

/** 가중 추첨으로 서로 다른 n 개. */
export function rollChoices(n = 3, pool = UPGRADES) {
  const left = pool.slice()
  const out = []
  while (out.length < n && left.length) {
    const total = left.reduce((a, u) => a + u.weight, 0)
    let r = Math.random() * total
    let i = 0
    while (i < left.length - 1 && (r -= left[i].weight) > 0) i++
    out.push(left.splice(i, 1)[0])
  }
  return out
}

/** 다음 레벨까지 필요한 경험치. 뒤로 갈수록 완만하게 늘어난다. */
export const xpToNext = level => Math.round(6 + level * level * 2.4 + level * 4)
