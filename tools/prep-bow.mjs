/**
 * 활시위 컷신 그림 네 장을 다듬는다.
 *
 * 1 장은 생성기에서 원본(1376×768)으로 받았고, 2~4 장은 다운로드가 막혀서
 * 브라우저 화면을 떠 왔다 — 1568×660 캡처 안에 그림이 가운데 16:9 로
 * 앉아 있고 양옆이 검다. 그 검은 띠와 오른쪽 아래 생성기 표식(✦)을 잘라 낸다.
 *
 *   node tools/prep-bow.mjs <1장.png> <2장> <3장> <4장>
 */
import sharp from 'sharp'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const files = process.argv.slice(2)
for (const [i, f] of files.entries()) {
  const img = sharp(f)
  const { width: W, height: H } = await img.metadata()
  // 그림이 차지한 칸: 캡처면 가운데 16:9, 원본이면 전체
  let box = { left: 0, top: 0, width: W, height: H }
  if (W / H > 2) {
    const w = Math.round(H * 1376 / 768)
    box = { left: Math.round((W - w) / 2) + 2, top: 0, width: w - 4, height: H - 8 }
  }
  // 표식(✦)은 가로 91% · 세로 85% 자리에 있다. 세로로 자르면 4 장의 발이
  // 잘리므로 오른쪽만 11% 덜어 낸다 (컷신이 어차피 당겨 쓴다)
  box.width = Math.round(box.width * 0.89)
  const out = path.join(ROOT, `public/img/cut-bow-${i + 1}.webp`)
  const info = await sharp(f).extract(box).resize({ width: 1280 }).webp({ quality: 82 }).toFile(out)
  console.log(`✔ cut-bow-${i + 1}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`)
}
