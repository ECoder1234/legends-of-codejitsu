import { defaultSaveState, saveKey } from '../data/save';
import { normalizeChapter3Progress } from './chapter3Progress';
import type { SaveState } from '../types/game';

function isSaveState(value: unknown): value is SaveState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as SaveState;
  return (
    Array.isArray(candidate.unlockedAbilities) &&
    Array.isArray(candidate.clearedChapters) &&
    typeof candidate.playerUpgrades?.maxHp === 'number' &&
    typeof candidate.playerUpgrades?.maxEnergy === 'number' &&
    typeof candidate.currentCheckpoint === 'string'
  );
}

export function parseSave(raw: string | null): SaveState {
  if (!raw) {
    return structuredClone(defaultSaveState);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isSaveState(parsed)) {
      return structuredClone(defaultSaveState);
    }
    return {
      ...structuredClone(defaultSaveState),
      ...parsed,
      playerUpgrades: {
        ...defaultSaveState.playerUpgrades,
        ...parsed.playerUpgrades,
      },
      abilityKeyBinding: typeof parsed.abilityKeyBinding === 'string' ? parsed.abilityKeyBinding : defaultSaveState.abilityKeyBinding,
      abilityKeyUnlocked: typeof parsed.abilityKeyUnlocked === 'boolean' ? parsed.abilityKeyUnlocked : defaultSaveState.abilityKeyUnlocked,
      boundAbilityId: typeof parsed.boundAbilityId === 'string' ? parsed.boundAbilityId : defaultSaveState.boundAbilityId,
      chapter3: normalizeChapter3Progress(parsed.chapter3),
    };
  } catch {
    return structuredClone(defaultSaveState);
  }
}

export function loadSave(storage: Storage = localStorage): SaveState {
  return parseSave(storage.getItem(saveKey));
}

export function writeSave(save: SaveState, storage: Storage = localStorage): void {
  storage.setItem(saveKey, JSON.stringify(save));
}

export function unlockAbility(save: SaveState, abilityId: string): SaveState {
  if (save.unlockedAbilities.includes(abilityId)) {
    return save;
  }
  return {
    ...save,
    unlockedAbilities: [...save.unlockedAbilities, abilityId],
  };
}

export function clearChapter(save: SaveState, chapter: number): SaveState {
  if (save.clearedChapters.includes(chapter)) {
    return save;
  }
  return {
    ...save,
    clearedChapters: [...save.clearedChapters, chapter].sort((a, b) => a - b),
  };
}
