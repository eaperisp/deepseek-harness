// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { SelfController } from '../src/client/self.ts'
import { SelfPage, type SelfPageProps } from '../src/client/SelfPage.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
it('shows live adapter operations and capability gaps without project templates', async () => {
  const controller = new SelfController(async () => JSON.stringify({ providers: [{ kind: 'available', provider: { id: 'robot', name: 'Connected robot' }, capabilities: [{ id: 'arm', name: 'Arm', category: 'actuator', description: 'Advertised service', status: { kind: 'degraded', message: 'Adapter missing' }, operations: [] }] }] }))
  await controller.refresh()
  const props: SelfPageProps = {
    t: makeTranslate(zh), refresh: () => controller.refresh(),
    useSelf: select => select(useSyncExternalStore(
      callback => controller.state.subscribe(callback), () => controller.state.getSnapshot(),
    )),
  }
  render(<SelfPage {...props} />)
  expect(screen.getByText('Connected robot')).toBeTruthy()
  expect(screen.getByText('Adapter missing')).toBeTruthy()
  expect(screen.getByText(/当前没有可调用操作/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '创建项目' })).toBeNull()
  controller.dispose()
})
it('clears old inventory on refresh failure and joins duplicate UI requests', async () => {
  const pending = Promise.withResolvers<string>()
  const inspect = vi.fn(async () => '{"providers":[]}').mockImplementationOnce(() => pending.promise)
  const controller = new SelfController(inspect)
  const first = controller.refresh(); await controller.refresh()
  expect(inspect).toHaveBeenCalledTimes(1)
  pending.resolve('{"providers":[]}'); await first
  expect(controller.state.getSnapshot().inventory).toEqual({ providers: [] })
  inspect.mockRejectedValueOnce(new Error('Offline'))
  await controller.refresh()
  expect(controller.state.getSnapshot()).toMatchObject({ inventory: null, error: 'Offline', busy: false })
  controller.dispose()
})
it('does not publish a late response after disposal', async () => {
  const pending = Promise.withResolvers<string>()
  const controller = new SelfController(() => pending.promise)
  const request = controller.refresh(); controller.dispose(); pending.resolve('{"providers":[]}'); await request
  expect(controller.state.getSnapshot().inventory).toBeNull()
})
