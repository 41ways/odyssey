import { installTheme, meanderURI, laurelURI } from './theme.js'

/**
 * 시작 화면.
 * 흑색상 도기 한 장을 펼친 것처럼 — 뇌문 띠 두 줄 사이에 제목, 양옆에 월계.
 */
const CSS = `
#title { position:absolute; inset:0; z-index:80; display:grid; place-items:center;
  background:
    radial-gradient(ellipse 120% 80% at 50% 40%, rgba(140,58,36,.20), transparent 70%),
    linear-gradient(180deg, #0b0705 0%, #150d08 45%, #0a0604 100%);
  font-family:var(--body); opacity:1; transition:opacity .6s; }
#title.gone { opacity:0; pointer-events:none; }
#title .plate { text-align:center; padding:0 28px; max-width:760px; }
#title .band { height:14px; background-image:${meanderURI('#c8973e', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.6; }
#title .crown { display:flex; align-items:center; justify-content:center; gap:26px; margin:34px 0 10px; }
#title .laurel { width:26px; height:62px; background-image:${laurelURI()};
  background-repeat:no-repeat; }
#title .laurel.r { transform:scaleX(-1); }
#title h1 { font-family:var(--serif); font-size:64px; font-weight:900;
  letter-spacing:.3em; text-indent:.3em; color:var(--ivory);
  text-shadow:0 0 44px rgba(200,151,62,.35), 0 6px 26px #000; }
#title .greek { font-family:var(--serif); font-size:14px; letter-spacing:.52em;
  text-indent:.52em; color:var(--bronze); opacity:.7; margin-top:6px; }
#title .line { margin:26px auto 0; max-width:520px; font-size:14.5px; line-height:2;
  color:var(--ivory-dim); }
#title .line em { color:var(--ivory); font-style:normal; }
#title .go { margin-top:40px; font-family:var(--serif); font-size:13px; letter-spacing:.34em;
  text-indent:.34em; color:var(--ivory); animation:pulse 2.1s ease-in-out infinite; }
#title .keys { margin-top:22px; font-size:12px; color:#6f6455; letter-spacing:.06em; line-height:2; }
#title .keys b { color:var(--bronze); font-weight:700; }
@keyframes pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
`

export class TitleScreen {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)

    this.el = document.createElement('div')
    this.el.id = 'title'
    this.el.innerHTML = `
      <div class="plate">
        <div class="band"></div>
        <div class="crown">
          <div class="laurel"></div>
          <h1>오디세이</h1>
          <div class="laurel r"></div>
        </div>
        <div class="greek">ΟΔΥΣΣΕΙΑ</div>
        <div class="line">
          트로이는 불탔고 배는 열두 척이었다.<br>
          바다가 <em>스무 해</em>를 붙들었고, 아홉 번 뭍에 닿았다.<br>
          마지막 뭍에서 기다린 것은 집이 아니었다.
        </div>
        <div class="go">아무 키나 눌러 시작</div>
        <div class="keys">
          <b>W A S D</b> 이동 · <b>마우스</b> 조준 · <b>좌클릭</b> 칼 · <b>우클릭</b> 활 · <b>Space</b> 구르기
        </div>
        <div class="band" style="margin-top:34px"></div>
      </div>`
    root.appendChild(this.el)
  }

  /** 아무 키나 누를 때까지 기다린다. */
  wait() {
    return new Promise(resolve => {
      const go = () => {
        removeEventListener('keydown', go)
        removeEventListener('pointerdown', go)
        this.el.classList.add('gone')
        setTimeout(() => this.el.remove(), 700)
        resolve()
      }
      addEventListener('keydown', go)
      addEventListener('pointerdown', go)
    })
  }
}
