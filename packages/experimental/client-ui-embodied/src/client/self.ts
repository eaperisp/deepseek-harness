/** One owner for the robot inventory displayed in the workbench. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { inspectionSchema } from '@deepseek-ai/dsh-robot/model'
import type { z } from 'zod'

interface SelfState {
  busy: boolean
  error: string | null
  inventory: z.infer<typeof inspectionSchema> | null
  receivedAt: string | null
  liveInterrupted: boolean
}

/** One validated provider in the latest discovery snapshot. */
export type RobotSnapshot = z.infer<typeof inspectionSchema>['providers'][number]

/** Reads the same provider registry used by the Agent's robot tools. */
export class SelfController {
  /** Latest successful inventory and explicit request status. */
  readonly state = createSnapshotStore<SelfState>({ busy: false, error: null, inventory: null, receivedAt: null, liveInterrupted: false })
  private disposed = false
  private reading = false
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
    await this.read(false)
  }
  /**
   * Update the displayed snapshot without unmounting its model or capability rows.
   * @returns Completion after publishing the snapshot or marking live feedback interrupted.
   */
  async sample(): Promise<void> {
    await this.read(true)
  }

  private async read(background: boolean): Promise<void> {
    if (this.disposed || this.reading) return
    this.reading = true
    if (!background) {
      this.state.update((state) => {
        state.busy = true; state.error = null; state.liveInterrupted = true
      })
    }
    try {
      const inventory = inspectionSchema.parse(JSON.parse(await this.inspect()))
      this.publish((state) => {
        state.inventory = inventory; state.receivedAt = new Date().toISOString(); state.liveInterrupted = false
      })
    } catch (error) {
      this.publish((state) => {
        if (background) state.liveInterrupted = true
        else {
          state.error = error instanceof Error ? error.message : 'ROBOT_DISCOVERY_FAILED'
          state.inventory = null
          state.receivedAt = null
        }
      })
    } finally {
      this.reading = false
      if (!background) this.publish((state) => { state.busy = false })
    }
  }
}
