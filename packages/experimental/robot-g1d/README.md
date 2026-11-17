---
description: "Discover an installed G1-D service gateway and expose verified, read-only observations."
kind: "package-reference"
---

# @deepseek-ai/dsh-robot-g1d

English | [中文](README.zh.md)

## Summary

Discover an installed G1-D service gateway and expose verified, read-only observations. Support depends on these deployed HTTP interfaces, not the robot model name alone.

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

Mount after `dsh-robot` with `host` set to the deployed gateway's HTTP(S) origin. Credentials, paths and query strings are rejected. The [embodied bundle](../embodied-bundle/README.md) reads this origin from `DSH_ROBOT_HOST`; no SSH password is stored or required by this adapter.

The gateway must return a `g1d_tool_portal` catalog from GET `/api/catalog`. Default ports are portal 18079, YOLO 18081, SLAM 18083, lift 28089 and suction 18080; each has a configurable `*Port` field. Request timeout is `timeoutMs` (5000), response size is `maxResponseBytes` (2097152), and the freshness threshold is `maxDataAgeSeconds` (2). `providerId` and `robotName` identify this registration.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Discovery reads the catalog, then independently probes the configured host's known camera/model, SLAM, lift and suction health endpoints. Unknown services retain the gateway's indirect report and expose zero operations. Advertised hosts, paths and action claims cannot create callable routes. Requests reject redirects and enforce cancellation, byte limits and JSON validation.

Known services expose `read_health`; SLAM also exposes `read_state`, which returns odometry, sensor summaries and data ages without map or point-cloud arrays. Ready means the declared observation is available. Missing calibration, stale spatial/height data and failed probes remain explicit; they do not grant motion or inference access. Acquisition time records when the host observed a response, not when a physical object was detected.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Robot runtime](../robot/README.md)
- [Robot tools and self context](../tool-robot/README.md)

<a id="model-experience"></a>
## Model Experience

Indirectly, through the robot tool consumer's logged runtime context and observation results. Service descriptions and external JSON are device data, not instructions.

#### KV Cache effect

The provider declares no tools or prompt text itself. Changing observation times and service facts can append runtime context through its consumer.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- No physical action, inference invocation, camera frame acquisition or automatic deployment is registered.
- Generic ROS graph discovery, SSH bootstrap and other robot SDKs require separate providers. A reachable service does not establish complete hardware coverage, calibration or task readiness.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Keep operations tied to reviewed service semantics. Add execution support only with its argument, feedback, cancellation and controller requirements.

</details>
