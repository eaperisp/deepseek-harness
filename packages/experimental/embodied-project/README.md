---
description: "Save robot development projects, compare required capabilities, and retain evidence for each configuration revision."
kind: "package-reference"
---

# @deepseek-ai/dsh-embodied-project

English | [中文](README.zh.md)

## Summary

Save robot development projects, compare required capabilities, and retain evidence for each configuration revision.

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

Mount this service with an absolute project storage root, then load template providers and a tool or workbench consumer. The bundle supplies the composition; its storage root comes from `DSH_EMBODIED_PROJECTS_ROOT`.

```yaml
- name: '@deepseek-ai/dsh-embodied-project'
  config:
    root: !!js process.env.DSH_EMBODIED_PROJECTS_ROOT
```

Configuration defaults are 2,000,000 bytes per document or command, 100 projects and 200 total revisions plus runs per project. Concurrent mutations use file locks and expected revisions. Invalid files fail without replacement. Cancellation before commit saves nothing; an accepted atomic write can finish, so read the project before retrying an uncertain operation.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Projects retain immutable revisions and sample runs. Each revision pins template and target versions. Changing a target or provider version invalidates current validation without deleting historical runs. Required capabilities block execution; absent optional capabilities remain explicit.

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

Indirectly, through `dsh-tool-embodied-project`, which owns tool declarations and logged project results.

#### KV Cache effect

Tool and skill consumers own logged model context. New project query results append to the conversation without rewriting prior request prefixes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Only sample runs are accepted. Project files are local development records, not application source bundles or hardware deployment receipts.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
