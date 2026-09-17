import * as THREE from 'three'
import { createCharacter } from '../render/character.js'
import { clamp } from '../core/math.js'

/**
 * 저승으로 걸어 들어가는 연출.
 *
 * 다른 판은 현판 한 장으로 시작하지만 저승은 싸우는 곳이 아니다.
 * 걸어 들어가는 시간을 줘야 "여기는 다른 데"가 된다.
 *
 * 타임라인(초)
 *   0.0–1.2  암전에서 열린다
 *   0.6–3.4  플레이어가 안개 속으로 걸어 들어간다
 *   2.4–4.0  앞쪽 바닥에서 보랏빛이 솟고 그림자가 일어선다
 *   4.0–5.2  카메라가 그림자 쪽으로 밀고 들어간다
 */
export const INTRO_TIME = 5.2

export function makeShade(game) {
  const rig = createCharacter({ height: 2.35, tint: '#4a3f66', bulk: 1.12, gear: ['legs', 'feet', 'body', 'arms', 'pauldron'] })
  if (!rig) return null
  // 어둠에 묻히면 안 된다. 스스로 빛나게 해서 형체가 보이게.
  for (const m of rig.mats) {
    m.transparent = true
    m.opacity = 0.85
    if (m.emissive) { m.emissive.set('#6a56a8'); m.emissiveIntensity = 1.0 }
  }
  const g = new THREE.Group()
  g.add(rig.root)
  // 발밑에서 올라오는 빛
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 44),
    new THREE.MeshBasicMaterial({ color: '#a98ce0', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  pool.rotation.x = -Math.PI / 2
  pool.position.y = 0.04
  g.add(pool)
  game.render3d.scene.add(g)
  return { group: g, rig, pool }
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

  const shade = makeShade(game)
  if (shade) {
    shade.group.position.set(0, -3.2, -5.4)
    shade.group.rotation.y = 0
  }

  const fade = document.createElement('div')
  fade.style.cssText = 'position:absolute;inset:0;background:#05040a;z-index:58;pointer-events:none'
  game.uiRoot.appendChild(fade)

  let t = 0
  let ash = 0
  return {
    tick(dt) {
      t += dt
      const k = t / INTRO_TIME

      fade.style.opacity = String(clamp(1 - t / 1.2, 0, 1))

      // 걸어 들어간다 — 애니메이션은 달리기 클립이 맡는다
      const walk = clamp((t - 0.6) / 2.8, 0, 1)
      p.pos.z = start.z + (-3.2 - start.z) * (walk * walk * (3 - 2 * walk))   // smoothstep
      p._run = walk > 0 && walk < 1 ? 0.55 : 0
      p.facing = Math.PI

      // 재가 피어오른다
      ash -= dt
      if (ash <= 0) {
        ash = 0.05
        game.particles.shed(
          p.pos.x + (Math.random() - 0.5) * 14, 0.2 + Math.random() * 2.4,
          p.pos.z + (Math.random() - 0.5) * 10, '#8a7bb0', 0.1)
      }

      // 그림자가 일어선다
      if (shade) {
        const rise = clamp((t - 2.4) / 1.6, 0, 1)
        shade.group.position.y = -3.2 + rise * 3.2
        shade.pool.material.opacity = 0.06 + rise * 0.34
        shade.rig.pose({ t, run: 0, attack: null, draw: null, roll: 0, dead: false, flinch: 0 }, dt)
        if (rise > 0 && rise < 1 && Math.random() < 0.5) {
          game.particles.shed(shade.group.position.x + (Math.random() - 0.5) * 2.4,
            0.2 + Math.random() * 2.6, shade.group.position.z + (Math.random() - 0.5) * 1.6, '#b49ce8', 0.12)
        }
      }

      // 카메라가 그림자 쪽으로 밀고 들어간다
      game.render3d.zoom = clamp((t - 4.0) / 1.2, 0, 1) * 0.55

      return k >= 1
    },
    dispose() {
      fade.remove()
      game.render3d.zoom = 0
      if (shade) game.render3d.scene.remove(shade.group)
    },
  }
}
