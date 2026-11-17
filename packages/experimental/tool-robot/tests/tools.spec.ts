import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import RobotRuntime, { type RobotProviderId, type RobotCapabilityId, type RobotOperationId } from '@deepseek-ai/dsh-robot'
import * as SimulatedRobot from '@deepseek-ai/dsh-robot-simulated'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import { ToolExecutionPipeline } from '@deepseek-ai/dsh-tools/pipeline'
import * as RobotTools from '../src/index.ts'

const contexts: Context[] = []
const signal = new AbortController().signal

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(context => context.fiber.dispose()))
})

async function setup(requireActionApproval: boolean): Promise<Context> {
  const context = new Context()
  contexts.push(context)
  await context.plugin(SystemPrompt)
  await context.plugin(Tools)
  await context.plugin(RobotRuntime)
  await context.plugin(SimulatedRobot)
  await context.plugin(RobotTools, { requireActionApproval })
  return context
}

async function invoke(context: Context, name: string, args: object) {
  const pipeline = new ToolExecutionPipeline(context)
  const prepared = await pipeline.prepare({
    name, callId: ToolCallId(`${name}-call`), arguments: args, signal,
  })
  const outcome = prepared.kind === 'dispatch' ? await pipeline.dispatch(prepared.exec) : prepared
  return pipeline.complete(prepared.exec, outcome)
}

describe('robot tools', () => {
  it('discovers the simulated robot and executes read-only perception', async () => {
    const context = await setup(true)
    const inspection = await invoke(context, 'robot_inspect', {})
    expect(inspection.isError).not.toBe(true)
    expect(inspection.value).toMatchObject({ providers: [{ kind: 'available', provider: { id: 'simulated' } }] })
    expect(JSON.stringify(inspection.value)).toContain('"id":"radar"')
    expect(JSON.stringify(inspection.value)).toContain('"id":"gripper"')

    const observed = await invoke(context, 'robot_observe', {
      provider_id: 'simulated', capability_id: 'object_recognition', operation_id: 'recognize_objects', arguments: {},
    })
    expect(observed.isError).not.toBe(true)
    expect(observed.value).toMatchObject({ kind: 'completed', output: { objects: [{ label: 'box', confidence: 0.96 }] } })
  })

  it('explains standard workflow coverage without dispatching physical actions', async () => {
    const context = await setup(true)
    const result = await invoke(context, 'robot_workflow', { workflow_id: 'spatial-memory' })
    expect(result.isError).not.toBe(true)
    expect(result.value).toMatchObject({ workflows: [{ status: 'blocked', workflow: { id: 'spatial-memory' } }] })
    const serialized = JSON.stringify(result.value)
    expect(serialized).toContain('"id":"camera-frame"')
    expect(serialized).toContain('"operationId":"capture_summary"')
    expect(serialized).toContain('"id":"localization"')
    expect(serialized).toContain('"operationId":"localize"')
    expect(serialized).toContain('"id":"memory-write"')
    expect(serialized).toContain('"kind":"missing"')

    const missing = await invoke(context, 'robot_workflow', { workflow_id: 'not-registered' })
    expect(missing).toMatchObject({ isError: true, error: { info: { code: 'ROBOT_WORKFLOW_NOT_FOUND' } } })
  })

  it('asks before physical actions by default and can be explicitly composed without that policy', async () => {
    const protectedContext = await setup(true)
    const denied = await invoke(protectedContext, 'robot_act', {
      provider_id: 'simulated', capability_id: 'gripper', operation_id: 'set_opening', arguments: { opening_percent: 25 },
    })
    expect(denied.isError).toBe(true)

    const unattendedContext = await setup(false)
    const completed = await invoke(unattendedContext, 'robot_act', {
      provider_id: 'simulated', capability_id: 'gripper', operation_id: 'set_opening', arguments: { opening_percent: 25 },
    })
    expect(completed).toMatchObject({ isError: false, value: { kind: 'completed', output: { openingPercent: 25 } } })
  })

  it('keeps observation and action roles separate', async () => {
    const context = await setup(false)
    const result = await invoke(context, 'robot_observe', {
      provider_id: 'simulated', capability_id: 'gripper', operation_id: 'set_opening', arguments: { opening_percent: 25 },
    })
    expect(result).toMatchObject({ isError: true, error: { info: { code: 'ROBOT_OPERATION_MODE_MISMATCH' } } })
  })

  it('exposes stable tool presentation and JSON rendering', async () => {
    const context = await setup(false)
    const inspect = context.tools.get('robot_inspect')!
    const workflow = context.tools.get('robot_workflow')!
    const observe = context.tools.get('robot_observe')!
    const act = context.tools.get('robot_act')!
    expect(inspect.presentCall?.({})).toEqual({ card: 'generic', title: 'robot_inspect' })
    expect(workflow.presentCall?.({ workflow_id: 'simulation' })).toMatchObject({ title: 'robot_workflow: simulation' })
    expect(observe.presentCall?.({ provider_id: 'simulated', capability_id: 'radar', operation_id: 'scan', arguments: {} }))
      .toMatchObject({ title: 'robot_observe: radar/scan' })
    expect(act.presentCall?.({ provider_id: 'simulated', capability_id: 'gripper', operation_id: 'set_opening', arguments: {} }))
      .toMatchObject({ title: 'robot_act: gripper/set_opening' })
    expect(inspect.output.render({}, { ready: true })).toEqual([{ type: 'text', text: '{"ready":true}' }])
  })

  it('preserves a stricter downstream physical-action policy', async () => {
    const context = await setup(true)
    context.on('tools/pre-execute', async (): Promise<PreToolDecision> => ({ kind: 'deny', reason: 'deployment interlock' }))
    const denied = await invoke(context, 'robot_act', {
      provider_id: 'simulated', capability_id: 'gripper', operation_id: 'set_opening', arguments: { opening_percent: 25 },
    })
    expect(denied).toMatchObject({ isError: true })
  })

  it('rejects provider output that cannot be represented as lossless JSON', async () => {
    const context = await setup(false)
    const unregister = context.robot.register({
      info: { id: brandString<RobotProviderId>('invalid-json'), name: 'Invalid JSON' },
      discover: () => Promise.resolve([{
        id: brandString<RobotCapabilityId>('sensor'), name: 'Sensor', description: 'Sensor', category: 'sensor', status: { kind: 'ready' },
        operations: [{ id: brandString<RobotOperationId>('read'), name: 'Read', description: 'Read', mode: 'observe', arguments: [] }],
      }]),
      execute: () => Promise.resolve({ kind: 'completed', output: 1n as never }),
    })
    const result = await invoke(context, 'robot_observe', {
      provider_id: 'invalid-json', capability_id: 'sensor', operation_id: 'read', arguments: {},
    })
    expect(result).toMatchObject({ isError: true })
    await unregister()
  })
})
