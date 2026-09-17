import { installTheme, meanderURI } from './theme.js'

/**
 * 스테이지 고르기 (로컬 시험용).
 * Tab 으로 열고 숫자나 클릭으로 그 판부터 시작한다. 주소에 ?stage=3 을 붙여도 된다.
 */
const CSS = `
#picker { position:absolute; inset:0; z-index:70; display:none; place-items:center;
  pointer-events:none; font-family:var(--body);
  background:linear-gradient(180deg, rgba(8,5,4,.86), rgba(5,3,3,.95)); }
#picker.on { display:grid; pointer-events:auto; cursor:default; }
#picker .box { width:min(660px, 88vw); text-align:center; }
#picker .band { height:13px; background-image:${meanderURI('#c8973e', 0.9)};
  background-repeat:repeat-x; background-position:center; opacity:.45; }
#picker h3 { font-family:var(--serif); font-size:15px; letter-spacing:.4em;
  text-indent:.4em; color:var(--bronze); margin:20px 0 4px; }
#picker .hint { font-size:11.5px; color:#6f6455; margin-bottom:20px; letter-spacing:.04em; }
#picker ol { list-style:none; display:grid; gap:6px; margin-bottom:22px; }
#picker li { display:flex; align-items:center; gap:14px; padding:10px 16px; cursor:pointer;
  border:1px solid #33291f; border-radius:2px; background:rgba(26,18,12,.7);
  transition:border-color .12s, background .12s, transform .12s; text-align:left; }
#picker li:hover { border-color:var(--bronze); background:rgba(44,30,18,.85); transform:translateX(4px); }
#picker .n { font-family:var(--serif); font-size:13px; color:var(--bronze); width:18px; }
#picker .nm { font-size:15px; color:var(--ivory); min-width:150px; }
#picker .ki { font-size:11px; letter-spacing:.14em; color:#7f7364; }
#picker .ds { margin-left:auto; font-size:11.5px; color:#8a7c68; }
`

const KIND = { waves: '웨이브', boss: '보스', relic: '유물', fork: '갈림길' }

export class StagePicker {
  constructor(root, stages, onPick) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)

    this.el = document.createElement('div')
    this.el.id = 'picker'
    this.el.innerHTML = `<div class="box">
      <div class="band"></div>
      <h3>스테이지 고르기</h3>
      <div class="hint">숫자키 1–9 · 클릭 · Tab 으로 닫기 &nbsp;|&nbsp; 주소에 ?stage=3 을 붙여도 된다</div>
      <ol>${stages.map((s, i) => `<li data-i="${i}">
        <span class="n">${i + 1}</span>
        <span class="nm">${s.name}</span>
        <span class="ki">${KIND[s.kind] ?? s.kind}</span>
        <span class="ds">${s.title ?? ''}</span></li>`).join('')}</ol>
      <div class="band"></div>
    </div>`
    root.appendChild(this.el)

    for (const li of this.el.querySelectorAll('li')) {
      li.addEventListener('click', () => { this.close(); onPick(+li.dataset.i) })
    }
    addEventListener('keydown', e => {
      if (e.code === 'Tab') { e.preventDefault(); this.toggle(); return }
      if (!this.open) return
      const n = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'].indexOf(e.code)
      if (n >= 0 && n < stages.length) { e.preventDefault(); this.close(); onPick(n) }
      if (e.code === 'Escape') this.close()
    })
  }

  get open() { return this.el.classList.contains('on') }
  toggle() { this.open ? this.close() : this.show() }
  show() { this.el.classList.add('on'); document.body.style.cursor = 'default' }
  close() { this.el.classList.remove('on'); document.body.style.cursor = '' }
}
