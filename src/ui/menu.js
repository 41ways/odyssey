import { installTheme, meanderURI } from './theme.js'

/**
 * 멈춤 메뉴와 소리 단추.
 *
 * 키보드에만 걸어 두면 있는 줄 모른다 — 음소거는 눈에 보이는 단추로 따로 낸다.
 * Esc 는 '지금 하던 걸 멈추고 나가는' 키다. 다른 전체 화면이 떠 있을 때는
 * 그쪽이 먼저 Esc 를 쓰므로 여기서는 열지 않는다 (main.js 가 막는다).
 *
 * 멈춤은 게임의 paused 를 직접 건드리되, 들어올 때의 값을 기억했다가
 * 나갈 때 되돌린다. 연출 때문에 이미 멈춰 있었는데 메뉴를 닫았다고
 * 같이 풀려 버리면 컷신 중에 몸이 움직인다.
 */
const CSS = `
/* ── 소리 단추 ─────────────────────────────────────────── */
#mute { position:absolute; right:20px; top:18px; z-index:72; pointer-events:auto;
  width:34px; height:34px; display:grid; place-items:center; cursor:pointer;
  border:1px solid #4a3c22; border-radius:3px;
  background:linear-gradient(180deg, rgba(42,33,18,.82), rgba(18,13,7,.88));
  box-shadow:inset 0 1px 0 rgba(255,225,165,.18), 0 4px 14px rgba(0,0,0,.6);
  transition:border-color .14s, box-shadow .14s, transform .14s; }
#mute:hover { border-color:var(--gold); transform:translateY(-1px);
  box-shadow:inset 0 1px 0 rgba(255,225,165,.3), 0 6px 18px rgba(0,0,0,.7),
             0 0 18px rgba(232,200,132,.22); }
#mute svg { width:17px; height:17px; display:block; }
#mute .on, #mute .off { stroke:var(--gold); fill:none; stroke-width:1.6;
  stroke-linecap:round; stroke-linejoin:round; }
#mute .body { fill:var(--gold); stroke:none; }
#mute.quiet .body { fill:#7a6b4c; }
#mute.quiet .on, #mute.quiet .off { stroke:#7a6b4c; }
#mute .wave { transition:opacity .16s; }
#mute .slash { opacity:0; transition:opacity .16s; }
#mute.quiet .wave { opacity:0; }
#mute.quiet .slash { opacity:1; }

/* ── 멈춤 메뉴 ─────────────────────────────────────────── */
#pause { position:absolute; inset:0; z-index:74; display:none; place-items:center;
  pointer-events:none; font-family:var(--body);
  background:
    radial-gradient(ellipse 80% 60% at 50% 42%, rgba(232,200,132,.08), transparent 66%),
    linear-gradient(180deg, rgba(8,6,4,.88), rgba(4,3,2,.95)); }
#pause.on { display:grid; pointer-events:auto; cursor:default; }
#pause .box { width:min(380px, 84vw); text-align:center; }
#pause .band { height:13px; background-image:${meanderURI()};
  background-repeat:repeat-x; background-position:center; opacity:.45; }
#pause h3 { font-family:var(--display); font-size:34px; font-weight:500;
  letter-spacing:.06em; color:var(--ivory); margin:22px 0 4px;
  text-shadow:0 0 50px rgba(232,200,132,.35), 0 4px 20px #000; }
#pause .where { font-family:var(--serif); font-size:11.5px; letter-spacing:.24em;
  color:#a48f68; margin-bottom:22px; }
#pause ul { list-style:none; margin:0 0 22px; padding:0; display:grid; gap:7px; }
#pause li { display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer;
  border:1px solid #3a2f1d; border-radius:3px; text-align:left;
  background:linear-gradient(180deg, rgba(34,26,14,.8), rgba(18,13,7,.88));
  transition:border-color .13s, background .13s, transform .13s; }
#pause li:hover { border-color:var(--gold); transform:translateX(3px);
  background:linear-gradient(180deg, rgba(50,38,20,.9), rgba(26,19,10,.92)); }
#pause .k { font-family:var(--serif); font-size:10px; color:#8a7548;
  border:1px solid #4d3f22; border-radius:2px; padding:2px 6px; min-width:26px;
  text-align:center; }
#pause .t { font-size:14.5px; color:var(--ivory); }
#pause .v { margin-left:auto; font-size:12px; color:#c8a16a; letter-spacing:.06em; }
#pause .keys { font-size:11.5px; line-height:2; color:#7d7264; letter-spacing:.02em;
  margin-bottom:20px; }
#pause .keys b { color:var(--gold-dim); font-weight:700; }
`

/** 소리 켜짐/꺼짐 한 벌. 물결과 빗금만 바뀐다. */
const SPEAKER = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path class="body" d="M4 9.5h3.4L12 5.6v12.8L7.4 14.5H4z"/>
  <g class="wave">
    <path class="on" d="M15.2 9.4a3.6 3.6 0 0 1 0 5.2"/>
    <path class="on" d="M17.6 7.2a7 7 0 0 1 0 9.6"/>
  </g>
  <g class="slash">
    <path class="off" d="M15.4 9.6l5 4.8"/>
    <path class="off" d="M20.4 9.6l-5 4.8"/>
  </g>
</svg>`

export class PauseMenu {
  /** @param game 멈춤·소리·재시작을 실제로 하는 주체 */
  constructor(root, game) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.game = game

    // 소리 단추 — 늘 보인다
    this.mute = document.createElement('div')
    this.mute.id = 'mute'
    this.mute.title = '소리 켜고 끄기 (M)'
    this.mute.innerHTML = SPEAKER
    this.mute.addEventListener('click', () => this.toggleMute())
    root.appendChild(this.mute)

    this.el = document.createElement('div')
    this.el.id = 'pause'
    root.appendChild(this.el)
    this.syncMute()
  }

  get open() { return this.el.classList.contains('on') }

  /** 단추 모양을 지금 상태에 맞춘다. */
  syncMute() {
    this.mute.classList.toggle('quiet', !!this.game.music?.muted)
  }

  toggleMute() {
    const m = this.game.music?.toggleMute()
    this.syncMute()
    if (this.open) this.render()
    else this.game.hud?.banner?.(m ? '음소거' : '소리 켜짐', m ? 'M 으로 다시 켠다' : '', 1.4)
    return m
  }

  toggle() { this.open ? this.close() : this.show() }

  show() {
    if (this.open) return
    // 이미 멈춰 있었는지 기억해 둔다. 연출 중이었다면 닫아도 풀면 안 된다.
    this._wasPaused = !!this.game.paused
    this.game.paused = true
    this.render()
    this.el.classList.add('on')
    document.body.style.cursor = 'default'
  }

  close() {
    if (!this.open) return
    this.el.classList.remove('on')
    document.body.style.cursor = ''
    if (!this._wasPaused) this.game.paused = false
  }

  render() {
    const g = this.game
    const muted = !!g.music?.muted
    const where = g.run?.view?.name ?? g.run?.stage?.name ?? ''
    this.el.innerHTML = `
      <div class="box">
        <div class="band"></div>
        <h3>Paused</h3>
        <div class="where">${where}</div>
        <ul>
          <li data-do="resume"><span class="k">Esc</span><span class="t">이어하기</span></li>
          <li data-do="mute"><span class="k">M</span><span class="t">소리</span>
            <span class="v">${muted ? '꺼짐' : '켜짐'}</span></li>
          <li data-do="restart"><span class="k">R</span><span class="t">처음부터</span></li>
        </ul>
        <div class="keys">
          <b>W A S D</b> 이동 · <b>마우스</b> 조준<br>
          <b>좌클릭</b> 칼 · <b>우클릭</b> 활 · <b>Space</b> 구르기
        </div>
        <div class="band"></div>
      </div>`
    for (const li of this.el.querySelectorAll('li')) {
      li.addEventListener('click', () => {
        const what = li.dataset.do
        if (what === 'resume') this.close()
        else if (what === 'mute') this.toggleMute()
        else if (what === 'restart') { this.close(); g.restart() }
      })
    }
  }
}
