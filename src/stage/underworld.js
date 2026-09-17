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
 * 타임라인(초)
 *   0.0–1.6  암전이 걷히고 레터박스가 닫힌다
 *   1.0–4.4  오디세우스가 안개 속으로 걸어 들어간다
 *   3.8–4.6  앞쪽 흙이 부풀고 갈라진다
 *   4.6–7.2  손이, 투구가, 어깨가 차례로 올라온다
 *   7.0–8.4  카메라가 바짝 붙고 이름이 뜬다
 *   8.4–9.6  이름이 사라지고 레터박스가 열린다
 */
export const INTRO_TIME = 9.6

const PORTRAIT = '/img/agamemnon.webp?v=4'

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

/** 땅 위로 올라오는 망자. 땅에 잠긴 부분은 잘라 낸다. */
function makeRisen(game, { at = { x: 0, z: -4.6 }, height = 3.8 } = {}) {
  const tex = new THREE.TextureLoader().load(PORTRAIT)
  tex.colorSpace = THREE.SRGBColorSpace
  // 821×782 — 허벅지 아래는 잘라 두었고 아랫단은 흐려진다
  const w = height * (821 / 782)
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02)
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    clippingPlanes: [clip], side: THREE.DoubleSide, toneMapped: false,
  })
  // 갑옷이 새까매서 저승의 어둠에 그대로 묻힌다. 색을 1 넘게 곱해 끌어올린다.
  mat.color.setRGB(2.5, 2.35, 2.6)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat)
  mesh.position.set(at.x, -height / 2, at.z)
  // 카메라가 40도 위에서 내려다본다. 판을 그쪽으로 뉘어야 세워 둔 판자처럼
  // 위로 길게 뻗지 않고, 화면 안에 다 들어온다.
  mesh.rotation.x = -0.44
  mesh.renderOrder = 4

  // 뒤에서 받치는 빛 — 이게 없으면 검은 형체가 검은 배경에 묻힌다
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.6, height * 1.1),
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
  g.add(back, mesh, pool, mound)
  game.render3d.scene.add(g)
  return { group: g, mesh, back, pool, mound, mat, height, at }
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

  const risen = makeRisen(game, { at: { x: 0, z: -5.4 } })

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

      // 올라온다. 땅에 잠긴 부분은 잘려 있어 정말 흙을 헤치고 나오는 것처럼 보인다
      const rise = clamp((t - 4.6) / 2.6, 0, 1)
      const ease = 1 - Math.pow(1 - rise, 2.6)
      risen.mesh.position.y = -risen.height / 2 + ease * risen.height * 0.92
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

      // 카메라가 바짝 붙고 이름이 뜬다
      game.render3d.zoom = clamp((t - 5.4) / 1.8, 0, 1) * 0.3
      if (!named && t > 7.0) { named = true; nameEl.style.opacity = '1' }
      if (named && t > 8.4) nameEl.style.opacity = '0'
      if (t > 8.6) bars.forEach(b => {
        b.style.transform = b.classList.contains('uw-top') ? 'translateY(-100%)' : 'translateY(100%)'
      })

      return t >= INTRO_TIME
    },
    dispose() {
      layer.remove()
      game.render3d.zoom = 0
      game.render3d.scene.remove(risen.group)
      risen.mat.map?.dispose()
      risen.mat.dispose()
    },
  }
}
