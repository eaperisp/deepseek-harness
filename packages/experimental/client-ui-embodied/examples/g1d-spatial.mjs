/** Authenticated on-demand laser scans and odometry from the G1-D dashboard. */
export const inject = ['webServer']

/** Register read-only sensor preview routes for the configured robot.
 * @param ctx - Web server and plugin lifetime.
 * @param config - Dashboard origin, identification and sampling limits.
 */
export function apply(ctx, { origin, lidarModel = null, locationSource, intervalMs = 500, maxAgeSeconds = 2, timeoutMs = 4000, maxBytes = 4 * 1024 * 1024 }) {
  const upstream = new URL(origin)
  if (upstream.origin !== origin || !['https:', 'http:'].includes(upstream.protocol) ||
    (lidarModel !== null && typeof lidarModel !== 'string') || typeof locationSource !== 'string' || !locationSource.trim() ||
    ![intervalMs, timeoutMs, maxBytes].every(v => Number.isSafeInteger(v) && v > 0) || !Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new Error('Invalid spatial preview configuration')
  }
  const life = new AbortController()
  ctx.effect(() => () => life.abort())
  const json = value => Response.json(value, { headers: { 'cache-control': 'no-store' } })
  function route(name, serve) {
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/robot-spatial/' + name,
      resource(req, peer) {
        if (!peer) return new Response(null, { status: 403 })
        if (req.method !== 'GET') return new Response(null, { status: 405 })
        return serve(req)
      },
    }))
  }
  route('info', () => json({ lidarModel, locationSource, intervalMs }))
  for (const kind of ['scan', 'odom']) route(kind, async req => {
    const cancel = new AbortController()
    const signal = AbortSignal.any([req.signal, life.signal, cancel.signal, AbortSignal.timeout(timeoutMs)])
    try {
      const res = await fetch(new URL('/api/state', upstream), { signal, redirect: 'error' })
      if (!res.ok || !res.body) return new Response(null, { status: 502 })
      const chunks = []
      let size = 0
      for await (const chunk of res.body) {
        size += chunk.length
        if (size > maxBytes) return new Response(null, { status: 502 })
        chunks.push(chunk)
      }
      const state = JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
      if (state?.ok !== true) return new Response(null, { status: 502 })
      const data = state[kind]
      const age = state.freshness_s?.[kind]
      if (!data || !Number.isFinite(age) || age < 0 || age > maxAgeSeconds || typeof data.frame_id !== 'string') return json(null)
      const common = { kind, frame: data.frame_id, seq: data.seq, time: data.received_at }
      if (![common.seq, common.time].every(Number.isFinite)) return json(null)
      if (kind === 'scan') {
        if (!Array.isArray(data.ranges) || data.ranges.length > 16384 || ![data.angle_min, data.angle_increment].every(Number.isFinite)) return json(null)
        const points = []
        for (const [i, r] of data.ranges.entries()) {
          if (!Number.isFinite(r) || r <= 0) continue
          const angle = data.angle_min + i * data.angle_increment
          points.push([+(r * Math.cos(angle)).toFixed(3), +(r * Math.sin(angle)).toFixed(3)])
        }
        return json({ ...common, points })
      }
      if (![data.x, data.y, data.yaw].every(Number.isFinite)) return json(null)
      return json({ ...common, x: data.x, y: data.y, yaw: data.yaw })
    } catch (error) {
      if (req.signal.aborted) throw error
      return new Response(null, { status: 503 })
    } finally { cancel.abort() }
  })
}
