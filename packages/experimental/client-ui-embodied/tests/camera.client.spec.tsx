// @vitest-environment jsdom
/** Camera acquisition follows the expanded row. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { CameraRow } from '../src/client/CameraRow.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('loads metadata while folded and aborts the outstanding frame on collapse', async () => {
  const frames: AbortSignal[] = []
  vi.stubGlobal('fetch', (path: string, options: RequestInit) => {
    if (path.endsWith('/info')) return Promise.resolve(Response.json({ model: 'TestCam', type: 'UVC', fps: 30, intervalMs: 250 }))
    const signal = options.signal
    if (!signal) throw new Error('Missing cancellation signal')
    frames.push(signal)
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  })
  render(<CameraRow title="Camera" group="inventory" t={makeTranslate(zh)}>{null}</CameraRow>)
  await screen.findByText('TestCam')
  expect(frames).toHaveLength(0)
  const row = screen.getByText('Camera').closest('details')!
  expect(Array.from(row.querySelectorAll('summary > span'), line => line.textContent)).toMatchInlineSnapshot(`
    [
      "Camera",
      "型号 TestCam · UVC",
      "预览传输速率 已暂停 · 配置 30 FPS",
    ]
  `)
  row.open = true
  fireEvent(row, new Event('toggle'))
  await waitFor(() => expect(frames).toHaveLength(1))
  row.open = false
  fireEvent(row, new Event('toggle'))
  await waitFor(() => expect(frames[0]?.aborted).toBe(true))
  expect(screen.queryByRole('img')).toBeNull()
})
