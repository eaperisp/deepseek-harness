/** Simulated robot provider plugin. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-robot'
import z from '@deepseek-ai/schemastery'
import { SimulatedRobotProvider } from './provider.ts'

/** Cordis plugin name. */
export const name = 'robot-simulated'

/** Services required to register the simulated provider. */
export const inject = ['robot']

/** Simulated robot identity and initial observations. */
export interface Config {
  /** Stable provider id used by robot tools. */
  providerId: string
  /** Human-readable robot name. */
  providerName: string
  /** Nearest obstacle reported by the simulated radar. */
  obstacleDistanceMeters: number
  /** Label returned by simulated camera recognition. */
  recognizedObjectLabel: string
}

/** Simulated robot identity and initial observations. */
export const Config = z.object({
  providerId: z.string().min(1).default('simulated'),
  providerName: z.string().min(1).default('Simulated mobile manipulator'),
  obstacleDistanceMeters: z.number().min(0).default(1.4),
  recognizedObjectLabel: z.string().min(1).default('box'),
})

/**
 * Register one deterministic simulated robot.
 * @param ctx - robot capability registry.
 * @param config - validated provider identity and initial observations.
 */
export function apply(ctx: Context, config: Config): void {
  const provider = new SimulatedRobotProvider(config)
  ctx.effect(() => ctx.robot.register(provider), 'robot-simulated.registration()')
}
