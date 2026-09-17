/**
 * 여덟 개의 판.
 *
 * 한 판은 두 구간이다 — **뱀서식 웨이브로 자라고, 그 끝에서 보스를 만난다.**
 * 웨이브 구간에서 전리품과 성장을 모으고, 그 차림 그대로 보스방으로 넘어간다.
 * 구간마다 땅도 빛도 다르다 (해안에서 싸우다 동굴로 들어가는 식).
 *
 * env 는 render/world.js 의 applyStage 가 그대로 받아 쓴다.
 * 바닥 텍스처는 그 구간에 들어갈 때 한 장씩만 받는다 (tools/fetch-ground.mjs).
 */

/* ── 구간별 환경 조각 ────────────────────────────────────── */

const SHORE = {
  arena: { radius: 16, ground: 'ismaros', repeat: 9, wallColor: '#2a2018', rockColor: '#544738',
    // 털린 마을의 가장자리 — 엎어진 항아리와 부서진 기둥
    props: [{ key: 'jar', count: 9, ring: [1.03, 1.12], scale: [0.8, 1.3], tint: '#8a5f3c' },
            { key: 'column', count: 3, ring: [1.04, 1.11], scale: [0.7, 1.0], tint: '#b9ac92' }] },
  env: { bg: '#150c08', fog: 0.019, fogColor: '#1a0e08', exposure: 1.05, camDistance: 20.5,
    key: '#ffb478', keyIntensity: 2.4, rim: '#6f8cff', rimIntensity: 1.1,
    hemiSky: '#3a4a74', hemiGround: '#140f0a', hemiIntensity: 0.55 },
}
const CAVE = {
  arena: { radius: 15, ground: 'cyclops', repeat: 7, wallColor: '#1a1714', rockColor: '#3d372f' },
  env: { bg: '#07080a', fog: 0.032, fogColor: '#0a0b0e', exposure: 1.0, camDistance: 30,
    key: '#ff9a52', keyIntensity: 2.2, rim: '#4a6ea8', rimIntensity: 0.8,
    hemiSky: '#1e2838', hemiGround: '#0c0a08', hemiIntensity: 0.35 },
}
const CLIFF = {
  arena: { radius: 17, ground: 'telepylos', repeat: 8, wallColor: '#2a2e33', rockColor: '#4a4f55',
    // 좁은 만 — 바위 절벽 위로 라이스트리고네스의 집들이 있었다
    props: [{ key: 'columnRound', count: 5, ring: [1.03, 1.12], scale: [0.9, 1.4], tint: '#9aa0a6' }] },
  env: { bg: '#0c1014', fog: 0.02, fogColor: '#121820', exposure: 1.06, camDistance: 22,
    key: '#cfd8e8', keyIntensity: 2.0, rim: '#5f7fa8', rimIntensity: 1.2,
    hemiSky: '#4a5a72', hemiGround: '#181c20', hemiIntensity: 0.6 },
}
const FOREST = {
  arena: { radius: 16, ground: 'aiaia', repeat: 7, wallColor: '#23301f', rockColor: '#3e4a34',
    // 키르케의 숲. 집 둘레에는 약을 담던 항아리가 굴러다닌다
    props: [{ key: 'tree', count: 22, ring: [1.02, 1.16], scale: [0.85, 1.3] },
            { key: 'jar', count: 5, ring: [1.03, 1.11], scale: [0.9, 1.2], tint: '#6f5a3a' }] },
  env: { bg: '#0a1208', fog: 0.022, fogColor: '#101a10', exposure: 1.08, camDistance: 21,
    key: '#e8d08a', keyIntensity: 2.1, rim: '#a06fd0', rimIntensity: 1.3,
    hemiSky: '#54704a', hemiGround: '#141a10', hemiIntensity: 0.55 },
}
const UNDER = {
  keepEnv: true,        // 톤 시안이 덮지 않는다 — 여기 어둠은 연출이다
  arena: { radius: 14, ground: 'underworld', repeat: 6, wallColor: '#0e0c10', rocks: false,
    // 망자의 자리. 기둥은 고르게 둘러선다 — 아무렇게나 두면 폐허가 되고,
    // 줄을 맞추면 누군가 세운 곳이 된다
    props: [{ key: 'column', count: 8, ring: [1.12, 1.12], scale: [1.1, 1.1], spread: false, tint: '#4a4258' },
            { key: 'pedestal', count: 8, ring: [1.02, 1.02], scale: [1, 1], spread: false, offset: 0.39, tint: '#3d3550' }] },
  env: { bg: '#050408', fog: 0.045, fogColor: '#08060c', exposure: 0.95, camDistance: 19,
    key: '#8a7fd0', keyIntensity: 1.2, rim: '#d05a6a', rimIntensity: 0.9,
    hemiSky: '#241e38', hemiGround: '#060508', hemiIntensity: 0.4 },
}
const DECK = (radius = 14, cam = 20) => ({
  arena: { radius, ground: 'ship', repeat: 5, wallColor: '#141a22', rocks: false,
    // 뱃전 너머로 남은 배들이 따라온다
    props: [{ key: 'ship', count: 3, ring: [1.18, 1.5], scale: [0.9, 1.3], y: -1.2 }] },
  env: { bg: '#060c14', fog: 0.03, fogColor: '#0a121c', exposure: 1.02, camDistance: cam,
    key: '#bfd8ff', keyIntensity: 1.8, rim: '#7f5fd0', rimIntensity: 1.4,
    hemiSky: '#2a3d5a', hemiGround: '#0a1018', hemiIntensity: 0.5 },
})
const STORM = {
  arena: { radius: 15, ground: 'ship', repeat: 5, wallColor: '#10161e', rocks: false,
    props: [{ key: 'ship', count: 2, ring: [1.2, 1.55], scale: [0.9, 1.2], y: -1.4 }] },
  env: { bg: '#04080e', fog: 0.034, fogColor: '#070d16', exposure: 1.0, camDistance: 24,
    key: '#9fc0e8', keyIntensity: 1.7, rim: '#4a7fd0', rimIntensity: 1.5,
    hemiSky: '#223349', hemiGround: '#060a10', hemiIntensity: 0.45 },
}
const HALL = {
  arena: { radius: 15, ground: 'ithaca', repeat: 8, wallColor: '#2a2420', rocks: false,
    // 구혼자들이 스무 해를 먹어 치운 홀
    props: [{ key: 'column', count: 10, ring: [1.06, 1.06], scale: [1.2, 1.2], spread: false, tint: '#e3d8be' },
            { key: 'jar', count: 7, ring: [1.04, 1.12], scale: [0.9, 1.3], tint: '#8a5f3c' }] },
  env: { bg: '#0f0a06', fog: 0.024, fogColor: '#160f08', exposure: 1.1, camDistance: 20.5,
    key: '#ffc888', keyIntensity: 2.6, rim: '#8a6fd0', rimIntensity: 0.9,
    hemiSky: '#4a3f5a', hemiGround: '#1a1208', hemiIntensity: 0.5 },
}
const BEACH = {
  arena: { radius: 16, ground: 'shore', repeat: 8, wallColor: '#241f1a', rockColor: '#4a4238' },
  env: { bg: '#0a0c12', fog: 0.02, fogColor: '#10131a', exposure: 1.04, camDistance: 21,
    key: '#e8c8a0', keyIntensity: 2.0, rim: '#6f7fd0', rimIntensity: 1.2,
    hemiSky: '#3a4258', hemiGround: '#14120e', hemiIntensity: 0.55 },
}

/* ── 판 ──────────────────────────────────────────────────── */

export const STAGES = [
  {
    id: 'ismaros', name: '이스마로스', title: '키코네스족과 외눈의 목자',
    wave: {
      ...SHORE,
      intro: '돌아가는 길의 첫 항구. 우리는 이곳을 약탈했다.',
      goal: 14,
      steps: [
        { untilKills: 3, maxAlive: 3, interval: 1.8, mix: { warrior: 1 } },
        { untilKills: 8, maxAlive: 4, interval: 1.4, mix: { warrior: 3, archer: 1 }, say: '언덕에서 활잡이가 내려온다' },
        { untilKills: 14, maxAlive: 6, interval: 1.1, mix: { warrior: 3, archer: 2 }, say: '마을이 깨어났다' },
      ],
      clear: '해안이 조용해졌다. 바람이 동굴 쪽에서 불어온다.',
    },
    // 웨이브와 보스방은 다른 곳이다. 해안에서 싸우다 동굴로 들어간다 —
    // 현판에 같은 이름이 뜨면 걸어 들어간 것이 아니라 그 자리에 머문 것이 된다.
    boss: { ...CAVE, name: '폴리페모스의 동굴', id: 'polyphemos',
      intro: '입구를 바위가 막았다. 나갈 길은 저것을 눕히는 것뿐이다.' },
    clear: '“아무도 나를 해치지 않았다”  그가 그렇게 외쳤다.',
  },

  {
    id: 'telepylos', name: '텔레필로스', title: '라이스트리고네스의 항구',
    wave: {
      ...CLIFF,
      intro: '좁은 만에 배를 댔다. 절벽 위에서 바위가 날아왔다.',
      goal: 16,
      steps: [
        { untilKills: 5, maxAlive: 4, interval: 1.5, mix: { warrior: 3, archer: 1 } },
        { untilKills: 11, maxAlive: 6, interval: 1.2, mix: { warrior: 3, archer: 2 }, say: '절벽 위가 새까맣다' },
        { untilKills: 16, maxAlive: 7, interval: 1.0, mix: { warrior: 3, archer: 2 }, say: '배가 하나씩 부서진다' },
      ],
      clear: '항구 안쪽에서 거대한 그림자가 걸어 나온다.',
    },
    boss: { ...CLIFF, camDistance: 26, name: '라이스트리고네스의 항구', id: 'antiphates',
      intro: '항구 전체가 우리를 향해 돌아섰다.' },
    clear: '배 한 척만 남았다.',
  },

  {
    id: 'aiaia', name: '아이아이에섬', title: '키르케의 숲',
    wave: {
      ...FOREST,
      intro: '연기가 오르는 집 하나. 먼저 간 자들은 돌아오지 않았다.',
      goal: 18,
      steps: [
        { untilKills: 6, maxAlive: 5, interval: 1.3, mix: { pig: 1 } },
        { untilKills: 12, maxAlive: 7, interval: 1.0, mix: { pig: 3, warrior: 1 }, say: '짐승이 사람 소리를 낸다' },
        { untilKills: 18, maxAlive: 9, interval: 0.85, mix: { pig: 3, warrior: 1, archer: 1 }, say: '숲이 통째로 움직인다' },
      ],
      clear: '집 문이 열렸다.',
    },
    boss: { ...FOREST, camDistance: 21, name: '키르케의 집', id: 'kirke',
      intro: '술잔을 든 여자가 웃는다.' },
    clear: '돼지가 다시 사람이 되었다.',
  },

  {
    id: 'underworld', name: '저승', title: '아가멤논의 그림자',
    ...UNDER,
    relic: true,
    intro: '피를 마신 망자가 말을 한다. 가져갈 것을 하나 고르라고.',
    clear: '그림자가 등을 돌렸다.',
  },

  {
    id: 'sirens', name: '세이렌의 바다', title: '노래하는 것',
    wave: {
      ...DECK(14, 20),
      intro: '돛대에 몸을 묶었다. 그래도 귀는 열려 있다.',
      goal: 16,
      steps: [
        { untilKills: 6, maxAlive: 5, interval: 1.2, mix: { warrior: 1 } },
        { untilKills: 16, maxAlive: 8, interval: 0.9, mix: { warrior: 3, archer: 2 }, say: '물에서 올라온다' },
      ],
      clear: '갑판이 비었다. 그때 노래가 시작된다.',
    },
    boss: { ...DECK(14, 22), name: '세이렌의 바위', id: 'siren',
      intro: '노래가 들린다. 귀를 막을 수 없다.' },
    clear: '노래가 멎었다.',
  },

  {
    id: 'messina', name: '메시나 해협', title: '스킬라와 카리브디스',
    wave: {
      ...STORM,
      intro: '해협이 좁아진다. 양쪽 다 무사하지 않다.',
      goal: 14,
      steps: [
        { untilKills: 6, maxAlive: 6, interval: 1.0, mix: { warrior: 3, archer: 1 } },
        { untilKills: 14, maxAlive: 8, interval: 0.8, mix: { warrior: 3, archer: 2 }, say: '파도가 갑판을 넘는다' },
      ],
      clear: '어느 쪽으로 갈지 정해야 한다.',
    },
    fork: {
      ...STORM,
      name: '메시나 해협',
      intro: '어느 쪽으로도 갈 수 있다. 어느 쪽도 무사하지 않다.',
      options: [
        { boss: 'skylla', label: '절벽 쪽으로', line: '스킬라 — 여섯 머리가 배 위로 내려온다' },
        { boss: 'charybdis', label: '소용돌이 쪽으로', line: '카리브디스 — 바다가 통째로 빨려 들어간다' },
      ],
    },
    clear: '해협을 지났다.',
  },

  {
    id: 'ithaca', name: '이타카', title: '구혼자들',
    // 거지 차림으로 들어간다. 아무도 그를 알아보지 못한다.
    beggar: { until: 'boss', say: '누더기를 걸치고 문턱을 넘었다. 아무도 알아보지 못한다' },
    wave: {
      ...HALL,
      intro: '스무 해 만에 문을 열었다. 홀 안이 가득 차 있다.',
      goal: 30,
      steps: [
        { untilKills: 8, maxAlive: 6, interval: 0.9, mix: { warrior: 1 } },
        { untilKills: 18, maxAlive: 9, interval: 0.7, mix: { warrior: 4, archer: 1 }, say: '위층에서도 내려온다' },
        { untilKills: 30, maxAlive: 12, interval: 0.55, mix: { warrior: 4, archer: 1 }, say: '문이란 문에서 쏟아진다' },
      ],
      clear: '한 사람만 남았다.',
    },
    boss: { ...HALL, camDistance: 20, name: '이타카의 홀', id: 'antinoos',
      intro: '술잔을 내려놓고 칼을 뽑는다.' },
    clear: '홀이 비었다.',
  },

  {
    id: 'death', name: '죽음', title: '텔레고노스',
    boss: { ...BEACH, name: '이타카의 해변', id: 'telegonos',
      intro: '해변에 선 젊은이가 같은 창을 들고 있다.' },
    endless: true,
    intro: '해변에 선 젊은이가 같은 창을 들고 있다.',
    clear: '',
  },
]

export const STAGE_BY_ID = new Map(STAGES.map(s => [s.id, s]))

/* ── 막간 ────────────────────────────────────────────────
   판이 끝나자마자 다음 판이 시작되면 아홉 번 싸운 기억만 남는다.
   사이에 한 호흡을 넣어야 '돌아가는 길' 이 된다. */

/** 맨 처음. 왜 바다에 있는지부터 말한다. */
export const OPENING = {
  scene: 'fire',
  art: '/img/lude-opening.webp',
  lines: [
    { text: '십 년이 걸렸다. <em>트로이가 불탔다.</em>', hold: 3000 },
    { text: '열두 척으로 떠났다.<br>집까지는 며칠이면 되는 거리였다.', hold: 3400 },
    { text: '바다가 <em>스무 해</em>를 붙들었다.', hold: 3000 },
  ],
  dest: '이스마로스 — 첫 항구',
}

/** 판과 판 사이. 다음 뭍으로 간다. */
export const SAILING = {
  ismaros: ['돛을 올렸다. 동굴에서 나온 배는 한 척 가벼워져 있었다.', '노를 저으면 저을수록 뭍이 멀어졌다.'],
  telepylos: ['좁은 만을 빠져나왔다. 열한 척이 그 안에 남았다.', '남은 배 한 척으로 계속 간다.'],
  aiaia: ['마녀가 길을 알려 주었다. 먼저 <em>죽은 자에게</em> 물으라고.', '바다 끝에 해가 들지 않는 곳이 있다.'],
  underworld: ['망자의 말을 들고 돌아왔다.', '이제 무엇이 기다리는지 안다. 그래도 간다.'],
  sirens: ['밀랍을 파냈다. 귀가 다시 열렸다.', '앞쪽에서 물이 돌아가는 소리가 난다.'],
  messina: ['해협을 지났다. 남은 것은 <em>집</em> 하나뿐이다.', '이십 년 만에 이타카가 보인다.'],
  ithaca: ['홀이 조용해졌다.', '그런데도 끝나지 않았다.'],
}

/**
 * 어느 판을 떠나 어디로 가는가에 따라 뱃길의 얼굴이 다르다.
 * 일곱 번 같은 밤바다를 보여 주면 일곱 번 같은 데를 지난 것이 된다.
 * 이름은 ui/interlude.js 의 SCENES 가 받는다.
 */
const PASSAGE = {
  ismaros: 'dawn',        // 불탄 마을을 등지고 나온 아침
  telepylos: 'storm',     // 바위에 열한 척이 깨진 뒤
  aiaia: 'fire',          // 해가 들지 않는 곳으로 내려간다
  underworld: 'ashdawn',  // 잿빛에서 다시 빛으로
  sirens: 'whirl',        // 앞쪽에서 물이 돌아간다
  messina: 'landfall',    // 이십 년 만에 뭍이 보인다
  ithaca: 'night',        // 홀이 조용해졌다
}

/** 다음 판으로 넘어갈 때 쓸 막간. */
export function interludeFor(fromIndex) {
  const from = STAGES[fromIndex]
  const to = STAGES[fromIndex + 1]
  if (!from || !to) return null
  const lines = SAILING[from.id] ?? ['배를 밀었다.']
  return {
    scene: PASSAGE[from.id] ?? 'sea',
    // 그림이 들어오면 그게 배경이 된다. 없으면 CSS 장면이 그대로 남는다.
    art: `/img/lude-${from.id}.webp`,
    lines: lines.map((text, i) => ({ text, hold: i === lines.length - 1 ? 3000 : 2800 })),
    dest: `${to.name} — ${to.title}`,
  }
}

/* ── 저승의 유물 ─────────────────────────────────────────
   딱 하나만 고른다. 셋 다 특수공격(E)을 여는데, 여는 방식이 다르다. */
export const RELICS = [
  {
    id: 'wax', name: '귀를 막는 밀랍', tag: '아가멤논',
    desc: '특수공격 시 3초간 경직 무시 · 공격속도 +12%',
    flavor: '들리지 않으면 끌려가지 않는다',
    apply: s => { s.actionRate *= 1.12; s.relic = 'wax' },
  },
  {
    id: 'aegis', name: '메두사의 방패', tag: '아가멤논',
    desc: '치명상을 한 번 버틴다 · 특수공격 시 주위를 굳힌다 · 구르기 충전 2회',
    flavor: '보는 것이 굳는다. 보지 않으면 죽는다',
    apply: s => { s.relic = 'aegis'; s.rollChargeMod = -1; s.lastStand = 1 },
  },
  {
    id: 'spear', name: '청동 창', tag: '아가멤논',
    desc: '특수공격으로 창을 던진다 · 높은 피해 · 짧은 쿨',
    flavor: '그는 자기 집 문턱에서 이걸 맞았다',
    apply: s => { s.relic = 'spear'; s.meleeDamage *= 1.08 },
  },
]
