/** Capability readiness, endpoint confinement and bounded observation responses. */
import { afterEach, expect, it, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { RobotCapabilityId, RobotOperationId } from '@deepseek-ai/dsh-robot'
import { G1dProvider, type DiscoveryConfig } from '../src/provider.ts'
import { readJson } from '../src/http.ts'

const config: DiscoveryConfig = { host: 'http://robot.test', providerId: 'test', robotName: 'Test robot', portalPort: 18079, yoloPort: 18081, slamPort: 18083, liftPort: 28089, suctionPort: 18080, timeoutMs: 1000, maxResponseBytes: 10000, maxDataAgeSeconds: 2 }
const signal = new AbortController().signal
afterEach(() => vi.restoreAllMocks())
function catalog(ids: string[]) {
  return { service: 'g1d_tool_portal', tools: ids.map(id => ({ id, name: id, description: id, location: 'body', port: 1, health_path: '/move', state: 'online', url: 'http://outside.test/move' })) }
}
it('uses reviewed host routes, distinguishes stale feedback and leaves unknown services uncallable', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input)
    expect(url.hostname).toBe('robot.test')
    if (url.pathname === '/api/catalog') return Response.json(catalog(['slam', 'lift_height', 'arm_console']))
    if (url.pathname === '/api/health') return Response.json({ ok: true, has_scan: true, has_map: true, has_odom: true, freshness_s: { scan: .1, map: .2, odom: 200 } })
    if (url.pathname === '/api/basic_status') return Response.json({ ok: true, offset_valid: true, physical_height_m: .3, data_age_sec: .1 })
    throw new Error('Unexpected route')
  })
  const result = await new G1dProvider(config).discover(signal)
  expect(result.find(item => item.id === 'spatial')?.status.kind).toBe('degraded')
  expect(result.find(item => item.id === 'lift')).toMatchObject({ status: { kind: 'ready' }, operations: [{ mode: 'observe' }] })
  expect(result.find(item => item.id === 'catalog.arm_console')).toMatchObject({ status: { kind: 'degraded' }, operations: [] })
  expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET' && init.redirect === 'error')).toBe(true)
})
it('retains a failed service and refuses unregistered actions without issuing a request', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (new URL(input instanceof Request ? input.url : input).pathname === '/api/catalog') return Response.json(catalog(['yolo']))
    return new Response('unavailable', { status: 503 })
  })
  const provider = new G1dProvider(config)
  expect(await provider.discover(signal)).toMatchObject([{ id: 'vision', status: { kind: 'unavailable' }, operations: [] }])
  const calls = fetch.mock.calls.length
  await expect(provider.execute({ capabilityId: brandString<RobotCapabilityId>('vision'), operationId: brandString<RobotOperationId>('move'), arguments: {} }, signal)).rejects.toMatchObject({ code: 'ROBOT_OPERATION_UNAVAILABLE' })
  expect(fetch).toHaveBeenCalledTimes(calls)
})
it('bounds bytes and rejects a response that is not the configured gateway protocol', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ service: 'unrelated', tools: [] }))
  await expect(new G1dProvider(config).discover(signal)).rejects.toThrow()
  vi.mocked(fetch).mockResolvedValue(new Response('你好'))
  await expect(readJson({ ...config, maxResponseBytes: 5 }, 1, '/health', signal)).rejects.toMatchObject({ code: 'ROBOT_RESPONSE_TOO_LARGE' })
})
it('projects live state without map or point-cloud arrays and ignores catalog operation claims', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ odom: { x: 1, y: 2, yaw: .5 }, freshness_s: { odom: .1 }, map: { data: [1, 2] }, point_cloud: [1, 2], token: 'not-for-the-model' }))
  const output = await new G1dProvider(config).execute({ capabilityId: brandString<RobotCapabilityId>('spatial'), operationId: brandString<RobotOperationId>('read_state'), arguments: {} }, signal)
  expect(output).toMatchObject({ kind: 'completed', output: { facts: { odom: { x: 1, y: 2, yaw: .5 } } } })
  expect(JSON.stringify(output)).not.toContain('not-for-the-model')
  expect(JSON.stringify(output)).not.toContain('point_cloud')
})
