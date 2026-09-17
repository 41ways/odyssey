import { clamp } from '../core/math.js'
import { TUNING } from '../player/player.js'

const CSS = `
#hud { position:absolute; inset:0; pointer-events:none;
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif; color:#e9e2d6; }
#hud .bottom { position:absolute; left:50%; bottom:34px; transform:translateX(-50%);
  display:flex; flex-direction:column; align-items:center; gap:10px; }
#hud .hp { width:360px; height:20px; background:#160f0e; border:2px solid #3a2a22;
  border-radius:3px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,.6); position:relative; }
#hud .hp i { position:absolute; inset:0; transform-origin:left center; display:block;
  background:linear-gradient(180deg,#e85b45,#a52c22); transition:transform .08s linear; }
#hud .hp b { position:absolute; inset:0; transform-origin:left center; display:block;
  background:#f5d7a0; opacity:.5; transition:transform .5s cubic-bezier(.2,.7,.3,1) .12s; }
#hud .hp span { position:absolute; inset:0; display:grid; place-items:center;
  font-size:12px; font-weight:700; letter-spacing:.04em; text-shadow:0 1px 3px #000; }
#hud .xp { width:360px; height:5px; background:#141018; border:1px solid #2b2436;
  border-radius:3px; overflow:hidden; position:relative; }
#hud .xp i { display:block; height:100%; width:100%; transform-origin:left center;
  background:linear-gradient(90deg,#4b8fd0,#9fe0ff); transition:transform .18s ease-out; }
#hud .lv { position:absolute; left:-46px; top:-7px; font-size:12px; font-weight:800;
  color:#9fe0ff; letter-spacing:.06em; }
#hud .pips { display:flex; gap:8px; }
#hud .pip { width:52px; height:7px; border-radius:4px; background:#1d1712;
  border:1px solid #3a2f26; overflow:hidden; }
#hud .pip i { display:block; height:100%; width:100%; transform-origin:left center;
  background:linear-gradient(90deg,#5aa8ff,#9ad4ff); }
#hud .pip.empty i { background:#3a4a5e; }
#hud .keys { position:absolute; left:20px; bottom:20px; font-size:12px; line-height:1.8;
  color:#8b8378; letter-spacing:.02em; }
#hud .keys .grown { color:#c8a16a; margin-top:4px; font-size:11.5px; letter-spacing:.03em; }
#hud .keys kbd { background:#221b16; border:1px solid #3d332b; border-radius:4px;
  padding:1px 6px; color:#d8cdbd; font-family:inherit; font-size:11px; }
#hud .stats { position:absolute; right:18px; top:16px; font-size:12px; text-align:right;
  color:#7d7568; font-variant-numeric:tabular-nums; line-height:1.7; }
#hud .stats b { color:#e8c98a; font-size:22px; font-weight:800; }
#hud .dead { position:absolute; inset:0; display:grid; place-items:center;
  background:rgba(10,4,4,.72); opacity:0; transition:opacity .6s; }
#hud .dead.on { opacity:1; }
#hud .dead p { font-size:52px; font-weight:800; letter-spacing:.34em; color:#c0392b;
  text-shadow:0 4px 30px #000; }
`

export class Hud {
  constructor(root) {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    const el = document.createElement('div')
    el.id = 'hud'
    el.innerHTML = `
      <div class="bottom">
        <div class="hp"><b></b><i></i><span></span></div>
        <div class="xp"><i></i><span class="lv">Lv 1</span></div>
        <div class="pips"></div>
      </div>
      <div class="keys">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동 &nbsp; <kbd>마우스</kbd> 조준</div>
        <div><kbd>좌클릭</kbd> 칼 (3타) &nbsp; <kbd>우클릭</kbd> 활 (꾹 눌러 차징) &nbsp; <kbd>Space</kbd> 구르기</div>
        <div class="grown"></div>
      </div>
      <div class="stats">
        <div>누적 피해</div><b class="dmg">0</b>
        <div class="fps">— fps</div>
      </div>
      <div class="dead"><p>죽음</p></div>`
    root.appendChild(el)

    this.hpFill = el.querySelector('.hp i')
    this.hpGhost = el.querySelector('.hp b')
    this.hpText = el.querySelector('.hp span')
    this.pips = el.querySelector('.pips')
    this.dmgEl = el.querySelector('.dmg')
    this.xpFill = el.querySelector('.xp i')
    this.lvEl = el.querySelector('.lv')
    this.statsEl = el.querySelector('.keys .grown')
    this.fpsEl = el.querySelector('.fps')
    this.deadEl = el.querySelector('.dead')

    this.pipEls = []
    this._fpsAcc = 0
    this._fpsN = 0
  }

  setCharges(n) {
    while (this.pipEls.length < n) {
      const d = document.createElement('div')
      d.className = 'pip'
      d.innerHTML = '<i></i>'
      this.pips.appendChild(d)
      this.pipEls.push(d)
    }
  }

  update(player, { totalDamage, dt, xp = 0, xpNeed = 1, level = 1 }) {
    const k = clamp(player.hp / player.maxHp, 0, 1)
    this.hpFill.style.transform = `scaleX(${k})`
    this.hpGhost.style.transform = `scaleX(${k})`
    this.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`

    this.setCharges(TUNING.roll.charges)
    for (let i = 0; i < this.pipEls.length; i++) {
      const filled = i < player.rollCharges
      const charging = i === player.rollCharges && player.rollCharges < TUNING.roll.charges
      this.pipEls[i].classList.toggle('empty', !filled)
      const f = this.pipEls[i].firstChild
      f.style.transform = `scaleX(${filled ? 1 : charging ? (player.rollTimer / TUNING.roll.regen) : 0})`
    }

    this.xpFill.style.transform = `scaleX(${clamp(xp / xpNeed, 0, 1)})`
    this.lvEl.textContent = `Lv ${level}`

    // 모은 스탯을 계속 보여준다. 성장이 눈에 보여야 고르는 재미가 산다.
    const st = player.stats
    const pct = v => `${Math.round((v - 1) * 100)}%`
    const parts = []
    if (st.moveSpeed > 1.001) parts.push(`이동 +${pct(st.moveSpeed)}`)
    if (st.actionRate > 1.001) parts.push(`공속 +${pct(st.actionRate)}`)
    if (st.drawRate > 1.001) parts.push(`차징 +${pct(st.drawRate)}`)
    if (st.rollRegen > 1.001) parts.push(`충전 +${pct(st.rollRegen)}`)
    if (st.meleeDamage > 1.001) parts.push(`칼 +${pct(st.meleeDamage)}`)
    if (st.rangedDamage > 1.001) parts.push(`활 +${pct(st.rangedDamage)}`)
    if (st.meleeRange > 1.001) parts.push(`사거리 +${pct(st.meleeRange)}`)
    const line = parts.join(' · ')
    if (line !== this._statLine) { this.statsEl.textContent = line; this._statLine = line }

    this.dmgEl.textContent = Math.round(totalDamage).toLocaleString('ko-KR')

    this._fpsAcc += dt; this._fpsN++
    if (this._fpsAcc >= 0.5) {
      this.fpsEl.textContent = `${Math.round(this._fpsN / this._fpsAcc)} fps`
      this._fpsAcc = 0; this._fpsN = 0
    }

    this.deadEl.classList.toggle('on', player.dead)
  }
}
