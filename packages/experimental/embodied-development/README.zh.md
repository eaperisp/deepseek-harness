---
description: "使用已有标注样例和面向新手的开发指引，开始视觉识别与空间记忆练习。"
kind: "package-reference"
---

# @deepseek-ai/dsh-embodied-development

[English](README.md) | 中文

## 概述

使用已有标注样例和面向新手的开发指引，开始视觉识别与空间记忆练习。

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

在项目服务与技能服务之后加载此提供者。它注册两个模板、两个明确标识的样例设备及一个开发技能；现有技能工具按需加载该技能。

```yaml
- name: '@deepseek-ai/dsh-embodied-development'
```

技能引导目标澄清、能力匹配、常规 Harness 代码编辑与测试、项目版本更新以及证据解释。导入文档仅作参考数据。提供者负责模板语义，并在结果行为或能力发生变化时更新版本。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

视觉识别列出三个固定样例的已有标注。空间记忆将按空白分隔的查询词与双语标签匹配。每次运行记录查询、样例时间和地图会话；仅相机设备的观察位置保持为空。

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

按需加载的 [技能正文](src/instructions.ts) 以 `embodied-development` 名称提供新手开发流程；技能工具负责将其写入 Session。

#### Token 影响

技能目录包含简短描述，完整指引仅在请求技能时进入上下文。

#### KV Cache 影响

工具及技能消费者负责上下文的日志记录。新的项目查询结果追加到会话，不会改写已有请求前缀。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 这些示例不执行视觉模型、不读取实时图像、不建图，也未连接 HomeBody。历史观察位置不是物体坐标，也不能证明物体当前仍然存在。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
