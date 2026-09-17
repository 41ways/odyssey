import * as THREE from 'three'
import { models } from '../render/models.js'

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
 * 스킬라 — 절벽에서 뻗는 여섯 머리.
 *
 * 전에는 원통 마디 다섯을 이어 만든 관이었다 (tentacle() 헬퍼). 그건 돌로도
 * 살로도 안 보이고, 무엇보다 **제 동작이 없었다** — 사인파로 흔드는 것뿐이라
 * 내려찍는 순간과 물러나는 순간이 같은 모양이었다.
 *
 * 이제 받아 온 촉수 모델을 쓴다. 뼈대 15 마디에 Attack · Idle 클립이 붙어
 * 있어서, 그 머리가 실제로 때릴 때 때리는 동작을 한다. 파훼가 '회복 구간을
 * 노리는 것' 이므로 (bosses.js 의 SKYLLA) 때리는 동작과 거둬들이는 동작이
 * 눈에 보이는 게 규칙의 절반이다 — 안 보이면 언제 때릴지를 못 읽는다.
 *   Quaternius (CC0), poly.pizza 경유 · CREDITS.md
 *
 * 머리 끝에는 돌 뱀 머리를 얹는다. 촉수 끝은 빨판이고, 이 보스는
 * '여섯 머리의 것' 이라 머리로 읽혀야 한다.
 *
 * 모델이 없으면 옛 원통으로 돌아간다. 파일 하나 없다고 보스가 안 나오면 안 된다.
 */
function skyllaWall(rig) {
  const root = new THREE.Group()
  const stone = mat('#7d8288', { roughness: 0.97, metalness: 0.02, flatShading: true })
  const crack = new THREE.MeshStandardMaterial({
    color: '#3a4450', emissive: '#2a6a5a', emissiveIntensity: 0.9, roughness: 0.8,
  })

  const arms = []
  const SPREAD = [-1.15, -0.72, -0.26, 0.26, 0.72, 1.15]
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group()
    const made = models.create('tentacle')
    let tt = null, tip = null

    if (made) {
      /**
       * 촉수는 +z 로 뻗는다. 갑판 쪽으로 앞-아래로 숙여 심는다.
       *
       * 숫자는 눈으로 고른 게 아니라 끝 뼈(Tentacle15)의 월드 높이를
       * 재서 골랐다. 0.28 이면 머리가 y 4.1 — 화면 위로 지나가서 위협이
       * 안 된다. 0.9 면 y 1.2 로 가슴 높이에 온다. 그 사이를 머리마다
       * 다르게 줘서 (0.62 · 0.75 · 0.88) 높낮이가 섞이게 한다 —
       * 여섯이 같은 각도로 늘어서면 한 마리에서 난 갈래로 읽힌다.
       */
      made.root.rotation.x = 0.62 + (i % 3) * 0.13
      // 돌로 칠한다. 받아 온 재질은 제 색이 따로 있어서 그대로 두면
      // 판의 색과 따로 논다.
      for (const m of made.mats) { m.color?.set?.('#7d8288'); m.roughness = 0.95; m.metalness = 0.03 }
      arm.add(made.root)
      // 끝 뼈를 찾아 머리를 매단다. 뼈에 붙이면 동작을 따라 같이 움직인다.
      made.root.traverse(o => { if (o.isBone && o.name === 'Tentacle15') tip = o })
    } else {
      tt = tentacle({ segs: 5, len: 0.46, r0: 0.19, r1: 0.055, curl: 0.2, material: stone, sides: 6 })
      arm.add(tt.root)
      tip = tt.tip
    }

    // 돌 뱀 머리. 받아 둔 모델이 있으면 그걸, 없으면 깨진 바위 덩어리.
    const head = new THREE.Group()
    const hm = models.create('serpentHead')
    if (hm) {
      hm.root.scale.setScalar(made ? 0.22 : 0.42)
      hm.root.rotation.x = made ? 0 : -Math.PI * 0.5
      head.add(hm.root)
    } else {
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), stone)
      chunk.scale.set(0.9, 0.8, 1.4)
      head.add(chunk)
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), crack)
    glow.position.set(0, 0.02, 0.06)
    head.add(glow)
    if (!made) head.position.y = 0.46
    tip?.add(head)

    // 절벽 폭만큼 벌린다. 좁게 모으면 한 마리에서 난 뿔처럼 보이고,
    // 벌려야 벽 여기저기서 따로 뻗어 나온 것으로 읽힌다.
    arm.rotation.z = SPREAD[i] * 0.3
    if (!made) arm.rotation.x = -1.05 - Math.abs(SPREAD[i]) * 0.1
    arm.position.set(SPREAD[i] * 3.6, made ? -0.2 : -0.5, 0)
    root.add(arm)
    arms.push({ arm, tt, made, head, glow, phase: i * 1.3, spread: SPREAD[i], alive: 1, striking: 0 })
  }

  const mount = rig.attachTo('spine_03', root, { scale: 1, position: [0, 0.1, -0.1] })
  return {
    group: root, mount, arms, necks: arms,     // necks 는 옛 이름 호환
    /**
     * @param s.severed 끊긴 머리 수 (Boss.severed.size). 끊긴 만큼 사라진다 —
     *   파훼의 보상이 눈에 보이는 자리가 여기다.
     * @param s.striking 지금 때리는 중인 머리 번호(1..6) 또는 0
     */
    update(dt, s) {
      // 끊긴 머리는 돌아오지 않는다. 옛 규칙(2페엔 하나만)은 severed 가
      // 없을 때만 쓴다 — 페이즈로 숨기면 끊은 것과 구분이 안 된다.
      const gone = s.severed ?? (s.phase >= 1 ? 5 : 0)
      const keep = Math.max(1, 6 - gone)
      this.arms.forEach((a, i) => {
        const want = i < keep ? 1 : 0
        a.alive += (want - a.alive) * Math.min(1, dt * 2.2)
        a.arm.scale.setScalar(Math.max(0.001, a.alive))
        a.arm.visible = a.alive > 0.02
        if (a.made) {
          // 때리는 머리만 Attack, 나머지는 Idle. 이게 파훼의 읽을 거리다.
          const hit = s.striking === i + 1
          if (hit !== a.striking) { a.made.pose({ run: 0, attack: hit, draw: null, roll: 0 }, dt); a.striking = hit }
          a.made.mixer?.update(dt)
        } else {
          waveTentacle(s.t, a.tt, { speed: 1.5, amp: 0.06, lag: 0.5, phase: a.phase })
        }
        a.glow.material.emissiveIntensity = 0.7 + Math.sin(s.t * 3 + a.phase) * 0.35
      })
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

  // 소용돌이 깔때기. 아래로 파인 원뿔 — 물이 빨려 드는 구멍이다.
  const funnel = new THREE.Mesh(
    new THREE.ConeGeometry(2.5, 3.2, 28, 5, true),
    new THREE.MeshStandardMaterial({
      color: '#12324a', roughness: 0.32, side: THREE.DoubleSide,
      transparent: true, opacity: 0.88, emissive: '#0a2438', emissiveIntensity: 0.6,
    }),
  )
  funnel.position.y = -1.5
  root.add(funnel)

  // 물살 고리. 층마다 다른 속도로 돌아야 '빨려 든다' 로 보인다.
  const swirls = []
  for (let i = 0; i < 5; i++) {
    const r = 2.6 - i * 0.42
    const s = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.055 + i * 0.012, 6, 40),
      new THREE.MeshBasicMaterial({
        color: '#7fc0ff', transparent: true, opacity: 0.34 - i * 0.045,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    )
    s.rotation.x = Math.PI / 2
    s.position.y = 0.16 - i * 0.28
    root.add(s)
    swirls.push({ m: s, spin: (1 + i * 0.55) * (i % 2 ? -1 : 1) })
  }

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
  eye.position.y = 0.35
  root.add(eye)

  const mount = rig.attachToBody(root, { position: [0, 0, 0], scale: 1 })
  return {
    group: root, mount, swirls, arms, iris, lidPivot, funnel,
    open: 0,
    update(dt, s) {
      const fast = s.phase >= 1 ? 1.7 : 1
      for (const w of this.swirls) w.m.rotation.z += dt * w.spin * fast
      this.funnel.rotation.y += dt * 1.1 * fast

      // 팔은 길고 낭창거린다. 빨아들일 때 안쪽으로 오므린다.
      const want = s.sucking ? 1 : 0.12
      this.open += (want - this.open) * Math.min(1, dt * 5)
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
