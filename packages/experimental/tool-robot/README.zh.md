---
description: "供模型发现机器人能力、检查具身工作流、执行观察和请求经审批物理动作的工具。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-robot

[English](README.md) | 中文

## 概述

本包用四个工具把机器人能力接缝提供给模型：发现全部能力、把实时能力与标准具身工作流比较、执行只读观察、请求物理动作。观察和动作使用不同工具，运行时还会检查声明的模式。物理动作默认需要用户审批。

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

在 `@deepseek-ai/dsh-robot` 和至少一个提供者之后挂载。`inspectionTimeoutMs` 默认为 10 秒，`operationTimeoutMs` 默认为 60 秒，`requireActionApproval` 默认为 `true`。只有无人值守部署已经具备等效的外部授权和硬件安全控制时，才应把最后一个字段设为 `false`。

启动、组装提示词以及每个 Agent 步骤都会刷新发现结果。必需的 `systemPrompt` 服务提供记录到日志的 `robot:self` 运行上下文，受 `maxContextCharacters`（16000）限制，并按 `contextOrder`（220）排序。目录超限时需调用 `robot_inspect`；发现失败会明确标记硬件可用性未知。

用户描述应用而不是具体操作时，先使用 `robot_workflow`。它会报告准确匹配和缺失的操作，以及有序的实现与验收阶段，不会执行任何操作。执行流程仍是 `robot_inspect` → 选择返回的准确 id → 按需调用 `robot_observe` → 对已声明动作调用 `robot_act` → 再次观察并确认物理状态。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

工具不传递任意命令字符串。`robot_workflow` 要求服务用一次当前检查解析代码中定义的工作流，绝不派发操作。观察和动作工具把 `provider_id`、`capability_id`、`operation_id` 和结构化参数交给 `ctx.robot`。一个 `tools/pre-execute` waterfall 监听器会对无关调用执行 `next()`，并对 `robot_act` 返回 `ask`。通用工具调用和结果负责 Session 的持久日志与回放。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [机器人服务](../robot/README.zh.md) — 提供者约定和生命周期。
- [模拟机器人](../robot-simulated/README.zh.md) — 可运行的第一套组合。
- [用户审批](../../interaction/user-approval/README.zh.md) — 审批策略和应答器。

<a id="model-experience"></a>
## 模型体验

### 机器人工具 schema

#### 模型看到什么

[生成的声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-robot)提供 `robot_inspect`、`robot_workflow`、`robot_observe` 和 `robot_act`；工作流分析返回当前覆盖情况且不执行操作，发现结果返回准确 id 和参数声明，观察返回传感器或感知 JSON，动作经审批后返回 `completed` 或 `unknown`。

#### Token 影响

挂载本包期间，每次模型请求都会声明四个普通工具。运行上下文包含能力证据及任务与开发指引；每项操作增加记录到日志的参数和结果。发现与工作流结果的大小随已注册能力和要求的数量增长。

#### KV Cache 影响

提供者变化时工具定义保持稳定。运行上下文机制把变化的事实记录为新上下文；历史事实仍可重建。持续变化的时间戳或遥测会增加追加上下文，并降低后续 token 的缓存复用。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 工具目前使用通用卡片，专用的机器人遥测和动作回执界面留待后续实现。
- 每次调用执行一个操作。协调计划仍由一系列已经发现的操作组成，安全敏感步骤之间应重新观察状态。
- 工作流分析不会安装缺失适配器、运行验收阶段或认证机器人能够完成任务。
- 审批只授权一次工具调用，不能替代控制器联锁、工作空间限制或急停系统。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

模型工具的 schema 应保持与提供者无关。协议专用能力应放入适配器，并且只通过发现接口暴露可移植操作。

</details>
