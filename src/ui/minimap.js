import { installTheme, meanderURI } from './theme.js'

/**
 * 미니맵 — 청동 원반에 새긴 판.
 *
 * ── 왜 필요해졌나 ──
 * 판을 반지름 16 에서 36 으로 넓히고 나니 **화면이 판의 일부만 담는다.**
 * 전에는 카메라 하나가 지도 노릇을 했다 (판 전체가 화면 안이었다). 이제는
 * 적이 어디서 오는지, 보스가 어느 쪽인지, 쓰러진 동료가 어느 방향인지를
 * 화면만 보고는 알 수 없다. 넓힌 판은 지도를 같이 주지 않으면 그냥
 * '멀리 걸어야 하는 판' 이 된다.
 *
 * ── 무엇을 그리나 ──
 * 판의 경계, 나, 동료(쓰러진 동료는 깜빡인다), 적, 보스, 떨어진 전리품,
 * 그리고 동굴의 양 — 양은 피해 갈 것이라 지도에 있어야 길을 고를 수 있다.
 * 소품과 바위는 안 그린다 — 지도는 **결정에 쓰는 그림**이라 판단에 안
 * 들어오는 것을 그리면 그만큼 읽는 데 시간이 든다.
 *
 * 판 전체를 한 원반에 담는다 (플레이어 주변만 보여 주는 방식이 아니라).
 * 보스가 판 반대편에 있다는 걸 알아야 '지금 붙을까 말까' 가 판단이 되고,
 * 그건 화면에 안 나오는 것을 지도가 대신 말해 주는 유일한 자리다.
 *
 * 북쪽 고정이다. 카메라 yaw 가 0 으로 묶여 있어서 (render/world.js) 화면의
 * 위쪽이 늘 -z 다 — 지도를 돌리면 오히려 화면과 어긋난다.
 */

const SIZE = 148          // 원반 지름(px)
const DOT = { me: 4.2, ally: 3.2, enemy: 3.0, boss: 6.0, loot: 2.4 }

const CSS = `
#minimap { position:absolute; right:18px; top:16px; z-index:12; pointer-events:none;
  width:${SIZE}px; height:${SIZE}px; }
/* 청동 원반 — 체력판과 같은 결로. 테두리 한 줄만으로는 브라우저 위젯처럼 보인다 */
#minimap .disc { position:absolute; inset:0; border-radius:50%;
  background:radial-gradient(circle at 42% 34%, #221d15, #0d0b08 72%);
  box-shadow:
    inset 0 1px 0 rgba(255,225,165,.22), inset 0 0 0 1px rgba(232,200,132,.26),
    inset 0 0 26px rgba(0,0,0,.9), 0 8px 26px rgba(0,0,0,.7); }
#minimap canvas { position:absolute; inset:5px; width:calc(100% - 10px); height:calc(100% - 10px);
  border-radius:50%; }
/* 위쪽에 뇌문 한 조각 — 어디가 북쪽인지 표시도 겸한다 */
#minimap .north { position:absolute; left:50%; top:-3px; transform:translateX(-50%);
  width:44px; height:7px; background-image:${meanderURI('#c8973e', 0.9)};
  background-repeat:repeat-x; background-size:auto 7px; opacity:.55; }
#minimap .label { position:absolute; left:0; right:0; bottom:-16px; text-align:center;
  font-family:var(--serif); font-size:10px; letter-spacing:.14em; color:#7d7264;
  text-shadow:0 1px 3px rgba(0,0,0,.9); white-space:nowrap; }
#minimap.off { display:none; }
`

export class Minimap {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)

    const el = document.createElement('div')
    el.id = 'minimap'
    el.innerHTML = `<div class="disc"></div><canvas></canvas><i class="north"></i><span class="label"></span>`
    root.appendChild(el)
    this.el = el
    this.canvas = el.querySelector('canvas')
    this.labelEl = el.querySelector('.label')
    // 레티나에서 점이 뭉개지지 않게 두 배로 그린다
    const dpr = Math.min(2, devicePixelRatio || 1)
    this.canvas.width = this.canvas.height = Math.round((SIZE - 10) * dpr)
    this.ctx = this.canvas.getContext('2d')
    this.dpr = dpr
    this._label = null
  }

  show(on) { this.el.classList.toggle('off', !on) }

  /**
   * 한 장 그린다. 매 프레임 불린다 — 148px 원반이라 값이 싸다.
   *
   * @param g  Game
   */
  draw(g) {
    const ctx = this.ctx
    const w = this.canvas.width
    const R = g.arenaRadius || 16
    const arena = g.render3d?.arena
    // 판 가장자리가 원반에 꽉 차지 않게 한 뼘 남긴다 — 밖으로 나간 것(배·절벽)도 보이게
    const k = (w / 2) / (R * 1.12)
    const px = (x) => w / 2 + x * k
    const pz = (z) => w / 2 + z * k

    ctx.clearRect(0, 0, w, w)

    // ── 판의 바닥과 경계 ──
    ctx.save()
    ctx.beginPath()
    if (arena) {
      // 판 모양 그대로 (네모난 홀은 네모로). 보이는 방과 지도의 방이 달라지면 지도가 거짓말이 된다
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2
        const r = arena.radiusAt(a)
        const x = px(Math.sin(a) * r), z = pz(Math.cos(a) * r)
        i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)
      }
    } else ctx.arc(w / 2, w / 2, R * k, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = 'rgba(122,102,62,.30)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(232,200,132,.62)'
    ctx.lineWidth = 1.4 * this.dpr
    ctx.stroke()
    ctx.restore()

    // ── 저승의 벽 ── 여기서는 지도가 곧 길 찾기다
    const maze = g.mazeWalls
    if (maze?.length) {
      ctx.fillStyle = 'rgba(150,136,190,.5)'
      for (const wl of maze) {
        const x = px(wl.x - wl.hw), z = pz(wl.z - wl.hd)
        ctx.fillRect(x, z, Math.max(1.5, wl.hw * 2 * k), Math.max(1.5, wl.hd * 2 * k))
      }
    }

    const dot = (x, z, r, fill, ring = null) => {
      ctx.beginPath()
      ctx.arc(px(x), pz(z), r * this.dpr, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 1.2 * this.dpr; ctx.stroke() }
    }

    // ── 전리품 ── 흘린 것을 두고 가지 않게
    for (const o of g.pickups?.live ?? []) {
      dot(o.x, o.z, DOT.loot, 'rgba(232,200,132,.85)')
    }

    // ── 양 ── 적이 아니라 피해 갈 것. 지도에서 길을 고르는 데 쓴다 (enemy/sheep.js)
    for (const sh of g.sheep ?? []) {
      dot(sh.pos.x, sh.pos.z, DOT.ally - 0.6, sh.quiet > 0 ? 'rgba(232,200,132,.7)' : 'rgba(230,226,214,.8)')
    }

    // ── 적 ──
    for (const e of g.enemies ?? []) {
      if (e.dead || e.isDummy) continue
      if (e.isBoss) dot(e.pos.x, e.pos.z, DOT.boss, 'rgba(200,60,44,.9)', 'rgba(255,170,120,.9)')
      else dot(e.pos.x, e.pos.z, DOT.enemy, 'rgba(198,74,58,.88)')
    }

    // ── 동료 ── 쓰러진 사람은 깜빡인다. 지도에서 제일 급한 점이다
    const blink = (performance.now() % 700) < 380
    for (const a of g.allies ?? []) {
      if (a.dead) continue
      if (a.down > 0) { if (blink) dot(a.pos.x, a.pos.z, DOT.ally + 1.4, '#ff6a52', '#ffd0c0') }
      else dot(a.pos.x, a.pos.z, DOT.ally, 'rgba(111,208,192,.9)')
    }

    // ── 나 ── 점이 아니라 화살이다. 어디를 보고 있는지가 지도의 절반이다
    const p = g.player
    if (p && !p.dead) {
      const s = DOT.me * this.dpr
      ctx.save()
      ctx.translate(px(p.pos.x), pz(p.pos.z))
      ctx.rotate(-p.facing)            // 화면 위가 -z 라 각도 부호가 뒤집힌다
      ctx.beginPath()
      ctx.moveTo(0, -s * 1.6)
      ctx.lineTo(s, s)
      ctx.lineTo(0, s * 0.42)
      ctx.lineTo(-s, s)
      ctx.closePath()
      ctx.fillStyle = '#ffe6b8'
      ctx.fill()
      ctx.strokeStyle = 'rgba(40,28,10,.9)'
      ctx.lineWidth = 1 * this.dpr
      ctx.stroke()
      ctx.restore()
    }

    const label = g.run?.view?.name ?? ''
    if (label !== this._label) { this.labelEl.textContent = label; this._label = label }
  }
}
