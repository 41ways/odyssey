/**
 * 레벨 — 경험치로 성장 선택을 사는 곳.
 *
 * ── 왜 필요했나 ──
 * 성장 선택지에는 이미 계열(칼·활·발)과 등급(일반→레어→유니크→레전더리)이
 * 있고, 윗등급은 같은 계열을 2·4·6 번 골라야 열린다. 그런데 게임 전체에서
 * 고를 기회가 보스 은총 일곱 번 + 유물 한 번, 도합 여덟 번뿐이었다.
 * 한 계열에 여섯 번을 넣으려면 여덟 번 중 여섯을 같은 데 몰아야 한다 —
 * 레전더리는 사실상 못 보는 카드였다. 만들어 놓고 닫아 둔 문이다.
 *
 * 뱀서류가 이걸 푸는 방식은 단순하다. **적을 잡으면 바로 값이 붙고, 그 값이
 * 차면 그 자리에서 카드를 고른다.** 판이 진행되는 동안 힘이 자란다.
 * 그래서 같은 판 안에서도 앞과 뒤의 체감이 달라지고, 다음 판으로 넘어갈 때
 * "준비가 됐다" 는 느낌이 생긴다.
 *
 * ── 곡선 ──
 * need(L) = 24 + 13(L-1). 선형이다. 지수로 두면 후반에 한 번도 안 오르고,
 * 상수로 두면 후반에 세 번씩 오른다. 선형이면 **판마다 두 번**으로 떨어진다.
 * 판마다 두 번이 중요한 이유: 은총 한 번을 더해 판당 세 번이 되고,
 * 여덟 판이면 스무 번이다. 스무 번 중 여섯이면 한 계열에 30% — 마음먹으면
 * 레전더리에 닿고, 안 먹으면 안 닿는다. 그게 빌드가 갈리는 지점이다.
 *
 * 경험치는 판이 깊어질수록 붙는다 (DEPTH). 안 붙이면 뒷판이 경험치 가뭄이
 * 되는데, 이유는 처치 수는 비슷한데 필요량은 계속 오르기 때문이다.
 */

const BASE = 24
const STEP = 13

/** L 레벨에서 L+1 로 가는 데 드는 값. */
export const needFor = L => BASE + STEP * (L - 1)

/** 판이 깊어질 때 적 한 마리가 주는 몫. 체력 곡선과 같은 방향으로 붙인다. */
export const DEPTH = 0.26

/** 보스 한 기가 주는 몫. 잡졸 다섯 마리쯤 — 은총이 진짜 보상이라 여기선 덜 준다. */
export const BOSS_XP = 20

export class Level {
  constructor() { this.reset() }

  reset() {
    this.lv = 1
    this.xp = 0
    this.need = needFor(1)
    this.pending = 0      // 아직 안 고른 레벨업 수
  }

  /** 0..1 — 지금 레벨 안에서 얼마나 찼는지. */
  get ratio() { return Math.min(1, this.xp / this.need) }

  /**
   * 값을 넣고 넘친 만큼 레벨을 올린다.
   * 넘친 값은 버리지 않고 다음 레벨로 넘긴다 — 큰 놈을 잡았을 때
   * 값이 사라지면 잡은 손해가 된다.
   * @returns 올라간 레벨 수
   */
  add(amount) {
    if (amount <= 0) return 0
    this.xp += amount
    let up = 0
    while (this.xp >= this.need) {
      this.xp -= this.need
      this.lv++
      this.need = needFor(this.lv)
      up++
    }
    this.pending += up
    return up
  }

  /** 깊이에 따라 붙는 몫을 곱해 준다. */
  static scale(base, deep = 0) { return base * (1 + Math.max(0, deep) * DEPTH) }
}
