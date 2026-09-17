import * as THREE from 'three'
import { clamp } from '../core/math.js'

/**
 * 저승에 들어서는 장면.
 *
 * 다른 판은 현판 한 장으로 시작하지만 저승은 싸우는 곳이 아니다.
 * 걸어 들어가는 시간을 줘야 "여기는 다른 데"가 된다.
 *
 * 영화처럼 보이게 하는 건 결국 세 가지다 —
 *   화면을 눌러 가로로 길게 (레터박스), 카메라를 천천히 밀고,
 *   중요한 순간에 말을 아끼는 것.
 * 아가멤논은 걸어 나오지 않는다. 땅을 헤치고 올라온다.
 *
 * 한 장을 잘라 올리면 아무리 흔들어도 판자가 밀려 올라오는 티가 난다.
 * 그래서 단계마다 그림을 따로 그려 두고 넘긴다 —
 * 손 하나, 허리까지 나와 고개 숙인 몸, 다 나와 내려다보는 왕.
 * 넘어갈 때만 겹쳐 흐리면 그 사이는 눈이 알아서 메운다.
 *
 * 타임라인(초)
 *   0.0–1.6  암전이 걷히고 레터박스가 닫힌다
 *   1.0–4.4  오디세우스가 안개 속으로 걸어 들어간다
 *   3.8–4.6  앞쪽 흙이 부풀고 갈라진다
 *   4.6–7.2  손이, 투구가, 어깨가 차례로 올라온다
 *   7.0–8.4  카메라가 바짝 붙고 이름이 뜬다
 *   8.4–9.6  이름이 사라지고 레터박스가 열린다
 */
export const INTRO_TIME = 10.6

/** 올라오는 단계. 앞의 것이 흐려지며 다음 것이 켜진다. */
const RISE = [
  { url: '/img/rise/rise-agamemnon-1.webp', at: 0.00, height: 1.5, ratio: 724 / 979 },   // 손 하나
  { url: '/img/rise/rise-agamemnon-2.webp', at: 0.34, height: 2.5, ratio: 777 / 968 },   // 허리까지
  { url: '/img/rise/rise-agamemnon-3.webp', at: 0.72, height: 3.4, ratio: 391 / 1083 },  // 다 나와 내려다본다
]

/** 가장자리로 갈수록 사라지는 둥근 빛 한 장. 뒤에서 형체를 떠받친다. */
function haloTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  rg.addColorStop(0, 'rgba(255,255,255,1)')
  rg.addColorStop(0.45, 'rgba(255,255,255,.34)')
  rg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = rg
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 한 단계 = 판 하나. 바닥에 세우고, 켜고 끄기만 한다. */
function makeStage(spec, at, lean) {
  const tex = new THREE.TextureLoader().load(spec.url)
  tex.colorSpace = THREE.SRGBColorSpace
  const w = spec.height * spec.ratio
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  })
  // 갑옷이 새까매서 저승의 어둠에 그대로 묻힌다. 색을 1 넘게 곱해 끌어올린다.
  mat.color.setRGB(2.3, 2.2, 2.45)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, spec.height), mat)
  // 카메라가 40도 위에서 내려다본다. 판을 그쪽으로 뉘어야 세워 둔 판자처럼
  // 위로 길게 뻗지 않고 화면 안에 다 들어온다. 발밑이 바닥에 닿게 올려 둔다.
  mesh.rotation.x = lean
  mesh.position.set(at.x, spec.height * 0.5 * Math.cos(lean), at.z + spec.height * 0.5 * Math.sin(lean))
  mesh.renderOrder = 4
  return { mesh, mat, spec }
}

/** 땅 위로 올라오는 망자. 단계마다 다른 그림으로 넘어간다. */
function makeRisen(game, { at = { x: 0, z: -4.2 } } = {}) {
  const LEAN = -0.44
  const stages = RISE.map(spec => makeStage(spec, at, LEAN))
  const height = RISE[RISE.length - 1].height

  // 뒤에서 받치는 빛 — 이게 없으면 검은 형체가 검은 배경에 묻힌다
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(height * 1.6, height * 1.1),
    new THREE.MeshBasicMaterial({
      color: '#6f54b0', transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      map: haloTexture(),
    })
  )
  back.position.set(at.x, height * 0.5, at.z - 0.5)
  back.rotation.x = -0.44
  back.renderOrder = 3

  // 발밑에서 새는 빛 — 형체가 검어서 이게 없으면 배경에 묻힌다
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.4),
    new THREE.MeshBasicMaterial({
      color: '#8d6ad8', transparent: true, opacity: 0, map: haloTexture(),
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    })
  )
  pool.rotation.x = -Math.PI / 2
  pool.position.set(at.x, 0.04, at.z)

  // 부풀어 오르는 흙무덤
  // 갈라진 자리. 테두리가 또렷하면 바닥에 뚫린 구멍처럼 보여서 흐린 판으로 깐다.
  const mound = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({
      color: '#120c0a', transparent: true, opacity: 0, map: haloTexture(), depthWrite: false,
    })
  )
  mound.rotation.x = -Math.PI / 2
  mound.position.set(at.x, 0.05, at.z)

  const g = new THREE.Group()
  g.add(back, pool, mound, ...stages.map(s => s.mesh))
  game.render3d.scene.add(g)
  return { group: g, stages, back, pool, mound, height, at, lean: LEAN }
}


/**
 * 연출을 한 번 돌린다. draw() 가 매 프레임 진행도를 먹인다.
 * @returns {{ tick(dt): boolean, dispose(): void }}  tick 이 true 를 돌려주면 끝
 */
export function startUnderworldIntro(game) {
  const p = game.player
  const start = { x: p.pos.x, z: Math.min(9, game.arenaRadius - 3) }
  p.pos.set(start.x, 0, start.z)
  p.facing = Math.PI
  game.render3d.camTarget.copy(p.pos)

  const risen = makeRisen(game, { at: { x: 0, z: -4.2 } })

  // 화면 위에 얹는 것들 — 암전, 레터박스, 이름
  const layer = document.createElement('div')
  layer.style.cssText = 'position:absolute;inset:0;z-index:58;pointer-events:none;overflow:hidden'
  layer.innerHTML = `
    <div class="uw-fade" style="position:absolute;inset:0;background:#05040a"></div>
    <div class="uw-bar uw-top" style="position:absolute;left:0;right:0;top:0;height:12vh;
      background:#000;transform:translateY(-100%);transition:transform 1.5s cubic-bezier(.2,.8,.2,1)"></div>
    <div class="uw-bar uw-bot" style="position:absolute;left:0;right:0;bottom:0;height:12vh;
      background:#000;transform:translateY(100%);transition:transform 1.5s cubic-bezier(.2,.8,.2,1)"></div>
    <div class="uw-grade" style="position:absolute;inset:0;
      background:radial-gradient(ellipse 74% 60% at 50% 46%, transparent 44%, rgba(6,4,12,.42) 100%),
                 linear-gradient(180deg, rgba(50,32,86,.12), transparent 44%, rgba(70,24,34,.10))"></div>
    <div class="uw-name" style="position:absolute;left:0;right:0;bottom:20vh;text-align:center;
      opacity:0;transition:opacity .9s ease">
      <div style="font-family:var(--display);font-size:clamp(26px,3.4vw,42px);font-weight:500;
        letter-spacing:.06em;color:#efe2c6;text-shadow:0 0 60px rgba(160,130,220,.5),0 6px 30px #000">아가멤논</div>
      <div style="font-family:var(--serif);font-size:12px;letter-spacing:.42em;text-indent:.42em;
        color:#9d86c8;margin-top:12px">미케네 3대 국왕</div>
    </div>`
  game.uiRoot.appendChild(layer)
  const fade = layer.querySelector('.uw-fade')
  const bars = layer.querySelectorAll('.uw-bar')
  const nameEl = layer.querySelector('.uw-name')
  setTimeout(() => bars.forEach(b => { b.style.transform = 'translateY(0)' }), 40)

  let t = 0
  let ash = 0
  let dirt = 0
  let named = false
  return {
    tick(dt) {
      t += dt

      fade.style.opacity = String(clamp(1 - t / 1.6, 0, 1))

      // 걸어 들어간다 — 애니메이션은 달리기 클립이 맡는다
      const walk = clamp((t - 1.0) / 3.4, 0, 1)
      p.pos.z = start.z + (-2.6 - start.z) * (walk * walk * (3 - 2 * walk))   // smoothstep
      p._run = walk > 0 && walk < 1 ? 0.5 : 0
      p.facing = Math.PI

      // 재가 피어오른다
      ash -= dt
      if (ash <= 0) {
        ash = 0.05
        game.particles.shed(
          p.pos.x + (Math.random() - 0.5) * 14, 0.2 + Math.random() * 2.4,
          p.pos.z + (Math.random() - 0.5) * 10, '#8a7bb0', 0.1)
      }

      // 흙이 부풀고 갈라진다
      const swell = clamp((t - 3.8) / 0.8, 0, 1)
      risen.mound.material.opacity = swell * 0.62
      risen.mound.scale.setScalar(0.4 + swell * 0.8)
      if (swell > 0 && swell < 1) game.render3d.addShake(dt * 0.5)

      // 올라온다. 단계마다 그림이 통째로 바뀐다 — 앞의 것이 흐려지며 다음이 켜진다.
      const rise = clamp((t - 4.6) / 2.8, 0, 1)
      const ease = 1 - Math.pow(1 - rise, 2.6)
      for (let i = 0; i < risen.stages.length; i++) {
        const st = risen.stages[i]
        const next = risen.stages[i + 1]
        // 제 차례가 오면 켜지고, 다음 차례가 오면 꺼진다. 겹치는 구간만 흐려진다.
        const inK = clamp((rise - st.spec.at) / 0.12, 0, 1)
        const outK = next ? clamp((rise - next.spec.at) / 0.12, 0, 1) : 0
        st.mat.opacity = inK * (1 - outK)
        // 켜지는 동안만 살짝 밀어 올린다 — 멈춘 그림이 아니라 나오는 중으로 읽힌다
        const push = (1 - inK) * 0.35
        st.mesh.position.y = st.spec.height * 0.5 * Math.cos(risen.lean) - push
      }
      risen.pool.material.opacity = ease * 0.26
      risen.back.material.opacity = ease * 0.26
      if (rise > 0 && rise < 1) {
        dirt -= dt
        if (dirt <= 0) {
          dirt = 0.035
          // 흙은 아래로, 재는 위로 — 두 가지가 같이 떨어져야 파헤치는 것처럼 보인다
          game.particles.shed(
            risen.at.x + (Math.random() - 0.5) * 2.4, 0.15 + Math.random() * 1.4,
            risen.at.z + (Math.random() - 0.5) * 1.4, '#3a2c22', 0.14)
          game.particles.shed(
            risen.at.x + (Math.random() - 0.5) * 2.2, 0.3 + Math.random() * 3.0,
            risen.at.z + (Math.random() - 0.5) * 1.4, '#b49ce8', 0.1)
        }
        game.render3d.addShake(dt * 0.7)
      }

      // 카메라가 바짝 붙고 이름이 뜬다.
      // 시선도 둘 사이로 옮긴다 — 플레이어만 보면 올라오는 쪽이 레터박스에 잘린다.
      const look = clamp((t - 4.2) / 1.6, 0, 1)
      game.camFocus ??= new THREE.Vector3()
      game.camFocus.set(0, 0, p.pos.z + (risen.at.z + 1.0 - p.pos.z) * look)
      game.render3d.zoom = clamp((t - 5.4) / 1.8, 0, 1) * 0.3
      if (!named && t > 7.0) { named = true; nameEl.style.opacity = '1' }
      if (named && t > 8.4) nameEl.style.opacity = '0'
      // 띠가 다 걷히기 전에 연출이 끝나면 다음 화면 위에 검은 띠가 남아 글자를 자른다
      if (t > 8.6) bars.forEach(b => {
        b.style.transform = b.classList.contains('uw-top') ? 'translateY(-100%)' : 'translateY(100%)'
      })

      return t >= INTRO_TIME
    },
    dispose() {
      layer.remove()
      game.camFocus = null
      game.render3d.zoom = 0
      game.render3d.scene.remove(risen.group)
      for (const s of risen.stages) { s.mat.map?.dispose(); s.mat.dispose(); s.mesh.geometry.dispose() }
    },
  }
}
