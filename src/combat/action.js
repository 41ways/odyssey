/**
 * 액션 = 프레임 데이터. 플레이어도 적도 보스도 전부 같은 시스템을 쓴다.
 *
 *   startup   예고. 여기서 장판이 깔린다. 길수록 읽기 쉽고 피하기 쉽다
 *   active    판정이 살아있는 구간
 *   recovery  후딜. 여기가 반격 창이다
 *   cancelAt  시작부터 잰 시각. 이 이후로 버퍼된 다음 입력을 받아준다
 *
 * 소울라이크의 리듬(예고 → 회피 → 반격)이 전부 이 네 숫자에서 나온다.
 */
export class ActionRunner {
  constructor(owner) {
    this.owner = owner
    this.def = null
    this.t = 0
    this.hitSet = new Set()
    this.telegraph = null
  }

  get active() { return this.def !== null }
  get total() { return this.def ? this.def.startup + this.def.active + this.def.recovery : 0 }
  get phase() {
    if (!this.def) return 'none'
    if (this.t < this.def.startup) return 'startup'
    if (this.t < this.def.startup + this.def.active) return 'active'
    return 'recovery'
  }
  /** 후딜 중에 다음 동작으로 이어갈 수 있는가. */
  get cancelable() { return !!this.def && this.def.cancelAt != null && this.t >= this.def.cancelAt }

  play(def) {
    this.def = def
    this.t = 0
    this.hitSet.clear()
    this.telegraph = null
    this._wasActive = false
    def.onStart?.(this.owner, this)
  }

  stop() {
    if (this.telegraph) { this.owner.fx?.telegraph.cancel(this.telegraph); this.telegraph = null }
    this.def = null
    this.t = 0
  }

  update(dt) {
    if (!this.def) return
    const d = this.def
    const prev = this.t
    // 공격속도는 액션 시계를 배속하는 것으로 구현한다.
    // 예고·판정·후딜·캔슬 창이 전부 같은 비율로 따라와서 밸런스가 안 어긋난다.
    this.t += dt * (d.fixedRate ? 1 : (this.owner.actionRate ?? 1))

    const aStart = d.startup, aEnd = d.startup + d.active
    const entering = prev < aStart && this.t >= aStart
    if (entering) { this.telegraph = null; d.onActive?.(this.owner, this) }
    if (this.t >= aStart && prev < aEnd) d.onHitWindow?.(this.owner, this, dt)

    // 전진 — 공격이 몸을 끌고 가야 무게가 실린다
    if (d.move) {
      const k = d.move.curve(this.t / this.total)
      const prevK = d.move.curve(prev / this.total)
      const step = (k - prevK) * d.move.distance
      this.owner.pos.x += Math.sin(this.owner.facing) * step
      this.owner.pos.z += Math.cos(this.owner.facing) * step
    }

    if (this.t >= this.total) {
      const done = d
      this.def = null
      this.t = 0
      done.onEnd?.(this.owner, this)
    }
  }
}

/** 전진 곡선 몇 개. 앞쪽에 몰아주면 묵직하게 파고드는 느낌이 난다. */
export const CURVE = {
  front: t => 1 - Math.pow(1 - Math.min(t * 2.2, 1), 3),
  even: t => t,
  lunge: t => Math.min(t * 3.4, 1) ** 0.6,
}
