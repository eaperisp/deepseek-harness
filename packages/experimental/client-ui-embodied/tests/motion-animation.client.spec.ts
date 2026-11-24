// @vitest-environment jsdom
/** The measured lift, odometry and joint targets advance on intermediate render frames. */
import { Group } from 'three'
import { expect, it, vi } from 'vitest'
import { mountRobotScene } from '../src/client/robot-scene.ts'

const handles = vi.hoisted(() => ({ parse: vi.fn(), render: vi.fn() }))
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { parseAsync = handles.parse } }))
vi.mock('three', async original => ({
  ...await original<typeof import('three')>(),
  WebGLRenderer: class { setPixelRatio = vi.fn(); setSize = vi.fn(); render = handles.render; dispose = vi.fn() },
}))

it('interpolates all three measured axes, handles the yaw wrap and cancels the pending frame on disposal', async () => {
  const root = new Group()
  const link = (name: string, parent: Group) => { const node = new Group(); node.name = name; parent.add(node); return node }
  const middle = link('LZ_mt_Link', root)
  const inner = link('LZ_it_Link', middle)
  const elbow = link('right_elbow_link', inner)
  handles.parse.mockResolvedValue({ scene: root })
  const frames = new Map<number, FrameRequestCallback>()
  let sequence = 0
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('fetch', async () => new Response(new ArrayBuffer(0)))
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('ResizeObserver', class { observe() {}; disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++sequence, fn); return sequence })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const step = (time: number) => {
    now = time
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((fn) => { fn(now) })
  }
  try {
    const scene = await mountRobotScene(document.createElement('canvas'), new AbortController().signal)
    const sample = (yaw: number, angle: number) => ({ ticket: 'test', actions: [], receipt: null, lift: null,
      base: { frame: 'odom', x: 0, y: 0, yaw }, joints: { right_elbow_joint: angle } })
    scene.setPose(sample(Math.PI - .05, 0))
    scene.setExtension(.2)
    step(0)
    scene.setPose(sample(-Math.PI + .05, 1))
    scene.setExtension(.3)
    step(225)
    expect(inner.position.z + middle.position.z).toBeGreaterThan(.2)
    expect(inner.position.z + middle.position.z).toBeLessThan(.3)
    expect(root.rotation.y).toBeGreaterThan(0)
    expect(root.rotation.y).toBeLessThan(.1)
    expect(elbow.rotation.y).toBeGreaterThan(0)
    expect(elbow.rotation.y).toBeLessThan(1)
    step(450)
    expect(inner.position.z + middle.position.z).toBeCloseTo(.3)
    expect(root.rotation.y).toBeCloseTo(.1)
    expect(elbow.rotation.y).toBeCloseTo(1)
    scene.setExtension(.2)
    scene.dispose()
    expect(frames.size).toBe(0)
  } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})
