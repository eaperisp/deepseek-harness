/** Calibrated feedback drives the exact total advance of the two lift stages. */
import { inspectionSchema } from '@deepseek-ai/dsh-robot/model'
import { Group, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { readLiftFeedback } from '../src/client/lift-feedback.ts'
import { bindLift } from '../src/client/robot-scene.ts'

function liftSnapshot(height: number, calibrated = true) {
  return inspectionSchema.parse({ providers: [{
    kind: 'available', provider: { id: 'g1d', name: 'G1-D' }, capabilities: [{
      id: 'lift', name: 'Lift', description: 'Measured height', category: 'actuator', status: { kind: 'ready' }, operations: [],
      evidence: { facts: { ok: true, offset_valid: calibrated, physical_height_m: height, physical_min_m: 0.12, physical_max_m: 0.52 } },
    }],
  }] }).providers[0]!
}

it('advances the upper model by 10 cm while the base remains stationary', () => {
  const root = new Group()
  const column = new Group()
  column.rotateX(-Math.PI / 2)
  const middle = new Group()
  middle.name = 'LZ_mt_Link'
  const inner = new Group()
  inner.name = 'LZ_it_Link'
  root.add(column)
  column.add(middle)
  middle.add(inner)

  const update = bindLift(root)
  update(readLiftFeedback(liftSnapshot(0.25))!.extensionMeters)
  const before = inner.getWorldPosition(new Vector3()).y
  update(readLiftFeedback(liftSnapshot(0.35))!.extensionMeters)
  expect(inner.getWorldPosition(new Vector3()).y - before).toBeCloseTo(0.1)
  expect(column.getWorldPosition(new Vector3()).y).toBe(0)
})

it('rejects uncalibrated and out-of-range feedback', () => {
  expect(readLiftFeedback(liftSnapshot(0.25, false))).toBeNull()
  expect(readLiftFeedback(liftSnapshot(0.7))).toBeNull()
})
