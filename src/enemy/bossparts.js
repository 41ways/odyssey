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
function skyllaWall(rig) {
  const root = new THREE.Group()
  const stone = mat('#7d8288', { roughness: 0.97, metalness: 0.02, flatShading: true })
  const crack = new THREE.MeshStandardMaterial({
    color: '#3a4450', emissive: '#2a6a5a', emissiveIntensity: 0.9, roughness: 0.8,
  })

  const arms = []
  const SPREAD = [-1.15, -0.72, -0.26, 0.26, 0.72, 1.15]
  for (let i = 0; i < 6; i++) {
    // 마디가 적고 굵다. 돌은 낭창거리지 않는다.
    const tt = tentacle({ segs: 5, len: 0.46, r0: 0.19, r1: 0.055, curl: 0.2, material: stone, sides: 6 })

    // 끝은 돌 뱀 머리. 받아 둔 모델이 있으면 그걸 쓰고,
    // 없으면 깨진 바위 덩어리로 간다 — 파일 하나 없다고 보스가 안 나오면 안 된다.
    const head = new THREE.Group()
    const made = models.create('serpentHead')
    if (made) {
      made.root.scale.setScalar(0.42)
      made.root.rotation.x = -Math.PI * 0.5   // 머리가 목 방향(+y)을 보게
      head.add(made.root)
    } else {
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), stone)
      chunk.scale.set(0.9, 0.8, 1.4)
      head.add(chunk)
      for (let t = 0; t < 5; t++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), stone)
        const a = (t / 5) * Math.PI * 2
        spike.position.set(Math.sin(a) * 0.1, Math.cos(a) * 0.08, 0.17)
        spike.rotation.x = -Math.PI * 0.5
        head.add(spike)
      }
    }
    // 갈라진 틈에서 새는 빛 — 살아 있는 돌이라는 표시
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), crack)
    glow.position.set(0, 0.02, 0.06)
    head.add(glow)
    head.position.y = 0.46
    tt.tip.add(head)

    // 절벽 폭만큼 벌린다. 좁게 모으면 한 마리에서 난 뿔처럼 보이고,
    // 벌려야 벽 여기저기서 따로 뻗어 나온 것으로 읽힌다.
    // (attachTo 는 월드 단위라 여기 값에 보스 키 배수가 한 번 더 곱해진다)
    tt.root.rotation.z = SPREAD[i] * 0.3
    // 앞-아래로 숙인다. 위로 서면 갑판에 닿지 않고 화면 위로만 자란다.
    tt.root.rotation.x = -1.05 - Math.abs(SPREAD[i]) * 0.1
    tt.root.position.set(SPREAD[i] * 3.6, -0.5, 0)
    root.add(tt.root)
    arms.push({ tt, head, glow, phase: i * 1.3, spread: SPREAD[i], alive: 1 })
  }

  const mount = rig.attachTo('spine_03', root, { scale: 1, position: [0, 0.1, -0.1] })
  return {
    group: root, mount, arms, necks: arms,     // necks 는 옛 이름 호환
    update(dt, s) {
      // 2페에는 하나만 남는다 — 나머지는 부서져 내린다
      const keep = s.phase >= 1 ? 1 : 6
      this.arms.forEach((a, i) => {
        const want = i < keep ? 1 : 0
        a.alive += (want - a.alive) * Math.min(1, dt * 2.2)
        a.tt.root.scale.setScalar(Math.max(0.001, a.alive))
        a.tt.root.visible = a.alive > 0.02
        // 돌은 살보다 덜 흔들린다
        waveTentacle(s.t, a.tt, { speed: 1.5, amp: 0.06, lag: 0.5, phase: a.phase })
        a.glow.material.emissiveIntensity = 0.7 + Math.sin(s.t * 3 + a.phase) * 0.35
        // 남은 하나는 앞으로 곧게 선다
        if (keep === 1 && i === 0) {
          a.tt.root.rotation.z += (0 - a.tt.root.rotation.z) * Math.min(1, dt * 2)
          a.tt.root.position.x += (0 - a.tt.root.position.x) * Math.min(1, dt * 2)
        }
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

  // 팔 여섯. 소용돌이 가장자리에서 올라와 안쪽으로 굽는다.
  const arms = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    const tt = tentacle({ segs: 8, len: 0.44, r0: 0.17, r1: 0.025, curl: 0.19, material: flesh, sides: 8 })
    // 빨판 — 안쪽 면에만
    for (let k = 1; k < tt.joints.length; k += 2) {
      const cup = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), new THREE.MeshStandardMaterial({
        color: '#cfe4f2', roughness: 0.35, side: THREE.DoubleSide,
      }))
      cup.position.set(0, 0.2, 0.1 - k * 0.008)
      cup.rotation.x = -0.4
      tt.joints[k].add(cup)
    }
    tt.root.position.set(Math.sin(a) * 1.9, -0.3, Math.cos(a) * 1.9)
    tt.root.rotation.y = a
    tt.root.rotation.x = -0.42
    root.add(tt.root)
    arms.push({ tt, phase: i * 1.05, a })
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
        waveTentacle(s.t, a.tt, {
          speed: 1.9 * fast, amp: 0.1, lag: 0.48, phase: a.phase,
          curl: 0.19 + this.open * 0.14,
        })
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
