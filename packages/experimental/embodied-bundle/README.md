---
description: "Discover a connected robot at startup and supply its actual capabilities to the Harness conversation and optional self-inspection panel."
kind: "package-bundle"
---

# @deepseek-ai/dsh-embodied-bundle

English | [中文](README.zh.md)

## Summary

Discover a connected robot at startup and supply its actual capabilities to the Harness conversation and optional self-inspection panel.

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

This optional bundle declares its plugin rows in the exported patch. Set DSH_ROBOT_HOST to the G1-D HTTP origin, or use the default http://127.0.0.1 when Harness runs on the robot. The parent profile supplies tools and systemPrompt; the bundle adds no alternative application entrypoint.

[Composition patch](cordis.patch.yml)

Use the existing profile and optional-bundle mechanisms when integrating the source package into a distribution. The default patch uses the real gateway adapter. The separate sample.patch.yml retains sample project services for tests and requires DSH_EMBODIED_PROJECTS_ROOT; it is not loaded by default.

### Add a custom robot tool

From the source checkout, launch the Web profile with the simulated robot and the [example tool patch](examples/custom-tool.patch.yml).

```sh
pnpm dsh --profile web --patch packages/experimental/embodied-bundle/examples/simulated.patch.yml --patch packages/experimental/embodied-bundle/examples/custom-tool.patch.yml --no-open --port 0
```

Open the URL printed by the launcher. In a session with a configured model, ask it to call `robot_inventory_summary`. The example reports one available provider and six ready simulated capabilities. The recorded-session test verifies that call without a live model or robot.

Copy [inventory-tool.ts](examples/inventory-tool.ts) and its patch into your extension directory. Give the YAML row and tool unique names, point the row at your TypeScript file, then adapt the input schema, output schema and `execute` function. Pass `exec.signal` when calling the robot service. Replace the example patch path in the launch command with your own.

Use `ctx.tools.register` for a new tool that combines read-only capabilities. To add a sensor or device operation, implement a [robot provider](../robot/README.md) and register it with `ctx.robot.register` in an effect. Declare device-changing operations as `act` and invoke them through `robot_act` to retain the approval policy. Use the simulation patch for local tests and the device bundle patch for the corresponding hardware deployment.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The patch composes the robot registry, G1-D observation adapter, durable spatial-memory provider, model consumer and self-inspection panel. Startup discovery and model-step refresh make capability evidence available through logged runtime context. Provider failures remain explicit.

[Source](src/index.ts)

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Embodied Harness subsystem](../../../docs/subsystems/embodied.md)
- [Robot capability runtime](../robot/README.md)
- [Harness architecture](../../../docs/architecture.md)

<a id="model-experience"></a>
## Model Experience

Indirectly, through the robot tool consumer composed by the patch.

#### KV Cache effect

The robot tool consumer owns logged self context and observations. Changed runtime facts append to the conversation without rewriting previous facts.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- No shipped profile enables this bundle by default. G1-D support covers reviewed gateway observation routes; motion and inference execution require additional adapters.
- Spatial memory stores explicit observations and uses lexical recall. Camera, recognition and localization adapters still need to supply current evidence.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
