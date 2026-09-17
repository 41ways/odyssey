/**
 * 보스 초상을 등장 연출 카드용으로 줄여 public/img/boss/ 로 보낸다.
 *
 * 투명 배경으로 뽑지 않는다 — 생성기가 투명을 격자 그림으로 구워 버리기도 하고,
 * 어차피 카드 안에서는 가장자리를 CSS 로 흐리게 지우는 편이 더 낫다.
 * 여기서는 생성기 표식(오른쪽 아래 ✦)이 들어간 귀퉁이만 잘라 낸다.
 *
 *   node tools/prep-bosses.mjs
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'art/boss')
const OUT = path.join(ROOT, 'public/img/boss')

const CUT_RIGHT = 0.11
const CUT_BOTTOM = 0.12

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(SRC).filter(f => /\.(png|jpe?g)$/i.test(f))) {
  const name = f.replace(/\.\w+$/, '')
  const img = sharp(path.join(SRC, f))
  const { width, height } = await img.metadata()
  const info = await img
    .extract({
      left: 0, top: 0,
      width: Math.round(width * (1 - CUT_RIGHT)),
      height: Math.round(height * (1 - CUT_BOTTOM)),
    })
    .resize({ width: 760 })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, `${name}.webp`))
  console.log(`✔ boss/${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`)
}
