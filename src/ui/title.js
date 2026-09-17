import { installTheme, meanderURI, laurelURI } from './theme.js'

/**
 * 시작 화면.
 *
 * 그림 두 장은 같은 한 컷을 앞뒤로 나눈 것이라 화면에 겹칠 때도 같은 자리에
 * 같은 크기로 놓는다. 마우스를 따라 미는 폭만 다르게 준다 —
 * 먼 것(포세이돈·키클롭스)은 조금, 가까운 것(오디세우스)은 많이.
 * 그 차이가 곧 거리감이다.
 *
 * 크게 확대해 덮으면 포세이돈의 머리가 잘린다. 밀리는 폭이 화면 너비의
 * 1% 도 안 되므로 3% 만 키워도 가장자리는 드러나지 않는다.
 * 앞 장은 발밑을 기준으로 키워야 바위에서 발이 뜨지 않는다.
 *
 * 제목과 시작 글자는 움직이지 않는다. 움직이면 입체가 아니라 흔들림이다.
 */
// public/ 의 그림은 주소가 그대로라 브라우저가 옛 판을 붙들고 있는다.
// 다시 뽑을 때마다 이 숫자를 올린다.
const V = 5
const BACK = `/img/title-back.webp?v=${V}`
const FRONT = `/img/title-front.webp?v=${V}`

const BACK_SCALE = 1.03

/**
 * 앞 장으로 받은 그림은 뒤 장과 같은 판이 아니다 — 같은 1365×768 캔버스인데
 * 인물만 훨씬 크게 그려져 있다. 그대로 겹치면 오디세우스가 화면을 다 막고
 * 포세이돈의 얼굴이 가린다. mainimage 한 장에 둘이 같이 있던 그 크기·자리로
 * 되돌려 놓는다. 값은 mainimage 와 mainimageback 을 빼서 인물만 남긴 뒤
 * 그 자리를 재서 나온 것이다.
 */
const FRONT_SCALE = 0.545
const FRONT_DX = -2.5      // %
const FRONT_DY = 3.6       // %
const FRONT_ORIGIN = '50% 91.4%'    // 발밑. 여기를 축으로 줄여야 바위에서 뜨지 않는다

const CSS = `
#title { position:absolute; inset:0; z-index:80; overflow:hidden;
  background:#070605; font-family:var(--body); opacity:1; transition:opacity 1.2s ease; }
#title.gone { opacity:0; pointer-events:none; }

.tl-stage { position:absolute; inset:0; perspective:1400px; overflow:hidden; }
.tl-layer { position:absolute; inset:0; background-repeat:no-repeat;
  background-position:center; background-size:cover; will-change:transform;
  backface-visibility:hidden; }
.tl-back  { background-image:url("${BACK}"); }
/* 앞 장은 뒤 장과 같은 한 컷이다. 잘라 쓰지 않고 그대로 겹친다 */
.tl-front { background-image:url("${FRONT}"); transform-origin:${FRONT_ORIGIN}; }

/* 글자가 읽히게 위아래를 눌러 준다 */
.tl-veil { position:absolute; inset:0; pointer-events:none;
  background:
    linear-gradient(180deg, rgba(6,5,4,.55) 0%, rgba(6,5,4,.10) 26%, rgba(6,5,4,.08) 54%, rgba(6,5,4,.86) 100%),
    radial-gradient(ellipse 74% 54% at 50% 44%, transparent 34%, rgba(6,5,4,.48) 100%); }

/* 오디세우스 발밑에만 옅은 볕 */
.tl-front-veil { position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 26% 34% at 50% 80%, rgba(232,200,132,.13), transparent 64%); }

.tl-plate { position:absolute; inset:0; display:grid; place-items:center;
  align-content:center; text-align:center; padding:0 24px; }
/* 제목 뒤에만 그늘 한 겹. 그림을 다 덮지 않으면서 글자가 읽힌다 */
.tl-shade { position:absolute; left:50%; top:50%; width:min(1180px, 96vw); height:46vh;
  transform:translate(-50%, -50%) translateY(-19vh); pointer-events:none;
  background:radial-gradient(ellipse 52% 50% at 50% 50%, rgba(5,4,3,.72) 0%,
    rgba(5,4,3,.46) 46%, transparent 78%); }
.tl-top { margin-top:-19vh; }
.tl-band { height:14px; width:min(460px, 72vw); margin:0 auto;
  background-image:${meanderURI()}; background-repeat:repeat-x;
  background-position:center; opacity:.5; }
.tl-crown { display:flex; align-items:center; justify-content:center; gap:26px; margin:26px 0 4px; }
.tl-laurel { width:26px; height:62px; background-image:${laurelURI()};
  background-repeat:no-repeat; background-size:contain; }
.tl-laurel.r { transform:scaleX(-1); }
#title h1 { margin:0; font-family:var(--display); font-size:clamp(26px, 5.2vw, 70px);
  font-weight:500; letter-spacing:.24em; text-indent:.24em; line-height:1; white-space:nowrap;
  color:#fff6e2;
  text-shadow:0 0 90px rgba(232,200,132,.45), 0 0 26px rgba(255,236,200,.28), 0 8px 34px #000; }
.tl-greek { font-family:var(--serif); font-size:13.5px; letter-spacing:.54em;
  text-indent:.54em; color:var(--gold); opacity:.74; margin-top:11px; }
.tl-say { position:absolute; left:0; right:0; bottom:17.5vh; text-align:center;
  font-size:14.5px; letter-spacing:.06em; color:var(--text); text-shadow:0 2px 18px #000; }
.tl-say em { color:var(--gold); font-style:normal; }

.tl-go { position:absolute; left:0; right:0; bottom:12vh; text-align:center;
  font-family:var(--serif); font-size:13px; letter-spacing:.36em; text-indent:.36em;
  color:var(--ivory); text-shadow:0 2px 16px #000; }
.tl-go.blink { animation:tlPulse 2.2s ease-in-out infinite; }
@keyframes tlPulse { 0%,100%{opacity:.42} 50%{opacity:1} }
/* 떠날 때 — 글자는 물에 푼 잉크처럼 번지며 사라진다.
   배경과 오디세우스는 서로 반대로 흘러 마지막으로 한 번 더 깊이를 보인다. */
#title.leaving .tl-plate { filter:blur(26px); opacity:0; transform:scale(1.07);
  transition:filter 2.0s ease-in-out, opacity 2.1s ease-in, transform 2.8s ease-out; }
#title.leaving .tl-go, #title.leaving .tl-say { opacity:0; transition:opacity .9s ease; }
#title.leaving .tl-veil { background:linear-gradient(180deg, rgba(6,5,4,.62), rgba(6,5,4,.80));
  transition:background 2.0s ease-in .9s; }

@media (prefers-reduced-motion: reduce) { .tl-go.blink { animation:none; opacity:.8 } }
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
      <div class="tl-stage">
        <div class="tl-layer tl-back"></div>
        <div class="tl-layer tl-front"></div>
        <div class="tl-front-veil"></div>
        <div class="tl-veil"></div>
      </div>
      <div class="tl-shade"></div>
      <div class="tl-plate">
        <div class="tl-top">
          <div class="tl-band"></div>
          <div class="tl-crown">
            <div class="tl-laurel"></div>
            <h1>THE ODYSSEY</h1>
            <div class="tl-laurel r"></div>
          </div>
          <div class="tl-greek">ΟΔΥΣΣΕΙΑ</div>
        </div>
      </div>
      <div class="tl-say">바다가 <em>스무 해</em>를 붙들었다.</div>
      <div class="tl-go blink">아무 키나 눌러 시작</div>`
    root.appendChild(this.el)

    this.back = this.el.querySelector('.tl-back')
    this.front = this.el.querySelector('.tl-front')
    this.aim = { x: 0, y: 0 }      // 마우스가 가리키는 곳 (-1..1)
    this.at = { x: 0, y: 0 }       // 지금 밀려 있는 정도. 뒤늦게 따라간다
    this.out = 0                   // 퇴장 진행도 0→1

    this._move = e => {
      this.aim.x = (e.clientX / innerWidth) * 2 - 1
      this.aim.y = (e.clientY / innerHeight) * 2 - 1
    }
    addEventListener('pointermove', this._move)

    // 창이 숨겨져 있으면 rAF 가 안 돌아 화면이 굳는다. 타이머로 돌린다.
    this._timer = setInterval(() => this.step(1 / 60), 16)
    this.step(0)
  }

  /** 먼 것은 조금, 가까운 것은 많이. 그 차이가 거리감이다. */
  step(dt) {
    const k = dt ? Math.min(1, dt * 4.5) : 1
    this.at.x += (this.aim.x - this.at.x) * k
    this.at.y += (this.aim.y - this.at.y) * k
    if (this._leaving) this.out = Math.min(1, this.out + (dt || 0) / 2.9)
    const { x, y } = this.at
    // 뒤로 갈수록 느려지게 — 물살에 실려 나가는 느낌
    const e = 1 - Math.pow(1 - this.out, 2.6)
    const W = innerWidth || 1280
    const backOut = e * W * 0.055        // 배경은 오른쪽으로
    const frontOut = -e * W * 0.19       // 오디세우스는 왼쪽으로

    this.back.style.transform =
      `translate3d(${(-x * 9 + backOut).toFixed(2)}px, ${(-y * 5).toFixed(2)}px, 0)` +
      ` scale(${(BACK_SCALE + e * 0.05).toFixed(4)})`
    this.front.style.transform =
      `translate(calc(${FRONT_DX}% + ${(-x * 26 + frontOut).toFixed(2)}px),` +
      ` calc(${FRONT_DY}% + ${(-y * 13).toFixed(2)}px))` +
      ` rotateY(${(x * -2.2).toFixed(2)}deg) scale(${FRONT_SCALE})`
  }

  /** 시험·촬영용 — 마우스를 그 자리에 둔 것처럼. */
  setAim(x, y) { this.aim.x = x; this.aim.y = y; this.step(0) }

  /** 아무 키나 누를 때까지 기다린다. */
  wait() {
    return new Promise(resolve => {
      const go = () => {
        removeEventListener('keydown', go)
        removeEventListener('pointerdown', go)
        removeEventListener('pointermove', this._move)
        this._leaving = true
        this.el.classList.add('leaving')
        // 흐르는 동안에도 마우스 시차는 멈춘다 — 떠나는 그림이 흔들리면 안 된다
        this.aim.x = this.at.x; this.aim.y = this.at.y
        setTimeout(() => {
          clearInterval(this._timer)
          this.el.classList.add('gone')
          setTimeout(() => this.el.remove(), 1300)
          resolve()
        }, 2500)
      }
      addEventListener('keydown', go)
      addEventListener('pointerdown', go)
    })
  }
}
