---
description: "Durable semantic spatial observations exposed through the portable robot capability API."
kind: "package-reference"
---

# @deepseek-ai/dsh-robot-spatial-memory

English | [中文](README.zh.md)

## Summary

This package stores timestamped semantic observations and recalls them as historical evidence. It gives an embodied Harness durable spatial memory without making stored coordinates look safe for current navigation or manipulation.

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

Mount it after `@deepseek-ai/dsh-robot` and `@deepseek-ai/dsh-storage-domain`. The default embodied bundle already supplies this ordering. The provider exposes `spatial_memory/remember` for durable writes and `spatial_memory/recall` for text, frame and age-filtered reads. Configuration controls provider identity, record capacity, per-record byte limits and recall result limits.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Each observation records its acquisition time, coordinate frame, pose fields, evidence provenance and optional confidence. Storage uses a versioned storage domain. Recall results are marked `historical` and `historical-only`; callers must re-observe the target and validate current transforms before physical action.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Robot service](../robot/README.md) — provider-neutral discovery and execution.
- [Embodied bundle](../embodied-bundle/README.md) — default composition.

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-robot`, which inspects the provider and executes memory operations through the robot runtime.

#### KV Cache effect

The provider adds no prompt text or tool declarations itself. The robot tool consumer logs discovered capability facts and operation results.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Recall uses case-insensitive text matching; it does not yet provide embeddings, scene graphs or 3D Gaussian Splatting retrieval.
- Observation ingestion is explicit. Camera, recognition and localization adapters must provide current evidence and frames.
- Historical poses are evidence only and never authorize motion.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Keep stored evidence provider-neutral. Hardware-specific calibration and frame conversion belong in the observing adapter.

</details>
