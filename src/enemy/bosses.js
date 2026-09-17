import { Boss, slam, stomp, ring, lance, volley, spray, summon } from './boss.js'
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
  id: 'polyphemos', name: '폴리페모스', title: '외눈의 목자',
  hp: 900, radius: 1.9, mass: 200, speed: 2.4, keepRange: [3.6, 7], gap: [1.0, 1.8],
  barHeight: 6, groggyMult: 2.2,
  look: { height: 5.2, bulk: 1.5, tint: '#c9a07a', gear: ['legs', 'feet'] },
  phases: [
    {
      below: 1,
      say: '동굴이 울린다. 무언가 거대한 것이 일어섰다',
      patterns: [
        slam({ id: 'swing', startup: 0.95, active: 0.12, recovery: 0.9, range: 7.5, halfAngle: 0.8,
          damage: 26, knockback: 14, pick: { max: 8.5, weight: 3, cooldown: 2.4 } }),
        stomp({ id: 'crush', startup: 1.15, active: 0.12, recovery: 1.5, radius: 4.6,
          damage: 32, knockback: 16, groggy: 1.6, shake: 0.6,
          pick: { max: 7, weight: 2, cooldown: 5 } }),
        volley({ id: 'sheep', kind: 'sheep', startup: 1.0, active: 0.1, recovery: 0.8, count: 1, spread: 0,
          damage: 22, speed: 15, bullet: '#e8e0d0', bulletSize: 0.7, range: 26,
          pick: { min: 5, weight: 3, cooldown: 2.8 } }),
        ring({ id: 'roar', startup: 0.85, active: 0.1, recovery: 1.1, inner: 3.2, outer: 11,
          damage: 18, knockback: 6, stagger: 0.9, color: '#ffd166', shake: 0.5,
          pick: { weight: 2, cooldown: 7 } }),
      ],
    },
    {
      below: 0.5,
      say: '눈이 멀었다. 이제 아무 데나 던진다',
      patterns: [
        volley({ id: 'sheep_wild', kind: 'sheep', startup: 0.62, active: 0.1, recovery: 0.5, count: 3, spread: 0.75,
          damage: 20, speed: 14, bullet: '#e8e0d0', bulletSize: 0.62, range: 26,
          pick: { weight: 5, cooldown: 1.6 } }),
        slam({ id: 'blind_swing', startup: 0.62, active: 0.12, recovery: 0.85, range: 8.5, halfAngle: 1.5,
          damage: 28, knockback: 15, pick: { max: 9.5, weight: 3, cooldown: 2.2 } }),
        stomp({ id: 'crush2', startup: 0.9, active: 0.12, recovery: 1.4, radius: 5.4,
          damage: 34, knockback: 18, groggy: 1.4, shake: 0.7, pick: { weight: 2, cooldown: 5 } }),
        ring({ id: 'roar2', startup: 0.7, active: 0.1, recovery: 0.9, inner: 2.6, outer: 13,
          damage: 20, stagger: 1.0, color: '#ffd166', shake: 0.6, pick: { weight: 2, cooldown: 6 } }),
      ],
    },
  ],
}

/* ── 안티파테스 (라이스트리고네스 족장) ──────────────────
   1페는 부하를 불러 셋이 덤비고, 2페는 혼자 창과 활을 같이 쓴다. */
export const ANTIPHATES = {
  id: 'antiphates', name: '안티파테스', title: '식인 거인의 왕',
  hp: 760, radius: 1.2, mass: 90, speed: 3.6, keepRange: [3, 7], gap: [0.9, 1.6],
  barHeight: 4.2, groggyMult: 1.9,
  look: { height: 3.4, bulk: 1.15, tint: '#a8705a', gear: ['legs', 'feet', 'body', 'arms'] },
  phases: [
    {
      below: 1,
      say: '항구 전체가 우리를 향해 돌아섰다',
      onEnter: b => { for (let i = 0; i < 2; i++) b.world.spawnMinion?.('warrior', b.pos.x + rand(-4, 4), b.pos.z + rand(-4, 4)) },
      patterns: [
        slam({ id: 'cleave', startup: 0.72, active: 0.1, recovery: 0.7, range: 5.4, halfAngle: 0.9,
          damage: 22, pick: { max: 6.5, weight: 3, cooldown: 2.2 } }),
        lance({ id: 'hurl', startup: 0.85, active: 0.08, recovery: 0.7, range: 22, halfAngle: 0.08,
          damage: 24, pick: { min: 4, weight: 3, cooldown: 3 } }),
        summon({ id: 'call', startup: 1.0, active: 0.1, recovery: 0.9, kind: 'archer', count: 1, radius: 6,
          pick: { weight: 2, cooldown: 9 } }),
      ],
    },
    {
      below: 0.45,
      say: '부하가 다 죽자 혼자서 둘을 한다',
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
   직접 때리지 않는다. 돼지를 불러 막고 뒤에서 마법을 던진다. */
export const KIRKE = {
  id: 'kirke', name: '키르케', title: '아이아이에의 마녀',
  hp: 620, radius: 0.6, mass: 24, speed: 4.4, keepRange: [7, 11], gap: [0.8, 1.4],
  barHeight: 2.4, groggyMult: 1.6, turnHalf: 0.1,
  look: { height: 1.76, bulk: 0.94, tint: '#c88ad0', gear: ['legs', 'feet', 'body'] },
  phases: [
    {
      below: 1,
      say: '술잔을 든 여자가 웃는다',
      patterns: [
        summon({ id: 'pigs', startup: 1.05, active: 0.1, recovery: 0.8, kind: 'pig', count: 2, radius: 6,
          pick: { weight: 4, cooldown: 7 } }),
        volley({ id: 'fireball', kind: 'fire', startup: 0.75, active: 0.08, recovery: 0.6, count: 3, spread: 0.32,
          damage: 18, speed: 13, bullet: '#ff7a3a', bulletSize: 0.42,
          pick: { weight: 4, cooldown: 2.6 } }),
        lance({ id: 'hex', startup: 1.1, active: 0.08, recovery: 0.9, range: 20, halfAngle: 0.1,
          damage: 10, stagger: 0.2, color: '#c77dff',
          // 변신 마법 — 맞으면 느려진다. 죽지는 않지만 피하기가 어려워진다
          onEnd(b) { b.world.onHex?.() },
          pick: { weight: 3, cooldown: 8 } }),
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
        summon({ id: 'pigs2', startup: 0.85, active: 0.1, recovery: 0.6, kind: 'pig', count: 3, radius: 7,
          pick: { weight: 3, cooldown: 8 } }),
        ring({ id: 'ward', startup: 0.7, active: 0.1, recovery: 0.8, inner: 2.0, outer: 6.5,
          damage: 20, color: '#c77dff', pick: { weight: 2, cooldown: 6 } }),
      ],
    },
  ],
}

/* ── 세이렌 ──────────────────────────────────────────────
   바닥으로 들어갔다가 내 발밑에서 솟는다. 탄막과 흡수. */
export const SIREN = {
  id: 'siren', name: '세이렌', title: '노래하는 것',
  hp: 680, radius: 0.7, mass: 26, speed: 3.2, keepRange: [5, 9], gap: [0.7, 1.3],
  barHeight: 2.6, groggyMult: 1.7,
  look: { height: 1.8, bulk: 0.92, tint: '#7fd0d8', gear: ['legs', 'body'] },
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
      ],
    },
  ],
}

/* ── 스킬라 ──────────────────────────────────────────────
   배 위에서 싸운다. 1페는 다섯 머리가 번갈아 내려찍고,
   2페는 머리 하나가 끈질기게 쫓는다. */
export const SKYLLA = {
  id: 'skylla', name: '스킬라', title: '여섯 머리의 것',
  hp: 840, radius: 1.4, mass: 140, speed: 1.8, keepRange: [4, 8], gap: [0.6, 1.1],
  barHeight: 4.6, groggyMult: 2.0,
  look: { height: 3.6, bulk: 1.3, tint: '#6a8c7a', gear: [] },
  phases: [
    {
      below: 1,
      say: '절벽 그늘에서 머리 다섯이 내려온다',
      patterns: [
        stomp({ id: 'head1', startup: 0.8, active: 0.1, recovery: 0.55, radius: 2.8, damage: 22,
          color: '#7fd08a', pick: { weight: 5, cooldown: 1.2 } }),
        stomp({ id: 'head2', startup: 0.7, active: 0.1, recovery: 0.5, radius: 2.4, damage: 20,
          color: '#7fd08a', pick: { weight: 5, cooldown: 1.0 } }),
        slam({ id: 'sweep', startup: 1.0, active: 0.12, recovery: 1.3, range: 8, halfAngle: 1.4,
          damage: 28, knockback: 14, groggy: 1.5, shake: 0.5,
          pick: { weight: 3, cooldown: 6 } }),
      ],
    },
    {
      below: 0.45,
      say: '남은 머리 하나가 끈질기게 따라붙는다',
      patterns: [
        lance({ id: 'stab', startup: 0.58, active: 0.08, recovery: 0.5, range: 11, halfAngle: 0.13,
          damage: 26, color: '#7fd08a', pick: { weight: 5, cooldown: 1.4 } }),
        stomp({ id: 'smash', startup: 0.72, active: 0.1, recovery: 1.1, radius: 3.6, damage: 30,
          groggy: 1.2, color: '#7fd08a', pick: { weight: 4, cooldown: 3 } }),
        ring({ id: 'lash', startup: 0.66, active: 0.1, recovery: 0.7, inner: 2.4, outer: 8,
          damage: 22, color: '#7fd08a', pick: { weight: 3, cooldown: 4.5 } }),
      ],
    },
  ],
}

/* ── 카리브디스 ──────────────────────────────────────────
   움직이지 않는다. 소용돌이를 피하면서 가운데 눈을 친다. 탄막 게임. */
export const CHARYBDIS = {
  id: 'charybdis', name: '카리브디스', title: '삼키는 소용돌이',
  hp: 720, radius: 1.6, mass: 999, speed: 0, keepRange: [0, 0], gap: [0.5, 0.9],
  barHeight: 3.4, groggyMult: 1.5, turnHalf: 0.4,
  look: { height: 2.6, bulk: 1.4, tint: '#5a7fa8', gear: [] },
  phases: [
    {
      below: 1,
      say: '바다가 통째로 빨려 들어간다',
      patterns: [
        spray({ id: 'gyre', kind: 'water', startup: 0.8, active: 0.08, recovery: 0.6, count: 18, damage: 14,
          speed: 6.5, bullet: '#8fd6ff', warn: 3.6, pick: { weight: 5, cooldown: 2.6 } }),
        ring({ id: 'pull', startup: 1.0, active: 0.12, recovery: 0.9, inner: 4.5, outer: 15,
          damage: 20, knockback: -14, color: '#6fa8ff', shake: 0.4,
          pick: { weight: 3, cooldown: 5 } }),
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
        ring({ id: 'pull2', startup: 0.75, active: 0.12, recovery: 0.7, inner: 3.5, outer: 16,
          damage: 24, color: '#6fa8ff', pick: { weight: 3, cooldown: 4 } }),
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
  look: { height: 1.84, bulk: 1.02, tint: '#8fa0c8', gear: ['legs', 'feet', 'body', 'arms', 'pauldron'] },
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

export const BOSSES = {
  polyphemos: POLYPHEMOS, antiphates: ANTIPHATES, kirke: KIRKE,
  siren: SIREN, skylla: SKYLLA, charybdis: CHARYBDIS, telegonos: TELEGONOS,
}

export function makeBoss(id, world, fx) {
  const cfg = BOSSES[id]
  if (!cfg) throw new Error(`없는 보스: ${id}`)
  return new Boss(world, fx, cfg)
}
