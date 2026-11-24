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
import { motionSchema, type MotionPort } from './motion.ts'

/** Browser services required before mounting the workbench. */
export const inject = ['remote', 'slots', 'locale', 'layout']

const panelId = 'robot-studio' as MainPanelId

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
    const refresh = () => controller.refresh()
    const sample = () => controller.sample()
    const motion: MotionPort = {
      async read() {
        const result = await inner.remote.robotStudio.motionState()
        if (!result.ok) throw new Error(result.error.message)
        return motionSchema.parse(JSON.parse(result.value))
      },
      async submit(action, target, ticket) {
        const result = await inner.remote.robotStudio.motion(action, target, ticket)
        if (!result.ok) throw new Error(result.error.message)
        return result.value
      },
    }
    inner.effect(() => () => { controller.dispose() })
    inner.slots.inject('main', function* () {
      yield inner.slots.register({
        name: 'main', key: panelId, locale: 'robotStudio',
        inject: () => ({ hooks: { self: controller.state }, refresh, sample, motion }),
      }, SelfPage)
      if (window.location.hash === '#robot-self') {
        inner.layout.selectPanel(panelId)
      }
      yield inner.layout.panelInfo.subscribe(() => {
        const url = new URL(window.location.href)
        const selected = inner.layout.panelInfo.getSnapshot().activePanelId === panelId
        if (selected === (url.hash === '#robot-self')) return
        url.hash = selected ? 'robot-self' : ''
        window.history.replaceState(window.history.state, '', url)
      })
    })
    inner.slots.inject('sidebar.panellist', () => inner.slots.register({
      name: 'sidebar.panellist', id: panelId, order: 10, label: () => t('selfTitle'), locale: 'robotStudio',
    }, StudioIcon))
    void controller.refresh()
  })
  try { await ui } catch (error) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
