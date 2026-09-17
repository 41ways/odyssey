import { installTheme, meanderURI } from './theme.js'

/**
 * Tab 으로 여는 시험용 패널 (로컬 전용).
 *
 * 왼쪽은 판 고르기 — 숫자나 클릭으로 그 판부터 시작한다.
 * 오른쪽은 연출 목록 — 오프닝·막간·저승·은총·장비·보스 등장을 한 줄씩 바로 틀어 본다.
 * 연출은 처음부터 돌려야만 나오는 것들이라, 이게 없으면 한 번 고칠 때마다
 * 확인에 몇 분이 든다.
 *
 * 주소로도 된다 — ?stage=3 · 보스부터는 &boss=1 · 난이도는 &sail=wrath
 */
const CSS = `
#picker { position:absolute; inset:0; z-index:70; display:none; place-items:center;
  pointer-events:none; font-family:var(--body);
  background:linear-gradient(180deg, rgba(8,5,4,.88), rgba(5,3,3,.96)); }
#picker.on { display:grid; pointer-events:auto; cursor:default; }
#picker .box { width:min(1100px, 94vw); max-height:92vh; display:flex; flex-direction:column; }
#picker .band { height:13px; background-image:${meanderURI('#c8973e', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.45; flex:none; }
#picker .cols { display:grid; grid-template-columns:1fr 1fr; gap:26px;
  padding:18px 4px; overflow:auto; }
#picker h3 { font-family:var(--serif); font-size:14px; letter-spacing:.36em;
  text-indent:.36em; color:var(--bronze); margin:0 0 6px; text-align:center; }
#picker .hint { font-size:11px; color:#6f6455; margin-bottom:12px; letter-spacing:.03em;
  text-align:center; }
#picker .opt { font-size:12px; color:#9c8156; margin-bottom:10px; letter-spacing:.03em;
  display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; }
#picker .opt input { accent-color:#c8973e; cursor:pointer; }
#picker ul { list-style:none; display:grid; gap:5px; margin:0; padding:0; }
#picker li { display:flex; align-items:center; gap:12px; padding:9px 14px; cursor:pointer;
  border:1px solid #33291f; border-radius:2px; background:rgba(26,18,12,.7);
  transition:border-color .12s, background .12s, transform .12s; text-align:left; }
#picker li:hover { border-color:var(--bronze); background:rgba(44,30,18,.85); transform:translateX(4px); }
#picker .n { font-family:var(--serif); font-size:12px; color:var(--bronze); width:16px; flex:none; }
#picker .nm { font-size:14px; color:var(--ivory); }
#picker .ki { font-size:11px; letter-spacing:.08em; color:#7f7364; margin-left:auto; flex:none; }
#picker .ds { font-size:11.5px; color:#c8a16a; flex:none; }
#picker .grp { font-family:var(--serif); font-size:10.5px; letter-spacing:.3em;
  color:#7d6a45; margin:14px 0 4px; }
#picker .grp:first-child { margin-top:0; }
`

const BOSS_NAME = {
  polyphemos: '폴리페모스', antiphates: '안티파테스', kirke: '키르케', siren: '세이렌',
  skylla: '스킬라', charybdis: '카리브디스', antinoos: '안티노오스', telegonos: '텔레고노스',
}

/** 한 판이 어떤 모양인지 한 줄로. */
function shape(s) {
  if (s.relic) return { left: '유물', right: '아가멤논의 그림자' }
  const wave = s.wave ? `웨이브 ${s.wave.goal}` : '바로 보스'
  const boss = s.fork
    ? s.fork.options.map(o => BOSS_NAME[o.boss]).join(' / ')
    : BOSS_NAME[s.boss?.id] ?? '—'
  return { left: wave, right: `→ ${boss}` }
}

export class StagePicker {
  /** @param game 판을 열고 연출을 트는 주체. eventList() 와 jumpTo() 를 쓴다. */
  constructor(root, game) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.game = game

    this.el = document.createElement('div')
    this.el.id = 'picker'
    root.appendChild(this.el)
    this.render()

    addEventListener('keydown', e => {
      if (e.code === 'Tab') { e.preventDefault(); this.toggle(); return }
      if (!this.open) return
      if (e.code === 'Escape') { this.close(); return }
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(e.code)
      if (n >= 0 && n < this._stages.length) { e.preventDefault(); this.pickStage(n) }
    })
  }

  render() {
    const game = this.game
    this._stages = game.stages ?? []
    const events = game.eventList ? game.eventList() : []
    this._events = events

    let lastGroup = null
    const evHtml = events.map((e, i) => {
      const head = e.group !== lastGroup ? `<div class="grp">${e.group}</div>` : ''
      lastGroup = e.group
      return `${head}<li data-ev="${i}">
        <span class="nm">${e.name}</span>
        <span class="ki">${e.note ?? ''}</span></li>`
    }).join('')

    this.el.innerHTML = `<div class="box">
      <div class="band"></div>
      <div class="cols">
        <div>
          <h3>판 고르기</h3>
          <div class="hint">숫자키 1–${this._stages.length} · 클릭 &nbsp;|&nbsp; 주소엔 ?stage=3 · &boss=1 · &sail=wrath</div>
          <label class="opt"><input type="checkbox" id="picker-bare"> 맨몸으로 (전리품·성장 없이)</label>
          <label class="opt" style="margin-top:-6px"><input type="checkbox" id="picker-wave"> 웨이브부터 (기본은 보스전으로 바로)</label>
          <ul>${this._stages.map((s, i) => { const sh = shape(s); return `<li data-st="${i}">
            <span class="n">${i + 1}</span>
            <span class="nm">${s.name}</span>
            <span class="ki">${sh.left}</span>
            <span class="ds">${sh.right}</span></li>` }).join('')}</ul>
        </div>
        <div>
          <h3>연출 보기</h3>
          <div class="hint">한 줄씩 그 자리에서 틀어 본다 · Tab 으로 닫기</div>
          <ul>${evHtml}</ul>
        </div>
      </div>
      <div class="band"></div>
    </div>`

    for (const li of this.el.querySelectorAll('li[data-st]')) {
      li.addEventListener('click', () => this.pickStage(+li.dataset.st))
    }
    for (const li of this.el.querySelectorAll('li[data-ev]')) {
      li.addEventListener('click', () => this.playEvent(+li.dataset.ev))
    }
  }

  pickStage(i) {
    this.close()
    this.game.jumpTo(i, { bare: this.bare, toBoss: this.toBoss })
  }

  playEvent(i) {
    const e = this._events[i]
    if (!e) return
    this.close()
    // 연출 안에서 터진 잘못이 조용히 묻히면 확인하는 의미가 없다
    Promise.resolve().then(e.run).catch(err => {
      console.error('[연출]', e.name, err)
      this.game.hud?.toast?.(`연출 실패 — ${e.name}`, 4)
    })
  }

  get open() { return this.el.classList.contains('on') }
  get bare() { return this.el.querySelector('#picker-bare')?.checked ?? false }
  get toBoss() { return !(this.el.querySelector('#picker-wave')?.checked ?? false) }
  toggle() { this.open ? this.close() : this.show() }
  show() { this.render(); this.el.classList.add('on'); document.body.style.cursor = 'default' }
  close() { this.el.classList.remove('on'); document.body.style.cursor = '' }
}
