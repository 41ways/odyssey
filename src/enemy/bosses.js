import { Boss, slam, stomp, ring, lance, volley, spray, summon, suck, lob, mend, gaze } from './boss.js'
import { rand } from '../core/math.js'

/**
 * 보스 도감.
 *
 * 전부 데이터다. 패턴 목록과 페이즈만 쓰면 보스 하나가 된다.
 * below 는 "체력이 이 비율 아래로 떨어지면 이 페이즈" 라는 뜻이다.
 */

/* ── 폴리페모스 ──────────────────────────────────────────
   눈을 찌르기 전과 후가 다른 보스다. 1페는 보고 피할 수 있게 느리게,
   2페는 앞이 안 보이니 아무 데나 던진다. */
export const POLYPHEMOS = {
  /* 소리로 찾는다.
     캄캄한 제 우리 안의 목자다. 멀리 있으면 내가 어디 있는지 모르고 마지막으로
     알아낸 자리를 친다 (Boss.aimPoint). 알아내는 길은 셋 — 7 걸음 안으로
     들어가거나, 그를 때리거나, **양이 울거나** (enemy/sheep.js).
     그래서 이 판은 '어떻게 돌아갈까' 가 판단이 된다. */
  hunts: true, sense: 7,
  id: 'polyphemos', how: '어둠 속에서 **소리로 찾는다** — 멀면 헛친다. 양을 건드리면 들킨다. 쓰러지면 **눈**을 활로 쏜다.', name: '폴리페모스', title: '외눈의 목자',
  // 5미터짜리는 느리게 움직이고 오래 쉰다. 빠르면 커 보이지 않는다.
  hp: 900, radius: 2.2, mass: 200, speed: 1.5, keepRange: [4.4, 8.5], gap: [2.6, 4.0],
  turnHalf: 0.55,        // 고개를 천천히 돌린다. 스치듯 따라붙지 못한다
  barHeight: 7, groggyMult: 2.4, pace: 1.0,
  // 눈. 쓰러졌을 때만 드러나고, 화살로만 찌를 수 있다.
  // 머리뼈를 따라간다. face 는 이마 앞으로 얼마나 나오는지, r 은 맞는 범위.
  // downY 는 '무너졌을 때 눈이 오는 높이' 다. 화살은 1.05 높이로 날아가므로
  // 여기가 너무 높으면 화살이 그 아래로 지나간다 — 맞힐 수 없는 약점이 된다.
  weakPoint: { face: 0.3, r: 1.8, y: 4.3, downY: 2.2, z: 1.0, requires: 'arrow' },
  // 갖춰 입히지 않는다 — 목자지 병사가 아니다. 허리에 두른 거죽 한 장뿐이라
  // 맨살 덩치가 그대로 보인다.
  // 스케치팹 'Cyclops Rig' (DM-913, CC-BY). 리깅 + Idle 포함. 눈은 모델에 있다.
  look: { model: 'cyclopsBody', height: 6.4, bulk: 1.55, tint: '#c9a07a',
    gear: ['legs'],
    // 이 모델은 선 자세부터 상체가 접혀 있다 — 머리가 골반 한 뼘 위에 온다.
    // 그만큼 되젖혀서 세운다. 완전히 펴지는 않는다, 목자는 구부정한 게 맞다
    straighten: { bone: 'Spine_77', amount: 0.6 } },
  phases: [
    {
      below: 1,
      say: '동굴이 울린다. 무언가 거대한 것이 일어섰다',
      patterns: [
        slam({ id: 'swing', startup: 1.35, active: 0.14, recovery: 1.4, range: 7.5, halfAngle: 0.85,
          damage: 26, knockback: 16, shake: 0.35, pick: { max: 8.5, weight: 3, cooldown: 4.5 } }),
        stomp({ id: 'crush', startup: 1.55, active: 0.14, recovery: 2.2, radius: 5.0,
          damage: 32, knockback: 18, groggy: 2.0, shake: 0.7,
          pick: { max: 7, weight: 2, cooldown: 8 } }),
        // 양을 던진다 — 포물선으로 날아가 떨어진 자리에서 터진다
        lob({ id: 'sheep', kind: 'sheep', startup: 1.25, active: 0.12, recovery: 1.3,
          count: 1, radius: 2.6, flight: 1.15, height: 6.0,
          damage: 24, knockback: 12, bulletSize: 0.62, shake: 0.25,
          pick: { min: 5, weight: 3, cooldown: 5 } }),
        ring({ id: 'roar', startup: 1.1, active: 0.12, recovery: 1.6, inner: 3.4, outer: 11,
          damage: 18, knockback: 6, stagger: 0.9, color: '#ffd166', shake: 0.5,
          pick: { weight: 2, cooldown: 10 } }),
      ],
    },
    {
      below: 0.5,
      // 체력이 절반이 되면 쓰러진다. 눈을 화살로 쏴야 다음으로 넘어간다.
      needsWeakPoint: true,
      weakHint: '눈 — 활로',
      downSay: '무릎을 꿇었다. 지금이다 — 눈을 쏴라',
      say: '눈이 멀었다. 이제 아무 데나 던진다',
      patterns: [
        // 눈이 멀었으니 겨냥이 안 된다 — 세 마리를 흩뿌린다
        lob({ id: 'sheep_wild', kind: 'sheep', startup: 0.95, active: 0.12, recovery: 1.0,
          count: 3, scatter: 4.2, radius: 2.4, flight: 1.0, height: 5.2,
          damage: 22, knockback: 11, bulletSize: 0.58, shake: 0.28,
          pick: { weight: 5, cooldown: 3.4 } }),
        slam({ id: 'blind_swing', startup: 0.95, active: 0.14, recovery: 1.15, range: 8.5, halfAngle: 1.6,
          damage: 28, knockback: 16, shake: 0.4, pick: { max: 9.5, weight: 3, cooldown: 3.6 } }),
        stomp({ id: 'crush2', startup: 1.25, active: 0.14, recovery: 1.9, radius: 5.6,
          damage: 34, knockback: 20, groggy: 1.8, shake: 0.8, pick: { weight: 2, cooldown: 7 } }),
        ring({ id: 'roar2', startup: 0.9, active: 0.12, recovery: 1.3, inner: 2.8, outer: 13,
          damage: 20, stagger: 1.0, color: '#ffd166', shake: 0.6, pick: { weight: 2, cooldown: 8 } }),
      ],
    },
  ],
}

/* ── 안티파테스 (라이스트리고네스 족장) ──────────────────
   파훼: **부름꾼을 먼저 치운다.**

   이 자는 혼자 싸우지 않는다. 열한 척을 가라앉힌 건 왕의 창이 아니라
   절벽 위에서 던진 돌이었다. 그래서 왕만 두들기는 길을 막았다 —
   부른 것이 하나라도 살아 있으면 왕은 안 깎인다 (Boss.#warded).

   덕분에 이 판의 리듬이 폴리페모스와 정반대가 된다. 거인 판은 큰 놈 하나를
   보고 피하는 판이고, 여기는 **시선을 나눠야 하는** 판이다. 왕의 창을 피하면서
   활잡이를 먼저 끊어야 하니까. 파훼가 다르면 판이 다르다. */
export const ANTIPHATES = {
  id: 'antiphates', how: '왕은 **부름꾼이 살아 있는 동안 안 깎인다.** 먼저 부름꾼을 치운다.', name: '안티파테스', title: '식인 거인의 왕',
  hp: 760, radius: 1.5, mass: 90, speed: 3.6, keepRange: [3.4, 7.4], gap: [1.1, 1.9],
  barHeight: 5.4, groggyMult: 1.9,
  guarded: true,           // 부름꾼이 살아 있으면 몸이 안 열린다
  /**
   * 왕이다. 그런데 여태 **사람 몸을 4.6 미터로 늘린 것**이었다 —
   * 청동을 두르긴 했지만 실루엣이 사람이라, '식인 거인의 왕' 이 몸에
   * 안 보였다. 키만 큰 사람과 거인은 다른 것이다.
   *
   * 받아 온 거인으로 바꾼다. Attack · Idle · Run · Walk · HitRecieve ·
   * Death 일곱 클립이 붙어 있어서 휘두를 때 휘두르는 동작을 한다
   * (Quaternius, CC0 · CREDITS.md).
   *
   * 제 몸이 붙은 보스는 코드 조각을 안 받는데 (buildBossBody), 이 보스는
   * 원래 조각이 없었으니 잃는 게 없다. 파훼는 부름꾼이고 그건 몸이
   * 아니라 규칙이다.
   */
  // 키 큰 사람이 아니라 거인이어야 한다. 받아 온 몸으로 간다.
  look: { model: 'antiphates', height: 5.2, bulk: 1.15, tint: '#b9a48c', gear: [] },
  phases: [
    {
      below: 1,
      say: '항구 전체가 우리를 향해 돌아섰다',
      // 처음부터 둘을 세워 둔다. 시작하자마자 "왕이 안 깎인다" 를 배워야
      // 그 다음부터 부름 패턴이 위협으로 읽힌다.
      onEnter: b => {
        // 같은 종족이 지킨다. 사람 둘이 거인 왕을 지키고 있으면
        // '부름꾼' 이 왕의 백성으로 안 읽힌다.
        for (let i = 0; i < 2; i++) {
          const e = b.world.spawnMinion?.('giant', b.pos.x + rand(-5, 5), b.pos.z + rand(-5, 5))
          if (e) e.guardsBoss = b
        }
      },
      patterns: [
        slam({ id: 'cleave', startup: 0.72, active: 0.1, recovery: 0.7, range: 5.4, halfAngle: 0.9,
          damage: 22, pick: { max: 6.5, weight: 3, cooldown: 2.2 } }),
        lance({ id: 'hurl', startup: 0.85, active: 0.08, recovery: 0.7, range: 22, halfAngle: 0.08,
          damage: 24, pick: { min: 4, weight: 3, cooldown: 3 } }),
        // 부름. 활잡이 둘이 절벽 쪽에 선다 — 살아 있으면 왕이 안 깎이니
        // 이 패턴이 나온 순간 표적이 바뀐다.
        // 부름. 절벽 위의 제 백성을 부른다 — 살아 있으면 왕이 안 깎이니
        // 이 패턴이 나온 순간 표적이 바뀐다. 그리고 그놈들이 돌을 던진다.
        summon({ id: 'call', startup: 1.2, active: 0.1, recovery: 0.9, kind: 'giant', count: 2, radius: 8,
          guards: true, say: '왕이 절벽 위를 부른다', pick: { weight: 3, cooldown: 11 } }),
      ],
    },
    {
      below: 0.45,
      say: '부하가 다 죽자 혼자서 둘을 한다',
      // 2페는 부름이 없다. 여기서도 불러 대면 판이 계속 잡졸 정리가 되고,
      // 왕과 단둘이 되는 순간이 안 온다 — 마지막은 둘만 남아야 한다.
      patterns: [
        slam({ id: 'cleave2', startup: 0.55, active: 0.1, recovery: 0.55, range: 5.8, halfAngle: 1.1,
          damage: 24, pick: { max: 7, weight: 3, cooldown: 1.8 } }),
        lance({ id: 'hurl2', startup: 0.6, active: 0.08, recovery: 0.5, range: 24, halfAngle: 0.07,
          damage: 26, pick: { weight: 3, cooldown: 2.2 } }),
        volley({ id: 'rain', kind: 'rock', startup: 0.9, active: 0.1, recovery: 0.8, count: 5, spread: 0.55,
          damage: 16, speed: 17, bullet: '#ff9a4a', pick: { min: 5, weight: 3, cooldown: 4 } }),
        stomp({ id: 'quake', startup: 0.85, active: 0.1, recovery: 1.2, radius: 4.2,
          damage: 26, groggy: 1.2, pick: { max: 6, weight: 2, cooldown: 6 } }),
      ],
    },
  ],
}

/* ── 키르케 ──────────────────────────────────────────────
   직접 때리지 않는다. 돼지를 불러 막고 뒤에서 마법을 던진다.

   파훼: **잔을 끊는다.**

   앞의 두 보스는 둘 다 정답이 "물러서기" 다 — 거인의 장판을 보고 피하고,
   왕의 부름꾼을 밖에서 정리한다. 세 판 연속 도망이면 리듬이 하나뿐이다.
   그래서 이 여자에게는 **들어가야 이기는** 패턴을 준다.

   그 여자는 잔을 들고 있다. 그 잔으로 사람을 짐승으로 만들었고, 같은 잔으로
   자기 상처를 덮는다. 잔을 드는 동안은 몸이 열려 있다 — 그때 때리면 끊기고
   오래 멍해진다. 안 끊으면 체력의 두 할이 돌아온다. 7초 시전을 보고도
   물러서면 싸움이 길어지는 게 아니라 **안 끝난다**. */
export const KIRKE = {
  id: 'kirke', how: '술잔을 들면 **붙어라** — 멀리 있으면 돼지가 된다. 몰리를 받았다면 통하지 않는다.', name: '키르케', title: '아이아이에의 마녀',
  hp: 620, radius: 0.6, mass: 24, speed: 4.4, keepRange: [7, 11], gap: [0.8, 1.4],
  barHeight: 2.4, groggyMult: 1.6, turnHalf: 0.1,
  breakGroggy: 3.2,        // 끊었을 때 열리는 반격 창. 들어간 값을 돌려준다
  // 후드를 눌러쓴 여자 몸. 얼굴이 보이지 않아야 '마녀'로 읽힌다.
  look: { set: 'witch', height: 1.76, bulk: 0.96, tint: '#b58ad8',
    gear: ['legs', 'feet', 'body', 'arms', 'hood'] },
  phases: [
    {
      below: 1,
      say: '술잔을 든 여자가 웃는다',
      patterns: [
        // 그 여자의 집 둘레에는 사람이었던 짐승들이 있다
        summon({ id: 'pigs', startup: 1.05, active: 0.1, recovery: 0.8, count: 5, radius: 7,
          mix: { pig: 3, wolf: 2 }, pick: { weight: 4, cooldown: 6 } }),
        volley({ id: 'fireball', kind: 'fire', startup: 0.75, active: 0.08, recovery: 0.6, count: 3, spread: 0.32,
          damage: 18, speed: 13, bullet: '#ff7a3a', bulletSize: 0.42,
          pick: { weight: 4, cooldown: 2.6 } }),
        // 변신 마법 — 느리게 따라온다. 걸어서는 못 떨구고 구르기로 쳐내야 한다.
        volley({ id: 'hex', kind: 'orb', startup: 1.05, active: 0.08, recovery: 0.8,
          count: 1, spread: 0, damage: 12, speed: 4.6, bullet: '#c77dff', bulletSize: 0.5,
          range: 60, homing: 1.5, parryable: true, hex: true,
          pick: { weight: 3, cooldown: 7 } }),
        // 잔. 시전이 길고(2.4초) 장판이 발밑에만 깔린다 — 아프지 않은 장판이라
        // 처음 보면 그냥 밟고 들어가게 된다. 그게 정답이다.
        // 멀리 있을 때만 든다 (min: 6) — 붙어 있는데 들면 공짜로 끊긴다.
        mend({ id: 'cup', startup: 2.4, active: 0.1, recovery: 1.1, radius: 3.0, heal: 0.20,
          say: '잔을 입으로 가져간다 — 저걸 깨야 한다',
          breakSay: '잔이 깨졌다',
          pick: { min: 6, weight: 3, cooldown: 13 } }),
      ],
    },
    {
      below: 0.5,
      say: '웃음이 그쳤다',
      patterns: [
        spray({ id: 'circle', kind: 'fire', startup: 0.8, active: 0.08, recovery: 0.7, count: 16, damage: 14,
          speed: 7.5, bullet: '#ff7a3a', warn: 3, pick: { weight: 4, cooldown: 4 } }),
        volley({ id: 'fireball2', kind: 'fire', startup: 0.52, active: 0.08, recovery: 0.45, count: 5, spread: 0.5,
          damage: 18, speed: 15, bullet: '#ff7a3a', bulletSize: 0.42,
          pick: { weight: 4, cooldown: 2 } }),
        summon({ id: 'pigs2', startup: 0.85, active: 0.1, recovery: 0.6, count: 7, radius: 8,
          mix: { pig: 3, wolf: 3, warrior: 1 },
          pick: { weight: 3, cooldown: 8 } }),
        volley({ id: 'hex2', kind: 'orb', startup: 0.8, active: 0.08, recovery: 0.6,
          count: 2, spread: 0.5, damage: 12, speed: 5.0, bullet: '#c77dff', bulletSize: 0.5,
          range: 60, homing: 1.8, parryable: true, hex: true,
          pick: { weight: 3, cooldown: 6 } }),
        ring({ id: 'ward', startup: 0.7, active: 0.1, recovery: 0.8, inner: 2.0, outer: 6.5,
          damage: 20, color: '#c77dff', pick: { weight: 2, cooldown: 6 } }),
        // 2페의 잔은 더 빨리 들고 더 많이 되찾는다. 돼지를 뚫고 들어가야 하니
        // 시간이 짧아진 만큼 '지금 가야 한다' 가 분명해진다.
        mend({ id: 'cup2', startup: 1.8, active: 0.1, recovery: 0.9, radius: 3.4, heal: 0.24,
          say: '또 잔을 든다',
          breakSay: '잔이 깨졌다',
          pick: { min: 5, weight: 4, cooldown: 10 } }),
      ],
    },
  ],
}

/* ── 세이렌 ──────────────────────────────────────────────
   바닥으로 들어갔다가 내 발밑에서 솟는다. 탄막과 흡수.

   파훼: **등 뒤로 돌아간다.**

   앞의 셋은 정답이 다 거리였다 — 물러서기(거인), 표적 바꾸기(왕),
   들어가기(마녀). 이 판은 방향이다. 노래는 정면 반쪽을 통째로 덮고
   등 뒤 한 조각만 조용하다. 가까이 있어도 되고 멀리 있어도 되는데,
   뒤여야 한다 (boss.js 의 gaze).

   장판이 거의 다 칠해지므로, 이 판에서는 **안 칠해진 조각**이 정답이 된다.
   그리고 노래는 안 아프다 — 붙잡는다. 잡히면 그 다음 탄막이 아픈 것이 되고,
   그게 이 여자가 노래로 배를 가라앉히는 방식이다. */
export const SIREN = {
  id: 'siren', how: '노래는 **등 뒤 한 조각**만 조용하다. 맞으면 느려지고, 그 다음 탄막이 아프다.', name: '세이렌', title: '노래하는 것',
  // 몸이 키 4.2 가 되면서 몸통 반지름과 이름표 높이를 같이 올렸다.
  // 0.7 이면 칼이 꼬리 가장자리를 스쳐도 헛친다.
  hp: 680, radius: 1.0, mass: 26, speed: 3.2, keepRange: [5, 9], gap: [0.7, 1.3],
  barHeight: 4.4, groggyMult: 1.7,
  // 새의 몸(호메로스 원전)이 아니라 인어로 간다 — 바다에서 노래해 배를
  // 끌어들이는 쪽이 이 판의 그림과 맞는다. 받아 온 몸이라 사람 뼈대가 아니고,
  // 그래서 클립 대신 코드가 흔든다 (sway).
  look: { model: 'siren', height: 4.2, bulk: 1.0, tint: null, gear: [], sway: 1 },
  phases: [
    {
      below: 1,
      say: '노래가 들린다. 귀를 막을 수 없다',
      patterns: [
        spray({ id: 'song', kind: 'orb', startup: 0.9, active: 0.08, recovery: 0.7, count: 14, damage: 13,
          speed: 6.5, bullet: '#8fd6ff', warn: 3.4, pick: { weight: 4, cooldown: 3.4 } }),
        // 잠수 — 시전 동안 바닥으로 들어갔다가 플레이어가 있던 자리에서 솟는다
        stomp({ id: 'surface', startup: 1.0, active: 0.12, recovery: 0.9, radius: 3.4,
          damage: 24, knockback: 12, color: '#8fd6ff', groggy: 0.9,
          onStart(b, run) {
            const p = b.world.player
            run.origin = { x: p.pos.x, z: p.pos.z }
            b.diving = 1
          },
          onEnd(b, run) { b.pos.set(run.origin.x, 0, run.origin.z); b.diving = 0 },
          pick: { weight: 4, cooldown: 5 } }),
        ring({ id: 'drain', startup: 0.6, active: 0.1, recovery: 0.8, inner: 0, outer: 3.2,
          damage: 16, color: '#b48cff',
          onEnd(b) { b.hp = Math.min(b.maxHp, b.hp + 28) },   // 닿으면 빨아먹는다
          pick: { max: 4.5, weight: 3, cooldown: 4 } }),
        // 노래. 처음이라 시전을 길게(1.9초) 준다 — 장판을 보고 "뒤로 돌아야
        // 한다" 를 스스로 알아낼 시간이다. 한 번 잡혀 보면 다음부터는 안다.
        gaze({ id: 'aria', startup: 1.9, active: 0.12, recovery: 1.5,
          range: 26, halfAngle: Math.PI * 0.5, damage: 10, slowFor: 3.0, slowTo: 0.45,
          say: '노래가 정면으로 퍼진다 — 등 뒤로 돌아라',
          groggy: 1.1, pick: { weight: 4, cooldown: 9 } }),
      ],
    },
    {
      below: 0.45,
      say: '노래가 비명으로 바뀐다',
      patterns: [
        spray({ id: 'song2', kind: 'orb', startup: 0.62, active: 0.08, recovery: 0.55, count: 20, damage: 14,
          speed: 7.5, bullet: '#b48cff', warn: 3, pick: { weight: 5, cooldown: 2.4 } }),
        stomp({ id: 'surface2', startup: 0.72, active: 0.12, recovery: 0.7, radius: 3.8,
          damage: 26, color: '#8fd6ff', groggy: 0.7,
          onStart(b, run) { const p = b.world.player; run.origin = { x: p.pos.x, z: p.pos.z }; b.diving = 1 },
          onEnd(b, run) { b.pos.set(run.origin.x, 0, run.origin.z); b.diving = 0 },
          pick: { weight: 5, cooldown: 3.2 } }),
        ring({ id: 'drain2', startup: 0.5, active: 0.1, recovery: 0.7, inner: 0, outer: 3.8,
          damage: 20, color: '#b48cff',
          onEnd(b) { b.hp = Math.min(b.maxHp, b.hp + 34) },
          pick: { max: 5, weight: 3, cooldown: 3.4 } }),
        // 2페의 노래는 더 넓고(0.62π) 더 빠르다. 조용한 조각이 좁아지니
        // 1페에서 배운 답을 더 정확히 내야 한다 — 답이 바뀌는 게 아니라
        // 같은 답의 여유가 줄어드는 쪽이 배운 것을 안 버린다.
        gaze({ id: 'aria2', startup: 1.25, active: 0.12, recovery: 1.1,
          range: 30, halfAngle: Math.PI * 0.62, damage: 12, slowFor: 3.4, slowTo: 0.40,
          say: '비명이 갑판을 훑는다',
          groggy: 0.9, pick: { weight: 5, cooldown: 7 } }),
      ],
    },
  ],
}

/* ── 스킬라 ──────────────────────────────────────────────
   배 위에서 싸운다. 1페는 머리 셋이 번갈아 내려찍고,
   2페는 남은 셋이 끈질기게 쫓는다.

   파훼: **머리를 끊는다. 내려찍고 거둬들이는 사이에만.**

   다른 파훼들은 다 공격 **전**의 판단이다 — 장판을 보고 피하고(거인),
   표적을 바꾸고(왕), 시전 중에 들어가고(마녀), 등 뒤로 돌고(세이렌).
   이것 하나는 공격 **뒤**다. 머리가 갑판을 치고 벽으로 돌아가기 전
   회복 구간에만 끊긴다. 그러니 붙어서 기다려야 하고, 기다리는 동안은
   다른 머리에 맞는다. 물러서면 영원히 못 끊는다.

   보상이 값을 한다 — 끊은 머리의 패턴이 판에서 **사라진다**
   (Boss.#choose). 여섯 패턴이 여섯 머리고, 끊을수록 보스가 순해진다.
   그게 눈에 보이는 게 이 파훼의 값이다. 몬헌의 부위 파괴다.

   배수는 1.8 배. 기다리다 맞는 값을 돌려줘야 기다릴 이유가 생기고,
   여섯 번이면 체력의 절반쯤이 여기서 나간다 — 파훼가 싸움의 절반이다. */
export const SKYLLA = {
  id: 'skylla', how: '여섯 머리는 **거둬들일 때** 끊긴다. 내려찍은 뒤 회복 구간을 노린다.', name: '스킬라', title: '여섯 머리의 것',
  hp: 840, radius: 1.4, mass: 140, speed: 2.6, keepRange: [4, 8], gap: [0.6, 1.1],
  barHeight: 4.6, groggyMult: 2.0,
  heads: 6, severMult: 1.8, severGroggy: 1.8,
  // 먼 쪽 난간(-z)에 매달린다. 좌우로만 옮겨 다니며 친다.
  // 난간에 딱 붙이지 않고 갑판 쪽으로 걸친다 — 뱃전 밖에 세우면
  // 화면 위로 밀려나고, 머리가 갑판에 닿지도 않는다.
  rail: -1, railInset: 5.2,
  /**
   * 사람 몸이 없다 — 절벽에서 뻗는 돌 촉수 여섯뿐이다.
   *
   * 전에는 `model: 'orochi'` 였다 (스케치팹 'Yamata no Orochi', tran95).
   * 그런데 그게 두 가지로 틀렸다 —
   *   1. **정적 메시라 목이 안 움직인다.** 내려찍는 보스인데 몸이 안 움직이면
   *      언제 때릴지를 못 읽는다. 파훼가 '회복 구간을 노리기' 인 이상
   *      때리는 동작과 거둬들이는 동작이 보이는 게 규칙의 절반이다.
   *   2. 머리가 **여덟**이다. '여섯 머리의 것' 이라고 부르면서 여덟을 보여
   *      주고 있었다.
   * 게다가 제 모델이 붙은 보스는 코드 조각을 안 받으므로 (boss.js 의
   * buildBossBody), 공들여 만든 여섯 머리 조각이 통째로 죽은 코드였다.
   *
   * 그래서 몸을 버리고 **촉수 여섯을 몸으로 삼는다.** 뼈대는 촉수를 매달
   * 축으로만 쓰고 살은 감춘다 (hideBody) — 카리브디스가 이미 쓰는 방식이다.
   * 촉수는 받아 온 애니메이션 모델이고 (Quaternius, CC0) 머리 끝에는
   * 돌 뱀 머리를 얹는다 (bossparts.js 의 skyllaWall).
   */
  // 촉수 여섯이 한 벌로 온다 (Kraken Animation, Yanez Designs, CC-BY).
  // 코드로 마디를 겹쳐 흔들던 것과 실루엣이 다르다 — 처음부터 촉수로 만들어졌다.
  look: { model: 'skylla', height: 5.0, bulk: 1.0, tint: '#7f9a86', gear: [],
    hideBody: true, sink: 0.9 },
  phases: [
    {
      below: 1,
      say: '절벽 그늘에서 머리가 내려온다 — 치고 물러설 때를 노려라',
      patterns: [
        stomp({ id: 'head1', head: 1, startup: 0.8, active: 0.1, recovery: 0.55, radius: 2.8, damage: 22,
          color: '#7fd08a', pick: { weight: 5, cooldown: 1.2 } }),
        stomp({ id: 'head2', head: 2, startup: 0.7, active: 0.1, recovery: 0.5, radius: 2.4, damage: 20,
          color: '#7fd08a', pick: { weight: 5, cooldown: 1.0 } }),
        slam({ id: 'sweep', head: 3, startup: 1.0, active: 0.12, recovery: 1.3, range: 8, halfAngle: 1.4,
          damage: 28, knockback: 14, groggy: 1.5, shake: 0.5,
          pick: { weight: 3, cooldown: 6 } }),
      ],
    },
    {
      below: 0.45,
      say: '남은 머리가 끈질기게 따라붙는다',
      patterns: [
        lance({ id: 'stab', head: 4, startup: 0.58, active: 0.08, recovery: 0.5, range: 11, halfAngle: 0.13,
          damage: 26, color: '#7fd08a', pick: { weight: 5, cooldown: 1.4 } }),
        stomp({ id: 'smash', head: 5, startup: 0.72, active: 0.1, recovery: 1.1, radius: 3.6, damage: 30,
          groggy: 1.2, color: '#7fd08a', pick: { weight: 4, cooldown: 3 } }),
        ring({ id: 'lash', head: 6, startup: 0.66, active: 0.1, recovery: 0.7, inner: 2.4, outer: 8,
          damage: 22, color: '#7fd08a', pick: { weight: 3, cooldown: 4.5 } }),
      ],
    },
  ],
}

/* ── 카리브디스 ──────────────────────────────────────────
   움직이지 않는다. 소용돌이를 피하면서 가운데 눈을 친다. 탄막 게임. */
export const CHARYBDIS = {
  id: 'charybdis', how: '멈추면 빨려 들어간다. 헤엄치면서 **테두리 이빨**을 깬다.', name: '카리브디스', title: '삼키는 소용돌이',
  hp: 720, radius: 1.6, mass: 999, speed: 0, keepRange: [0, 0], gap: [0.5, 0.9],
  barHeight: 3.4, groggyMult: 1.5, turnHalf: 0.4,
  // 소용돌이 그 자체다. 사람 몸은 감추고 깔때기와 팔만 남긴다.
  look: { height: 2.6, bulk: 1.4, tint: '#5a7fa8', gear: [], hideBody: true },
  phases: [
    {
      below: 1,
      say: '바다가 통째로 빨려 들어간다',
      patterns: [
        spray({ id: 'gyre', kind: 'water', startup: 0.8, active: 0.08, recovery: 0.6, count: 18, damage: 14,
          speed: 6.5, bullet: '#8fd6ff', warn: 3.6, pick: { weight: 5, cooldown: 2.6 } }),
        // 빨아들이기 — 걸어서는 못 벗어난다. 구르기로 끊고, 끝난 뒤 잠잠할 때 붙는다.
        suck({ id: 'pull', startup: 0.9, active: 1.6, recovery: 1.8, radius: 16, eye: 2.6,
          damage: 26, pulls: 7.5, groggy: 2.2, color: '#6fa8ff', shake: 0.35,
          pick: { weight: 4, cooldown: 7 } }),
        volley({ id: 'spout', kind: 'water', startup: 0.7, active: 0.08, recovery: 0.5, count: 7, spread: 0.75,
          damage: 15, speed: 11, bullet: '#bfe4ff', pick: { weight: 4, cooldown: 2.2 } }),
      ],
    },
    {
      below: 0.45,
      say: '소용돌이가 빨라진다',
      patterns: [
        spray({ id: 'gyre2', kind: 'water', startup: 0.55, active: 0.08, recovery: 0.45, count: 26, damage: 15,
          speed: 8, bullet: '#8fd6ff', warn: 3.2, pick: { weight: 6, cooldown: 1.8 } }),
        suck({ id: 'pull2', startup: 0.65, active: 1.9, recovery: 1.5, radius: 17, eye: 3.0,
          damage: 30, pulls: 10, groggy: 1.8, color: '#6fa8ff', shake: 0.45,
          pick: { weight: 4, cooldown: 5.5 } }),
        volley({ id: 'spout2', kind: 'water', startup: 0.5, active: 0.08, recovery: 0.4, count: 11, spread: 1.0,
          damage: 16, speed: 12, bullet: '#bfe4ff', pick: { weight: 5, cooldown: 1.6 } }),
      ],
    },
  ],
}

/* ── 텔레고노스 ──────────────────────────────────────────
   오디세우스와 같은 무기, 같은 패턴, 모든 유물. 체력이 무한이라 이길 수 없다.
   입힌 피해량이 그대로 점수가 된다. */
export const TELEGONOS = {
  id: 'telegonos', name: '텔레고노스', title: '멀리서 태어난 아들',
  hp: 1e9, radius: 0.55, mass: 40, speed: 6.4, keepRange: [2.6, 5], gap: [0.35, 0.7],
  barHeight: 2.4, groggyMult: 1, turnHalf: 0.05, endless: true,
  /**
   * 후드를 쓴 자. 바다에서 온 모르는 아들이다 — 오디세우스가 끝까지
   * 누군지 모르고 죽는 상대라, 얼굴이 보이지 않는 쪽이 맞다.
   *
   * 전에는 안티노오스와 **똑같은 몸에 색만 달랐다.** 마지막 두 보스가
   * 서로 구분이 안 됐고 잡졸과도 구분이 안 됐다.
   */
  look: { model: 'hooded', height: 1.84, bulk: 1.02, tint: '#8fa0c8', gear: [] },
  phases: [
    {
      below: 1,
      say: '같은 무기, 같은 손. 이길 수 없다',
      patterns: [
        slam({ id: 't_slash', startup: 0.24, active: 0.08, recovery: 0.3, range: 3.4, halfAngle: 1.1,
          damage: 18, knockback: 6, pick: { max: 4.2, weight: 6, cooldown: 0.7 } }),
        slam({ id: 't_heavy', startup: 0.42, active: 0.1, recovery: 0.55, range: 4.2, halfAngle: 1.9,
          damage: 30, knockback: 14, stagger: 0.5, pick: { max: 5, weight: 3, cooldown: 3 } }),
        lance({ id: 't_spear', startup: 0.55, active: 0.08, recovery: 0.45, range: 20, halfAngle: 0.07,
          damage: 26, color: '#c08a3e', pick: { min: 3, weight: 4, cooldown: 2.4 } }),
        volley({ id: 't_bow', kind: 'arrow', startup: 0.5, active: 0.08, recovery: 0.4, count: 1, spread: 0,
          damage: 20, speed: 30, bullet: '#ffd27a', bulletSize: 0.3,
          pick: { min: 4, weight: 4, cooldown: 1.6 } }),
        ring({ id: 't_shield', startup: 0.45, active: 0.1, recovery: 0.6, inner: 0, outer: 4.2,
          damage: 14, stagger: 0.8, color: '#9fd8ff', pick: { max: 5, weight: 2, cooldown: 5 } }),
      ],
    },
  ],
}

/* ── 안티노오스 ──────────────────────────────────────────
   구혼자들의 우두머리. 오디세우스가 활을 들고 처음 쏜 자다.
   사람이라 크지 않고, 대신 빠르고 부하를 계속 부른다.

   파훼: **잔을 들 때 활을 꽉 당겨서 쏜다.**

   앞의 다섯은 다 근접 창을 보상한다 — 시전을 끊고(마녀), 회복을
   때리고(스킬라), 그로기에 몰아친다(거인·왕). 이 하나는 **거리를 벌리고
   오래 기다리는 것**을 요구한다. 고함 한 번에 구혼자 여섯이 사방에서
   들어오는데 그 안에서 1초를 당기고 있어야 하니, 자리를 만드는 게
   실력이 된다. 차징이 게임 전체에서 제일 값을 하는 자리가 여기다.

   단, 활은 **열쇠고 화력이 아니다.** 처음에는 이 보스가 늘 화살만 받게
   짜 봤는데, 그러면 칼을 키운 사람은 마지막 판에서 자기 빌드가 통째로
   무효가 된다. 로그라이크에서 그건 난이도가 아니라 벽이다.
   그래서 잔을 든 동안만 몸이 닫히고, 그걸 여는 건 꽉 당긴 화살
   하나뿐이다. 열리면 4초를 멍해지니 그 뒤는 자기 빌드로 몰아치면 된다.
   문을 여는 데만 활이 필요하고, 문 안에서 하는 일은 자유다.

   이야기에서도 그렇다. 그 활은 아무도 못 당기는 활이었고, 그가 쏜 것은
   잔을 입으로 가져가던 자였다. */
export const ANTINOOS = {
  id: 'antinoos', how: '활을 든 자다 — **기둥 뒤**로 붙는다. 구혼자가 붙으면 먼저 떼어 낸다.', name: '안티노오스', title: '구혼자들의 우두머리',
  hp: 700, radius: 0.55, mass: 38, speed: 6.2, keepRange: [5.5, 9], gap: [0.5, 0.9],
  flees: true,          // 붙으면 도망친다. 쫓아가서 잡아야 한다
  barHeight: 2.4, groggyMult: 1.9, turnHalf: 0.07,
  // 문턱은 '얼마나 당겼나' 로 본다. 피해량으로 보면 활 성장을 쌓은 사람은
  // 탭 사격으로도 넘어서, 시험이 아니라 성장 검사가 된다 (Boss.hurt).
  bowMin: 0.72, bowHint: '활을 꽉 당겨라', breakGroggy: 4.0,
  /**
   * 금과 청동을 두른 귀족. 남의 집에서 왕처럼 굴던 자다.
   *
   * 전에는 텔레고노스와 **똑같은 몸에 색만 달랐다** — 마지막 두 보스가
   * 서로도, 잡졸과도 구분이 안 됐다. 이름이 다르면 몸도 달라야 한다.
   */
  look: { model: 'king', height: 1.88, bulk: 1.0, tint: null, gear: [] },
  phases: [
    {
      below: 1,
      say: '술잔을 내려놓고 칼을 뽑는다',
      patterns: [
        slam({ id: 'a_slash', startup: 0.34, active: 0.08, recovery: 0.36, range: 3.4, halfAngle: 1.0,
          damage: 18, knockback: 7, pick: { max: 4.4, weight: 5, cooldown: 1.1 } }),
        volley({ id: 'a_bow', kind: 'arrow', startup: 0.55, active: 0.08, recovery: 0.45, count: 3, spread: 0.3,
          damage: 15, speed: 26, bullet: '#ffd27a', bulletSize: 0.3,
          pick: { min: 3.5, weight: 4, cooldown: 2.2 } }),
        // 고함 — 홀 전체가 들린다. 사방에서 몰려온다.
        // 활 쏘는 놈, 칼 든 놈, 앞에서 막아 주는 놈이 같이 온다
        summon({ id: 'a_shout', startup: 0.8, active: 0.1, recovery: 0.9, count: 6, radius: 10,
          mix: { warrior: 4, archer: 2, shield: 1 },
          shake: 0.5, color: '#ffd166', say: '“여기다! 놈이 여기 있다!”',
          pick: { weight: 5, cooldown: 5.5 } }),
        // 잔을 든다. 이 2.6초 동안 몸이 닫히고, 꽉 당긴 화살만 통한다.
        // 안 쏘면 두 할이 돌아가고 다시 처음부터다.
        mend({ id: 'a_cup', startup: 2.6, active: 0.1, recovery: 1.0, radius: 2.8, heal: 0.18,
          breakBy: 'draw', color: '#ffd27a',
          say: '잔을 들어 입으로 가져간다 — 지금 쏴라',
          breakSay: '잔이 손에서 떨어졌다',
          pick: { weight: 4, cooldown: 12 } }),
      ],
    },
    {
      below: 0.45,
      say: '홀 전체가 그를 둘러싼다',
      patterns: [
        slam({ id: 'a_slash2', startup: 0.26, active: 0.08, recovery: 0.3, range: 3.6, halfAngle: 1.2,
          damage: 20, knockback: 8, pick: { max: 4.8, weight: 6, cooldown: 0.8 } }),
        slam({ id: 'a_heavy', startup: 0.46, active: 0.1, recovery: 0.6, range: 4.4, halfAngle: 2.0,
          damage: 30, knockback: 14, stagger: 0.5, groggy: 0.9, pick: { max: 5.5, weight: 3, cooldown: 3.4 } }),
        volley({ id: 'a_rain', kind: 'arrow', startup: 0.5, active: 0.08, recovery: 0.4, count: 5, spread: 0.55,
          damage: 15, speed: 28, bullet: '#ffd27a', bulletSize: 0.3,
          pick: { weight: 4, cooldown: 1.8 } }),
        summon({ id: 'a_shout2', startup: 0.62, active: 0.1, recovery: 0.7, count: 9, radius: 11,
          mix: { warrior: 4, archer: 3, shield: 2 },
          shake: 0.6, color: '#ffd166', say: '“전부 들어와라!”',
          pick: { weight: 5, cooldown: 5.5 } }),
        // 2페의 잔은 더 짧다(1.9초). 홀이 가득 찬 상태에서 그 사이에
        // 자리를 만들어 당겨야 하니, 답은 그대로고 여유만 줄어든다.
        mend({ id: 'a_cup2', startup: 1.9, active: 0.1, recovery: 0.8, radius: 3.2, heal: 0.20,
          breakBy: 'draw', color: '#ffd27a',
          say: '또 잔을 든다',
          breakSay: '잔이 깨졌다',
          pick: { weight: 5, cooldown: 10 } }),
      ],
    },
  ],
}

export const BOSSES = {
  polyphemos: POLYPHEMOS, antiphates: ANTIPHATES, kirke: KIRKE,
  siren: SIREN, skylla: SKYLLA, charybdis: CHARYBDIS,
  antinoos: ANTINOOS, telegonos: TELEGONOS,
}

export function makeBoss(id, world, fx) {
  const cfg = BOSSES[id]
  if (!cfg) throw new Error(`없는 보스: ${id}`)
  return new Boss(world, fx, cfg)
}
