import { installTheme } from './theme.js'

/**
 * 저승 — 손이 올라온다.
 *
 * 전에는 이 장면도 액자에 걸었다. 그런데 막간의 액자는 "지나온 뱃길을
 * 박물관처럼 돌아본다" 는 장치다. 지나온 것을 보는 자리에 **지금 나를
 * 붙잡으러 오는 것**을 걸어 두면 거리가 생긴다 — 액자 안에 있는 건 이미
 * 끝난 일이니까.
 *
 * 그래서 여기만 액자를 걷어낸다. 손은 액자가 아니라 화면에서 나온다.
 * 테두리 없이, 화면 밖에서 들어와, 커지면서 이쪽으로 온다.
 *
 * 누끼를 따로 따지 않는다 — 그림의 배경이 순수한 검정(1,1,1)이고 이 장면의
 * 바닥도 검정이라, screen 합성이면 검정은 아무것도 더하지 않는다.
 * 알파를 깎아 만든 테두리보다 이쪽이 가장자리가 부드럽다.
 */
const CSS = `
/* z-index 는 유물 화면(55)·은총(56)보다 **아래**다.
   이 장면은 끝나면서 화면을 검게 덮은 채로 다음 화면에 넘긴다 —
   넘겨주는 쪽이 받는 쪽보다 위에 있으면 받는 화면이 그 암전에 가려진다.
   (실제로 그래서 손 다음에 검은 화면만 남았다.) 3D 판 위이기만 하면 된다. */
#reach { position:absolute; inset:0; z-index:54; display:none;
  pointer-events:none; overflow:hidden; background:#040306;
  font-family:var(--body); }
#reach.on { display:block; pointer-events:auto; cursor:default; }

/* 구덩이. 손이 나올 자리에 먼저 빛이 고인다 —
   아무 데서나 튀어나오면 놀랄 뿐이고, 여기서 나온다고 미리 알려 주면 무서워진다. */
#reach .pit { position:absolute; left:50%; top:50%; width:74%; height:62%;
  transform:translate(-50%,-50%); pointer-events:none;
  opacity:0; transition:opacity 1.2s ease;
  background:radial-gradient(ellipse 50% 42% at 42% 54%,
    rgba(122,44,52,.34) 0%, rgba(58,24,40,.16) 42%, transparent 76%);
  filter:blur(26px); }
#reach.dug .pit { opacity:1; }

/* 손. 화면 왼쪽 밖에서 들어와 커지면서 이쪽으로 온다.
   검정 배경은 screen 이 지워 주므로 테두리가 없다. */
#reach .hand { position:absolute; left:50%; top:52%;
  width:min(1400px, 104vw); aspect-ratio:1400/797;
  transform-origin:18% 52%;            /* 팔이 들어오는 쪽을 축으로 */
  transform:translate(-78%, -50%) scale(.52);
  opacity:0; mix-blend-mode:screen;
  background-image:url("/img/agamemnon-hand.webp");
  background-size:100% 100%; background-repeat:no-repeat;
  will-change:transform, opacity; }
/* 1단 — 흙을 뚫고 나온다. 빠르게, 한 번에 */
#reach.rise .hand { opacity:1;
  transform:translate(-54%, -50%) scale(.86);
  transition:transform 1.05s cubic-bezier(.12,.82,.28,1), opacity .5s ease; }
/* 2단 — 잡으러 온다. 느리게 다가오다 */
#reach.loom .hand {
  transform:translate(-46%, -50%) scale(1.06);
  transition:transform 2.6s cubic-bezier(.34,0,.66,1); }
/* 3단 — 덮친다. 화면을 지나간다 */
#reach.grab .hand {
  transform:translate(-34%, -50%) scale(1.9);
  transition:transform .62s cubic-bezier(.5,0,.86,.3); }

/* 흙. 손이 나오는 순간에만 쏟아진다 */
#reach .dirt { position:absolute; inset:0; pointer-events:none; opacity:0; }
#reach.rise .dirt { opacity:1; }
#reach .dirt i { position:absolute; width:4px; height:4px; border-radius:40%;
  background:#6a5844; opacity:0;
  animation:clod 1.5s cubic-bezier(.2,.7,.4,1) forwards; }
@keyframes clod {
  0%   { transform:translate3d(0,0,0) scale(.4); opacity:0; }
  14%  { opacity:.9; }
  100% { transform:translate3d(var(--dx), var(--dy), 0) scale(1); opacity:0; }
}

/* 가장자리를 눌러 준다 — 손이 화면 밖에서 왔다는 게 읽혀야 한다 */
#reach .vig { position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 72% 66% at 46% 50%,
    transparent 30%, rgba(4,3,6,.62) 78%, rgba(4,3,6,.94) 100%); }

/* 글. 액자의 띠는 쓰지 않는다 — 여기는 액자가 아니다 */
#reach .say { position:absolute; left:50%; bottom:13%; transform:translateX(-50%);
  width:min(820px, 88vw); text-align:center; }
#reach .say span { display:block; font-family:var(--serif);
  font-size:clamp(19px, 2.0vw, 26px); line-height:1.9; letter-spacing:.06em;
  color:#f4ead6; opacity:0; transform:translateY(10px);
  transition:opacity .7s ease, transform .8s cubic-bezier(.2,.8,.3,1);
  text-shadow:0 2px 8px rgba(0,0,0,.96), 0 4px 26px rgba(0,0,0,.9); }
#reach .say span.in { opacity:1; transform:none; }
#reach .say span em { color:#e0808a; font-style:normal; }

/* 마지막에 통째로 어두워지고, 그 어둠 위로 선택지가 올라온다 */
#reach .black { position:absolute; inset:0; background:#040306;
  opacity:0; pointer-events:none; transition:opacity .5s ease; }
#reach.out .black { opacity:1; }

#reach .skip { position:absolute; right:26px; bottom:22px; font-family:var(--serif);
  font-size:11px; letter-spacing:.26em; text-indent:.26em; color:#7d7160;
  border:1px solid #3b3227; border-radius:2px; padding:9px 16px 9px 18px;
  background:rgba(12,9,6,.6); cursor:pointer; opacity:0;
  transition:opacity .6s ease .9s, color .14s, border-color .14s, background .14s; }
#reach.on .skip { opacity:1; }
#reach .skip:hover { color:var(--ivory); border-color:var(--bronze); background:rgba(40,28,16,.8); }
`

/** 흙덩이. 손이 나오는 자리에서 사방으로 튄다. */
const clods = (n = 26) => Array.from({ length: n }, () => {
  const x = (36 + Math.random() * 26).toFixed(1)
  const y = (34 + Math.random() * 34).toFixed(1)
  const dx = (Math.random() * 260 - 90).toFixed(0)
  const dy = (60 + Math.random() * 220).toFixed(0)
  const d = (Math.random() * 0.5).toFixed(2)
  const s = (0.6 + Math.random() * 1.1).toFixed(2)
  return `<i style="left:${x}%;top:${y}%;--dx:${dx}px;--dy:${dy}px;`
    + `animation-delay:${d}s;transform:scale(${s})"></i>`
}).join('')

export class Reach {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'reach'
    root.appendChild(this.el)
  }

  close() {
    this.el.classList.remove('on', 'dug', 'rise', 'loom', 'grab', 'out')
    document.body.style.cursor = ''
  }

  /**
   * @param o.lines  한 줄씩 뜰 글. { text, hold }
   * @param o.keepOpen  true 면 켠 채로 넘긴다 — 다음 화면이 덮은 뒤 close() 한다
   */
  play({ lines = [], keepOpen = false } = {}) {
    return new Promise(resolve => {
      const T = []
      this.el.innerHTML = `
        <div class="pit"></div>
        <div class="hand"></div>
        <div class="dirt">${clods()}</div>
        <div class="vig"></div>
        <div class="say"><span></span></div>
        <div class="black"></div>
        <button class="skip" type="button">SKIP</button>`
      this.el.classList.remove('dug', 'rise', 'loom', 'grab', 'out')
      this.el.classList.add('on')
      document.body.style.cursor = 'default'

      const span = this.el.querySelector('.say span')
      let done = false
      const finish = () => {
        if (done) return
        done = true
        T.forEach(clearTimeout)
        removeEventListener('keydown', esc)
        if (!keepOpen) this.close()
        resolve()
      }
      const esc = e => { if (e.code === 'Escape') finish() }
      this.el.querySelector('.skip')?.addEventListener('click', finish)
      T.push(setTimeout(() => addEventListener('keydown', esc), 500))

      // 구덩이가 먼저 붉어진다
      T.push(setTimeout(() => this.el.classList.add('dug'), 260))

      // 글줄. 첫 줄이 끝날 때쯤 손이 올라온다
      let t = 520
      lines.forEach((l, i) => {
        T.push(setTimeout(() => {
          span.classList.remove('in')
          T.push(setTimeout(() => { span.innerHTML = l.text; span.classList.add('in') }, 300))
        }, t))
        if (i === 0) T.push(setTimeout(() => this.el.classList.add('rise'), t + (l.hold ?? 2600) * 0.62))
        if (i === 1) T.push(setTimeout(() => this.el.classList.add('loom'), t + 200))
        t += l.hold ?? 2600
      })

      // 덮친다 → 어두워진다 → 그 위로 선택지
      T.push(setTimeout(() => {
        this.el.classList.add('grab')
        span.classList.remove('in')
      }, t))
      T.push(setTimeout(() => this.el.classList.add('out'), t + 420))
      T.push(setTimeout(finish, t + 900))
    })
  }
}
