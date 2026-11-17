# Robot integration

English | [中文](robot.zh.md)

The experimental robot subsystem lets an Agent discover the actual functions exposed by a deployed robot and invoke exact operations without embedding ROS, vendor SDK, or device-specific branches in the agent loop. It separates portable capability descriptions, hardware adapters, and model tools.

## Architecture

| Layer | Package | Responsibility |
|---|---|---|
| Service Definition | [`dsh-robot`](../../packages/experimental/robot/README.md) | Provider and workflow registries, discovery, live workflow matching, operation validation, exact routing, cancellation and unload settlement |
| Service Provider | [`dsh-robot-simulated`](../../packages/experimental/robot-simulated/README.md), [`dsh-robot-g1d`](../../packages/experimental/robot-g1d/README.md) or [`dsh-robot-spatial-memory`](../../packages/experimental/robot-spatial-memory/README.md) | Translate ROS 2, a vendor SDK, a local gateway or a durable application service into portable capabilities and execute approved requests |
| Consumer | [`dsh-tool-robot`](../../packages/experimental/tool-robot/README.md) | Expose discovery, read-only observation and physical action as model tools; request approval for actions |

One Host can register several robots or gateways. Each provider declares capabilities such as a radar, camera, object recognition, spatial localization, gripper or mobile base. A capability declares its current status and operations. Each operation has a stable id, an `observe` or `act` mode, and named JSON arguments with types, bounds, units and optional enum values.

## Public vocabulary

### `RobotProvider`

One registered robot or gateway, with stable `RobotProviderInfo`, read-only `discover()` and exact `execute()` methods.

### `RobotCapability`

One sensor, perception function, actuator, mobility function or system service, including readiness, optional JSON evidence and its current `RobotOperationDefinition` list. The browser-safe `./model` export validates inspection JSON.

### `RobotExecutionRequest`

An exact provider, capability and operation selection, its expected `RobotOperationMode`, and structured `RobotArguments`.

### `RobotInspection`

One point-in-time list of `RobotProviderSnapshot` values. Each provider is independently `available` with capabilities or `failed` with a safe `RobotDiscoveryFailure`.

### `RobotOperationOutcome`

A closed result: `completed` carries lossless JSON output, while `unknown` states that the physical outcome cannot be confirmed.

### `RobotWorkflowDefinition`

A provider-neutral application definition with exact alternative operations, required and optional abilities, ordered implementation stages and observable verification checks. `RobotWorkflowResolution` maps each requirement to a ready, degraded, unavailable or missing live operation and marks the overall workflow ready, degraded or blocked.

## Standard workflows

The runtime includes four starting definitions. Spatial memory follows the HomeBody-style sequence of calibrated sensing, localization, semantic observation, evidence-backed memory and live re-observation; its durable provider implements memory write and recall, while sensing, localization, navigation and manipulation still depend on matching adapters. Simulation and real-to-sim require a versioned scene, bounded deterministic episodes and retained metrics before an optional hardware transfer. Hand-eye calibration separates frame configuration, diverse synchronized sample collection, solving, explicit application and independent verification. Gravity compensation first establishes one controller owner, then identifies payload and verifies stationary and slow-motion behavior to avoid double compensation.

These definitions are capability requirements, not implementations. `inspectWorkflows()` performs discovery only and never invokes an operation. A plugin can register another portable definition, while robot-specific transports and controllers remain provider packages.

## Command flow

1. Startup and Agent steps refresh logged self context; the user asks for a task in ordinary language.
2. For an application request, the model calls `robot_workflow` and receives live matches, missing adapters, implementation stages and verification checks. This step performs no robot operation.
3. The model calls `robot_inspect` and receives all currently registered providers, capabilities, readiness states, operations and argument declarations.
4. The model selects only ids from that result. It may call `robot_observe` to read radar, camera-derived recognition, pose or other state.
5. For a physical change, the model calls `robot_act`. The default tool policy asks the user before dispatch and preserves stricter downstream policy decisions.
6. `ctx.robot` re-discovers the selected provider, rejects stale or unavailable capabilities, verifies `observe` versus `act`, validates all arguments, and routes to the exact provider registration.
7. The provider executes through its controller and returns `completed` or `unknown`. An uncertain outcome is never converted to success.
8. The model can observe again to verify the resulting physical state. Ordinary tool call and result events retain the complete model-visible interaction in the Session log.

Discovery failures are contained by provider: one disconnected robot appears as failed while other robots and functions remain usable. Provider unload first removes admission, aborts accepted work, and waits for it to settle.

## Hardware adapter requirements

A production adapter should keep transport details behind `RobotProvider`. It validates untrusted ROS, process, wire, or SDK data at that interface, maps controller failures to actionable messages, honors cancellation and reaches quiescence before unload. It must expose only operations the controller can actually perform and refresh status on discovery.

Approval is one authorization layer, not motion safety. Collision avoidance, joint and velocity limits, workspace constraints, interlocks, watchdogs and emergency stops remain enforced by the robot controller or provider. Deployments that disable `requireActionApproval` need equivalent external authorization and hardware safeguards.

## Delivery stages

The G1-D gateway provider exposes verified observations. The spatial-memory provider persists semantic observations and recalls them as historical evidence. ROS 2 discovery, additional vendor SDKs, physical execution and streaming telemetry require independently validated adapters. The deterministic simulator exercises provider-neutral dispatch without claiming hardware readiness.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxrobot--robotruntime"></a>

### `ctx.robot` — `RobotRuntime`

Registry shared by robot providers and model-facing consumers in one Host.

```ts cordis-catalog
/**
 * Register one robot or gateway; duplicate ids fail without replacing the original.
 * The contributing plugin must own the returned disposer with `ctx.effect()`.
 * @param provider - adapter owned by the contributing plugin.
 * @returns idempotent disposer which removes admission, cancels, and joins accepted work.
 */
register(provider: RobotProvider): () => Promise<void>

/**
 * Read registered provider facts in registration order without contacting hardware.
 * @returns detached provider facts.
 */
listProviders(): readonly RobotProviderInfo[]

/**
 * Register one additional portable workflow; duplicate ids fail without replacement.
 * The contributing plugin must own the returned disposer with `ctx.effect()`.
 * @param workflow - complete requirements and ordered verification stages.
 * @returns idempotent disposer which removes only this registration.
 */
registerWorkflow(workflow: RobotWorkflowDefinition): () => void

/**
 * List workflow definitions without contacting hardware.
 * @returns definitions in registration order.
 */
listWorkflows(): readonly RobotWorkflowDefinition[]

/**
 * Resolve one or every registered workflow against one shared live robot inspection.
 * This method never executes a robot operation; a `ready` result reports only that
 * the declared operations are discoverable and ready at inspection time.
 * @param signal - caller cancellation.
 * @param workflowId - optional exact workflow id.
 * @returns robot evidence and resolved workflow requirements.
 */
async inspectWorkflows(signal: AbortSignal, workflowId?: RobotWorkflowId): Promise<RobotWorkflowInspection>

/**
 * Discover all registered providers concurrently. One failed provider is reported
 * in place and does not hide working robots or capabilities.
 * @param signal - caller cancellation.
 * @returns one settled snapshot per provider in registration order.
 */
async inspect(signal: AbortSignal): Promise<RobotInspection>

/**
 * Re-discover, validate, and execute one exact provider operation. The mode must
 * match the declaration so read-only consumers cannot dispatch physical actions.
 * @param request - exact provider, operation, mode, and untrusted model arguments.
 * @param signal - caller cancellation.
 * @returns provider result, including explicit unknown physical outcomes.
 */
async execute(request: RobotExecutionRequest, signal: AbortSignal): Promise<RobotOperationOutcome>
```

Source: [`packages/experimental/robot/src/index.ts`](../../packages/experimental/robot/src/index.ts)
<!-- END GENERATED cordis-surface -->
