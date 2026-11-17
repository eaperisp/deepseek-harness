/** Provider contracts for reusable development templates and deployment targets. */
import type { Revision, Run } from './model.ts'

/** A target declares semantic capabilities independently of its manufacturer. */
export interface ProjectTarget {
  readonly id: string
  readonly version: string
  readonly title: string
  readonly mode: 'sample'
  readonly capabilities: readonly string[]
}

/** A template declares requirements and owns its sample implementation. */
export interface ProjectTemplate {
  readonly id: string
  readonly version: string
  readonly title: string
  readonly description: string
  readonly steps: readonly string[]
  readonly required: readonly string[]
  readonly optional: readonly string[]
  readonly limitations: readonly string[]
  /**
   * Execute with a selected target; implementations must honor cancellation and settle before disposal.
   * @param revision - selected project version.
   * @param target - resolved sample target.
   * @param query - validated user query.
   * @param signal - caller and registration cancellation.
   * @returns sample evidence without the owner-assigned run identity.
   */
  run(this: void, revision: Revision, target: ProjectTarget, query: string, signal: AbortSignal): Promise<Omit<Run, 'id' | 'revision' | 'createdAt' | 'query'>>
}
