import { STAGES, RELICS } from './stages.js'
import { WaveRunner } from './waves.js'
import { makeBoss } from '../enemy/bosses.js'
import { rollChoices, newlyUnlocked, TIERS } from '../player/stats.js'

/**
 * 한 판(run) 의 진행.
 *
 * 스테이지를 순서대로 열고, 끝나면 성장 선택지를 한 장 주고 다음으로 넘긴다.
 * 마지막 스테이지(죽음)는 이길 수 없다 — 입힌 피해량이 그대로 기록이 된다.
 */
export class Run {
  constructor(game) {
    this.game = game
    this.index = -1
    this.stage = null
    this.waves = null
    this.boss = null
    this.busy = false
    this.finished = false
    this.bestDamage = 0
  }

  get isLast() { return this.index === STAGES.length - 1 }

  async start(from = 0) {
    this.index = from - 1
    this.finished = false
    await this.next()
  }

  async next() {
    this.index++
    if (this.index >= STAGES.length) { this.finished = true; return }
    await this.enter(STAGES[this.index])
  }

  async enter(stage) {
    const g = this.game
    this.stage = stage
    this.boss = null
    this.waves = null
    this.cleared = false

    g.clearField()
    await g.render3d.applyStage(stage)
    g.arenaRadius = g.render3d.arenaRadius
    g.player.pos.set(0, 0, Math.min(6, g.arenaRadius - 3))
    g.player.vel.set(0, 0, 0)
    g.hud.banner(stage.name, stage.intro, 3.6)

    if (stage.kind === 'waves') {
      g.kills = 0
      this.waves = new WaveRunner(stage, g)
    } else if (stage.kind === 'boss') {
      this.#spawnBoss(stage.boss)
    } else if (stage.kind === 'fork') {
      this.busy = true
      const pick = await g.chooseFork(stage)
      this.busy = false
      this.#spawnBoss(pick.boss)
    } else if (stage.kind === 'relic') {
      this.busy = true
      await g.chooseRelic(RELICS)
      this.busy = false
      this.cleared = true
      await this.#afterClear(false)
    }
  }

  #spawnBoss(id) {
    const g = this.game
    const b = makeBoss(id, g, g.fx)
    b.pos.set(0, 0, -Math.min(7, g.arenaRadius - 4))
    b.facing = Math.PI
    g.track(b)
    this.boss = b
    g.hud.setBoss(b)
  }

  update(dt) {
    if (this.busy || this.finished || this.cleared) return
    const g = this.game

    if (this.waves) {
      this.waves.update(dt)
      if (this.waves.cleared) this.#clear()
      return
    }
    if (this.boss && this.boss.dead) this.#clear()
  }

  #clear() {
    if (this.cleared) return
    this.cleared = true
    const g = this.game
    g.hud.setBoss(null)
    if (this.stage.clear) g.hud.banner(`${this.stage.name} 통과`, this.stage.clear, 3.4)
    setTimeout(() => this.#afterClear(true), 1600)
  }

  /** 판 사이의 성장 선택. 저승은 유물을 이미 줬으므로 건너뛴다. */
  async #afterClear(offerChoice) {
    const g = this.game
    if (this.finished) return
    if (offerChoice) {
      this.busy = true
      await g.offerUpgrade(`${this.stage.name} 통과`, '가져갈 것을 하나 고른다')
      this.busy = false
    }
    await this.next()
  }

  /** 마지막 판은 이길 수 없다. 죽으면 그때까지 입힌 피해가 기록이다. */
  onPlayerDeath() {
    if (this.stage?.endless) {
      this.bestDamage = Math.max(this.bestDamage, this.game.totalDamage)
      this.game.showCredits(this.bestDamage)
      return true
    }
    return false
  }
}

export { STAGES, RELICS, rollChoices, newlyUnlocked, TIERS }
