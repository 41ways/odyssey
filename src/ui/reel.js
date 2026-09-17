import { installTheme } from './theme.js'

/**
 * 릴 — 그림 여러 장을 이어 붙여 장면을 만든다.
 *
 * ── 왜 영상이 아니라 그림인가 ──
 * 영상 클립 하나가 이 게임 전체보다 무겁다. 그런데 우리가 원하는 건 영상이
 * 아니라 **시간이 흐른다는 느낌**이다. 그건 그림 두세 장으로도 된다 —
 * 만화가 칸 사이에서 시간을 만드는 것과 같은 원리다.
 *
 * 그래서 영상을 흉내내지 않는다. 대신:
 *
 *  · 한 장에서 다음 장으로 **겹쳐 넘긴다** (크로스페이드). 툭 끊으면 슬라이드쇼고,
 *    겹쳐 넘기면 같은 장면이 변한 것으로 읽힌다.
 *  · 넘기는 동안에도 그림이 **아주 느리게 확대되고 밀린다** (켄 번스).
 *    정지한 그림은 정지해 보이고, 조금이라도 움직이면 살아 있는 걸로 보인다.
 *  · 장면마다 **입자와 색조**를 얹는다. 불타는 장면이면 불티가 올라가고 화면이
 *    붉어진다 — 그림 세 장으로 못 하는 걸 코드가 메운다.
 *
 * 액자(ui/interlude.js)와 다른 물건이다. 액자는 "지나온 뱃길을 박물관처럼
 * 돌아보는" 장치고, 릴은 **지금 눈앞에서 벌어지는 일**이다. 그래서 테두리가
 * 없고 화면을 꽉 채운다.
 */

const CSS = `
#reel { position:absolute; inset:0; z-index:64; display:none;
  pointer-events:none; overflow:hidden; background:#040306;
  font-family:var(--body); }
#reel.on { display:block; pointer-events:auto; cursor:default; }

/* 그림 한 장. 여러 장이 겹쳐 있고 지금 장만 보인다. */
#reel .plate { position:absolute; inset:0; opacity:0;
  background-size:cover; background-position:center;
  transition:opacity var(--fade, 900ms) ease;
  will-change:opacity, transform; }
#reel .plate.in { opacity:1; }
/* 켄 번스 — 아주 느리게 밀고 당긴다. 장마다 방향을 달리해서 리듬이 생긴다. */
@keyframes reelPush {
  from { transform:scale(1.0) translate3d(0,0,0); }
  to   { transform:scale(var(--zoom,1.12)) translate3d(var(--px,0), var(--py,0), 0); }
}
#reel .plate.in { animation:reelPush var(--hold, 2600ms) linear forwards; }

/* 색조 한 겹. 장면의 감정을 색으로 깐다 — 불이면 붉게, 물이면 푸르게. */
#reel .wash { position:absolute; inset:0; pointer-events:none;
  mix-blend-mode:soft-light; opacity:0; transition:opacity 1.2s ease; }
#reel.on .wash { opacity:1; }

/* 가장자리 그늘. 영화처럼 보이려는 게 아니라 글을 읽히게 하려는 것이다. */
#reel .vig { position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 78% 70% at 50% 46%,
    transparent 34%, rgba(4,3,6,.55) 76%, rgba(4,3,6,.92) 100%); }

/* 위아래 검은 띠. 있으면 '지금은 연출' 이라는 신호가 된다. */
#reel .bar { position:absolute; left:0; right:0; height:0;
  background:#040306; transition:height .7s cubic-bezier(.3,.8,.3,1); }
#reel .bar.top { top:0; }
#reel .bar.bot { bottom:0; }
#reel.on .bar { height:7.5%; }

/* 불티·눈·먼지. 장면이 정하는 입자. */
#reel .motes { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
#reel .motes i { position:absolute; border-radius:50%;
  animation:reelMote linear infinite; }
@keyframes reelMote {
  0%   { transform:translate3d(0,0,0) scale(.5); opacity:0; }
  12%  { opacity:var(--a,.9); }
  85%  { opacity:calc(var(--a,.9) * .35); }
  100% { transform:translate3d(var(--dx,0), var(--dy,-120px), 0) scale(1.1); opacity:0; }
}

/* 글. 액자의 띠 장식은 쓰지 않는다 — 여기는 액자가 아니다. */
#reel .say { position:absolute; left:50%; bottom:13.5%; transform:translateX(-50%);
  width:min(860px, 88vw); text-align:center; }
#reel .say span { display:block; font-family:var(--serif);
  font-size:clamp(19px, 2.05vw, 27px); line-height:1.95; letter-spacing:.055em;
  color:#f4ead6; opacity:0; transform:translateY(11px);
  transition:opacity .75s ease, transform .85s cubic-bezier(.2,.8,.3,1);
  text-shadow:0 2px 8px rgba(0,0,0,.96), 0 4px 28px rgba(0,0,0,.92); }
#reel .say span.in { opacity:1; transform:none; }
#reel .say span em { font-style:normal; color:var(--flame, #ffc46a); }

/* 어디인지 한 줄. 장면이 바뀌는 자리에서만 뜬다. */
#reel .where { position:absolute; left:50%; top:11.5%; transform:translateX(-50%);
  font-family:var(--serif); font-size:12.5px; letter-spacing:.44em; text-indent:.44em;
  color:#e0b264; opacity:0; transition:opacity .9s ease;
  text-shadow:0 2px 10px rgba(0,0,0,.95); }
#reel .where.in { opacity:1; }

/* 마지막 암전. 다음 화면이 이 어둠 위로 올라온다. */
#reel .black { position:absolute; inset:0; background:#040306;
  opacity:0; pointer-events:none; transition:opacity .55s ease; }
#reel.out .black { opacity:1; }

#reel .skip { position:absolute; right:26px; bottom:22px; font-family:var(--serif);
  font-size:11px; letter-spacing:.26em; text-indent:.26em; color:#7d7160;
  border:1px solid #3b3227; border-radius:2px; padding:9px 16px 9px 18px;
  background:rgba(12,9,6,.6); cursor:pointer; opacity:0;
  transition:opacity .6s ease .9s, color .14s, border-color .14s, background .14s; }
#reel.on .skip { opacity:1; }
#reel .skip:hover { color:var(--ivory); border-color:var(--bronze); background:rgba(40,28,16,.8); }
`

/**
 * 장면의 분위기. 색조와 입자를 한 벌로 묶어 둔다 —
 * 컷신마다 따로 적으면 열두 군데에 같은 숫자를 쓰게 된다.
 */
const MOODS = {
  /** 불타는 것. 트로이, 이스마로스. */
  fire: {
    wash: 'radial-gradient(ellipse 70% 60% at 50% 72%, rgba(255,120,40,.5), rgba(120,30,10,.25) 55%, transparent 85%)',
    flame: '#ffb45a',
    mote: { n: 34, color: '#ffb464', size: [2, 5], dy: [-260, -120], dx: [-60, 60], dur: [4.5, 9] },
  },
  /** 바다·소용돌이. 메시나, 세이렌. */
  water: {
    wash: 'radial-gradient(ellipse 78% 70% at 50% 50%, rgba(60,140,220,.42), rgba(10,40,80,.3) 60%, transparent 88%)',
    flame: '#8fd0ff',
    mote: { n: 26, color: '#bfe4ff', size: [2, 4], dy: [-160, 60], dx: [-140, 140], dur: [3.5, 7] },
  },
  /** 저승. 아가멤논. */
  under: {
    wash: 'radial-gradient(ellipse 74% 66% at 50% 56%, rgba(150,60,90,.38), rgba(40,14,30,.34) 58%, transparent 88%)',
    flame: '#e08090',
    mote: { n: 30, color: '#c49ce8', size: [2, 4], dy: [-240, -90], dx: [-50, 50], dur: [5, 10] },
  },
  /** 눈·북쪽. 텔레필로스. */
  snow: {
    wash: 'radial-gradient(ellipse 80% 72% at 50% 40%, rgba(180,210,240,.34), rgba(60,80,110,.26) 62%, transparent 90%)',
    flame: '#cfe4ff',
    mote: { n: 44, color: '#e8f2ff', size: [2, 4], dy: [140, 320], dx: [-90, 90], dur: [5, 11] },
  },
  /** 돌·궁전. 이타카. */
  stone: {
    wash: 'radial-gradient(ellipse 76% 68% at 50% 52%, rgba(220,170,90,.3), rgba(70,50,24,.28) 60%, transparent 88%)',
    flame: '#ffd08a',
    mote: { n: 20, color: '#e8d8b0', size: [1, 3], dy: [-120, -40], dx: [-40, 40], dur: [6, 12] },
  },
  /** 아무 색도 얹지 않는다. */
  none: { wash: 'none', flame: '#ffc46a', mote: { n: 0 } },
}

const rnd = (a, b) => a + Math.random() * (b - a)

function moteHTML(spec) {
  if (!spec?.n) return ''
  return Array.from({ length: spec.n }, () => {
    const [s0, s1] = spec.size, [d0, d1] = spec.dur
    const sz = rnd(s0, s1).toFixed(1)
    return `<i style="left:${rnd(0, 100).toFixed(1)}%;top:${rnd(10, 100).toFixed(1)}%;`
      + `width:${sz}px;height:${sz}px;background:${spec.color};`
      + `box-shadow:0 0 ${(sz * 2.2).toFixed(0)}px ${spec.color};`
      + `--dx:${rnd(spec.dx[0], spec.dx[1]).toFixed(0)}px;--dy:${rnd(spec.dy[0], spec.dy[1]).toFixed(0)}px;`
      + `--a:${rnd(0.45, 0.95).toFixed(2)};`
      + `animation-duration:${rnd(d0, d1).toFixed(1)}s;animation-delay:${(-rnd(0, d1)).toFixed(1)}s"></i>`
  }).join('')
}

export class Reel {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'reel'
    root.appendChild(this.el)
    this._pre = new Set()
  }

  /**
   * 미리 받아 둔다. 컷신이 열릴 때 디코딩하면 첫 장에서 버벅인다 —
   * 액자에서 겪은 것과 같은 문제다.
   */
  preload(urls) {
    for (const u of urls ?? []) {
      if (!u || this._pre.has(u)) continue
      this._pre.add(u)
      const img = new Image()
      img.decoding = 'async'
      img.src = u
      img.decode?.().catch(() => {})
    }
  }

  close() {
    this.el.classList.remove('on', 'out')
    document.body.style.cursor = ''
  }

  /**
   * @param o.shots  [{ art, text, hold }] — 그림 한 장과 그때 뜰 글.
   *                 art 를 빼면 앞 장이 그대로 남는다 (같은 그림에 글만 바뀜)
   * @param o.mood   MOODS 의 이름
   * @param o.where  화면 위에 작게 뜰 장소
   * @param o.keepOpen  true 면 암전한 채로 넘긴다
   */
  play({ shots = [], mood = 'none', where = null, keepOpen = false } = {}) {
    return new Promise(resolve => {
      const M = MOODS[mood] ?? MOODS.none
      const T = []

      // 그림은 미리 다 깔아 두고 겹쳐 넘긴다. 그때그때 만들면 첫 프레임이 빈다.
      const plates = shots.map((s, i) => {
        const zoom = 1.06 + (i % 3) * 0.045
        const px = ((i % 2) ? 1 : -1) * rnd(8, 22)
        const py = ((i % 3) ? -1 : 1) * rnd(4, 14)
        // url() 안에는 홑따옴표를 쓴다. style="..." 안에서 쌍따옴표를 쓰면
        // 속성이 거기서 끝나 버려서 background-image 가 통째로 빈다 —
        // 실제로 그래서 그림이 안 보이고 색조와 불티만 나왔다.
        const bg = s.art ? `background-image:url('${s.art}');` : ''
        return `<div class="plate" data-i="${i}" style="${bg}--zoom:${zoom.toFixed(3)};--px:${px.toFixed(0)}px;--py:${py.toFixed(0)}px"></div>`
      }).join('')

      this.el.style.setProperty('--flame', M.flame)
      this.el.innerHTML = `
        ${plates}
        <div class="wash" style="background:${M.wash}"></div>
        <div class="motes">${moteHTML(M.mote)}</div>
        <div class="vig"></div>
        <div class="bar top"></div><div class="bar bot"></div>
        ${where ? `<div class="where">${where}</div>` : ''}
        <div class="say"><span></span></div>
        <div class="black"></div>
        <button class="skip" type="button">SKIP</button>`
      this.el.classList.remove('out')
      this.el.classList.add('on')
      document.body.style.cursor = 'default'

      const plateEls = [...this.el.querySelectorAll('.plate')]
      const span = this.el.querySelector('.say span')
      const whereEl = this.el.querySelector('.where')

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

      let t = 260
      shots.forEach((s, i) => {
        const hold = s.hold ?? 2600
        T.push(setTimeout(() => {
          // 겹쳐 넘긴다. 페이드를 hold 의 3분의 1 로 잡으면 넘기는 게 보이면서
          // 머무는 시간도 남는다 — 절반을 넘기면 계속 흐릿한 화면이 된다.
          const fade = Math.min(1100, hold * 0.34)
          const el = plateEls[i]
          if (el) {
            el.style.setProperty('--fade', `${fade}ms`)
            el.style.setProperty('--hold', `${hold + fade}ms`)
            el.classList.add('in')
            // 지난 장은 다음 장이 다 올라온 뒤에 내린다. 동시에 바꾸면 사이가 빈다.
            if (i > 0) T.push(setTimeout(() => plateEls[i - 1]?.classList.remove('in'), fade))
          }
          span.classList.remove('in')
          T.push(setTimeout(() => {
            if (s.text) { span.innerHTML = s.text; span.classList.add('in') }
          }, Math.min(320, fade * 0.4)))
        }, t))
        t += hold
      })

      if (whereEl) T.push(setTimeout(() => whereEl.classList.add('in'), Math.max(700, t - 1600)))

      // 마지막 글을 한 번 접고 암전한다
      T.push(setTimeout(() => span.classList.remove('in'), t))
      T.push(setTimeout(() => this.el.classList.add('out'), t + 300))
      T.push(setTimeout(finish, t + 900))
    })
  }
}
