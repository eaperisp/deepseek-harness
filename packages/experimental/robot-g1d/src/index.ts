/** Register observation adapters for an existing G1-D gateway. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-robot'
import z from '@deepseek-ai/schemastery'
import { G1dProvider, type DiscoveryConfig } from './provider.ts'

/** Cordis plugin identity. */
export const name = 'robot-g1d'
/** Provider-neutral runtime owning dispatch and cancellation. */
export const inject = ['robot']
/** Deployment-selected G1-D endpoint and observation budgets. */
export interface Config extends DiscoveryConfig {}
/** Validated configuration; no robot address or credential is embedded in source. */
export const Config = z.object({
  host: z.string().required(), providerId: z.string().default('g1d'), robotName: z.string().default('Unitree G1-D'),
  portalPort: z.number().min(1).max(65535).default(18079), yoloPort: z.number().min(1).max(65535).default(18081),
  slamPort: z.number().min(1).max(65535).default(18083),
  liftPort: z.number().min(1).max(65535).default(28089),
  suctionPort: z.number().min(1).max(65535).default(18080),
  timeoutMs: z.number().min(1).default(5000),
  maxResponseBytes: z.number().min(1).default(2097152),
  maxDataAgeSeconds: z.number().min(0).default(2),
})
/**
 * Contribute the gateway adapter; no SDK is loaded and no motion endpoint is registered.
 * @param ctx - Plugin lifetime and robot registry.
 * @param config - Validated gateway origin and limits.
 */
export function apply(ctx: Context, config: Config): void { ctx.effect(() => ctx.robot.register(new G1dProvider(config))) }
