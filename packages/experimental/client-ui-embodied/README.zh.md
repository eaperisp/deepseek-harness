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

打开面板后，地址栏会加入 `#robot-self`。刷新此地址会重新打开面板并读取控制器的最新状态。面板在挂载和刷新时读取机器人注册服务。选择状态数量可以筛选设备快照。可以按能力名称、操作名称或操作 ID 搜索清单。能力按类别分组。展开一行可查看状态原因、已注册操作、操作模式和发现证据。刷新失败会清除上次清单。各提供者的失败保持可见，模拟设备仅在配置后出现。`inspectionTimeoutMs` 默认为 10000。

若提供者 ID 为 `g1d`，请在构建 Web 前将宇树模型目录中以米为单位的 G1-D GLB 放到 `apps/web/public/robot-models/g1-d.glb`。面板可见时，每次响应返回后间隔两秒再次读取设备快照。两段立柱跟随标定高度。可选的 G1-D 操作适配器将按钮指令交给已配置的实机工具，并读取里程计和机械臂关节角度驱动模型动画。立柱每次最多移动 10 厘米。靠近行程端点时，按钮改为升至上限或降至下限，进入配置的到位容差后禁用该方向。网关响应或任一运控服务返回有效反馈时，整机状态显示「已连接」。旁边显示在线运控服务数，底盘、立柱、机械臂和吸盘分别按各自的反馈显示在线或离线。在运控控制区操作机械臂、立柱和吸盘。能力清单的执行器状态行显示实测高度、机械臂活动任务数和吸盘控制器输出。输入物体名称或 ID 可抓取目标。可选的 `suctionUrl` 指向 ES80Z 接口地址。机械臂控制台已连接且空闲、吸盘串口就绪时可切换吸取与释放。输出回读只确认控制器指令，实际真空度需由传感器测量。面板分别显示控制器回执和实测状态。

左目相机行显示配置的硬件型号、相机类型和源帧率。展开后接收 JPEG 并以 kbit/s 显示预览图像的实测速率。折叠或切到后台会停止取图。在 Web 配置档中加载[相机转发插件](examples/g1d-camera.mjs)，设置网关 `origin`、相机 `type`、`fps` 及可选的已核实型号 `model`。

[空间数据转发插件](examples/g1d-spatial.mjs)使用同一网关 `origin`、已核实的定位来源 `locationSource` 和可选雷达型号 `lidarModel`。展开雷达或定位行才接收扫描或里程计数据。面板显示有效载荷的实测传输速率，并根据连续采样的序号和时间估算源更新频率。轨迹使用里程计坐标系，每次展开重新记录。

部署 `robot-arm` 扩展包后，在创建工具与注册工具之间调用[操作适配器](examples/g1d-operator.mjs)的 `installOperator(ctx, { tools, robot, settings, jointsUrl, liftUrl })`。两个地址分别指向关节反馈服务的 `/api/robot_state` 和立柱标定服务的 `/api/basic_status`。手动控制要求操作档启用 `directMotion: true` 并配置 `requireActionApproval: false`。面板的每条新指令消耗一次性凭据。机械臂急停会请求已配置的控制台停止机械臂并释放吸盘。

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

- 运控控制需要安装操作适配器并启用直接运动配置。缺少有效反馈时，对应运动按钮禁用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
