/**
 * 키르케 몸 — Quaternius Ultimate Modular Women Pack 의 Witch.gltf 를
 * 게임이 쓰는 이름으로 정리한다.
 *
 * 이 몸은 오디세우스(hero)와 뼈 이름이 다른 완전히 다른 뼈대다 — 그래서
 * retarget 을 안 쓴다. 대신 이 파일이 원래 들고 있는 클립 이름을
 * character.js 의 CLIP 상수와 같은 이름으로 바꿔치기한다. 그러면
 * character.js 쪽은 코드를 안 건드리고, `ownClips: true` 로 표시된 벌은
 * 자기 클립을 그대로 쓰게만 하면 된다.
 *
 *   node tools/prep-circe.mjs
 *     art/gen/circe-src.gltf  →  public/models/circe-body.glb
 */
import { NodeIO } from '@gltf-transform/core'
import { dedup, prune } from '@gltf-transform/functions'

const SRC = 'art/gen/circe-src.gltf'
const OUT = 'public/models/circe-body.glb'

/** 원본 클립 이름 → character.js 가 찾는 이름. 없는 건 버린다. */
const RENAME = {
  Idle: 'Sword_Idle',
  Run: 'Jog_Fwd_Loop',
  Sword_Slash: 'Sword_Attack',
  Roll: 'Roll',
  HitRecieve: 'Hit_Chest',
  Death: 'Death01',
}

const io = new NodeIO()
const doc = await io.read(SRC)
const root = doc.getRoot()

const anims = root.listAnimations()
console.log('원본 클립:', anims.map(a => a.getName()).join(', '))

let sprintSrc = null
for (const a of anims) {
  const name = a.getName()
  const want = RENAME[name]
  if (want) {
    a.setName(want)
    if (name === 'Run') sprintSrc = a   // 뛰기 전용 클립이 없어서 걷기를 복제해 쓴다
  } else {
    a.dispose()
  }
}

// Sprint_Loop 이 없다 — Jog_Fwd_Loop(옛 Run) 을 복제해 이름만 바꾼다.
// pose() 가 달리기 속도에 맞춰 재생 속도를 올리므로 몸짓은 그대로 빨라져 보인다.
if (sprintSrc) {
  const clone = doc.createAnimation('Sprint_Loop')
  for (const ch of sprintSrc.listChannels()) {
    const sampler = ch.getSampler()
    const newSampler = doc.createAnimationSampler()
      .setInput(sampler.getInput()).setOutput(sampler.getOutput()).setInterpolation(sampler.getInterpolation())
    clone.addSampler(newSampler)
    clone.addChannel(doc.createAnimationChannel().setTargetNode(ch.getTargetNode()).setTargetPath(ch.getTargetPath()).setSampler(newSampler))
  }
}

console.log('남긴 클립:', root.listAnimations().map(a => a.getName()).join(', '))

await doc.transform(prune(), dedup())
await io.write(OUT, doc)
console.log('→', OUT)
