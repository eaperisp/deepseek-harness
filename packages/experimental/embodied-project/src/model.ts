/** Validated project documents shared by the workbench, tools, and persisted files. */
import { z } from 'zod'
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'

/** Opaque identity of a persisted development project. */
export type ProjectId = Branded<'EmbodiedProjectId'>
/** Opaque identity of one sample run. */
export type RunId = Branded<'EmbodiedRunId'>

/** Provider-defined template identifier. */
export const templateId = z.string().regex(/^[a-z][a-z0-9-]*$/).max(100)
/** Provider-defined target identifier. */
export const targetId = z.string().regex(/^[a-z][a-z0-9-]*$/).max(100)
/** Project identifier used as a single filename, never a path. */
export const projectId = z.uuid().transform(value => brandString<ProjectId>(value))
/** Run identity validated at command and persistence parsing. */
export const runId = z.uuid().transform(value => brandString<RunId>(value))
const text = z.string().trim().min(1).max(2000)

/** Provider metadata accepted across the Remote JSON connection. */
export const catalogSchema = z.object({
  templates: z.array(z.object({
    id: templateId, version: text, title: text, description: text,
    steps: z.array(text), required: z.array(text), optional: z.array(text), limitations: z.array(text),
  }).strict()),
  targets: z.array(z.object({
    id: targetId, version: text, title: text, mode: z.literal('sample'), capabilities: z.array(text),
  }).strict()),
}).strict()

/** Evidence validity relative to the currently registered provider versions. */
export const statusSchema = z.enum(['needs-validation', 'sample-passed', 'blocked'])

/** One immutable project revision; robot bindings never rewrite previous revisions. */
export const revisionSchema = z.object({
  revision: z.number().int().positive(), title: text, goal: text,
  template: templateId, target: targetId, createdAt: z.iso.datetime(),
  templateVersion: text, targetVersion: text,
}).strict()

/** Evidence from the deterministic sample runner, not hardware validation. */
export const runSchema = z.object({
  id: runId, revision: z.number().int().positive(), createdAt: z.iso.datetime(),
  query: text, mode: z.literal('sample'), status: z.enum(['passed', 'blocked']),
  checks: z.array(z.object({ name: z.string(), passed: z.boolean(), detail: z.string() }).strict()),
  observations: z.array(z.object({
    image: z.string(), capturedAt: z.iso.datetime(), mapSession: z.string(),
    label: z.string(), score: z.number().min(0).max(1),
    observerPosition: z.object({ x: z.number(), y: z.number(), frame: z.string() }).strict().nullable(),
  }).strict()),
}).strict()

/** Versioned file format; unknown versions and malformed evidence are rejected. */
export const projectSchema = z.object({
  formatVersion: z.literal(1), id: projectId,
  revisions: z.array(revisionSchema).min(1), runs: z.array(runSchema),
}).strict().superRefine((value, ctx) => {
  if (value.revisions.some((r, i) => r.revision !== i + 1)) ctx.addIssue({ code: 'custom', message: 'Revision sequence is invalid' })
  if (value.runs.some(r => r.revision > value.revisions.length)) ctx.addIssue({ code: 'custom', message: 'Run references a missing revision' })
  if (new Set(value.runs.map(r => r.id)).size !== value.runs.length) ctx.addIssue({ code: 'custom', message: 'Duplicate run identity' })
  if (value.runs.some(r => r.status === 'passed' && (r.checks.length === 0 || r.checks.some(c => !c.passed)))) ctx.addIssue({ code: 'custom', message: 'Passed evidence contains failed or absent checks' })
})

/** Commands accepted from model JSON and the workbench. */
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('catalog') }).strict(),
  z.object({ action: z.literal('list') }).strict(),
  z.object({ action: z.literal('read'), id: projectId }).strict(),
  z.object({ action: z.literal('create'), title: text, goal: text, template: templateId, target: targetId }).strict(),
  z.object({ action: z.literal('revise'), id: projectId, expectedRevision: z.number().int().positive(), title: text, goal: text, target: targetId }).strict(),
  z.object({ action: z.literal('run'), id: projectId, expectedRevision: z.number().int().positive(), query: text }).strict(),
  z.object({ action: z.literal('export'), id: projectId }).strict(),
])

/** Persisted project and its version-bound evidence. */
export type Project = z.infer<typeof projectSchema>
/** Project revision selected for matching and execution. */
export type Revision = z.infer<typeof revisionSchema>
/** Sample execution record. */
export type Run = z.infer<typeof runSchema>

/** JSON project response; compatibility metadata is owned by the registry. */
export const viewSchema = z.object({ project: projectSchema, status: statusSchema })
/** JSON list response with provider-relative validity. */
export const listSchema = z.object({
  projects: z.array(z.object({ id: projectId, current: revisionSchema, status: statusSchema })),
})
/** Export payload for caller-managed file delivery. */
export const exportSchema = z.object({ filename: z.string(), content: z.string() })
