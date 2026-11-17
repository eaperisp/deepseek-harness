---
description: "在 Harness 界面中查看已连接机器人、服务就绪状态、可调用操作和缺失的适配器。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-embodied

[English](README.md) | 中文

## 概述

在 Harness 界面中查看已连接机器人、服务就绪状态、可调用操作和缺失的适配器。

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

在机器人注册服务之后加载 Host 接口。其 Client 贡献在现有 Web 布局中增加机器人自身面板；常规客户端加载器提供 Remote、语言和插槽服务。

```yaml
- name: '@deepseek-ai/dsh-client-ui-embodied'
```

面板挂载及刷新时读取机器人注册服务。刷新失败会清除上次清单。各提供者的失败保持可见，不会用模拟机器人替换不可用的连接。inspectionTimeoutMs 默认为 10000。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

可选 Remote 接口调用与机器人工具相同的注册服务。页面展示适配器证据，并明确区分状态读取支持与缺失的任务执行适配器。保留的项目 dispatch 方法需要可选样例项目服务。

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

无。面板读取发现快照，不将其提交给模型。

#### KV Cache 影响

机器人工具消费者负责记录自身上下文。打开或刷新此面板不会新增模型请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 面板使用显式刷新，不提供遥测流。任务执行和开发通过 Harness 对话进行；此面板不下发物理动作。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
