/** Starter development templates and explicit sample targets for the embodied Harness. */
import type { Context } from '@deepseek-ai/cordis'
import type { ProjectTemplate } from '@deepseek-ai/dsh-embodied-project'
import type {} from '@deepseek-ai/dsh-skill'
import { runSample } from './samples.ts'
import { instructions } from './instructions.ts'

/** Cordis plugin identity. */
export const name = 'embodied-development'
/** Template registry and skill catalog required by this provider. */
export const inject = ['embodiedProjects', 'skills']

/**
 * Register beginner workflows and sample configurations, without claiming manufacturer support.
 * @param ctx - provider lifetime and required services.
 */
export function apply(ctx: Context): void {
  const common = {
    version: '1', required: ['image.read'], optional: ['pose.read'],
    limitations: ['Historical observer positions are not current object coordinates.', 'Sample labels are annotations, not model inference.'],
    run: runSample,
  }
  const templates: ProjectTemplate[] = [
    { ...common, id: 'vision', title: 'Visual recognition', description: 'Inspect annotated sample objects before connecting an image model.', required: ['image.read', 'objects.read'], optional: [], steps: ['image.read', 'objects.read', 'report'] },
    { ...common, id: 'spatial-memory', title: 'Spatial memory', description: 'Retrieve historical sample observations by label and inspect position validity.', steps: ['image.read', 'memory.record', 'memory.search', 'report'] },
  ]
  for (const template of templates) ctx.effect(() => ctx.embodiedProjects.registerTemplate(template))
  ctx.effect(() => ctx.embodiedProjects.registerTarget({ id: 'sample-full', version: '1', title: 'Sample camera and localization', mode: 'sample', capabilities: ['image.read', 'objects.read', 'pose.read'] }))
  ctx.effect(() => ctx.embodiedProjects.registerTarget({ id: 'sample-camera', version: '1', title: 'Sample camera only', mode: 'sample', capabilities: ['image.read', 'objects.read'] }))
  ctx.effect(() => ctx.skills.register({ name: 'embodied-development', source: 'bundled', description: 'Help beginners develop robot applications, select capabilities, run sample workflows, interpret evidence and prepare robot adaptation.', content: instructions }))
}
