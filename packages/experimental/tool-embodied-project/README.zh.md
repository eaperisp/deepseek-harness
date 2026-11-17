---
description: "让 Agent 发现开发模板、创建项目、运行样例并查看与版本绑定的证据。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-embodied-project

[English](README.md) | 中文

## 概述

让 Agent 发现开发模板、创建项目、运行样例并查看与版本绑定的证据。

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

在项目服务和工具服务之后加载此消费者。先调用目录查询命令；Agent 可以继续使用现有 Harness 文件和终端工具进行常规开发。

```yaml
- name: '@deepseek-ai/dsh-tool-embodied-project'
```

命令动作包括 catalog、list、create、read、revise、run 和 export。修改或运行已有项目必须提供当前版本。出现冲突或结果不确定时先刷新，不应直接重放修改操作。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

消费者将 JSON 命令交给项目服务验证和执行。常规工具调用及结果在 Session 中保留模型看到的全部内容。工作台使用同一服务，不维护另一份项目状态。

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

### 开发上下文

#### 模型可见内容

[生成的工具声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-embodied-project) 定义 embodied_project。结果包含项目记录或模板目录。

#### Token 影响

加载时增加一个工具声明，每次调用增加命令及 JSON 结果；开销随返回记录增长。

#### KV Cache 影响

工具及技能消费者负责上下文的日志记录。新的项目查询结果追加到会话，不会改写已有请求前缀。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 导出返回项目 JSON，由现有文件交付工具保存；它不会生成完整应用仓库或部署机器人。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
