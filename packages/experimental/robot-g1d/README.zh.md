---
description: "发现已安装的 G1-D 服务网关，并提供经过验证的只读观测。"
kind: "package-reference"
---

# @deepseek-ai/dsh-robot-g1d

[English](README.md) | 中文

## 概述

发现已安装的 G1-D 服务网关，并提供经过验证的只读观测。支持取决于实际部署的 HTTP 接口，不能仅由机器人型号判断。

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

在 `dsh-robot` 之后挂载，并把 `host` 设置为已部署网关的 HTTP(S) 源地址。拒绝凭证、路径和查询字符串。[具身组合包](../embodied-bundle/README.zh.md)从 `DSH_ROBOT_HOST` 读取此地址；适配器不存储或要求 SSH 密码。

网关必须在 GET `/api/catalog` 返回 `g1d_tool_portal` 目录。默认端口为目录 18079、YOLO 18081、SLAM 18083、升降 28089、吸盘 18080；每项都有可配置的 `*Port` 字段。请求超时为 `timeoutMs`（5000），响应大小为 `maxResponseBytes`（2097152），新鲜度阈值为 `maxDataAgeSeconds`（2）。`providerId` 和 `robotName` 标识此注册。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

发现过程先读取目录，再独立探测所配置主机上已知的相机/模型、SLAM、升降和吸盘健康接口。未知服务保留网关的间接报告，且不提供任何操作。目录声称的主机、路径和动作不能产生可调用路由。请求拒绝重定向，并执行取消、字节上限及 JSON 校验。

已知服务提供 `read_health`；SLAM 另外提供 `read_state`，返回里程计、传感器摘要和数据年龄，不包含地图或点云数组。就绪表示所声明的观测可用。标定缺失、空间/高度数据过期和探测失败会明确保留；这些情况不会授予运动或推理访问能力。采集时间表示主机观察到响应的时刻，不是检测到物理物体的时刻。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [机器人运行时](../robot/README.zh.md)
- [机器人工具与自身上下文](../tool-robot/README.zh.md)

<a id="model-experience"></a>
## 模型体验

通过机器人工具消费者记录的运行上下文和观测结果间接影响模型。服务描述和外部 JSON 是设备数据，不是指令。

#### KV Cache 影响

提供者本身不声明工具或提示词。变化的观测时间和服务事实可能通过消费者追加运行上下文。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 未注册物理动作、推理调用、相机帧获取或自动部署。
- 通用 ROS 图发现、SSH 引导及其他机器人 SDK 需要独立提供者。服务可访问不能证明硬件覆盖完整、标定有效或任务就绪。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

操作应绑定已检查的服务语义。加入执行能力时，必须同时明确参数、反馈、取消及控制器要求。

</details>
