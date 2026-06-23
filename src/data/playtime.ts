export interface PlayableContentSegment {
  id: string;
  chapter: 1 | 2 | 3;
  label: string;
  type: 'tutorial' | 'exploration' | 'combat-room' | 'puzzle' | 'traversal' | 'npc-encounter' | 'trap-room' | 'stealth' | 'mini-boss' | 'boss' | 'story' | 'hub' | 'arc';
  estimatedSeconds: number;
  dialogueExcluded: boolean;
}

export interface ChapterOneDungeonRoomPlan {
  id: string;
  label: string;
  estimatedSeconds: number;
  enemyCount: number;
}

export const minimumPlayableSeconds = 10800;

export const chapterOneDungeonRooms: ChapterOneDungeonRoomPlan[] = [
  { id: 'archive-gauntlet-01', label: 'Archive Gauntlet I', estimatedSeconds: 420, enemyCount: 3 },
  { id: 'archive-gauntlet-02', label: 'Archive Gauntlet II', estimatedSeconds: 420, enemyCount: 4 },
  { id: 'archive-gauntlet-03', label: 'Archive Gauntlet III', estimatedSeconds: 420, enemyCount: 5 },
  { id: 'archive-gauntlet-04', label: 'Archive Gauntlet IV', estimatedSeconds: 420, enemyCount: 4 },
  { id: 'archive-gauntlet-05', label: 'Archive Gauntlet V', estimatedSeconds: 420, enemyCount: 4 },
  { id: 'archive-gauntlet-06', label: 'Archive Gauntlet VI', estimatedSeconds: 420, enemyCount: 4 },
  { id: 'archive-gauntlet-07', label: 'Archive Gauntlet VII', estimatedSeconds: 420, enemyCount: 5 },
  { id: 'archive-gauntlet-08', label: 'Archive Gauntlet VIII', estimatedSeconds: 420, enemyCount: 6 },
  { id: 'archive-gauntlet-09', label: 'Archive Gauntlet IX', estimatedSeconds: 420, enemyCount: 5 },
  { id: 'archive-gauntlet-10', label: 'Archive Gauntlet X', estimatedSeconds: 420, enemyCount: 5 },
];

export const playableContentSegments: PlayableContentSegment[] = [
  ...chapterOneDungeonRooms.map((room) => ({
    id: `chapter1-${room.id}`,
    chapter: 1 as const,
    label: room.label,
    type: 'combat-room' as const,
    estimatedSeconds: room.estimatedSeconds,
    dialogueExcluded: true,
  })),
  { id: 'null-oni-boss', chapter: 1, label: 'Null Oni boss fight', type: 'boss', estimatedSeconds: 1200, dialogueExcluded: true },
  { id: 'chapter2-gate-loop', chapter: 2, label: 'Gate Loop', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-boolean-switchback', chapter: 2, label: 'Boolean Switchback', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-array-shrine', chapter: 2, label: 'Array Shrine', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-runtime-ravine', chapter: 2, label: 'Runtime Ravine', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-return-threshold', chapter: 2, label: 'Return Threshold', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-recursive-bridge', chapter: 2, label: 'Recursive Bridge', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-stack-overpass', chapter: 2, label: 'Stack Overpass', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-branch-lock', chapter: 2, label: 'Branch Lock', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-loop-citadel', chapter: 2, label: 'Loop Citadel', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'chapter2-return-keep', chapter: 2, label: 'Return Keep', type: 'combat-room', estimatedSeconds: 430, dialogueExcluded: true },
  { id: 'return-oni-boss', chapter: 2, label: 'Return Oni boss fight', type: 'boss', estimatedSeconds: 1200, dialogueExcluded: true },
];

export function playableContentAudit(): {
  minimumPlayableSeconds: number;
  totalPlayableSeconds: number;
  totalPlayableMinutes: number;
  chapterOnePlayableSeconds: number;
  chapterOnePlayableMinutes: number;
  chapterOneMeetsMinimum: boolean;
  chapterTwoPlayableSeconds: number;
  chapterTwoPlayableMinutes: number;
  chapterTwoMeetsMinimum: boolean;
  chapterOneCombatRoomCount: number;
  chapterOneEnemyCount: number;
  dialogueExcluded: boolean;
  segmentCount: number;
  combatRoomCount: number;
  bossCount: number;
  meetsMinimum: boolean;
  segments: PlayableContentSegment[];
} {
  const totalPlayableSeconds = playableContentSegments.reduce((total, segment) => total + segment.estimatedSeconds, 0);
  const chapterOnePlayableSeconds = playableContentSegments
    .filter((segment) => segment.chapter === 1)
    .reduce((total, segment) => total + segment.estimatedSeconds, 0);
  const chapterTwoPlayableSeconds = playableContentSegments
    .filter((segment) => segment.chapter === 2)
    .reduce((total, segment) => total + segment.estimatedSeconds, 0);
  const combatRoomCount = playableContentSegments.filter((segment) => segment.type === 'combat-room').length;
  const chapterOneCombatRoomCount = chapterOneDungeonRooms.length;
  const chapterOneEnemyCount = chapterOneDungeonRooms.reduce((total, room) => total + room.enemyCount, 0);
  const bossCount = playableContentSegments.filter((segment) => segment.type === 'boss').length;
  return {
    minimumPlayableSeconds,
    totalPlayableSeconds,
    totalPlayableMinutes: Math.round((totalPlayableSeconds / 60) * 10) / 10,
    chapterOnePlayableSeconds,
    chapterOnePlayableMinutes: Math.round((chapterOnePlayableSeconds / 60) * 10) / 10,
    chapterOneMeetsMinimum: chapterOnePlayableSeconds >= 5000,
    chapterTwoPlayableSeconds,
    chapterTwoPlayableMinutes: Math.round((chapterTwoPlayableSeconds / 60) * 10) / 10,
    chapterTwoMeetsMinimum: chapterTwoPlayableSeconds >= 5000,
    chapterOneCombatRoomCount,
    chapterOneEnemyCount,
    dialogueExcluded: playableContentSegments.every((segment) => segment.dialogueExcluded),
    segmentCount: playableContentSegments.length,
    combatRoomCount,
    bossCount,
    meetsMinimum: totalPlayableSeconds >= minimumPlayableSeconds,
    segments: playableContentSegments,
  };
}
