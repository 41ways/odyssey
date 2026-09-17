/**
 * 효과음 — 파일 없이 만든다.
 *
 * ── 왜 합성인가 ──
 * 이 게임에는 배경 음악만 있었다. 그래서 칼이 몸에 들어가는 순간과
 * 허공을 가르는 순간이 **소리로 구분되지 않았다.** 프레임 데이터를 아무리
 * 다듬어도 맞았는지 빗맞았는지를 귀로 모르면 타격감이 안 생긴다.
 * 쿼터뷰는 특히 그렇다 — 캐릭터가 작아서 눈으로는 잘 안 보인다.
 *
 * 효과음 파일을 받아 올 수도 있었다. 그런데 필요한 게 열두 종이고,
 * 라이선스가 제각각이고, 다 합치면 또 몇 MB다. 반면 이 소리들은
 * 전부 **잡음 한 조각과 사인파 몇 개**로 만들 수 있는 것들이다.
 * 칼 휘두르는 소리는 필터 쓸어내린 잡음이고, 몸에 박히는 소리는
 * 낮은 쿵 + 짧은 잡음이고, 금속 소리는 어긋나게 맞춘 사인파 셋이다.
 * 0 바이트로 되는 걸 몇 MB 받아 올 이유가 없다.
 *
 * ── 규칙 ──
 * 1. **첫 입력 전에는 소리를 못 낸다.** 브라우저가 막는다. music.js 와
 *    같은 방식으로 첫 클릭·키에 풀고, 그 전의 호출은 조용히 버린다.
 * 2. **같은 소리가 겹쳐 쌓이지 않게 막는다.** 적 열 마리가 한 프레임에
 *    죽으면 같은 소리가 열 번 나고, 그건 소리가 아니라 잡음이다.
 *    종류마다 최소 간격(`gap`)을 둔다.
 * 3. **음소거는 음악과 같이 간다.** M 을 눌러 껐는데 칼 소리가 계속
 *    나면 그건 버그로 읽힌다. `Music` 을 물려 받아서 그쪽을 본다.
 * 4. **볼륨은 음악보다 조금 높게.** 배경은 배경이고 타격은 사건이다.
 */

/** 소리 한 종의 설계. gap 은 이 소리가 다시 날 수 있는 최소 간격(초). */
const GAP = {
  swing: 0.05, hit: 0.03, crit: 0.06, thud: 0.04, clang: 0.05,
  draw: 0.2, shoot: 0.05, roll: 0.12, step: 0.09,
  level: 0.4, chime: 0.15, boom: 0.08, deny: 0.18,
}

export class Sfx {
  /** @param music 음소거 상태를 여기서 본다 (core/music.js) */
  constructor(music = null) {
    this.music = music
    this.vol = 0.5
    this.ctx = null
    this.master = null
    this.noise = null
    this._last = new Map()

    const arm = () => {
      if (this.ctx) return
      try {
        this.ctx = new (window.AudioContext ?? window.webkitAudioContext)()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.vol
        this.master.connect(this.ctx.destination)
        this.noise = this.#makeNoise()
      } catch { this.ctx = null }
    }
    addEventListener('pointerdown', arm, { once: true })
    addEventListener('keydown', arm, { once: true })
  }

  get muted() { return !!this.music?.muted }

  /**
   * 1초짜리 흰 잡음 한 조각. 모든 '쉭' 과 '퍽' 이 이걸 잘라 쓴다.
   * 매번 새로 만들면 프레임이 튄다 — 한 번 만들어 두고 재생 속도와
   * 필터만 바꿔서 전혀 다른 소리로 쓴다.
   */
  #makeNoise() {
    const n = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, n, n)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /** 이 소리를 지금 내도 되는가. 너무 촘촘하면 버린다 (규칙 2). */
  #ok(key) {
    if (!this.ctx || this.muted) return false
    const now = this.ctx.currentTime
    const last = this._last.get(key) ?? -1
    if (now - last < (GAP[key] ?? 0.04)) return false
    this._last.set(key, now)
    return true
  }

  /**
   * 잡음 한 조각. 칼바람·발소리·천 소리가 다 이것이다.
   * @param o.dur   길이(초)
   * @param o.from  필터 시작 주파수 · o.to 끝 주파수 — 쓸어내리면 '쉭'
   * @param o.q     좁을수록 '삐' 에 가깝고 넓을수록 '쉬' 에 가깝다
   */
  #puff({ dur = 0.14, from = 3000, to = 500, q = 1.1, gain = 0.5, type = 'bandpass', rate = 1 } = {}) {
    const c = this.ctx, t = c.currentTime
    const src = c.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = rate
    const f = c.createBiquadFilter()
    f.type = type
    f.Q.value = q
    f.frequency.setValueAtTime(from, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f); f.connect(g); g.connect(this.master)
    src.start(t, Math.random() * 0.8)   // 잡음 조각의 시작점을 흩는다 — 안 그러면 매번 똑같다
    src.stop(t + dur + 0.02)
  }

  /**
   * 사인파 한 음. 쿵·금속·종이 다 이것을 겹쳐 만든다.
   * @param o.f0 시작 주파수 · o.f1 끝 주파수 (내려가면 '쿵', 그대로면 '띵')
   */
  #tone({ f0 = 200, f1 = 60, dur = 0.16, gain = 0.4, type = 'sine', delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay
    const o = c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(this.master)
    o.start(t); o.stop(t + dur + 0.02)
  }

  /* ── 소리 목록 ─────────────────────────────────────────────
     이름은 '무엇이 일어났는가' 로 짓는다. '어떤 소리인가' 로 지으면
     나중에 소리를 바꿀 때 부르는 쪽을 다 고쳐야 한다. */

  /**
   * 칼을 휘두른다 (허공).
   * @param heavy 3타처럼 큰 동작인가 — 낮고 길게 쓸어내린다
   */
  swing(heavy = false) {
    if (!this.#ok('swing')) return
    this.#puff(heavy
      ? { dur: 0.26, from: 2200, to: 260, q: 0.8, gain: 0.34, rate: 0.85 }
      : { dur: 0.13, from: 3600, to: 700, q: 1.3, gain: 0.22 })
    if (heavy) this.#tone({ f0: 150, f1: 48, dur: 0.22, gain: 0.16 })
  }

  /** 몸에 들어갔다. 낮은 쿵 + 짧고 탁한 잡음 — '퍽' 은 이 둘의 합이다. */
  hit(heavy = false) {
    if (!this.#ok('hit')) return
    this.#tone({ f0: heavy ? 180 : 240, f1: heavy ? 52 : 80, dur: heavy ? 0.16 : 0.1, gain: heavy ? 0.42 : 0.28 })
    this.#puff({ dur: 0.07, from: 1400, to: 300, q: 0.7, gain: heavy ? 0.3 : 0.18, type: 'lowpass' })
  }

  /**
   * 내가 맞았다.
   *
   * `hit` 과 따로 두는 이유는 소리 모양이 아니라 **간격** 때문이다.
   * 둘이 같은 칸을 쓰면, 적 다섯을 베는 중에 내가 맞았을 때 내 소리가
   * 간격 제한에 걸려 사라진다. 그건 제일 중요한 소리를 잃는 것이다.
   */
  thud() {
    if (!this.#ok('thud')) return
    this.#tone({ f0: 160, f1: 44, dur: 0.2, gain: 0.5 })
    this.#puff({ dur: 0.09, from: 900, to: 180, q: 0.6, gain: 0.32, type: 'lowpass' })
  }

  /** 급소·그로기 타격. 위에 밝은 한 겹을 더 얹는다 — 같은 타격인데 다르게 들려야 한다. */
  crit() {
    if (!this.#ok('crit')) return
    this.#tone({ f0: 210, f1: 60, dur: 0.18, gain: 0.44 })
    this.#puff({ dur: 0.1, from: 5200, to: 900, q: 1.6, gain: 0.3 })
    this.#tone({ f0: 1180, f1: 880, dur: 0.14, gain: 0.12, type: 'triangle', delay: 0.01 })
  }

  /** 안 통했다 (무적·부름꾼·잔). 금속이 튕기는 소리 — 어긋난 사인파 셋. */
  clang() {
    if (!this.#ok('clang')) return
    for (const [f, g, d] of [[1720, 0.16, 0], [2410, 0.1, 0.004], [3180, 0.06, 0.008]]) {
      this.#tone({ f0: f, f1: f * 0.97, dur: 0.3, gain: g, type: 'triangle', delay: d })
    }
    this.#puff({ dur: 0.05, from: 4200, to: 1600, q: 2.2, gain: 0.16 })
  }

  /** 거절 — 지금은 할 수 없다. 짧고 낮게 두 번. */
  deny() {
    if (!this.#ok('deny')) return
    this.#tone({ f0: 300, f1: 300, dur: 0.06, gain: 0.16, type: 'square' })
    this.#tone({ f0: 210, f1: 210, dur: 0.08, gain: 0.16, type: 'square', delay: 0.075 })
  }

  /** 활을 당긴다. 올라가는 잡음 — 당기는 동안 한 번만 난다 (gap 0.2). */
  draw() {
    if (!this.#ok('draw')) return
    // 처음에 gain 0.14 로 뒀는데 실제로 재 보니 정점이 0.011 이었다.
    // 좁은 밴드패스(Q 2.4)가 잡음의 대부분을 깎아 내기 때문이다 —
    // 필터를 통과한 뒤의 크기를 보고 정해야 한다.
    this.#puff({ dur: 0.36, from: 320, to: 1500, q: 1.6, gain: 0.7, rate: 0.7 })
  }

  /**
   * 꽉 당겼다.
   *
   * 이 소리 하나가 차징의 값을 만든다. 만작이 되었는지를 눈으로만
   * 알려 주면 (화살촉 색이 바뀐다) 조준하는 동안은 그걸 못 본다.
   * 시위가 다 당겨진 순간에 '띵' 이 오면 **언제 놓아야 하는지**가
   * 손에 남고, 그때부터 차징이 기다림이 아니라 기술이 된다.
   */
  ready() {
    if (!this.#ok('chime')) return
    this.#tone({ f0: 1568, f1: 1568, dur: 0.16, gain: 0.13, type: 'triangle' })
    this.#tone({ f0: 2093, f1: 2093, dur: 0.12, gain: 0.07, type: 'triangle', delay: 0.02 })
  }

  /** 쏜다. @param full 꽉 당겼는가 — 그러면 '탕' 에 가깝다 */
  shoot(full = false) {
    if (!this.#ok('shoot')) return
    this.#puff({ dur: full ? 0.14 : 0.08, from: full ? 2600 : 1900, to: 420, q: 1.5, gain: full ? 0.34 : 0.2 })
    this.#tone({ f0: full ? 420 : 520, f1: full ? 120 : 200, dur: 0.1, gain: full ? 0.22 : 0.12, type: 'triangle' })
  }

  /** 구른다. 천과 흙 — 낮고 넓은 잡음. */
  roll() {
    if (!this.#ok('roll')) return
    this.#puff({ dur: 0.3, from: 900, to: 180, q: 0.6, gain: 0.2, type: 'lowpass', rate: 0.6 })
  }

  /** 발소리. 아주 작게 — 들리라고 넣는 게 아니라 없으면 붕 떠서 넣는다. */
  step() {
    if (!this.#ok('step')) return
    this.#puff({ dur: 0.06, from: 620, to: 140, q: 0.7, gain: 0.075, type: 'lowpass' })
  }

  /** 큰 것이 땅을 친다. 거인의 발, 바위, 충격파. */
  boom() {
    if (!this.#ok('boom')) return
    this.#tone({ f0: 110, f1: 34, dur: 0.5, gain: 0.5 })
    this.#puff({ dur: 0.34, from: 700, to: 90, q: 0.5, gain: 0.3, type: 'lowpass', rate: 0.5 })
  }

  /** 무언가가 열렸다 — 끊었다, 끊어졌다, 약점이 드러났다. */
  chime() {
    if (!this.#ok('chime')) return
    for (const [f, d] of [[880, 0], [1320, 0.05], [1760, 0.1]]) {
      this.#tone({ f0: f, f1: f, dur: 0.42, gain: 0.15, type: 'triangle', delay: d })
    }
  }

  /** 레벨이 올랐다. 올라가는 세 음 — 이것만 길고 분명하게 둔다. */
  level() {
    if (!this.#ok('level')) return
    for (const [f, d] of [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.27]]) {
      this.#tone({ f0: f, f1: f, dur: 0.5, gain: 0.17, type: 'triangle', delay: d })
    }
  }
}
