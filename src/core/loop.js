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
    let real = clamp((now - last) / 1000, 0, 0.25)
    last = now

    /* 한참 멈춰 있었으면 그 시간을 **따라잡지 않는다.**
       막 뒤에서 셰이더를 굽거나, 컷신 그림을 풀거나, 탭에서 돌아오면 한
       프레임의 간격이 0.2초씩 벌어진다. 전에는 그걸 메우려고 한 프레임에
       시뮬레이션을 다섯 칸씩 몰아 돌렸다 — 세상이 83ms 만큼 순간이동하고,
       그 프레임 자체도 다섯 배로 걸려서 눈에 턱 걸린다. 화면이 넘어갈 때마다
       한 번씩 삐걱거리던 게 이것이다.
       멈춘 시간은 그냥 버린다. 잃는 건 흘러간 시간이고, 얻는 건 이어지는 화면이다. */
    if (real > 0.1) real = DT

    // 연출은 실시간으로 흐른다. 히트스톱이 스스로를 풀 수 있어야 하니까.
    fx(real)

    acc += real
    let steps = 0
    while (acc >= DT && steps < 5) {
      update(DT)
      acc -= DT
      steps++
    }
    if (steps === 5) acc = 0 // 그래도 밀리면 버린다

    render(acc / DT)
  }

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame) },
    stop() { running = false; cancelAnimationFrame(raf) },
  }
}
