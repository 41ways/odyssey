const CSS = `
#levelup { position:absolute; inset:0; z-index:50; display:none; place-items:center; pointer-events:none;
  background:radial-gradient(ellipse at center, rgba(12,8,6,.62), rgba(6,4,4,.9));
  backdrop-filter:blur(2px); }
#levelup.on { display:grid; pointer-events:auto; cursor:default; }
#levelup .wrap { text-align:center; animation:lvlIn .28s cubic-bezier(.2,.8,.3,1); }
@keyframes lvlIn { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
#levelup h2 { font-size:26px; letter-spacing:.2em; font-weight:800; color:#e8c98a;
  margin-bottom:8px; text-indent:.2em; }
#levelup .sub { font-size:13px; color:#8b8378; margin-bottom:30px; letter-spacing:.04em; }
#levelup .sub::before { content:'"'; } #levelup .sub::after { content:'"'; }
#levelup .cards { display:flex; gap:16px; justify-content:center; }
#levelup button { width:212px; padding:24px 18px 20px; text-align:left; cursor:pointer;
  background:linear-gradient(180deg,#1e1712,#14100d); color:#e9e2d6;
  border:1px solid #3d332b; border-radius:6px; font:inherit;
  transition:border-color .14s, transform .14s, box-shadow .14s; }
#levelup button:hover { border-color:#c8974e; transform:translateY(-4px);
  box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 0 1px rgba(200,151,78,.25); }
#levelup .tag { font-size:10px; letter-spacing:.2em; color:#9b7b4a; margin-bottom:12px; }
#levelup .tier { display:inline-block; font-size:9.5px; letter-spacing:.16em; font-weight:800;
  padding:2px 7px; border-radius:3px; margin-bottom:11px; }
#levelup button.t1 { border-color:#2f4d70; }
#levelup button.t1:hover { border-color:#5aa8ff; box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 0 1px rgba(90,168,255,.3); }
#levelup button.t2 { border-color:#4a3566; }
#levelup button.t2:hover { border-color:#c77dff; box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 0 1px rgba(199,125,255,.3); }
#levelup button.t3 { border-color:#6b4d14;
  background:linear-gradient(180deg,#2a2013,#16110c); }
#levelup button.t3:hover { border-color:#ffb02e; box-shadow:0 12px 34px rgba(0,0,0,.6), 0 0 0 1px rgba(255,176,46,.35); }
#levelup .unlocked { font-size:11.5px; letter-spacing:.1em; color:#7f9fd0; margin-bottom:16px; }
#levelup .name { font-size:19px; font-weight:800; margin-bottom:8px; }
#levelup .desc { font-size:13px; color:#d3b483; line-height:1.5; font-weight:600; }
#levelup .flavor { font-size:11.5px; color:#8a8074; line-height:1.55; margin-top:12px;
  padding-top:11px; border-top:1px solid #2e2720; font-style:italic; }
#levelup .num { float:right; font-size:11px; color:#5f564c; border:1px solid #3d332b;
  border-radius:3px; padding:1px 6px; margin-top:-4px; }
`

export class LevelUp {
  constructor(root) {
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
          <h2>${heading}</h2>
          <div class="sub">${sub}</div>
          ${unlocked.length ? `<div class="unlocked">${unlocked.map(u => `${tiers[u.tier]?.label ?? ''} 해금 — ${u.name}`).join(' · ')}</div>` : ''}
          <div class="cards">
            ${choices.map((u, i) => `
              <button data-i="${i}" class="t${u.tier}">
                <div class="tag">${u.tag}<span class="num">${i + 1}</span></div>
                ${u.tier > 0 ? `<div class="tier" style="background:${tiers[u.tier].color}22;color:${tiers[u.tier].color}">${tiers[u.tier].label}</div>` : ''}
                <div class="name">${u.name}</div>
                <div class="desc">${u.desc}</div>
                ${u.flavor ? `<div class="flavor">${u.flavor}</div>` : ''}
              </button>`).join('')}
          </div>
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
