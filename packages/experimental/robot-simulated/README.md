---
description: "Deterministic simulated mobile manipulator with radar, camera, object recognition, spatial perception, gripper and base operations."
kind: "package-reference"
---

# @deepseek-ai/dsh-robot-simulated

English | [中文](README.zh.md)

## Summary

This package registers a deterministic in-process mobile manipulator. It exercises the complete robot discovery and execution path without hardware and provides a starting point for adapter tests and deployment rehearsal.

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

Mount it after `@deepseek-ai/dsh-robot`. Configuration fields are `providerId` (`simulated`), `providerName` (`Simulated mobile manipulator`), `obstacleDistanceMeters` (`1.4`) and `recognizedObjectLabel` (`box`). It exposes radar scanning, camera summaries, object recognition, local-map pose, gripper opening and relative base movement.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

One provider instance owns pose and gripper state. Observation operations read deterministic values; action operations update that state. The plugin registers the instance as an effect, so unloading it removes the provider and drains accepted work through the robot runtime.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Robot service](../robot/README.md) — adapter interface and validation.
- [Robot tools](../tool-robot/README.md) — model-facing operations.

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-robot`, which exposes the simulated provider's capabilities and results.

#### KV Cache effect

The provider adds no prompt text or tool declarations itself; the robot tool consumer supplies its facts through logged runtime context and tool results.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The simulator is deterministic and does not model dynamics, collisions, sensor noise or timing.
- It is a test and demonstration provider, not a safety simulator.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Keep operations aligned with the provider-neutral service examples; hardware-only fields belong in hardware adapters.

</details>
