import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const manifestPath = resolve(process.env.CODEJITSU_PROOF_MANIFEST ?? 'tmp/visual-proof/manifest.json');
const chapterOneDungeonRoomCount = 10;
const requiredPauseOptions = ['Resume', 'Save Game', 'Settings', 'Extras', 'Exit to Title'];

function unique(values) {
  return new Set(values.filter(Boolean));
}

function byName(manifest, name) {
  return manifest.routes.find((route) => route.name === name);
}

function frameTotal(manifest) {
  return manifest.routes.reduce((total, route) => total + (route.frames?.length ?? 0), 0);
}

function changingAnimatedRoutes(manifest) {
  return manifest.routes.filter((route) => {
    if (![
      'title',
      'story',
      'tutorial',
      'dungeon',
      'boss',
      'chapter2-trail',
      'result-lose',
    ].includes(route.name) && !route.name.startsWith('dungeon-room-')) {
      return false;
    }
    return unique((route.frames ?? []).map((frame) => frame.hash)).size >= 2;
  }).length;
}

function primitiveFallbacks(manifest) {
  return manifest.routes.flatMap((route) =>
    (route.runtime?.primitiveFallbacks ?? []).map((fallback) => ({ route: route.name, ...fallback })),
  );
}

function check(id, requirement, passed, evidence, severity = 'required') {
  return {
    id,
    requirement,
    status: passed ? 'verified' : 'missing',
    severity,
    evidence,
  };
}

function summarize(manifest) {
  const title = byName(manifest, 'title');
  const story = byName(manifest, 'story');
  const tutorial = byName(manifest, 'tutorial');
  const archive = byName(manifest, 'archive-approach');
  const hub = byName(manifest, 'hub');
  const dungeon = byName(manifest, 'dungeon');
  const pause = byName(manifest, 'pause-menu');
  const terminal = byName(manifest, 'terminal-popup');
  const boss = byName(manifest, 'boss');
  const chapter2Trail = byName(manifest, 'chapter2-trail');
  const lose = byName(manifest, 'result-lose');
  const dungeonRooms = manifest.routes.filter((route) => route.name.startsWith('dungeon-room-'));
  const generated = manifest.generatedAssetInventory ?? {};
  const routeCount = manifest.routes.length;
  const frames = frameTotal(manifest);
  const changingRoutes = changingAnimatedRoutes(manifest);
  const uniqueDungeonVisuals = unique(dungeonRooms.map((route) => {
    const visual = route.runtime?.dungeonRoom;
    return `${visual?.textureKey ?? 'missing'}:${visual?.cropIndex ?? -1}`;
  })).size;
  const bossUniqueAttacks = unique((boss?.runtime?.bossAttackHistory ?? []).map((entry) => entry.attack)).size;

  const checks = [
    check('no-runtime-errors', 'No blocking browser/runtime errors were captured.', (manifest.runtimeIssues ?? []).length === 0, {
      runtimeIssues: manifest.runtimeIssues ?? [],
    }),
    check('generated-assets', 'At least 15 generated raster assets are present and referenced.', generated.generatedAssetCount >= 15 && generated.missingAssets?.length === 0 && generated.tinyAssets?.length === 0, {
      generatedAssetCount: generated.generatedAssetCount,
      missingAssets: generated.missingAssets,
      tinyAssets: generated.tinyAssets,
    }),
    check('no-stale-typos', 'No straw/sential/sentinal typo remains in generated names or live sentinel identity.', generated.staleGeneratedNames?.length === 0 && (dungeon?.runtime?.enemyBounds ?? []).every((enemy) => enemy.cleanIdentity === true), {
      staleGeneratedNames: generated.staleGeneratedNames,
      enemies: dungeon?.runtime?.enemyBounds,
    }),
    check('no-primitive-fallbacks', 'Captured routes expose no primitive/simple-shape fallback counters.', primitiveFallbacks(manifest).length === 0, {
      primitiveFallbacks: primitiveFallbacks(manifest),
    }),
    check('title', 'Front screen shows only LEGENDS OF CODEJITSU with generated sky-drop impact.', title?.runtime?.titleLayout?.title === 'LEGENDS OF CODEJITSU' && title.runtime.titleLayout?.fallAnimation?.complete === true && title.runtime.titleLayout?.titleFx?.generatedOnlyTitleFx === true, {
      title: title?.runtime?.titleLayout?.title,
      fallAnimation: title?.runtime?.titleLayout?.fallAnimation,
      titleFx: title?.runtime?.titleLayout?.titleFx,
    }),
    check('first-scene', 'First story scene clearly stages Apprentice versus Null Oni with no extra/confusing actors.', story?.runtime?.dialogueStaging?.archiveConfrontationClear === true && story.runtime.dialogueStaging?.storyCharacterCount === 2 && story.runtime.dialogueStaging?.noActorOverlap === true, {
      staging: story?.runtime?.dialogueStaging,
    }),
    check('tutorial-layout', 'Tutorial panel is generated, readable, non-overlapping, and teaches movement/X/terminal/try.catch.', tutorial?.runtime?.tutorialPanel?.usesImagegenPanel === true && tutorial.runtime.tutorialPanel?.noOverlap === true && tutorial.runtime.tutorialPanel?.fitsPanel === true && tutorial.runtime.tutorialFlow?.stepCount >= 5 && tutorial.runtime.tutorialFlow?.controls?.includes('WASD') && tutorial.runtime.tutorialFlow?.controls?.includes('X') && tutorial.runtime.tutorialFlow?.controls?.includes('T') && tutorial.runtime.tutorialFlow?.codeLinesExplained?.some((line) => /try\.catch.*counter oath/i.test(line)), {
      tutorialPanel: tutorial?.runtime?.tutorialPanel,
      tutorialFlow: tutorial?.runtime?.tutorialFlow,
    }),
    check('generated-character-animations', 'Active Chapter 1 characters use generated multi-frame animation sheets with clean alpha padding.', ['hero', 'mentor', 'sentinel', 'oni'].every((kind) => {
      const entry = (dungeon?.runtime?.animationCatalog ?? []).find((candidate) => candidate.kind === kind);
      return entry?.usesGeneratedTexture === true &&
        entry.allRequiredPresent === true &&
        Number(entry.requiredPoseCount ?? 0) >= 7 &&
        Number(entry.animatedPoseCount ?? 0) >= 5 &&
        (entry.poses ?? []).filter((pose) => pose.requiredAnimated).every((pose) =>
          pose.present === true &&
          pose.animated === true &&
          Number(pose.frameCount ?? 0) > 1 &&
          typeof pose.motionProfile === 'string' &&
          pose.motionProfile.length > 0,
        );
    }) && (dungeon?.runtime?.assetAudit ?? []).length >= 6 && dungeon.runtime.assetAudit.every((entry) =>
      Number(entry.padding ?? 0) >= 14 &&
      Number(entry.border ?? 0) >= 4 &&
      Number(entry.alphaErrors ?? 99) === 0,
    ), {
      animationCatalog: dungeon?.runtime?.animationCatalog,
      assetAudit: dungeon?.runtime?.assetAudit,
    }),
    check('debug-copy-hidden', 'Map/chapter/debug labels and noisy objective text are hidden from captured playable HUDs.', archive?.runtime?.archiveHud?.textOverlayCount === 0 && hub?.runtime?.hubHud?.titleVisible === false && dungeonRooms.every((route) => route.runtime?.dungeonRoom?.mapProgressCopyVisible === false && route.runtime?.dungeonRoom?.roomTitleVisible === false), {
      archiveHud: archive?.runtime?.archiveHud,
      hubHud: hub?.runtime?.hubHud,
      dungeonRooms: dungeonRooms.map((route) => route.runtime?.dungeonRoom),
    }),
    check('single-gates', 'Archive and hub gate presentations are generated and not duplicated.', archive?.runtime?.archiveGate?.singleGatePresentation === true && archive.runtime.archiveGate?.noExtraGateOverlay === true && hub?.runtime?.hubGate?.usesImagegenGate === true && hub.runtime.hubBackdrop?.noExtraGateOverlay === true, {
      archiveGate: archive?.runtime?.archiveGate,
      hubGate: hub?.runtime?.hubGate,
    }),
    check('distinct-scenes', 'Main scenes and all Chapter 1 dungeon rooms have distinct visual identities.', uniqueDungeonVisuals === chapterOneDungeonRoomCount && routeCount >= 22, {
      routeCount,
      uniqueDungeonVisuals,
      dungeonRoomVisuals: dungeonRooms.map((route) => ({
        name: route.name,
        textureKey: route.runtime?.dungeonRoom?.textureKey,
        cropIndex: route.runtime?.dungeonRoom?.cropIndex,
      })),
    }),
    check('playtime', 'Chapter 1 proves at least 15 non-dialogue playable minutes.', Number(dungeon?.runtime?.chapterOnePlaytime?.chapterOnePlayableMinutes ?? 0) >= 15 && dungeon.runtime.chapterOnePlaytime?.actualRoomCount === chapterOneDungeonRoomCount, {
      chapterOnePlaytime: dungeon?.runtime?.chapterOnePlaytime,
    }),
    check('chapter2-playtime', 'Chapter 2 proves at least 15 non-dialogue playable minutes.', Number(chapter2Trail?.runtime?.chapter2Trail?.chapterTwoPlaytime?.chapterTwoPlayableMinutes ?? 0) >= 15 && chapter2Trail.runtime.chapter2Trail?.chapterTwoPlaytime?.chapterTwoMeetsMinimum === true, {
      chapterTwoPlaytime: chapter2Trail?.runtime?.chapter2Trail?.chapterTwoPlaytime,
    }),
    check('chapter2-warriors', 'Chapter 2 warriors are readable, separated, remade/generated, varied, and damageable by X plus terminal.', (chapter2Trail?.runtime?.chapter2Trail?.enemies ?? []).filter((enemy) => enemy.hp > 0).length >= 2 && chapter2Trail.runtime.chapter2Trail?.usesRemadeMinionVariants === true && Number(chapter2Trail.runtime.chapter2Trail?.enemyArchetypeCount ?? 0) >= 3 && Number(chapter2Trail.runtime.chapter2Trail?.movementStyleCount ?? 0) >= 3 && chapter2Trail.runtime.chapter2Trail.enemies.filter((enemy) => enemy.hp > 0).every((enemy) =>
      enemy.readableOnMap === true &&
      enemy.damageable === true &&
      enemy.bodyAlive === true &&
      enemy.noOverlap === true &&
      Number(enemy.displayWidth ?? 0) >= 145 &&
      Number(enemy.displayHeight ?? 0) >= 150 &&
      Number(enemy.bodyWidth ?? 0) >= 60 &&
      Number(enemy.bodyHeight ?? 0) >= 54 &&
      Number(enemy.frameCount ?? 0) > 1 &&
      String(enemy.renderVariant ?? '').includes('imagegen')
    ) && Number(chapter2Trail.runtime.chapter2Trail?.lastSwordDamage?.targets ?? 0) > 0 && Number(chapter2Trail.runtime.chapter2Trail?.lastSwordDamage?.afterTotalHp ?? 999) < Number(chapter2Trail.runtime.chapter2Trail?.lastSwordDamage?.beforeTotalHp ?? 0) && Number(chapter2Trail.runtime.chapter2Trail?.lastTerminalDamage?.targets ?? 0) > 0 && Number(chapter2Trail.runtime.chapter2Trail?.lastTerminalDamage?.afterTotalHp ?? 999) < Number(chapter2Trail.runtime.chapter2Trail?.lastTerminalDamage?.beforeTotalHp ?? 0), {
      chapter2Trail: chapter2Trail?.runtime?.chapter2Trail,
    }),
    check('chapter2-portal-size', 'Chapter 2 portal and foreground effects stay bounded and quiet instead of covering the arena.', chapter2Trail?.runtime?.chapter2Trail?.portalBounds?.bounded === true && chapter2Trail.runtime.chapter2Trail?.foregroundOverlay?.quiet === true, {
      portalBounds: chapter2Trail?.runtime?.chapter2Trail?.portalBounds,
      foregroundOverlay: chapter2Trail?.runtime?.chapter2Trail?.foregroundOverlay,
    }),
    check('screenshots', 'Visual proof captured a broad route/frame sweep with changing animated frames.', routeCount >= 22 && frames >= 132 && changingRoutes >= 17, {
      routeCount,
      frames,
      changingRoutes,
    }),
    check('pause-menu', 'Escape pause menu has required options, generated panel, and clean layout.', pause?.runtime?.pauseVisual?.usesImagegenPanel === true && requiredPauseOptions.every((label) => pause.runtime.pauseVisual?.rowLabels?.includes(label)) && pause.runtime.pauseVisual?.noOverlap === true, {
      pauseVisual: pause?.runtime?.pauseVisual,
    }),
    check('terminal-popup', 'T terminal popup slows time to 0.5x and accepts full try.catch syntax with generated UI.', terminal?.runtime?.terminalOpen === true && terminal.runtime.timeScale === 0.5 && terminal.runtime.terminalInput === 'try.catch' && terminal.runtime.terminalVisual?.usesImagegenPanel === true && terminal.runtime.layoutAudits?.terminal?.noOverlap === true, {
      terminalInput: terminal?.runtime?.terminalInput,
      timeScale: terminal?.runtime?.timeScale,
      terminalVisual: terminal?.runtime?.terminalVisual,
    }),
    check('boss-motion', 'Null Oni boss motion is stable and uses generated movement effects without primitive afterimages.', boss?.runtime?.bossMotion?.snapFree === true && boss.runtime.bossMotion?.usesImagegenMotionSmear === true && boss.runtime.bossMotion?.primitiveAfterimages === 0, {
      bossMotion: boss?.runtime?.bossMotion,
    }),
    check('boss-detail', 'Null Oni shows varied detailed command-pattern attacks with generated warning art.', bossUniqueAttacks >= 3 && boss?.runtime?.bossWarning?.generatedArtOnly === true && boss.runtime.bossAttackBanner?.textLineCount === 0, {
      bossUniqueAttacks,
      bossAttackHistory: boss?.runtime?.bossAttackHistory,
      bossWarning: boss?.runtime?.bossWarning,
    }),
    check('death-retry', 'Death retry returns to a ready boss scene without respawn/runtime errors.', lose?.runtime?.scene === 'boss' && lose.runtime.bossMotionReady === true && lose.runtime.bossMotion?.primitiveAfterimages === 0, {
      resultLoseRuntime: lose?.runtime,
    }),
  ];

  const failed = checks.filter((entry) => entry.status !== 'verified');
  return {
    manifestPath,
    completionProven: failed.length === 0,
    verifiedCount: checks.length - failed.length,
    failedCount: failed.length,
    checks,
  };
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const report = summarize(manifest);
console.log(JSON.stringify(report, null, 2));
if (report.failedCount > 0) {
  process.exitCode = 1;
}
