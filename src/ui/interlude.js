import { installTheme, meanderURI } from './theme.js'

/**
 * 막간.
 *
 * 판이 끝나자마자 다음 판이 시작되면 아홉 번 싸운 기억만 남는다.
 * 사이에 한 호흡을 넣어야 "돌아가는 길"이 된다.
 *
 * 글줄을 하나씩 띄우고, 뒤에는 바다 아니면 불을 깐다. 아무 키나 누르면 건너뛴다.
 */
const CSS = `
#lude { position:absolute; inset:0; z-index:62; display:none; place-items:center;
  pointer-events:none; font-family:var(--body); overflow:hidden; background:#05040a; }
#lude.on { display:grid; pointer-events:auto; cursor:default; }

/* 바다 — 수평선과 천천히 지나가는 배 */
#lude .sea { position:absolute; inset:0; opacity:0; transition:opacity 1.2s ease; }
#lude.on .sea { opacity:1; }
#lude .sky { position:absolute; inset:0 0 44% 0;
  background:linear-gradient(180deg, #070a14 0%, #121a2c 55%, #2a3550 100%); }
#lude .water { position:absolute; inset:56% 0 0 0;
  background:linear-gradient(180deg, #16203a 0%, #0a0f1c 70%, #05070e 100%); }
#lude .horizon { position:absolute; left:0; right:0; top:56%; height:1px;
  background:linear-gradient(90deg, transparent, rgba(180,200,240,.35), transparent); }
#lude .moon { position:absolute; left:50%; top:22%; width:140px; height:140px;
  transform:translateX(-50%); border-radius:50%;
  background:radial-gradient(circle, rgba(220,230,255,.22), transparent 62%); }
#lude .ship { position:absolute; top:52.4%; left:-16%; width:118px; height:64px;
  animation:sail 34s linear infinite; }
@keyframes sail { from { left:-16% } to { left:114% } }
#lude .wave { position:absolute; left:0; right:0; height:1px; background:rgba(150,180,230,.10); }

/* 불 — 잿가루가 떠오른다 */
#lude .fire { position:absolute; inset:0; opacity:0; transition:opacity 1.2s ease;
  background:
    radial-gradient(ellipse 80% 50% at 50% 108%, rgba(200,80,30,.34), transparent 62%),
    linear-gradient(180deg, #0a0604 0%, #170b05 60%, #240d04 100%); }
#lude.on .fire { opacity:1; }
#lude .ember { position:absolute; width:3px; height:3px; border-radius:50%;
  background:#ffae5a; opacity:0; }

#lude .plate { position:relative; text-align:center; width:min(760px, 88vw); }
#lude .band { height:14px; background-image:${meanderURI('#c8973e', 0.85)};
  background-repeat:repeat-x; background-position:center; opacity:.35; }
#lude .line { min-height:6.6em; display:grid; place-items:center; margin:30px 0; }
#lude .line span { display:block; font-family:var(--serif); font-size:26px; line-height:1.9;
  letter-spacing:.06em; color:#ece0c8; opacity:0; transform:translateY(12px);
  transition:opacity .8s ease, transform .9s cubic-bezier(.2,.8,.3,1);
  text-shadow:0 4px 30px #000; }
#lude .line span.in { opacity:1; transform:none; }
#lude .line span em { color:#ffd9a0; font-style:normal; }
#lude .dest { font-family:var(--serif); font-size:13px; letter-spacing:.44em;
  text-indent:.44em; color:#c8973e; opacity:0; transition:opacity .8s ease; }
#lude .dest.in { opacity:1; }
#lude .skip { position:absolute; right:22px; bottom:20px; font-size:11px;
  letter-spacing:.2em; color:#5f564c; }
`

export class Interlude {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'lude'
    root.appendChild(this.el)
  }

  /**
   * @param o.lines   한 줄씩 뜰 글. 각 { text, hold }
   * @param o.dest    아래에 작게 뜨는 목적지 (선택)
   * @param o.scene   'sea' | 'fire'
   */
  play({ lines, dest, scene = 'sea' }) {
    return new Promise(resolve => {
      const back = scene === 'fire'
        ? `<div class="fire">${Array.from({ length: 40 }, () => {
            const l = Math.random() * 100, d = (Math.random() * 8).toFixed(1), s = (6 + Math.random() * 6).toFixed(1)
            return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;animation:ashUp ${s}s linear ${d}s infinite"></i>`
          }).join('')}</div>`
        : `<div class="sea">
            <div class="sky"></div><div class="moon"></div>
            <div class="water">${Array.from({ length: 7 }, (_, i) =>
              `<div class="wave" style="top:${8 + i * 11}%"></div>`).join('')}</div>
            <div class="horizon"></div>
            <svg class="ship" viewBox="0 0 118 64" fill="none">
              <path d="M8 46 h102 l-12 12 H20 z" fill="#0a0e18" stroke="#3b4a68" stroke-width="1.2"/>
              <path d="M59 6 v40" stroke="#3b4a68" stroke-width="2"/>
              <path d="M59 10 q26 10 0 26 z" fill="#131a2a" stroke="#4a5c80" stroke-width="1.2"/>
              <path d="M59 12 q-22 9 0 22 z" fill="#0e1422" stroke="#3b4a68" stroke-width="1"/>
            </svg>
          </div>`

      this.el.innerHTML = `${back}
        <div class="plate">
          <div class="band"></div>
          <div class="line"><span></span></div>
          ${dest ? `<div class="dest">${dest}</div>` : ''}
          <div class="band"></div>
        </div>
        <div class="skip">아무 키나 눌러 건너뛰기</div>`
      this.el.classList.add('on')
      document.body.style.cursor = 'default'

      const span = this.el.querySelector('.line span')
      const destEl = this.el.querySelector('.dest')
      const timers = []
      let done = false

      const finish = () => {
        if (done) return
        done = true
        timers.forEach(clearTimeout)
        removeEventListener('keydown', skip)
        removeEventListener('pointerdown', skip)
        this.el.classList.remove('on')
        document.body.style.cursor = ''
        resolve()
      }
      const skip = () => finish()
      // 곧바로 붙이면 직전 입력이 그대로 건너뛴다
      timers.push(setTimeout(() => {
        addEventListener('keydown', skip)
        addEventListener('pointerdown', skip)
      }, 500))

      let t = 350
      for (const l of lines) {
        timers.push(setTimeout(() => {
          span.classList.remove('in')
          timers.push(setTimeout(() => { span.innerHTML = l.text; span.classList.add('in') }, 320))
        }, t))
        t += (l.hold ?? 2600)
      }
      if (destEl) timers.push(setTimeout(() => destEl.classList.add('in'), Math.max(600, t - 1400)))
      timers.push(setTimeout(finish, t + 300))
    })
  }
}
