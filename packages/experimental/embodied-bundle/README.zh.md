---
description: "启动时发现已连接机器人，并向 Harness 对话及可选自身状态面板提供实际能力。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-embodied-bundle

[English](README.md) | 中文

## 概述

启动时发现已连接机器人，并向 Harness 对话及可选自身状态面板提供实际能力。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

此可选组合包在导出的补丁中声明插件条目。将 DSH_ROBOT_HOST 设置为 G1-D HTTP 源地址；Harness 在机器人上运行时可使用默认的 http://127.0.0.1。父配置档提供 tools 和 systemPrompt；组合包不增加其他应用启动入口。

[插件组合补丁](cordis.patch.yml)

将源码包集成到发行版时，使用现有配置档及可选组合包机制。默认补丁使用真实网关适配器。独立的 sample.patch.yml 保留用于测试的样例项目服务，并要求设置 DSH_EMBODIED_PROJECTS_ROOT；默认不会加载它。

### 添加自定义机器人工具

在源码仓库根目录运行以下命令，使用模拟机器人和[示例工具补丁](examples/custom-tool.patch.yml)启动 Web 配置档。

```sh
pnpm dsh --profile web --patch packages/experimental/embodied-bundle/examples/simulated.patch.yml --patch packages/experimental/embodied-bundle/examples/custom-tool.patch.yml --no-open --port 0
```

打开启动命令打印的网址。在已配置模型的会话中，请它调用 `robot_inventory_summary`。示例会报告 1 个可用提供者、6 项就绪的模拟能力。录制会话测试可在没有在线模型和机器人时验证此调用。

将 [inventory-tool.ts](examples/inventory-tool.ts) 及其补丁复制到自己的扩展目录。给 YAML 条目和工具取唯一名称，将条目指向自己的 TypeScript 文件，再修改输入结构、输出结构和 `execute` 函数。调用机器人服务时传入 `exec.signal`。启动时将示例补丁路径换成自己的补丁路径。

组合已有只读能力时，用 `ctx.tools.register` 添加工具。增加传感器或设备操作时，实现[机器人提供者](../robot/README.zh.md)，并在 effect 中通过 `ctx.robot.register` 注册。将会改变设备状态的操作声明为 `act`，并通过 `robot_act` 调用以保留审批策略。本地测试使用仿真补丁，部署时使用对应设备的组合补丁。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

补丁组合机器人注册服务、G1-D 观测适配器、持久空间记忆提供者、模型消费者及自身状态面板。启动发现和模型步骤刷新通过已记录的运行上下文提供能力证据。提供者的失败保持显式可见。

[源码](src/index.ts)

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [具身 Harness 子系统](../../../docs/subsystems/embodied.zh.md)
- [机器人能力运行时](../robot/README.zh.md)
- [Harness 架构](../../../docs/architecture.zh.md)

<a id="model-experience"></a>
## 模型体验

通过补丁组合的机器人工具消费者间接影响模型。

#### KV Cache 影响

机器人工具消费者负责记录自身上下文及观测。变化的运行事实追加到会话，不改写之前的事实。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 默认发布配置档不启用此组合包。G1-D 支持覆盖已检查的网关观测接口；运动及推理执行需要额外适配器。
- 空间记忆存储显式观测并使用词法召回。相机、识别和定位适配器仍需提供当前证据。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
