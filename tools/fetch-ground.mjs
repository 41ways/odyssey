/**
 * 스테이지 바닥 텍스처를 Poly Haven(CC0) 에서 받아 줄여 넣는다.
 *
 *   node tools/fetch-ground.mjs
 *
 * 원본 1k JPG 는 장당 1MB 씩 한다. 쿼터뷰에서 바닥은 타일링되어 깔리므로
 * 768 WebP 면 충분하다. 스테이지별로 필요할 때만 불러오므로 한 번에 한 장만 내려간다.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const OUT = path.resolve(import.meta.dirname, '../public/textures')

/** 스테이지 → Poly Haven 에셋 id. 전부 CC0. */
export const GROUND = {
  ismaros: 'burned_ground_01',        // 약탈당해 불탄 해안
  cyclops: 'cliff_side',              // 동굴 바위
  telepylos: 'coast_land_rocks_01',   // 절벽 항구
  aiaia: 'forest_ground_04',          // 마녀의 숲섬
  underworld: 'volcanic_rock_tiles',  // 저승의 검은 돌
  ship: 'dark_planks',                // 배 갑판 (세이렌·메시나 공용)
  ithaca: 'marble_01',                // 궁전 홀
  shore: 'coast_sand_04',             // 마지막 해변
}

const api = async url => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

fs.mkdirSync(OUT, { recursive: true })
const credits = []
let total = 0

for (const [key, id] of Object.entries(GROUND)) {
  const out = path.join(OUT, `${key}.webp`)
  const files = await api(`https://api.polyhaven.com/files/${id}`)
  const diffuse = files.Diffuse ?? files.diffuse
  const src = diffuse?.['1k']?.jpg?.url
  if (!src) { console.log(`✗ ${key}: ${id} 에 1k jpg 없음`); continue }

  const res = await fetch(src)
  const buf = Buffer.from(await res.arrayBuffer())
  // 768 · q62 면 쿼터뷰에서 눈에 띄는 손실 없이 대부분 120KB 아래로 떨어진다
  await sharp(buf).resize(768, 768, { fit: 'cover' }).webp({ quality: 62 }).toFile(out)

  const size = fs.statSync(out).size
  total += size
  credits.push(`- \`${key}.webp\` — "${id}" (Poly Haven, CC0) — https://polyhaven.com/a/${id}`)
  console.log(`✔ ${key.padEnd(12)} ${(buf.length / 1024).toFixed(0)} KB → ${(size / 1024).toFixed(0)} KB   (${id})`)
}

console.log(`\n합계 ${(total / 1024).toFixed(0)} KB — 스테이지마다 한 장씩만 내려간다`)
fs.writeFileSync(path.join(OUT, 'CREDITS.txt'), credits.join('\n') + '\n')
