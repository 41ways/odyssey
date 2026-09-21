/**
 * 받아 온 동작을 게임이 쓸 이름으로 정리한다.
 *
 * Quaternius 묶음에는 활이 없고 칼은 한 종류뿐이다 (43 개가 칼·주먹·권총·마법).
 * gameasset.net 이 같은 CC0 로 만 개 넘게 푸니 거기서 모자란 것만 골라 온다.
 *
 * **한 파일로 합치지 않는다.** 묶으면 한 씬에 몸이 여러 벌 들어가고 뼈 이름이
 * 그대로 겹친다 (Hips 가 다섯 개). 이름으로 뼈를 찾는 retarget 이 클립마다
 * 남의 몸의 뼈를 잡는다. 한 파일에 한 몸씩 둔다.
 *
 *   node tools/prep-anims.mjs
 *     art/anim/*.glb  →  public/models/anim/<이름>.glb
 */
import { NodeIO } from '@gltf-transform/core'
import { dedup } from '@gltf-transform/functions'
import { readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'art/anim'
const OUT = 'public/models/anim'

/** 파일 번호 → 게임에서 부를 이름 */
const NAME = {
  '5713': 'Bow_Draw',      // 시위를 당겨 겨눈다
  '5733': 'Bow_Shoot',     // 놓는다
  '8908': 'Sword_A',       // 1 타 — 내려베기
  '8942': 'Sword_B',       // 2 타 — 호를 그리며
  '9029': 'Sword_C',       // 3 타 — 찌르기
}

mkdirSync(OUT, { recursive: true })
const io = new NodeIO()

for (const f of readdirSync(SRC).filter(f => f.endsWith('.glb')).sort()) {
  const want = NAME[f.split('_')[0]]
  if (!want) continue
  const doc = await io.read(join(SRC, f))
  const anims = doc.getRoot().listAnimations()
  if (!anims.length) { console.warn('동작 없음:', f); continue }
  anims[0].setName(want)
  for (const extra of anims.slice(1)) extra.dispose()
  await doc.transform(dedup())
  await io.write(join(OUT, `${want}.glb`), doc)
  console.log(f, '→', `${want}.glb`)
}
