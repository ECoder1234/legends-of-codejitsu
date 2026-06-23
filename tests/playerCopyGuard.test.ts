import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const sourceRoot = process.cwd();

const playerFacingFiles = [
  'src/scenes/ArchiveApproachScene.ts',
  'src/scenes/BossScene.ts',
  'src/scenes/Chapter2StoryScene.ts',
  'src/scenes/Chapter2TrailScene.ts',
  'src/scenes/DungeonScene.ts',
  'src/scenes/HubScene.ts',
  'src/scenes/ResultScene.ts',
  'src/scenes/StoryScene.ts',
  'src/scenes/TitleScene.ts',
  'src/scenes/TutorialScene.ts',
  'src/scenes/dialogueController.ts',
  'src/scenes/overlays.ts',
  'src/data/abilities.ts',
  'src/data/bosses.ts',
  'src/data/characters.ts',
  'src/data/dialogue.ts',
  'index.html',
];

const forbiddenPlayerCopy = [
  /straw/i,
  /sential/i,
  /sentinal/i,
  /new map/i,
  /chapter\s*1\s*map/i,
  /chapter\s*one\s*map/i,
  /map\s*2/i,
  /map\s*two/i,
  /gate\s*2/i,
  /2\s*gates/i,
  /const\s+LEGENDS/i,
  /CODEJITSU\s*\.execute\(\)/i,
  /made with phaser/i,
  /2[.,]5d game/i,
  /Dungeon objective:/i,
  /press ENTER at the gate/i,
  /warning shape/i,
];

function listFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const absolute = join(root, entry);
    const stats = statSync(absolute);
    return stats.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

function sourceStringLiterals(source: string): string[] {
  return Array.from(source.matchAll(/(["'`])(?:\\[\s\S]|(?!\1)[\s\S])*\1/g)).map((match) =>
    match[0].slice(1, -1),
  );
}

describe('player-facing copy guard', () => {
  it('keeps banned debug/prototype wording out of player-facing source strings', () => {
    const offenders = playerFacingFiles.flatMap((file) => {
      const source = readFileSync(join(sourceRoot, file), 'utf8');
      const literals = sourceStringLiterals(source).join('\n');
      return forbiddenPlayerCopy
        .filter((pattern) => pattern.test(literals))
        .map((pattern) => `${file}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps generated asset paths free of stale typo/prototype names', () => {
    const generatedRoot = join(sourceRoot, 'public/assets/generated');
    const files = listFiles(generatedRoot).map((file) => relative(sourceRoot, file));
    const manifest = readFileSync(join(sourceRoot, 'public/assets/generated/manifest.json'), 'utf8');
    const offenders = [...files, manifest].filter((entry) =>
      /straw|sential|sentinal|new-map|chapter-1-map|chapter-one-map|map-2|gate-2|2-gates/i.test(entry),
    );

    expect(offenders).toEqual([]);
  });
});
