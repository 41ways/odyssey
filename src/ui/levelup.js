import { installTheme, meanderURI } from './theme.js'

/**
 * 계열 문장(紋章). 칼·활·발 셋뿐이라(stats.js 의 LINEAGES) 아이콘도 셋 —
 * 거기에 계열 없는 둘(암브로시아·"아무도 아니다")은 id로 따로 짚는다.
 * relic.js 의 SIGILS 와 같은 규칙(64 사각, stroke #c8973e, 강조만 옅게 채움).
 * 이게 있어야 카드 넉 장이 글자로만 안 갈리고 한눈에 계열이 잡힌다.
 */
const ICON = {
  blade: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M124.812 388.907a60.718 60.718 0 0 0 16.564 11.588L107.28 435.07a48.756 48.756 0 0 0-28.35-28.006l34.16-34.576a61.093 61.093 0 0 0 11.722 16.42zm209.598-276.44c-32.754 33.14-57.813 79.127-103.008 124.853-9.13 9.245-40.292 37.355-58.303 53.555l49.223 48.64c15.98-18.24 43.727-49.744 52.858-58.978 45.154-45.726 90.828-71.39 123.57-104.477C452.683 121.485 481 28.492 481 28.492s-92.67 29.4-146.59 83.976zM83.656 430.594a30.92 30.92 0 1 0 .26 43.727 30.817 30.817 0 0 0-.26-43.727zm91.13-40.603c11.16 0 20.822-2.81 24.497-6.56l20.885-21.103-69.88-69.047-20.823 21.135c-7.964 8.068-11.233 43.06 7.85 61.905 10.12 10.026 24.79 13.66 37.47 13.66z"/></svg>`,
  arrow: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M331.734 20.443a4.421 4.421 0 0 0-1.802.327c-27.736 11.543-47.295 57.495-29.899 76.671 33.52 38.946 72.835 55.573 90.147 128.434 2.607 20.15 1.218 40.094 0 60.25-17.312 72.861-56.627 89.488-90.147 128.434-17.396 19.176 2.163 65.128 29.899 76.671 9.038 3.762 28.025-26.165 21.752-25.209-16.34 2.491-37.8-20.941-28.387-28.93 38.47-32.65 105.49-100.055 100.277-135.552-2.211-15.057-9.35-30.36-15.574-45.539 6.225-15.18 13.363-30.482 15.574-45.54 5.214-35.496-61.806-102.901-100.277-135.552-9.412-7.988 12.047-31.42 28.387-28.93 5.881.897-10.44-25.35-19.95-25.535zM152 24.23l-21.441 53.602L152 99.273l21.441-21.441zm-9 91.497v296.546l9-9 9 9V115.727l-2.637 2.636-6.363 6.364zm160 9.847v260.824l18-17.53V143.104zM152 428.727l-23 23v38.546l23-23 23 23v-38.546z"/></svg>`,
  step: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M24.928 23.108c8.025 58.99 116.646 113.317 197.394 132.7-51.69.28-128.258-5.556-185.43-22.678 24.43 47.073 109.81 60.78 187.105 67.028-57.808 15.162-109.87 21.8-173.96 19.956C82.1 255.192 166.16 254.14 236.62 242.794c-38.85 19.96-83.113 32.74-129.636 39.588 40.913 20.362 106.803 1.757 147.45-4.43-19.043 16.43-41.836 28.653-66.856 37.932 25.075 10.61 64.635 2.653 92.165-11.408-3.48 11.993-15.64 25.648-31.718 35.095 20.82 4.43 46.642.674 66.817-6.833 27.207 10.518 36.235 23.727 37.968 38.06-41.966 13.17-57.812 106.545 29.825 105.43-41.212-17.458-48.907-61.13-19.812-76.848 44.16-23.86 65.382 48.02 55.51 86.106 33.642-12.11 36.518-88.94-7.634-108.167 46.837.503 67.127 32.147 54.327 72.508 53.774-63.696 9.178-103.04-46.535-99.114-82.715-5.958-156.808-121.435-127.108-150.472 22.79-19.817 22.544-51.31-6.26-65.664-72.81-36.302-120.06-22.37-260.198-111.466z"/></svg>`,
  ambrosia: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M206.47 19.5c-4.53 42.503-28.564 74.22-28.564 95.53.004 10.575 15.696 23.5 30.344 23.5 4.005 0 7.924-.994 11.47-2.686-2.032 5.148-3.804 10.014-5.19 14.625-14.796 1.954-28.22 4.893-39.655 8.655-10.928 3.596-20.086 7.868-27.125 13.344-7.04 5.474-12.5 12.918-12.5 21.905 0 1.2.096 2.357.28 3.5h-.06c0 71.244 44.097 130.45 101.936 141.97-8.37 41.925-29.252 79.813-58.344 110.092-8.084 4.503-12.75 9.735-12.75 15.344 0 16.683 41.04 30.22 91.625 30.22s91.657-13.537 91.657-30.22c0-5.672-4.772-10.962-13.03-15.5-29.02-30.266-49.46-68.122-57.627-110C336.594 328.085 380.5 268.967 380.5 197.876h-.094c.187-1.143.28-2.3.28-3.5.002-8.987-5.49-16.43-12.53-21.906-7.04-5.477-16.196-9.75-27.125-13.345-16.012-5.27-35.905-8.914-58.03-10.5-7.514-27.144-27.472-62.53-34.656-104.22-2.246 21.072-8.228 40.076-14.72 57.064-5.578-21.2-21.483-49.06-27.155-81.97zm110.81 9.438c-4.078 38.274-25.717 66.84-25.717 86.03 0 9.523 14.153 21.157 27.343 21.157 12.9 0 24.626-11.597 24.625-21.625 0-19.986-20.012-49.374-26.25-85.563zm-31.405 138.656c19.192 1.662 36.208 4.97 49.313 9.28 9.588 3.156 17.065 6.895 21.5 10.345 4.434 3.45 5.312 5.84 5.312 7.155 0 1.314-.877 3.675-5.313 7.125-4.435 3.45-11.91 7.22-21.5 10.375-19.176 6.31-46.743 10.438-77.218 10.438-30.477 0-58.075-4.128-77.25-10.438-9.59-3.155-17.066-6.925-21.5-10.375-4.436-3.45-5.282-5.81-5.282-7.125 0-1.314.846-3.706 5.28-7.156 4.436-3.45 11.913-7.19 21.5-10.345 8.754-2.88 19.266-5.3 31-7.094 2 13.153 21.07 28.064 38.938 28.064 18.173 0 34.696-16.06 35.22-30.25z"/></svg>`,
  nobody: `<svg viewBox="0 0 512 512" fill="#c8973e"><path d="M418.813 30.625c-21.178 26.27-49.712 50.982-84.125 70.844-36.778 21.225-75.064 33.62-110.313 38.06a310.317 310.317 0 0 0 6.813 18.25c16.01.277 29.366-.434 36.406-1.5l9.47-1.53 8.436-1.28.22 10.186a307.48 307.48 0 0 1-1.095 18.72l56.625 8.843c.86-.095 1.713-.15 2.563-.157 11.188-.114 21.44 7.29 24.468 18.593.657 2.448.922 4.903.845 7.313 5.972-2.075 11.753-4.305 17.28-6.72l9.595-4.188 2.313 10.22a340.211 340.211 0 0 1 7.375 48.062C438.29 247.836 468.438 225.71 493 197.5c-3.22-36.73-16.154-78.04-39.125-117.813a290.509 290.509 0 0 0-2.22-3.78l-27.56 71.374c5.154.762 10.123 3.158 14.092 7.126 9.81 9.807 9.813 25.69 0 35.5-9.812 9.81-25.722 9.807-35.53 0-8.86-8.858-9.69-22.68-2.532-32.5l38.938-100.844a322.02 322.02 0 0 0-20.25-25.937zM51.842 118.72c-8.46 17.373-15.76 36.198-21.187 56.436-14.108 52.617-13.96 103.682-2.812 143.438 13.3-2.605 26.442-3.96 39.312-4.03 1.855-.012 3.688.02 5.53.06 20.857.48 40.98 4.332 59.97 11.5a355.064 355.064 0 0 1-1.656-34.218c0-27.8 3.135-54.377 9-78.937l2.47-10.407 9.655 4.562c29.467 13.98 66.194 23.424 106.28 25.22 5.136-20.05 8.19-39.78 9.408-58.75-35.198 4.83-75.387 2.766-116.407-8.22-38.363-10.272-72.314-26.78-99.562-46.656zm230.594 82.218c-1.535 10.452-3.615 21.03-6.218 31.687a312.754 312.754 0 0 0 46-3.97 24.98 24.98 0 0 1-1.532-21.748l-38.25-5.97zM105 201.375l4.156 18.22-21.594 4.905c8.75 5.174 13.353 15.703 10.594 26-3.32 12.394-16.045 19.758-28.437 16.438-12.394-3.32-19.76-16.075-16.44-28.47a23.235 23.235 0 0 1 3.126-6.874l-21.062 4.78-4.125-18.218 73.78-16.78zm388.594 22.813c-25.53 25.46-55.306 45.445-86.906 60.5.05 2.397.093 4.8.093 7.218 0 9.188-.354 18.232-1.03 27.125 16.635 1.33 32.045-1.7 45.344-9.374 25.925-14.962 40.608-45.694 42.5-85.47zm-338.844 3c-4.03 19.993-6.33 41.31-6.406 63.593l.125-.342c30.568 10.174 62.622 17.572 95.25 21.375l7.5.875.718 7.5 5.687 60.125-18.625 1.75-2.53-26.75a23.117 23.117 0 0 1-14.845.968c-12.393-3.32-19.76-16.042-16.438-28.436.285-1.06.647-2.08 1.063-3.063a496.627 496.627 0 0 1-57.406-14.53c2.69 49.62 16.154 94.04 36.094 126.656 22.366 36.588 52.13 57.78 83.968 57.78 31.838.003 61.602-21.19 83.97-57.78 19.536-31.96 32.846-75.244 35.905-123.656a499.132 499.132 0 0 1-48.25 11.656c1.914 4.57 2.415 9.78 1.033 14.938-3.322 12.394-16.045 19.758-28.438 16.437a23.01 23.01 0 0 1-2.125-.686l-2.5 26.47-18.594-1.752 5.688-60.125.72-7.5 7.498-.875c29.245-3.407 57.995-9.717 85.657-18.312v-1.594c0-21.573-2.27-42.23-6.064-61.75C351.132 242.653 313.092 250 272.312 250c-43.59 0-83.986-8.658-117.562-22.813zm-87.5 105.968c-10.87.102-21.995 1.22-33.375 3.313 12.695 31.62 33.117 53.07 59 60 16.9 4.523 34.896 2.536 52.813-5.25-4.382-13.89-7.874-28.606-10.344-43.97-21.115-9.623-43.934-14.32-68.094-14.094zm137.5 80.22h130.813c-40.082 44.594-92.623 42.844-130.813 0z"/></svg>`,
  // 메시나 갈림길(main.js 의 chooseFork) 도 이 카드를 그대로 빌려 쓴다 —
  // 스킬라(절벽·촉수)와 카리브디스(소용돌이)도 있으면 고르기 전에 눈에 걸린다.
  skylla: `<svg viewBox="0 0 64 64" fill="none" stroke="#c8973e" stroke-width="2.2">
    <path d="M10 8v30c0 14 10 22 22 22s22-8 22-22V8" fill="#c8973e" fill-opacity=".12"/>
    <path d="M22 24c0 6 4 10 10 10s10-4 10-10" stroke-linecap="round"/>
    <path d="M18 40c2 6 7 10 14 10s12-4 14-10" stroke-linecap="round"/></svg>`,
  charybdis: `<svg viewBox="0 0 64 64" fill="none" stroke="#c8973e" stroke-width="2.2">
    <path d="M32 8a24 24 0 1 1 -17 7" stroke-linecap="round"/>
    <path d="M32 16a16 16 0 1 1 -11 4.6" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="4.6" fill="#c8973e" fill-opacity=".35"/></svg>`,
}
const iconFor = u => ICON[u.id] ?? ICON[u.boss] ?? ICON[u.lineage] ?? ''

const CSS = `
#levelup { position:absolute; inset:0; z-index:50; display:none; place-items:center;
  pointer-events:none; font-family:var(--body);
  background:
    radial-gradient(ellipse 95% 65% at 50% 42%, rgba(232,200,132,.12), transparent 66%),
    linear-gradient(180deg, rgba(10,9,7,.82), rgba(5,4,3,.95));
}
/* 해협의 갈림길처럼 '어디서 고르는지' 가 중요한 선택은 바탕을 얇게 한다.
   화면을 다 덮으면 배 위에서 고르는 건지 어디서 고르는 건지 알 수가 없다. */
#levelup.sheer {
  background:
    radial-gradient(ellipse 70% 52% at 50% 46%, rgba(10,16,26,.30), rgba(4,7,12,.72) 100%),
    linear-gradient(180deg, rgba(6,10,16,.42), rgba(4,6,10,.60));
  backdrop-filter:blur(2.5px); }
#levelup.on { display:grid; pointer-events:auto; cursor:default; }
#levelup .wrap { text-align:center; animation:lvlIn .32s cubic-bezier(.2,.8,.3,1); }
@keyframes lvlIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }

#levelup .band { height:14px; width:min(760px, 84vw); margin:0 auto;
  background-image:${meanderURI('#c8973e', 0.9)}; background-repeat:repeat-x;
  background-position:center; opacity:.5; }
#levelup h2 { font-family:var(--serif); font-size:34px; font-weight:700;
  letter-spacing:.24em; text-indent:.24em; color:var(--ivory); margin:22px 0 8px;
  text-shadow:0 0 44px rgba(232,200,132,.45), 0 2px 0 #4a3a1c, 0 4px 18px #000; }
#levelup .sub { font-size:13px; color:var(--text-dim); margin-bottom:8px; letter-spacing:.03em; }
#levelup .sub::before { content:'“'; } #levelup .sub::after { content:'”'; }
#levelup .unlocked { font-family:var(--serif); font-size:12px; letter-spacing:.22em;
  color:var(--gold); margin:14px 0 4px; text-shadow:0 0 22px rgba(232,200,132,.5); }
#levelup .cards { display:flex; gap:18px; justify-content:center; margin-top:26px;
  perspective:1400px; }

/* 등장 — 한 장씩 차례로 선다. 윗등급은 뒤집히며 열린다. */
#levelup button { opacity:0; transform:translateY(22px);
  transition:opacity .34s ease, transform .4s cubic-bezier(.2,.9,.3,1),
             border-color .15s, box-shadow .15s; }
#levelup button.in { opacity:1; transform:none; }
#levelup button.sealed { opacity:1; transform:rotateY(90deg); }
#levelup button.opening { transform:rotateY(0deg);
  transition:transform .5s cubic-bezier(.2,.9,.25,1); }

/* 윗등급이 열릴 때 뒤에서 터지는 빛 */
#levelup .burst { position:absolute; left:50%; top:50%; width:340px; height:340px;
  transform:translate(-50%,-50%) scale(.3); border-radius:50%; pointer-events:none;
  opacity:0; transition:opacity .5s ease, transform .7s cubic-bezier(.1,.8,.3,1); }
#levelup .burst.go { opacity:.85; transform:translate(-50%,-50%) scale(1); }
#levelup .burst.fade { opacity:0; }

/* 윗등급 카드 테두리가 한 번 번쩍인다 */
#levelup button.flash { box-shadow:inset 0 0 0 2px currentColor, 0 0 60px currentColor; }

/* 등급 도장이 찍히듯 들어온다 */
#levelup .tier { opacity:0; transform:scale(1.9); transition:opacity .2s ease, transform .3s cubic-bezier(.2,.9,.2,1); }
#levelup button.in .tier, #levelup button.opening .tier { opacity:1; transform:none; }

/* 청동판 — 위 모서리에 빛이 걸리고 아래로 그늘진다 */
#levelup button { width:230px; padding:0 0 22px; text-align:left; cursor:pointer;
  color:var(--text); font:inherit; border:1px solid var(--line); border-radius:3px;
  background:linear-gradient(180deg, var(--plate) 0%, var(--ground2) 58%, var(--ground) 100%);
  box-shadow:inset 0 1px 0 rgba(232,200,132,.22), inset 0 0 0 1px rgba(232,200,132,.06),
    0 18px 44px rgba(0,0,0,.6);
  transition:border-color .15s, transform .15s, box-shadow .15s; overflow:hidden;
  position:relative; }
/* 판을 고정한 리벳 */
#levelup button::after { content:''; position:absolute; right:11px; bottom:11px;
  width:7px; height:7px; pointer-events:none;
  background:radial-gradient(circle, rgba(232,200,132,.75), rgba(232,200,132,.28) 42%, transparent 62%); }
#levelup button:hover { transform:translateY(-5px); border-color:var(--gold);
  box-shadow:inset 0 1px 0 rgba(232,200,132,.5), inset 0 0 0 1px rgba(232,200,132,.28),
    0 26px 52px rgba(0,0,0,.7), 0 0 38px rgba(232,200,132,.16); }
#levelup button .top { height:13px; background-image:${meanderURI('#c8973e', 0.85)};
  background-repeat:repeat-x; background-position:center; opacity:.4; margin-bottom:20px; }
#levelup button:hover .top { opacity:.85; }
#levelup .pad { padding:0 20px; }
#levelup .icon { width:30px; height:30px; margin-bottom:12px; opacity:.92; }
#levelup .icon svg { width:100%; height:100%; }
#levelup .tag { font-family:var(--serif); font-size:10px; letter-spacing:.26em;
  color:var(--gold-dim); margin-bottom:13px; display:flex; justify-content:space-between; align-items:center; }
#levelup .num { font-size:10px; color:#5f564c; border:1px solid #3d332b;
  border-radius:2px; padding:1px 6px; }
#levelup .tier { display:inline-block; font-family:var(--serif); font-size:9.5px;
  letter-spacing:.2em; font-weight:700; padding:3px 9px; border-radius:2px; margin-bottom:12px; }
#levelup .name { font-family:var(--serif); font-size:21px; font-weight:700;
  margin-bottom:10px; letter-spacing:.02em; color:var(--ivory); }
#levelup .desc { font-size:12.5px; color:var(--gold); line-height:1.7; font-weight:700; }
#levelup .flavor { font-size:11px; color:var(--text-dim); line-height:1.7; margin-top:13px;
  padding-top:12px; border-top:1px solid var(--line-dim); }

/* 등급마다 테두리 색이 다르다 — 무엇을 집는지 눈으로 먼저 안다 */
#levelup button.t1 { border-color:#2f4d70; }
#levelup button.t1:hover { border-color:#5aa8ff; box-shadow:inset 0 0 0 1px rgba(90,168,255,.35), 0 22px 46px rgba(0,0,0,.65); }
#levelup button.t2 { border-color:#4a3566; }
#levelup button.t2:hover { border-color:#c77dff; box-shadow:inset 0 0 0 1px rgba(199,125,255,.35), 0 22px 46px rgba(0,0,0,.65); }
#levelup button.t3 { border-color:#6b4d14; background:linear-gradient(180deg,#2e2113,#16100a); }
#levelup button.t3:hover { border-color:#ffb02e; box-shadow:inset 0 0 0 1px rgba(255,176,46,.45), 0 26px 54px rgba(0,0,0,.7); }
`

export class LevelUp {
  constructor(root) {
    installTheme()
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    this.el = document.createElement('div')
    this.el.id = 'levelup'
    root.appendChild(this.el)
    this.onKey = this.onKey.bind(this)
  }

  get open() { return this.el.classList.contains('on') }

  /** 고를 때까지 기다린다. 숫자 키로도 고를 수 있다. */
  show({ heading, sub, choices, unlocked = [], tiers = [], sheer = false }) {
    this.el.classList.toggle('sheer', !!sheer)
    return new Promise(resolve => {
      this._resolve = resolve
      this._choices = choices
      this.el.innerHTML = `
        <div class="wrap">
          <div class="band"></div>
          <h2>${heading}</h2>
          <div class="sub">${sub}</div>
          ${unlocked.length ? `<div class="unlocked">${unlocked.map(u => `${tiers[u.tier]?.label ?? ''} 해금 — ${u.name}`).join(' · ')}</div>` : ''}
          <div class="cards">
            ${choices.map((u, i) => `
              <button data-i="${i}" class="t${u.tier ?? 0}" data-tier="${u.tier ?? 0}">
                ${u.tier > 0 ? `<div class="burst" style="background:radial-gradient(circle, ${tiers[u.tier].color}88, ${tiers[u.tier].color}22 42%, transparent 68%)"></div>` : ''}
                <div class="top"></div>
                <div class="pad">
                  ${iconFor(u) ? `<div class="icon">${iconFor(u)}</div>` : ''}
                  <div class="tag"><span>${u.tag ?? ''}</span><span class="num">${i + 1}</span></div>
                  ${u.tier > 0 ? `<div class="tier" style="background:${tiers[u.tier].color}22;color:${tiers[u.tier].color}">${tiers[u.tier].label}</div>` : ''}
                  <div class="name">${u.name}</div>
                  <div class="desc">${u.desc}</div>
                  ${u.flavor ? `<div class="flavor">${u.flavor}</div>` : ''}
                </div>
              </button>`).join('')}
          </div>
          <div class="band" style="margin-top:30px"></div>
        </div>`
      this.el.classList.add('on')
      document.body.style.cursor = 'default'
      for (const b of this.el.querySelectorAll('button')) {
        b.addEventListener('click', () => this.pick(+b.dataset.i))
      }
      this.#reveal()
      addEventListener('keydown', this.onKey)
    })
  }

  /**
   * 카드 등장.
   * 일반은 차례로 서고, 윗등급은 한 박자 늦게 뒤집히며 열린다 —
   * 무엇이 특별한지 눈이 먼저 안다.
   * (rAF 는 창이 숨겨져 있으면 안 돌아서 전부 타이머로 돌린다)
   */
  #reveal() {
    const cards = [...this.el.querySelectorAll('button')]
    let t = 40
    for (const b of cards) {
      const tier = +b.dataset.tier
      if (tier === 0) {
        setTimeout(() => b.classList.add('in'), t)
        t += 90
      } else {
        // 윗등급: 옆으로 세워 뒀다가 늦게 연다
        b.classList.add('sealed')
        const at = t + 260
        setTimeout(() => {
          const burst = b.querySelector('.burst')
          burst?.classList.add('go')
          b.classList.remove('sealed')
          b.classList.add('opening', 'in', 'flash')
          setTimeout(() => { b.classList.remove('flash'); burst?.classList.add('fade') }, 420)
        }, at)
        t = at + 140
      }
    }
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
    this.el.classList.remove('on')
    document.body.style.cursor = ''
    r(this._choices[i])
  }
}
