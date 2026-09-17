import * as THREE from 'three'
import { World } from './render/world.js'
import { Fx } from './render/fx.js'
import { Input } from './core/input.js'
import { createLoop } from './core/loop.js'
import { Projectiles } from './combat/projectile.js'
import { separate } from './combat/actor.js'
import { Player } from './player/player.js'
import { kikonesWarrior, kikonesArcher, circePig } from './enemy/kikones.js'
import { Hud } from './ui/hud.js'
import { LevelUp } from './ui/levelup.js'
import { Pickups } from './combat/pickup.js'
import { rollChoices, newStats, newlyUnlocked, TIERS, UPGRADES } from './player/stats.js'
import { KIT, kitProgress } from './player/gear.js'
import { Run } from './stage/run.js'
import { RELICS } from './stage/stages.js'
import { models } from './render/models.js'
import { preloadCharacter } from './render/character.js'
import { rand } from './core/math.js'

const MINIONS = { warrior: kikonesWarrior, archer: kikonesArcher, pig: circePig }

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
    this.fx = new Fx(this.render3d, uiRoot)
    this.input = new Input(this.render3d.canvas, this.render3d.camera)
    this.projectiles = new Projectiles(this.render3d.scene, this.fx)
    this.pickups = new Pickups(this.render3d.scene, this.fx)
    this.hud = new Hud(uiRoot)
    this.hud.setUpgradePool([...UPGRADES, ...RELICS])
    this.levelUp = new LevelUp(uiRoot)

    this.enemies = []
    this.corpses = []
    this.totalDamage = 0
    this.kills = 0
    this.paused = false
    this.taken = new Map()

    this.reticle = makeReticle()
    this.render3d.scene.add(this.reticle)

    this.player = new Player(this, this.input, this.fx, this.projectiles)
    this.render3d.scene.add(this.player.group)
    this.render3d.camTarget.copy(this.player.pos)

    this.run = new Run(this)

    addEventListener('keydown', e => {
      if (e.code === 'KeyR') this.restart()
      if (e.code === 'BracketRight') this.run.next()   // 시험용: 다음 판으로
    })

    this.loop = createLoop({
      update: dt => this.update(dt),
      render: () => this.draw(),
      fx: real => { this.fx.update(real); this._real = real },
    })
    this.loop.start()
    this.run.start()
  }

  /* ── 필드 ─────────────────────────────────────────────── */

  track(enemy) {
    enemy.onHurt = d => { this.totalDamage += d }
    if (!enemy.isDummy) {
      const die = enemy.die.bind(enemy)
      enemy.die = () => {
        const wasBurning = !!enemy.burn
        die()
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
    const r = Math.min(Math.hypot(x, z), this.arenaRadius - 1.5)
    const a = Math.atan2(x, z)
    e.pos.set(Math.sin(a) * r, 0, Math.cos(a) * r)
    e.facing = Math.atan2(this.player.pos.x - e.pos.x, this.player.pos.z - e.pos.z)
    this.fx.ring(e.pos.x, e.pos.z, { color: '#c2705e', radius: 1.6, life: 0.45 })
    return this.track(e)
  }

  /** 웨이브용 — 늘 플레이어 반대편 가장자리에서 들어온다. 등 뒤에 생기면 억울하다. */
  spawnEnemy(kind = 'warrior') {
    const p = this.player.pos
    const away = Math.atan2(-p.x, -p.z) + rand(-1.1, 1.1)
    const r = this.arenaRadius - rand(0.6, 2.2)
    return this.spawnMinion(kind, Math.sin(away) * r, Math.cos(away) * r)
  }

  clearField() {
    for (const e of this.enemies) this.render3d.scene.remove(e.group)
    for (const c of this.corpses) this.render3d.scene.remove(c.group)
    this.enemies.length = 0
    this.corpses.length = 0
    this.pickups.clear()
    this.projectiles.clear()
    this.hud.setBoss(null)
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

  async offerUpgrade(heading, sub) {
    this.#freeze()
    const before = new Map(this.taken)
    const pick = await this.levelUp.show({
      heading, sub, choices: rollChoices(3, this.taken),
      unlocked: this._pendingUnlocks ?? [], tiers: TIERS,
    })
    this._pendingUnlocks = null
    this.taken.set(pick.id, (this.taken.get(pick.id) ?? 0) + 1)
    pick.apply(this.player.stats)
    this.player.applyStats()
    const opened = newlyUnlocked(before, this.taken)
    if (opened.length) this._pendingUnlocks = opened
    this.fx.ring(this.player.pos.x, this.player.pos.z, { color: '#9fe0ff', radius: 3.0, life: 0.5 })
    this.#thaw()
    return pick
  }

  async chooseRelic(relics) {
    this.#freeze()
    const pick = await this.levelUp.show({
      heading: '아가멤논의 그림자', sub: '가져갈 것을 하나 고르라고 했다',
      choices: relics, tiers: TIERS,
    })
    pick.apply(this.player.stats)
    this.player.applyStats()
    this.hud.banner(pick.name, pick.flavor, 2.8)
    this.#thaw()
    return pick
  }

  async chooseFork(stage) {
    this.#freeze()
    const pick = await this.levelUp.show({
      heading: stage.name, sub: stage.intro,
      choices: stage.options.map(o => ({ ...o, name: o.label, desc: o.line, tag: '해협', tier: 0 })),
      tiers: TIERS,
    })
    this.#thaw()
    return pick
  }

  showCredits(damage) {
    this.hud.credits(damage, this.taken, this.run)
  }

  /* ── 진행 ─────────────────────────────────────────────── */

  restart() {
    this.clearField()
    this.kills = 0
    this.totalDamage = 0
    this.taken.clear()
    this.player.gear.reset()
    this.player.stats = newStats()
    this.player.applyStats()
    const p = this.player
    p.hp = p.maxHp; p.dead = false; p.rollCharges = 3; p.rolling = 0
    p.stagger = 0; p.invuln = 0; p.action.stop(); p._echo = null
    this.hud.hideCredits()
    this.run.start()
  }

  onWaveSay(text) { this.hud.toast(text) }
  onBossSay(text) { this.hud.toast(text, 2.8) }

  /** 키르케의 변신 마법 — 죽지는 않지만 느려진다. */
  onHex() {
    const p = this.player
    p.hexed = 5
    this.hud.toast('돼지로 변한다 — 몸이 무겁다', 2.2)
  }

  update(dt) {
    if (this.paused) return
    if (this.fx.hitstop > 0) return

    this.run.update(dt)
    this.input.update(dt)
    const aim = this.input.updateAim()

    const p = this.player
    if (p.hexed > 0) { p.hexed -= dt; if (p.hexed <= 0) p.hexed = 0 }
    p.update(dt, aim)

    if (p.dead && !this._deathHandled) {
      this._deathHandled = true
      if (!this.run.onPlayerDeath()) this.hud.banner('죽음', '다시 시작하려면 R', 9)
    }
    if (!p.dead) this._deathHandled = false

    for (const e of this.enemies) { e.think(dt); e.step(dt, this.arenaRadius) }

    const all = [p, ...this.enemies]
    separate(all, dt)
    this.projectiles.update(dt, all, this.arenaRadius)

    const looted = this.pickups.update(dt, p)
    if (looted.length && !p.dead) this.#openLoot(looted)

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

  async #openLoot(pieces) {
    if (this.paused) return
    this._queue = (this._queue ?? []).concat(pieces)
    while (this._queue.length) {
      const piece = this._queue.shift()
      this.player.equip(piece.id)
      this.fx.ring(this.player.pos.x, this.player.pos.z, { color: '#ffd27a', radius: 3.6, life: 0.6 })
      await this.offerUpgrade(piece.name, piece.line)
    }
  }

  draw() {
    const cam = this.render3d.camera
    this.player.sync(cam)
    for (const e of this.enemies) e.sync(cam)
    for (const c of this.corpses) { c.sync(cam); c.group.position.y = -Math.min(c.deathT / 0.45, 1) * 1.6 }
    this.reticle.position.set(this.input.aim.x, 0.05, this.input.aim.z)
    this.reticle.visible = this.input.pointerInside
    this.render3d.updateCamera(this.player.pos, this.input.pointerInside ? this.input.aim : null, this._real ?? 1 / 60)
    this.render3d.render()
    this.hud.update(this.player, {
      totalDamage: this.totalDamage, dt: this._real ?? 1 / 60,
      kills: this.kills, kit: kitProgress(this.kills),
      stage: this.run.stage, index: this.run.index, count: 9,
    })
  }
}

/** 바닥 조준점. 커서를 숨겼으니 이게 커서다. */
function makeReticle() {
  const g = new THREE.Group()
  const mat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.88, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
  g.add(new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 24), mat('#ffd9a0')))
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), mat('#fff4dd')))
  g.rotation.x = -Math.PI / 2
  g.position.y = 0.05
  g.renderOrder = 20
  return g
}

await Promise.all([models.preload(), preloadCharacter()])
const game = new Game(document.getElementById('app'), document.getElementById('ui'))
window.__game = game
