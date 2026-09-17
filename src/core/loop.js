import { clamp } from './math.js'

/**
 * 고정 타임스텝 루프.
 * 시뮬레이션은 60Hz 로 고정, 렌더는 화면 주사율을 따른다.
 * 히트스톱 중에는 시뮬레이션만 멈추고 연출(흔들림·이펙트)은 계속 흐른다.
 */
export const DT = 1 / 60

export function createLoop({ update, render, fx }) {
  let last = performance.now()
  let acc = 0
  let running = false
  let raf = 0

  function frame(now) {
    raf = requestAnimationFrame(frame)
    const real = clamp((now - last) / 1000, 0, 0.25)
    last = now

    // 연출은 실시간으로 흐른다. 히트스톱이 스스로를 풀 수 있어야 하니까.
    fx(real)

    acc += real
    let steps = 0
    while (acc >= DT && steps < 5) {
      update(DT)
      acc -= DT
      steps++
    }
    if (steps === 5) acc = 0 // 탭 복귀 등으로 밀린 시간은 버린다

    render(acc / DT)
  }

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame) },
    stop() { running = false; cancelAnimationFrame(raf) },
  }
}
