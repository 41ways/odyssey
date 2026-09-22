# 출처

## 3D 모델

- **Universal Base Characters** — Quaternius, https://quaternius.com/packs/universalbasecharacters.html — **CC0**
- **Universal Animation Library** — Quaternius, https://quaternius.com/packs/universalanimationlibrary.html — **CC0**
- **Modular Character Outfits – Fantasy** — Quaternius, https://quaternius.com/packs/modularcharacteroutfitsfantasy.html — **CC0**
- **Ultimate Modular Women Pack** (Witch) — Quaternius, https://quaternius.com/packs/ultimatemodularwomen.html — **CC0**
  키르케의 몸. `tools/prep-circe.mjs` 가 클립 이름만 게임 것에 맞게 바꾼다
  (뼈대가 달라 hero 클립을 못 빌려 쓴다 — 제 클립을 그대로 쓴다).

## 동작 (애니메이션)

- **Universal Animation Library** (위) — 걷기·달리기·칼·구르기·죽기 43 종
- **gameasset.net** — https://anim.gameasset.net/ — **CC0**
  묶음에 **없는 것만** 골라 왔다. 활 둘(`Bow_Draw`·`Bow_Shoot`)과 칼 셋
  (`Sword_A/B/C` — 3 타가 세 번 같은 동작이던 것을 타마다 다르게).
  받아서 이름만 정리하는 건 `tools/prep-anims.mjs`.

  뼈 이름이 Mixamo 계열이라 게임 안에서 우리 뼈대로 옮긴다. **팔만** 옮긴다 —
  몸통·골반은 쉬는 자세가 직각으로 달라서 옮기면 몸이 눕거나 접힌다
  ([#6](https://github.com/41ways/odyssey/issues/6)). 자세한 경위는
  `render/character.js` 의 EXTRA 주석.

CC0 는 출처 표기가 의무가 아니지만 적어 둔다. 어디서 왔는지 모르는 에셋이 쌓이는 게 제일 위험하다.

원본 zip 은 `art/` 에 있고 git 에는 안 올라간다.
게임에 실리는 건 거기서 골라 최적화한 `public/models/` 의 파일들뿐이다.

## 바닥 텍스처

전부 **Poly Haven · CC0**. `node tools/fetch-ground.mjs` 로 다시 받는다.
원본은 장당 1MB 안팎인데 768 WebP 로 줄여 넣는다 (합계 601 KB, 스테이지마다 한 장씩만 내려간다).

- `ismaros.webp` — "burned_ground_01" (Poly Haven, CC0) — https://polyhaven.com/a/burned_ground_01
- `cyclops.webp` — "cliff_side" (Poly Haven, CC0) — https://polyhaven.com/a/cliff_side
- `telepylos.webp` — "coast_land_rocks_01" (Poly Haven, CC0) — https://polyhaven.com/a/coast_land_rocks_01
- `aiaia.webp` — "forest_ground_04" (Poly Haven, CC0) — https://polyhaven.com/a/forest_ground_04
- `underworld.webp` — "volcanic_rock_tiles" (Poly Haven, CC0) — https://polyhaven.com/a/volcanic_rock_tiles
- `ship.webp` — "dark_planks" (Poly Haven, CC0) — https://polyhaven.com/a/dark_planks
- `ithaca.webp` — "marble_01" (Poly Haven, CC0) — https://polyhaven.com/a/marble_01
- `shore.webp` — "coast_sand_04" (Poly Haven, CC0) — https://polyhaven.com/a/coast_sand_04

## 새 에셋을 넣을 때

```
- <파일명> — "<모델 이름>" by <작성자> (<링크>), <라이선스>
```

CC Attribution(CC BY)은 표기가 **의무**다. 표기 없이 쓰면 라이선스 위반이다.
Sketchfab "Free Standard" 는 표기 의무는 없지만 모델 단독 재배포가 금지다.

## 스케치팹 (CC-BY 4.0)

| 모델 | 작가 | 쓰는 곳 | 출처 |
|---|---|---|---|
| Cyclops Rig | DM-913 | 폴리페모스 | https://sketchfab.com/3d-models/cyclops-rig-e5cc86878c314f5bae6d7268bb7541d9 |
| Yamata no Orochi | tran95 | ~~스킬라~~ **지금은 안 쓴다** (아래 참고) | https://sketchfab.com/3d-models/yamata-no-orochi-8f4c0e2c632e401eb5c5381acc3ce789 |
| Agamemnon's Helmet | Quesho | 오디세우스의 투구 (킬 15 해금) | https://sketchfab.com/3d-models/agamemnons-helmet-538a010347644530a56a20a511313f9a |

> 오로치는 스킬라의 몸이었다가 빠졌다. 정적 메시라 목이 안 움직였고
> (내려찍는 보스인데 몸이 안 움직이면 언제 때릴지를 못 읽는다), 머리가
> 여덟이라 '여섯 머리의 것' 과 안 맞았다. 지금은 애니메이션이 붙은
> 촉수 여섯으로 몸을 짠다 (아래 Quaternius). 파일은 지우지 않고 남겨 둔다 —
> 움직이는 뱀이 필요해지면 다시 볼 자리다.

CC-BY 는 작가 표기가 조건이다. 배포 시 이 표를 크레딧 화면에도 싣는다.

## threejsassets.com (무료 티어 — 상업 이용 가능, 표기 불요)

| 모델 | 쓰는 곳 |
|---|---|
| Fjord Cliff Rock | 스킬라 절벽 · 동굴 바위 |

## Higgsfield (생성)

| 모델 | 도구 | 쓰는 곳 |
|---|---|---|
| serpent-head | tripo_3d (텍스트→3D) | 스킬라 코드 촉수 끝 (오로치 모델이 없을 때의 대체) |
| agamemnon-hand | nano_banana_pro | 저승 손 연출 |

## Quaternius (CC0) — poly.pizza 경유

| 모델 | 쓰는 곳 | 출처 |
|---|---|---|
| Tentacle | **스킬라의 여섯 머리**(돌색) · **카리브디스의 여섯 팔**(살색) | https://poly.pizza/m/BR1vpIvvvv |
| Giant | **안티파테스** — Attack·Idle·Run·Walk·HitRecieve·Death 7 클립 | https://poly.pizza/search/ogre |
| Viking Boat | **항해하는 배** — 네모 돛 하나에 노를 젓는 낮은 배 (호메로스의 검은 배 대역) | https://poly.pizza/m/J7SCPiNoSy |
| Sheep | **폴리페모스의 양** — 그의 우리에 사는 것들. 부딪히면 운다 (`enemy/sheep.js`) | https://poly.pizza/m/C39AUXUUes |
| Rock Large | **저승 벽** — 층진 바위를 쌓아 미로를 세운다 | https://poly.pizza/m/54jZKTAt5p |
| Bushes · Flower Bushes · Grass | **키르케의 숲 바닥** — 나무는 판 가장자리라 싸우는 화면에 안 들어온다 | https://poly.pizza/m/J2h3HrO356 · https://poly.pizza/m/1X06RgvSr6 · https://poly.pizza/m/UGTOzcO3P2 |

한 파일이 두 보스의 몸을 다 맡는다. 뼈대 15 마디에 Attack · Idle 클립이
붙어 있어서, 전에 코드로 만들던 원통 마디와 달리 **때리는 순간과 거둬들이는
순간이 다르게 보인다.** 스킬라의 파훼가 '회복 구간을 노리기' 인 이상
그게 규칙의 절반이다. 색만 갈라 쓴다 — 돌(#7d8288)과 살(#4a7fa8).

CC0 라 표기 의무는 없지만 적어 둔다. 어디서 왔는지 모르는 파일이
저장소에 있는 게 더 나쁘다.

## ambientCG (CC0)

판 바닥의 노멀맵·거칠기맵 여덟 벌. 목록은 `public/textures/CREDITS.txt`.

## 스케치팹 (CC-BY 4.0) — 그 밖의 것

위 표(51행)에 없는 나머지. **게임 안 일시정지 메뉴의 '출처' 화면에도
같이 적는다** — CREDITS.md 에 적는 것만으로는 표기 조건을 못 채운다,
읽는 사람이 이 파일을 안 보니까 (`src/ui/menu.js` 의 `CC_BY`).

- **스킬라의 촉수** — *Kraken (Animation)* by **Yanez Designs** (Sketchfab, CC-BY 4.0)
  https://sketchfab.com/3d-models/kraken-animation-3f2e84dffa9742f8a894143a4dfa7d73
  물판과 촉수 둘을 덜어 내고 512 WebP + draco 로 줄여 씀 (`tools/prep-skylla.mjs`).
- **세이렌** — *Mermaid* by **Danny Dugas** (Sketchfab, CC-BY 4.0)
  https://sketchfab.com/3d-models/mermaid-6145894382fa4c4588c9d4bc1997e07c
  헤엄치는 자세로 누워 있어 세워 쓴다. 1024 WebP + draco (642KB).

- **안티파테스** — *Fire-Branded Ogre* by **ribtibs** (Sketchfab, CC-BY 4.0)
  https://sketchfab.com/3d-models/fire-branded-ogre-39cbab6fbaf14ccc87444e06695a1a35
  5.8k 삼각형. 1024 WebP + draco (86KB). **왕 자신의 몸**이다 (5.2m 로 키워 씀).
  뼈가 없는 정적 조각이라 오디세우스의 뼈대를 입히고 클립을 빌린다
  (render/autoskin.js). 라이스트리고네스 잡졸(작게·잿빛)도 같은 파일.

  > 헷갈리기 쉬운 게 하나 있다 — 안티파테스가 **부르는 부름꾼**은 이 파일이
  > 아니라 *84행의 Quaternius Giant(CC0)* 다. 왕은 청동을 두른 이 CC-BY
  > 오우거, 부름꾼은 맨몸의 CC0 거인 — 서로 다른 몸이라 한눈에 누가 지키는
  > 자인지 갈린다. `src/enemy/bosses.js` 에 한동안 이 둘을 헷갈린 주석이
  > 달려 있었다 (고쳤다).

## Game-icons.net (CC BY 3.0)

유물·성장·장비 카드의 문장(紋章) 아이콘. 손으로 그린 선 그림이던 걸
실제 아이콘 세트로 바꿨다(2026-09-22). CC-BY 3.0 — 4.0 아니다,
일시정지 메뉴의 '출처' 화면에도 `lic: '3.0'` 으로 따로 적어 둔다.
https://game-icons.net

- **Lorc** — 창(spear-hook), 날개 발(winged-leg), 흉갑(breastplate),
  바람(windy-stripes), 부엉이(owl), 가면(drama-masks — 이름·아무도
  아니다 둘 다), 눈(eyeball — 저주·눈 둘 다), 잔(chalice-drops)
- **Delapouite** — 투구(spartan-helmet), 팔가리개(bracer),
  망토(cape), 화살(bow-arrow)
- **Skoll** — 견갑(pauldrons), 칼(gladius)
- **sbed** — 방패(shield)

받는 자리: `https://game-icons.net/icons/ffffff/transparent/1x1/<작가>/<이름>.svg`
(흰색·투명 배경). `viewBox="0 0 512 512"` 그대로 두고 `fill` 만
판마다 쓰는 금색(`#c8973e`/`#e8c98a`)으로 바꿔 쓴다 — 스케일은
`.icon svg { width:100%; height:100% }` 가 알아서 한다.
