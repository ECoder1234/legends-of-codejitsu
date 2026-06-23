import Phaser from 'phaser';
import type { ArenaClampResult, ArenaClampSide } from './transition';

export interface RuntimeActorBounds {
  scene: string;
  x: number;
  y: number;
  pose?: string;
  frameIndex?: number;
  frameCount?: number;
  sourcePose?: string;
  renderVariant?: string;
  motionProfile?: string;
  momentumState?: string;
  visualScale?: number;
  visualStride?: number;
  visualGrounded?: boolean;
  footPlantPhase?: number;
  tractionGrip?: number;
  brakingSnap?: boolean;
  driftSuppression?: number;
  inputResponsiveness?: number;
  turnAnticipation?: number;
  stopGrip?: number;
  cinematicSnap?: number;
  accelerationBurst?: number;
  brakingGrip?: number;
  stepBeat?: number;
  movePolishLevel?: number;
  releaseBrakeAssist?: number;
  bounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  arena?: {
    leftAtY: number;
    rightAtY: number;
    topWidthRatio: number;
  };
}

export interface RuntimeFrameHealth {
  scene: string;
  frames: number;
  maxDeltaMs: number;
  longFrameCount: number;
  healthy: boolean;
  lastDeltaMs: number;
  at: number;
}

export function publishPlayerBounds(
  sceneName: string,
  player: Phaser.GameObjects.Sprite,
  bounds: Phaser.Geom.Rectangle,
  arenaTopWidthRatio?: number,
): void {
  let arenaPayload: RuntimeActorBounds['arena'];
  if (arenaTopWidthRatio !== undefined) {
    const arena = arenaRangeAtY(player.y, bounds, arenaTopWidthRatio);
    arenaPayload = {
      leftAtY: Math.round(arena.left * 10) / 10,
      rightAtY: Math.round(arena.right * 10) / 10,
      topWidthRatio: arenaTopWidthRatio,
    };
  }
  (window as Window & { __CODEJITSU_PLAYER_BOUNDS?: RuntimeActorBounds }).__CODEJITSU_PLAYER_BOUNDS = {
    scene: sceneName,
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    pose: player.getData('actorPose') as string | undefined,
    frameIndex: player.getData('actorFrameIndex') as number | undefined,
    frameCount: player.getData('actorFrameCount') as number | undefined,
    sourcePose: player.getData('actorSourcePose') as string | undefined,
    renderVariant: player.getData('actorRenderVariant') as string | undefined,
    motionProfile: player.getData('actorMotionProfile') as string | undefined,
    momentumState: player.getData('actorMomentumState') as string | undefined,
    visualScale: player.getData('actorVisualScale') as number | undefined,
    visualStride: player.getData('actorVisualStride') as number | undefined,
    visualGrounded: player.getData('actorVisualGrounded') as boolean | undefined,
    footPlantPhase: player.getData('actorFootPlantPhase') as number | undefined,
    tractionGrip: player.getData('actorTractionGrip') as number | undefined,
    brakingSnap: player.getData('actorBrakingSnap') as boolean | undefined,
    driftSuppression: player.getData('actorDriftSuppression') as number | undefined,
    inputResponsiveness: player.getData('actorInputResponsiveness') as number | undefined,
    turnAnticipation: player.getData('actorTurnAnticipation') as number | undefined,
    stopGrip: player.getData('actorStopGrip') as number | undefined,
    cinematicSnap: player.getData('actorCinematicSnap') as number | undefined,
    accelerationBurst: player.getData('actorAccelerationBurst') as number | undefined,
    brakingGrip: player.getData('actorBrakingGrip') as number | undefined,
    stepBeat: player.getData('actorStepBeat') as number | undefined,
    movePolishLevel: player.getData('actorMovePolishLevel') as number | undefined,
    releaseBrakeAssist: player.getData('actorReleaseBrakeAssist') as number | undefined,
    bounds: {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
    },
    arena: arenaPayload,
  };
}

function arenaRangeAtY(y: number, bounds: Phaser.Geom.Rectangle, topWidthRatio: number): { left: number; right: number } {
  const clampedY = Phaser.Math.Clamp(y, bounds.top, bounds.bottom);
  const progress = Phaser.Math.Clamp((clampedY - bounds.top) / Math.max(1, bounds.height), 0, 1);
  const eased = 1 - Math.pow(1 - progress, 1.35);
  const widthAtY = bounds.width * Phaser.Math.Linear(topWidthRatio, 1, eased);
  return {
    left: bounds.centerX - widthAtY / 2,
    right: bounds.centerX + widthAtY / 2,
  };
}

export function publishSwordSwing(
  sceneName: string,
  x: number,
  y: number,
  hitX: number,
  hitY: number,
  variant: number,
  targetId = '',
  visual: { usesImagegenVfx?: boolean; primitivePieces?: number; vfxFrameIndex?: number } = {},
): void {
  (window as Window & {
    __CODEJITSU_SWORD_SWING?: {
      scene: string;
      inputKey: 'x';
      weapon: 'sword';
      removedKeys: string[];
      hasBlade: boolean;
      usesImagegenVfx: boolean;
      primitivePieces: number;
      vfxFrameIndex: number;
      x: number;
      y: number;
      hitX: number;
      hitY: number;
      variant: number;
      targetId: string;
      aimedAtTarget: boolean;
      at: number;
    };
  }).__CODEJITSU_SWORD_SWING = {
    scene: sceneName,
    inputKey: 'x',
    weapon: 'sword',
    removedKeys: ['j'],
    hasBlade: true,
    usesImagegenVfx: visual.usesImagegenVfx === true,
    primitivePieces: Number(visual.primitivePieces ?? 0),
    vfxFrameIndex: Number(visual.vfxFrameIndex ?? -1),
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    hitX: Math.round(hitX * 10) / 10,
    hitY: Math.round(hitY * 10) / 10,
    variant,
    targetId,
    aimedAtTarget: targetId.length > 0,
    at: Math.round(performance.now()),
  };
}

export function publishControlScheme(sceneName: string): void {
  (window as Window & {
    __CODEJITSU_CONTROL_SCHEME?: {
      scene: string;
      move: string;
      swing: string;
      terminal: string;
      removedAttackKeys: string[];
      at: number;
    };
  }).__CODEJITSU_CONTROL_SCHEME = {
    scene: sceneName,
    move: 'WASD',
    swing: 'X',
    terminal: 'T',
    removedAttackKeys: ['J'],
    at: Math.round(performance.now()),
  };
}

export function publishFrameHealth(sceneName: string, deltaMs: number): void {
  const runtime = window as Window & {
    __CODEJITSU_FRAME_HEALTH?: Record<string, RuntimeFrameHealth>;
  };
  const previous = runtime.__CODEJITSU_FRAME_HEALTH?.[sceneName];
  const normalizedDelta = Math.max(0, Math.min(1000, deltaMs));
  const frames = (previous?.frames ?? 0) + 1;
  const ignoredWarmup = frames <= 2;
  const maxDeltaMs = ignoredWarmup
    ? Math.max(previous?.maxDeltaMs ?? 0, 0)
    : Math.max(previous?.maxDeltaMs ?? 0, Math.round(normalizedDelta * 10) / 10);
  const longFrameCount = (previous?.longFrameCount ?? 0) + (!ignoredWarmup && normalizedDelta > 220 ? 1 : 0);
  const entry: RuntimeFrameHealth = {
    scene: sceneName,
    frames,
    maxDeltaMs,
    longFrameCount,
    healthy: maxDeltaMs <= 260 && longFrameCount <= 1,
    lastDeltaMs: Math.round(normalizedDelta * 10) / 10,
    at: Math.round(performance.now()),
  };
  runtime.__CODEJITSU_FRAME_HEALTH = {
    ...(runtime.__CODEJITSU_FRAME_HEALTH ?? {}),
    [sceneName]: entry,
  };
}

export interface RuntimePhysicsGuard {
  scene: string;
  reason: string;
  x: number;
  y: number;
  at: number;
}

export function guardedSetVelocity(
  sceneName: string,
  sprite: Phaser.Physics.Arcade.Sprite,
  x: number,
  y: number,
): boolean {
  if (sprite.body) {
    sprite.setVelocity(x, y);
    return true;
  }
  if (!sprite.active || !sprite.scene) return false;
  publishPhysicsGuard(sceneName, sprite, 'missing-body');
  return false;
}

export function publishPhysicsGuard(
  sceneName: string,
  sprite: Phaser.GameObjects.Sprite,
  reason: string,
): void {
  const runtime = window as Window & {
    __CODEJITSU_PHYSICS_GUARD?: RuntimePhysicsGuard[];
  };
  runtime.__CODEJITSU_PHYSICS_GUARD = [
    ...(runtime.__CODEJITSU_PHYSICS_GUARD ?? []),
    {
      scene: sceneName,
      reason,
      x: Math.round(sprite.x * 10) / 10,
      y: Math.round(sprite.y * 10) / 10,
      at: Math.round(performance.now()),
    },
  ].slice(-20);
}

export interface RuntimeBoundaryFeedback {
  scene: string;
  side: ArenaClampSide;
  attempted: {
    x: number;
    y: number;
  };
  clamped: {
    x: number;
    y: number;
  };
  arena: {
    leftAtY: number;
    rightAtY: number;
    topWidthRatio: number;
  };
  visual: 'edge-shimmer';
  at: number;
}

export function publishBoundaryFeedback(sceneName: string, result: ArenaClampResult): void {
  if (!result.clamped) return;
  (window as Window & { __CODEJITSU_BOUNDARY_FEEDBACK?: RuntimeBoundaryFeedback }).__CODEJITSU_BOUNDARY_FEEDBACK = {
    scene: sceneName,
    side: result.side,
    attempted: {
      x: Math.round(result.attempted.x * 10) / 10,
      y: Math.round(result.attempted.y * 10) / 10,
    },
    clamped: {
      x: Math.round(result.point.x * 10) / 10,
      y: Math.round(result.point.y * 10) / 10,
    },
    arena: {
      leftAtY: Math.round(result.arena.leftAtY * 10) / 10,
      rightAtY: Math.round(result.arena.rightAtY * 10) / 10,
      topWidthRatio: result.arena.topWidthRatio,
    },
    visual: 'edge-shimmer',
    at: Math.round(performance.now()),
  };
}
