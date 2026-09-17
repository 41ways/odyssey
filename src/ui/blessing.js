import { installTheme, meanderURI, laurelURI } from './theme.js'

/**
 * 아테나의 은총 화면.
 *
 * 저승이 보랏빛과 재라면 이쪽은 금빛과 올리브다.
 * 같은 틀을 쓰되 색과 문양이 반대편에 서야 "다른 신"으로 읽힌다.
 *
 * 여신을 가운데 세우면 글과 카드가 그 위에 얹혀 얼굴을 가린다.
 * 왼쪽에 세워 두고 오른쪽 한 단으로 말을 받는다 — 서로를 안 덮는다.
 *
 * 글단은 화면 오른쪽 끝이 아니라 여신 옆에 붙인다. 끝에 붙여 두면
 * 넓은 화면에서 둘 사이가 허허벌판이 되고, 시선이 한 번 더 건너뛰어야 한다.
 *
 * 초상은 public/img/athena.webp 를 쓴다. 없으면 올빼미 문양으로 대체한다.
 */
const PORTRAIT = '/img/athena.webp?v=2'

/** 사진이 없을 때 — 아테나의 올빼미. */
const owlSVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <defs><radialGradient id="g" cx="50%" cy="42%" r="60%">
    <stop offset="0%" stop-color="#f0dca8"/><stop offset="55%" stop-color="#8a7038"/><stop offset="100%" stop-color="#2e2512" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="420" height="420" fill="url(#g)" opacity=".5"/>
  <g fill="none" stroke="#e8c98a" stroke-width="4" stroke-linecap="round">
    <path d="M210 96 C150 96 118 142 118 196 C118 268 160 316 210 316 C260 316 302 268 302 196 C302 142 270 96 210 96 Z"/>
    <circle cx="172" cy="190" r="30"/><circle cx="248" cy="190" r="30"/>
    <path d="M210 206 l-16 22 h32 z" fill="#e8c98a"/>
    <path d="M150 112 l24 30 M270 112 l-24 30"/>
    <path d="M176 300 v26 M244 300 v26"/>
  </g>
  <g fill="#e8c98a"><circle cx="172" cy="190" r="10"/><circle cx="248" cy="190" r="10"/></g>
</svg>`)

const CSS = `
#bless { position:absolute; inset:0; z-index:56; display:none; pointer-events:none;
  font-family:var(--body); overflow:hidden;
  background:
    radial-gradient(ellipse 66% 48% at 50% 26%, rgba(232,201,138,.24), transparent 62%),
    radial-gradient(ellipse 90% 55% at 50% 100%, rgba(120,150,110,.12), transparent 62%),
    linear-gradient(180deg, #0a0805 0%, #120e07 52%, #070502 100%); }
#bless.on { display:block; pointer-events:auto; cursor:default; }

/* 빛기둥 — 위에서 내려온다 */
#bless .beam { position:absolute; left:23%; top:-10%; width:34vw; height:120vh;
  transform:translateX(-50%) scaleY(.2); transform-origin:50% 0%; opacity:0;
  background:radial-gradient(ellipse 58% 96% at 50% 2%,
    rgba(255,232,170,.36), rgba(255,220,140,.11) 44%, transparent 76%);
  filter:blur(10px); transition:transform 1.0s cubic-bezier(.2,.9,.3,1), opacity .8s ease; }
#bless.up .beam { transform:translateX(-50%) scaleY(1); opacity:1; }

#bless .figure { position:absolute; left:23%; bottom:-2vh; transform:translate(-50%, -14%);
  height:97vh; opacity:0; transition:transform 1.2s cubic-bezier(.16,.9,.3,1), opacity 1.0s ease; }
#bless.up .figure { transform:translate(-50%, 0); opacity:1; }
#bless .figure img { height:100%; width:auto; max-width:none; display:block;
  filter:contrast(1.04) brightness(1.04)
    drop-shadow(0 0 34px rgba(255,220,150,.5)) drop-shadow(0 0 96px rgba(200,160,70,.4)); }
#bless .figure .halo { position:absolute; left:50%; top:34%; width:74vh; height:74vh;
  transform:translate(-50%,-50%); z-index:-1; pointer-events:none;
  background:radial-gradient(circle, rgba(255,226,160,.40), rgba(180,140,60,.16) 38%, transparent 66%); }

#bless .said { position:absolute; left:39%; top:50%; width:min(900px, 58vw);
  transform:translateY(-230px); text-align:left;
  opacity:0; transition:opacity .7s ease .5s; }
#bless.up .said { opacity:1; }
#bless .band { height:14px; background-image:${meanderURI('#e8c98a', 0.95)};
  background-repeat:repeat-x; background-position:center; opacity:.45; }
#bless .crown { display:flex; align-items:center; justify-content:flex-start; gap:22px; margin-top:14px; }
#bless .laurel { width:26px; height:62px; background-image:${laurelURI('#e8c98a')};
  background-repeat:no-repeat; background-size:contain; }
#bless .laurel.r { transform:scaleX(-1); }
#bless .said h2 { font-family:var(--serif); font-size:clamp(30px, 3.2vw, 44px); white-space:nowrap; font-weight:700;
  letter-spacing:.26em; text-indent:.26em; color:#fff2d4; margin:0 0 6px;
  text-shadow:0 0 70px rgba(255,214,130,.75), 0 0 26px rgba(255,214,130,.5), 0 6px 26px #000; }
#bless .said .t { font-size:12.5px; letter-spacing:.34em; color:#c3a877; margin:2px 0 18px 4px; }
#bless .said p { font-size:15px; line-height:2.0; color:#cdba95; text-shadow:0 2px 14px #000; }
#bless .said p em { color:#fff3da; font-style:normal; }

#bless .cards { position:absolute; left:39%; top:50%; width:min(900px, 58vw);
  transform:translateY(-10px);
  display:flex; gap:16px; justify-content:flex-start; opacity:0;
  transition:opacity .6s ease .85s; }
#bless.up .cards { opacity:1; }
#bless button { flex:1 1 0; min-width:0; padding:0 0 18px; text-align:left; cursor:pointer;
  color:var(--ivory); font:inherit; border:1px solid #6d5a32; border-radius:4px;
  background:linear-gradient(180deg, rgba(44,34,18,.94) 0%, rgba(28,21,11,.96) 45%, rgba(15,11,6,.97) 100%);
  box-shadow:inset 0 0 0 1px rgba(232,201,138,.16), 0 24px 56px rgba(0,0,0,.72);
  transition:border-color .16s, transform .16s, box-shadow .16s; overflow:hidden; position:relative; }
#bless button:hover { transform:translateY(-8px); border-color:#ffd88a;
  box-shadow:inset 0 0 0 1px rgba(255,216,138,.55), 0 32px 70px rgba(0,0,0,.8), 0 0 54px rgba(255,205,120,.3); }
#bless button .top { height:13px; background-image:${meanderURI('#e8c98a', 0.95)};
  background-repeat:repeat-x; background-position:center; opacity:.5; }
#bless button:hover .top { opacity:1; }
#bless .pad { padding:16px 18px 0; }
#bless .tag { font-family:var(--serif); font-size:10px; letter-spacing:.24em;
  color:#a88c52; margin-bottom:10px; }
#bless .bname { font-family:var(--serif); font-size:18px; font-weight:700;
  margin-bottom:10px; color:#fff1d6; }
#bless .bdesc { font-size:13px; line-height:1.75; color:#f0cf93; font-weight:700; }
#bless .bflavor { font-size:11px; line-height:1.65; color:#95866c; margin-top:12px;
  padding-top:11px; border-top:1px solid #45381f; }
#bless .num { position:absolute; top:19px; right:14px; font-family:var(--serif);
  font-size:10px; color:#8a7548; border:1px solid #4d3f22; border-radius:2px; padding:2px 6px; }
`

/* 좁은 화면에서는 여신을 뒤로 물리고 글을 가운데로 */
const NARROW = `
@media (max-width: 900px) {
  #bless .figure { left:50%; opacity:.28; }
  #bless.up .figure { opacity:.28; }
  #bless .said, #bless .cards { left:50%; width:min(600px, 92vw);
    transform:translateX(-50%) translateY(-220px); }
  #bless .cards { transform:translateX(-50%) translateY(-20px); }
}`

export class BlessingScreen {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS + NARROW
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'bless'
    root.appendChild(this.el)
    this.onKey = this.onKey.bind(this)
  }

  get open() { return this.el.classList.contains('on') }

  show({ said, choices }) {
    return new Promise(resolve => {
      this._resolve = resolve
      this._choices = choices
      this.el.innerHTML = `
        <div class="beam"></div>
        <div class="figure">
          <div class="halo"></div>
          <img src="${PORTRAIT}" alt=""
            onerror="this.src='data:image/svg+xml;charset=utf-8,${owlSVG}'">
        </div>
        <div class="said">
          <div class="band"></div>
          <div class="crown"><div class="laurel"></div>
            <h2>아테나의 은총</h2>
          <div class="laurel r"></div></div>
          <div class="t">회색 눈의 여신</div>
          <p>${said}</p>
        </div>
        <div class="cards">
          ${choices.map((b, i) => `
            <button data-i="${i}">
              <div class="top"></div>
              <span class="num">${i + 1}</span>
              <div class="pad">
                <div class="tag">${b.tag}</div>
                <div class="bname">${b.name}</div>
                <div class="bdesc">${b.desc}</div>
                <div class="bflavor">${b.flavor}</div>
              </div>
            </button>`).join('')}
        </div>`
      this.el.classList.add('on')
      setTimeout(() => this.el.classList.add('up'), 30)
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
    this.el.classList.remove('on', 'up')
    document.body.style.cursor = ''
    r(this._choices[i])
  }
}
