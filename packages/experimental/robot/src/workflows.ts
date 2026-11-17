/** Standard portable workflows for beginner robot development. */

import { brandString } from '@deepseek-ai/dsh-brand'
import type {
  RobotCapabilityId,
  RobotOperationId,
  RobotOperationMode,
  RobotWorkflowAlternative,
  RobotWorkflowDefinition,
  RobotWorkflowId,
  RobotWorkflowRequirement,
  RobotWorkflowRequirementId,
  RobotWorkflowStage,
  RobotWorkflowStageId,
} from './types.ts'

const capabilityId = (value: string): RobotCapabilityId => brandString<RobotCapabilityId>(value)
const operationId = (value: string): RobotOperationId => brandString<RobotOperationId>(value)
const workflowId = (value: string): RobotWorkflowId => brandString<RobotWorkflowId>(value)
const requirementId = (value: string): RobotWorkflowRequirementId => brandString<RobotWorkflowRequirementId>(value)
const stageId = (value: string): RobotWorkflowStageId => brandString<RobotWorkflowStageId>(value)

function alternative(capability: string, operation: string, mode: RobotOperationMode = 'observe'): RobotWorkflowAlternative {
  return { capabilityId: capabilityId(capability), operationId: operationId(operation), mode }
}

function requirement(
  id: string,
  name: string,
  description: string,
  alternatives: readonly RobotWorkflowAlternative[],
  required = true,
): RobotWorkflowRequirement {
  return { id: requirementId(id), name, description, required, alternatives }
}

function stage(
  id: string,
  name: string,
  description: string,
  requirements: readonly string[],
  verification: readonly string[],
): RobotWorkflowStage {
  return { id: stageId(id), name, description, requirementIds: requirements.map(requirementId), verification }
}

/** Repository-owned workflow definitions available to every robot deployment. */
export const standardRobotWorkflows: readonly RobotWorkflowDefinition[] = [
  {
    id: workflowId('spatial-memory'),
    name: 'Spatial memory',
    description: 'Explore an environment, attach semantic observations to stable poses, and later recall where an object or place was observed.',
    category: 'spatial-memory',
    reference: 'https://github.com/Stanford-TML/homebody',
    requirements: [
      requirement('camera-frame', 'Calibrated camera frame', 'Capture an RGB or RGB-D frame with acquisition time and sensor frame identity.', [alternative('camera', 'capture_frame'), alternative('camera', 'capture_summary')]),
      requirement('localization', 'Fresh localization', 'Read a timestamped robot pose in a declared map frame.', [alternative('spatial', 'read_state'), alternative('spatial_perception', 'localize')]),
      requirement('semantic-observation', 'Semantic observation', 'Return object or place labels with confidence and observation frame.', [alternative('vision', 'recognize_objects'), alternative('object_recognition', 'recognize_objects')]),
      requirement('memory-write', 'Memory write', 'Store an observation with time, pose, frame and evidence provenance.', [alternative('spatial_memory', 'remember', 'act')]),
      requirement('memory-query', 'Memory query', 'Recall matching observations without treating historical coordinates as current targets.', [alternative('spatial_memory', 'recall')]),
      requirement('navigation', 'Guarded navigation', 'Plan and execute navigation only after localization, map and safety checks pass.', [alternative('navigation', 'navigate_to', 'act'), alternative('mobile_base', 'move_relative', 'act')], false),
      requirement('manipulation', 'Object manipulation', 'Pick or place after current perception, transforms and collision checks pass.', [alternative('manipulation', 'pick', 'act'), alternative('gripper', 'set_opening', 'act')], false),
    ],
    stages: [
      stage('qualify-sensors', 'Qualify sensors and frames', 'Connect camera and localization adapters, then establish time synchronization and frame transforms.', ['camera-frame', 'localization'], ['Frames and units are named.', 'Camera and pose timestamps meet the deployment freshness limit.', 'An independent pose check stays within the configured error limit.']),
      stage('build-memory', 'Build semantic memory', 'Record semantic observations with source evidence instead of storing labels or coordinates alone.', ['semantic-observation', 'memory-write'], ['Every record retains the source frame, pose, time and confidence.', 'Restart and reload preserve the same memory records.']),
      stage('recall-and-verify', 'Recall and re-observe', 'Query historical observations, navigate only when available, and verify the target with current sensing.', ['memory-query', 'navigation'], ['Recall distinguishes historical and current coordinates.', 'A live observation confirms the target before any manipulation.', 'Failures leave navigation and manipulation stopped.']),
    ],
  },
  {
    id: workflowId('simulation'),
    name: 'Simulation and real-to-sim',
    description: 'Develop and replay robot tasks in a physics simulator before selecting an approved path for real hardware.',
    category: 'simulation',
    requirements: [
      requirement('scene-load', 'Scene loading', 'Load a versioned robot, sensors, controllers and environment description.', [alternative('simulation', 'load_scene')]),
      requirement('simulation-run', 'Deterministic simulation run', 'Run a bounded episode with an explicit seed, time step and stop conditions.', [alternative('simulation', 'run_episode')]),
      requirement('metrics', 'Episode metrics', 'Report task success, collisions, limits, timing and replay artifacts.', [alternative('simulation', 'read_metrics')]),
      requirement('real-to-sim', 'Real-to-sim reconstruction', 'Create a reviewable simulation asset from captured geometry and calibration.', [alternative('simulation', 'reconstruct_scene')], false),
      requirement('policy-transfer', 'Approved hardware transfer', 'Apply a simulation-qualified policy through the normal approved robot action path.', [alternative('deployment', 'activate_policy', 'act')], false),
    ],
    stages: [
      stage('prepare-model', 'Prepare the digital twin', 'Pin robot geometry, joint limits, sensors, controller rates and environment assets.', ['scene-load', 'real-to-sim'], ['Robot joints and collision geometry match the target revision.', 'Sensor intrinsics, extrinsics and rates are recorded.', 'Assets and randomization settings are versioned.']),
      stage('run-evaluation', 'Run reproducible evaluation', 'Execute bounded episodes and retain metrics and replay evidence.', ['simulation-run', 'metrics'], ['The same seed reproduces the tested trajectory within tolerance.', 'Collision, joint-limit and timeout failures are visible.', 'A failed episode cannot be reported as task success.']),
      stage('transfer-safely', 'Transfer through hardware safeguards', 'Start with reduced limits and observation-only checks before enabling an approved action provider.', ['policy-transfer'], ['The real controller enforces limits and emergency stop independently.', 'Sim-to-real acceptance thresholds are explicit.', 'Every physical action still uses approval and post-action verification.']),
    ],
  },
  {
    id: workflowId('hand-eye-calibration'),
    name: 'Hand-eye calibration',
    description: 'Estimate, apply and independently verify eye-in-hand or eye-to-hand transforms without hiding poor samples or residuals.',
    category: 'calibration',
    reference: 'https://moveit.picknik.ai/main/doc/examples/hand_eye_calibration/hand_eye_calibration_tutorial.html',
    requirements: [
      requirement('camera-frame', 'Calibration camera frames', 'Capture timestamped images with fixed intrinsics and target observations.', [alternative('camera', 'capture_frame')]),
      requirement('arm-pose', 'Robot pose feedback', 'Read timestamped end-effector and base transforms in declared frames.', [alternative('arm', 'read_pose')]),
      requirement('calibration-motion', 'Guarded calibration motion', 'Move through approved, collision-checked calibration poses.', [alternative('arm', 'move_calibration_pose', 'act')]),
      requirement('sample-capture', 'Synchronized sample capture', 'Pair target observations and robot poses without reusing stale data.', [alternative('hand_eye_calibration', 'capture_sample')]),
      requirement('transform-solve', 'Transform solver', 'Solve a selected eye-in-hand or eye-to-hand model and expose residuals.', [alternative('hand_eye_calibration', 'solve')]),
      requirement('transform-apply', 'Explicit transform application', 'Publish or save the selected transform only after review.', [alternative('hand_eye_calibration', 'apply_transform', 'act')]),
    ],
    stages: [
      stage('configure-frames', 'Configure frames and target', 'Declare the calibration type, parent and child frames, target geometry and camera intrinsics.', ['camera-frame', 'arm-pose'], ['Frame directions are unambiguous.', 'Intrinsics and target dimensions match the physical setup.', 'Robot and camera clocks meet the synchronization limit.']),
      stage('collect-samples', 'Collect diverse samples', 'Use approved motion to capture synchronized observations across varied rotations and translations.', ['calibration-motion', 'sample-capture'], ['Samples cover multiple axes and avoid near-duplicate poses.', 'Rejected detections and stale pairs remain visible.', 'The physical workspace stays within configured safety limits.']),
      stage('solve-and-verify', 'Solve, apply and verify', 'Inspect residuals, apply the chosen transform explicitly, then test on poses excluded from solving.', ['transform-solve', 'transform-apply'], ['Residuals meet configured translation and rotation limits.', 'Independent target poses meet the task-space error limit.', 'The previous transform remains recoverable if verification fails.']),
    ],
  },
  {
    id: workflowId('gravity-compensation'),
    name: 'Gravity compensation',
    description: 'Identify payload and model terms, enable one gravity-compensation owner, and verify safe stationary and moving behavior.',
    category: 'dynamics',
    requirements: [
      requirement('joint-state', 'Joint state feedback', 'Read synchronized joint position and velocity with units and timestamps.', [alternative('arm', 'read_joint_state')]),
      requirement('torque-feedback', 'Joint torque feedback', 'Read measured or estimated joint torque and identify its source.', [alternative('arm', 'read_joint_torque')]),
      requirement('dynamics-model', 'Robot dynamics model', 'Calculate model gravity terms for the configured robot and tool.', [alternative('dynamics', 'compute_gravity')]),
      requirement('payload-identification', 'Payload identification', 'Estimate or configure payload mass and center of mass with uncertainty.', [alternative('dynamics', 'identify_payload')]),
      requirement('compensation-control', 'Guarded compensation control', 'Enable or disable compensation through the controller that owns torque commands.', [alternative('dynamics', 'set_gravity_compensation', 'act')]),
      requirement('wrench-feedback', 'Force-torque feedback', 'Read an independently zeroed end-effector wrench for verification.', [alternative('force_torque', 'read_wrench')], false),
    ],
    stages: [
      stage('establish-ownership', 'Establish controller ownership', 'Determine whether firmware, the robot SDK or the application adds gravity and friction terms.', ['joint-state', 'torque-feedback', 'dynamics-model'], ['Exactly one layer owns gravity compensation.', 'Torque units, sign conventions and joint order are verified.', 'Emergency stop and torque limits remain controller-enforced.']),
      stage('identify-payload', 'Identify payload', 'Record tool mass, center of mass and uncertainty using safe static poses.', ['payload-identification', 'wrench-feedback'], ['The payload configuration names the tool revision.', 'Identification residuals meet configured limits.', 'An implausible estimate blocks controller activation.']),
      stage('enable-and-verify', 'Enable and verify compensation', 'Enable compensation at reduced limits, test stationary poses, then test slow bounded motion.', ['compensation-control'], ['No double compensation is present.', 'Stationary drift and residual torque meet configured limits.', 'Disable and recovery paths are tested before normal operation.']),
    ],
  },
]
