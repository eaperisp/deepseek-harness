// @vitest-environment jsdom
import { commandSchema } from '@deepseek-ai/dsh-embodied-project/model'
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { StudioController } from '../src/client/controller.ts'
import { StudioPage, type StudioPageProps } from '../src/client/StudioPage.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
const project = {
  formatVersion: 1, id: '11111111-1111-4111-8111-111111111111',
  revisions: [{ revision: 1, title: '找杯子', goal: '检索历史画面', template: 'spatial-memory', target: 'sample-camera', templateVersion: '1', targetVersion: '1', createdAt: '2026-01-01T00:00:00.000Z' }],
  runs: [],
}

it('offers registered templates, shows Host evidence validity and submits the selected target', async () => {
  const dispatch = vi.fn(async (raw: string) => {
    const action = commandSchema.parse(JSON.parse(raw)).action
    if (action === 'catalog') return JSON.stringify({ templates: [{ id: 'spatial-memory', version: '1', title: 'Memory', description: 'Sample', steps: ['image.read', 'memory.search'], required: ['image.read'], optional: [], limitations: [] }], targets: [{ id: 'custom-target', version: '1', title: '自定义样例设备', mode: 'sample', capabilities: ['image.read'] }] })
    if (action === 'list') return JSON.stringify({ projects: [{ id: project.id, current: project.revisions[0], status: 'needs-validation' }] })
    return JSON.stringify({ project, status: 'needs-validation' })
  })
  const controller = new StudioController(dispatch)
  await controller.command({ action: 'read', id: project.id })
  const command = vi.fn(async (_command: Record<string, unknown>) => {})
  const props: StudioPageProps = {
    command, t: makeTranslate(zh),
    useStudio: select => select(useSyncExternalStore(
      callback => controller.state.subscribe(callback), () => controller.state.getSnapshot(),
    )),
  }
  render(<StudioPage {...props} />)
  expect(screen.getByText(/当前配置需要重新验证/)).toBeTruthy()
  expect(screen.getByRole('button', { name: '自定义样例设备' })).toBeTruthy()
  expect(screen.getByText(/未连接真实机器人/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '应用所选设备及插件版本' }))
  expect(command).toHaveBeenCalledWith({ action: 'revise', id: project.id, expectedRevision: 1, title: '找杯子', goal: '检索历史画面', target: 'custom-target' })
  controller.dispose()
})

it('keeps saved state on failure, blocks duplicate requests and publishes nothing after disposal', async () => {
  const pending = Promise.withResolvers<string>()
  const dispatch = vi.fn(() => pending.promise)
  const controller = new StudioController(dispatch)
  const first = controller.command({ action: 'list' })
  await controller.command({ action: 'list' })
  expect(dispatch).toHaveBeenCalledTimes(1)
  controller.dispose()
  pending.resolve('{"projects":[]}')
  await first
  expect(controller.state.getSnapshot().projects).toEqual([])
  expect(dispatch).toHaveBeenCalledTimes(1)

  const failing = new StudioController(async () => { throw new Error('Offline') })
  await failing.command({ action: 'list' })
  expect(failing.state.getSnapshot()).toMatchObject({ busy: false, error: 'Offline' })
  failing.dispose()
})

it('rejects malformed Remote data without reporting a successful load', async () => {
  const controller = new StudioController(async () => '{"projects":"invalid"}')
  await controller.command({ action: 'list' })
  expect(controller.state.getSnapshot().error).not.toBeNull()
  expect(controller.state.getSnapshot().projects).toEqual([])
  controller.dispose()
})
