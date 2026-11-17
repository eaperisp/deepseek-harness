import { expect, it } from 'vitest'
import { runSample } from '../src/samples.ts'
import type { Revision } from '@deepseek-ai/dsh-embodied-project/model'

const revision: Revision = { revision: 1, title: 'Find cup', goal: 'Read history', template: 'spatial-memory', target: 'camera', templateVersion: '1', targetVersion: '1', createdAt: '2026-01-01T00:00:00.000Z' }
const target = { id: 'camera', title: 'Camera', version: '1', mode: 'sample', capabilities: ['image.read'] } as const
const signal = new AbortController().signal

it('retrieves Chinese and English annotations with explicitly missing observer positions', async () => {
  for (const query of ['杯子', 'cup']) {
    const result = await runSample(revision, target, query, signal)
    expect(result.status).toBe('passed')
    expect(result.observations).toMatchObject([{ image: 'sample://kitchen', observerPosition: null, mapSession: 'sample-map-1' }])
    expect(result.observations).toHaveLength(1)
  }
})

it('reports no match as blocked and keeps sample coordinates tied to their map session', async () => {
  expect((await runSample(revision, target, 'missing', signal)).status).toBe('blocked')
  const located = await runSample(revision, { ...target, capabilities: ['image.read', 'pose.read'] }, 'keys', signal)
  expect(located.observations[0]?.observerPosition).toEqual({ x: 3, y: 2, frame: 'sample-map-1' })
  expect((await runSample({ ...revision, template: 'vision' }, target, 'cup', signal)).observations).toHaveLength(3)
  await expect(runSample(revision, target, 'cup', AbortSignal.abort(new Error('cancelled')))).rejects.toThrow('cancelled')
})
