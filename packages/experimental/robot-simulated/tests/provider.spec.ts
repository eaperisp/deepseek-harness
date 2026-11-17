import { describe, expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { RobotCapabilityId, RobotOperationId } from '@deepseek-ai/dsh-robot'
import { SimulatedRobotProvider } from '../src/provider.ts'

const capabilityId = (value: string): RobotCapabilityId => brandString<RobotCapabilityId>(value)
const operationId = (value: string): RobotOperationId => brandString<RobotOperationId>(value)

describe('SimulatedRobotProvider', () => {
  it('exposes sensors, perception, gripper, and mobility and preserves action state', async () => {
    const provider = new SimulatedRobotProvider({
      providerId: 'simulated', providerName: 'Test robot', obstacleDistanceMeters: 1.4, recognizedObjectLabel: 'box',
    })
    const signal = new AbortController().signal
    const capabilities = await provider.discover(signal)
    expect(capabilities.map(capability => [capability.id, capability.category])).toEqual([
      ['radar', 'sensor'], ['camera', 'sensor'], ['object_recognition', 'perception'],
      ['spatial_perception', 'perception'], ['gripper', 'actuator'], ['mobile_base', 'mobility'],
    ])

    await provider.execute({
      capabilityId: capabilityId('mobile_base'), operationId: operationId('move_relative'),
      arguments: { linear_meters: 1, angular_degrees: 90 },
    }, signal)
    const pose = await provider.execute({
      capabilityId: capabilityId('spatial_perception'), operationId: operationId('localize'), arguments: {},
    }, signal)
    expect(pose).toEqual({
      kind: 'completed', summary: 'Robot pose read',
      output: { frame: 'local_map', xMeters: 1, yMeters: 0, headingDegrees: 90 },
    })

    await expect(provider.execute({
      capabilityId: capabilityId('radar'), operationId: operationId('scan'), arguments: {},
    }, signal)).resolves.toMatchObject({ output: { nearestObstacle: { distanceMeters: 1.4 } } })
    await expect(provider.execute({
      capabilityId: capabilityId('camera'), operationId: operationId('capture_summary'), arguments: {},
    }, signal)).resolves.toMatchObject({ output: { width: 1280, scene: 'A box is visible ahead.' } })
    await expect(provider.execute({
      capabilityId: capabilityId('object_recognition'), operationId: operationId('recognize_objects'), arguments: {},
    }, signal)).resolves.toMatchObject({ output: { objects: [{ label: 'box' }] } })
    await expect(provider.execute({
      capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'), arguments: { opening_percent: 30 },
    }, signal)).resolves.toMatchObject({ output: { previousOpeningPercent: 100, openingPercent: 30 } })
    await expect(provider.execute({
      capabilityId: capabilityId('mobile_base'), operationId: operationId('move_relative'),
      arguments: { linear_meters: 1, angular_degrees: 300 },
    }, signal)).resolves.toMatchObject({ output: { xMeters: 1, yMeters: 1, headingDegrees: 30 } })
    expect(() => provider.execute({
      capabilityId: capabilityId('missing'), operationId: operationId('missing'), arguments: {},
    }, signal)).toThrow('unsupported simulated robot operation')
    expect(() => provider.execute({
      capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'), arguments: { opening_percent: 'wide' },
    }, signal)).toThrow('opening_percent must be a number')
  })
})
