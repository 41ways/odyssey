# 출처

## 3D 모델

- **Universal Base Characters** — Quaternius, https://quaternius.com/packs/universalbasecharacters.html — **CC0**
- **Universal Animation Library** — Quaternius, https://quaternius.com/packs/universalanimationlibrary.html — **CC0**
- **Modular Character Outfits – Fantasy** — Quaternius, https://quaternius.com/packs/modularcharacteroutfitsfantasy.html — **CC0**

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
