import { chapter3Arcs, chapter3Missions, chapter3StartingLoadout, chapter3Upgrades } from '../data/chapter3';
import type { Chapter3Progress, SaveState, VowLoadoutDefinition } from '../types/game';

export function defaultChapter3Progress(): Chapter3Progress {
  return {
    unlockedMissionIds: ['combat-contract'],
    completedMissionIds: [],
    claimedMissionRewardIds: [],
    completedArcIds: [],
    claimedArcRewardIds: [],
    discoveredSecretIds: [],
    fragments: 0,
    materials: 0,
    upgradeRanks: {},
    loadout: structuredClone(chapter3StartingLoadout),
    unlockedArcIds: [],
    arcProgress: {},
  };
}

export function normalizeChapter3Progress(progress: Partial<Chapter3Progress> | undefined): Chapter3Progress {
  const defaults = defaultChapter3Progress();
  const loadout = normalizeLoadout(progress?.loadout);
  const arcProgress = normalizeArcProgress(progress?.arcProgress);
  const completedArcIds = unique([
    ...(progress?.completedArcIds ?? []),
    ...chapter3Arcs
      .filter((arc) => arc.missionIds.every((missionId) => arcProgress[arc.id]?.completedMissionIds.includes(missionId)))
      .map((arc) => arc.id),
  ]);
  return {
    ...defaults,
    ...progress,
    unlockedMissionIds: unique([...defaults.unlockedMissionIds, ...(progress?.unlockedMissionIds ?? [])]),
    completedMissionIds: unique(progress?.completedMissionIds ?? []),
    claimedMissionRewardIds: unique(progress?.claimedMissionRewardIds ?? []),
    completedArcIds,
    claimedArcRewardIds: unique(progress?.claimedArcRewardIds ?? []),
    discoveredSecretIds: unique(progress?.discoveredSecretIds ?? []),
    fragments: Math.max(0, Number(progress?.fragments ?? defaults.fragments)),
    materials: Math.max(0, Number(progress?.materials ?? defaults.materials)),
    upgradeRanks: { ...(progress?.upgradeRanks ?? {}) },
    loadout,
    unlockedArcIds: unique([
      ...(progress?.unlockedArcIds ?? []),
      ...chapter3Arcs.filter((arc) => arcProgress[arc.id]?.unlocked).map((arc) => arc.id),
    ]),
    arcProgress,
  };
}

export function completeChapter3Mission(save: SaveState, missionId: string): SaveState {
  const mission = chapter3Missions.find((entry) => entry.id === missionId);
  if (!mission) {
    throw new Error(`Unknown Chapter 3 mission: ${missionId}`);
  }
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  const completedMissionIds = unique([...chapter3.completedMissionIds, missionId]);
  const unlockedMissionIds = unique([
    ...chapter3.unlockedMissionIds,
    ...chapter3Missions
      .filter((entry) => entry.requiredMissionIds.every((required) => completedMissionIds.includes(required)))
      .map((entry) => entry.id),
  ]);
  const rewardAlreadyClaimed = chapter3.claimedMissionRewardIds.includes(missionId);
  const shouldClaimReward = !rewardAlreadyClaimed || mission.replayable;
  let nextSave: SaveState = {
    ...save,
    currentCheckpoint: missionId === 'archive-heart' ? 'chapter3-boss' : 'chapter3-hub',
    chapter3: {
      ...chapter3,
      completedMissionIds,
      unlockedMissionIds,
      claimedMissionRewardIds: rewardAlreadyClaimed
        ? chapter3.claimedMissionRewardIds
        : [...chapter3.claimedMissionRewardIds, missionId],
      fragments: chapter3.fragments + (shouldClaimReward ? mission.reward.fragments : 0),
      materials: chapter3.materials + (shouldClaimReward ? mission.reward.materials : 0),
    },
  };
  if (mission.reward.abilityId) {
    nextSave = addUnlockedAbility(nextSave, mission.reward.abilityId);
  }
  if (mission.reward.unlockArcId) {
    nextSave = unlockArc(nextSave, mission.reward.unlockArcId);
  }
  if (mission.id === 'archive-heart') {
    chapter3Arcs.forEach((arc) => {
      nextSave = unlockArc(nextSave, arc.id);
    });
    nextSave = addClearedChapter(nextSave, 3);
  }
  return nextSave;
}

export function canStartChapter3Mission(save: SaveState, missionId: string): boolean {
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  const mission = chapter3Missions.find((entry) => entry.id === missionId);
  return Boolean(mission && chapter3.unlockedMissionIds.includes(mission.id));
}

export function canPurchaseChapter3Upgrade(save: SaveState, upgradeId: string): boolean {
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  const upgrade = chapter3Upgrades.find((entry) => entry.id === upgradeId);
  if (!upgrade) return false;
  const currentRank = chapter3.upgradeRanks[upgrade.id] ?? 0;
  return (
    currentRank < upgrade.maxRank &&
    chapter3.fragments >= upgrade.cost &&
    upgrade.unlockMissionIds.every((missionId) => chapter3.completedMissionIds.includes(missionId))
  );
}

export function purchaseChapter3Upgrade(save: SaveState, upgradeId: string): SaveState {
  if (!canPurchaseChapter3Upgrade(save, upgradeId)) {
    return save;
  }
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  const upgrade = chapter3Upgrades.find((entry) => entry.id === upgradeId);
  if (!upgrade) return save;
  const rank = chapter3.upgradeRanks[upgrade.id] ?? 0;
  return {
    ...save,
    playerUpgrades: applyUpgradeToPlayerStats(save, upgrade.id),
    chapter3: {
      ...chapter3,
      fragments: chapter3.fragments - upgrade.cost,
      upgradeRanks: {
        ...chapter3.upgradeRanks,
        [upgrade.id]: rank + 1,
      },
      loadout: recalculateLoadoutModifiers({
        ...chapter3,
        upgradeRanks: {
          ...chapter3.upgradeRanks,
          [upgrade.id]: rank + 1,
        },
      }),
    },
  };
}

export function setChapter3Loadout(save: SaveState, loadout: VowLoadoutDefinition): SaveState {
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  const unlocked = new Set(save.unlockedAbilities);
  const terminalVows = unique(loadout.terminalVows.filter((id) => unlocked.has(id))).slice(0, 3);
  const fallbackQuickCast = terminalVows[0] ?? 'try-catch';
  const quickCastVow = unlocked.has(loadout.quickCastVow) ? loadout.quickCastVow : fallbackQuickCast;
  return {
    ...save,
    boundAbilityId: quickCastVow,
    chapter3: {
      ...chapter3,
      loadout: recalculateLoadoutModifiers({
        ...chapter3,
        loadout: {
          terminalVows,
          quickCastVow,
          passiveModifiers: loadout.passiveModifiers,
        },
      }),
    },
  };
}

export function unlockArc(save: SaveState, arcId: string): SaveState {
  const arc = chapter3Arcs.find((entry) => entry.id === arcId);
  if (!arc) return save;
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  const existing = chapter3.arcProgress[arc.id];
  return {
    ...save,
    chapter3: {
      ...chapter3,
      unlockedArcIds: unique([...chapter3.unlockedArcIds, arc.id]),
      arcProgress: {
        ...chapter3.arcProgress,
        [arc.id]: {
          ...(existing ?? {
            completedMissionIds: [],
            clearedBossIds: [],
          }),
          unlocked: true,
        },
      },
    },
  };
}

export function completeArcTrial(
  save: SaveState,
  arcId: string,
  trialId: string,
  reward: { fragments: number; materials: number },
): SaveState {
  const arc = chapter3Arcs.find((entry) => entry.id === arcId);
  if (!arc) {
    throw new Error(`Unknown Chapter 3 arc: ${arcId}`);
  }
  if (!arc.missionIds.includes(trialId)) {
    throw new Error(`Unknown trial "${trialId}" for Chapter 3 arc: ${arcId}`);
  }
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  const existing = chapter3.arcProgress[arc.id] ?? {
    unlocked: true,
    completedMissionIds: [],
    clearedBossIds: [],
  };
  const trialAlreadyClaimed = existing.completedMissionIds.includes(trialId);
  const completedMissionIds = unique([...existing.completedMissionIds, trialId]);
  const allTrialsCleared = arc.missionIds.every((missionId) => completedMissionIds.includes(missionId));
  const arcRewardAlreadyClaimed = chapter3.claimedArcRewardIds.includes(arc.id);
  const shouldClaimArcReward = allTrialsCleared && !arcRewardAlreadyClaimed;
  const claimedArcRewardIds = shouldClaimArcReward
    ? [...chapter3.claimedArcRewardIds, arc.id]
    : chapter3.claimedArcRewardIds;
  const completedArcIds = allTrialsCleared ? unique([...chapter3.completedArcIds, arc.id]) : chapter3.completedArcIds;
  const clearedBossIds = shouldClaimArcReward ? unique([...existing.clearedBossIds, ...arc.bossIds]) : existing.clearedBossIds;

  return {
    ...save,
    chapter3: {
      ...chapter3,
      fragments:
        chapter3.fragments +
        (trialAlreadyClaimed ? 0 : reward.fragments) +
        (shouldClaimArcReward ? arc.reward.fragments : 0),
      materials:
        chapter3.materials +
        (trialAlreadyClaimed ? 0 : reward.materials) +
        (shouldClaimArcReward ? arc.reward.materials : 0),
      unlockedArcIds: unique([...chapter3.unlockedArcIds, arc.id]),
      completedArcIds,
      claimedArcRewardIds,
      arcProgress: {
        ...chapter3.arcProgress,
        [arc.id]: {
          unlocked: true,
          completedMissionIds,
          clearedBossIds,
        },
      },
    },
  };
}

export function claimAvailableArcRewards(save: SaveState): SaveState {
  const chapter3 = normalizeChapter3Progress(save.chapter3);
  let fragments = chapter3.fragments;
  let materials = chapter3.materials;
  let completedArcIds = chapter3.completedArcIds;
  let claimedArcRewardIds = chapter3.claimedArcRewardIds;
  const arcProgress = { ...chapter3.arcProgress };

  chapter3Arcs.forEach((arc) => {
    const existing = arcProgress[arc.id];
    const allTrialsCleared = arc.missionIds.every((missionId) => existing?.completedMissionIds.includes(missionId));
    if (!allTrialsCleared) return;
    completedArcIds = unique([...completedArcIds, arc.id]);
    if (claimedArcRewardIds.includes(arc.id)) return;
    fragments += arc.reward.fragments;
    materials += arc.reward.materials;
    claimedArcRewardIds = [...claimedArcRewardIds, arc.id];
    arcProgress[arc.id] = {
      unlocked: true,
      completedMissionIds: existing?.completedMissionIds ?? [],
      clearedBossIds: unique([...(existing?.clearedBossIds ?? []), ...arc.bossIds]),
    };
  });

  return {
    ...save,
    chapter3: {
      ...chapter3,
      fragments,
      materials,
      completedArcIds,
      claimedArcRewardIds,
      arcProgress,
    },
  };
}

function applyUpgradeToPlayerStats(save: SaveState, upgradeId: string): SaveState['playerUpgrades'] {
  const upgrade = chapter3Upgrades.find((entry) => entry.id === upgradeId);
  if (!upgrade) return save.playerUpgrades;
  if (upgrade.stat === 'maxHp') {
    return { ...save.playerUpgrades, maxHp: save.playerUpgrades.maxHp + upgrade.amountPerRank };
  }
  if (upgrade.stat === 'maxEnergy') {
    return { ...save.playerUpgrades, maxEnergy: save.playerUpgrades.maxEnergy + upgrade.amountPerRank };
  }
  return save.playerUpgrades;
}

function recalculateLoadoutModifiers(progress: Chapter3Progress): VowLoadoutDefinition {
  const slowTerminalRank = progress.upgradeRanks['slow-terminal'] ?? 0;
  const quickSealRank = progress.upgradeRanks['quick-seal'] ?? 0;
  return {
    ...progress.loadout,
    passiveModifiers: {
      cooldownMultiplier: 1,
      quickCastDamageMultiplier: 1 + quickSealRank * 0.18,
      terminalSlowTimeMultiplier: 1 + slowTerminalRank * 0.15,
    },
  };
}

function normalizeLoadout(loadout: VowLoadoutDefinition | undefined): VowLoadoutDefinition {
  const defaults = chapter3StartingLoadout;
  return {
    terminalVows: unique(loadout?.terminalVows ?? defaults.terminalVows).slice(0, 3),
    quickCastVow: loadout?.quickCastVow ?? defaults.quickCastVow,
    passiveModifiers: {
      ...defaults.passiveModifiers,
      ...(loadout?.passiveModifiers ?? {}),
    },
  };
}

function normalizeArcProgress(progress: Partial<Chapter3Progress['arcProgress']> | undefined): Chapter3Progress['arcProgress'] {
  const source = progress ?? {};
  const normalized: Chapter3Progress['arcProgress'] = {};
  const knownArcKeys = new Set(chapter3Arcs.flatMap((arc) => [arc.id, arc.saveNamespace]));

  chapter3Arcs.forEach((arc) => {
    const legacy = source[arc.saveNamespace];
    const current = source[arc.id];
    const completedMissionIds = unique([
      ...(legacy?.completedMissionIds ?? []),
      ...(current?.completedMissionIds ?? []),
    ]);
    const clearedBossIds = unique([
      ...(legacy?.clearedBossIds ?? []),
      ...(current?.clearedBossIds ?? []),
    ]);
    const unlocked = Boolean(legacy?.unlocked || current?.unlocked || completedMissionIds.length || clearedBossIds.length);
    if (!unlocked) return;
    normalized[arc.id] = {
      unlocked,
      completedMissionIds,
      clearedBossIds,
    };
  });

  Object.entries(source).forEach(([key, value]) => {
    if (knownArcKeys.has(key) || !value) return;
    normalized[key] = {
      unlocked: Boolean(value.unlocked),
      completedMissionIds: unique(value.completedMissionIds ?? []),
      clearedBossIds: unique(value.clearedBossIds ?? []),
    };
  });

  return normalized;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function addUnlockedAbility(save: SaveState, abilityId: string): SaveState {
  if (save.unlockedAbilities.includes(abilityId)) {
    return save;
  }
  return {
    ...save,
    unlockedAbilities: [...save.unlockedAbilities, abilityId],
  };
}

function addClearedChapter(save: SaveState, chapter: number): SaveState {
  if (save.clearedChapters.includes(chapter)) {
    return save;
  }
  return {
    ...save,
    clearedChapters: [...save.clearedChapters, chapter].sort((a, b) => a - b),
  };
}
