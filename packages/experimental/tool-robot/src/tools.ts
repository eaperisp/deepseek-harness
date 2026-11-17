/** Model-facing robot inspection, observation, and action tools. */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { RobotCapabilityId, RobotOperationId, RobotProviderId, RobotWorkflowId } from '@deepseek-ai/dsh-robot'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { snapshotJsonValue } from '@deepseek-ai/dsh-util-values'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/** Fixed action tool name used by the approval policy listener. */
export const ROBOT_ACT_TOOL_NAME = 'robot_act'

/** Tool execution limits configured by the deployment. */
export interface RobotToolConfig {
  readonly inspectionTimeoutMs: number
  readonly operationTimeoutMs: number
}

const operationParameters = {
  provider_id: { type: 'string', required: true, description: 'Exact provider id returned by robot_inspect.' },
  capability_id: { type: 'string', required: true, description: 'Exact capability id returned by robot_inspect.' },
  operation_id: { type: 'string', required: true, description: 'Exact operation id returned by robot_inspect.' },
  arguments: { type: 'object', required: true, additionalProperties: true, description: 'Named arguments declared by the selected operation.' },
} as const

const jsonOutput = {
  schema: { type: 'json' } as const,
  render: (_args: object, value: JsonValue) => [{ type: 'text' as const, text: JSON.stringify(value) }],
}

/**
 * Register all robot tools with the shared registry.
 * @param ctx - robot runtime and tool registry.
 * @param config - inspection and operation time limits.
 */
export function registerRobotTools(ctx: Context, config: RobotToolConfig): void {
  ctx.tools.register(defineTool({
    name: 'robot_inspect',
    description: 'Discover every currently registered robot, sensor, perception function, actuator, mobility function, its readiness, operations, argument requirements, and whether each operation observes or acts. Call this before robot_observe or robot_act and use only returned ids.',
    parameters: {},
    timeoutMs: config.inspectionTimeoutMs,
    output: jsonOutput,
    async execute(_args, exec) {
      return jsonResult(await ctx.robot.inspect(exec.signal))
    },
    presentCall: () => ({ card: 'generic', title: 'robot_inspect' }),
  }))

  ctx.tools.register(defineTool({
    name: 'robot_workflow',
    description: 'Compare the live robot inventory with standard embodied-development workflows. Omit workflow_id to inspect every workflow, or pass an exact id from a previous result. The result reports ready, degraded, unavailable, and missing operations plus ordered implementation and verification stages. It never executes an operation or proves that a physical task is safe.',
    parameters: {
      workflow_id: { type: 'string', description: 'Optional exact workflow id, such as spatial-memory, simulation, hand-eye-calibration, or gravity-compensation.' },
    },
    timeoutMs: config.inspectionTimeoutMs,
    output: jsonOutput,
    async execute(args, exec) {
      const id = args.workflow_id === undefined ? undefined : workflowId(args.workflow_id)
      return jsonResult(await ctx.robot.inspectWorkflows(exec.signal, id))
    },
    presentCall: args => ({ card: 'generic', title: args.workflow_id === undefined ? 'robot_workflow' : `robot_workflow: ${args.workflow_id}`, rawInput: args }),
  }))

  ctx.tools.register(defineTool({
    name: 'robot_observe',
    description: 'Run one read-only robot sensor or perception operation discovered by robot_inspect. This tool rejects operations declared as physical actions.',
    parameters: operationParameters,
    timeoutMs: config.operationTimeoutMs,
    output: jsonOutput,
    async execute(args, exec) {
      const outcome = await ctx.robot.execute({
        providerId: providerId(args.provider_id),
        capabilityId: capabilityId(args.capability_id),
        operationId: operationId(args.operation_id),
        mode: 'observe',
        arguments: args.arguments,
      }, exec.signal)
      return jsonResult({ providerId: args.provider_id, capabilityId: args.capability_id, operationId: args.operation_id, ...outcome })
    },
    presentCall: args => ({ card: 'generic', title: `robot_observe: ${args.capability_id}/${args.operation_id}`, rawInput: args }),
  }))

  ctx.tools.register(defineTool({
    name: ROBOT_ACT_TOOL_NAME,
    description: 'Run one state-changing robot operation discovered by robot_inspect. The operation may move hardware or change the physical world and normally requires user approval. This tool rejects read-only operations.',
    parameters: operationParameters,
    timeoutMs: config.operationTimeoutMs,
    output: jsonOutput,
    async execute(args, exec) {
      const outcome = await ctx.robot.execute({
        providerId: providerId(args.provider_id),
        capabilityId: capabilityId(args.capability_id),
        operationId: operationId(args.operation_id),
        mode: 'act',
        arguments: args.arguments,
      }, exec.signal)
      return jsonResult({ providerId: args.provider_id, capabilityId: args.capability_id, operationId: args.operation_id, ...outcome })
    },
    presentCall: args => ({ card: 'generic', title: `robot_act: ${args.capability_id}/${args.operation_id}`, rawInput: args }),
  }))
}

function providerId(value: string): RobotProviderId { return brandString<RobotProviderId>(value) }
function capabilityId(value: string): RobotCapabilityId { return brandString<RobotCapabilityId>(value) }
function operationId(value: string): RobotOperationId { return brandString<RobotOperationId>(value) }
function workflowId(value: string): RobotWorkflowId { return brandString<RobotWorkflowId>(value) }

function jsonResult(value: unknown): JsonValue {
  const snapshot = snapshotJsonValue(value as JsonValue)
  if (snapshot === undefined) throw new TypeError('robot tool output must be lossless JSON')
  return snapshot
}
