/** Deterministic mobile-manipulator provider used for integration and deployment rehearsal. */

import { brandString } from '@deepseek-ai/dsh-brand'
import type {
  RobotCapability,
  RobotCapabilityId,
  RobotOperationId,
  RobotOperationOutcome,
  RobotProvider,
  RobotProviderExecutionRequest,
  RobotProviderId,
} from '@deepseek-ai/dsh-robot'

type CompletedOutput = Extract<RobotOperationOutcome, { kind: 'completed' }>['output']

/** Validated simulated-provider configuration. */
export interface SimulatedRobotConfig {
  readonly providerId: string
  readonly providerName: string
  readonly obstacleDistanceMeters: number
  readonly recognizedObjectLabel: string
}

/** Mutable state belongs to this provider instance and disappears with its plugin fiber. */
export class SimulatedRobotProvider implements RobotProvider {
  readonly info
  private xMeters = 0
  private yMeters = 0
  private headingDegrees = 0
  private gripperOpeningPercent = 100

  constructor(private readonly config: SimulatedRobotConfig) {
    this.info = {
      id: providerId(config.providerId),
      name: config.providerName,
      description: 'Deterministic in-process mobile manipulator used to verify discovery, observation, approval, and action flows.',
    }
  }

  /** Return the current simulated capability declaration. */
  discover(signal: AbortSignal): Promise<readonly RobotCapability[]> {
    signal.throwIfAborted()
    return Promise.resolve([
      capability('radar', 'Range radar', 'Measures nearby obstacle distance.', 'sensor', [
        operation('scan', 'Scan surroundings', 'Return the nearest obstacle distance in the robot frame.', 'observe'),
      ]),
      capability('camera', 'RGB camera', 'Captures a summarized forward camera frame.', 'sensor', [
        operation('capture_summary', 'Capture frame summary', 'Return frame metadata and a concise scene description.', 'observe'),
      ]),
      capability('object_recognition', 'Object recognition', 'Recognizes objects in the latest camera view.', 'perception', [
        operation('recognize_objects', 'Recognize objects', 'Return recognized labels, confidence, and robot-frame positions.', 'observe'),
      ]),
      capability('spatial_perception', 'Spatial perception', 'Reports the robot pose in the local map frame.', 'perception', [
        operation('localize', 'Read local pose', 'Return position and heading in the local map frame.', 'observe'),
      ]),
      capability('gripper', 'Parallel gripper', 'Controls the end-effector finger opening.', 'actuator', [
        operation('set_opening', 'Set gripper opening', 'Set the gripper opening as a percentage.', 'act', [{
          name: 'opening_percent', description: 'Requested finger opening.', type: 'number', required: true,
          minimum: 0, maximum: 100, unit: 'percent',
        }]),
      ]),
      capability('mobile_base', 'Mobile base', 'Moves the robot in its local planar frame.', 'mobility', [
        operation('move_relative', 'Move relative', 'Move forward and rotate relative to the current pose.', 'act', [
          { name: 'linear_meters', description: 'Forward distance; negative values move backward.', type: 'number', required: true, minimum: -2, maximum: 2, unit: 'm' },
          { name: 'angular_degrees', description: 'Counter-clockwise rotation.', type: 'number', required: true, minimum: -180, maximum: 180, unit: 'degree' },
        ]),
      ]),
    ])
  }

  /** Execute one simulated observation or action. */
  execute(request: RobotProviderExecutionRequest, signal: AbortSignal): Promise<RobotOperationOutcome> {
    signal.throwIfAborted()
    const key = `${request.capabilityId}/${request.operationId}`
    switch (key) {
      case 'radar/scan':
        return completed({ nearestObstacle: { distanceMeters: this.config.obstacleDistanceMeters, bearingDegrees: 12 } }, 'Radar scan completed')
      case 'camera/capture_summary':
        return completed({ width: 1280, height: 720, encoding: 'rgb8', scene: `A ${this.config.recognizedObjectLabel} is visible ahead.` }, 'Camera frame summarized')
      case 'object_recognition/recognize_objects':
        return completed({ objects: [{ label: this.config.recognizedObjectLabel, confidence: 0.96, positionRobotMeters: { x: 0.8, y: 0.1, z: 0.2 } }] }, 'One object recognized')
      case 'spatial_perception/localize':
        return completed({ frame: 'local_map', xMeters: this.xMeters, yMeters: this.yMeters, headingDegrees: this.headingDegrees }, 'Robot pose read')
      case 'gripper/set_opening': {
        const previous = this.gripperOpeningPercent
        this.gripperOpeningPercent = numberArgument(request, 'opening_percent')
        return completed({ previousOpeningPercent: previous, openingPercent: this.gripperOpeningPercent }, 'Gripper opening changed')
      }
      case 'mobile_base/move_relative': {
        const linear = numberArgument(request, 'linear_meters')
        const angular = numberArgument(request, 'angular_degrees')
        const radians = this.headingDegrees * Math.PI / 180
        this.xMeters += linear * Math.cos(radians)
        this.yMeters += linear * Math.sin(radians)
        this.headingDegrees = normalizeDegrees(this.headingDegrees + angular)
        return completed({ frame: 'local_map', xMeters: this.xMeters, yMeters: this.yMeters, headingDegrees: this.headingDegrees }, 'Mobile base pose changed')
      }
      default:
        throw new Error(`unsupported simulated robot operation: ${key}`)
    }
  }
}

function providerId(value: string): RobotProviderId { return brandString<RobotProviderId>(value) }
function capabilityId(value: string): RobotCapabilityId { return brandString<RobotCapabilityId>(value) }
function operationId(value: string): RobotOperationId { return brandString<RobotOperationId>(value) }

function capability(
  id: string,
  name: string,
  description: string,
  category: RobotCapability['category'],
  operations: RobotCapability['operations'],
): RobotCapability {
  return { id: capabilityId(id), name, description, category, status: { kind: 'ready' }, operations }
}

function operation(
  id: string,
  name: string,
  description: string,
  mode: 'observe' | 'act',
  args: RobotCapability['operations'][number]['arguments'] = [],
): RobotCapability['operations'][number] {
  return { id: operationId(id), name, description, mode, arguments: args }
}

function completed(output: CompletedOutput, summary: string): Promise<RobotOperationOutcome> {
  return Promise.resolve({ kind: 'completed', output, summary })
}

function numberArgument(request: RobotProviderExecutionRequest, name: string): number {
  const value = request.arguments[name]
  if (typeof value !== 'number') throw new TypeError(`simulated robot argument ${name} must be a number`)
  return value
}

function normalizeDegrees(value: number): number {
  return (value % 360 + 360) % 360
}
