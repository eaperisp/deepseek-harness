---
description: "Model tools for discovering robot capabilities, checking embodied workflows, running observations, and requesting approved physical actions."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-robot

English | [中文](README.zh.md)

## Summary

This package exposes the robot seam to models as four tools: discover everything, compare live capabilities with standard embodied workflows, run a read-only observation, and request a physical action. Observation and action are separate tools and the runtime checks their declared mode. Physical actions require user approval by default.

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

Mount it after `@deepseek-ai/dsh-robot` and at least one provider. `inspectionTimeoutMs` defaults to 10 seconds, `operationTimeoutMs` to 60 seconds, and `requireActionApproval` to `true`. Set the last field to `false` only when an unattended deployment has equivalent external authorization and hardware safety controls.

Startup, prompt assembly and each Agent step refresh discovery. The required `systemPrompt` service supplies a logged `robot:self` runtime-context section, bounded by `maxContextCharacters` (16000) and ordered by `contextOrder` (220). Oversized catalogs require `robot_inspect`; failed discovery explicitly marks hardware availability unknown.

Use `robot_workflow` first when the user names an application rather than an operation. It reports exact matched and missing operations plus ordered implementation and verification stages without executing anything. The execution flow remains `robot_inspect` → select exact returned ids → `robot_observe` as needed → `robot_act` for a declared action → observe again to verify physical state.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The tools pass no arbitrary command string. `robot_workflow` asks the service to resolve code-owned definitions against one current inspection; it never dispatches an operation. Observation and action tools route `provider_id`, `capability_id`, `operation_id` and structured arguments to `ctx.robot`. A `tools/pre-execute` waterfall listener delegates every unrelated call and returns `ask` for `robot_act`. Generic tool calls and results provide durable Session logging and replay.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Robot service](../robot/README.md) — provider contract and lifecycle.
- [Simulated robot](../robot-simulated/README.md) — runnable first composition.
- [User approval](../../interaction/user-approval/README.md) — approval policy and answerers.

<a id="model-experience"></a>
## Model Experience

### Robot tool schemas

#### What the model sees

The [generated declarations](../../../docs/tool-catalog.md#deepseek-aidsh-tool-robot) expose `robot_inspect`, `robot_workflow`, `robot_observe`, and `robot_act`; workflow analysis returns current coverage without execution, discovery returns exact ids and argument declarations, observations return sensor or perception JSON, and actions return `completed` or `unknown` after approval.

#### Token effect

Every model request declares four ordinary tools while the package is mounted. Runtime context includes capability evidence and task/development instructions; each operation adds its logged arguments and result. Discovery and workflow results scale with the registered capability and requirement counts.

#### KV Cache effect

Tool definitions remain stable while providers change. The runtime-context mechanism logs changed facts as new context; earlier facts remain reconstructable. Repeated timestamps or telemetry can increase appended context and reduce reuse for subsequent tokens.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Tools use the generic card; dedicated robot telemetry and action receipts are deferred.
- One call executes one operation. Coordinated plans remain a sequence of discovered operations and should re-observe state between safety-sensitive steps.
- Workflow analysis does not install missing adapters, run verification stages or certify the robot for a task.
- Approval authorizes one tool call; it does not replace controller interlocks, workspace limits or emergency-stop systems.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Keep model schemas provider-neutral. Add protocol-specific affordances to an adapter and expose only portable operations through discovery.

</details>
