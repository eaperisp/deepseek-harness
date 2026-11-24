/** Expandable laser scan and odometry views. */
import { useEffect, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { usePreviewVisibility } from './preview-visibility.ts'
import css from './self.module.css'

const infoSchema = z.object({ lidarModel: z.string().nullable(), locationSource: z.string(), intervalMs: z.number().int().positive() })
const point = z.tuple([z.number(), z.number()])
const common = z.object({ frame: z.string(), seq: z.number(), time: z.number() })
const sampleSchema = z.discriminatedUnion('kind', [
  common.extend({ kind: z.literal('scan'), points: z.array(point).max(16384) }),
  common.extend({ kind: z.literal('odom'), x: z.number(), y: z.number(), yaw: z.number() }),
])
type Sample = z.infer<typeof sampleSchema>
type Point = z.infer<typeof point>
type View = { sample: Sample; trail: Point[]; kbps: number; hz: number | null }

function Plot({ sample, trail, label }: Pick<View, 'sample' | 'trail'> & { label: string }) {
  const origin: Point = sample.kind === 'odom' ? [sample.x, sample.y] : [0, 0]
  const points = sample.kind === 'scan' ? sample.points : trail
  const radius = Math.ceil(points.reduce((r, [x, y]) => Math.max(r, Math.hypot(x - origin[0], y - origin[1])), 1))
  const scale = 83 / radius
  const xy = ([x, y]: Point) => `${((x - origin[0]) * scale).toFixed(1)},${((origin[1] - y) * scale).toFixed(1)}`
  return <svg className={css.spatialPlot} role="img" aria-label={label} viewBox="-110 -96 220 192">
    <g fill="none" stroke="currentColor" opacity=".22">
      <circle r="83" /><circle r="41.5" /><path d="M-91 0H91 M0 -91V91" />
    </g>
    {sample.kind === 'scan' ? <><path d={points.map(p => 'M' + xy(p) + 'h.2').join('')} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><circle r="3" /></> :
      <><polyline points={trail.map(xy).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 0 -5 -5 -2 0 -5 5Z" transform={`rotate(${-sample.yaw * 180 / Math.PI})`} /></>}
    <text x="90" y="-4">+X</text><text x="4" y="-83">+Y</text><text x="-103" y="89">{radius} m</text>
  </svg>
}

/** Show the sensor identity, receiving rate and fresh samples for an expanded row.
 * @param props - Sensor kind, discovery identity, group and localized diagnostics.
 * @returns A laser scan or odometry row.
 */
export function SpatialRow({ kind, title, group, t, children }: PropsLocale<'robotStudio'> & {
  kind: Sample['kind']
  title: string
  group: string
  children: ReactNode
}) {
  const { open, visible, setOpen } = usePreviewVisibility()
  const [info, setInfo] = useState<z.infer<typeof infoSchema> | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (info || !visible) return
    const abort = new AbortController()
    void (async () => {
      try {
        const reply = await fetch('/robot-spatial/info', { signal: abort.signal, cache: 'no-store' })
        if (!reply.ok) return
        const meta = infoSchema.parse(await reply.json())
        if (!abort.signal.aborted) setInfo(meta)
      } catch { /* Identification remains unavailable until a successful read. */ }
    })()
    return () => abort.abort()
  }, [info, visible, open])
  useEffect(() => {
    if (!open || !visible || !info) return
    const interval = info.intervalMs
    const abort = new AbortController()
    let timer: number | undefined
    let previous: Sample | null = null
    let trail: Point[] = []
    let since = performance.now()
    async function read() {
      try {
        const reply = await fetch('/robot-spatial/' + kind, { signal: abort.signal, cache: 'no-store' })
        if (!reply.ok) throw new Error('Spatial preview unavailable')
        const buffer = await reply.arrayBuffer()
        const sample = sampleSchema.parse(JSON.parse(new TextDecoder().decode(buffer)))
        if (sample.kind !== kind) throw new Error('Unexpected spatial sample')
        if (abort.signal.aborted) return
        const now = performance.now()
        const continuous = previous && previous.frame === sample.frame && sample.seq >= previous.seq && sample.time >= previous.time
        const hz = continuous && previous && sample.time > previous.time
          ? (sample.seq - previous.seq) / (sample.time - previous.time) : null
        if (!continuous) trail = []
        if (sample.kind === 'odom' && (!continuous || previous?.seq !== sample.seq)) trail = [...trail.slice(-119), [sample.x, sample.y]]
        setView({ sample, trail, hz, kbps: buffer.byteLength * 8 / Math.max(1, now - since) })
        previous = sample
        since = now
        setFailed(false)
      } catch {
        if (abort.signal.aborted) return
        previous = null
        trail = []
        since = performance.now()
        setView(null)
        setFailed(true)
      }
      if (!abort.signal.aborted) timer = window.setTimeout(() => { void read() }, interval)
    }
    void read()
    return () => { abort.abort(); window.clearTimeout(timer); setView(null); setFailed(false) }
  }, [kind, info, open, visible])
  const active = open && visible
  const sample = active ? view?.sample : null
  const speed = active && view ? t('previewKbps', { value: view.kbps.toFixed(1) }) : t(active ? (!info || failed ? 'noSpatialData' : 'spatialConnecting') : 'cameraPaused')
  return <details className={css.row} name={group} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className={css.cameraSummary}>
      <span className={css.cameraHeading}><strong>{title}</strong><IconChevronDownOutlineRegular className={css.chevron} size={14} /></span>
      <span>{t(kind === 'scan' ? 'cameraModel' : 'poseSource')} <b>{(kind === 'scan' ? info?.lidarModel : info?.locationSource) ?? t('cameraUnreported')}</b>
        {kind === 'scan' && ' · ' + t('laserScan')}</span>
      <span>{t('cameraSpeed')} <b>{speed}</b>{active && view?.hz != null && ' · ' + view.hz.toFixed(1) + ' Hz'}</span>
    </summary>
    {active && <div className={css.spatialView}>
      {sample && view ? <>
        <Plot sample={sample} trail={view.trail} label={t(kind === 'scan' ? 'laserScan' : 'odometryPlot')} />
        <span>{sample.frame} · {sample.kind === 'scan' ? t('scanReturns', { value: String(sample.points.length) }) :
          `X ${sample.x.toFixed(2)} m · Y ${sample.y.toFixed(2)} m · ${(sample.yaw * 180 / Math.PI).toFixed(1)}°`}</span>
      </> : <span>{speed}</span>}
    </div>}
    {children}
  </details>
}
