/** Left-eye identification and on-demand camera monitoring. */
import { useEffect, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './self.module.css'
import { usePreviewVisibility } from './preview-visibility.ts'

const cameraInfo = z.object({
  model: z.string().nullable(), type: z.string(), fps: z.number().positive(), intervalMs: z.number().int().positive(),
})

/** Show device metadata while folded and receive frames while the open row is visible.
 * @param props - Discovery title, accordion group, diagnostics and translated labels.
 * @returns The camera row.
 */
export function CameraRow({ title, group, t, children }: PropsLocale<'robotStudio'> & { title: string; group: string; children: ReactNode }) {
  const { open, visible, setOpen } = usePreviewVisibility()
  const [info, setInfo] = useState<z.infer<typeof cameraInfo> | null>(null)
  const [frame, setFrame] = useState<{ url: string; kbps: number } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (info || !visible) return
    const abort = new AbortController()
    void (async () => {
      try {
        const res = await fetch('/robot-camera/left/info', { signal: abort.signal, cache: 'no-store' })
        if (!res.ok) return
        const data = cameraInfo.parse(await res.json())
        if (!abort.signal.aborted) setInfo(data)
      } catch { /* An unconfigured camera has no verified device metadata. */ }
    })()
    return () => abort.abort()
  }, [open, visible, info])
  useEffect(() => {
    if (!open || !visible || !info) return
    const interval = info.intervalMs
    const abort = new AbortController()
    let timer: number | undefined
    let previousUrl: string | undefined
    let started = performance.now()
    let bytes = 0
    async function read() {
      try {
        const reply = await fetch('/robot-camera/left/frame.jpg', { signal: abort.signal, cache: 'no-store' })
        if (!reply.ok || reply.headers.get('content-type') !== 'image/jpeg') throw new Error('No camera frame')
        const blob = await reply.blob()
        if (abort.signal.aborted) return
        bytes += blob.size
        const now = performance.now()
        const elapsed = Math.max(now - started, 1)
        const url = URL.createObjectURL(blob)
        setFrame({ url, kbps: bytes * 8 / elapsed })
        if (previousUrl) URL.revokeObjectURL(previousUrl)
        previousUrl = url
        setFailed(false)
        if (elapsed >= 2000) { started = now; bytes = 0 }
      } catch {
        if (abort.signal.aborted) return
        setFrame(null)
        setFailed(true)
        bytes = 0
        started = performance.now()
      }
      if (!abort.signal.aborted) timer = window.setTimeout(() => { void read() }, interval)
    }
    void read()
    return () => {
      abort.abort()
      window.clearTimeout(timer)
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      setFrame(null)
      setFailed(false)
    }
  }, [open, visible, info])
  const speed = frame && open && visible ? t('previewKbps', { value: frame.kbps.toFixed(0) })
    : t(open && visible ? (failed || !info ? 'cameraNoImage' : 'cameraConnecting') : 'cameraPaused')
  return <details className={css.row} name={group} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className={css.cameraSummary}>
      <span className={css.cameraHeading}><strong>{title}</strong><IconChevronDownOutlineRegular className={css.chevron} size={14} /></span>
      <span>{t('cameraModel')} <b>{info?.model ?? t('cameraUnreported')}</b>{info?.type && ' · ' + info.type}</span>
      <span>{t('cameraSpeed')} <b>{speed}</b>{info && ' · ' + t('cameraFps', { value: String(info.fps) })}</span>
    </summary>
    {open && visible && <div className={css.cameraViewport}>
      {frame ? <img src={frame.url} alt={t('leftCameraImage')} /> : <span>{speed}</span>}
    </div>}
    {children}
  </details>
}
