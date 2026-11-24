/** Device discovery dashboard for inspecting capability snapshots. */
import { useEffect, useId, useState } from 'react'
import {
  Button, IconChevronDownOutlineRegular, IconClockOutlineRegular, IconGaugeOutlineRegular, IconGlobeOutlineRegular,
  IconInfoOutlineRegular, IconInspectOutlineRegular, IconLayersOutlineRegular, IconSettingsOutlineRegular, IconSlidersTwoOutlineRegular,
  IconPluginPinwheelOutlineRegular, IconRefreshOutlineRegular, IconSearchOutlineRegular, Input,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { StudioKey } from './locales.ts'
import { readLiftFeedback } from './lift-feedback.ts'
import { ConnectionBadge, serviceHealth, useOperatorState } from './connection.tsx'
import type { MotionPort, MotionState } from './motion.ts'
import { ActuatorCard } from './ActuatorCard.tsx'
import { CameraRow } from './CameraRow.tsx'
import { SpatialRow } from './SpatialRow.tsx'
import { RobotTwin } from './RobotTwin.tsx'
import type { RobotSnapshot, SelfController } from './self.ts'
import css from './self.module.css'

/** Inventory state and the single read-only refresh action supplied by the plugin. */
export interface SelfFace { motion: MotionPort; hooks: { self: SelfController['state'] }; refresh: () => Promise<void>; sample: () => Promise<void> }
/** Localized main-panel props. */
export type SelfPageProps = PropsLocale<'robotStudio'> & InjectFace<SelfFace>

type Translate = SelfPageProps['t']
type Capability = Extract<RobotSnapshot, { kind: 'available' }>['capabilities'][number]
type Status = Capability['status']['kind']

const statuses = ['ready', 'degraded', 'unavailable'] as const satisfies readonly Status[]
const statusLabels: Record<Status, StudioKey> = {
  ready: 'ready',
  degraded: 'limited',
  unavailable: 'unavailable',
}
const categoryIcons = {
  actuator: IconSlidersTwoOutlineRegular,
  mobility: IconGlobeOutlineRegular,
  sensor: IconGaugeOutlineRegular,
  perception: IconInspectOutlineRegular,
  system: IconSettingsOutlineRegular,
} satisfies Record<Capability['category'], typeof IconLayersOutlineRegular>

function CapabilityRow({ capability, group, model, t }: { capability: Capability; group: string; model: boolean; t: Translate }) {
  const { status, operations, evidence } = capability
  const axis = model && (['arm', 'lift', 'suction'] as const).find(id => id === capability.id)
  const detail = (
    <div className={css.detail}>
      <p className={css.secondary}>{capability.description}</p>
      {status.kind !== 'ready' && <p className={css.statusReason} data-status={status.kind}>{status.message}</p>}
      <div className={css.operations}>
        <h5>{t('callable')}</h5>
        {operations.length === 0 ? <p className={css.secondary}>{t('noAdapter')}</p> : <ul>
          {operations.map(operation => <li key={operation.id}>
            <div className={css.operationIdentity}>
              <span>{operation.name}</span>
              <code>{operation.id}</code>
            </div>
            <span className={css.mode} data-mode={operation.mode}>{t(operation.mode === 'observe' ? 'observe' : 'act')}</span>
          </li>)}
        </ul>}
      </div>
      {evidence !== undefined && <details className={css.evidence}>
        <summary>{t('deviceEvidence')}<IconChevronDownOutlineRegular className={css.chevron} size={14} /></summary>
        <pre tabIndex={0}>{JSON.stringify(evidence, null, 2)}</pre>
      </details>}
    </div>
  )
  if (axis) return <ActuatorCard id={axis} group={group} t={t}>{detail}</ActuatorCard>
  if (model && capability.id === 'camera') return <CameraRow title={capability.name} group={group} t={t}>{detail}</CameraRow>
  if (model && (capability.id === 'spatial' || capability.id === 'navigation')) {
    return <SpatialRow kind={capability.id === 'spatial' ? 'scan' : 'odom'} title={capability.name} group={group} t={t}>{detail}</SpatialRow>
  }
  return (
    <details name={group} className={css.row}>
      <summary className={css.rowSummary}>
        <span className={css.rowTitle}>{capability.name}</span>
        <span className={css.rowState}>
          <span className={css.badge} data-status={status.kind}>{t(statusLabels[status.kind])}</span>
          <IconChevronDownOutlineRegular className={css.chevron} size={14} />
        </span>
      </summary>
      {detail}
    </details>
  )
}

type DeviceProps = { motion: MotionPort; robot: RobotSnapshot; interrupted: boolean; t: Translate }

function DeviceCapabilities({ robot, interrupted, motion, state, t }: DeviceProps & { state: MotionState | undefined }) {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [query, setQuery] = useState('')
  const listId = useId()
  const hasModel = robot.provider.id === 'g1d'
  const capabilities = robot.kind === 'available' ? robot.capabilities : []
  const counts = { ready: 0, degraded: 0, unavailable: 0 }
  for (const capability of capabilities) counts[capability.status.kind]++
  const search = query.trim().toLowerCase()
  const visible = capabilities.filter((capability) => {
    if (filter !== 'all' && filter !== capability.status.kind) return false
    if (!search) return true
    const alias = hasModel && (capability.id === 'arm' ? t('armAxis') : capability.id === 'lift' ? t('liftAxis') : capability.id === 'suction' ? t('cupAxis') : '')
    return (alias && alias.toLowerCase().includes(search)) || capability.name.toLowerCase().includes(search)
      || capability.operations.some(operation => [operation.id, operation.name].some(value => value.toLowerCase().includes(search)))
  })

  const inventory = <section className={css.inventory} aria-labelledby={listId + '-title'}>
    <div className={css.capabilityToolbar}>
      <h3 id={listId + '-title'}><IconLayersOutlineRegular size={19} />{t('capabilities')}</h3>
      <span className={css.resultCount}>{t('matchedCapabilities', { value: String(visible.length) })}</span>
      {capabilities.length > 0 && <Input
        className={css.search ?? ''} icon={<IconSearchOutlineRegular />}
        type="search" value={query} placeholder={t('searchCapabilities')} aria-label={t('searchCapabilities')}
        aria-controls={listId} onChange={(event) => { setQuery(event.currentTarget.value) }}
      />}
    </div>
    <div id={listId} className={css.capabilities}>
      {visible.length === 0
        ? <p className={css.empty} role="status">{t(capabilities.length === 0 ? 'noCapabilities' : 'noMatchingCapabilities')}</p>
        : (Object.keys(categoryIcons) as Capability['category'][]).map((category) => {
          const rows = visible.filter(capability => capability.category === category)
          if (rows.length === 0) return null
          const Icon = categoryIcons[category]
          return <div key={category} className={css.capabilityGroup}>
            <h4 className={css.groupTitle}>
              <Icon size={15} /><span>{t(hasModel && category === 'actuator' ? 'actuatorDeck' : category)}</span><span className={css.groupCount}>{rows.length}</span>
            </h4>
            {rows.map(capability => <CapabilityRow key={capability.id} capability={capability} group={listId} model={hasModel} t={t} />)}
          </div>
        })}
    </div>
  </section>
  return (
    <div className={hasModel ? css.robotWorkspace : undefined}>
      <div className={css.overview}>
        <div className={css.metrics} role="group" aria-label={t('filterCapabilities')}>
          {(['all', ...statuses] as const).map((status) => {
            const label = t(status === 'all' ? 'allCapabilities' : statusLabels[status])
            const count = status === 'all' ? capabilities.length : counts[status]
            return <button
              key={status} type="button" className={css.metric} data-status={status} aria-label={`${label} ${count}`}
              aria-pressed={filter === status} aria-controls={listId} onClick={() => { setFilter(status) }}
            >
              <span className={css.metricLabel}>{label}</span>
              <span className={css.count}>{count}</span>
            </button>
          })}
        </div>
        {capabilities.length > 0 && <div className={css.distribution} aria-hidden="true">
          {statuses.filter(status => counts[status] > 0).map(status => (
            <span key={status} data-status={status} style={{ flexGrow: counts[status] }} />
          ))}
        </div>}
      </div>
      {hasModel ? (
        <RobotTwin state={state} motion={motion} lift={interrupted ? null : readLiftFeedback(robot)} t={t}>{inventory}</RobotTwin>
      ) : inventory}

    </div>
  )
}

function Device({ robot, interrupted, motion, t }: DeviceProps) {
  const titleId = useId()
  const g1d = robot.provider.id === 'g1d'
  const state = useOperatorState(g1d ? motion : null)
  const services = Object.values(serviceHealth(state))
  const online = services.filter(Boolean).length
  const reachable = (robot.kind === 'available' && !interrupted) || online > 0
  return (
    <section className={css.device} aria-labelledby={titleId}>
      <header className={css.deviceHeader}>
        <div className={css.deviceIcon}><IconPluginPinwheelOutlineRegular size={28} /></div>
        <div className={css.deviceIdentity}>
          <h2 id={titleId}>{robot.provider.name}</h2>
          {robot.provider.description && <p className={css.secondary}>{robot.provider.description}</p>}
        </div>
        {g1d && <div className={css.robotConnection}>
          <div><span>{t('robotConnection')}</span><ConnectionBadge online={reachable || (state === undefined ? undefined : false)} robot t={t} /></div>
          <small>{state === undefined ? t('serviceChecking') : t('motionOnlineCount', { value: String(online), total: String(services.length) })}</small>
        </div>}
      </header>
      {robot.kind === 'failed' && <div className={css.failure} role="alert">
        <h3>{t('connectionFailed')}</h3>
        <p>{t('connectionRecovery')}</p>
        <p className={css.secondary}><code>{robot.error.code}</code> · {robot.error.message}</p>
      </div>}
      {(robot.kind === 'available' || robot.provider.id === 'g1d') && <DeviceCapabilities state={state} motion={motion} robot={robot} interrupted={interrupted} t={t} />}
    </section>
  )
}

/**
 * Show connected devices, status filters, callable operations, and discovery evidence.
 * @param props - Slot-provided state and locale.
 * @returns Robot discovery dashboard.
 */
export function SelfPage(props: SelfPageProps) {
  const { t, sample } = props
  const titleId = useId()
  const { busy, error, inventory, receivedAt, liveInterrupted } = props.useSelf(value => value)
  const followsModel = inventory?.providers.some(robot => robot.provider.id === 'g1d') === true
  useEffect(() => {
    if (!followsModel) return
    let active = true
    let running = false
    let timer: number | undefined
    const schedule = () => {
      if (!active || running || timer !== undefined || document.hidden) return
      timer = window.setTimeout(() => {
        timer = undefined
        running = true
        void sample().finally(() => { running = false; schedule() })
      }, 2000)
    }
    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer)
        timer = undefined
      } else schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [followsModel, sample])
  return (
    <main className={css.page} aria-labelledby={titleId}>
      <div className={css.content}>
        <header className={css.pageHeader}>
          <div>
            <h1 id={titleId}>{t('selfTitle')}</h1>
            {receivedAt && <div className={css.timestamp}>
              <IconClockOutlineRegular size={14} />
              <span>{t('lastScan')} <time dateTime={receivedAt}>
                {new Date(receivedAt).toLocaleString(t('dateLocale'), { dateStyle: 'medium', timeStyle: 'short' })}
              </time></span>
            </div>}
          </div>
          <Button variant="primary" disabled={busy} icon={<IconRefreshOutlineRegular />} onClick={() => { void props.refresh() }}>
            {t('rescan')}
          </Button>
        </header>

        <details className={css.statusHelp}>
          <summary><IconInfoOutlineRegular size={14} />{t('statusHelp')}
            <IconChevronDownOutlineRegular className={css.chevron} size={14} />
          </summary>
          <dl>
            {statuses.map(status => <div key={status}>
              <dt className={css.badge} data-status={status}>{t(statusLabels[status])}</dt>
              <dd>{t(status === 'ready' ? 'readyHelp' : status === 'degraded' ? 'limitedHelp' : 'unavailableHelp')}</dd>
            </div>)}
          </dl>
          <p>{t('snapshotNotice')}</p>
        </details>

        <div className={css.devices}>
          {busy && <p className={css.empty} role="status">{t('scanning')}</p>}
          {error && <div className={css.failure} role="alert"><p>{t('selfError')}</p><pre>{error}</pre></div>}
          {inventory?.providers.length === 0 && <p className={css.empty}>{t('noRobot')}</p>}
          {inventory?.providers.map(robot => (
            <Device key={robot.provider.id} robot={robot} motion={props.motion} interrupted={liveInterrupted} t={t} />
          ))}
        </div>

        <details className={css.guide}>
          <summary>{t('agentEntry')}<IconChevronDownOutlineRegular className={css.chevron} size={14} /></summary>
          <div className={css.guideBody}><p>{t('agentInstructions')}</p><p>{t('discoveryScope')}</p></div>
        </details>
      </div>
    </main>
  )
}
