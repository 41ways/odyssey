import * as THREE from 'three'
import { World } from './render/world.js'
import { Fx } from './render/fx.js'
import { Input } from './core/input.js'
import { createLoop } from './core/loop.js'
import { Projectiles } from './combat/projectile.js'
import { Particles } from './render/particles.js'
import { separate } from './combat/actor.js'
import { Player } from './player/player.js'
import { kikonesWarrior, kikonesArcher, circePig } from './enemy/kikones.js'
import { Hud } from './ui/hud.js'
import { TitleScreen } from './ui/title.js'
import { EquipCard } from './ui/equipcard.js'
import { StagePicker } from './ui/stagepicker.js'
import { STAGES } from './stage/stages.js'
import { LOOKS, LOOK_KEYS } from './render/looks.js'
import { LevelUp } from './ui/levelup.js'
import { Pickups } from './combat/pickup.js'
import { rollChoices, newStats, newlyUnlocked, TIERS, UPGRADES } from './player/stats.js'
import { KIT, kitProgress } from './player/gear.js'
import { Run } from './stage/run.js'
import { RELICS } from './stage/stages.js'
import { RelicScreen } from './ui/relic.js'
import { startUnderworldIntro } from './stage/underworld.js'
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
    this.particles = new Particles(this.render3d.scene)
    this.projectiles = new Projectiles(this.render3d.scene, this.fx, this.particles)
    this.pickups = new Pickups(this.render3d.scene, this.fx)
    this.hud = new Hud(uiRoot)
    this.hud.setUpgradePool([...UPGRADES, ...RELICS])
    this.levelUp = new LevelUp(uiRoot)
    this.equipCard = new EquipCard(uiRoot)
    this.relicScreen = new RelicScreen(uiRoot)
    this.uiRoot = uiRoot
    this.cutscene = null
    this.equipFx = null

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
      if (e.code === 'KeyL') this.cycleLook()          // 시험용: 톤 시안 돌려보기
    })

    // 스테이지 고르기 — Tab 또는 주소의 ?stage=N
    this.picker = new StagePicker(uiRoot, STAGES, (i, o) => this.jumpTo(i, o))

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
    this.render3d.look = LOOKS[q.get('look')] ? q.get('look') : 'souls'
    this.paused = true
    new TitleScreen(uiRoot).wait().then(() => { this.paused = false; this.jumpTo(startAt, { bare }) })
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
    this.particles.clear()
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

  /** 저승으로 걸어 들어간다. 끝나면 유물 화면이 열린다. */
  playCutscene(make) {
    return new Promise(resolve => {
      this.#freeze()
      this.cutscene = { run: make(this), done: resolve }
    })
  }

  #driveCutscene(dt) {
    const c = this.cutscene
    if (!c) return
    if (c.run.tick(dt)) {
      c.run.dispose()
      this.cutscene = null
      c.done()
    }
  }

  async chooseRelic(relics) {
    await this.playCutscene(startUnderworldIntro)
    const pick = await this.relicScreen.show({
      name: '아가멤논', title: '뮈케네의 왕이었던 것',
      said: '나는 내 집 문턱에서 죽었다. <em>스무 해를 싸우고</em> 돌아가 아내의 손에.<br>'
        + '너도 돌아갈 셈이냐. 그렇다면 <em>하나만 가져가라</em> — 들고 갈 수 있는 건 하나뿐이다.',
      relics,
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

  /**
   * 시험용 — 아무 판이나 그 자리에서 연다.
   *
   * 맨몸 레벨1 로 900 체력짜리 보스를 만나면 체험이 안 된다.
   * 그 지점까지 왔다면 가졌을 만큼을 쥐여 주고 시작한다.
   */
  async jumpTo(index, { bare = false } = {}) {
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
      // 성장은 판마다 두 장씩. 한 계열로 몰아 줘서 등급도 열리게 한다
      const picks = Math.min(index * 2, 12)
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

    await this.run.start(index)
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
    this.projectiles.update(dt, all, this.arenaRadius, this.render3d.camera)
    this.particles.update(dt)

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
      this.paused = true
      const meshes = this.player.equip(piece.id)
      await this.presentGear(piece, meshes)
      this.paused = false
      await this.offerUpgrade(piece.name, piece.line)
    }
  }

  draw() {
    const real = this._real ?? 1 / 60
    this.#driveCutscene(real)
    this.#driveEquipFx(real)
    const cam = this.render3d.camera
    if (this.cutscene) this.player.updateVisualOnly(real)
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
      stage: this.run.view, index: this.run.index, count: STAGES.length,
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

      // outerHTML 은 <br> 처럼 안 닫힌 태그를 그대로 뱉어서 XML 파서가 거부한다.
      // XMLSerializer 는 XML 로 맞춰 준다.
      const body = new XMLSerializer().serializeToString(ui)
      imgs.forEach((im, i) => { if (saved[i]) im.setAttribute('src', saved[i]) })
      // 캡처에서만 빼는 것들:
      //  - backdrop-filter 는 foreignObject 안에서 화면 전체를 뭉갠다
      //  - animation 은 정지 스냅샷에서 0% 키프레임(대개 opacity:0)으로 굳어 버린다
      const safeCss = css
        .replace(/backdrop-filter\s*:[^;}]*;?/g, '')
        .replace(/-webkit-backdrop-filter\s*:[^;}]*;?/g, '')
        .replace(/[^-\w]animation(-\w+)?\s*:[^;}]*;?/g, ' ')
        .replace(/&/g, '&amp;')
      const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${innerWidth}px;height:${innerHeight}px">
        <style>${safeCss}</style>${body}</div>`
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${innerWidth}" height="${innerHeight}">
        <foreignObject width="100%" height="100%">${html}</foreignObject></svg>`
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
