import { installTheme, meanderURI } from './theme.js'
import { eulReul } from '../core/hangul.js'

/**
 * 할 일 판 — 지금 무엇을 해야 하는가.
 *
 * ── 왜 필요했나 ──
 * 판에 들어설 때 현판이 한 번 지나가고 그걸로 끝이었다. 3 초 뒤에는
 * "여기서 뭘 해야 하지" 를 화면 어디에서도 못 읽는다. 처치 수는 위쪽
 * 한 줄에 작게 있었고, 보스의 파훼법은 **처음 만날 때 한 번** 말하고
 * 사라졌다 — 눈을 쏘라는 말을 놓치면 그 판이 통째로 막힌다.
 *
 * 그래서 **지금 해야 할 한 가지**를 늘 띄워 둔다. 목록이 아니라 한 줄이다:
 * 여러 개를 세워 두면 읽는 데 시간이 들고, 이 게임에는 어차피 한 번에
 * 하나뿐이다 (잡졸을 치우거나, 보스를 눕히거나, 길을 찾거나).
 *
 * 그 아래 **파훼 한 줄**을 둔다. 보스의 약점은 외워야 하는 것이 아니라
 * 읽고 실행하는 것이다. 외우게 만들면 두 번째 시도에서만 재미있어진다.
 */

const CSS = `
#quest { position:absolute; right:18px; top:${16 + 148 + 38}px; z-index:12; pointer-events:none;
  width:238px; text-align:right; opacity:0; transform:translateX(8px);
  transition:opacity .45s ease, transform .45s cubic-bezier(.2,.8,.3,1); }
#quest.on { opacity:1; transform:none; }
#quest .head { display:flex; justify-content:flex-end; align-items:center; gap:7px;
  font-family:var(--serif); font-size:10px; letter-spacing:.24em; color:#8a7749;
  text-shadow:0 1px 3px rgba(0,0,0,.9); }
#quest .head i { display:block; width:38px; height:7px; background-image:${meanderURI('#c8973e', 0.9)};
  background-repeat:repeat-x; background-size:auto 7px; opacity:.5; }
/* 지금 할 일 — 한 줄. 여기가 제일 커야 한다 */
#quest .task { margin-top:7px; font-family:var(--serif); font-size:15px; line-height:1.45;
  color:#f0dcae; letter-spacing:.02em;
  text-shadow:0 1px 3px rgba(0,0,0,.95), 0 0 18px rgba(0,0,0,.7); }
#quest .task b { color:var(--gold); font-variant-numeric:tabular-nums; }
/* 진행 막대 — 처치 수처럼 셀 수 있는 것만 */
#quest .bar { margin-top:7px; margin-left:auto; width:100%; height:4px; border-radius:2px;
  background:#0d0a07; overflow:hidden; display:none;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(232,200,132,.18); }
#quest.counting .bar { display:block; }
#quest .bar i { display:block; height:100%; width:100%; transform-origin:left center;
  background:linear-gradient(90deg,var(--gold-dim),var(--gold)); transition:transform .25s ease-out; }
/* 파훼 — 읽고 바로 쓰는 줄이라 색을 따로 준다 */
#quest .how b { color:#e8fbff; font-weight:700; }
#quest .how { margin-top:9px; font-size:12px; line-height:1.55; color:#9fd8e8;
  letter-spacing:.01em; text-shadow:0 1px 3px rgba(0,0,0,.95); display:none; }
#quest.hinting .how { display:block; }
#quest .how::before { content:'파훼'; display:inline-block; margin-right:6px; padding:1px 5px;
  border-radius:2px; font-family:var(--serif); font-size:9.5px; letter-spacing:.14em;
  color:#0c1417; background:linear-gradient(180deg,#bfe8f4,#6aa8bc); vertical-align:.08em; }
/* 곁의 사람 — 쓰러진 동료가 있으면 그게 가장 급한 일이 된다 */
#quest .urgent { margin-top:10px; font-size:12.5px; color:#ffb4a4; display:none;
  letter-spacing:.01em; text-shadow:0 1px 3px rgba(0,0,0,.95); }
#quest.urgent-on .urgent { display:block; animation:questPulse 1.1s ease-in-out infinite; }
@keyframes questPulse { 0%,100% { opacity:.55 } 50% { opacity:1 } }
`

export class QuestPanel {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)

    const el = document.createElement('div')
    el.id = 'quest'
    el.innerHTML = `
      <div class="head"><i></i><span>할 일</span></div>
      <div class="task"></div>
      <div class="bar"><i></i></div>
      <div class="how"></div>
      <div class="urgent"></div>`
    root.appendChild(el)
    this.el = el
    this.taskEl = el.querySelector('.task')
    this.barEl = el.querySelector('.bar i')
    this.howEl = el.querySelector('.how')
    this.urgentEl = el.querySelector('.urgent')
    this._task = null
    this._how = null
    this._urgent = null
  }

  show(on) { this.el.classList.toggle('on', !!on) }

  /**
   * 판이 정한 파훼 한 줄. 보스를 만날 때 run.js 가 넣는다.
   * `**...**` 만 굵게 바꾼다 — 한 줄에서 눈이 먼저 잡아야 하는 낱말이 있다.
   */
  setHow(text) {
    this._how = text ?? null
    this.howEl.innerHTML = text
      ? String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
          .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      : ''
    this.el.classList.toggle('hinting', !!text)
  }

  /**
   * 매 프레임. 지금 해야 할 한 가지를 고른다.
   *
   * 고르는 순서가 곧 급한 순서다 — 쓰러진 동료 > 보스 > 잡졸.
   */
  update(g) {
    const run = g.run
    const view = run?.view
    if (!view) { this.show(false); return }
    this.show(true)

    let task = view.name, counting = false, k = 0
    if (run.phase === 'relic') {
      const ph = g.under?.phase
      task = ph === 'out' ? '남쪽으로 빠져나간다'
        : ph === 'called' ? '손이 올라온다 — 받을 것을 고른다'
        : '구덩이를 찾아 손을 부른다'
    } else if (run.phase === 'boss' && run.boss && !run.boss.dead) {
      const b = run.boss
      const hp = Math.max(0, Math.round((b.hp / b.maxHp) * 100))
      task = `${b.cfg.name}${eulReul(b.cfg.name)} 눕힌다 <b>${hp}%</b>`
    } else if (view.goal) {
      const n = Math.min(g.kills ?? 0, view.goal)
      task = `${view.name} — <b>${n}</b> / ${view.goal} 처치`
      counting = true
      k = n / view.goal
    }

    if (task !== this._task) { this.taskEl.innerHTML = task; this._task = task }
    this.el.classList.toggle('counting', counting)
    if (counting) this.barEl.style.transform = `scaleX(${k.toFixed(3)})`

    // 쓰러진 동료 — 지금 제일 급한 일
    const down = (g.allies ?? []).filter(a => !a.dead && a.down > 0)
    const urgent = down.length
      ? `${down.map(a => a.name).join(' · ')} — 곁에 서서 일으킨다 (${Math.ceil(down[0].down)}초)`
      : null
    if (urgent !== this._urgent) {
      this.urgentEl.textContent = urgent ?? ''
      this.el.classList.toggle('urgent-on', !!urgent)
      this._urgent = urgent
    }
  }
}
