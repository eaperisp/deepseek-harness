/** Instance-owned template and target registrations with cancellation and settlement. */
import { runSchema, templateId, targetId, type Revision, type Run, type RunId } from './model.ts'
import { StudioError } from './errors.ts'
import type { ProjectTarget, ProjectTemplate } from './types.ts'

interface Entry<T> { value: T; lifetime: AbortController; pending: Set<Promise<Run>> }
interface CatalogSnapshot {
  templates: Omit<ProjectTemplate, 'run'>[]
  targets: ProjectTarget[]
}
interface Compatibility {
  template: string
  target: string
  available: boolean
  compatible: boolean
  required: { id: string; available: boolean }[]
  optional: { id: string; available: boolean }[]
  templateVersion: string | null
  targetVersion: string | null
  limitations: string[]
}

/** Shared semantic registry; application-specific steps remain in contributing plugins. */
export class ProjectCatalog {
  private readonly templates = new Map<string, Entry<ProjectTemplate>>()
  private readonly targets = new Map<string, Entry<ProjectTarget>>()

  /**
   * Register a template; the contributing fiber owns the returned disposer.
   * @param template - application implementation.
   * @returns disposer that removes admission, aborts and joins accepted executions.
   */
  registerTemplate(template: ProjectTemplate): () => Promise<void> {
    templateId.parse(template.id)
    return this.register(this.templates, template.id, {
      ...template, required: [...template.required], optional: [...template.optional],
      steps: [...template.steps], limitations: [...template.limitations],
    })
  }

  /**
   * Register a deployment target independently of templates.
   * @param target - advertised capabilities and sample-only execution mode.
   * @returns disposer that cancels and joins accepted work.
   */
  registerTarget(target: ProjectTarget): () => Promise<void> {
    targetId.parse(target.id)
    return this.register(this.targets, target.id, structuredClone(target))
  }

  private register<T>(map: Map<string, Entry<T>>, id: string, value: T): () => Promise<void> {
    if (map.has(id)) throw new StudioError('DUPLICATE_REGISTRATION', `Already registered: ${id}`)
    const entry: Entry<T> = { value, lifetime: new AbortController(), pending: new Set() }
    map.set(id, entry)
    return async () => {
      if (map.get(id) === entry) map.delete(id)
      entry.lifetime.abort(new Error('Project contribution unloaded'))
      await Promise.allSettled(entry.pending)
    }
  }

  /**
   * Read registered metadata without executable functions.
   * @returns detached template summaries and target declarations.
   */
  snapshot(): CatalogSnapshot {
    return {
      templates: [...this.templates.values()].map(({ value: { run: _run, ...summary } }) => structuredClone(summary)),
      targets: [...this.targets.values()].map(({ value }) => structuredClone(value)),
    }
  }

  /**
   * Compare semantic requirements without assuming a manufacturer supplies them.
   * @param template - template identity.
   * @param target - deployment identity.
   * @returns compatibility and optional degradation; absent contributions are explicit.
   */
  match(template: string, target: string): Compatibility {
    const definition = this.templates.get(template)?.value
    const device = this.targets.get(target)?.value
    const required = definition?.required.map(id => ({ id, available: device?.capabilities.includes(id) === true })) ?? []
    return {
      template, target, available: definition !== undefined && device !== undefined,
      compatible: definition !== undefined && device !== undefined && required.every(item => item.available),
      required,
      optional: definition?.optional.map(id => ({ id, available: device?.capabilities.includes(id) === true })) ?? [],
      templateVersion: definition?.version ?? null, targetVersion: device?.version ?? null,
      limitations: [...(definition?.limitations ?? [])],
    }
  }

  /**
   * Run the registered sample implementation after enforcing required capabilities.
   * @param revision - immutable project revision.
   * @param query - validated user request.
   * @param id - owner-minted run identity.
   * @param createdAt - owner-recorded start time.
   * @param caller - caller cancellation.
   * @returns validated evidence; unknown or incompatible registrations reject before dispatch.
   */
  async run(revision: Revision, query: string, id: RunId, createdAt: string, caller: AbortSignal): Promise<Run> {
    caller.throwIfAborted()
    const template = this.templates.get(revision.template)
    const target = this.targets.get(revision.target)
    if (!template || !target || !this.match(revision.template, revision.target).compatible) {
      throw new StudioError('CAPABILITY_MISSING', 'Required capabilities are unavailable. Select a compatible target or load the missing provider.')
    }
    const signal = AbortSignal.any([caller, template.lifetime.signal, target.lifetime.signal])
    const pending = Promise.resolve().then(async () => {
      signal.throwIfAborted()
      const result = await template.value.run(revision, target.value, query, signal)
      signal.throwIfAborted()
      return runSchema.parse({ ...result, id, createdAt, query, revision: revision.revision })
    })
    template.pending.add(pending)
    target.pending.add(pending)
    try { return await pending } finally { template.pending.delete(pending); target.pending.delete(pending) }
  }
}
