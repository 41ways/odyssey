import { CUT_CAVE, CUT_WHIRL, CUT_ITHACA, CUT_TELEPYLOS, CUT_BOW } from './cuts.js'

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
  arena: { radius: 36, ground: 'ismaros', repeat: 9, wallColor: '#2a2018', rockColor: '#544738',
    shape: 'grove',      // 불탄 마을 언저리. 자연 지형이라 각지지 않되 완전한 원도 아니다
    // 털린 마을의 가장자리 — 엎어진 항아리와 부서진 기둥
    props: [{ key: 'jar', count: 9, ring: [1.03, 1.12], scale: [0.8, 1.3], tint: '#8a5f3c' },
            { key: 'column', count: 3, ring: [1.04, 1.11], scale: [0.7, 1.0], tint: '#b9ac92' },
            /* 발밑도 채운다. 가장자리만 세워 두면 정작 싸우는 화면에는 맨
               흙바닥만 남아서, 넓은 갈색 마당에서 치고받는 그림이 된다
               (숲 판이 먼저 겪고 고친 것이다 — FOREST 의 grass·bush 참고).
               불탄 마을이라 마른 풀과 덤불로, 색은 타고 남은 쪽으로 끌어온다.
               키는 허리 아래. 가운데는 비운다 — 보스가 서고 장판이 깔린다. */
            { key: 'grass', count: 34, ring: [0.24, 1.0], scale: [0.7, 1.3], tint: '#7d6b3f' },
            { key: 'bush', count: 11, ring: [0.36, 0.98], scale: [0.6, 0.95], tint: '#5a4a2c' },
            { key: 'jar', count: 5, ring: [0.4, 0.92], scale: [0.6, 0.9], tint: '#6f4c2e' }] },
  env: { bg: '#150c08', fog: 0.019, fogColor: '#1a0e08', exposure: 1.05, camDistance: 27,
    key: '#ffb478', keyIntensity: 2.4, rim: '#6f8cff', rimIntensity: 1.1,
    hemiSky: '#3a4a74', hemiGround: '#140f0a', hemiIntensity: 0.55 },
}
/**
 * 폴리페모스의 동굴.
 *
 * ── 왜 다시 짰나 ──
 * "동굴같지가 않다" 가 맞았다. 어두운 둥근 마당에 자잘한 돌이 굴러다니고,
 * 이야기는 "입구를 바위가 막았다" 로 시작하는데 **그 바위가 화면에 없었다.**
 * 어둡게 한다고 동굴이 되지 않는다 — 머리 위에 무엇이 있어야 안에 있는
 * 것이 된다.
 *
 * 쿼터뷰라 천장을 통째로 덮을 수는 없다 (카메라가 위에 있어서 다 가린다).
 * 넷으로 짠다 —
 *   · **종유석**이 가장자리에서 내려온다. 먼 쪽 것이 화면 윗변에 걸려
 *     틀을 닫는다. 바깥 고리(0.78~1.1)에만 둔다: 가까운 쪽에 두면
 *     카메라와 나 사이에 끼어서 몸을 가린다.
 *   · **석순**이 바닥에서 솟는다. 발밑에 굴곡이 있어야 방이 아니라 굴이다.
 *   · **벽**은 바위를 키워 세운다. 작은 돌 열여섯 개는 자갈밭이지 벽이 아니다.
 *   · **입구를 막은 바위** 하나. 남쪽(들어온 쪽)에 세우고 틈으로 바깥 빛이
 *     샌다. 판에서 제일 먼저 눈에 들어와야 하는 물건이다 — 저것 때문에
 *     못 나간다. 파훼(눈을 쏜다)가 유일한 출구라는 걸 그림이 말한다.
 *
 * 빛도 바꾼다. 하늘빛(hemi)은 거의 끄고 — 동굴에는 하늘이 없다 — 대신
 * 모닥불 둘을 놓아 흔들리는 주광을 만든다.
 */
const CAVE = {
  /* 톤 시안이 덮지 않는다.
     기본 톤이 '정오의 대리석' 이라 bg·안개·노출·빛을 전부 덮어쓴다. 그래서
     이 방은 **파르테논처럼 밝은 동굴**이었다 — 어둡게 적어 둔 env 가 한 번도
     화면에 닿은 적이 없다. 동굴의 어둠은 색 취향이 아니라 내용이다 (저승과
     같은 이유로 keepEnv). 여기서 톤이 하는 일은 바위 색을 섞는 것까지다. */
  keepEnv: true,
  /* 동굴은 **좁아야 한다.**
     다른 판을 넓히면서 여기도 34 로 키웠더니 벽과 천장이 한 번도 화면에
     안 들어왔다 — 넓은 어둠은 동굴이 아니라 밤의 들판이다. 갇혔다는 것이
     이 판의 내용이고(입구를 바위가 막았다), 갇힘은 경계가 보여야 성립한다.
     다른 판의 3분의 2 로 둔다: 옛 15 보다는 넉넉하되 벽이 보이는 크기. */
  arena: { radius: 23, ground: 'cyclops', repeat: 7, wallColor: '#15120f', rockColor: '#3d372f',
    shape: 'cave',       // 벽이 들고 나야 동굴이다 — 구석이 있어야 숨을 데가 생긴다
    rockCount: 60, rockScale: [0.25, 0.8],
    props: [
      // 벽 — 키운 바위를 둘러 세운다. 판 밖에 서므로 몸에 안 닿는다
      { key: 'cliffRock', count: 18, ring: [1.1, 1.26], scale: [3.2, 5.2], tint: '#2b2721' },
      // 천장에서 내려오는 것. y 는 천장 높이, 길이는 3.4~7.2 라 바닥엔 안 닿는다
      { key: 'stalactite', count: 22, ring: [0.72, 1.14], scale: [0.9, 1.7], y: 11 },
      // 바닥에서 솟은 것. 가운데(0.26 안쪽)는 비운다 — 거인이 서고 장판이 깔린다
      { key: 'stalagmite', count: 18, ring: [0.26, 1.0], scale: [0.8, 1.6] },
      { key: 'cliffRock', count: 14, ring: [0.3, 0.98], scale: [0.3, 0.7], tint: '#4a423a' },
      { key: 'jar', count: 4, ring: [0.88, 1.05], scale: [0.7, 1.0], tint: '#5a4a38' },
      // 불 둘 — 방 가운데를 밝히는 화로. 그리고 그 사이를 잇는 벽 횃불 열 개.
      // 화로만으로는 넓은 방 가장자리가 죽은 어둠이라, 벽선을 따라 불빛이
      // 죽 늘어서야 벽이 있다는 게 (안 보여도) 읽힌다.
      { key: 'brazier', count: 2, ring: [0.62, 0.72], scale: [1.2, 1.5], offset: 1.9 },
      { key: 'torch', count: 10, ring: [1.0, 1.1], scale: [0.9, 1.2] },
      // 그리고 저 바위 때문에 못 나간다. 들어온 쪽(남쪽, a=0)에 하나
      { key: 'doorStone', count: 1, ring: [1.0, 1.0], spread: false, offset: 0 },
    ],
    /* 거인은 **목자**다. 그의 우리에 양이 한 마리도 없었다.
       때리는 것도 아니고 때려도 되는 것도 아니다 — 살아 있는 지형이다.
       다만 부딪히면 울고, 그 소리가 거인에게 내 자리를 알려 준다
       (enemy/sheep.js · Boss.hear). 지름길과 돌아가는 길이 생긴다. */
    flock: 7 },
  // 거인이 나오는 방이라고 카메라를 물리면 내가 작아질 뿐 거인은 안 커진다.
  // 카메라는 그대로 두고 거인을 키운다.
  env: { bg: '#050607', fog: 0.036, fogColor: '#07080b', exposure: 1.0, camDistance: 30,
    key: '#ff9a52', keyIntensity: 2.0, rim: '#4a6ea8', rimIntensity: 0.6,
    // 동굴에는 하늘이 없다. 위에서 오는 빛을 거의 끄고 불빛에 맡긴다 —
    // 다만 0.18 은 발밑이 안 읽힐 만큼 어두웠다. 바닥의 결이 보이는 선까지만 올린다
    hemiSky: '#182029', hemiGround: '#0a0806', hemiIntensity: 0.28 },
}
const CLIFF = {
  arena: { radius: 38, ground: 'telepylos', repeat: 8, wallColor: '#2a2e33', rockColor: '#4a4f55',
    shape: 'cove',       // 좁은 만 — 한쪽은 바다로 열리고 반대쪽은 바위로 막힌다
    // 좁은 만 — 바위 절벽 위로 라이스트리고네스의 집들이 있었다
    props: [{ key: 'columnRound', count: 5, ring: [1.03, 1.12], scale: [0.9, 1.4], tint: '#9aa0a6' },
            // 발밑은 눈 맞은 돌밭. 북쪽 끝이라 풀은 성기고 돌이 많다
            { key: 'cliffRock', count: 14, ring: [0.26, 1.0], scale: [0.3, 0.6], tint: '#6b7079' },
            { key: 'grass', count: 16, ring: [0.3, 0.98], scale: [0.6, 1.0], tint: '#6a7060' }] },
  env: { bg: '#0c1014', fog: 0.024, fogColor: '#151c26', exposure: 1.06, camDistance: 28,
    snow: true,          // 북쪽 끝이다. 눈이 온다
    key: '#cfd8e8', keyIntensity: 2.0, rim: '#5f7fa8', rimIntensity: 1.2,
    hemiSky: '#4a5a72', hemiGround: '#181c20', hemiIntensity: 0.6 },
}
const FOREST = {
  arena: { radius: 36, ground: 'aiaia', repeat: 7, wallColor: '#23301f', rockColor: '#3e4a34',
    shape: 'grove',      // 숲은 나무가 정하는 모양이다. 동굴만큼 각지지는 않게
    // 키르케의 숲. 집 둘레에는 약을 담던 항아리가 굴러다닌다
    props: [{ key: 'tree', count: 22, ring: [1.02, 1.16], scale: [0.85, 1.3] },
            { key: 'jar', count: 5, ring: [1.03, 1.11], scale: [0.9, 1.2], tint: '#6f5a3a' },
            // 나무는 가장자리라 싸우는 화면에는 흙바닥만 남았다. 발밑을 채운다.
            // 가운데(0.2 안쪽)는 비운다 — 보스가 서는 자리고, 장판이 가려진다.
            // 키는 허리 아래로만 둔다. 쿼터뷰에서 그보다 크면 발을 가린다.
            { key: 'bush', count: 14, ring: [0.35, 0.98], scale: [0.7, 1.1] },
            { key: 'flowerbush', count: 12, ring: [0.25, 0.95], scale: [0.8, 1.2] },
            { key: 'grass', count: 40, ring: [0.2, 1.0], scale: [0.8, 1.5] }] },
  env: { bg: '#0a1208', fog: 0.022, fogColor: '#101a10', exposure: 1.08, camDistance: 27,
    key: '#e8d08a', keyIntensity: 2.1, rim: '#a06fd0', rimIntensity: 1.3,
    hemiSky: '#54704a', hemiGround: '#141a10', hemiIntensity: 0.55 },
}
const UNDER = {
  keepEnv: true,        // 톤 시안이 덮지 않는다 — 여기 어둠은 연출이다
  arena: { radius: 34, ground: 'underworld', repeat: 7, wallColor: '#0e0c10', rocks: false,
    shape: 'square',     // 기둥이 줄 맞춰 선 곳이다. 누군가 지은 방이어야 한다
    // 망자의 자리. 기둥은 고르게 둘러선다 — 아무렇게나 두면 폐허가 되고,
    // 줄을 맞추면 누군가 세운 곳이 된다
    props: [{ key: 'column', count: 8, ring: [1.12, 1.12], scale: [1.1, 1.1], spread: false, tint: '#4a4258' },
            { key: 'pedestal', count: 8, ring: [1.02, 1.02], scale: [1, 1], spread: false, offset: 0.39, tint: '#3d3550' }] },
  // 어둡되 길이 보여야 한다. 전에는 싸움이 없는 빈 마당이라 캄캄해도
  // 됐지만, 이제 걸어서 길을 찾아야 하므로 벽이 읽혀야 한다.
  // 안개를 걷어내고(0.045 → 0.028) 바닥빛을 올린다.
  env: { bg: '#050408', fog: 0.028, fogColor: '#0a0812', exposure: 1.02, camDistance: 27,
    key: '#9a8ee0', keyIntensity: 1.6, rim: '#d05a6a', rimIntensity: 1.1,
    hemiSky: '#3a3158', hemiGround: '#0c0a12', hemiIntensity: 0.62 },
}
const DECK = (radius = 26, cam = 22) => ({
  arena: { radius, ground: 'ship', repeat: 5, wallColor: '#141a22', rocks: false,
    shape: 'deck',       // 갑판은 좁고 길다. 옆으로 피할 데가 없어야 배 위 싸움이 된다
    // 뱃전 너머로 남은 배들이 따라온다
    props: [{ key: 'ship', count: 3, ring: [1.18, 1.5], scale: [0.9, 1.3], y: -1.2 }] },
  env: { bg: '#060c14', fog: 0.03, fogColor: '#0a121c', exposure: 1.02, camDistance: cam,
    key: '#bfd8ff', keyIntensity: 1.8, rim: '#7f5fd0', rimIntensity: 1.4,
    hemiSky: '#2a3d5a', hemiGround: '#0a1018', hemiIntensity: 0.5 },
})
/** 가로로 누운 뱃전. 스킬라가 매달릴 난간이 화면 위를 가로지른다. */
const BROADSIDE = {
  arena: { radius: 28, ground: 'ship', repeat: 5, wallColor: '#10161e', rocks: false,
    shape: 'deckWide',
    // 먼 쪽 뱃전 너머는 절벽이다. 스킬라가 여기서 뻗어 나온다.
    cliff: { height: 13, depth: 5.5, count: 15, color: '#5a6068', back: 1.2 },
    // 뱃전 너머 멀리 남은 배들. 가까이 두면 짧은 축에서 갑판을 침범한다
    props: [{ key: 'ship', count: 2, ring: [1.7, 2.0], scale: [0.9, 1.15], y: -2.2 }] },
  // 넓은 배에는 넓은 샷. 난간의 머리와 갑판의 나를 한 화면에 넣어야 하는데,
  // 카메라를 안 물리면 둘 중 하나는 반드시 화면 밖으로 밀린다.
  env: { bg: '#04080e', fog: 0.03, fogColor: '#070d16', exposure: 1.0, camDistance: 29,
    key: '#9fc0e8', keyIntensity: 1.8, rim: '#4ad09a', rimIntensity: 1.6,
    hemiSky: '#223349', hemiGround: '#060a10', hemiIntensity: 0.45 },
}
/**
 * 소용돌이. 카리브디스가 있는 곳은 갑판이 아니라 **물 위**다.
 *
 * 물 텍스처가 따로 없으므로 갑판결을 크게 늘려 푸르게 물들인다 —
 * 늘어난 결이 물살처럼 읽힌다. 모양은 둥글다: 소용돌이는 네모지지 않는다.
 */
const WHIRL = {
  arena: { radius: 30, ground: 'ship', repeat: 2, shape: 'round', rocks: false,
    groundTint: '#43698c', wallColor: '#0a141e',
    props: [{ key: 'ship', count: 3, ring: [1.2, 1.5], scale: [0.8, 1.1], y: -2.6 }] },
  env: { bg: '#050c14', fog: 0.032, fogColor: '#08111c', exposure: 1.0, camDistance: 24,
    key: '#8fb8e0', keyIntensity: 1.6, rim: '#4a90d0', rimIntensity: 1.7,
    hemiSky: '#1e3350', hemiGround: '#050a12', hemiIntensity: 0.5 },
}
const STORM = {
  arena: { radius: 28, ground: 'ship', repeat: 5, wallColor: '#10161e', rocks: false,
    shape: 'deck',       // 폭풍 속 갑판도 갑판이다
    props: [{ key: 'ship', count: 2, ring: [1.2, 1.55], scale: [0.9, 1.2], y: -1.4 }] },
  env: { bg: '#04080e', fog: 0.034, fogColor: '#070d16', exposure: 1.0, camDistance: 24,
    key: '#9fc0e8', keyIntensity: 1.7, rim: '#4a7fd0', rimIntensity: 1.5,
    hemiSky: '#223349', hemiGround: '#060a10', hemiIntensity: 0.45 },
}
const HALL = {
  arena: { radius: 23, ground: 'ithaca', repeat: 8, wallColor: '#2a2420', rocks: false,
    shape: 'hall',       // 홀은 사람이 지은 방이고, 정사각이 아니라 안으로 긴 방이다
    // 구혼자들이 스무 해를 먹어 치운 홀
    props: [{ key: 'column', count: 10, ring: [1.06, 1.06], scale: [1.2, 1.2], spread: false, tint: '#e3d8be' },
            // 구혼자들이 먹던 자리. 벽을 두르고 가운데는 비운다 — 그리스의
            // 연회방(안드론)이 그렇게 생겼고, 소품에 충돌이 없어서이기도 하다
            { key: 'feastTable', count: 12, ring: [0.9, 0.96], offset: 0.3, scale: [1.15, 1.4], faceIn: true },
            { key: 'brazier', count: 6, ring: [0.99, 1.02], offset: 0.8 },
            { key: 'jar', count: 9, ring: [1.04, 1.12], scale: [0.9, 1.3], tint: '#8a5f3c' }] },
  env: { bg: '#0f0a06', fog: 0.024, fogColor: '#160f08', exposure: 1.1, camDistance: 24,
    key: '#ffc888', keyIntensity: 2.6, rim: '#8a6fd0', rimIntensity: 0.9,
    hemiSky: '#4a3f5a', hemiGround: '#1a1208', hemiIntensity: 0.5 },
}
const BEACH = {
  arena: { radius: 36, ground: 'shore', repeat: 8, wallColor: '#241f1a', rockColor: '#4a4238',
    shape: 'round' },    // 마지막은 트인 해변이다. 여기만은 둥근 게 맞다
  env: { bg: '#0a0c12', fog: 0.02, fogColor: '#10131a', exposure: 1.04, camDistance: 27,
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
    boss: { ...CAVE, cut: CUT_CAVE, name: '폴리페모스의 동굴', id: 'polyphemos',
      intro: '입구를 바위가 막았다. 나갈 길은 저것을 눕히는 것뿐이다.' },
    clear: '“아무도 나를 해치지 않았다”  그가 그렇게 외쳤다.',
  },

  {
    id: 'telepylos', name: '텔레필로스', title: '라이스트리고네스의 항구',
    // 열두 척 중 열한 척이 여기서 가라앉는다. 오디세우스가 혼자 남는
    // 이유가 이 장면인데 현판 한 줄로 지나가고 있었다.
    cut: CUT_TELEPYLOS,
    wave: {
      ...CLIFF,
      intro: '좁은 만에 배를 댔다. 절벽 위에서 바위가 날아왔다.',
      goal: 16,
      /**
       * 여기는 **거인족의 마을**이다.
       *
       * 전에는 사람 크기 키코네스족이 나왔다 — 거인 마을에 사람이 살고
       * 있었고 거인은 왕 하나뿐이었다. 판 이름이 '라이스트리고네스의
       * 항구' 인데 라이스트리고네스가 없었다.
       *
       * 이야기에서 열한 척을 가라앉힌 건 온 마을이 절벽 위에서 던진
       * 돌이다. 그래서 이 판은 **하늘에서 떨어지는 걸 보고 피하면서
       * 거리를 좁히는** 판이 된다 — 몰려오는 걸 베는 다른 판들과 리듬이
       * 다르다. 거인은 멀리서 던지므로 수를 적게(maxAlive) 두어야 한다.
       * 던지는 놈 일곱이 동시에 던지면 바닥이 통째로 장판이 된다.
       */
      steps: [
        { untilKills: 5, maxAlive: 3, interval: 1.9, mix: { giant: 1 } },
        { untilKills: 11, maxAlive: 4, interval: 1.6, mix: { giant: 3, warrior: 1 }, say: '절벽 위가 새까맣다' },
        { untilKills: 16, maxAlive: 5, interval: 1.4, mix: { giant: 3, warrior: 1, archer: 1 }, say: '배가 하나씩 부서진다' },
      ],
      clear: '항구 안쪽에서 거대한 그림자가 걸어 나온다.',
    },
    boss: { ...CLIFF, camDistance: 28, name: '라이스트리고네스의 항구', id: 'antiphates',
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
        { untilKills: 6, maxAlive: 6, interval: 1.2, mix: { pig: 2, wolf: 1 } },
        { untilKills: 12, maxAlive: 8, interval: 0.95, mix: { pig: 3, wolf: 2, lion: 1 }, say: '짐승이 사람 소리를 낸다' },
        // 사자는 둔화로 판을 만든다. 늑대·돼지와 같이 나와야 값을 한다.
        { untilKills: 18, maxAlive: 11, interval: 0.8, mix: { pig: 3, wolf: 3, lion: 1, archer: 1 }, say: '숲이 통째로 움직인다' },
      ],
      clear: '집 문이 열렸다.',
    },
    boss: { ...FOREST, camDistance: 27, name: '키르케의 집', id: 'kirke',
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
    sea: true,           // 포세이돈의 영역 — 그가 노했으면 적이 질기다 (voyage.js)
    wave: {
      ...DECK(26, 22),
      intro: '돛대에 몸을 묶었다. 그래도 귀는 열려 있다.',
      goal: 16,
      steps: [
        { untilKills: 6, maxAlive: 5, interval: 1.2, mix: { warrior: 1 } },
        { untilKills: 16, maxAlive: 8, interval: 0.9, mix: { warrior: 3, archer: 2 }, say: '물에서 올라온다' },
      ],
      clear: '갑판이 비었다. 그때 노래가 시작된다.',
    },
    boss: { ...DECK(26, 24), name: '세이렌의 바위', id: 'siren',
      intro: '노래가 들린다. 귀를 막을 수 없다.' },
    clear: '노래가 멎었다.',
  },

  {
    id: 'messina', name: '메시나 해협', title: '스킬라와 카리브디스',
    sea: true,
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
      cut: CUT_WHIRL,
      name: '메시나 해협',
      intro: '어느 쪽으로도 갈 수 있다. 어느 쪽도 무사하지 않다.',
      options: [
        // 스킬라는 갑판 위를 걸어 다니지 않는다. 배를 옆으로 눕히고
        // 먼 쪽 난간에 매달리게 한다 — 크라켄이 배를 덮치는 그림이다.
        { boss: 'skylla', label: '절벽 쪽으로', line: '스킬라 — 여섯 머리가 배 위로 내려온다',
          stage: BROADSIDE },
        // 카리브디스가 있는 곳은 갑판이 아니라 소용돌이 한가운데다
        // 여기서는 걷지 않는다 — 헤엄치고, 테두리 이빨을 깬다 (stage/maelstrom.js)
        { boss: 'charybdis', label: '소용돌이 쪽으로', line: '카리브디스 — 바다가 통째로 빨려 들어간다',
          stage: { ...WHIRL, maelstrom: { radius: 26, pull: 5.4 } } },
      ],
    },
    clear: '해협을 지났다.',
  },

  {
    id: 'ithaca', name: '이타카', title: '구혼자들',
    // 스무 해 만에 집이 보인다. 판에 들어서기 전에 한 번 보여 준다.
    cut: CUT_ITHACA,
    // 거지 차림으로 들어간다. 아무도 그를 알아보지 못한다.
    beggar: { until: 'boss', say: '누더기를 걸치고 문턱을 넘었다. 아무도 알아보지 못한다' },
    wave: {
      ...HALL,
      intro: '스무 해 만에 문을 열었다. 홀 안이 가득 차 있다.',
      goal: 30,
      steps: [
        { untilKills: 8, maxAlive: 6, interval: 0.9, mix: { warrior: 1 } },
        { untilKills: 18, maxAlive: 11, interval: 0.65, mix: { warrior: 4, archer: 2, shield: 1 }, say: '위층에서도 내려온다' },
        { untilKills: 30, maxAlive: 15, interval: 0.5, mix: { warrior: 4, archer: 2, shield: 2 }, say: '문이란 문에서 쏟아진다' },
      ],
      clear: '한 사람만 남았다.',
    },
    boss: { ...HALL, camDistance: 24, name: '이타카의 홀', id: 'antinoos',
      // 싸움은 활로 시작된다. 거지 차림을 벗기 전에 튼다
      cutBefore: CUT_BOW,
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
  wear: 0,               // 아직 아무 데도 안 갔다. 액자도 갓 걸렸다
  art: ['/img/lude-opening.webp', '/img/lude-opening-b.webp', '/img/lude-opening-c.webp'],
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

/**
 * 막간의 액자가 얼마나 낡았는가. 0 = 갓 건 것, 1 = 스무 해 걸려 있던 것.
 *
 * 같은 액자를 여덟 번 그대로 보여 주면 여덟 번 같은 벽 앞에 선 것이 된다.
 * 판을 지날수록 금박이 빛을 잃고 누렇게 떠야, 걸린 시간이 이야기 안에서
 * 흐른 시간과 같아진다. 그림은 한 장뿐이고 나이만 CSS 로 먹인다.
 */
export const wearAt = fromIndex =>
  Math.min(1, Math.max(0, (fromIndex + 1) / (STAGES.length - 1)))

/** 다음 판으로 넘어갈 때 쓸 막간. */
export function interludeFor(fromIndex) {
  const from = STAGES[fromIndex]
  const to = STAGES[fromIndex + 1]
  if (!from || !to) return null
  const lines = SAILING[from.id] ?? ['배를 밀었다.']
  return {
    scene: PASSAGE[from.id] ?? 'sea',
    wear: wearAt(fromIndex),
    // 글줄마다 한 장씩. 두 번째 장이 없으면 첫 장이 그대로 남는다.
    art: [`/img/lude-${from.id}.webp`, `/img/lude-${from.id}-b.webp`],
    lines: lines.map((text, i) => ({ text, hold: i === lines.length - 1 ? 3000 : 2800 })),
    dest: `${to.name} — ${to.title}`,
  }
}

/**
 * 저승에 들어서는 장면.
 *
 * 액자에 걸지 않는다. 막간의 액자는 "지나온 뱃길을 박물관처럼 돌아본다" 는
 * 장치인데, 지나온 것을 보는 자리에 지금 나를 붙잡으러 오는 것을 걸면
 * 거리가 생긴다 — 액자 안의 것은 이미 끝난 일이니까.
 *
 * 그래서 여기만 테두리를 걷고, 손이 화면에서 직접 나온다 (ui/reach.js).
 * 그리고 곧바로 유물 선택으로 넘어간다 — 사이에 한 화면 더 끼우면
 * 붙잡힌 다음에 숨을 돌리게 된다.
 */
export const UNDERWORLD_CUT = {
  lines: [
    { text: '구덩이에 피를 부었다. <em>흙이 부풀었다.</em>', hold: 2900 },
    { text: '손 하나가 땅을 뚫고 올라온다. <em>으스러진 손이다.</em>', hold: 3600 },
  ],
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
