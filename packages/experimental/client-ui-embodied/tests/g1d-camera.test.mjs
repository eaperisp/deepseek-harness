/** The camera relay reads upstream images only for admitted frame requests. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../examples/g1d-camera.mjs'

test('metadata and denied requests do not acquire frames, and malformed images stay out of the preview', async t => {
  const routes = new Map()
  const ctx = { effect(fn) { t.after(fn()) }, webServer: { register(route) {
    routes.set(route.path, route.resource)
    return () => routes.delete(route.path)
  } } }
  apply(ctx, { origin: 'http://camera.test', type: 'UVC', fps: 30, maxBytes: 6 })
  let bytes = [255, 216, 255, 217]
  const fetchFrame = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.href, 'http://camera.test/api/camera/left_eye.jpg')
    return new Response(Uint8Array.from(bytes), { headers: { 'content-type': 'image/jpeg' } })
  })
  function request(path, peer, method = 'GET') {
    return routes.get('/robot-camera/left/' + path)(new Request('http://app.test/', { method }), peer)
  }
  assert.equal((await request('frame.jpg')).status, 403)
  assert.equal((await request('frame.jpg', {}, 'HEAD')).status, 405)
  assert.equal((await (await request('info', {})).json()).model, null)
  assert.equal(fetchFrame.mock.callCount(), 0)
  const valid = await request('frame.jpg', {})
  assert.equal(valid.headers.get('cache-control'), 'no-store')
  assert.deepEqual([...new Uint8Array(await valid.arrayBuffer())], bytes)
  for (bytes of [[1, 2, 3, 4], [255, 216, 1, 2, 3, 255, 217]]) {
    assert.equal((await request('frame.jpg', {})).status, 502)
  }
})
