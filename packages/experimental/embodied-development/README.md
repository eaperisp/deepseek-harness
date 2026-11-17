---
description: "Start visual recognition and spatial-memory exercises with annotated samples and beginner development guidance."
kind: "package-reference"
---

# @deepseek-ai/dsh-embodied-development

English | [中文](README.zh.md)

## Summary

Start visual recognition and spatial-memory exercises with annotated samples and beginner development guidance.

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

Load this provider after the project and skill services. It contributes two templates, two explicit sample targets, and a development skill that the existing skill tool loads on demand.

```yaml
- name: '@deepseek-ai/dsh-embodied-development'
```

The skill guides goal clarification, capability matching, ordinary Harness code editing and test work, revision updates, and interpretation of evidence. Imported documents remain reference data. Providers own template semantics and must change their version when results or capabilities change.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Visual recognition lists annotations from three fixtures. Spatial memory matches whitespace-separated query tokens against bilingual labels. A run records its query, sample timestamps and map session. Camera-only targets preserve observer position as null.

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

### Development context

#### What the model sees

The on-demand [skill body](src/instructions.ts) supplies beginner development guidance under `embodied-development`; the skill tool owns its Session representation.

#### Token effect

The skill catalog contains a short description. Full instructions enter context only when the skill is requested.

#### KV Cache effect

Tool and skill consumers own logged model context. New project query results append to the conversation without rewriting prior request prefixes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- These examples do not run a vision model, read live images, build a map or connect to HomeBody. A historical observer position is not an object coordinate or evidence of current presence.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
