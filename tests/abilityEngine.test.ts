import { describe, expect, it } from 'vitest';
import { getAbility } from '../src/data/abilities';
import { castAbility, createAbilityState, pushSyntaxToken, recordComboHit } from '../src/systems/abilityEngine';

describe('abilityEngine', () => {
  it('casts an unlocked syntax ability when energy and combo requirements are met', () => {
    let state = createAbilityState(100);
    state = pushSyntaxToken(pushSyntaxToken(state, 'try'), 'catch');
    state = recordComboHit(state);

    const [next, result] = castAbility(state, ['try-catch'], 1000);

    expect(result.ok).toBe(true);
    expect(result.ability?.displayName).toBe('try.catch');
    expect(next.energy).toBe(82);
    expect(next.activeTokens).toEqual([]);
    expect(next.cooldownEndsAt['try-catch']).toBe(1000 + getAbility('try-catch').cooldownMs);
  });

  it('blocks unknown or incomplete syntax', () => {
    const state = pushSyntaxToken(createAbilityState(100), 'try');
    const [, result] = castAbility(state, ['try-catch'], 0);

    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });

  it('blocks locked abilities and cooldown recasts', () => {
    let state = createAbilityState(100);
    state = pushSyntaxToken(pushSyntaxToken(state, 'try'), 'catch');
    state = recordComboHit(state);

    const [, locked] = castAbility(state, [], 0);
    expect(locked.reason).toBe('locked');

    const [afterCast] = castAbility(state, ['try-catch'], 0);
    const [, cooldown] = castAbility(pushSyntaxToken(pushSyntaxToken(afterCast, 'try'), 'catch'), ['try-catch'], 10);
    expect(cooldown.reason).toBe('cooldown');
  });
});
