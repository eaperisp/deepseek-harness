import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { ProjectCatalog } from '../src/catalog.ts'
import { exportSchema, listSchema, projectSchema, viewSchema, type Project } from '../src/model.ts'
import { ProjectStore } from '../src/store.ts'
import type { ProjectTemplate } from '../src/types.ts'

const roots: string[] = []
const parseView = (raw: string) => viewSchema.parse(JSON.parse(raw))
const parseList = (raw: string) => listSchema.parse(JSON.parse(raw))
const parseExport = (raw: string) => exportSchema.parse(JSON.parse(raw))
const signal = new AbortController().signal
const evidence = { mode: 'sample', status: 'passed', checks: [{ name: 'fixture', passed: true, detail: 'Fixture only' }], observations: [] } as const
const template = (): ProjectTemplate => ({
  id: 'example', title: 'Example', version: '1', description: 'Fixture',
  required: ['image.read'], optional: ['pose.read'], steps: ['image.read'], limitations: ['Sample'],
  run: async () => ({ ...evidence, checks: [...evidence.checks], observations: [] }),
})
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function setup(limits: { maxProjects?: number; maxHistory?: number; maxDocumentBytes?: number } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'embodied-project-'))
  roots.push(root)
  const catalog = new ProjectCatalog()
  const unregister = catalog.registerTemplate(template())
  catalog.registerTarget({ id: 'camera', version: '1', title: 'Camera', mode: 'sample', capabilities: ['image.read'] })
  const config = { root, maxProjects: 10, maxHistory: 20, maxDocumentBytes: 20_000, ...limits }
  const store = new ProjectStore(config, catalog)
  const execute = (command: object) => store.execute(JSON.stringify(command), signal)
  const create = async (): Promise<Project> => projectSchema.parse(parseView(await execute({ action: 'create', title: 'Find objects', goal: 'Inspect sample', template: 'example', target: 'camera' })).project)
  return { root, catalog, unregister, store, config, execute, create }
}

it('persists revision-bound runs, resumes after restart and exports the committed document', async () => {
  const { store, config, catalog, create, execute } = await setup()
  const project = await create()
  expect(parseView(await execute({ action: 'read', id: project.id })).status).toBe('needs-validation')
  const result = parseView(await execute({ action: 'run', id: project.id, expectedRevision: 1, query: 'cup' }))
  expect(result.status).toBe('sample-passed')
  expect(result.project.runs[0]).toMatchObject({ revision: 1, query: 'cup', mode: 'sample' })
  const restarted = new ProjectStore(config, catalog)
  expect(await restarted.execute(JSON.stringify({ action: 'read', id: project.id }), signal)).toBe(await store.execute(JSON.stringify({ action: 'read', id: project.id }), signal))
  const exported = parseExport(await execute({ action: 'export', id: project.id }))
  expect(projectSchema.parse(JSON.parse(exported.content))).toEqual(result.project)
  await execute({ action: 'revise', id: project.id, expectedRevision: 1, title: 'Revised', goal: 'Check again', target: 'camera' })
  const revised = parseView(await execute({ action: 'read', id: project.id }))
  expect(revised.status).toBe('needs-validation')
  expect(revised.project.runs).toEqual(result.project.runs)
})

it('serializes conflicting edits across independent store owners', async () => {
  const { config, catalog, create, execute } = await setup()
  const project = await create()
  const command = { action: 'revise', id: project.id, expectedRevision: 1, title: 'Next', goal: 'Next', target: 'camera' }
  const other = new ProjectStore(config, catalog)
  const results = await Promise.allSettled([execute(command), other.execute(JSON.stringify(command), signal)])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toMatchObject([{ reason: { code: 'REVISION_CONFLICT' } }])
})

it('invalidates evidence in both list and read when a provider changes, and requires a new revision', async () => {
  const { unregister, catalog, create, execute } = await setup()
  const project = await create()
  await execute({ action: 'run', id: project.id, expectedRevision: 1, query: 'cup' })
  await unregister()
  catalog.registerTemplate({ ...template(), version: '2' })
  expect(parseList(await execute({ action: 'list' })).projects[0]?.status).toBe('needs-validation')
  expect(parseView(await execute({ action: 'read', id: project.id })).status).toBe('needs-validation')
  await expect(execute({ action: 'run', id: project.id, expectedRevision: 1, query: 'cup' })).rejects.toMatchObject({ code: 'DEPENDENCY_CHANGED' })
  await execute({ action: 'revise', id: project.id, expectedRevision: 1, title: 'Updated', goal: 'Check new provider', target: 'camera' })
  expect(parseView(await execute({ action: 'run', id: project.id, expectedRevision: 2, query: 'cup' })).status).toBe('sample-passed')
})

it('rejects missing capabilities before invoking a template and exposes optional degradation', async () => {
  const { catalog, create, execute } = await setup()
  catalog.registerTarget({ id: 'empty', version: '1', title: 'Empty', mode: 'sample', capabilities: [] })
  const project = await create()
  expect(catalog.match('example', 'camera')).toMatchObject({ compatible: true, optional: [{ id: 'pose.read', available: false }] })
  await execute({ action: 'revise', id: project.id, expectedRevision: 1, title: 'Empty', goal: 'Check', target: 'empty' })
  await expect(execute({ action: 'run', id: project.id, expectedRevision: 2, query: 'cup' })).rejects.toMatchObject({ code: 'CAPABILITY_MISSING' })
  expect(parseView(await execute({ action: 'read', id: project.id })).project.runs).toEqual([])
})

it('leaves a corrupted document untouched and rejects paths and unknown format versions', async () => {
  const { root, create, execute } = await setup()
  const project = await create()
  await expect(execute({ action: 'read', id: '../outside' })).rejects.toThrow()
  const path = join(root, project.id + '.json')
  const raw = JSON.stringify({ ...project, formatVersion: 99 })
  await writeFile(path, raw)
  await expect(execute({ action: 'read', id: project.id })).rejects.toThrow()
  expect(await readFile(path, 'utf8')).toBe(raw)
  await writeFile(path, JSON.stringify({ ...project, id: randomUUID() }))
  await expect(execute({ action: 'read', id: project.id })).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' })
})

it('enforces project and history limits and admits no pre-cancelled command', async () => {
  const { store, create, execute } = await setup({ maxProjects: 1, maxHistory: 1 })
  const project = await create()
  await expect(create()).rejects.toMatchObject({ code: 'PROJECT_LIMIT' })
  await expect(execute({ action: 'run', id: project.id, expectedRevision: 1, query: 'cup' })).rejects.toMatchObject({ code: 'HISTORY_LIMIT' })
  await expect(store.execute('{"action":"list"}', AbortSignal.abort(new Error('cancelled')))).rejects.toThrow('cancelled')
  await expect(store.execute('x'.repeat(20_001), signal)).rejects.toMatchObject({ code: 'INPUT_LIMIT' })
})

it('rejects inconsistent evidence in persisted documents', async () => {
  const { create } = await setup()
  const project = await create()
  const run = { ...evidence, id: randomUUID(), revision: 1, createdAt: new Date().toISOString(), query: 'cup' }
  expect(projectSchema.safeParse({ ...project, runs: [{ ...run, checks: [] }] }).success).toBe(false)
  expect(projectSchema.safeParse({ ...project, runs: [{ ...run, revision: 2 }] }).success).toBe(false)
  expect(projectSchema.safeParse({ ...project, runs: [run, run] }).success).toBe(false)
  expect(projectSchema.safeParse({ ...project, revisions: [{ ...project.revisions[0], revision: 2 }] }).success).toBe(false)
})

it('cancels and joins a running provider before unregister completes', async () => {
  const { catalog, unregister, create, execute } = await setup()
  await unregister()
  const entered = Promise.withResolvers<undefined>()
  const aborted = Promise.withResolvers<undefined>()
  const release = Promise.withResolvers<undefined>()
  const remove = catalog.registerTemplate({
    ...template(),
    run: async (_revision, _target, _query, signal) => {
      signal.addEventListener('abort', () => { aborted.resolve(undefined) }, { once: true })
      entered.resolve(undefined)
      await release.promise
      signal.throwIfAborted()
      return { ...evidence, checks: [...evidence.checks], observations: [] }
    },
  })
  const project = await create()
  const pending = execute({ action: 'run', id: project.id, expectedRevision: 1, query: 'cup' })
  const rejected = expect(pending).rejects.toThrow('unloaded')
  await entered.promise
  let settled = false
  const disposal = remove().then(() => { settled = true })
  try {
    await aborted.promise
    expect(catalog.match('example', 'camera').available).toBe(false)
    expect(settled).toBe(false)
  } finally { release.resolve(undefined); await disposal; await rejected }
  expect(parseView(await execute({ action: 'read', id: project.id })).project.runs).toEqual([])
})
