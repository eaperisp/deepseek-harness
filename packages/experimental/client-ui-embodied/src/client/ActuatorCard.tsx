/** Live readouts for the G1-D actuator inventory. */
import { createContext, useContext, type ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { MotionState } from './motion.ts'
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './self.module.css'

/** Measurements shared by the model and actuator status rows. */
export const ActuatorContext = createContext<{
  state: MotionState
  height: number | undefined
  travel: number | undefined
} | null>(null)

/** Display current actuator feedback and expandable diagnostics.
 * @param props - Actuator identity, localized text and discovery details.
 * @returns A read-only actuator status row.
 */
export function ActuatorCard({ id, group, t, children }: { id: 'lift' | 'arm' | 'suction'; group?: string; children: ReactNode } & PropsLocale<'robotStudio'>) {
  const controls = useContext(ActuatorContext)
  if (!controls) return children
  const { state, height, travel } = controls
  const count = state?.taskCount
  const cup = state?.suction
  const title = t(id === 'lift' ? 'liftAxis' : id === 'arm' ? 'armAxis' : 'cupAxis')
  const value = id === 'lift' ? (height === undefined ? t('noReading') : t('heightCm', { value: (100 * height).toFixed(1) }))
    : id === 'arm' ? (count == null ? t('noReading') : count === 0 ? t('taskIdle') : t('taskActive', { value: String(count) }))
      : t(cup === 'on' ? 'cupOn' : cup === 'off' ? 'cupOff' : cup === 'blowing' ? 'cupBlow' : 'noReading')
  return <section aria-label={title}>
    <details className={css.row} name={group}>
      <summary className={css.rowSummary}>
        <span className={css.rowTitle}>{title}</span>
        <span className={css.rowState}><strong className={css.axisValue}>{value}</strong>
          <IconChevronDownOutlineRegular className={css.chevron} size={14} />
        </span>
      </summary>
      {id === 'lift' && travel !== undefined && <meter className={css.axisMeter} min={0} max={1} value={travel} aria-label={t('liftHeight')} />}
      {id === 'arm' && state?.taskStage && <p className={css.axisNote}>{state.taskStage}</p>}
      {id === 'suction' && <p className={css.axisNote}>{t('cupNoSensor')}</p>}
      {children}
    </details>
  </section>
}
