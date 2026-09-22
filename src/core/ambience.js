/**
 * 배경 공기 — 판마다 까는 낮은 잡음 한 겹.
 *
 * ── 왜 필요한가 ──
 * 음악(music.js)은 판의 "결"을 정하고, 효과음(sfx.js)은 "일어난 일"을
 * 알린다. 그런데 둘 다 조용한 순간 — 걷기만 하는 사이, 적이 없는 틈 —
 * 에는 아무 소리도 안 난다. 그 침묵이 "고요하다"가 아니라 "꺼졌다"로
 * 들린다. 화면은 바다·숲·동굴인데 귀에는 아무것도 없으면, 그림 위에
 * 서 있는 것이지 그 자리에 있는 게 아니다.
 *
 * 그래서 판마다 낮은 잡음 하나를 계속 깐다 — 바다는 바람과 파도,
 * 숲은 잎이 스치는 소리, 동굴·저승은 낮은 웅웅거림과 물방울, 홀은
 * 횃불이 타는 소리. 음악보다 한참 낮게(기본 0.16) 깔아서, 있는지도
 * 모르게 있다가 빠지면 허전해지는 자리를 만든다.
 *
 * ── 만드는 법 ──
 * sfx.js 와 같은 잡음 한 조각을 쓰되, 한 번 쓰고 버리는 게 아니라
 * **계속 돈다**(loop) 필터만 천천히 흔들어서(LFO) 바람이 죽었다 살았다
 * 하는 것처럼 만든다. 그 위에 가끔 한 번씩 짧은 소리(물방울·새·잉걸불
 * 튀는 소리)를 흩어 얹는다 — 이게 없으면 그냥 "쉬 하는 화이트노이즈"
 * 지 "그 자리의 소리"가 아니다.
 *
 * ── 규칙은 music.js 와 같다 ──
 * 1. 첫 입력 전엔 못 켠다. 2. 판이 바뀌면 겹쳐 넘긴다(뚝 끊지 않는다).
 * 3. 음소거는 Music 쪽을 그대로 본다 — 따로 끌 방법을 안 늘린다.
 */

const FLAVOR = {
  // 이스마로스·텔레필로스·세이렌·메시나 — 바람과 먼 파도
  sea: { base: 900, lfo: 0.09, lfoDepth: 260, q: 0.5, gain: 0.16,
    tick: { every: [3.5, 7], f: [1800, 3400], dur: [0.5, 0.9], gain: 0.05 } },
  // 아이아이에 — 잎이 스치는 소리, 이따금 짐승·새
  forest: { base: 1400, lfo: 0.14, lfoDepth: 420, q: 0.7, gain: 0.13,
    tick: { every: [2.2, 5], f: [2600, 4200], dur: [0.12, 0.22], gain: 0.06 } },
  // 폴리페모스의 동굴·저승 — 낮은 웅웅거림, 물방울
  cave: { base: 220, lfo: 0.05, lfoDepth: 40, q: 1.6, gain: 0.20,
    tick: { every: [2.6, 5.5], f: [1200, 2000], dur: [0.06, 0.1], gain: 0.07, tone: true } },
  // 이타카의 홀 — 횃불이 타는 소리, 마른 나무
  hall: { base: 1100, lfo: 0.22, lfoDepth: 180, q: 0.9, gain: 0.11,
    tick: { every: [1.6, 3.2], f: [2200, 3600], dur: [0.05, 0.09], gain: 0.05 } },
}

export class Ambience {
  /** @param music 음소거 상태를 여기서 본다 (core/music.js) */
  constructor(music = null) {
    this.music = music
    this.vol = 1
    this.ctx = null
    this.master = null
    this.noise = null
    this.cur = null       // { key, gain, filter, src, lfo, tickTimer }
    this._want = null

    const arm = () => {
      if (this.ctx) return
      try {
        this.ctx = new (window.AudioContext ?? window.webkitAudioContext)()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.vol
        this.master.connect(this.ctx.destination)
        this.noise = this.#makeNoise()
        if (this._want) this.play(this._want)
      } catch { this.ctx = null }
    }
    addEventListener('pointerdown', arm, { once: true })
    addEventListener('keydown', arm, { once: true })
  }

  get muted() { return !!this.music?.muted }

  /** 8초짜리 흰 잡음 — 한 번 만들고 계속 돌려 쓴다. */
  #makeNoise() {
    const n = this.ctx.sampleRate * 8
    const buf = this.ctx.createBuffer(1, n, n / 8)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /**
   * 판의 공기를 튼다. key 가 없거나 모르는 값이면 조용히 끈다
   * (예: 액자·화면 같은 판 밖 자리).
   */
  play(key) {
    this._want = key
    if (!this.ctx) return
    if (this.cur?.key === key) return
    const spec = FLAVOR[key]
    this.#stop(0.9)
    if (!spec) return

    const c = this.ctx, t = c.currentTime
    const src = c.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = spec.q
    filter.frequency.value = spec.base
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(this.muted ? 0 : spec.gain, t + 1.4)
    src.connect(filter); filter.connect(gain); gain.connect(this.master)
    src.start(t, Math.random() * 4)

    // 필터를 천천히 흔든다 — 바람이 죽었다 살았다 하는 것처럼
    const lfo = c.createOscillator()
    lfo.frequency.value = spec.lfo
    const lfoGain = c.createGain()
    lfoGain.gain.value = spec.lfoDepth
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency)
    lfo.start(t)

    const state = { key, gain, filter, src, lfo, tickTimer: null }
    this.cur = state
    this.#scheduleTick(state, spec)
  }

  /** 가끔 한 번씩 — 물방울·새·잉걸불. 판이 바뀌면 자동으로 멎는다(클로저가 죽은 state 를 들고 있으면 스스로 멈춘다). */
  #scheduleTick(state, spec) {
    if (!spec.tick) return
    const [lo, hi] = spec.tick.every
    const wait = (lo + Math.random() * (hi - lo)) * 1000
    state.tickTimer = setTimeout(() => {
      if (this.cur !== state) return   // 그 사이 판이 바뀌었다
      if (!this.muted) this.#tick(spec.tick)
      this.#scheduleTick(state, spec)
    }, wait)
  }

  #tick({ f, dur, gain, tone }) {
    const c = this.ctx, t = c.currentTime
    const d = dur[0] + Math.random() * (dur[1] - dur[0])
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + d * 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    g.connect(this.master)
    if (tone) {
      // 저승·동굴의 물방울 — 짧은 사인파
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(f[0] + Math.random() * (f[1] - f[0]), t)
      o.frequency.exponentialRampToValueAtTime(f[0] * 0.6, t + d)
      o.connect(g); o.start(t); o.stop(t + d + 0.02)
    } else {
      // 바람 스침·잉걸불 — 잡음 조각
      const src = c.createBufferSource()
      src.buffer = this.noise
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 2.2
      bp.frequency.value = f[0] + Math.random() * (f[1] - f[0])
      src.connect(bp); bp.connect(g)
      src.start(t, Math.random() * 4); src.stop(t + d + 0.02)
    }
  }

  #stop(fade = 0.9) {
    if (!this.cur) return
    const { gain, src, lfo, tickTimer } = this.cur
    clearTimeout(tickTimer)
    const c = this.ctx, t = c.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(0, t + fade)
    src.stop(t + fade + 0.05)
    lfo.stop(t + fade + 0.05)
    this.cur = null
  }

  /** M — 음소거는 Music 쪽에서 토글하고, 여기는 그 상태를 반영만 한다. */
  syncMute() {
    if (!this.ctx || !this.cur) return
    const target = this.muted ? 0 : (FLAVOR[this.cur.key]?.gain ?? 0)
    const t = this.ctx.currentTime
    this.cur.gain.gain.cancelScheduledValues(t)
    this.cur.gain.gain.setValueAtTime(this.cur.gain.gain.value, t)
    this.cur.gain.gain.linearRampToValueAtTime(target, t + 0.5)
  }
}
