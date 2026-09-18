import { installTheme, PALETTE } from './theme.js'
import { godRow } from './fate.js'

/**
 * 여정 표 — 왼쪽 위의 작은 청동판.
 *
 * 배가 몇 척 남았는지, 동료가 몇인지, 두 신이 나를 어떻게 보는지.
 * 판 안에서는 거의 안 움직이는 숫자라 작게 둔다. 대신 **줄어드는 순간**은
 * 크게 알린다 (main.js 의 crewLoss) — 여기는 그 뒤에 남는 기록이다.
 *
 * 줄어들 때 숫자가 붉게 한 번 떨린다. 판 안에서 누가 죽었는지 모르고
 * 지나가면 이 판이 앗아간 것이 없는 것처럼 느껴진다.
 */
const CSS = `
#voyage { position:absolute; left:16px; top:14px; z-index:12; pointer-events:none;
  font-family:var(--body); padding:9px 13px 10px; border-radius:3px;
  background:linear-gradient(180deg, rgba(30,26,20,.82), rgba(14,12,9,.86));
  border:1px solid ${PALETTE.lineDim}; box-shadow:0 8px 24px rgba(0,0,0,.5);
  opacity:0; transition:opacity .5s; }
#voyage.on { opacity:1; }
/* 보스 체력바가 위쪽 띠(52~110px)를 차지하면 그 아래로 비켜 선다 */
#voyage { transition:opacity .5s, top .4s ease; }
#voyage.low { top:124px; }
#voyage .fleet { display:flex; align-items:center; gap:8px; font-size:13px; color:${PALETTE.text}; }
#voyage .fleet svg { width:18px; height:18px; }
#voyage .fleet b { font-family:var(--serif); font-size:16px; color:${PALETTE.ivory}; font-weight:700;
  display:inline-block; transition:color .3s; }
#voyage .fleet b.hit { color:#e0584a; animation:vShake .5s; }
#voyage .sep { color:${PALETTE.lineDim}; }
#voyage .gods { margin-top:6px; display:flex; flex-direction:column; gap:3px; }
#voyage .god { display:flex; align-items:center; gap:7px; font-size:11.5px; color:${PALETTE.textDim}; }
#voyage .god svg { width:15px; height:15px; }
#voyage .pips { display:flex; gap:3px; margin-left:auto; }
#voyage .pips i { width:6px; height:6px; border-radius:50%; border:1px solid ${PALETTE.lineDim}; }
#voyage .god.poseidon .pips i.on { background:#4f9fc4; border-color:transparent; box-shadow:0 0 6px #4f9fc4; }
#voyage .god.athena .pips i.on { background:${PALETTE.gold}; border-color:transparent; box-shadow:0 0 6px ${PALETTE.gold}; }
@keyframes vShake { 0%,100% { transform:none } 20% { transform:translateX(-3px) } 40% { transform:translateX(3px) }
  60% { transform:translateX(-2px) } 80% { transform:translateX(1px) } }
`

const SHIP = `<svg viewBox="0 0 24 24" fill="none" stroke="${PALETTE.gold}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 15h18l-3 5H6z"/><path d="M12 3v12"/><path d="M12 4l6 8h-6"/><path d="M12 6l-5 6h5"/></svg>`
const MAN = `<svg viewBox="0 0 24 24" fill="none" stroke="${PALETTE.gold}" stroke-width="1.6" stroke-linecap="round">
  <circle cx="12" cy="6" r="3"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/></svg>`

export class VoyageHud {
  constructor(root, voyage) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'voyage'
    root.appendChild(this.el)
    this.v = voyage
    this.last = { ships: voyage.ships, crew: voyage.crew }
    voyage.onChange = () => this.render()
    this.render()
    // 보스바가 떴는지 본다. 보스바는 hud.js 가 켜고 끄므로 여기서 따라간다
    setInterval(() => {
      this.el.classList.toggle('low', !!document.querySelector('#hud .boss.on'))
    }, 400)
  }

  show(on = true) { this.el.classList.toggle('on', on) }

  render() {
    const v = this.v
    const shipsHit = v.ships < this.last.ships, crewHit = v.crew < this.last.crew
    const alone = v.crew === 0
    this.el.innerHTML = `
      <div class="fleet">
        ${alone
          ? `${MAN}<b class="${crewHit ? 'hit' : ''}">홀로</b>`
          : `${SHIP}<b class="${shipsHit ? 'hit' : ''}">${v.ships}</b><span>척</span>
             <span class="sep">·</span>${MAN}<b class="${crewHit ? 'hit' : ''}">${v.crew}</b><span>명</span>`}
      </div>
      <div class="gods">${godRow('poseidon', v.gods.poseidon)}${godRow('athena', v.gods.athena)}</div>`
    this.last = { ships: v.ships, crew: v.crew }
  }
}
