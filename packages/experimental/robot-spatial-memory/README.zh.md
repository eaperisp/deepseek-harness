---
description: "通过通用机器人能力 API 提供持久化的语义空间观测。"
kind: "package-reference"
---

# @deepseek-ai/dsh-robot-spatial-memory

[English](README.md) | 中文

## 概述

本包存储带时间戳的语义观测，并将其作为历史证据召回。它为具身 Harness 提供持久空间记忆，同时避免让历史坐标看起来可直接用于当前导航或操作。

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

在 `@deepseek-ai/dsh-robot` 和 `@deepseek-ai/dsh-storage-domain` 之后挂载。默认具身组合包已按此顺序组合。提供者通过 `spatial_memory/remember` 持久写入，并通过 `spatial_memory/recall` 按文本、坐标系和观测年龄筛选读取。配置项控制提供者标识、记录容量、单条记录字节上限和召回结果上限。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

每条观测记录采集时间、坐标系、位姿字段、证据来源及可选置信度。数据通过带版本的存储域保存。召回结果标记为 `historical` 和 `historical-only`；进行物理动作前，调用方必须重新观测目标并校验当前坐标变换。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [机器人服务](../robot/README.zh.md) — 与提供者无关的发现和执行。
- [具身组合包](../embodied-bundle/README.zh.md) — 默认组合。

<a id="model-experience"></a>
## 模型体验

通过 `dsh-tool-robot` 间接影响模型；该工具经机器人运行时检查提供者并执行记忆操作。

#### KV Cache 影响

提供者自身不增加提示词或工具声明。机器人工具消费者记录发现的能力事实和操作结果。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 召回使用不区分大小写的文本匹配；尚未提供向量、场景图或 3D Gaussian Splatting 检索。
- 观测需要显式写入。相机、识别和定位适配器必须提供当前证据及坐标系。
- 历史位姿仅作为证据，不能授权运动。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

存储的证据应与具体提供者无关。硬件专用标定和坐标变换应由观测适配器负责。

</details>
