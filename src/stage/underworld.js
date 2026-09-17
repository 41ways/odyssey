import * as THREE from 'three'
import { buildMaze, blocked } from './maze.js'
import { makeShade } from '../enemy/shade.js'

/**
 * 저승 — 걸어 들어가고, 부르고, 쫓겨 나온다.
 *
 * 전에는 판에 들어서자마자 컷씬이 돌고 유물을 골랐다. 그러면 저승은
 * '거쳐 가는 화면' 이지 '다녀온 곳' 이 아니다. 여기만 싸움이 없으니까
 * 오히려 **길이 이야기를 해야 한다.**
 *
 *   1) 굽은 길을 걸어 들어간다 — 곧장 못 간다
 *   2) 구덩이 앞에 서서 **직접 누른다** — 부른 건 나다
 *   3) 아가멤논이 올라오고, 유물을 고른다
 *   4) 망자들이 깨어난다. 왔던 길을 그대로 되짚어 나간다
 *
 * 4번이 있어야 3번이 값을 한다. 받고 바로 다음 판으로 넘어가면
 * 유물은 그냥 주운 것이 되고, 쫓겨 나오면 가져 나온 것이 된다.
 */

const PIT_R = 2.4           // 구덩이 반지름
const REACH = 3.6           // 이만큼 가까워야 누를 수 있다
/**
 * 입구에서 몇 칸 안쪽에 세울 것인가.
 *
 * 맨 끝 칸에 세우면 등 뒤가 곧장 판 밖이라 화면 아래 절반이 허공이 된다.
 * 두 칸 물리면 뒤에도 바닥이 남아서 '방 안에 서 있다' 가 된다.
 * 나가는 판정은 그래서 시작점이 아니라 맨 끝 칸이 맡는다.
 */
const START_IN = 2

export class Underworld {
  /**
   * @param g     Game
   * @param seed  길 모양. 같은 씨앗이면 같은 길이다
   */
  constructor(g, seed = 7) {
    this.g = g
    this.maze = buildMaze({ extent: (g.render3d.arena?.R ?? 14) - 0.6, seed })
    this.phase = 'in'         // 'in' → 'called' → 'out' → 'done'
    this.shades = []
    this.t = 0
    this.wave = 0
  }

  /** 판을 세운다. 벽을 올리고, 구덩이를 파고, 플레이어를 입구에 놓는다. */
  enter() {
    const g = this.g
    g.render3d.setMaze(this.maze.walls)
    g.mazeWalls = this.maze.walls        // actor 가 여기를 본다

    const p = this.maze.lane[Math.min(START_IN, this.maze.lane.length - 1)]
    // 나가는 줄은 길의 맨 끝 칸이다. 숫자로 적어 두면 판 크기를 바꿀 때 어긋난다.
    this.exitZ = this.maze.start.z - 0.4
    g.player.pos.set(p.x, 0, p.z)
    g.player.vel.set(0, 0, 0)
    g.player.facing = Math.atan2(this.maze.goal.x - p.x, this.maze.goal.z - p.z)

    this.#digPit()
    g.hud.banner('저승', '피를 부을 구덩이를 찾아라', 3.2)
  }

  /** 구덩이. 바닥에 팬 자리와 그 위로 도는 붉은 김. */
  #digPit() {
    const { x, z } = this.maze.goal
    const grp = new THREE.Group()
    grp.position.set(x, 0, z)

    // 팬 자리
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(PIT_R, 40),
      new THREE.MeshBasicMaterial({ color: '#12060a' }),
    )
    hole.rotation.x = -Math.PI / 2
    hole.position.y = 0.03
    grp.add(hole)

    // 테두리 — 여기가 뭔가 있는 자리라는 표시. 누를 수 있을 때 밝아진다.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(PIT_R * 0.86, PIT_R * 1.04, 44),
      new THREE.MeshBasicMaterial({
        color: '#b8324a', transparent: true, opacity: 0.4,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.05
    grp.add(ring)

    // 김. 위로 서는 붉은 기둥 하나 — 멀리서도 '저기다' 가 읽혀야 한다
    // 길 반대쪽 끝에서도 보여야 한다 — 어디로 가는지 모르면 미로가 아니라
    // 그냥 막힌 마당이다. 23 유닛 밖에서도 읽히게 높고 진하게 세운다.
    const haze = new THREE.Mesh(
      new THREE.CylinderGeometry(PIT_R * 0.42, PIT_R * 0.95, 16, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#c0364e', transparent: true, opacity: 0.2,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    )
    haze.position.y = 8
    grp.add(haze)

    // 불빛. 기둥이 화면 밖으로 나가도 둘레 벽이 붉게 물들어서
    // "저쪽에 뭔가 있다" 가 남는다 — 표지는 보이는 것보다 새어 나오는 게 낫다.
    const lamp = new THREE.PointLight('#d0405a', 26, 20, 2)
    lamp.position.y = 2.2
    grp.add(lamp)
    this.lamp = lamp

    this.g.render3d.scene.add(grp)
    this.pit = { grp, ring, haze, x, z }
  }

  /** 구덩이를 누를 수 있는가 — 가까이 있고, 아직 안 불렀을 때. */
  get canCall() {
    if (this.phase !== 'in' || !this.pit) return false
    const p = this.g.player.pos
    return Math.hypot(p.x - this.pit.x, p.z - this.pit.z) <= REACH
  }

  /** 마우스를 눌렀다. 구덩이 차례면 true 를 돌려 준다 — 그러면 칼이 안 나간다. */
  click() {
    if (!this.canCall) return false
    this.phase = 'called'
    this.g.onUnderworldCall?.()
    return true
  }

  /** 유물을 고르고 나서. 망자들이 깨어난다. */
  chased() {
    this.phase = 'out'
    this.t = 0
    this.wave = 0
    this.g.hud.banner('돌아가라', '망자들이 깨어났다 — 왔던 길로', 3.0)
    // 구덩이는 식는다. 볼일이 끝났다.
    if (this.pit) {
      this.pit.ring.material.color.set('#4a2a34')
      this.pit.haze.material.opacity = 0.05
      if (this.lamp) this.lamp.intensity = 4
    }
  }

  update(dt) {
    if (this.phase === 'done') return
    this.t += dt
    const g = this.g

    // 누를 수 있으면 테두리가 뛴다. 누를 수 없으면 가라앉는다.
    if (this.pit) {
      const near = this.canCall
      const want = near ? 0.55 + Math.sin(this.t * 5.5) * 0.28 : 0.3
      const m = this.pit.ring.material
      m.opacity += (want - m.opacity) * Math.min(1, dt * 8)
      this.pit.haze.rotation.y += dt * 0.5
    }

    if (this.phase === 'in') {
      // 구덩이 앞에 서면 무엇을 눌러야 하는지 한 번 알려 준다
      if (this.canCall && !this._told) {
        this._told = true
        g.hud.banner('구덩이', '눌러서 피를 붓는다', 2.4)
      }
      return
    }

    if (this.phase !== 'out') return

    // ── 쫓기는 구간 ────────────────────────────────────────
    // 길 북쪽 끝에서부터 차례로 깨어나 밀고 내려온다.
    const due = Math.floor(this.t / 1.5)
    while (this.wave < due && this.wave < 9) {
      this.#wake(this.wave)
      this.wave++
    }

    // 남쪽 줄을 넘으면 끝이다
    if (g.player.pos.z >= this.exitZ) this.#leave()
  }

  /** 망자 하나를 길 위에서 깨운다. 플레이어보다 북쪽에서만 나온다. */
  #wake(i) {
    const g = this.g
    const lane = this.maze.lane
    // 길의 북쪽 절반 어딘가 — 플레이어 뒤에서 나와야 '쫓긴다' 가 된다
    const pick = lane[Math.min(lane.length - 1, 1 + (i * 2) % Math.max(1, lane.length - 2))]
    let x = pick.x + (Math.random() - 0.5) * 2.2
    let z = Math.min(pick.z, g.player.pos.z - 4)
    if (blocked(x, z, 0.6, this.maze.walls)) { x = pick.x; z = pick.z }

    const s = makeShade(g, g.fx)
    s.pos.set(x, 0, z)
    s.facing = Math.atan2(g.player.pos.x - x, g.player.pos.z - z)
    g.track(s)
    this.shades.push(s)
    g.fx.ring(x, z, { color: '#6fa8ff', radius: 1.5, life: 0.6 })
  }

  #leave() {
    this.phase = 'done'
    this.onOut?.()
  }

  /** 판을 걷는다. 벽도 구덩이도 망자도 두고 가면 다음 판에 남는다. */
  dispose() {
    const g = this.g
    g.render3d.setMaze(null)
    g.mazeWalls = null
    if (this.pit) {
      g.render3d.scene.remove(this.pit.grp)
      this.pit.grp.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() })
      this.pit = null
    }
    for (const s of this.shades) s.dead || s.die?.()
    this.shades.length = 0
  }
}
