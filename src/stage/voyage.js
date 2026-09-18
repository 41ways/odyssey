/**
 * 여정 — 배, 동료, 그리고 신들의 시선.
 *
 * 이 게임은 판을 깨고 성장을 고르는 것까지는 두터웠는데, 『오디세이아』를
 * 『오디세이아』로 만드는 것이 빠져 있었다.
 *
 *   · **동료.** 열두 척으로 떠나 혼자 돌아오는 이야기다. 판마다 사람이
 *     줄어드는 게 이 서사의 무게인데, 게임에서는 오디세우스 혼자였다.
 *   · **신들.** 포세이돈의 분노와 아테나의 편애가 이야기를 움직인다.
 *     게임에서 신은 보상 화면(아테나의 은총) 하나뿐이었다.
 *   · **선택.** 키클롭스에게 이름을 외칠 것인가, 헬리오스의 소에 손을 댈 것인가.
 *     그 선택이 뒤를 바꾼다 — 그게 이 이야기가 교훈담인 이유다.
 *
 * 그래서 판과 판 사이에 이야기 속 실제 갈림길을 두고, 고른 것이 뒤의 판에
 * 남게 한다. 숫자는 호메로스를 따른다 (배 12, 키코네스에서 배마다 여섯,
 * 키클롭스가 여섯, 라이스트리고네스에서 열한 척, 엘페노르, 스킬라가 여섯,
 * 트리나키아에서 나머지 전부).
 */

export const GODS = {
  poseidon: { name: '포세이돈', title: '대지를 흔드는 자', max: 5 },
  athena: { name: '아테나', title: '빛나는 눈의 여신', max: 5 },
}

/** 시작 — 트로이를 떠날 때 */
export const START = { ships: 12, crew: 600 }

export class Voyage {
  constructor() { this.reset() }

  reset() {
    this.ships = START.ships
    this.crew = START.crew
    this.gods = { poseidon: 0, athena: 1 }    // 아테나는 처음부터 그의 편이다
    this.flags = {}
    this.log = []                              // 잃은 것의 기록 — 엔딩에서 읽는다
    this.onChange?.()
  }

  /** @returns 실제로 잃은 수 */
  lose(n, where) {
    const before = this.crew
    this.crew = Math.max(0, this.crew - n)
    const lost = before - this.crew
    if (lost > 0) this.log.push({ where, lost })
    this.onChange?.()
    return lost
  }

  /** 남은 수로 맞춘다 (라이스트리고네스처럼 '몇이 남았다' 로 전해지는 경우) */
  leave(ships, crew, where) {
    const lost = Math.max(0, this.crew - crew)
    this.ships = ships
    this.crew = crew
    if (lost > 0) this.log.push({ where, lost })
    this.onChange?.()
    return lost
  }

  god(id, d) {
    const g = GODS[id]
    this.gods[id] = Math.max(0, Math.min(g.max, this.gods[id] + d))
    this.onChange?.()
  }

  /** 포세이돈이 노한 만큼 바다가 거칠다 — 바다 판 적 체력 배수 */
  seaWrath() { return 1 + this.gods.poseidon * 0.08 }
}

/**
 * 이야기가 정한 상실. 판의 어느 매듭에서 일어나는가.
 * where 는 알림에 그대로 나간다.
 */
export const LOSSES = {
  'ismaros:wave': { lose: 72, where: '이스마로스', line: '키코네스가 다시 몰려왔다. 배마다 여섯이 돌아오지 못했다.' },
  'ismaros:boss': { lose: 6, where: '폴리페모스의 동굴', line: '거인은 날마다 둘씩 먹었다. 여섯이 동굴에 남았다.' },
  'telepylos:boss': { leave: [1, 45], where: '라이스트리고네스의 항구',
    line: '거인들이 절벽에서 바위를 던졌다. <em>열한 척</em>이 항구 안에서 부서졌다.' },
  'aiaia:boss': { lose: 1, where: '키르케의 섬', line: '엘페노르가 지붕에서 떨어졌다. 아무도 그를 묻지 못했다.' },
  'messina:skylla': { lose: 6, where: '스킬라의 절벽', line: '머리 여섯이 내려와 여섯을 채어 갔다. 그들이 내 이름을 불렀다.' },
  'messina:charybdis': { lose: 12, where: '카리브디스', line: '소용돌이가 노 젓는 자리를 통째로 삼켰다.' },
}

/**
 * 판 사이의 갈림길. after 는 방금 끝낸 판.
 *
 * 선택지마다 무엇을 주고 무엇을 앗아가는지를 **미리 다 보여 주지 않는다.**
 * 이야기 속 오디세우스도 몰랐다. 대신 고르고 난 뒤 결과를 분명히 말한다 —
 * 모르고 고르되, 고른 뒤에는 무엇이 바뀌었는지 알아야 선택이 된다.
 */
export const FATES = [
  {
    after: 'ismaros',
    id: 'name',
    art: '/img/fate-name.webp',
    fallback: '/img/lude-ismaros-b.webp',
    where: '키클롭스의 섬을 떠나며',
    title: '이름',
    said: '눈먼 거인이 바위를 들고 해안에 서 있다. 동굴에서 나는 내 이름을 <em>‘아무도 아니다’</em>라고 했다.<br>'
      + '이제 배는 바위가 닿지 않을 만큼 멀어졌다. 동료들이 소매를 잡는다.',
    choices: [
      {
        id: 'shout', label: '“나는 이타카의 오디세우스다!”', hint: '이름을 남긴다',
        result: '거인이 아버지에게 빌었다. <em>포세이돈</em>이 그 이름을 들었다.<br>이름은 남았다. 바다는 그것을 잊지 않는다.',
        gods: { poseidon: +2 }, glory: true,
      },
      {
        id: 'silent', label: '말없이 노를 젓는다', hint: '아무도 아닌 채로',
        result: '아무도 아닌 자는 저주받을 수 없다.<br><em>아테나</em>가 그 지략을 보았다.',
        gods: { athena: +1 },
      },
    ],
  },
  {
    after: 'telepylos',
    id: 'moly',
    art: '/img/fate-moly.webp',
    fallback: '/img/lude-aiaia.webp',
    where: '아이아이에섬의 숲길',
    title: '헤르메스',
    said: '마녀의 집으로 가는 길에 젊은이가 섰다. 황금 지팡이를 짚은 <em>헤르메스</em>다.<br>'
      + '그가 검은 뿌리에 흰 꽃이 핀 풀을 내민다. “신들은 이것을 <em>몰리</em>라 부른다.”',
    choices: [
      {
        id: 'take', label: '몰리를 받는다', hint: '신의 약초',
        result: '마녀의 술잔이 너를 짐승으로 만들지 못한다.<br><em>키르케의 저주가 통하지 않는다.</em>',
        flags: { moly: true },
      },
      {
        id: 'refuse', label: '내 손으로 푼다', hint: '신의 도움 없이',
        result: '헤르메스가 웃고 사라졌다.<br>신의 풀 대신 <em>제 힘을 하나 더 얻는다.</em>',
        glory: true,
      },
    ],
  },
  {
    after: 'aiaia',
    id: 'stay',
    art: '/img/fate-stay.webp',
    fallback: '/img/lude-aiaia-b.webp',
    where: '키르케의 집',
    title: '한 해',
    said: '마녀는 이제 적이 아니다. 식탁에는 고기와 포도주가 끝없이 오르고, 동료들은 살이 올랐다.<br>'
      + '<em>“한 해쯤 쉬어 간들 이타카가 어디로 가겠소.”</em>',
    choices: [
      {
        id: 'stay', label: '한 해를 머문다', hint: '몸을 추스른다',
        result: '상처가 다 아물었다. 몸이 전보다 단단하다.<br>그러나 이타카에서는 <em>한 해가 더</em> 흘렀다.',
        heal: true, bonusHp: 25, gods: { athena: -1 },
      },
      {
        id: 'go', label: '곧장 떠난다', hint: '페넬로페가 기다린다',
        result: '동료들이 투덜대며 노를 잡았다.<br><em>아테나</em>가 그 고집을 좋아한다.',
        gods: { athena: +1 }, xp: 60,
      },
    ],
  },
  {
    after: 'messina',
    id: 'cattle',
    art: '/img/fate-cattle.webp',
    fallback: '/img/lude-messina-b.webp',
    where: '트리나키아 — 태양신의 섬',
    title: '헬리오스의 소',
    said: '바람이 한 달을 멈췄다. 양식이 떨어졌다. 풀밭에는 <em>태양신 헬리오스의 소</em>가 살쪄 있다.<br>'
      + '에우릴로코스가 말한다. “굶어 죽느니 신의 벌을 받겠소.”',
    choices: [
      {
        id: 'refuse', label: '손대지 않는다', hint: '맹세를 지킨다',
        result: '내가 잠든 사이 그들이 소를 잡았다. 제우스의 벼락이 배를 쪼갰다.<br>'
          + '<em>나 혼자</em> 돛대에 매달려 살아남았다. <em>아테나</em>가 그 손을 놓지 않았다.',
        crewAll: true, gods: { athena: +1 },
      },
      {
        id: 'feast', label: '함께 먹는다', hint: '살아야 돌아간다',
        result: '배가 불렀다. 힘이 돌아왔다. 그리고 제우스의 벼락이 모두를 삼켰다.<br>'
          + '살아남았지만 <em>벼락이 몸에 남았다.</em>',
        crewAll: true, heal: true, bonusHp: -20, damage: 0.12, gods: { poseidon: +1 },
      },
    ],
  },
]

export const fateAfter = stageId => FATES.find(f => f.after === stageId) ?? null
