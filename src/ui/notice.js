import { meanderURI } from './theme.js'

/**
 * 알림 — 무슨 일이 일어났는지 몸으로 알려 주는 층.
 *
 * ── 왜 필요했나 ──
 * 이 게임에서 뭔가를 얻는 순간이 다 조용했다. 레벨이 오르면 카드 화면이
 * 그냥 떴고, 등급이 열리면 선택지에 조용히 한 장 더 생겼고, 장비를 주우면
 * 카드 하나가 지나갔다. **얻은 것이 얻은 것처럼 느껴지지 않는다.**
 *
 * 로스트아크가 이걸 푸는 방식은 세 겹이다 —
 *   1. 큰 일(레벨업·해금)은 **화면 가운데**에서 한 번 크게 터뜨린다.
 *      멈추게 하지는 않고, 스스로 지나간다.
 *   2. 작은 일(획득)은 **오른쪽에 줄을 세워** 쌓는다. 여러 개가 한꺼번에
 *      들어와도 순서대로 보이고, 놓쳐도 되는 정보다.
 *   3. 등급이 올라갈수록 **연출을 키운다.** 같은 형식에 빛만 더 얹으면
 *      플레이어가 등급을 글자 대신 밝기로 읽는다.
 *
 * 이 저장소의 결에 맞게 재료만 바꿨다. MMO 의 네온 대신 청동·상아·뇌문이고,
 * 광선은 흰빛이 아니라 등급 색이다.
 *
 * ── 지키는 것 ──
 * · **판을 멈추지 않는다.** 선택이 필요한 것만 멈춘다 (levelup·bless 화면).
 *   알림이 판을 멈추면 전투 중에 알림이 뜰 수 없고, 그러면 전투 중에
 *   일어난 일을 알려 줄 방법이 없어진다.
 * · **줄을 세운다.** 한 프레임에 셋이 들어오면 셋이 겹쳐 보이는 게 아니라
 *   차례로 지나가야 한다.
 * · **끝나면 지운다.** DOM 이 쌓이면 긴 판에서 느려진다.
 */

const MEANDER = meanderURI('#c8973e', 0.9)

const CSS = `
#notice { position:absolute; inset:0; pointer-events:none; z-index:58;
  font-family:var(--body); overflow:hidden; }

/* ── 가운데 큰 알림 (레벨업 · 해금) ───────────────────────── */
#notice .big { position:absolute; left:0; right:0; top:26%; text-align:center;
  opacity:0; transform:translateY(14px) scale(.96); }
#notice .big.go { animation:ntBig var(--hold,2000ms) cubic-bezier(.2,.8,.25,1) forwards; }
@keyframes ntBig {
  0%   { opacity:0; transform:translateY(14px) scale(.94); }
  12%  { opacity:1; transform:translateY(0) scale(1); }
  76%  { opacity:1; transform:translateY(0) scale(1); }
  100% { opacity:0; transform:translateY(-10px) scale(1.02); }
}
/* 등급 색 광선. 뒤에서 퍼져 나가며 한 번 훑는다. */
#notice .big .rays { position:absolute; left:50%; top:50%; width:620px; height:620px;
  margin:-310px 0 0 -310px; pointer-events:none; opacity:.55;
  background:conic-gradient(from 0deg,
    transparent 0deg, var(--tint) 3deg, transparent 8deg,
    transparent 40deg, var(--tint) 43deg, transparent 48deg,
    transparent 85deg, var(--tint) 88deg, transparent 94deg,
    transparent 130deg, var(--tint) 133deg, transparent 139deg,
    transparent 175deg, var(--tint) 178deg, transparent 184deg,
    transparent 220deg, var(--tint) 223deg, transparent 229deg,
    transparent 265deg, var(--tint) 268deg, transparent 274deg,
    transparent 310deg, var(--tint) 313deg, transparent 319deg,
    transparent 360deg);
  mask-image:radial-gradient(circle, transparent 14%, #000 34%, transparent 62%);
  -webkit-mask-image:radial-gradient(circle, transparent 14%, #000 34%, transparent 62%); }
#notice .big.go .rays { animation:ntRays var(--hold,2000ms) linear forwards; }
@keyframes ntRays {
  0%   { transform:rotate(0deg) scale(.5); opacity:0; }
  18%  { opacity:.6; }
  100% { transform:rotate(38deg) scale(1.25); opacity:0; }
}
/* 어두운 판 — 배경이 무엇이든 글이 읽히게 */
#notice .big .plate { position:absolute; left:50%; top:50%; width:min(720px,92vw); height:200px;
  transform:translate(-50%,-50%);
  background:radial-gradient(ellipse 50% 50% at 50% 50%,
    rgba(6,5,9,.8) 0%, rgba(6,5,9,.55) 46%, rgba(6,5,9,0) 76%); }
#notice .big .kicker { position:relative; font-family:var(--serif); font-size:13px;
  letter-spacing:.05em; color:var(--tint); text-transform:none;
  text-shadow:0 1px 3px rgba(0,0,0,.95), 0 0 18px var(--tint); }
#notice .big h2 { position:relative; margin:6px 0 0; font-family:var(--serif);
  font-size:44px; font-weight:700; letter-spacing:.04em; color:#fff6e2;
  text-shadow:0 2px 0 #3a2c12, 0 0 4px rgba(0,0,0,.9),
              0 3px 14px rgba(0,0,0,.95), 0 0 40px var(--tint); }
#notice .big .sub { position:relative; margin-top:10px; font-size:16px; letter-spacing:.015em;
  color:#e6d5b4; text-shadow:0 1px 3px rgba(0,0,0,.95); }
/* 좌우로 뻗는 청동 선 — 뇌문 한 줄이 '현판' 을 만든다 */
#notice .big .rule { position:relative; height:12px; width:min(460px,74vw); margin:13px auto 0;
  background-image:${MEANDER}; background-repeat:repeat-x; background-position:center;
  opacity:.42; }
/* 한 번 훑고 지나가는 빛 */
#notice .big .sweep { position:absolute; left:50%; top:50%; width:min(760px,96vw); height:130px;
  margin-top:-65px; transform:translateX(-50%); overflow:hidden; }
#notice .big .sweep i { position:absolute; top:0; bottom:0; width:32%;
  background:linear-gradient(90deg, transparent, rgba(255,246,226,.5), transparent);
  filter:blur(5px); }
#notice .big.go .sweep i { animation:ntSweep 900ms cubic-bezier(.3,.7,.3,1) 120ms forwards; }
@keyframes ntSweep { from { left:-40%; } to { left:110%; } }

/* ── 오른쪽 획득 줄 ───────────────────────────────────────── */
#notice .feed { position:absolute; right:20px; top:96px; width:262px;
  display:flex; flex-direction:column; gap:7px; align-items:flex-end; }
#notice .card { width:100%; box-sizing:border-box; padding:8px 11px 9px 13px;
  border-radius:2px; position:relative; overflow:hidden;
  background:linear-gradient(180deg, rgba(22,17,12,.94), rgba(14,11,8,.9));
  box-shadow:inset 0 0 0 1px rgba(232,200,132,.16), 0 5px 18px rgba(0,0,0,.65);
  opacity:0; transform:translateX(26px);
  animation:ntCardIn 260ms cubic-bezier(.2,.9,.3,1) forwards; }
#notice .card.out { animation:ntCardOut 320ms ease forwards; }
@keyframes ntCardIn  { to { opacity:1; transform:none; } }
@keyframes ntCardOut { to { opacity:0; transform:translateX(26px); height:0; padding:0 11px; margin-top:-7px; } }
/* 등급을 왼쪽 띠로 — 글자보다 색이 먼저 읽힌다 */
#notice .card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
  background:var(--tint); box-shadow:0 0 12px var(--tint); }
#notice .card .ck { font-family:var(--serif); font-size:10.5px; letter-spacing:.06em;
  color:var(--tint); }
#notice .card .cn { font-family:var(--serif); font-size:14.5px; font-weight:700;
  letter-spacing:.02em; color:#f4e7cd; margin-top:2px; }
#notice .card .cd { font-size:12px; color:#b9a888; margin-top:3px; line-height:1.45; }
/* 레전더리만 한 번 반짝인다. 위로 갈수록 연출을 키우는 게 규칙이다. */
#notice .card.hi::after { content:''; position:absolute; inset:0;
  background:linear-gradient(90deg, transparent, rgba(255,214,140,.3), transparent);
  animation:ntCardShine 1100ms ease 160ms; }
@keyframes ntCardShine { from { transform:translateX(-100%); } to { transform:translateX(100%); } }
`

/** 등급 색. stats.js 의 TIERS 와 맞춘다. */
const TINT = ['#9a8f7e', '#5aa8ff', '#c77dff', '#ffb02e']

export class Notice {
  constructor(root) {
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)

    this.el = document.createElement('div')
    this.el.id = 'notice'
    this.el.innerHTML = `<div class="feed"></div>`
    root.appendChild(this.el)
    this.feed = this.el.querySelector('.feed')

    this._q = []          // 가운데 알림 대기열
    this._busy = false
  }

  /* ── 가운데 큰 알림 ───────────────────────────────────── */

  /**
   * 줄을 세워 하나씩 터뜨린다.
   * 한 프레임에 둘이 들어오는 일이 실제로 있다 — 정예를 잡아 레벨이
   * 오르면서 그 레벨에서 등급이 열리는 경우다. 겹쳐 뜨면 둘 다 안 읽힌다.
   */
  #push(spec) {
    this._q.push(spec)
    if (!this._busy) this.#drain()
  }

  async #drain() {
    this._busy = true
    while (this._q.length) {
      const s = this._q.shift()
      await this.#show(s)
    }
    this._busy = false
  }

  #show({ kicker, title, sub, tint, hold = 2000 }) {
    return new Promise(done => {
      const box = document.createElement('div')
      box.className = 'big'
      box.style.setProperty('--tint', tint)
      box.style.setProperty('--hold', `${hold}ms`)
      box.innerHTML = `
        <div class="plate"></div>
        <div class="rays"></div>
        <div class="sweep"><i></i></div>
        <div class="kicker">${kicker}</div>
        <h2>${title}</h2>
        ${sub ? `<div class="sub">${sub}</div>` : ''}
        <div class="rule"></div>`
      this.el.appendChild(box)
      /**
       * 켜기 전에 배치를 한 번 강제한다.
       *
       * 붙이자마자 클래스를 주면 브라우저가 처음 상태를 안 거치고 바로
       * 끝 상태로 가서 애니메이션이 안 돈다. 그래서 흔히 rAF 한 프레임을
       * 기다리는데, **이 저장소에서는 그러면 안 된다** — 탭이 가려져 있으면
       * rAF 가 멈추므로 알림이 영원히 opacity 0 으로 남는다.
       * (실제로 그렇게 나왔다: 큐는 도는데 화면엔 아무것도 안 보였다.)
       * offsetWidth 를 읽으면 그 자리에서 배치가 확정되니 rAF 가 필요 없다.
       */
      void box.offsetWidth
      box.classList.add('go')
      setTimeout(() => { box.remove(); done() }, hold + 60)
    })
  }

  /** 레벨이 올랐다. */
  level(n, sub = '') {
    this.#push({ kicker: 'LEVEL UP', title: `레벨 ${n}`, sub, tint: '#ffd27a', hold: 1900 })
  }

  /**
   * 등급이 열렸다.
   *
   * 이건 이 게임에 이미 있던 사건인데 아무도 몰랐다 — 같은 계열을 두 번
   * 고르면 레어가 열리고, 네 번이면 유니크가 열린다. 그게 선택지에 조용히
   * 한 장 더 생기는 것으로만 표현됐다. 열린 걸 알려 주지 않으면
   * 계열을 모으는 것이 선택이 아니라 우연이 된다.
   */
  unlock(tierIndex, label, what) {
    this.#push({
      kicker: '해금',
      title: `${label} 등급`,
      sub: what ? `${what} — 이제 고를 수 있다` : '새 선택지가 열렸다',
      tint: TINT[tierIndex] ?? TINT[0],
      hold: 2300,
    })
  }

  /** 판을 넘었다 · 보스를 토벌했다 같은 큰 매듭. */
  milestone(kicker, title, sub = '', tint = '#e8c884') {
    this.#push({ kicker, title, sub, tint, hold: 2200 })
  }

  /* ── 오른쪽 획득 줄 ───────────────────────────────────── */

  /**
   * 무언가를 얻었다. 판을 멈추지 않고 오른쪽에 쌓인다.
   * @param o.tier 0..3 — 색과 반짝임이 여기서 나온다
   */
  acquire({ kind = '획득', name, desc = '', tier = 0, hold = 3400 }) {
    const card = document.createElement('div')
    card.className = 'card' + (tier >= 3 ? ' hi' : '')
    card.style.setProperty('--tint', TINT[tier] ?? TINT[0])
    card.innerHTML = `
      <div class="ck">${kind}</div>
      <div class="cn">${name}</div>
      ${desc ? `<div class="cd">${desc}</div>` : ''}`
    this.feed.appendChild(card)
    // 너무 쌓이면 오래된 것부터 내린다. 화면을 덮으면 알림이 방해가 된다.
    while (this.feed.children.length > 5) this.feed.firstChild.remove()
    setTimeout(() => {
      card.classList.add('out')
      setTimeout(() => card.remove(), 340)
    }, hold)
  }

  /** 판을 비울 때 남은 것을 치운다. */
  clear() {
    this._q.length = 0
    this.feed.innerHTML = ''
    for (const b of this.el.querySelectorAll('.big')) b.remove()
  }
}
