import { abilities } from '../data/abilities';
import type { AbilityDefinition } from '../types/game';

export interface AbilityRuntimeState {
  cooldownEndsAt: Record<string, number>;
  activeTokens: string[];
  comboCount: number;
  energy: number;
}

export interface AbilityCastResult {
  ok: boolean;
  ability?: AbilityDefinition;
  reason?: 'unknown' | 'locked' | 'cooldown' | 'energy' | 'combo';
}

export function createAbilityState(maxEnergy = 100): AbilityRuntimeState {
  return {
    cooldownEndsAt: {},
    activeTokens: [],
    comboCount: 0,
    energy: maxEnergy,
  };
}

export function pushSyntaxToken(state: AbilityRuntimeState, token: string, maxTokens = 4): AbilityRuntimeState {
  const activeTokens = [...state.activeTokens, token].slice(-maxTokens);
  return { ...state, activeTokens };
}

export function clearSyntaxTokens(state: AbilityRuntimeState): AbilityRuntimeState {
  return { ...state, activeTokens: [] };
}

export function findAbilityByTokens(tokens: string[]): AbilityDefinition | undefined {
  return abilities.find((ability) => {
    if (ability.syntaxTokens.length !== tokens.length) {
      return false;
    }
    return ability.syntaxTokens.every((token, index) => token === tokens[index]);
  });
}

export function castAbility(
  state: AbilityRuntimeState,
  unlockedAbilityIds: string[],
  now: number,
): [AbilityRuntimeState, AbilityCastResult] {
  const ability = findAbilityByTokens(state.activeTokens);
  if (!ability) {
    return [state, { ok: false, reason: 'unknown' }];
  }
  if (!unlockedAbilityIds.includes(ability.id)) {
    return [state, { ok: false, reason: 'locked' }];
  }
  if ((state.cooldownEndsAt[ability.id] ?? 0) > now) {
    return [state, { ok: false, reason: 'cooldown' }];
  }
  if (state.energy < ability.energyCost) {
    return [state, { ok: false, reason: 'energy' }];
  }
  if (state.comboCount < ability.comboRequirement) {
    return [state, { ok: false, reason: 'combo' }];
  }

  return [
    {
      ...state,
      activeTokens: [],
      energy: Math.max(0, state.energy - ability.energyCost),
      cooldownEndsAt: {
        ...state.cooldownEndsAt,
        [ability.id]: now + ability.cooldownMs,
      },
    },
    { ok: true, ability },
  ];
}

export function gainEnergy(state: AbilityRuntimeState, amount: number, maxEnergy = 100): AbilityRuntimeState {
  return { ...state, energy: Math.min(maxEnergy, state.energy + amount) };
}

export function recordComboHit(state: AbilityRuntimeState): AbilityRuntimeState {
  return { ...state, comboCount: Math.min(9, state.comboCount + 1) };
}

export function decayCombo(state: AbilityRuntimeState): AbilityRuntimeState {
  return { ...state, comboCount: Math.max(0, state.comboCount - 1) };
}
