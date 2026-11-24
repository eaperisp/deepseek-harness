/** Exercise the manual dispatch adapter against in-memory hardware. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installOperator } from '../examples/g1d-operator.mjs'

test('suction controls recheck the idle arm and verify the reported output after a single request', async t => {
  let service
  let on = false
  let tasks = 0
  const writes = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    switch (new URL(url).pathname) {
      case '/api/state': return Response.json({ bridge: { running: true, arm_node_seen: true }, active_task_count: tasks })
      case '/api/v1/status': return Response.json({ ok: true, service: 'es80z-api', data: {
        serial_present: true, serial_error: null, fault: 0, is_enabled: true, is_ready: true, is_sucked: on, is_released: !on,
      } })
      case '/api/v1/command': {
        assert.equal(options.method, 'POST')
        const { command } = JSON.parse(options.body)
        writes.push(command)
        on = command === 'suck'
        return Response.json({ ok: true })
      }
      default: return Response.json({})
    }
  })
  installOperator({ provide(_, v) { service = v }, effect(fn) { t.after(fn()) } }, {
    tools: [], robot: { getState: async () => null }, settings: { directMotion: true, arm: { consoleUrl: 'http://arm.test' } },
    suctionUrl: 'http://cup.test', liftUrl: 'http://lift.test/', jointsUrl: 'http://joints.test/',
  })
  const read = async () => JSON.parse(await service.state(new AbortController().signal))
  let state = await read()
  assert.deepEqual(state.actions, ['suck'])
  for (const action of ['suck', 'release']) {
    service.submit(action, '', state.ticket)
    assert.throws(() => service.submit(action, '', state.ticket))
    await new Promise(resolve => setImmediate(resolve))
    state = await read()
    assert.equal(state.receipt.status, 'returned')
    assert.equal(state.suction, action === 'suck' ? 'on' : 'off')
  }
  tasks = 1
  service.submit('suck', '', state.ticket)
  await new Promise(resolve => setImmediate(resolve))
  state = await read()
  assert.deepEqual(writes, ['suck', 'release'])
  assert.equal(state.receipt.status, 'unconfirmed')
  assert.deepEqual(state.actions, [])
})

test('one click submits one relative lift; a replay or overlapping command cannot move it again', async t => {
  const pending = Promise.withResolvers()
  const calls = []
  let service
  let close
  const ctx = { provide(_, value) { service = value }, effect(fn) { close = fn() } }
  t.mock.method(globalThis, 'fetch', async url => Response.json(url === 'lift' ? {
    ok: true, offset_valid: true, data_age_sec: 0, physical_min_m: 0, physical_max_m: .43, physical_height_m: .27,
  } : { ok: true, state: { ok: true, source: 'unitree_dds_lowstate', dds: { lowstate_age_ms: 0 }, joints: {} } }))
  const lift = { name: 'robot_lift', execute(args) { calls.push(args); return pending.promise }, output: { render: () => [{ text: 'verified' }] } }
  const options = { robot: { getState: async () => ({ ok: true, freshness_s: { odom: 0 }, odom: { x: 0, y: 0, yaw: 3, frame_id: 'odom' } }) },
    tools: [lift], settings: { directMotion: true, requireActionApproval: true, arm: {}, lift: { arrivalMarginM: .002 } }, liftUrl: 'lift', jointsUrl: 'joints' }
  installOperator(ctx, options)
  assert.equal(service, undefined)
  installOperator(ctx, { ...options, settings: { ...options.settings, requireActionApproval: false } })
  const read = async () => JSON.parse(await service.state(new AbortController().signal))
  const before = await read()
  assert.deepEqual(calls, [])
  assert.throws(() => service.submit('raise', '', 'old'))
  const id = service.submit('raise', '', before.ticket)
  assert.throws(() => service.submit('raise', '', before.ticket))
  assert.equal((await read()).receipt.status, 'running')
  await assert.rejects(lift.execute({ delta_m: .1 }, {}))
  assert.deepEqual(calls, [{ delta_m: .1 }])
  pending.resolve({ verified: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual((await read()).receipt, { id, action: 'raise', status: 'returned', detail: 'verified' })
  await close()
})

test('lift steps use calibrated remaining travel and stop within the arrival tolerance', async t => {
  for (const [height, min, age, action, delta] of [
    [.0948, 0, 0, 'lower', -.0948],
    [.0948, .02, 0, 'lower', -.0748],
    [.2, 0, 0, 'lower', -.1],
    [.4, 0, 0, 'raise', .028],
    [.022, .02, 0, 'lower', 0],
    [0, 0, 0, 'lower', 0],
    [.427, 0, 0, 'raise', 0],
    [.0948, 0, 3, 'lower', 0],
  ]) {
    await t.test(`${action} at ${height} m, minimum ${min} m, age ${age} s`, async t => {
      let service
      let input
      t.mock.method(globalThis, 'fetch', async url => Response.json(url === 'lift' ? {
        ok: true, offset_valid: true, data_age_sec: age, physical_min_m: min, physical_max_m: .43, physical_height_m: height,
      } : {}))
      installOperator({ provide(_, value) { service = value }, effect(fn) { t.after(fn()) } }, {
        robot: { getState: async () => null }, liftUrl: 'lift', jointsUrl: 'joints',
        settings: { directMotion: true, requireActionApproval: false, arm: {}, lift: { arrivalMarginM: .002 } },
        tools: [{ name: 'robot_lift', async execute(args) { input = args; return { verified: true } }, output: { render: () => [] } }],
      })
      const state = JSON.parse(await service.state(new AbortController().signal))
      assert.equal(state.actions.includes(action), delta !== 0)
      if (delta === 0) {
        assert.throws(() => service.submit(action, '', state.ticket))
        assert.equal(input, undefined)
      } else {
        service.submit(action, '', state.ticket)
        await new Promise(resolve => setImmediate(resolve))
        assert.ok(Math.abs(input.delta_m - delta) < 1e-9)
        assert.equal(Math.abs(input.delta_m), state.lift[action === 'raise' ? 'raiseStep' : 'lowerStep'])
      }
    })
  }
})
