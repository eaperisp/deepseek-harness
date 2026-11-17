/** Browser registration for the robot project workbench. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import remote from '@deepseek-ai/dsh-client-ui-embodied/remote'
import { SelfController } from './self.ts'
import { SelfPage } from './SelfPage.tsx'
import { StudioIcon } from './StudioPage.tsx'
import { en, zh } from './locales.ts'

/** Browser services required before mounting the workbench. */
export const inject = ['remote', 'slots', 'locale']

/**
 * Mount the generated Remote before consumers, and dispose consumers before the Remote.
 * @param ctx - browser plugin lifetime and required services.
 * @returns cleanup that joins UI disposal before unmounting the Remote.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.robotStudio', 'slots', 'locale'], (inner) => {
    inner.effect(() => inner.locale.register('robotStudio', { en, zh }))
    const t = inner.locale.bind('robotStudio')
    const controller = new SelfController(async () => {
      const result = await inner.remote.robotStudio.inspect()
      if (!result.ok) throw new Error(result.error.message)
      return result.value
    })
    inner.effect(() => () => { controller.dispose() })
    inner.slots.inject('main', () => inner.slots.register({
      name: 'main', key: 'robot-studio' as MainPanelId, locale: 'robotStudio',
      inject: () => ({ hooks: { self: controller.state }, refresh: () => controller.refresh() }),
    }, SelfPage))
    inner.slots.inject('sidebar.panellist', () => inner.slots.register({
      name: 'sidebar.panellist', id: 'robot-studio', order: 10, label: () => t('selfTitle'), locale: 'robotStudio',
    }, StudioIcon))
    void controller.refresh()
  })
  try { await ui } catch (error) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
