import { describe, expect, it } from 'vitest';
import { firstBoss } from '../src/data/bosses';
import { applyBossDamage, chooseBossAttack, createBossState, isBossStaggered, resetBossStagger } from '../src/systems/bossEngine';

describe('bossEngine', () => {
  it('tracks damage, stagger, and defeat', () => {
    let state = createBossState(firstBoss);
    state = applyBossDamage(firstBoss, state, 30);
    expect(state.hp).toBe(firstBoss.maxHp - 30);
    expect(isBossStaggered(firstBoss, state)).toBe(false);

    state = applyBossDamage(firstBoss, state, firstBoss.staggerDamage);
    expect(isBossStaggered(firstBoss, state)).toBe(true);
    expect(resetBossStagger(state).stagger).toBe(0);

    state = applyBossDamage(firstBoss, state, firstBoss.maxHp);
    expect(state.defeated).toBe(true);
    expect(state.hp).toBe(0);
  });

  it('cycles attacks from the current phase', () => {
    const state = createBossState(firstBoss);
    expect(chooseBossAttack(firstBoss, state, 0)?.id).toBe('void-palm');
    expect(chooseBossAttack(firstBoss, state, 1)?.id).toBe('false-return');
    expect(chooseBossAttack(firstBoss, state, 2)?.id).toBe('void-cleave');
    expect(chooseBossAttack(firstBoss, state, 3)?.id).toBe('null-crosscut');
    expect(chooseBossAttack(firstBoss, state, 4)?.id).toBe('null-pursuit');
    expect(chooseBossAttack(firstBoss, state, 5)?.id).toBe('broken-bracket-cage');
    expect(chooseBossAttack(firstBoss, state, 6)?.id).toBe('mask-crash');
  });

  it('defines readable attack shapes and tells for Null Oni patterns', () => {
    const attacks = firstBoss.phases.flatMap((phase) => phase.attacks);
    expect(new Set(attacks.map((attack) => attack.shape))).toEqual(new Set(['burst', 'ring', 'lane', 'multi-burst']));
    expect(new Set(attacks.map((attack) => attack.behavior))).toEqual(new Set(['tracking-palm', 'mask-ring', 'lane-sweep', 'rift-chain', 'mirror-step', 'binary-cage', 'void-cleave', 'null-crosscut', 'null-pursuit']));
    attacks.forEach((attack) => {
      expect(attack.tellText?.length ?? 0).toBeGreaterThan(20);
      expect(attack.techniqueTokens?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(attack.movementHint?.length ?? 0).toBeGreaterThan(20);
      expect(attack.punishHint?.length ?? 0).toBeGreaterThan(20);
      expect(attack.threatLevel ?? 0).toBeGreaterThanOrEqual(2);
      expect(attack.castLine?.includes('.') ?? false).toBe(true);
      expect(attack.phaseRole?.length ?? 0).toBeGreaterThan(8);
      expect(attack.movementTell?.length ?? 0).toBeGreaterThan(20);
      expect(attack.counterWindowMs ?? 0).toBeGreaterThanOrEqual(400);
      expect(attack.arenaEffect?.length ?? 0).toBeGreaterThan(10);
      expect(attack.bossMotion?.length ?? 0).toBeGreaterThan(24);
      expect(attack.counterStyle?.length ?? 0).toBeGreaterThan(20);
      expect(['opener', 'follow-up', 'trap', 'finisher', 'phase-breaker']).toContain(attack.comboRole);
      expect(attack.dangerLayers?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(attack.dangerLayers?.every((layer) => layer.length > 8)).toBe(true);
      expect(attack.counterRhythm?.length ?? 0).toBeGreaterThan(18);
      expect(attack.commandHint?.length ?? 0).toBeGreaterThan(16);
      expect(attack.phaseShift?.length ?? 0).toBeGreaterThan(20);
    });
    expect(attacks.filter((attack) => attack.aftershock).map((attack) => attack.id)).toEqual([
      'void-palm',
      'mask-crash',
      'mask-crash-plus',
      'void-palm',
    ]);
  });
});
