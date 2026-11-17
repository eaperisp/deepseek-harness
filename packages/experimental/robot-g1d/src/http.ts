/** Bounded, redirect-free observation requests to one configured robot host. */
import { RobotError } from '@deepseek-ai/dsh-robot'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { z } from 'zod'

/** Limits and exact host selected by the deployment, never by catalog response data. */
export interface HttpConfig {
  /** Configured HTTP(S) origin, without credentials, query or path. */
  host: string
  /** Per-request timeout in milliseconds. */
  timeoutMs: number
  /** Maximum UTF-8 response bytes accepted before parsing. */
  maxResponseBytes: number
}

/**
 * Read JSON from a reviewed observation endpoint on the configured robot.
 * @param config - Host identity and request limits.
 * @param port - Adapter-selected service port.
 * @param path - Adapter-selected read-only route.
 * @param signal - Caller and plugin cancellation.
 * @returns Parsed JSON; rejects redirects, oversized responses and transport failures.
 */
export async function readJson(config: HttpConfig, port: number, path: string, signal: AbortSignal): Promise<JsonValue> {
  const url = new URL(config.host)
  url.port = String(port); url.pathname = path
  const response = await fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)]) })
  if (!response.ok) { await response.body?.cancel(); throw new RobotError(`Observation HTTP status ${response.status}`, 'ROBOT_HTTP_STATUS') }
  const reader = response.body?.getReader()
  if (!reader) throw new RobotError('Observation response has no body', 'ROBOT_RESPONSE_INVALID')
  const chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      length += item.value.byteLength
      if (length > config.maxResponseBytes) throw new RobotError('Observation exceeds the configured byte limit', 'ROBOT_RESPONSE_TOO_LARGE')
      chunks.push(item.value)
    }
    return z.json().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } finally { await reader.cancel(); reader.releaseLock() }
}
