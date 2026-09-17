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
#relic { position:absolute; inset:0; z-index:55; display:none; pointer-events:none;
  font-family:var(--body); overflow:hidden;
  background:
    radial-gradient(ellipse 70% 50% at 50% 30%, rgba(120,92,180,.20), transparent 62%),
    radial-gradient(ellipse 90% 55% at 50% 100%, rgba(150,40,60,.16), transparent 62%),
    linear-gradient(180deg, #06050a 0%, #0b0810 55%, #050408 100%); }
#relic.on { display:block; pointer-events:auto; cursor:default; }
#relic .ash { position:absolute; inset:0; pointer-events:none; }
#relic .ash i { position:absolute; width:3px; height:3px; border-radius:50%;
  background:#c8b28a; opacity:0; }

/* 아래에서 솟아올라 화면 아래 절반을 덮는다 */
#relic .shade { position:absolute; left:50%; bottom:-3vh; transform:translate(-50%, 26%);
  height:94vh; opacity:0; transition:transform 1.1s cubic-bezier(.16,.9,.3,1), opacity .9s ease; }
#relic.up .shade { transform:translate(-50%, 0); opacity:1; }
#relic .shade img { height:100%; width:auto; max-width:none; display:block;
  filter:contrast(1.05) brightness(1.0)
    drop-shadow(0 0 34px rgba(170,138,240,.55)) drop-shadow(0 0 90px rgba(120,86,200,.45)); }
/* 후광 두 겹 — 안쪽은 좁고 세게, 바깥은 넓고 옅게.
   실루엣 경계가 빛에 묻혀서 잘린 자리가 눈에 안 띈다 */
#relic .shade .glow { position:absolute; left:50%; top:46%; width:82vh; height:82vh;
  transform:translate(-50%,-50%); pointer-events:none; z-index:-1;
  background:radial-gradient(circle, rgba(165,132,235,.42), rgba(110,74,180,.18) 38%, transparent 66%); }
#relic .shade .glow2 { position:absolute; left:50%; top:52%; width:150vh; height:110vh;
  transform:translate(-50%,-50%); pointer-events:none; z-index:-2;
  background:radial-gradient(ellipse, rgba(120,88,190,.22), rgba(70,44,120,.08) 42%, transparent 70%); }

/* 머리 위에 이름과 말 */
#relic .said { position:absolute; left:50%; top:3.5vh; transform:translateX(-50%);
  width:min(700px, 90vw); text-align:center; opacity:0; transition:opacity .7s ease .45s; }
#relic.up .said { opacity:1; }
#relic .band { height:14px; background-image:${meanderURI('#9b7bd0', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.4; }
#relic .said h2 { font-family:var(--serif); font-size:52px; font-weight:700;
  letter-spacing:.26em; text-indent:.26em; color:#e8dcf8; margin:18px 0 8px;
  text-shadow:0 0 70px rgba(150,118,215,.7), 0 0 28px rgba(150,118,215,.5), 0 6px 26px #000; }
#relic .said .t { font-size:12.5px; letter-spacing:.34em; color:#9a89c4; margin-bottom:18px; }
#relic .said p { font-size:15px; line-height:2.0; color:#b8abd2;
  text-shadow:0 2px 14px #000; }
#relic .said p em { color:#efe6ff; font-style:normal; }

/* 벌린 양팔 사이 — 세 장이 여기 들어간다 */
#relic .cards { position:absolute; left:50%; bottom:20vh; transform:translateX(-50%);
  display:flex; gap:16px; justify-content:center; opacity:0;
  transition:opacity .6s ease .75s, transform .6s cubic-bezier(.2,.8,.3,1) .75s; }
#relic.up .cards { opacity:1; }
#relic button { width:min(228px, 24vw); padding:0 0 20px; text-align:left; cursor:pointer;
  color:var(--ivory); font:inherit; border:1px solid #57456f; border-radius:4px;
  background:linear-gradient(180deg, rgba(31,24,45,.94) 0%, rgba(18,13,28,.96) 45%, rgba(10,7,17,.97) 100%);
  backdrop-filter:blur(3px);
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.14), 0 24px 56px rgba(0,0,0,.72);
  transition:border-color .16s, transform .16s, box-shadow .16s; overflow:hidden; position:relative; }
#relic button:hover { transform:translateY(-8px); border-color:var(--bronze);
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.5), 0 32px 70px rgba(0,0,0,.8), 0 0 50px rgba(155,123,208,.28); }
#relic button .top { height:13px; background-image:${meanderURI('#c8973e', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.45; }
#relic button:hover .top { opacity:1; }
#relic .sigil { width:62px; height:62px; margin:16px auto 10px; }
#relic .pad { padding:0 18px; }
#relic .rname { font-family:var(--serif); font-size:19px; font-weight:700;
  text-align:center; letter-spacing:.04em; margin-bottom:11px; color:#f4e9d6; }
#relic .rdesc { font-size:12px; line-height:1.7; color:#e4c391; font-weight:700; }
#relic .rflavor { font-size:11px; line-height:1.65; color:#8f8478; margin-top:11px;
  padding-top:10px; border-top:1px solid #3a2f52; }
#relic .num { position:absolute; top:20px; right:14px; font-family:var(--serif);
  font-size:10px; color:#7a6a9c; border:1px solid #453a63; border-radius:2px; padding:2px 6px; }
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

  show({ name = '아가멤논', title = '미케네 3대 국왕', said, relics }) {
    return new Promise(resolve => {
      this._resolve = resolve
      this._relics = relics
      this.el.innerHTML = `
        <div class="ash">${Array.from({ length: 34 }, () => {
          const l = Math.random() * 100, d = (Math.random() * 9).toFixed(1), s = (7 + Math.random() * 7).toFixed(1)
          return `<i style="left:${l.toFixed(1)}%;bottom:-8px;animation:ashUp ${s}s linear ${d}s infinite"></i>`
        }).join('')}</div>

        <div class="shade">
          <div class="glow2"></div>
          <div class="glow"></div>
          <img src="${PORTRAIT}" alt=""
            onerror="this.src='data:image/svg+xml;charset=utf-8,${shadeSVG}'">
        </div>

        <div class="said">
          <div class="band"></div>
          <h2>${name}</h2>
          <div class="t">${title}</div>
          <p>${said}</p>
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
        </div>`
      this.el.classList.add('on')
      // 한 박자 뒤에 켜야 transition 이 먹는다 — 솟아오르는 게 보여야 한다.
      // rAF 는 창이 숨겨져 있으면 안 돌아서 타이머를 쓴다.
      setTimeout(() => this.el.classList.add('up'), 30)
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
    this.el.classList.remove('up')
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
