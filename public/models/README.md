# 모델 넣는 곳

`.glb` 파일을 이 폴더에 아래 이름으로 넣으면 **자동으로 잡아 쓴다.**
없으면 코드로 만든 인체(`src/render/figure.js`)로 돌아가므로, 하나도 없어도 게임은 돌아간다.

| 파일 이름 | 쓰이는 곳 | 기준 키 |
|---|---|---|
| `odysseus.glb` | 플레이어 | 1.82 m |
| `kikones-warrior.glb` | 키코네스 전사 | 1.78 m |
| `kikones-archer.glb` | 키코네스 궁수 | 1.74 m |
| `cyclops.glb` | 폴리페모스 | 5.2 m |
| `sheep.glb` | 던져지는 양 | 0.95 m |

크기는 **자동으로 맞춰진다.** 모델이 몇 미터로 만들어졌든 위 기준 키에 맞게 스케일되고,
발이 바닥(y=0)에 놓이고 중심이 원점으로 옮겨진다. 정면이 +Z 가 아니면
`src/render/models.js` 의 `MANIFEST` 에 `rotationY` 를 적어 준다.

애니메이션 클립 이름은 느슨하게 맞춘다 — `idle` / `run`·`walk` / `attack`·`swing` /
`aim`·`draw` / `roll`·`dodge` / `die` 가 이름에 들어 있으면 알아서 찾는다.

## 폴리곤 예산

웹에서 한 화면에 적이 대여섯 마리 뜨므로 **캐릭터당 1.5만 삼각형 이하**로 맞춘다.
그보다 무거우면 줄여서 넣는다.

```bash
npx @gltf-transform/cli optimize 원본.glb 결과.glb --simplify-error 0.001 --texture-size 1024
```

## 출처 표기

받아 온 모델은 반드시 `CREDITS.md` 에 라이선스와 원작자를 적는다.
CC Attribution 은 표기가 **의무**다.
