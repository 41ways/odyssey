/**
 * 음악.
 *
 * 이 게임에는 소리가 하나도 없었다. 쿼터뷰에서 "웅장함" 을 만드는 데 카메라
 * 거리보다 크게 작동하는 게 소리다 — 거인이 크게 보이는 건 화면 크기가 아니라
 * 발소리가 낮게 깔릴 때다. 그런데 소리를 3D 로 만들 예산은 없으니, 우선
 * **판의 결을 정하는 배경 음악 한 겹**부터 깐다.
 *
 * ── 규칙 ──
 * 1. 브라우저는 사용자가 손을 대기 전에는 소리를 못 낸다. 그래서 첫 클릭·키에
 *    붙여 시작한다. 그 전에 play() 를 부르면 예외가 나므로 조용히 삼킨다.
 * 2. 판이 바뀔 때 툭 끊지 않는다. **겹쳐 넘긴다** — 전투에서 보스로 갈 때
 *    음악이 끊기면 판이 로딩된 것처럼 보인다.
 * 3. 볼륨은 항상 낮게. 배경은 배경이어야 한다. 기본 0.34.
 * 4. 음소거는 언제든 M. 끈 상태는 기억한다 — 껐는데 다음 판에서 다시 켜지면
 *    그건 버그로 읽힌다.
 */

const KEY = 'odyssey.muted'

/** 판의 결 → 트랙. 같은 결이면 같은 음악을 쓴다. */
const TRACKS = {
  sail: '/audio/movement-1-ashen-causeway.mp3',   // 뱃길·막간
  fight: '/audio/movement-2-cinder-vault.mp3',    // 웨이브
  deep: '/audio/movement-3-black-bell-sanctum.mp3', // 저승·동굴
  boss: '/audio/boss-bell-warden.mp3',            // 보스
}

export class Music {
  constructor() {
    this.muted = localStorage.getItem(KEY) === '1'
    this.vol = 0.34
    this.cur = null          // { el, key }
    this.next = null
    this.armed = false
    this._fades = []

    // 첫 입력에 소리를 푼다. 브라우저가 그 전에는 재생을 막는다.
    const arm = () => {
      if (this.armed) return
      this.armed = true
      if (this._want) this.play(this._want, { fade: 1.2 })
    }
    addEventListener('pointerdown', arm, { once: true })
    addEventListener('keydown', arm, { once: true })
  }

  #make(url) {
    const el = new Audio(url)
    el.loop = true
    el.preload = 'auto'
    el.volume = 0
    return el
  }

  /**
   * 그 결의 음악으로 넘어간다. 이미 같은 결이면 아무것도 안 한다 —
   * 같은 트랙을 다시 걸면 처음으로 돌아가서 흐름이 끊긴다.
   */
  play(key, { fade = 2.0 } = {}) {
    const url = TRACKS[key]
    if (!url) return
    this._want = key
    if (!this.armed || this.muted) return
    if (this.cur?.key === key) return

    const el = this.#make(url)
    el.play().catch(() => {})          // 아직 못 틀면 조용히 넘긴다
    const from = this.cur
    this.cur = { el, key }
    this.#fade(el, 0, this.vol, fade)
    if (from) this.#fade(from.el, from.el.volume, 0, fade, () => {
      from.el.pause(); from.el.src = ''
    })
  }

  /** 지금 곡을 내린다. 컷신처럼 조용해야 하는 자리에서 쓴다. */
  hush({ fade = 1.0 } = {}) {
    if (!this.cur) return
    const from = this.cur
    this.cur = null
    this._want = null
    this.#fade(from.el, from.el.volume, 0, fade, () => { from.el.pause(); from.el.src = '' })
  }

  toggleMute() {
    this.muted = !this.muted
    localStorage.setItem(KEY, this.muted ? '1' : '0')
    if (this.muted) {
      if (this.cur) this.#fade(this.cur.el, this.cur.el.volume, 0, 0.4)
    } else if (this.cur) {
      this.cur.el.play().catch(() => {})
      this.#fade(this.cur.el, 0, this.vol, 0.6)
    } else if (this._want) {
      this.play(this._want, { fade: 0.6 })
    }
    return this.muted
  }

  /** 볼륨을 시간에 걸쳐 옮긴다. setInterval 하나로 다 처리한다. */
  #fade(el, from, to, seconds, done) {
    const t0 = performance.now()
    const ms = Math.max(seconds, 0.01) * 1000
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms)
      try { el.volume = Math.max(0, Math.min(1, from + (to - from) * k)) } catch {}
      if (k >= 1) { clearInterval(id); done?.() }
    }, 40)
    this._fades.push(id)
  }
}
