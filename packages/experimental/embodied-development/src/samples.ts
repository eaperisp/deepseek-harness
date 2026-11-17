/** Deterministic annotated sample pipeline; hardware and model inference are not invoked. */
import type { ProjectTemplate } from '@deepseek-ai/dsh-embodied-project'

/**
 * Execute the supplied beginner sample template against declared target capabilities.
 * @param revision - selected template and immutable project revision.
 * @param target - sample capabilities, including optional localization.
 * @param query - annotation tokens to retrieve.
 * @param signal - cancellation before sample evaluation.
 * @returns annotated sample evidence without owner-assigned identifiers.
 */
export const runSample: ProjectTemplate['run'] = (revision, target, query, signal) => Promise.resolve().then(() => {
  signal.throwIfAborted()
  const frames = [
    { image: 'sample://desk', label: '黑色本子 black notebook', x: 0.5, y: 1 },
    { image: 'sample://kitchen', label: '白色杯子 white cup', x: 2, y: 0.5 },
    { image: 'sample://entry', label: '钥匙 keys', x: 3, y: 2 },
  ]
  const tokens = query.toLowerCase().split(/\s+/u).filter(Boolean)
  const observations = frames.map(frame => ({
    image: frame.image, capturedAt: '2026-01-01T00:00:00.000Z', mapSession: 'sample-map-1', label: frame.label,
    score: tokens.length === 0 ? 0 : tokens.filter(token => frame.label.includes(token)).length / tokens.length,
    observerPosition: target.capabilities.includes('pose.read') ? { x: frame.x, y: frame.y, frame: 'sample-map-1' } : null,
  })).filter(frame => revision.template === 'vision' || frame.score > 0).sort((a, b) => b.score - a.score)
  return {
    mode: 'sample', status: observations.length > 0 ? 'passed' : 'blocked', observations,
    checks: [
      { name: 'sample-input', passed: true, detail: 'Three annotated sample frames; no live sensor or trained model was used.' },
      { name: 'result-present', passed: observations.length > 0, detail: observations.length > 0 ? 'Inspect the returned sample records.' : 'No sample label matched. Try cup, keys, notebook, 杯子 or 本子.' },
      { name: 'position-validity', passed: true, detail: target.capabilities.includes('pose.read') ? 'Observer positions belong to sample-map-1.' : 'Position is unavailable and is preserved as null.' },
    ],
  }
})
