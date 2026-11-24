/** Map the G1-D adapter's calibrated observation to the model's lift travel in metres. */
import { z } from 'zod'
import type { RobotSnapshot } from './self.ts'

const liftEvidence = z.object({ facts: z.object({
  ok: z.literal(true),
  offset_valid: z.literal(true),
  physical_height_m: z.number(),
  physical_min_m: z.number(),
  physical_max_m: z.number(),
}) })

/** Current physical height and displacement from the model's retracted pose. */
export interface LiftFeedback {
  heightMeters: number
  extensionMeters: number
  maxExtensionMeters: number
}

/**
 * Use ready, calibrated feedback from the G1-D lift capability.
 * @param robot - The current device snapshot.
 * @returns A position within the reported physical travel, or null when unavailable.
 */
export function readLiftFeedback(robot: RobotSnapshot): LiftFeedback | null {
  if (robot.kind !== 'available') return null
  const lift = robot.capabilities.find(capability => capability.id === 'lift')
  if (lift?.status.kind !== 'ready') return null
  const result = liftEvidence.safeParse(lift.evidence)
  if (!result.success) return null
  const { physical_height_m: heightMeters, physical_min_m: min, physical_max_m: max } = result.data.facts
  if (heightMeters < min || heightMeters > max) return null
  return { heightMeters, extensionMeters: heightMeters - min, maxExtensionMeters: max - min }
}
