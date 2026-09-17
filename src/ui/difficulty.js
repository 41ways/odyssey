import { installTheme, meanderURI, laurelURI } from './theme.js'

/**
 * 난이도 고르기 — 시작 화면이 물에 풀린 다음 나오는 첫 화면.
 *
 * 숫자로 '쉬움·보통·어려움' 이라 쓰지 않는다. 오디세우스가 무엇을 걸고
 * 배를 띄우는지로 고른다. 고른 값은 딱 두 군데만 건드린다 —
 * 내가 맞는 양과 적의 맷집. 규칙을 더 늘리면 무엇 때문에 죽었는지 모르게 된다.
 */
export const SAILS = [
  {
    id: 'calm', tag: '순풍',
    name: '잔잔한 바다',
    line: '받는 피해 −30% · 적 체력 −15%',
    flavor: '아이올로스가 자루의 입을 묶어 주었다. 아직은.',
    takeMul: 0.7, hpMul: 0.85,
  },
  {
    id: 'voyage', tag: '뱃길',
    name: '이야기대로',
    line: '손대지 않는다',
    flavor: '시인이 부른 그대로의 스무 해.',
    takeMul: 1, hpMul: 1,
  },
  {
    id: 'wrath', tag: '노여움',
    name: '포세이돈의 분노',
    line: '받는 피해 +45% · 적 체력 +30%',
    flavor: '바다의 신은 아들의 눈을 기억한다.',
    takeMul: 1.45, hpMul: 1.3,
  },
]

const CSS = `
#diff { position:absolute; inset:0; z-index:78; display:none; pointer-events:none;
  font-family:var(--body); overflow:hidden; background:
    radial-gradient(ellipse 80% 60% at 50% 34%, rgba(232,201,138,.10), transparent 64%),
    linear-gradient(180deg, #0a0806 0%, #100c07 55%, #060403 100%); }
/* 바탕은 켜는 순간 꽉 찬다. 서서히 드러내면 그 틈으로 뒤의 판이 비친다 */
#diff.on { display:block; pointer-events:auto; cursor:default; }

#diff .wrap { position:absolute; inset:0; display:grid; place-items:center; align-content:center;
  padding:0 24px; }
#diff .head { text-align:center; opacity:0; transform:translateY(12px);
  transition:opacity 1.0s ease .25s, transform 1.0s cubic-bezier(.2,.9,.3,1) .25s; }
#diff.up .head { opacity:1; transform:none; }
#diff .band { height:14px; width:min(520px, 76vw); margin:0 auto;
  background-image:${meanderURI()}; background-repeat:repeat-x;
  background-position:center; opacity:.45; }
#diff .crown { display:flex; align-items:center; justify-content:center; gap:26px; margin:24px 0 4px; }
#diff .laurel { width:24px; height:56px; background-image:${laurelURI()};
  background-repeat:no-repeat; background-size:contain; }
#diff .laurel.r { transform:scaleX(-1); }
#diff h2 { margin:0; font-family:var(--display); font-size:clamp(30px, 4.4vw, 46px);
  font-weight:700; letter-spacing:.06em; color:var(--ivory);
  text-shadow:0 0 60px rgba(232,200,132,.4), 0 6px 26px #000; }
#diff .sub { font-family:var(--serif); font-size:12.5px; letter-spacing:.38em;
  text-indent:.38em; color:var(--gold); opacity:.72; margin-top:14px; }

#diff .cards { display:flex; gap:18px; justify-content:center; margin-top:44px;
  width:min(1000px, 92vw); }
#diff button { flex:1 1 0; min-width:0; padding:0 0 22px; text-align:left; cursor:pointer;
  color:var(--ivory); font:inherit; border:1px solid #5b4a2a; border-radius:4px;
  background:linear-gradient(180deg, rgba(42,33,18,.92) 0%, rgba(26,20,11,.95) 46%, rgba(14,10,6,.97) 100%);
  box-shadow:inset 0 0 0 1px rgba(232,201,138,.13), 0 22px 52px rgba(0,0,0,.7);
  opacity:0; transform:translateY(18px);
  transition:opacity .9s ease, transform .6s cubic-bezier(.2,.9,.3,1),
             border-color .16s, box-shadow .16s; position:relative; overflow:hidden; }
#diff.up button { opacity:1; transform:none; }
#diff.up button:nth-child(1) { transition-delay:.55s, .55s, 0s, 0s; }
#diff.up button:nth-child(2) { transition-delay:.70s, .70s, 0s, 0s; }
#diff.up button:nth-child(3) { transition-delay:.85s, .85s, 0s, 0s; }
#diff button:hover { transform:translateY(-8px); border-color:#ffd88a;
  box-shadow:inset 0 0 0 1px rgba(255,216,138,.5), 0 30px 66px rgba(0,0,0,.8),
             0 0 50px rgba(255,205,120,.24); }
#diff button .top { height:13px; background-image:${meanderURI()};
  background-repeat:repeat-x; background-position:center; opacity:.45; }
#diff button:hover .top { opacity:1; }
#diff .pad { padding:18px 20px 0; }
#diff .tag { font-family:var(--serif); font-size:10px; letter-spacing:.26em;
  color:#a88c52; margin-bottom:11px; }
#diff .dname { font-family:var(--serif); font-size:23px; font-weight:700;
  margin-bottom:12px; color:#fff1d6; }
#diff .dline { font-size:12.5px; line-height:1.7; color:#f0cf93; font-weight:700; }
#diff .dflavor { font-size:11.5px; line-height:1.7; color:#95866c; margin-top:13px;
  padding-top:12px; border-top:1px solid #45381f; }
#diff .num { position:absolute; top:20px; right:15px; font-family:var(--serif);
  font-size:10px; color:#8a7548; border:1px solid #4d3f22; border-radius:2px; padding:2px 6px; }

@media (max-width: 760px) {
  #diff .cards { flex-direction:column; width:min(420px, 92vw); }
}
`

export class DifficultyScreen {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'diff'
    root.appendChild(this.el)
    this.onKey = this.onKey.bind(this)
  }

  /** @returns {Promise<typeof SAILS[number]>} */
  show() {
    return new Promise(resolve => {
      this._resolve = resolve
      this.el.innerHTML = `
        <div class="wrap">
          <div class="head">
            <div class="band"></div>
            <div class="crown">
              <div class="laurel"></div>
              <h2>Choose your sea</h2>
              <div class="laurel r"></div>
            </div>
            <div class="sub">어떤 바다를 건널 것인가</div>
          </div>
          <div class="cards">
            ${SAILS.map((s, i) => `
              <button data-i="${i}">
                <div class="top"></div>
                <span class="num">${i + 1}</span>
                <div class="pad">
                  <div class="tag">${s.tag}</div>
                  <div class="dname">${s.name}</div>
                  <div class="dline">${s.line}</div>
                  <div class="dflavor">${s.flavor}</div>
                </div>
              </button>`).join('')}
          </div>
        </div>`
      this.el.classList.add('on')
      requestAnimationFrame(() => this.el.classList.add('up'))
      // 창이 숨어 있으면 rAF 가 안 돈다. 한 번 더 밀어 준다.
      setTimeout(() => this.el.classList.add('up'), 60)
      document.body.style.cursor = 'default'
      for (const b of this.el.querySelectorAll('button')) {
        b.addEventListener('click', () => this.pick(+b.dataset.i))
      }
      addEventListener('keydown', this.onKey)
    })
  }

  onKey(e) {
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
    if (i >= 0) { e.preventDefault(); this.pick(i) }
  }

  pick(i) {
    if (!this._resolve) return
    const r = this._resolve
    this._resolve = null
    removeEventListener('keydown', this.onKey)
    this.el.classList.remove('up')
    document.body.style.cursor = ''
    setTimeout(() => this.el.classList.remove('on'), 420)
    r(SAILS[i])
  }
}
