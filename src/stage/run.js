import { STAGES, RELICS, OPENING, interludeFor } from './stages.js'
import { Underworld } from './underworld.js'
import { Maelstrom } from './maelstrom.js'
import { CUT_TROY, CUT_CAVE, CUT_UNDER, CUT_WHIRL, CUT_ITHACA } from './cuts.js'
import { WaveRunner } from './waves.js'
import { makeBoss } from '../enemy/bosses.js'
import { fateAfter } from './voyage.js'

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
    // 트로이는 액자에 걸 것이 아니다. 지금 불타고 있다 (stage/cuts.js).
    if (from === 0 && !o.noIntro) await this.game.playCut(CUT_TROY)
    this.game.voyageHud?.show(true)
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
      await g.playCut(CUT_UNDER)
      g.music.play('deep')
      // 판을 세우고 나서 길을 놓는다 — 이제 저승은 '거쳐 가는 화면' 이 아니라
      // 걸어 들어갔다가 쫓겨 나오는 곳이다 (stage/underworld.js)
      this.under = new Underworld(g, 7)
      g.under = this.under
      this.under.enter()
      this.under.onOut = () => this.#leftUnderworld()
      return
    }

    if (stage.wave && !skipWave) {
      this.phase = 'wave'
      // 판에 들어서는 컷신. 있는 판만 있다 — 매 판 넣으면 흐름이 끊긴다.
      if (stage.cut) await g.playCut(stage.cut)
      g.music.play('fight')
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
      // 이 판에 나오는 모델을 여기서 받는다. 막이 내려와 있는 동안이라
      // 기다리는 시간이 화면에 안 드러난다.
      await g.loadStageModels(this.stage?.id)
      await g.render3d.applyStage(part)
      g.arenaRadius = g.render3d.arenaRadius
      // 판 모양은 한 군데서 만들고 쓰는 쪽마다 물려 준다 —
      // 경계를 보는 눈이 둘이 되면 반드시 어긋난다
      g.arena = g.render3d.arena
      g.projectiles.setArena(g.render3d.arena)
      g.player.pos.set(0, 0, Math.min(6, g.arenaRadius - 3))
      g.player.vel.set(0, 0, 0)
      g.player.action.stop()
      g.render3d.camTarget.copy(g.player.pos)
      g.setAllies?.(this.stage, part)
      g.setSheep?.(part)
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
      if (stage.fork.cut) await g.playCut(stage.fork.cut)
      this.busy = true
      const pick = await g.chooseFork({ name: stage.name, intro: stage.fork.intro, options: stage.fork.options })
      this.busy = false
      // 고른 쪽에 따라 판이 달라질 수 있다 — 스킬라는 가로로 누운 뱃전에서,
      // 카리브디스는 트인 폭풍 갑판에서 싸운다
      cfg = { ...stage.fork, ...(pick.stage ?? {}), id: pick.boss, intro: pick.line }
    }

    // 벗기 전에 보여 줄 장면 (이타카의 활 겨루기)
    if (cfg.cutBefore) await g.playCut(cfg.cutBefore)
    // 거지 차림이었다면 여기서 벗는다
    if (stage.beggar) await g.setBeggar(false)

    await this.#scene(cfg, cfg.intro, { banner: false })
    // 보스를 만나는 컷신. 갇혔다는 게 먼저 와야 그 뒤가 파훼가 된다.
    if (cfg.cut) await g.playCut(cfg.cut)
    g.music.play('boss')
    const b = makeBoss(cfg.id, g, g.fx)
    // 난간에 붙는 보스는 뱃전에, 나머지는 판 안쪽에 선다
    const zHalf = g.render3d.arena?.radiusAt(Math.PI) ?? g.arenaRadius
    b.pos.set(0, 0, b.cfg.rail ? -(zHalf - 1.1) : -Math.min(7, g.arenaRadius - 4))
    b.facing = Math.PI
    g.track(b)
    this.boss = b
    g.render3d.setBossFocus(b)

    // 만나는 장면. 체력바는 이 뒤에 붙여야 이름이 두 번 나오지 않는다
    await g.cinema({
      title: b.cfg.name, sub: b.cfg.title ?? '', at: b.pos, zoom: 0.5, hold: 2.6,
      face: `/img/boss/${b.cfg.id}.webp?v=2`,   // v2: 세이렌 초상을 인어로
    })
    g.hud.setBoss(b)
    // 파훼 한 줄을 할 일 판에 걸어 둔다. 처음 한 번 말하고 사라지면
    // 그 말을 놓친 사람에게는 판이 통째로 막힌다 (ui/quest.js)
    g.quest?.setHow(b.cfg.how ?? null)

    // 소용돌이 판 — 여기서는 헤엄치고, 테두리 이빨을 깬다
    if (cfg.maelstrom) {
      this.maelstrom = new Maelstrom(g, b, cfg.maelstrom)
      g.maelstrom = this.maelstrom
      g.projectiles.setMaelstrom(this.maelstrom)
      g.player.swimming = true
      g.hud.banner('헤엄쳐라', '멈추면 빨려 들어간다 — 테두리 이빨을 깨라', 3.4)
    }

    if (cfg.intro) g.hud.banner(cfg.name ?? this.stage.name, cfg.intro, 2.4)
  }

  update(dt) {
    if (this.busy || this.finished || this.cleared) return
    const g = this.game

    if (this.phase === 'relic') { this.under?.update(dt); return }

    if (this.phase === 'wave' && this.waves) {
      this.waves.update(dt)
      if (this.waves.cleared) {
        this.waves = null
        this.busy = true
        g.hud.banner(this.stage.name, this.stage.wave.clear, 2.6)
        // 한 박자 쉬고 보스방으로. 그 사이에 이 판이 앗아간 사람을 센다
        setTimeout(async () => {
          await g.crewLoss?.(`${this.stage.id}:wave`)
          await this.#enterBoss(); this.busy = false
        }, 2200)
      }
      return
    }

    this.maelstrom?.update(dt)

    if (this.phase === 'boss' && this.boss && this.boss.dead) this.#clear()
  }

  /**
   * 구덩이를 눌렀다. 손이 올라오고, 유물을 고르고, 그 다음엔 쫓긴다.
   * Game 이 이걸 부른다 (마우스는 Game 이 받는다).
   */
  async callUp() {
    const g = this.game
    this.busy = true
    await g.chooseRelic(RELICS)
    this.busy = false
    this.under?.chased()
  }

  /** 남쪽 끝을 넘었다. 여기서 비로소 저승이 끝난다. */
  async #leftUnderworld() {
    if (this.cleared) return
    this.cleared = true
    const g = this.game
    this.busy = true
    g.hud.banner(this.stage.name, this.stage.clear ?? '', 2.6)
    await new Promise(r => setTimeout(r, 1400))
    this.under?.dispose()
    this.under = null
    g.under = null
    this.busy = false
    await this.#afterStage(false)
  }

  #clear() {
    if (this.cleared) return
    this.cleared = true
    const g = this.game
    const fell = this.boss
    this._fellId = fell?.cfg?.id
    g.render3d.setBossFocus(null)
    g.quest?.setHow(null)
    if (this.maelstrom) {
      this.maelstrom.dispose(); this.maelstrom = null
      g.maelstrom = null; g.player.swimming = false
      g.projectiles.setMaelstrom(null)
    }
    setTimeout(async () => {
      g.hud.setBoss(null)
      // 쓰러진 자리를 한 번 보고 간다. 바로 은총 화면이 뜨면 이긴 실감이 없다
      await g.cinema({
        title: `${fell?.cfg?.name ?? this.stage.name} 토벌`,
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
    // 이 판이 앗아간 동료 — 보스를 눕힌 뒤에 센다 (이긴 기쁨 다음에 오는 것)
    if (afterBoss) {
      const key = this.stage.fork ? `${this.stage.id}:${this._fellId}` : `${this.stage.id}:boss`
      await g.crewLoss?.(key)
    }
    if (afterBoss) await g.grantBlessing(this.stage)
    if (afterBoss) await g.offerUpgrade(`${this.stage.name} 통과`, '가져갈 것을 하나 고른다')
    // 막간 액자를 평소처럼 튼다. 마지막 장이 물처럼 녹아 바다가 되고,
    // 거기서부터 직접 몬다 (stage/sailleg.js, Game.sailTo).
    const lude = interludeFor(this.index)
    g.music.play('sail')
    if (lude) await g.sailTo(lude)
    // 뱃길 위의 갈림길 — 이야기 속 선택 (stage/voyage.js)
    const fate = fateAfter(this.stage.id)
    if (fate) await g.chooseFate(fate)       // 액자는 켠 채로 — 그 위에 올라온다
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
