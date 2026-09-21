/**
 * 받아 온 동작들을 한 파일로 묶는다.
 *
 * 애니메이션 묶음(Quaternius UAL)에는 활 동작이 없다 — 43 개를 다 뒤져도
 * 칼·주먹·권총·마법뿐이라 활은 권총 조준을 빌려 쓰고 있었고, 칼 3 타는
 * 같은 클립 하나를 속도만 바꿔 세 번 틀고 있었다.
 *
 * gameasset.net 이 같은 CC0 로 10,783 개를 푼다. 거기서 활 둘과 칼 셋을
 * 골라 왔다. 뼈 이름이 우리 것과 다르므로(Mixamo 계열: Hips/Spine1/LeftArm…)
 * 게임 안에서 retarget.js 가 옮긴다 — 여기서는 **살덩이를 버리고 뼈와 동작만**
 * 한 파일로 합친다. 다섯 파일이 각각 107KB 인데 대부분이 안 쓰는 메시다.
 *
 *   node tools/prep-anims.mjs
 *     art/anim/*.glb  →  public/models/anim-extra.glb
 */
import { NodeIO } from '@gltf-transform/core'
import { dedup, mergeDocuments } from '@gltf-transform/functions'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'art/anim'
const OUT = 'public/models/anim-extra.glb'

/** 파일 이름 → 게임에서 부를 이름. 번호와 문장은 여기서 떨어뜨린다. */
const NAME = {
  '5713': 'Bow_Draw',      // 시위를 당겨 겨눈다
  '5733': 'Bow_Shoot',     // 놓는다
  '8908': 'Sword_A',       // 1 타 — 내려베기
  '8942': 'Sword_B',       // 2 타 — 호를 그리며
  '9029': 'Sword_C',       // 3 타 — 찌르기
}

const io = new NodeIO()
const files = readdirSync(SRC).filter(f => f.endsWith('.glb')).sort()

let base = null
for (const f of files) {
  const id = f.split('_')[0]
  const want = NAME[id]
  if (!want) continue

  const doc = await io.read(join(SRC, f))
  const anims = doc.getRoot().listAnimations()
  if (!anims.length) { console.warn('동작 없음:', f); continue }
  anims[0].setName(want)
  for (const extra of anims.slice(1)) extra.dispose()

  if (!base) { base = doc; console.log('바탕:', f, '→', want); continue }

  // 같은 뼈대라 동작만 옮겨 붙인다
  await mergeDocuments(base, doc)
  console.log('보탬:', f, '→', want)
}

if (!base) { console.error('가져올 것이 없다'); process.exit(1) }

/* 메시를 지우고 싶지만 그러면 스킨이 고아가 되어 prune 이 같이 지운다.
   retarget 은 **바인드 포즈**(skeleton.boneInverses)를 읽어야 하므로 스킨이
   반드시 남아야 한다 — 없으면 노드에 저장된 자세를 쓰게 되고, 그 자세가
   T 자가 아니면 옮긴 동작이 통째로 뒤틀린다. 살덩이째 둔다.
   어차피 용량의 대부분은 메시가 아니라 동작 트랙이다. */
/* 합치면 파일마다 버퍼가 하나씩 생기는데 GLB 는 버퍼 하나만 받는다.
   남은 것을 첫 버퍼로 모은다. */
const root = base.getRoot()
const buffers = root.listBuffers()
const keep = buffers[0]
for (const acc of root.listAccessors()) acc.setBuffer(keep)
for (const b of buffers.slice(1)) b.dispose()
/* prune 은 쓰지 않는다 — 합친 문서에서는 스킨이 씬에 안 달린 것으로 보여
   통째로 지워진다. 스킨이 사라지면 retarget 이 바인드 포즈를 못 읽는다. */
await base.transform(dedup())

await io.write(OUT, base)
const names = base.getRoot().listAnimations().map(a => a.getName())
console.log('\n담긴 동작:', names.join(', '))
console.log('나온 곳:', OUT)
