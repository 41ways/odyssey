/**
 * 갈림길 그림 넷을 다듬는다 (stage/voyage.js 의 FATES[].art).
 *
 * 생성기에서 연속 다운로드가 막혀 브라우저 화면을 떠 왔다 — 캡처 가운데에
 * 16:9 로 앉아 있고 양옆이 검다. 검은 띠를 재서 잘라 내고, 오른쪽 아래
 * 생성기 표식(✦, 가로 91%)이 들어가지 않게 오른쪽을 11% 덜어 낸다.
 *
 *   node tools/prep-fates.mjs   (shots/fate-*.jpeg → public/img/fate-*.webp)
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SHOTS = path.join(ROOT, 'shots')
const latest = new Map()
for (const f of fs.readdirSync(SHOTS).filter(f => /^fate-[a-z]+-\d+\./.test(f)).sort()) {
  latest.set(f.replace(/-\d+\.\w+$/, ''), f)       // 같은 이름이면 마지막 것
}
for (const [name, f] of latest) {
  const src = path.join(SHOTS, f)
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true })
  // 가운데 줄에서 검지 않은 첫·끝 열을 찾는다
  const y = Math.floor(info.height / 2), ch = info.channels
  const dark = x => { const i = (y * info.width + x) * ch; return data[i] + data[i + 1] + data[i + 2] < 24 }
  let l = 0, r = info.width - 1
  while (l < r && dark(l)) l++
  while (r > l && dark(r)) r--
  const w = r - l + 1
  const box = { left: l + 2, top: 0, width: Math.round((w - 4) * 0.89), height: info.height - 6 }
  const out = path.join(ROOT, 'public/img', `${name}.webp`)
  const res = await sharp(src).extract(box).resize({ width: 1280 }).webp({ quality: 82 }).toFile(out)
  console.log(`✔ ${name}.webp  ${res.width}×${res.height}  ${Math.round(res.size / 1024)} KB  (띠 ${l}~${r})`)
}
