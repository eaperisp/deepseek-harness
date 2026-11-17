---
description: "Let an Agent discover development starters, create projects, run samples, and inspect revision-bound evidence."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-embodied-project

English | [中文](README.zh.md)

## Summary

Let an Agent discover development starters, create projects, run samples, and inspect revision-bound evidence.

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

Mount this consumer after the project and tools services. Begin with a catalog command. The Agent can continue ordinary file and shell development using the existing Harness tools.

```yaml
- name: '@deepseek-ai/dsh-tool-embodied-project'
```

The command actions are catalog, list, create, read, revise, run and export. Mutations that address an existing project require its current revision. Refresh after conflicts or uncertain outcomes; do not replay a mutation blindly.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The consumer forwards a validated JSON command to the project service. Ordinary tool calls and results retain everything shown to the model in the Session. The workbench uses the same service without duplicating project state.

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

The [generated tool declaration](../../../docs/tool-catalog.md#deepseek-aidsh-tool-embodied-project) defines embodied_project. Results contain project records or the template catalog.

#### Token effect

Loading adds one tool declaration. Each call adds its command and JSON result; cost grows with returned records.

#### KV Cache effect

Tool and skill consumers own logged model context. New project query results append to the conversation without rewriting prior request prefixes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Export returns project JSON for an existing file-delivery tool to save. It does not generate an application repository or deploy a robot.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
