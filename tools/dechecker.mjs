/**
 * '투명 배경' 이라며 나온 그림 중에 격자무늬가 픽셀로 구워진 것들이 있다.
 * 알파는 전부 불투명하고, 투명을 뜻하던 회색 바둑판이 그대로 그려져 있다.
 *
 * 격자는 정확히 두 가지 색뿐이고 칸도 일정하다. 그래서 왼쪽 위 귀퉁이에서
 * 두 색을 읽어 내고, 가장자리에서부터 그 색만 타고 번져 들어가며 지운다.
 * 번져 들어가는 방식이라 인물 안쪽의 흰 천이나 대리석에는 구멍이 뚫리지 않는다.
 *
 *   node tools/dechecker.mjs <들어올 png> <나갈 이름> [여유값] [폭]
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const [src, name, tolArg, widthArg] = process.argv.slice(2)
// CUT_BELOW=702 처럼 주면 그 줄 아래는 통째로 지운다 (받침대 자르기)
// FADE_PX=150 을 같이 주면 그 위 150줄이 서서히 사라진다 — 자른 자리가 안 보이게
const CUT = Number(process.env.CUT_BELOW ?? 0)
const FADE = Number(process.env.FADE_PX ?? 0)
// 인물이 원본 테두리에 닿아 잘려 있으면 그 변만 흐리게 눅인다.
// 안 그러면 화면에 칼로 자른 듯한 직선이 남는다 (아가멤논의 망토가 그랬다).
const EDGE = Number(process.env.FADE_EDGE ?? 0)
const TRIM = process.env.TRIM === '1'   // 남은 여백을 잘라 낸다
// FLAT=1: 격자가 아니라 '한 가지 색으로 평평한 배경' 을 걷어낸다.
// 생성기에 투명을 달라고 하면 격자를 그려 버리므로, 아예 단색 배경으로
// 뽑아 달라고 하고 그 색만 가장자리에서부터 번져 들어가며 지운다.
const FLAT = process.env.FLAT === '1'
const FLAT_TOL = Number(process.env.FLAT_TOL ?? 34)
if (!src || !name) { console.error('쓰기: node tools/dechecker.mjs <png> <이름> [여유값] [폭]'); process.exit(1) }
const TOL = Number(tolArg ?? 12)

const img = sharp(src).ensureAlpha()
const { width: W, height: H } = await img.metadata()
const { data } = await img.raw().toBuffer({ resolveWithObject: true })

if (FLAT) {
  // 네 귀퉁이의 중앙값을 배경색으로 본다. 한쪽에 인물이 걸쳐 있어도 중앙값이면 버틴다.
  const corner = (x, y) => { const o = (y * W + x) * 4; return [data[o], data[o + 1], data[o + 2]] }
  const cs = [corner(3, 3), corner(W - 4, 3), corner(3, H - 4), corner(W - 4, H - 4)]
  const med = k => cs.map(c => c[k]).sort((a, b) => a - b)[1]
  const bgc = [med(0), med(1), med(2)]
  console.log(`  단색 배경 rgb(${bgc.join(' ')}) 을 걷어낸다`)

  const near = o => Math.abs(data[o] - bgc[0]) + Math.abs(data[o + 1] - bgc[1]) + Math.abs(data[o + 2] - bgc[2]) < FLAT_TOL * 3
  const N2 = W * H
  const bg2 = new Uint8Array(N2)
  const st = []
  const push2 = i => { if (!bg2[i] && near(i * 4)) { bg2[i] = 1; st.push(i) } }
  for (let x = 0; x < W; x++) { push2(x); push2((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { push2(y * W); push2(y * W + W - 1) }
  while (st.length) {
    const i = st.pop(), x = i % W, y = (i / W) | 0
    if (x > 0) push2(i - 1)
    if (x < W - 1) push2(i + 1)
    if (y > 0) push2(i - W)
    if (y < H - 1) push2(i + W)
  }

  // 생성기 표식(✦) 처럼 인물과 안 붙은 작은 섬은 버린다
  {
    const seen = new Uint8Array(N2)
    for (let i = 0; i < N2; i++) {
      if (seen[i] || bg2[i]) continue
      const comp = [i]; seen[i] = 1
      for (let h = 0; h < comp.length && comp.length < 2500; h++) {
        const j = comp[h], x = j % W, y = (j / W) | 0
        const add = k => { if (!seen[k] && !bg2[k]) { seen[k] = 1; comp.push(k) } }
        if (x > 0) add(j - 1)
        if (x < W - 1) add(j + 1)
        if (y > 0) add(j - W)
        if (y < H - 1) add(j + W)
      }
      if (comp.length < 2500) for (const j of comp) bg2[j] = 1
    }
  }

  const out2 = Buffer.alloc(N2 * 4)
  let kept2 = 0
  for (let i = 0; i < N2; i++) {
    const o = i * 4
    out2[o] = data[o]; out2[o + 1] = data[o + 1]; out2[o + 2] = data[o + 2]
    out2[o + 3] = bg2[i] ? 0 : 255
    if (!bg2[i]) kept2++
  }
  let pipe2 = sharp(out2, { raw: { width: W, height: H, channels: 4 } }).blur(0.5)
  if (TRIM) pipe2 = sharp(await pipe2.png().toBuffer()).trim({ threshold: 1 })
  if (widthArg) pipe2 = pipe2.resize({ width: Number(widthArg) })
  const dst2 = `public/img/${name}.webp`
  await pipe2.webp({ quality: 88, alphaQuality: 92 }).toFile(dst2)
  const m2 = await sharp(dst2).metadata()
  console.log(`✔ ${name}.webp  ${m2.width}×${m2.height}  ${Math.round((await sharp(dst2).toBuffer()).length / 1024)} KB`)
  console.log(`  배경 ${(100 - kept2 / N2 * 100).toFixed(0)}% 지움`)
  process.exit(0)
}

// 귀퉁이에서 격자의 두 밝기를 읽는다. 값에 잡티가 섞여 있어 색 그대로는
// 세어 봐야 흩어진다 — 밝기 기둥을 세우고 봉우리 두 개를 고른다.
const hist = new Float64Array(256)
const R = 96
for (let y = 0; y < Math.min(R, H); y++) {
  for (let x = 0; x < Math.min(R, W); x++) {
    const o = (y * W + x) * 4
    hist[Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2])]++
  }
}
const smooth = new Float64Array(256)
for (let i = 0; i < 256; i++) {
  let sum = 0, n = 0
  for (let d = -3; d <= 3; d++) if (i + d >= 0 && i + d < 256) { sum += hist[i + d]; n++ }
  smooth[i] = sum / n
}
const peaks = []
for (let pass = 0; pass < 2; pass++) {
  let best = -1, bv = 0
  for (let i = 0; i < 256; i++) {
    if (smooth[i] > bv && peaks.every(p => Math.abs(p - i) > 24)) { bv = smooth[i]; best = i }
  }
  if (best < 0) break
  peaks.push(best)
}
if (peaks.length < 2) { console.error('격자를 못 찾았다 — 귀퉁이가 배경이 아닌 것 같다'); process.exit(1) }
console.log(`  격자 밝기 ${peaks.sort((a, b) => a - b).join(' / ')}`)

// 칸과 칸 사이에는 두 회색이 섞인 줄이 한 겹 낀다. 그 줄까지 배경으로 봐야
// 번지기가 칸을 넘어간다 — 안 그러면 첫 칸에서 멈춘다.
const LO = peaks[0] - TOL
const HI = peaks[1] + TOL
const isChecker = o => {
  const r = data[o], g = data[o + 1], b = data[o + 2]
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  if (mx && (mx - mn) / mx > 0.075) return false          // 색이 돌면 그림이다
  const l = 0.299 * r + 0.587 * g + 0.114 * b
  return l >= LO && l <= HI
}

// 격자는 '무늬' 다. 가까이에서 두 회색이 같이 보이면 그건 칸이고,
// 인물 쪽 회색(대리석 받침 같은 것)은 매끈해서 한 가지 값만 보인다.
// 그래서 무늬가 보이는 자리만 씨앗으로 삼고, 거기서 번져 나간다 —
// 다리 사이처럼 가장자리와 안 닿은 칸도 이러면 같이 지워진다.
const N = W * H
const SPAN = (HI - LO) * 0.42
const patterned = i => {
  const x = i % W, y = (i / W) | 0
  let lo = 255, hi = 0
  for (let dy = -6; dy <= 6; dy += 3) for (let dx = -6; dx <= 6; dx += 3) {
    const nx = x + dx, ny = y + dy
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue
    const o = (ny * W + nx) * 4
    const l = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
    if (l < lo) lo = l
    if (l > hi) hi = l
  }
  return hi - lo > SPAN
}
const bg = new Uint8Array(N)
const stack = []
const push = i => { if (!bg[i] && isChecker(i * 4)) { bg[i] = 1; stack.push(i) } }
for (let i = 0; i < N; i++) if (isChecker(i * 4) && patterned(i)) push(i)
while (stack.length) {
  const i = stack.pop(), x = i % W, y = (i / W) | 0
  if (x > 0) push(i - 1)
  if (x < W - 1) push(i + 1)
  if (y > 0) push(i - W)
  if (y < H - 1) push(i + W)
}

// 격자 칸 경계에 낀 반투명 픽셀이 테두리로 남는다. 한 겹 더 깎는다.
const grown = Uint8Array.from(bg)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x
  if (bg[i]) continue
  let near = 0
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy
    if (nx >= 0 && nx < W && ny >= 0 && ny < H && bg[ny * W + nx]) near++
  }
  const o = i * 4
  const mx = Math.max(data[o], data[o + 1], data[o + 2]), mn = Math.min(data[o], data[o + 1], data[o + 2])
  const sat = mx === 0 ? 0 : (mx - mn) / mx
  if (near >= 3 && sat < 0.10 && mx > 150) grown[i] = 1     // 경계의 무채색 자투리만
}

// 남은 부스러기 — 지우다 만 점 몇 개가 배경에 뜬다. 작은 섬은 버린다
{
  const seen = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    if (seen[i] || grown[i]) continue
    const comp = [i]; seen[i] = 1
    for (let h = 0; h < comp.length && comp.length < 400; h++) {
      const j = comp[h], x = j % W, y = (j / W) | 0
      const tryAdd = k => { if (!seen[k] && !grown[k]) { seen[k] = 1; comp.push(k) } }
      if (x > 0) tryAdd(j - 1)
      if (x < W - 1) tryAdd(j + 1)
      if (y > 0) tryAdd(j - W)
      if (y < H - 1) tryAdd(j + W)
    }
    if (comp.length < 400) for (const j of comp) grown[j] = 1
  }
}

if (CUT) for (let y = CUT; y < H; y++) for (let x = 0; x < W; x++) grown[y * W + x] = 1

const out = Buffer.alloc(N * 4)
let kept = 0
for (let i = 0; i < N; i++) {
  const o = i * 4
  out[o] = data[o]; out[o + 1] = data[o + 1]; out[o + 2] = data[o + 2]
  let a = grown[i] ? 0 : 255
  if (a && CUT && FADE) {
    const y = (i / W) | 0
    if (y > CUT - FADE) a = Math.round(a * (1 - (y - (CUT - FADE)) / FADE))
  }
  out[o + 3] = a
  if (a) kept++
}

if (EDGE) {
  const at = i => out[i * 4 + 3]
  const touching = side => {
    let n = 0, tot = 0
    if (side === 'left' || side === 'right') {
      const x = side === 'left' ? 0 : W - 1
      for (let y = 0; y < H; y++) { tot++; if (at(y * W + x) > 24) n++ }
    } else {
      const y = side === 'top' ? 0 : H - 1
      for (let x = 0; x < W; x++) { tot++; if (at(y * W + x) > 24) n++ }
    }
    return n / tot > 0.015
  }
  const ramp = (d) => Math.min(1, d / EDGE)
  const sides = ['left', 'right', 'top', 'bottom'].filter(touching)
  if (sides.length) console.log(`  (테두리에 닿은 변을 눅인다: ${sides.join(', ')})`)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      if (!out[o + 3]) continue
      let k = 1
      if (sides.includes('left')) k = Math.min(k, ramp(x))
      if (sides.includes('right')) k = Math.min(k, ramp(W - 1 - x))
      if (sides.includes('top')) k = Math.min(k, ramp(y))
      if (sides.includes('bottom')) k = Math.min(k, ramp(H - 1 - y))
      out[o + 3] = Math.round(out[o + 3] * k)
    }
  }
}

mkdirSync('public/img', { recursive: true })
let pipe = sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .blur(0.4)                                   // 자른 자리를 아주 살짝 눅인다
if (TRIM) pipe = sharp(await pipe.png().toBuffer()).trim({ threshold: 1 })
if (widthArg) pipe = pipe.resize({ width: Number(widthArg) })
const dst = `public/img/${name}.webp`
await pipe.webp({ quality: 88, alphaQuality: 92 }).toFile(dst)
const m = await sharp(dst).metadata()
console.log(`✔ ${name}.webp  ${m.width}×${m.height}  ${Math.round((await sharp(dst).toBuffer()).length / 1024)} KB`)
console.log(`  배경 ${(100 - kept / N * 100).toFixed(0)}% 지움`)
