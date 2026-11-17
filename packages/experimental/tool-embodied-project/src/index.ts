/** Model tool consumer of the UI-independent embodied project service. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-embodied-project'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis plugin identity. */
export const name = 'tool-embodied-project'
/** Required project and tool services. */
export const inject = ['embodiedProjects', 'tools']

/**
 * Register the development tool; normal tool results are retained in the Session.
 * @param ctx - plugin lifetime with project and tool services.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'embodied_project',
    description: 'Manage robot development projects. Begin with catalog. create requires title, goal, template and target; read/export require id; revise requires id, expectedRevision, title, goal and target; run requires id, expectedRevision and query. list resumes stored projects. Template providers declare available capabilities. Sample evidence never proves model inference or real-robot behavior. Explain the result and next step in the user language.',
    parameters: { command: { type: 'string', required: true, description: 'JSON command whose action is catalog, list, create, read, revise, run or export.' } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async (args, exec) => await ctx.embodiedProjects.execute(args.command, exec.signal),
    presentCall: () => ({ card: 'generic', title: 'embodied_project' }),
  }))
}
