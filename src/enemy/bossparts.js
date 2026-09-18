import * as THREE from 'three'
import { models } from '../render/models.js'
import { makeVortex } from '../render/vortex.js'

/**
 * 보스의 몸.
 *
 * 보스 여덟이 전부 같은 사람 몸에 키·부피·색조만 달랐다. 그래서 외눈박이는
 * 눈이 없고, 여섯 머리는 머리가 하나였다. 이름이 곧 파훼법인 보스들인데
 * 이름이 몸에 안 보이면 "눈을 쏴라" 가 글자로만 존재한다.
 *
 * 다만 GLTF 를 따로 받아 오지는 않는다. 이 게임의 전부가 gzip 1.3MB 고,
 * 보스마다 몸을 한 벌씩 받으면 그 예산이 통째로 날아간다. 대신 **공용 뼈대에
 * 코드로 만든 조각을 매단다** — 무기·투구를 본에 매단 것과 같은 방식이다.
 * 애니메이션이 돌면 조각도 따라 돌고, 용량은 0 이다.
 *
 * 그리고 조각은 장식이 아니라 **지금 무슨 일이 벌어지는지**를 말해야 한다.
 *   · 폴리페모스의 눈은 쏴야 하는 과녁이고, 멀면 감긴다
 *   · 스킬라의 머리는 1페에 여섯, 2페에 하나다 (패턴이 그렇게 생겼다)
 *   · 카리브디스의 눈은 빨아들이는 동안 열린다
 */

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.62, metalness: 0.05, ...o,
})

/**
 * 촉수 하나.
 *
 * 마디를 여러 개 겹쳐 만든다. 마디마다 조금씩 돌리면 통짜 원뿔이 아니라
 * 휘어지는 팔이 된다. 흔들 때 마디마다 **위상을 늦추는** 게 핵심이다 —
 * 같이 흔들면 막대기가 흔들리는 것이고, 늦춰야 채찍처럼 물결친다.
 *
 * @param o.segs  마디 수
 * @param o.len   마디 하나 길이
 * @param o.r0/r1 뿌리/끝 반지름
 * @param o.curl  기본으로 말려 있는 정도 (라디안/마디)
 */
function tentacle({ segs = 6, len = 0.42, r0 = 0.15, r1 = 0.03, curl = 0.16, material, sides = 8 }) {
  const root = new THREE.Group()
  const joints = []
  let prev = root
  for (let k = 0; k < segs; k++) {
    const j = new THREE.Group()
    j.position.y = k === 0 ? 0 : len
    j.rotation.x = curl
    const t = k / (segs - 1)
    const ra = r0 + (r1 - r0) * t
    const rb = r0 + (r1 - r0) * Math.min(1, t + 1 / (segs - 1))
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, len, sides), material)
    tube.position.y = len * 0.5
    j.add(tube)
    prev.add(j)
    prev = j
    joints.push(j)
  }
  return { root, joints, tip: prev, segs, curl }
}

/** 촉수를 물결치게 한다. 마디마다 위상을 늦춘다. */
function waveTentacle(t, tt, { speed = 2.2, amp = 0.12, lag = 0.55, phase = 0, curl = null }) {
  tt.joints.forEach((j, k) => {
    j.rotation.x = (curl ?? tt.curl) + Math.sin(t * speed + phase + k * lag) * amp
    j.rotation.z = Math.cos(t * speed * 0.78 + phase + k * lag * 0.7) * amp * 0.7
  })
}

/* ── 폴리페모스 — 외눈 ─────────────────────────────────────
   이마 한가운데 눈 하나. 쓰러졌을 때 화살로 찌르는 과녁이 이것이다.
   그래서 어두운 동굴에서도 읽히게 스스로 빛난다. */
function cyclopsEye(rig) {
  const g = new THREE.Group()

  // 눈두덩 — 눈만 있으면 공처럼 떠 보인다. 뼈가 둘러싸야 얼굴이 된다.
  // 반구를 씌우면 머리에 모자를 얹은 꼴이 되므로, 눈 위에 걸치는 두덩만 만든다.
  const brow = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.052, 8, 20, Math.PI * 1.15),
    mat('#a8815f', { roughness: 0.92 }),
  )
  brow.rotation.z = -Math.PI * 0.075
  brow.position.set(0, 0.015, 0.02)
  brow.scale.set(1.18, 0.9, 1)
  g.add(brow)

  const white = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), mat('#e8dcc4', {
    roughness: 0.34, emissive: '#3a2a18', emissiveIntensity: 0.35,
  }))
  g.add(white)

  // 홍채와 동공은 한 축에 묶어 **위-앞으로 틀어 둔다.**
  // 카메라가 40도 위에서 내려다보는 쿼터뷰라, 정면을 보게 달면 위에서는
  // 흰자만 보이고 눈이 아니라 알처럼 읽힌다.
  const look = new THREE.Group()
  look.rotation.x = -0.62
  g.add(look)

  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.104, 18, 14), new THREE.MeshStandardMaterial({
    color: '#d8a03a', roughness: 0.22, emissive: '#c07818', emissiveIntensity: 1.5,
  }))
  iris.position.z = 0.086
  iris.scale.z = 0.52
  look.add(iris)

  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), new THREE.MeshBasicMaterial({ color: '#140a06' }))
  pupil.position.z = 0.125
  pupil.scale.z = 0.5
  look.add(pupil)

  // 눈꺼풀. 눈알과 같은 중심에서 **경첩처럼 돌아** 앞을 덮는다.
  // 위에서 내려오게 만들면 평소에 머리 위에 큰 돔이 떠 있어서 모자처럼 보인다 —
  // 실제로 처음에 그렇게 나왔다. 돌리면 평소엔 눈알 뒤에 숨는다.
  const lidPivot = new THREE.Group()
  const lid = new THREE.Mesh(
    new THREE.SphereGeometry(0.168, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mat('#9a734f', { roughness: 0.94 }),
  )
  lid.rotation.x = Math.PI * 0.5      // 반구가 +z(앞)를 덮는 방향
  lidPivot.add(lid)
  lidPivot.rotation.x = -2.5          // 평소엔 뒤로 젖혀 눈알 뒤에 숨는다
  g.add(lidPivot)

  const mount = rig.attachTo('Head', g, { scale: 1, position: [0, 0.1, 0.17] })
  return {
    group: g, mount, lidPivot, iris, pupil, white,
    blind: 0,
    update(dt, s) {
      // 눈이 멀면 눈꺼풀이 돌아 내려오고 빛이 죽는다
      const want = s.blinded ? 1 : 0
      this.blind += (want - this.blind) * Math.min(1, dt * 3)
      this.lidPivot.rotation.x = -2.5 + this.blind * 2.5
      this.iris.material.emissiveIntensity = 1.5 * (1 - this.blind) + 0.1
      this.iris.material.color.setHex(this.blind > 0.5 ? 0x7a2418 : 0xd8a03a)
      // 쓰러져 있는 동안은 과녁이다. 뛰게 해서 여기를 쏘라고 말한다.
      const beat = s.downed ? 1 + Math.sin(s.t * 7) * 0.12 : 1
      this.group.scale.setScalar(beat)

      // 그리고 얼굴을 든다.
      //
      // 무너지면 상체가 앞으로 엎어져서 이마가 바닥을 본다. 그런데 이마에
      // 달린 눈이 곧 쏴야 하는 과녁이다 — 바닥을 보고 있으면 화살이 닿을
      // 각이 없다. 쓰러진 동안만 눈을 위로 들어 앞을 보게 한다.
      // (짐승이 무릎 꿇고도 고개는 쳐드는 그림이라 어색하지도 않다.)
      this.lift ??= 0
      this.lift += ((s.downed ? 1 : 0) - this.lift) * Math.min(1, dt * 3)
      if (this.mount) {
        this.mount.rotation.x = -this.lift * 0.95
        // 자리도 키를 탄다. mount 의 position 은 스케일 이전 좌표라 배수를 곱한다.
        const k = this.scale ?? 1
        this.mount.position.z = (0.17 + this.lift * 0.1) * k
        this.mount.position.y = (0.1 + this.lift * 0.06) * k
      }
    },
  }
}

/* ── 스킬라 — 절벽에서 뻗는 돌 크라켄 ──────────────────────
   스킬라는 배 위에 올라타는 짐승이 아니라 **절벽 그 자체**다.
   바위벽에서 돌로 된 목 여섯이 뻗어 나와 갑판을 친다. 그래서 몸이 없다 —
   사람 뼈대는 감춰 두고(look.hideBody) 촉수만 남긴다.

   돌이라는 게 재질로만 읽히면 안 된다. 움직임도 돌이어야 한다 —
   물결치는 진폭을 살로 된 것의 절반쯤으로 줄이고, 마디 수를 적게 잡아
   관절이 뚝뚝 꺾이게 한다. 매끄럽게 휘면 그냥 초록 뱀이 회색이 된 것뿐이다. */
/**
 * 스킬라 — 돌 뱀 여섯. 각자 따로 움직이고 각자 문다.
 *
 * ── 두 번 틀린 자리다 ──
 * 1차: 원통 마디를 이어 만든 관 여섯. 돌로도 살로도 안 보이고 제 동작이
 *      없어서, 내려찍는 순간과 물러나는 순간이 같은 모양이었다.
 * 2차: 받아 온 촉수 여섯을 한 점에서 부챗살로 뻗었다. 움직이긴 했는데
 *      **한 마리 오징어의 팔로 읽혔다** — 여섯이 한 곳에서 나와 같은
 *      동작을 같은 박자로 하니 당연했다. 절벽도 안 보였다.
 *
 * 3차(지금): **메두사의 머리처럼** 짠다. 뱀 여섯이 각각
 *   · 제 자리에 따로 심겨 있고 (벽면을 따라 벌어져, 높이도 제각각)
 *   · 제 시간으로 움직이고 (mixer 시간을 어긋나게 준다)
 *   · 제 속도로 고개를 돌리고 (플레이어를 따라보는 속도가 머리마다 다르다)
 *   · 제 차례에 혼자 문다 (striking 인 머리만 Attack)
 *
 * 마지막 셋이 핵심이다. 여섯이 같은 박자로 같은 방향을 보면 아무리 따로
 * 떼어 놔도 한 마리가 된다. **어긋남이 여섯 마리를 만든다.**
 *
 * 모델은 뼈 열다섯의 돌 뱀 (Quaternius, CC0 · CREDITS.md). Body·Neck·Head·
 * Tail·Mouth·Tongue 가 따로 있어서 한 마리가 제 몸으로 움직인다.
 * 없으면 옛 원통으로 돌아간다 — 파일 하나 없다고 보스가 안 나오면 안 된다.
 */
function skyllaWall(rig) {
  const root = new THREE.Group()
  const stone = mat('#7d8288', { roughness: 0.97, metalness: 0.02, flatShading: true })
  const crack = new THREE.MeshStandardMaterial({
    color: '#3a4450', emissive: '#2a6a5a', emissiveIntensity: 0.9, roughness: 0.8,
  })

  const arms = []
  /**
   * 벽면을 따라 벌어진 자리.
   *
   * 간격을 고르게 두지 않는다 — 고르게 두면 늘어선 기둥처럼 보이고,
   * 들쭉날쭉해야 벽 여기저기서 따로 난 것이 된다.
   *
   * **좌표가 두 배로 먹힌다.** attachBossParts 가 mount 에
   * look.height / 1.8 (= 3.6/1.8 = 2) 을 곱하기 때문이다. 처음에 ±6.6 으로
   * 뒀다가 실측해 보니 여섯이 월드 x −13 ~ +13 에 섰다 — 반지름 16 인
   * 투기장의 가장자리 밖이라 화면에 아무것도 안 보였다. 그래서 원하는
   * 월드 값의 **절반**을 적는다.
   *
   * y 도 같다. spine_03 에 매달리므로 뼈 높이만큼 기본 offset 이 있다
   * (실측 2.4). 바닥에 앉히려면 음수로 내려야 한다.
   */
  const SPOT = [
    { x: -3.3, y: -1.15, z: 0.30, turn: 1.7 },
    { x: -2.0, y: -0.95, z: -0.10, turn: 2.6 },
    { x: -0.7, y: -1.20, z: 0.45, turn: 2.1 },
    { x: 0.9, y: -1.00, z: 0.05, turn: 3.0 },
    { x: 2.2, y: -1.15, z: 0.35, turn: 1.9 },
    { x: 3.4, y: -0.90, z: -0.15, turn: 2.4 },
  ]

  for (let i = 0; i < 6; i++) {
    const spot = SPOT[i]
    const arm = new THREE.Group()
    const head = new THREE.Group()          // 고개를 돌리는 축
    const made = models.create('snake')
    let tt = null

    if (made) {
      for (const m of made.mats) {
        m.color?.set?.('#8a8f95'); m.roughness = 0.95; m.metalness = 0.04
      }
      /**
       * 몸을 세운다.
       *
       * 모델은 기어가는 자세다 (1.08 × 1.49 × 4.34 — z 로 길고 낮다).
       * 그대로 두면 쿼터뷰에서 위에서 내려보므로 길이가 안 보이고 납작한
       * 덩어리로 읽힌다. 실제로 그렇게 나왔다.
       *
       * 세워야 '고개를 든 뱀' 이 된다. Head 뼈의 월드 높이를 재서 골랐다 —
       * 0 이면 1.62, −0.8 이면 2.27 이다. 플레이어가 1.8 이니 −0.8 이면
       * 머리가 사람 키를 넘어 내려다보는 높이가 된다.
       * 머리마다 조금씩 달리 줘서 여섯이 같은 각도로 안 서게 한다.
       */
      made.root.rotation.x = -0.7 - (i % 3) * 0.12
      head.add(made.root)
      /**
       * 제 시간으로 움직이게 한다.
       *
       * 여섯이 같은 클립을 0 초부터 같이 틀면 여섯이 한 몸처럼 흔들린다.
       * mixer 를 미리 제각각 돌려 놓으면 그 뒤로는 영원히 어긋난 채 간다 —
       * 한 줄로 여섯 마리가 된다.
       */
      made.pose({ run: 0, attack: false, draw: null, roll: 0 }, 1 / 60)
      made.mixer?.update(i * 0.9 + Math.random() * 0.6)
    } else {
      tt = tentacle({ segs: 5, len: 0.46, r0: 0.19, r1: 0.055, curl: 0.2, material: stone, sides: 6 })
      head.add(tt.root)
    }

    // 갈라진 틈에서 새는 빛 — 살아 있는 돌이라는 표시
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), crack)
    glow.position.set(0, 0.35, 0.1)
    head.add(glow)

    arm.add(head)
    arm.position.set(spot.x, spot.y, spot.z)
    root.add(arm)
    arms.push({
      arm, head, tt, made, glow,
      spot, turn: spot.turn, facing: 0,
      phase: i * 1.3, alive: 1, striking: false,
    })
  }

  const mount = rig.attachTo('spine_03', root, { scale: 1, position: [0, 0.1, -0.1] })
  return {
    group: root, mount, arms, necks: arms,     // necks 는 옛 이름 호환
    /**
     * @param s.severed  끊긴 머리 수 — 끊긴 만큼 사라진다
     * @param s.striking 지금 무는 머리 번호(1..6) 또는 0
     * @param s.aimX/aimZ 플레이어 자리. 머리마다 다른 속도로 이쪽을 본다
     */
    update(dt, s) {
      const gone = s.severed ?? (s.phase >= 1 ? 3 : 0)
      const keep = Math.max(1, 6 - gone)
      for (let i = 0; i < this.arms.length; i++) {
        const a = this.arms[i]
        const want = i < keep ? 1 : 0
        a.alive += (want - a.alive) * Math.min(1, dt * 2.2)
        a.arm.scale.setScalar(Math.max(0.001, a.alive))
        a.arm.visible = a.alive > 0.02

        // 고개를 돌린다. 속도가 머리마다 달라서 여섯이 제각각 늦거나 빠르다.
        // 이 한 줄이 '따로 움직인다' 의 절반이다.
        const want2 = Math.atan2((s.aimX ?? 0) - a.spot.x, (s.aimZ ?? 0) - a.spot.z)
        let d = want2 - a.facing
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        a.facing += d * Math.min(1, dt * a.turn)
        a.head.rotation.y = a.facing

        if (a.made) {
          // 제 차례에만 문다. 나머지는 제 시간으로 흔들린다.
          const hit = s.striking === i + 1
          if (hit !== a.striking) {
            a.made.pose({ run: 0, attack: hit, draw: null, roll: 0 }, dt)
            a.striking = hit
          }
          a.made.mixer?.update(dt)
        } else {
          waveTentacle(s.t, a.tt, { speed: 1.5, amp: 0.06, lag: 0.5, phase: a.phase })
        }
        a.glow.material.emissiveIntensity = 0.7 + Math.sin(s.t * 3 + a.phase) * 0.35
      }
    },
  }
}

/* ── 카리브디스 — 소용돌이 속 크라켄 ──────────────────────
   움직이지 않는다 (speed 0). 소용돌이 그 자체이고, 그 안에서 팔이 올라온다.
   스킬라가 돌이라면 이쪽은 물이다 — 같은 촉수라도 훨씬 길고 낭창거리며,
   반투명하게 젖어 있다.

   가운데 눈은 빨아들이는 동안 열린다 (suck 의 eye 판정). 그때가 치는 때고,
   그 신호가 몸에 보여야 한다. */
function charybdisVortex(rig) {
  const root = new THREE.Group()

  const flesh = new THREE.MeshStandardMaterial({
    color: '#4a7fa8', roughness: 0.42, metalness: 0.06,
    transparent: true, opacity: 0.93,
    emissive: '#18455f', emissiveIntensity: 0.45,
  })

  /**
   * 소용돌이.
   *
   * 고리를 다섯 겹 쌓아 서로 반대로 돌렸었다. 고리가 도는 건 보이는데
   * 물이 빨려 드는 건 안 보였다 — 빨려 드는 물은 층이 아니라 **안쪽이
   * 더 빨리 도는 한 장의 면**이다. 그래서 면 하나에 각도를 반지름으로
   * 나눠 흘리는 셰이더로 갈았다. `render/vortex.js`.
   */
  const vortex = makeVortex({
    // 판을 덮은 수면에 뚫린 구멍(stage/maelstrom.js)에 정확히 들어앉는 크기
    radius: 3.9, depth: 2.6, throat: 0.5,
    base: 0.8, edgeFade: 0.96, throatFade: 0.14, order: 7,
  })
  root.add(vortex.group)

  /**
   * 팔 여섯. 소용돌이 가장자리에서 올라와 안쪽으로 굽는다.
   *
   * 깔때기와 물살 고리와 눈은 코드가 맞다 — 소용돌이는 받아 올 수 있는
   * 메시가 아니고, 저 셋은 모양이 아니라 **움직임**이다. 그런데 팔은
   * 모양이라서, 원통 마디를 이어 붙인 것과 진짜 촉수가 확연히 다르다.
   * 그래서 팔만 받아 온 모델로 간다 (스킬라와 같은 파일을 돌려 쓴다).
   *   Quaternius (CC0), poly.pizza 경유 · CREDITS.md
   *
   * 모델이 없으면 원통으로 돌아간다.
   */
  const arms = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    const holder = new THREE.Group()
    const made = models.create('tentacle')
    let tt = null
    if (made) {
      // 촉수는 +z 로 뻗는다. 바깥에서 안쪽-위로 굽게 세운다.
      made.root.rotation.x = -0.55
      // 살색으로 칠한다. 돌인 스킬라와 같은 파일이라 색으로 갈라야 한다.
      for (const m of made.mats) {
        m.color?.set?.('#4a7fa8'); m.roughness = 0.45; m.metalness = 0.05
      }
      holder.add(made.root)
    } else {
      tt = tentacle({ segs: 8, len: 0.44, r0: 0.17, r1: 0.025, curl: 0.19, material: flesh, sides: 8 })
      for (let k = 1; k < tt.joints.length; k += 2) {
        const cup = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), new THREE.MeshStandardMaterial({
          color: '#cfe4f2', roughness: 0.35, side: THREE.DoubleSide,
        }))
        cup.position.set(0, 0.2, 0.1 - k * 0.008)
        cup.rotation.x = -0.4
        tt.joints[k].add(cup)
      }
      holder.add(tt.root)
    }
    holder.position.set(Math.sin(a) * 1.9, -0.3, Math.cos(a) * 1.9)
    holder.rotation.y = a
    if (!made) holder.rotation.x = -0.42
    root.add(holder)
    arms.push({ holder, tt, made, phase: i * 1.05, a })
  }

  // 가운데 눈. 깔때기 바닥에서 올려다본다.
  const eye = new THREE.Group()
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 18), mat('#dfe8f0', { roughness: 0.2 }))
  eye.add(ball)
  const look = new THREE.Group()
  look.rotation.x = -0.75          // 쿼터뷰 카메라 쪽을 본다
  eye.add(look)
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), new THREE.MeshStandardMaterial({
    color: '#4aa8ff', roughness: 0.14, emissive: '#2a80e0', emissiveIntensity: 1.8,
  }))
  iris.position.z = 0.26; iris.scale.z = 0.5
  look.add(iris)
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), new THREE.MeshBasicMaterial({ color: '#04121e' }))
  pupil.position.z = 0.37; pupil.scale.z = 0.5
  look.add(pupil)
  // 눈꺼풀 — 경첩식. 평소엔 눈알 뒤에 숨는다.
  const lidPivot = new THREE.Group()
  const lid = new THREE.Mesh(
    new THREE.SphereGeometry(0.455, 22, 15, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mat('#28506a', { roughness: 0.88 }),
  )
  lid.rotation.x = Math.PI * 0.5
  lidPivot.add(lid)
  lidPivot.rotation.x = -2.5
  eye.add(lidPivot)
  // 목구멍 안에 잠겨 있다. 올려다보는 눈이라야 '빨려 드는 구멍' 이 된다.
  eye.position.y = -0.55
  root.add(eye)

  const mount = rig.attachToBody(root, { position: [0, 0, 0], scale: 1 })
  return {
    group: root, mount, vortex, arms, iris, lidPivot,
    open: 0,
    update(dt, s) {
      const fast = s.phase >= 1 ? 1.7 : 1

      // 팔은 길고 낭창거린다. 빨아들일 때 안쪽으로 오므린다.
      const want = s.sucking ? 1 : 0.12
      this.open += (want - this.open) * Math.min(1, dt * 5)
      // 소용돌이도 같은 값으로 연다 — 빨아들일 때 깊어지고 빨라진다
      this.vortex.update(dt * fast, this.open)
      for (const a of this.arms) {
        if (a.made) {
          // 빨아들이는 동안만 Attack. 그때가 이 보스의 위험 구간이고,
          // 팔이 그 순간에만 크게 움직여야 '지금 빨아들인다' 가 읽힌다.
          a.made.pose({ run: 0, attack: s.sucking, draw: null, roll: 0 }, dt)
          // 오므리는 만큼 안쪽으로 기울인다 — 모델은 굽지 않으니 축을 돌린다
          a.holder.rotation.x = -0.55 - this.open * 0.35
          a.made.mixer?.update(dt)
        } else {
          waveTentacle(s.t, a.tt, {
            speed: 1.9 * fast, amp: 0.1, lag: 0.48, phase: a.phase,
            curl: 0.19 + this.open * 0.14,
          })
        }
      }

      // 빨아들이는 동안 눈이 열린다 — 여기가 치라는 신호다
      this.lidPivot.rotation.x = -2.5 + (1 - this.open) * 2.5
      this.iris.material.emissiveIntensity = 0.5 + this.open * 2.4
    },
  }
}

/* ── 세이렌 — 날개 ─────────────────────────────────────────
   고전의 세이렌은 새의 몸에 사람의 얼굴이다. 바닥에서 솟아오르므로
   날개는 접혀 있다가 노래할 때 펴진다. */
function sirenWings(rig) {
  const made = []
  for (const side of [-1, 1]) {
    const wing = new THREE.Group()
    // 깃 — 길이가 다른 판을 부채처럼 겹친다
    for (let i = 0; i < 7; i++) {
      const len = 0.55 + i * 0.13
      const f = new THREE.Mesh(
        new THREE.CircleGeometry(len * 0.5, 8, 0, Math.PI),
        new THREE.MeshStandardMaterial({
          color: i % 2 ? '#8fd8e0' : '#6fb8c8', roughness: 0.66,
          side: THREE.DoubleSide, transparent: true, opacity: 0.93,
          emissive: '#2a6a78', emissiveIntensity: 0.35,
        }),
      )
      f.scale.set(0.42, 1, 1)
      f.position.set(side * (0.1 + i * 0.075), -i * 0.045, -0.02 - i * 0.012)
      f.rotation.set(Math.PI / 2, 0, side * (0.35 + i * 0.12))
      wing.add(f)
    }
    const mount = rig.attachTo(side < 0 ? 'clavicle_l' : 'clavicle_r', wing, {
      scale: 1, position: [0, 0.02, -0.05],
    })
    made.push({ wing, mount, side })
  }
  return {
    wings: made,
    spread: 0,
    update(dt, s) {
      // 솟아오르거나 노래할 때 펴진다
      const want = s.acting ? 1 : 0.22
      this.spread += (want - this.spread) * Math.min(1, dt * 3.4)
      for (const w of this.wings) {
        w.wing.rotation.z = w.side * (0.15 + this.spread * 0.85)
        w.wing.rotation.x = Math.sin(s.t * 2.4) * 0.07 * this.spread
        w.wing.scale.setScalar(0.7 + this.spread * 0.5)
      }
    },
  }
}

const PARTS = {
  polyphemos: cyclopsEye,
  skylla: skyllaWall,
  charybdis: charybdisVortex,
  siren: sirenWings,
}

/**
 * 보스 하나에 제 몸을 붙인다. 붙일 게 없는 보스면 null.
 * 돌려받은 것의 update(dt, state) 를 보스가 매 프레임 부른다.
 *
 * `scale` 이 중요하다. attachTo 는 본의 월드 스케일을 상쇄해서 붙이므로
 * (holder.scale = 1/본스케일) 조각의 좌표는 리그 크기와 무관한 **월드 단위**가
 * 된다. 그래서 키 6.4 짜리 거인에게도 반지름 0.15 짜리 눈이 그대로 달린다 —
 * 사람 눈만 한 외눈박이가 된다. 키에 비례해서 키워야 맞다.
 */
export function attachBossParts(id, rig, look = {}) {
  const make = PARTS[id]
  if (!make || !rig?.attachTo) return null
  const scale = (look.height ?? 1.8) / 1.8
  try {
    const parts = make(rig)
    if (!parts) return null
    for (const m of [parts.mount, parts.eyeMount, ...(parts.wings ?? []).map(w => w.mount)]) {
      if (m) m.scale.multiplyScalar(scale)
    }
    parts.scale = scale
    return parts
  } catch (e) {
    // 조각 하나 못 붙였다고 보스가 안 나오면 안 된다
    console.warn(`[bossparts] ${id} 붙이기 실패:`, e.message)
    return null
  }
}

/* ── 받아 온 몸에 붙이는 조종 ─────────────────────────────
   위의 조각들은 공용 사람 뼈대에 매단다. 제 모델을 받아 온 보스는
   매달 자리가 없는 대신 **제 뼈**가 있다. 그 뼈를 직접 움직인다. */

/**
 * 스킬라 — 크라켄 촉수 여섯.
 *
 * 받아 온 크라켄(Kraken Animation, Yanez Designs, CC-BY)은 뼈 사슬이 여덟인데
 * 살이 붙은 건 1~6 여섯뿐이다 (7·8 은 메시가 없는 빈 사슬). 클립은 한 벌을
 * 도는 흔들기 하나뿐이라, 그대로 두면 여섯이 한 박자로 흔들릴 뿐 어느 촉수가
 * 무는지가 몸에 없다.
 *
 * 그래서 —
 *   · 머리 번호마다 촉수 하나를 정해 두고, 그 번호의 패턴이 돌 때 **그 촉수만**
 *     쳐들었다가(예고) 붉은 원 위로 내리친다(판정). 거둬들이는 동안은 갑판에
 *     걸쳐 있다 — 그게 끊는 때다 (boss.js #sever).
 *   · 끊긴 번호의 촉수는 오그라들어 사라진다.
 *
 * 뼈의 로컬 축은 모델마다 제각각이라 믿지 않는다. 매 프레임 밑동과 끝의
 * **월드 위치**를 재서, 끝이 가야 할 방향으로 밑동을 돌린다.
 */
/**
 * 머리 1..6 → 촉수 사슬 번호.
 * 앞의 넷(1·2 앞줄, 5·6 옆줄)에 자주 쓰는 패턴을, 뒤의 둘(3·4)에 크게
 * 한 번 치는 패턴(smash·lash)을 준다 — 뒤쪽 밑동은 뱃전 밖이라 멀리서
 * 뻗어 와야 하고, 그만큼 예고가 긴 패턴이어야 맞다.
 * 처음엔 살 없는 7·8 을 머리로 쓰고 살 있는 3·4 를 접었다가 넷만 보였다.
 */
const KRAKEN_HEADS = [5, 1, 6, 2, 3, 4]
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _r = new THREE.Vector3(), _t = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qp = new THREE.Quaternion()
const _qi = new THREE.Quaternion()

function skyllaKraken(root) {
  const chains = new Map()
  root.traverse(o => {
    const m = o.isBone && /^TentacleBones00(\d)/.exec(o.name)
    if (!m) return
    let tip = o
    for (;;) { const c = tip.children.find(x => x.isBone); if (!c) break; tip = c }
    chains.set(Number(m[1]), o)
    o.userData.tip = tip
  })
  if (KRAKEN_HEADS.some(n => !chains.has(n))) return null

  const heads = KRAKEN_HEADS.map((n, i) => ({
    n: i + 1, bone: chains.get(n), tip: chains.get(n).userData.tip,
    wind: 0, slam: 0, alive: 1,
    clipQ: new THREE.Quaternion(), written: null,
  }))

  return {
    ownsStrike: true,
    group: null,

    /** 머리 n 의 밑동 (월드 x,z). 패턴의 원점이 여기다. */
    headBase(n) {
      const h = heads[n - 1]
      if (!h) return null
      h.bone.getWorldPosition(_r)
      return { x: _r.x, z: _r.z }
    },

    update(dt, s) {
      root.updateMatrixWorld(true)

      const st = s.strike
      for (const h of heads) {
        // 클립이 이 뼈를 안 움직이면 지난 프레임에 내가 쓴 값이 그대로 남는다.
        // 그걸 클립 값으로 착각하면 회전이 쌓인다 — 내가 쓴 값이면 되돌린다.
        if (h.written && h.bone.quaternion.equals(h.written)) h.bone.quaternion.copy(h.clipQ)
        h.clipQ.copy(h.bone.quaternion)

        // 끊긴 촉수는 오그라든다
        const want = s.severedHeads?.has(h.n) ? 0 : 1
        h.alive += (want - h.alive) * Math.min(1, dt * 3)
        h.bone.scale.setScalar(Math.max(0.0001, h.alive))

        // 무는 촉수의 목표 — 예고 동안 쳐들고, 판정에 내리치고, 거두는 동안 걸쳐 있다
        let wantWind = 0, wantSlam = 0, snap = 8
        if (st && st.head === h.n) {
          if (st.phase === 'startup') { wantWind = Math.pow(st.p, 0.6) }
          else if (st.phase === 'active') { wantSlam = 1; snap = 34 }
          else { wantSlam = st.p < 0.65 ? 1 : 1 - (st.p - 0.65) / 0.35 }
        }
        h.wind += (wantWind - h.wind) * Math.min(1, dt * (wantWind > h.wind ? 7 : 14))
        h.slam += (wantSlam - h.slam) * Math.min(1, dt * snap)
        if (h.wind < 0.002 && h.slam < 0.002) { h.written = null; continue }

        // 지금 촉수가 뻗은 방향 (클립 자세 그대로)
        h.bone.getWorldPosition(_r)
        h.tip.getWorldPosition(_t)
        _v.subVectors(_t, _r).normalize()

        // 떨어질 자리 쪽 수평 방향
        const tx = st?.head === h.n ? st.x : _t.x, tz = st?.head === h.n ? st.z : _t.z
        _w.set(tx - _r.x, 0, tz - _r.z)
        const flat = _w.length() || 1
        _w.divideScalar(flat)

        // 쳐든 자세: 떨어질 자리 반대로 젖히고 높이 든다
        _qa.setFromUnitVectors(_v, _t.copy(_up).multiplyScalar(1.1).addScaledVector(_w, -0.75).normalize())
        // 내리친 자세: 끝이 떨어질 자리의 갑판에 닿는다
        _qb.setFromUnitVectors(_v, _t.set(tx - _r.x, 0.25 - _r.y, tz - _r.z).normalize())

        const q = _qi.identity().slerp(_qa, h.wind).slerp(_qb, h.slam)

        // 월드 회전을 뼈의 로컬로 옮긴다: 부모⁻¹ · q · 부모 · 클립
        h.bone.parent.getWorldQuaternion(_qp)
        h.bone.quaternion.copy(_qp).invert().multiply(q).multiply(_qp).multiply(h.clipQ)
        h.written ??= new THREE.Quaternion()
        h.written.copy(h.bone.quaternion)
      }
    },
  }
}

const MODEL_PARTS = {
  skylla: skyllaKraken,
}

/** 받아 온 몸에 조종을 붙인다. 뼈가 기대와 다르면 조용히 없이 간다. */
export function attachModelParts(id, root) {
  const make = MODEL_PARTS[id]
  if (!make) return null
  try {
    return make(root)
  } catch (e) {
    console.warn(`[bossparts] ${id} 조종 붙이기 실패:`, e.message)
    return null
  }
}
