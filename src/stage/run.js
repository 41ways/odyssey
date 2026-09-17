import { STAGES, RELICS } from './stages.js'
import { WaveRunner } from './waves.js'
import { makeBoss } from '../enemy/bosses.js'

/**
 * 한 판(run) 의 진행.
 *
 * 판 하나는 두 구간이다 — **뱀서식 웨이브로 자라고, 그 끝에서 보스를 만난다.**
 * 웨이브에서 모은 전리품과 성장을 그대로 들고 보스방으로 넘어간다.
 * 마지막 판(죽음)은 이길 수 없다 — 입힌 피해량이 그대로 기록이 된다.
 */
export class Run {
  constructor(game) {
    this.game = game
    this.index = -1
    this.stage = null
    this.phase = null      // 'wave' | 'boss' | 'relic'
    this.waves = null
    this.boss = null
    this.busy = false
    this.finished = false
    this.cleared = false
    this.bestDamage = 0
  }

  get isLast() { return this.index === STAGES.length - 1 }
  /** HUD 가 쓰는 현재 구간 정보. */
  get view() {
    if (!this.stage) return null
    return {
      name: this.stage.name,
      goal: this.phase === 'wave' ? this.stage.wave.goal : 0,
      phase: this.phase,
      bossName: this.boss?.cfg.name ?? null,
    }
  }

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

    if (stage.relic) {
      this.phase = 'relic'
      // 저승은 걸어 들어가는 연출이 현판을 대신한다
      await this.#scene(stage, stage.intro, { banner: false })
      this.busy = true
      await g.chooseRelic(RELICS)
      this.busy = false
      this.cleared = true
      await this.#afterStage(false)
      return
    }

    if (stage.wave) {
      this.phase = 'wave'
      g.kills = 0
      await this.#scene(stage.wave, stage.wave.intro)
      this.waves = new WaveRunner({ goal: stage.wave.goal, waves: stage.wave.steps }, g)
      return
    }

    // 웨이브 없이 바로 보스인 판 (죽음)
    await this.#enterBoss()
  }

  /** 구간 하나를 연다 — 땅·빛을 갈고, 플레이어를 세우고, 현판을 띄운다. */
  async #scene(part, intro, { banner = true } = {}) {
    const g = this.game
    g.clearField()
    await g.render3d.applyStage(part)
    g.arenaRadius = g.render3d.arenaRadius
    g.player.pos.set(0, 0, Math.min(6, g.arenaRadius - 3))
    g.player.vel.set(0, 0, 0)
    g.render3d.camTarget.copy(g.player.pos)
    if (banner) g.hud.banner(this.stage.name, intro, 3.4)
  }

  /** 웨이브를 다 치우면 보스방으로 넘어간다. */
  async #enterBoss() {
    const g = this.game
    const stage = this.stage
    this.phase = 'boss'

    // 갈림길이면 먼저 고른다
    let cfg = stage.boss
    if (stage.fork) {
      await this.#scene(stage.fork, stage.fork.intro)
      this.busy = true
      const pick = await g.chooseFork({ name: stage.name, intro: stage.fork.intro, options: stage.fork.options })
      this.busy = false
      cfg = { ...stage.fork, id: pick.boss, intro: pick.line }
    }

    await this.#scene(cfg, cfg.intro)
    const b = makeBoss(cfg.id, g, g.fx)
    b.pos.set(0, 0, -Math.min(7, g.arenaRadius - 4))
    b.facing = Math.PI
    g.track(b)
    this.boss = b
    g.hud.setBoss(b)
  }

  update(dt) {
    if (this.busy || this.finished || this.cleared) return
    const g = this.game

    if (this.phase === 'wave' && this.waves) {
      this.waves.update(dt)
      if (this.waves.cleared) {
        this.waves = null
        this.busy = true
        g.hud.banner(this.stage.name, this.stage.wave.clear, 2.6)
        // 한 박자 쉬고 보스방으로
        setTimeout(async () => { await this.#enterBoss(); this.busy = false }, 2200)
      }
      return
    }

    if (this.phase === 'boss' && this.boss && this.boss.dead) this.#clear()
  }

  #clear() {
    if (this.cleared) return
    this.cleared = true
    const g = this.game
    g.hud.setBoss(null)
    if (this.stage.clear) g.hud.banner(`${this.stage.name} 통과`, this.stage.clear, 3.4)
    setTimeout(() => this.#afterStage(true), 1800)
  }

  /** 판 사이의 성장 선택. 저승은 유물을 이미 줬으므로 건너뛴다. */
  async #afterStage(offerChoice) {
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

export { STAGES, RELICS }
