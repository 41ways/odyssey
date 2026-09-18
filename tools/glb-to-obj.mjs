/**
 * GLB 를 OBJ+MTL+텍스처 zip 으로 푼다 — Mixamo 자동 리깅에 올리기 위해서다.
 *
 * Mixamo 는 glb 를 안 받는다. 받는 건 fbx·obj·zip 뿐인데, 이 기계에는
 * 블렌더도 FBX 도구도 없다. 리깅에는 모양과 UV 만 있으면 되므로 OBJ 로 간다.
 * 노드의 월드 변환을 정점에 구워 넣어야 Mixamo 에서 서 있는 자세로 보인다.
 *
 *   node tools/glb-to-obj.mjs public/models/antiphates.glb art/mixamo/antiphates
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const [src, outDir] = process.argv.slice(2)
const name = path.basename(outDir)
fs.mkdirSync(outDir, { recursive: true })

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
})
const doc = await io.read(src)
const root = doc.getRoot()

// 행렬 곱 (열 우선 4×4)
const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}

const v = [], vt = [], vn = [], faces = []
let texture = null
const walk = (node, parent) => {
  const m = mul(parent, node.getMatrix())
  const mesh = node.getMesh()
  if (mesh) for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0')
    const base = v.length
    for (let i = 0; i < P.getCount(); i++) {
      const [x, y, z] = P.getElement(i, [])
      v.push([m[0]*x + m[4]*y + m[8]*z + m[12], m[1]*x + m[5]*y + m[9]*z + m[13], m[2]*x + m[6]*y + m[10]*z + m[14]])
      if (N) { const [a, b, c] = N.getElement(i, []); vn.push([m[0]*a + m[4]*b + m[8]*c, m[1]*a + m[5]*b + m[9]*c, m[2]*a + m[6]*b + m[10]*c]) }
      if (T) { const [s, t] = T.getElement(i, []); vt.push([s, 1 - t]) }
    }
    const idx = prim.getIndices()
    const n = idx ? idx.getCount() : P.getCount()
    for (let i = 0; i < n; i += 3) {
      const f = [0, 1, 2].map(k => base + 1 + (idx ? idx.getScalar(i + k) : i + k))
      faces.push(f)
    }
    texture ??= prim.getMaterial()?.getBaseColorTexture()
  }
  for (const c of node.listChildren()) walk(c, m)
}
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
for (const scene of root.listScenes()) for (const n of scene.listChildren()) walk(n, I)

// 키를 재서 정규화할 필요는 없다 — Mixamo 가 알아서 맞춘다. 다만 발을 0 에 둔다.
const minY = Math.min(...v.map(p => p[1]))
const f3 = n => n.toFixed(5)
let obj = `mtllib ${name}.mtl\nusemtl skin\n`
for (const p of v) obj += `v ${f3(p[0])} ${f3(p[1] - minY)} ${f3(p[2])}\n`
for (const t of vt) obj += `vt ${f3(t[0])} ${f3(t[1])}\n`
for (const n of vn) obj += `vn ${f3(n[0])} ${f3(n[1])} ${f3(n[2])}\n`
const hasT = vt.length === v.length, hasN = vn.length === v.length
for (const f of faces) obj += 'f ' + f.map(i => `${i}/${hasT ? i : ''}/${hasN ? i : ''}`).join(' ') + '\n'
fs.writeFileSync(path.join(outDir, `${name}.obj`), obj)

let mtl = 'newmtl skin\nKd 1 1 1\n'
if (texture) {
  await sharp(Buffer.from(texture.getImage())).png().toFile(path.join(outDir, `${name}.png`))
  mtl += `map_Kd ${name}.png\n`
}
fs.writeFileSync(path.join(outDir, `${name}.mtl`), mtl)
execSync(`cd "${outDir}" && rm -f ${name}.zip && zip -q ${name}.zip ${name}.obj ${name}.mtl ${texture ? name + '.png' : ''}`)
const h = Math.max(...v.map(p => p[1])) - minY
console.log(`✔ ${name}.zip  정점 ${v.length} · 면 ${faces.length} · 키 ${h.toFixed(2)} · 텍스처 ${texture ? '있음' : '없음'}`)
