import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import RobotRuntime, {
  RobotError,
  type RobotCapability,
  type RobotCapabilityId,
  type RobotOperationId,
  type RobotProvider,
  type RobotProviderId,
  type RobotWorkflowDefinition,
  type RobotWorkflowId,
  type RobotWorkflowRequirementId,
  type RobotWorkflowStageId,
} from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(context => context.fiber.dispose()))
})

async function setup(): Promise<Context> {
  const context = new Context()
  contexts.push(context)
  await context.plugin(RobotRuntime)
  return context
}

const providerId = (value: string): RobotProviderId => brandString<RobotProviderId>(value)
const capabilityId = (value: string): RobotCapabilityId => brandString<RobotCapabilityId>(value)
const operationId = (value: string): RobotOperationId => brandString<RobotOperationId>(value)
const workflowId = (value: string): RobotWorkflowId => brandString<RobotWorkflowId>(value)
const requirementId = (value: string): RobotWorkflowRequirementId => brandString<RobotWorkflowRequirementId>(value)
const stageId = (value: string): RobotWorkflowStageId => brandString<RobotWorkflowStageId>(value)

function capability(): RobotCapability {
  return {
    id: capabilityId('gripper'),
    name: 'Gripper',
    description: 'Test gripper',
    category: 'actuator',
    status: { kind: 'ready' },
    operations: [{
      id: operationId('set_opening'),
      name: 'Set opening',
      description: 'Set gripper opening',
      mode: 'act',
      arguments: [{ name: 'percent', description: 'Opening', type: 'number', required: true, minimum: 0, maximum: 100 }],
    }],
  }
}

function provider(id: string, discover: RobotProvider['discover'] = () => Promise.resolve([capability()])): RobotProvider {
  return {
    info: { id: providerId(id), name: id },
    discover,
    execute: request => Promise.resolve({ kind: 'completed', output: { arguments: request.arguments } }),
  }
}

describe('RobotRuntime', () => {
  it('resolves standard workflows without executing robot operations', async () => {
    const context = await setup()
    let executions = 0
    context.robot.register({ ...provider('robot'), execute: (request) => {
      executions += 1
      return Promise.resolve({ kind: 'completed', output: { arguments: request.arguments } })
    } })
    expect(context.robot.listWorkflows().map(workflow => workflow.id)).toEqual([
      'spatial-memory', 'simulation', 'hand-eye-calibration', 'gravity-compensation',
    ])
    const result = await context.robot.inspectWorkflows(new AbortController().signal, workflowId('gravity-compensation'))
    expect(result.workflows).toHaveLength(1)
    expect(result.workflows[0]).toMatchObject({ status: 'blocked', workflow: { id: 'gravity-compensation' } })
    expect(result.workflows[0]?.requirements.every(requirement => requirement.kind === 'missing')).toBe(true)
    expect(executions).toBe(0)
  })

  it('registers portable workflows, ranks ready alternatives, and removes them by lifetime', async () => {
    const context = await setup()
    context.robot.register(provider('robot'))
    const workflow: RobotWorkflowDefinition = {
      id: workflowId('gripper-check'), name: 'Gripper check', description: 'Check gripper adapter.', category: 'calibration',
      requirements: [{
        id: requirementId('opening'), name: 'Opening command', description: 'Set an opening.', required: true,
        alternatives: [{ capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'), mode: 'act' }],
      }],
      stages: [{ id: stageId('inspect'), name: 'Inspect', description: 'Inspect readiness.', requirementIds: [requirementId('opening')], verification: ['Operation is ready.'] }],
    }
    const unregister = context.robot.registerWorkflow(workflow)
    await expect(context.robot.inspectWorkflows(new AbortController().signal, workflow.id)).resolves.toMatchObject({
      workflows: [{ status: 'ready', requirements: [{ kind: 'ready', selection: { providerId: 'robot', capabilityId: 'gripper', operationId: 'set_opening', mode: 'act' } }] }],
    })
    unregister()
    unregister()
    await expect(context.robot.inspectWorkflows(new AbortController().signal, workflow.id)).rejects.toMatchObject({ code: 'ROBOT_WORKFLOW_NOT_FOUND' })
  })

  it('rejects invalid and duplicate workflow definitions', async () => {
    const context = await setup()
    const missingRequirement: RobotWorkflowDefinition = {
      id: workflowId('invalid'), name: 'Invalid', description: 'Invalid', category: 'simulation',
      requirements: [{ id: requirementId('known'), name: 'Known', description: 'Known', required: true, alternatives: [{ capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'), mode: 'act' }] }],
      stages: [{ id: stageId('stage'), name: 'Stage', description: 'Stage', requirementIds: [requirementId('unknown')], verification: [] }],
    }
    expect(() => context.robot.registerWorkflow(missingRequirement)).toThrow(expect.objectContaining({ code: 'ROBOT_INVALID_WORKFLOW' }))
    const existing = context.robot.listWorkflows()[0]!
    expect(() => context.robot.registerWorkflow(existing)).toThrow(expect.objectContaining({ code: 'ROBOT_DUPLICATE_WORKFLOW' }))
  })

  it('discovers working providers while containing another provider failure', async () => {
    const context = await setup()
    context.robot.register(provider('working'))
    context.robot.register(provider('broken', () => Promise.reject(new Error('camera gateway offline'))))
    context.robot.register(provider('typed', () => Promise.reject(new RobotError('lidar warming', 'ROBOT_WARMING'))))
    // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- Provider inputs can reject with non-Error values.
    context.robot.register(provider('opaque', () => Promise.reject('offline')))

    await expect(context.robot.inspect(new AbortController().signal)).resolves.toEqual({ providers: [
      { kind: 'available', provider: { id: 'working', name: 'working' }, capabilities: [capability()] },
      { kind: 'failed', provider: { id: 'broken', name: 'broken' }, error: { code: 'ROBOT_DISCOVERY_FAILED', message: 'camera gateway offline' } },
      { kind: 'failed', provider: { id: 'typed', name: 'typed' }, error: { code: 'ROBOT_WARMING', message: 'lidar warming' } },
      { kind: 'failed', provider: { id: 'opaque', name: 'opaque' }, error: { code: 'ROBOT_DISCOVERY_FAILED', message: 'Robot capability discovery failed' } },
    ] })
  })

  it('rejects duplicate providers without replacing the original', async () => {
    const context = await setup()
    context.robot.register(provider('same'))
    expect(() => context.robot.register(provider('same'))).toThrow(expect.objectContaining({ code: 'ROBOT_DUPLICATE_PROVIDER' }))
    expect(context.robot.listProviders()).toEqual([{ id: 'same', name: 'same' }])
    const unregister = context.robot.register(provider('temporary'))
    await unregister()
    await unregister()
  })

  it('resolves capabilities and contains provider execution failures', async () => {
    const context = await setup()
    context.robot.register(provider('success'))
    context.robot.register({ ...provider('typed'), execute: () => Promise.reject(new RobotError('interlocked', 'ROBOT_INTERLOCKED')) })
    context.robot.register({ ...provider('error'), execute: () => Promise.reject(new Error('transport lost')) })
    // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- Provider inputs can reject with non-Error values.
    context.robot.register({ ...provider('opaque'), execute: () => Promise.reject('transport lost') })
    const request = (id: string) => ({
      providerId: providerId(id), capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'),
      mode: 'act' as const, arguments: { percent: 50 },
    })
    await expect(context.robot.execute(request('success'), new AbortController().signal))
      .resolves.toMatchObject({ kind: 'completed', output: { arguments: { percent: 50 } } })
    await expect(context.robot.execute(request('typed'), new AbortController().signal))
      .rejects.toMatchObject({ code: 'ROBOT_INTERLOCKED' })
    await expect(context.robot.execute(request('error'), new AbortController().signal))
      .rejects.toMatchObject({ code: 'ROBOT_OPERATION_FAILED', message: 'robot operation failed: transport lost' })
    await expect(context.robot.execute(request('opaque'), new AbortController().signal))
      .rejects.toMatchObject({ code: 'ROBOT_OPERATION_FAILED', message: 'robot operation failed: unknown provider failure' })
  })

  it('rejects missing and unavailable capability selections', async () => {
    const context = await setup()
    context.robot.register(provider('robot', () => Promise.resolve([{
      ...capability(), status: { kind: 'unavailable', message: 'emergency stop active' },
    }])))
    const request = {
      providerId: providerId('robot'), capabilityId: capabilityId('missing'), operationId: operationId('missing'),
      mode: 'act' as const, arguments: {},
    }
    await expect(context.robot.execute(request, new AbortController().signal))
      .rejects.toMatchObject({ code: 'ROBOT_CAPABILITY_NOT_FOUND' })
    await expect(context.robot.execute({ ...request, capabilityId: capabilityId('gripper') }, new AbortController().signal))
      .rejects.toMatchObject({ code: 'ROBOT_CAPABILITY_UNAVAILABLE' })

    context.robot.register(provider('ready'))
    await expect(context.robot.execute({
      ...request, providerId: providerId('ready'), capabilityId: capabilityId('gripper'), operationId: operationId('missing'),
    }, new AbortController().signal)).rejects.toMatchObject({ code: 'ROBOT_OPERATION_NOT_FOUND' })
  })

  it('validates mode, required inputs, unknown inputs, and numeric ranges before dispatch', async () => {
    const context = await setup()
    context.robot.register(provider('robot'))
    const base = {
      providerId: providerId('robot'), capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'),
    }
    await expect(context.robot.execute({ ...base, mode: 'observe', arguments: { percent: 50 } }, new AbortController().signal))
      .rejects.toEqual(expect.objectContaining({ code: 'ROBOT_OPERATION_MODE_MISMATCH' }))
    await expect(context.robot.execute({ ...base, mode: 'act', arguments: {} }, new AbortController().signal))
      .rejects.toEqual(expect.objectContaining({ code: 'ROBOT_INVALID_ARGUMENT' }))
    await expect(context.robot.execute({ ...base, mode: 'act', arguments: { percent: 101 } }, new AbortController().signal))
      .rejects.toEqual(expect.objectContaining({ code: 'ROBOT_INVALID_ARGUMENT' }))
    await expect(context.robot.execute({ ...base, mode: 'act', arguments: { percent: 50, extra: true } }, new AbortController().signal))
      .rejects.toEqual(expect.objectContaining({ code: 'ROBOT_INVALID_ARGUMENT' }))
    await expect(context.robot.execute({ ...base, mode: 'act', arguments: { percent: -1 } }, new AbortController().signal))
      .rejects.toEqual(expect.objectContaining({ code: 'ROBOT_INVALID_ARGUMENT' }))
    await expect(context.robot.execute({ ...base, mode: 'act', arguments: { percent: 50, first: true, second: true } }, new AbortController().signal))
      .rejects.toEqual(expect.objectContaining({ code: 'ROBOT_INVALID_ARGUMENT' }))
  })

  it('validates every declared argument type and enum values', async () => {
    const context = await setup()
    const typedCapability: RobotCapability = {
      ...capability(),
      operations: [{
        id: operationId('configure'), name: 'Configure', description: 'Configure', mode: 'act',
        arguments: [
          { name: 'metadata', description: 'Metadata', type: 'json' },
          { name: 'count', description: 'Count', type: 'integer', required: true },
          { name: 'gain', description: 'Gain', type: 'number', required: true },
          { name: 'mode', description: 'Mode', type: 'string', required: true, enum: ['safe', 'fast'] },
          { name: 'enabled', description: 'Enabled', type: 'boolean', required: true },
        ],
      }],
    }
    context.robot.register(provider('typed', () => Promise.resolve([typedCapability])))
    const base = {
      providerId: providerId('typed'), capabilityId: capabilityId('gripper'), operationId: operationId('configure'), mode: 'act' as const,
    }
    await expect(context.robot.execute({
      ...base, arguments: { count: 2, gain: 0.5, mode: 'safe', enabled: true },
    }, new AbortController().signal)).resolves.toMatchObject({ kind: 'completed' })
    for (const arguments_ of [
      { count: 2.5, gain: 0.5, mode: 'safe', enabled: true },
      { count: 2, gain: 'high', mode: 'safe', enabled: true },
      { count: 2, gain: 0.5, mode: 1, enabled: true },
      { count: 2, gain: 0.5, mode: 'unsafe', enabled: true },
      { count: 2, gain: 0.5, mode: 'safe', enabled: 'yes' },
    ]) {
      await expect(context.robot.execute({ ...base, arguments: arguments_ }, new AbortController().signal))
        .rejects.toMatchObject({ code: 'ROBOT_INVALID_ARGUMENT' })
    }
  })

  it('honors cancellation before discovery or execution and rejects new registration after disposal', async () => {
    const context = await setup()
    context.robot.register(provider('robot'))
    const aborted = AbortSignal.abort(new Error('cancelled'))
    await expect(context.robot.inspect(aborted)).rejects.toThrow('cancelled')
    await expect(context.robot.execute({
      providerId: providerId('robot'), capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'),
      mode: 'act', arguments: { percent: 50 },
    }, aborted)).rejects.toThrow('cancelled')
    const runtime = context.robot
    await context.fiber.dispose()
    expect(() => runtime.register(provider('late'))).toThrow('Robot runtime disposed')
  })

  it('preserves an explicit unknown outcome when cancellation races provider completion', async () => {
    const context = await setup()
    const entered = Promise.withResolvers<undefined>()
    context.robot.register({
      ...provider('robot'),
      async execute(_request, signal) {
        entered.resolve(undefined)
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => { resolve() }, { once: true })
        })
        return { kind: 'unknown', message: 'commit result was not observed', output: { operationId: 'pending' } }
      },
    })
    const controller = new AbortController()
    const pending = context.robot.execute({
      providerId: providerId('robot'), capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'),
      mode: 'act', arguments: { percent: 50 },
    }, controller.signal)
    await entered.promise
    controller.abort(new Error('caller stopped waiting'))
    await expect(pending).resolves.toEqual({
      kind: 'unknown', message: 'commit result was not observed', output: { operationId: 'pending' },
    })
  })

  it('removes admission before cancelling and joining accepted provider work', async () => {
    const context = await setup()
    const entered = Promise.withResolvers<undefined>()
    const stopped = Promise.withResolvers<undefined>()
    const testProvider: RobotProvider = {
      ...provider('robot'),
      async execute(_request, signal) {
        entered.resolve(undefined)
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => { resolve() }, { once: true })
        })
        stopped.resolve(undefined)
        signal.throwIfAborted()
        return { kind: 'completed', output: null }
      },
    }
    const unregister = context.robot.register(testProvider)
    const pending = context.robot.execute({
      providerId: providerId('robot'), capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'),
      mode: 'act', arguments: { percent: 50 },
    }, new AbortController().signal)
    await entered.promise
    const removing = unregister()
    expect(context.robot.listProviders()).toEqual([])
    await expect(context.robot.execute({
      providerId: providerId('robot'), capabilityId: capabilityId('gripper'), operationId: operationId('set_opening'),
      mode: 'act', arguments: { percent: 50 },
    }, new AbortController().signal)).rejects.toEqual(expect.objectContaining({ code: 'ROBOT_PROVIDER_UNAVAILABLE' }))
    await stopped.promise
    await expect(pending).rejects.toBeInstanceOf(Error)
    await removing
  })
})
