import { describe, expect, it } from 'vitest';
import { defaultSaveState } from '../src/data/save';
import { clearChapter, parseSave, unlockAbility } from '../src/systems/saveSystem';

describe('saveSystem', () => {
  it('falls back to the default save on corrupt data', () => {
    expect(parseSave('not-json')).toEqual(defaultSaveState);
    expect(parseSave(JSON.stringify({ bad: true }))).toEqual(defaultSaveState);
  });

  it('unlocks abilities and clears chapters idempotently', () => {
    const withAbility = unlockAbility(defaultSaveState, 'loop-strike');
    expect(withAbility.unlockedAbilities).toContain('loop-strike');
    expect(unlockAbility(withAbility, 'loop-strike').unlockedAbilities.filter((id) => id === 'loop-strike')).toHaveLength(1);

    const cleared = clearChapter(withAbility, 1);
    expect(cleared.clearedChapters).toEqual([1]);
    expect(clearChapter(cleared, 1).clearedChapters).toEqual([1]);
  });

  it('accepts tutorial checkpoints in save serialization', () => {
    const parsed = parseSave(JSON.stringify({ ...defaultSaveState, currentCheckpoint: 'tutorial' }));
    expect(parsed.currentCheckpoint).toBe('tutorial');
  });

  it('migrates old saves with Chapter 3 defaults', () => {
    const parsed = parseSave(JSON.stringify({
      unlockedAbilities: ['try-catch', 'loop-strike'],
      clearedChapters: [1, 2],
      playerUpgrades: { maxHp: 120, maxEnergy: 110 },
      currentCheckpoint: 'chapter2-trail',
    }));

    expect(parsed.chapter3.unlockedMissionIds).toEqual(['combat-contract']);
    expect(parsed.chapter3.loadout.terminalVows).toEqual(['try-catch', 'loop-strike']);
    expect(parsed.chapter3.fragments).toBe(0);
  });
});
