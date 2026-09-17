import { clamp } from '../core/math.js'
import { TUNING } from '../player/player.js'
import { installTheme, meanderURI } from './theme.js'

const MEANDER = meanderURI('#c8973e', 0.9)

const CSS = `
#hud { position:absolute; inset:0; pointer-events:none;
  font-family:var(--body); color:var(--ivory); }
#hud .bottom { position:absolute; left:50%; bottom:34px; transform:translateX(-50%);
  display:flex; flex-direction:column; align-items:center; gap:10px; }
/* 체력 — 청동 판에 박아 넣은 도기 띠.
   테두리 하나로 끝내면 브라우저 진행바처럼 보인다. 판을 깔고, 뇌문을 얹고,
   네 귀에 못을 박고, 홈 안에 테라코타를 채운다. */
#hud .hpwrap { position:relative; padding:7px 9px 8px; border-radius:3px;
  background:linear-gradient(180deg,#4a3d27 0%,#33291a 34%,#241c11 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,225,165,.32), inset 0 -1px 0 rgba(0,0,0,.6),
    inset 0 0 0 1px rgba(232,200,132,.22),
    0 10px 30px rgba(0,0,0,.75); }
/* 위아래로 뇌문 한 줄씩 — 얇게, 배경으로만 */
#hud .hpwrap::before, #hud .hpwrap::after { content:''; position:absolute; left:10px; right:10px;
  height:6px; background-image:${MEANDER}; background-repeat:repeat-x;
  background-size:auto 6px; background-position:center; opacity:.34; pointer-events:none; }
#hud .hpwrap::before { top:0.5px; }
#hud .hpwrap::after { bottom:0.5px; transform:scaleY(-1); }
/* 네 귀의 못 */
#hud .rivet { position:absolute; width:5px; height:5px; border-radius:50%;
  background:radial-gradient(circle at 35% 30%, #ffe6b4, #a3843f 55%, #4a3a1c 100%);
  box-shadow:0 1px 1px rgba(0,0,0,.8); }
#hud .rivet.tl { left:3px; top:3px } #hud .rivet.tr { right:3px; top:3px }
#hud .rivet.bl { left:3px; bottom:3px } #hud .rivet.br { right:3px; bottom:3px }

#hud .hp { width:368px; height:19px; position:relative; overflow:hidden; border-radius:1px;
  background:linear-gradient(180deg,#0d0a07,#17120c);
  box-shadow:inset 0 2px 5px rgba(0,0,0,.9), inset 0 0 0 1px rgba(0,0,0,.8),
             0 0 0 1px rgba(232,200,132,.28); }
#hud .hp i { position:absolute; inset:0; transform-origin:left center; display:block;
  background:
    linear-gradient(180deg, rgba(255,210,170,.5) 0 2px, transparent 2px),
    linear-gradient(180deg,#d8583a 0%,#a6321f 46%,#6a1610 100%);
  transition:transform .08s linear; }
/* 맞은 만큼은 상아색으로 잠깐 남았다가 따라 내려온다 — 얼마나 깎였는지 보인다 */
#hud .hp b { position:absolute; inset:0; transform-origin:left center; display:block;
  background:#f5d7a0; opacity:.42; transition:transform .5s cubic-bezier(.2,.7,.3,1) .12s; }
#hud .hp span { position:absolute; inset:0; display:grid; place-items:center;
  font-family:var(--serif); font-size:11.5px; font-weight:700; letter-spacing:.12em;
  font-variant-numeric:tabular-nums; text-shadow:0 1px 3px #000, 0 0 10px rgba(0,0,0,.9); }
/* 얼마 안 남으면 판 전체가 달아오른다 */
#hud .hpwrap.low { box-shadow:
    inset 0 1px 0 rgba(255,225,165,.32), inset 0 -1px 0 rgba(0,0,0,.6),
    inset 0 0 0 1px rgba(255,120,80,.5),
    0 10px 30px rgba(0,0,0,.75), 0 0 34px rgba(200,60,30,.4); }
#hud .hpwrap.low .hp i { background:
    linear-gradient(180deg, rgba(255,220,180,.6) 0 2px, transparent 2px),
    linear-gradient(180deg,#ff7a4a 0%,#c23a1e 46%,#7a1a10 100%); }

/* 경험치 — 체력 아래 얇은 한 줄. 왼쪽에 레벨 숫자를 청동 표로 박는다.
   숫자가 막대 안에 들어가면 5px 높이에 안 들어가고, 막대 위에 얹으면
   체력바와 줄이 어긋난다. 옆에 세우는 게 제일 조용하다. */
#hud .xpwrap { display:flex; align-items:center; gap:7px; }
#hud .lvchip { flex:0 0 auto; min-width:19px; height:15px; padding:0 3px;
  display:grid; place-items:center; border-radius:2px;
  font-family:var(--serif); font-size:10.5px; font-weight:700; color:#2a1f0e;
  font-variant-numeric:tabular-nums; letter-spacing:.02em;
  background:linear-gradient(180deg,#ffe6b0,#c8973e 62%,#8a6524);
  box-shadow:inset 0 1px 0 rgba(255,246,220,.7), 0 1px 3px rgba(0,0,0,.7); }
#hud .xp { flex:1 1 auto; width:342px; height:5px; background:#0d0a07; border-radius:2px;
  overflow:hidden; position:relative;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(232,200,132,.18); }
#hud .xp i { display:block; height:100%; width:100%; transform-origin:left center;
  background:linear-gradient(90deg,var(--gold-dim),var(--gold)); transition:transform .22s ease-out; }
#hud .lv { display:block; width:368px; margin-top:4px; text-align:center;
  font-size:11px; color:#8b7a60; letter-spacing:.05em; white-space:nowrap; }

/* 구르기 — 청동 방패 세 닢. 차오르는 중인 것은 시계 방향으로 채워진다 */
#hud .pips { display:flex; gap:11px; margin-top:2px; }
#hud .pip { --k:1; position:relative; width:19px; height:19px; border-radius:50%;
  background:radial-gradient(circle at 34% 28%, #2b2317, #15100a 70%);
  box-shadow:inset 0 1px 2px rgba(0,0,0,.9), 0 0 0 1px rgba(232,200,132,.3),
             0 3px 8px rgba(0,0,0,.6); }
#hud .pip i { position:absolute; inset:2.5px; border-radius:50%; display:block;
  background:conic-gradient(from 180deg, #ffe0a2 0deg, #c8973e calc(var(--k) * 360deg),
    rgba(40,33,22,.85) calc(var(--k) * 360deg)); }
/* 가운데 청동 보스(umbo) — 방패처럼 보이게 하는 건 이 한 점이다 */
#hud .pip::after { content:''; position:absolute; left:50%; top:50%; width:6px; height:6px;
  margin:-3px 0 0 -3px; border-radius:50%;
  background:radial-gradient(circle at 34% 30%, #ffeec4, #a3843f 60%, #43340f 100%);
  box-shadow:0 1px 2px rgba(0,0,0,.8); }
#hud .pip.full { box-shadow:inset 0 1px 2px rgba(0,0,0,.9), 0 0 0 1px rgba(255,210,130,.55),
             0 3px 8px rgba(0,0,0,.6), 0 0 14px rgba(232,200,132,.35); }
#hud .pip.empty i { background:rgba(40,33,22,.85); }

#hud .keys { position:absolute; left:22px; bottom:20px; font-size:11.5px; line-height:1.9;
  color:#7d7264; letter-spacing:.02em; }
#hud .keys .grown { color:#c8a16a; margin-top:4px; font-size:11.5px; letter-spacing:.03em; }
#hud .keys .dev { margin-top:7px; font-size:10.5px; color:#5f564c; letter-spacing:.02em; }
#hud .keys .dev kbd { font-size:9.5px; padding:1px 5px; color:#8a7c66; border-color:#332b24; }
/* 조작 글리프.
   전에는 <kbd>W</kbd> 처럼 글자를 네모에 넣었다. 그건 웹 문서의 표기고,
   게임 화면에서는 키캡 그림이 눈에 훨씬 빨리 들어온다.
   threejsassets 의 Vesperfall 입력 묶음 (CREDITS.md) — 64px WebP. */
#hud .keys .k { display:inline-block; vertical-align:-0.34em;
  width:26px; height:26px; margin:0 1px;
  background-size:contain; background-repeat:no-repeat; background-position:center;
  filter:saturate(.85) brightness(1.06); }
#hud .keys .k.wasd  { width:52px; background-image:url('/img/keys/input-wasd.webp'); }
#hud .keys .k.mouse { background-image:url('/img/keys/input-mouse-left.webp'); opacity:.72; }
#hud .keys .k.lmb   { background-image:url('/img/keys/input-mouse-left.webp'); }
#hud .keys .k.rmb   { background-image:url('/img/keys/input-mouse-right.webp'); }
#hud .keys .k.space { width:46px; background-image:url('/img/keys/input-space.webp'); }

#hud .keys kbd { background:#191510; border:1px solid var(--line-dim); border-radius:2px;
  padding:1px 7px; color:var(--text); font-family:var(--serif); font-size:10.5px; letter-spacing:.06em; }
#hud .stats { position:absolute; right:20px; top:18px; font-size:11px; text-align:right;
  color:#7d7264; font-variant-numeric:tabular-nums; line-height:1.8;
  font-family:var(--serif); letter-spacing:.16em; }
#hud .stats b { color:var(--gold); font-size:25px; font-weight:700; letter-spacing:.02em;
  text-shadow:0 0 26px rgba(232,200,132,.4); }
#hud .banner { position:absolute; left:0; right:0; top:19%; text-align:center; opacity:0;
  transition:opacity .5s, transform .5s; transform:translateY(10px); pointer-events:none; }
#hud .banner.on { opacity:1; transform:none; }
#hud .banner h1 { font-family:var(--serif); font-size:46px; font-weight:700;
  letter-spacing:.28em; text-indent:.28em; color:var(--ivory);
  text-shadow:0 0 60px rgba(232,200,132,.5), 0 2px 0 #4a3a1c, 0 4px 34px rgba(0,0,0,.95); }
#hud .banner p { margin-top:14px; font-size:14px; letter-spacing:.06em; color:#b09a74; }
#hud .banner .rule { height:14px; width:min(520px,72vw); margin:16px auto 0;
  background-image:${MEANDER}; background-repeat:repeat-x; background-position:center; opacity:.4; }
#hud .toast { position:absolute; left:0; right:0; top:34%; text-align:center; opacity:0;
  transition:opacity .35s; pointer-events:none; font-family:var(--serif);
  font-size:17px; letter-spacing:.16em; color:#e0b77a; text-shadow:0 2px 18px #000; }
#hud .toast.on { opacity:1; }
#hud .wave { position:absolute; left:50%; top:20px; transform:translateX(-50%);
  font-family:var(--serif); font-size:12px; letter-spacing:.22em; color:#8f8172;
  font-variant-numeric:tabular-nums; }
#hud .wave b { color:var(--gold); font-weight:700; }
#hud .boss { position:absolute; left:50%; top:52px; transform:translateX(-50%);
  width:min(620px, 72vw); opacity:0; transition:opacity .4s; }
#hud .boss.on { opacity:1; }
#hud .boss .who { display:flex; justify-content:space-between; align-items:baseline;
  margin-bottom:6px; }
#hud .boss .who b { font-family:var(--serif); font-size:18px; font-weight:700;
  letter-spacing:.18em; color:var(--ivory); }
#hud .boss .who span { font-size:11px; letter-spacing:.16em; color:#9a8a72; }
#hud .boss .bar { height:13px; background:#120c09; border:1px solid var(--line);
  border-radius:1px; overflow:hidden; position:relative;
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.18), 0 6px 22px rgba(0,0,0,.6); }
#hud .boss .bar i { position:absolute; inset:0; transform-origin:left center; display:block;
  background:linear-gradient(180deg,#b8402c,#4f1109); transition:transform .1s linear; }
#hud .boss .bar u { position:absolute; inset:0; transform-origin:left center; display:block;
  background:#f5d7a0; opacity:.4; transition:transform .6s cubic-bezier(.2,.7,.3,1) .15s; }
#hud .boss.down .bar { border-color:#c8973e; box-shadow:inset 0 0 0 1px rgba(255,200,90,.5), 0 0 34px rgba(255,190,60,.45); }
#hud .boss .weak { margin-top:7px; text-align:center; font-family:var(--serif);
  font-size:12.5px; letter-spacing:.2em; color:#ffd166; opacity:0; transition:opacity .3s; }
#hud .boss.down .weak { opacity:1; }
#hud .boss .phases { position:absolute; inset:0; display:flex; pointer-events:none; }
#hud .boss .phases s { flex:1; border-right:1px solid rgba(0,0,0,.6); }
#hud .boss .phases s:last-child { border:0; }
#hud .credits { position:absolute; inset:0; z-index:60; display:none; place-items:center;
  background:linear-gradient(180deg, rgba(4,3,6,.95), rgba(8,5,4,.98)); }
#hud .credits.on { display:grid; }
#hud .credits .in { text-align:center; max-width:620px; padding:0 24px; animation:lvlIn .8s ease; }
#hud .credits h1 { font-family:var(--serif); font-size:38px; font-weight:700;
  letter-spacing:.34em; text-indent:.34em; color:var(--blood); margin-bottom:10px;
  text-shadow:0 0 44px rgba(168,50,42,.4); }
#hud .credits .score { font-family:var(--serif); font-size:56px; font-weight:700; color:var(--bronze);
  font-variant-numeric:tabular-nums; margin:22px 0 6px; }
#hud .credits .score small { display:block; font-family:var(--serif); font-size:11px; letter-spacing:.3em;
  color:#8b8378; font-weight:600; margin-bottom:8px; }
#hud .credits .list { margin-top:26px; text-align:left; display:flex; flex-wrap:wrap;
  gap:6px 10px; justify-content:center; }
#hud .credits .list span { font-size:12px; color:#bda87f; border:1px solid #4a3a28;
  border-radius:2px; padding:4px 10px; background:rgba(28,20,14,.6); }
#hud .credits .again { margin-top:32px; font-family:var(--serif); font-size:12px;
  letter-spacing:.3em; color:#7d7264; }
#hud .credits .band { height:14px; width:min(560px,80vw); margin:0 auto 26px;
  background-image:${MEANDER}; background-repeat:repeat-x; background-position:center; opacity:.45; }
#hud .dead { position:absolute; inset:0; z-index:40; display:grid; place-items:center;
  background:rgba(10,4,4,.72); opacity:0; transition:opacity .6s; }
#hud .dead.on { opacity:1; }
#hud .dead p { font-family:var(--serif); font-size:56px; font-weight:700;
  letter-spacing:.34em; text-indent:.34em; color:var(--blood);
  text-shadow:0 0 50px rgba(168,50,42,.4), 0 4px 30px #000; }
`

export class Hud {
  constructor(root) {
    installTheme()
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    const el = document.createElement('div')
    el.id = 'hud'
    el.innerHTML = `
      <div class="bottom">
        <div class="hpwrap">
          <i class="rivet tl"></i><i class="rivet tr"></i>
          <i class="rivet bl"></i><i class="rivet br"></i>
          <div class="hp"><b></b><i></i><span></span></div>
        </div>
        <div class="xpwrap"><b class="lvchip">1</b><div class="xp"><i></i></div></div>
        <span class="lv"></span>
        <div class="pips"></div>
      </div>
      <div class="keys">
        <div><b class="k wasd"></b> 이동 &nbsp; <b class="k mouse"></b> 조준</div>
        <div><b class="k lmb"></b> 칼 (3타) &nbsp; <b class="k rmb"></b> 활 (꾹 눌러 차징) &nbsp; <b class="k space"></b> 구르기</div>
        <div class="grown"></div>
        <div class="dev"><kbd>Tab</kbd> 판 고르기 · <kbd>L</kbd> 화면 톤 · <kbd>M</kbd> 음소거 · <kbd>]</kbd> 다음 판 · <kbd>R</kbd> 처음부터</div>
      </div>
      <div class="stats">
        <div>누적 피해</div><b class="dmg">0</b>
        <div class="fps">— fps</div>
      </div>
      <div class="wave"></div>
      <div class="boss"><div class="who"><b></b><span></span></div>
        <div class="bar"><u></u><i></i><div class="phases"></div></div>
        <div class="weak"></div></div>
      <div class="credits"><div class="in">
        <div class="band"></div>
        <h1></h1><p class="sub2"></p>
        <div class="score"><small>입힌 피해</small><em class="num"></em></div>
        <div class="list"></div>
        <div class="again">다시 시작 — R</div>
      </div></div>
      <div class="banner"><h1></h1><p></p><div class="rule"></div></div>
      <div class="toast"></div>
      <div class="dead"><p>죽음</p></div>`
    root.appendChild(el)

    this.hpWrap = el.querySelector('.hpwrap')
    this.hpFill = el.querySelector('.hp i')
    this.hpGhost = el.querySelector('.hp b')
    this.hpText = el.querySelector('.hp span')
    this.pips = el.querySelector('.pips')
    this.dmgEl = el.querySelector('.dmg')
    this.xpFill = el.querySelector('.xp i')
    this.lvChip = el.querySelector('.lvchip')
    this.lvEl = el.querySelector('.lv')
    this.statsEl = el.querySelector('.keys .grown')
    this.fpsEl = el.querySelector('.fps')
    this.deadEl = el.querySelector('.dead')
    this.waveEl = el.querySelector('.wave')
    this.bannerEl = el.querySelector('.banner')
    this.toastEl = el.querySelector('.toast')
    this.bossEl = el.querySelector('.boss')
    this.bossFill = el.querySelector('.boss .bar i')
    this.bossGhost = el.querySelector('.boss .bar u')
    this.creditsEl = el.querySelector('.credits')
    this.boss = null

    this.pipEls = []
    this._fpsAcc = 0
    this._fpsN = 0
  }

  /** 스테이지 이름을 크게 띄운다. */
  banner(title, sub, hold = 2.6) {
    this.bannerEl.querySelector('h1').textContent = title
    this.bannerEl.querySelector('p').textContent = sub ?? ''
    this.bannerEl.classList.add('on')
    clearTimeout(this._bannerT)
    this._bannerT = setTimeout(() => this.bannerEl.classList.remove('on'), hold * 1000)
  }

  clearBanner() { clearTimeout(this._bannerT); this.bannerEl.classList.remove('on') }

  /** 웨이브가 바뀔 때 한 줄. */
  toast(text, hold = 2.2) {
    this.toastEl.textContent = text
    this.toastEl.classList.add('on')
    clearTimeout(this._toastT)
    this._toastT = setTimeout(() => this.toastEl.classList.remove('on'), hold * 1000)
  }

  /** 보스 체력바. 페이즈 경계를 눈금으로 보여 준다. */
  setBoss(boss) {
    this.boss = boss
    this.bossEl.classList.toggle('on', !!boss && !boss.cfg?.endless)
    if (!boss) return
    this.bossEl.querySelector('.who b').textContent = boss.cfg.name
    this.bossEl.querySelector('.who span').textContent = boss.cfg.title ?? ''
    const marks = this.bossEl.querySelector('.phases')
    marks.innerHTML = boss.cfg.phases.map(() => '<s></s>').join('')
  }

  /** 보스가 쓰러져 약점이 드러난 상태. */
  setBossDown(on, hint) {
    this.bossEl.classList.toggle('down', !!on)
    if (on && this.boss) {
      this.bossEl.querySelector('.weak').textContent =
        hint ?? `쓰러졌다 — ${this.boss.cfg.phases.find(p => p.needsWeakPoint)?.weakHint ?? '약점'}`
    }
  }

  credits(damage, taken, run) {
    const el = this.creditsEl
    el.querySelector('h1').textContent = '죽음'
    el.querySelector('.sub2').textContent = '창은 가오리 뼈로 만든 것이었다. 아들은 아버지를 몰랐다.'
    el.querySelector('.num').textContent = Math.round(damage).toLocaleString('ko-KR')
    const names = []
    for (const [id, n] of taken) {
      const u = (this._pool ?? []).find(x => x.id === id)
      names.push(`${u?.name ?? id}${n > 1 ? ` ×${n}` : ''}`)
    }
    el.querySelector('.list').innerHTML = names.map(n => `<span>${n}</span>`).join('')
    el.classList.add('on')
    document.body.style.cursor = 'default'
  }

  /** 크레딧에 고른 것의 이름을 띄우려면 선택지 목록이 필요하다. */
  setUpgradePool(pool) { this._pool = pool }

  hideCredits() { this.creditsEl.classList.remove('on'); document.body.style.cursor = '' }

  setCharges(n) {
    while (this.pipEls.length < n) {
      const d = document.createElement('div')
      d.className = 'pip'
      d.innerHTML = '<i></i>'
      this.pips.appendChild(d)
      this.pipEls.push(d)
    }
  }

  update(player, { totalDamage, dt, kills = 0, kit = null, level = null, stage = null, index = 0, count = 9 }) {
    const k = clamp(player.hp / player.maxHp, 0, 1)
    this.hpFill.style.transform = `scaleX(${k})`
    this.hpGhost.style.transform = `scaleX(${k})`
    this.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`
    this.hpWrap?.classList.toggle('low', k <= 0.3)

    this.setCharges(TUNING.roll.charges)
    for (let i = 0; i < this.pipEls.length; i++) {
      const filled = i < player.rollCharges
      const charging = i === player.rollCharges && player.rollCharges < TUNING.roll.charges
      this.pipEls[i].classList.toggle('empty', !filled && !charging)
      this.pipEls[i].classList.toggle('full', filled)
      // 원형이라 가로로 늘이는 대신 시계 방향 각도로 채운다
      const k2 = filled ? 1 : charging ? clamp(player.rollTimer / TUNING.roll.regen, 0, 1) : 0
      this.pipEls[i].style.setProperty('--k', k2.toFixed(3))
    }

    // 막대는 경험치다. 전에는 차림(장비) 진행도를 그렸는데, 그건 처치 수로
    // 한 번씩 열리는 것이라 막대가 필요하지 않다 — 숫자 한 줄로 충분하다.
    // 막대가 차오르는 걸 매 초 보고 있어야 하는 건 경험치 쪽이다.
    if (level) {
      this.xpFill.style.transform = `scaleX(${clamp(level.ratio, 0, 1)})`
      this.lvChip.textContent = level.lv
    }
    if (kit) {
      const label = kit.done
        ? `처치 ${kills} · 차림 완성`
        : `처치 ${kills} · ${kit.next.name}까지 ${kit.to - kills}`
      if (label !== this._kitLabel) { this.lvEl.textContent = label; this._kitLabel = label }
    }

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

    if (stage) {
      // 웨이브 구간이면 처치 수를, 보스 구간이면 보스 이름을 보여 준다
      const tail = stage.goal
        ? ` · <b>${Math.min(kills, stage.goal)}</b> / ${stage.goal}`
        : (stage.bossName ? ` · <b>${stage.bossName}</b>` : '')
      const label = `${index + 1} / ${count} · ${stage.name}${tail}`
      if (label !== this._waveLabel) { this.waveEl.innerHTML = label; this._waveLabel = label }
    }

    if (this.boss && !this.boss.dead) {
      const k = clamp(this.boss.hp / this.boss.maxHp, 0, 1)
      this.bossFill.style.transform = `scaleX(${k})`
      this.bossGhost.style.transform = `scaleX(${k})`
    } else if (this.boss?.dead) {
      this.bossFill.style.transform = 'scaleX(0)'
      this.bossGhost.style.transform = 'scaleX(0)'
    }

    this.dmgEl.textContent = Math.round(totalDamage).toLocaleString('ko-KR')

    this._fpsAcc += dt; this._fpsN++
    if (this._fpsAcc >= 0.5) {
      this.fpsEl.textContent = `${Math.round(this._fpsN / this._fpsAcc)} fps`
      this._fpsAcc = 0; this._fpsN = 0
    }

    // 크레딧이 떠 있으면 사망 암전은 겹치지 않는다 — 두 겹이면 글씨가 안 보인다
    this.deadEl.classList.toggle('on', player.dead && !this.creditsEl.classList.contains('on'))
  }
}
