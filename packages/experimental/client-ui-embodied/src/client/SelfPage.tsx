/** Device-first workbench showing verified operations and unsupported capabilities. */
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SelfController } from './self.ts'
import css from './studio.module.css'

/** Inventory state and the single read-only refresh action supplied by the plugin. */
export interface SelfFace { hooks: { self: SelfController['state'] }; refresh: () => Promise<void> }
/** Localized main-panel props. */
export type SelfPageProps = PropsLocale<'robotStudio'> & InjectFace<SelfFace>
/**
 * Show the connected robot, evidence, callable operations and capability gaps.
 * @param props - Slot-provided state and locale.
 * @returns Robot self-inspection page.
 */
export function SelfPage(props: SelfPageProps) {
  const { t } = props
  const state = props.useSelf(value => value)
  return <main className={css.page}>
    <header className={css.selfHeader}><div><h1>{t('selfTitle')}</h1><p>{t('selfIntro')}</p></div><Button disabled={state.busy} onClick={() => { void props.refresh() }}>{t(state.busy ? 'scanning' : 'rescan')}</Button></header>
    <section className={css.callout}><h2>{t('agentEntry')}</h2><p>{t('agentInstructions')}</p><p>{t('discoveryScope')}</p></section>
    {state.busy && <p role="status">{t('scanning')}</p>}
    {state.error && <div role="alert"><p>{t('selfError')}</p><pre>{state.error}</pre></div>}
    {state.receivedAt && <p className={css.secondary}>{t('lastScan')} {state.receivedAt} · {t('snapshotNotice')}</p>}
    {state.inventory?.providers.length === 0 && <p>{t('noRobot')}</p>}
    {state.inventory?.providers.map(provider => <section key={provider.provider.id} className={css.robot}>
      <h2>{provider.provider.name}</h2><p className={css.secondary}>{provider.provider.description}</p>
      {provider.kind === 'failed' ? <div role="alert"><p>{t('connectionFailed')}</p><p>{provider.error.code}: {provider.error.message}</p><p>{t('connectionRecovery')}</p></div> : <div className={css.capabilities}>
        {provider.capabilities.map(capability => <article key={capability.id} className={css.capability}>
          <div className={css.capabilityHeading}><h3>{capability.name}</h3><span>{t(capability.status.kind === 'ready' ? 'readable' : capability.status.kind === 'degraded' ? 'limited' : 'unavailable')}</span></div>
          <p>{capability.description}</p>
          {capability.status.kind !== 'ready' && <p>{capability.status.message}</p>}
          <h4>{t('callable')}</h4>
          {capability.operations.length === 0 ? <p>{t('noAdapter')}</p> : <ul>{capability.operations.map(operation => <li key={operation.id}><code>{operation.id}</code> · {operation.name} · {t(operation.mode === 'observe' ? 'observe' : 'act')}</li>)}</ul>}
          {capability.evidence !== undefined && <details><summary>{t('deviceEvidence')}</summary><pre>{JSON.stringify(capability.evidence, null, 2)}</pre></details>}
        </article>)}
      </div>}
    </section>)}
  </main>
}
