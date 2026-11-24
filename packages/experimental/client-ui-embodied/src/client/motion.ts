/** Fixed operator actions and measured G1-D coordinates in metres and radians. */
import { z } from 'zod'

const actions = z.enum(['forward', 'backward', 'turnLeft', 'turnRight', 'raise', 'lower', 'rest', 'grasp', 'stop', 'armStop', 'suck', 'release'])
/** One manual movement or stop. */
export type MotionAction = z.infer<typeof actions>
/** Validated snapshot returned by the installed operator adapter. */
export const motionSchema = z.object({
  ticket: z.string(), actions: z.array(actions),
  taskCount: z.number().int().nonnegative().nullish(), taskStage: z.string().nullish(),
  suction: z.enum(['on', 'off', 'blowing']).nullish(),
  base: z.object({ frame: z.string(), x: z.number(), y: z.number(), yaw: z.number() }).nullable(),
  lift: z.object({
    height: z.number(), min: z.number(), max: z.number(),
    raiseStep: z.number().min(0).max(.1).optional(), lowerStep: z.number().min(0).max(.1).optional(),
  }).nullable(),
  joints: z.record(z.string(), z.number()).nullable(),
  receipt: z.object({ id: z.string(), action: actions, status: z.enum(['running', 'returned', 'unconfirmed']), detail: z.string() }).nullable(),
}).nullable()
/** One operator snapshot, including the absence of an installed adapter. */
export type MotionState = z.infer<typeof motionSchema>
/** Browser transport for shared operator state and single-use movement tickets. */
export interface MotionPort {
  read(): Promise<MotionState>
  submit(action: MotionAction, target: string, ticket: string): Promise<string>
}
