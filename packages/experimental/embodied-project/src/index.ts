/** Shared project service for model tools, SDK consumers and the optional workbench. */
import { isAbsolute } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { ProjectCatalog } from './catalog.ts'
import { ProjectStore, type StoreConfig } from './store.ts'
import type { ProjectTarget, ProjectTemplate } from './types.ts'

export type { ProjectTarget, ProjectTemplate } from './types.ts'
export type { StoreConfig } from './store.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { embodiedProjects: EmbodiedProjects }
}

/** Project persistence and template registration without UI or model dependencies. */
export default class EmbodiedProjects extends Service {
  static Config = s.object({
    root: s.string().required(),
    maxDocumentBytes: s.natural().min(1024).default(2_000_000),
    maxProjects: s.natural().min(1).default(100),
    maxHistory: s.natural().min(1).default(200),
  })
  private readonly catalog = new ProjectCatalog()
  private readonly store: ProjectStore
  private readonly lifetime = new AbortController()
  private readonly pending = new Set<Promise<string>>()

  constructor(ctx: Context, config: StoreConfig) {
    super(ctx, 'embodiedProjects')
    if (!isAbsolute(config.root)) throw new Error('embodiedProjects.root must be an absolute project storage directory')
    this.store = new ProjectStore(config, this.catalog)
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error('Embodied project service unloaded'))
      await Promise.allSettled(this.pending)
    })
  }

  /**
   * Contribute an application template.
   * @param template - template implementation owned by the caller fiber.
   * @returns disposer; the contributor must own it through ctx.effect.
   */
  registerTemplate(template: ProjectTemplate): () => Promise<void> {
    this.lifetime.signal.throwIfAborted()
    return this.catalog.registerTemplate(template)
  }

  /**
   * Contribute a target configuration.
   * @param target - target capabilities and execution mode.
   * @returns disposer; the contributor must own it through ctx.effect.
   */
  registerTarget(target: ProjectTarget): () => Promise<void> {
    this.lifetime.signal.throwIfAborted()
    return this.catalog.registerTarget(target)
  }

  /**
   * Execute a validated JSON project command and wait for any commit.
   * @param command - catalog, list, create, read, revise, run or export JSON.
   * @param caller - caller cancellation; accepted atomic writes may finish after cancellation.
   * @returns JSON snapshot after successful persistence; rejects conflicts and malformed input.
   */
  async execute(command: string, caller: AbortSignal): Promise<string> {
    const signal = AbortSignal.any([this.lifetime.signal, caller])
    signal.throwIfAborted()
    const pending = this.store.execute(command, signal)
    this.pending.add(pending)
    try { return await pending } finally { this.pending.delete(pending) }
  }
}
