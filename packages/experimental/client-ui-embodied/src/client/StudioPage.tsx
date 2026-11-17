/** Beginner workbench rendering committed project state and revision-bound sample evidence. */
import { useState } from 'react'
import { Button, Input, IconPluginPinwheelOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { StudioController } from './controller.ts'
import type { StudioKey } from './locales.ts'
import css from './studio.module.css'

export interface StudioFace { hooks: { studio: StudioController['state'] }; command: (command: Record<string, unknown>) => Promise<void> }
export type StudioPageProps = PropsLocale<'robotStudio'> & InjectFace<StudioFace>

/** Render the workbench with template selection, project resumption and evidence inspection. */
export function StudioPage(props: StudioPageProps) {
  const { t } = props
  const state = props.useStudio(value => value)
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [template, setTemplate] = useState('')
  const [target, setTarget] = useState('')
  const [query, setQuery] = useState('')
  const project = state.project
  const current = project?.revisions.at(-1)
  const status = state.status
  const selectedTemplate = state.catalog.templates.find(item => item.id === template) ?? state.catalog.templates[0]
  const selectedTarget = state.catalog.targets.find(item => item.id === target) ?? state.catalog.targets[0]
  const definition = state.catalog.templates.find(item => item.id === current?.template)
  const currentTarget = state.catalog.targets.find(item => item.id === current?.target)
  const labels: Record<string, StudioKey> = { vision: 'vision', 'spatial-memory': 'memory', 'sample-full': 'full', 'sample-camera': 'camera', 'image.read': 'image', 'objects.read': 'detect', 'memory.record': 'record', 'memory.search': 'search', report: 'report' }
  const label = (id: string, fallback: string): string => { const key = labels[id]; return key === undefined ? fallback : t(key) }
  return <main className={css.page}>
    <header><h1>{t('title')}</h1><p>{t('intro')}</p><p>{t('sampleOnly')}</p></header>
    <div className={css.columns}>
      <section className={css.section}>
        <h2>{t('create')}</h2>
        <label>{t('name')}<Input value={title} maxLength={2000} onChange={(event) => { setTitle(event.target.value) }} /></label>
        <label>{t('goal')}<Input value={goal} maxLength={2000} onChange={(event) => { setGoal(event.target.value) }} /></label>
        <fieldset><legend>{t('template')}</legend><div className={css.actions}>
          {state.catalog.templates.map(item => <Button key={item.id}
            aria-pressed={selectedTemplate?.id === item.id} onClick={() => { setTemplate(item.id) }}>
            {label(item.id, item.title)}
          </Button>)}
        </div></fieldset>
        <fieldset><legend>{t('target')}</legend><div className={css.actions}>
          {state.catalog.targets.map(item => <Button key={item.id}
            aria-pressed={selectedTarget?.id === item.id} onClick={() => { setTarget(item.id) }}>
            {label(item.id, item.title)}
          </Button>)}
        </div></fieldset>
        <Button variant="primary" disabled={state.busy || !title.trim() || !goal.trim() || !selectedTemplate || !selectedTarget} onClick={() => { void props.command({ action: 'create', title, goal, template: selectedTemplate?.id, target: selectedTarget?.id }) }}>{t('create')}</Button>
        <Button disabled={state.busy} onClick={() => { void props.command({ action: 'list' }) }}>{t('refresh')}</Button>
        {state.projects.length === 0 && <p>{t('empty')}</p>}
        <ul>{state.projects.map(item => <li key={item.id}><Button disabled={state.busy} onClick={() => { void props.command({ action: 'read', id: item.id }) }}>{item.current.title}</Button></li>)}</ul>
      </section>
      <section className={css.section}>
        <h2>{t('selected')}</h2>
        {state.busy && <p role="status">{t('busy')}</p>}
        {state.error !== null && <div role="alert"><p>{t('error')}</p><pre>{state.error}</pre></div>}
        {project !== null && current !== undefined && <>
          <h3>{current.title}</h3><p>{current.goal}</p>
          <p>{t('revision')} {current.revision} · {t(status === 'sample-passed' ? 'passed' : status === 'blocked' ? 'blocked' : 'stale')}</p>
          <p>{label(current.target, currentTarget?.title ?? current.target)}</p>
          <h3>{t('workflow')}</h3>
          <ol>{definition?.steps.map(step => <li key={step}>{label(step, step)}</li>)}</ol>
          <label>{t('query')}<Input value={query} onChange={(event) => { setQuery(event.target.value) }} /></label>
          <div className={css.actions}>
            <Button variant="primary" disabled={state.busy || !query.trim()} onClick={() => { void props.command({ action: 'run', id: project.id, expectedRevision: current.revision, query }) }}>{t('run')}</Button>
            <Button disabled={state.busy || !selectedTarget} onClick={() => { void props.command({ action: 'revise', id: project.id, expectedRevision: current.revision, title: current.title, goal: current.goal, target: selectedTarget?.id }) }}>{t('change')}</Button>
            <Button disabled={state.busy} onClick={() => { void props.command({ action: 'export', id: project.id }) }}>{t('export')}</Button>
          </div>
          <h3>{t('evidence')}</h3>
          {project.runs.toReversed().map(run => <article key={run.id}>
            <p>{t(run.revision === current.revision ? (run.status === 'passed' ? 'passed' : 'blocked') : 'old')} · {t('revision')} {run.revision} · {run.createdAt}</p>
            <p>{run.query}</p>
            <ul>{run.checks.map(check => <li key={check.name}>{check.detail}</li>)}</ul>
            {run.observations.map(item => <div key={item.image}><p>{item.label}</p><p>{t('historical')} · {item.capturedAt} · {item.mapSession}</p><p>{item.observerPosition === null ? t('noPosition') : `${t('position')}: ${item.observerPosition.x}, ${item.observerPosition.y} (${item.observerPosition.frame})`}</p></div>)}
          </article>)}
        </>}
        {state.exported !== null && <><p>{t('copy')}</p><pre tabIndex={0}>{state.exported}</pre></>}
      </section>
    </div>
    <footer><p>{t('limitations')}</p><p>{t('hardware')}</p></footer>
  </main>
}

/** Render the existing sidebar glyph at its owner-provided size. */
export function StudioIcon({ size }: PropsRuntime<'sidebar.panellist'>) { return <IconPluginPinwheelOutlineRegular size={size} /> }
