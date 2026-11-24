/** Authenticated, on-demand left-eye JPEG relay for the G1-D Web profile. */
export const inject = ['webServer']

/** Register camera metadata and a single-frame relay for this profile.
 * @param ctx - Web server and plugin lifetime.
 * @param config - Dashboard origin, device identification and preview sampling settings.
 */
export function apply(ctx, { origin, model, type, fps, intervalMs = 250, maxBytes = 2 * 1024 * 1024, timeoutMs = 5000 }) {
  const upstream = new URL(origin)
  if (!['https:', 'http:'].includes(upstream.protocol) || upstream.origin !== origin) throw new Error('Expected a dashboard origin')
  if ((model !== undefined && typeof model !== 'string') || typeof type !== 'string' || !type.trim() ||
    !Number.isFinite(fps) || fps <= 0 || !Number.isSafeInteger(intervalMs) || intervalMs < 1 ||
    !Number.isSafeInteger(maxBytes) || maxBytes < 4 || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid camera settings')
  const lifetime = new AbortController()
  ctx.effect(() => () => lifetime.abort())
  function route(path, serve) {
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/robot-camera/left/' + path,
      resource(request, peer) {
        if (!peer) return new Response(null, { status: 403 })
        if (request.method !== 'GET') return new Response(null, { status: 405 })
        return serve(request)
      },
    }))
  }
  route('info', () => Response.json({ model: model || null, type, fps, intervalMs }, { headers: { 'cache-control': 'no-store' } }))
  route('frame.jpg', async request => {
    const cancel = new AbortController()
    const signal = AbortSignal.any([request.signal, lifetime.signal, cancel.signal, AbortSignal.timeout(timeoutMs)])
    try {
      const reply = await fetch(new URL('/api/camera/left_eye.jpg', upstream), { signal, redirect: 'error' })
      if (!reply.ok || reply.headers.get('content-type')?.split(';')[0] !== 'image/jpeg' || !reply.body) {
        return new Response(null, { status: 502 })
      }
      const chunks = []
      let size = 0
      for await (const chunk of reply.body) {
        size += chunk.length
        if (size > maxBytes) return new Response(null, { status: 502 })
        chunks.push(chunk)
      }
      const jpeg = Buffer.concat(chunks, size)
      if (size < 4 || jpeg.readUInt16BE(0) !== 0xffd8 || jpeg.readUInt16BE(size - 2) !== 0xffd9) return new Response(null, { status: 502 })
      return new Response(jpeg, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } })
    } catch (error) {
      if (request.signal.aborted) throw error
      return new Response(null, { status: 503 })
    } finally { cancel.abort() }
  })
}
