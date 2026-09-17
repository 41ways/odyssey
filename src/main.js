import * as THREE from 'three'
import { World, CAMERA_RIG } from './render/world.js'
import { Fx } from './render/fx.js'
import { Input } from './core/input.js'
import { createLoop } from './core/loop.js'
import { Projectiles } from './combat/projectile.js'
import { Particles } from './render/particles.js'
import { separate } from './combat/actor.js'
import { Player } from './player/player.js'
import { kikonesWarrior, kikonesArcher, kikonesShield, circePig, circeWolf } from './enemy/kikones.js'
import { Hud } from './ui/hud.js'
import { meanderURI } from './ui/theme.js'
import { TitleScreen } from './ui/title.js'
import { DifficultyScreen, SAILS } from './ui/difficulty.js'
import { EquipCard } from './ui/equipcard.js'
import { StagePicker } from './ui/stagepicker.js'
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
import { rollBlessings } from './player/blessings.js'
import { models } from './render/models.js'
import { preloadCharacter } from './render/character.js'
import { rand } from './core/math.js'

const MINIONS = { warrior: kikonesWarrior, archer: kikonesArcher, shield: kikonesShield,
  pig: circePig, wolf: circeWolf }

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
    this.blessScreen = new BlessingScreen(uiRoot)
    this.interlude = new Interlude(uiRoot)
    this.blessed = new Set()
    this.uiRoot = uiRoot
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
    this.setGod(q.get('god') !== '0')       // 지금은 기본 켜짐

    this.paused = true
    this.sail = SAILS[1]                   // 고르기 전까지는 '이야기대로'
    this.title = new TitleScreen(uiRoot)
    this.diffScreen = new DifficultyScreen(uiRoot)
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
    const deep = Math.max(0, this.run?.index ?? 0)
    const curve = enemy.isBoss ? 1 + deep * 0.10 : 1 + deep * 0.17
    const mul = (this.sail?.hpMul ?? 1) * curve
    if (mul !== 1) { enemy.maxHp = Math.round(enemy.maxHp * mul); enemy.hp = enemy.maxHp }
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
      heading, sub, choices: rollChoices(this.player.stats.choiceCount ?? 3, this.taken, [], this.player.stats.unlockEase ?? 0),
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
    await this.playInterlude(UNDERWORLD_CUT)
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
  async playInterlude(spec, { keepOpen = false } = {}) {
    this.#freeze()
    await this.interlude.play({ ...spec, keepOpen })
    if (!keepOpen) this.#thaw()
  }

  /**
   * 아테나의 은총. 보스를 눕힐 때마다 한 번.
   * 성장 선택지보다 훨씬 세다 — 판 하나를 넘긴 값이 수치 몇 퍼센트여서는 안 된다.
   */
  async grantBlessing(stage) {
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
      choices: rollBlessings(this.blessed),
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

  async chooseRelic(relics) {
    await this.playInterlude(UNDERWORLD_CUT, { keepOpen: true })
    const pick = await this.relicScreen.show({
      name: '아가멤논', title: '미케네 3대 국왕',
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
      if (say) this.hud.toast(say, 4)
      return
    }
    const worn = this._beggarWorn ?? []
    this._beggarWorn = null
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
    this.#driveSettle(real)
    this.#driveEquipFx(real)
    const cam = this.render3d.camera
    this.player.sync(cam)
    for (const e of this.enemies) e.sync(cam)
    for (const c of this.corpses) { c.sync(cam); c.group.position.y = -Math.min(c.deathT / 0.45, 1) * 1.6 }
    this.reticle.position.set(this.input.aim.x, 0.05, this.input.aim.z)
    this.reticle.visible = this.input.pointerInside
    // 연출 중에는 카메라가 다른 것을 본다
    this.render3d.updateCamera(this.camFocus ?? this.player.pos,
      this.camFocus ? null : (this.input.pointerInside ? this.input.aim : null),
      this._real ?? 1 / 60)
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
