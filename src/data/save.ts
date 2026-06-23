import type { SaveState } from '../types/game';

export const defaultSaveState: SaveState = {
  unlockedAbilities: ['try-catch'],
  clearedChapters: [],
  playerUpgrades: {
    maxHp: 60,
    maxEnergy: 100,
  },
  abilityKeyBinding: 'z',
  abilityKeyUnlocked: false,
  boundAbilityId: 'try-catch',
  currentCheckpoint: 'title',
  chapter3: {
    unlockedMissionIds: ['combat-contract'],
    completedMissionIds: [],
    claimedMissionRewardIds: [],
    completedArcIds: [],
    claimedArcRewardIds: [],
    discoveredSecretIds: [],
    fragments: 0,
    materials: 0,
    upgradeRanks: {},
    loadout: {
      terminalVows: ['try-catch', 'loop-strike'],
      quickCastVow: 'try-catch',
      passiveModifiers: {
        cooldownMultiplier: 1,
        quickCastDamageMultiplier: 1,
        terminalSlowTimeMultiplier: 1,
      },
    },
    unlockedArcIds: [],
    arcProgress: {},
  },
};

export const saveKey = 'legends-of-codejitsu-save-v1';
