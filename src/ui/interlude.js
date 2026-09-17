import { installTheme, meanderURI } from './theme.js'

/**
 * 막간.
 *
 * 판이 끝나자마자 다음 판이 시작되면 아홉 번 싸운 기억만 남는다.
 * 사이에 한 호흡을 넣어야 "돌아가는 길"이 된다.
 *
 * 글줄을 하나씩 띄우고 뒤에는 그 뱃길에 맞는 장면을 깐다.
 * 마우스로는 넘어가지 않는다 — 읽는 중에 한 번 클릭했다고 이야기가 날아가면
 * 다시는 안 읽게 된다. 넘기려면 아래 건너뛰기를 직접 누른다.
 */
const CSS = `
#lude { position:absolute; inset:0; z-index:62; display:none; place-items:center;
  pointer-events:none; font-family:var(--body); overflow:hidden; background:#05040a; }
#lude.on { display:grid; pointer-events:auto; cursor:default; }

/* ── 뱃길 장면 ───────────────────────────────────────────
   판마다 같은 바다를 보여 주면 일곱 번 같은 데를 지난 것이 된다.
   어디를 떠나 어디로 가는지에 따라 하늘과 물을 바꾼다. */
#lude .scene { position:absolute; inset:0; opacity:0; transition:opacity 1.4s ease; }
#lude.on .scene { opacity:1; }
#lude .sky { position:absolute; inset:0 0 44% 0; }
#lude .water { position:absolute; inset:56% 0 0 0; }
#lude .horizon { position:absolute; left:0; right:0; top:56%; height:1px;
  background:linear-gradient(90deg, transparent, rgba(180,200,240,.35), transparent); }
#lude .wave { position:absolute; left:0; right:0; height:1px; background:rgba(150,180,230,.10); }
#lude .orb { position:absolute; border-radius:50%; }
#lude .ship { position:absolute; top:52.4%; left:-16%; width:118px; height:64px;
  animation:sail 34s linear infinite; }
@keyframes sail { from { left:-16% } to { left:114% } }
#lude .ship.toss { animation:sail 22s linear infinite, toss 3.4s ease-in-out infinite; }
@keyframes toss { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-10px) rotate(5deg)} }

/* 밤바다 — 떠나온 뒤의 첫 호흡 */
#lude .sea .sky { background:linear-gradient(180deg,#070a14 0%,#121a2c 55%,#2a3550 100%); }
#lude .sea .water { background:linear-gradient(180deg,#16203a 0%,#0a0f1c 70%,#05070e 100%); }
#lude .sea .orb { left:50%; top:22%; width:140px; height:140px; transform:translateX(-50%);
  background:radial-gradient(circle, rgba(220,230,255,.22), transparent 62%); }

/* 새벽 — 약탈한 마을을 등지고 나온 아침 */
#lude .dawn .sky { background:linear-gradient(180deg,#0d1020 0%,#3a2c3a 46%,#a46a4a 82%,#d69a5e 100%); }
#lude .dawn .water { background:linear-gradient(180deg,#8a5a3e 0%,#3a2a2c 34%,#0e0c14 100%); }
#lude .dawn .orb { left:50%; top:47%; width:118px; height:118px; transform:translate(-50%,-50%);
  background:radial-gradient(circle, rgba(255,214,150,.75), rgba(255,170,90,.25) 42%, transparent 68%); }
#lude .dawn .glare { position:absolute; left:calc(50% - 40px); top:56%; width:80px; bottom:0;
  background:linear-gradient(180deg, rgba(255,200,130,.3), transparent 72%); filter:blur(7px); }

/* 폭풍 — 열한 척이 깨진 뒤 */
#lude .storm .sky { background:linear-gradient(180deg,#04070c 0%,#0b1220 58%,#182338 100%); }
#lude .storm .water { background:linear-gradient(180deg,#141d2e 0%,#080d16 60%,#03050a 100%); }
#lude .storm .flash { position:absolute; inset:0; background:rgba(190,210,255,.5);
  opacity:0; animation:bolt 7s steps(1) infinite; }
@keyframes bolt {
  0%,100%{opacity:0} 42%{opacity:.5} 43%{opacity:0} 45%{opacity:.34} 46.5%{opacity:0}
  78%{opacity:.4} 79%{opacity:0} }
#lude .storm .wave { background:rgba(170,200,240,.16); animation:swell 5s ease-in-out infinite; }
@keyframes swell { 0%,100%{transform:translateX(-3%)} 50%{transform:translateX(3%)} }

/* 불 — 저승으로 내려가기 전 */
#lude .fire { background:
    radial-gradient(ellipse 80% 50% at 50% 108%, rgba(200,80,30,.34), transparent 62%),
    linear-gradient(180deg, #0a0604 0%, #170b05 60%, #240d04 100%); }
#lude .ember { position:absolute; width:3px; height:3px; border-radius:50%;
  background:#ffae5a; opacity:0; }

/* 잿빛에서 다시 빛으로 — 저승을 나와서 */
#lude .ashdawn { background:linear-gradient(180deg,#0a0810 0%,#1b1526 44%,#4a3a46 78%,#8a6f62 100%); }
#lude .ashdawn .water { background:linear-gradient(180deg,#584439 0%,#221a20 40%,#08060c 100%); }
#lude .ashdawn .orb { left:50%; top:52%; width:200px; height:200px; transform:translate(-50%,-50%);
  background:radial-gradient(circle, rgba(240,220,190,.4), transparent 62%); }

/* 소용돌이 — 물이 돌아가는 소리 */
#lude .whirl { background:linear-gradient(180deg,#050a10 0%,#0a141f 60%,#04080e 100%); }
#lude .whirl .ring { position:absolute; left:50%; top:58%; border-radius:50%;
  border:1px solid rgba(140,190,230,.20); transform:translate(-50%,-50%) rotate(0deg);
  animation:spin 18s linear infinite; }
#lude .whirl .ring:nth-child(2n) { border-color:rgba(200,160,90,.14); animation-duration:26s;
  animation-direction:reverse; }
@keyframes spin { to { transform:translate(-50%,-50%) rotate(360deg) } }
#lude .whirl .eye { position:absolute; left:50%; top:58%; width:70px; height:70px;
  transform:translate(-50%,-50%); border-radius:50%;
  background:radial-gradient(circle, #02040a 34%, rgba(60,110,150,.22) 70%, transparent 100%); }

/* 뭍이 보인다 */
#lude .landfall .sky { background:linear-gradient(180deg,#101828 0%,#3c4258 44%,#9a8a66 84%,#d8be86 100%); }
#lude .landfall .water { background:linear-gradient(180deg,#6f6348 0%,#2a2a2c 38%,#0a0c10 100%); }
#lude .landfall .land { position:absolute; left:0; right:0; top:50.6%; height:8%;
  background:linear-gradient(180deg, #0a0c10, #0a0c10);
  clip-path:polygon(0 100%,14% 62%,22% 74%,34% 40%,44% 66%,55% 30%,66% 64%,76% 48%,88% 70%,100% 56%,100% 100%);
  opacity:.9; }
#lude .landfall .orb { left:62%; top:47%; width:92px; height:92px; transform:translate(-50%,-50%);
  background:radial-gradient(circle, rgba(255,232,180,.6), transparent 64%); }

/* 홀이 조용해졌다 — 그런데도 끝나지 않았다 */
#lude .night { background:
    radial-gradient(ellipse 60% 44% at 50% 30%, rgba(120,26,26,.22), transparent 66%),
    linear-gradient(180deg,#070407 0%,#10080a 58%,#050304 100%); }
#lude .night .orb { left:50%; top:26%; width:120px; height:120px; transform:translateX(-50%);
  background:radial-gradient(circle, rgba(200,70,60,.4), rgba(120,30,30,.14) 46%, transparent 70%); }
#lude .night .col { position:absolute; bottom:0; width:38px; top:34%;
  background:linear-gradient(180deg, rgba(20,15,12,.0), rgba(14,10,8,.92) 30%); }

#lude .plate { position:relative; text-align:center; width:min(760px, 88vw); }
#lude .band { height:14px; background-image:${meanderURI('#c8973e', 0.85)};
  background-repeat:repeat-x; background-position:center; opacity:.35; }
#lude .line { min-height:6.6em; display:grid; place-items:center; margin:30px 0; }
#lude .line span { display:block; font-family:var(--serif); font-size:26px; line-height:1.9;
  letter-spacing:.06em; color:#ece0c8; opacity:0; transform:translateY(12px);
  transition:opacity .8s ease, transform .9s cubic-bezier(.2,.8,.3,1);
  text-shadow:0 4px 30px #000; }
#lude .line span.in { opacity:1; transform:none; }
#lude .line span em { color:#ffd9a0; font-style:normal; }
#lude .dest { font-family:var(--serif); font-size:13px; letter-spacing:.44em;
  text-indent:.44em; color:#c8973e; opacity:0; transition:opacity .8s ease; }
#lude .dest.in { opacity:1; }
#lude .skip { position:absolute; right:26px; bottom:22px; font-family:var(--serif);
  font-size:11px; letter-spacing:.26em; text-indent:.26em; color:#7d7160;
  border:1px solid #3b3227; border-radius:2px; padding:9px 16px 9px 18px;
  background:rgba(12,9,6,.6); cursor:pointer; opacity:0;
  transition:opacity .6s ease .9s, color .14s, border-color .14s, background .14s; }
#lude.on .skip { opacity:1; }
#lude .skip:hover { color:var(--ivory); border-color:var(--bronze); background:rgba(40,28,16,.8); }
`

const waves = (n = 7, step = 11) => Array.from({ length: n }, (_, i) =>
  `<div class="wave" style="top:${8 + i * step}%"></div>`).join('')

const SHIP = cls => `<svg class="ship ${cls}" viewBox="0 0 118 64" fill="none">
  <path d="M8 46 h102 l-12 12 H20 z" fill="#0a0e18" stroke="#3b4a68" stroke-width="1.2"/>
  <path d="M59 6 v40" stroke="#3b4a68" stroke-width="2"/>
  <path d="M59 10 q26 10 0 26 z" fill="#131a2a" stroke="#4a5c80" stroke-width="1.2"/>
  <path d="M59 12 q-22 9 0 22 z" fill="#0e1422" stroke="#3b4a68" stroke-width="1"/>
</svg>`

const seaLike = (name, extra = '') => () => `<div class="scene ${name}">
  <div class="sky"></div><div class="orb"></div>
  <div class="water">${waves()}</div>
  <div class="horizon"></div>${extra}${SHIP('')}
</div>`

/** 판마다 다른 뱃길. 이름은 stages.js 의 interludeFor 가 정한다. */
const SCENES = {
  sea: seaLike('sea'),
  dawn: seaLike('dawn', '<div class="glare"></div>'),
  storm: () => `<div class="scene storm">
    <div class="sky"></div>
    <div class="water">${waves(9, 9)}</div>
    <div class="horizon"></div>${SHIP('toss')}
    <div class="flash"></div>
  </div>`,
  fire: () => `<div class="scene fire">${Array.from({ length: 40 }, () => {
    const l = Math.random() * 100, d = (Math.random() * 8).toFixed(1), s = (6 + Math.random() * 6).toFixed(1)
    return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;animation:ashUp ${s}s linear ${d}s infinite"></i>`
  }).join('')}</div>`,
  ashdawn: () => `<div class="scene ashdawn">
    <div class="orb"></div>
    <div class="water">${waves(6, 12)}</div>
    <div class="horizon"></div>${SHIP('')}
    ${Array.from({ length: 26 }, () => {
      const l = Math.random() * 100, d = (Math.random() * 9).toFixed(1), s = (7 + Math.random() * 7).toFixed(1)
      return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;background:#c9bcd8;animation:ashUp ${s}s linear ${d}s infinite"></i>`
    }).join('')}
  </div>`,
  whirl: () => `<div class="scene whirl">
    ${Array.from({ length: 7 }, (_, i) => {
      const r = 90 + i * 74
      return `<div class="ring" style="width:${r}px;height:${Math.round(r * 0.34)}px"></div>`
    }).join('')}
    <div class="eye"></div>${SHIP('toss')}
  </div>`,
  landfall: seaLike('landfall', '<div class="land"></div>'),
  night: () => `<div class="scene night">
    <div class="orb"></div>
    ${[8, 21, 79, 92].map(l => `<div class="col" style="left:${l}%"></div>`).join('')}
  </div>`,
}

export class Interlude {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'lude'
    root.appendChild(this.el)
  }

  /**
   * @param o.lines   한 줄씩 뜰 글. 각 { text, hold }
   * @param o.dest    아래에 작게 뜨는 목적지 (선택)
   * @param o.scene   SCENES 의 이름 — sea·dawn·storm·fire·ashdawn·whirl·landfall·night
   */
  play({ lines, dest, scene = 'sea' }) {
    return new Promise(resolve => {
      const back = SCENES[scene] ? SCENES[scene]() : SCENES.sea()

      this.el.innerHTML = `${back}
        <div class="plate">
          <div class="band"></div>
          <div class="line"><span></span></div>
          ${dest ? `<div class="dest">${dest}</div>` : ''}
          <div class="band"></div>
        </div>
        <button class="skip" type="button">SKIP</button>`
      this.el.classList.add('on')
      document.body.style.cursor = 'default'

      const span = this.el.querySelector('.line span')
      const destEl = this.el.querySelector('.dest')
      const timers = []
      let done = false

      const finish = () => {
        if (done) return
        done = true
        timers.forEach(clearTimeout)
        removeEventListener('keydown', skip)
        this.el.classList.remove('on')
        document.body.style.cursor = ''
        resolve()
      }
      const skip = e => {
        // 이동·공격 키로 실수로 넘기지 않게 — Esc 와 건너뛰기 단추만 받는다
        if (e && e.code !== 'Escape') return
        finish()
      }
      this.el.querySelector('.skip')?.addEventListener('click', () => finish())
      timers.push(setTimeout(() => addEventListener('keydown', skip), 500))

      let t = 350
      for (const l of lines) {
        timers.push(setTimeout(() => {
          span.classList.remove('in')
          timers.push(setTimeout(() => { span.innerHTML = l.text; span.classList.add('in') }, 320))
        }, t))
        t += (l.hold ?? 2600)
      }
      if (destEl) timers.push(setTimeout(() => destEl.classList.add('in'), Math.max(600, t - 1400)))
      timers.push(setTimeout(finish, t + 300))
    })
  }
}
