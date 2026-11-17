/** One owner for the robot inventory displayed in the workbench. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { inspectionSchema } from '@deepseek-ai/dsh-robot/model'
import type { z } from 'zod'

interface SelfState {
  busy: boolean
  error: string | null
  inventory: z.infer<typeof inspectionSchema> | null
  receivedAt: string | null
}

/** Reads the same provider registry used by the Agent's robot tools. */
export class SelfController {
  /** Latest successful inventory and explicit request status. */
  readonly state = createSnapshotStore<SelfState>({ busy: false, error: null, inventory: null, receivedAt: null })
  private disposed = false
  constructor(private readonly inspect: () => Promise<string>) {}
  /** Stop publishing after the browser plugin unloads. */
  dispose(): void { this.disposed = true }
  private publish(update: (state: SelfState) => void): void {
    if (!this.disposed) this.state.update(update)
  }
  /**
   * Refresh device evidence; a failed refresh clears callable state.
   * @returns Completion after publishing evidence or a visible failure, unless disposed.
   */
  async refresh(): Promise<void> {
    if (this.disposed || this.state.getSnapshot().busy) return
    this.state.update((state) => { state.busy = true; state.error = null; state.inventory = null; state.receivedAt = null })
    try {
      const inventory = inspectionSchema.parse(JSON.parse(await this.inspect()))
      this.publish((state) => { state.inventory = inventory; state.receivedAt = new Date().toISOString() })
    } catch (error) {
      this.publish((state) => { state.error = error instanceof Error ? error.message : 'ROBOT_DISCOVERY_FAILED' })
    } finally { this.publish((state) => { state.busy = false }) }
  }
}
