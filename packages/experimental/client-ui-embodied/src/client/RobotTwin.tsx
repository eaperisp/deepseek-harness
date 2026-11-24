/** G1-D operator controls and measured motion. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConnectionBadge, serviceHealth } from './connection.tsx'
import { ActuatorContext } from './ActuatorCard.tsx'
import { Button, IconRefreshOutlineRegular, IconSlidersTwoOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { LiftFeedback } from './lift-feedback.ts'
import type { MotionAction, MotionPort, MotionState } from './motion.ts'
import type { StudioKey } from './locales.ts'
import type { RobotScene } from './robot-scene.ts'
import css from './self.module.css'

const groups = [
  ['chassis', ['forward', 'backward', 'turnLeft', 'turnRight']],
  ['column', ['raise', 'lower']],
  ['rightArm', ['rest', 'grasp']],
  ['cupAxis', ['suck', 'release']],
  ['stopControls', ['stop', 'armStop']],
] as const satisfies readonly (readonly [StudioKey, readonly MotionAction[]])[]

/**
 * Render the installed model and set its lift from validated measurements.
 * @param props - Localized labels and current calibrated feedback.
 * @returns The viewport and its live-data status.
 */
export function RobotTwin({ lift, motion, state, t, children }: { motion: MotionPort; state: MotionState | undefined; lift: LiftFeedback | null; children?: ReactNode } & PropsLocale<'robotStudio'>) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<RobotScene>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const services = serviceHealth(state)
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const claimed = useRef('')
  const liveLift = state ? state.lift && { heightMeters: state.lift.height, extensionMeters: state.lift.height - state.lift.min } : lift
  const extension = liveLift?.extensionMeters
  useEffect(() => {
    const element = canvas.current
    if (element === null) return
    const lifetime = new AbortController()
    const load = async () => {
      try {
        const { mountRobotScene } = await import('./robot-scene.ts')
        const mounted = await mountRobotScene(element, lifetime.signal)
        if (lifetime.signal.aborted) { mounted.dispose(); return }
        scene.current = mounted
        setPhase('ready')
      } catch {
        if (!lifetime.signal.aborted) setPhase('failed')
      }
    }
    void load()
    return () => {
      lifetime.abort()
      scene.current?.dispose()
      scene.current = undefined
    }
  }, [attempt])
  useEffect(() => {
    if (phase === 'ready' && state) scene.current?.setPose(state)
  }, [phase, state])
  useEffect(() => {
    if (phase === 'ready' && extension !== undefined) scene.current?.setExtension(extension)
  }, [phase, extension])
  async function submit(action: MotionAction) {
    if (!state || !state.actions.includes(action) || claimed.current === state.ticket) return
    claimed.current = state.ticket
    setSending(true)
    setError('')
    try { await motion.submit(action, action === 'grasp' ? target.trim() : '', state.ticket) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('controlUnavailable')) }
    finally { setSending(false) }
  }
  const formattedHeight = (value: number) => t('heightCm', { value: (value * 100).toFixed(1) })
  function buttonLabel(action: MotionAction) {
    if (action !== 'raise' && action !== 'lower') return t(action)
    const step = action === 'raise' ? state?.lift?.raiseStep : state?.lift?.lowerStep
    if (step === 0) return t(action === 'raise' ? 'atUpperLimit' : 'atLowerLimit')
    if (step !== undefined && step < .1 - Number.EPSILON) return t(action === 'raise' ? 'raiseToLimit' : 'lowerToLimit')
    return t(action)
  }
  const targetInput = <label className={css.targetLabel}>{t('pickTarget')}
    <input value={target} maxLength={80} onChange={(event) => { setTarget(event.target.value) }} />
  </label>
  const buttons = (actions: readonly MotionAction[]) => <div className={css.motionButtons}>
    {actions.map(action => <button key={action} type="button" data-stop={action === 'armStop' || action === 'stop'}
      disabled={sending || !state?.actions.includes(action) || claimed.current === state.ticket || (action === 'grasp' && !target.trim())}
      onClick={() => { void submit(action) }}>{buttonLabel(action)}</button>)}
  </div>
  const range = state ? state.lift && state.lift.max - state.lift.min : lift?.maxExtensionMeters
  return <><section className={css.motion} aria-label={t('motionControl')}>
    <header className={css.motionHeader}>
      <span className={css.motionIcon} aria-hidden="true"><IconSlidersTwoOutlineRegular size={20} /></span>
      <div><h3>{t('motionControl')}</h3><p>{t(state === undefined ? 'serviceChecking' : Object.values(services).some(Boolean) ? 'controlScope' : 'controlUnavailable')}</p></div>
    </header>
    {groups.map(([group, actions]) => <fieldset key={group} data-group={group} aria-label={t(group)}>
      <legend><span className={css.serviceHeading}><span>{t(group)}</span>{group !== 'stopControls' &&
        <ConnectionBadge online={state === undefined ? undefined : services[group]} t={t} />}</span></legend>
      {group === 'rightArm' && targetInput}
      {buttons(actions)}
    </fieldset>)}
    {error && <p role="alert">{t('commandUnknown')} {error}</p>}
    {state?.receipt && <div className={css.receipt} role="status" data-outcome={state.receipt.status}>
      <strong>{t(state.receipt.action === 'raise' ? 'liftRaised' : state.receipt.action === 'lower' ? 'liftLowered' : state.receipt.action)}</strong>
      <span>{t(state.receipt.status)}</span>
      {state.receipt.detail && <p>{state.receipt.detail}</p>}
    </div>}
  </section><section className={css.twin} aria-label={t('robotModel')}>
    <header className={css.twinHeader}>
      <h3>{t('robotModel')}</h3>
      {phase === 'ready' && <Button size="sm" variant="outline" onClick={() => { scene.current?.reset() }}>{t('resetView')}</Button>}
    </header>
    <div className={css.viewport}>
      <canvas ref={canvas} className={css.canvas} aria-hidden="true" />
      {phase === 'ready' && <span className={css.viewMode}>{t(state?.base && state.joints ? 'measuredPose' : 'feedbackMode')}</span>}
      {phase === 'loading' && <p className={css.modelMessage} role="status">{t('modelLoading')}</p>}
      {phase === 'failed' && <div className={css.modelMessage}>
        <p>{t('modelUnavailable')}</p>
        <Button size="sm" icon={<IconRefreshOutlineRegular />} onClick={() => { setPhase('loading'); setAttempt(value => value + 1) }}>{t('retryModel')}</Button>
      </div>}
    </div>
    <footer className={css.twinFooter}>
      <span>{t('liftHeight')}</span>
      {liveLift === null ? <span className={css.feedbackUnavailable}>{t('liftUnavailable')}</span> : <strong className={css.liftValue}>
        {formattedHeight(liveLift.heightMeters)}
      </strong>}
    </footer>
  </section><ActuatorContext.Provider value={{ state: state ?? null, height: liveLift?.heightMeters,
    travel: range && range > 0 && extension !== undefined ? extension / range : undefined }}>{children}</ActuatorContext.Provider></>
}
