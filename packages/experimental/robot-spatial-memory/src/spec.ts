/** Durable record declaration for robot spatial memory. */

import { brandString } from '@deepseek-ai/dsh-brand'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

/** Stable identity of one stored spatial observation. */
export type SpatialMemoryId = import('@deepseek-ai/dsh-brand').Branded<'SpatialMemoryId'>

const spatialMemoryId = z.string().transform(value => brandString<SpatialMemoryId>(value))

/** Validated durable spatial observation. */
export const spatialMemoryRecord = z.object({
  id: spatialMemoryId,
  label: z.string().min(1).max(200),
  observedAt: z.string().refine(value => Number.isFinite(Date.parse(value)), 'must be an ISO-8601 timestamp'),
  storedAt: z.string().refine(value => Number.isFinite(Date.parse(value)), 'must be an ISO-8601 timestamp'),
  frame: z.string().min(1).max(200),
  pose: z.record(z.string(), z.json()),
  evidence: z.json(),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().max(2000).optional(),
})

/** One durable spatial observation inferred from its validation schema. */
export type SpatialMemoryRecord = z.infer<typeof spatialMemoryRecord>

/** Domain declaration for authoritative spatial observations. */
export const spatialMemoryDomainSpec = defineDomain({
  name: 'robot_spatial_memory',
  version: 1,
  layout: 'per-record',
  tables: {
    observations: domainTable<SpatialMemoryId, SpatialMemoryRecord>(spatialMemoryRecord),
  },
})
