---
description: "保存机器人开发项目，匹配所需能力，并按配置版本保留验证证据。"
kind: "package-reference"
---

# @deepseek-ai/dsh-embodied-project

[English](README.md) | 中文

## 概述

保存机器人开发项目，匹配所需能力，并按配置版本保留验证证据。

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

配置绝对项目存储目录后，加载模板提供者及工具或工作台消费者。组合包提供插件组合，存储目录读取 `DSH_EMBODIED_PROJECTS_ROOT`。

```yaml
- name: '@deepseek-ai/dsh-embodied-project'
  config:
    root: !!js process.env.DSH_EMBODIED_PROJECTS_ROOT
```

配置默认限制为每个文档或命令 2,000,000 字节、100 个项目，以及每项目 200 条版本与运行记录。并发修改使用文件锁及期望版本。无效文件不会被覆盖。提交前取消不保存；已接受的原子写入可能完成，因此遇到不确定结果时应先重新读取项目。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

项目保留不可变版本和样例运行记录。每个版本固定模板及目标设备的版本；修改设备或插件版本后，当前验证失效，历史记录仍然保留。缺少必需能力时拒绝执行，缺少可选能力时明确报告。

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

通过 `dsh-tool-embodied-project` 间接影响模型；该消费者负责工具声明及写入日志的项目结果。

#### KV Cache 影响

工具及技能消费者负责上下文的日志记录。新的项目查询结果追加到会话，不会改写已有请求前缀。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 仅支持样例运行。项目文件是本地开发记录，不是应用源码包或实机部署凭据。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
