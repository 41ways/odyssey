/**
 * 초상 잘라내기.
 *
 *   node tools/cut-portrait.mjs art/agamemnon.png agamemnon 0.14 0.05 0.72 0.56
 *                                원본            이름      x    y    h    w  (비율)
 *
 * 흰 배경을 밝기로 걷어낸다. 인물이 어두우면 이 방법이 가장 깔끔하다 —
 * 밝을수록 투명하게, 경계는 부드럽게 넘긴다.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [src, name, sx = 0.14, sy = 0.05, sh = 0.72, sw = 0.56] = process.argv.slice(2)
const OUT = path.resolve(import.meta.dirname, '../public/img')
fs.mkdirSync(OUT, { recursive: true })

const img = sharp(src)
const meta = await img.metadata()
const left = Math.round(meta.width * Number(sx))
const top = Math.round(meta.height * Number(sy))
const width = Math.round(meta.width * Number(sw))
const height = Math.round(meta.height * Number(sh))

const { data, info } = await sharp(src)
  .extract({ left, top, width, height })
  .resize({ width: 560, withoutEnlargement: true })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

// 밝기 200 아래는 그대로, 246 위는 완전히 투명. 그 사이는 부드럽게.
const LO = 200, HI = 246
let cut = 0
for (let i = 0; i < data.length; i += 4) {
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  if (lum <= LO) continue
  const a = lum >= HI ? 0 : 1 - (lum - LO) / (HI - LO)
  data[i + 3] = Math.round(data[i + 3] * a)
  if (a === 0) cut++
}

const out = path.join(OUT, `${name}.webp`)
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .webp({ quality: 88, alphaQuality: 90 })
  .toFile(out)

const size = fs.statSync(out).size
console.log(`✔ ${path.basename(out)}  ${info.width}×${info.height}  ${(size / 1024).toFixed(0)} KB`)
console.log(`  (원본 ${meta.width}×${meta.height} 에서 잘라내고 흰 배경 ${(cut / (info.width * info.height) * 100).toFixed(0)}% 제거)`)
