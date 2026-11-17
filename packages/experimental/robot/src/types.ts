/** Portable robot capability and provider types. @module @deepseek-ai/dsh-robot/types */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/** Stable identity of one robot or robot gateway registered in a Host. */
export type RobotProviderId = Branded<'RobotProviderId'>

/** Provider-local stable identity of one sensor, perception function, or actuator. */
export type RobotCapabilityId = Branded<'RobotCapabilityId'>

/** Capability-local stable identity of one observable or state-changing operation. */
export type RobotOperationId = Branded<'RobotOperationId'>

/** Stable identity of one portable embodied-development workflow. */
export type RobotWorkflowId = Branded<'RobotWorkflowId'>

/** Workflow-local stable identity of one required capability. */
export type RobotWorkflowRequirementId = Branded<'RobotWorkflowRequirementId'>

/** Workflow-local stable identity of one development or execution stage. */
export type RobotWorkflowStageId = Branded<'RobotWorkflowStageId'>

/** Lossless JSON arguments accepted by one robot operation. */
export interface RobotArguments {
  readonly [key: string]: JsonValue
}

/** Broad capability class used for discovery and presentation. */
export type RobotCapabilityCategory = 'sensor' | 'perception' | 'actuator' | 'mobility' | 'system'

/** Whether an operation observes state or may change the physical world. */
export type RobotOperationMode = 'observe' | 'act'

/** Primitive argument kinds understood by the provider-neutral validator. */
export type RobotArgumentType = 'string' | 'number' | 'integer' | 'boolean' | 'json'

/** Provider-declared input accepted by one operation. */
export interface RobotArgumentDefinition {
  /** Stable input field name. */
  readonly name: string
  /** Model-facing explanation of the input. */
  readonly description: string
  /** Required JSON value kind. */
  readonly type: RobotArgumentType
  /** Whether callers must supply the field. */
  readonly required?: boolean
  /** Allowed primitive values, when the input has a closed set. */
  readonly enum?: readonly (string | number | boolean)[]
  /** Inclusive numeric lower bound. */
  readonly minimum?: number
  /** Inclusive numeric upper bound. */
  readonly maximum?: number
  /** Physical unit, such as `m`, `degree`, or `percent`. */
  readonly unit?: string
}

/** One provider-declared robot operation. */
export interface RobotOperationDefinition {
  /** Stable capability-local identity. */
  readonly id: RobotOperationId
  /** Human-readable operation name. */
  readonly name: string
  /** Model-facing purpose and observable effect. */
  readonly description: string
  /** Whether the operation is read-only or state-changing. */
  readonly mode: RobotOperationMode
  /** Accepted named arguments; undeclared arguments are rejected. */
  readonly arguments: readonly RobotArgumentDefinition[]
}

/** Current provider-reported readiness of one capability. */
export type RobotCapabilityStatus =
  | { readonly kind: 'ready' }
  | { readonly kind: 'degraded'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly message: string }

/** One discoverable robot sensor, perception function, actuator, or system service. */
export interface RobotCapability {
  /** Observation time, source and limitations supplied by the adapter; not execution authority. */
  readonly evidence?: JsonValue
  /** Stable provider-local identity. */
  readonly id: RobotCapabilityId
  /** Human-readable capability name. */
  readonly name: string
  /** What the capability senses, infers, or changes. */
  readonly description: string
  /** Broad class used for discovery and presentation. */
  readonly category: RobotCapabilityCategory
  /** Current readiness, refreshed on each discovery. */
  readonly status: RobotCapabilityStatus
  /** Operations currently exposed by this capability. */
  readonly operations: readonly RobotOperationDefinition[]
}

/** Stable facts about one registered robot or gateway. */
export interface RobotProviderInfo {
  /** Registry identity used for explicit routing. */
  readonly id: RobotProviderId
  /** Human-readable robot or gateway name. */
  readonly name: string
  /** Optional deployment description. */
  readonly description?: string
}

/** Input passed from the seam to an exact provider operation. */
export interface RobotProviderExecutionRequest {
  /** Provider-local capability selected after discovery. */
  readonly capabilityId: RobotCapabilityId
  /** Capability-local operation selected after discovery. */
  readonly operationId: RobotOperationId
  /** Arguments validated against the discovered declaration. */
  readonly arguments: RobotArguments
}

/** Provider result that never reports an uncertain physical effect as success. */
export type RobotOperationOutcome =
  | { readonly kind: 'completed'; readonly output: JsonValue; readonly summary?: string }
  | { readonly kind: 'unknown'; readonly message: string; readonly output?: JsonValue }

/** Robot adapter registered with the shared runtime. */
export interface RobotProvider {
  /** Stable provider facts. */
  readonly info: RobotProviderInfo
  /**
   * Discover current capabilities without changing robot state.
   * @param signal - caller and provider-registration lifetime cancellation.
   * @returns the current complete capability list.
   */
  discover(signal: AbortSignal): Promise<readonly RobotCapability[]>
  /**
   * Execute one exact operation previously validated against discovery.
   * @param request - provider-local operation and validated arguments.
   * @param signal - caller and provider-registration lifetime cancellation.
   * @returns completed output or an explicit unknown physical outcome.
   */
  execute(request: RobotProviderExecutionRequest, signal: AbortSignal): Promise<RobotOperationOutcome>
}

/** Safe discovery failure retained alongside other providers' successful results. */
export interface RobotDiscoveryFailure {
  /** Machine-routable failure class. */
  readonly code: string
  /** Actionable provider-local message without raw transport data. */
  readonly message: string
}

/** Result of discovering one registered provider. */
export type RobotProviderSnapshot =
  | { readonly kind: 'available'; readonly provider: RobotProviderInfo; readonly capabilities: readonly RobotCapability[] }
  | { readonly kind: 'failed'; readonly provider: RobotProviderInfo; readonly error: RobotDiscoveryFailure }

/** Complete point-in-time discovery result across registered providers. */
export interface RobotInspection {
  readonly providers: readonly RobotProviderSnapshot[]
}

/** Consumer request routed to one exact discovered operation. */
export interface RobotExecutionRequest extends RobotProviderExecutionRequest {
  /** Exact registered provider identity. */
  readonly providerId: RobotProviderId
  /** Expected operation mode; prevents observation and action callers from crossing roles. */
  readonly mode: RobotOperationMode
}

/** Application family used to browse embodied-development workflows. */
export type RobotWorkflowCategory = 'spatial-memory' | 'simulation' | 'calibration' | 'dynamics'

/** One exact operation that can satisfy a portable workflow requirement. */
export interface RobotWorkflowAlternative {
  /** Provider-local capability identity expected from an adapter. */
  readonly capabilityId: RobotCapabilityId
  /** Capability-local operation identity expected from an adapter. */
  readonly operationId: RobotOperationId
  /** Required observation or physical-action classification. */
  readonly mode: RobotOperationMode
}

/** One portable robot ability required or recommended by a workflow. */
export interface RobotWorkflowRequirement {
  /** Stable identity referenced by workflow stages. */
  readonly id: RobotWorkflowRequirementId
  /** Human-readable ability name. */
  readonly name: string
  /** Why this ability is needed and what its adapter must provide. */
  readonly description: string
  /** Whether the workflow is blocked when no ready alternative exists. */
  readonly required: boolean
  /** Exact operation identities accepted across robot implementations. */
  readonly alternatives: readonly RobotWorkflowAlternative[]
}

/** One ordered stage that teaches a newcomer how to complete and verify a workflow. */
export interface RobotWorkflowStage {
  /** Stable workflow-local stage identity. */
  readonly id: RobotWorkflowStageId
  /** Human-readable stage name. */
  readonly name: string
  /** Work to perform without claiming that missing adapters exist. */
  readonly description: string
  /** Requirements used by this stage. */
  readonly requirementIds: readonly RobotWorkflowRequirementId[]
  /** Observable checks required before the stage is accepted. */
  readonly verification: readonly string[]
}

/** Portable embodied workflow registered independently of one robot model. */
export interface RobotWorkflowDefinition {
  /** Stable registry identity. */
  readonly id: RobotWorkflowId
  /** Human-readable workflow name. */
  readonly name: string
  /** Outcome and scope of the workflow. */
  readonly description: string
  /** Application family used for discovery. */
  readonly category: RobotWorkflowCategory
  /** Required and optional portable abilities. */
  readonly requirements: readonly RobotWorkflowRequirement[]
  /** Ordered beginner-facing implementation and verification stages. */
  readonly stages: readonly RobotWorkflowStage[]
  /** Optional primary reference that defines the named workflow. */
  readonly reference?: string
}

/** Exact live operation selected for one workflow requirement. */
export interface RobotWorkflowSelection {
  readonly providerId: RobotProviderId
  readonly providerName: string
  readonly capabilityId: RobotCapabilityId
  readonly capabilityName: string
  readonly operationId: RobotOperationId
  readonly operationName: string
  readonly mode: RobotOperationMode
}

/** Live readiness of one workflow requirement against discovered robots. */
export type RobotWorkflowRequirementResolution =
  | { readonly kind: 'ready'; readonly requirement: RobotWorkflowRequirement; readonly selection: RobotWorkflowSelection }
  | { readonly kind: 'degraded'; readonly requirement: RobotWorkflowRequirement; readonly selection: RobotWorkflowSelection; readonly message: string }
  | { readonly kind: 'unavailable'; readonly requirement: RobotWorkflowRequirement; readonly selection: RobotWorkflowSelection; readonly message: string }
  | { readonly kind: 'missing'; readonly requirement: RobotWorkflowRequirement }

/** One workflow resolved against a point-in-time robot inspection. */
export interface RobotWorkflowResolution {
  /** `ready` requires every required operation to be ready; `blocked` has a missing or unavailable required operation. */
  readonly status: 'ready' | 'degraded' | 'blocked'
  readonly workflow: RobotWorkflowDefinition
  readonly requirements: readonly RobotWorkflowRequirementResolution[]
}

/** Complete workflow analysis and the robot evidence used to compute it. */
export interface RobotWorkflowInspection {
  readonly robot: RobotInspection
  readonly workflows: readonly RobotWorkflowResolution[]
}
