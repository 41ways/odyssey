const CSS = `
#levelup { position:absolute; inset:0; z-index:50; display:none; place-items:center; pointer-events:none;
  background:radial-gradient(ellipse at center, rgba(12,8,6,.62), rgba(6,4,4,.9));
  backdrop-filter:blur(2px); }
#levelup.on { display:grid; pointer-events:auto; cursor:default; }
#levelup .wrap { text-align:center; animation:lvlIn .28s cubic-bezier(.2,.8,.3,1); }
@keyframes lvlIn { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
#levelup h2 { font-size:15px; letter-spacing:.42em; font-weight:700; color:#e8c98a;
  margin-bottom:6px; text-indent:.42em; }
#levelup .sub { font-size:12px; color:#8b8378; margin-bottom:26px; letter-spacing:.06em; }
#levelup .cards { display:flex; gap:16px; justify-content:center; }
#levelup button { width:196px; padding:24px 18px 20px; text-align:left; cursor:pointer;
  background:linear-gradient(180deg,#1e1712,#14100d); color:#e9e2d6;
  border:1px solid #3d332b; border-radius:6px; font:inherit;
  transition:border-color .14s, transform .14s, box-shadow .14s; }
#levelup button:hover { border-color:#c8974e; transform:translateY(-4px);
  box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 0 1px rgba(200,151,78,.25); }
#levelup .tag { font-size:10px; letter-spacing:.2em; color:#9b7b4a; margin-bottom:12px; }
#levelup .name { font-size:19px; font-weight:800; margin-bottom:8px; }
#levelup .desc { font-size:13px; color:#a49a8c; line-height:1.5; }
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
  show(level, choices) {
    return new Promise(resolve => {
      this._resolve = resolve
      this._choices = choices
      this.el.innerHTML = `
        <div class="wrap">
          <h2>레벨 ${level}</h2>
          <div class="sub">하나를 고른다</div>
          <div class="cards">
            ${choices.map((u, i) => `
              <button data-i="${i}">
                <div class="tag">${u.tag}<span class="num">${i + 1}</span></div>
                <div class="name">${u.name}</div>
                <div class="desc">${u.desc}</div>
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
