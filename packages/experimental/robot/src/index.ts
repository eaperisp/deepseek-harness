/** Robot capability discovery, validation, routing, and lifecycle ownership. @module */

import { Context, Service } from '@deepseek-ai/cordis'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {
  RobotArgumentDefinition,
  RobotArguments,
  RobotCapability,
  RobotExecutionRequest,
  RobotInspection,
  RobotOperationDefinition,
  RobotOperationOutcome,
  RobotProvider,
  RobotProviderId,
  RobotProviderInfo,
  RobotProviderSnapshot,
  RobotWorkflowDefinition,
  RobotWorkflowId,
  RobotWorkflowInspection,
  RobotWorkflowRequirementResolution,
  RobotWorkflowResolution,
  RobotWorkflowSelection,
} from './types.ts'
import { standardRobotWorkflows } from './workflows.ts'

export type * from './types.ts'
export { standardRobotWorkflows } from './workflows.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Experimental registry and execution seam for robots and robot gateways. */
    robot: RobotRuntime
  }
}

/** Typed robot failure exposed through tool result metadata. */
export class RobotError extends HarnessError {}

interface Registration {
  readonly provider: RobotProvider
  readonly lifetime: AbortController
  readonly pending: Set<Promise<unknown>>
}

/** Registry shared by robot providers and model-facing consumers in one Host. */
export default class RobotRuntime extends Service {
  private readonly providers = new Map<RobotProviderId, Registration>()
  private readonly workflows = new Map<RobotWorkflowId, RobotWorkflowDefinition>()
  private readonly lifetime = new AbortController()

  constructor(ctx: Context) {
    super(ctx, 'robot')
    for (const workflow of standardRobotWorkflows) this.addWorkflow(workflow)
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error('Robot runtime disposed'))
      await Promise.all([...this.providers.values()].map(registration => this.remove(registration)))
      this.workflows.clear()
    })
  }

  /**
   * Register one robot or gateway; duplicate ids fail without replacing the original.
   * The contributing plugin must own the returned disposer with `ctx.effect()`.
   * @param provider - adapter owned by the contributing plugin.
   * @returns idempotent disposer which removes admission, cancels, and joins accepted work.
   */
  register(provider: RobotProvider): () => Promise<void> {
    this.lifetime.signal.throwIfAborted()
    if (this.providers.has(provider.info.id)) {
      throw new RobotError(`robot provider already registered: ${provider.info.id}`, 'ROBOT_DUPLICATE_PROVIDER')
    }
    const registration: Registration = { provider, lifetime: new AbortController(), pending: new Set() }
    this.providers.set(provider.info.id, registration)
    return async () => { await this.remove(registration) }
  }

  private async remove(registration: Registration): Promise<void> {
    if (this.providers.get(registration.provider.info.id) !== registration) return
    this.providers.delete(registration.provider.info.id)
    registration.lifetime.abort(new Error('Robot provider unloaded'))
    await Promise.allSettled(registration.pending)
  }

  /**
   * Read registered provider facts in registration order without contacting hardware.
   * @returns detached provider facts.
   */
  listProviders(): readonly RobotProviderInfo[] {
    return [...this.providers.values()].map(({ provider }) => ({ ...provider.info }))
  }

  /**
   * Register one additional portable workflow; duplicate ids fail without replacement.
   * The contributing plugin must own the returned disposer with `ctx.effect()`.
   * @param workflow - complete requirements and ordered verification stages.
   * @returns idempotent disposer which removes only this registration.
   */
  registerWorkflow(workflow: RobotWorkflowDefinition): () => void {
    this.lifetime.signal.throwIfAborted()
    this.addWorkflow(workflow)
    return () => {
      if (this.workflows.get(workflow.id) === workflow) this.workflows.delete(workflow.id)
    }
  }

  private addWorkflow(workflow: RobotWorkflowDefinition): void {
    validateWorkflow(workflow)
    if (this.workflows.has(workflow.id)) {
      throw new RobotError(`robot workflow already registered: ${workflow.id}`, 'ROBOT_DUPLICATE_WORKFLOW')
    }
    this.workflows.set(workflow.id, workflow)
  }

  /**
   * List workflow definitions without contacting hardware.
   * @returns definitions in registration order.
   */
  listWorkflows(): readonly RobotWorkflowDefinition[] {
    return [...this.workflows.values()]
  }

  /**
   * Resolve one or every registered workflow against one shared live robot inspection.
   * This method never executes a robot operation; a `ready` result reports only that
   * the declared operations are discoverable and ready at inspection time.
   * @param signal - caller cancellation.
   * @param workflowId - optional exact workflow id.
   * @returns robot evidence and resolved workflow requirements.
   */
  async inspectWorkflows(signal: AbortSignal, workflowId?: RobotWorkflowId): Promise<RobotWorkflowInspection> {
    signal.throwIfAborted()
    const workflows = workflowId === undefined ? [...this.workflows.values()] : [this.resolveWorkflow(workflowId)]
    const robot = await this.inspect(signal)
    signal.throwIfAborted()
    return { robot, workflows: workflows.map(workflow => resolveWorkflow(workflow, robot)) }
  }

  private resolveWorkflow(id: RobotWorkflowId): RobotWorkflowDefinition {
    const workflow = this.workflows.get(id)
    if (workflow === undefined) throw new RobotError(`robot workflow was not found: ${id}`, 'ROBOT_WORKFLOW_NOT_FOUND')
    return workflow
  }

  /**
   * Discover all registered providers concurrently. One failed provider is reported
   * in place and does not hide working robots or capabilities.
   * @param signal - caller cancellation.
   * @returns one settled snapshot per provider in registration order.
   */
  async inspect(signal: AbortSignal): Promise<RobotInspection> {
    signal.throwIfAborted()
    const registrations = [...this.providers.values()]
    const providers = await Promise.all(registrations.map(async registration => await this.inspectProvider(registration, signal)))
    signal.throwIfAborted()
    return { providers }
  }

  private async inspectProvider(registration: Registration, caller: AbortSignal): Promise<RobotProviderSnapshot> {
    const signal = AbortSignal.any([caller, this.lifetime.signal, registration.lifetime.signal])
    const pending = Promise.resolve().then(async () => {
      signal.throwIfAborted()
      return await registration.provider.discover(signal)
    })
    registration.pending.add(pending)
    try {
      const capabilities = await pending
      signal.throwIfAborted()
      return { kind: 'available', provider: { ...registration.provider.info }, capabilities }
    } catch (cause: unknown) {
      signal.throwIfAborted()
      const error = cause instanceof RobotError
        ? { code: cause.code, message: cause.message }
        : { code: 'ROBOT_DISCOVERY_FAILED', message: cause instanceof Error ? cause.message : 'Robot capability discovery failed' }
      return { kind: 'failed', provider: { ...registration.provider.info }, error }
    } finally {
      registration.pending.delete(pending)
    }
  }

  /**
   * Re-discover, validate, and execute one exact provider operation. The mode must
   * match the declaration so read-only consumers cannot dispatch physical actions.
   * @param request - exact provider, operation, mode, and untrusted model arguments.
   * @param signal - caller cancellation.
   * @returns provider result, including explicit unknown physical outcomes.
   */
  async execute(request: RobotExecutionRequest, signal: AbortSignal): Promise<RobotOperationOutcome> {
    signal.throwIfAborted()
    const registration = this.providers.get(request.providerId)
    if (registration === undefined) {
      throw new RobotError(`robot provider is unavailable: ${request.providerId}`, 'ROBOT_PROVIDER_UNAVAILABLE')
    }
    const combined = AbortSignal.any([signal, this.lifetime.signal, registration.lifetime.signal])
    const pending = Promise.resolve().then(async () => {
      combined.throwIfAborted()
      const capabilities = await registration.provider.discover(combined)
      const operation = resolveOperation(capabilities, request)
      validateArguments(operation, request.arguments)
      combined.throwIfAborted()
      return await registration.provider.execute({
        capabilityId: request.capabilityId,
        operationId: request.operationId,
        arguments: request.arguments,
      }, combined)
    })
    registration.pending.add(pending)
    try {
      const outcome = await pending
      if (outcome.kind !== 'unknown') combined.throwIfAborted()
      return outcome
    } catch (cause: unknown) {
      combined.throwIfAborted()
      if (cause instanceof RobotError) throw cause
      throw new RobotError(`robot operation failed: ${cause instanceof Error ? cause.message : 'unknown provider failure'}`, 'ROBOT_OPERATION_FAILED', { cause })
    } finally {
      registration.pending.delete(pending)
    }
  }
}

function resolveOperation(
  capabilities: readonly RobotCapability[],
  request: RobotExecutionRequest,
): RobotOperationDefinition {
  const capability = capabilities.find(candidate => candidate.id === request.capabilityId)
  if (capability === undefined) {
    throw new RobotError(`robot capability was not found: ${request.capabilityId}`, 'ROBOT_CAPABILITY_NOT_FOUND')
  }
  if (capability.status.kind === 'unavailable') {
    throw new RobotError(`robot capability is unavailable: ${request.capabilityId}: ${capability.status.message}`, 'ROBOT_CAPABILITY_UNAVAILABLE')
  }
  const operation = capability.operations.find(candidate => candidate.id === request.operationId)
  if (operation === undefined) {
    throw new RobotError(`robot operation was not found: ${request.operationId}`, 'ROBOT_OPERATION_NOT_FOUND')
  }
  if (operation.mode !== request.mode) {
    throw new RobotError(`robot operation ${request.operationId} is ${operation.mode}, not ${request.mode}`, 'ROBOT_OPERATION_MODE_MISMATCH')
  }
  return operation
}

function validateArguments(operation: RobotOperationDefinition, args: RobotArguments): void {
  const declared = new Map(operation.arguments.map(argument => [argument.name, argument]))
  const unknown = Object.keys(args).filter(name => !declared.has(name))
  if (unknown.length > 0) invalid(`undeclared argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`)
  for (const definition of operation.arguments) {
    const value = args[definition.name]
    if (value === undefined) {
      if (definition.required === true) invalid(`missing required argument: ${definition.name}`)
      continue
    }
    validateArgument(definition, value)
  }
}

function validateArgument(definition: RobotArgumentDefinition, value: JsonValue): void {
  const validType = definition.type === 'json'
    || definition.type === 'integer' && typeof value === 'number' && Number.isInteger(value)
    || definition.type === 'number' && typeof value === 'number'
    || definition.type === 'string' && typeof value === 'string'
    || definition.type === 'boolean' && typeof value === 'boolean'
  if (!validType) invalid(`argument ${definition.name} must be ${definition.type}`)
  if (definition.enum !== undefined && !definition.enum.some(candidate => candidate === value)) {
    invalid(`argument ${definition.name} must be one of ${definition.enum.join(', ')}`)
  }
  if (typeof value === 'number') {
    if (definition.minimum !== undefined && value < definition.minimum) invalid(`argument ${definition.name} must be at least ${definition.minimum}`)
    if (definition.maximum !== undefined && value > definition.maximum) invalid(`argument ${definition.name} must be at most ${definition.maximum}`)
  }
}

function invalid(message: string): never {
  throw new RobotError(message, 'ROBOT_INVALID_ARGUMENT')
}

function validateWorkflow(workflow: RobotWorkflowDefinition): void {
  if (workflow.requirements.length === 0) throw new RobotError(`robot workflow has no requirements: ${workflow.id}`, 'ROBOT_INVALID_WORKFLOW')
  const requirements = new Set<string>()
  for (const requirement of workflow.requirements) {
    if (requirements.has(requirement.id)) throw new RobotError(`robot workflow has duplicate requirement: ${workflow.id}/${requirement.id}`, 'ROBOT_INVALID_WORKFLOW')
    if (requirement.alternatives.length === 0) throw new RobotError(`robot workflow requirement has no alternatives: ${workflow.id}/${requirement.id}`, 'ROBOT_INVALID_WORKFLOW')
    requirements.add(requirement.id)
  }
  const stages = new Set<string>()
  for (const stage of workflow.stages) {
    if (stages.has(stage.id)) throw new RobotError(`robot workflow has duplicate stage: ${workflow.id}/${stage.id}`, 'ROBOT_INVALID_WORKFLOW')
    stages.add(stage.id)
    for (const requirementId of stage.requirementIds) {
      if (!requirements.has(requirementId)) throw new RobotError(`robot workflow stage references unknown requirement: ${workflow.id}/${stage.id}/${requirementId}`, 'ROBOT_INVALID_WORKFLOW')
    }
  }
}

function resolveWorkflow(workflow: RobotWorkflowDefinition, robot: RobotInspection): RobotWorkflowResolution {
  const requirements = workflow.requirements.map((requirement) => {
    const candidates: { readonly rank: number; readonly result: RobotWorkflowRequirementResolution }[] = []
    for (const provider of robot.providers) {
      if (provider.kind !== 'available') continue
      for (const alternative of requirement.alternatives) {
        const capability = provider.capabilities.find(candidate => candidate.id === alternative.capabilityId)
        const operation = capability?.operations.find(candidate =>
          candidate.id === alternative.operationId && candidate.mode === alternative.mode)
        if (capability === undefined || operation === undefined) continue
        const selection: RobotWorkflowSelection = {
          providerId: provider.provider.id,
          providerName: provider.provider.name,
          capabilityId: capability.id,
          capabilityName: capability.name,
          operationId: operation.id,
          operationName: operation.name,
          mode: operation.mode,
        }
        switch (capability.status.kind) {
          case 'ready': candidates.push({ rank: 0, result: { kind: 'ready', requirement, selection } }); break
          case 'degraded': candidates.push({ rank: 1, result: { kind: 'degraded', requirement, selection, message: capability.status.message } }); break
          case 'unavailable': candidates.push({ rank: 2, result: { kind: 'unavailable', requirement, selection, message: capability.status.message } }); break
        }
      }
    }
    candidates.sort((left, right) => left.rank - right.rank)
    return candidates[0]?.result ?? { kind: 'missing' as const, requirement }
  })
  const required = requirements.filter(result => result.requirement.required)
  const status = required.some(result => result.kind === 'missing' || result.kind === 'unavailable')
    ? 'blocked'
    : required.some(result => result.kind === 'degraded') ? 'degraded' : 'ready'
  return { status, workflow, requirements }
}
