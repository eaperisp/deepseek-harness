import { Context } from '@deepseek-ai/cordis'
import RobotRuntime from '@deepseek-ai/dsh-robot'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import { expect, it } from 'vitest'
import * as InventoryTool from '../examples/inventory-tool.ts'

it('removes the custom inventory tool when its plugin unloads', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(RobotRuntime)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(Tools)
    const plugin = ctx.plugin(InventoryTool)
    await plugin
    expect(ctx.tools.get('robot_inventory_summary')).toBeDefined()

    await plugin.dispose()
    expect(ctx.tools.get('robot_inventory_summary')).toBeUndefined()
  } finally {
    await ctx.fiber.dispose()
  }
})
