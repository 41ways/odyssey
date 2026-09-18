/**
 * 스킬라의 몸.
 *
 * 받아 온 것은 '물에서 솟은 촉수 여덟 + 물판' 한 벌이다 (Sketchfab,
 * Yanez Designs, CC-BY — CREDITS.md). 우리는 절벽에서 내려오는 머리 여섯이
 * 필요하므로 물판을 버리고 촉수 둘을 덜어 낸다.
 *
 * 코드로 만든 촉수를 사람 뼈대에 매달던 것을 이걸로 갈아 끼운다 —
 * 마디를 겹쳐 흔드는 것과, 처음부터 촉수로 만들어진 것은 실루엣이 다르다.
 *
 *   node tools/prep-skylla.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'art/boss3d/skylla.glb')
const TMP = path.join(ROOT, 'art/boss3d/_skylla-trim.glb')
const OUT = path.join(ROOT, 'public/models/skylla.glb')

/** 스킬라는 머리가 여섯이다. 남는 촉수는 버린다. */
const KEEP = 6

const io = new NodeIO()
const doc = await io.read(SRC)
const root = doc.getRoot()

let dropped = 0
for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const name = mesh.getName()
  // 물판은 우리 바다가 따로 있으니 필요 없다
  const isWater = /water/i.test(name)
  // Tentacle007, 008 은 덜어 낸다
  const n = Number(name.match(/Tentacle0*(\d+)/)?.[1] ?? 0)
  if (isWater || (n && n > KEEP)) {
    node.setMesh(null)
    mesh.dispose()
    dropped++
  }
}
console.log(`  메시 ${dropped}개 버림 (물판 + 남는 촉수)`)

await io.write(TMP, doc)
execFileSync('npx', ['--yes', '@gltf-transform/cli', 'optimize', TMP, OUT,
  '--texture-size', '512', '--texture-compress', 'webp',
  '--compress', 'draco', '--simplify', 'false'], { stdio: ['ignore', 'ignore', 'pipe'] })
fs.unlinkSync(TMP)

const before = fs.statSync(SRC).size, after = fs.statSync(OUT).size
console.log(`✔ skylla.glb  ${(before / 1024 / 1024).toFixed(1)}MB → ${Math.round(after / 1024)} KB`)
