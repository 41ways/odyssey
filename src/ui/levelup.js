import { installTheme, meanderURI } from './theme.js'

const CSS = `
#levelup { position:absolute; inset:0; z-index:50; display:none; place-items:center;
  pointer-events:none; font-family:var(--body);
  background:
    radial-gradient(ellipse 95% 65% at 50% 42%, rgba(232,200,132,.12), transparent 66%),
    linear-gradient(180deg, rgba(10,9,7,.82), rgba(5,4,3,.95));
}
/* 해협의 갈림길처럼 '어디서 고르는지' 가 중요한 선택은 바탕을 얇게 한다.
   화면을 다 덮으면 배 위에서 고르는 건지 어디서 고르는 건지 알 수가 없다. */
#levelup.sheer {
  background:
    radial-gradient(ellipse 70% 52% at 50% 46%, rgba(10,16,26,.30), rgba(4,7,12,.72) 100%),
    linear-gradient(180deg, rgba(6,10,16,.42), rgba(4,6,10,.60));
  backdrop-filter:blur(2.5px); }
#levelup.on { display:grid; pointer-events:auto; cursor:default; }
#levelup .wrap { text-align:center; animation:lvlIn .32s cubic-bezier(.2,.8,.3,1); }
@keyframes lvlIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }

#levelup .band { height:14px; width:min(760px, 84vw); margin:0 auto;
  background-image:${meanderURI('#c8973e', 0.9)}; background-repeat:repeat-x;
  background-position:center; opacity:.5; }
#levelup h2 { font-family:var(--serif); font-size:34px; font-weight:700;
  letter-spacing:.24em; text-indent:.24em; color:var(--ivory); margin:22px 0 8px;
  text-shadow:0 0 44px rgba(232,200,132,.45), 0 2px 0 #4a3a1c, 0 4px 18px #000; }
#levelup .sub { font-size:13px; color:var(--text-dim); margin-bottom:8px; letter-spacing:.03em; }
#levelup .sub::before { content:'“'; } #levelup .sub::after { content:'”'; }
#levelup .unlocked { font-family:var(--serif); font-size:12px; letter-spacing:.22em;
  color:var(--gold); margin:14px 0 4px; text-shadow:0 0 22px rgba(232,200,132,.5); }
#levelup .cards { display:flex; gap:18px; justify-content:center; margin-top:26px;
  perspective:1400px; }

/* 등장 — 한 장씩 차례로 선다. 윗등급은 뒤집히며 열린다. */
#levelup button { opacity:0; transform:translateY(22px);
  transition:opacity .34s ease, transform .4s cubic-bezier(.2,.9,.3,1),
             border-color .15s, box-shadow .15s; }
#levelup button.in { opacity:1; transform:none; }
#levelup button.sealed { opacity:1; transform:rotateY(90deg); }
#levelup button.opening { transform:rotateY(0deg);
  transition:transform .5s cubic-bezier(.2,.9,.25,1); }

/* 윗등급이 열릴 때 뒤에서 터지는 빛 */
#levelup .burst { position:absolute; left:50%; top:50%; width:340px; height:340px;
  transform:translate(-50%,-50%) scale(.3); border-radius:50%; pointer-events:none;
  opacity:0; transition:opacity .5s ease, transform .7s cubic-bezier(.1,.8,.3,1); }
#levelup .burst.go { opacity:.85; transform:translate(-50%,-50%) scale(1); }
#levelup .burst.fade { opacity:0; }

/* 윗등급 카드 테두리가 한 번 번쩍인다 */
#levelup button.flash { box-shadow:inset 0 0 0 2px currentColor, 0 0 60px currentColor; }

/* 등급 도장이 찍히듯 들어온다 */
#levelup .tier { opacity:0; transform:scale(1.9); transition:opacity .2s ease, transform .3s cubic-bezier(.2,.9,.2,1); }
#levelup button.in .tier, #levelup button.opening .tier { opacity:1; transform:none; }

/* 청동판 — 위 모서리에 빛이 걸리고 아래로 그늘진다 */
#levelup button { width:230px; padding:0 0 22px; text-align:left; cursor:pointer;
  color:var(--text); font:inherit; border:1px solid var(--line); border-radius:3px;
  background:linear-gradient(180deg, var(--plate) 0%, var(--ground2) 58%, var(--ground) 100%);
  box-shadow:inset 0 1px 0 rgba(232,200,132,.22), inset 0 0 0 1px rgba(232,200,132,.06),
    0 18px 44px rgba(0,0,0,.6);
  transition:border-color .15s, transform .15s, box-shadow .15s; overflow:hidden;
  position:relative; }
/* 판을 고정한 리벳 */
#levelup button::after { content:''; position:absolute; right:11px; bottom:11px;
  width:7px; height:7px; pointer-events:none;
  background:radial-gradient(circle, rgba(232,200,132,.75), rgba(232,200,132,.28) 42%, transparent 62%); }
#levelup button:hover { transform:translateY(-5px); border-color:var(--gold);
  box-shadow:inset 0 1px 0 rgba(232,200,132,.5), inset 0 0 0 1px rgba(232,200,132,.28),
    0 26px 52px rgba(0,0,0,.7), 0 0 38px rgba(232,200,132,.16); }
#levelup button .top { height:13px; background-image:${meanderURI('#c8973e', 0.85)};
  background-repeat:repeat-x; background-position:center; opacity:.4; margin-bottom:20px; }
#levelup button:hover .top { opacity:.85; }
#levelup .pad { padding:0 20px; }
#levelup .tag { font-family:var(--serif); font-size:10px; letter-spacing:.26em;
  color:var(--gold-dim); margin-bottom:13px; display:flex; justify-content:space-between; align-items:center; }
#levelup .num { font-size:10px; color:#5f564c; border:1px solid #3d332b;
  border-radius:2px; padding:1px 6px; }
#levelup .tier { display:inline-block; font-family:var(--serif); font-size:9.5px;
  letter-spacing:.2em; font-weight:700; padding:3px 9px; border-radius:2px; margin-bottom:12px; }
#levelup .name { font-family:var(--serif); font-size:21px; font-weight:700;
  margin-bottom:10px; letter-spacing:.02em; color:var(--ivory); }
#levelup .desc { font-size:12.5px; color:var(--gold); line-height:1.7; font-weight:700; }
#levelup .flavor { font-size:11px; color:var(--text-dim); line-height:1.7; margin-top:13px;
  padding-top:12px; border-top:1px solid var(--line-dim); }

/* 등급마다 테두리 색이 다르다 — 무엇을 집는지 눈으로 먼저 안다 */
#levelup button.t1 { border-color:#2f4d70; }
#levelup button.t1:hover { border-color:#5aa8ff; box-shadow:inset 0 0 0 1px rgba(90,168,255,.35), 0 22px 46px rgba(0,0,0,.65); }
#levelup button.t2 { border-color:#4a3566; }
#levelup button.t2:hover { border-color:#c77dff; box-shadow:inset 0 0 0 1px rgba(199,125,255,.35), 0 22px 46px rgba(0,0,0,.65); }
#levelup button.t3 { border-color:#6b4d14; background:linear-gradient(180deg,#2e2113,#16100a); }
#levelup button.t3:hover { border-color:#ffb02e; box-shadow:inset 0 0 0 1px rgba(255,176,46,.45), 0 26px 54px rgba(0,0,0,.7); }
`

export class LevelUp {
  constructor(root) {
    installTheme()
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    this.el = document.createElement('div')
    this.el.id = 'levelup'
    root.appendChild(this.el)
    this.onKey = this.onKey.bind(this)
  }

  get open() { return this.el.classList.contains('on') }

  /** 고를 때까지 기다린다. 숫자 키로도 고를 수 있다. */
  show({ heading, sub, choices, unlocked = [], tiers = [], sheer = false }) {
    this.el.classList.toggle('sheer', !!sheer)
    return new Promise(resolve => {
      this._resolve = resolve
      this._choices = choices
      this.el.innerHTML = `
        <div class="wrap">
          <div class="band"></div>
          <h2>${heading}</h2>
          <div class="sub">${sub}</div>
          ${unlocked.length ? `<div class="unlocked">${unlocked.map(u => `${tiers[u.tier]?.label ?? ''} 해금 — ${u.name}`).join(' · ')}</div>` : ''}
          <div class="cards">
            ${choices.map((u, i) => `
              <button data-i="${i}" class="t${u.tier ?? 0}" data-tier="${u.tier ?? 0}">
                ${u.tier > 0 ? `<div class="burst" style="background:radial-gradient(circle, ${tiers[u.tier].color}88, ${tiers[u.tier].color}22 42%, transparent 68%)"></div>` : ''}
                <div class="top"></div>
                <div class="pad">
                  <div class="tag"><span>${u.tag ?? ''}</span><span class="num">${i + 1}</span></div>
                  ${u.tier > 0 ? `<div class="tier" style="background:${tiers[u.tier].color}22;color:${tiers[u.tier].color}">${tiers[u.tier].label}</div>` : ''}
                  <div class="name">${u.name}</div>
                  <div class="desc">${u.desc}</div>
                  ${u.flavor ? `<div class="flavor">${u.flavor}</div>` : ''}
                </div>
              </button>`).join('')}
          </div>
          <div class="band" style="margin-top:30px"></div>
        </div>`
      this.el.classList.add('on')
      document.body.style.cursor = 'default'
      for (const b of this.el.querySelectorAll('button')) {
        b.addEventListener('click', () => this.pick(+b.dataset.i))
      }
      this.#reveal()
      addEventListener('keydown', this.onKey)
    })
  }

  /**
   * 카드 등장.
   * 일반은 차례로 서고, 윗등급은 한 박자 늦게 뒤집히며 열린다 —
   * 무엇이 특별한지 눈이 먼저 안다.
   * (rAF 는 창이 숨겨져 있으면 안 돌아서 전부 타이머로 돌린다)
   */
  #reveal() {
    const cards = [...this.el.querySelectorAll('button')]
    let t = 40
    for (const b of cards) {
      const tier = +b.dataset.tier
      if (tier === 0) {
        setTimeout(() => b.classList.add('in'), t)
        t += 90
      } else {
        // 윗등급: 옆으로 세워 뒀다가 늦게 연다
        b.classList.add('sealed')
        const at = t + 260
        setTimeout(() => {
          const burst = b.querySelector('.burst')
          burst?.classList.add('go')
          b.classList.remove('sealed')
          b.classList.add('opening', 'in', 'flash')
          setTimeout(() => { b.classList.remove('flash'); burst?.classList.add('fade') }, 420)
        }, at)
        t = at + 140
      }
    }
  }

  onKey(e) {
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
    if (i >= 0 && i < this._choices.length) { e.preventDefault(); this.pick(i) }
  }

  pick(i) {
    if (!this._resolve) return
    const r = this._resolve
    this._resolve = null
    removeEventListener('keydown', this.onKey)
    this.el.classList.remove('on')
    document.body.style.cursor = ''
    r(this._choices[i])
  }
}
