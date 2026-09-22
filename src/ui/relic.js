import { installTheme, meanderURI } from './theme.js'

/**
 * 저승의 유물 고르기.
 *
 * 성장 선택지와 같은 카드로 만들면 "또 카드 세 장"이 된다.
 * 저승은 한 번뿐이고 여기서 고른 것이 끝까지 간다 — 화면부터 달라야 한다.
 * 위에는 말을 거는 망자, 아래에 유물 셋.
 *
 * 초상은 public/img/agamemnon.webp 를 쓴다. 없으면 그림자 형상으로 대체한다.
 * (원본 PNG 는 art/src-png/ 에 둔다 — 빌드에 실리면 1MB 가 그냥 나간다.)
 */
const PORTRAIT = '/img/agamemnon.webp?v=4'

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
#relic .said { position:absolute; left:50%; top:7vh; transform:translateX(-50%);
  width:min(700px, 90vw); text-align:center; opacity:0; transition:opacity .7s ease .45s; }
#relic.up .said { opacity:1; }
#relic .band { height:14px; background-image:${meanderURI('#9b7bd0', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.4; }
#relic .said h2 { font-family:var(--serif); font-size:clamp(30px, 3.4vw, 46px); font-weight:700;
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
  aegis: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M256 16c25 24 100 72 150 72v96c0 96-75 240-150 312-75-72-150-216-150-312V88c50 0 125-48 150-72z"/></svg>`,
  spear: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M18.506 19.895v37.56L135.11 174.06l33.755-33.757L48.97 19.895H18.507zm296.924 81.607c-8.398 17.695-17.58 34.514-27.555 50.48 53.052 55.6 109.094 165.155 145.602 270.827l6.332 18.327-18.28-6.467c-104.687-37.034-220.62-91.264-274.374-141.967-15.972 9.98-32.793 19.165-50.49 27.563 53.693 35.685 121.57 69.222 189.496 95.166-14.437 7.188-29.938 13.59-46.58 19.27l.002.003c68.264 38.63 175.57 65.47 254.412 64.127 1.33-78.052-27.08-188.95-64.127-254.416-5.76 16.87-12.257 32.57-19.56 47.166-26.458-69.205-60.387-138.182-94.88-190.08zm-117.858 36.523L135.79 199.81c34.207 31.62 67.775 56.763 94.798 71.598 14.454 7.935 27.094 12.95 36.334 14.762 9.24 1.812 13.778.34 15.564-1.445 1.786-1.786 3.26-6.326 1.448-15.565-1.812-9.24-6.83-21.88-14.764-36.334-14.835-27.023-39.976-60.59-71.598-94.8zm79.762 30.08c-4.66 6.81-9.48 13.45-14.457 19.926 8.892 12.557 16.52 24.587 22.676 35.802 8.515 15.51 14.306 29.43 16.718 41.73 2.414 12.3 1.528 24.28-6.57 32.377-8.096 8.096-20.076 8.982-32.376 6.57-12.3-2.413-26.22-8.206-41.73-16.72-11.1-6.094-23-13.632-35.414-22.405a447.782 447.782 0 0 1-22.877 16.76c47.263 42.21 149.664 92.317 245.545 127.873-35.19-95.766-86.347-192.602-131.514-241.913z"/></svg>`,
  // 카산드라 — 아무도 안 믿은 예언. 뜬 눈 하나와, 그래도 맞은 말이 떨어지는 자국.
  curse: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M256.242 19.143a235.119 235.119 0 0 0-30.094 2.107l13.957 18.725L276.9 68.008l-48.474-11.682-22.586-31.424a235.507 235.507 0 0 0-68.522 27.258l4.67 19.35 58.403 10.51-2.335 50.812-17.522-35.623-53.728-9.347-6.063-24.886a233.303 233.303 0 0 0-41.679 38.227l13.866 45.06 54.898 8.176-68.33 13.433-14.633-48.287a238.59 238.59 0 0 0-10.844 17.068c-12.047 20.868-20.527 42.807-25.64 65.114l49.368 23.92 49.06-.58-49.06 21.607-18.105-8.81v25.747h30.37l-49.058 18.69v-53.526l-16.13-7.847c-5.85 41.047-.63 82.657 14.546 120.55l21.44-23.553 12.37 11.498 34.103-12.99-21.453 24.75 16.443 15.285-40.296-12.264-14.17 15.908a233.702 233.702 0 0 0 35.44 51.586l40.896-.158-28.047 13.262a235.939 235.939 0 0 0 43.89 32.63c112.427 64.91 255.91 26.462 320.82-85.964 64.91-112.427 26.464-255.91-85.962-320.82-21.172-12.224-43.447-20.773-66.09-25.862l9.207 25.723-29.07-29.292a233.59 233.59 0 0 0-32.648-2.115zm81.076 126.125c21.167.245 42.198 5.62 61.43 16.72 65.644 37.893 83.97 127.31 42.557 199.026-41.41 71.71-128.022 100.554-193.666 62.662-65.645-37.893-83.97-127.31-42.558-199.026 28.47-49.303 78.305-78.34 128.002-79.363a129.93 129.93 0 0 1 4.234-.02zm-.59 18.67a111.313 111.313 0 0 0-3.654.023c-18.408.41-36.93 5.29-54.09 14.185l34.21 53.44a87.67 87.67 0 0 0-15.227 10.874l-34.947-54.59c-16.317 11.548-30.75 27.068-41.754 46.126a154.29 154.29 0 0 0-2.27 4.092l62.068 24.504a91.416 91.416 0 0 0-8.17 16.867l-61.72-24.366c-10.588 27.475-12.18 56.18-5.824 81.922l62.4-21.23c.464 6.36 1.638 12.59 3.516 18.544l-60.073 20.44c9.103 21.78 24.502 40.32 45.436 52.51l30.73-45a69.422 69.422 0 0 0 14.5 11.904l-28.08 41.12c20.49 7.43 42.64 8.273 64.046 3.23l.31-33.95c6.27.064 12.55-.674 18.71-2.166l-.276 30.12c12.81-5.225 25.06-12.622 36.186-22.013l-11.71-18.29a88.026 88.026 0 0 0 14.808-11.53l10.613 16.578a149.052 149.052 0 0 0 18.654-25.615c1.91-3.307 3.67-6.652 5.294-10.023l-16.094-6.354c2.808-5.71 4.987-11.582 6.504-17.522l16.633 6.566c5.45-16.308 7.792-32.934 7.25-49.018l-22.186 7.55a79.12 79.12 0 0 0-5.09-18.01l25.246-8.588c-3.6-19.748-11.75-38.048-24.008-53.122l-22.637 33.147a69.9 69.9 0 0 0-8.602-5.852 70.564 70.564 0 0 0-7.487-3.725l25.425-37.23a105.562 105.562 0 0 0-46.547-23.094l-.502 54.96c-2.52-.213-5.05-.3-7.58-.248-3.716.073-7.43.437-11.115 1.06l.532-58.135c-1.14-.046-2.28-.078-3.423-.09zm15.786 75.83c3.027.026 6.037.308 9.006.84-7.354 7.116-12.168 18.937-12.168 32.326 0 21.752 12.7 39.384 28.367 39.384 12.172 0 22.55-10.647 26.577-25.597 2.1 14.36-.655 30.18-9.07 44.72-18.287 31.595-55.212 43.19-82.24 27.623-27.03-15.567-35.414-53.21-17.128-84.805 12.57-21.722 33.953-33.99 54.872-34.477a55.738 55.738 0 0 1 1.782-.012z"/></svg>`,
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
