export interface MovementInputKeys {
  up: { isDown: boolean };
  down: { isDown: boolean };
  left: { isDown: boolean };
  right: { isDown: boolean };
  arrowUp?: { isDown: boolean };
  arrowDown?: { isDown: boolean };
  arrowLeft?: { isDown: boolean };
  arrowRight?: { isDown: boolean };
}

export interface MovementVector {
  x: number;
  y: number;
}

export interface MutableMovementVector extends MovementVector {
  set: (x: number, y: number) => unknown;
}

export interface MovementTuning {
  speed: number;
  ySpeedScale: number;
  acceleration: number;
  deceleration: number;
  stopThreshold: number;
  turnBoost: number;
  launchBoost: number;
  releaseSnapThreshold: number;
  runBoost: number;
  runAfterMs: number;
  runRampMs: number;
  footworkResponsiveness: number;
  turnAnticipation: number;
  stopGrip: number;
  strideSnap: number;
  brakeAssist: number;
}

export interface MovementStepResult {
  moving: boolean;
  velocity: MovementVector;
  direction: MovementVector;
  momentumState: 'idle' | 'launch' | 'walk' | 'run' | 'hard-turn' | 'brake';
  runFactor: number;
  groundedSpeed: number;
  strideIntensity: number;
  strideIntervalMs: number;
  footPlantPhase: number;
  bodyLean: number;
  shadowLead: MovementVector;
  trailIntensity: number;
  cameraLead: MovementVector;
  tractionGrip: number;
  brakingSnap: boolean;
  driftSuppression: number;
  inputResponsiveness: number;
  turnAnticipation: number;
  stopGrip: number;
  cinematicSnap: number;
  accelerationBurst: number;
  brakingGrip: number;
  stepBeat: number;
  movePolishLevel: number;
  releaseBrakeAssist: number;
}

export const apprenticeMovementTuning: MovementTuning = {
  speed: 318,
  ySpeedScale: 0.76,
  acceleration: 118,
  deceleration: 214,
  stopThreshold: 16,
  turnBoost: 5.35,
  launchBoost: 1.78,
  releaseSnapThreshold: 132,
  runBoost: 0.28,
  runAfterMs: 70,
  runRampMs: 185,
  footworkResponsiveness: 0.7,
  turnAnticipation: 0.23,
  stopGrip: 0.88,
  strideSnap: 0.42,
  brakeAssist: 0.68,
};

export function readMovementInput(keys: MovementInputKeys): MovementVector {
  const input = { x: 0, y: 0 };
  if (keys.left.isDown || keys.arrowLeft?.isDown) input.x -= 1;
  if (keys.right.isDown || keys.arrowRight?.isDown) input.x += 1;
  if (keys.up.isDown || keys.arrowUp?.isDown) input.y -= 1;
  if (keys.down.isDown || keys.arrowDown?.isDown) input.y += 1;
  const length = Math.hypot(input.x, input.y);
  if (length > 0) {
    input.x /= length;
    input.y /= length;
  }
  return input;
}

export function stepMovementVelocity(
  currentVelocity: MutableMovementVector,
  input: MovementVector,
  deltaMs: number,
  tuning: MovementTuning = apprenticeMovementTuning,
  sustainedMoveMs = 0,
): MovementStepResult {
  const moving = input.x * input.x + input.y * input.y > 0;
  const runFactor = moving
    ? 1 + tuning.runBoost * clamp01((sustainedMoveMs - tuning.runAfterMs) / Math.max(1, tuning.runRampMs))
    : 1;
  const target = {
    x: input.x * tuning.speed * runFactor,
    y: input.y * tuning.speed * tuning.ySpeedScale * runFactor,
  };
  const currentLength = Math.hypot(currentVelocity.x, currentVelocity.y);
  const targetLength = Math.hypot(target.x, target.y);
  const alignment = moving && currentLength > tuning.stopThreshold && targetLength > 0
    ? (currentVelocity.x * target.x + currentVelocity.y * target.y) / Math.max(1, currentLength * targetLength)
    : 1;
  const reversing =
    moving &&
    currentLength > tuning.stopThreshold &&
    alignment < 0;
  const hardTurn = moving && currentLength > tuning.stopThreshold && alignment < 0.38;
  const launching = moving && currentLength < targetLength * 0.42;
  const rate =
    (moving ? tuning.acceleration : tuning.deceleration) *
    (reversing ? tuning.turnBoost : 1) *
    (launching ? tuning.launchBoost : 1);
  const alpha = 1 - Math.exp(-rate * Math.max(0, deltaMs) / 1000);
  currentVelocity.x += (target.x - currentVelocity.x) * alpha;
  currentVelocity.y += (target.y - currentVelocity.y) * alpha;
  let intentBlend = 0;
  let turnAnticipation = 0;

  if (moving && currentLength > tuning.stopThreshold) {
    intentBlend = PhaserFreeClamp(tuning.footworkResponsiveness * Math.max(0, deltaMs) / 100, 0, 0.22);
    currentVelocity.x += (target.x - currentVelocity.x) * intentBlend;
    currentVelocity.y += (target.y - currentVelocity.y) * intentBlend;
  }
  if (hardTurn) {
    turnAnticipation = PhaserFreeClamp((0.38 - alignment) * tuning.turnAnticipation, 0, 0.2);
    currentVelocity.x += target.x * turnAnticipation;
    currentVelocity.y += target.y * turnAnticipation;
  }

  const driftSuppression = !moving
    ? clamp01((tuning.releaseSnapThreshold * 1.9 - currentLength) / Math.max(1, tuning.releaseSnapThreshold * 1.9))
    : 0;
  if (!moving && driftSuppression > 0) {
    const brakeAlpha = PhaserFreeClamp(
      (driftSuppression * tuning.stopGrip + tuning.brakeAssist * 0.22) * Math.max(0, deltaMs) / 80,
      0,
      0.86,
    );
    currentVelocity.x *= 1 - brakeAlpha;
    currentVelocity.y *= 1 - brakeAlpha;
  }

  const velocityLengthSq = currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y;
  const snapThreshold = moving ? tuning.stopThreshold : tuning.releaseSnapThreshold;
  let brakingSnap = false;
  if (velocityLengthSq < snapThreshold * snapThreshold) {
    currentVelocity.set(0, 0);
    brakingSnap = !moving;
  }
  const groundedSpeed = Math.hypot(currentVelocity.x, currentVelocity.y / Math.max(0.1, tuning.ySpeedScale));
  const strideIntensity = moving ? clamp01((groundedSpeed - 32) / 142) * (0.98 + (runFactor - 1) * 1.85) : 0;
  const strideIntervalMs = PhaserFreeClamp(118 - (runFactor - 1) * 162 - clamp01(groundedSpeed / 300) * 40, 66, 128);
  const footPlantPhase = moving ? Math.round((((sustainedMoveMs / Math.max(1, strideIntervalMs)) % 1) * 1000)) / 1000 : 0;
  const stepBeat = moving ? Math.round(Math.abs(Math.sin(footPlantPhase * Math.PI * 2)) * 1000) / 1000 : 0;
  const cinematicSpeed = clamp01(groundedSpeed / (tuning.speed * (1 + tuning.runBoost)));
  const cinematicSnap = PhaserFreeClamp(alpha + intentBlend + turnAnticipation + driftSuppression * 0.28, 0, 1);
  const momentumState: MovementStepResult['momentumState'] = !moving
    ? (currentLength > tuning.stopThreshold ? 'brake' : 'idle')
    : hardTurn
      ? 'hard-turn'
      : runFactor > 1.1
          ? 'run'
          : launching
            ? 'launch'
            : 'walk';
  const bodyLean = moving
    ? PhaserFreeClamp((currentVelocity.x / Math.max(1, tuning.speed)) * 0.16 + (input.x - input.y * 0.28) * 0.054 + turnAnticipation * Math.sign(input.x || currentVelocity.x || 1), -0.25, 0.25)
    : PhaserFreeClamp((currentVelocity.x / Math.max(1, tuning.speed)) * 0.06, -0.07, 0.07);
  const shadowLead = {
    x: currentVelocity.x * 0.021 * cinematicSpeed,
    y: (currentVelocity.y / Math.max(0.1, tuning.ySpeedScale)) * 0.009 * cinematicSpeed,
  };
  const cameraLead = {
    x: currentVelocity.x * 0.03 * cinematicSpeed,
    y: currentVelocity.y * 0.02 * cinematicSpeed,
  };

  return {
    moving,
    velocity: { x: currentVelocity.x, y: currentVelocity.y },
    direction: moving ? { x: input.x, y: input.y } : { x: 0, y: 0 },
    momentumState,
    runFactor,
    groundedSpeed,
    strideIntensity,
    strideIntervalMs,
    footPlantPhase,
    bodyLean,
    shadowLead,
    trailIntensity: moving ? clamp01((groundedSpeed - tuning.speed * 0.78) / (tuning.speed * 0.42)) : 0,
    cameraLead,
    tractionGrip: PhaserFreeClamp(alpha + intentBlend + (reversing ? 0.18 : 0), 0, 1),
    brakingSnap,
    driftSuppression: Math.round(driftSuppression * 1000) / 1000,
    inputResponsiveness: Math.round(rate * 10) / 10,
    turnAnticipation: Math.round(turnAnticipation * 1000) / 1000,
    stopGrip: Math.round(tuning.stopGrip * 1000) / 1000,
    cinematicSnap: Math.round(cinematicSnap * 1000) / 1000,
    accelerationBurst: Math.round((launching ? tuning.launchBoost : hardTurn ? tuning.turnBoost : 1) * 1000) / 1000,
    brakingGrip: Math.round((driftSuppression * tuning.stopGrip) * 1000) / 1000,
    stepBeat,
    movePolishLevel: Math.round((tuning.strideSnap + tuning.brakeAssist + tuning.footworkResponsiveness) * 1000) / 1000,
    releaseBrakeAssist: Math.round(tuning.brakeAssist * 1000) / 1000,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function PhaserFreeClamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
