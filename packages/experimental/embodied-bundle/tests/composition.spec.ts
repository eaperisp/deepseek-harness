import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Loader, { interpolate, type EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { SkillRegistry } from '@deepseek-ai/dsh-skill'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import { ToolExecutionPipeline } from '@deepseek-ai/dsh-tools/pipeline'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { viewSchema } from '@deepseek-ai/dsh-embodied-project/model'
import * as Project from '@deepseek-ai/dsh-embodied-project'
import * as Development from '@deepseek-ai/dsh-embodied-development'
import * as ProjectTools from '@deepseek-ai/dsh-tool-embodied-project'
import * as Workbench from '@deepseek-ai/dsh-client-ui-embodied'
import * as Robot from '@deepseek-ai/dsh-robot'
import * as Simulated from '@deepseek-ai/dsh-robot-simulated'
import * as RobotTools from '@deepseek-ai/dsh-tool-robot'
import { load } from 'js-yaml'
import { expect, it, vi } from 'vitest'

it('loads the shipped bundle rows, shares workbench and tool state, and unloads contributions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'embodied-bundle-'))
  const ctx = new Context()
  const modules = new Map<string, object>([
    ['@deepseek-ai/dsh-embodied-project', Project], ['@deepseek-ai/dsh-embodied-development', Development],
    ['@deepseek-ai/dsh-tool-embodied-project', ProjectTools], ['@deepseek-ai/dsh-client-ui-embodied', Workbench],
    ['@deepseek-ai/dsh-robot', Robot], ['@deepseek-ai/dsh-robot-simulated', Simulated], ['@deepseek-ai/dsh-tool-robot', RobotTools],
  ])
  try {
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(Tools)
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(Loader)
    if (!ctx.loader.internal) throw new Error('Loader importer missing')
    const importer = vi.spyOn(ctx.loader.internal, 'import').mockImplementation(async (name: string) => {
      const module = modules.get(name)
      if (!module) throw new Error('Unexpected plugin: ' + name)
      return module
    })
    const patch = load(await readFile(new URL('../sample.patch.yml', import.meta.url), 'utf8'), { schema: entryListSchema }) as { insert: EntryOptions[] }[]
    for (const row of patch[0]!.insert) {
      const config: unknown = interpolate({ process: { env: { DSH_EMBODIED_PROJECTS_ROOT: root } } }, row.config)
      await ctx.loader.create({ ...row, config })
    }
    await ctx.loader.await()
    expect(importer.mock.calls).toHaveLength(7)
    expect((await ctx.skills.list()).some(skill => skill.name === 'embodied-development')).toBe(true)
    expect((await ctx.skills.get('embodied-development'))?.content).toContain('not execution authority')
    expect((await ctx.robot.inspect(new AbortController().signal)).providers).toHaveLength(1)
    const tool = ctx.tools.get('embodied_project')!
    expect(tool.presentCall?.({ command: '{"action":"catalog"}' })).toEqual({ card: 'generic', title: 'embodied_project' })
    const pipeline = new ToolExecutionPipeline(ctx)
    async function invoke(command: object) {
      const prepared = await pipeline.prepare({ name: 'embodied_project', callId: ToolCallId('project-test'), arguments: { command: JSON.stringify(command) }, signal: new AbortController().signal })
      const outcome = prepared.kind === 'dispatch' ? await pipeline.dispatch(prepared.exec) : prepared
      return pipeline.complete(prepared.exec, outcome)
    }
    const created = await invoke({ action: 'create', title: 'Find a cup', goal: 'Inspect historical sample', template: 'spatial-memory', target: 'sample-full' })
    expect(created.isError).toBe(false)
    expect(typeof created.value).toBe('string')
    if (typeof created.value !== 'string') throw new Error('Expected serialized project')
    const view = viewSchema.parse(JSON.parse(created.value))
    expect(JSON.parse(await ctx.robotStudio.dispatch(JSON.stringify({ action: 'read', id: view.project.id })))).toMatchObject(view)
    const ran = await invoke({ action: 'run', id: view.project.id, expectedRevision: 1, query: '杯子' })
    expect(ran.isError).toBe(false)
    if (typeof ran.value !== 'string') throw new Error('Expected serialized result')
    const result = viewSchema.parse(JSON.parse(ran.value))
    expect(result).toMatchObject({ status: 'sample-passed', project: { runs: [{ query: '杯子', observations: [{ observerPosition: { frame: 'sample-map-1' } }] }] } })
    expect(tool.output.render({ command: '' }, ran.value)).toEqual([{ type: 'text', text: ran.value }])
    const failed = await invoke({ action: 'run', id: view.project.id, expectedRevision: 99, query: 'cup' })
    expect(failed.isError).toBe(true)
    ctx.loader.remove('embodied-development')
    await ctx.loader.await()
    expect((await ctx.skills.list()).some(skill => skill.name === 'embodied-development')).toBe(false)
    expect(JSON.parse(await ctx.robotStudio.dispatch('{"action":"catalog"}'))).toEqual({ templates: [], targets: [] })
    importer.mockRestore()
  } finally {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
