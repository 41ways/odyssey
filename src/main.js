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
import { rollChoices, newStats } from './player/stats.js'
import { KIT, kitProgress } from './player/gear.js'
import { models } from './render/models.js'
import { preloadCharacter } from './render/character.js'
import { rand } from './core/math.js'

/**
 * 0단계 — 전투 코어 시험장.
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

    this.spawnDummy()
    this.spawnWave()

    addEventListener('keydown', e => {
      if (e.code === 'KeyR') this.reset()        // 다시 시작
      if (e.code === 'KeyQ') this.spawnWave()   // 적 추가 소환
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
        die()
        this.kills++
        // 이번 처치로 장비가 열리면 시체 자리에 전리품을 떨군다
        const piece = KIT.find(k => k.kills === this.kills)
        if (piece) this.pickups.drop(enemy.pos.x, enemy.pos.z, piece, { color: '#ffd27a' })
      }
    }
    this.enemies.push(enemy)
    this.render3d.scene.add(enemy.group)
    return enemy
  }

  spawnDummy() {
    const d = dummy(this, this.fx)
    d.pos.set(0, 0, -6)
    this.track(d)
  }

  spawnWave() {
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2)
      const e = kikonesWarrior(this, this.fx)
      e.pos.set(Math.sin(a) * rand(9, 13), 0, Math.cos(a) * rand(9, 13))
      this.track(e)
    }
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2)
      const e = kikonesArcher(this, this.fx)
      e.pos.set(Math.sin(a) * 13, 0, Math.cos(a) * 13)
      this.track(e)
    }
  }

  reset() {
    for (const e of this.enemies) this.render3d.scene.remove(e.group)
    for (const c of this.corpses) this.render3d.scene.remove(c.group)
    this.enemies.length = 0
    this.corpses.length = 0
    this.totalDamage = 0
    this.pickups.clear()
    this.kills = 0
    this.player.gear.reset()
    this.player.stats = newStats()
    this.player.applyStats()
    const p = this.player
    p.hp = p.maxHp; p.dead = false; p.rollCharges = 3; p.rolling = 0
    p.stagger = 0; p.invuln = 0; p.action.stop()
    p.pos.set(0, 0, 6); p.vel.set(0, 0, 0)
    this.spawnDummy()
    this.spawnWave()
  }

  update(dt) {
    if (this.paused) return
    // 히트스톱: 시뮬레이션만 멈춘다. 연출은 실시간으로 계속 흐른다.
    if (this.fx.hitstop > 0) return

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
      const pick = await this.levelUp.show({
        heading: piece.name, sub: piece.line, choices: rollChoices(3),
      })
      pick.apply(this.player.stats)
      this.player.applyStats()
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
      kills: this.kills, kit: kitProgress(this.kills),
    })
  }
}

// 있는 모델만 먼저 받아 둔다. 없으면 코드 인체로 돌아가므로 게임은 항상 시작된다.
await Promise.all([models.preload(), preloadCharacter()])
const game = new Game(document.getElementById('app'), document.getElementById('ui'))
// 튜닝용 핸들. 콘솔에서 __game.player.pos 같은 걸 바로 만질 수 있다.
window.__game = game
