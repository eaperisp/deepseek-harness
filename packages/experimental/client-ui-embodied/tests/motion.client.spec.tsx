// @vitest-environment jsdom
/** The operator pad submits one command and renders only returned measurements. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ComponentProps } from 'react'
import { useOperatorState } from '../src/client/connection.tsx'
import { RobotTwin as Twin } from '../src/client/RobotTwin.tsx'
import { ActuatorCard } from '../src/client/ActuatorCard.tsx'
import { zh } from '../src/client/locales.ts'
import type { MotionPort, MotionState } from '../src/client/motion.ts'

const scene = vi.hoisted(() => ({ setPose: vi.fn(), setExtension: vi.fn(), reset: vi.fn(), dispose: vi.fn() }))
vi.mock('../src/client/robot-scene.ts', () => ({ mountRobotScene: async () => scene }))
afterEach(cleanup)

function RobotTwin(props: Omit<ComponentProps<typeof Twin>, 'state'>) {
  const state = useOperatorState(props.motion)
  return <Twin {...props} state={state} />
}

it('keeps actuator commands in the operator pad and live feedback in the inventory', async () => {
  const t = makeTranslate(zh)
  const submit = vi.fn(async () => 'cup')
  const state: NonNullable<MotionState> = { ticket: 'one', actions: ['suck', 'grasp'], suction: 'off', taskCount: 0,
    base: null, joints: null, lift: null, receipt: null }
  render(<RobotTwin motion={{ read: async () => state, submit }} lift={null} t={t}>
    <ActuatorCard id="arm" t={t}>{null}</ActuatorCard>
    <ActuatorCard id="suction" t={t}>{null}</ActuatorCard>
  </RobotTwin>)
  const arm = within(screen.getByRole('region', { name: '右机械臂' }))
  const cup = within(screen.getByRole('region', { name: '真空吸盘' }))
  await cup.findByText('吸取已关闭')
  expect(arm.getByText('空闲')).toBeTruthy()
  const controls = within(screen.getByRole('region', { name: '运控控制' }))
  expect(within(controls.getByRole('group', { name: '真空吸盘' })).getByText('在线')).toBeTruthy()
  expect(within(controls.getByRole('group', { name: '机械臂任务' })).getByText('离线')).toBeTruthy()
  expect(arm.queryByRole('textbox')).toBeNull()
  expect(cup.queryByRole('button', { name: '开始吸取' })).toBeNull()
  const pad = within(screen.getByRole('region', { name: '运控控制' }))
  fireEvent.change(pad.getByRole('textbox'), { target: { value: '42' } })
  expect(pad.getByRole('button', { name: '释放吸盘' }).hasAttribute('disabled')).toBe(true)
  await act(async () => { fireEvent.click(pad.getByRole('button', { name: '开始吸取' })) })
  fireEvent.click(pad.getByRole('button', { name: '抓取目标' }))
  expect(submit.mock.calls).toEqual([['suck', '', 'one']])
})

it('offers the remaining descent and displays the lower limit after measured arrival', async () => {
  let state: NonNullable<MotionState> = {
    ticket: 'partial', actions: ['raise', 'lower'], base: null, joints: null, receipt: null,
    lift: { height: .0948, min: 0, max: .427, raiseStep: .1, lowerStep: .0948 },
  }
  const submit = vi.fn(async () => 'last-step')
  render(<RobotTwin motion={{ read: async () => state, submit }} lift={null} t={makeTranslate(zh)} />)
  const lower = await screen.findByRole('button', { name: '降至下限' })
  expect(screen.getByText('9.5 厘米')).toBeTruthy()
  await act(async () => { fireEvent.click(lower) })
  expect(submit).toHaveBeenCalledWith('lower', '', 'partial')
  state = { ...state, ticket: 'arrived', actions: ['raise'], lift: { height: .0007, min: 0, max: .427, raiseStep: .1, lowerStep: 0 },
    receipt: { id: 'last-step', action: 'lower', status: 'returned', detail: '' } }
  expect((await screen.findByRole('button', { name: '已到下限' })).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('立柱下降')).toBeTruthy()
  expect(screen.getByText('0.1 厘米')).toBeTruthy()
  expect(within(screen.getByRole('group', { name: '立柱' })).getByText('在线')).toBeTruthy()
})

it('keeps the lift at the measured position until the operator returns a newer sample', async () => {
  let state: NonNullable<MotionState> = {
    ticket: 'first', actions: ['raise', 'grasp'], base: null, joints: null,
    lift: { height: .27, min: 0, max: .43 }, receipt: null,
  }
  const submitted = Promise.withResolvers<string>()
  const submit = vi.fn(() => submitted.promise)
  const port: MotionPort = { read: async () => state, submit }
  render(<RobotTwin motion={port} lift={null} t={makeTranslate(zh)} />)
  await screen.findByText('27.0 厘米')
  const raise = screen.getByRole('button', { name: '升高 10 厘米' })
  fireEvent.click(raise)
  fireEvent.click(raise)
  expect(submit).toHaveBeenCalledTimes(1)
  expect(submit).toHaveBeenCalledWith('raise', '', 'first')
  expect(scene.setExtension).toHaveBeenLastCalledWith(.27)
  await act(async () => { submitted.resolve('receipt'); await submitted.promise })
  state = { ...state, ticket: 'next', lift: { height: .37, min: 0, max: .43 } }
  await waitFor(() => { expect(scene.setExtension).toHaveBeenLastCalledWith(.37) })
  expect(await screen.findByText('37.0 厘米')).toBeTruthy()
  const pick = screen.getByRole('button', { name: '抓取目标' })
  expect(pick.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('抓取物名称或 ID'), { target: { value: '42' } })
  await act(async () => { fireEvent.click(pick) })
  expect(submit).toHaveBeenCalledWith('grasp', '42', 'next')
})
