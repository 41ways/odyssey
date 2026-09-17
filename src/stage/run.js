import { STAGES, RELICS, OPENING, interludeFor } from './stages.js'
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
    const here = this.phase === 'boss'
      ? (this.stage.fork?.name ?? this.stage.boss?.name)
      : this.stage.wave?.name
    return {
      name: here ?? this.stage.name,
      goal: this.phase === 'wave' ? this.stage.wave.goal : 0,
      phase: this.phase,
      bossName: this.boss?.cfg.name ?? null,
    }
  }

  /** @param o.toBoss 웨이브를 건너뛰고 보스부터 (시험용) */
  async start(from = 0, o = {}) {
    this.index = from - 1
    this.finished = false
    this._skipWave = !!o.toBoss
    // 맨 처음은 왜 바다에 있는지부터 말하고 시작한다
    if (from === 0 && !o.noIntro) await this.game.playInterlude(OPENING)
    await this.next()
  }

  async next() {
    this.index++
    if (this.index >= STAGES.length) { this.finished = true; return }
    await this.enter(STAGES[this.index])
  }

  async enter(stage) {
    // 시험용으로 건너뛴 경우에만. 한 번 쓰고 끈다.
    const skipWave = this._skipWave
    this._skipWave = false
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

    if (stage.wave && !skipWave) {
      this.phase = 'wave'
      g.kills = 0
      await this.#scene(stage.wave, stage.wave.intro)
      // 이타카는 거지 차림으로 들어간다 — 보스전에서 정체를 드러낸다
      if (stage.beggar) g.setBeggar(true, stage.beggar.say)
      // 막이 걷히고 현판이 지나갈 동안은 비워 둔다
      this.waves = new WaveRunner({ goal: stage.wave.goal, waves: stage.wave.steps }, g, 1.9)
      return
    }

    // 웨이브 없이 바로 보스인 판 (죽음)
    await this.#enterBoss()
  }

  /**
   * 구간 하나를 연다 — 땅·빛을 갈고, 플레이어를 세우고, 현판을 띄운다.
   *
   * 갈아 끼우는 건 어둠 뒤에서 한다. 앞에서 갈면 한 프레임 만에
   * 다른 데로 떨어진 것처럼 보인다.
   */
  async #scene(part, intro, { banner = true } = {}) {
    const g = this.game
    await g.curtain(async () => {
      g.clearField()
      await g.render3d.applyStage(part)
      g.arenaRadius = g.render3d.arenaRadius
      g.player.pos.set(0, 0, Math.min(6, g.arenaRadius - 3))
      g.player.vel.set(0, 0, 0)
      g.player.action.stop()
      g.render3d.camTarget.copy(g.player.pos)
    })
    // 구간이 제 이름을 들고 있으면 그걸 쓴다 (해안 → 동굴처럼 자리가 바뀔 때)
    if (banner) g.hud.banner(part.name ?? this.stage.name, intro, 3.4)
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

    // 거지 차림이었다면 여기서 벗는다
    if (stage.beggar) await g.setBeggar(false)

    await this.#scene(cfg, cfg.intro, { banner: false })
    const b = makeBoss(cfg.id, g, g.fx)
    b.pos.set(0, 0, -Math.min(7, g.arenaRadius - 4))
    b.facing = Math.PI
    g.track(b)
    this.boss = b

    // 만나는 장면. 체력바는 이 뒤에 붙여야 이름이 두 번 나오지 않는다
    await g.cinema({ title: b.cfg.name, sub: b.cfg.title ?? '', at: b.pos, zoom: 0.5, hold: 2.3 })
    g.hud.setBoss(b)
    if (cfg.intro) g.hud.banner(cfg.name ?? this.stage.name, cfg.intro, 2.4)
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
    const fell = this.boss
    setTimeout(async () => {
      g.hud.setBoss(null)
      // 쓰러진 자리를 한 번 보고 간다. 바로 은총 화면이 뜨면 이긴 실감이 없다
      await g.cinema({
        title: `${fell?.cfg?.name ?? this.stage.name} 쓰러짐`,
        sub: this.stage.clear ?? '', at: fell?.pos, zoom: 0.55, hold: 2.2, lead: 0.9,
      })
      this.#afterStage(true)
    }, 900)
  }

  /**
   * 판이 끝난 뒤.
   *   1) 보스를 눕혔으면 아테나의 은총
   *   2) 성장 선택지 한 장
   *   3) 다음 뭍으로 가는 막간
   */
  async #afterStage(afterBoss) {
    const g = this.game
    if (this.finished) return
    this.busy = true
    if (afterBoss) await g.grantBlessing(this.stage)
    if (afterBoss) await g.offerUpgrade(`${this.stage.name} 통과`, '가져갈 것을 하나 고른다')
    const lude = interludeFor(this.index)
    if (lude) await g.playInterlude(lude)
    this.busy = false
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
