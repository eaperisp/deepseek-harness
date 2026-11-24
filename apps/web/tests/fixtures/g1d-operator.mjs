/** In-memory control and telemetry for the G1-D browser scenario. */
export function apply(ctx, { endpoint }) {
  let command = 0
  let height = .0948
  let yaw = 0
  let elbow = 0
  let receipt = null
  ctx.provide('g1dOperator', {
    async state(signal) {
      const response = await fetch(endpoint, { signal })
      if (!(await response.json()).enabled) return 'null'
      return JSON.stringify({ actions: ['raise', 'turnLeft', 'grasp', ...(height > 0 ? ['lower'] : [])], ticket: String(command),
        base: { frame: 'odom', x: 0, y: 0, yaw }, joints: { right_elbow_joint: elbow },
        lift: { height, min: 0, max: .43, lowerStep: Math.min(.1, height) }, receipt })
    },
    submit(action, target, ticket) {
      if (ticket !== String(command)) throw new Error('Stale ticket')
      if (action === 'raise') height += .1
      else if (action === 'lower' && height > 0) height = Math.max(0, height - .1)
      else if (action === 'turnLeft') yaw += Math.PI / 12
      else if (action === 'grasp' && target === '42') elbow = 1.1
      else throw new Error('Unexpected operator command')
      const id = String(++command)
      receipt = { id, action, status: 'returned', detail: 'fixture-' + id }
      return id
    },
  })
}
