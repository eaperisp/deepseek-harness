---
description: "实验性机器人能力注册服务：发现传感器、感知功能和执行器，校验操作，并把请求路由到指定提供者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-robot

[English](README.md) | 中文

## 概述

本包是与具体厂商无关的机器人服务。适配器注册一台机器人或一个网关，声明当前的传感器、感知功能、执行器和移动操作，并且只执行明确声明的操作。它还会把实时能力与空间记忆、仿真、手眼标定和重力补偿等可移植开发工作流进行比较。

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

先挂载服务，再挂载提供者和消费者：

```yaml
- name: cordis:@deepseek-ai/dsh-robot
- name: cordis:@deepseek-ai/dsh-robot-simulated
- name: cordis:@deepseek-ai/dsh-tool-robot
```

硬件适配器注入 `robot`、实现 `RobotProvider`，并用 `ctx.effect()` 持有 `ctx.robot.register(provider)` 返回的释放函数。`discover()` 必须返回当前完整的能力列表，且不得改变机器人状态。`execute()` 接收明确的能力、操作和已经校验过的 JSON 参数，并且必须响应取消信号。

操作声明包含模式：`observe` 读取传感器或推断状态，`act` 可能改变物理环境。如果传输故障导致物理结果无法确认，提供者必须返回 `{ kind: 'unknown', message }`，不能报告完成。

`ctx.robot.inspectWorkflows(signal, workflowId?)` 执行一次实时检查，并把每项工作流要求解析为就绪、降级、不可用或缺失的准确操作。工作流就绪仅表示检查时所需操作可发现且状态就绪；它不会执行操作、授权任务或替代安全验收。插件可以通过 `ctx.robot.registerWorkflow(definition)` 增加可移植工作流，并且必须用 `ctx.effect()` 持有返回的释放函数。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

`RobotRuntime` 持有提供者与工作流身份、提供者生命周期和已接受的工作。检查会并发调用各提供者，并隔离单个提供者的故障。工作流分析优先选择准确且就绪的备选操作，再考虑降级或不可用操作；所需操作缺失或不可用时把工作流标记为阻塞。执行仍是独立步骤：运行时重新发现所选提供者，校验准确操作和参数，再只派发到该注册实例。

工具调用和结果已经是机器人交互面向模型的持久记录，因此本服务不会再添加一套平行的 Session 事件。

| 源码 | 内容 |
|---|---|
| [`src/types.ts`](src/types.ts) | 提供者、能力、操作、参数和结果类型 |
| [`src/index.ts`](src/index.ts) | 注册、发现、校验、路由和生命周期 |
| [`src/workflows.ts`](src/workflows.ts) | 标准可移植要求和验收阶段 |
| [`tests/runtime.spec.ts`](tests/runtime.spec.ts) | 故障隔离、校验和卸载行为 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [模拟机器人](../robot-simulated/README.zh.md) — 可运行的雷达、相机、识别、空间感知、夹爪和移动底盘提供者。
- [机器人工具](../tool-robot/README.zh.md) — 面向模型的发现、观察和动作流程。
- [机器人子系统](../../../docs/subsystems/robot.zh.md) — 架构、指令流程、适配器要求与交付阶段。
- [架构](../../../docs/architecture.zh.md) — 服务定义、提供者和消费者组成的能力接缝。

<a id="model-experience"></a>
## 模型体验

间接地，通过 `dsh-tool-robot` 提供发现 schema 和记录到日志的操作结果。

#### KV Cache 影响

本服务自身不增加提示词或工具声明；缓存行为由消费者的普通工具定义和结果决定。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 第一版框架支持具名 JSON 参数和基础类型校验；适配器仍须在注册前或自身进程、网络接口处校验更复杂的协议数据。
- 当前按需读取能力快照，尚未提供流式遥测订阅。
- 标准工作流描述所需接口和验收方法，但不包含尚缺的仿真、标定、动力学、记忆、导航或操作提供者。
- 防碰撞、运动规划、急停和硬件联锁仍由提供者或机器人控制器负责，工具审批不能替代这些机制。
- 第一版框架尚未包含 ROS 2 和厂商 SDK 适配器。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

硬件协议应留在提供者包中，不要为机器人在 agent loop 中增加专用分支。

</details>
