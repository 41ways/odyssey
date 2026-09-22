import { installTheme, meanderURI } from './theme.js'

/**
 * 멈춤 메뉴와 소리 단추.
 *
 * 소리는 이 메뉴 안에서만 끄고 켠다. 화면 한구석에 단추를 띄워 두면
 * 싸우는 중에 눈이 자꾸 그리로 가고, 손이 미끄러져 눌리기도 한다.
 * 멈춘 다음에 만지는 것이면 멈춘 자리에 두는 게 맞다.
 *
 * Esc 는 '지금 하던 걸 멈추고 나가는' 키다. 다른 전체 화면이 떠 있을 때는
 * 그쪽이 먼저 Esc 를 쓰므로 여기서는 열지 않는다 (main.js 가 막는다).
 *
 * 멈춤은 게임의 paused 를 직접 건드리되, 들어올 때의 값을 기억했다가
 * 나갈 때 되돌린다. 연출 때문에 이미 멈춰 있었는데 메뉴를 닫았다고
 * 같이 풀려 버리면 컷신 중에 몸이 움직인다.
 */
const CSS = `
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
#pause .credits { text-align:left; font-size:12px; line-height:1.7; color:#bda87f; margin-bottom:20px; }
#pause .credits .row { margin-bottom:10px; }
#pause .credits .who { color:var(--ivory); }
#pause .credits .lic { color:#8a7548; font-size:11px; }
`

/** CC-BY 는 표기가 의무다 (CREDITS.md 참고). 게임 안에서 닿는 자리가 이 메뉴뿐이라 여기 둔다. */
const CC_BY = [
  { name: 'Agamemnon’s Helmet', who: 'Quesho', where: '오디세우스의 투구' },
  { name: 'Cyclops Rig', who: 'DM-913', where: '폴리페모스' },
  // 아래 셋은 실제로 화면에 쓰는 모델인데 빠져 있었다 — CREDITS.md 에는
  // 적어 뒀지만 게임 안 화면에는 없었다. CC-BY 는 표기가 라이선스 조건이라
  // CREDITS.md 에 적는 것만으로는 부족하다 (읽는 사람이 그 파일을 안 본다).
  { name: 'Kraken (Animation)', who: 'Yanez Designs', where: '스킬라의 촉수' },
  { name: 'Mermaid', who: 'Danny Dugas', where: '세이렌' },
  // 안티파테스 자신의 몸 — 부름꾼(맨몸 거인)은 이 파일이 아니라 CC0 라 표기가
  // 없다. 왕과 부름꾼을 헷갈린 주석이 bosses.js 에 있었다 (CREDITS.md 참고).
  { name: 'Fire-Branded Ogre', who: 'ribtibs', where: '안티파테스 · 라이스트리고네스' },
  // 유물·성장·장비 카드의 문장 아이콘 — 손으로 그린 선 그림에서
  // game-icons.net 으로 바꿨다. 거기는 CC BY 4.0 이 아니라 3.0 이라
  // lic 을 따로 준다. 작가별로 묶는다.
  { name: 'Game-icons.net 아이콘 (Lorc)', who: 'Lorc', where: '창·발·흉갑·바람·부엉이·가면·눈·잔', lic: '3.0' },
  { name: 'Game-icons.net 아이콘 (Delapouite)', who: 'Delapouite', where: '투구·팔가리개·망토·화살', lic: '3.0' },
  { name: 'Game-icons.net 아이콘 (Skoll)', who: 'Skoll', where: '견갑·칼', lic: '3.0' },
  { name: 'Game-icons.net 아이콘 (sbed)', who: 'sbed', where: '방패', lic: '3.0' },
]

export class PauseMenu {
  /** @param game 멈춤·소리·재시작을 실제로 하는 주체 */
  constructor(root, game) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.game = game

    this.el = document.createElement('div')
    this.el.id = 'pause'
    root.appendChild(this.el)
  }

  get open() { return this.el.classList.contains('on') }

  toggleMute() {
    const m = this.game.music?.toggleMute()
    this.game.ambience?.syncMute()
    if (this.open) this.render()
    return m
  }

  toggle() { this.open ? this.close() : this.show() }

  show() {
    if (this.open) return
    // 이미 멈춰 있었는지 기억해 둔다. 연출 중이었다면 닫아도 풀면 안 된다.
    this._wasPaused = !!this.game.paused
    this.game.paused = true
    this._showingCredits = false
    this.render()
    this.el.classList.add('on')
    document.body.style.cursor = 'default'
  }

  close() {
    if (!this.open) return
    // 출처를 보던 중이면 Esc 한 번은 멈춤 메뉴로 돌아가는 데 쓴다 —
    // 화면에 적힌 "Esc 돌아가기" 와 어긋나면 안 된다
    if (this._showingCredits) { this._showingCredits = false; this.render(); return }
    this.el.classList.remove('on')
    document.body.style.cursor = ''
    if (!this._wasPaused) this.game.paused = false
  }

  render() {
    if (this._showingCredits) return this.#renderCredits()
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
          <li data-do="mute"><span class="k">♪</span><span class="t">소리</span>
            <span class="v">${muted ? '꺼짐' : '켜짐'}</span></li>
          <li data-do="credits"><span class="k">?</span><span class="t">출처</span></li>
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
        else if (what === 'credits') { this._showingCredits = true; this.render() }
        else if (what === 'restart') { this.close(); g.restart() }
      })
    }
  }

  /** 빌려 쓴 것들 — CC-BY 는 표기가 조건이라 여기서 밝힌다. */
  #renderCredits() {
    const rows = CC_BY.map(c => `<div class="row">
      <div class="who">${c.name} <span class="lic">— ${c.who}</span></div>
      <div class="lic">${c.where} · CC BY ${c.lic ?? '4.0'}</div>
    </div>`).join('')
    this.el.innerHTML = `
      <div class="box">
        <div class="band"></div>
        <h3>출처</h3>
        <div class="credits">${rows}</div>
        <ul><li data-do="back"><span class="k">Esc</span><span class="t">돌아가기</span></li></ul>
        <div class="band"></div>
      </div>`
    this.el.querySelector('li').addEventListener('click', () => {
      this._showingCredits = false
      this.render()
    })
  }
}
