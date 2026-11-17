/** Workbench data owner; all mutations re-read the committed Host result. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { z } from 'zod'
import { catalogSchema, viewSchema, listSchema, exportSchema, revisionSchema, statusSchema, type Project } from '@deepseek-ai/dsh-embodied-project/model'

interface State {
  busy: boolean
  error: string | null
  catalog: z.infer<typeof catalogSchema>
  projects: { id: string; current: z.infer<typeof revisionSchema>; status: z.infer<typeof statusSchema> }[]
  project: Project | null
  status: z.infer<typeof statusSchema>
  exported: string | null
}

/** Owns a workbench view and contains request failures without clearing saved data. */
export class StudioController {
  /** Committed project snapshots and request feedback for the workbench. */
  readonly state = createSnapshotStore<State>({ busy: false, error: null, catalog: { templates: [], targets: [] }, projects: [], project: null, status: 'needs-validation', exported: null })
  private disposed = false
  private isDisposed(): boolean { return this.disposed }
  constructor(private readonly dispatch: (command: string) => Promise<string>) {}

  /** Stop publishing after plugin disposal; the Host owns already accepted commits. */
  dispose(): void { this.disposed = true }

  /**
   * Execute one user command and refresh the visible catalog and project list.
   * @param command - project command forwarded to the Host.
   * @returns settlement after publication or contained failure.
   */
  async command(command: Record<string, unknown>): Promise<void> {
    if (this.isDisposed() || this.state.getSnapshot().busy) return
    this.state.update((state) => { state.busy = true; state.error = null; state.exported = null })
    try {
      const response: unknown = JSON.parse(await this.dispatch(JSON.stringify(command)))
      if (this.isDisposed()) return
      if (command.action === 'export') {
        const result = exportSchema.parse(response)
        this.state.update((state) => { state.exported = result.content })
      } else if (command.action !== 'list') {
        const result = viewSchema.parse(response)
        this.state.update((state) => { state.project = result.project; state.status = result.status })
      }
      const list: unknown = command.action === 'list' ? response : JSON.parse(await this.dispatch('{"action":"list"}'))
      const result = listSchema.parse(list)
      if (!this.isDisposed()) this.state.update((state) => { state.projects = result.projects })
      const selected = this.state.getSnapshot().project
      if (command.action === 'list' && selected !== null) {
        const refreshed = viewSchema.parse(JSON.parse(await this.dispatch(JSON.stringify({ action: 'read', id: selected.id }))))
        if (!this.isDisposed()) this.state.update((state) => { state.project = refreshed.project; state.status = refreshed.status })
      }
      if (this.isDisposed()) return
      const catalog = catalogSchema.parse(JSON.parse(await this.dispatch('{"action":"catalog"}')))
      if (!this.isDisposed()) this.state.update((state) => {
        state.catalog = catalog
        if (state.project !== null) state.status = result.projects.find(item => item.id === state.project?.id)?.status ?? 'needs-validation'
      })
    } catch (error) {
      if (!this.isDisposed()) this.state.update((state) => { state.error = error instanceof Error ? error.message : 'REQUEST_FAILED' })
    } finally {
      if (!this.isDisposed()) this.state.update((state) => { state.busy = false })
    }
  }
}
