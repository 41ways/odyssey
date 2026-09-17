import { installTheme, meanderURI } from './theme.js'

const CSS = `
#levelup { position:absolute; inset:0; z-index:50; display:none; place-items:center;
  pointer-events:none; font-family:var(--body);
  background:
    radial-gradient(ellipse 100% 70% at 50% 42%, rgba(140,58,36,.28), transparent 68%),
    linear-gradient(180deg, rgba(10,6,4,.78), rgba(6,4,3,.94));
  backdrop-filter:blur(2.5px); }
#levelup.on { display:grid; pointer-events:auto; cursor:default; }
#levelup .wrap { text-align:center; animation:lvlIn .32s cubic-bezier(.2,.8,.3,1); }
@keyframes lvlIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }

#levelup .band { height:14px; width:min(760px, 84vw); margin:0 auto;
  background-image:${meanderURI('#c8973e', 0.9)}; background-repeat:repeat-x;
  background-position:center; opacity:.5; }
#levelup h2 { font-family:var(--serif); font-size:30px; font-weight:700;
  letter-spacing:.22em; text-indent:.22em; color:var(--ivory); margin:22px 0 8px;
  text-shadow:0 0 34px rgba(200,151,62,.3), 0 4px 18px #000; }
#levelup .sub { font-size:13.5px; color:var(--ivory-dim); margin-bottom:8px; letter-spacing:.03em; }
#levelup .sub::before { content:'“'; } #levelup .sub::after { content:'”'; }
#levelup .unlocked { font-family:var(--serif); font-size:12px; letter-spacing:.2em;
  color:var(--bronze); margin:14px 0 4px; }
#levelup .cards { display:flex; gap:18px; justify-content:center; margin-top:26px; }

#levelup button { width:224px; padding:0 0 22px; text-align:left; cursor:pointer;
  color:var(--ivory); font:inherit; border:1px solid #4a3623; border-radius:3px;
  background:linear-gradient(180deg,#241812,#130d09);
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.14), 0 16px 40px rgba(0,0,0,.55);
  transition:border-color .15s, transform .15s, box-shadow .15s; overflow:hidden; }
#levelup button:hover { transform:translateY(-5px); border-color:var(--bronze);
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.4), 0 22px 46px rgba(0,0,0,.65); }
#levelup button .top { height:13px; background-image:${meanderURI('#c8973e', 0.85)};
  background-repeat:repeat-x; background-position:center; opacity:.4; margin-bottom:20px; }
#levelup button:hover .top { opacity:.85; }
#levelup .pad { padding:0 20px; }
#levelup .tag { font-family:var(--serif); font-size:10px; letter-spacing:.24em;
  color:#9c7b4a; margin-bottom:13px; display:flex; justify-content:space-between; align-items:center; }
#levelup .num { font-size:10px; color:#5f564c; border:1px solid #3d332b;
  border-radius:2px; padding:1px 6px; }
#levelup .tier { display:inline-block; font-family:var(--serif); font-size:9.5px;
  letter-spacing:.2em; font-weight:700; padding:3px 9px; border-radius:2px; margin-bottom:12px; }
#levelup .name { font-size:20px; font-weight:700; margin-bottom:9px; letter-spacing:.01em; }
#levelup .desc { font-size:13px; color:#e0bd85; line-height:1.55; font-weight:700; }
#levelup .flavor { font-size:11.5px; color:#8a8074; line-height:1.6; margin-top:13px;
  padding-top:12px; border-top:1px solid #33291f; }

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
  show({ heading, sub, choices, unlocked = [], tiers = [] }) {
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
              <button data-i="${i}" class="t${u.tier ?? 0}">
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
      addEventListener('keydown', this.onKey)
    })
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
