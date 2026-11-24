// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { SelfController } from '../src/client/self.ts'
import { SelfPage, type SelfPageProps } from '../src/client/SelfPage.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
it('shows registered operations, evidence and capability gaps when filtering a device', async () => {
  const controller = new SelfController(async () => JSON.stringify({ providers: [{
    kind: 'available', provider: { id: 'robot', name: 'Connected robot' }, capabilities: [
      { id: 'arm', name: 'Arm', category: 'actuator', description: 'Advertised service', status: { kind: 'degraded', message: 'Adapter missing' }, operations: [] },
      {
        id: 'camera', name: 'Camera', category: 'sensor', description: 'Forward camera', status: { kind: 'ready' },
        operations: [{ id: 'read_camera_status', name: 'Read camera status', description: 'Read status', mode: 'observe', arguments: [] }],
        evidence: { source: 'Discovery adapter' },
      },
    ],
  }] }))
  await controller.refresh()
  const props: SelfPageProps = {
    motion: { read: async () => null, submit: vi.fn() }, t: makeTranslate(zh),
    refresh: () => controller.refresh(), sample: () => controller.sample(),
    useSelf: select => select(useSyncExternalStore(
      callback => controller.state.subscribe(callback), () => controller.state.getSnapshot(),
    )),
  }
  render(<SelfPage {...props} />)
  expect(screen.getByText('Connected robot')).toBeTruthy()
  expect(screen.getByText('Adapter missing')).toBeTruthy()
  fireEvent.click(screen.getByText('Arm'))
  expect(screen.getByText(/当前没有可调用操作/)).toBeTruthy()
  const filters = within(screen.getByRole('group', { name: '按能力状态筛选' }))
  fireEvent.click(filters.getByRole('button', { name: '就绪 1' }))
  expect(screen.queryByText('Arm')).toBeNull()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'read_camera_status' } })
  fireEvent.click(screen.getByText('Camera'))
  expect(screen.getByText('read_camera_status')).toBeTruthy()
  expect(screen.getByText('只读')).toBeTruthy()
  const disclosure = screen.getByText('发现证据')
  fireEvent.click(disclosure)
  expect(disclosure.closest('details')?.open).toBe(true)
  expect(screen.getByText(/Discovery adapter/)).toBeTruthy()
  fireEvent.click(screen.getByText('状态说明'))
  expect(screen.getByText(/观测数据可能过期/).closest('details')?.open).toBe(true)
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
it('keeps the snapshot visible while a live read fails and clears the live error after recovery', async () => {
  const inspect = vi.fn(async () => '{"providers":[]}')
  const controller = new SelfController(inspect)
  await controller.refresh()
  inspect.mockRejectedValueOnce(new Error('Offline'))
  await controller.sample()
  expect(controller.state.getSnapshot()).toMatchObject({ inventory: { providers: [] }, busy: false, liveInterrupted: true })
  await controller.sample()
  expect(controller.state.getSnapshot().liveInterrupted).toBe(false)
  controller.dispose()
})
