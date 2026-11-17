import { expect, it } from 'vitest'
import { INLINE_SAFE } from '../packages/client/tsdown.client.ts'

it('inlines only embodied project JSON schemas, excluding Host services and persistence', () => {
  expect(INLINE_SAFE.test('@deepseek-ai/dsh-embodied-project/model')).toBe(true)
  expect(INLINE_SAFE.test('@deepseek-ai/dsh-robot/model')).toBe(true)
  for (const specifier of [
    '@deepseek-ai/dsh-embodied-project',
    '@deepseek-ai/dsh-embodied-project/model/host',
    '@deepseek-ai/dsh-embodied-project/status',
    '@deepseek-ai/dsh-embodied-project/src/store.ts',
    '@deepseek-ai/dsh-client-ui-embodied',
    '@deepseek-ai/dsh-robot',
    '@deepseek-ai/dsh-robot/model/host',
    '@deepseek-ai/dsh-robot-g1d',
  ]) expect(INLINE_SAFE.test(specifier)).toBe(false)
})
