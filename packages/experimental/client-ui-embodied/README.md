---
description: "Inspect the connected robot, observed service readiness, exact callable operations and missing adapters in the Harness UI."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-embodied

English | [中文](README.zh.md)

## Summary

Inspect the connected robot, observed service readiness, exact callable operations and missing adapters in the Harness UI.

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

Mount the Host facade after the robot registry. Its Client contribution adds a Robot self panel to the existing Web layout; the normal client loader supplies Remote, locale and slot services.

```yaml
- name: '@deepseek-ai/dsh-client-ui-embodied'
```

The panel reads the robot registry when mounted and when refreshed. A failed refresh clears the previous inventory. Individual provider failures stay visible; no simulated robot replaces an unavailable connection. inspectionTimeoutMs defaults to 10000.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The optional Remote facade calls the same registry as robot tools. The page shows adapter evidence and explicitly separates observation support from missing task-execution adapters. The retained project dispatch method requires the optional sample project services.

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

None, as the panel reads discovery snapshots without submitting them to a model.

#### KV Cache effect

The robot tool consumer owns logged self context. Opening or refreshing this panel does not add model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The panel uses explicit refresh rather than streaming telemetry. Task execution and development use the Harness conversation; this panel does not issue physical actions.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
