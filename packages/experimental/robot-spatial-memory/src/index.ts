/** Register durable spatial observation memory as a portable robot provider. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-robot'
import type {} from '@deepseek-ai/dsh-storage-domain'
import z from '@deepseek-ai/schemastery'
import { SpatialMemoryProvider } from './provider.ts'
import { spatialMemoryDomainSpec } from './spec.ts'

export { SpatialMemoryProvider } from './provider.ts'
export type { SpatialMemoryProviderConfig } from './provider.ts'
export { spatialMemoryDomainSpec, spatialMemoryRecord } from './spec.ts'
export type { SpatialMemoryId, SpatialMemoryRecord } from './spec.ts'

/** Cordis plugin identity. */
export const name = 'robot-spatial-memory'
/** Robot provider registry and durable domain facility required by this plugin. */
export const inject = ['robot', 'storageDomain']

/** Provider identity and bounded storage/query limits. */
export interface Config {
  /** Stable provider id within this Host. */
  providerId: string
  /** Human-readable provider name. */
  providerName: string
  /** Maximum durable records; a full memory rejects new writes without eviction. */
  maxRecords: number
  /** Maximum UTF-8 bytes for one serialized record. */
  maxSerializedRecordBytes: number
  /** Recall result count when the caller omits `limit`. */
  defaultRecallLimit: number
  /** Maximum recall result count accepted from callers. */
  maxRecallLimit: number
}

/** Provider identity and bounded storage/query limits. */
export const Config: z<Config> = z.object({
  providerId: z.string().min(1).default('spatial-memory'),
  providerName: z.string().min(1).default('Spatial memory'),
  maxRecords: z.number().min(1).default(10_000),
  maxSerializedRecordBytes: z.number().min(1024).default(65_536),
  defaultRecallLimit: z.number().min(1).default(20),
  maxRecallLimit: z.number().min(1).default(100),
})

/**
 * Open the durable memory domain and register its provider. Unload first removes
 * provider admission and drains accepted calls, then closes the domain handle.
 * @param ctx - robot and storage services with plugin lifetime ownership.
 * @param config - validated provider identity and memory limits.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  if (config.defaultRecallLimit > config.maxRecallLimit) {
    throw new TypeError('defaultRecallLimit must not exceed maxRecallLimit')
  }
  const domain = await ctx.storageDomain.open(spatialMemoryDomainSpec)
  try {
    const provider = new SpatialMemoryProvider(domain.table('observations'), config)
    const unregister = ctx.robot.register(provider)
    ctx.effect(() => async () => {
      await unregister()
      await domain.close()
    }, 'robot-spatial-memory.registration()')
  } catch (error) {
    await domain.close()
    throw error
  }
}
