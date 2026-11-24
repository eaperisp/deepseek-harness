/** Spatial preview projections and access through read-only routes. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../examples/g1d-spatial.mjs'

test('folded metadata reads no dashboard state and expanded routes expose only fresh matching samples', async t => {
  const routes = new Map()
  apply({ effect(fn) { t.after(fn()) }, webServer: { register(route) {
    routes.set(route.path, route.resource)
    return () => routes.delete(route.path)
  } } }, { origin: 'http://robot.test', locationSource: 'SLAMWARE' })
  const snapshot = { ok: true, freshness_s: { scan: .1, odom: .1 },
    scan: { frame_id: 'laser', seq: 1, received_at: 3, angle_min: 0, angle_increment: Math.PI / 2, ranges: [2, null, 4] },
    odom: { frame_id: 'odom', seq: 2, received_at: 5, x: 1, y: 2, yaw: .5 }, track: 'private' }
  const upstream = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.href, 'http://robot.test/api/state')
    return Response.json(snapshot)
  })
  const read = (kind, peer) => routes.get('/robot-spatial/' + kind)(new Request('http://app.test'), peer)
  assert.equal((await read('scan')).status, 403)
  assert.equal((await (await read('info', {})).json()).lidarModel, null)
  assert.equal(upstream.mock.callCount(), 0)
  assert.deepEqual((await (await read('scan', {})).json()).points, [[2, 0], [-4, 0]])
  assert.deepEqual(await (await read('odom', {})).json(), { kind: 'odom', frame: 'odom', seq: 2, time: 5, x: 1, y: 2, yaw: .5 })
  snapshot.freshness_s.scan = 5
  assert.equal(await (await read('scan', {})).json(), null)
})
