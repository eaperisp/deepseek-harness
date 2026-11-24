/** Keyless discovery dashboard coverage through the simulated robot adapter. */
import { fileURLToPath } from 'node:url'
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { compareOrRefreshGolden, launchWebScaffold, webSnapshotMode } from './scaffold.ts'
import { ZH_BROWSER_LOCALE } from './support.ts'

const BUNDLE = new URL('../../../packages/experimental/embodied-bundle/', import.meta.url)
const EXPECTED = fileURLToPath(new URL('./expected/robot-self/panel.expected.md', import.meta.url))
const LIFT_EXPECTED = fileURLToPath(new URL('./expected/robot-self/lift.expected.md', import.meta.url))

it('searches and expands robot capabilities at phone width', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: [
      fileURLToPath(new URL('./pin-browse-picker.overlay.yml', import.meta.url)),
      fileURLToPath(new URL('./robot-self.overlay.yml', import.meta.url)),
    ],
    extraInstallAnchors: [fileURLToPath(new URL('package.json', BUNDLE))],
  })
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await browser.newPage({
    locale: ZH_BROWSER_LOCALE, timezoneId: 'Asia/Shanghai', viewport: { width: 1440, height: 940 },
  })
  await page.clock.setFixedTime(new Date('2026-01-02T03:04:00.000Z'))
  await page.goto(scaffold.authenticatedUrl)
  await page.getByRole('button', { name: '机器人自身', exact: true }).click()
  const panel = page.getByRole('main', { name: '机器人自身' })
  const radar = panel.getByText('Range radar', { exact: true })
  await radar.click()
  await panel.getByText('scan', { exact: true }).waitFor()
  await compareOrRefreshGolden(EXPECTED, await panel.ariaSnapshot(), webSnapshotMode())

  await page.setViewportSize({ width: 390, height: 844 })
  const filters = panel.getByRole('group', { name: '按能力状态筛选' })
  const unavailable = filters.getByRole('button', { name: '不可用 0' })
  await unavailable.focus()
  await page.keyboard.press('Enter')
  expect(await unavailable.getAttribute('aria-pressed')).toBe('true')
  expect(await panel.getByRole('status').textContent()).toBe('没有符合筛选条件的能力。')
  expect(await radar.count()).toBe(0)

  await filters.getByRole('button', { name: '全部 6' }).click()
  const search = panel.getByRole('searchbox', { name: '搜索能力或操作' })
  await search.fill('set_opening')
  expect(await radar.count()).toBe(0)
  await panel.getByText('Parallel gripper', { exact: true }).click()
  await panel.getByText('物理动作', { exact: true }).waitFor()
  expect(await panel.evaluate(element => element.scrollWidth)).toBe(await panel.evaluate(element => element.clientWidth))
  const refresh = panel.getByRole('button', { name: '重新发现' })
  await refresh.click()
  await expect.poll(() => refresh.isEnabled()).toBe(true)
  expect(await search.inputValue()).toBe('set_opening')
  await search.fill('')
  await radar.waitFor()
})

it('samples calibrated G1-D height while leaving the capability list mounted', async () => {
  let height = .2
  let calibrated = true
  let operatorEnabled = false
  let gatewayOnline = true
  const gateway = createServer((request, response) => {
    const body = request.method !== 'GET' ? undefined : request.url === '/api/catalog' && gatewayOnline ? {
      service: 'g1d_tool_portal',
      tools: [{ id: 'lift_height', name: 'Lift', description: 'Lift feedback', location: 'body', port: 28089, health_path: '/api/basic_status', state: 'online' }],
    } : request.url === '/api/basic_status' ? {
      ok: true, offset_valid: calibrated, physical_height_m: height, physical_min_m: 0, physical_max_m: .427, data_age_sec: 0,
    } : request.url === '/operator' ? { enabled: operatorEnabled } : undefined
    response.writeHead(body === undefined ? 404 : 200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(body))
  })
  await new Promise<void>((resolve, reject) => {
    gateway.once('error', reject)
    gateway.listen(0, '127.0.0.1', resolve)
  })
  onTestFinished(() => new Promise<void>((resolve, reject) => {
    gateway.close((error) => { if (error) reject(error); else resolve() })
  }))
  const address = gateway.address()
  if (address === null || typeof address === 'string') throw new Error('Mock robot has no TCP address')
  const directory = await mkdtemp(join(tmpdir(), 'dsh-robot-height-'))
  const overlay = join(directory, 'robot.yml')
  await writeFile(overlay, `- insert:
    - id: robot-runtime
      name: '@deepseek-ai/dsh-robot'
    - id: robot-g1d
      name: '@deepseek-ai/dsh-robot-g1d'
      config:
        host: http://127.0.0.1
        portalPort: ${address.port}
        liftPort: ${address.port}
    - id: robot-workbench
      name: '@deepseek-ai/dsh-client-ui-embodied'
    - id: test-operator
      name: '${new URL('./fixtures/g1d-operator.mjs', import.meta.url).href}'
      config:
        endpoint: http://127.0.0.1:${address.port}/operator
`)
  onTestFinished(async () => { await unlink(overlay); await rmdir(directory) })
  const scaffold = await launchWebScaffold({
    extraOverlayPath: [fileURLToPath(new URL('./pin-browse-picker.overlay.yml', import.meta.url)), overlay],
    extraInstallAnchors: [fileURLToPath(new URL('package.json', BUNDLE))],
  })
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await browser.newPage({ locale: ZH_BROWSER_LOCALE, viewport: { width: 1400, height: 940 } })
  await page.route('**/robot-models/g1-d.glb', route => route.fulfill({ status: 404 }))
  await page.goto(scaffold.authenticatedUrl)
  await page.getByRole('button', { name: '机器人自身', exact: true }).click()
  const panel = page.getByRole('main', { name: '机器人自身' })
  const model = panel.getByRole('region', { name: '机器人 3D' })
  await model.getByText('20.0 厘米').waitFor()
  await model.getByText('无法显示 G1-D 模型。').waitFor()
  const canvas = model.locator('canvas')
  const dimensions = await canvas.evaluate(element => ({
    width: element.clientWidth, height: element.clientHeight, viewportWidth: element.parentElement!.clientWidth,
  }))
  expect(dimensions.width).toBe(dimensions.viewportWidth)
  expect(dimensions.height).toBeGreaterThanOrEqual(360)
  const motion = panel.getByRole('region', { name: '运控控制' })
  expect(await motion.getByRole('button', { name: '升高 10 厘米' }).isDisabled()).toBe(true)
  const search = panel.getByRole('searchbox', { name: '搜索能力或操作' })
  await search.fill('read_health')
  height = .3
  await model.getByText('30.0 厘米').waitFor()
  expect(await search.inputValue()).toBe('read_health')
  const liveView = await model.ariaSnapshot()
  calibrated = false
  await model.getByText('暂无有效实时反馈').waitFor()
  await panel.getByText('运控服务在线 0/4').waitFor()
  await panel.getByText('已连接', { exact: true }).waitFor()
  const offlineViews = [await motion.ariaSnapshot(), liveView, await model.ariaSnapshot()]
  operatorEnabled = true
  await model.getByText('9.5 厘米').waitFor()
  const column = motion.getByRole('group', { name: '立柱' })
  const liftCard = panel.getByRole('region', { name: '升降立柱', exact: true })
  await liftCard.getByText('9.5 厘米').waitFor()
  await panel.getByText('运控服务在线 2/4').waitFor()
  await column.getByText('在线', { exact: true }).waitFor()
  const lastStep = await column.ariaSnapshot()
  expect(await liftCard.getByRole('button', { name: '降至下限' }).count()).toBe(0)
  await column.getByRole('button', { name: '降至下限' }).click()
  await model.getByText('0.0 厘米').waitFor()
  expect(await column.getByRole('button', { name: '已到下限' }).isDisabled()).toBe(true)
  await compareOrRefreshGolden(LIFT_EXPECTED, [...offlineViews, lastStep, await column.ariaSnapshot()].join('\n\n'), webSnapshotMode())
  await motion.getByRole('button', { name: '升高 10 厘米' }).click()
  await model.getByText('10.0 厘米').waitFor()
  await motion.getByText(/fixture-2/).waitFor()
  await motion.getByRole('button', { name: '左转 15°' }).click()
  await motion.getByText(/fixture-3/).waitFor()
  await motion.getByLabel('抓取物名称或 ID').fill('42')
  await motion.getByRole('button', { name: '抓取目标' }).click()
  await motion.getByText(/fixture-4/).waitFor()
  expect(new URL(page.url()).hash).toBe('#robot-self')
  await page.reload()
  await motion.getByText(/fixture-4/).waitFor()
  await model.getByText('10.0 厘米').waitFor()
  expect(await motion.getByRole('button', { name: '升高 10 厘米' }).isEnabled()).toBe(true)
  gatewayOnline = false
  operatorEnabled = false
  const deviceHeader = panel.getByRole('heading', { name: 'Unitree G1-D' }).locator('xpath=ancestor::header')
  await deviceHeader.getByText('离线', { exact: true }).waitFor()
  await deviceHeader.getByText('运控服务在线 0/4').waitFor()
  gatewayOnline = true
  await deviceHeader.getByText('已连接', { exact: true }).waitFor()
})
