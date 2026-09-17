/**
 * 아테나의 은총.
 *
 * 보스를 눕힐 때마다 한 번. 성장 선택지보다 훨씬 세다 —
 * 판 하나를 넘긴 값이 수치 몇 퍼센트여서는 안 된다.
 *
 * 오디세우스를 끝까지 편든 신은 아테나다. 그가 살아 돌아간 건 꾀 때문이기도 하지만
 * 그 꾀를 봐 준 신이 있었기 때문이다. 판이 끝날 때마다 그 손이 한 번 닿는다.
 */
export const BLESSINGS = [
  {
    id: 'spear', name: '아테나의 창', tag: '전투',
    desc: '모든 피해 +28%',
    flavor: '그 여신은 창을 던지지 않는다. 쥐는 법을 알려 줄 뿐이다',
    apply: s => { s.meleeDamage *= 1.28; s.rangedDamage *= 1.28 },
  },
  {
    id: 'aegis', name: '아테나의 방패', tag: '생존',
    desc: '최대 체력 +70, 즉시 가득 회복',
    flavor: '들고 있는 것이 아니라 등 뒤에 서 있는 것이다',
    apply: s => { s.bonusHp += 70; s.healFull = true },
  },
  {
    id: 'eye', name: '아테나의 눈', tag: '회피',
    desc: '구르기 충전 +1 · 무적 시간 +35%',
    flavor: '언제 물러설지를 아는 것이 지혜다',
    apply: s => { s.rollChargeMod = (s.rollChargeMod ?? 0) + 1; s.iframeMul = (s.iframeMul ?? 1) * 1.35 },
  },
  {
    id: 'breath', name: '아테나의 입김', tag: '속도',
    desc: '이동속도 +20% · 공격속도 +20%',
    flavor: '돛이 없어도 배는 간다',
    apply: s => { s.moveSpeed *= 1.20; s.actionRate *= 1.20 },
  },
  {
    id: 'counsel', name: '아테나의 조언', tag: '지혜',
    desc: '앞으로 성장 선택지가 네 장씩 · 등급이 한 계단 빨리 열린다',
    flavor: '“너는 어떻게 할 셈이냐”  그가 묻자 여신이 되물었다',
    apply: s => { s.choiceCount = 4; s.unlockEase = (s.unlockEase ?? 0) + 1 },
  },
  {
    id: 'name', name: '되찾은 이름', tag: '귀향',
    desc: '치명상을 한 번 버틴다 · 최대 체력 +30',
    flavor: '“아무도 아니다”라고 했던 자가 다시 이름을 말한다',
    apply: s => { s.lastStand = (s.lastStand ?? 0) + 1; s.bonusHp += 30 },
  },
]

/** 판마다 서로 다른 셋을 뽑는다. 이미 받은 건 빼고. */
export function rollBlessings(taken = new Set(), n = 3) {
  const pool = BLESSINGS.filter(b => !taken.has(b.id))
  const out = []
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return out
}
