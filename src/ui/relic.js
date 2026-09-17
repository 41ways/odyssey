import { installTheme, meanderURI } from './theme.js'

/**
 * 저승의 유물 고르기.
 *
 * 성장 선택지와 같은 카드로 만들면 "또 카드 세 장"이 된다.
 * 저승은 한 번뿐이고 여기서 고른 것이 끝까지 간다 — 화면부터 달라야 한다.
 * 위에는 말을 거는 망자, 아래에 유물 셋.
 *
 * 초상은 public/img/agamemnon.png 를 쓴다. 없으면 그림자 형상으로 대체한다.
 */
const PORTRAIT = '/img/agamemnon.webp'

/** 사진이 없을 때 쓰는 그림자. 빈 칸으로 두는 것보다 낫다. */
const shadeSVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="260" height="300" viewBox="0 0 260 300">
  <defs>
    <radialGradient id="g" cx="50%" cy="34%" r="62%">
      <stop offset="0%" stop-color="#6a5a86"/><stop offset="60%" stop-color="#2b2338"/><stop offset="100%" stop-color="#14101c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8e7fb0"/><stop offset="100%" stop-color="#241d33"/>
    </linearGradient>
  </defs>
  <rect width="260" height="300" fill="url(#g)"/>
  <g fill="url(#b)" opacity="0.92">
    <ellipse cx="130" cy="112" rx="46" ry="56"/>
    <path d="M130 168 C 74 172 52 214 46 300 L214 300 C208 214 186 172 130 168 Z"/>
    <path d="M100 132 C104 178 156 178 160 132 C156 160 104 160 100 132 Z" opacity="0.85"/>
  </g>
  <g fill="none" stroke="#c8973e" stroke-opacity="0.5" stroke-width="2">
    <path d="M88 96 q42 -34 84 0"/>
  </g>
  <g fill="#0c0a12"><ellipse cx="112" cy="106" rx="8" ry="6"/><ellipse cx="148" cy="106" rx="8" ry="6"/></g>
</svg>`)

const CSS = `
#relic { position:absolute; inset:0; z-index:55; display:none; place-items:center;
  pointer-events:none; font-family:var(--body); overflow:hidden;
  background:
    radial-gradient(ellipse 70% 50% at 50% 22%, rgba(120,92,180,.22), transparent 62%),
    radial-gradient(ellipse 90% 60% at 50% 100%, rgba(150,40,50,.14), transparent 60%),
    linear-gradient(180deg, #06050a 0%, #0b0810 55%, #050408 100%); }
#relic.on { display:grid; pointer-events:auto; cursor:default; }
#relic .ash { position:absolute; inset:0; pointer-events:none; }
#relic .ash i { position:absolute; width:3px; height:3px; border-radius:50%;
  background:#c8b28a; opacity:.0; }

#relic .wrap { position:relative; text-align:center; width:min(1000px, 94vw); }
#relic .band { height:14px; background-image:${meanderURI('#9b7bd0', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.45; }

#relic .who { display:flex; align-items:flex-end; justify-content:center; gap:22px; margin:14px 0 2px; }
/* 액자에 넣으면 사진이 되고, 아래를 어둠에 녹이면 떠오른 형상이 된다 */
#relic .frame { position:relative; width:250px; height:310px; flex:none; }
#relic .frame img { position:relative; z-index:1; width:100%; height:100%;
  object-fit:contain; object-position:50% 100%;
  filter:grayscale(.2) contrast(1.06) brightness(.95) drop-shadow(0 0 28px rgba(140,110,200,.45));
  -webkit-mask-image:linear-gradient(180deg, #000 0%, #000 74%, transparent 97%);
  mask-image:linear-gradient(180deg, #000 0%, #000 74%, transparent 97%); }
#relic .frame .glow { position:absolute; left:50%; top:46%; width:300px; height:300px;
  transform:translate(-50%,-50%); pointer-events:none;
  background:radial-gradient(circle, rgba(140,110,200,.34), rgba(90,60,150,.12) 46%, transparent 70%); }
#relic .said { text-align:left; max-width:500px; padding-bottom:44px; }
#relic .said h2 { font-family:var(--serif); font-size:28px; font-weight:700;
  letter-spacing:.2em; color:#d9cdea; margin-bottom:6px;
  text-shadow:0 0 34px rgba(140,110,200,.45); }
#relic .said .t { font-size:11px; letter-spacing:.24em; color:#8a7bb0; margin-bottom:14px; }
#relic .said p { font-size:14px; line-height:1.95; color:#a99cc0; }
#relic .said p em { color:#e6dcf4; font-style:normal; }

#relic .cards { display:flex; gap:20px; justify-content:center; margin-top:28px; }
#relic button { width:266px; padding:0 0 24px; text-align:left; cursor:pointer;
  color:var(--ivory); font:inherit; border:1px solid #4a3c66; border-radius:4px;
  background:linear-gradient(180deg,#191426 0%,#120d1c 45%,#0a0711 100%);
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.12), 0 20px 52px rgba(0,0,0,.6);
  transition:border-color .16s, transform .16s, box-shadow .16s; overflow:hidden; position:relative; }
#relic button:hover { transform:translateY(-7px); border-color:var(--bronze);
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.45), 0 28px 62px rgba(0,0,0,.7), 0 0 44px rgba(155,123,208,.2); }
#relic button .top { height:14px; background-image:${meanderURI('#c8973e', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.45; }
#relic button:hover .top { opacity:.95; }
#relic .sigil { width:74px; height:74px; margin:20px auto 14px; }
#relic .pad { padding:0 22px; }
#relic .rname { font-family:var(--serif); font-size:21px; font-weight:700;
  text-align:center; letter-spacing:.05em; margin-bottom:14px; color:#f0e4d0; }
#relic .rdesc { font-size:12.5px; line-height:1.75; color:#e0bd85; font-weight:700; }
#relic .rflavor { font-size:11.5px; line-height:1.7; color:#8a8074; margin-top:14px;
  padding-top:13px; border-top:1px solid #33294a; }
#relic .num { position:absolute; top:22px; right:16px; font-family:var(--serif);
  font-size:10px; color:#6f5f90; border:1px solid #3d3358; border-radius:2px; padding:2px 7px; }
#relic .foot { margin-top:26px; font-family:var(--serif); font-size:11px;
  letter-spacing:.32em; color:#6f6580; }
`

/** 유물마다 다른 문장(紋章). 카드가 세 장 다 똑같아 보이지 않게. */
const SIGILS = {
  wax: `<svg viewBox="0 0 64 64" fill="none" stroke="#c8973e" stroke-width="2.2">
    <path d="M32 8c-11 0-19 9-19 21 0 9 4 13 4 20 0 5 4 7 8 7"/>
    <path d="M32 8c11 0 19 9 19 21 0 9-4 13-4 20 0 5-4 7-8 7"/>
    <circle cx="32" cy="34" r="9" fill="#c8973e" fill-opacity=".25"/>
    <path d="M23 46h18"/></svg>`,
  aegis: `<svg viewBox="0 0 64 64" fill="none" stroke="#c8973e" stroke-width="2.2">
    <path d="M32 6 54 14v20c0 13-10 21-22 24C20 55 10 47 10 34V14z"/>
    <circle cx="32" cy="30" r="8" fill="#c8973e" fill-opacity=".2"/>
    <path d="M32 22v-6M32 38v6M24 30h-6M40 30h6M26 24l-4-4M38 24l4-4M26 36l-4 4M38 36l4 4"/></svg>`,
  spear: `<svg viewBox="0 0 64 64" fill="none" stroke="#c8973e" stroke-width="2.2">
    <path d="M32 4 41 22 32 30 23 22z" fill="#c8973e" fill-opacity=".25"/>
    <path d="M32 30v28"/><path d="M26 34h12"/><path d="M28 58h8"/></svg>`,
}

export class RelicScreen {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)

    this.el = document.createElement('div')
    this.el.id = 'relic'
    root.appendChild(this.el)
    this.onKey = this.onKey.bind(this)
  }

  get open() { return this.el.classList.contains('on') }

  show({ name = '아가멤논', title = '뮈케네의 왕이었던 것', said, relics }) {
    return new Promise(resolve => {
      this._resolve = resolve
      this._relics = relics
      this.el.innerHTML = `
        <div class="ash">${Array.from({ length: 34 }, (_, i) => {
          const l = Math.random() * 100, d = (Math.random() * 9).toFixed(1), s = (7 + Math.random() * 7).toFixed(1)
          return `<i style="left:${l.toFixed(1)}%;bottom:-8px;animation:ashUp ${s}s linear ${d}s infinite"></i>`
        }).join('')}</div>
        <div class="wrap">
          <div class="band"></div>
          <div class="who">
            <div class="frame">
              <div class="glow"></div>
              <img src="${PORTRAIT}" alt=""
                onerror="this.src='data:image/svg+xml;charset=utf-8,${shadeSVG}'">
            </div>
            <div class="said">
              <h2>${name}</h2>
              <div class="t">${title}</div>
              <p>${said}</p>
            </div>
          </div>
          <div class="cards">
            ${relics.map((r, i) => `
              <button data-i="${i}">
                <div class="top"></div>
                <span class="num">${i + 1}</span>
                <div class="sigil">${SIGILS[r.id] ?? ''}</div>
                <div class="pad">
                  <div class="rname">${r.name}</div>
                  <div class="rdesc">${r.desc}</div>
                  <div class="rflavor">${r.flavor}</div>
                </div>
              </button>`).join('')}
          </div>
          <div class="foot">하나만 가져갈 수 있다</div>
          <div class="band" style="margin-top:22px"></div>
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
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
    if (i >= 0 && i < this._relics.length) { e.preventDefault(); this.pick(i) }
  }

  pick(i) {
    if (!this._resolve) return
    const r = this._resolve
    this._resolve = null
    removeEventListener('keydown', this.onKey)
    this.el.classList.remove('on')
    document.body.style.cursor = ''
    r(this._relics[i])
  }
}

// 재가 떠오른다
const ashKeyframes = document.createElement('style')
ashKeyframes.textContent = `@keyframes ashUp {
  0% { transform:translateY(0) translateX(0); opacity:0 }
  12% { opacity:.55 }
  100% { transform:translateY(-105vh) translateX(28px); opacity:0 } }`
document.head.appendChild(ashKeyframes)
