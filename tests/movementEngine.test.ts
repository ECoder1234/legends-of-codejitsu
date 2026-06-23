import { describe, expect, it } from 'vitest';
import { apprenticeMovementTuning, stepMovementVelocity } from '../src/systems/movementEngine';

describe('movementEngine', () => {
  it('accelerates toward input and scales vertical movement for isometric floors', () => {
    const velocity = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    const result = stepMovementVelocity(velocity, { x: 0, y: -1 }, 100, apprenticeMovementTuning);

    expect(result.moving).toBe(true);
    expect(result.velocity.y).toBeLessThan(0);
    expect(Math.abs(result.velocity.y)).toBeLessThan(apprenticeMovementTuning.speed);
  });

  it('decelerates cleanly to a full stop instead of drifting forever', () => {
    const velocity = { x: 12, y: 8, set(x: number, y: number) { this.x = x; this.y = y; } };
    const result = stepMovementVelocity(velocity, { x: 0, y: 0 }, 120, apprenticeMovementTuning);

    expect(result.moving).toBe(false);
    expect(Math.hypot(result.velocity.x, result.velocity.y)).toBe(0);
  });

  it('ramps into a cleaner run after sustained movement', () => {
    const fresh = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    const running = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };

    const firstStep = stepMovementVelocity(fresh, { x: 1, y: 0 }, 100, apprenticeMovementTuning, 50);
    const runStep = stepMovementVelocity(running, { x: 1, y: 0 }, 100, apprenticeMovementTuning, 900);

    expect(firstStep.runFactor).toBe(1);
    expect(runStep.runFactor).toBeGreaterThan(1.1);
    expect(runStep.velocity.x).toBeGreaterThan(firstStep.velocity.x);
    expect(firstStep.momentumState).toBe('launch');
    expect(runStep.momentumState).toBe('run');
    expect(runStep.footPlantPhase).toBeGreaterThanOrEqual(0);
    expect(runStep.footPlantPhase).toBeLessThan(1);
  });

  it('turns sharply when reversing direction', () => {
    const velocity = { x: 180, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    const result = stepMovementVelocity(velocity, { x: -1, y: 0 }, 100, apprenticeMovementTuning, 400);

    expect(result.velocity.x).toBeLessThan(-160);
    expect(result.direction.x).toBe(-1);
  });

  it('reports grounded stride data for animation and dust timing', () => {
    const velocity = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    const result = stepMovementVelocity(velocity, { x: 1, y: 0 }, 120, apprenticeMovementTuning, 900);

    expect(result.groundedSpeed).toBeGreaterThan(0);
    expect(result.strideIntensity).toBeGreaterThan(0);
    expect(result.strideIntervalMs).toBeGreaterThanOrEqual(64);
    expect(result.strideIntervalMs).toBeLessThanOrEqual(142);
    expect(result.bodyLean).toBeGreaterThan(0);
    expect(result.shadowLead.x).toBeGreaterThan(0);
    expect(result.trailIntensity).toBeGreaterThan(0);
    expect(result.cameraLead.x).toBeGreaterThan(0);
    expect(result.tractionGrip).toBeGreaterThan(0.5);
    expect(result.inputResponsiveness).toBeGreaterThan(70);
    expect(result.cinematicSnap).toBeGreaterThan(0.7);
    expect(result.stopGrip).toBeGreaterThan(0.85);
    expect(result.stepBeat).toBeGreaterThanOrEqual(0);
    expect(result.stepBeat).toBeLessThanOrEqual(1);
    expect(result.movePolishLevel).toBeGreaterThan(1.6);
  });

  it('reports braking snap and drift suppression when the player releases movement', () => {
    const velocity = { x: 72, y: 36, set(x: number, y: number) { this.x = x; this.y = y; } };
    const result = stepMovementVelocity(velocity, { x: 0, y: 0 }, 100, apprenticeMovementTuning, 0);

    expect(result.moving).toBe(false);
    expect(result.driftSuppression).toBeGreaterThan(0.4);
    expect(result.brakingSnap).toBe(true);
    expect(Math.hypot(result.velocity.x, result.velocity.y)).toBe(0);
    expect(result.cinematicSnap).toBeGreaterThan(0.4);
  });

  it('adds anticipation when turning hard so movement reads cleaner on screen', () => {
    const velocity = { x: 210, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    const result = stepMovementVelocity(velocity, { x: -1, y: 0 }, 80, apprenticeMovementTuning, 500);

    expect(result.turnAnticipation).toBeGreaterThan(0.05);
    expect(result.velocity.x).toBeLessThan(-170);
    expect(result.cinematicSnap).toBeGreaterThan(0.85);
    expect(result.momentumState).toBe('hard-turn');
    expect(result.accelerationBurst).toBeGreaterThan(1);
  });

  it('reports braking grip when movement is released so the character does not drift', () => {
    const velocity = { x: 180, y: 40, set(x: number, y: number) { this.x = x; this.y = y; } };
    const result = stepMovementVelocity(velocity, { x: 0, y: 0 }, 48, apprenticeMovementTuning, 0);

    expect(result.momentumState).toBe('brake');
    expect(result.brakingGrip).toBeGreaterThan(0);
    expect(result.driftSuppression).toBeGreaterThan(0);
    expect(result.releaseBrakeAssist).toBeGreaterThan(0.6);
  });
});
