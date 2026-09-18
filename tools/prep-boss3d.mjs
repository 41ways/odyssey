/**
 * 보스의 몸을 받아 온 모델로 갈아 끼운다.
 *
 * 스테이지마다 따로 받아 오기로 했으니 (models.js 의 STAGE_MODELS) 한 판에
 * 실리는 무게만 맞으면 된다. 그래서 보스 하나에 1MB 안팎까지는 쓴다 —
 * 전부를 한 번에 내려받던 때의 예산(전체 1.3MB)이 아니다.
 *
 *   node tools/prep-boss3d.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'art/boss3d')
const OUT = path.join(ROOT, 'public/models')

/** 파일마다 텍스처 크기를 따로 준다 — 화면을 크게 차지하는 놈일수록 크게. */
const JOBS = [
  { src: 'siren.glb', out: 'siren.glb', tex: 1024 },
  { src: 'antiphates.glb', out: 'antiphates.glb', tex: 1024 },
]

for (const j of JOBS) {
  const from = path.join(SRC, j.src)
  if (!fs.existsSync(from)) { console.log(`– ${j.src} 없음`); continue }
  const to = path.join(OUT, j.out)
  execFileSync('npx', ['--yes', '@gltf-transform/cli', 'optimize', from, to,
    '--texture-size', String(j.tex), '--texture-compress', 'webp',
    '--compress', 'draco', '--simplify', 'false'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const a = fs.statSync(from).size, b = fs.statSync(to).size
  console.log(`✔ ${j.out}  ${(a / 1024 / 1024).toFixed(1)}MB → ${Math.round(b / 1024)} KB`)
}
