import { SceneKeys } from '../scenes/sceneKeys';
import type { ArcDefinition, MissionDefinition, UpgradeDefinition, VowLoadoutDefinition } from '../types/game';

export const chapter3StartingLoadout: VowLoadoutDefinition = {
  terminalVows: ['try-catch', 'loop-strike'],
  quickCastVow: 'try-catch',
  passiveModifiers: {
    cooldownMultiplier: 1,
    quickCastDamageMultiplier: 1,
    terminalSlowTimeMultiplier: 1,
  },
};

export const chapter3Missions: MissionDefinition[] = [
  {
    id: 'combat-contract',
    title: 'Sentinel Contract',
    type: 'combat-contract',
    difficulty: 1,
    sceneKey: SceneKeys.Chapter3Hub,
    requiredMissionIds: [],
    reward: { fragments: 2, materials: 1 },
    replayable: true,
    summary: 'Clear a corrupted contract board and learn how fragments fuel builds.',
  },
  {
    id: 'puzzle-shrine',
    title: 'Array Shrine',
    type: 'puzzle-shrine',
    difficulty: 2,
    sceneKey: SceneKeys.PuzzleRoom,
    requiredMissionIds: ['combat-contract'],
    reward: { fragments: 2, materials: 2, abilityId: 'array-split' },
    replayable: true,
    summary: 'Recover array.split from a split-path shrine inside the broken archive.',
  },
  {
    id: 'stealth-recovery',
    title: 'Silent Reliquary',
    type: 'stealth-recovery',
    difficulty: 2,
    sceneKey: SceneKeys.StealthRoom,
    requiredMissionIds: ['combat-contract'],
    reward: { fragments: 2, materials: 2 },
    replayable: true,
    summary: 'Slip past watcher masks and recover names without starting a full fight.',
  },
  {
    id: 'traversal-breach',
    title: 'Data-Ash Breach',
    type: 'traversal-breach',
    difficulty: 3,
    sceneKey: SceneKeys.TraversalRoom,
    requiredMissionIds: ['puzzle-shrine', 'stealth-recovery'],
    reward: { fragments: 3, materials: 2, abilityId: 'debug-break' },
    replayable: true,
    summary: 'Cross a collapsing breach where movement pressure becomes a build check.',
  },
  {
    id: 'mini-boss-gate',
    title: 'Null Gate Warden',
    type: 'mini-boss-gate',
    difficulty: 4,
    sceneKey: SceneKeys.MiniBoss,
    requiredMissionIds: ['traversal-breach'],
    reward: { fragments: 3, materials: 3 },
    replayable: true,
    summary: 'Beat the gate warden to prove the Chapter 3 hub loop is boss-ready.',
  },
  {
    id: 'archive-heart',
    title: 'Archive Heart Boss',
    type: 'story-boss',
    difficulty: 5,
    sceneKey: SceneKeys.Chapter3Boss,
    requiredMissionIds: ['mini-boss-gate'],
    reward: { fragments: 5, materials: 4, abilityId: 'window-kill', unlockArcId: 'fractured-openworld' },
    replayable: false,
    summary: 'A three-phase boss that checks sword combo, terminal typing, and quick-cast timing.',
  },
];

export const chapter3Upgrades: UpgradeDefinition[] = [
  {
    id: 'guard-thread',
    displayName: 'Guard Thread',
    cost: 2,
    maxRank: 3,
    stat: 'maxHp',
    amountPerRank: 18,
    unlockMissionIds: [],
    description: 'Raises max HP for longer mission routes.',
  },
  {
    id: 'breath-cache',
    displayName: 'Breath Cache',
    cost: 2,
    maxRank: 3,
    stat: 'maxEnergy',
    amountPerRank: 16,
    unlockMissionIds: [],
    description: 'Raises max energy so vow-heavy builds can stay active.',
  },
  {
    id: 'combo-script',
    displayName: 'Combo Script',
    cost: 3,
    maxRank: 2,
    stat: 'swordComboGain',
    amountPerRank: 1,
    unlockMissionIds: ['combat-contract'],
    description: 'Sword hits build combo faster for boss phase breaks.',
  },
  {
    id: 'slow-terminal',
    displayName: 'Slow Terminal',
    cost: 3,
    maxRank: 2,
    stat: 'terminalSlowTime',
    amountPerRank: 0.15,
    unlockMissionIds: ['puzzle-shrine'],
    description: 'Extends terminal slow-time for typed vow builds.',
  },
  {
    id: 'quick-seal',
    displayName: 'Quick Seal',
    cost: 4,
    maxRank: 2,
    stat: 'quickCastPower',
    amountPerRank: 0.18,
    unlockMissionIds: ['stealth-recovery'],
    description: 'Boosts the Z quick-cast hit for reflex builds.',
  },
];

export const chapter3Arcs: ArcDefinition[] = [
  {
    id: 'fractured-openworld',
    title: 'Fractured Openworld Arc',
    entryChapter: 4,
    regionScene: 'FracturedOpenworldArcScene',
    missionIds: ['arc-open-road', 'arc-lost-names', 'arc-sky-null'],
    bossIds: ['sky-null-oni'],
    reward: { fragments: 8, materials: 8 },
    saveNamespace: 'arc.fracturedOpenworld',
    summary: 'A wandering hub of three combat trials and a final Sky Null Oni rematch. Unlocked when Archive Heart falls.',
  },
  {
    id: 'silent-codex',
    title: 'Silent Codex Arc',
    entryChapter: 4,
    regionScene: 'SilentCodexArcScene',
    missionIds: ['arc-mirror-trial', 'arc-checksum-spire', 'arc-codex-warden'],
    bossIds: ['silent-codex-warden'],
    reward: { fragments: 8, materials: 8 },
    saveNamespace: 'arc.silentCodex',
    summary: 'A silent vault hiding a Codex Warden. Three quick combat-and-vow trials, then a heavy duel boss.',
  },
];

export function getChapter3Mission(id: string): MissionDefinition {
  const mission = chapter3Missions.find((entry) => entry.id === id);
  if (!mission) {
    throw new Error(`Unknown Chapter 3 mission: ${id}`);
  }
  return mission;
}

export function getChapter3Upgrade(id: string): UpgradeDefinition {
  const upgrade = chapter3Upgrades.find((entry) => entry.id === id);
  if (!upgrade) {
    throw new Error(`Unknown Chapter 3 upgrade: ${id}`);
  }
  return upgrade;
}
