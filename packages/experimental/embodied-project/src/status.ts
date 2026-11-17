/** Revision-bound evidence status shared by project consumers. */
import type { Project, Revision } from './model.ts'
import { StudioError } from './errors.ts'

/**
 * Read the latest revision from a validated project.
 * @param project - nonempty revision history.
 * @returns current revision.
 */
export function currentRevision(project: Project): Revision {
  const current = project.revisions.at(-1)
  if (!current) throw new StudioError('REVISION_MISSING', 'Project has no revision.')
  return current
}

/**
 * Derive the latest sample result for the current revision.
 * @param project - validated project history.
 * @returns unverified, blocked or sample-passed; never a hardware validation claim.
 */
export function projectStatus(project: Project): 'needs-validation' | 'sample-passed' | 'blocked' {
  const current = currentRevision(project)
  const run = project.runs.findLast(item => item.revision === current.revision)
  return run === undefined ? 'needs-validation' : run.status === 'passed' ? 'sample-passed' : 'blocked'
}
