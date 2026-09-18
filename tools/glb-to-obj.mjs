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

// 발을 0 에 두고, 키를 센티미터로 맞춘다 (기본 170).
// Mixamo 는 OBJ 단위를 cm 로 읽는다. 키 2.83 그대로 올리면 2.8cm 짜리 인형이 되어
// 서버 리깅이 'Unknown error while generating motion' 으로 떨어졌다.
const minY = Math.min(...v.map(p => p[1]))
const H0 = Math.max(...v.map(p => p[1])) - minY
const K = Number(process.env.HEIGHT_CM ?? 170) / H0
for (const p of v) { p[0] *= K; p[1] = (p[1] - minY) * K; p[2] *= K }
const f3 = n => n.toFixed(5)
/* 같은 자리의 정점을 하나로 붙인다.
   glTF 는 UV 가 끊기는 자리마다 정점을 쪼개 둔다. 그걸 그대로 OBJ 로 옮기면
   몸이 서로 안 붙은 조각 수백 개가 되고, Mixamo 자동 리깅이
   'Unknown error while generating motion' 으로 떨어졌다. OBJ 는 위치와 UV 를
   따로 인덱싱할 수 있으니 위치만 합치고 UV 는 모서리마다 그대로 둔다. */
const key = p => p.map(x => Math.round(x * 1000)).join(',')
const weld = new Map(), vw = [], remap = []
for (const [i, p] of v.entries()) {
  const k = key(p)
  if (!weld.has(k)) { weld.set(k, vw.length + 1); vw.push(p) }
  remap[i + 1] = weld.get(k)
}
let obj = `mtllib ${name}.mtl\nusemtl skin\n`
for (const p of vw) obj += `v ${f3(p[0])} ${f3(p[1])} ${f3(p[2])}\n`
for (const t of vt) obj += `vt ${f3(t[0])} ${f3(t[1])}\n`
const hasT = vt.length === v.length
// 법선은 빼고 Mixamo 가 다시 계산하게 둔다 (붙인 정점에 쪼개진 법선을 달면 어긋난다)
for (const f of faces) {
  const a = remap[f[0]], b = remap[f[1]], c = remap[f[2]]
  if (a === b || b === c || a === c) continue       // 붙이다 찌그러진 면은 버린다
  obj += 'f ' + f.map((i, k) => `${[a, b, c][k]}${hasT ? '/' + i : ''}`).join(' ') + '\n'
}
console.log(`  붙이기: 정점 ${v.length} → ${vw.length}`)
fs.writeFileSync(path.join(outDir, `${name}.obj`), obj)

let mtl = 'newmtl skin\nKd 1 1 1\n'
if (texture) {
  await sharp(Buffer.from(texture.getImage())).png().toFile(path.join(outDir, `${name}.png`))
  mtl += `map_Kd ${name}.png\n`
}
fs.writeFileSync(path.join(outDir, `${name}.mtl`), mtl)
execSync(`cd "${outDir}" && rm -f ${name}.zip && zip -q ${name}.zip ${name}.obj ${name}.mtl ${texture ? name + '.png' : ''}`)
const h = Math.max(...v.map(p => p[1]))
console.log(`✔ ${name}.zip  정점 ${v.length} · 면 ${faces.length} · 키 ${h.toFixed(2)} · 텍스처 ${texture ? '있음' : '없음'}`)
