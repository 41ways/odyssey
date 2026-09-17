/**
 * 막간 배경 그림을 public/img/ 로 넣는다.
 *
 * 생성기가 오른쪽 아래에 표식(✦)을 박아 놓는다. 화면에서는 글자 뒤로
 * 그대로 보이므로 그 귀퉁이를 잘라 낸다 — 지우는 게 아니라 화면 밖으로 민다.
 * 막간은 어차피 cover 로 깔고 천천히 밀어 쓰기 때문에 조금 잘려도 티가 안 난다.
 *
 *   node tools/prep-ludes.mjs
 */
import sharp from 'sharp'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

/**
 * art/ 의 원본 → public/img/ 의 이름. 이름은 '떠나는 판' 기준이다.
 * -b, -c 는 글줄이 넘어갈 때 갈아 끼우는 다음 장이다. 한 장으로 세 줄을
 * 다 받으면 읽는 동안 화면이 멈춰 있고, 갈아 끼우면 배가 가고 있는 게 된다.
 */
const MAP = {
  'troy-burning': 'lude-opening',            // 오프닝 — 트로이가 불탔다
  'troy-burning-b': 'lude-opening-b',        //   열두 척으로 떠났다
  'troy-burning-c': 'lude-opening-c',        //   바다가 스무 해를 붙들었다
  'sailingstorm': 'lude-ismaros',            // 이스마로스 → 텔레필로스
  'sailingstorm-b': 'lude-ismaros-b',        //   저을수록 뭍이 멀어졌다
  'circe': 'lude-telepylos',                 // 텔레필로스 → 아이아이에섬
  'circe-b': 'lude-telepylos-b',             //   좁은 만을 빠져나왔다
  'sailingindark': 'lude-aiaia',             // 아이아이에섬 → 저승
  'sailingindark-b': 'lude-aiaia-b',         //   해가 들지 않는 곳
  'leaving-underworld': 'lude-underworld',   // 저승 → 세이렌의 바다
  'leaving-underworld-b': 'lude-underworld-b', // 다시 빛 속으로
  'scyllacharybdis': 'lude-sirens',          // 세이렌의 바다 → 메시나 해협
  'scyllacharybdis-b': 'lude-sirens-b',      //   물이 돌아가기 시작한다
  'landfall-ithaca': 'lude-messina',         // 메시나 해협 → 이타카
  'landfall-ithaca-b': 'lude-messina-b',     //   뭍에 닿았다
  'hall-after': 'lude-ithaca',               // 이타카 → 죽음
  'hall-after-b': 'lude-ithaca-b',           //   그런데도 끝나지 않았다
}

/** 오른쪽 11%, 아래 14% 를 버린다. 표식이 그 안에 들어간다. */
const CUT_RIGHT = 0.11
const CUT_BOTTOM = 0.14

for (const [src, out] of Object.entries(MAP)) {
  const file = path.join(ROOT, 'art', `${src}.png`)
  const img = sharp(file)
  const { width, height } = await img.metadata()
  const info = await img
    .extract({
      left: 0, top: 0,
      width: Math.round(width * (1 - CUT_RIGHT)),
      height: Math.round(height * (1 - CUT_BOTTOM)),
    })
    .resize({ width: 1408 })
    .webp({ quality: 82 })
    .toFile(path.join(ROOT, 'public/img', `${out}.webp`))
  console.log(`✔ ${out}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`)
}
