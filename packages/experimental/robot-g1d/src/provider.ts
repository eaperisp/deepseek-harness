/** G1-D gateway discovery with explicit observation adapters and no motion dispatch. */
import { brandString } from '@deepseek-ai/dsh-brand'
import { RobotError } from '@deepseek-ai/dsh-robot'
import type { RobotProvider, RobotCapability, RobotCapabilityId, RobotProviderId, RobotOperationId, RobotProviderExecutionRequest, RobotOperationOutcome } from '@deepseek-ai/dsh-robot'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { z } from 'zod'
import { readJson, type HttpConfig } from './http.ts'

const catalogSchema = z.object({ service: z.literal('g1d_tool_portal'), tools: z.array(z.object({
  id: z.string().min(1).max(100), name: z.string().max(300), description: z.string().max(2000),
  location: z.string(), port: z.number().int().min(1).max(65535), health_path: z.string(), state: z.string(),
})).max(100) })
const healthSchema = z.looseObject({ ok: z.boolean() })

/** Configurable service locations and freshness thresholds for a deployed gateway. */
export interface DiscoveryConfig extends HttpConfig {
  /** Stable provider id within this Host. */
  providerId: string
  /** Display name of the connected robot. */
  robotName: string
  /** Port serving the installed tool catalog. */
  portalPort: number
  /** Port serving camera and model health. */
  yoloPort: number
  /** Port serving localization and sensor observations. */
  slamPort: number
  /** Port serving lift calibration and height feedback. */
  liftPort: number
  /** Port serving suction device health. */
  suctionPort: number
  /** Maximum reported age for spatial and height feedback in seconds. */
  maxDataAgeSeconds: number
}
interface Route { port: number; path: string; kind: 'health' | 'state' }

/** Provider for existing G1-D HTTP services; advertised URLs never grant new operations. */
export class G1dProvider implements RobotProvider {
  readonly info
  private readonly routes: ReadonlyMap<string, Route>
  constructor(private readonly config: DiscoveryConfig) {
    const host = new URL(config.host)
    if (!['http:', 'https:'].includes(host.protocol) || host.username || host.password || host.search || host.hash || host.pathname !== '/') throw new Error('Robot host must be an HTTP(S) origin without credentials, query or path')
    this.info = { id: brandString<RobotProviderId>(config.providerId), name: config.robotName, description: host.origin }
    this.routes = new Map([
      ['vision/read_health', { port: config.yoloPort, path: '/health', kind: 'health' }],
      ['spatial/read_health', { port: config.slamPort, path: '/api/health', kind: 'health' }],
      ['spatial/read_state', { port: config.slamPort, path: '/api/state', kind: 'state' }],
      ['lift/read_health', { port: config.liftPort, path: '/api/basic_status', kind: 'health' }],
      ['suction/read_health', { port: config.suctionPort, path: '/api/v1/health', kind: 'health' }],
    ])
  }

  /**
   * Probe the catalog and independently inspect reviewed local observation routes.
   * @param signal - Caller cancellation.
   * @returns Evidence-backed capabilities; failures remain visible and never become motion access.
   */
  async discover(signal: AbortSignal): Promise<readonly RobotCapability[]> {
    const at = new Date().toISOString()
    const catalog = catalogSchema.parse(await readJson(this.config, this.config.portalPort, '/api/catalog', signal))
    const found = new Set(catalog.tools.map(item => item.id))
    const capabilities: RobotCapability[] = []
    const known = [
      { key: 'yolo', id: 'vision', name: '相机与 YOLO 识别服务', category: 'perception' as const, port: this.config.yoloPort, path: '/health' },
      { key: 'slam', id: 'spatial', name: '雷达、定位与空间感知', category: 'sensor' as const, port: this.config.slamPort, path: '/api/health' },
      { key: 'lift_height', id: 'lift', name: '升降高度反馈', category: 'actuator' as const, port: this.config.liftPort, path: '/api/basic_status' },
      { key: 'suction', id: 'suction', name: '吸盘服务状态', category: 'actuator' as const, port: this.config.suctionPort, path: '/api/v1/health' },
    ]
    await Promise.all(known.filter(item => found.has(item.key)).map(async (item) => {
      try {
        const data = healthSchema.parse(await readJson(this.config, item.port, item.path, signal))
        const evidence = projectHealth(item.id, data)
        const status = healthStatus(item.id, data, this.config.maxDataAgeSeconds)
        const operations = [{ id: brandString<RobotOperationId>('read_health'), name: '读取当前状态', description: 'Read live service health and feedback; does not run inference or move hardware.', mode: 'observe' as const, arguments: [] }]
        if (item.id === 'spatial') {
          operations.push({ id: brandString<RobotOperationId>('read_state'), name: '读取定位与传感器状态', description: 'Read current odometry, sensor summaries and data ages; no navigation command.', mode: 'observe', arguments: [] })
        }
        capabilities.push({ id: brandString<RobotCapabilityId>(item.id), name: item.name, description: '已接入只读接口；物理动作和识别调用需要独立执行适配器。', category: item.category, status, operations, evidence: { observedAt: at, source: this.config.host, port: item.port, path: item.path, facts: evidence } })
      } catch (error) {
        signal.throwIfAborted()
        capabilities.push({ id: brandString<RobotCapabilityId>(item.id), name: item.name, description: '已发现服务，但此次直接读取失败。', category: item.category, status: { kind: 'unavailable', message: error instanceof RobotError ? error.code : 'ROBOT_OBSERVATION_FAILED' }, operations: [], evidence: { observedAt: at, port: item.port, path: item.path } })
      }
    }))
    for (const item of catalog.tools.filter(item => !known.some(known => known.key === item.id))) {
      capabilities.push({ id: brandString<RobotCapabilityId>('catalog.' + item.id), name: item.name, description: item.description, category: 'system', status: { kind: item.state === 'online' ? 'degraded' : 'unavailable', message: item.state === 'online' ? '目录报告在线；尚未接入经过验证的操作适配器。' : '目录报告服务离线或异常。' }, operations: [], evidence: { observedAt: at, source: 'gateway catalog (indirect)', location: item.location, port: item.port, reportedState: item.state } })
    }
    signal.throwIfAborted()
    return capabilities.sort((a, b) => a.id.localeCompare(b.id))
  }

  /**
   * Execute only an exact, adapter-owned GET route from the latest discovery.
   * @param request - Validated capability and operation; arguments must remain empty.
   * @param signal - Caller cancellation.
   * @returns Fresh observation with acquisition time; never a physical-action outcome.
   */
  async execute(request: RobotProviderExecutionRequest, signal: AbortSignal): Promise<RobotOperationOutcome> {
    const route = this.routes.get(request.capabilityId + '/' + request.operationId)
    if (!route || Object.keys(request.arguments).length !== 0) throw new RobotError('No verified observation route for this request', 'ROBOT_OPERATION_UNAVAILABLE')
    const data = z.record(z.string(), z.json()).parse(await readJson(this.config, route.port, route.path, signal))
    return { kind: 'completed', output: { observedAt: new Date().toISOString(), facts: route.kind === 'state' ? projectState(data) : projectHealth(request.capabilityId, data) } }
  }
}

function pick(data: Record<string, unknown>, keys: readonly string[]): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {}
  for (const key of keys) if (data[key] !== undefined) result[key] = z.json().parse(data[key])
  return result
}
function projectHealth(id: string, data: Record<string, unknown>): JsonValue {
  switch (id) {
    case 'vision': return pick(data, ['ok', 'service', 'yolo_model', 'resolved_device', 'cuda_available', 'yolo_class_names', 'camera'])
    case 'spatial': return pick(data, ['ok', 'freshness_s', 'has_scan', 'has_map', 'has_odom', 'has_point_cloud', 'has_arm_task_status'])
    case 'lift': return pick(data, ['ok', 'physical_height_m', 'physical_min_m', 'physical_max_m', 'offset_valid', 'data_age_sec', 'source'])
    default: return pick(data, ['ok', 'service', 'device', 'serial_error'])
  }
}
function projectState(data: Record<string, unknown>): JsonValue {
  return pick(data, ['odom', 'freshness_s', 'sensors', 'robot_basic_state'])
}
function healthStatus(id: string, data: Record<string, unknown>, maxAge: number): RobotCapability['status'] {
  if (data.ok !== true) return { kind: 'degraded', message: '服务响应异常，不能据此判断任务可执行。' }
  if (id === 'spatial') {
    const ages = z.record(z.string(), z.unknown()).safeParse(data.freshness_s)
    if (!ages.success || !['scan', 'map', 'odom'].every(key => data['has_' + key] === true && typeof ages.data[key] === 'number' && Number.isFinite(ages.data[key]) && ages.data[key] >= 0 && ages.data[key] <= maxAge)) return { kind: 'degraded', message: '空间数据缺失或已过期。' }
  }
  if (id === 'lift' && (data.offset_valid !== true || typeof data.data_age_sec !== 'number' || !Number.isFinite(data.data_age_sec) || data.data_age_sec < 0 || data.data_age_sec > maxAge)) return { kind: 'degraded', message: '高度标定或实时反馈不可用。' }
  if (id === 'vision' && (!z.object({ ok: z.literal(true) }).safeParse(data.camera).success || typeof data.yolo_model !== 'string')) return { kind: 'degraded', message: '相机或识别模型未就绪。' }
  return { kind: 'ready' }
}
