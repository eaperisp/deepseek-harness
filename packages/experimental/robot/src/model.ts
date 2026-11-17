/** Browser-safe validation for robot discovery responses. */
import { z } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { RobotProviderId, RobotCapabilityId, RobotOperationId } from './types.ts'

const operation = z.object({
  id: z.string().transform(value => brandString<RobotOperationId>(value)), name: z.string(), description: z.string(),
  mode: z.enum(['observe', 'act']), arguments: z.array(z.object({ name: z.string(), description: z.string(), type: z.enum(['string', 'number', 'integer', 'boolean', 'json']), required: z.boolean().optional(), enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(), minimum: z.number().optional(), maximum: z.number().optional(), unit: z.string().optional() })),
})
const capability = z.object({
  id: z.string().transform(value => brandString<RobotCapabilityId>(value)), name: z.string(), description: z.string(),
  category: z.enum(['sensor', 'perception', 'actuator', 'mobility', 'system']),
  status: z.discriminatedUnion('kind', [z.object({ kind: z.literal('ready') }), z.object({ kind: z.literal('degraded'), message: z.string() }), z.object({ kind: z.literal('unavailable'), message: z.string() })]),
  operations: z.array(operation), evidence: z.json().optional(),
})
const provider = z.object({
  id: z.string().transform(value => brandString<RobotProviderId>(value)), name: z.string(), description: z.string().optional(),
})
/** Validated wire response shared by the discovery workbench and Host. */
export const inspectionSchema = z.object({ providers: z.array(z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('available'), provider, capabilities: z.array(capability) }),
  z.object({ kind: z.literal('failed'), provider, error: z.object({ code: z.string(), message: z.string() }) }),
])) })
