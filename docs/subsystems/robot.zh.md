# 机器人集成

[English](robot.md) | 中文

实验性机器人子系统让 Agent 可以发现已部署机器人实际提供的功能，并调用明确的操作，而不在 agent loop 中加入 ROS、厂商 SDK 或设备专用分支。它把可移植的能力描述、硬件适配器和模型工具分开。

## 架构

| 层 | 包 | 职责 |
|---|---|---|
| 服务定义 | [`dsh-robot`](../../packages/experimental/robot/README.zh.md) | 提供者和工作流注册、能力发现、实时工作流匹配、操作校验、准确路由、取消与卸载等待 |
| 服务提供者 | [`dsh-robot-simulated`](../../packages/experimental/robot-simulated/README.zh.md)、[`dsh-robot-g1d`](../../packages/experimental/robot-g1d/README.zh.md) 或 [`dsh-robot-spatial-memory`](../../packages/experimental/robot-spatial-memory/README.zh.md) | 将 ROS 2、厂商 SDK、本地网关或持久应用服务映射为通用能力，并执行获准请求 |
| 消费者 | [`dsh-tool-robot`](../../packages/experimental/tool-robot/README.zh.md) | 用模型工具提供发现、只读观察和物理动作，并对动作请求审批 |

一个 Host 可以注册多台机器人或多个网关。每个提供者声明雷达、相机、物体识别、空间定位、夹爪或移动底盘等能力。能力声明当前状态和操作；每项操作都有稳定 id、`observe` 或 `act` 模式，以及带类型、范围、单位和可选枚举值的具名 JSON 参数。

## 公共词汇

### `RobotProvider`

一台已注册的机器人或一个网关，包含稳定的 `RobotProviderInfo`、只读的 `discover()` 方法和准确路由的 `execute()` 方法。

### `RobotCapability`

一个传感器、感知功能、执行器、移动功能或系统服务，包含就绪状态、可选 JSON 证据和当前 `RobotOperationDefinition` 列表。浏览器安全的 `./model` 导出负责校验检查结果 JSON。

### `RobotExecutionRequest`

对提供者、能力和操作的准确选择，以及预期的 `RobotOperationMode` 和结构化 `RobotArguments`。

### `RobotInspection`

一个时间点的 `RobotProviderSnapshot` 列表。每个提供者独立表示为带能力的 `available`，或带安全 `RobotDiscoveryFailure` 的 `failed`。

### `RobotOperationOutcome`

闭合结果：`completed` 带无损 JSON 输出；`unknown` 表示无法确认物理结果。

### `RobotWorkflowDefinition`

与提供者无关的应用定义，包含准确的备选操作、必需与可选能力、有序实现阶段和可观察验收检查。`RobotWorkflowResolution` 把每项要求映射到就绪、降级、不可用或缺失的实时操作，并把整体工作流标记为就绪、降级或阻塞。

## 标准工作流

运行时包含四个起始定义。空间记忆遵循 HomeBody 风格流程：标定后的感知、定位、语义观察、带证据的记忆与实时再观察；持久提供者已实现记忆写入和召回，而感知、定位、导航和操作仍依赖匹配的适配器。仿真与 real-to-sim 要求版本化场景、受限的确定性回合以及保留的指标，再进入可选硬件迁移。手眼标定把坐标系配置、多样化同步样本采集、求解、明确应用和独立验证分开。重力补偿先确定唯一控制器责任方，再识别负载，并验证静止及低速运动行为，以避免重复补偿。

这些定义是能力要求，不是实现。`inspectWorkflows()` 只执行发现，绝不调用操作。插件可以注册其他可移植定义；机器人专用传输和控制器仍属于提供者包。

## 指令流程

1. 启动和 Agent 步骤刷新已记录的自身上下文；用户使用自然语言提出任务。
2. 对于应用请求，模型调用 `robot_workflow`，得到实时匹配、缺失适配器、实现阶段和验收检查。此步骤不会执行机器人操作。
3. 模型调用 `robot_inspect`，得到当前所有已注册提供者、能力、就绪状态、操作和参数声明。
4. 模型只选择结果中返回的 id，并可调用 `robot_observe` 读取雷达、相机识别结果、位姿或其他状态。
5. 需要改变物理环境时，模型调用 `robot_act`。默认工具策略会在派发前询问用户，并保留下游更严格的策略决定。
6. `ctx.robot` 重新发现所选提供者，拒绝过期或不可用的能力，检查 `observe` 与 `act`，校验全部参数，再路由到准确的提供者注册实例。
7. 提供者通过控制器执行，并返回 `completed` 或 `unknown`。无法确认的结果绝不会被转换为成功。
8. 模型可以再次观察以确认物理状态。普通工具调用和结果事件会在 Session 日志中保留完整的模型可见交互。

发现故障按提供者隔离：一台断连机器人会显示为失败，但其他机器人和功能仍可使用。提供者卸载时先停止接受新工作，再取消并等待已经接受的工作结束。

## 硬件适配器要求

生产适配器应把传输细节留在 `RobotProvider` 后面，在 ROS、进程、网络或 SDK 接口处校验不受信任的数据，把控制器故障转换为可操作的消息，响应取消，并在卸载前完全停止工作。它只能暴露控制器真正支持的操作，并在每次发现时刷新状态。

审批只是授权层之一，并不是运动安全机制。防碰撞、关节和速度限制、工作空间约束、联锁、看门狗和急停仍由机器人控制器或提供者强制执行。关闭 `requireActionApproval` 的部署必须具备等效的外部授权和硬件保护。

## 交付阶段

G1-D 网关提供者暴露经过验证的观测。空间记忆提供者持久保存语义观测，并将其作为历史证据召回。ROS 2 发现、其他厂商 SDK、物理执行及流式遥测需要独立验证的适配器。确定性模拟器用于验证通用路由，不代表硬件就绪。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxrobot--robotruntime"></a>

### `ctx.robot` — `RobotRuntime`

Registry shared by robot providers and model-facing consumers in one Host.

```ts cordis-catalog
/**
 * Register one robot or gateway; duplicate ids fail without replacing the original.
 * The contributing plugin must own the returned disposer with `ctx.effect()`.
 * @param provider - adapter owned by the contributing plugin.
 * @returns idempotent disposer which removes admission, cancels, and joins accepted work.
 */
register(provider: RobotProvider): () => Promise<void>

/**
 * Read registered provider facts in registration order without contacting hardware.
 * @returns detached provider facts.
 */
listProviders(): readonly RobotProviderInfo[]

/**
 * Register one additional portable workflow; duplicate ids fail without replacement.
 * The contributing plugin must own the returned disposer with `ctx.effect()`.
 * @param workflow - complete requirements and ordered verification stages.
 * @returns idempotent disposer which removes only this registration.
 */
registerWorkflow(workflow: RobotWorkflowDefinition): () => void

/**
 * List workflow definitions without contacting hardware.
 * @returns definitions in registration order.
 */
listWorkflows(): readonly RobotWorkflowDefinition[]

/**
 * Resolve one or every registered workflow against one shared live robot inspection.
 * This method never executes a robot operation; a `ready` result reports only that
 * the declared operations are discoverable and ready at inspection time.
 * @param signal - caller cancellation.
 * @param workflowId - optional exact workflow id.
 * @returns robot evidence and resolved workflow requirements.
 */
async inspectWorkflows(signal: AbortSignal, workflowId?: RobotWorkflowId): Promise<RobotWorkflowInspection>

/**
 * Discover all registered providers concurrently. One failed provider is reported
 * in place and does not hide working robots or capabilities.
 * @param signal - caller cancellation.
 * @returns one settled snapshot per provider in registration order.
 */
async inspect(signal: AbortSignal): Promise<RobotInspection>

/**
 * Re-discover, validate, and execute one exact provider operation. The mode must
 * match the declaration so read-only consumers cannot dispatch physical actions.
 * @param request - exact provider, operation, mode, and untrusted model arguments.
 * @param signal - caller cancellation.
 * @returns provider result, including explicit unknown physical outcomes.
 */
async execute(request: RobotExecutionRequest, signal: AbortSignal): Promise<RobotOperationOutcome>
```

Source: [`packages/experimental/robot/src/index.ts`](../../packages/experimental/robot/src/index.ts)
<!-- END GENERATED cordis-surface -->
