/** Optional Remote facade for live robot inventory and separately mounted sample projects. */
import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-embodied-project'
import type {} from '@deepseek-ai/dsh-robot'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

/** Installed operator controller for a G1-D deployment. */
export interface G1dOperator {
  state(signal: AbortSignal): Promise<string>
  submit(action: string, target: string, ticket: string): string
}
declare module '@deepseek-ai/cordis' { interface Context { robotStudio: EmbodiedWorkbench; g1dOperator: G1dOperator } }

/** Timeout for an explicit inventory refresh. */
export interface Config {
  /** Maximum discovery duration in milliseconds. */
  inspectionTimeoutMs: number
}

/** Workbench API with plugin-scoped cancellation. */
export default class EmbodiedWorkbench extends TypertRemoteService {
  static inject = ['robot']
  static Config = z.object({ inspectionTimeoutMs: z.number().min(1).default(10000) })
  private readonly lifetime = new AbortController()
  private readonly pending = new Set<Promise<string>>()
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'robotStudio')
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error('Embodied workbench unloaded'))
      await Promise.allSettled(this.pending)
    })
  }
  /**
   * Discover the currently configured robot and its exact callable operations.
   * @returns A JSON capability inventory; failed providers remain visible.
   */
  @Remote
  async inspect(): Promise<string> {
    this.lifetime.signal.throwIfAborted()
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(this.config.inspectionTimeoutMs)])
    const pending = this.ctx.robot.inspect(signal).then(value => JSON.stringify(value))
    this.pending.add(pending)
    try { return await pending } finally { this.pending.delete(pending) }
  }
  /**
   * Read the operator's measured pose and last command receipt.
   * @returns A JSON snapshot, or JSON null when no operator adapter is installed.
   */
  @Remote
  async motionState(): Promise<string> {
    this.lifetime.signal.throwIfAborted()
    return this.ctx.get('g1dOperator')?.state(this.lifetime.signal) ?? 'null'
  }
  /**
   * Submit one manual command against the operator's current admission ticket.
   * @param action - Fixed operator action.
   * @param target - Object identifier for a grasp.
   * @param ticket - Single-use admission ticket from the current controller.
   * @returns Receipt identifier. Subsequent measurements report the outcome.
   */
  @Remote
  async motion(action: string, target: string, ticket: string): Promise<string> {
    this.lifetime.signal.throwIfAborted()
    const operator = this.ctx.get('g1dOperator')
    if (!operator) throw new Error('G1-D operator unavailable')
    return operator.submit(action, target, ticket)
  }
  /**
   * Forward a project command without a second data store.
   * @param command - validated by the project service.
   * @returns committed project result or structured Remote failure.
   */
  @Remote
  async dispatch(command: string): Promise<string> {
    this.lifetime.signal.throwIfAborted()
    const projects = this.ctx.get('embodiedProjects')
    if (!projects) throw new Error('Sample project services are not enabled in this profile')
    const pending = projects.execute(command, this.lifetime.signal)
    this.pending.add(pending)
    try { return await pending } finally { this.pending.delete(pending) }
  }
}
