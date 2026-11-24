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

Opening the panel adds `#robot-self` to the URL. Reloading that URL reopens the panel and reads fresh controller state. The panel reads the robot registry when mounted and when refreshed. Select a status count to filter a device's snapshot. Search the list by capability name, operation name, or operation ID. Capabilities are grouped by category. Expand a row to see its status explanation, registered operations, modes, and discovery evidence. A failed refresh clears the previous inventory. Individual provider failures stay visible without substituting a simulated device. `inspectionTimeoutMs` defaults to 10000.

For the provider with ID `g1d`, install the meter-scale G1-D GLB from the Unitree model catalog at `apps/web/public/robot-models/g1-d.glb` before building Web. The visible panel samples the device two seconds after each response. Both lift stages follow calibrated height feedback. The optional G1-D operator adapter sends explicit button presses to the configured physical robot tools. It reads odometry and measured arm joint angles for the animated model. Each lift command moves up to 10 cm. Near either limit the button moves the remaining distance and becomes disabled within the configured arrival tolerance. The robot header shows a connection when the gateway responds or a motion service reports live feedback. It also counts the online motion services. The chassis, lift, arm and suction indicators follow their own telemetry. Use the motion controls to operate the arm, lift and suction cup. The actuator status rows show measured lift height, the active arm task count and the suction controller output. Enter an object name or ID to pick. An optional `suctionUrl` points to the ES80Z API origin. Switching suction requires a responsive, idle arm console and ready serial output. The output acknowledgement does not measure vacuum pressure. The panel shows the controller response separately from measurements.

The left camera row shows the configured hardware model, camera type and source frame rate. Expanding it starts a JPEG preview and measures the received image payload in kbit/s. Folding the row or hiding the tab stops acquisition. Mount [the camera relay](examples/g1d-camera.mjs) in the Web profile with the dashboard `origin`, camera `type`, `fps` and an optional verified `model`.

The [spatial relay](examples/g1d-spatial.mjs) uses the same dashboard `origin`, a verified `locationSource` and an optional `lidarModel`. Expanding the spatial or navigation row starts its laser scan or odometry preview. Each view reports received payload rate and the source update frequency estimated from successive timestamps and sequence numbers. The trail uses the reported odometry frame and starts again when the view reopens.

For the deployed `robot-arm` bundle, call `installOperator(ctx, { tools, robot, settings, jointsUrl, liftUrl })` from [the operator adapter](examples/g1d-operator.mjs) after constructing the tools and before registering them. Supply the low-state visualizer’s `/api/robot_state` and the calibrated lift service’s `/api/basic_status` URLs. Manual dispatch requires `directMotion: true` and `requireActionApproval: false` on that operator profile. Every new panel command consumes one admission ticket. The arm E-stop submits the configured console stop, which also releases suction.

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

- Motion controls require the installed operator adapter and its direct-motion configuration. Unavailable feedback disables the corresponding movement.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
