import { installTheme, meanderURI } from './theme.js'

/**
 * 장비를 입는 순간의 연출.
 *
 * 전리품을 줍고 바로 성장 선택지가 뜨면, 무엇이 몸에 붙었는지 모르고 지나간다.
 * 카드가 뜨기 전에 한 박자를 줘서 "지금 이게 생겼다"를 보여 준다.
 */
const CSS = `
#equip { position:absolute; inset:0; z-index:45; display:none; place-items:center;
  pointer-events:none; font-family:var(--body); }
#equip.on { display:grid; }
#equip .flash { position:absolute; inset:0;
  background:radial-gradient(ellipse 52% 38% at 50% 44%, rgba(232,201,138,.20), transparent 66%);
  opacity:0; }
#equip .plate { position:absolute; left:50%; top:64%; transform:translate(-50%,0);
  text-align:center; opacity:0; }
#equip .band { height:13px; width:340px; margin:0 auto;
  background-image:${meanderURI('#e8c98a', 0.95)}; background-repeat:repeat-x;
  background-position:center; opacity:.65; }
#equip .got { font-family:var(--serif); font-size:11px; letter-spacing:.42em;
  text-indent:.42em; color:var(--bronze); margin:16px 0 10px; }
#equip h2 { font-family:var(--serif); font-size:36px; font-weight:700;
  letter-spacing:.2em; text-indent:.2em; color:#fff1d6;
  text-shadow:0 0 44px rgba(232,201,138,.6), 0 4px 22px #000; }
#equip p { margin-top:12px; font-size:13.5px; color:#c2ab85; letter-spacing:.03em; }
#equip p::before { content:'“'; } #equip p::after { content:'”'; }
`

export class EquipCard {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'equip'
    this.el.innerHTML = `<div class="flash"></div>
      <div class="plate">
        <div class="band"></div>
        <div class="got">걸쳤다</div>
        <h2></h2><p></p>
        <div class="band" style="margin-top:20px"></div>
      </div>`
    root.appendChild(this.el)
    this.flash = this.el.querySelector('.flash')
    this.plate = this.el.querySelector('.plate')
  }

  open(name, line) {
    this.el.querySelector('h2').textContent = name
    this.el.querySelector('p').textContent = line ?? ''
    this.el.classList.add('on')
  }

  /** k 는 0..1 진행도. 연출을 직접 몰아 준다 — CSS 애니메이션은 캡처에서 굳는다. */
  drive(k) {
    const inK = Math.min(k / 0.18, 1)
    const outK = 1 - Math.max(0, (k - 0.78) / 0.22)
    this.flash.style.opacity = String(Math.pow(1 - Math.min(k / 0.35, 1), 2))
    this.plate.style.opacity = String(Math.min(inK, outK))
    this.plate.style.transform = `translate(-50%, ${(1 - inK) * 20}px)`
  }

  close() { this.el.classList.remove('on') }
}
