/** Atomic, bounded project storage with optimistic revision checks across Host processes. */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { commandSchema, projectId, projectSchema, runId, type Project } from './model.ts'
import { currentRevision, projectStatus } from './status.ts'
import { StudioError } from './errors.ts'
import type { ProjectCatalog } from './catalog.ts'

/** Deployment limits for retained project documents and command input. */
export interface StoreConfig {
  /** Absolute directory containing project JSON files and lock files. */
  root: string
  /** Maximum UTF-8 bytes per stored document or incoming command. */
  maxDocumentBytes: number
  /** Maximum number of retained project documents. */
  maxProjects: number
  /** Maximum total revisions and runs retained in one project. */
  maxHistory: number
}

/** Owns file access; each command returns a JSON snapshot after its commit succeeds. */
export class ProjectStore {
  constructor(private readonly config: StoreConfig, private readonly catalog: ProjectCatalog) {}

  /**
   * Execute validated commands; conflicting revisions and invalid stored files fail without replacement.
   * @param input - serialized project command.
   * @param signal - cancellation before commit; an accepted atomic write can still finish.
   * @returns committed document or catalog JSON.
   */
  async execute(input: string, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted()
    if (Buffer.byteLength(input) > this.config.maxDocumentBytes) throw new StudioError('INPUT_LIMIT', 'Project command exceeds the configured byte limit.')
    const command = commandSchema.parse(JSON.parse(input))
    if (command.action === 'catalog') return JSON.stringify(this.catalog.snapshot())
    await mkdir(this.config.root, { recursive: true, mode: 0o700 })
    if (command.action === 'list') {
      const names = await this.names()
      const projects = await Promise.all(names.map(async (name) => {
        const project = await this.read(name.slice(0, -5))
        return { id: project.id, current: currentRevision(project), status: this.status(project) }
      }))
      return JSON.stringify({ projects })
    }
    if (command.action === 'create') {
      const versions = this.versions(command.template, command.target)
      return await withFileLock(join(this.config.root, 'catalog'), async () => {
        if ((await this.names()).length >= this.config.maxProjects) throw new StudioError('PROJECT_LIMIT', 'Project count reached the configured limit.')
        const project: Project = {
          formatVersion: 1, id: projectId.parse(randomUUID()), revisions: [{
            revision: 1, title: command.title, goal: command.goal, template: command.template,
            target: command.target, ...versions, createdAt: new Date().toISOString(),
          }], runs: [],
        }
        await this.save(project, signal)
        return this.view(project)
      }, { signal })
    }
    if (command.action === 'read') return this.view(await this.read(command.id))
    if (command.action === 'export') {
      const project = await this.read(command.id)
      return JSON.stringify({ filename: `${project.id}.robot-project.json`, content: JSON.stringify(project, null, 2) + '\n' })
    }
    return await withFileLock(this.path(command.id), async () => {
      const project = await this.read(command.id)
      const current = currentRevision(project)
      if (current.revision !== command.expectedRevision) throw new StudioError('REVISION_CONFLICT', 'Project changed. Reload it before editing or running.')
      if (project.revisions.length + project.runs.length >= this.config.maxHistory) throw new StudioError('HISTORY_LIMIT', 'Project history reached the configured limit. Export it before starting another project.')
      if (command.action === 'revise') {
        const versions = this.versions(current.template, command.target)
        project.revisions.push({
          ...current, ...versions, revision: current.revision + 1, title: command.title,
          goal: command.goal, target: command.target, createdAt: new Date().toISOString(),
        })
      } else {
        const versions = this.versions(current.template, current.target)
        if (versions.templateVersion !== current.templateVersion || versions.targetVersion !== current.targetVersion) throw new StudioError('DEPENDENCY_CHANGED', 'Template or target changed. Revise the project before running.')
        project.runs.push(await this.catalog.run(current, command.query, runId.parse(randomUUID()), new Date().toISOString(), signal))
      }
      await this.save(project, signal)
      return this.view(project)
    }, { signal })
  }

  private path(id: string): string { return join(this.config.root, `${projectId.parse(id)}.json`) }

  private async names(): Promise<string[]> {
    const names = (await readdir(this.config.root)).filter(name => name.endsWith('.json') && projectId.safeParse(name.slice(0, -5)).success)
    if (names.length > this.config.maxProjects) throw new StudioError('PROJECT_LIMIT', 'Stored project count exceeds the configured limit.')
    return names.sort()
  }

  private async read(id: string): Promise<Project> {
    const path = this.path(id)
    if ((await stat(path)).size > this.config.maxDocumentBytes) throw new StudioError('DOCUMENT_LIMIT', 'Stored project exceeds the configured byte limit.')
    const raw = await readFile(path, 'utf8')
    if (Buffer.byteLength(raw) > this.config.maxDocumentBytes) throw new StudioError('DOCUMENT_LIMIT', 'Stored project exceeds the configured byte limit.')
    const project = projectSchema.parse(JSON.parse(raw))
    if (project.id !== id) throw new StudioError('IDENTITY_MISMATCH', 'Project filename and document identity disagree. Restore a verified backup.')
    return project
  }

  private async save(project: Project, signal: AbortSignal): Promise<void> {
    const content = JSON.stringify(projectSchema.parse(project), null, 2) + '\n'
    if (Buffer.byteLength(content) > this.config.maxDocumentBytes) throw new StudioError('DOCUMENT_LIMIT', 'Project exceeds the configured byte limit; no changes were saved.')
    signal.throwIfAborted()
    await writeFileAtomic(this.path(project.id), content, { mode: 0o600, dirMode: 0o700 })
  }

  private view(project: Project): string {
    const current = currentRevision(project)
    const compatibility = this.catalog.match(current.template, current.target)
    return JSON.stringify({ project, status: this.status(project), compatibility })
  }

  private status(project: Project): ReturnType<typeof projectStatus> {
    const current = currentRevision(project)
    const compatibility = this.catalog.match(current.template, current.target)
    const stale = current.templateVersion !== compatibility.templateVersion || current.targetVersion !== compatibility.targetVersion
    return stale || !compatibility.compatible ? 'needs-validation' : projectStatus(project)
  }

  private versions(template: string, target: string): { templateVersion: string; targetVersion: string } {
    const result = this.catalog.match(template, target)
    if (result.templateVersion === null || result.targetVersion === null) throw new StudioError('PROVIDER_MISSING', 'Load the selected template and target provider before editing this project.')
    return { templateVersion: result.templateVersion, targetVersion: result.targetVersion }
  }
}
