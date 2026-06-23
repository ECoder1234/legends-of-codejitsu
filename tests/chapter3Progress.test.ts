import { describe, expect, it } from 'vitest';
import { chapter3Arcs, chapter3Missions, chapter3Upgrades } from '../src/data/chapter3';
import { defaultSaveState } from '../src/data/save';
import { SceneKeys } from '../src/scenes/sceneKeys';
import {
  canPurchaseChapter3Upgrade,
  canStartChapter3Mission,
  claimAvailableArcRewards,
  completeArcTrial,
  completeChapter3Mission,
  normalizeChapter3Progress,
  purchaseChapter3Upgrade,
  setChapter3Loadout,
} from '../src/systems/chapter3Progress';

describe('chapter3Progress', () => {
  it('defines a mission hub with the planned mission types and arc-ready data', () => {
    expect(chapter3Missions.map((mission) => mission.type)).toEqual([
      'combat-contract',
      'puzzle-shrine',
      'stealth-recovery',
      'traversal-breach',
      'mini-boss-gate',
      'story-boss',
    ]);
    expect(chapter3Missions.at(-1)?.sceneKey).toBe(SceneKeys.Chapter3Boss);
    expect(chapter3Upgrades.map((upgrade) => upgrade.stat)).toContain('terminalSlowTime');
    expect(chapter3Upgrades.map((upgrade) => upgrade.stat)).toContain('quickCastPower');
    expect(chapter3Arcs[0]).toMatchObject({
      id: 'fractured-openworld',
      entryChapter: 4,
      saveNamespace: 'arc.fracturedOpenworld',
    });
  });

  it('unlocks missions through the Chapter 3 hub route', () => {
    let save = structuredClone(defaultSaveState);

    expect(canStartChapter3Mission(save, 'combat-contract')).toBe(true);
    expect(canStartChapter3Mission(save, 'puzzle-shrine')).toBe(false);

    save = completeChapter3Mission(save, 'combat-contract');

    expect(save.chapter3.completedMissionIds).toContain('combat-contract');
    expect(save.chapter3.unlockedMissionIds).toEqual(expect.arrayContaining(['puzzle-shrine', 'stealth-recovery']));
    expect(save.chapter3.fragments).toBe(2);
    expect(save.chapter3.materials).toBe(1);
  });

  it('keeps replayable mission rewards repeatable but story boss rewards idempotent', () => {
    let save = completeChapter3Mission(structuredClone(defaultSaveState), 'combat-contract');
    save = completeChapter3Mission(save, 'combat-contract');

    expect(save.chapter3.fragments).toBe(4);
    expect(save.chapter3.claimedMissionRewardIds.filter((id) => id === 'combat-contract')).toHaveLength(1);

    save = completeChapter3Mission(save, 'puzzle-shrine');
    save = completeChapter3Mission(save, 'stealth-recovery');
    save = completeChapter3Mission(save, 'traversal-breach');
    save = completeChapter3Mission(save, 'mini-boss-gate');
    save = completeChapter3Mission(save, 'archive-heart');
    const afterBoss = completeChapter3Mission(save, 'archive-heart');

    expect(afterBoss.chapter3.fragments).toBe(save.chapter3.fragments);
    expect(afterBoss.unlockedAbilities).toContain('window-kill');
    expect(afterBoss.clearedChapters).toContain(3);
    expect(afterBoss.chapter3.unlockedArcIds).toEqual(expect.arrayContaining(chapter3Arcs.map((arc) => arc.id)));
    expect(afterBoss.chapter3.arcProgress['fractured-openworld']?.unlocked).toBe(true);
    expect(afterBoss.chapter3.arcProgress['silent-codex']?.unlocked).toBe(true);
  });

  it('migrates legacy arc namespace progress to arc ids', () => {
    const normalized = normalizeChapter3Progress({
      ...structuredClone(defaultSaveState.chapter3),
      arcProgress: {
        'arc.fracturedOpenworld': {
          unlocked: true,
          completedMissionIds: ['arc-open-road'],
          clearedBossIds: [],
        },
      },
    });

    expect(normalized.unlockedArcIds).toContain('fractured-openworld');
    expect(normalized.arcProgress['fractured-openworld']?.completedMissionIds).toEqual(['arc-open-road']);
    expect(normalized.arcProgress['arc.fracturedOpenworld']).toBeUndefined();
  });

  it('claims arc trial rewards and one-time arc completion rewards', () => {
    let save = structuredClone(defaultSaveState);
    save = completeChapter3Mission(save, 'combat-contract');
    save = completeChapter3Mission(save, 'puzzle-shrine');
    save = completeChapter3Mission(save, 'stealth-recovery');
    save = completeChapter3Mission(save, 'traversal-breach');
    save = completeChapter3Mission(save, 'mini-boss-gate');
    save = completeChapter3Mission(save, 'archive-heart');
    const beforeArc = save.chapter3.fragments;

    save = completeArcTrial(save, 'fractured-openworld', 'arc-open-road', { fragments: 2, materials: 1 });
    expect(save.chapter3.fragments).toBe(beforeArc + 2);
    expect(save.chapter3.completedArcIds).not.toContain('fractured-openworld');

    save = completeArcTrial(save, 'fractured-openworld', 'arc-lost-names', { fragments: 3, materials: 2 });
    save = completeArcTrial(save, 'fractured-openworld', 'arc-sky-null', { fragments: 5, materials: 4 });
    const afterArc = save.chapter3.fragments;

    expect(save.chapter3.completedArcIds).toContain('fractured-openworld');
    expect(save.chapter3.claimedArcRewardIds).toContain('fractured-openworld');
    expect(save.chapter3.arcProgress['fractured-openworld']?.clearedBossIds).toContain('sky-null-oni');
    expect(afterArc).toBe(beforeArc + 2 + 3 + 5 + 8);

    save = completeArcTrial(save, 'fractured-openworld', 'arc-sky-null', { fragments: 5, materials: 4 });
    expect(save.chapter3.fragments).toBe(afterArc);
  });

  it('backfills unclaimed arc rewards for already completed arc progress', () => {
    const save = {
      ...structuredClone(defaultSaveState),
      chapter3: {
        ...structuredClone(defaultSaveState.chapter3),
        fragments: 1,
        materials: 1,
        arcProgress: {
          'silent-codex': {
            unlocked: true,
            completedMissionIds: ['arc-mirror-trial', 'arc-checksum-spire', 'arc-codex-warden'],
            clearedBossIds: [],
          },
        },
      },
    };

    const claimed = claimAvailableArcRewards(save);
    const claimedAgain = claimAvailableArcRewards(claimed);

    expect(claimed.chapter3.fragments).toBe(9);
    expect(claimed.chapter3.materials).toBe(9);
    expect(claimed.chapter3.claimedArcRewardIds).toContain('silent-codex');
    expect(claimed.chapter3.arcProgress['silent-codex']?.clearedBossIds).toContain('silent-codex-warden');
    expect(claimedAgain.chapter3.fragments).toBe(claimed.chapter3.fragments);
  });

  it('purchases upgrades and updates player stats plus loadout modifiers', () => {
    let save = completeChapter3Mission(structuredClone(defaultSaveState), 'combat-contract');
    expect(canPurchaseChapter3Upgrade(save, 'guard-thread')).toBe(true);

    save = purchaseChapter3Upgrade(save, 'guard-thread');
    expect(save.playerUpgrades.maxHp).toBe(78);
    expect(save.chapter3.fragments).toBe(0);

    save = completeChapter3Mission(save, 'combat-contract');
    save = completeChapter3Mission(save, 'puzzle-shrine');
    save = purchaseChapter3Upgrade(save, 'slow-terminal');
    expect(save.chapter3.loadout.passiveModifiers.terminalSlowTimeMultiplier).toBeGreaterThan(1);
  });

  it('binds quick-cast vows only from unlocked abilities', () => {
    let save = completeChapter3Mission(structuredClone(defaultSaveState), 'combat-contract');
    save = completeChapter3Mission(save, 'puzzle-shrine');
    save = setChapter3Loadout(save, {
      terminalVows: ['array-split', 'missing-vow', 'try-catch'],
      quickCastVow: 'array-split',
      passiveModifiers: save.chapter3.loadout.passiveModifiers,
    });

    expect(save.boundAbilityId).toBe('array-split');
    expect(save.chapter3.loadout.quickCastVow).toBe('array-split');
    expect(save.chapter3.loadout.terminalVows).toEqual(['array-split', 'try-catch']);
  });
});
