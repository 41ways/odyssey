/**
 * 아홉 개의 판.
 *
 * 스테이지는 데이터다 — 어떤 땅에서, 어떤 빛 아래, 무엇과 싸우는지.
 * env 는 render/world.js 의 applyStage 가 그대로 받아 쓴다.
 * 바닥 텍스처는 스테이지에 들어갈 때 한 장씩만 받는다 (tools/fetch-ground.mjs).
 */

const waveSet = (goal, steps) => ({ goal, waves: steps })

export const STAGES = [
  {
    id: 'ismaros', kind: 'waves',
    name: '이스마로스', title: '키코네스족의 해안',
    intro: '돌아가는 길의 첫 항구. 우리는 이곳을 약탈했다.',
    clear: '해안이 조용해졌다. 바다가 기다린다.',
    arena: { radius: 16, ground: 'ismaros', repeat: 9, wallColor: '#2a2018', rockColor: '#544738' },
    env: {
      bg: '#150c08', fog: 0.019, fogColor: '#1a0e08', exposure: 1.05,
      key: '#ffb478', keyIntensity: 2.4, rim: '#6f8cff', rimIntensity: 1.1,
      hemiSky: '#3a4a74', hemiGround: '#140f0a', hemiIntensity: 0.55,
    },
    ...waveSet(24, [
      { untilKills: 3, maxAlive: 3, interval: 1.8, mix: { warrior: 1 } },
      { untilKills: 8, maxAlive: 4, interval: 1.5, mix: { warrior: 3, archer: 1 }, say: '언덕에서 활잡이가 내려온다' },
      { untilKills: 15, maxAlive: 6, interval: 1.2, mix: { warrior: 3, archer: 2 }, say: '마을이 깨어났다' },
      { untilKills: 24, maxAlive: 8, interval: 0.95, mix: { warrior: 3, archer: 2 }, say: '내륙에서 떼로 몰려온다' },
    ]),
  },

  {
    id: 'cyclops', kind: 'boss', boss: 'polyphemos',
    name: '폴리페모스의 동굴', title: '외눈의 목자',
    intro: '입구를 바위가 막았다. 나갈 길은 저것을 눕히는 것뿐이다.',
    clear: '“아무도 나를 해치지 않았다”  그가 그렇게 외쳤다.',
    arena: { radius: 15, ground: 'cyclops', repeat: 7, wallColor: '#1a1714', rockColor: '#3d372f' },
    env: {
      bg: '#07080a', fog: 0.032, fogColor: '#0a0b0e', exposure: 1.0,
      key: '#ff9a52', keyIntensity: 2.2, rim: '#4a6ea8', rimIntensity: 0.8,
      hemiSky: '#1e2838', hemiGround: '#0c0a08', hemiIntensity: 0.35,
    },
  },

  {
    id: 'telepylos', kind: 'boss', boss: 'antiphates',
    name: '텔레필로스', title: '라이스트리고네스의 항구',
    intro: '좁은 만에 배를 댔다. 절벽 위에서 바위가 날아왔다.',
    clear: '배 한 척만 남았다.',
    arena: { radius: 17, ground: 'telepylos', repeat: 8, wallColor: '#2a2e33', rockColor: '#4a4f55' },
    env: {
      bg: '#0c1014', fog: 0.02, fogColor: '#121820', exposure: 1.06,
      key: '#cfd8e8', keyIntensity: 2.0, rim: '#5f7fa8', rimIntensity: 1.2,
      hemiSky: '#4a5a72', hemiGround: '#181c20', hemiIntensity: 0.6,
    },
  },

  {
    id: 'aiaia', kind: 'boss', boss: 'kirke',
    name: '아이아이에섬', title: '키르케의 숲',
    intro: '연기가 오르는 집 하나. 먼저 간 자들은 돌아오지 않았다.',
    clear: '돼지가 다시 사람이 되었다.',
    arena: { radius: 16, ground: 'aiaia', repeat: 7, wallColor: '#23301f', rockColor: '#3e4a34' },
    env: {
      bg: '#0a1208', fog: 0.022, fogColor: '#101a10', exposure: 1.08,
      key: '#e8d08a', keyIntensity: 2.1, rim: '#a06fd0', rimIntensity: 1.3,
      hemiSky: '#54704a', hemiGround: '#141a10', hemiIntensity: 0.55,
    },
  },

  {
    id: 'underworld', kind: 'relic',
    name: '저승', title: '아가멤논의 그림자',
    intro: '피를 마신 망자가 말을 한다. 가져갈 것을 하나 고르라고.',
    clear: '그림자가 등을 돌렸다.',
    arena: { radius: 14, ground: 'underworld', repeat: 6, wallColor: '#0e0c10', rocks: false },
    env: {
      bg: '#050408', fog: 0.045, fogColor: '#08060c', exposure: 0.95,
      key: '#8a7fd0', keyIntensity: 1.2, rim: '#d05a6a', rimIntensity: 0.9,
      hemiSky: '#241e38', hemiGround: '#060508', hemiIntensity: 0.4,
    },
  },

  {
    id: 'sirens', kind: 'boss', boss: 'siren',
    name: '세이렌의 바다', title: '노래하는 것',
    intro: '돛대에 몸을 묶었다. 그래도 귀는 열려 있다.',
    clear: '노래가 멎었다.',
    arena: { radius: 14, ground: 'ship', repeat: 5, wallColor: '#141a22', rocks: false },
    env: {
      bg: '#060c14', fog: 0.03, fogColor: '#0a121c', exposure: 1.02,
      key: '#bfd8ff', keyIntensity: 1.8, rim: '#7f5fd0', rimIntensity: 1.4,
      hemiSky: '#2a3d5a', hemiGround: '#0a1018', hemiIntensity: 0.5,
    },
  },

  {
    id: 'messina', kind: 'fork',
    name: '메시나 해협', title: '스킬라와 카리브디스',
    intro: '어느 쪽으로도 갈 수 있다. 어느 쪽도 무사하지 않다.',
    clear: '해협을 지났다.',
    options: [
      { boss: 'skylla', label: '절벽 쪽으로', line: '스킬라 — 여섯 머리가 배 위로 내려온다' },
      { boss: 'charybdis', label: '소용돌이 쪽으로', line: '카리브디스 — 바다가 통째로 빨려 들어간다' },
    ],
    arena: { radius: 15, ground: 'ship', repeat: 5, wallColor: '#10161e', rocks: false },
    env: {
      bg: '#04080e', fog: 0.034, fogColor: '#070d16', exposure: 1.0,
      key: '#9fc0e8', keyIntensity: 1.7, rim: '#4a7fd0', rimIntensity: 1.5,
      hemiSky: '#223349', hemiGround: '#060a10', hemiIntensity: 0.45,
    },
  },

  {
    id: 'ithaca', kind: 'waves',
    name: '이타카', title: '구혼자들',
    intro: '스무 해 만에 문을 열었다. 홀 안이 가득 차 있다.',
    clear: '홀이 비었다.',
    arena: { radius: 15, ground: 'ithaca', repeat: 8, wallColor: '#2a2420', rocks: false },
    env: {
      bg: '#0f0a06', fog: 0.024, fogColor: '#160f08', exposure: 1.1,
      key: '#ffc888', keyIntensity: 2.6, rim: '#8a6fd0', rimIntensity: 0.9,
      hemiSky: '#4a3f5a', hemiGround: '#1a1208', hemiIntensity: 0.5,
    },
    // 빠르고 끝없이 달려든다. 한 마리는 약하지만 멈추지 않는다.
    ...waveSet(40, [
      { untilKills: 8, maxAlive: 6, interval: 0.9, mix: { warrior: 1 } },
      { untilKills: 20, maxAlive: 9, interval: 0.7, mix: { warrior: 4, archer: 1 }, say: '위층에서도 내려온다' },
      { untilKills: 40, maxAlive: 13, interval: 0.5, mix: { warrior: 4, archer: 1 }, say: '문이란 문에서 쏟아진다' },
    ]),
  },

  {
    id: 'death', kind: 'boss', boss: 'telegonos', endless: true,
    name: '죽음', title: '텔레고노스',
    intro: '해변에 선 젊은이가 같은 창을 들고 있다.',
    clear: '',
    arena: { radius: 16, ground: 'shore', repeat: 8, wallColor: '#241f1a', rockColor: '#4a4238' },
    env: {
      bg: '#0a0c12', fog: 0.02, fogColor: '#10131a', exposure: 1.04,
      key: '#e8c8a0', keyIntensity: 2.0, rim: '#6f7fd0', rimIntensity: 1.2,
      hemiSky: '#3a4258', hemiGround: '#14120e', hemiIntensity: 0.55,
    },
  },
]

export const STAGE_BY_ID = new Map(STAGES.map(s => [s.id, s]))

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
