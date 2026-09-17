# 원본 에셋

받아 온 모델 원본을 여기 둔다. **git 에는 안 올라간다** (용량 때문).
여기 있는 원본을 줄여서 `public/models/` 로 내보낸다.

```bash
npx @gltf-transform/cli optimize art/원본.glb public/models/이름.glb \
  --simplify-error 0.001 --texture-size 512 --texture-compress webp
```

내보낸 뒤에는 반드시 `CREDITS.md` 에 원작자와 라이선스를 적는다.
