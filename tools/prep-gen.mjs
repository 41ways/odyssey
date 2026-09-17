/**
 * 받아 온 GLB 하나를 게임 예산에 맞게 깎는다.
 *
 * 텍스트→3D 나 스케치팹에서 받은 모델은 1~2K 텍스처가 붙어 나와서 한 장에
 * 수 MB 를 넘는다. 쿼터뷰에서 보스도 화면에 200px 남짓이라 512 면 남는다.
 *
 * 스케치팹 모델은 구식 확장(pbrSpecularGlossiness)을 쓰는 일이 있어서
 * 전체 확장을 등록하고 metalRough 로 바꿔 둔다 — three 가 읽는 건 이쪽이다.
 *
 *   node tools/prep-gen.mjs <입력.glb> <출력.glb> [--tex 512] [--simplify 0.2]
 *
 * --simplify 는 삼각형 비율. 스킨(뼈대)이 있는 모델은 건너뛴다 — 웨이트가 깨진다.
 */
import fs from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { dedup, prune, weld, simplify, textureCompress, metalRough, resample } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'

const args = process.argv.slice(2)
const [src, dst] = args
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const TEX = +opt('--tex', 512)
const SIMP = +opt('--simplify', 0)
if (!src || !dst) { console.error('사용: node tools/prep-gen.mjs <입력.glb> <출력.glb> [--tex 512] [--simplify 0.2]'); process.exit(1) }

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  })

const doc = await io.read(src)
const root = doc.getRoot()
const skinned = root.listSkins().length > 0
const before = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0)

const steps = [metalRough(), dedup(), prune(), weld()]
if (SIMP > 0 && !skinned) {
  await MeshoptSimplifier.ready
  steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: SIMP, error: 0.001 }))
} else if (SIMP > 0) {
  console.log('  스킨이 있어 simplify 는 건너뛴다 (웨이트 보호)')
}
if (root.listAnimations().length) steps.push(resample())
steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 82 }))
await doc.transform(...steps)

doc.createExtension(KHRDracoMeshCompression).setRequired(true)
  .setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER })
await io.write(dst, doc)

const after = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0)
const a = fs.statSync(src).size, b = fs.statSync(dst).size
console.log(`${src}\n  ${(a/1024)|0}KB → ${(b/1024)|0}KB (${(a/b).toFixed(1)}배) · 삼각형 ${Math.round(before).toLocaleString()} → ${Math.round(after).toLocaleString()} · 스킨 ${root.listSkins().length} · 애니 ${root.listAnimations().length}`)
