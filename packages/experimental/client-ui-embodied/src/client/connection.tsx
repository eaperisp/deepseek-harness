/** Connection indicators derived from the operator's live telemetry. */
import { useEffect, useState } from 'react'
import type { MotionPort, MotionState } from './motion.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './self.module.css'

/** Poll the active robot once for both the header and the motion panel.
 * @param motion - Read-only state transport, or null for other providers.
 * @returns The latest operator snapshot, or undefined before the initial read.
 */
export function useOperatorState(motion: MotionPort | null) {
  const [state, setState] = useState<MotionState | undefined>(undefined)
  useEffect(() => {
    if (!motion) return
    const port = motion
    let mounted = true
    let reading = false
    let timer: number | undefined
    let expiry: number | undefined
    const visibleAndMounted = () => mounted && !document.hidden
    async function poll() {
      if (reading || !visibleAndMounted()) return
      reading = true
      let delay = 2000
      let expired = false
      expiry = window.setTimeout(() => {
        expired = true
        if (visibleAndMounted()) setState(null)
      }, 3000)
      try {
        const value = await port.read()
        if (value) delay = 350
        if (!expired && visibleAndMounted()) setState(value)
      } catch {
        if (visibleAndMounted()) setState(null)
      } finally {
        window.clearTimeout(expiry)
        reading = false
        if (visibleAndMounted()) timer = window.setTimeout(() => { void poll() }, delay)
      }
    }
    const visible = () => {
      window.clearTimeout(timer)
      if (document.hidden) setState(null)
      else void poll()
    }
    void poll()
    document.addEventListener('visibilitychange', visible)
    return () => { mounted = false; window.clearTimeout(expiry); window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }, [motion])
  return state
}

/** Determine the health of the four motion services from fresh device feedback.
 * @param state - Operator feedback with stale measurements already invalidated.
 * @returns Per-service availability, independent of movement limits or in-flight commands.
 */
export function serviceHealth(state: MotionState | undefined) {
  return {
    chassis: state?.base != null,
    column: state?.lift != null,
    rightArm: state?.taskCount != null && Object.keys(state.joints ?? {}).filter(key => key.startsWith('right_')).length === 7,
    cupAxis: state?.suction != null,
  }
}

/** Render a labeled connection dot.
 * @param props - Connection state and whether the label describes the entire robot.
 * @returns A textual status with a color cue.
 */
export function ConnectionBadge({ online, robot, t }: PropsLocale<'robotStudio'> & { online: boolean | undefined; robot?: boolean }) {
  return <span className={css.connectionBadge} data-state={online === undefined ? 'pending' : online ? 'online' : 'offline'}>
    {t(online === undefined ? 'serviceChecking' : online ? (robot ? 'robotConnected' : 'serviceOnline') : 'serviceOffline')}
  </span>
}
