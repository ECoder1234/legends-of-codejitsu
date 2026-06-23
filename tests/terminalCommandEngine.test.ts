import { describe, expect, it } from 'vitest';
import { getAbility } from '../src/data/abilities';
import { castAbility, createAbilityState, recordComboHit, pushSyntaxToken } from '../src/systems/abilityEngine';
import { parseTerminalCommand, tokensForCommand } from '../src/systems/terminalCommandEngine';

describe('terminalCommandEngine', () => {
  it('parses full command strings and aliases', () => {
    expect(parseTerminalCommand(' try.catch ').command?.abilityId).toBe('try-catch');
    expect(parseTerminalCommand('try catch').command?.command).toBe('try.catch');
    expect(parseTerminalCommand('tryy.y.ccactccchch').command?.command).toBe('try.catch');
    expect(parseTerminalCommand('ttrtrtrytrytry.cccaccatc').command?.command).toBe('try.catch');
    expect(parseTerminalCommand('nonsense').command).toBeUndefined();
  });

  it('feeds terminal command tokens into cooldown-backed ability casting', () => {
    const parsed = parseTerminalCommand('try.catch');
    let state = recordComboHit(createAbilityState(100));
    tokensForCommand(parsed.command?.command ?? '').forEach((token) => {
      state = pushSyntaxToken(state, token, 2);
    });

    const [afterCast, result] = castAbility(state, ['try-catch'], 100);
    expect(result.ok).toBe(true);
    expect(afterCast.cooldownEndsAt['try-catch']).toBe(100 + getAbility('try-catch').cooldownMs);

    let recastState = afterCast;
    tokensForCommand('try.catch').forEach((token) => {
      recastState = pushSyntaxToken(recastState, token, 2);
    });
    const [, cooldown] = castAbility(recastState, ['try-catch'], 200);
    expect(cooldown.reason).toBe('cooldown');
  });
});
