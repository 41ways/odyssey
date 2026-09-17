import { rand } from '../core/math.js'

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
