---
description: "确定性的模拟移动机械臂，提供雷达、相机、物体识别、空间感知、夹爪和底盘操作。"
kind: "package-reference"
---

# @deepseek-ai/dsh-robot-simulated

[English](README.md) | 中文

## 概述

本包注册一个进程内、结果确定的模拟移动机械臂。它无需硬件即可运行完整的机器人发现与执行流程，可作为适配器测试和部署演练的起点。

## 目录

- [使用本包](#use-this-package)
- [实现原理](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 `@deepseek-ai/dsh-robot` 之后挂载。配置字段包括 `providerId`（默认 `simulated`）、`providerName`（默认 `Simulated mobile manipulator`）、`obstacleDistanceMeters`（默认 `1.4`）和 `recognizedObjectLabel`（默认 `box`）。它提供雷达扫描、相机摘要、物体识别、本地地图位姿、夹爪开度和底盘相对移动。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

一个提供者实例持有位姿和夹爪状态。观察操作读取确定值，动作操作更新这些状态。插件用 effect 注册该实例，因此卸载时会移除提供者，并通过机器人运行时等待已经接受的工作结束。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [机器人服务](../robot/README.zh.md) — 适配器接口和校验。
- [机器人工具](../tool-robot/README.zh.md) — 面向模型的操作。

<a id="model-experience"></a>
## 模型体验

间接地，通过 `dsh-tool-robot` 暴露模拟提供者的能力和结果。

#### KV Cache 影响

提供者自身不增加提示词或工具声明；机器人工具消费者通过已记录的运行上下文及工具结果提供其事实。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 模拟器是确定性的，不模拟动力学、碰撞、传感器噪声或时序。
- 它是测试和演示提供者，不是安全仿真器。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

操作应与通用服务示例保持一致；硬件专用字段应放入硬件适配器。

</details>
