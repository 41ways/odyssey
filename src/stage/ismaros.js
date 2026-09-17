/**
 * 이스마로스 — 첫 스테이지.
 *
 * 트로이에서 돌아오는 길, 오디세우스 일행이 처음 들른 곳이자 처음 약탈한 곳이다.
 * 여기서 얻은 전리품이 그대로 그의 차림이 된다.
 *
 * 웨이브는 "적을 한 무더기 쏟고 다 잡을 때까지 기다리는" 방식이 아니라,
 * 처치 수에 따라 압박을 올리면서 계속 흘려보낸다. 뱀서식 리듬.
 * 목표 처치 수(goal)는 전리품 마지막 단계(20)보다 조금 위에 둔다 —
 * 마지막 장비를 입고 한 번은 휘둘러 봐야 끝나는 맛이 난다.
 */
export const ISMAROS = {
  id: 'ismaros',
  name: '이스마로스',
  line: '키코네스족의 해안',
  intro: '돌아가는 길의 첫 항구. 우리는 이곳을 약탈했다.',
  clear: '해안이 조용해졌다. 바다가 기다린다.',
  goal: 24,
  waves: [
    // untilKills 까지 이 압박을 유지한다
    { untilKills: 3, maxAlive: 3, interval: 1.8, mix: { warrior: 1 }, say: null },
    { untilKills: 8, maxAlive: 4, interval: 1.5, mix: { warrior: 3, archer: 1 }, say: '언덕에서 활잡이가 내려온다' },
    { untilKills: 15, maxAlive: 6, interval: 1.2, mix: { warrior: 3, archer: 2 }, say: '마을이 깨어났다' },
    { untilKills: 24, maxAlive: 8, interval: 0.95, mix: { warrior: 3, archer: 2 }, say: '내륙에서 떼로 몰려온다' },
  ],
}

/**
 * 웨이브 진행.
 * 살아있는 수를 목표치에 맞춰 계속 채워 넣는다. 목표 처치 수를 넘으면
 * 보충을 멈추고, 남은 적을 다 정리하면 스테이지가 끝난다.
 */
export class WaveRunner {
  constructor(stage, game) {
    this.stage = stage
    this.game = game
    this.timer = 0
    this.waveIndex = -1
    this.done = false
    this.cleared = false
    this.spawned = 0
  }

  get wave() {
    const w = this.stage.waves
    for (let i = 0; i < w.length; i++) if (this.game.kills < w[i].untilKills) return { wave: w[i], index: i }
    return { wave: w[w.length - 1], index: w.length - 1 }
  }

  reset() {
    this.timer = 0
    this.waveIndex = -1
    this.done = false
    this.cleared = false
    this.spawned = 0
  }

  update(dt) {
    if (this.cleared) return
    const game = this.game
    const alive = game.enemies.filter(e => !e.isDummy && !e.dead).length

    // 목표를 채웠으면 더 안 부른다. 남은 적만 정리하면 끝.
    if (game.kills >= this.stage.goal) {
      this.done = true
      if (alive === 0) { this.cleared = true; game.onStageClear?.(this.stage) }
      return
    }

    const { wave, index } = this.wave
    if (index !== this.waveIndex) {
      this.waveIndex = index
      if (wave.say) game.onWaveSay?.(wave.say)
      this.timer = 0.35        // 다음 물결이 오기 전 한 박자
    }

    this.timer -= dt
    if (this.timer > 0 || alive >= wave.maxAlive) return
    this.timer = wave.interval

    // 목표를 넘겨 소환하지 않는다 — 다 잡았는데 끝이 안 나는 일이 없게
    const room = this.stage.goal - game.kills - alive
    if (room <= 0) return

    game.spawnEnemy(pickKind(wave.mix))
    this.spawned++
  }
}

function pickKind(mix) {
  const entries = Object.entries(mix)
  const total = entries.reduce((a, [, w]) => a + w, 0)
  let r = Math.random() * total
  for (const [kind, w] of entries) { r -= w; if (r <= 0) return kind }
  return entries[0][0]
}
