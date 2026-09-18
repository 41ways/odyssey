import { installTheme, meanderURI, PALETTE } from './theme.js'
import { GODS } from '../stage/voyage.js'

/**
 * 운명의 갈림길 — 판과 판 사이에서 이야기 속 선택을 한다.
 *
 * 성장 카드와 모양이 같으면 "또 카드" 가 된다. 이건 수치를 고르는 게 아니라
 * **장면 안에서 무엇을 할지**를 고르는 것이다. 그래서 —
 *   · 그림이 화면을 채운다 (카드가 아니라 장면)
 *   · 선택지는 대사처럼 쓴다 ("나는 이타카의 오디세우스다!")
 *   · 무엇을 얻는지는 **고른 뒤에** 말한다. 이야기 속 오디세우스도 몰랐다
 *   · 고르면 나머지가 가라앉고, 그 결과가 같은 자리에 떠오른다
 *
 * 신의 눈금이 바뀌면 그 자리에서 보여 준다 — 선택이 무엇을 움직였는지가
 * 눈에 남아야 다음 선택이 무거워진다.
 */

const CSS = `
#fate { position:absolute; inset:0; z-index:66; display:none; pointer-events:none;
  font-family:var(--body); overflow:hidden; background:#07060a; }
#fate.on { display:block; pointer-events:auto; cursor:default; }
#fate .art { position:absolute; inset:-4%; background-size:cover; background-position:center;
  transform:scale(1.02); opacity:0; transition:opacity 1.4s ease, transform 14s linear; }
#fate.up .art { opacity:1; transform:scale(1.1); }
#fate .veil { position:absolute; inset:0;
  background:
    linear-gradient(180deg, rgba(7,6,10,.82) 0%, rgba(7,6,10,.25) 30%, rgba(7,6,10,.2) 48%, rgba(7,6,10,.9) 76%, #07060a 100%),
    radial-gradient(ellipse 120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,.6) 100%); }

#fate .head { position:absolute; left:50%; top:5.5vh; transform:translateX(-50%);
  width:min(760px, 92vw); text-align:center; opacity:0; transition:opacity .9s ease .5s; }
#fate.up .head { opacity:1; }
#fate .where { font-size:13px; letter-spacing:.06em; color:${PALETTE.goldDim}; }
#fate h2 { font-family:var(--serif); font-weight:700; font-size:clamp(32px, 3.6vw, 50px);
  letter-spacing:.04em; color:${PALETTE.ivory}; margin:10px 0 14px;
  text-shadow:0 0 40px rgba(232,200,132,.28), 0 4px 22px #000; }
#fate .band { height:14px; width:min(420px, 70vw); margin:0 auto 16px;
  background-image:${meanderURI(PALETTE.gold, 0.9)}; background-repeat:repeat-x; opacity:.5; }
#fate .said { font-size:16px; line-height:1.95; color:${PALETTE.text};
  text-shadow:0 2px 12px #000, 0 0 2px #000; }
#fate .said em, #fate .result em { color:${PALETTE.ivory}; font-style:normal; }

#fate .opts { position:absolute; left:50%; bottom:10vh; transform:translateX(-50%);
  display:flex; gap:22px; justify-content:center; width:min(900px, 94vw); opacity:0;
  transition:opacity .7s ease 1.1s; }
#fate.up .opts { opacity:1; }
#fate button { flex:1 1 0; max-width:400px; text-align:center; cursor:pointer; position:relative;
  padding:22px 22px 18px; font:inherit; color:${PALETTE.ivory}; border-radius:3px;
  border:1px solid ${PALETTE.line};
  background:linear-gradient(180deg, rgba(34,29,22,.9), rgba(16,13,10,.94));
  box-shadow:inset 0 0 0 1px rgba(232,200,132,.1), 0 20px 50px rgba(0,0,0,.7);
  transition:transform .18s, border-color .18s, box-shadow .18s, opacity .6s, filter .6s; }
#fate button::before { content:''; position:absolute; left:0; right:0; top:0; height:12px;
  background-image:${meanderURI(PALETTE.gold, 0.9)}; background-repeat:repeat-x; opacity:.35; }
#fate button:hover { transform:translateY(-6px); border-color:${PALETTE.gold};
  box-shadow:inset 0 0 0 1px rgba(232,200,132,.4), 0 26px 60px rgba(0,0,0,.8), 0 0 40px rgba(232,200,132,.16); }
#fate button:hover::before { opacity:.9; }
#fate .line { font-family:var(--serif); font-size:20px; font-weight:700; line-height:1.5; margin-top:6px; }
#fate .hint { font-size:12.5px; color:${PALETTE.textDim}; margin-top:8px; }
#fate .key { position:absolute; top:16px; right:12px; font-size:10px; color:${PALETTE.textDim};
  border:1px solid ${PALETTE.lineDim}; border-radius:2px; padding:1px 5px; }
#fate.chosen button { pointer-events:none; }
#fate.chosen button:not(.pick) { opacity:0; filter:blur(3px); }
#fate.chosen button.pick { transform:translateY(-6px); border-color:${PALETTE.gold}; }

#fate .result { position:absolute; left:50%; bottom:calc(10vh + 150px); transform:translateX(-50%);
  width:min(720px, 92vw); text-align:center; font-size:16.5px; line-height:1.95; color:${PALETTE.text};
  opacity:0; transition:opacity .8s ease; text-shadow:0 2px 12px #000; }
#fate.chosen .result { opacity:1; }
#fate .gods { display:flex; gap:26px; justify-content:center; margin-top:14px; }
#fate .god { display:flex; align-items:center; gap:8px; font-size:12.5px; color:${PALETTE.textDim}; }
#fate .god svg { width:20px; height:20px; }
#fate .pips { display:flex; gap:4px; }
#fate .pips i { width:7px; height:7px; border-radius:50%; border:1px solid ${PALETTE.lineDim}; }
#fate .pips i.on { border-color:transparent; }
#fate .god.poseidon .pips i.on { background:#4f9fc4; box-shadow:0 0 8px #4f9fc4; }
#fate .god.athena .pips i.on { background:${PALETTE.gold}; box-shadow:0 0 8px ${PALETTE.gold}; }
#fate .god.moved { color:${PALETTE.ivory}; }
#fate .god .d { font-weight:700; }
#fate .god.poseidon .d { color:#7cc3e4; }
#fate .god.athena .d { color:${PALETTE.gold}; }
#fate .cont { margin-top:18px; font-size:12px; color:${PALETTE.textDim}; letter-spacing:.04em;
  animation:fateBlink 2.2s ease-in-out infinite; }
@keyframes fateBlink { 0%,100% { opacity:.45 } 50% { opacity:1 } }
`

/** 삼지창과 올빼미 — 두 신의 표지 */
export const GLYPH = {
  poseidon: `<svg viewBox="0 0 24 24" fill="none" stroke="#7cc3e4" stroke-width="1.8" stroke-linecap="round">
    <path d="M12 22V6"/><path d="M6 3v5c0 2 2.5 3 6 3s6-1 6-3V3"/><path d="M12 2v4"/><path d="M9 19h6"/></svg>`,
  athena: `<svg viewBox="0 0 24 24" fill="none" stroke="#e8c884" stroke-width="1.7" stroke-linecap="round">
    <path d="M6 5l2.5 2.5M18 5l-2.5 2.5"/><path d="M5 12a7 7 0 0 0 14 0c0-3-2-6-7-6s-7 3-7 6z"/>
    <circle cx="9.3" cy="11.5" r="1.9"/><circle cx="14.7" cy="11.5" r="1.9"/><path d="M12 14l-1 1.6h2z"/></svg>`,
}

export const godRow = (id, value, delta = 0) => {
  const g = GODS[id]
  return `<div class="god ${id}${delta ? ' moved' : ''}">${GLYPH[id]}<span>${g.name}</span>
    <span class="pips">${Array.from({ length: g.max }, (_, i) => `<i class="${i < value ? 'on' : ''}"></i>`).join('')}</span>
    ${delta ? `<span class="d">${delta > 0 ? '+' : ''}${delta}</span>` : ''}</div>`
}

export class FateScreen {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'fate'
    root.appendChild(this.el)
    this.onKey = this.onKey.bind(this)
  }

  get open() { return this.el.classList.contains('on') }

  /** 그림을 미리 받아 둔다. 없는 그림이면 대역으로 */
  static art(f) {
    return new Promise(res => {
      const im = new Image()
      im.onload = () => res(f.art)
      im.onerror = () => res(f.fallback)
      im.src = f.art
    })
  }

  /**
   * @param fate     voyage.js 의 FATES 하나
   * @param resolveResult (choice) → { gods:{id:[before, after]} } — 고른 뒤 게임이 결과를 적용하고 알려 준다
   * @returns 고른 선택지
   */
  async show(fate, applyChoice) {
    const art = await FateScreen.art(fate)
    return new Promise(resolve => {
      this._fate = fate
      this._apply = applyChoice
      this._resolve = resolve
      this._stage = 'choose'
      this.el.innerHTML = `
        <div class="art" style="background-image:url('${art}')"></div>
        <div class="veil"></div>
        <div class="head">
          <div class="where">${fate.where}</div>
          <h2>${fate.title}</h2>
          <div class="band"></div>
          <div class="said">${fate.said}</div>
        </div>
        <div class="result"></div>
        <div class="opts">${fate.choices.map((c, i) => `
          <button data-i="${i}"><span class="key">${i + 1}</span>
            <div class="line">${c.label}</div><div class="hint">${c.hint ?? ''}</div></button>`).join('')}
        </div>`
      this.el.classList.remove('chosen', 'up')
      this.el.classList.add('on')
      setTimeout(() => this.el.classList.add('up'), 30)
      document.body.style.cursor = 'default'
      for (const b of this.el.querySelectorAll('button')) b.addEventListener('click', () => this.pick(+b.dataset.i))
      this.el.addEventListener('click', this._onClick = e => {
        if (this._stage === 'result' && !e.target.closest('button')) this.close()
      })
      addEventListener('keydown', this.onKey)
    })
  }

  onKey(e) {
    if (this._stage === 'choose') {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
      if (i >= 0 && i < this._fate.choices.length) { e.preventDefault(); this.pick(i) }
    } else if (this._stage === 'result' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault(); this.close()
    }
  }

  pick(i) {
    if (this._stage !== 'choose') return
    this._stage = 'wait'
    const c = this._fate.choices[i]
    this._choice = c
    this.el.querySelectorAll('button')[i].classList.add('pick')
    const moved = this._apply?.(c) ?? {}
    const res = this.el.querySelector('.result')
    const rows = Object.entries(moved.gods ?? {})
      .map(([id, [a, b]]) => godRow(id, b, b - a)).join('')
    res.innerHTML = `${c.result}${rows ? `<div class="gods">${rows}</div>` : ''}<div class="cont">계속 — 클릭 또는 Enter</div>`
    this.el.classList.add('chosen')
    // 결과를 읽을 틈을 준 뒤에 넘길 수 있게 한다. 바로 넘기면 못 읽고 지나간다
    setTimeout(() => { this._stage = 'result' }, 900)
  }

  close() {
    if (this._stage !== 'result') return
    this._stage = null
    removeEventListener('keydown', this.onKey)
    this.el.removeEventListener('click', this._onClick)
    this.el.classList.remove('up')
    setTimeout(() => { this.el.classList.remove('on', 'chosen') }, 500)
    document.body.style.cursor = ''
    const r = this._resolve
    this._resolve = null
    r?.(this._choice)
  }
}
