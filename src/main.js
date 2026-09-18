import * as THREE from 'three'
import { World, CAMERA_RIG } from './render/world.js'
import { Fx } from './render/fx.js'
import { Input } from './core/input.js'
import { createLoop } from './core/loop.js'
import { Projectiles } from './combat/projectile.js'
import { Particles } from './render/particles.js'
import { separate } from './combat/actor.js'
import { Player } from './player/player.js'
import { kikonesWarrior, kikonesArcher, kikonesShield, circePig, circeWolf, circeLion, laistrygon } from './enemy/kikones.js'
import { Hud } from './ui/hud.js'
import { meanderURI } from './ui/theme.js'
import { TitleScreen } from './ui/title.js'
import { DifficultyScreen, SAILS } from './ui/difficulty.js'
import { EquipCard } from './ui/equipcard.js'
import { StagePicker } from './ui/stagepicker.js'
import { PauseMenu } from './ui/menu.js'
import { STAGES, OPENING, interludeFor } from './stage/stages.js'
import { LOOKS, LOOK_KEYS } from './render/looks.js'
import { LevelUp } from './ui/levelup.js'
import { Pickups } from './combat/pickup.js'
import { rollChoices, newStats, newlyUnlocked, TIERS, UPGRADES } from './player/stats.js'
import { KIT, kitProgress } from './player/gear.js'
import { Run } from './stage/run.js'
import { RELICS, UNDERWORLD_CUT } from './stage/stages.js'
import { RelicScreen } from './ui/relic.js'
import { BlessingScreen } from './ui/blessing.js'
import { Interlude } from './ui/interlude.js'
import { Reach } from './ui/reach.js'
import { Reel } from './ui/reel.js'
import { Music } from './core/music.js'
import { Level, BOSS_XP } from './player/level.js'
import { Sfx } from './core/sfx.js'
import { Notice } from './ui/notice.js'
import { promote, eliteChance } from './enemy/elite.js'
import { CUT_TROY, CUT_CAVE, CUT_UNDER, CUT_WHIRL, CUT_ITHACA, CUT_BOW, ALL_CUTS, cutArt } from './stage/cuts.js'
import { rollBlessings } from './player/blessings.js'
import { models } from './render/models.js'
import { preloadCharacter } from './render/character.js'
import { rand } from './core/math.js'
import { Voyage, LOSSES, FATES } from './stage/voyage.js'
import { FateScreen } from './ui/fate.js'
import { VoyageHud } from './ui/voyagehud.js'
import { Companion, companionsFor } from './player/companion.js'

const MINIONS = { warrior: kikonesWarrior, archer: kikonesArcher, shield: kikonesShield,
  pig: circePig, wolf: circeWolf, lion: circeLion, giant: laistrygon }

/**
 * 오디세이 — 아홉 판을 이어 달리는 한 번의 귀향.
 *
 * Game 은 판 하나가 도는 데 필요한 것만 들고 있다.
 * 무엇과 싸우고 어디로 넘어가는지는 stage/run.js 가 정한다.
 */
class Game {
  constructor(container, uiRoot) {
    this.render3d = new World(container)
    this.arenaRadius = this.render3d.arenaRadius
    // 판 모양. 적·플레이어의 이동 제한이 이걸 본다 (combat/actor.js)
    this.arena = this.render3d.arena
    this.fx = new Fx(this.render3d, uiRoot)
    this.input = new Input(this.render3d.canvas, this.render3d.camera)
    this.particles = new Particles(this.render3d.scene)
    this.projectiles = new Projectiles(this.render3d.scene, this.fx, this.particles)
    this.pickups = new Pickups(this.render3d.scene, this.fx)
    this.hud = new Hud(uiRoot)
    this.hud.setUpgradePool([...UPGRADES, ...RELICS])
    this.levelUp = new LevelUp(uiRoot)
    this.equipCard = new EquipCard(uiRoot)
    this.relicScreen = new RelicScreen(uiRoot)
    this.blessScreen = new BlessingScreen(uiRoot)
    this.interlude = new Interlude(uiRoot)
    this.reach = new Reach(uiRoot)          // 저승 — 손이 올라온다
    this.reel = new Reel(uiRoot)           // 컷신 — 그림 몇 장으로 시간을 만든다
    this.music = new Music()               // 판의 결을 정하는 배경 한 겹
    // 효과음은 파일이 없다 — 잡음과 사인파로 합성한다 (core/sfx.js).
    // 음소거를 음악과 같이 보도록 music 을 물려 준다.
    this.sfx = new Sfx(this.music)
    this.notice = new Notice(uiRoot)     // 얻은 것이 얻은 것처럼 보이게 (ui/notice.js)
    // 여정 — 배·동료·신들의 시선, 그리고 판 사이의 갈림길 (stage/voyage.js)
    this.voyage = new Voyage()
    this.fateScreen = new FateScreen(uiRoot)
    this.voyageHud = new VoyageHud(uiRoot, this.voyage)
    this.blessed = new Set()
    this.uiRoot = uiRoot
    this.equipFx = null

    this.enemies = []
    this.allies = []          // 곁에서 싸우는 동료 (player/companion.js)
    this.corpses = []
    this.totalDamage = 0
    this.kills = 0
    this.paused = false
    this.taken = new Map()
    this.level = new Level()      // 경험치 → 성장 선택 (player/level.js)
    this.hazards = []             // 바닥에 남는 불 (leaveFire)

    this.player = new Player(this, this.input, this.fx, this.projectiles)
    this.render3d.scene.add(this.player.group)
    this.render3d.camTarget.copy(this.player.pos)

    this.run = new Run(this)

    // 멈춤 메뉴와 소리 단추. Esc 로 열고 닫는다.
    this.menu = new PauseMenu(uiRoot, this)

    addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        // Esc 는 '지금 하던 걸 멈추고 나가는' 키다. 다른 전체 화면이 떠 있으면
        // 그쪽이 먼저 쓴다 — 골라야 하는 창 위에 메뉴를 겹치면 둘 다 못 쓴다.
        if (this.menu.open) { this.menu.close(); return }
        if (this.#screenOpen()) return
        e.preventDefault()
        this.menu.show()
        return
      }
      if (this.menu.open && e.code !== 'KeyR') return
      if (e.code === 'KeyR') this.restart()
      if (e.code === 'BracketRight') this.run.next()   // 시험용: 다음 판으로
      if (e.code === 'KeyL') this.cycleLook()          // 시험용: 톤 시안 돌려보기
      if (e.code === 'KeyG') this.setGod(!this.god)    // ★시험용 무적 — 배포 전에 지운다
    })

    // 스테이지 고르기 — Tab 또는 주소의 ?stage=N
    this.stages = STAGES
    this.picker = new StagePicker(uiRoot, this)

    this.loop = createLoop({
      update: dt => this.update(dt),
      render: () => this.draw(),
      fx: real => { this.fx.update(real); this._real = real },
    })
    this.loop.start()
    // 시작 화면을 먼저 보여 주고, 아무 키나 누르면 첫 판이 열린다
    // ?stage=3 으로 그 판부터, ?bare=1 이면 맨몸으로
    const q = new URLSearchParams(location.search)
    const from = Number(q.get('stage'))
    const startAt = Number.isFinite(from) && from >= 1 ? Math.min(from, STAGES.length) - 1 : 0
    const bare = q.get('bare') === '1'
    this.render3d.look = LOOKS[q.get('look')] ? q.get('look') : 'marble'   // 기본 톤: 정오의 대리석
    /* ★★★ 시험용 무적 — 배포 전에 지울 것 ★★★
       지울 곳은 세 군데다:
         1) 여기 (this.setGod 호출과 ?god=1 읽기)
         2) setGod() 메서드와 KeyG 키 바인딩
         3) combat/actor.js 의 `if (this.god)` 블록
       켜져 있으면 화면 왼쪽 위에 빨간 표시가 뜬다. 그게 안전장치다. */
    // QA 로 남에게 넘기는 빌드라 기본은 꺼짐. 시험할 때만 ?god=1 이나 G.
    this.setGod(q.get('god') === '1')

    this.paused = true
    this.sail = SAILS[1]                   // 고르기 전까지는 '이야기대로'
    this.title = new TitleScreen(uiRoot)
    this.diffScreen = new DifficultyScreen(uiRoot)
    // 제목 화면이 떠 있는 동안 첫 막간 그림을 미리 풀어 둔다 —
    // 난이도를 고르고 나면 곧바로 오프닝 액자가 올라온다
    this.warmInterlude(OPENING)
    // 컷신 그림도 같이 풀어 둔다. 첫 컷신이 트로이라 바로 필요하다.
    for (const c of ALL_CUTS) this.reel.preload(cutArt(c))
    this.title.wait()
      .then(() => (q.get('sail') ? SAILS.find(s => s.id === q.get('sail')) ?? SAILS[1] : this.diffScreen.show()))
      .then(sail => {
        this.sail = sail
        this.player.takeMul = sail.takeMul
        this.paused = false
        this.jumpTo(startAt, { bare, toBoss: q.get('boss') === '1' })
      })
  }

  /* ── 필드 ─────────────────────────────────────────────── */

  track(enemy) {
    // 맷집은 여기 한 군데에서만 정한다. 모든 적이 지나는 길목이다.
    //   난이도 × 판이 깊어질수록 붙는 몫.
    // 뒤로 갈수록 내 성장이 크게 붙으므로, 적이 그대로면 후반이 헐거워진다.
    // 보스는 원래 체력이 커서 같은 비율로 올리면 너무 길어진다 — 덜 붙인다.
    // 레벨이 붙은 뒤로는 내 화력이 판마다 세 번씩 올라간다 (player/level.js).
    // 적이 예전 곡선(0.17)에 머물면 뒷판이 헐거워지는 게 아니라 **무의미해진다** —
    // 고른 카드가 체감되지 않으면 고르는 재미도 없다. 그래서 같이 올린다.
    const deep = Math.max(0, this.run?.index ?? 0)
    const curve = enemy.isBoss ? 1 + deep * 0.14 : 1 + deep * 0.24
    // 포세이돈이 노한 만큼 바다 위의 적이 질기다 (이름을 외쳤다면)
    const sea = this.run?.stage?.sea ? this.voyage.seaWrath() : 1
    const mul = (this.sail?.hpMul ?? 1) * curve * sea
    if (mul !== 1) { enemy.maxHp = Math.round(enemy.maxHp * mul); enemy.hp = enemy.maxHp }
    // 경험치도 같은 방향으로. 안 붙이면 필요량만 오르고 수입은 그대로라
    // 뒷판이 경험치 가뭄이 된다.
    enemy.xpValue = Level.scale(enemy.xpValue ?? 0, deep)
    enemy.onHurt = d => { this.totalDamage += d }
    if (!enemy.isDummy) {
      const die = enemy.die.bind(enemy)
      enemy.die = () => {
        const wasBurning = !!enemy.burn
        die()
        this.gainXp(enemy.isBoss ? Level.scale(BOSS_XP, deep) : enemy.xpValue)
        if (!enemy.isBoss) {
          this.kills++
          if (wasBurning && this.player.stats.burn >= 2) this.#spreadFire(enemy)
          const piece = KIT.find(k => k.kills === this.kills)
          if (piece) this.pickups.drop(enemy.pos.x, enemy.pos.z, piece, { color: '#ffd27a' })
        }
      }
    }
    this.enemies.push(enemy)
    this.render3d.scene.add(enemy.group)
    return enemy
  }

  /** 보스가 부르는 잡졸, 그리고 웨이브가 부르는 적. */
  spawnMinion(kind, x, z) {
    const make = MINIONS[kind] ?? kikonesWarrior
    const e = make(this, this.fx)
    // 가장자리는 판 모양을 따른다. 원으로 잡으면 긴 갑판에서는 적이
    // 허공에 생기고, 좁은 쪽에서는 벽 안에 박힌다.
    const a = Math.atan2(x, z)
    const arena = this.render3d.arena
    const lim = arena ? arena.radiusAt(a) - 1.5 : this.arenaRadius - 1.5
    const r = Math.min(Math.hypot(x, z), lim)
    e.pos.set(Math.sin(a) * r, 0, Math.cos(a) * r)
    e.facing = Math.atan2(this.player.pos.x - e.pos.x, this.player.pos.z - e.pos.z)
    this.fx.ring(e.pos.x, e.pos.z, { color: '#c2705e', radius: 1.6, life: 0.45 })
    return this.track(e)
  }

  /** 웨이브용 — 늘 플레이어 반대편 가장자리에서 들어온다. 등 뒤에 생기면 억울하다. */
  spawnEnemy(kind = 'warrior') {
    const p = this.player.pos
    const away = Math.atan2(-p.x, -p.z) + rand(-1.1, 1.1)
    const arena = this.render3d.arena
    const r = (arena ? arena.radiusAt(away) : this.arenaRadius) - rand(0.6, 2.2)
    const e = this.spawnMinion(kind, Math.sin(away) * r, Math.cos(away) * r)

    // 무리 안에 다르게 싸워야 하는 한 마리를 섞는다 (enemy/elite.js).
    // 웨이브가 수만 늘리면 판이 어려워지는 게 아니라 길어질 뿐이다.
    const deep = Math.max(0, this.run?.index ?? 0)
    if (e && Math.random() < eliteChance(deep)) {
      const t = promote(e)
      if (t) {
        this.hud.toast(`${t.name} ${e.label ?? '것'} — ${t.hint}`, 2.6)
        this.fx.ring(e.pos.x, e.pos.z, { color: t.color, radius: 2.6, life: 0.7 })
        this.sfx?.chime()
      }
    }
    return e
  }

  /**
   * 바닥에 불을 남긴다.
   *
   * 역병을 진 정예가 죽은 자리에 깔린다 (enemy/elite.js). 이게 있어야
   * "어디서 죽일지" 가 판단이 된다 — 붙어서 잡으면 그 불을 내가 밟는다.
   *
   * 적은 안 태운다. 적까지 태우면 불을 깔아 주는 게 이득이 되어,
   * 위험이 아니라 보상이 된다.
   */
  leaveFire(x, z, { radius = 2.6, seconds = 5, dps = 9 } = {}) {
    this.hazards.push({ x, z, r: radius, left: seconds, dps, tick: 0 })
  }

  #tickHazards(dt) {
    const p = this.player
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]
      h.left -= dt
      if (h.left <= 0) { this.hazards.splice(i, 1); continue }
      // 불꽃 몇 점. 매 프레임 뿌리면 예산을 먹으므로 간격을 둔다.
      h.tick -= dt
      if (h.tick <= 0) {
        h.tick = 0.22
        this.fx.ring(h.x, h.z, { color: '#9ae06a', radius: h.r, life: 0.32 })
        this.particles.burst({ x: h.x + rand(-h.r * 0.6, h.r * 0.6), y: 0.2,
          z: h.z + rand(-h.r * 0.6, h.r * 0.6), count: 4,
          color: '#9ae06a', speed: 2.2, size: 0.13, life: 0.5, gravity: -1.2 })
      }
      // 구르는 중에는 안 밟는다. 무적 프레임이 불에도 통해야 일관된다.
      if (p.dead || p.invuln > 0 || p.rolling > 0) continue
      if (Math.hypot(p.pos.x - h.x, p.pos.z - h.z) > h.r + p.radius) continue
      h.hit = (h.hit ?? 0) - dt
      if (h.hit <= 0) {
        h.hit = 0.4
        p.hurt(h.dps * 0.4, { from: { x: h.x, z: h.z }, knockback: 0, hitstop: 0.02, color: '#9ae06a' })
      }
    }
  }

  clearField() {
    for (const e of this.enemies) this.render3d.scene.remove(e.group)
    for (const c of this.corpses) this.render3d.scene.remove(c.group)
    this.enemies.length = 0
    this.corpses.length = 0
    this.hazards.length = 0
    this.notice?.clear()
    this.pickups.clear()
    this.projectiles.clear()
    this.particles.clear()
    this.hud.setBoss(null)
    // 판을 비울 때 시선도 같이 놓는다 — 안 그러면 죽은 보스를 계속 본다
    this.render3d.setBossFocus(null)
  }

  #spreadFire(from) {
    const R = 3.4
    this.fx.ring(from.pos.x, from.pos.z, { color: '#ff7a2a', radius: R * 1.2, life: 0.5 })
    for (const e of this.enemies) {
      if (e.dead || Math.hypot(e.pos.x - from.pos.x, e.pos.z - from.pos.z) > R) continue
      e.ignite({ dps: 7 * this.player.stats.meleeDamage, seconds: 3.5, level: this.player.stats.burn })
    }
  }

  /* ── 선택 화면 ────────────────────────────────────────── */

  #freeze() { this.paused = true; this.input.held.clear(); this.input.buffer.clear() }
  #thaw() { this.paused = false }

  /**
   * 전체 화면 선택은 한 번에 하나만.
   *
   * ── 무엇이 터졌나 ──
   * 보스를 잡으면 경험치가 들어온다 (player/level.js 를 붙인 뒤로). 그 경험치로
   * 레벨이 오르면 성장 카드가 뜨는데, 같은 순간에 보스 처치 보상인 아테나의
   * 은총도 뜬다. 둘 다 `#freeze()` 로 판을 세우고 `await` 로 대답을 기다리므로,
   * **두 화면이 겹쳐 뜨고 둘 다 기다린다.** 하나를 고르면 그 하나만 `#thaw()`
   * 하는데 다른 하나는 아직 기다리는 중이라, 판이 영원히 멈춘다.
   * 세이렌(네 번째 보스)에서 처음 확실히 걸렸다 — 그때쯤 경험치가 레벨 한 칸을
   * 채우기 때문이다.
   *
   * ── 왜 이렇게 고치나 ──
   * "레벨업을 은총보다 먼저" 같은 순서 규칙으로 막을 수도 있다. 그런데 화면을
   * 띄우는 자리가 지금 여섯이고 (레벨업·은총·유물·갈림길·장비·성장) 앞으로 더
   * 늘어난다. 규칙을 자리마다 적으면 새로 하나 붙일 때마다 다시 터진다.
   * **한 번에 하나** 라는 규칙 하나를 통로에 두는 게 맞다.
   *
   * 줄을 세우기만 하고 순서는 먼저 온 쪽이 먼저다. 겹친 둘은 둘 다 정당한
   * 보상이라 하나를 버릴 이유가 없다 — 차례로 보여 주면 된다.
   *
   * 주의: 잠긴 함수 안에서 잠긴 함수를 부르면 서로를 기다린다. 그래서
   * `offerUpgrade` 는 일부러 잠그지 않았다 — 늘 잠긴 것들 안에서 불린다.
   */
  #modal(run) {
    const prev = this._modalChain ?? Promise.resolve()
    let release
    this._modalChain = new Promise(r => { release = r })
    return prev.then(async () => {
      try { return await run() } finally { release() }
    })
  }

  /**
   * 경험치를 넣는다. 레벨이 올라가면 표시만 하고, 카드는 update 가 연다.
   * 여기서 바로 열지 않는 이유는 이게 die() 안에서 불리기 때문이다.
   */
  gainXp(amount) {
    if (!amount || this.player.dead) return
    const up = this.level.add(amount)
    if (!up) return
    // 올랐다는 걸 카드보다 먼저 몸으로 알려 준다 — 카드는 0.2 초쯤 뒤에 뜬다
    this.sfx?.level()
    this.notice?.level(this.level.lv, up > 1 ? `${up} 칸 올랐다` : '')
    const p = this.player
    this.fx.ring(p.pos.x, p.pos.z, { color: '#ffe6b8', radius: 2.6, life: 0.55 })
    this.particles.converge({ x: p.pos.x, y: 1.0, z: p.pos.z, count: 22, radius: 3.2,
      color: '#ffe6b8', size: 0.13, life: 0.55 })
  }

  /** 밀린 레벨업을 하나씩 고른다. 두 칸이 한꺼번에 올라도 카드는 한 장씩. */
  async #spendLevels() {
    if (this._leveling) return
    this._leveling = true
    try {
      while (this.level.pending > 0 && !this.player.dead) {
        this.level.pending--
        await this.#modal(() =>
          this.offerUpgrade(`레벨 ${this.level.lv}`, '스무 해가 사람을 벼린다 — 하나를 고른다'))
      }
    } finally { this._leveling = false }
  }

  async offerUpgrade(heading, sub) {
    this.#freeze()
    const before = new Map(this.taken)
    const pick = await this.levelUp.show({
      heading, sub, choices: rollChoices(this.player.stats.choiceCount ?? 3, this.taken, [], this.player.stats.unlockEase ?? 0),
      unlocked: this._pendingUnlocks ?? [], tiers: TIERS,
    })
    this._pendingUnlocks = null
    this.taken.set(pick.id, (this.taken.get(pick.id) ?? 0) + 1)
    pick.apply(this.player.stats)
    this.player.applyStats()
    // 고른 것을 오른쪽에 남긴다. 카드 화면은 닫히면 사라지므로,
    // 무엇을 모으고 있는지가 화면에 계속 남아야 빌드가 보인다.
    this.notice?.acquire({ kind: TIERS[pick.tier]?.label ?? '성장',
      name: pick.name, desc: pick.desc, tier: pick.tier ?? 0 })
    const opened = newlyUnlocked(before, this.taken)
    if (opened.length) {
      this._pendingUnlocks = opened
      /**
       * 등급이 열린 걸 알려 준다.
       *
       * 이건 원래 있던 사건인데 아무도 몰랐다 — 같은 계열을 두 번 고르면
       * 레어가 열리고 네 번이면 유니크가 열리는데, 그게 다음 선택지에
       * 조용히 한 장 더 생기는 것으로만 표현됐다. 열린 걸 안 알려 주면
       * 계열을 모으는 게 선택이 아니라 우연이 된다.
       */
      const top = opened.reduce((a, b) => (b.tier > a.tier ? b : a), opened[0])
      const label = TIERS[top.tier]?.label ?? ''
      this.notice?.unlock(top.tier, label, top.name)
      this.sfx?.chime()
    }
    this.fx.ring(this.player.pos.x, this.player.pos.z, { color: '#9fe0ff', radius: 3.0, life: 0.5 })
    this.#thaw()
    return pick
  }

  /**
   * Tab 으로 여는 연출 목록.
   *
   * 연출은 게임을 처음부터 돌려야만 볼 수 있어서 한 군데 고치면 확인에 몇 분이 든다.
   * 여기서 한 줄씩 바로 틀어 본다. 이름과 실행만 들고 있고, 무엇을 어떻게
   * 그릴지는 패널이 정한다.
   */
  eventList() {
    const ev = []
    ev.push(
      { group: '시작', name: '오프닝', note: '왜 바다에 있는가', run: () => this.playInterlude(OPENING) },
      { group: '컷신', name: '트로이가 불탔다', note: '그림 세 장', run: () => this.playCut(CUT_TROY) },
      { group: '컷신', name: '동굴 문이 막혔다', note: '폴리페모스', run: () => this.playCut(CUT_CAVE) },
      { group: '컷신', name: '해가 들지 않는 곳', note: '저승', run: () => this.playCut(CUT_UNDER) },
      { group: '컷신', name: '바다가 도는 자리', note: '메시나', run: () => this.playCut(CUT_WHIRL) },
      { group: '컷신', name: '이타카가 보였다', note: '스무 해 만에', run: () => this.playCut(CUT_ITHACA) },
      { group: '컷신', name: '활시위를 건다', note: '안티노오스 앞', run: () => this.playCut(CUT_BOW) },
      { group: '시작', name: '시작 화면', note: '패럴랙스 · 물에 풀리는 퇴장', run: () => { location.href = '/' } },
      { group: '시작', name: '난이도 고르기', note: '어떤 바다를 건널 것인가', run: () => this.diffScreen.show() },
    )
    for (let i = 0; i < STAGES.length - 1; i++) {
      const lude = interludeFor(i)
      if (!lude) continue
      ev.push({
        group: '막간', name: `${STAGES[i].name} → ${STAGES[i + 1].name}`,
        note: lude.scene, run: () => this.playInterlude(lude),
      })
    }
    ev.push(
      { group: '저승', name: '아가멤논이 올라온다', note: '흙을 헤치고', run: () => this.previewUnderworld() },
      { group: '저승', name: '유물 고르기', note: '하나만 들고 간다', run: () => this.chooseRelic(RELICS) },
      { group: '보상', name: '아테나의 은총', note: '보스를 눕힌 뒤', run: () => this.grantBlessing(this.run.stage ?? STAGES[0]) },
      { group: '보상', name: '성장 선택', note: '카드 세 장', run: () => this.offerUpgrade('성장', '가져갈 것을 하나 고른다') },
    )
    for (const k of KIT) {
      ev.push({ group: '장비', name: k.name, note: `${k.kills}마리째`, run: () => this.previewGear(k) })
    }
    STAGES.forEach((st, i) => {
      if (st.relic) return
      ev.push({
        group: '보스', name: st.name, note: st.title ?? '',
        run: () => this.jumpTo(i, { toBoss: true }),
      })
    })
    return ev
  }

  /** 저승 컷씬만 따로. */
  async previewUnderworld() {
    this.#freeze()
    await this.reach.play(UNDERWORLD_CUT)
    this.#thaw()
  }

  /** 장비 착용 연출만 따로. 입고 있던 것은 그대로 두고 그 조각만 다시 붙인다. */
  async previewGear(piece) {
    const meshes = this.player.equip(piece.id)
    this.paused = true
    await this.presentGear(piece, meshes)
    this.paused = false
  }

  /**
   * 한 컷 연출 — 검은 띠를 위아래로 물리고, 카메라를 한 곳에 붙이고,
   * 가운데에 이름을 띄운다.
   *
   * 판이 바뀌는 자리마다 이게 없으면 "웨이브가 끝났다 → 갑자기 보스가 서 있다"
   * 가 된다. 사이에 한 호흡을 넣어야 만난 것이 된다.
   *
   * @param o.title  큰 글자 (보스 이름)
   * @param o.sub    작은 글자 (칭호나 한 줄)
   * @param o.at     카메라가 볼 자리 {x, z}. 없으면 플레이어를 본다
   * @param o.zoom   0~1. 클수록 바짝
   * @param o.hold   글자를 띄워 두는 시간(초)
   * @param o.face   초상 그림 주소. 없거나 못 불러오면 글자만 뜬다
   */
  async cinema({ title, sub = '', at = null, zoom = 0.45, hold = 2.2, lead = 0.7, face = null } = {}) {
    const box = this._cinema ??= (() => {
      // 모양은 <style> 로 뺀다. 인라인 style 에 뇌문 data URI 를 넣으면
      // 그 안의 날것 <svg 때문에 화면 캡처용 XML 직렬화가 통째로 깨진다.
      const st = document.createElement('style')
      st.textContent = `
#cinema { position:absolute; inset:0; z-index:54; pointer-events:none; overflow:hidden; }
#cinema .cn-bar { position:absolute; left:0; right:0; height:11vh; background:#05040a;
  transition:transform .9s cubic-bezier(.2,.8,.2,1); }
#cinema .cn-top { top:0; transform:translateY(-100%); }
#cinema .cn-bot { bottom:0; transform:translateY(100%); }
#cinema.on .cn-top, #cinema.on .cn-bot { transform:translateY(0); }
#cinema .cn-card { position:absolute; left:0; right:0; bottom:19vh; text-align:center;
  opacity:0; transform:translateY(10px);
  transition:opacity .7s ease, transform .9s cubic-bezier(.2,.8,.3,1); }
#cinema.say .cn-card { opacity:1; transform:none; }

/* 초상 — 화면 한쪽에 세우고 가장자리는 지운다.
   잘라 낸 컷을 쓰면 테두리가 칼자국처럼 남는다. 네 변을 흐리게 지우면
   배경이 무엇이든 무대 어둠에 그대로 녹는다. */
#cinema .cn-face { position:absolute; right:6vw; top:50%; width:min(29vw, 380px);
  aspect-ratio:3/4; transform:translateY(-46%) scale(1.04); opacity:0;
  background-size:cover; background-position:center top;
  -webkit-mask-image:radial-gradient(ellipse 62% 58% at 50% 40%, #000 22%, rgba(0,0,0,.55) 62%, transparent 86%);
  mask-image:radial-gradient(ellipse 62% 58% at 50% 40%, #000 22%, rgba(0,0,0,.55) 62%, transparent 86%);
  transition:opacity 1.1s ease, transform 2.6s cubic-bezier(.2,.8,.3,1); }
#cinema.on .cn-face { opacity:1; transform:translateY(-46%) scale(1); }
#cinema .cn-face.none { display:none; }
@media (max-width: 860px) { #cinema .cn-face { right:50%; transform:translate(50%,-46%); width:62vw; }
  #cinema.on .cn-face { transform:translate(50%,-46%) scale(1); } }
#cinema .cn-rule { height:13px; width:min(420px,64vw); margin:0 auto 20px;
  background-image:${meanderURI()}; background-repeat:repeat-x;
  background-position:center; opacity:.5; }
#cinema .cn-title { font-family:var(--display); font-weight:500;
  font-size:clamp(30px,4.2vw,56px); letter-spacing:.14em; color:#f2e6cc;
  text-shadow:0 0 70px rgba(232,200,132,.45), 0 6px 30px #000; }
#cinema .cn-sub { font-family:var(--serif); font-size:12.5px; letter-spacing:.42em;
  text-indent:.42em; color:#b79b6a; margin-top:14px; }`
      document.head.appendChild(st)

      const d = document.createElement('div')
      d.id = 'cinema'
      d.innerHTML = `
        <div class="cn-bar cn-top"></div>
        <div class="cn-bar cn-bot"></div>
        <div class="cn-face none"></div>
        <div class="cn-card">
          <div class="cn-rule"></div>
          <div class="cn-title"></div>
          <div class="cn-sub"></div>
        </div>`
      this.uiRoot.appendChild(d)
      return d
    })()

    box.querySelector('.cn-title').textContent = title ?? ''
    box.querySelector('.cn-sub').textContent = sub ?? ''

    // 초상은 받아지고 나서야 켠다. 없는 파일이면 글자만 뜨고 아무 일도 없다.
    const faceEl = box.querySelector('.cn-face')
    faceEl.classList.add('none')
    faceEl.style.backgroundImage = ''
    if (face) {
      await new Promise(done => {
        const probe = new Image()
        probe.onload = () => {
          faceEl.style.backgroundImage = `url("${face}")`
          faceEl.classList.remove('none')
          done()
        }
        probe.onerror = () => done()
        probe.src = face
        setTimeout(done, 1200)        // 늦게 오면 그냥 글자만 간다
      })
    }

    this.#freeze()
    this.settle = null                 // 판이 열리는 몸풀기와 카메라를 두고 다투지 않게
    // 평소의 추적은 거의 즉시 붙는다. 연출에서는 그게 '순간이동' 으로 보여서
    // 시선이 건너간 게 아니라 화면이 갈린 것처럼 읽힌다. 잠깐 느리게 만든다.
    const follow0 = CAMERA_RIG.follow
    CAMERA_RIG.follow = 0.42
    if (at) this.camFocus = new THREE.Vector3(at.x, 0, at.z)
    this.render3d.zoom = zoom
    box.classList.add('on')
    await new Promise(r => setTimeout(r, lead * 1000))

    box.classList.add('say')
    await new Promise(r => setTimeout(r, hold * 1000))

    box.classList.remove('say', 'on')
    // 카메라는 글자보다 느리게 돌아온다 — 딱 끊기면 다시 '뚝' 이 된다
    this.settle = { t: 0, dur: 1.2 }
    this.camFocus = null
    await new Promise(r => setTimeout(r, 700))
    CAMERA_RIG.follow = follow0
    this.#thaw()
  }

  /**
   * 이 판에 나오는 모델을 받는다.
   *
   * 막이 내려와 있는 동안 부르므로 기다림이 화면에 안 드러난다.
   * 오래 걸리면 (첫 방문·느린 망) 한 줄 알린다 — 아무 말 없이 멈춰 있으면
   * 게임이 죽은 줄 안다.
   */
  async loadStageModels(id) {
    if (!id) return
    const t = setTimeout(() => this.hud?.toast?.('불러오는 중…', 6), 700)
    try { await models.loadStage(id) } finally { clearTimeout(t) }
  }

  /**
   * 지금 전체 화면이 떠 있는가.
   * 고르는 창 위에 멈춤 메뉴를 겹치면 둘 다 못 쓰게 된다 — Esc 를 양보한다.
   */
  #screenOpen() {
    return !!document.querySelector(
      '#levelup.on, #bless.on, #relic.on, #lude.on, #diff.on, #picker.on, #reach.on, #reel.on, #fate.on, #title')
  }

  /** ★시험용 무적. 배포 전에 이 메서드째로 지운다. */
  setGod(on) {
    this.god = !!on
    if (this.player) this.player.god = this.god
    const el = this._godTag ??= (() => {
      const d = document.createElement('div')
      d.style.cssText = 'position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:95;'
        + 'pointer-events:none;font:700 11px/1 var(--serif),serif;letter-spacing:.3em;'
        + 'color:#ffb4a0;background:rgba(80,14,10,.82);border:1px solid #a03a2a;'
        + 'border-radius:2px;padding:7px 14px 7px 17px;text-shadow:0 1px 2px #000'
      d.textContent = '무적 켜짐 — G 로 끄기'
      this.uiRoot.appendChild(d)
      return d
    })()
    el.style.display = this.god ? 'block' : 'none'
    this.hud?.toast?.(this.god ? '무적 켜짐' : '무적 꺼짐', 1.6)
  }

  /**
   * 막간 — 판과 판 사이의 한 호흡.
   * keepOpen 이면 글이 끝나도 화면을 켠 채로 둔다. 다음 판의 막이 내려온 뒤에
   * 닫아야, 그 사이로 '지나온 판' 이 한 박자 비치지 않는다.
   */
  /**
   * 커서가 지금 무엇을 겨누는지 보여 준다.
   *
   * 바닥에 조준점을 따로 그리면 커서와 같은 자리에 겹쳐 둘 다 지저분해진다.
   * 겨누는 곳은 커서 하나로 말하고, 무엇을 겨누는지는 커서 모양으로 말한다.
   *
   * 클래스만 갈아 끼우므로 비용이 없다 — 바뀔 때만 손댄다.
   */
  #aimCursor() {
    const cv = this.render3d.renderer.domElement
    let want = ''
    const a = this.input.aim
    if (this.under?.canCall) want = 'aim-use'
    else if (this.player.dead) want = 'aim-blocked'
    else {
      // 조준점 근처에 적이 있으면 공격 커서. 사거리는 칼이 닿는 정도.
      for (const e of this.enemies) {
        if (e.dead) continue
        if (Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < e.radius + 1.3) { want = 'aim-hostile'; break }
      }
    }
    if (this._cursorWant === want) return
    this._cursorWant = want
    cv.classList.remove('aim-hostile', 'aim-use', 'aim-blocked', 'aim-loot')
    if (want) cv.classList.add(want)
  }

  /**
   * 컷신 하나. 그림 몇 장이 겹쳐 넘어가는 동안 판은 멈춘다.
   *
   * keepOpen 이면 암전한 채로 넘긴다 — 다음 화면(유물 선택 등)이
   * 그 어둠 위로 올라오게 하려는 것이다.
   */
  async playCut(cut, { keepOpen = false } = {}) {
    if (!cut) return
    this.#freeze()
    await this.reel.play({ ...cut, keepOpen })
    if (!keepOpen) this.#thaw()
  }

  async playInterlude(spec, { keepOpen = false } = {}) {
    this.#freeze()
    await this.interlude.play({ ...spec, keepOpen })
    if (!keepOpen) this.#thaw()
  }

  /**
   * 아테나의 은총. 보스를 눕힐 때마다 한 번.
   * 성장 선택지보다 훨씬 세다 — 판 하나를 넘긴 값이 수치 몇 퍼센트여서는 안 된다.
   */
    /** 아테나의 은총. 한 번에 하나만 뜨게 줄에 세운다 (#modal). */
  grantBlessing(stage) { return this.#modal(() => this.#grantBlessingInner(stage)) }

  async #grantBlessingInner(stage) {
    this.#freeze()
    const p = this.player
    // 빛이 내려온다
    this.fx.shaft(p.pos.x, p.pos.z, { color: '#ffe6b8', radius: 1.6, height: 9, life: 2.2 })
    this.fx.meanderRing(p.pos.x, p.pos.z, { color: '#ffe0a0', radius: 3.0, life: 2.0, spin: 0.7 })
    this.particles.converge({ x: p.pos.x, y: 1.0, z: p.pos.z, count: 40, radius: 4.0, color: '#ffe6b8', size: 0.16, life: 0.8 })
    this.fx.shake(0.3)
    await new Promise(r => setTimeout(r, 700))

    const pick = await this.blessScreen.show({
      said: `<em>${stage.name}</em>을 지났구나.<br>`
        + '나는 네 편이다. 처음부터 그랬고, 끝까지 그럴 것이다 — <em>하나를 받아라.</em>',
      // 아테나의 호의가 셋 이상이면 한 장을 더 보여 준다 — 편애가 손에 잡혀야 한다
      choices: rollBlessings(this.blessed, this.voyage.gods.athena >= 3 ? 4 : 3),
    })
    this.blessed.add(pick.id)
    pick.apply(p.stats)
    p.applyStats()
    if (p.stats.healFull) { p.hp = p.maxHp; p.stats.healFull = false }
    this.particles.burst({ x: p.pos.x, y: 1.0, z: p.pos.z, count: 40, color: '#fff0c8', speed: 7, size: 0.17, life: 0.8, gravity: 2, up: 1.3 })
    this.hud.banner(pick.name, pick.flavor, 2.8)
    this.#thaw()
    return pick
  }

  /**
   * 판이 바뀌는 순간을 덮는 막.
   *
   * 땅과 빛이 한 프레임에 갈리면 다른 데로 '뚝' 떨어진 것처럼 보인다.
   * 어둠으로 덮고, 덮인 동안 갈고, 다시 걷으면서 카메라가 천천히 내려앉는다.
   * 걷히는 시간이 곧 "여기가 어디인지 둘러보는 시간"이 된다.
   *
   * @param apply 막이 내려가 있는 동안 할 일 (땅·빛 교체)
   */
  async curtain(apply, { out = 0.55, hold = 0.25, into = 1.7 } = {}) {
    const veil = this._veil ??= (() => {
      const d = document.createElement('div')
      d.style.cssText = 'position:absolute;inset:0;z-index:52;pointer-events:none;'
        + 'background:#06050a;opacity:0;transition:opacity .42s ease'
      this.uiRoot.appendChild(d)
      return d
    })()

    veil.style.transitionDuration = `${out}s`
    veil.style.opacity = '1'
    await new Promise(r => setTimeout(r, out * 1000))

    // 막이 다 내려온 뒤에야 막간 화면을 걷는다
    this.interlude?.close()
    this.reach?.close()
    this.reel?.close()
    await apply?.()
    await new Promise(r => setTimeout(r, hold * 1000))

    // 카메라가 한 뼘 물러난 자리에서 제자리로 내려앉고, 빛이 같이 든다
    this.settle = { t: 0, dur: into * 1.6 }
    veil.style.transitionDuration = `${into}s`
    veil.style.opacity = '0'
    await new Promise(r => setTimeout(r, into * 1000 * 0.62))
  }

  /**
   * 판이 열리는 동안의 몸풀기.
   *
   * 막만 걷으면 밝기가 한 번에 제자리로 와서 스위치를 켠 것처럼 보인다.
   * 카메라는 한 뼘 물러난 자리에서 내려앉고, 노출은 어두운 데서 올라온다.
   * 둘이 서로 다른 곡선으로 붙어야 '눈이 적응하는' 느낌이 난다.
   */
  #driveSettle(dt) {
    const s = this.settle
    if (!s) return
    s.t += dt
    const k = Math.min(1, s.t / s.dur)
    this.render3d.zoom = -0.30 * Math.pow(1 - k, 2.6)
    const target = this.render3d.exposure ?? 1.05
    const lit = 0.34 + 0.66 * (1 - Math.pow(1 - k, 1.7))
    this.render3d.renderer.toneMappingExposure = target * lit
    if (k >= 1) {
      this.render3d.zoom = 0
      this.render3d.renderer.toneMappingExposure = target
      this.settle = null
    }
  }

    /** 저승의 유물. 줄에 세운다 (#modal). */
  chooseRelic(relics) { return this.#modal(() => this.#chooseRelicInner(relics)) }

  async #chooseRelicInner(relics) {
    // 손이 화면을 덮은 채로 넘긴다 — 유물 화면이 그 어둠 위로 올라온다
    this.#freeze()
    await this.reach.play({ ...UNDERWORLD_CUT, keepOpen: true })
    const pick = await this.relicScreen.show({
      name: '아가멤논', title: '미케네 3대 국왕',
      said: '나는 내 집 문턱에서 죽었다. <em>스무 해를 싸우고</em> 돌아가 아내의 손에.<br>'
        + '너도 돌아갈 셈이냐. 그렇다면 <em>하나만 가져가라</em> — 들고 갈 수 있는 건 하나뿐이다.',
      relics,
    })
    pick.apply(this.player.stats)
    this.player.applyStats()
    this.reach.close()
    this.hud.banner(pick.name, pick.flavor, 2.8)
    this.#thaw()
    return pick
  }

  /**
   * 곧 쓸 막간 그림을 미리 받아 둔다.
   * 제목·난이도 화면이 떠 있는 동안이 제일 조용한 때다.
   */
  warmInterlude(spec) {
    const art = spec?.art
    if (art) this.interlude?.preload(Array.isArray(art) ? art : [art])
  }

  /**
   * 곁에 설 동료를 세운다. 판(구간)이 바뀔 때마다 run.js 가 부른다.
   * 누가 서는지는 이야기가 정한다 (companionsFor) — 저승엔 혼자, 트리나키아
   * 뒤로는 아무도 없고, 이타카에서는 아들이 선다.
   */
  setAllies(stage, part = {}) {
    for (const a of this.allies) this.render3d.scene.remove(a.group)
    this.allies.length = 0
    // 헤엄치는 판(카리브디스)에는 세우지 않는다 — 물 위에 사람이 서 있게 된다
    if (part.maelstrom) return
    const p = this.player
    for (const spec of companionsFor(stage, this.voyage)) {
      const a = new Companion(this, this.fx, spec)
      a.pos.set(p.pos.x + spec.slot * 1.4, 0, p.pos.z + 1.6)
      a.facing = p.facing
      this.allies.push(a)
      this.render3d.scene.add(a.group)
    }
  }

  /**
   * 판 사이의 갈림길 (stage/voyage.js 의 FATES).
   * 고른 것을 그 자리에서 적용하고, 신의 눈금이 어떻게 움직였는지 돌려준다.
   */
  chooseFate(fate) { return this.#modal(() => this.#chooseFateInner(fate)) }

  async #chooseFateInner(fate) {
    this.#freeze()
    this.music.play('sail')
    // 갈림길은 막간 액자 위로 올라온다. 다 덮은 뒤에 액자를 닫는다 —
    // 그대로 두면 뒤이어 뜨는 성장 카드(영광)가 액자 밑에 깔린다
    const shown = this.fateScreen.show(fate, c => this.#applyFate(c))
    setTimeout(() => this.interlude?.close?.(), 1500)
    const pick = await shown
    this.voyage.flags[`fate:${fate.id}`] = pick.id     // 무엇을 골랐는지 — 엔딩이 읽는다
    this.#thaw()
    // 결과가 성장 카드면 여기서 고른다 — 이름을 남긴 값
    if (pick.glory) await this.offerUpgrade('영광', '이름을 남긴 자가 가져가는 것')
    return pick
  }

  #applyFate(c) {
    const v = this.voyage, p = this.player
    const gods = {}
    for (const [id, d] of Object.entries(c.gods ?? {})) {
      const a = v.gods[id]
      v.god(id, d)
      gods[id] = [a, v.gods[id]]
    }
    Object.assign(v.flags, c.flags ?? {})
    if (c.bonusHp) { p.stats.bonusHp = (p.stats.bonusHp ?? 0) + c.bonusHp; p.applyStats() }
    if (c.damage) { p.stats.meleeDamage *= 1 + c.damage; p.stats.rangedDamage *= 1 + c.damage; p.applyStats() }
    if (c.heal) p.hp = p.maxHp
    p.hp = Math.min(p.hp, p.maxHp)
    if (c.xp) this.gainXp(c.xp)
    if (c.crewAll) v.leave(0, 0, '트리나키아')
    return { gods }
  }

  /**
   * 이야기가 정한 상실. 판의 매듭에서 run.js 가 부른다.
   * 조용히 숫자만 줄면 아무것도 잃지 않은 것처럼 지나간다 — 한 번 세운다.
   */
  async crewLoss(key) {
    const L = LOSSES[key]
    if (!L || this.voyage.crew <= 0) return
    const lost = L.leave ? this.voyage.leave(L.leave[0], L.leave[1], L.where) : this.voyage.lose(L.lose, L.where)
    if (!lost) return
    this.notice.milestone('돌아오지 못한 자', `${lost}명`, L.line.replace(/<[^>]+>/g, ''), '#c0453a')
    this.sfx?.thud?.()
    await new Promise(r => setTimeout(r, 1600))
  }

    /** 해협의 갈림길. 줄에 세운다 (#modal). */
  chooseFork(stage) { return this.#modal(() => this.#chooseForkInner(stage)) }

  async #chooseForkInner(stage) {
    this.#freeze()
    const pick = await this.levelUp.show({
      heading: stage.name, sub: stage.intro,
      choices: stage.options.map(o => ({ ...o, name: o.label, desc: o.line, tag: '해협', tier: 0 })),
      tiers: TIERS,
      sheer: true,        // 배 위에서 고르는 것이 보여야 한다
    })
    this.#thaw()
    return pick
  }

  showCredits(damage) {
    this.hud.credits(damage, this.taken, this.run, this.voyage, FATES)
  }

  /* ── 진행 ─────────────────────────────────────────────── */

  restart() {
    this.voyage.reset()
    this.clearField()
    this.kills = 0
    this.totalDamage = 0
    this.taken.clear()
    this.level.reset()
    this.player.gear.reset()
    this.player.stats = newStats()
    this.player.applyStats()
    const p = this.player
    p.hp = p.maxHp; p.dead = false; p.rollCharges = 3; p.rolling = 0
    p.stagger = 0; p.invuln = 0; p.action.stop(); p._echo = null
    this.hud.hideCredits()
    this.run.start()
  }

  /**
   * 시험용 — 아무 판이나 그 자리에서 연다.
   *
   * 맨몸 레벨1 로 900 체력짜리 보스를 만나면 체험이 안 된다.
   * 그 지점까지 왔다면 가졌을 만큼을 쥐여 주고 시작한다.
   */
  /**
   * 시험용 — 화면 톤 시안을 하나씩 돌려 본다 (L 키).
   * 지금 / 정오의 대리석 / 황금빛 오후 / 에게해 / 도기 채색 / 프레스코
   */
  cycleLook(name) {
    const cur = LOOK_KEYS.indexOf(this.render3d.look ?? 'marble')
    const next = name ?? LOOK_KEYS[(cur + 1) % LOOK_KEYS.length]
    this.render3d.setLook(next)
    const l = LOOKS[next]
    this.hud.banner(l.name, l.line, 2.4)
    return next
  }

  async jumpTo(index, { bare = false, toBoss = true } = {}) {
    this.paused = false
    this.equipFx = null
    this.equipCard.close()
    this.hud.hideCredits()

    const p = this.player
    p.gear.reset()
    p.stats = newStats()
    this.taken.clear()
    this.kills = 0

    if (!bare && index > 0) {
      // 전리품은 두 번째 판부터 한 벌 다 갖춘 것으로 본다
      for (const k of KIT) p.equip(k.id)
      // 성장은 판마다 세 장. 레벨이 두 번 오르고 은총이 한 번 오므로
      // 실제 진행과 같은 수다 (player/level.js 의 곡선 참고).
      const picks = Math.min(index * 3, 20)
      this.level.reset()
      for (let i = 0; i < index * 2; i++) this.level.add(this.level.need)
      this.level.pending = 0        // 여기서 카드를 띄우면 안 된다 — 이미 아래서 먹인다
      for (let i = 0; i < picks; i++) {
        const pool = rollChoices(1, this.taken)
        if (!pool.length) break
        const u = pool[0]
        u.apply(p.stats)
        this.taken.set(u.id, (this.taken.get(u.id) ?? 0) + 1)
      }
      // 저승을 지난 뒤라면 유물도 하나
      if (index > 4) {
        const relic = RELICS[Math.floor(Math.random() * RELICS.length)]
        relic.apply(p.stats)
        this.taken.set(relic.id, 1)
      }
    }
    p.applyStats()
    p.hp = p.maxHp; p.dead = false; p.action.stop(); p.rolling = 0; p.stagger = 0
    p.invuln = 0; p._echo = null; p.rollCharges = 3
    p.god = this.god        // ★시험용 무적 — 배포 전에 지운다

    await this.run.start(index, { toBoss })
    if (!bare && index > 0) this.hud.toast(`연습 — 그 지점 차림으로 시작 (성장 ${this.taken.size}종)`, 3)
  }

  /**
   * 장비를 입는 순간을 보여 준다.
   * 카드가 바로 뜨면 무엇이 몸에 붙었는지 모르고 지나간다. 한 박자를 준다 —
   * 카메라가 당겨지고, 붙은 조각이 청동빛으로 달아올랐다 식는다.
   */
  presentGear(piece, meshes) {
    return new Promise(resolve => {
      this.hud.clearBanner()          // 스테이지 배너와 겹치면 둘 다 안 읽힌다
      this.equipCard.open(piece.name, piece.line)
      const { x, z } = this.player.pos
      // 퍼지는 노란 링 대신, 바닥엔 도는 뇌문 고리 하나와 위에서 내려오는 빛기둥
      this.fx.meanderRing(x, z, { color: '#f0d49a', radius: 2.3, life: 1.7, spin: 0.9 })
      this.fx.shaft(x, z, { color: '#ffe6b8', radius: 1.0, height: 6.5, life: 1.5 })
      this.fx.shake(0.18)
      this.equipFx = { t: 0, dur: 1.9, meshes, done: resolve, pulls: 0 }
    })
  }

  #driveEquipFx(dt) {
    const e = this.equipFx
    if (!e) return
    e.t += dt
    const k = Math.min(e.t / e.dur, 1)

    // 카메라: 빠르게 당겼다가 천천히 놓는다
    this.render3d.zoom = Math.min(k / 0.16, 1) * (1 - Math.max(0, (k - 0.66) / 0.34))

    // 붙은 조각이 달아올랐다 식는다. 세게 주면 몸 전체가 타 보인다.
    const heat = Math.pow(1 - Math.min(k / 0.55, 1), 1.6) * 1.15
    for (const m of e.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) if (mat?.emissive) mat.emissive.setRGB(heat, heat * 0.72, heat * 0.3)
    }

    // 빛 알갱이가 바깥에서 몸으로 빨려 들어온다 — 무언가 '붙는' 방향이다
    const want = Math.floor(k / 0.085)
    while (e.pulls < want && e.pulls < 7) {
      this.particles.converge({
        x: this.player.pos.x, y: 0.95, z: this.player.pos.z,
        count: 9, radius: 2.6, color: '#ffd9a0', size: 0.14, life: 0.5,
      })
      e.pulls++
    }
    // 다 붙는 순간 한 번 터뜨린다
    if (!e.popped && k >= 0.52) {
      e.popped = true
      this.particles.burst({
        x: this.player.pos.x, y: 1.0, z: this.player.pos.z,
        count: 26, color: '#fff0c8', speed: 5.5, size: 0.14, life: 0.5, gravity: 3, up: 1.1,
      })
      this.fx.shake(0.28)
    }

    this.equipCard.drive(k)

    if (k >= 1) {
      this.render3d.zoom = 0
      for (const m of e.meshes) {
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) if (mat?.emissive) mat.emissive.setRGB(0, 0, 0)
      }
      this.equipCard.close()
      this.equipFx = null
      e.done()
    }
  }

  /**
   * 거지 차림.
   * 들어갈 땐 전리품을 전부 감추고, 정체를 드러낼 땐 한 벌씩 다시 입는다 —
   * 그 순간이 이 판의 절정이다.
   */
  async setBeggar(on, say) {
    const p = this.player
    if (on) {
      this._beggarWorn = KIT.filter(k => p.gear.has(k.id)).map(k => k.id)
      p.gear.reset()
      p.gear.rags?.(true)
      if (say) this.hud.toast(say, 4)
      return
    }
    const worn = this._beggarWorn ?? []
    this._beggarWorn = null
    p.gear.rags?.(false)
    if (!worn.length) return
    this.paused = true
    this.hud.banner('“내가 오디세우스다”', '누더기가 벗겨진다', 3.2)
    for (const id of worn) {
      const meshes = p.equip(id)
      const { x, z } = p.pos
      this.fx.meanderRing(x, z, { color: '#f0d49a', radius: 2.2, life: 0.9, spin: 1.4 })
      this.particles.converge({ x, y: 0.95, z, count: 16, radius: 2.4, color: '#ffd9a0', size: 0.15, life: 0.35 })
      for (const m of meshes) {
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) if (mat?.emissive) mat.emissive.setRGB(1.2, 0.85, 0.35)
      }
      this.fx.shake(0.3)
      await new Promise(r => setTimeout(r, 340))
    }
    // 달아오른 것을 식힌다
    for (const id of worn) for (const m of p.equip(id)) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) if (mat?.emissive) mat.emissive.setRGB(0, 0, 0)
    }
    this.fx.shaft(p.pos.x, p.pos.z, { color: '#ffe6b8', radius: 1.2, height: 7, life: 1.4 })
    await new Promise(r => setTimeout(r, 700))
    this.paused = false
  }

  onWaveSay(text) { this.hud.toast(text) }
  onBossSay(text) { this.hud.toast(text, 2.8) }

  /** 보스가 쓰러져 약점이 드러났다. */
  onBossDown(boss, phase) {
    this.hud.toast(phase.downSay ?? `쓰러졌다 — ${phase.weakHint ?? '약점'}`, 4)
    this.hud.setBossDown(true)
  }

  onBossWeakHit(boss) {
    this.hud.setBossDown(false)
    this.hud.toast('찔렀다', 1.6)
    this.particles.burst({ x: boss.pos.x, y: (boss.cfg.weakPoint?.y ?? 2), z: boss.pos.z,
      count: 40, color: '#ffe08a', speed: 11, size: 0.22, life: 0.8, gravity: 5, up: 1.4 })
  }

  /** 키르케의 변신 마법 — 죽지는 않지만 느려진다. */
  onHex() {
    const p = this.player
    if (this.voyage.flags.moly) {
      // 헤르메스의 몰리 — 마녀의 술잔이 통하지 않는다
      this.hud.toast('몰리가 마법을 삼켰다 — 짐승이 되지 않는다', 2.2)
      this.fx.meanderRing(p.pos.x, p.pos.z, { color: '#e8f0ff', radius: 2.0, life: 0.8, spin: 1.2 })
      return
    }
    p.hexed = 5
    this.hud.toast('돼지로 변한다 — 몸이 무겁다', 2.2)
  }

  update(dt) {
    if (this.paused) return
    if (this.fx.hitstop > 0) return

    this.run.update(dt)
    this.input.update(dt)
    const aim = this.input.updateAim()

    // 저승의 구덩이는 마우스로 누른다. 칼보다 먼저 본다 —
    // 부르는 자리에 서서 클릭했는데 칼이 나가면 '눌렀다' 가 안 된다.
    if (this.under?.canCall && this.input.consume('slash')) {
      if (this.under.click()) this.run.callUp?.()
    }

    const p = this.player
    if (p.hexed > 0) { p.hexed -= dt; if (p.hexed <= 0) p.hexed = 0 }
    if (p.slowed > 0) { p.slowed -= dt; if (p.slowed <= 0) { p.slowed = 0; p.slowMul = 1 } }
    p.update(dt, aim)

    if (p.dead && !this._deathHandled) {
      this._deathHandled = true
      if (!this.run.onPlayerDeath()) this.hud.banner('죽음', '다시 시작하려면 R', 9)
    }
    if (!p.dead) this._deathHandled = false

    for (const e of this.enemies) { e.think(dt); e.step(dt, this.arenaRadius) }
    for (const a of this.allies) { a.think(dt); a.step(dt, this.arenaRadius) }

    const all = [p, ...this.enemies]
    separate([...all, ...this.allies], dt)
    this.projectiles.update(dt, all, this.arenaRadius, this.render3d.camera)
    this.particles.update(dt)

    this.#tickHazards(dt)

    const looted = this.pickups.update(dt, p)
    if (looted.length && !p.dead) this.#openLoot(looted)
    // 레벨업 카드는 여기서 연다. die() 안에서 바로 열면 적 목록을 돌던
    // 중간에 화면이 뜨고, 그 사이 목록이 바뀐다.
    if (this.level.pending > 0 && !p.dead) this.#spendLevels()

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]
      if (!e.dead) continue
      this.enemies.splice(i, 1)
      e.deathT = 0
      this.corpses.push(e)
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i]
      c.deathT += dt
      const k = Math.min(c.deathT / 0.45, 1)
      c.group.position.y = -k * 1.6
      c.group.rotation.z = k * 1.3
      if (k >= 1) { this.render3d.scene.remove(c.group); this.corpses.splice(i, 1) }
    }
  }

  /** 전리품 → 장비 착용 → 성장 카드. 줄에 세운다 (#modal). */
  #openLoot(pieces) { return this.#modal(() => this.#openLootInner(pieces)) }

  async #openLootInner(pieces) {
    if (this.paused) return
    this._queue = (this._queue ?? []).concat(pieces)
    while (this._queue.length) {
      const piece = this._queue.shift()
      this.paused = true
      const meshes = this.player.equip(piece.id)
      await this.presentGear(piece, meshes)
      this.paused = false
      // 입은 것을 오른쪽에 남긴다 — 카드 연출은 지나가고 나면 사라진다
      this.notice?.acquire({ kind: '차림', name: piece.name, desc: piece.line, tier: 1 })
      await this.offerUpgrade(piece.name, piece.line)
    }
  }

  /**
   * 전체 화면 연출이 3D 판을 완전히 덮고 있는가.
   *
   * 막간과 저승 손은 불투명하게 화면 전체를 가린다. 그 뒤로 3D 판을 계속
   * 그려 봐야 한 픽셀도 안 보인다 — 그런데 하필 그때가 액자의 blur·mask·
   * 혼합이 가장 무거운 순간이라, 안 보이는 렌더가 보이는 연출의 예산을
   * 깎아먹는다. 덮여 있으면 그리지 않는다.
   */
  get covered() {
    return !!(this.interlude?.el?.classList.contains('on')
      || this.reach?.el?.classList.contains('on')
      || this.reel?.el?.classList.contains('on'))
  }

  draw() {
    const real = this._real ?? 1 / 60
    // 시간이 걸린 연출은 덮여 있어도 계속 흘러야 한다 — 막이 걷히는 순간
    // 제자리에 있어야 하니까.
    this.#driveSettle(real)
    this.#driveEquipFx(real)
    if (this.covered) return
    const cam = this.render3d.camera
    this.player.sync(cam)
    for (const e of this.enemies) e.sync(cam)
    for (const a of this.allies) a.sync(cam)
    for (const c of this.corpses) { c.sync(cam); c.group.position.y = -Math.min(c.deathT / 0.45, 1) * 1.6 }
    this.#aimCursor()
    // 연출 중에는 카메라가 다른 것을 본다
    this.render3d.updateSnow(real, this.player.pos)
    this.render3d._mist?.userData.tick?.(real)
    this.render3d.updateCamera(this.camFocus ?? this.player.pos,
      this.camFocus ? null : (this.input.pointerInside ? this.input.aim : null),
      this._real ?? 1 / 60)
    this.render3d.render()
    this.hud.update(this.player, {
      totalDamage: this.totalDamage, dt: this._real ?? 1 / 60,
      kills: this.kills, kit: kitProgress(this.kills), level: this.level,
      stage: this.run.view, index: this.run.index, count: STAGES.length,
    })
  }
}

// 시작할 때는 어느 판에나 나오는 것만 받는다. 보스는 그 판에 들어갈 때.
await Promise.all([models.preload(models.baseKeys()), preloadCharacter()])
const game = new Game(document.getElementById('app'), document.getElementById('ui'))
window.__game = game

/**
 * 개발용 화면 캡처. window.__shot('이름.png') → shots/ 에 떨어진다.
 * 3D 캔버스 위에 HUD(DOM) 를 SVG foreignObject 로 얹어 한 장으로 만든다.
 */
if (import.meta.env?.DEV) {
  /** 패널이 숨어 있으면 rAF 가 멈춰 캐릭터가 바인드 포즈(T포즈)로 남는다. 손으로 돌려 준다. */
  window.__tick = (n = 60) => {
    for (let i = 0; i < n; i++) { game.fx.update(1 / 60); game.update(1 / 60) }
    game._real = 1 / 60
    game.draw()
  }

  /** 연출을 정확히 몇 초 지점까지 돌린다. 숨은 창에서는 rAF 가 안 돌아 손으로 민다. */
  window.__seek = (sec = 1) => {
    game._real = 1 / 60
    for (let i = 0; i < Math.round(sec * 60); i++) game.draw()
  }

  window.__shot = async (name = 'shot.png', settle = 45) => {
    if (settle) window.__tick(settle)
    game.draw()                                   // 캔버스 내용을 확실히 채워 두고 읽는다
    const src = game.render3d.canvas
    const w = src.width, h = src.height
    const out = document.createElement('canvas')
    out.width = w; out.height = h
    const g2 = out.getContext('2d')
    g2.drawImage(src, 0, 0)

    // HUD 를 통째로 SVG 안에 넣어 그린다. 실패하면 3D 만 담는다.
    try {
      const ui = document.getElementById('ui')
      const css = [...document.styleSheets].map(s => {
        try { return [...s.cssRules].map(r => r.cssText).join('\n') } catch { return '' }
      }).join('\n')
      // foreignObject 안에서는 외부 파일을 못 불러온다. 이미지는 data URI 로 바꿔 넣는다.
      const imgs = [...ui.querySelectorAll('img')]
      const saved = imgs.map(im => im.getAttribute('src'))
      await Promise.all(imgs.map(async im => {
        const src = im.getAttribute('src')
        if (!src || src.startsWith('data:')) return
        try {
          const blob = await (await fetch(src)).blob()
          im.setAttribute('src', await new Promise(ok => {
            const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob)
          }))
        } catch { /* 못 가져오면 그냥 둔다 */ }
      }))

      // 인라인 style 의 background-image 도 foreignObject 안에서는 못 불러온다
      const styled = [...ui.querySelectorAll('[style*="url("]')]
      const savedStyle = styled.map(el => el.getAttribute('style'))
      await Promise.all(styled.map(async el => {
        const m = el.style.backgroundImage?.match(/url\((["']?)([^)"']+)\1\)/)
        if (!m || m[2].startsWith('data:')) return
        try {
          const blob = await (await fetch(m[2])).blob()
          const uri = await new Promise(ok => {
            const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob)
          })
          el.style.backgroundImage = `url("${uri}")`
        } catch { /* 못 가져오면 그냥 둔다 */ }
      }))

      // outerHTML 은 <br> 처럼 안 닫힌 태그를 그대로 뱉어서 XML 파서가 거부한다.
      // XMLSerializer 는 XML 로 맞춰 준다.
      const body = new XMLSerializer().serializeToString(ui)
      imgs.forEach((im, i) => { if (saved[i]) im.setAttribute('src', saved[i]) })
      styled.forEach((el, i) => { if (savedStyle[i]) el.setAttribute('style', savedStyle[i]) })
      // 캡처에서만 빼는 것들:
      //  - backdrop-filter 는 foreignObject 안에서 화면 전체를 뭉갠다
      //  - animation 은 정지 스냅샷에서 0% 키프레임(대개 opacity:0)으로 굳어 버린다
      let safeCss = css
        .replace(/backdrop-filter\s*:[^;}]*;?/g, '')
        .replace(/-webkit-backdrop-filter\s*:[^;}]*;?/g, '')
        .replace(/[^-\w]animation(-\w+)?\s*:[^;}]*;?/g, ' ')
      // CSS 안의 url(/img/...) 도 foreignObject 에서는 못 불러온다. 같이 구워 넣는다.
      // 단 '지금 화면에 실제로 쓰이는 것' 만. 시작 화면처럼 이미 사라진 화면의
      // 큰 그림까지 구워 넣으면 data URL 한도를 넘겨 합성이 통째로 실패한다.
      const used = new Set()
      for (const el of [ui, ...ui.querySelectorAll('*')]) {
        const bg = getComputedStyle(el).backgroundImage
        if (!bg || bg === 'none') continue
        for (const u of bg.matchAll(/url\(["']?(\/[^)"']+)["']?\)/g)) used.add(u[1])
      }
      for (const m of [...used]) {
        try {
          const blob = await (await fetch(m)).blob()
          const uri = await new Promise(ok => {
            const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob)
          })
          safeCss = safeCss.split(m).join(uri)
        } catch { /* 못 가져오면 그냥 둔다 */ }
      }
      safeCss = safeCss.replace(/&/g, '&amp;')
      const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${innerWidth}px;height:${innerHeight}px">
        <style>${safeCss}</style>${body}</div>`
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${innerWidth}" height="${innerHeight}">
        <foreignObject width="100%" height="100%">${html}</foreignObject></svg>`
      // blob: 로 넘기면 캔버스가 오염돼 toDataURL 이 막힌다. data: 여야 한다.
      const img = new Image()
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      })
      g2.drawImage(img, 0, 0, w, h)
    } catch (err) {
      console.warn('[shot] HUD 합성 실패, 3D 만 담는다:', err)
    }

    const r = await fetch('/__shot', {
      method: 'POST',
      body: JSON.stringify({ name, data: out.toDataURL('image/png') }),
    })
    return r.json()
  }
}
