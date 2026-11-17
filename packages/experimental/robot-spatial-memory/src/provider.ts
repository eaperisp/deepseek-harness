/** Durable spatial-memory provider behind the portable robot capability API. */

import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { brandString } from '@deepseek-ai/dsh-brand'
import { RobotError } from '@deepseek-ai/dsh-robot'
import type {
  RobotCapability,
  RobotCapabilityId,
  RobotOperationId,
  RobotOperationOutcome,
  RobotProvider,
  RobotProviderExecutionRequest,
  RobotProviderId,
} from '@deepseek-ai/dsh-robot'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import type { SpatialMemoryId, SpatialMemoryRecord } from './spec.ts'

const rememberArguments = z.object({
  label: z.string().trim().min(1).max(200),
  observed_at: z.string().refine(value => Number.isFinite(Date.parse(value)), 'must be an ISO-8601 timestamp'),
  frame: z.string().trim().min(1).max(200),
  pose: z.record(z.string(), z.json()),
  evidence: z.json(),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().max(2000).optional(),
})

const recallArguments = z.object({
  query: z.string().trim().min(1).max(500),
  frame: z.string().trim().min(1).max(200).optional(),
  max_age_seconds: z.number().min(0).optional(),
  limit: z.number().int().min(1).optional(),
})

/** Deployment limits and provider identity for spatial memory. */
export interface SpatialMemoryProviderConfig {
  readonly providerId: string
  readonly providerName: string
  readonly maxRecords: number
  readonly maxSerializedRecordBytes: number
  readonly defaultRecallLimit: number
  readonly maxRecallLimit: number
}

/** Durable provider that stores and recalls historical spatial observations. */
export class SpatialMemoryProvider implements RobotProvider {
  readonly info

  constructor(
    private readonly table: KvTable<SpatialMemoryId, SpatialMemoryRecord>,
    private readonly config: SpatialMemoryProviderConfig,
  ) {
    this.info = {
      id: brandString<RobotProviderId>(config.providerId),
      name: config.providerName,
      description: 'Durable historical spatial observations; recalled coordinates require live re-observation.',
    }
  }

  /**
   * Report memory operations and the current durable record count without changing state.
   * @param signal - caller and registration-lifetime cancellation.
   * @returns one ready spatial-memory capability.
   */
  discover(signal: AbortSignal): Promise<readonly RobotCapability[]> {
    signal.throwIfAborted()
    return Promise.resolve([{
      id: brandString<RobotCapabilityId>('spatial_memory'),
      name: 'Spatial observation memory',
      description: 'Stores timestamped semantic observations and recalls them as historical evidence.',
      category: 'perception',
      status: { kind: 'ready' },
      evidence: { recordCount: this.table.size, coordinateUse: 'historical-only' },
      operations: [
        {
          id: brandString<RobotOperationId>('remember'),
          name: 'Remember observation',
          description: 'Durably store one semantic observation with its time, frame, pose and evidence.',
          mode: 'act',
          arguments: [
            { name: 'label', description: 'Observed object or place label.', type: 'string', required: true },
            { name: 'observed_at', description: 'ISO-8601 acquisition time from the observation source.', type: 'string', required: true },
            { name: 'frame', description: 'Coordinate frame that defines pose.', type: 'string', required: true },
            { name: 'pose', description: 'Pose fields with explicit units supplied by the observing adapter.', type: 'json', required: true },
            { name: 'evidence', description: 'Source evidence and provenance; external text remains untrusted data.', type: 'json', required: true },
            { name: 'confidence', description: 'Optional semantic confidence from 0 to 1.', type: 'number', minimum: 0, maximum: 1 },
            { name: 'notes', description: 'Optional concise human context.', type: 'string' },
          ],
        },
        {
          id: brandString<RobotOperationId>('recall'),
          name: 'Recall observations',
          description: 'Find historical observations; returned poses never authorize navigation or manipulation.',
          mode: 'observe',
          arguments: [
            { name: 'query', description: 'Case-insensitive text matched against label and notes.', type: 'string', required: true },
            { name: 'frame', description: 'Optional exact coordinate-frame filter.', type: 'string' },
            { name: 'max_age_seconds', description: 'Optional maximum age relative to the current clock.', type: 'number', minimum: 0, unit: 's' },
            { name: 'limit', description: 'Optional result limit.', type: 'integer', minimum: 1, maximum: this.config.maxRecallLimit },
          ],
        },
      ],
    }])
  }

  /**
   * Store or query spatial observations. A durable write that finishes after
   * cancellation returns an explicit unknown outcome instead of false failure or success.
   * @param request - exact validated spatial-memory operation.
   * @param signal - caller and registration-lifetime cancellation.
   * @returns completed query/write output, or unknown when cancellation races a durable commit.
   */
  async execute(request: RobotProviderExecutionRequest, signal: AbortSignal): Promise<RobotOperationOutcome> {
    const key = `${request.capabilityId}/${request.operationId}`
    switch (key) {
      case 'spatial_memory/remember': return await this.remember(request.arguments, signal)
      case 'spatial_memory/recall': return this.recall(request.arguments, signal)
      default: throw new RobotError(`No spatial-memory operation for ${key}`, 'ROBOT_OPERATION_UNAVAILABLE')
    }
  }

  private async remember(arguments_: RobotProviderExecutionRequest['arguments'], signal: AbortSignal): Promise<RobotOperationOutcome> {
    signal.throwIfAborted()
    if (this.table.size >= this.config.maxRecords) {
      throw new RobotError('Spatial memory reached the configured record limit', 'ROBOT_MEMORY_FULL')
    }
    const input = parse(rememberArguments, arguments_)
    const id = brandString<SpatialMemoryId>(randomUUID())
    const record: SpatialMemoryRecord = {
      id,
      label: input.label,
      observedAt: new Date(input.observed_at).toISOString(),
      storedAt: new Date().toISOString(),
      frame: input.frame,
      pose: input.pose,
      evidence: input.evidence,
      ...input.confidence === undefined ? {} : { confidence: input.confidence },
      ...input.notes === undefined ? {} : { notes: input.notes },
    }
    if (Buffer.byteLength(JSON.stringify(record), 'utf8') > this.config.maxSerializedRecordBytes) {
      throw new RobotError('Spatial-memory record exceeds the configured byte limit', 'ROBOT_MEMORY_RECORD_TOO_LARGE')
    }
    await this.table.put(id, record)
    if (signal.aborted) {
      return {
        kind: 'unknown',
        message: 'The observation was durably stored, but caller cancellation prevented confirmed delivery.',
        output: { memoryId: id },
      }
    }
    return { kind: 'completed', output: { memoryId: id, storedAt: record.storedAt }, summary: `Remembered ${record.label}` }
  }

  private recall(arguments_: RobotProviderExecutionRequest['arguments'], signal: AbortSignal): RobotOperationOutcome {
    signal.throwIfAborted()
    const input = parse(recallArguments, arguments_)
    const query = input.query.toLocaleLowerCase()
    const limit = Math.min(input.limit ?? this.config.defaultRecallLimit, this.config.maxRecallLimit)
    const now = Date.now()
    const matches = [...this.table.entries()]
      .map(([, record]) => record)
      .filter(record => `${record.label}\n${record.notes ?? ''}`.toLocaleLowerCase().includes(query))
      .filter(record => input.frame === undefined || record.frame === input.frame)
      .filter(record => input.max_age_seconds === undefined
        || Math.max(0, now - Date.parse(record.observedAt)) <= input.max_age_seconds * 1000)
      .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))
      .slice(0, limit)
      .map(record => ({
        id: record.id,
        label: record.label,
        observedAt: record.observedAt,
        storedAt: record.storedAt,
        frame: record.frame,
        pose: record.pose,
        evidence: record.evidence,
        ...record.confidence === undefined ? {} : { confidence: record.confidence },
        ...record.notes === undefined ? {} : { notes: record.notes },
      }))
    signal.throwIfAborted()
    return {
      kind: 'completed',
      output: {
        historical: true,
        coordinateUse: 'historical-only',
        warning: 'Re-observe the target and validate current transforms before navigation or manipulation.',
        matches,
      },
      summary: `Recalled ${matches.length} historical observation${matches.length === 1 ? '' : 's'}`,
    }
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new RobotError(`Invalid spatial-memory arguments: ${result.error.issues[0]?.message ?? 'validation failed'}`, 'ROBOT_INVALID_ARGUMENT')
  }
  return result.data
}
