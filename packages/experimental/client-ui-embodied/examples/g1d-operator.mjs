/** Manual controls for the installed robot-arm bundle and its configured direct-motion policy. */
import { randomUUID } from 'node:crypto'

const liftStepM = .1
const commands = {
  raise: ['robot_lift', {}], lower: ['robot_lift', {}],
  suck: ['suction_output', { command: 'suck' }], release: ['suction_output', { command: 'release' }],
  forward: ['robot_move_forward', { distance_m: .1 }], backward: ['robot_back_up', { distance_m: .1 }],
  turnLeft: ['robot_turn_left', { angle_deg: 15 }], turnRight: ['robot_turn_right', { angle_deg: 15 }],
  grasp: ['robot_arm', { action: 'pick' }], rest: ['robot_arm', { action: 'reset' }],
  stop: ['robot_stop', {}], armStop: ['robot_arm_estop', {}],
}

/**
 * Register the same configured movement implementations used by the installed robot tools.
 * @param ctx - Deployment plugin lifetime.
 * @param options - Installed tools, dashboard client, policy and operator telemetry addresses.
 */
export function installOperator(ctx, { tools, robot, settings, jointsUrl, liftUrl, suctionUrl }) {
  if (!settings.directMotion || settings.requireActionApproval) return
  const byName = new Map(tools.map(tool => [tool.name, tool]))
  const life = new AbortController()
  const armUrl = settings.arm.consoleUrl && new URL('/api/state', settings.arm.consoleUrl)
  const readArm = signal => armUrl ? get(armUrl, signal) : Promise.resolve(null)
  const readCup = signal => suctionUrl ? get(new URL('/api/v1/status', suctionUrl), signal) : Promise.resolve(null)
  function cupState(reply) {
    const d = reply?.data
    if (reply?.ok !== true || reply.service !== 'es80z-api' || d?.serial_present !== true || d.serial_error !== null ||
      d.fault !== 0 || d.is_enabled !== true || d.is_ready !== true) return null
    if (d.is_blowing === true) return 'blowing'
    if (d.is_sucked === true && d.is_released === false) return 'on'
    if (d.is_released === true && d.is_sucked === false) return 'off'
    return null
  }
  function armTaskCount(arm) {
    return arm?.bridge?.running === true && arm.bridge.arm_node_seen === true &&
      Number.isSafeInteger(arm.active_task_count) && arm.active_task_count >= 0 ? arm.active_task_count : null
  }
  if (suctionUrl && armUrl) byName.set('suction_output', {
    name: 'suction_output',
    async execute({ command }, { signal }) {
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(6500)])
      const [arm, cup] = await Promise.all([readArm(deadline), readCup(deadline)])
      if (stopping || armTaskCount(arm) !== 0 || cupState(cup) !== (command === 'suck' ? 'off' : 'on')) throw new Error('Suction output or arm task changed')
      const response = await fetch(new URL('/api/v1/command', suctionUrl), {
        method: 'POST', redirect: 'error', signal: deadline, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command, wait: true, wait_timeout: 3 }),
      })
      if (!response.ok || (await response.json()).ok !== true) throw new Error('Suction controller did not acknowledge the command')
      return { verified: cupState(await readCup(deadline)) === (command === 'suck' ? 'on' : 'off') }
    },
    output: { render: () => [] },
  })
  const movements = new Set([...Object.values(commands).map(([name]) => name), 'robot_navigate', 'robot_workflow_run', 'robot_arm_resume_home'])
  let moving = false
  for (const tool of byName.values()) {
    if (!movements.has(tool.name) || ['robot_stop', 'robot_arm_estop'].includes(tool.name)) continue
    const execute = tool.execute
    tool.execute = async (args, exec) => {
      if (moving) throw new Error('Another robot movement is in progress')
      moving = true
      try { return await execute(args, exec) } finally { moving = false }
    }
  }
  const fresh = age => Number.isFinite(age) && age >= 0 && age <= 2
  const get = async (url, signal) => {
    const response = await fetch(url, { signal, redirect: 'error' })
    if (!response.ok) throw new Error('Telemetry HTTP ' + response.status)
    return response.json()
  }
  let ticket = randomUUID()
  let issued = performance.now()
  let active
  let stopping
  let receipt = null
  let lastRead = 0
  let sample
  let reading
  async function read() {
    const started = performance.now()
    const signal = AbortSignal.any([life.signal, AbortSignal.timeout(2500)])
    const [state, joint, lift, arm, cup] = await Promise.all([
      robot.getState({ signal }).catch(() => null), get(jointsUrl, signal).catch(() => null),
      get(liftUrl, signal).catch(() => null), readArm(signal).catch(() => null), readCup(signal).catch(() => null),
    ])
    const o = state?.odom
    const base = state?.ok && fresh(state.freshness_s?.odom) && typeof o?.frame_id === 'string' && [o.x,o.y,o.yaw].every(Number.isFinite)
      ? { frame: o.frame_id, x: o.x, y: o.y, yaw: o.yaw } : null
    const v = joint?.state
    const joints = joint?.ok && v?.ok && v.source === 'unitree_dds_lowstate' && fresh(v.dds?.lowstate_age_ms / 1000)
      ? Object.fromEntries(Object.entries(v.joints ?? {}).filter(([key,q]) => /^(left|right)_(shoulder_(pitch|roll|yaw)|elbow|wrist_(pitch|roll|yaw))_joint$/.test(key) && Number.isFinite(q))) : null
    const calibrated = lift?.ok && lift.offset_valid && fresh(lift.data_age_sec)
      && [lift.physical_height_m,lift.physical_min_m,lift.physical_max_m].every(Number.isFinite)
      && lift.physical_min_m <= lift.physical_height_m && lift.physical_height_m <= lift.physical_max_m
    let column = null
    if (calibrated) {
      const { physical_height_m: height, physical_min_m: min, physical_max_m: max } = lift
      const margin = settings.lift.arrivalMarginM
      const step = distance => distance > margin + Number.EPSILON ? Math.min(liftStepM, distance) : 0
      column = { height, min, max, raiseStep: step(max - margin - height), lowerStep: step(height - min) }
    }
    const taskCount = armTaskCount(arm)
    const stage = arm?.active_status?.stage
    sample = { base, joints, lift: column, taskCount, taskStage: taskCount > 0 && typeof stage === 'string' ? stage.slice(0, 80) : null,
      suction: cupState(cup) }
    lastRead = started
  }
  function allowed(action) {
    if (!Object.hasOwn(commands,action) || !byName.has(commands[action][0])) return false
    if (action === 'stop') return !stopping
    if (action === 'armStop') return !!settings.arm.consoleUrl && !stopping
    if (moving || active || stopping || !sample || performance.now() - lastRead > 2000) return false
    if (action === 'raise') return sample.lift?.raiseStep > 0
    if (action === 'lower') return sample.lift?.lowerStep > 0
    if (action === 'suck' || action === 'release') return sample.taskCount === 0 && sample.suction === (action === 'suck' ? 'off' : 'on')
    if (action === 'grasp' || action === 'rest') return Object.keys(sample.joints ?? {}).filter(k => k.startsWith('right_')).length === 7
    return sample.base !== null
  }
  const pending = new Set()
  ctx.provide('g1dOperator', {
    async state(signal) {
      signal.throwIfAborted()
      if (!sample || performance.now() - lastRead > 150) {
        reading ??= read().finally(() => { reading = undefined })
        await reading
      }
      signal.throwIfAborted()
      if (performance.now() - issued > 8000) { ticket = randomUUID(); issued = performance.now() }
      return JSON.stringify({ ...sample, ticket, actions: Object.keys(commands).filter(allowed), receipt })
    },
    submit(action, target, key) {
      life.signal.throwIfAborted()
      if (key !== ticket || performance.now() - issued > 8000 || !allowed(action)) throw new Error('Command unavailable or control state changed')
      if (typeof target !== 'string' || target.length > 80 || (action === 'grasp' ? !target.trim() : target !== '')) throw new Error('Invalid command target')
      const id = randomUUID()
      ticket = randomUUID()
      issued = performance.now()
      const stop = action === 'stop' || action === 'armStop'
      if (stop) stopping = id
      else active = id
      receipt = { id, action, status: 'running', detail: '' }
      const [name, args] = commands[action]
      const tool = byName.get(name)
      let input = args
      if (action === 'raise') input = { delta_m: sample.lift.raiseStep }
      if (action === 'lower') input = { delta_m: -sample.lift.lowerStep }
      if (action === 'grasp') input = { ...args, target: target.trim() }
      const job = Promise.resolve().then(() => tool.execute(input, { signal: life.signal })).then(result => {
        if (receipt.id !== id) return
        const text = tool.output.render(input, result).map(item => item.text).join(' ')
        receipt = { id, action, status: result.verified === false || (name === 'robot_lift' && result.verified !== true) ? 'unconfirmed' : 'returned', detail: text.slice(0,600) }
      }).catch(error => {
        if (receipt.id === id) receipt = { id, action, status: 'unconfirmed', detail: String(error.message ?? error).slice(0,600) }
      }).finally(() => {
        if (active === id) active = undefined
        if (stopping === id) stopping = undefined
        pending.delete(job)
        lastRead = -Infinity
      })
      pending.add(job)
      return id
    },
  })
  ctx.effect(() => async () => { life.abort(); await Promise.allSettled([...pending, reading]) })
}
