/**
 * 저승의 길.
 *
 * 저승은 싸우는 곳이 아니다. 그런데 싸우지 않는 판을 그냥 빈 마당으로 두면
 * "아무것도 없는 데를 걸어서 가운데까지 갔다" 가 되고, 그건 판이 아니라 복도다.
 * 그래서 **길을 만든다** — 곧장 가지 못하고 몇 번 꺾어야 구덩이에 닿는다.
 *
 * 다만 진짜 미로는 아니다. 갈림길에서 헤매게 하면 이야기가 멈춘다.
 * 길은 하나고, 그 길이 굽어 있을 뿐이다. 벽은 넘겨다볼 수 있게 낮고,
 * 막다른 곳은 없다.
 *
 * 돌아 나오는 길도 같은 길이다. 올 때 꺾었던 자리를 갈 때 다시 꺾는다 —
 * 쫓기면서 같은 자리를 지나야 "돌아간다" 가 된다.
 */

/** 씨앗 하나로 같은 길을 다시 만든다. 판을 다시 열어도 길이 안 바뀌어야 한다. */
function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/**
 * 격자 위에 남→북 한 줄짜리 길을 낸다.
 *
 * 앞으로(북으로) 가는 것과 옆으로 새는 것을 섞되, 남은 줄 수보다 더 오래
 * 옆으로 새지 않게 막는다. 그래야 반드시 끝에 닿는다 — 생성에 실패해서
 * 판이 안 열리는 일이 있으면 안 된다.
 */
function carve(cols, rows, rand, meander = 0.55) {
  const mid = Math.floor(cols / 2)
  const path = [{ c: mid, r: rows - 1 }]
  let c = mid, r = rows - 1
  while (r > 0) {
    // 옆으로 샐지 북으로 갈지. 북으로 갈 기회는 항상 남겨 둔다.
    const canSide = rand() < meander
    if (canSide) {
      const dir = rand() < 0.5 ? -1 : 1
      const steps = 1 + Math.floor(rand() * 3)
      for (let i = 0; i < steps; i++) {
        const nc = c + dir
        if (nc < 0 || nc >= cols) break
        // 이미 지난 칸으로 되돌아가지 않는다 — 고리가 생기면 길이 둘이 된다
        if (path.some(p => p.c === nc && p.r === r)) break
        c = nc
        path.push({ c, r })
      }
    }
    r--
    path.push({ c, r })
  }
  return path
}

/**
 * 길 하나와 그 둘레의 벽.
 *
 * @param extent  판 중심에서 가장자리까지 (정사각 기준 반폭)
 * @param cols/rows 격자 크기. 칸 하나가 곧 복도 폭이다
 * @param fill    길이 아닌 칸에 벽을 세울 확률. 1 이면 빽빽한 미로,
 *                낮추면 폐허 사이를 지나가는 느낌이 된다
 */
export function buildMaze({ extent = 14, cols = 0, rows = 0, seed = 7, fill = 0.62, meander = 0.55, lane = 5.2 } = {}) {
  const rand = rng(seed)
  /* 칸 수를 판 크기에서 뽑는다.
     전에는 7×7 로 박혀 있었다. 저승 판을 반지름 16 에서 34 로 넓히자 칸
     하나가 9.5 걸음이 됐다 — 그건 복도가 아니라 **마당**이다. 벽 사이를
     지나간다는 느낌이 사라지고, 멀리 있는 벽 몇 개를 비껴 걷는 게 된다.
     칸 폭을 5.2 걸음으로 고정하고 칸 수를 판에 맞춰 늘린다. 판이 넓어질수록
     길이 길어지는 게 아니라 **굽이가 많아진다** — 길이는 어차피 판 크기가 준다. */
  const n = Math.max(7, Math.min(15, Math.round((extent * 2) / lane)))
  cols = cols || (n % 2 ? n : n + 1)      // 홀수라야 가운데 칸에서 출발한다
  rows = rows || cols
  const path = carve(cols, rows, rand, meander)
  const onPath = new Set(path.map(p => `${p.c},${p.r}`))

  const cw = (extent * 2) / cols          // 칸 하나의 폭
  const cd = (extent * 2) / rows
  const cx = i => -extent + cw * (i + 0.5)
  const cz = j => -extent + cd * (j + 0.5)

  const walls = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (onPath.has(`${i},${j}`)) continue
      if (rand() > fill) continue
      // 칸을 꽉 채우지 않는다. 틈이 있어야 벽이 아니라 '무너진 것들' 로 보인다.
      const shrink = 0.62 + rand() * 0.24
      walls.push({
        x: cx(i) + (rand() - 0.5) * cw * 0.12,
        z: cz(j) + (rand() - 0.5) * cd * 0.12,
        hw: cw * 0.5 * shrink,
        hd: cd * 0.5 * shrink,
        h: 1.7 + rand() * 1.5,
        turn: rand() * 0.5 - 0.25,
      })
    }
  }

  const first = path[0], last = path[path.length - 1]
  return {
    walls,
    // 걸어야 하는 자리들. 쫓기는 구간에서 망자들이 이 줄을 따라 밀고 온다.
    lane: path.map(p => ({ x: cx(p.c), z: cz(p.r) })),
    start: { x: cx(first.c), z: cz(first.r) },
    goal: { x: cx(last.c), z: cz(last.r) },
    cell: { w: cw, d: cd },
  }
}

/**
 * 벽에서 밀어낸다.
 *
 * 겹친 깊이가 얕은 축으로만 민다 — 두 축을 같이 밀면 모서리에서 대각선으로
 * 튕겨 나가서, 벽을 따라 걷는 게 아니라 벽이 사람을 차는 것처럼 느껴진다.
 *
 * @returns 밀어냈으면 true
 */
export function pushOut(pos, radius, walls) {
  let hit = false
  // 두 번 돈다. 한 벽에서 밀려난 자리가 옆 벽 안일 수 있다 —
  // 좁은 모퉁이에서 한 번만 풀면 벽을 뚫고 지나간다.
  for (let pass = 0; pass < 2; pass++) {
    let moved = false
    for (const w of walls) {
      const dx = pos.x - w.x
      const dz = pos.z - w.z
      const ox = w.hw + radius - Math.abs(dx)
      if (ox <= 0) continue
      const oz = w.hd + radius - Math.abs(dz)
      if (oz <= 0) continue
      if (ox < oz) pos.x = w.x + Math.sign(dx || 1) * (w.hw + radius)
      else pos.z = w.z + Math.sign(dz || 1) * (w.hd + radius)
      moved = hit = true
    }
    if (!moved) break
  }
  return hit
}

/** 그 점이 벽 안인가. 무언가를 놓을 자리를 고를 때 쓴다. */
export function blocked(x, z, radius, walls) {
  for (const w of walls) {
    if (Math.abs(x - w.x) < w.hw + radius && Math.abs(z - w.z) < w.hd + radius) return true
  }
  return false
}
