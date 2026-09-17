import * as THREE from 'three'
import { World } from './render/world.js'
import { Fx } from './render/fx.js'
import { Input } from './core/input.js'
import { createLoop } from './core/loop.js'
import { Projectiles } from './combat/projectile.js'
import { separate } from './combat/actor.js'
import { Player } from './player/player.js'
import { kikonesWarrior, kikonesArcher, dummy } from './enemy/kikones.js'
import { Hud } from './ui/hud.js'
import { LevelUp } from './ui/levelup.js'
import { Pickups } from './combat/pickup.js'
import { rollChoices, newStats, newlyUnlocked, TIERS } from './player/stats.js'
import { ISMAROS, WaveRunner } from './stage/ismaros.js'
import { KIT, kitProgress } from './player/gear.js'
import { models } from './render/models.js'
import { preloadCharacter } from './render/character.js'
import { rand } from './core/math.js'

/**
 * 이스마로스 — 첫 판.
 * 아직 로그라이크도 스테이지도 없다. 이동 / 구르기 / 칼 / 활의 손맛만 본다.
 * 여기가 재미없으면 보스 아홉 마리를 만들어도 소용없다.
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
    this.levelUp = new LevelUp(uiRoot)

    this.kills = 0
    this.paused = false
    this.taken = new Map()          // 고른 선택지와 횟수. 등급 해금의 근거
    this.stage = ISMAROS
    this.waves = new WaveRunner(ISMAROS, this)

    this.enemies = []
    this.corpses = []
    this.totalDamage = 0

    // 바닥 조준점. 커서를 숨겼으니 이게 커서다.
    this.reticle = new THREE.Group()
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.3, 24),
      new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
    )
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 12),
      new THREE.MeshBasicMaterial({ color: '#fff4dd', transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
    )
    this.reticle.add(ring, dot)
    this.reticle.rotation.x = -Math.PI / 2
    this.reticle.position.y = 0.05
    this.reticle.renderOrder = 20
    this.render3d.scene.add(this.reticle)

    this.player = new Player(this, this.input, this.fx, this.projectiles)
    this.player.pos.set(0, 0, 6)
    this.render3d.scene.add(this.player.group)
    this.render3d.camTarget.copy(this.player.pos)

    this.hud.banner(ISMAROS.name, ISMAROS.intro, 3.4)

    addEventListener('keydown', e => {
      if (e.code === 'KeyR') this.reset()                       // 다시 시작
      if (e.code === 'KeyQ') this.spawnEnemy('warrior')         // 시험용 추가 소환
    })

    this.loop = createLoop({
      update: dt => this.update(dt),
      render: () => this.draw(),
      fx: real => { this.fx.update(real); this._real = real },
    })
    this.loop.start()
  }

  track(enemy) {
    enemy.onHurt = d => { this.totalDamage += d }
    if (!enemy.isDummy) {
      const die = enemy.die.bind(enemy)
      enemy.die = () => {
        const wasBurning = !!enemy.burn
        die()
        this.kills++
        // 옮아붙는 불 — 불타 죽으면 주위로 번진다
        if (wasBurning && this.player.stats.burn >= 2) this.#spreadFire(enemy)
        // 이번 처치로 장비가 열리면 시체 자리에 전리품을 떨군다
        const piece = KIT.find(k => k.kills === this.kills)
        if (piece) this.pickups.drop(enemy.pos.x, enemy.pos.z, piece, { color: '#ffd27a' })
      }
    }
    this.enemies.push(enemy)
    this.render3d.scene.add(enemy.group)
    return enemy
  }

  /** 불이 번진다. 죽은 자리 주위의 적에게 옮아붙는다. */
  #spreadFire(from) {
    const R = 3.4
    this.fx.ring(from.pos.x, from.pos.z, { color: '#ff7a2a', radius: R * 1.2, life: 0.5 })
    for (const e of this.enemies) {
      if (e.dead || e.isDummy) continue
      if (Math.hypot(e.pos.x - from.pos.x, e.pos.z - from.pos.z) > R) continue
      e.ignite({ dps: 7 * this.player.stats.meleeDamage, seconds: 3.5, level: this.player.stats.burn })
    }
  }

  /** 플레이어 반대편 가장자리에서 들어온다. 등 뒤에 갑자기 생기면 억울하다. */
  spawnEnemy(kind = 'warrior') {
    const p = this.player.pos
    const away = Math.atan2(-p.x, -p.z) + rand(-1.1, 1.1)
    const r = this.arenaRadius - rand(0.6, 2.2)
    const make = kind === 'archer' ? kikonesArcher : kikonesWarrior
    const e = make(this, this.fx)
    e.pos.set(Math.sin(away) * r, 0, Math.cos(away) * r)
    e.facing = Math.atan2(p.x - e.pos.x, p.z - e.pos.z)
    this.fx.ring(e.pos.x, e.pos.z, { color: '#c2705e', radius: 1.6, life: 0.45 })
    return this.track(e)
  }

  onWaveSay(text) { this.hud.toast(text) }

  onStageClear(stage) {
    this.hud.banner(`${stage.name} 통과`, stage.clear, 4.5)
  }

  reset() {
    for (const e of this.enemies) this.render3d.scene.remove(e.group)
    for (const c of this.corpses) this.render3d.scene.remove(c.group)
    this.enemies.length = 0
    this.corpses.length = 0
    this.totalDamage = 0
    this.pickups.clear()
    this.projectiles.clear()
    this.kills = 0
    this.taken.clear()
    this.waves.reset()
    this.player.gear.reset()
    this.player.stats = newStats()
    this.player.applyStats()
    this.player._echo = null
    const p = this.player
    p.hp = p.maxHp; p.dead = false; p.rollCharges = 3; p.rolling = 0
    p.stagger = 0; p.invuln = 0; p.action.stop()
    p.pos.set(0, 0, 6); p.vel.set(0, 0, 0)
    this.hud.banner(this.stage.name, this.stage.intro, 3.0)
  }

  update(dt) {
    if (this.paused) return
    // 히트스톱: 시뮬레이션만 멈춘다. 연출은 실시간으로 계속 흐른다.
    if (this.fx.hitstop > 0) return

    this.waves.update(dt)

    this.input.update(dt)
    const aim = this.input.updateAim()

    this.player.update(dt, aim)

    for (const e of this.enemies) {
      e.think(dt)
      e.step(dt, this.arenaRadius)
    }

    const all = [this.player, ...this.enemies]
    separate(all, dt)
    this.projectiles.update(dt, all, this.arenaRadius)

    const looted = this.pickups.update(dt, this.player)
    if (looted.length && !this.player.dead) this.openLoot(looted)

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

  /** 전리품을 입고 성장 선택지를 고른다. 고를 때까지 시간을 멈춘다. */
  async openLoot(pieces) {
    if (this.paused) return
    this.paused = true
    this.input.held.clear()
    this.input.buffer.clear()
    this._queue = (this._queue ?? []).concat(pieces)
    while (this._queue.length) {
      const piece = this._queue.shift()
      this.player.equip(piece.id)
      this.fx.ring(this.player.pos.x, this.player.pos.z, { color: '#ffd27a', radius: 3.6, life: 0.6 })
      const before = new Map(this.taken)
      const pick = await this.levelUp.show({
        heading: piece.name, sub: piece.line,
        choices: rollChoices(3, this.taken),
        unlocked: this._pendingUnlocks ?? [],
        tiers: TIERS,
      })
      this._pendingUnlocks = null
      this.taken.set(pick.id, (this.taken.get(pick.id) ?? 0) + 1)
      pick.apply(this.player.stats)
      this.player.applyStats()
      // 이번 선택으로 윗등급이 열렸으면 다음 화면에서 알려 준다
      const opened = newlyUnlocked(before, this.taken)
      if (opened.length) this._pendingUnlocks = opened
      this.fx.ring(this.player.pos.x, this.player.pos.z, { color: '#9fe0ff', radius: 3.0, life: 0.5 })
    }
    this.paused = false
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
      kills: this.kills, kit: kitProgress(this.kills), stage: this.stage,
    })
  }
}

// 있는 모델만 먼저 받아 둔다. 없으면 코드 인체로 돌아가므로 게임은 항상 시작된다.
await Promise.all([models.preload(), preloadCharacter()])
const game = new Game(document.getElementById('app'), document.getElementById('ui'))
// 튜닝용 핸들. 콘솔에서 __game.player.pos 같은 걸 바로 만질 수 있다.
window.__game = game
