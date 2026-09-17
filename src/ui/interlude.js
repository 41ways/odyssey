import { installTheme, meanderURI } from './theme.js'

/**
 * 막간.
 *
 * 판이 끝나자마자 다음 판이 시작되면 아홉 번 싸운 기억만 남는다.
 * 사이에 한 호흡을 넣어야 "돌아가는 길"이 된다.
 *
 * 글줄을 하나씩 띄우고 뒤에는 그 뱃길에 맞는 장면을 깐다.
 * 마우스로는 넘어가지 않는다 — 읽는 중에 한 번 클릭했다고 이야기가 날아가면
 * 다시는 안 읽게 된다. 넘기려면 아래 건너뛰기를 직접 누른다.
 */
const CSS = `
#lude { position:absolute; inset:0; z-index:62; display:none;
  pointer-events:none; font-family:var(--body); overflow:hidden; background:#05040a; }
#lude.on { display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:clamp(18px, 3.2vh, 40px); padding:4vh 24px;
  pointer-events:auto; cursor:default; }

/* ── 뱃길 장면 ───────────────────────────────────────────
   판마다 같은 바다를 보여 주면 일곱 번 같은 데를 지난 것이 된다.
   어디를 떠나 어디로 가는지에 따라 하늘과 물을 바꾼다. */
#lude .scene { position:absolute; inset:0; opacity:0; transition:opacity 1.4s ease;
  filter:saturate(.7) brightness(.42); }
#lude.on .scene { opacity:1; }
/* 액자 뒤로 물린 장면 위에 어둠 한 겹 — 액자가 떠 보이게 */
#lude .scrim { position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 80% 70% at 50% 45%, rgba(4,3,6,.55), rgba(3,2,5,.92) 100%); }

/* 그림은 액자에 넣는다.
   화면 가득 깔면 배경이 되고, 배경이 되면 그냥 지나간다.
   테를 두르면 '보여 주는 그림' 이 되고, 글은 그 아래 설명이 된다.

   그림이 여러 장이면 한자리에서 갈아 끼우지 않는다. 옆으로 늘어놓고
   카메라가 옆걸음으로 옮겨 간다 — 큐레이터가 다음 그림 앞으로 걸어가듯이.
   그래야 '다른 그림' 이 아니라 '다음 그림' 이 된다. */
#lude .frame { position:relative; flex:0 1 auto;
  width:min(1060px, 90vw); max-height:62vh; aspect-ratio:1049/603;
  background-image:url("/img/frame.webp?v=4");
  background-size:100% 100%; background-repeat:no-repeat;
  opacity:0; transform:translateY(10px) scale(.985);
  transition:opacity 1.2s ease, transform 1.4s cubic-bezier(.2,.8,.3,1);
  filter:drop-shadow(0 26px 46px rgba(0,0,0,.8)); }
#lude.on .frame { opacity:1; transform:none; }
#lude .frame.out { opacity:0; transform:translateY(-8px) scale(.99);
  transition:opacity 1.0s ease, transform 1.2s ease; }
/* 화폭 — 액자 안쪽 구멍의 실제 자리. 테 위에 얹지만 장식 밖으로는 안 나간다 */
#lude .pane { position:absolute; left:9.8%; right:11.2%; top:17.1%; bottom:12.4%;
  overflow:hidden; z-index:2;
  background:radial-gradient(ellipse 66% 58% at 50% 46%, #17102a 0%, #0a0714 58%, #050309 100%);
  /* 테 안쪽 턱이 그림에 드리우는 그늘 */
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.85), inset 0 6px 22px rgba(0,0,0,.75),
             inset 0 -4px 16px rgba(0,0,0,.5); }
/* 옆으로 늘어선 그림들. 한 칸씩 밀려 간다 */
#lude .reel { position:absolute; inset:0; display:flex;
  transition:transform 1.7s cubic-bezier(.45,.02,.25,1); }
#lude .plate-img { position:relative; flex:0 0 100%; height:100%;
  background-size:cover; background-position:center;
  opacity:0; transition:opacity 1.0s ease; }
#lude .plate-img.in { opacity:1; }
/* 오려 낸 인물은 꽉 채우지 않는다 — 액자 안에 세워 둔다 */
#lude .plate-img.fig { background-size:contain; background-repeat:no-repeat;
  background-position:center bottom; }
#lude .pane::after { content:''; position:absolute; inset:0; pointer-events:none; z-index:2;
  background:linear-gradient(180deg, rgba(4,3,6,.34) 0%, transparent 24%,
    transparent 66%, rgba(4,3,6,.52) 100%); }

/* 글 뒤에 그늘 한 겹. 그림이 밝으면 흰 글씨가 그대로 묻힌다 —
   화면 전체를 어둡게 하면 그림이 죽으니 글 있는 띠만 눌러 준다. */
#lude .plate { position:relative; flex:0 0 auto; text-align:center;
  width:min(860px, 90vw); padding:10px 20px; opacity:1;
  transition:opacity 1.0s ease, transform 1.2s ease; }
#lude .plate::before { content:''; position:absolute; inset:-30% -18%;
  background:radial-gradient(ellipse 60% 58% at 50% 50%,
    rgba(4,3,6,.72) 0%, rgba(4,3,6,.46) 48%, transparent 84%);
  pointer-events:none; }
#lude .plate > * { position:relative; }
/* 마지막 글줄이 뚝 끊기지 않게 한 번 접고 나간다 */
#lude .plate.out { opacity:0; transform:translateY(-8px); }
#lude .band { height:14px; background-image:${meanderURI('#c8973e', 0.85)};
  background-repeat:repeat-x; background-position:center; opacity:.35; }
#lude .line { min-height:4.2em; display:grid; place-items:center; margin:22px 0 18px; }
#lude .line span { display:block; font-family:var(--serif); font-size:clamp(19px, 2.0vw, 26px); line-height:1.9;
  letter-spacing:.06em; color:#f4ead6; opacity:0; transform:translateY(12px);
  transition:opacity .8s ease, transform .9s cubic-bezier(.2,.8,.3,1);
  text-shadow:0 2px 6px rgba(0,0,0,.95), 0 4px 22px rgba(0,0,0,.9), 0 0 60px rgba(0,0,0,.8); }
#lude .line span.in { opacity:1; transform:none; }
#lude .line span em { color:#ffd9a0; font-style:normal; }
#lude .dest { font-family:var(--serif); font-size:13px; letter-spacing:.44em;
  text-indent:.44em; color:#e0b264; opacity:0; transition:opacity .8s ease;
  text-shadow:0 2px 10px rgba(0,0,0,.95); }
#lude .dest.in { opacity:1; }
#lude .skip { position:absolute; right:26px; bottom:22px; font-family:var(--serif);
  font-size:11px; letter-spacing:.26em; text-indent:.26em; color:#7d7160;
  border:1px solid #3b3227; border-radius:2px; padding:9px 16px 9px 18px;
  background:rgba(12,9,6,.6); cursor:pointer; opacity:0;
  transition:opacity .6s ease .9s, color .14s, border-color .14s, background .14s; }
#lude.on .skip { opacity:1; }
#lude .skip:hover { color:var(--ivory); border-color:var(--bronze); background:rgba(40,28,16,.8); }
`

const waves = (n = 7, step = 11) => Array.from({ length: n }, (_, i) =>
  `<div class="wave" style="top:${8 + i * step}%"></div>`).join('')

const SHIP = cls => `<svg class="ship ${cls}" viewBox="0 0 118 64" fill="none">
  <path d="M8 46 h102 l-12 12 H20 z" fill="#0a0e18" stroke="#3b4a68" stroke-width="1.2"/>
  <path d="M59 6 v40" stroke="#3b4a68" stroke-width="2"/>
  <path d="M59 10 q26 10 0 26 z" fill="#131a2a" stroke="#4a5c80" stroke-width="1.2"/>
  <path d="M59 12 q-22 9 0 22 z" fill="#0e1422" stroke="#3b4a68" stroke-width="1"/>
</svg>`

const seaLike = (name, extra = '') => () => `<div class="scene ${name}">
  <div class="sky"></div><div class="orb"></div>
  <div class="water">${waves()}</div>
  <div class="horizon"></div>${extra}${SHIP('')}
</div>`

/** 판마다 다른 뱃길. 이름은 stages.js 의 interludeFor 가 정한다. */
const SCENES = {
  sea: seaLike('sea'),
  dawn: seaLike('dawn', '<div class="glare"></div>'),
  storm: () => `<div class="scene storm">
    <div class="sky"></div>
    <div class="water">${waves(9, 9)}</div>
    <div class="horizon"></div>${SHIP('toss')}
    <div class="flash"></div>
  </div>`,
  fire: () => `<div class="scene fire">${Array.from({ length: 40 }, () => {
    const l = Math.random() * 100, d = (Math.random() * 8).toFixed(1), s = (6 + Math.random() * 6).toFixed(1)
    return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;animation:ashUp ${s}s linear ${d}s infinite"></i>`
  }).join('')}</div>`,
  ashdawn: () => `<div class="scene ashdawn">
    <div class="orb"></div>
    <div class="water">${waves(6, 12)}</div>
    <div class="horizon"></div>${SHIP('')}
    ${Array.from({ length: 26 }, () => {
      const l = Math.random() * 100, d = (Math.random() * 9).toFixed(1), s = (7 + Math.random() * 7).toFixed(1)
      return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;background:#c9bcd8;animation:ashUp ${s}s linear ${d}s infinite"></i>`
    }).join('')}
  </div>`,
  whirl: () => `<div class="scene whirl">
    ${Array.from({ length: 7 }, (_, i) => {
      const r = 90 + i * 74
      return `<div class="ring" style="width:${r}px;height:${Math.round(r * 0.34)}px"></div>`
    }).join('')}
    <div class="eye"></div>${SHIP('toss')}
  </div>`,
  landfall: seaLike('landfall', '<div class="land"></div>'),
  under: () => `<div class="scene under">${Array.from({ length: 30 }, () => {
    const l = Math.random() * 100, d = (Math.random() * 9).toFixed(1), s = (7 + Math.random() * 7).toFixed(1)
    return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;background:#b49ce8;animation:ashUp ${s}s linear ${d}s infinite"></i>`
  }).join('')}</div>`,
  night: () => `<div class="scene night">
    <div class="orb"></div>
    ${[8, 21, 79, 92].map(l => `<div class="col" style="left:${l}%"></div>`).join('')}
  </div>`,
}

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
   * @param o.scene   SCENES 의 이름 — sea·dawn·storm·fire·ashdawn·whirl·landfall·night
   * @param o.art      액자에 넣을 그림. 한 장이면 문자열, 글줄마다 갈려면 배열.
   *                    없거나 못 불러오면 조용히 CSS 장면이 남는다
   * @param o.figure    true 면 오려 낸 인물로 본다 — 꽉 채우지 않고 액자 안에 세운다
   */
  /** 막이 내려온 뒤에 닫는다 — 곧바로 닫으면 그 틈으로 지난 판이 보인다. */
  close() {
    this.el.classList.remove('on')
    document.body.style.cursor = ''
  }

  play({ lines, dest, scene = 'sea', art = null, figure = false, keepOpen = false }) {
    return new Promise(resolve => {
      const arts = art ? (Array.isArray(art) ? art : [art]) : []
      const back = (SCENES[scene] ? SCENES[scene]() : SCENES.sea()) + '<div class="scrim"></div>'
      const pane = arts.map((src, i) =>
        `<div class="plate-img${figure ? ' fig' : ''}" data-i="${i}" data-src="${src}"></div>`).join('')

      this.el.innerHTML = `${back}
        ${arts.length ? `<div class="frame">
          <div class="pane"><div class="reel">${pane}</div></div>
        </div>` : ''}
        <div class="plate">
          <div class="band"></div>
          <div class="line"><span></span></div>
          ${dest ? `<div class="dest">${dest}</div>` : ''}
          <div class="band"></div>
        </div>
        <button class="skip" type="button">SKIP</button>`
      this.el.classList.add('on')
      document.body.style.cursor = 'default'

      // 그림은 받아지고 나서야 붙인다. 없는 파일이면 CSS 장면 그대로 간다.
      const plates = [...this.el.querySelectorAll('.plate-img')]
      for (const el of plates) {
        const probe = new Image()
        probe.onload = () => {
          el.style.backgroundImage = `url("${el.dataset.src}")`
          el.dataset.ready = '1'
          el.classList.add('in')
        }
        // 못 받은 칸은 빈 채로 둔다. 지우면 뒤 칸들이 앞으로 당겨져 순서가 어긋난다.
        probe.onerror = () => el.classList.add('in')
        probe.src = el.dataset.src
      }
      /** n번째 그림 앞으로 옮겨 간다. 없는 번호면 마지막 그림 앞에 선다. */
      const reel = this.el.querySelector('.reel')
      const showPlate = n => {
        if (!reel || plates.length < 2) return
        const i = Math.min(n, plates.length - 1)
        reel.style.transform = `translateX(${-i * 100}%)`
      }

      const span = this.el.querySelector('.line span')
      const destEl = this.el.querySelector('.dest')
      const timers = []
      let done = false

      const finish = () => {
        if (done) return
        done = true
        timers.forEach(clearTimeout)
        removeEventListener('keydown', skip)
        // keepOpen 이면 화면을 켠 채로 넘긴다. 다음 판의 막이 내려온 뒤 close() 가 닫는다.
        if (!keepOpen) this.close()
        resolve()
      }
      const skip = e => {
        // 이동·공격 키로 실수로 넘기지 않게 — Esc 와 건너뛰기 단추만 받는다
        if (e && e.code !== 'Escape') return
        finish()
      }
      this.el.querySelector('.skip')?.addEventListener('click', () => finish())
      timers.push(setTimeout(() => addEventListener('keydown', skip), 500))

      let t = 350
      lines.forEach((l, i) => {
        timers.push(setTimeout(() => {
          span.classList.remove('in')
          showPlate(i)                 // 글이 바뀌기 조금 전에 그림부터 넘어간다
          timers.push(setTimeout(() => { span.innerHTML = l.text; span.classList.add('in') }, 320))
        }, t))
        t += (l.hold ?? 2600)
      })
      if (destEl) timers.push(setTimeout(() => destEl.classList.add('in'), Math.max(600, t - 1400)))
      // 마지막 글줄을 한 번 접고 나간다. 그대로 끊으면 읽다 만 것처럼 남는다.
      const plate = this.el.querySelector('.plate')
      const frameEl = this.el.querySelector('.frame')
      timers.push(setTimeout(() => {
        plate?.classList.add('out')
        frameEl?.classList.add('out')
      }, t + 200))
      timers.push(setTimeout(finish, t + 1300))
    })
  }
}
