import { describe, expect, it } from 'vitest';
import { createBossAiProfile, shouldQueueBossCombo } from '../src/systems/bossAi';

describe('bossAi', () => {
  it('changes Null Oni pressure by distance, phase, and health', () => {
    expect(createBossAiProfile({
      hpPercent: 1,
      phaseIndex: 0,
      distanceToPlayer: 280,
      terminalCastUsed: false,
      queuedComboCount: 0,
      isStaggered: false,
    }).stance).toBe('hunter');

    const close = createBossAiProfile({
      hpPercent: 0.8,
      phaseIndex: 0,
      distanceToPlayer: 90,
      terminalCastUsed: false,
      queuedComboCount: 0,
      isStaggered: false,
    });
    expect(close.stance).toBe('duelist');
    expect(close.orbitStrength).toBeGreaterThan(0.4);

    const phaseTwo = createBossAiProfile({
      hpPercent: 0.4,
      phaseIndex: 1,
      distanceToPlayer: 170,
      terminalCastUsed: false,
      queuedComboCount: 1,
      isStaggered: false,
    });
    expect(phaseTwo.stance).toBe('unstable');
    expect(phaseTwo.comboEvery).toBe(2);

    const cornered = createBossAiProfile({
      hpPercent: 0.2,
      phaseIndex: 1,
      distanceToPlayer: 160,
      terminalCastUsed: true,
      queuedComboCount: 0,
      isStaggered: false,
    });
    expect(cornered.stance).toBe('cornered');
    expect(cornered.attackDelayMs).toBeLessThan(phaseTwo.attackDelayMs);
  });

  it('uses stance cadence for combo follow-ups', () => {
    const hunter = createBossAiProfile({
      hpPercent: 1,
      phaseIndex: 0,
      distanceToPlayer: 220,
      terminalCastUsed: false,
      queuedComboCount: 0,
      isStaggered: false,
    });
    const unstable = createBossAiProfile({
      hpPercent: 0.42,
      phaseIndex: 1,
      distanceToPlayer: 220,
      terminalCastUsed: false,
      queuedComboCount: 0,
      isStaggered: false,
    });

    expect(shouldQueueBossCombo(hunter, 2)).toBe(false);
    expect(shouldQueueBossCombo(hunter, 3)).toBe(true);
    expect(shouldQueueBossCombo(unstable, 2)).toBe(true);
  });
});
