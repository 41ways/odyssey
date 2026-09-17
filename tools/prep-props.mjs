/**
 * art/props/ 의 CC0 모델을 게임에 쓸 크기로 줄여 public/models/ 로 보낸다.
 *
 * 받아 온 그대로는 1024 PNG 텍스처가 붙어 있어 나무 한 그루가 2.4MB 다.
 * 쿼터뷰에서 소품은 화면에 100px 남짓으로 나오므로 512 WebP 면 넘친다.
 *
 *   node tools/prep-props.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'art/props')
const OUT = path.join(ROOT, 'public/models')

/** 이름을 바꿔 내보내는 것들. 없으면 파일 이름 그대로 간다. */
const RENAME = {}
/** 손대지 않을 것 — 쓰지 않기로 한 후보 */
// pig-alt 는 걷기·뛰기 클립까지 있지만 각이 너무 져서 사람 모델과 따로 논다.
// 부드러운 쪽을 쓰고, 없는 달리기는 models.js 가 몸통을 흔들어 메운다.
const SKIP = new Set(['pig-alt'])

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.glb'))) {
  const base = f.replace(/\.glb$/, '')
  if (SKIP.has(base)) { console.log(`– ${f} 건너뜀`); continue }
  const out = path.join(OUT, `${RENAME[base] ?? base}.glb`)
  const before = fs.statSync(path.join(SRC, f)).size
  execFileSync('npx', ['--yes', '@gltf-transform/cli', 'optimize', path.join(SRC, f), out,
    '--texture-size', '512', '--texture-compress', 'webp',
    '--compress', 'draco', '--simplify', 'false'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const after = fs.statSync(out).size
  console.log(`✔ ${path.basename(out).padEnd(18)} ${(before / 1024).toFixed(0)} → ${(after / 1024).toFixed(0)} KB`)
}
