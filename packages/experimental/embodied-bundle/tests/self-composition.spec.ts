/** Real bundle boot discovers HTTP capabilities before publishing model context. */
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Loader, { interpolate, type EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import * as NativeExecutor from '@deepseek-ai/dsh-tool-executor-native'
import * as Robot from '@deepseek-ai/dsh-robot'
import * as G1d from '@deepseek-ai/dsh-robot-g1d'
import * as SpatialMemory from '@deepseek-ai/dsh-robot-spatial-memory'
import * as RobotTools from '@deepseek-ai/dsh-tool-robot'
import * as Workbench from '@deepseek-ai/dsh-client-ui-embodied'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import { load } from 'js-yaml'
import { expect, it, vi } from 'vitest'

it('boots the default device bundle, logs self context and refreshes failures without sample fallback', async () => {
  let healthy = true
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (!healthy) { response.writeHead(503); response.end('{}'); return }
    const data = request.url === '/api/catalog'
      ? { service: 'g1d_tool_portal', tools: [{ id: 'lift_height', name: 'Lift', description: 'Lift state', location: 'body', port: 28089, health_path: '/api/basic_status', state: 'online' }] }
      : { ok: true, offset_valid: true, data_age_sec: .1, physical_height_m: .3 }
    response.end(JSON.stringify(data))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP address')
  const root = await mkdtemp(join(tmpdir(), 'embodied-self-'))
  const ctx = new Context()
  const modules = new Map<string, object>([
    ['@deepseek-ai/dsh-robot', Robot], ['@deepseek-ai/dsh-robot-g1d', G1d],
    ['@deepseek-ai/dsh-robot-spatial-memory', SpatialMemory], ['@deepseek-ai/dsh-tool-robot', RobotTools],
    ['@deepseek-ai/dsh-client-ui-embodied', Workbench],
  ])
  try {
    await ctx.plugin(Storage); await ctx.plugin(StorageJson, { root }); await ctx.plugin(StorageDomain, { backend: 'json' })
    await ctx.plugin(SystemPrompt); await ctx.plugin(Tools); await ctx.plugin(NativeExecutor); await ctx.plugin(Loader)
    if (!ctx.loader.internal) throw new Error('Loader unavailable')
    const importer = vi.spyOn(ctx.loader.internal, 'import').mockImplementation(async (name: string) => {
      const module = modules.get(name)
      if (!module) throw new Error('Unexpected plugin ' + name)
      return module
    })
    const patch = load(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), { schema: entryListSchema }) as { insert: EntryOptions[] }[]
    for (const row of patch[0]!.insert) {
      const config: unknown = row.id === 'embodied-robot-g1d'
        ? { host: 'http://127.0.0.1', portalPort: address.port, liftPort: address.port }
        : interpolate({}, row.config)
      await ctx.loader.create({ ...row, config })
    }
    await ctx.loader.await()
    expect(importer).toHaveBeenCalledTimes(5)
    expect(ctx.tools.get('embodied_project')).toBeUndefined()
    expect(ctx.tools.get('robot_inspect')).toBeDefined()
    expect(ctx.tools.get('robot_workflow')).toBeDefined()
    const context = (await ctx.systemPrompt.assemble()).contexts.find(item => item.name === 'robot:self')
    expect(context?.text).toContain('physical_height_m')
    expect(context?.text).toContain('read_health')
    expect(JSON.parse(await ctx.robotStudio.inspect())).toMatchObject({ providers: [
      { kind: 'available', capabilities: [{ id: 'lift' }] },
      { kind: 'available', provider: { id: 'spatial-memory' }, capabilities: [{ id: 'spatial_memory' }] },
    ] })
    const spatialWorkflow = ctx.robot.listWorkflows().find(workflow => workflow.id === 'spatial-memory')
    if (spatialWorkflow === undefined) throw new Error('Spatial-memory workflow is missing')
    const spatialInspection = (await ctx.robot.inspectWorkflows(
      new AbortController().signal,
      spatialWorkflow.id,
    )).workflows[0]
    expect(spatialInspection?.requirements.find(result => result.requirement.id === 'memory-write'))
      .toMatchObject({ kind: 'ready' })
    expect(spatialInspection?.requirements.find(result => result.requirement.id === 'memory-query'))
      .toMatchObject({ kind: 'ready' })
    healthy = false
    expect(JSON.parse(await ctx.robotStudio.inspect())).toMatchObject({ providers: [
      { kind: 'failed' }, { kind: 'available', provider: { id: 'spatial-memory' } },
    ] })
    expect((await ctx.systemPrompt.assemble()).contexts.find(item => item.name === 'robot:self')?.text).toContain('ROBOT_HTTP_STATUS')
    ctx.loader.remove('embodied-robot-g1d'); await ctx.loader.await()
    expect(ctx.robot.listProviders()).toEqual([expect.objectContaining({ id: 'spatial-memory' })])
  } finally {
    await ctx.fiber.dispose()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error) reject(error)
      else resolve()
    }))
    await rm(root, { recursive: true, force: true })
  }
})
