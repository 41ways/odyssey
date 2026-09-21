/**
 * Sketchfab 'Agamemnon's Helmet' (Quesho, CC-BY) 을 게임용으로 줄인다.
 *
 * 원본(art/helmet-src.glb, 30MB, 삼각형 52만)의 대부분은 말총 볏의 낱개
 * 털(Braid·BraidDetail·BraidEnd·Hair 여섯 장)과 목뼈(Vertebrae) 메시다 —
 * 실제로 쓰는 건 투구 몸통 둘(Helmet·Helmet2)뿐이고, 다 같은 재질 하나를
 * 쓴다. 그 둘만 남기고 gltf-transform 으로 512 WebP + draco 까지 줄인다.
 *
 *   node tools/prep-helmet.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..')
const SRC = path.join(ROOT, 'art/helmet-src.glb')
const MID = path.join(ROOT, 'art/helmet-mid.glb')
const OUT = path.join(ROOT, 'public/models/helmet.glb')

const KEEP = new Set(['Helmet__0', 'Helmet2__0'])

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
})
const doc = await io.read(SRC)
const root = doc.getRoot()

// 볏 털·목뼈 노드를 지운다. 부모 그룹(Braid·Hair 등, 메시 없는 빈 노드)도
// 자식이 없어지면 prune() 이 같이 걷어낸다.
for (const mesh of root.listMeshes()) {
  if (!KEEP.has(mesh.getName())) mesh.dispose()
}
await doc.transform(prune(), dedup())
await io.write(MID, doc)

// 원본은 조각가가 손으로 판 88,656 삼각형 — 게임에서는 100px 남짓으로
// 나오는 소품이라 그 디테일이 안 보인다. 5% 로 줄여도(≈4,400 삼각형)
// 화면에서는 그대로다. 그보다 낮추면 볼(cheek) 곡면이 각지기 시작한다.
execFileSync('npx', ['--yes', '@gltf-transform/cli', 'optimize', MID, OUT,
  '--texture-size', '512', '--texture-compress', 'webp',
  '--compress', 'draco', '--simplify', 'true', '--simplify-ratio', '0.05', '--simplify-error', '0.003'],
  { stdio: 'inherit' })

console.log(`✔ ${path.relative(ROOT, OUT)}`)
