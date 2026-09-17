import * as THREE from 'three'

/**
 * WASD(또는 방향키) 이동, 좌클릭 칼, 우클릭 활, 스페이스 구르기, 마우스로 조준.
 *
 * 입력 버퍼가 핵심이다. 회복 동작 중에 누른 입력을 0.22초 동안 들고 있다가
 * 다음 캔슬 창이 열리는 순간 꺼내 쓴다. 이게 없으면 조작이 통째로 뻑뻑해진다.
 */
const BUFFER = 0.22

const KEYMAP = {
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Space: 'roll',
}

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas
    this.camera = camera
    this.held = new Set()
    this.buffer = new Map()   // action -> 남은 버퍼 시간
    this.mouse = new THREE.Vector2(0, 0)      // NDC
    this.aim = new THREE.Vector3(0, 0, 4)     // 월드 평면 위 조준점
    this.pointerInside = true

    this._ray = new THREE.Raycaster()
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

    addEventListener('keydown', e => {
      const a = KEYMAP[e.code]
      if (!a) return
      e.preventDefault()
      if (!this.held.has(a)) this.buffer.set(a, BUFFER)
      this.held.add(a)
    })
    addEventListener('keyup', e => {
      const a = KEYMAP[e.code]
      if (a) { e.preventDefault(); this.held.delete(a) }
    })
    addEventListener('blur', () => this.held.clear())

    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect()
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    })
    canvas.addEventListener('pointerleave', () => { this.pointerInside = false })
    canvas.addEventListener('pointerenter', () => { this.pointerInside = true })
    canvas.addEventListener('pointerdown', e => {
      const a = e.button === 0 ? 'slash' : e.button === 2 ? 'bow' : null
      if (!a) return
      if (!this.held.has(a)) this.buffer.set(a, BUFFER)
      this.held.add(a)
    })
    // 캔버스 밖에서 떼도 풀려야 한다. 안 그러면 활이 계속 당겨진 채로 남는다.
    addEventListener('pointerup', e => {
      const a = e.button === 0 ? 'slash' : e.button === 2 ? 'bow' : null
      if (a) this.held.delete(a)
    })
    canvas.addEventListener('contextmenu', e => e.preventDefault())
  }

  /** 방향키 입력을 월드 방향 벡터로. 카메라 yaw 가 0 으로 고정이라 축이 그대로 맞는다. */
  moveVector(out) {
    let x = 0, z = 0
    if (this.held.has('left')) x -= 1
    if (this.held.has('right')) x += 1
    if (this.held.has('up')) z -= 1
    if (this.held.has('down')) z += 1
    out.set(x, 0, z)
    if (out.lengthSq() > 0) out.normalize()
    return out
  }

  /** 마우스가 가리키는 바닥 지점. 조준과 시선 방향의 기준. */
  updateAim() {
    this._ray.setFromCamera(this.mouse, this.camera)
    const hit = this._ray.ray.intersectPlane(this._plane, this.aim)
    if (!hit) this.aim.set(0, 0, 0)
    return this.aim
  }

  isHeld(a) { return this.held.has(a) }

  /** 버퍼에 들어있으면 꺼내 쓰고 지운다. */
  consume(a) {
    if (!this.buffer.has(a)) return false
    this.buffer.delete(a)
    return true
  }

  peek(a) { return this.buffer.has(a) }

  update(dt) {
    for (const [a, t] of this.buffer) {
      const n = t - dt
      if (n <= 0) this.buffer.delete(a)
      else this.buffer.set(a, n)
    }
  }
}
