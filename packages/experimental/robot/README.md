---
description: "Experimental robot capability registry: discover sensors, perception functions and actuators, validate operations, and route exact provider requests."
kind: "package-reference"
---

# @deepseek-ai/dsh-robot

English | [中文](README.zh.md)

## Summary

This package is the provider-neutral robot service. Robot adapters register one robot or gateway, declare its current sensors, perception functions, actuators and mobility operations, and execute only exact declared operations. It also compares live capabilities with portable development workflows for spatial memory, simulation, hand-eye calibration and gravity compensation.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the service before a provider and a consumer:

```yaml
- name: cordis:@deepseek-ai/dsh-robot
- name: cordis:@deepseek-ai/dsh-robot-simulated
- name: cordis:@deepseek-ai/dsh-tool-robot
```

A hardware adapter injects `robot`, implements `RobotProvider`, and owns the disposer returned by `ctx.robot.register(provider)` with `ctx.effect()`. `discover()` must return the current complete capability list without changing robot state. `execute()` receives an exact capability, operation and already validated JSON arguments, and must honor its cancellation signal.

Operation mode is part of the declaration: `observe` reads sensor or inferred state, while `act` may change the physical world. If a transport failure leaves the physical result uncertain, return `{ kind: 'unknown', message }`; do not report completion.

`ctx.robot.inspectWorkflows(signal, workflowId?)` performs one live inspection and resolves every workflow requirement to a ready, degraded, unavailable or missing exact operation. A ready workflow means only that its required operations were discoverable and ready at that instant. It does not execute those operations, authorize a task or replace safety qualification. Plugins can add portable workflows with `ctx.robot.registerWorkflow(definition)` and must own the returned disposer with `ctx.effect()`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`RobotRuntime` owns provider and workflow identities, provider lifetimes and accepted work. Inspection runs providers concurrently and contains one provider's failure so other robots remain discoverable. Workflow analysis ranks exact ready alternatives before degraded or unavailable alternatives and marks a workflow blocked when a required operation is missing or unavailable. Execution remains separate: it re-discovers the selected provider, validates the exact operation and arguments, then dispatches only that registration.

Tool calls and results already give robot interactions their durable, model-visible representation, so this service adds no parallel Session event.

| Source | Contents |
|---|---|
| [`src/types.ts`](src/types.ts) | Provider, capability, operation, argument and outcome types |
| [`src/index.ts`](src/index.ts) | Registry, discovery, validation, routing and lifecycle |
| [`src/workflows.ts`](src/workflows.ts) | Standard portable requirements and verification stages |
| [`tests/runtime.spec.ts`](tests/runtime.spec.ts) | Failure containment, validation and unload behavior |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Simulated robot](../robot-simulated/README.md) — runnable radar, camera, recognition, spatial, gripper and mobile-base provider.
- [Robot tools](../tool-robot/README.md) — model-facing discovery, observation and action flow.
- [Robot subsystem](../../../docs/subsystems/robot.md) — architecture, command flow, adapter requirements and delivery stages.
- [Architecture](../../../docs/architecture.md) — Service Definition, Provider and Consumer capability seams.

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-robot`, which owns discovery schemas and logged operation results.

#### KV Cache effect

The service itself adds no prompt text or tool declaration; its consumer's ordinary tool definitions and results determine cache behavior.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The first framework supports named JSON arguments and primitive validation; adapters own richer protocol validation before registration or at their process and wire interfaces.
- Capability snapshots are read on demand; no streaming telemetry subscription is exposed yet.
- Standard workflows describe required interfaces and verification, but they do not include the missing simulator, calibration, dynamics, memory, navigation or manipulation providers.
- Collision checking, motion planning, emergency stops and hardware interlocks remain provider or robot-controller responsibilities. Tool approval is not a substitute for them.
- ROS 2 and vendor SDK adapters are not included in this first framework.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Keep hardware protocols behind provider packages. Do not add robot-specific branches to the agent loop.

</details>
