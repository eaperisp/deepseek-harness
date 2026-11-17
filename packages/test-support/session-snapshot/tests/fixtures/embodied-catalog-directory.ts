/** Portable directory spelling for catalog-only recorded sessions. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'

/** Stable Loader identity for the recording fixture. */
export const name = 'embodied-catalog-directory'

/**
 * Keep the real workspace directory while avoiding JSON-escaped Windows separators.
 * @param ctx - Context observing recorded Agent creation.
 */
export function apply(ctx: Context): void {
  ctx.on('agent/created', async ({ agent }) => {
    const cwd = agent.session.header.cwd
    if (cwd === undefined) throw new Error('Catalog recording requires a workspace directory')
    agent.session.append('working-directory/change', { cwd: cwd.replaceAll('\\', '/') })
  })
}
