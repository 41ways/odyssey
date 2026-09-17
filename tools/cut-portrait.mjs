/**
 * 초상 잘라내기.
 *
 *   node tools/cut-portrait.mjs art/agamemnon.png agamemnon 0 0.045 0.66 1.0
 *                                원본            이름      x  y     h    w  (비율)
 *
 * 흰 배경 위의 그림은 알파만 깎으면 밝은 테두리가 남는다.
 * 경계 픽셀은 인물색과 흰색이 섞인 값이라, 반투명으로 만들어도 색이 여전히 희기 때문이다.
 * 그래서 세 단계를 거친다.
 *   1) 밝기로 알파를 뽑고
 *   2) 흰 배경분을 역산해 원래 색을 되살리고 (decontaminate)
 *   3) 알파를 한 겹 깎고 부드럽게 흐려 경계를 녹인다
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [src, name, sx = 0, sy = 0.045, sh = 0.66, sw = 1.0,
       optLo = 168, optHi = 248, optFeather = ''] = process.argv.slice(2)
const OUT = path.resolve(import.meta.dirname, '../public/img')
fs.mkdirSync(OUT, { recursive: true })

const meta = await sharp(src).metadata()
const left = Math.round(meta.width * Number(sx))
const top = Math.round(meta.height * Number(sy))
const width = Math.round(meta.width * Number(sw))
const height = Math.round(meta.height * Number(sh))

const { data, info } = await sharp(src)
  .extract({ left, top, width, height })
  .resize({ width: Number(process.env.OUT_W ?? 640), withoutEnlargement: true })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const W = info.width, H = info.height
const N = W * H

// 이미 투명한 그림은 배경을 지울 필요가 없다 — 있는 알파를 그대로 쓴다
let hasAlpha = false
for (let i = 3; i < data.length; i += 4) { if (data[i] < 250) { hasAlpha = true; break } }

/**
 * '투명' 체커보드가 픽셀로 구워져 나온 그림이 있다.
 * 격자는 채도가 0 인 회색 두 가지뿐이라, 밝고 무채색인 곳만 걷어내면 된다.
 * 인물의 흰 천은 아주 살짝이라도 색이 돌아서 살아남는다.
 */
const isChecker = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const sat = mx === 0 ? 0 : (mx - mn) / mx
  return sat < 0.045 && mx > 185
}
let checkerMode = false
if (!hasAlpha) {
  let hits = 0, tot = 0
  for (let i = 0; i < N; i += 7) {                    // 듬성듬성 세어 본다
    const o = i * 4
    tot++
    if (isChecker(data[o], data[o + 1], data[o + 2])) hits++
  }
  // 배경이 순백이면 흰 배경 처리로 충분하다. 격자는 회색이 섞여 비율이 다르게 나온다.
  let greyish = 0
  for (let i = 0; i < N; i += 7) {
    const o = i * 4
    const mx = Math.max(data[o], data[o + 1], data[o + 2])
    if (isChecker(data[o], data[o + 1], data[o + 2]) && mx < 240) greyish++
  }
  checkerMode = hits / tot > 0.2 && greyish / Math.max(hits, 1) > 0.25
  if (checkerMode) console.log('  (투명 격자가 픽셀로 구워진 그림 — 무채색 밝은 곳을 걷어낸다)')
}

/* 1) 밝기 → 알파 */
const alpha = new Float32Array(N)
// 밝은 받침대까지 살려야 하는 그림은 문턱을 올려 잡는다
const LO = Number(optLo), HI = Number(optHi)
for (let i = 0; i < N; i++) {
  const o = i * 4
  if (hasAlpha) { alpha[i] = data[o + 3] / 255; continue }
  if (checkerMode) { alpha[i] = isChecker(data[o], data[o + 1], data[o + 2]) ? 0 : 1; continue }
  const lum = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  alpha[i] = lum <= LO ? 1 : lum >= HI ? 0 : 1 - (lum - LO) / (HI - LO)
}

/* 2) 흰 배경분 역산 — 관측색 = 인물색*a + 흰색*(1-a) 이므로 인물색을 되돌린다 */
for (let i = 0; i < N; i++) {
  if (hasAlpha || checkerMode) break
  const a = alpha[i]
  if (a <= 0.004 || a >= 0.996) continue
  const o = i * 4
  for (let c = 0; c < 3; c++) {
    const v = (data[o + c] - 255 * (1 - a)) / a
    data[o + c] = Math.max(0, Math.min(255, Math.round(v)))
  }
}

/* 3) 알파를 한 겹 깎고 (erode) 3x3 으로 흐려 경계를 녹인다 */
const eroded = new Float32Array(N)
const ERODE = hasAlpha ? 0.04 : checkerMode ? 0.5 : 0.28
for (let i = 0; i < N; i++) eroded[i] = Math.max(0, (alpha[i] - ERODE) / (1 - ERODE))

const soft = new Float32Array(N)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let sum = 0, n = 0
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy
      if (yy < 0 || yy >= H) continue
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx
        if (xx < 0 || xx >= W) continue
        sum += eroded[yy * W + xx]; n++
      }
    }
    soft[y * W + x] = sum / n
  }
}
/* 4) 가장자리를 녹인다 — 잘린 자리가 직선으로 보이면 안 된다.
      아래는 넓게(치마 아래를 통째로 날린다), 좌우·위는 얇게(손과 볏은 살린다) */
// 망토가 화면 밖으로 이어지는 쪽은 넓게 녹여야 잘린 자리가 안 보인다
const FEATHER = optFeather
  ? Object.fromEntries(optFeather.split(',').map((v, i) => [['bottom', 'side', 'top'][i], Number(v)]))
  : { bottom: 0.24, side: 0.11, top: 0.05 }
const fade = (v) => v * v * (3 - 2 * v)      // smoothstep
for (let y = 0; y < H; y++) {
  const fb = Math.min(1, (H - 1 - y) / (H * FEATHER.bottom))
  const ft = Math.min(1, y / (H * FEATHER.top))
  for (let x = 0; x < W; x++) {
    const fs = Math.min(1, Math.min(x, W - 1 - x) / (W * FEATHER.side))
    const f = fade(fb) * fade(ft) * fade(fs)
    data[(y * W + x) * 4 + 3] = Math.round(soft[y * W + x] * f * 255)
  }
}

const out = path.join(OUT, `${name}.webp`)
await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .webp({ quality: 90, alphaQuality: 95 })
  .toFile(out)

const cut = alpha.reduce((n, a) => n + (a < 0.02 ? 1 : 0), 0)
console.log(`✔ ${path.basename(out)}  ${W}×${H}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`)
console.log(`  배경 ${(cut / N * 100).toFixed(0)}% 제거 · 경계 색 역산 + 한 겹 깎고 흐림`)
