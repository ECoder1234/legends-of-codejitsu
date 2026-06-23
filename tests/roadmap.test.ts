import { describe, expect, it } from 'vitest';
import { seasonOneBosses } from '../src/data/bosses';
import { chapterOneRoadmap, roadmapRuntimeLines } from '../src/data/roadmap';
import { chapterOneDungeonRooms, minimumPlayableSeconds, playableContentAudit } from '../src/data/playtime';

describe('chapterOneRoadmap', () => {
  it('keeps the requested six-phase breakdown explicit and ordered', () => {
    expect(chapterOneRoadmap).toHaveLength(6);
    expect(chapterOneRoadmap.map((phase) => phase.id)).toEqual([1, 2, 3, 4, 5, 6]);
    const text = roadmapRuntimeLines().join(' ');

    [
      'Archive Clan',
      'Null Oni corruption',
      '2.5D borders',
      'gate walking',
      'dark fades',
      'X sword',
      'J removed',
      'clean texture edges',
      'generated animations',
      'victory dialogue',
      'E2E playtest',
    ].forEach((required) => expect(text).toContain(required));
  });
});

describe('playableContentAudit', () => {
  it('keeps Chapter 1 and Chapter 2 at separate minimum playable targets', () => {
    const audit = playableContentAudit();
    const gameplayTypes = new Set(audit.segments.map((segment) => segment.type));
    const chapterTwoCombatRooms = audit.segments.filter((segment) => segment.chapter === 2 && segment.type === 'combat-room');

    expect(chapterOneDungeonRooms).toHaveLength(10);
    expect(audit.minimumPlayableSeconds).toBe(10800);
    expect(audit.chapterOnePlayableSeconds).toBeGreaterThanOrEqual(5000);
    expect(audit.chapterTwoPlayableSeconds).toBeGreaterThanOrEqual(5000);
    expect(audit.totalPlayableMinutes).toBeGreaterThanOrEqual(180);
    expect(audit.chapterOneCombatRoomCount).toBe(10);
    expect(chapterTwoCombatRooms).toHaveLength(10);
    expect(audit.chapterOneEnemyCount).toBeGreaterThanOrEqual(45);
    expect(audit.segments.every((segment) => segment.chapter === 1 || segment.chapter === 2)).toBe(true);
    expect(gameplayTypes).toEqual(new Set(['combat-room', 'boss']));
    expect(audit.bossCount).toBe(2);
    expect(seasonOneBosses.map((boss) => boss.chapter)).toEqual([1, 2]);
    expect(seasonOneBosses.every((boss) => boss.maxHp >= 4000)).toBe(true);
  });
});
