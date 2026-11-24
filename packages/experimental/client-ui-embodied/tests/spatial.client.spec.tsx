// @vitest-environment jsdom
/** Sensor plots follow accordion visibility. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { SpatialRow } from '../src/client/SpatialRow.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each(['scan', 'odom'] as const)('requests %s data only for the visible open row', async (kind) => {
  const calls: AbortSignal[] = []
  vi.stubGlobal('fetch', async (path: string, options: RequestInit) => {
    if (path.endsWith('/info')) return Response.json({ locationSource: 'SLAMWARE', lidarModel: 'TestLaser', intervalMs: 10000 })
    expect(path).toBe('/robot-spatial/' + kind)
    calls.push(options.signal!)
    return Response.json({ kind, seq: 7, time: 5, frame: kind, points: [[2, 0]], x: 1, y: 2, yaw: 0 })
  })
  render(<SpatialRow kind={kind} title="Sensor" group="inventory" t={makeTranslate(zh)}>{null}</SpatialRow>)
  await screen.findByText(kind === 'scan' ? 'TestLaser' : 'SLAMWARE')
  expect(screen.getByText('已暂停').parentElement?.textContent).toMatchInlineSnapshot('"预览传输速率 已暂停"')
  expect(calls).toHaveLength(0)
  const row = screen.getByText('Sensor').closest('details')!
  row.open = true
  fireEvent(row, new Event('toggle'))
  const plot = await screen.findByRole('img')
  expect(plot.getAttribute('aria-label')).toBe(kind === 'scan' ? '二维激光扫描' : '里程计轨迹与朝向')
  row.open = false
  fireEvent(row, new Event('toggle'))
  await waitFor(() => expect(calls[0]?.aborted).toBe(true))
  expect(screen.queryByRole('img')).toBeNull()
})
