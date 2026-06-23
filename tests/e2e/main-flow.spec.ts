import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test.setTimeout(420_000);

test('playable scenes route velocity through the physics guard', () => {
  const sceneFiles = [
    'src/scenes/TutorialScene.ts',
    'src/scenes/ArchiveApproachScene.ts',
    'src/scenes/HubScene.ts',
    'src/scenes/DungeonScene.ts',
    'src/scenes/BossScene.ts',
  ];
  const offenders = sceneFiles.filter((file) =>
    readFileSync(join(process.cwd(), file), 'utf8').includes('.setVelocity('),
  );
  const guardSource = readFileSync(join(process.cwd(), 'src/scenes/runtimeDebug.ts'), 'utf8');

  expect(offenders).toEqual([]);
  expect(guardSource).toContain('export function guardedSetVelocity');
  expect(guardSource).toContain('__CODEJITSU_PHYSICS_GUARD');
});

test('removed dodge mechanic stays removed from source and controls', () => {
  const files = [
    'src/systems/input.ts',
    'src/scenes/runtimeDebug.ts',
    'src/scenes/TutorialScene.ts',
    'src/scenes/DungeonScene.ts',
    'src/scenes/BossScene.ts',
    'src/data/tutorial.ts',
    'src/data/dialogue.ts',
    'src/data/bosses.ts',
    'src/data/characters.ts',
    'src/data/animations.ts',
    'src/scenes/actors.ts',
    'Plan.md',
  ];
  const offenders = files.filter((file) => /dodge/i.test(readFileSync(join(process.cwd(), file), 'utf8')));

  expect(offenders).toEqual([]);
});

test('player-facing UI copy avoids debug map labels', () => {
  const files = [
    'src/scenes/ArchiveApproachScene.ts',
    'src/scenes/TutorialScene.ts',
    'src/scenes/DungeonScene.ts',
    'src/scenes/HubScene.ts',
    'src/scenes/Chapter2TrailScene.ts',
    'src/scenes/TitleScene.ts',
    'src/data/dialogue.ts',
  ];
  const forbidden = [/New map/i, /Chapter 1 map/i, /Chapter 2 trail/i, /Archive Descent/i, /old map/i, /map gate/i, /lower gate/i, /lower seam/i, /Objective:/i, /Find seal/i, /Find seam/i, /Face target/i, /Open vow/i, /Enter the seam/i, /The seam shifts/i, /Follow seam/i, /Enter seam/i, /Right seam/i, /VOW SEAM OPENED/i, /RETURN THRESHOLD OPEN/i, /The seam bends toward/i, /Return Oni waits beyond/i, /const LEGENDS/i, /\.execute\(\)/i, /warning shape/i];
  const offenders = files.flatMap((file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    return forbidden
      .filter((pattern) => pattern.test(source))
      .map((pattern) => `${file}: ${pattern}`);
  });

  expect(offenders).toEqual([]);
  const generatedChapterOneNames = readdirSync(join(process.cwd(), 'public/assets/generated/chapter1'), { recursive: true })
    .map((entry) => String(entry));
  const staleGeneratedNames = generatedChapterOneNames.filter((entry) => /straw|sential|sentinal/i.test(entry));
  expect(staleGeneratedNames).toEqual([]);
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/assets/generated/manifest.json'), 'utf8')) as {
    titleStartSeal?: string;
    titleStartPlaque?: string;
    advancePromptSeal?: string;
    skipPromptSeal?: string;
    swordSwingVfx?: string;
    combatHitMarks?: string;
    combatTelegraphSigils?: string;
    bossTelegraphSigils?: string;
    bossHudPanel?: string;
    bossCombatCue?: string;
    bossPlayerCue?: string;
    bossFinisherCue?: string;
    bossAttackBanner?: string;
    bossAttackCue?: string;
    bossPhaseRupture?: string;
    bossComboCadence?: string;
    bossWarningLanes?: string;
    bossThreatPip?: string;
    healthBarFrame?: string;
    healthMeterFill?: string;
    terminalPanel?: string;
    pausePanel?: string;
    dialoguePanel?: string;
    resultPanel?: string;
    resultAmbientMotes?: string;
    resultAtmosphereOverlay?: string;
    warningSigils?: string;
    dungeonHudPanel?: string;
    tutorialHudPanel?: string;
    tutorialHintStrip?: string;
    chapter2TrailHudPanel?: string;
    chapter1?: { archivePracticeEcho?: string; tutorialVowTarget?: string; tutorialSigils?: string; tutorialFocusOverlay?: string; hubAtmosphereOverlay?: string; archiveApproachOverlay?: string; archiveMemoryShard?: string; archiveVowSeam?: string; archiveNullOniOmen?: string; introNullOniThreat?: string; binarySentinelCombat?: string; seamPortal?: string; nullOniShadowstep?: string; bossArenaAtmosphere?: string; dungeonAtmosphereOverlay?: string; dungeonSealStatus?: string; dungeonSeamTransition?: string; dungeonExitBeacon?: string; dungeonSentinelWarning?: string; hubSeamCue?: string; archiveSeamCue?: string };
    chapter2?: { trailAtmosphereOverlay?: string; trailStatusCue?: string; stageInterludeCue?: string; stageInterludeAtmosphere?: string; trailAttackMarkers?: string };
  };
  expect(manifest.titleStartSeal).toContain('title-start-seal-v1-alpha.png');
  expect(manifest.titleStartPlaque).toContain('title-start-plaque-v1-alpha-trim.png');
  expect(manifest.advancePromptSeal).toContain('advance-prompt-seal-v1-alpha.png');
  expect(manifest.skipPromptSeal).toContain('skip-prompt-seal-v1-alpha.png');
  expect(manifest.swordSwingVfx).toContain('sword-swing-vfx-v1-alpha.png');
  expect(manifest.combatHitMarks).toContain('combat-hit-marks-v1-alpha.png');
  expect(manifest.combatTelegraphSigils).toContain('codejitsu-telegraph-sigils-v2-alpha.png');
  expect(manifest.bossTelegraphSigils).toContain('codejitsu-boss-telegraph-sigils-v4-alpha.png');
  expect(manifest.bossHudPanel).toContain('boss-compact-hud-plaque-v1-alpha.png');
  expect(manifest.bossCombatCue).toContain('boss-combat-cue-v1-alpha.png');
  expect(manifest.bossPlayerCue).toContain('boss-player-cue-v1-alpha.png');
  expect(manifest.bossFinisherCue).toContain('boss-finisher-cue-v1-alpha.png');
  expect(manifest.bossAttackBanner).toContain('boss-attack-banner-v1-alpha-trim.png');
  expect(manifest.bossAttackCue).toContain('boss-attack-cue-v1-alpha.png');
  expect(manifest.bossPhaseRupture).toContain('boss-phase-rupture-v1-alpha.png');
  expect(manifest.bossComboCadence).toContain('boss-combo-cadence-v1-alpha.png');
  expect(manifest.bossWarningLanes).toContain('boss-warning-lanes-v3-alpha.png');
  expect(manifest.bossThreatPip).toContain('boss-threat-pip-v1-alpha-trim.png');
  expect(manifest.healthBarFrame).toContain('health-bar-frame-v1-alpha-trim.png');
  expect(manifest.healthMeterFill).toContain('health-meter-fill-v1-alpha.png');
  expect(manifest.terminalPanel).toContain('terminal-modal-frame-v1-alpha-trim.png');
  expect(manifest.pausePanel).toContain('pause-menu-plaque-v1-alpha-trim.png');
  expect(manifest.dialoguePanel).toContain('dialogue-panel-v1-alpha-trim.png');
  expect(manifest.resultPanel).toContain('result-panel-v1-alpha-trim.png');
  expect(manifest.resultAmbientMotes).toContain('result-ambient-motes-v1-alpha.png');
  expect(manifest.resultAtmosphereOverlay).toContain('result-atmosphere-overlay-v1-alpha.png');
  expect(manifest.warningSigils).toContain('warning-sigils-v1-alpha.png');
  expect(manifest.dungeonHudPanel).toContain('dungeon-hud-seal-strip-v1-alpha-trim.png');
  expect(manifest.tutorialHudPanel).toContain('tutorial-micro-plaque-v2-alpha.png');
  expect(manifest.tutorialHintStrip).toContain('tutorial-hint-strip-v1-alpha.png');
  expect(manifest.chapter2TrailHudPanel).toContain('chapter2-trail-hud-plaque-v1-alpha-trim.png');
  expect(manifest.chapter1?.archivePracticeEcho).toContain('archive-practice-echo-v3-alpha.png');
  expect(manifest.chapter1?.tutorialVowTarget).toContain('tutorial-vow-target-v2-alpha.png');
  expect(manifest.chapter1?.tutorialSigils).toContain('tutorial-sigils-v2-alpha.png');
  expect(manifest.chapter1?.tutorialFocusOverlay).toContain('tutorial-focus-overlay-v3-alpha.png');
  expect(manifest.chapter1?.hubAtmosphereOverlay).toContain('hub-atmosphere-overlay-v1-alpha.png');
  expect(manifest.chapter1?.archiveApproachOverlay).toContain('archive-approach-overlay-v1-alpha.png');
  expect(manifest.chapter1?.archiveMemoryShard).toContain('archive-memory-shard-v1-alpha.png');
  expect(manifest.chapter1?.archiveVowSeam).toContain('archive-vow-seam-v1-alpha.png');
  expect(manifest.chapter1?.archiveNullOniOmen).toContain('archive-null-oni-omen-v1-alpha.png');
  expect(manifest.chapter1?.introNullOniThreat).toContain('intro-null-oni-threat-v1-alpha.png');
  expect(manifest.chapter1?.hubSeamCue).toContain('hub-seam-cue-v1-alpha.png');
  expect(manifest.chapter1?.archiveSeamCue).toContain('archive-seam-cue-v1-alpha.png');
  expect(manifest.chapter1?.binarySentinelCombat).toContain('binary-sentinel-v4-alpha.png');
  expect(manifest.chapter1?.seamPortal).toContain('chapter1-seam-portal-v1-alpha.png');
  expect(manifest.chapter1?.nullOniShadowstep).toContain('null-oni-shadowstep-v1-alpha.png');
  expect(manifest.chapter1?.bossArenaAtmosphere).toContain('boss-arena-atmosphere-v1-alpha.png');
  expect(manifest.chapter1?.dungeonAtmosphereOverlay).toContain('dungeon-atmosphere-overlay-v1-alpha.png');
  expect(manifest.chapter1?.dungeonSealStatus).toContain('dungeon-seal-status-v1-alpha.png');
  expect(manifest.chapter1?.dungeonSeamTransition).toContain('dungeon-seam-transition-v1-alpha.png');
  expect(manifest.chapter1?.dungeonExitBeacon).toContain('dungeon-exit-beacon-v1-alpha.png');
  expect(manifest.chapter1?.dungeonSentinelWarning).toContain('dungeon-sentinel-warning-v1-alpha.png');
  expect(manifest.chapter2?.trailAtmosphereOverlay).toContain('trail-atmosphere-overlay-v1-alpha.png');
  expect(manifest.chapter2?.trailStatusCue).toContain('trail-status-cue-v1-alpha.png');
  expect(manifest.chapter2?.stageInterludeCue).toContain('stage-interlude-cue-v1-alpha.png');
  expect(manifest.chapter2?.stageInterludeAtmosphere).toContain('stage-interlude-atmosphere-v1-alpha.png');
  expect(manifest.chapter2?.trailAttackMarkers).toContain('trail-attack-markers-v1-alpha.png');
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/archive-vow-seam-v1-alpha.png')).byteLength).toBeGreaterThan(100_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/archive-null-oni-omen-v1-alpha.png')).byteLength).toBeGreaterThan(100_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/intro-null-oni-threat-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/hub-seam-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/archive-approach-overlay-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/dungeon-atmosphere-overlay-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-arena-atmosphere-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/result-atmosphere-overlay-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/hub-atmosphere-overlay-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/archive-seam-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/null-oni-shadowstep-v1-alpha.png')).byteLength).toBeGreaterThan(100_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/tutorial-hint-strip-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/tutorial-focus-overlay-v3-alpha.png')).byteLength).toBeGreaterThan(120_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/dungeon-seal-status-v1-alpha.png')).byteLength).toBeGreaterThan(100_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/dungeon-seam-transition-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/dungeon-exit-beacon-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/dungeon-sentinel-warning-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter2/trail-atmosphere-overlay-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter2/stage-interlude-atmosphere-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-combat-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-player-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-finisher-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-attack-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-phase-rupture-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-combo-cadence-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter1/boss-warning-lanes-v3-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter2/trail-status-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter2/stage-interlude-cue-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/chapter2/trail-attack-markers-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/advance-prompt-seal-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/skip-prompt-seal-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/sword-swing-vfx-v1-alpha.png')).byteLength).toBeGreaterThan(100_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/combat-hit-marks-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/result-ambient-motes-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/codejitsu-telegraph-sigils-v2-alpha.png')).byteLength).toBeGreaterThan(500_000);
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/codejitsu-boss-telegraph-sigils-v4-alpha.png')).byteLength).toBeGreaterThan(500_000);

  const bossSource = readFileSync(join(process.cwd(), 'src/scenes/BossScene.ts'), 'utf8');
  expect(bossSource).not.toMatch(/this\.add\.text\(/);
  expect(bossSource).not.toContain('null()');
  expect(bossSource).not.toMatch(/\$\{label\} -\$\{damage\}/);
  expect(bossSource).toContain('addCombatHitMark');
  expect(bossSource).not.toContain('PHASE 2: THE MASK RUPTURES');
  expect(bossSource).not.toContain('the room now attacks in lanes, rifts, and false returns');
  expect(bossSource).not.toMatch(/QUEUED/);
  expect(bossSource).not.toMatch(/`CHAIN \$\{/);
  expect(bossSource).toContain('addMaskShardVfx');
  expect(bossSource).toContain('collisionOnlyGeneratedTelegraph');
  const titleSource = readFileSync(join(process.cwd(), 'src/scenes/TitleScene.ts'), 'utf8');
  expect(titleSource).toContain('addGeneratedTitleAmbientDebris');
  expect(titleSource).not.toMatch(/this\.add\.rectangle\(px, py/);
  expect(titleSource).not.toContain('PRESS ENTER OR CLICK TO START');
  expect(readFileSync(join(process.cwd(), 'public/assets/generated/ui/title-start-seal-v1-alpha.png')).byteLength).toBeGreaterThan(500_000);
  const hubSource = readFileSync(join(process.cwd(), 'src/scenes/HubScene.ts'), 'utf8');
  expect(hubSource).not.toMatch(/makePixelText\(this, 640, 62, 'Dojo of Syntax'/);
  const resultSource = readFileSync(join(process.cwd(), 'src/scenes/ResultScene.ts'), 'utf8');
  expect(resultSource).not.toMatch(/archive\.ok|return vow|codeGlyphs/);
  expect(resultSource).not.toMatch(/Chapter \$\{chapter\} Cleared|Unlocked:|Press ENTER to begin Chapter|Press ENTER or click to retry/);
  expect(resultSource).not.toMatch(/makePixelText\([^)]*'ENTER'/s);
  expect(resultSource).toContain('addAdvancePromptSeal');
  const dialogueSource = readFileSync(join(process.cwd(), 'src/scenes/dialogueController.ts'), 'utf8');
  const chapter2StorySource = readFileSync(join(process.cwd(), 'src/scenes/Chapter2StoryScene.ts'), 'utf8');
  expect(dialogueSource).not.toMatch(/makePixelText\([^)]*'ENTER'/s);
  expect(chapter2StorySource).not.toMatch(/makePixelText\([^)]*'ENTER'/s);
  expect(dialogueSource).not.toContain("'SKIP'");
  expect(chapter2StorySource).not.toContain("'SKIP'");
  expect(dialogueSource).toContain('addDialogueTextPrompt');
  expect(chapter2StorySource).toContain('addDialogueTextPrompt');
  expect(dialogueSource).toContain("'Enter'");
  expect(chapter2StorySource).toContain("'Enter'");
  expect(dialogueSource).toContain("'Skip'");
  expect(chapter2StorySource).toContain("'Skip'");
  const dungeonSource = readFileSync(join(process.cwd(), 'src/scenes/DungeonScene.ts'), 'utf8');
  const chapter2TrailSource = readFileSync(join(process.cwd(), 'src/scenes/Chapter2TrailScene.ts'), 'utf8');
  expect(dungeonSource).not.toMatch(/addFloatingCombatText|\$\{ability\.displayName\} -/);
  expect(chapter2TrailSource).not.toMatch(/addFloatingCombatText|\$\{ability\.displayName\} -/);
  expect(dungeonSource).toContain('addCombatHitMark');
  expect(chapter2TrailSource).toContain('addCombatHitMark');
});

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

interface BrowserRuntimeIssue {
  type: string;
  text: string;
}

function installRuntimeIssueCapture(page: Page): BrowserRuntimeIssue[] {
  const issues: BrowserRuntimeIssue[] = [];
  const relevant = (text: string) =>
    /setVelocity|this\.body|AudioContext was prevented|Uncaught TypeError|phaser\.js|Security Error|moz-extension/i.test(text);

  page.on('console', (message) => {
    const text = message.text();
    if ((message.type() === 'error' || message.type() === 'warning') && relevant(text)) {
      issues.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => {
    issues.push({ type: 'pageerror', text: error.stack ?? error.message });
  });
  return issues;
}

function expectNoAppRuntimeIssues(issues: BrowserRuntimeIssue[]): void {
  const blocking = issues.filter((issue) =>
    issue.type === 'pageerror' ||
    /setVelocity|this\.body|Uncaught TypeError|AudioContext was prevented/i.test(issue.text),
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function expectPlayerInsideBounds(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const state = window.__CODEJITSU_PLAYER_BOUNDS;
      if (!state || state.scene !== expectedScene) return false;
      return (
        state.x >= state.bounds.left &&
        state.x <= state.bounds.right &&
        state.y >= state.bounds.top &&
        state.y <= state.bounds.bottom &&
        (!state.arena || (state.x >= state.arena.leftAtY && state.x <= state.arena.rightAtY))
      );
    }, scene),
  ).toBe(true);
}

async function expectArenaClampActive(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const state = window.__CODEJITSU_PLAYER_BOUNDS;
      if (!state || state.scene !== expectedScene || !state.arena) return false;
      const rectWidth = state.bounds.right - state.bounds.left;
      const arenaWidth = state.arena.rightAtY - state.arena.leftAtY;
      return state.arena.topWidthRatio < 0.75 && arenaWidth < rectWidth;
    }, scene),
  ).toBe(true);
}

async function expectDepthCues(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const cues = (window.__CODEJITSU_DEPTH_CUES ?? []).find((entry) => entry.scene === expectedScene);
      return Boolean(
        cues &&
        cues.topWidthRatio < 0.75 &&
        cues.bandCount >= 6 &&
        cues.foregroundOccluders >= 6 &&
        cues.foregroundDepth > 840 &&
        cues.actorDepthMode === 'y-sorted' &&
        cues.perspectiveScale === true &&
        cues.textureForeground === true,
      );
    }, scene),
  ).toBe(true);
}

async function expectDialogueStaging(page: Page, mode: string, minimumActors: number) {
  await expect.poll(() =>
    page.evaluate(({ expectedMode, expectedActors }) => {
      const staging = window.__CODEJITSU_DIALOGUE_STAGING;
      return Boolean(
        staging &&
        staging.mode === expectedMode &&
        staging.portraitCentered === true &&
        staging.activeActorVisible === true &&
        staging.activeActorPose.length > 0 &&
        staging.noActorOverlap === true &&
        staging.facingReadable === true &&
        staging.actorCount >= expectedActors,
      );
    }, { expectedMode: mode, expectedActors: minimumActors }),
  ).toBe(true);
}

async function expectTalkSound(page: Page, sceneName: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const sound = window.__CODEJITSU_TALK_SOUND;
      return Boolean(
        sound &&
        sound.scene === expectedScene &&
        sound.requested > 0 &&
        sound.played > 0 &&
        sound.audioState === 'running' &&
        sound.oscillator === 'square' &&
        sound.duration > 0 &&
        sound.lastFrequency >= 300 &&
        sound.lastEndFrequency >= 260,
      );
    }, sceneName),
  ).toBe(true);
}

async function expectBossTerminalGate(page: Page, answered: boolean) {
  await expect.poll(() =>
    page.evaluate((expectedAnswered) => {
      const gate = window.__CODEJITSU_BOSS_TERMINAL_GATE;
      return Boolean(
        gate &&
        gate.scene === 'boss' &&
        gate.required === true &&
        gate.requiredCommand === 'try.catch' &&
        gate.answered === expectedAnswered &&
        gate.finishUnlocked === expectedAnswered &&
        gate.status.includes(expectedAnswered ? 'vow answered' : 'mask cracked') &&
        gate.status.includes(expectedAnswered ? 'sealed' : 'vow try.catch'),
      );
    }, answered),
  ).toBe(true);
}

async function expectFrameHealth(page: Page, scenes: string[]) {
  await expect.poll(() =>
    page.evaluate((expectedScenes) => {
      const health = window.__CODEJITSU_FRAME_HEALTH ?? {};
      return expectedScenes.every((scene) => {
        const entry = health[scene];
        return Boolean(
          entry &&
          entry.frames >= 8 &&
          entry.healthy === true &&
          entry.longFrameCount <= 1 &&
          Number(entry.maxDeltaMs ?? 999) <= 260,
        );
      });
    }, scenes),
  ).toBe(true);
}

async function expectAbilityArtLoaded(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const art = window.__CODEJITSU_ABILITY_ART;
      return Boolean(
        art &&
        art.textureLoaded === true &&
        art.sourceWidth > 1000 &&
        art.sourceHeight > 400 &&
        art.effectTextureLoaded === true &&
        art.effectSourceWidth >= 1280 &&
        art.effectSourceHeight >= 768 &&
        art.effectFrameRows === 3 &&
        art.effectFrameColumns === 5 &&
        art.cards.length === 5 &&
        art.cards.every((card) => card.crop && card.crop.width > 200 && card.crop.height > 200),
      );
    }),
  ).toBe(true);
}

async function expectTelegraphAssetLoaded(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const asset = window.__CODEJITSU_TELEGRAPH_ASSET;
      return Boolean(
        asset &&
        asset.textureLoaded === true &&
        asset.textureKey === 'combat-telegraph-sigils' &&
        asset.sourceWidth >= 1900 &&
        asset.sourceHeight >= 700 &&
        asset.frameCount === 6 &&
        asset.generated === true &&
        asset.bossTextureLoaded === true &&
        asset.bossTextureKey === 'boss-telegraph-sigils' &&
        asset.bossSourceWidth >= 1800 &&
        asset.bossSourceHeight >= 600
      );
    }),
  ).toBe(true);
}

async function expectGeneratedTelegraphPublished(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const telegraphs = window.__CODEJITSU_GENERATED_TELEGRAPHS ?? [];
      return telegraphs.some((entry) =>
        entry.scene === expectedScene &&
        entry.textureKey === (expectedScene === 'boss' ? 'boss-telegraph-sigils' : 'combat-telegraph-sigils') &&
        entry.generated === true &&
        entry.width >= 90 &&
        entry.height >= 90 &&
        entry.alpha > 0.4,
      );
    }, scene),
  ).toBe(true);
}

async function expectBossWarningsUseGeneratedArt(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_BOSS_WARNING_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'boss' &&
        visual.usesGeneratedTelegraphs === true &&
        visual.usesImagegenWarningLanes === true &&
        Number(visual.generatedWarningLaneOverlayCount ?? 0) > 0 &&
        visual.warningLaneTextureKey === 'boss-warning-lanes' &&
        visual.generatedWarningCount > 0 &&
        visual.collisionShapeCount > 0 &&
        visual.collisionOnlyShapeCount === visual.collisionShapeCount &&
        visual.visiblePrimitiveWarningCount === 0 &&
        visual.collisionShapesHidden === true &&
        visual.primitiveWarningAlpha === 0 &&
        visual.generatedArtOnly === true,
      );
    }),
  ).toBe(true);
}

async function expectBossPhaseBreakUsesGeneratedArt(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_BOSS_PHASE_BREAK_VISUAL;
      return Boolean(
        visual &&
        visual.usesImagegenPhaseRupture === true &&
        visual.primitivePhasePieces === 0 &&
        visual.textLineCount === 0 &&
        visual.textureKey === 'boss-phase-rupture',
      );
    }),
  ).toBe(true);
}

async function expectBossImpactVfxPublished(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const effects = window.__CODEJITSU_BOSS_IMPACT_VFX ?? [];
      return effects.some((effect) =>
        effect.scene === 'boss' &&
        effect.generated === true &&
        effect.textureKey === 'boss-impact-vfx' &&
        effect.width >= 120 &&
        effect.height >= 70 &&
        ['slash-line', 'crescent', 'ring', 'pillar', 'palm', 'footprint'].includes(effect.kind),
      );
    }),
  ).toBe(true);
}

async function expectImpactVfxPublished(page: Page, scene: string, kind?: string) {
  await expect.poll(() =>
    page.evaluate(({ expectedScene, expectedKind }) => {
      const effects = window.__CODEJITSU_IMPACT_VFX ?? [];
      return effects.some((effect) =>
        effect.scene === expectedScene &&
        effect.generated === true &&
        effect.textureKey === 'boss-impact-vfx' &&
        effect.width >= 120 &&
        effect.height >= 70 &&
        (expectedKind === undefined || effect.kind === expectedKind),
      );
    }, { expectedScene: scene, expectedKind: kind }),
  ).toBe(true);
}

async function expectCombatHitMarksUseGeneratedArt(page: Page, scene: string, abilityId?: string) {
  await expect.poll(() =>
    page.evaluate(({ expectedScene, expectedAbility }) => {
      const visual = window.__CODEJITSU_COMBAT_HIT_MARK;
      return Boolean(
        visual &&
        visual.scene === expectedScene &&
        visual.usesImagegenCombatHitMark === true &&
        visual.textureKey === 'combat-hit-marks' &&
        visual.primitiveTextLabels === 0 &&
        visual.visibleTextLabels === false &&
        Number(visual.frameIndex ?? -1) >= 0 &&
        (expectedAbility === undefined || visual.abilityId === expectedAbility),
      );
    }, { expectedScene: scene, expectedAbility: abilityId }),
  ).toBe(true);
}

async function expectChapter2TrailAttackMarkersGenerated(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const marker = window.__CODEJITSU_CHAPTER2_ATTACK_MARKER;
      return Boolean(
        marker &&
        marker.scene === 'chapter2-trail' &&
        marker.usesGeneratedSigil === true &&
        marker.primitiveMarkerPieces === 0 &&
        marker.generatedArtOnly === true &&
        marker.usesImagegenMarker === true &&
        marker.markerTextureKey === 'chapter2-trail-attack-markers' &&
        Number(marker.markerFrameIndex ?? -1) >= 0 &&
        marker.width >= 140 &&
        marker.height >= 90 &&
        ['lane', 'burst', 'cage', 'pursuit'].includes(marker.sigilKind),
      );
    }),
  ).toBe(true);
}

async function expectChapter2StoryVisualsClean(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visuals = window.__CODEJITSU_CHAPTER2_STORY_VISUALS;
      return Boolean(
        visuals &&
        visuals.scene === 'chapter2-story' &&
        visuals.usesImagegenAura === true &&
        visuals.primitiveGateSigils === 0 &&
        visuals.textGlyphOverlays === 0 &&
        visuals.generatedGlyphStorm === true,
      );
    }),
  ).toBe(true);
}

async function expectTryCatchGuardActive(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const guard = window.__CODEJITSU_TRY_CATCH_GUARD;
      return Boolean(
        guard &&
        guard.scene === 'boss' &&
        guard.active === true &&
        guard.durationMs >= 6000 &&
        guard.playerHp > 0 &&
        guard.usesGeneratedSigil === true &&
        guard.bossFrozen === true,
      );
    }),
  ).toBe(true);
}

async function expectTerminalCommandCards(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const cards = window.__CODEJITSU_TERMINAL_COMMAND_CARDS ?? [];
      return cards.length === 5 &&
        cards.every((card) => card.usesGeneratedIcon === true) &&
        cards.some((card) => card.command === 'try.catch') &&
        cards.some((card) => card.command === 'loop.strike');
    }),
  ).toBe(true);
}

async function expectTerminalOverlayUsesGeneratedPanel(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_TERMINAL_VISUAL;
      return Boolean(
        visual &&
        visual.usesImagegenPanel === true &&
        visual.primitivePanelPieces === 0 &&
        visual.compactHelperCopy === true &&
        visual.panelWidth <= 860 &&
        visual.panelHeight <= 410,
      );
    }),
  ).toBe(true);
}

async function expectPauseOverlayUsesGeneratedPanel(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_PAUSE_VISUAL;
      return Boolean(
        visual &&
        visual.usesImagegenPanel === true &&
        visual.primitivePanelPieces === 0 &&
        visual.rowCount >= 2 &&
        visual.panelWidth <= 470 &&
        visual.panelHeight <= 540,
      );
    }),
  ).toBe(true);
}

async function expectChapter2TrailHudUsesGeneratedPanel(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL;
      return Boolean(
        visual &&
        visual.usesImagegenPanel === true &&
        visual.primitivePanelPieces === 0 &&
        visual.textureKey === 'chapter2-trail-hud-panel' &&
        visual.compactCopy === true &&
        visual.usesImagegenTrailCue === true &&
        visual.primitiveCuePieces === 0 &&
        Number(visual.trailCueFrameIndex ?? -1) >= 0 &&
        Number(visual.textOverlayCount ?? 0) >= 2 &&
        /Gate Loop|echoes remain/i.test(`${visual.objectiveCopy ?? ''}`) &&
        !/map|debug|press enter|walk to|rescue trail/i.test(`${visual.objectiveCopy ?? ''}`),
      );
    }),
  ).toBe(true);
}

async function expectDialogueUsesGeneratedPanel(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const layout = window.__CODEJITSU_DIALOGUE_LAYOUT;
      return Boolean(
        layout &&
        layout.usesImagegenPanel === true &&
        layout.primitivePanelPieces === 0 &&
        layout.usesIntegratedPortraitSocket === true &&
        layout.textLayout === 'portrait-left' &&
        layout.portraitInsidePanel === true,
      );
    }),
  ).toBe(true);
}

async function expectAdvancePromptSeal(page: Page, expectedScene?: string) {
  await expect.poll(() =>
    page.evaluate((sceneName) => {
      const prompt = window.__CODEJITSU_ADVANCE_PROMPT_SEAL;
      const dialogueTextPrompt = sceneName === 'StoryScene' || sceneName === 'chapter2-story';
      return Boolean(
        prompt &&
        prompt.usesImagegenPromptSeal === !dialogueTextPrompt &&
        prompt.textureKey === (dialogueTextPrompt ? 'text-prompt' : 'advance-prompt-seal') &&
        prompt.visibleTextPrompt === dialogueTextPrompt &&
        Number(prompt.frameIndex ?? -1) >= (dialogueTextPrompt ? -1 : 0) &&
        (sceneName === undefined || prompt.scene === sceneName),
      );
    }, expectedScene),
  ).toBe(true);
}

async function expectSkipPromptSeal(page: Page, expectedScene?: string) {
  await expect.poll(() =>
    page.evaluate((sceneName) => {
      const prompt = window.__CODEJITSU_SKIP_PROMPT_SEAL;
      const dialogueTextPrompt = sceneName === 'StoryScene' || sceneName === 'chapter2-story';
      return Boolean(
        prompt &&
        prompt.usesImagegenSkipSeal === !dialogueTextPrompt &&
        prompt.textureKey === (dialogueTextPrompt ? 'text-prompt' : 'skip-prompt-seal') &&
        prompt.visibleTextPrompt === dialogueTextPrompt &&
        prompt.visible === true &&
        Number(prompt.frameIndex ?? -1) >= (dialogueTextPrompt ? -1 : 0) &&
        (sceneName === undefined || prompt.scene === sceneName),
      );
    }, expectedScene),
  ).toBe(true);
}

async function expectLayoutAuditsClean(page: Page, keys: string[]) {
  await expect.poll(() =>
    page.evaluate((expectedKeys) => {
      const audits = window.__CODEJITSU_LAYOUT_AUDITS ?? {};
      return expectedKeys.every((key) => {
        const audit = audits[key];
        return Boolean(audit && audit.noOverflow === true && audit.noOverlap === true);
      });
    }, keys),
  ).toBe(true);
}

async function expectNoPublishedLayoutFailures(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const audits = Object.values(window.__CODEJITSU_LAYOUT_AUDITS ?? {});
      return audits.every((audit) => audit.noOverflow === true && audit.noOverlap === true);
    }),
  ).toBe(true);
}

async function expectTutorialPanelReadable(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const layout = window.__CODEJITSU_TUTORIAL_PANEL_LAYOUT;
      const flow = window.__CODEJITSU_TUTORIAL_FLOW;
      return Boolean(
        layout &&
        flow &&
        layout.noOverlap === true &&
        layout.fitsPanel === true &&
        layout.usesImagegenPanel === true &&
        layout.usesImagegenHintStrip === true &&
        layout.primitivePanelPieces === 0 &&
        layout.primitiveHintPieces === 0 &&
        layout.compactCopy === true &&
        layout.quietCopy === true &&
        layout.lowerDocked === true &&
        layout.microDocked === true &&
        layout.wordCount >= 8 &&
        layout.wordCount <= 20 &&
        !/find seal|find seam|face target|open vow|enter the seam/i.test(`${layout.objectiveCopy ?? ''} ${layout.statusCopy ?? ''}`) &&
        layout.panel.x <= 40 &&
        layout.panel.y >= 580 &&
        layout.panel.width <= 580 &&
        layout.panel.height <= 116 &&
        layout.gap >= 8 &&
        layout.hintGap >= 8 &&
        layout.panelAvoidsPlayfield === true &&
        Number(layout.playfieldGap ?? 0) >= 34 &&
        layout.hintFits === true &&
        layout.hintNoOverlap === true &&
        layout.hintFrameIndex >= 0 &&
        layout.hintFrameIndex <= 3 &&
        layout.hintTextureKey === 'tutorial-hint-strip' &&
        layout.instruction.width <= layout.panel.width - 100 &&
        layout.status.width <= layout.panel.width - 100 &&
        flow.stepCount >= 5 &&
        flow.controls.includes('WASD') &&
        flow.controls.includes('X') &&
        flow.controls.includes('T') &&
        flow.hasTerminalSlowTimeStep === true &&
        flow.codeLinesExplained.some((line) => /try\.catch.*counter oath/i.test(line)),
      );
    }),
  ).toBe(true);
}

async function expectTutorialMarkersUseGeneratedArt(page: Page, activeHighlight?: string) {
  await expect.poll(() =>
    page.evaluate((expectedHighlight) => {
      const visual = window.__CODEJITSU_TUTORIAL_MARKER_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'tutorial' &&
        visual.usesImagegenSigils === true &&
        visual.primitiveMarkerPieces === 0 &&
        visual.frameCount === 4 &&
        visual.markerFrameIndex >= 0 &&
        visual.warningFrameIndex >= 0 &&
        visual.textureKey === 'tutorial-sigils' &&
        visual.lowNoise === true &&
        Number(visual.markerWidth ?? 999) <= 180 &&
        Number(visual.warningWidth ?? 999) <= 170 &&
        (expectedHighlight === undefined || visual.activeHighlight === expectedHighlight),
      );
    }, activeHighlight),
  ).toBe(true);
}

async function expectTutorialBackdropClean(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const backdrop = window.__CODEJITSU_TUTORIAL_BACKDROP;
      return Boolean(
        backdrop &&
        backdrop.scene === 'tutorial' &&
        backdrop.textureKey === 'tutorial-yard' &&
        backdrop.usesCleanImagegenBackdrop === true &&
        backdrop.routeLineRemoved === true &&
        backdrop.noBakedText === true &&
        backdrop.noBakedCharacters === true &&
        backdrop.usesImagegenFocusOverlay === true &&
        backdrop.primitiveBackdropShadePieces === 0 &&
        backdrop.focusOverlayTextureKey === 'tutorial-focus-overlay' &&
        backdrop.sourceWidth >= 1280 &&
        backdrop.sourceHeight >= 720,
      );
    }),
  ).toBe(true);
}

async function expectTutorialGateUsesGeneratedArt(page: Page, visible: boolean) {
  await expect.poll(() =>
    page.evaluate((expectedVisible) => {
      const visual = window.__CODEJITSU_TUTORIAL_GATE_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'tutorial' &&
        visual.usesImagegenGate === true &&
        visual.primitiveGatePieces === 0 &&
        visual.textureKey === 'chapter1-seam-portal' &&
        visual.labelVisible === false &&
        visual.gateVisible === expectedVisible,
      );
    }, visible),
  ).toBe(true);
}

async function expectArchiveGateUsesGeneratedArt(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_ARCHIVE_GATE_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'archive-approach' &&
        visual.usesImagegenGate === true &&
        visual.primitiveGatePieces === 0 &&
        visual.textureKey === 'chapter1-seam-portal' &&
        visual.labelVisible === false &&
        visual.debugMapCopyVisible === false &&
        visual.roomTitleVisible === false &&
        visual.singleGatePresentation === true &&
        visual.noExtraGateOverlay === true,
      );
    }),
  ).toBe(true);
}

async function expectArchivePathUsesGeneratedVfx(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_ARCHIVE_PATH_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'archive-approach' &&
        visual.usesImagegenSeamVfx === true &&
        visual.textArrowCount === 0 &&
        visual.seamVfxCount >= 4,
      );
    }),
  ).toBe(true);
}

async function expectArchiveBackdropUsesGeneratedOverlay(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const backdrop = window.__CODEJITSU_ARCHIVE_BACKDROP;
      return Boolean(
        backdrop &&
        backdrop.scene === 'archive-approach' &&
        backdrop.textureKey === 'archive-memory' &&
        backdrop.usesImagegenApproachOverlay === true &&
        backdrop.primitiveBackdropShadePieces === 0 &&
        backdrop.overlayTextureKey === 'archive-approach-overlay' &&
        backdrop.noExtraGateOverlay === true &&
        backdrop.sourceWidth >= 1280 &&
        backdrop.sourceHeight >= 720,
      );
    }),
  ).toBe(true);
}

async function expectHubGateUsesGeneratedArt(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_HUB_GATE_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'hub' &&
        visual.usesImagegenGate === true &&
        visual.primitiveGatePieces === 0 &&
        visual.textureKey === 'chapter1-seam-portal' &&
        visual.binaryDigitLabels === 0 &&
        visual.gateVisible === true,
      );
    }),
  ).toBe(true);
}

async function expectHubHudUsesGeneratedPanel(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_HUB_HUD_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'hub' &&
        visual.usesImagegenPanel === true &&
        visual.primitivePanelPieces === 0 &&
        visual.usesImagegenHubCue === true &&
        visual.primitiveCuePieces === 0 &&
        visual.compactCopy === true &&
        visual.wordCount <= 1 &&
        Number(visual.textOverlayCount ?? 99) <= 1 &&
        visual.titleVisible === false &&
        Number(visual.hubCueFrameIndex ?? -1) >= 0 &&
        !/archive seam|outer seam|wasd|esc|dojo of syntax/i.test(`${visual.objectiveCopy ?? ''}`) &&
        visual.panelWidth <= 500 &&
        visual.panelHeight <= 90,
      );
    }),
  ).toBe(true);
}

async function expectHubBackdropUsesGeneratedAtmosphere(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const backdrop = window.__CODEJITSU_HUB_BACKDROP;
      return Boolean(
        backdrop &&
        backdrop.scene === 'hub' &&
        backdrop.textureKey === 'broken-dojo' &&
        backdrop.usesImagegenAtmosphere === true &&
        backdrop.primitiveBackdropShadePieces === 0 &&
        backdrop.atmosphereTextureKey === 'hub-atmosphere-overlay' &&
        backdrop.noExtraGateOverlay === true &&
        backdrop.sourceWidth >= 1280 &&
        backdrop.sourceHeight >= 720,
      );
    }),
  ).toBe(true);
}

async function expectArchiveHudUsesGeneratedPanel(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_ARCHIVE_HUD_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'archive-approach' &&
        visual.usesImagegenPanel === true &&
        visual.primitivePanelPieces === 0 &&
        visual.usesImagegenArchiveCue === true &&
        visual.primitiveCuePieces === 0 &&
        visual.compactCopy === true &&
        visual.wordCount === 0 &&
        Number(visual.textOverlayCount ?? 99) === 0 &&
        Number(visual.archiveCueFrameIndex ?? -1) >= 0 &&
        !/follow seam|enter seam|right seam|archive descent/i.test(`${visual.objectiveCopy ?? ''}`) &&
        visual.panelWidth <= 440 &&
        visual.panelHeight <= 80,
      );
    }),
  ).toBe(true);
}

async function expectDungeonGateUsesGeneratedArt(page: Page, open: boolean) {
  await expect.poll(() =>
    page.evaluate((expectedOpen) => {
      const visual = window.__CODEJITSU_DUNGEON_GATE_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'dungeon' &&
        visual.usesImagegenGate === true &&
        visual.primitiveGatePieces === 0 &&
        visual.textureKey === 'dungeon-exit-beacon' &&
        visual.labelVisible === false &&
        visual.gateVisible === expectedOpen &&
        visual.gateOpen === expectedOpen &&
        visual.singleGatePresentation === true &&
        visual.usesImagegenExitBeacon === true &&
        visual.dynamicPortalVisible === false &&
        visual.exitBeaconOnly === true &&
        visual.mapGateOnly === undefined,
      );
    }, open),
  ).toBe(true);
}

async function expectDungeonHudUsesGeneratedPanel(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_DUNGEON_HUD_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'dungeon' &&
        visual.usesImagegenPanel === true &&
        visual.primitivePanelPieces === 0 &&
        visual.usesImagegenSealStatus === true &&
        visual.primitiveSealStatusPieces === 0 &&
        visual.sealStatusTextureKey === 'dungeon-seal-status' &&
        Number(visual.sealStatusFrameIndex ?? -1) >= 0 &&
        visual.compactCopy === true &&
        Number(visual.wordCount ?? 99) >= 8 &&
        Number(visual.wordCount ?? 99) <= 12 &&
        visual.gateCopyVisible === false &&
        visual.noMapCopyVisible === true &&
        Number(visual.textOverlayCount ?? 99) === 2 &&
        /^Room \d+\/\d+: /.test(`${visual.objectiveCopy ?? ''}`) &&
        /sentinels left - X or T/i.test(`${visual.statusCopy ?? ''}`) &&
        !/map|chapter|objective/i.test(`${visual.objectiveCopy ?? ''} ${visual.statusCopy ?? ''}`) &&
        visual.panelWidth <= 480 &&
        visual.panelHeight <= 130,
      );
    }),
  ).toBe(true);
}

async function expectDungeonSentinelWarningsUseGeneratedArt(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_DUNGEON_SENTINEL_WARNING;
      return Boolean(
        visual &&
        visual.scene === 'dungeon' &&
        visual.usesImagegenWarningOverlay === true &&
        visual.textureKey === 'dungeon-sentinel-warning' &&
        Number(visual.warningOverlayCount ?? 0) > 0 &&
        visual.collisionOnly === true &&
        visual.generatedArtOnly === true &&
        Number(visual.primitiveWarningAlpha ?? 1) === 0,
      );
    }),
  ).toBe(true);
}

async function expectSeamVfxPublished(page: Page, scene: string, kind?: string) {
  await expect.poll(() =>
    page.evaluate(({ expectedScene, expectedKind }) => {
      const effects = window.__CODEJITSU_SEAM_VFX ?? [];
      return effects.some((effect) =>
        effect.scene === expectedScene &&
        effect.generated === true &&
        effect.textureKey === 'codejitsu-seam-vfx' &&
        effect.width >= 70 &&
        effect.height >= 50 &&
        (expectedKind === undefined || effect.kind === expectedKind),
      );
    }, { expectedScene: scene, expectedKind: kind }),
  ).toBe(true);
}

async function expectRoomBordersUseGeneratedVfx(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const border = (window.__CODEJITSU_ROOM_BORDER_VISUAL ?? []).find((entry) => entry.scene === expectedScene);
      return Boolean(
        border &&
        border.usesImagegenSeamVfx === true &&
        border.seamFragments >= 8 &&
        border.visibleRailAlpha <= 0.14 &&
        border.primitivePostAlpha === 0 &&
        border.generatedOnlyBorders === true,
      );
    }, scene),
  ).toBe(true);
}

async function expectBoundaryFeedback(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const feedback = window.__CODEJITSU_BOUNDARY_FEEDBACK;
      const player = window.__CODEJITSU_PLAYER_BOUNDS;
      if (!feedback || !player || feedback.scene !== expectedScene || player.scene !== expectedScene) return false;
      return feedback.visual === 'edge-shimmer' &&
        feedback.side !== 'none' &&
        feedback.arena.topWidthRatio < 0.75 &&
        feedback.clamped.x >= feedback.arena.leftAtY &&
        feedback.clamped.x <= feedback.arena.rightAtY &&
        feedback.clamped.y >= player.bounds.top &&
        feedback.clamped.y <= player.bounds.bottom &&
        Math.hypot(feedback.attempted.x - feedback.clamped.x, feedback.attempted.y - feedback.clamped.y) > 0.1;
    }, scene),
  ).toBe(true);
}

async function expectFadeTo(page: Page, sceneKey: string) {
  await expect.poll(() =>
    page.evaluate((expectedSceneKey) => {
      const transitions = [
        window.__CODEJITSU_TRANSITION,
        ...(window.__CODEJITSU_TRANSITION_HISTORY ?? []),
      ].filter(Boolean);
      return transitions.some((transition) => (
        (transition?.fadingTo === expectedSceneKey || transition?.fadingIn === expectedSceneKey) &&
        Number(transition?.darkAlpha ?? 0) > 0.55
      ));
    }, sceneKey),
  ).toBe(true);
}

async function expectStoryStageDarkTransition(page: Page, fromStage: string, toStage: string) {
  await expect.poll(() =>
    page.evaluate(({ from, to }) => {
      const transition = (window.__CODEJITSU_STAGE_TRANSITIONS ?? [])
        .find((entry) => entry.id === `${from}-to-${to}`);
      return Boolean(
        transition &&
        transition.effect === 'story-stage-dark' &&
        transition.letterbox === true &&
        transition.swapped === true &&
        transition.complete === true &&
        transition.maxDarkAlpha >= 0.85,
      );
    }, { from: fromStage, to: toStage }),
  ).toBe(true);
}

async function expectWalkGateArrival(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const transitions = [
        window.__CODEJITSU_TRANSITION,
        ...(window.__CODEJITSU_TRANSITION_HISTORY ?? []),
      ].filter(Boolean);
      return transitions.some((transition) => (
        transition?.walkingGate === expectedScene &&
        transition?.effect === 'gate-arrived' &&
        transition?.style === 'scroller-gate-walk' &&
        transition?.interpolation === 'phaser-tween-position' &&
        transition?.usesGeneratedGateVfx === true &&
        Number(transition?.primitiveGatePieces ?? 99) === 0 &&
        Number(transition?.generatedGatePieces ?? 0) >= 5 &&
        transition?.letterbox === true &&
        transition?.cameraPan === true &&
        Number(transition?.darkAlpha ?? 0) > 0.45 &&
        Number(transition?.pathLength ?? 0) > 10 &&
        transition?.arrived === true &&
        transition?.gateClosed === true &&
        transition?.fadeAfterArrival === true &&
        Number(transition?.distanceRemaining ?? 999) === 0
      ));
    }, scene),
  ).toBe(true);
}

async function expectWalkGateAnimation(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const transitions = (window.__CODEJITSU_TRANSITION_HISTORY ?? [])
        .filter((transition) =>
          transition?.walkingGate === expectedScene &&
          transition?.effect === 'gate-walk' &&
          transition?.style === 'scroller-gate-walk',
        );
      const frameIndices = transitions
        .map((transition) => Number(transition.actorFrameIndex ?? -1))
        .filter((frame) => frame >= 0);
      const progress = transitions
        .map((transition) => Number(transition.progress ?? -1))
        .filter((sample) => sample >= 0);
      const distances = transitions
        .map((transition) => Number(transition.distanceRemaining ?? -1))
        .filter((sample) => sample >= 0);
      return transitions.length >= 3 &&
        transitions.every((transition) => transition.interpolation === 'phaser-tween-position') &&
        transitions.every((transition) => transition.usesGeneratedGateVfx === true) &&
        transitions.every((transition) => Number(transition.primitiveGatePieces ?? 99) === 0) &&
        transitions.some((transition) => Number(transition.generatedGatePieces ?? 0) >= 5) &&
        transitions.some((transition) => transition.actorPose === 'walk') &&
        transitions.some((transition) => transition.actorMotionProfile === 'grounded-walk-cycle') &&
        transitions.some((transition) => transition.walkingAnimated === true) &&
        transitions.some((transition) => Number(transition.actorFrameCount ?? 0) > 1) &&
        transitions.some((transition) => Number(transition.footstepCount ?? 0) > 0) &&
        transitions.some((transition) => Number(transition.darkAlpha ?? 0) > 0.45) &&
        transitions.every((transition) => Number(transition.pathLength ?? 0) > 10) &&
        progress.length >= 2 &&
        Math.max(...progress) - Math.min(...progress) > 0.25 &&
        Math.max(...progress) > 0.75 &&
        distances.length >= 2 &&
        Math.max(...distances) - Math.min(...distances) > 5 &&
        new Set(frameIndices).size > 1;
    }, scene),
  ).toBe(true);
}

async function expectPlayerAnimationAdvances(page: Page, pose: string) {
  await expect.poll(async () => {
    const samples: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      samples.push(await page.evaluate((expectedPose) => {
        const state = window.__CODEJITSU_PLAYER_BOUNDS;
        if (!state || state.pose !== expectedPose || Number(state.frameCount ?? 0) < 2) return -1;
        return Number(state.frameIndex ?? -1);
      }, pose));
      await page.waitForTimeout(90);
    }
    return new Set(samples.filter((sample) => sample >= 0)).size;
  }).toBeGreaterThan(1);
}

async function expectPlayerPoseVariant(page: Page, pose: string, renderVariant: string, motionProfile: string) {
  await expect.poll(() =>
    page.evaluate(({ expectedPose, expectedVariant, expectedMotion }) => {
      const player = window.__CODEJITSU_PLAYER_BOUNDS;
      return Boolean(
        player &&
        player.pose === expectedPose &&
        player.renderVariant === expectedVariant &&
        player.motionProfile === expectedMotion,
      );
    }, { expectedPose: pose, expectedVariant: renderVariant, expectedMotion: motionProfile }),
  ).toBe(true);
}

async function expectMovementTraction(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const player = window.__CODEJITSU_PLAYER_BOUNDS;
      return Boolean(
        player &&
        player.scene === expectedScene &&
        player.pose === 'run' &&
        Number(player.tractionGrip ?? 0) > 0.5 &&
        Number(player.inputResponsiveness ?? 0) > 70 &&
        Number(player.cinematicSnap ?? 0) > 0.6 &&
        Number(player.stopGrip ?? 0) > 0.7 &&
        player.visualGrounded === true,
      );
    }, scene),
  ).toBe(true);
}

async function expectDepthMotion(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const motion = window.__CODEJITSU_DEPTH_MOTION;
      return Boolean(
        motion &&
        motion.scene === expectedScene &&
        motion.parallaxActive === true &&
        Number(motion.leadMagnitude ?? 0) > 1 &&
        Math.abs(Number(motion.overlayX ?? 640) - 640) > 0.05 &&
        Number(motion.overlayScale ?? 1) > 1,
      );
    }, scene),
  ).toBe(true);
}

async function expectMovementBrakesCleanly(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const player = window.__CODEJITSU_PLAYER_BOUNDS;
      return Boolean(
        player &&
        player.scene === expectedScene &&
        player.pose === 'idle' &&
        player.brakingSnap === true &&
        Number(player.driftSuppression ?? 0) > 0.35 &&
        Number(player.cinematicSnap ?? 0) > 0.3
      );
    }, scene),
  ).toBe(true);
}

async function expectSwordSwingPublished(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const swing = window.__CODEJITSU_SWORD_SWING;
      const player = window.__CODEJITSU_PLAYER_BOUNDS;
      if (!swing || !player || swing.scene !== expectedScene) return false;
      const reach = Math.hypot(swing.hitX - swing.x, swing.hitY - swing.y);
      return swing.at > 0 &&
        swing.inputKey === 'x' &&
        swing.weapon === 'sword' &&
        swing.hasBlade === true &&
        swing.usesImagegenVfx === true &&
        swing.primitivePieces === 0 &&
        Number(swing.vfxFrameIndex ?? -1) >= 0 &&
        swing.removedKeys.includes('j') &&
        reach > 70 &&
        Math.abs(swing.hitX - swing.x) > 45;
    }, scene),
  ).toBe(true);
}

async function expectSwordSwingTargetsEnemy(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const swing = window.__CODEJITSU_SWORD_SWING;
      const enemies = window.__CODEJITSU_ENEMY_BOUNDS ?? [];
      if (!swing || swing.scene !== expectedScene || !swing.aimedAtTarget || !swing.targetId) return false;
      return enemies.some((enemy) => enemy.scene === expectedScene && enemy.id === swing.targetId);
    }, scene),
  ).toBe(true);
}

async function expectControlScheme(page: Page, scene: string) {
  await expect.poll(() =>
    page.evaluate((expectedScene) => {
      const controls = window.__CODEJITSU_CONTROL_SCHEME;
      return Boolean(
        controls &&
        controls.scene === expectedScene &&
        controls.move === 'WASD' &&
        controls.swing === 'X' &&
        controls.terminal === 'T' &&
        controls.removedAttackKeys.includes('J'),
      );
    }, scene),
  ).toBe(true);
}

async function expectChapterRouteProgress(page: Page, currentArea: string, roomIndex?: number) {
  await expect.poll(() =>
    page.evaluate(({ expectedArea, expectedRoom }) => {
      const progress = window.__CODEJITSU_CHAPTER1_ROUTE_PROGRESS;
      const forbiddenRoomLabel = /Archive Shard Walk|Sentinel Passage|Broken Boolean Gate|Data Ash Crossing|Bitmask Bridge|Cache Shrine|Archive Reliquary|Checksum Mausoleum|Null Gate Antechamber|Oni Threshold/i;
      return Boolean(
        progress &&
        window.__CODEJITSU_CHAPTER1_MAP_FLOW === undefined &&
        progress.currentArea === expectedArea &&
        (expectedRoom === undefined || (
          progress.mapProgressCopyVisible === false &&
          !forbiddenRoomLabel.test(progress.currentArea)
        )) &&
        progress.totalRooms >= 10 &&
        progress.approachSceneActive === (expectedRoom === undefined) &&
        progress.routeStage === (expectedRoom === undefined ? 'approach' : 'dungeon') &&
        (expectedRoom === undefined || progress.roomIndex === expectedRoom),
      );
    }, { expectedArea: currentArea, expectedRoom: roomIndex }),
  ).toBe(true);
}

async function expectDungeonRoomVisual(page: Page, currentArea: string, roomIndex: number, cropIndex?: number) {
  await expect.poll(() =>
    page.evaluate(({ expectedArea, expectedRoom, expectedCrop }) => {
      const visual = window.__CODEJITSU_DUNGEON_ROOM_VISUAL;
      const forbiddenRoomLabel = /Archive Shard Walk|Sentinel Passage|Broken Boolean Gate|Data Ash Crossing|Bitmask Bridge|Cache Shrine|Archive Reliquary|Checksum Mausoleum|Null Gate Antechamber|Oni Threshold/i;
      return Boolean(
        visual &&
        visual.scene === 'dungeon' &&
        visual.currentArea === expectedArea &&
        visual.roomNameHidden === true &&
        visual.mapProgressCopyVisible === false &&
        !forbiddenRoomLabel.test(visual.currentArea) &&
        visual.currentMap === undefined &&
        visual.roomIndex === expectedRoom &&
        visual.totalRooms >= 10 &&
        visual.usesGeneratedRoomBackdrop === true &&
        visual.usesImagegenAtmosphereOverlay === true &&
        visual.primitiveBackdropShadePieces === 0 &&
        visual.atmosphereTextureKey === 'dungeon-atmosphere-overlay' &&
        visual.gateMarkerHiddenWhenLocked === true &&
        visual.repeatedGateMarkerVisible === false &&
        visual.roomTitleVisible === false &&
        visual.textureKey !== 'dungeon-gate' &&
        (expectedCrop === undefined || visual.cropIndex === expectedCrop),
      );
    }, { expectedArea: currentArea, expectedRoom: roomIndex, expectedCrop: cropIndex }),
  ).toBe(true);
}

async function expectChapterOnePlaytimeRuntime(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const runtime = window.__CODEJITSU_CHAPTER1_PLAYTIME_RUNTIME;
      return Boolean(
        runtime &&
        runtime.scene === 'dungeon' &&
        runtime.dialogueExcluded === true &&
        runtime.chapterOneMeetsMinimum === true &&
        runtime.minimumPlayableSeconds === 900 &&
        runtime.chapterOnePlayableSeconds >= 1140 &&
        runtime.chapterOnePlayableMinutes >= 19 &&
        runtime.actualRoomCount === 10 &&
        runtime.auditRoomCount === 10 &&
        runtime.roomIdsMatchAudit === true &&
        runtime.actualEnemyCount >= 39 &&
        runtime.auditEnemyCount === runtime.actualEnemyCount &&
        runtime.duplicateSpawnCount === 0 &&
        runtime.duplicateFreeSpawns === true &&
        runtime.playerFacingArea === 'Sealed Archive' &&
        runtime.internalLabelsHidden === true &&
        runtime.mapProgressCopyVisible === false,
      );
    }),
  ).toBe(true);
}

async function expectDungeonRoomTransitionUsesGeneratedSeam(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const visual = window.__CODEJITSU_DUNGEON_ROOM_TRANSITION_VISUAL;
      return Boolean(
        visual &&
        visual.scene === 'dungeon' &&
        visual.usesImagegenSeamTransition === true &&
        visual.primitiveOverlayPieces === 0 &&
        visual.textOverlayCount === 0 &&
        visual.generatedTransitionPieces >= 2 &&
        visual.textureKey === 'dungeon-seam-transition',
      );
    }),
  ).toBe(true);
}

async function expectJDoesNotSwing(page: Page) {
  const before = await page.evaluate(() => window.__CODEJITSU_SWORD_SWING?.at ?? 0);
  await page.keyboard.press('j');
  await page.waitForTimeout(260);
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_SWORD_SWING?.at ?? 0)).toBe(before);
}

async function expectGeneratedFramesClean(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const entries = window.__CODEJITSU_ASSET_AUDIT ?? [];
      if (entries.length < 6) return false;
      return entries.every((entry) => entry.padding >= 14 && entry.border >= 4 && entry.alphaErrors === 0);
    }),
  ).toBe(true);
}

async function expectChapter1AnimationCatalog(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const catalog = window.__CODEJITSU_ANIMATION_CATALOG ?? [];
      const requiredKinds = ['hero', 'mentor', 'sentinel', 'oni'];
      if (catalog.length < requiredKinds.length) return false;
      return requiredKinds.every((kind) => {
        const entry = catalog.find((candidate) => candidate.kind === kind);
        if (!entry || !entry.usesGeneratedTexture || !entry.allRequiredPresent) return false;
        if (entry.requiredPoseCount < 7 || entry.animatedPoseCount < 5) return false;
        const requiredAnimated = entry.poses.filter((pose) => pose.requiredAnimated);
        return requiredAnimated.every((pose) =>
          pose.present &&
          pose.animated &&
          pose.frameCount > 1 &&
          pose.renderVariant.length > 0 &&
          pose.motionProfile.length > 0,
        );
      });
    }),
  ).toBe(true);
}

async function expectGeneratedBackdropsQuality(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const entries = window.__CODEJITSU_BACKDROP_QUALITY ?? [];
      const requiredRoles = ['title-cover', 'story-archive', 'dojo-map', 'dungeon-map', 'boss-map', 'foreground-depth', 'chapter2-outdoor-map', 'chapter2-boss-map', 'result-cinematic-backdrop', 'result-victory-backdrop', 'result-death-backdrop', 'chapter2-vow-interlude'];
      const requiredStageRoles = ['chapter2-stage-gate-loop', 'chapter2-stage-boolean-switchback', 'chapter2-stage-array-shrine', 'chapter2-stage-runtime-ravine', 'chapter2-stage-return-threshold'];
      return [...requiredRoles, ...requiredStageRoles].every((role) => {
        const entry = entries.find((candidate) => candidate.role === role);
        return Boolean(
          entry &&
          entry.exists &&
          entry.coversCanvas &&
          entry.fullResolution &&
          entry.noUpscaleNeeded &&
          entry.sourceWidth >= 1280 &&
          entry.sourceHeight >= 720,
        );
      });
    }),
  ).toBe(true);
}

async function expectGeneratedCombatSheetsQuality(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const entries = window.__CODEJITSU_COMBAT_SHEET_QUALITY ?? [];
      const requiredRoles = ['apprentice-combat', 'master-keiko-combat', 'binary-sentinel-combat', 'null-oni-boss-combat', 'return-oni-combat'];
      return requiredRoles.every((role) => {
        const entry = entries.find((candidate) => candidate.role === role);
        return Boolean(
          entry &&
          entry.exists &&
          entry.highResolution &&
          entry.transparentCapable &&
          entry.alphaSampled &&
          entry.transparentCorners &&
          entry.cleanTransparentEdges &&
          Number(entry.edgeBleedScore ?? 1) < 0.16 &&
          entry.generatedCombatSheet &&
          entry.notFallbackAtlas &&
          entry.sourceWidth >= entry.minimumWidth &&
          entry.sourceHeight >= entry.minimumHeight,
        );
      });
    }),
  ).toBe(true);
}

async function expectEnemiesGrounded(page: Page, scene: string, minimumCount: number) {
  await expect.poll(() =>
    page.evaluate(({ expectedScene, expectedCount }) => {
      const enemies = (window.__CODEJITSU_ENEMY_BOUNDS ?? []).filter((enemy) => enemy.scene === expectedScene && enemy.hp > 0);
      if (enemies.length < expectedCount) return false;
      return enemies.every((enemy) =>
        enemy.bodyAlive &&
        (expectedScene !== 'dungeon' || (
          enemy.displayName === 'Binary Sentinel' &&
          enemy.speciesId === 'binary-sentinel' &&
          enemy.usesImagegenCombatSheet === true &&
          enemy.cleanIdentity === true &&
          !/straw|sential|sentinal/i.test([
            enemy.id,
            enemy.displayName,
            enemy.speciesId,
            enemy.renderVariant,
          ].filter(Boolean).join(' '))
        )) &&
        enemy.visualGrounded === true &&
        Number(enemy.visualScale ?? 0) > 0.9 &&
        enemy.noOverlap === true &&
        Number(enemy.distanceToPlayer ?? 0) > 90,
      );
    }, { expectedScene: scene, expectedCount: minimumCount }),
  ).toBe(true);
}

async function expectBossMotionStable(page: Page, bossId: string) {
  await expect.poll(() =>
    page.evaluate((expectedBossId) => {
      const motion = window.__CODEJITSU_BOSS_MOTION;
      return Boolean(
        motion &&
        motion.scene === 'boss' &&
        motion.id === expectedBossId &&
        motion.samples >= 12 &&
        motion.snapFree === true &&
        motion.cappedSeparation === true &&
        motion.noHardStop === true &&
        motion.glideDamping === true &&
        motion.velocityUsesFrameDelta === true &&
        motion.visualGrounded === true &&
        motion.usesImagegenAura === true &&
        motion.auraVisible === true &&
        motion.usesImagegenMotionSmear === true &&
        motion.usesImagegenShadowstep === true &&
        motion.usesImagegenTrail === true &&
        Number(motion.generatedAfterimages ?? 0) > 0 &&
        motion.primitiveAfterimages === 0 &&
        Number(motion.motionSmearFrameWidth ?? 0) > 300 &&
        Number(motion.motionSmearFrameHeight ?? 0) > 600 &&
        Number(motion.motionSmearFrameCount ?? 0) === 6 &&
        Number(motion.shadowstepFrameWidth ?? 0) > 200 &&
        Number(motion.shadowstepFrameHeight ?? 0) > 200 &&
        Number(motion.trailFrameWidth ?? 0) > 300 &&
        Number(motion.trailFrameHeight ?? 0) > 500 &&
        motion.movementState.startsWith('boss-') &&
        Number(motion.maxFrameStep ?? 999) <= 26 &&
        Number(motion.distanceToPlayer ?? 0) >= 90 &&
        Number(motion.frameCount ?? 0) > 1 &&
        Boolean(motion.renderVariant) &&
        Boolean(motion.motionProfile),
      );
    }, bossId),
  ).toBe(true);
}

async function expectBossBackdropUsesGeneratedAtmosphere(page: Page, bossId: string) {
  await expect.poll(() =>
    page.evaluate((expectedBossId) => {
      const backdrop = window.__CODEJITSU_BOSS_BACKDROP;
      return Boolean(
        backdrop &&
        backdrop.scene === 'boss' &&
        backdrop.bossId === expectedBossId &&
        backdrop.textureKey === 'null-oni-arena' &&
        backdrop.usesGeneratedArena === true &&
        backdrop.usesImagegenAtmosphereOverlay === true &&
        backdrop.primitiveBackdropShadePieces === 0 &&
        backdrop.atmosphereTextureKey === 'boss-arena-atmosphere' &&
        backdrop.bossTitleVisible === false &&
        backdrop.sourceWidth >= 1280 &&
        backdrop.sourceHeight >= 720,
      );
    }, bossId),
  ).toBe(true);
}

async function expectRespawnFromDeath(page: Page, bossId: string) {
  await expect.poll(() =>
    page.evaluate((expectedBossId) => {
      const respawn = window.__CODEJITSU_RESPAWN_STATE;
      return Boolean(
        respawn &&
        respawn.scene === 'boss' &&
        respawn.source === 'death-retry' &&
        respawn.bossId === expectedBossId &&
        respawn.playerHp === respawn.maxHp &&
        respawn.bossHp > 0 &&
        respawn.abilityEnergy > 0 &&
        respawn.terminalOpen === false &&
        respawn.paused === false &&
        respawn.timeScale === 1 &&
        respawn.staleDeathCleared === true &&
        respawn.staleResultCleared === true &&
        respawn.staleResultLayoutCleared === true &&
        respawn.staleBossWarningCleared === true &&
        respawn.staleBossTelegraphCleared === true &&
        respawn.staleBossBannerCleared === true &&
        respawn.staleTransitionCleared === true &&
        respawn.terminalBufferCleared === true &&
        respawn.delayedUntilFadeClear === true &&
        respawn.usesImagegenSeal === true &&
        respawn.sealFrameCount === 4 &&
        respawn.controlsReady === true &&
        window.__CODEJITSU_DEATH_SCREEN === undefined &&
        window.__CODEJITSU_RESULT_SCENE === undefined &&
        window.__CODEJITSU_TERMINAL_OPEN === false &&
        window.__CODEJITSU_PAUSED === false &&
        window.__CODEJITSU_TIME_SCALE === 1,
      );
    }, bossId),
  ).toBe(true);
}

async function expectEnemyPoseAnimation(page: Page, scene: string, pose: string, minimumCount = 1) {
  await expect.poll(async () => {
    const frameSamples: number[] = [];
    let matchingCount = 0;
    let hasMotionProfile = false;
    for (let index = 0; index < 7; index += 1) {
      const sample = await page.evaluate(({ expectedScene, expectedPose }) => {
        const enemies = (window.__CODEJITSU_ENEMY_BOUNDS ?? []).filter((enemy) =>
          enemy.scene === expectedScene &&
          enemy.hp > 0 &&
          enemy.pose === expectedPose &&
          Number(enemy.frameCount ?? 0) > 1,
        );
        return {
          count: enemies.length,
          frameIndices: enemies.map((enemy) => Number(enemy.frameIndex ?? -1)),
          hasMotionProfile: enemies.some((enemy) => Boolean(enemy.motionProfile) && Boolean(enemy.renderVariant)),
        };
      }, { expectedScene: scene, expectedPose: pose });
      matchingCount = Math.max(matchingCount, sample.count);
      hasMotionProfile ||= sample.hasMotionProfile;
      frameSamples.push(...sample.frameIndices.filter((frame) => frame >= 0));
      await page.waitForTimeout(110);
    }
    return matchingCount >= minimumCount && new Set(frameSamples).size > 1 && hasMotionProfile;
  }).toBe(true);
}

async function expectBossHudReadable(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => {
      const layout = window.__CODEJITSU_BOSS_HUD_LAYOUT;
      return Boolean(
        layout &&
        layout.usesImagegenPanel === true &&
        layout.primitivePanelPieces === 0 &&
        layout.usesImagegenPlayerCue === true &&
        layout.primitivePlayerCuePieces === 0 &&
        Number(layout.playerCueFrameIndex ?? -1) >= 0 &&
        layout.usesImagegenBossCue === true &&
        layout.primitiveCuePieces === 0 &&
        Number(layout.bossCueFrameIndex ?? -1) >= 0 &&
        Number(layout.textOverlayCount ?? 99) === 0 &&
        !/vow:|combo|energy|x strike|try\\.catch|back off|vow failed|vow required|mask ruptures|chain incoming|read mark/i.test(`${layout.objectiveCopy ?? ''}`) &&
        layout.compactCopy === true &&
        layout.noOverflow === true &&
        layout.playerHudNoOverflow === true &&
        layout.topOverlayNoOverlap === true &&
        layout.titleVisible === false &&
        layout.status.width <= layout.panel.width - 24 &&
        layout.status.bottom <= layout.panel.bottom - 10 &&
        layout.wordCount <= 12 &&
        layout.lines <= 4,
      );
    }),
  ).toBe(true);
  await expectGeneratedHealthBars(page, 'boss', ['Apprentice', 'Null Oni']);
}

async function expectGeneratedHealthBars(page: Page, scene: string, labels: string[]) {
  await expect.poll(() =>
    page.evaluate(({ expectedScene, expectedLabels }) => {
      const entries = window.__CODEJITSU_HEALTH_BAR_VISUAL ?? [];
      return expectedLabels.every((label) => {
        const entry = entries.find((candidate) =>
          candidate.label === label &&
          (candidate.scene === expectedScene || candidate.scene.toLowerCase().includes(expectedScene.toLowerCase())),
        );
        return Boolean(
          entry &&
          entry.usesImagegenFrame === true &&
          entry.usesImagegenFill === true &&
          entry.primitiveFramePieces === 0 &&
          entry.primitiveFillPieces === 0 &&
          entry.generatedFillCropped === true &&
          entry.frameWidth > 0 &&
          entry.frameHeight > 0 &&
          entry.fillWidth >= 0,
        );
      });
    }, { expectedScene: scene, expectedLabels: labels }),
  ).toBe(true);
}

interface PrimitiveFallbackIssue {
  route: string;
  scene: string;
  path: string;
  value: unknown;
}

async function expectGeneratedArtHasNoPrimitiveFallbacks(page: Page, route: string) {
  const issues = await page.evaluate((routeName) => {
    const root = window as unknown as Window & Record<string, unknown>;
    const visited = new WeakSet<object>();
    const offenders: PrimitiveFallbackIssue[] = [];

    const inspect = (value: unknown, path: string) => {
      if (!value || typeof value !== 'object') return;
      if (visited.has(value)) return;
      visited.add(value);

      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const childPath = `${path}.${key}`;
        if (/primitive/i.test(key)) {
          const failedNumber = typeof child === 'number' && child > 0;
          const failedBoolean = child === true;
          const failedString = typeof child === 'string' && child.trim().length > 0;
          if (failedNumber || failedBoolean || failedString) {
            offenders.push({
              route: routeName,
              scene: String(root.__CODEJITSU_SCENE ?? 'unknown'),
              path: childPath,
              value: child,
            });
          }
        }
        inspect(child, childPath);
      }
    };

    for (const [key, value] of Object.entries(root)) {
      if (key.startsWith('__CODEJITSU_')) inspect(value, key);
    }

    return offenders;
  }, route);

  expect(issues).toEqual([]);
}

async function waitForRouteVisualRuntime(page: Page, scene: string) {
  await page.waitForFunction((expectedScene) => window.__CODEJITSU_SCENE === expectedScene, scene);
  if (scene === 'title') {
    await page.waitForFunction(() => window.__CODEJITSU_TITLE_LAYOUT?.fallAnimation?.complete === true);
  }
  if (scene === 'boss') {
    await page.waitForFunction(() => window.__CODEJITSU_BOSS_MOTION?.usesImagegenMotionSmear === true);
    await page.waitForFunction(() => window.__CODEJITSU_BOSS_HUD_LAYOUT?.usesImagegenPanel === true);
  }
  if (scene === 'dungeon') {
    await page.waitForFunction(() => window.__CODEJITSU_DUNGEON_HUD_VISUAL?.usesImagegenPanel === true);
  }
  if (scene === 'chapter2-trail') {
    await page.waitForFunction(() => window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL?.usesImagegenPanel === true);
  }
}

async function clearVisibleSentinels(page: Page, maxSwings = 18) {
  const openingEnemyCount = await page.evaluate(() =>
    (window.__CODEJITSU_ENEMY_BOUNDS ?? []).filter((enemy) => enemy.scene === 'dungeon' && enemy.hp > 0 && enemy.bodyAlive).length,
  );
  if (openingEnemyCount >= 3) {
    await castTerminalCommand(page, 'try.catch');
    await page.waitForTimeout(260);
  }
  for (let index = 0; index < maxSwings; index += 1) {
    const target = await page.evaluate(() => {
      const enemies = (window.__CODEJITSU_ENEMY_BOUNDS ?? [])
        .filter((enemy) => enemy.scene === 'dungeon' && enemy.hp > 0 && enemy.bodyAlive)
        .sort((a, b) => a.hp - b.hp);
      const enemy = enemies[0];
      return enemy ? { x: enemy.x, y: enemy.y } : null;
    });
    if (!target) return;
    await steerPlayerNear(page, Math.max(220, target.x - 92), target.y, 46);
    await page.keyboard.press('x');
    await page.waitForTimeout(240);
  }
}

async function castTerminalCommand(page: Page, command: string) {
  await page.keyboard.press('t');
  try {
    await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true, undefined, { timeout: 4_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      scene: window.__CODEJITSU_SCENE,
      terminalOpen: window.__CODEJITSU_TERMINAL_OPEN,
      trail: window.__CODEJITSU_CHAPTER2_TRAIL,
      death: window.__CODEJITSU_DEATH_SCREEN,
    }));
    throw new Error(`Terminal did not open for ${command}: ${JSON.stringify(state)}`, { cause: error });
  }
  await page.keyboard.type(command, { delay: 18 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === false, undefined, { timeout: 4_000 });
}

async function clearChapter2TrailStage(page: Page, maxActions = 18) {
  for (let index = 0; index < maxActions; index += 1) {
    const target = await page.evaluate(() => {
      const trail = window.__CODEJITSU_CHAPTER2_TRAIL;
      const enemy = (trail?.enemies ?? [])
        .filter((candidate) => candidate.hp > 0)
        .sort((a, b) => a.hp - b.hp)[0];
      return enemy ? { x: enemy.x, y: enemy.y, remaining: trail?.remaining ?? 0 } : null;
    });
    if (!target || target.remaining <= 0) return;
    await steerPlayerNear(page, Math.max(220, target.x - 82), target.y, 54);
    if (index % 2 === 0) {
      await castTerminalCommand(page, 'loop.strike');
    } else {
      await page.keyboard.press('x');
      await page.waitForTimeout(230);
    }
  }
}

async function enterChapter2Gate(page: Page) {
  await steerPlayerNear(page, 930, 342, 74);
  await page.keyboard.press('Enter');
}

async function seedLoopStrikeSave(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('legends-of-codejitsu-save-v1', JSON.stringify({
      unlockedAbilities: ['try-catch', 'loop-strike'],
      clearedChapters: [1],
      playerUpgrades: { maxHp: 100, maxEnergy: 100 },
      currentCheckpoint: 'chapter2-boss',
    }));
  });
}

async function beatReturnOniWithControls(page: Page) {
  await seedLoopStrikeSave(page);
  if (await page.evaluate(() => window.__CODEJITSU_SCENE === 'victory-dialogue')) return;
  for (let index = 0; index < 8; index += 1) {
    const comboReady = await page.evaluate(() => Number(window.__CODEJITSU_BOSS_HIT_FEEDBACK?.comboCount ?? 0) >= 2);
    if (comboReady) break;
    const target = await page.evaluate(() => {
      const boss = (window.__CODEJITSU_ENEMY_BOUNDS ?? []).find((enemy) => enemy.scene === 'boss');
      return boss ? { x: boss.x - 104, y: boss.y + 10 } : { x: 744, y: 384 };
    });
    await steerPlayerNear(page, target.x, target.y, 48);
    await page.keyboard.press('x');
    await page.waitForTimeout(280);
  }
  await expect.poll(() => page.evaluate(() => Number(window.__CODEJITSU_BOSS_HIT_FEEDBACK?.comboCount ?? 0) >= 2)).toBe(true);
  await castTerminalCommand(page, 'loop.strike');
  await expect.poll(() => page.evaluate(() => {
    if (window.__CODEJITSU_SCENE === 'victory-dialogue') return true;
    const gate = window.__CODEJITSU_BOSS_TERMINAL_GATE;
    return Boolean(gate && gate.requiredCommand === 'loop.strike' && gate.answered === true);
  })).toBe(true);
  if (await page.evaluate(() => window.__CODEJITSU_SCENE === 'victory-dialogue')) return;
  for (let index = 0; index < 24; index += 1) {
    if (await page.evaluate(() => window.__CODEJITSU_SCENE === 'victory-dialogue')) return;
    await steerPlayerNear(page, 744, 384, 76);
    await page.keyboard.press('x');
    await page.waitForTimeout(250);
  }
}

async function finishActiveBossWithControls(page: Page, command: string, maxActions = 42) {
  for (let index = 0; index < maxActions; index += 1) {
    const scene = await page.evaluate(() => window.__CODEJITSU_SCENE);
    if (scene === 'victory-dialogue') return;
    if (scene !== 'boss') {
      throw new Error(`Expected to finish boss, but scene is ${scene}`);
    }
    if (index > 0 && index % 10 === 0) {
      await castTerminalCommand(page, command);
    }
    const target = await page.evaluate(() => {
      const boss = (window.__CODEJITSU_ENEMY_BOUNDS ?? []).find((enemy) => enemy.scene === 'boss' && enemy.hp > 0);
      return boss ? { x: boss.x - 104, y: boss.y + 8, hp: boss.hp } : null;
    });
    if (!target) return;
    await steerPlayerNear(page, target.x, target.y, 50);
    await page.keyboard.press('x');
    await page.waitForTimeout(260);
  }
}

async function steerPlayerNear(page: Page, targetX: number, targetY: number, tolerance = 56) {
  for (let index = 0; index < 10; index += 1) {
    const position = await page.evaluate(() => {
      const state = window.__CODEJITSU_PLAYER_BOUNDS;
      return state ? { x: state.x, y: state.y } : undefined;
    });
    if (!position) return;
    const dx = targetX - position.x;
    const dy = targetY - position.y;
    if (Math.hypot(dx, dy) < tolerance) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      await hold(page, dx > 0 ? 'd' : 'a', Math.min(420, Math.max(110, Math.abs(dx) * 3)));
    } else {
      await hold(page, dy > 0 ? 's' : 'w', Math.min(420, Math.max(110, Math.abs(dy) * 4)));
    }
  }
}

test('production UI panels do not overlap or overflow on major screens', async ({ page }) => {
  const runtimeIssues = installRuntimeIssueCapture(page);

  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'title');
  await page.waitForFunction(() => window.__CODEJITSU_TITLE_LAYOUT?.fallAnimation?.complete === true);
  await expect.poll(() => page.evaluate(() => {
    const layout = window.__CODEJITSU_TITLE_LAYOUT;
    return Boolean(layout && layout.titleReadable && layout.prompt === 'Click or press Enter to start' && layout.visiblePromptText === true);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const audit = window.__CODEJITSU_PLAYTIME_AUDIT;
    return Boolean(
      audit &&
      audit.dialogueExcluded === true &&
      audit.meetsMinimum === true &&
      audit.totalPlayableSeconds >= 900 &&
      audit.chapterOneMeetsMinimum === true &&
      audit.chapterTwoMeetsMinimum === true &&
      audit.chapterOnePlayableSeconds >= 1140 &&
      audit.chapterOnePlayableMinutes >= 19 &&
      audit.chapterTwoPlayableSeconds >= 900 &&
      audit.chapterTwoPlayableMinutes >= 15 &&
      audit.chapterOneCombatRoomCount >= 10 &&
      audit.chapterOneEnemyCount >= 39 &&
      audit.combatRoomCount >= 11 &&
      audit.bossCount >= 2,
    );
  })).toBe(true);

  await page.goto('/?start=story&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'story');
  await expectDialogueUsesGeneratedPanel(page);
  await expectAdvancePromptSeal(page, 'StoryScene');
  await expectSkipPromptSeal(page, 'StoryScene');
  await page.keyboard.press('Enter');
  await expectLayoutAuditsClean(page, ['dialogue']);
  await page.getByLabel('Skip dialogue').click();
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'tutorial');
  await expect.poll(() => page.evaluate(() => {
    const skip = window.__CODEJITSU_DIALOGUE_SKIP;
    return Boolean(skip && skip.clicked === true && skip.scene === 'StoryScene');
  })).toBe(true);

  await page.goto('/?start=tutorial&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'tutorial');
  await expectTutorialBackdropClean(page);
  await expectTutorialPanelReadable(page);
  await expectTutorialMarkersUseGeneratedArt(page, 'archive-tile');
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true);
  await expectTerminalOverlayUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['terminal']);
  await expectTerminalCommandCards(page);
  await page.keyboard.type('try.catch', { delay: 60 });
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_TERMINAL_INPUT)).toBe('try.catch');
  await expectLayoutAuditsClean(page, ['terminal']);

  await page.goto('/?start=dungeon&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'dungeon');
  await expectChapterOnePlaytimeRuntime(page);
  await expectDungeonGateUsesGeneratedArt(page, false);
  await expectDungeonHudUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['dungeon-hud']);
  await steerPlayerNear(page, 600, 410, 58);
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true);
  await expectTerminalOverlayUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['dungeon-hud', 'terminal']);
  await page.keyboard.type('try.catch', { delay: 50 });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const damage = window.__CODEJITSU_LAST_ABILITY_DAMAGE;
    const cast = window.__CODEJITSU_LAST_ABILITY_CAST_ART;
    return Boolean(
      damage &&
      cast &&
      damage.scene === 'dungeon' &&
      damage.abilityId === 'try-catch' &&
      damage.targets > 0 &&
      damage.damage > 0 &&
      cast.scene === 'dungeon' &&
      cast.usesGeneratedEffect === true &&
      cast.effectFrameCount === 3,
    );
  })).toBe(true);
  await expectImpactVfxPublished(page, 'dungeon', 'palm');
  await expectCombatHitMarksUseGeneratedArt(page, 'dungeon', 'try-catch');

  await page.goto('/?start=hub&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'hub');
  await expectControlScheme(page, 'hub');
  await expectHubGateUsesGeneratedArt(page);
  await expectHubBackdropUsesGeneratedAtmosphere(page);
  await expectHubHudUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['hub-hud']);
  await expectPlayerInsideBounds(page, 'hub');
  await expectArenaClampActive(page, 'hub');
  await expectDepthCues(page, 'hub');
  await expectRoomBordersUseGeneratedVfx(page, 'hub');

  await page.goto('/?start=boss&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'boss');
  await expectBossHudReadable(page);
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true);
  await expectTerminalOverlayUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['terminal']);

  await page.goto('/?start=chapter2-story&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'chapter2-story');
  await expectChapter2StoryVisualsClean(page);
  await expectDialogueUsesGeneratedPanel(page);
  await expectAdvancePromptSeal(page, 'chapter2-story');
  await expectSkipPromptSeal(page, 'chapter2-story');
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(220);
  }
  await expect.poll(() => page.evaluate(() => {
    const cinematic = window.__CODEJITSU_STOLEN_CINEMATIC;
    return Boolean(cinematic && cinematic.usesImagegenAsset === true && cinematic.textureKey === 'chapter2-stolen-cinematic');
  })).toBe(true);
  await expectChapter2StoryVisualsClean(page);
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_CHAPTER2_STORY_VISUALS?.stagedActorsHiddenForCinematic === true)).toBe(true);
  await expectLayoutAuditsClean(page, ['chapter2-dialogue']);

  await page.goto('/?start=chapter2-trail&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'chapter2-trail');
  await expectChapter2TrailHudUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['chapter2-trail-hud']);
  await steerPlayerNear(page, 520, 392, 72);
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true);
  await expectTerminalOverlayUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['chapter2-trail-hud', 'terminal']);
  await page.keyboard.type('try.catch', { delay: 60 });
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_TERMINAL_INPUT)).toBe('try.catch');
  await expectLayoutAuditsClean(page, ['chapter2-trail-hud', 'terminal']);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const damage = window.__CODEJITSU_LAST_ABILITY_DAMAGE;
    const cast = window.__CODEJITSU_LAST_ABILITY_CAST_ART;
    return Boolean(
      damage &&
      cast &&
      damage.scene === 'chapter2-trail' &&
      damage.abilityId === 'try-catch' &&
      damage.targets > 0 &&
      damage.damage > 0 &&
      cast.scene === 'chapter2-trail' &&
      cast.usesGeneratedEffect === true &&
      cast.effectFrameCount === 3 &&
      Number(window.__CODEJITSU_CHAPTER2_TRAIL?.lastTerminalDamage?.targets ?? 0) > 0 &&
      Number(window.__CODEJITSU_CHAPTER2_TRAIL?.lastTerminalDamage?.afterTotalHp ?? 999) <
        Number(window.__CODEJITSU_CHAPTER2_TRAIL?.lastTerminalDamage?.beforeTotalHp ?? 0),
    );
  })).toBe(true);
  await expectCombatHitMarksUseGeneratedArt(page, 'chapter2-trail', 'try-catch');
  await expect.poll(() => page.evaluate(() => {
    const trail = window.__CODEJITSU_CHAPTER2_TRAIL;
    return Boolean(trail && Number(trail.textOverlayCount ?? 0) >= 2 && trail.primitiveRouteOverlayCount === 0);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const trail = window.__CODEJITSU_CHAPTER2_TRAIL;
    return Boolean(
      trail &&
      trail.usesGeneratedPortal === true &&
      Number(trail.generatedPortalPieces ?? 0) >= 3 &&
      trail.primitivePortalPieces === 0,
    );
  })).toBe(true);
  await page.waitForTimeout(1700);
  await expectGeneratedTelegraphPublished(page, 'chapter2-trail');
  await expectChapter2TrailAttackMarkersGenerated(page);

  await page.goto('/?start=return-oni&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'boss');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_BOSS_HUD_LAYOUT?.noOverflow === true)).toBe(true);
  await beatReturnOniWithControls(page);
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'victory-dialogue', undefined, { timeout: 16_000 });
  await expectDialogueUsesGeneratedPanel(page);
  await page.keyboard.press('Enter');
  await expectLayoutAuditsClean(page, ['dialogue']);
  for (let index = 0; index < 8; index += 1) {
    if (await page.evaluate(() => window.__CODEJITSU_SCENE === 'win')) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(420);
  }
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'win');
  await expectLayoutAuditsClean(page, ['result-win']);
  await expectAdvancePromptSeal(page, 'result-win');
  await expect.poll(() => page.evaluate(() => {
    const result = window.__CODEJITSU_RESULT_SCENE;
    const art = window.__CODEJITSU_RESULT_ABILITY_ART;
    return Boolean(
      result &&
      result.outcome === 'win' &&
      result.usesImagegenBackdrop === true &&
      result.backdropKey === 'result-victory-backdrop' &&
      result.coversCanvas === true &&
      result.usesImagegenAtmosphereOverlay === true &&
      result.primitiveBackdropShadePieces === 0 &&
      result.atmosphereTextureKey === 'result-atmosphere-overlay' &&
      result.animated === true &&
      result.ringCount >= 5 &&
      result.particleCount >= 20 &&
      result.usesGeneratedVfx === true &&
      result.generatedVfxPieces >= 25 &&
      result.primitiveMotionPieces === 0 &&
      result.codeGlyphCount === 0 &&
      result.usesImagegenAmbientMotes === true &&
      Number(result.ambientMoteCount ?? 0) >= 4 &&
      result.primitiveAmbientMotePieces === 0 &&
      result.vfxTextureKey === 'result-ritual-vfx' &&
      result.vfxFrameCount === 8 &&
      result.usesImagegenPanel === true &&
      result.primitivePanelPieces === 0 &&
      result.panelKey === 'result-panel' &&
      art?.usesImagegenBackdrop === true &&
      art.usesGeneratedVfx === true &&
      art.primitiveMotionPieces === 0 &&
      art.animated === true &&
      art.usesImagegenPanel === true,
    );
  })).toBe(true);
  await expectNoPublishedLayoutFailures(page);
  expectNoAppRuntimeIssues(runtimeIssues);
});

test('generated art routes expose no primitive visual fallbacks', async ({ page }) => {
  const routes = [
    { name: 'title', url: '/?e2e=1', scene: 'title' },
    { name: 'story', url: '/?start=story&e2e=1', scene: 'story' },
    { name: 'tutorial', url: '/?start=tutorial&e2e=1', scene: 'tutorial' },
    { name: 'dungeon', url: '/?start=dungeon&e2e=1', scene: 'dungeon' },
    { name: 'hub', url: '/?start=hub&e2e=1', scene: 'hub' },
    { name: 'boss', url: '/?start=boss&e2e=1', scene: 'boss' },
    { name: 'result-win', url: '/?start=result-win&e2e=1', scene: 'win' },
    { name: 'result-lose', url: '/?start=result-lose&e2e=1', scene: 'lose' },
    { name: 'chapter2-story', url: '/?start=chapter2-story&e2e=1', scene: 'chapter2-story' },
    { name: 'chapter2-trail', url: '/?start=chapter2-trail&e2e=1', scene: 'chapter2-trail' },
    { name: 'return-oni', url: '/?start=return-oni&e2e=1', scene: 'boss' },
  ];

  for (const route of routes) {
    await page.goto(route.url);
    await waitForRouteVisualRuntime(page, route.scene);
    await expectGeneratedArtHasNoPrimitiveFallbacks(page, route.name);
  }
});

test('story dojo welcome keeps the speaker staging clear', async ({ page }) => {
  await page.goto('/?start=story&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'story');

  for (let index = 0; index < 3; index += 1) {
    await page.waitForTimeout(950);
    await page.keyboard.press('Enter');
  }

  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_SPEAKER)).toBe('Master Keiko');
  await expectDialogueStaging(page, 'dojo', 2);
  await expect.poll(() => page.evaluate(() => {
    const text = window.__CODEJITSU_DIALOGUE_TEXT ?? '';
    const actors = window.__CODEJITSU_DIALOGUE_ACTORS ?? [];
    const staging = window.__CODEJITSU_DIALOGUE_STAGING;
    const hero = actors.find((actor) => actor.id === 'apprentice');
    const keiko = actors.find((actor) => actor.id === 'master-keiko');
    return Boolean(
      text.includes('archive chose a runner') &&
      staging?.mode === 'dojo' &&
      staging.characterCount === 2 &&
      hero &&
      hero.facing === 'left' &&
      hero.pose === 'idle' &&
      hero.moving === false &&
      hero.active === false &&
      hero.x > 860 &&
      keiko &&
      keiko.facing === 'right' &&
      keiko.pose === 'talk' &&
      keiko.active === true &&
      Number(keiko.x) < 540,
    );
  })).toBe(true);
  await expectLayoutAuditsClean(page, ['dialogue']);
});

test('death result explains the failure and restarts on click', async ({ page }) => {
  const runtimeIssues = installRuntimeIssueCapture(page);
  await page.goto('/?start=result-lose&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'lose');
  await expectLayoutAuditsClean(page, ['result-lose']);
  await expectAdvancePromptSeal(page, 'result-lose');
  await expect.poll(() => page.evaluate(() => {
    const death = window.__CODEJITSU_DEATH_SCREEN;
    const result = window.__CODEJITSU_RESULT_SCENE;
    return Boolean(
      death &&
      result &&
      death.reason.includes('Null Oni') &&
      !death.reason.toLowerCase().includes('warning ring') &&
      !death.reason.toLowerCase().includes('tutorial fight') &&
      death.clickToRetry === true &&
      death.retryScene === 'BossScene' &&
      death.usesImagegenBackdrop === true &&
      death.backdropKey === 'result-death-backdrop' &&
      death.animated === true &&
      death.ringCount >= 5 &&
      death.particleCount >= 20 &&
      death.usesGeneratedVfx === true &&
      death.generatedVfxPieces >= 25 &&
      death.primitiveMotionPieces === 0 &&
      death.usesImagegenAtmosphereOverlay === true &&
      death.primitiveBackdropShadePieces === 0 &&
      death.usesImagegenWarningSigil === true &&
      death.primitiveWarningSigilPieces === 0 &&
      result.outcome === 'lose' &&
      result.backdropKey === 'result-death-backdrop' &&
      result.coversCanvas === true &&
      result.usesImagegenAtmosphereOverlay === true &&
      result.primitiveBackdropShadePieces === 0 &&
      result.atmosphereTextureKey === 'result-atmosphere-overlay' &&
      result.usesGeneratedVfx === true &&
      result.generatedVfxPieces >= 25 &&
      result.primitiveMotionPieces === 0 &&
      result.vfxTextureKey === 'result-ritual-vfx' &&
      result.vfxFrameCount === 8 &&
      result.codeGlyphCount === 0 &&
      result.usesImagegenPanel === true &&
      result.primitivePanelPieces === 0 &&
      result.panelKey === 'result-panel' &&
      result.usesImagegenWarningSigil === true &&
      result.primitiveWarningSigilPieces === 0 &&
      result.warningSigilKey === 'warning-sigils' &&
      result.warningSigilFrame === 'cracked-mask' &&
      death.usesImagegenPanel === true,
    );
  })).toBe(true);
  await page.mouse.click(640, 468);
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'boss');
  await expectRespawnFromDeath(page, 'null-oni');
  await expectControlScheme(page, 'boss');
  await expectPlayerInsideBounds(page, 'boss');
  await expectBossMotionStable(page, 'null-oni');
  await expect.poll(() => page.evaluate(() => {
    const boss = (window.__CODEJITSU_ENEMY_BOUNDS ?? []).find((enemy) => enemy.scene === 'boss');
    return Boolean(boss && boss.id === 'null-oni' && boss.hp > 0);
  })).toBe(true);
  await hold(page, 'd', 420);
  await page.keyboard.press('x');
  await expectSwordSwingPublished(page, 'boss');
  await expectNoPublishedLayoutFailures(page);
  expectNoAppRuntimeIssues(runtimeIssues);
});

test('tutorial recovers when the vow target is broken before the swing step', async ({ page }) => {
  const runtimeIssues = installRuntimeIssueCapture(page);
  await page.goto('/?start=tutorial&e2e=1');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'tutorial' && window.__CODEJITSU_TUTORIAL_STEP === 'move');

  await hold(page, 's', 650);
  await hold(page, 'd', 820);
  await hold(page, 'w', 180);
  await page.keyboard.press('x');
  await page.waitForTimeout(350);
  await page.keyboard.press('x');

  await page.waitForFunction(() =>
    window.__CODEJITSU_TUTORIAL_STEP === 'move' &&
    window.__CODEJITSU_TUTORIAL_DUMMY?.broken === true,
  );

  await steerPlayerNear(page, 520, 464, 48);
  await page.waitForFunction(() => ['face', 'swing', 'terminal'].includes(window.__CODEJITSU_TUTORIAL_STEP ?? ''));
  await steerPlayerNear(page, 562, 492, 42);

  await expect.poll(() => page.evaluate(() => ({
    step: window.__CODEJITSU_TUTORIAL_STEP,
    broken: window.__CODEJITSU_TUTORIAL_DUMMY?.broken,
    hits: window.__CODEJITSU_TUTORIAL_DUMMY?.hits,
  }))).toEqual({
    step: 'terminal',
    broken: true,
    hits: 2,
  });
  await expectTutorialPanelReadable(page);
  await expectNoPublishedLayoutFailures(page);
  expectNoAppRuntimeIssues(runtimeIssues);
});

test('plays Chapter 1 through terminal tutorial, pause save, and boss clear', async ({ page }) => {
  const runtimeIssues = installRuntimeIssueCapture(page);
  await page.goto('/?e2e=1');
  await page.evaluate(() => {
    localStorage.removeItem('codejitsu-sfx');
    localStorage.removeItem('codejitsu-shake');
    localStorage.removeItem('legends-of-codejitsu-save-v1');
  });
  await page.reload();
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'title');
  await expect.poll(() => page.evaluate(() => {
    const layout = window.__CODEJITSU_TITLE_LAYOUT;
    return Boolean(
      layout &&
      layout.calmCover === true &&
      layout.prompt === 'Click or press Enter to start' &&
      layout.visiblePromptText === true &&
      layout.fallAnimation?.mode === 'sky-drop' &&
      layout.fallAnimation.brandedDrop === 'single-title-stack' &&
      layout.fallAnimation.pieces === 1 &&
      layout.titleFx?.usesImagegenSkyfallFx === true &&
      layout.titleFx.primitiveFxPieces === 0 &&
      layout.titleFx.promptUsesImagegenPanel === false &&
      layout.titleFx.promptPrimitivePieces === 0 &&
      layout.titleFx.startPromptTextureKey === 'text-prompt' &&
      Number(layout.titleFx.generatedStaticDecorPieces ?? 0) >= 24 &&
      layout.titleFx.primitiveStaticDecorPieces === 0 &&
      layout.titleFx.usesImagegenVignette === true &&
      layout.titleFx.primitiveVignettePieces === 0 &&
      layout.titleFx.vignetteTextureKey === 'title-cinematic-vignette' &&
      layout.titleFx.shadowUsesImagegen === true &&
      layout.titleFx.primitiveShadowPieces === 0 &&
      layout.titleFx.skyGateUsesImagegen === true &&
      layout.titleFx.primitiveSkyGatePieces === 0 &&
      layout.titleFx.primitiveSimpleShapeFallbackPieces === 0 &&
      layout.titleFx.generatedOnlyTitleFx === true &&
      layout.titleFx.panelCount === 4 &&
      layout.fallAnimation.fromY.every((y) => y < 0) &&
      layout.fallAnimation.targetY.join(',') === '210,328' &&
      Number(layout.glitchLayers ?? -1) === 0 &&
      Number(layout.retroLayers ?? -1) === 0 &&
      Number(layout.sliceLayers ?? -1) === 0 &&
      Number(layout.glyphLayers ?? -1) === 0,
    );
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const layout = window.__CODEJITSU_TITLE_LAYOUT;
    return Boolean(
      layout &&
      layout.title === 'LEGENDS OF CODEJITSU' &&
      layout.titleReadable === true &&
      layout.coverMode === 'cover' &&
      layout.coversCanvas &&
      layout.coverWidth >= 1280 &&
      layout.coverHeight >= 720 &&
      layout.hasCodeLeak === false &&
      layout.titleLines?.join(' ') === 'LEGENDS OF CODEJITSU',
    );
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const animation = window.__CODEJITSU_TITLE_LAYOUT?.fallAnimation;
    return Boolean(
      animation &&
      animation.mode === 'sky-drop' &&
      animation.brandedDrop === 'single-title-stack' &&
      animation.pieces === 1 &&
      animation.complete === true &&
      animation.impact === true &&
      animation.dropOrigin === 'sky' &&
      Number(animation.motionTrailCount ?? 0) >= 12 &&
      Number(animation.impactCount ?? 0) >= 2 &&
      Number(window.__CODEJITSU_TITLE_LAYOUT?.titleFx?.generatedFxPieces ?? 0) >= 8 &&
      animation.currentY.join(',') === '210,328',
    );
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => Number(window.__CODEJITSU_TITLE_LAYOUT?.glitchLayers ?? -1))).toBe(0);
  await expectGeneratedBackdropsQuality(page);
  await expectTelegraphAssetLoaded(page);
  await expectGeneratedCombatSheetsQuality(page);
  await expectChapter1AnimationCatalog(page);
  await expect.poll(() => page.evaluate(() => {
    const layout = window.__CODEJITSU_TITLE_LAYOUT;
    return Boolean(
      layout &&
      layout.calmCover === true &&
      layout.prompt === 'Click or press Enter to start' &&
      layout.visiblePromptText === true &&
      Number(layout.retroLayers ?? -1) === 0 &&
      Number(layout.sliceLayers ?? -1) === 0 &&
      Number(layout.glyphLayers ?? -1) === 0,
    );
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_AUDIO_UNLOCK?.attempted ?? false)).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_AUDIO_UNLOCK?.attempted ?? false)).toBe(true);

  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'story');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_SPEAKER)).toBe('Apprentice');
  await expectDialogueUsesGeneratedPanel(page);
  await expect.poll(() => page.evaluate(() => {
    const text = window.__CODEJITSU_DIALOGUE_TEXT ?? '';
    return text.includes('mask across the archive') &&
      text.includes('Null Oni') &&
      text.includes('Last Archive Runner');
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const full = window.__CODEJITSU_DIALOGUE_TEXT ?? '';
    const revealed = window.__CODEJITSU_DIALOGUE_REVEALED ?? '';
    return revealed.length > 0 && revealed.length < full.length && window.__CODEJITSU_DIALOGUE_TYPING === true;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const layout = window.__CODEJITSU_DIALOGUE_LAYOUT;
    return Boolean(
      layout &&
      layout.textLayout === 'portrait-left' &&
      layout.portraitInsidePanel === true &&
      layout.portraitX < layout.bodyX &&
      layout.bodyX > layout.portraitX + 80 &&
      layout.bodyX >= layout.panel.x + 170,
    );
  })).toBe(true);
  await expectDialogueStaging(page, 'archive', 2);
  await expect.poll(() => page.evaluate(() => Number(window.__CODEJITSU_DIALOGUE_TALK_TICKS ?? 0))).toBeGreaterThan(0);
  await expectTalkSound(page, 'StoryScene');
  await expect.poll(() => page.evaluate(() => {
    const actors = window.__CODEJITSU_DIALOGUE_ACTORS ?? [];
    const hero = actors.find((actor) => actor.id === 'apprentice');
    const omen = actors.find((actor) => actor.id === 'null-oni');
    const shard = actors.find((actor) => actor.id.startsWith('archive-'));
    const staging = window.__CODEJITSU_DIALOGUE_STAGING;
    const movement = window.__CODEJITSU_DIALOGUE_MOVEMENT_HISTORY ?? [];
    return Boolean(
      hero &&
      hero.mode === 'archive' &&
      hero.facing === 'right' &&
      hero.active === true &&
      movement.some((entry) => entry.id === 'apprentice' && entry.reason === 'archive-runner-enters') &&
      omen &&
      omen.targetObject === true &&
      omen.active === false &&
      omen.facing === 'left' &&
      omen.pose === 'threat-idle' &&
      omen.renderVariant === 'imagegen-intro-null-oni-threat' &&
      omen.motionProfile === 'story-antagonist-threat' &&
      Number(omen.frameIndex ?? -1) === 0 &&
      omen.clearOfDialoguePanel === true &&
      Number(omen.visualBottom ?? 999) <= 480 &&
      !shard &&
      staging &&
      staging.actorCount === 2 &&
      staging.characterCount === 1 &&
      staging.storyCharacterCount === 2 &&
      staging.storyCharacterIds?.join(',') === 'apprentice,null-oni' &&
      staging.storyCharacterNames?.join(',') === 'Apprentice,Null Oni' &&
      staging.strayArchiveActorCount === 0 &&
      staging.memoryPropCount === 0 &&
      staging.visibleThreatCount === 1 &&
      staging.primaryThreatName === 'Null Oni' &&
      staging.threatRelationship === 'pursuer' &&
      staging.archiveCombatScene === false &&
      staging.archiveConfrontationClear === true,
    );
  })).toBe(true);
  for (let index = 0; index < 7; index += 1) {
    await page.waitForTimeout(950);
    await page.keyboard.press('Enter');
  }
  await expectStoryStageDarkTransition(page, 'archive', 'dojo');
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__CODEJITSU_DIALOGUE_MOVEMENT_HISTORY ?? [];
    const actors = window.__CODEJITSU_DIALOGUE_ACTORS ?? [];
    const hero = actors.find((actor) => actor.id === 'apprentice');
    const keiko = actors.find((actor) => actor.id === 'master-keiko');
    return Boolean(
      movement.some((entry) => entry.reason === 'keiko-welcome-step') &&
      movement.some((entry) => entry.reason === 'apprentice-turns-to-gate') &&
      hero?.mode === 'dojo' &&
      hero.facing === 'left' &&
      hero.x > 820 &&
      keiko?.facing === 'right' &&
      Number(keiko?.x ?? 999) < 560,
    );
  })).toBe(true);

  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'tutorial');
  await expectControlScheme(page, 'tutorial');
  await expectArenaClampActive(page, 'tutorial');
  await expectDepthCues(page, 'tutorial');
  await expectRoomBordersUseGeneratedVfx(page, 'tutorial');
  await expectTutorialBackdropClean(page);
  await expectTutorialGateUsesGeneratedArt(page, false);
  await expectTutorialPanelReadable(page);
  await expectTutorialMarkersUseGeneratedArt(page, 'archive-tile');
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__CODEJITSU_PLAYER_BOUNDS?.scene === 'tutorial' && window.__CODEJITSU_PLAYER_BOUNDS?.pose === 'run');
  await expectMovementTraction(page, 'tutorial');
  await expectDepthMotion(page, 'tutorial');
  await expect.poll(() => page.evaluate(() => {
    const player = window.__CODEJITSU_PLAYER_BOUNDS;
    const spacing = window.__CODEJITSU_TUTORIAL_SPACING;
    return player?.sourcePose === 'run' &&
      player?.renderVariant === 'run-from-walk-lean' &&
      player?.motionProfile === 'grounded-run-lean-trail' &&
      player?.momentumState === 'run' &&
      player.visualGrounded === true &&
      Number(player.visualScale ?? 0) > 0.82 &&
      Number(player.visualStride ?? 0) > 0 &&
      Number(player.footPlantPhase ?? -1) >= 0 &&
      Number(player.accelerationBurst ?? 0) >= 1 &&
      Number(player.stepBeat ?? -1) >= 0 &&
      Number(player.movePolishLevel ?? 0) > 1.6 &&
      Number(player.releaseBrakeAssist ?? 0) > 0.6 &&
      (!spacing || spacing.noOverlap === true);
  })).toBe(true);
  await expectPlayerAnimationAdvances(page, 'run');
  await expectGeneratedFramesClean(page);
  await page.waitForTimeout(180);
  await page.keyboard.up('d');
  await expectMovementBrakesCleanly(page, 'tutorial');
  await hold(page, 'w', 180);
  await page.waitForFunction(() => ['face', 'swing'].includes(window.__CODEJITSU_TUTORIAL_STEP ?? ''));
  const stepBeforeJ = await page.evaluate(() => window.__CODEJITSU_TUTORIAL_STEP);
  await page.keyboard.press('j');
  await page.waitForTimeout(250);
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_TUTORIAL_STEP)).toBe(stepBeforeJ);
  await steerPlayerNear(page, 562, 492, 42);
  await page.waitForFunction(() => window.__CODEJITSU_TUTORIAL_STEP === 'swing');
  await page.keyboard.press('x');
  await expectTutorialPanelReadable(page);
  await expectPlayerPoseVariant(page, 'swing', 'sword-arc-accent', 'sword-contact-arc');
  await expectPlayerAnimationAdvances(page, 'swing');
  await expectSwordSwingPublished(page, 'tutorial');
  await expect.poll(() => page.evaluate(() => {
    const dummy = window.__CODEJITSU_TUTORIAL_DUMMY;
    return Boolean(
	      dummy &&
	      dummy.hitRegistered === true &&
	      dummy.hits >= 1 &&
	      dummy.soloPractice === true &&
	      dummy.mentorVisible === false &&
	      dummy.mentorHitboxSmall === true &&
      dummy.labelVisible === false &&
      dummy.renderVariant === 'imagegen-vow-target' &&
      dummy.targetObject === true &&
      dummy.spectralEcho === false &&
      dummy.distinctFromPlayer === true &&
      Number(dummy.sourceWidth ?? 0) >= 1900 &&
      Number(dummy.sourceHeight ?? 0) >= 760 &&
      Number(dummy.displayHeight ?? 999) <= 130 &&
      Number(dummy.alpha ?? 0) >= 0.9,
    );
  })).toBe(true);
  await page.keyboard.press('x');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_TUTORIAL_DUMMY?.broken === true)).toBe(true);
  await expectGeneratedFramesClean(page);
  await page.waitForFunction(() => window.__CODEJITSU_TUTORIAL_STEP === 'terminal');
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true && window.__CODEJITSU_TIME_SCALE === 0.5);
  await expectTerminalOverlayUsesGeneratedPanel(page);
  await expect.poll(() => page.evaluate(() => {
    const hud = window.__CODEJITSU_TUTORIAL_HUD_VISIBILITY;
    return Boolean(hud && hud.visible === false && hud.hiddenForTerminal === true && hud.reason === 'terminal-open');
  })).toBe(true);
  await expectAbilityArtLoaded(page);
  await expectTerminalCommandCards(page);
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_TERMINAL_INPUT ?? '')).toBe('');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_TERMINAL_PREVIEW ?? '')).toContain('A vow of survival');
  await page.keyboard.type('try.catch', { delay: 60 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === false && window.__CODEJITSU_TIME_SCALE === 1);
  await expect.poll(() => page.evaluate(() => {
    const hud = window.__CODEJITSU_TUTORIAL_HUD_VISIBILITY;
    return Boolean(hud && hud.visible === true && hud.hiddenForTerminal === false && hud.reason === 'terminal-closed');
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const cast = window.__CODEJITSU_LAST_ABILITY_CAST_ART;
    return Boolean(
      cast &&
      cast.scene === 'tutorial' &&
      cast.abilityId === 'try-catch' &&
      cast.usesGeneratedIcon === true &&
      cast.usesGeneratedEffect === true &&
      cast.effectFrameCount === 3,
    );
  })).toBe(true);
  await page.waitForFunction(() => window.__CODEJITSU_TUTORIAL_GATE_OPEN === true);
  await expectTutorialGateUsesGeneratedArt(page, true);
  await hold(page, 'd', 1900);
  await hold(page, 'w', 350);
  await steerPlayerNear(page, 940, 418, 54);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_TRANSITION?.walkingGate === 'TutorialScene');
  await expect.poll(() => page.evaluate(() => Number(window.__CODEJITSU_TRANSITION?.progress ?? 0))).toBeGreaterThan(0.2);
  await expectWalkGateAnimation(page, 'TutorialScene');
  await expectWalkGateArrival(page, 'TutorialScene');
  await expectFadeTo(page, 'ArchiveApproachScene');

  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'archive-approach');
  await expectControlScheme(page, 'archive-approach');
  await expectPlayerInsideBounds(page, 'archive-approach');
  await expectArenaClampActive(page, 'archive-approach');
  await expectDepthCues(page, 'archive-approach');
  await expectRoomBordersUseGeneratedVfx(page, 'archive-approach');
  await expectChapterRouteProgress(page, 'Archive Approach');
  await expectArchiveGateUsesGeneratedArt(page);
  await expectArchivePathUsesGeneratedVfx(page);
  await expectArchiveBackdropUsesGeneratedOverlay(page);
  await expectArchiveHudUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['archive-approach-hud']);
  await expectSeamVfxPublished(page, 'archive-approach');
  await hold(page, 'd', 2600);
  await steerPlayerNear(page, 1024, 446, 74);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_TRANSITION?.walkingGate === 'ArchiveApproachScene');
  await expectWalkGateAnimation(page, 'ArchiveApproachScene');
  await expectWalkGateArrival(page, 'ArchiveApproachScene');
  await expectFadeTo(page, 'DungeonScene');

  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'dungeon');
  await expectControlScheme(page, 'dungeon');
  await expectPlayerInsideBounds(page, 'dungeon');
  await expectArenaClampActive(page, 'dungeon');
  await expectDepthCues(page, 'dungeon');
  await expectRoomBordersUseGeneratedVfx(page, 'dungeon');
  await expectChapterRouteProgress(page, 'Sealed Archive', 0);
  await expectChapterOnePlaytimeRuntime(page);
  await expectDungeonRoomVisual(page, 'Sealed Archive', 0);
  await expectDungeonGateUsesGeneratedArt(page, false);
  await expectDungeonHudUsesGeneratedPanel(page);
  await expectEnemiesGrounded(page, 'dungeon', 2);
  await expectEnemyPoseAnimation(page, 'dungeon', 'walk', 1);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__CODEJITSU_PAUSED === true);
  await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'main');
  await expectPauseOverlayUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['pause-menu']);
  await page.waitForTimeout(250);
  await page.keyboard.press('3');
  await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'settings');
  await expectPauseOverlayUsesGeneratedPanel(page);
  await expectLayoutAuditsClean(page, ['pause-menu']);
  await page.waitForTimeout(100);
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('codejitsu-sfx'))).toBe('off');
  await page.waitForTimeout(100);
  await page.keyboard.press('3');
  await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'main');
  await expectPauseOverlayUsesGeneratedPanel(page);
  await page.waitForTimeout(100);
  await page.keyboard.press('4');
  await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'extras');
  await expectPauseOverlayUsesGeneratedPanel(page);
  await expect.poll(() => page.evaluate(() => {
    return window.__CODEJITSU_ROADMAP_PHASES === undefined &&
      window.__CODEJITSU_ROADMAP_DETAILS === undefined;
  })).toBe(true);
  await page.keyboard.press('2');
  await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'vows');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'main');
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_PAUSED === false);

  await hold(page, 'd', 1250);
  await expectEnemyPoseAnimation(page, 'dungeon', 'attack', 1);
  await expectGeneratedTelegraphPublished(page, 'dungeon');
  await expectDungeonSentinelWarningsUseGeneratedArt(page);
  await expectSeamVfxPublished(page, 'dungeon');
  await page.keyboard.press('x');
  await expectSwordSwingPublished(page, 'dungeon');
  await expectSwordSwingTargetsEnemy(page, 'dungeon');
  await expectJDoesNotSwing(page);
  await clearVisibleSentinels(page, 36);
  await page.waitForFunction(() => window.__CODEJITSU_DUNGEON_GATE_OPEN === true);
  await expectDungeonGateUsesGeneratedArt(page, true);
  const maps = [
    { name: 'Sealed Archive', room: 1, enemies: 2 },
    { name: 'Sealed Archive', room: 2, enemies: 3 },
    { name: 'Sealed Archive', room: 3, enemies: 3 },
    { name: 'Sealed Archive', room: 4, enemies: 4 },
    { name: 'Sealed Archive', room: 5, enemies: 4 },
    { name: 'Sealed Archive', room: 6, enemies: 5, crop: 0 },
    { name: 'Sealed Archive', room: 7, enemies: 6, crop: 2 },
    { name: 'Sealed Archive', room: 8, enemies: 5 },
    { name: 'Sealed Archive', room: 9, enemies: 5 },
  ];
  for (const map of maps) {
    await steerPlayerNear(page, 640, 246, 68);
    await page.keyboard.press('Enter');
    await expectDungeonRoomTransitionUsesGeneratedSeam(page);
    await expectChapterRouteProgress(page, map.name, map.room);
    await expectDungeonRoomVisual(page, map.name, map.room, map.crop);
    await expectDungeonGateUsesGeneratedArt(page, false);
    await expectEnemiesGrounded(page, 'dungeon', map.enemies);
    await clearVisibleSentinels(page, map.enemies >= 5 ? 72 : 54);
    await page.waitForFunction(() => window.__CODEJITSU_DUNGEON_GATE_OPEN === true);
    await expectDungeonGateUsesGeneratedArt(page, true);
  }
  await steerPlayerNear(page, 640, 246, 68);
  await expectPlayerInsideBounds(page, 'dungeon');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_TRANSITION?.walkingGate === 'DungeonScene');
  await expect.poll(() => page.evaluate(() => Number(window.__CODEJITSU_TRANSITION?.progress ?? 0))).toBeGreaterThan(0.2);
  await expectWalkGateAnimation(page, 'DungeonScene');
  await expectWalkGateArrival(page, 'DungeonScene');
  await expectFadeTo(page, 'BossScene');

  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'boss');
  await expectControlScheme(page, 'boss');
  await expectPlayerInsideBounds(page, 'boss');
  await expectArenaClampActive(page, 'boss');
  await expectDepthCues(page, 'boss');
  await expectRoomBordersUseGeneratedVfx(page, 'boss');
  await expectEnemiesGrounded(page, 'boss', 1);
  await expectBossBackdropUsesGeneratedAtmosphere(page, 'null-oni');
  await expectBossMotionStable(page, 'null-oni');
  await expectBossHudReadable(page);
  await expectBossTerminalGate(page, false);
  await expect.poll(() => page.evaluate(() => {
    const hint = window.__CODEJITSU_BOSS_FINISHER_HINT;
    return Boolean(
      hint &&
      hint.explicit === true &&
      hint.command === 'try.catch' &&
      hint.usesImagegenFinisherCue === true &&
      hint.primitiveCuePieces === 0 &&
      Number(hint.finisherCueFrameIndex ?? -1) >= 0 &&
      hint.visibleText === false,
    );
  })).toBe(true);
  await hold(page, 'd', 1500);
  await expectPlayerInsideBounds(page, 'boss');
  await page.keyboard.press('x');
  await expectSwordSwingPublished(page, 'boss');
  await expectSwordSwingTargetsEnemy(page, 'boss');
  await expectJDoesNotSwing(page);
  await expect.poll(() => page.evaluate(() => {
    const feedback = window.__CODEJITSU_BOSS_HIT_FEEDBACK;
    return Boolean(
      feedback &&
      feedback.weapon === 'sword' &&
      feedback.inputKey === 'x' &&
      feedback.target === 'null-oni' &&
      feedback.damage > 0 &&
      feedback.bossReactionPose === 'hurt' &&
      Number(feedback.hitStopMs ?? 0) >= 70 &&
      Number(feedback.hitStopScale ?? 1) < 0.2 &&
      Number(feedback.cameraShakeMs ?? 0) >= 90 &&
      Number(feedback.cameraShakeIntensity ?? 0) > 0.004 &&
      Number(feedback.knockback ?? 0) >= 20 &&
      feedback.clashVisual === 'sword-break-clash',
    );
  })).toBe(true);
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true);
  await expectTerminalOverlayUsesGeneratedPanel(page);
  await page.keyboard.type('try.catch', { delay: 60 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === false);
  await expectBossTerminalGate(page, true);
  await expectTryCatchGuardActive(page);
  await expectCombatHitMarksUseGeneratedArt(page, 'boss', 'try-catch');
  await expect.poll(() => page.evaluate(() => {
    const history = window.__CODEJITSU_BOSS_ATTACK_HISTORY ?? [];
    const stance = window.__CODEJITSU_BOSS_STANCE;
    return Boolean(
      stance &&
      ['hunter', 'duelist', 'unstable', 'cornered'].includes(stance.stance) &&
      stance.orbitStrength > 0 &&
      stance.attackDelayMs > 0 &&
      history.some((entry) => entry.queued && entry.combo.length > 0 && entry.phase >= 1 && Boolean(entry.stance)) &&
      history.some((entry) => entry.queued && Number(entry.comboStep ?? 0) >= 2 && Number(entry.comboTotalSteps ?? 0) >= Number(entry.comboStep ?? 0)),
    );
  }), { timeout: 12_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const visual = window.__CODEJITSU_COMBO_CALLOUT_VISUAL;
    return Boolean(
      visual &&
      visual.usesImagegenDivider === true &&
      visual.usesImagegenCadenceCue === true &&
      visual.primitiveDividerPieces === 0 &&
      visual.primitiveCadenceCuePieces === 0 &&
      visual.dividerPieces >= 9 &&
      Number(visual.cadenceFrameIndex ?? -1) >= 0 &&
      visual.textLineCount === 0 &&
      visual.textureKey === 'boss-threat-pip' &&
      visual.cadenceTextureKey === 'boss-combo-cadence'
    );
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const telegraph = window.__CODEJITSU_BOSS_TELEGRAPH;
    return Boolean(
      telegraph &&
      telegraph.visual === 'ability-card-with-threat-pips' &&
      telegraph.name.length > 0 &&
      telegraph.subtitle.length > 0 &&
      telegraph.detail.length > 0 &&
      telegraph.detail.length <= 90 &&
      !telegraph.detail.includes('|') &&
      !telegraph.detail.includes(' > ') &&
      !telegraph.detail.includes('>.') &&
      !telegraph.detail.endsWith('...') &&
      telegraph.castLine.includes('.') &&
      telegraph.phaseRole.length > 0 &&
      telegraph.movementTell.length > 20 &&
      telegraph.counterWindowMs >= 400 &&
      telegraph.arenaEffect.length > 8 &&
      telegraph.bossMotion.length > 20 &&
      telegraph.counterStyle.length > 18 &&
      ['opener', 'follow-up', 'trap', 'finisher', 'phase-breaker'].includes(telegraph.comboRole) &&
      telegraph.threatLevel >= 2 &&
      telegraph.tokens.length >= 2 &&
      telegraph.movementHint.length > 0 &&
      telegraph.punishHint.length > 0 &&
      telegraph.dangerLayers.length >= 3 &&
      telegraph.counterRhythm.length > 18 &&
      telegraph.commandHint.length > 16 &&
      telegraph.phaseShift.length > 20 &&
      telegraph.usesImagegenBanner === true &&
      telegraph.usesImagegenAttackCue === true &&
      telegraph.usesImagegenThreatPips === true &&
      telegraph.primitiveBannerPieces === 0 &&
      telegraph.primitiveAttackCuePieces === 0 &&
      telegraph.primitiveThreatPips === 0 &&
      Number(telegraph.visibleTextLabels ?? 99) === 0
    );
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const visual = window.__CODEJITSU_BOSS_ATTACK_BANNER_VISUAL;
    return Boolean(
      visual &&
      visual.usesImagegenBanner === true &&
      visual.usesImagegenAttackCue === true &&
      visual.usesImagegenThreatPips === true &&
      visual.primitiveBannerPieces === 0 &&
      visual.primitiveAttackCuePieces === 0 &&
      visual.primitiveThreatPips === 0 &&
      Number(visual.attackCueFrameIndex ?? -1) >= 0 &&
      visual.textLineCount === 0 &&
      visual.textureKey === 'boss-attack-banner' &&
      visual.threatPipKey === 'boss-threat-pip' &&
      visual.threatLevel >= 1,
    );
  })).toBe(true);
  await expectBossHudReadable(page);
  await expectEnemyPoseAnimation(page, 'boss', 'attack', 1);
  await expectGeneratedTelegraphPublished(page, 'boss');
  await expectBossWarningsUseGeneratedArt(page);
  await expectSeamVfxPublished(page, 'boss');
  await expectBossImpactVfxPublished(page);
  await finishActiveBossWithControls(page, 'try.catch');
  await expectBossPhaseBreakUsesGeneratedArt(page);
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'victory-dialogue', undefined, { timeout: 12_000 });
  await expectDialogueUsesGeneratedPanel(page);
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_SPEAKER)).toBe('Null Oni');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_TEXT ?? '')).toContain('Nothing... cannot hold you');
  await expect.poll(() => page.evaluate(() => {
    const history = window.__CODEJITSU_DIALOGUE_TYPEWRITER_HISTORY ?? [];
    const entry = history.find((candidate) => candidate.speaker === 'Null Oni');
    return Boolean(entry && entry.partialShown === true && entry.talkTicks > 0);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const layout = window.__CODEJITSU_DIALOGUE_LAYOUT;
    const actors = window.__CODEJITSU_DIALOGUE_ACTORS ?? [];
    const hero = actors.find((actor) => actor.id === 'apprentice');
    const keiko = actors.find((actor) => actor.id === 'master-keiko');
    const oni = actors.find((actor) => actor.id === 'null-oni');
    return Boolean(
      layout &&
      layout.textLayout === 'portrait-left' &&
      layout.portraitInsidePanel === true &&
      layout.portraitX < layout.bodyX &&
      hero?.mode === 'victory' &&
      keiko?.mode === 'victory' &&
      oni?.mode === 'victory' &&
      hero.facing === 'right' &&
      keiko.facing === 'left' &&
      oni.facing === 'left' &&
      oni.pose === 'stagger' &&
      Number(hero.x ?? 0) < Number(oni.x ?? 0),
    );
  })).toBe(true);
  await expectDialogueStaging(page, 'victory', 3);
  await expect.poll(() => page.evaluate(() => Number(window.__CODEJITSU_DIALOGUE_TALK_TICKS ?? 0))).toBeGreaterThan(0);
  await expectTalkSound(page, 'VictoryDialogueScene');
  await page.waitForTimeout(950);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_SPEAKER)).toBe('Master Keiko');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_TEXT ?? '')).toContain('answer the void without becoming it');
  await page.waitForTimeout(950);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_SPEAKER)).toBe('Apprentice');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_TEXT ?? '')).toContain('my coworkers are not gone forever');
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__CODEJITSU_DIALOGUE_MOVEMENT_HISTORY ?? [];
    return movement.some((entry) => entry.reason === 'apprentice-approaches-mask') &&
      movement.some((entry) => entry.reason === 'keiko-joins-victory') &&
      movement.some((entry) => entry.reason === 'apprentice-claims-archive');
  })).toBe(true);
  await page.waitForTimeout(950);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_SPEAKER)).toBe('Master Keiko');
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_TEXT ?? '')).toContain('Carry try.catch as your first vow');
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__CODEJITSU_DIALOGUE_MOVEMENT_HISTORY ?? [];
    return movement.some((entry) => entry.reason === 'keiko-names-first-vow');
  })).toBe(true);
  for (let index = 0; index < 1; index += 1) {
    await page.waitForTimeout(950);
    await page.keyboard.press('Enter');
  }
  await expectFadeTo(page, 'ResultScene');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'win', undefined, { timeout: 12_000 });
  await expect.poll(() => page.evaluate(() => {
    const result = window.__CODEJITSU_RESULT_ABILITY_ART;
    return Boolean(result && result.chapter === 1 && result.abilityId === 'try-catch' && result.usesGeneratedIcon === true);
  })).toBe(true);

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('legends-of-codejitsu-save-v1') ?? '{}'));
  expect(save.clearedChapters).toContain(1);
  expect(save.unlockedAbilities).toContain('try-catch');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'chapter2-story');
  await expectDialogueUsesGeneratedPanel(page);
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_DIALOGUE_TEXT ?? '')).toContain('Null Oni had a brother');
  for (let index = 0; index < 16; index += 1) {
    if (await page.evaluate(() => window.__CODEJITSU_SCENE === 'chapter2-trail')) break;
    const typing = await page.evaluate(() => window.__CODEJITSU_DIALOGUE_TYPING === true);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(typing ? 120 : 360);
  }
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'chapter2-trail', undefined, { timeout: 12_000 });
  await expect.poll(() => page.evaluate(() => {
    const vow = window.__CODEJITSU_CHAPTER2_VOW;
    return Boolean(vow && vow.abilityId === 'loop-strike' && vow.learnedByMeditation === true);
  })).toBe(true);
  await expectPlayerInsideBounds(page, 'chapter2-trail');
  await expectArenaClampActive(page, 'chapter2-trail');
  await expectDepthCues(page, 'chapter2-trail');
  await expectRoomBordersUseGeneratedVfx(page, 'chapter2-trail');
  await expect.poll(() => page.evaluate(() => {
    const trail = window.__CODEJITSU_CHAPTER2_TRAIL;
    const warriors = new Set((trail?.enemies ?? []).map((enemy) => enemy.warrior));
    return Boolean(
      trail &&
      trail.outdoorScene === true &&
      trail.usesImagegenAtmosphereOverlay === true &&
      trail.primitiveBackdropShadePieces === 0 &&
      trail.atmosphereTextureKey === 'chapter2-trail-atmosphere-overlay' &&
      trail.usesGeneratedPortal === true &&
      trail.usesGeneratedPortalOnly === true &&
      trail.usesMapGate === undefined &&
      Number(trail.generatedPortalPieces ?? 0) >= 3 &&
      trail.primitivePortalPieces === 0 &&
      trail.usesImagegenWarriors === true &&
      trail.totalStages === 5 &&
      trail.stageIndex === 0 &&
      trail.stageBackdropKey === 'chapter2-stage-gate-loop' &&
      Number(trail.textOverlayCount ?? 0) >= 2 &&
      trail.primitiveRouteOverlayCount === 0 &&
      trail.remaining === 3 &&
      warriors.size >= 2 &&
      trail.chapterTwoPlaytime?.chapterTwoMeetsMinimum === true &&
      Number(trail.chapterTwoPlaytime?.chapterTwoPlayableMinutes ?? 0) >= 15 &&
      trail.enemies.every((enemy) =>
        Number(enemy.frameCount ?? 0) > 1 &&
        String(enemy.renderVariant ?? '').includes('imagegen') &&
        enemy.readableOnMap === true &&
        enemy.damageable === true &&
        enemy.bodyAlive === true &&
        enemy.noOverlap === true &&
        Number(enemy.displayWidth ?? 0) >= 145 &&
        Number(enemy.displayHeight ?? 0) >= 150 &&
        Number(enemy.bodyWidth ?? 0) >= 60 &&
        Number(enemy.bodyHeight ?? 0) >= 54,
      ),
    );
  })).toBe(true);
  const firstTrailEnemy = await page.evaluate(() => {
    const enemy = (window.__CODEJITSU_CHAPTER2_TRAIL?.enemies ?? [])
      .filter((candidate) => candidate.hp > 0)
      .sort((a, b) => a.x - b.x)[0];
    return enemy ? { x: enemy.x, y: enemy.y } : null;
  });
  expect(firstTrailEnemy).not.toBeNull();
  if (firstTrailEnemy) {
    await steerPlayerNear(page, Math.max(220, firstTrailEnemy.x - 82), firstTrailEnemy.y, 48);
    await page.keyboard.press('x');
    await expect.poll(() => page.evaluate(() => {
      const damage = window.__CODEJITSU_CHAPTER2_TRAIL?.lastSwordDamage;
      return Boolean(damage && damage.targets > 0 && damage.afterTotalHp < damage.beforeTotalHp);
    })).toBe(true);
  }
  const expectedBackdropKeys = [
    'chapter2-stage-gate-loop',
    'chapter2-stage-boolean-switchback',
    'chapter2-stage-array-shrine',
    'chapter2-stage-runtime-ravine',
    'chapter2-stage-return-threshold',
  ];
  for (let stage = 0; stage < 5; stage += 1) {
    await expect.poll(() => page.evaluate((expected) => window.__CODEJITSU_CHAPTER2_TRAIL?.stageBackdropKey === expected, expectedBackdropKeys[stage])).toBe(true);
    await expectChapter2TrailHudUsesGeneratedPanel(page);
    await clearChapter2TrailStage(page, 20);
    await expect.poll(() => page.evaluate(() => window.__CODEJITSU_CHAPTER2_TRAIL?.remaining ?? 999)).toBe(0);
    const previousInterludeCount = await page.evaluate(() => window.__CODEJITSU_CHAPTER2_STAGE_INTERLUDE?.count ?? 0);
    await enterChapter2Gate(page);
    await expect.poll(() => page.evaluate(({ previous, finalStage }) => {
      const interlude = window.__CODEJITSU_CHAPTER2_STAGE_INTERLUDE;
      return Boolean(
        interlude &&
        interlude.count > previous &&
        interlude.usesImagegenAsset === true &&
        interlude.usesImagegenPanel === true &&
        interlude.primitivePanelPieces === 0 &&
        interlude.panelKey === 'result-panel' &&
        interlude.usesImagegenInterludeCue === true &&
        interlude.primitiveInterludeCuePieces === 0 &&
        interlude.usesImagegenInterludeAtmosphere === true &&
        interlude.primitiveBackdropShadePieces === 0 &&
        interlude.atmosphereTextureKey === 'chapter2-stage-interlude-atmosphere' &&
        Number(interlude.interludeCueFrameIndex ?? -1) === (finalStage ? 1 : 0) &&
        interlude.textOverlayCount === 0 &&
        interlude.animated === true &&
        interlude.ringCount >= 4 &&
        interlude.particleCount >= 12 &&
        !String(interlude.toStageName ?? '').toLowerCase().includes('map') &&
        interlude.kind === (finalStage ? 'boss-gate' : 'stage-advance'),
      );
    }, { previous: previousInterludeCount, finalStage: stage === 4 })).toBe(true);
    await expectLayoutAuditsClean(page, ['chapter2-stage-interlude']);
    if (stage < 4) {
      await expect.poll(() => page.evaluate(() => window.__CODEJITSU_CHAPTER2_TRAIL?.stageIndex ?? -1)).toBe(stage + 1);
      await expect.poll(() => page.evaluate((expected) => window.__CODEJITSU_CHAPTER2_TRAIL?.stageBackdropKey === expected, expectedBackdropKeys[stage + 1])).toBe(true);
    }
  }
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'boss', undefined, { timeout: 12_000 });
  await expect.poll(() => page.evaluate(() => window.__CODEJITSU_BOSS_TERMINAL_GATE?.requiredCommand)).toBe('loop.strike');
  await beatReturnOniWithControls(page);
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'victory-dialogue', undefined, { timeout: 16_000 });
  await expectDialogueUsesGeneratedPanel(page);
  for (let index = 0; index < 8; index += 1) {
    if (await page.evaluate(() => window.__CODEJITSU_SCENE === 'win')) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(420);
  }
  await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'win', undefined, { timeout: 12_000 });
  await expect.poll(() => page.evaluate(() => {
    const result = window.__CODEJITSU_RESULT_ABILITY_ART;
    return Boolean(result && result.chapter === 2 && result.abilityId === 'loop-strike');
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.__CODEJITSU_PHYSICS_GUARD ?? []).length)).toBe(0);
  await expectFrameHealth(page, ['story', 'tutorial', 'archive-approach', 'dungeon', 'boss', 'victory-dialogue', 'chapter2-story', 'chapter2-trail']);
  expectNoAppRuntimeIssues(runtimeIssues);
});

declare global {
  interface Window {
    __CODEJITSU_SCENE?: string;
    __CODEJITSU_TERMINAL_OPEN?: boolean;
    __CODEJITSU_TERMINAL_INPUT?: string;
    __CODEJITSU_TERMINAL_PREVIEW?: string;
    __CODEJITSU_TERMINAL_COMMAND_CARDS?: Array<{
      command: string;
      abilityId: string;
      usesGeneratedIcon: boolean;
      visible: boolean;
    }>;
    __CODEJITSU_TUTORIAL_HUD_VISIBILITY?: {
      visible: boolean;
      hiddenForTerminal: boolean;
      reason: string;
      at: number;
    };
    __CODEJITSU_ADVANCE_PROMPT_SEAL?: {
      scene: string;
      kind: string;
      usesImagegenPromptSeal: boolean;
      visibleTextPrompt: boolean;
      textureKey: string;
      frameIndex: number;
      at: number;
    };
    __CODEJITSU_SKIP_PROMPT_SEAL?: {
      scene: string;
      usesImagegenSkipSeal: boolean;
      visibleTextPrompt: boolean;
      textureKey: string;
      frameIndex: number;
      visible: boolean;
      clicked: boolean;
      at: number;
    };
    __CODEJITSU_TERMINAL_VISUAL?: {
      scene: string;
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      compactHelperCopy: boolean;
      panelWidth: number;
      panelHeight: number;
      at: number;
    };
    __CODEJITSU_ABILITY_ART?: {
      textureLoaded: boolean;
      sourceWidth: number;
      sourceHeight: number;
      effectTextureLoaded: boolean;
      effectSourceWidth: number;
      effectSourceHeight: number;
      effectFrameRows: number;
      effectFrameColumns: number;
      cards: Array<{
        abilityId: string;
        displayName: string;
        iconIndex: number;
        crop?: { x: number; y: number; width: number; height: number; index: number };
      }>;
      at: number;
    };
    __CODEJITSU_TELEGRAPH_ASSET?: {
      textureLoaded: boolean;
      textureKey: string;
      sourceWidth: number;
      sourceHeight: number;
      frameCount: number;
      generated: boolean;
      bossTextureLoaded: boolean;
      bossTextureKey: string;
      bossSourceWidth: number;
      bossSourceHeight: number;
      at: number;
    };
    __CODEJITSU_GENERATED_TELEGRAPHS?: Array<{
      scene: string;
      kind: string;
      textureKey: string;
      x: number;
      y: number;
      width: number;
      height: number;
      alpha: number;
      generated: boolean;
      at: number;
    }>;
    __CODEJITSU_BOSS_IMPACT_VFX?: Array<{
      scene: string;
      kind: string;
      textureKey: string;
      x: number;
      y: number;
      width: number;
      height: number;
      generated: boolean;
      at: number;
    }>;
    __CODEJITSU_IMPACT_VFX?: Array<{
      scene: string;
      kind: string;
      textureKey: string;
      x: number;
      y: number;
      width: number;
      height: number;
      generated: boolean;
      at: number;
    }>;
    __CODEJITSU_CHAPTER2_ATTACK_MARKER?: {
      scene: string;
      warrior: string;
      attackShape: string;
      sigilKind: string;
      usesGeneratedSigil: boolean;
      primitiveMarkerPieces: number;
      generatedArtOnly?: boolean;
      usesImagegenMarker: boolean;
      markerTextureKey: string;
      markerFrameIndex: number;
      width: number;
      height: number;
      at: number;
    };
    __CODEJITSU_LAST_ABILITY_CAST_ART?: {
      scene: string;
      abilityId: string;
      usesGeneratedIcon: boolean;
      usesGeneratedEffect: boolean;
      effectFrameCount: number;
      at: number;
    };
    __CODEJITSU_LAST_ABILITY_DAMAGE?: {
      scene: string;
      abilityId: string;
      targets: number;
      damage: number;
      reach?: number;
      distance?: number;
      at: number;
    };
    __CODEJITSU_COMBAT_HIT_MARK?: {
      scene: string;
      kind: string;
      abilityId?: string;
      usesImagegenCombatHitMark: boolean;
      primitiveTextLabels: number;
      visibleTextLabels: boolean;
      textureKey: string;
      frameIndex: number;
      at: number;
    };
    __CODEJITSU_RESULT_ABILITY_ART?: {
      abilityId: string;
      usesGeneratedIcon: boolean;
      chapter: number;
      usesImagegenBackdrop?: boolean;
      usesGeneratedVfx?: boolean;
      generatedVfxPieces?: number;
      primitiveMotionPieces?: number;
      animated?: boolean;
      usesImagegenPanel?: boolean;
      at: number;
    };
    __CODEJITSU_RESULT_SCENE?: {
      outcome: 'win' | 'lose';
      chapter: number;
      usesImagegenBackdrop: boolean;
      backdropKey?: string;
      coverWidth: number;
      coverHeight: number;
      coversCanvas: boolean;
      usesImagegenAtmosphereOverlay?: boolean;
      primitiveBackdropShadePieces?: number;
      atmosphereTextureKey?: string;
      animated: boolean;
      ringCount: number;
      particleCount: number;
      codeGlyphCount: number;
      usesImagegenAmbientMotes?: boolean;
      ambientMoteCount?: number;
      primitiveAmbientMotePieces?: number;
      usesGeneratedVfx: boolean;
      generatedVfxPieces: number;
      primitiveMotionPieces: number;
      vfxTextureKey: string;
      vfxFrameCount: number;
      vfxSourceWidth?: number;
      vfxSourceHeight?: number;
      usesImagegenPanel?: boolean;
      primitivePanelPieces?: number;
      panelKey?: string;
      panelWidth?: number;
      panelHeight?: number;
      usesImagegenWarningSigil?: boolean;
      primitiveWarningSigilPieces?: number;
      warningSigilKey?: string;
      warningSigilFrame?: string;
      at: number;
    };
    __CODEJITSU_PLAYTIME_AUDIT?: {
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
      segments: Array<{ id: string; label: string; type: string; estimatedSeconds: number; dialogueExcluded: boolean }>;
    };
    __CODEJITSU_CHAPTER1_PLAYTIME_RUNTIME?: {
      scene: string;
      minimumPlayableSeconds: number;
      chapterOnePlayableSeconds: number;
      chapterOnePlayableMinutes: number;
      chapterOneMeetsMinimum: boolean;
      dialogueExcluded: boolean;
      actualRoomCount: number;
      auditRoomCount: number;
      roomIdsMatchAudit: boolean;
      actualEnemyCount: number;
      auditEnemyCount: number;
      duplicateSpawnCount: number;
      duplicateFreeSpawns: boolean;
      playerFacingArea: string;
      internalLabelsHidden: boolean;
      mapProgressCopyVisible: boolean;
      at: number;
    };
    __CODEJITSU_STOLEN_CINEMATIC?: {
      usesImagegenAsset: boolean;
      textureKey: string;
      reason: string;
      alpha: number;
      at: number;
    };
    __CODEJITSU_CHAPTER2_STORY_VISUALS?: {
      scene: string;
      usesImagegenAura: boolean;
      primitiveGateSigils: number;
      textGlyphOverlays: number;
      generatedGlyphStorm: boolean;
      stagedActorsHiddenForCinematic?: boolean;
      at: number;
    };
    __CODEJITSU_DEATH_SCREEN?: {
      chapter: number;
      reason: string;
      clickToRetry: boolean;
      retryScene: string;
      usesImagegenBackdrop: boolean;
      backdropKey?: string;
      animated: boolean;
      ringCount: number;
      particleCount: number;
      usesGeneratedVfx: boolean;
      generatedVfxPieces: number;
      primitiveMotionPieces: number;
      usesImagegenPanel?: boolean;
      usesImagegenAtmosphereOverlay?: boolean;
      primitiveBackdropShadePieces?: number;
      usesImagegenWarningSigil?: boolean;
      primitiveWarningSigilPieces?: number;
      at: number;
    };
    __CODEJITSU_RESPAWN_STATE?: {
      scene: 'boss';
      source: 'death-retry';
      bossId: string;
      playerHp: number;
      maxHp: number;
      bossHp: number;
      abilityEnergy: number;
      terminalOpen: boolean;
      paused: boolean;
      timeScale: number;
      staleDeathCleared: boolean;
      staleResultCleared: boolean;
      staleResultLayoutCleared?: boolean;
      staleBossWarningCleared?: boolean;
      staleBossTelegraphCleared?: boolean;
      staleBossBannerCleared?: boolean;
      staleTransitionCleared?: boolean;
      terminalBufferCleared?: boolean;
      delayedUntilFadeClear: boolean;
      usesImagegenSeal: boolean;
      sealFrameCount: number;
      controlsReady: boolean;
      at: number;
    };
    __CODEJITSU_LAYOUT_AUDITS?: Record<string, {
      key: string;
      panel: { x: number; y: number; width: number; height: number; right: number; bottom: number };
      entries: Array<{
        id: string;
        bounds: { x: number; y: number; width: number; height: number; right: number; bottom: number };
        allowOutside: boolean;
        allowOverlap: boolean;
      }>;
      noOverflow: boolean;
      noOverlap: boolean;
      overflowIds: string[];
      overlaps: Array<{ a: string; b: string }>;
      at: number;
    }>;
    __CODEJITSU_TIME_SCALE?: number;
    __CODEJITSU_PAUSED?: boolean;
    __CODEJITSU_PAUSE_MENU?: string;
    __CODEJITSU_PAUSE_VISUAL?: {
      scene: string;
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      rowCount: number;
      panelWidth: number;
      panelHeight: number;
      at: number;
    };
    __CODEJITSU_TUTORIAL_GATE_OPEN?: boolean;
    __CODEJITSU_TUTORIAL_BACKDROP?: {
      scene: string;
      textureKey: string;
      usesCleanImagegenBackdrop: boolean;
      routeLineRemoved: boolean;
      noBakedText: boolean;
      noBakedCharacters: boolean;
      usesImagegenFocusOverlay?: boolean;
      primitiveBackdropShadePieces?: number;
      focusOverlayTextureKey?: string;
      sourceWidth: number;
      sourceHeight: number;
      at: number;
    };
    __CODEJITSU_TUTORIAL_GATE_VISUAL?: {
      scene: string;
      usesImagegenGate: boolean;
      primitiveGatePieces: number;
      textureKey: string;
      labelVisible: boolean;
      gateVisible: boolean;
      at: number;
    };
    __CODEJITSU_TUTORIAL_MARKER_VISUAL?: {
      scene: string;
      usesImagegenSigils: boolean;
      primitiveMarkerPieces: number;
      activeHighlight: string;
      markerVisible: boolean;
      warningVisible: boolean;
      markerFrameIndex: number;
      warningFrameIndex: number;
      frameCount: number;
      markerWidth: number;
      warningWidth: number;
      lowNoise: boolean;
      textureKey: string;
      at: number;
    };
    __CODEJITSU_TUTORIAL_STEP?: string;
    __CODEJITSU_TUTORIAL_PANEL_LAYOUT?: {
      panel: { x: number; y: number; width: number; height: number; bottom: number };
      instruction: { x: number; y: number; width: number; height: number; bottom: number };
      status: { x: number; y: number; width: number; height: number; bottom: number };
      hint: { x: number; y: number; width: number; height: number; bottom: number; right: number };
      gap: number;
      hintGap: number;
      noOverlap: boolean;
      hintNoOverlap: boolean;
      fitsPanel: boolean;
      hintFits: boolean;
      panelAvoidsPlayfield?: boolean;
      playfieldGap?: number;
      usesImagegenPanel: boolean;
      usesImagegenHintStrip: boolean;
      primitivePanelPieces: number;
      primitiveHintPieces: number;
      compactCopy: boolean;
      quietCopy: boolean;
      hintFrameIndex: number;
      hintTextureKey: string;
      lowerDocked?: boolean;
      microDocked?: boolean;
      wordCount: number;
      objectiveCopy?: string;
      statusCopy?: string;
      at: number;
    };
    __CODEJITSU_TUTORIAL_FLOW?: {
      stepCount: number;
      controls: string[];
      codeLinesExplained: string[];
      storyIdentity: string;
      hasTerminalSlowTimeStep: boolean;
      hasCombatStep: boolean;
      hasMovementStep: boolean;
      at: number;
    };
    __CODEJITSU_DUNGEON_GATE_OPEN?: boolean;
    __CODEJITSU_DUNGEON_GATE_VISUAL?: {
      scene: string;
      usesImagegenGate: boolean;
      primitiveGatePieces: number;
      textureKey: string;
      labelVisible: boolean;
      gateVisible: boolean;
      gateOpen: boolean;
      singleGatePresentation?: boolean;
      usesImagegenExitBeacon?: boolean;
      dynamicPortalVisible?: boolean;
      exitBeaconOnly?: boolean;
      mapGateOnly?: undefined;
      at: number;
    };
    __CODEJITSU_DUNGEON_HUD_VISUAL?: {
      scene: string;
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      compactCopy: boolean;
      wordCount: number;
      objectiveCopy?: string;
      statusCopy?: string;
      gateCopyVisible?: boolean;
      usesImagegenSealStatus?: boolean;
      primitiveSealStatusPieces?: number;
      sealStatusFrameIndex?: number;
      sealStatusTextureKey?: string;
      noMapCopyVisible?: boolean;
      textOverlayCount?: number;
      panelWidth: number;
      panelHeight: number;
      at: number;
    };
    __CODEJITSU_DUNGEON_SENTINEL_WARNING?: {
      scene: string;
      axis: 'horizontal' | 'vertical';
      usesImagegenWarningOverlay: boolean;
      usesImagegenImpactOverlay?: boolean;
      warningOverlayCount: number;
      impactOverlayCount?: number;
      primitiveWarningAlpha: number;
      collisionOnly: boolean;
      generatedArtOnly?: boolean;
      textureKey: string;
      at: number;
    };
    __CODEJITSU_DUNGEON_ROOM_VISUAL?: {
      scene: string;
      roomId: string;
      currentArea: string;
      internalRoomLabel?: string;
      currentMap?: undefined;
      roomIndex: number;
      totalRooms: number;
      textureKey: string;
      cropIndex: number;
      usesGeneratedRoomBackdrop: boolean;
      usesImagegenAtmosphereOverlay: boolean;
      primitiveBackdropShadePieces: number;
      atmosphereTextureKey: string;
      gateMarkerHiddenWhenLocked: boolean;
      repeatedGateMarkerVisible: boolean;
      roomTitleVisible?: boolean;
      roomNameHidden?: boolean;
      mapProgressCopyVisible?: boolean;
      at: number;
    };
    __CODEJITSU_DUNGEON_ROOM_TRANSITION_VISUAL?: {
      scene: string;
      usesImagegenSeamTransition: boolean;
      primitiveOverlayPieces: number;
      textOverlayCount: number;
      generatedTransitionPieces: number;
      textureKey: string;
      at: number;
    };
    __CODEJITSU_HUB_GATE_VISUAL?: {
      scene: string;
      usesImagegenGate: boolean;
      primitiveGatePieces: number;
      textureKey: string;
      binaryDigitLabels: number;
      gateVisible: boolean;
      at: number;
    };
    __CODEJITSU_HUB_BACKDROP?: {
      scene: string;
      textureKey: string;
      usesImagegenAtmosphere: boolean;
      primitiveBackdropShadePieces: number;
      atmosphereTextureKey: string;
      noExtraGateOverlay: boolean;
      sourceWidth: number;
      sourceHeight: number;
      at: number;
    };
    __CODEJITSU_HUB_HUD_VISUAL?: {
      scene: string;
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      usesImagegenHubCue?: boolean;
      primitiveCuePieces?: number;
      compactCopy: boolean;
      wordCount: number;
      textOverlayCount?: number;
      titleVisible?: boolean;
      hubCueFrameIndex?: number;
      objectiveCopy?: string;
      panelWidth: number;
      panelHeight: number;
      at: number;
    };
    __CODEJITSU_ARCHIVE_GATE_VISUAL?: {
      scene: string;
      usesImagegenGate: boolean;
      primitiveGatePieces: number;
      textureKey: string;
      labelVisible: boolean;
      debugMapCopyVisible: boolean;
      roomTitleVisible?: boolean;
      singleGatePresentation?: boolean;
      noExtraGateOverlay?: boolean;
      at: number;
    };
    __CODEJITSU_ARCHIVE_PATH_VISUAL?: {
      scene: string;
      usesImagegenSeamVfx: boolean;
      textArrowCount: number;
      seamVfxCount: number;
      at: number;
    };
    __CODEJITSU_ARCHIVE_BACKDROP?: {
      scene: string;
      textureKey: string;
      usesImagegenApproachOverlay: boolean;
      primitiveBackdropShadePieces: number;
      overlayTextureKey: string;
      noExtraGateOverlay: boolean;
      sourceWidth: number;
      sourceHeight: number;
      at: number;
    };
    __CODEJITSU_ARCHIVE_HUD_VISUAL?: {
      scene: string;
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      usesImagegenArchiveCue?: boolean;
      primitiveCuePieces?: number;
      compactCopy: boolean;
      wordCount: number;
      textOverlayCount?: number;
      archiveCueFrameIndex?: number;
      objectiveCopy?: string;
      panelWidth: number;
      panelHeight: number;
      at: number;
    };
    __CODEJITSU_SEAM_VFX?: Array<{
      scene: string;
      kind: string;
      textureKey: string;
      x: number;
      y: number;
      width: number;
      height: number;
      generated: boolean;
      at: number;
    }>;
    __CODEJITSU_ROOM_BORDER_VISUAL?: Array<{
      scene: string;
      usesImagegenSeamVfx: boolean;
      visibleRailAlpha: number;
      primitivePostAlpha: number;
      seamFragments: number;
      generatedOnlyBorders?: boolean;
      at: number;
    }>;
    __CODEJITSU_CHAPTER1_MAP_FLOW?: undefined;
    __CODEJITSU_CHAPTER1_ROUTE_PROGRESS?: {
      currentArea: string;
      internalRoomLabel?: string;
      roomIndex?: number;
      totalRooms: number;
      routeStage: 'approach' | 'dungeon';
      approachSceneActive: boolean;
      gateOpen?: boolean;
      mapProgressCopyVisible?: boolean;
      at: number;
    };
    __CODEJITSU_DIALOGUE_SPEAKER?: string;
    __CODEJITSU_DIALOGUE_TEXT?: string;
    __CODEJITSU_DIALOGUE_REVEALED?: string;
    __CODEJITSU_DIALOGUE_TYPING?: boolean;
    __CODEJITSU_DIALOGUE_LAYOUT?: {
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      usesIntegratedPortraitSocket: boolean;
      portraitX: number;
      portraitY: number;
      portraitInsidePanel?: boolean;
      bodyX: number;
      bodyY: number;
      panelCenterX: number;
      panel: { x: number; y: number; width: number; height: number; bottom: number };
      textLayout?: 'portrait-left';
    };
    __CODEJITSU_DIALOGUE_TALK_TICKS?: number;
    __CODEJITSU_DIALOGUE_LAST_TALK_AT?: number;
    __CODEJITSU_DIALOGUE_TYPEWRITER_HISTORY?: Array<{
      speaker: string;
      textLength: number;
      partialShown: boolean;
      talkTicks: number;
      at: number;
    }>;
    __CODEJITSU_DIALOGUE_ACTORS?: Array<{
      id: string;
      mode: string;
      x: number;
      y: number;
      moving: boolean;
      targetX?: number;
      targetY?: number;
      gateWalking: boolean;
      pose?: string;
      frameIndex?: number;
      frameCount?: number;
      renderVariant?: string;
      motionProfile?: string;
      flipX: boolean;
      facing: 'left' | 'right';
      alpha: number;
      targetObject?: boolean;
      visualBottom?: number;
      clearOfDialoguePanel?: boolean;
      active: boolean;
    }>;
    __CODEJITSU_DIALOGUE_STAGING?: {
      mode: string;
      portraitCentered: boolean;
      activeActorVisible: boolean;
      activeActorPose: string;
      noActorOverlap: boolean;
      minActorDistance: number;
      facingReadable: boolean;
      actorCount: number;
      characterCount?: number;
      storyCharacterCount?: number;
      storyCharacterIds?: string[];
      storyCharacterNames?: string[];
      strayArchiveActorCount?: number;
      memoryPropCount?: number;
      visibleThreatCount?: number;
      primaryThreatName?: string;
      threatRelationship?: string;
      archiveCombatScene?: boolean;
      archiveConfrontationClear?: boolean;
      at: number;
    };
    __CODEJITSU_DIALOGUE_MOVEMENT_HISTORY?: Array<{
      id: string;
      reason: string;
      targetX: number;
      targetY: number;
      at: number;
    }>;
    __CODEJITSU_DIALOGUE_SKIP?: {
      visible: boolean;
      clicked: boolean;
      scene: string;
      at: number;
    };
    __CODEJITSU_ROADMAP_PHASES?: string[];
    __CODEJITSU_ROADMAP_DETAILS?: Array<{
      id: number;
      title: string;
      summary: string;
      verifies: string[];
    }>;
    __CODEJITSU_AUDIO_UNLOCK?: {
      attempted: boolean;
      state: string;
      at: number;
    };
    __CODEJITSU_TALK_SOUND?: {
      requested: number;
      played: number;
      lastFrequency: number;
      lastEndFrequency: number;
      oscillator: string;
      duration: number;
      audioState: string;
      scene: string;
      at: number;
    };
    __CODEJITSU_TRANSITION?: Record<string, unknown>;
    __CODEJITSU_TRANSITION_HISTORY?: Record<string, unknown>[];
    __CODEJITSU_STAGE_TRANSITIONS?: Array<{
      id: string;
      effect: string;
      fromStage: string;
      toStage: string;
      maxDarkAlpha: number;
      swapped: boolean;
      complete: boolean;
      letterbox: boolean;
      at: number;
    }>;
    __CODEJITSU_BOSS_ATTACK?: string;
    __CODEJITSU_BOSS_COMBO?: string;
    __CODEJITSU_BOSS_MOTION?: {
      scene: string;
      id: string;
      velocityX: number;
      velocityY: number;
      speed: number;
      moving: boolean;
      movementState: string;
      desiredDistance: number;
      distanceToPlayer: number;
      samples: number;
      lastFrameStep: number;
      maxFrameStep: number;
      snapFree: boolean;
      cappedSeparation: boolean;
      noHardStop: boolean;
      glideDamping: boolean;
      visualGrounded: boolean;
      usesImagegenAura: boolean;
      auraFrameIndex: number;
      auraVisible: boolean;
      usesImagegenMotionSmear?: boolean;
      motionSmearFrameWidth?: number;
      motionSmearFrameHeight?: number;
      motionSmearFrameCount?: number;
      usesImagegenShadowstep: boolean;
      generatedAfterimages: number;
      primitiveAfterimages: number;
      shadowstepFrameWidth: number;
      shadowstepFrameHeight: number;
      usesImagegenTrail: boolean;
      trailFrameWidth: number;
      trailFrameHeight: number;
      smoothRepositions?: number;
      scriptedMotionActive?: boolean;
      velocityUsesFrameDelta?: boolean;
      pose?: string;
      frameIndex?: number;
      frameCount?: number;
      renderVariant?: string;
      motionProfile?: string;
      at: number;
    };
    __CODEJITSU_BOSS_BACKDROP?: {
      scene: string;
      bossId: string;
      textureKey: string;
      usesGeneratedArena: boolean;
      usesImagegenAtmosphereOverlay: boolean;
      primitiveBackdropShadePieces: number;
      atmosphereTextureKey: string;
      bossTitleVisible?: boolean;
      sourceWidth: number;
      sourceHeight: number;
      at: number;
    };
    __CODEJITSU_BOSS_TELEGRAPH?: {
      attack: string;
      name: string;
      subtitle: string;
      detail: string;
      castLine: string;
      phaseRole: string;
      movementTell: string;
      counterWindowMs: number;
      arenaEffect: string;
      bossMotion: string;
      counterStyle: string;
      comboRole: string;
      threatLevel: number;
      tokens: string[];
      movementHint: string;
      punishHint: string;
      hasAftershock: boolean;
      dangerLayers: string[];
      counterRhythm: string;
      commandHint: string;
      phaseShift: string;
      visual: string;
      comboName: string;
      comboStep: number;
      comboTotalSteps: number;
      queuedFollowUps: string[];
      usesImagegenBanner?: boolean;
      usesImagegenAttackCue?: boolean;
      usesImagegenThreatPips?: boolean;
      primitiveBannerPieces?: number;
      primitiveAttackCuePieces?: number;
      primitiveThreatPips?: number;
      visibleTextLabels?: number;
      at: number;
    };
    __CODEJITSU_BOSS_ATTACK_BANNER_VISUAL?: {
      usesImagegenBanner: boolean;
      usesImagegenAttackCue: boolean;
      usesImagegenThreatPips: boolean;
      primitiveBannerPieces: number;
      primitiveAttackCuePieces: number;
      primitiveThreatPips: number;
      attackCueFrameIndex: number;
      textLineCount: number;
      textureKey: string;
      threatPipKey: string;
      threatLevel: number;
      at: number;
    };
    __CODEJITSU_BOSS_PHASE_BREAK_VISUAL?: {
      usesImagegenPhaseRupture: boolean;
      primitivePhasePieces: number;
      textLineCount: number;
      textureKey: string;
      at: number;
    };
    __CODEJITSU_COMBO_CALLOUT_VISUAL?: {
      usesImagegenDivider: boolean;
      usesImagegenCadenceCue: boolean;
      primitiveDividerPieces: number;
      primitiveCadenceCuePieces: number;
      dividerPieces: number;
      cadenceFrameIndex: number;
      textLineCount: number;
      textureKey: string;
      cadenceTextureKey: string;
      variant: string;
      at: number;
    };
    __CODEJITSU_BOSS_WARNING_VISUAL?: {
      scene: string;
      usesGeneratedTelegraphs: boolean;
      generatedWarningCount: number;
      usesImagegenWarningLanes?: boolean;
      generatedWarningLaneOverlayCount?: number;
      warningLaneTextureKey?: string;
      primitiveWarningAlpha: number;
      collisionShapeCount: number;
      collisionOnlyShapeCount?: number;
      visiblePrimitiveWarningCount?: number;
      collisionShapesHidden: boolean;
      generatedArtOnly?: boolean;
      at: number;
    };
    __CODEJITSU_BOSS_HUD_LAYOUT?: {
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      usesImagegenPlayerCue?: boolean;
      primitivePlayerCuePieces?: number;
      playerCueFrameIndex?: number;
      playerCueState?: string;
      usesImagegenBossCue?: boolean;
      primitiveCuePieces?: number;
      bossCueFrameIndex?: number;
      bossCueState?: string;
      textOverlayCount?: number;
      objectiveCopy?: string;
      compactCopy: boolean;
      wordCount: number;
      panel: { x: number; y: number; width: number; height: number; bottom: number };
      playerPanel: { x: number; y: number; width: number; height: number; bottom: number };
      status: { x: number; y: number; width: number; height: number; bottom: number };
      syntax?: { x: number; y: number; width: number; height: number; bottom: number };
      combo?: { x: number; y: number; width: number; height: number; bottom: number };
      title?: { x: number; y: number; width: number; height: number; bottom: number };
      attackBanner?: { x: number; y: number; width: number; height: number; bottom: number };
      titleVisible?: boolean;
      topOverlayNoOverlap: boolean;
      noOverflow: boolean;
      playerHudNoOverflow: boolean;
      lines: number;
      at: number;
    };
    __CODEJITSU_ENEMY_BOUNDS?: Array<{
      id: string;
      displayName?: string;
      speciesId?: string;
      scene: string;
      x: number;
      y: number;
      hp: number;
      pose?: string;
      frameIndex?: number;
      frameCount?: number;
      renderVariant?: string;
      motionProfile?: string;
      bodyAlive: boolean;
      visualScale?: number;
      visualStride?: number;
      visualGrounded?: boolean;
      usesImagegenCombatSheet?: boolean;
      cleanIdentity?: boolean;
      distanceToPlayer?: number;
      noOverlap?: boolean;
    }>;
    __CODEJITSU_PHYSICS_GUARD?: Array<{
      scene: string;
      reason: string;
      x: number;
      y: number;
      at: number;
    }>;
    __CODEJITSU_FRAME_HEALTH?: Record<string, {
      scene: string;
      frames: number;
      maxDeltaMs: number;
      longFrameCount: number;
      healthy: boolean;
      lastDeltaMs: number;
      at: number;
    }>;
    __CODEJITSU_HEALTH_BAR_VISUAL?: Array<{
      scene: string;
      label: string;
      usesImagegenFrame: boolean;
      usesImagegenFill: boolean;
      primitiveFramePieces: number;
      primitiveFillPieces: number;
      generatedFillCropped: boolean;
      ratio: number;
      frameWidth: number;
      frameHeight: number;
      fillWidth: number;
      at: number;
    }>;
    __CODEJITSU_TITLE_LAYOUT?: {
      scene: string;
      title: string;
      coverWidth: number;
      coverHeight: number;
      coversCanvas: boolean;
      glitchLayers: number;
      retroLayers?: number;
      sliceLayers?: number;
      glyphLayers?: number;
      titleLines?: string[];
      prompt?: string;
      visiblePromptText?: boolean;
      hasCodeLeak?: boolean;
      titleReadable?: boolean;
      calmCover?: boolean;
      coverMode?: string;
      titleFx?: {
        usesImagegenSkyfallFx: boolean;
        textureKey: string;
        primitiveFxPieces: number;
        generatedFxPieces: number;
        panelCount: number;
        promptUsesImagegenPanel?: boolean;
        promptPrimitivePieces?: number;
        startPromptTextureKey?: string;
        generatedStaticDecorPieces?: number;
        primitiveStaticDecorPieces?: number;
        usesImagegenVignette?: boolean;
        primitiveVignettePieces?: number;
        vignetteTextureKey?: string;
        shadowUsesImagegen?: boolean;
        primitiveShadowPieces?: number;
        skyGateUsesImagegen?: boolean;
        primitiveSkyGatePieces?: number;
        primitiveSimpleShapeFallbackPieces?: number;
        generatedOnlyTitleFx?: boolean;
      };
      fallAnimation?: {
        mode: 'sky-drop';
        brandedDrop?: 'single-title-stack';
        pieces?: number;
        fromY: number[];
        targetY: number[];
        currentY: number[];
        complete: boolean;
        impact: boolean;
        dropOrigin?: 'sky';
        motionTrailCount?: number;
        impactCount?: number;
      };
    };
    __CODEJITSU_CHAPTER2_TRAIL?: {
      remaining: number;
      portalOpen: boolean;
      usesGeneratedPortal: boolean;
      usesGeneratedPortalOnly: boolean;
      usesMapGate?: undefined;
      generatedPortalPieces?: number;
      primitivePortalPieces?: number;
      outdoorScene: boolean;
      usesImagegenWarriors: boolean;
      stageIndex: number;
      totalStages: number;
      stageName: string;
      stageId: string;
      stageVow: string;
      stageVisualVariant?: string;
      stageBackdropKey?: string;
      usesImagegenAtmosphereOverlay?: boolean;
      primitiveBackdropShadePieces?: number;
      atmosphereTextureKey?: string;
      allStagesCleared: boolean;
      chapterTwoPlaytime?: {
        chapterTwoPlayableSeconds: number;
        chapterTwoPlayableMinutes: number;
        chapterTwoMeetsMinimum: boolean;
      };
      lastSwordDamage?: { targets: number; beforeTotalHp: number; afterTotalHp: number; damage: number; at: number };
      lastTerminalDamage?: { abilityId: string; targets: number; beforeTotalHp: number; afterTotalHp: number; damage: number; at: number };
      textOverlayCount?: number;
      primitiveRouteOverlayCount?: number;
      enemies: Array<{
        id: string;
        hp: number;
        maxHp?: number;
        x: number;
        y: number;
        warrior: string;
        pose?: string;
        frameCount?: number;
        frameIndex?: number;
        renderVariant?: string;
        motionProfile?: string;
        displayWidth?: number;
        displayHeight?: number;
        bodyAlive?: boolean;
        bodyWidth?: number;
        bodyHeight?: number;
        visualScale?: number;
        readableOnMap?: boolean;
        damageable?: boolean;
        hpChangedSinceSpawn?: boolean;
        noOverlap?: boolean;
        distanceToPlayer?: number;
      }>;
    };
    __CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL?: {
      usesImagegenPanel: boolean;
      primitivePanelPieces: number;
      textureKey: string;
      panelWidth: number;
      panelHeight: number;
      compactCopy: boolean;
      usesImagegenTrailCue?: boolean;
      primitiveCuePieces?: number;
      trailCueFrameIndex?: number;
      textOverlayCount?: number;
      objectiveCopy?: string;
      at: number;
    };
    __CODEJITSU_CHAPTER2_STAGE_INTERLUDE?: {
      count: number;
      kind: 'stage-advance' | 'boss-gate';
      fromStageId: string;
      fromStageName: string;
      toStageId?: string;
      toStageName?: string;
      stageIndex: number;
      totalStages: number;
      gateGlyph: string;
      usesImagegenAsset: boolean;
      animated: boolean;
      ringCount: number;
      particleCount: number;
      usesImagegenPanel?: boolean;
      primitivePanelPieces?: number;
      panelKey?: string;
      usesImagegenInterludeCue?: boolean;
      primitiveInterludeCuePieces?: number;
      usesImagegenInterludeAtmosphere?: boolean;
      primitiveBackdropShadePieces?: number;
      atmosphereTextureKey?: string;
      interludeCueFrameIndex?: number;
      textOverlayCount?: number;
      at: number;
    };
    __CODEJITSU_CHAPTER2_VOW?: {
      abilityId: string;
      learnedByMeditation: boolean;
      at: number;
    };
    __CODEJITSU_BOSS_ATTACK_HISTORY?: Array<{
      attack: string;
      name: string;
      combo: string;
      queued: boolean;
      phase: number;
      chainIndex: number;
      stance?: string;
      pressureText?: string;
      comboStep?: number;
      comboTotalSteps?: number;
      queuedFollowUps?: string[];
      at: number;
    }>;
    __CODEJITSU_BOSS_STANCE?: {
      stance: string;
      pressureText: string;
      moveSpeedMultiplier: number;
      orbitStrength: number;
      desiredDistance: number;
      attackDelayMs: number;
      comboEvery: number;
      at: number;
    };
    __CODEJITSU_BOSS_HIT_FEEDBACK?: {
      weapon: string;
      inputKey: string;
      target: string;
      variant: number;
      damage: number;
      hitX: number;
      hitY: number;
      comboCount: number;
      energy: number;
      bossReactionPose?: string;
      hitStopMs?: number;
      hitStopScale?: number;
      cameraShakeMs?: number;
      cameraShakeIntensity?: number;
      knockback?: number;
      recoilDirection?: 1 | -1;
      clashVisual?: string;
      impactClass?: string;
      at: number;
    };
    __CODEJITSU_BOSS_TERMINAL_GATE?: {
      scene: 'boss';
      requiredCommand: string;
      required: boolean;
      answered: boolean;
      finishUnlocked: boolean;
      rawFinishBlocked: boolean;
      blockCount: number;
      status: string;
      at: number;
    };
    __CODEJITSU_BOSS_FINISHER_HINT?: {
      text: string;
      command: string;
      explicit: boolean;
      usesImagegenFinisherCue?: boolean;
      primitiveCuePieces?: number;
      finisherCueFrameIndex?: number;
      visibleText?: boolean;
      at: number;
    };
    __CODEJITSU_CONTROL_SCHEME?: {
      scene: string;
      move: string;
      swing: string;
      terminal: string;
      removedAttackKeys: string[];
      at: number;
    };
    __CODEJITSU_BOUNDARY_FEEDBACK?: {
      scene: string;
      side: 'left' | 'right' | 'top' | 'bottom' | 'none';
      attempted: {
        x: number;
        y: number;
      };
      clamped: {
        x: number;
        y: number;
      };
      arena: {
        leftAtY: number;
        rightAtY: number;
        topWidthRatio: number;
      };
      visual: string;
      at: number;
    };
    __CODEJITSU_DEPTH_CUES?: Array<{
      scene: string;
      topWidthRatio: number;
      bandCount: number;
      foregroundOccluders: number;
      foregroundDepth: number;
      actorDepthMode: string;
      perspectiveScale: boolean;
      textureForeground: boolean;
      at: number;
    }>;
    __CODEJITSU_DEPTH_MOTION?: {
      scene: string;
      parallaxActive: boolean;
      leadX: number;
      leadY: number;
      leadMagnitude: number;
      overlayX: number;
      overlayY: number;
      overlayScale: number;
      movementState?: string;
      at: number;
    };
    __CODEJITSU_PLAYER_BOUNDS?: {
      scene: string;
      x: number;
      y: number;
      pose?: string;
      frameIndex?: number;
      frameCount?: number;
      sourcePose?: string;
      renderVariant?: string;
      motionProfile?: string;
      momentumState?: string;
      visualScale?: number;
      visualStride?: number;
      visualGrounded?: boolean;
      footPlantPhase?: number;
      tractionGrip?: number;
      brakingSnap?: boolean;
      driftSuppression?: number;
      inputResponsiveness?: number;
      turnAnticipation?: number;
      stopGrip?: number;
      cinematicSnap?: number;
      accelerationBurst?: number;
      brakingGrip?: number;
      stepBeat?: number;
      movePolishLevel?: number;
      releaseBrakeAssist?: number;
      bounds: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      };
      arena?: {
        leftAtY: number;
        rightAtY: number;
        topWidthRatio: number;
      };
    };
    __CODEJITSU_TUTORIAL_SPACING?: {
      player: { x: number; y: number };
      mentor: { x: number; y: number };
      minDistance: number;
      actualDistance: number;
      noOverlap: boolean;
      soloPractice?: boolean;
      at: number;
    };
    __CODEJITSU_TUTORIAL_DUMMY?: {
      hp: number;
      hits: number;
      hitRegistered: boolean;
      broken: boolean;
      soloPractice: boolean;
      mentorVisible: boolean;
      mentorHitboxSmall: boolean;
      playerFacingDummy: boolean;
      labelVisible?: boolean;
      renderVariant?: string;
      pose?: string;
      spectralEcho?: boolean;
      targetObject?: boolean;
      alpha?: number;
      displayWidth?: number;
      displayHeight?: number;
      sourceWidth?: number;
      sourceHeight?: number;
      distinctFromPlayer?: boolean;
      at: number;
    };
    __CODEJITSU_SWORD_SWING?: {
      scene: string;
      inputKey: 'x';
      weapon: 'sword';
      removedKeys: string[];
      hasBlade: boolean;
      usesImagegenVfx?: boolean;
      primitivePieces?: number;
      vfxFrameIndex?: number;
      x: number;
      y: number;
      hitX: number;
      hitY: number;
      variant: number;
      targetId?: string;
      aimedAtTarget?: boolean;
      at: number;
    };
    __CODEJITSU_ASSET_AUDIT?: Array<{
      scene: string;
      key: string;
      width: number;
      height: number;
      padding: number;
      border: number;
      alphaErrors: number;
    }>;
    __CODEJITSU_ANIMATION_CATALOG?: Array<{
      kind: string;
      displayName: string;
      sourceTexture: string;
      usesGeneratedTexture: boolean;
      requiredPoseCount: number;
      animatedPoseCount: number;
      allRequiredPresent: boolean;
      poses: Array<{
        pose: string;
        requiredAnimated: boolean;
        present: boolean;
        sourcePose?: string;
        frameCount: number;
        animated: boolean;
        renderVariant: string;
        motionProfile: string;
      }>;
    }>;
    __CODEJITSU_BACKDROP_QUALITY?: Array<{
      key: string;
      role: string;
      exists: boolean;
      sourceWidth: number;
      sourceHeight: number;
      canvasWidth: number;
      canvasHeight: number;
      coversCanvas: boolean;
      fullResolution: boolean;
      noUpscaleNeeded: boolean;
      at: number;
    }>;
    __CODEJITSU_COMBAT_SHEET_QUALITY?: Array<{
      key: string;
      role: string;
      exists: boolean;
      sourceWidth: number;
      sourceHeight: number;
      minimumWidth: number;
      minimumHeight: number;
      highResolution: boolean;
      transparentCapable: boolean;
      alphaSampled: boolean;
      transparentCorners: boolean;
      edgeBleedScore: number;
      cleanTransparentEdges: boolean;
      generatedCombatSheet: boolean;
      notFallbackAtlas: boolean;
      at: number;
    }>;
    __CODEJITSU_TRY_CATCH_GUARD?: {
      scene: string;
      active: boolean;
      durationMs: number;
      guardUntil: number;
      playerHp: number;
      healed: number;
      usesGeneratedSigil: boolean;
      bossFrozen: boolean;
      at: number;
    };
  }
}
