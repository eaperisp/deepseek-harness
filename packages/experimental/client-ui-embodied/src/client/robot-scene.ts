/** Meter-scale rendering of the installed G1-D reference model and lift stages. */
import {
  Box3, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Scene, Vector3, WebGLRenderer, type Material, type Object3D,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { MotionState } from './motion.ts'

/** Mounted scene handle owned by one viewport. */
export interface RobotScene {
  setExtension: (meters: number) => void
  setPose: (pose: NonNullable<MotionState>) => void
  reset: () => void
  dispose: () => void
}

/**
 * Project the total lift travel onto the model's two serial prismatic stages.
 * @param model - G1-D GLB scene exported from the retracted URDF in metres.
 * @returns Setter for the total displacement of the inner stage in metres.
 */
export function bindLift(model: Object3D): (extensionMeters: number) => void {
  const middle = model.getObjectByName('LZ_mt_Link')
  const inner = model.getObjectByName('LZ_it_Link')
  if (!middle || !inner || inner.parent !== middle) throw new Error('G1-D lift hierarchy is missing')
  const middleZ = middle.position.z
  const innerZ = inner.position.z
  return (extensionMeters) => {
    middle.position.z = middleZ + extensionMeters / 2
    inner.position.z = innerZ + extensionMeters / 2
  }
}

function isMesh(object: Object3D): object is Mesh {
  return object instanceof Mesh
}

function disposeMeshes(model: Object3D): void {
  const materials = new Set<Material>()
  model.traverse((object) => {
    if (!isMesh(object)) return
    object.geometry.dispose()
    for (const material of [object.material].flat()) materials.add(material)
  })
  for (const material of materials) material.dispose()
}

function applyMaterials(model: Object3D): void {
  const shell = new MeshStandardMaterial({ color: 0xb6c3d7, metalness: .34, roughness: .42 })
  const chassis = new MeshStandardMaterial({ color: 0x3d4d68, metalness: .28, roughness: .47 })
  const column = new MeshStandardMaterial({ color: 0x6b9dce, metalness: .42, roughness: .34 })
  const originals = new Set<Material>()
  model.traverse((object) => {
    if (!isMesh(object)) return
    for (const material of [object.material].flat()) originals.add(material)
    if (/LZ_/.test(object.name)) object.material = column
    else if (/Wheel|Caster|AGV|camera|Lidar/i.test(object.name)) object.material = chassis
    else object.material = shell
  })
  for (const material of originals) material.dispose()
}

/**
 * Load and mount the dashboard's installed, self-contained G1-D GLB.
 * @param canvas - viewport-owned canvas.
 * @param signal - viewport lifetime and cancellation.
 * @returns Scene controls, or a failure when the asset or renderer is unavailable.
 */
export async function mountRobotScene(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<RobotScene> {
  const url = new URL('robot-models/g1-d.glb', document.baseURI)
  const response = await fetch(url, { signal, redirect: 'error' })
  if (!response.ok) throw new Error('G1-D model asset is unavailable')
  const { scene: model } = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')
  let renderer: WebGLRenderer
  let setExtension: (meters: number) => void
  try {
    signal.throwIfAborted()
    setExtension = bindLift(model)
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch (cause) {
    disposeMeshes(model)
    throw cause
  }
  applyMaterials(model)
  const arm = new Map<string, (angle: number) => void>()
  for (const side of ['left', 'right']) {
    for (const [joint, axis] of Object.entries({
      shoulder_pitch: 'y', shoulder_roll: 'x', shoulder_yaw: 'z', elbow: 'y', wrist_roll: 'x', wrist_pitch: 'y', wrist_yaw: 'z',
    } as const)) {
      const link = model.getObjectByName(side + '_' + joint + '_link')
      if (!link) continue
      const rest = link.quaternion.clone()
      const direction = new Vector3()
      direction[axis] = 1
      arm.set(side + '_' + joint + '_joint', (angle) => {
        link.quaternion.copy(rest)
        link.rotateOnAxis(direction, angle)
      })
    }
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const scene = new Scene()
  scene.add(model, new HemisphereLight(0xeff7ff, 0x657290, 2.4))
  const key = new DirectionalLight(0xffffff, 3)
  key.position.set(3, 5, 4)
  const fill = new DirectionalLight(0x829fff, 1.25)
  fill.position.set(-4, 1, -3)
  scene.add(key, fill)
  const bounds = new Box3().setFromObject(model)
  const grid = new GridHelper(4, 20, 0x425d84, 0x263d5f)
  grid.position.y = bounds.min.y - .01
  scene.add(grid)

  const center = bounds.getCenter(new Vector3())
  const diameter = bounds.getSize(new Vector3()).length()
  const camera = new PerspectiveCamera(38, 1, .02, 40)
  const home = new Vector3(1.3, .7, 1.8).normalize().multiplyScalar(diameter * 1.9)
  const controls = new OrbitControls(camera, canvas)
  const follow = new Vector3()
  controls.enablePan = false
  controls.minDistance = diameter * .7
  controls.maxDistance = diameter * 4
  const render = () => { renderer.render(scene, camera) }
  const reset = () => {
    controls.target.copy(center).add(follow).add(new Vector3(0, .16, 0))
    camera.position.copy(controls.target).add(home)
    controls.update()
  }
  const resize = () => {
    const { clientWidth, clientHeight } = canvas
    if (clientWidth === 0 || clientHeight === 0) return
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
    render()
  }
  controls.addEventListener('change', render)
  reset()
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  const tracks = new Map<string, { value: number; from: number; to: number; start: number; apply: (n: number) => void }>()
  let frame = 0
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const draw = (now: number) => {
    frame = 0
    let moving = false
    for (const track of tracks.values()) {
      if (track.value === track.to) continue
      const t = Math.min(1, Math.max(0, (now - track.start) / 450))
      track.value = t === 1 ? track.to : track.from + (track.to - track.from) * t * (2 - t)
      track.apply(track.value)
      moving ||= t < 1
    }
    const shift = model.position.clone().sub(model.position.clone().clampLength(0, .3)).sub(follow)
    follow.add(shift)
    camera.position.add(shift)
    controls.target.add(shift)
    grid.position.x = Math.round(model.position.x / .2) * .2
    grid.position.z = Math.round(model.position.z / .2) * .2
    render()
    if (moving) frame = requestAnimationFrame(draw)
  }
  const trackTo = (key: string, next: number, apply: (n: number) => void) => {
    const prior = tracks.get(key)
    if (prior?.to === next) return
    const current = prior && !reduced.matches ? prior.value : next
    tracks.set(key, { value: current, from: current, to: next, start: performance.now(), apply })
    if (current === next) apply(next)
    if (!frame) frame = requestAnimationFrame(draw)
  }
  let origin: NonNullable<MotionState>['base'] = null
  return {
    setPose({ joints, base }) {
      if (joints) {
        for (const [name, apply] of arm) {
          const angle = joints[name]
          if (angle !== undefined) trackTo(name, angle, apply)
        }
      }
      if (!base) return
      if (origin?.frame !== base.frame) origin = base
      const dx = base.x - origin.x
      const dy = base.y - origin.y
      const c = Math.cos(origin.yaw)
      const s = Math.sin(origin.yaw)
      trackTo('x', dx * c + dy * s, (n) => { model.position.x = n })
      trackTo('z', dx * s - dy * c, (n) => { model.position.z = n })
      const delta = base.yaw - origin.yaw - model.rotation.y
      trackTo('yaw', model.rotation.y + Math.atan2(Math.sin(delta), Math.cos(delta)), (n) => { model.rotation.y = n })
    },
    setExtension(meters) { trackTo('lift', meters, setExtension) },
    reset,
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      grid.dispose()
      disposeMeshes(model)
      renderer.dispose()
    },
  }
}
