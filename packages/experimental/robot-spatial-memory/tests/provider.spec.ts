import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import RobotRuntime from '@deepseek-ai/dsh-robot'
import type { RobotCapabilityId, RobotOperationId, RobotProviderId } from '@deepseek-ai/dsh-robot'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as SpatialMemory from '../src/index.ts'

const contexts: Context[] = []
const roots: string[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(context => context.fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), 'dsh-spatial-memory-'))
  roots.push(value)
  return value
}

async function setup(storageRoot: string, config: Partial<SpatialMemory.Config> = {}): Promise<Context> {
  const context = new Context()
  contexts.push(context)
  await context.plugin(Storage)
  await context.plugin(StorageJson, { root: storageRoot })
  await context.plugin(StorageDomain, { backend: 'json' })
  await context.plugin(RobotRuntime)
  await context.plugin(SpatialMemory, {
    providerId: 'spatial-memory',
    providerName: 'Spatial memory',
    maxRecords: 10_000,
    maxSerializedRecordBytes: 65_536,
    defaultRecallLimit: 20,
    maxRecallLimit: 100,
    ...config,
  })
  return context
}

const providerId = brandString<RobotProviderId>('spatial-memory')
const capabilityId = brandString<RobotCapabilityId>('spatial_memory')
const operationId = (value: string): RobotOperationId => brandString<RobotOperationId>(value)
const signal = new AbortController().signal

async function remember(context: Context, label: string, evidence: Record<string, string> = { source: 'test-camera' }) {
  return await context.robot.execute({
    providerId,
    capabilityId,
    operationId: operationId('remember'),
    mode: 'act',
    arguments: {
      label,
      observed_at: '2026-11-16T08:00:00.000Z',
      frame: 'map',
      pose: { x_m: 1.2, y_m: -0.4, yaw_rad: 0.2 },
      evidence,
      confidence: 0.91,
      notes: 'on the desk',
    },
  }, signal)
}

describe('spatial memory provider', () => {
  it('persists observations across provider restarts and marks recalled poses historical', async () => {
    const storageRoot = await root()
    const first = await setup(storageRoot)
    await expect(remember(first, 'red cup')).resolves.toMatchObject({ kind: 'completed', summary: 'Remembered red cup' })
    await first.fiber.dispose()
    contexts.splice(contexts.indexOf(first), 1)

    const second = await setup(storageRoot)
    const inspection = await second.robot.inspect(signal)
    expect(inspection).toMatchObject({ providers: [{ provider: { id: 'spatial-memory' }, capabilities: [{
      id: 'spatial_memory', status: { kind: 'ready' }, evidence: { recordCount: 1 },
    }] }] })
    const recalled = await second.robot.execute({
      providerId,
      capabilityId,
      operationId: operationId('recall'),
      mode: 'observe',
      arguments: { query: 'cup', frame: 'map', limit: 5 },
    }, signal)
    expect(recalled).toMatchObject({
      kind: 'completed',
      output: {
        historical: true,
        coordinateUse: 'historical-only',
        matches: [{ label: 'red cup', frame: 'map', pose: { x_m: 1.2 }, confidence: 0.91 }],
      },
    })
  })

  it('filters by age and exact frame without converting an empty result to failure', async () => {
    const context = await setup(await root())
    await remember(context, 'toolbox')
    await expect(context.robot.execute({
      providerId,
      capabilityId,
      operationId: operationId('recall'),
      mode: 'observe',
      arguments: { query: 'tool', frame: 'odom', max_age_seconds: 1 },
    }, signal)).resolves.toMatchObject({ kind: 'completed', output: { matches: [] }, summary: 'Recalled 0 historical observations' })
  })

  it('fails loudly at configured capacity and rejects oversized records before writing', async () => {
    const context = await setup(await root(), { maxRecords: 1, maxSerializedRecordBytes: 1024 })
    await remember(context, 'first')
    await expect(remember(context, 'second')).rejects.toMatchObject({ code: 'ROBOT_MEMORY_FULL' })

    const other = await setup(await root(), { providerId: 'small-memory', maxSerializedRecordBytes: 1024 })
    await expect(other.robot.execute({
      providerId: brandString<RobotProviderId>('small-memory'),
      capabilityId,
      operationId: operationId('remember'),
      mode: 'act',
      arguments: {
        label: 'large', observed_at: '2026-11-16T08:00:00Z', frame: 'map', pose: {}, evidence: { text: 'x'.repeat(2000) },
      },
    }, signal)).rejects.toMatchObject({ code: 'ROBOT_MEMORY_RECORD_TOO_LARGE' })
  })

  it('rejects an invalid configured recall range before opening storage', async () => {
    await expect(setup(await root(), { defaultRecallLimit: 5, maxRecallLimit: 4 })).rejects.toThrow('defaultRecallLimit')
  })
})
