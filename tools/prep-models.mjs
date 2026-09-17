/**
 * art/ 의 원본 팩에서 게임에 쓸 것만 골라 public/models/ 로 내보낸다.
 *
 * 원본은 4K PNG 텍스처 때문에 파츠 하나가 30MB 씩 한다. 쿼터뷰에서 캐릭터가
 * 화면에 150px 남짓으로 나오므로 512 WebP 면 차고 넘친다. 실제로 305배 줄어든다.
 *
 *   node tools/prep-models.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { dedup, prune, resample } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'

const ROOT = path.resolve(import.meta.dirname, '..')
const EX = path.join(ROOT, 'art/ex')
const OUT = path.join(ROOT, 'public/models')

const BASE = path.join(EX, 'Universal Base Characters[Standard]/Base Characters/Godot - UE')
const PARTS = path.join(EX, 'Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts')
const ANIM = path.join(EX, 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')

/** 게임에서 쓸 클립만. 43개 중 이것만 남기면 7.4MB 가 확 줄어든다. */
const KEEP_CLIPS = [
  'Idle_Loop',        // 대기
  'Sword_Idle',       // 칼 든 대기
  'Jog_Fwd_Loop',     // 달리기
  'Sprint_Loop',      // 전력질주
  'Roll',             // 구르기
  'Sword_Attack',     // 칼 (3타는 속도·각도 변주로 만든다)
  'Pistol_Aim_Neutral', // 활 조준 자세로 전용
  'Pistol_Shoot',     // 활 발사
  'Hit_Chest',        // 피격
  'Death01',          // 사망
]

const JOBS = [
  { src: path.join(BASE, 'Superhero_Male_FullBody.gltf'), out: 'hero-body.glb' },
  { src: path.join(PARTS, 'Male_Peasant_Legs.gltf'), out: 'gear-legs.glb' },
  { src: path.join(PARTS, 'Male_Peasant_Feet.gltf'), out: 'gear-feet.glb' },
  { src: path.join(PARTS, 'Male_Peasant_Body.gltf'), out: 'gear-body.glb' },
  { src: path.join(PARTS, 'Male_Peasant_Arms.gltf'), out: 'gear-arms.glb' },
  { src: path.join(PARTS, 'Male_Ranger_Acc_Pauldron.gltf'), out: 'gear-pauldron.glb' },
]

/**
 * 원본 glTF 일부가 존재하지 않는 텍스처를 가리킨다 (T_Eye_Normal_png.png 처럼
 * 접미사가 하나 더 붙어 있다). 있는 파일로 고쳐 준 사본을 만들어 쓴다.
 */
function fixUris(src, tmpDir) {
  const doc = JSON.parse(fs.readFileSync(src, 'utf8'))
  const dir = path.dirname(src)
  let fixed = 0
  for (const img of doc.images ?? []) {
    if (!img.uri) continue
    const p = path.join(dir, decodeURIComponent(img.uri))
    if (fs.existsSync(p)) continue
    const alt = decodeURIComponent(img.uri).replace(/_png(\.\w+)$/, '$1')
    if (fs.existsSync(path.join(dir, alt))) { img.uri = encodeURI(alt); fixed++ }
    else { delete img.uri; img.uri = undefined }
  }
  if (!fixed) return src
  const tmp = path.join(tmpDir, path.basename(src))
  fs.writeFileSync(tmp, JSON.stringify(doc))
  // .bin 과 텍스처를 옆에 걸어 둔다
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.gltf')) continue
    const link = path.join(tmpDir, f)
    if (!fs.existsSync(link)) fs.symlinkSync(path.join(dir, f), link)
  }
  console.log(`  (텍스처 경로 ${fixed}건 고침)`)
  return tmp
}

function optimize(src, outFile) {
  const out = path.join(OUT, outFile)
  execFileSync('npx', ['--yes', '@gltf-transform/cli', 'optimize', src, out,
    '--texture-size', '512', '--texture-compress', 'webp',
    '--compress', 'draco', '--simplify', 'false'], { stdio: ['ignore', 'ignore', 'pipe'] })
  return fs.statSync(out).size
}

/** 애니메이션 파일에서 필요한 클립만 남기고 메시·재질은 전부 버린다. */
async function prepAnimations() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })
  const doc = await io.read(ANIM)
  const root = doc.getRoot()

  const before = root.listAnimations().length
  for (const a of root.listAnimations()) {
    if (KEEP_CLIPS.includes(a.getName())) continue
    // 애니메이션만 dispose 하면 채널·샘플러가 남아서 accessor 가 살아있게 된다.
    // 버린 클립 33개의 accessor 6천여 개가 파일에 그대로 실리는 원인이었다.
    for (const ch of a.listChannels()) ch.dispose()
    for (const sm of a.listSamplers()) sm.dispose()
    a.dispose()
  }
  // 뼈대만 있으면 된다. 메시가 붙어 있으면 그만큼 그냥 낭비다.
  for (const m of root.listMeshes()) m.dispose()
  for (const s of root.listSkins()) s.dispose()
  for (const m of root.listMaterials()) m.dispose()
  for (const t of root.listTextures()) t.dispose()
  for (const n of root.listNodes()) if (n.getMesh()) n.setMesh(null)

  // 스켈레탈 애니메이션에서 뼈의 scale 은 거의 안 쓰이고,
  // translation 도 루트·골반 말고는 의미가 없다 (길이가 변하면 안 되니까).
  // 이 둘을 걷어내면 용량의 대부분이 사라진다. 세 채널 중 회전 하나만 남는 셈.
  const MOVABLE = new Set(['root', 'pelvis'])
  let dropped = 0
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      const p = ch.getTargetPath()
      const bone = ch.getTargetNode()?.getName() ?? ''
      const keep = p === 'rotation' || (p === 'translation' && MOVABLE.has(bone))
      if (!keep) { ch.dispose(); dropped++ }
    }
    for (const sm of anim.listSamplers()) {
      if (!anim.listChannels().some(c => c.getSampler() === sm)) sm.dispose()
    }
  }

  // 클립을 지우는 것만으로는 버퍼가 안 줄어든다. 고아가 된 accessor 를 실제로 걷어내야 한다.
  // resample 은 값이 그대로인 연속 키프레임을 접어서 용량을 크게 줄인다.
  await doc.transform(
    resample({ tolerance: 1e-3 }),
    dedup(),
    prune({ keepAttributes: false, keepLeaves: false, propertyTypes: [PropertyType.ACCESSOR, PropertyType.BUFFER, PropertyType.MESH, PropertyType.MATERIAL, PropertyType.TEXTURE, PropertyType.NODE, PropertyType.SKIN, PropertyType.ANIMATION] }),
  )
  console.log(`  (채널 ${dropped}개 제거 — scale 전부, translation 은 root·pelvis 만 남김)`)

  const out = path.join(OUT, 'anims.glb')
  await io.write(out, doc)
  const kept = root.listAnimations().map(a => a.getName())
  return { before, kept, size: fs.statSync(out).size }
}

const kb = n => `${(n / 1024).toFixed(0)} KB`

fs.mkdirSync(OUT, { recursive: true })
const tmpDir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'odyssey-'))

let total = 0
for (const job of JOBS) {
  if (!fs.existsSync(job.src)) { console.log(`✗ 원본 없음: ${job.src}`); continue }
  const srcSize = fs.statSync(job.src).size
  const src = fixUris(job.src, tmpDir)
  const size = optimize(src, job.out)
  total += size
  console.log(`✔ ${job.out.padEnd(20)} ${kb(size)}`)
}

const anim = await prepAnimations()
total += anim.size
console.log(`✔ ${'anims.glb'.padEnd(20)} ${kb(anim.size)}  (클립 ${anim.before} → ${anim.kept.length})`)
console.log(`\n합계 ${kb(total)}`)
console.log(`남긴 클립: ${anim.kept.join(', ')}`)
