import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { makeOcean } from '../render/ocean.js'
import { models } from '../render/models.js'

/**
 * 항해 시험 화면 — 파도 바다 위에 배 한 척.
 *
 * 게임에 넣기 전에 바다와 배의 관계(오르내림·기울기·속도감)만 따로 맞춰 보는 자리.
 * 개발 서버에서 /sail.html 로 연다. 빌드에는 안 들어간다.
 */
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.55
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2('#9fb3c2', 0.0045)
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 3000)

// 하늘 — 바다가 비출 것
const sun = new THREE.Vector3()
const sky = new Sky()
sky.scale.setScalar(10000)
const su = sky.material.uniforms
su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.82
sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 22), THREE.MathUtils.degToRad(200))
su.sunPosition.value.copy(sun)
scene.add(sky)
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(sky).texture

scene.add(new THREE.HemisphereLight('#bcd4ea', '#2a3036', 1.2))
const key = new THREE.DirectionalLight('#fff0d8', 2.4)
key.position.copy(sun).multiplyScalar(50)
scene.add(key)

let ocean = null
const setSea = name => {
  if (ocean) { scene.remove(ocean.mesh); ocean.mesh.geometry.dispose(); ocean.mesh.material.dispose() }
  ocean = makeOcean({ sea: name, sun: sun.clone().normalize() })
  scene.add(ocean.mesh)
}
setSea('calm')

// 배
await models.preload(['galley'])
const made = models.create('galley')
const ship = new THREE.Group()
if (made) ship.add(made.root)
else ship.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 7), new THREE.MeshStandardMaterial({ color: '#3a2a1c' })))
scene.add(ship)

const state = { x: 0, z: 0, heading: 0, speed: 0, sail: 0, rudder: 0, pitch: 0, roll: 0, y: 0 }
const keys = new Set()
addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'Digit1') setSea('calm'); if (e.code === 'Digit2') setSea('rough') })
addEventListener('keyup', e => keys.delete(e.code))
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) })

/**
 * 배가 파도를 탄다.
 * 뱃머리·고물·좌현·우현 네 점의 수면 높이를 재서, 평균이 높이, 앞뒤 차가
 * 들림(피치), 좌우 차가 기울기(롤)다. 한 점의 법선만 보면 짧은 잔물결에
 * 배가 파르르 떤다 — 배 길이만큼 떨어진 점을 봐야 긴 파도만 탄다.
 */
const LEN = 3.2, BEAM = 1.1
const fwd = new THREE.Vector3(), side = new THREE.Vector3()
function ride(dt) {
  fwd.set(Math.sin(state.heading), 0, Math.cos(state.heading))
  side.set(fwd.z, 0, -fwd.x)
  const h = (dx, dz) => ocean.at(state.x + dx, state.z + dz).y
  const bow = h(fwd.x * LEN, fwd.z * LEN), stern = h(-fwd.x * LEN, -fwd.z * LEN)
  const port = h(side.x * BEAM, side.z * BEAM), star = h(-side.x * BEAM, -side.z * BEAM)
  const k = Math.min(1, dt * 4)
  state.y += ((bow + stern + port + star) / 4 - state.y) * k
  state.pitch += (Math.atan2(stern - bow, LEN * 2) - state.pitch) * k
  state.roll += (Math.atan2(port - star, BEAM * 2) * 0.8 - state.roll) * k
}

camera.position.set(0, 16, -22)
camera.lookAt(0, 0, 6)
const clock = new THREE.Clock()
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20)
  ocean.update(dt)
  // 돛과 키
  if (keys.has('KeyW')) state.sail = Math.min(1, state.sail + dt * 0.6)
  if (keys.has('KeyS')) state.sail = Math.max(0, state.sail - dt * 0.8)
  const want = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0)
  state.rudder += (want - state.rudder) * Math.min(1, dt * 3)
  state.speed += (state.sail * 9 - state.speed) * Math.min(1, dt * 0.7)       // 배는 천천히 붙고 천천히 선다
  state.heading += state.rudder * dt * 0.5 * Math.min(1, state.speed / 3 + 0.15)
  state.x += Math.sin(state.heading) * state.speed * dt
  state.z += Math.cos(state.heading) * state.speed * dt
  ride(dt)
  ship.position.set(state.x, state.y - 0.35, state.z)
  ship.rotation.set(0, 0, 0)
  ship.rotateY(state.heading)
  ship.rotateX(state.pitch)
  ship.rotateZ(state.roll - state.rudder * state.speed * 0.012)     // 돌 때 바깥으로 기운다
  // 바다는 배를 따라 움직인다 (무한한 바다처럼 보이게) — 파도 식은 월드 좌표라 이어진다
  ocean.mesh.position.set(Math.round(state.x / 8) * 8, 0, Math.round(state.z / 8) * 8)
  // 게임과 같은 결의 비스듬한 위쪽 시점, 뱃머리 앞쪽을 조금 더 보여 준다
  const cx = state.x - Math.sin(state.heading) * 22, cz = state.z - Math.cos(state.heading) * 22
  camera.position.lerp(new THREE.Vector3(cx, 16, cz), Math.min(1, dt * 2))
  camera.lookAt(state.x + Math.sin(state.heading) * 6, 0, state.z + Math.cos(state.heading) * 6)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
frame()
window.__sail = { state, keys }
