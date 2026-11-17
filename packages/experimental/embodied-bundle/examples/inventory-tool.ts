/** Opt-in example that summarizes capability discovery through a custom tool. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-robot'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis plugin name. */
export const name = 'example-robot-inventory-tool'

/** Services used by the example. */
export const inject = ['robot', 'tools']

/**
 * Expose a read-only inventory summary for the lifetime of the plugin.
 * @param ctx - Robot registry and model tool registry.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'robot_inventory_summary',
    description: 'Count discovered robot providers and capabilities by readiness. Use robot_inspect for operation details.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          availableProviders: { type: 'integer', required: true },
          failedProviders: { type: 'integer', required: true },
          readyCapabilities: { type: 'integer', required: true },
          degradedCapabilities: { type: 'integer', required: true },
          unavailableCapabilities: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(_args, exec) {
      const { providers } = await ctx.robot.inspect(exec.signal)
      const available = providers.filter(provider => provider.kind === 'available')
      const capabilities = available.flatMap(provider => provider.capabilities)
      return {
        availableProviders: available.length,
        failedProviders: providers.length - available.length,
        readyCapabilities: capabilities.filter(capability => capability.status.kind === 'ready').length,
        degradedCapabilities: capabilities.filter(capability => capability.status.kind === 'degraded').length,
        unavailableCapabilities: capabilities.filter(capability => capability.status.kind === 'unavailable').length,
      }
    },
  }))
}
