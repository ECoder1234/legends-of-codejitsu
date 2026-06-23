import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.CODEJITSU_BASE_URL ?? 'http://127.0.0.1:5173';
const outputDir = resolve(process.env.CODEJITSU_PROOF_DIR ?? 'tmp/visual-proof');
const frameCount = Number.parseInt(process.env.CODEJITSU_PROOF_FRAMES ?? '6', 10);
const frameDelayMs = Number.parseInt(process.env.CODEJITSU_PROOF_DELAY_MS ?? '500', 10);
const chapterOneDungeonRoomCount = 10;
const relevantRuntimeIssue = (text) =>
  /setVelocity|this\.body|AudioContext was prevented|Uncaught TypeError|phaser\.js|Security Error|moz-extension/i.test(text);

async function collectGeneratedAssetInventory() {
  const manifestPath = resolve('public/assets/generated/manifest.json');
  const generatedManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const assets = [];
  const walk = (value, path = []) => {
    if (typeof value === 'string' && /^\/?assets\/generated\//.test(value)) {
      const normalizedUrl = value.startsWith('/') ? value : `/${value}`;
      assets.push({
        keyPath: path.join('.'),
        url: normalizedUrl,
        localPath: resolve('public', normalizedUrl.replace(/^\//, '')),
      });
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  };
  walk(generatedManifest);

  const checked = await Promise.all(assets.map(async (asset) => {
    try {
      const file = await stat(asset.localPath);
      return { ...asset, exists: true, bytes: file.size };
    } catch {
      return { ...asset, exists: false, bytes: 0 };
    }
  }));
  const staleNamePattern = /straw|sential|sentinal/i;
  return {
    manifestPath,
    generatedAssetCount: checked.length,
    presentAssetCount: checked.filter((asset) => asset.exists).length,
    missingAssets: checked.filter((asset) => !asset.exists).map((asset) => ({ keyPath: asset.keyPath, url: asset.url })),
    staleGeneratedNames: checked
      .filter((asset) => staleNamePattern.test(asset.url))
      .map((asset) => ({ keyPath: asset.keyPath, url: asset.url })),
    tinyAssets: checked
      .filter((asset) => asset.exists && asset.bytes < 1_000)
      .map((asset) => ({ keyPath: asset.keyPath, url: asset.url, bytes: asset.bytes })),
  };
}

async function sleep(ms) {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function canReachServer() {
  try {
    const response = await fetch(baseUrl, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await canReachServer()) return true;
    await sleep(250);
  }
  return false;
}

async function ensureDevServer() {
  if (await canReachServer()) {
    console.log(`Using existing dev server at ${baseUrl}`);
    return undefined;
  }

  console.log(`Starting Vite dev server for proof capture at ${baseUrl}`);
  const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
    detached: true,
  });
  server.stdout.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`[proof-server] ${text}`);
  });
  server.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) console.error(`[proof-server] ${text}`);
  });

  if (!(await waitForServer())) {
    server.kill('SIGTERM');
    throw new Error(`Vite dev server did not become reachable at ${baseUrl}`);
  }
  return server;
}

async function stopOwnedServer(server) {
  if (!server) return;
  const killGroup = (signal) => {
    try {
      process.kill(-server.pid, signal);
    } catch {
      try {
        server.kill(signal);
      } catch {
        // Already stopped.
      }
    }
  };
  killGroup('SIGTERM');
  const exited = await Promise.race([
    new Promise((resolveStop) => server.once('exit', () => resolveStop(true))),
    sleep(3_000).then(() => false),
  ]);
  if (!exited) {
    killGroup('SIGKILL');
    await Promise.race([
      new Promise((resolveStop) => server.once('exit', () => resolveStop(true))),
      sleep(1_000),
    ]);
  }
}

async function pressTerminalCommand(page, command) {
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true && window.__CODEJITSU_TIME_SCALE === 0.5, undefined, { timeout: 4_000 });
  await page.keyboard.type(command, { delay: 25 });
  await page.waitForFunction((expected) => window.__CODEJITSU_TERMINAL_INPUT === expected, command, { timeout: 4_000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === false && window.__CODEJITSU_TIME_SCALE === 1, undefined, { timeout: 4_000 });
}

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function steerPlayerNear(page, targetX, targetY, tolerance = 56) {
  for (let index = 0; index < 12; index += 1) {
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

async function pressGeneratedSwing(page) {
  await page.keyboard.press('x');
  await page.waitForFunction(() => window.__CODEJITSU_SWORD_SWING?.usesImagegenVfx === true, undefined, { timeout: 4_000 });
}

async function waitForStableBossMotion(page) {
  await page.waitForFunction(() => {
    const motion = window.__CODEJITSU_BOSS_MOTION;
    return Boolean(
      motion &&
      motion.scene === 'boss' &&
      motion.id === 'null-oni' &&
      motion.samples >= 12 &&
      motion.usesImagegenMotionSmear === true &&
      motion.usesImagegenShadowstep === true &&
      Number(motion.generatedAfterimages ?? 0) > 0 &&
      Number(motion.primitiveAfterimages ?? 999) === 0 &&
      Number(motion.maxFrameStep ?? 999) <= 26,
    );
  }, undefined, { timeout: 8_000 });
}

async function waitForGeneratedBossAttackArt(page) {
  await page.waitForFunction(() => {
    const telegraphs = window.__CODEJITSU_GENERATED_TELEGRAPHS ?? [];
    const impacts = window.__CODEJITSU_BOSS_IMPACT_VFX ?? [];
    const warning = window.__CODEJITSU_BOSS_WARNING_VISUAL;
    const telegraph = window.__CODEJITSU_BOSS_TELEGRAPH;
    const banner = window.__CODEJITSU_BOSS_ATTACK_BANNER_VISUAL;
    const history = window.__CODEJITSU_BOSS_ATTACK_HISTORY ?? [];
    return Boolean(
      history.some((entry) => entry.phase >= 1 && Number(entry.threatLevel ?? 0) >= 1 && Boolean(entry.castLine)) &&
      telegraphs.some((entry) =>
        entry.scene === 'boss' &&
        entry.textureKey === 'boss-telegraph-sigils' &&
        entry.generated === true &&
        entry.width >= 90 &&
        entry.height >= 90,
      ) &&
      impacts.some((effect) =>
        effect.scene === 'boss' &&
        effect.generated === true &&
        effect.textureKey === 'boss-impact-vfx' &&
        effect.width >= 120 &&
        effect.height >= 70,
      ) &&
      warning?.scene === 'boss' &&
      warning.usesGeneratedTelegraphs === true &&
      warning.usesImagegenWarningLanes === true &&
      warning.generatedArtOnly === true &&
      Number(warning.visiblePrimitiveWarningCount ?? 99) === 0 &&
      telegraph?.usesImagegenBanner === true &&
      telegraph?.usesImagegenAttackCue === true &&
      telegraph?.usesImagegenThreatPips === true &&
      Number(telegraph?.visibleTextLabels ?? 99) === 0 &&
      banner?.usesImagegenBanner === true &&
      banner?.usesImagegenAttackCue === true &&
      banner?.usesImagegenThreatPips === true &&
      Number(banner?.textLineCount ?? 99) === 0
    );
  }, undefined, { timeout: 14_000 });
}

const dungeonRoomRoutes = Array.from({ length: chapterOneDungeonRoomCount }, (_, roomIndex) => ({
  name: `dungeon-room-${String(roomIndex).padStart(2, '0')}`,
  path: `/?start=dungeon&e2e=1&room=${roomIndex}`,
  readyArg: roomIndex,
  ready: (expectedRoom) =>
    window.__CODEJITSU_SCENE === 'dungeon' &&
    window.__CODEJITSU_DUNGEON_HUD_VISUAL?.usesImagegenPanel === true &&
    window.__CODEJITSU_DUNGEON_ROOM_VISUAL?.roomIndex === expectedRoom &&
    window.__CODEJITSU_DUNGEON_ROOM_VISUAL?.usesGeneratedRoomBackdrop === true,
  action: async (page) => {
    await pressGeneratedSwing(page);
  },
}));

const routes = [
  {
    name: 'title',
    path: '/?e2e=1',
    ready: () => window.__CODEJITSU_TITLE_LAYOUT?.fallAnimation?.complete === true,
  },
  {
    name: 'story',
    path: '/?start=story&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'story' && window.__CODEJITSU_DIALOGUE_STAGING?.archiveConfrontationClear === true,
    action: async (page) => {
      await page.waitForFunction(() =>
        window.__CODEJITSU_DIALOGUE_TEXT &&
        window.__CODEJITSU_DIALOGUE_REVEALED === window.__CODEJITSU_DIALOGUE_TEXT &&
        window.__CODEJITSU_LAYOUT_AUDITS?.dialogue?.noOverlap === true &&
        window.__CODEJITSU_LAYOUT_AUDITS?.dialogue?.noOverflow === true,
      undefined, { timeout: 5_000 });
    },
  },
  {
    name: 'tutorial',
    path: '/?start=tutorial&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'tutorial' && window.__CODEJITSU_TUTORIAL_PANEL_LAYOUT?.microDocked === true,
    action: async (page) => {
      await pressGeneratedSwing(page);
    },
  },
  {
    name: 'archive-approach',
    path: '/?start=archive&e2e=1',
    ready: () =>
      window.__CODEJITSU_SCENE === 'archive-approach' &&
      window.__CODEJITSU_ARCHIVE_GATE_VISUAL?.singleGatePresentation === true &&
      window.__CODEJITSU_ARCHIVE_HUD_VISUAL?.usesImagegenPanel === true &&
      window.__CODEJITSU_ARCHIVE_BACKDROP?.usesImagegenApproachOverlay === true,
  },
  {
    name: 'hub',
    path: '/?start=hub&e2e=1',
    ready: () =>
      window.__CODEJITSU_SCENE === 'hub' &&
      window.__CODEJITSU_HUB_BACKDROP?.usesImagegenAtmosphere === true &&
      window.__CODEJITSU_HUB_GATE_VISUAL?.usesImagegenGate === true &&
      window.__CODEJITSU_HUB_HUD_VISUAL?.usesImagegenPanel === true,
  },
  {
    name: 'dungeon',
    path: '/?start=dungeon&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'dungeon' && window.__CODEJITSU_DUNGEON_HUD_VISUAL?.usesImagegenPanel === true,
    action: async (page) => {
      await pressGeneratedSwing(page);
      await pressTerminalCommand(page, 'try.catch');
      await page.waitForFunction(() =>
        window.__CODEJITSU_LAST_ABILITY_CAST_ART?.scene === 'dungeon' &&
        window.__CODEJITSU_LAST_ABILITY_CAST_ART?.usesGeneratedEffect === true,
      undefined, { timeout: 4_000 });
    },
  },
  {
    name: 'pause-menu',
    path: '/?start=dungeon&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'dungeon' && window.__CODEJITSU_DUNGEON_HUD_VISUAL?.usesImagegenPanel === true,
    action: async (page) => {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() =>
        window.__CODEJITSU_PAUSED === true &&
        window.__CODEJITSU_PAUSE_MENU === 'main' &&
        window.__CODEJITSU_PAUSE_VISUAL?.usesImagegenPanel === true,
      undefined, { timeout: 4_000 });
    },
  },
  {
    name: 'pause-vows',
    path: '/?start=dungeon&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'dungeon' && window.__CODEJITSU_DUNGEON_HUD_VISUAL?.usesImagegenPanel === true,
    action: async (page) => {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'main', undefined, { timeout: 4_000 });
      await page.keyboard.press('4');
      await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'extras', undefined, { timeout: 4_000 });
      await page.keyboard.press('2');
      await page.waitForFunction(() => window.__CODEJITSU_PAUSE_MENU === 'vows', undefined, { timeout: 4_000 });
    },
  },
  {
    name: 'terminal-popup',
    path: '/?start=dungeon&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'dungeon' && window.__CODEJITSU_DUNGEON_HUD_VISUAL?.usesImagegenPanel === true,
    action: async (page) => {
      await page.keyboard.press('t');
      await page.waitForFunction(() =>
        window.__CODEJITSU_TERMINAL_OPEN === true &&
        window.__CODEJITSU_TIME_SCALE === 0.5 &&
        window.__CODEJITSU_TERMINAL_VISUAL?.usesImagegenPanel === true,
      undefined, { timeout: 4_000 });
      await page.keyboard.type('try.catch', { delay: 25 });
      await page.waitForFunction(() =>
        window.__CODEJITSU_TERMINAL_INPUT === 'try.catch' &&
        window.__CODEJITSU_TERMINAL_OPEN === true &&
        window.__CODEJITSU_TIME_SCALE === 0.5,
      undefined, { timeout: 4_000 });
    },
  },
  ...dungeonRoomRoutes,
  {
    name: 'puzzle-room',
    path: '/?start=puzzle&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'puzzle',
    action: async (page) => {
      await page.keyboard.press('t');
      await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true, undefined, { timeout: 4_000 });
    },
  },
  {
    name: 'traversal-room',
    path: '/?start=traversal&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'traversal',
  },
  {
    name: 'sage-encounter',
    path: '/?start=sage&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'sage-encounter',
  },
  {
    name: 'trap-room',
    path: '/?start=trap&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'trap',
    action: async (page) => {
      await page.keyboard.press('t');
      await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === true, undefined, { timeout: 4_000 });
      await page.keyboard.type('scan', { delay: 25 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__CODEJITSU_TERMINAL_OPEN === false, undefined, { timeout: 4_000 });
    },
  },
  {
    name: 'stealth-room',
    path: '/?start=stealth&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'stealth',
    action: async (page) => {
      await hold(page, 'd', 400);
    },
  },
  {
    name: 'miniboss-room',
    path: '/?start=miniboss&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'miniboss',
    action: async (page) => {
      await page.keyboard.press('x');
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'boss',
    path: '/?start=boss&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'boss' && window.__CODEJITSU_BOSS_MOTION?.usesImagegenMotionSmear === true,
    action: async (page) => {
      await waitForStableBossMotion(page);
      await waitForGeneratedBossAttackArt(page);
      await pressGeneratedSwing(page);
      await waitForStableBossMotion(page);
    },
  },
  {
    name: 'chapter2-story',
    path: '/?start=chapter2-story&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'chapter2-story' && window.__CODEJITSU_DIALOGUE_LAYOUT?.usesImagegenPanel === true,
    action: async (page) => {
      await page.waitForFunction(() =>
        window.__CODEJITSU_DIALOGUE_TEXT &&
        window.__CODEJITSU_DIALOGUE_REVEALED === window.__CODEJITSU_DIALOGUE_TEXT &&
        window.__CODEJITSU_LAYOUT_AUDITS?.['chapter2-dialogue']?.noOverlap === true &&
        window.__CODEJITSU_LAYOUT_AUDITS?.['chapter2-dialogue']?.noOverflow === true,
      undefined, { timeout: 6_000 });
    },
  },
  {
    name: 'chapter2-trail',
    path: '/?start=chapter2-trail&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'chapter2-trail' && window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL?.usesImagegenPanel === true,
    action: async (page) => {
      await page.waitForFunction(() => {
        const trail = window.__CODEJITSU_CHAPTER2_TRAIL;
        return Boolean(
          trail &&
          (trail.enemies ?? []).length >= 3 &&
          trail.usesRemadeMinionVariants === true &&
          Number(trail.enemyArchetypeCount ?? 0) >= 3 &&
          Number(trail.movementStyleCount ?? 0) >= 3 &&
          trail.portalBounds?.bounded === true &&
          trail.foregroundOverlay?.quiet === true &&
          trail.enemies.every((enemy) =>
            enemy.readableOnMap === true &&
            enemy.damageable === true &&
            Number(enemy.displayWidth ?? 0) >= 170 &&
            Number(enemy.displayHeight ?? 0) >= 190,
          ) &&
          window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL?.textOverlayCount >= 2 &&
          window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL?.noOverlap === true &&
          window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL?.fitsPanel === true,
        );
      }, undefined, { timeout: 4_000 });
      const firstEnemy = await page.evaluate(() => {
        const enemy = (window.__CODEJITSU_CHAPTER2_TRAIL?.enemies ?? [])
          .filter((candidate) => candidate.hp > 0)
          .sort((a, b) => a.x - b.x)[0];
        return enemy ? { x: enemy.x, y: enemy.y } : { x: 610, y: 392 };
      });
      await steerPlayerNear(page, Math.max(220, firstEnemy.x - 82), firstEnemy.y, 48);
      await pressGeneratedSwing(page);
      await page.waitForFunction(() => {
        const trail = window.__CODEJITSU_CHAPTER2_TRAIL;
        return Boolean(
          trail?.lastSwordDamage &&
          trail.lastSwordDamage.targets > 0 &&
          trail.lastSwordDamage.afterTotalHp < trail.lastSwordDamage.beforeTotalHp,
        );
      }, undefined, { timeout: 4_000 });
      await pressTerminalCommand(page, 'try.catch');
      await page.waitForFunction(() =>
        window.__CODEJITSU_LAST_ABILITY_CAST_ART?.scene === 'chapter2-trail' &&
        window.__CODEJITSU_LAST_ABILITY_CAST_ART?.usesGeneratedEffect === true &&
        window.__CODEJITSU_CHAPTER2_TRAIL?.lastTerminalDamage?.afterTotalHp < window.__CODEJITSU_CHAPTER2_TRAIL?.lastTerminalDamage?.beforeTotalHp,
      undefined, { timeout: 4_000 });
    },
  },
  {
    name: 'result-win',
    path: '/?start=result-win&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'win',
  },
  {
    name: 'result-lose',
    path: '/?start=result-lose&e2e=1',
    ready: () => window.__CODEJITSU_SCENE === 'lose',
    action: async (page) => {
      await page.mouse.click(640, 468);
      await page.waitForFunction(() => window.__CODEJITSU_SCENE === 'boss', undefined, { timeout: 8_000 });
      await page.waitForFunction(() => window.__CODEJITSU_BOSS_MOTION?.usesImagegenMotionSmear === true, undefined, { timeout: 8_000 });
      await waitForStableBossMotion(page);
    },
  },
];

function assertProof(condition, message, details = undefined) {
  if (condition) return;
  const suffix = details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`;
  throw new Error(`Visual proof validation failed: ${message}${suffix}`);
}

function validateManifest(manifest) {
  const routesByName = new Map(manifest.routes.map((route) => [route.name, route]));
  const frames = manifest.routes.flatMap((route) => route.frames);
  const animatedProofRoutes = manifest.routes.filter((route) =>
    route.name === 'title' ||
    route.name === 'story' ||
    route.name === 'tutorial' ||
    route.name === 'dungeon' ||
    route.name.startsWith('dungeon-room-') ||
    route.name === 'boss' ||
    route.name === 'chapter2-trail' ||
    route.name === 'result-lose',
  );
  const dungeonRooms = manifest.routes.filter((route) => route.name.startsWith('dungeon-room-'));
  const title = routesByName.get('title');
  const story = routesByName.get('story');
  const tutorial = routesByName.get('tutorial');
  const archiveApproach = routesByName.get('archive-approach');
  const hub = routesByName.get('hub');
  const boss = routesByName.get('boss');
  const dungeon = routesByName.get('dungeon');
  const pauseMenu = routesByName.get('pause-menu');
  const terminalPopup = routesByName.get('terminal-popup');
  const chapter2Trail = routesByName.get('chapter2-trail');
  const chapter2Story = routesByName.get('chapter2-story');
  const lose = routesByName.get('result-lose');
  const blockingRuntimeIssues = manifest.runtimeIssues.filter((issue) =>
    issue.type === 'pageerror' ||
    /setVelocity|this\.body|Uncaught TypeError|AudioContext was prevented/i.test(issue.text),
  );
  const primitiveFallbacks = manifest.routes.flatMap((route) =>
    (route.runtime.primitiveFallbacks ?? []).map((fallback) => ({
      route: route.name,
      ...fallback,
    })),
  );
  const assetInventory = manifest.generatedAssetInventory;

  assertProof(assetInventory?.generatedAssetCount >= 15, 'at least 15 project-bound generated assets are referenced', assetInventory);
  assertProof(assetInventory?.missingAssets?.length === 0, 'all generated manifest assets exist on disk', assetInventory?.missingAssets);
  assertProof(assetInventory?.staleGeneratedNames?.length === 0, 'generated asset names do not contain stale typo spellings', assetInventory?.staleGeneratedNames);
  assertProof(assetInventory?.tinyAssets?.length === 0, 'generated manifest assets are non-empty real files', assetInventory?.tinyAssets);
  assertProof(blockingRuntimeIssues.length === 0, 'no blocking browser runtime errors were captured', blockingRuntimeIssues);
  assertProof(primitiveFallbacks.length === 0, 'no active primitive visual fallback counters were captured', primitiveFallbacks);
  assertProof(manifest.routes.length === routes.length, 'all configured routes were captured', {
    expected: routes.length,
    actual: manifest.routes.length,
  });
  assertProof(frames.length === routes.length * frameCount, 'expected screenshot count was captured', {
    expected: routes.length * frameCount,
    actual: frames.length,
  });
  assertProof(
    animatedProofRoutes.every((route) => {
      const hashes = new Set((route.frames ?? []).map((frame) => frame.hash).filter(Boolean));
      return route.frames?.length === frameCount && hashes.size >= Math.min(frameCount, 2);
    }),
    'captured animation/playtest routes produce changing screenshot frames',
    animatedProofRoutes.map((route) => ({
      name: route.name,
      frames: route.frames?.length ?? 0,
      uniqueHashes: new Set((route.frames ?? []).map((frame) => frame.hash).filter(Boolean)).size,
    })),
  );
  assertProof(
    title?.runtime.titleLayout?.title === 'LEGENDS OF CODEJITSU' &&
      title.runtime.titleLayout?.titleReadable === true &&
      title.runtime.titleLayout?.visiblePromptText === true &&
      title.runtime.titleLayout?.hasCodeLeak === false &&
      title.runtime.titleLayout?.prompt === 'Click or press Enter to start' &&
      title.runtime.titleLayout?.fallAnimation?.mode === 'sky-drop' &&
      title.runtime.titleLayout?.fallAnimation?.dropOrigin === 'sky' &&
      title.runtime.titleLayout?.fallAnimation?.brandedDrop === 'single-title-stack' &&
      title.runtime.titleLayout?.fallAnimation?.complete === true &&
      title.runtime.titleLayout?.fallAnimation?.impact === true &&
      title.runtime.titleLayout?.fallAnimation?.motionTrailCount > 0 &&
      title.runtime.titleLayout?.fallAnimation?.impactCount > 0 &&
      title.runtime.titleLayout?.titleFx?.usesImagegenSkyfallFx === true &&
      title.runtime.titleLayout?.titleFx?.generatedOnlyTitleFx === true &&
      title.runtime.titleLayout?.titleFx?.primitiveSimpleShapeFallbackPieces === 0 &&
      title.runtime.titleLayout?.titleFx?.primitiveFxPieces === 0 &&
      title.runtime.titleLayout?.titleFx?.primitiveStaticDecorPieces === 0 &&
      title.runtime.titleLayout?.titleFx?.primitiveVignettePieces === 0 &&
      title.runtime.titleLayout?.titleFx?.primitiveShadowPieces === 0 &&
      title.runtime.titleLayout?.titleFx?.primitiveSkyGatePieces === 0 &&
      !/const|execute|phaser|2\.5d|2,5d/i.test([
        title.runtime.titleLayout?.title,
        ...(title.runtime.titleLayout?.titleLines ?? []),
      ].join(' ')),
    'front screen shows only Legends of Codejitsu with generated sky-drop title FX',
    title?.runtime.titleLayout,
  );
  assertProof(
    story?.runtime.dialogueStaging?.mode === 'archive' &&
      story.runtime.dialogueStaging?.archiveConfrontationClear === true &&
      story.runtime.dialogueStaging?.storyCharacterCount === 2 &&
      story.runtime.dialogueStaging?.storyCharacterIds?.join(',') === 'apprentice,null-oni' &&
      story.runtime.dialogueStaging?.primaryThreatName === 'Null Oni' &&
      story.runtime.dialogueStaging?.visibleThreatCount === 1 &&
      story.runtime.dialogueStaging?.memoryPropCount === 0 &&
      story.runtime.dialogueStaging?.strayArchiveActorCount === 0 &&
      story.runtime.dialogueStaging?.facingReadable === true &&
      story.runtime.dialogueStaging?.noActorOverlap === true &&
      story.runtime.dialogueBackdrop?.textureKey === 'archive-memory' &&
      story.runtime.dialogueBackdrop?.usesGeneratedBackground === true &&
      story.runtime.dialogueBackdrop?.usesGeneratedAtmosphereOverlay === true &&
      story.runtime.dialogueBackdrop?.primitiveShadePieces === 0 &&
      story.runtime.dialogueBackdrop?.archiveOmenDemoted === true &&
      story.runtime.dialogueLayout?.noOverlap === true &&
      story.runtime.dialogueLayout?.noOverflow === true &&
      Number(story.runtime.dialogueLayout?.bodyX ?? 0) >= 400 &&
      Number(story.runtime.dialogueLayout?.bodyWrapWidth ?? 999) <= 600 &&
      story.runtime.dialogueLayout?.panelAspectLocked === true &&
      story.runtime.dialogueLayout?.portraitClearOfText === true &&
      story.runtime.dialogueLayout?.portraitAspectLocked === true &&
      Number(story.runtime.dialogueLayout?.portraitDisplayWidth ?? 0) >= 132 &&
      Number(story.runtime.dialogueLayout?.portraitDisplayWidth ?? 999) <= 140 &&
      Number(story.runtime.dialogueLayout?.portraitDisplayHeight ?? 0) >= 132 &&
      Number(story.runtime.dialogueLayout?.portraitDisplayHeight ?? 999) <= 140 &&
      story.runtime.layoutAudits?.dialogue?.noOverlap === true &&
      story.runtime.layoutAudits?.dialogue?.noOverflow === true,
    'first story scene clearly stages Apprentice versus Null Oni with generated backdrop treatment',
    {
      staging: story?.runtime.dialogueStaging,
      backdrop: story?.runtime.dialogueBackdrop,
      actors: story?.runtime.dialogueActors,
      dialogueLayout: story?.runtime.dialogueLayout,
      layoutAudit: story?.runtime.layoutAudits?.dialogue,
    },
  );
  assertProof(
    chapter2Story?.runtime.scene === 'chapter2-story' &&
      chapter2Story.runtime.dialogueText &&
      chapter2Story.runtime.dialogueRevealed === chapter2Story.runtime.dialogueText &&
      chapter2Story.runtime.dialogueLayout?.noOverlap === true &&
      chapter2Story.runtime.dialogueLayout?.noOverflow === true &&
      Number(chapter2Story.runtime.dialogueLayout?.bodyX ?? 0) >= 400 &&
      Number(chapter2Story.runtime.dialogueLayout?.bodyWrapWidth ?? 999) <= 600 &&
      chapter2Story.runtime.dialogueLayout?.panelAspectLocked === true &&
      chapter2Story.runtime.dialogueLayout?.portraitClearOfText === true &&
      chapter2Story.runtime.dialogueLayout?.portraitAspectLocked === true &&
      Number(chapter2Story.runtime.dialogueLayout?.portraitDisplayWidth ?? 0) >= 132 &&
      Number(chapter2Story.runtime.dialogueLayout?.portraitDisplayWidth ?? 999) <= 140 &&
      Number(chapter2Story.runtime.dialogueLayout?.portraitDisplayHeight ?? 0) >= 132 &&
      Number(chapter2Story.runtime.dialogueLayout?.portraitDisplayHeight ?? 999) <= 140 &&
      chapter2Story.runtime.layoutAudits?.['chapter2-dialogue']?.noOverlap === true &&
      chapter2Story.runtime.layoutAudits?.['chapter2-dialogue']?.noOverflow === true,
    'Chapter 2 story dialogue is fully revealed and fits the generated dialogue panel',
    {
      dialogueText: chapter2Story?.runtime.dialogueText,
      dialogueLayout: chapter2Story?.runtime.dialogueLayout,
      layoutAudit: chapter2Story?.runtime.layoutAudits?.['chapter2-dialogue'],
    },
  );
  assertProof(
    tutorial?.runtime.tutorialPanel?.usesImagegenPanel === true &&
      tutorial.runtime.tutorialPanel?.usesImagegenHintStrip === true &&
      tutorial.runtime.tutorialPanel?.primitivePanelPieces === 0 &&
      tutorial.runtime.tutorialPanel?.primitiveHintPieces === 0 &&
      tutorial.runtime.tutorialPanel?.noOverlap === true &&
      tutorial.runtime.tutorialPanel?.fitsPanel === true &&
      tutorial.runtime.tutorialPanel?.panelAvoidsPlayfield === true &&
      tutorial.runtime.tutorialPanel?.compactCopy === true &&
      tutorial.runtime.tutorialPanel?.microDocked === true &&
      Number(tutorial.runtime.tutorialPanel?.panel?.width ?? 0) >= 540 &&
      Number(tutorial.runtime.tutorialPanel?.panel?.height ?? 999) <= 116 &&
      Number(tutorial.runtime.tutorialPanel?.instruction?.height ?? 0) > 12 &&
      tutorial.runtime.tutorialFlow?.stepCount >= 5 &&
      tutorial.runtime.tutorialFlow?.controls?.includes('WASD') &&
      tutorial.runtime.tutorialFlow?.controls?.includes('X') &&
      tutorial.runtime.tutorialFlow?.controls?.includes('T') &&
      tutorial.runtime.tutorialFlow?.codeLinesExplained?.length >= 4 &&
      tutorial.runtime.tutorialFlow?.codeLinesExplained?.some((line) => /try\.catch.*counter oath/i.test(line)),
    'tutorial HUD uses generated readable art, teaches movement/X/terminal, explains try.catch, and has no overlap',
    {
      tutorialPanel: tutorial?.runtime.tutorialPanel,
      tutorialFlow: tutorial?.runtime.tutorialFlow,
    },
  );
  assertProof(
    archiveApproach?.runtime.archiveGate?.usesImagegenGate === true &&
      archiveApproach.runtime.archiveGate?.primitiveGatePieces === 0 &&
      archiveApproach.runtime.archiveGate?.singleGatePresentation === true &&
      archiveApproach.runtime.archiveGate?.noExtraGateOverlay === true &&
      archiveApproach.runtime.archiveGate?.labelVisible === false &&
      archiveApproach.runtime.archiveGate?.debugMapCopyVisible === false &&
      archiveApproach.runtime.archiveGate?.roomTitleVisible === false &&
      archiveApproach.runtime.archiveHud?.usesImagegenPanel === true &&
      archiveApproach.runtime.archiveHud?.usesImagegenArchiveCue === true &&
      archiveApproach.runtime.archiveHud?.primitivePanelPieces === 0 &&
      archiveApproach.runtime.archiveHud?.primitiveCuePieces === 0 &&
      archiveApproach.runtime.archiveHud?.compactCopy === true &&
      archiveApproach.runtime.archiveHud?.wordCount === 0 &&
      archiveApproach.runtime.archiveHud?.textOverlayCount === 0 &&
      archiveApproach.runtime.archiveBackdrop?.usesImagegenApproachOverlay === true &&
      archiveApproach.runtime.archiveBackdrop?.primitiveBackdropShadePieces === 0 &&
      archiveApproach.runtime.archiveBackdrop?.noExtraGateOverlay === true &&
      archiveApproach.runtime.archivePath?.usesImagegenSeamVfx === true &&
      archiveApproach.runtime.archivePath?.textArrowCount === 0 &&
      !/new map|chapter|map|gate 2|2 gates/i.test([
        archiveApproach.runtime.archiveHud?.objectiveCopy,
        archiveApproach.runtime.routeProgress?.currentArea,
      ].filter(Boolean).join(' ')),
    'archive approach uses one generated gate with no visible map/debug text clutter',
    {
      gate: archiveApproach?.runtime.archiveGate,
      hud: archiveApproach?.runtime.archiveHud,
      backdrop: archiveApproach?.runtime.archiveBackdrop,
      path: archiveApproach?.runtime.archivePath,
      routeProgress: archiveApproach?.runtime.routeProgress,
    },
  );
  assertProof(
    hub?.runtime.hubBackdrop?.textureKey === 'broken-dojo' &&
      hub.runtime.hubBackdrop?.usesImagegenAtmosphere === true &&
      hub.runtime.hubBackdrop?.primitiveBackdropShadePieces === 0 &&
      hub.runtime.hubBackdrop?.noExtraGateOverlay === true &&
      hub.runtime.hubGate?.usesImagegenGate === true &&
      hub.runtime.hubGate?.primitiveGatePieces === 0 &&
      hub.runtime.hubGate?.binaryDigitLabels === 0 &&
      hub.runtime.hubHud?.usesImagegenPanel === true &&
      hub.runtime.hubHud?.usesImagegenHubCue === true &&
      hub.runtime.hubHud?.primitivePanelPieces === 0 &&
      hub.runtime.hubHud?.primitiveCuePieces === 0 &&
      hub.runtime.hubHud?.compactCopy === true &&
      Number(hub.runtime.hubHud?.textOverlayCount ?? 99) <= 1 &&
      hub.runtime.hubHud?.titleVisible === false &&
      !/new map|chapter|map|gate 2|2 gates/i.test(String(hub.runtime.hubHud?.objectiveCopy ?? '')),
    'hub uses generated dojo art, one generated gate, and compact non-map copy',
    {
      backdrop: hub?.runtime.hubBackdrop,
      gate: hub?.runtime.hubGate,
      hud: hub?.runtime.hubHud,
    },
  );
  {
    const sceneBackdrops = [
      story?.runtime.dialogueBackdrop?.textureKey,
      tutorial?.runtime.tutorialBackdrop?.textureKey,
      archiveApproach?.runtime.archiveBackdrop?.textureKey,
      hub?.runtime.hubBackdrop?.textureKey,
      dungeon?.runtime.dungeonRoom?.textureKey,
      boss?.runtime.bossBackdrop?.textureKey,
      routesByName.get('chapter2-trail')?.runtime.chapter2Trail?.stageBackdropKey,
    ].filter(Boolean);
    assertProof(
      sceneBackdrops.length >= 7 && new Set(sceneBackdrops).size >= 6,
      'main story/playable scenes use distinct generated backdrop keys',
      sceneBackdrops,
    );
  }
  assertProof(dungeonRooms.length === chapterOneDungeonRoomCount, 'all Chapter 1 dungeon rooms were captured', {
    expected: chapterOneDungeonRoomCount,
    actual: dungeonRooms.length,
  });
  assertProof(
    dungeonRooms.every((route, index) => route.runtime.dungeonRoom?.roomIndex === index),
    'dungeon room indexes are consecutive and accurate',
    dungeonRooms.map((route) => ({ name: route.name, roomIndex: route.runtime.dungeonRoom?.roomIndex })),
  );
  assertProof(
    new Set(dungeonRooms.map((route) => route.runtime.dungeonRoom?.roomId)).size === chapterOneDungeonRoomCount,
    'dungeon room ids are unique',
    dungeonRooms.map((route) => route.runtime.dungeonRoom?.roomId),
  );
  assertProof(
    new Set(dungeonRooms.map((route) => {
      const visual = route.runtime.dungeonRoom;
      return `${visual?.textureKey ?? 'missing'}:${visual?.cropIndex ?? -1}`;
    })).size === chapterOneDungeonRoomCount,
    'dungeon room visual identities are unique by generated texture and crop',
    dungeonRooms.map((route) => ({
      name: route.name,
      roomId: route.runtime.dungeonRoom?.roomId,
      textureKey: route.runtime.dungeonRoom?.textureKey,
      cropIndex: route.runtime.dungeonRoom?.cropIndex,
    })),
  );
  assertProof(
    (() => {
      const enemies = (dungeon?.runtime.enemyBounds ?? []).filter((enemy) => enemy.scene === 'dungeon' && enemy.hp > 0);
      return enemies.length >= 2 && enemies.every((enemy) =>
        enemy.id?.startsWith('sentinel-') &&
        enemy.displayName === 'Binary Sentinel' &&
        enemy.speciesId === 'binary-sentinel' &&
        enemy.usesImagegenCombatSheet === true &&
        enemy.cleanIdentity === true &&
        !/straw|sential|sentinal/i.test([
          enemy.id,
          enemy.displayName,
          enemy.speciesId,
          enemy.renderVariant,
        ].filter(Boolean).join(' ')) &&
        enemy.bodyAlive === true &&
        enemy.visualGrounded === true &&
        Number(enemy.visualScale ?? 0) > 0.9 &&
        enemy.noOverlap === true &&
        Number(enemy.distanceToPlayer ?? 0) > 90 &&
        Number(enemy.frameCount ?? 0) > 1 &&
        typeof enemy.motionProfile === 'string' &&
        enemy.motionProfile.length > 0
      );
    })(),
    'dungeon enemies are clean Binary Sentinels with generated combat sheets and grounded animation',
    dungeon?.runtime.enemyBounds,
  );
  assertProof(
    ['hero', 'mentor', 'sentinel', 'oni'].every((kind) => {
      const entry = (dungeon?.runtime.animationCatalog ?? []).find((candidate) => candidate.kind === kind);
      if (!entry || entry.usesGeneratedTexture !== true || entry.allRequiredPresent !== true) return false;
      if (Number(entry.requiredPoseCount ?? 0) < 7 || Number(entry.animatedPoseCount ?? 0) < 5) return false;
      return (entry.poses ?? [])
        .filter((pose) => pose.requiredAnimated)
        .every((pose) =>
          pose.present === true &&
          pose.animated === true &&
          Number(pose.frameCount ?? 0) > 1 &&
          typeof pose.renderVariant === 'string' &&
          pose.renderVariant.length > 0 &&
          typeof pose.motionProfile === 'string' &&
          pose.motionProfile.length > 0,
        );
    }),
    'Chapter 1 active characters use generated multi-frame animation sheets',
    dungeon?.runtime.animationCatalog,
  );
  assertProof(
    (dungeon?.runtime.assetAudit ?? []).length >= 6 &&
      dungeon.runtime.assetAudit.every((entry) =>
        Number(entry.padding ?? 0) >= 14 &&
        Number(entry.border ?? 0) >= 4 &&
        Number(entry.alphaErrors ?? 99) === 0,
      ),
    'generated character frames have clean alpha padding and borders',
    dungeon?.runtime.assetAudit,
  );
  assertProof(
    dungeonRooms.every((route) =>
      route.runtime.dungeonRoom?.usesGeneratedRoomBackdrop === true &&
      route.runtime.dungeonRoom?.usesImagegenAtmosphereOverlay === true &&
      route.runtime.dungeonRoom?.primitiveBackdropShadePieces === 0 &&
      route.runtime.dungeonRoom?.roomNameHidden === true &&
      route.runtime.dungeonRoom?.roomTitleVisible === false &&
      route.runtime.dungeonRoom?.mapProgressCopyVisible === false &&
      route.runtime.dungeonRoom?.textureKey !== 'dungeon-gate'),
    'every dungeon room uses generated art and hides internal/debug labels',
    dungeonRooms.map((route) => ({ name: route.name, visual: route.runtime.dungeonRoom })),
  );
  assertProof(
    manifest.routes
      .filter((route) => route.name === 'tutorial' || route.name === 'dungeon' || route.name.startsWith('dungeon-room-') || route.name === 'boss' || route.name === 'chapter2-trail')
      .every((route) => route.runtime.swordSwing?.usesImagegenVfx === true && route.runtime.swordSwing?.primitivePieces === 0),
    'all captured swing routes use generated sword VFX',
    manifest.routes.map((route) => ({ name: route.name, swordSwing: route.runtime.swordSwing })),
  );
  assertProof(
    ['dungeon', 'chapter2-trail'].every((name) => {
      const route = routesByName.get(name);
      return route?.runtime.lastAbilityCast?.usesGeneratedEffect === true &&
        route.runtime.lastAbilityCast?.abilityId === 'try-catch' &&
        Number(route.runtime.lastAbilityDamage?.targets ?? 0) > 0;
    }),
    'terminal try.catch casts use generated effects and damage targets',
    ['dungeon', 'chapter2-trail'].map((name) => ({ name, runtime: routesByName.get(name)?.runtime })),
  );
  assertProof(
    chapter2Trail?.runtime.chapter2Trail?.usesImagegenWarriors === true &&
      Number(chapter2Trail.runtime.chapter2Trail?.chapterTwoPlaytime?.chapterTwoPlayableMinutes ?? 0) >= 15 &&
      (chapter2Trail.runtime.chapter2Trail?.enemies ?? []).filter((enemy) => enemy.hp > 0).length >= 2 &&
      chapter2Trail.runtime.chapter2Trail?.totalStages >= 5 &&
      chapter2Trail.runtime.chapter2TrailHud?.textOverlayCount >= 2 &&
      chapter2Trail.runtime.chapter2TrailHud?.noOverlap === true &&
      chapter2Trail.runtime.chapter2TrailHud?.fitsPanel === true &&
      chapter2Trail.runtime.chapter2Trail.enemies.filter((enemy) => enemy.hp > 0).every((enemy) =>
        enemy.readableOnMap === true &&
        enemy.damageable === true &&
        enemy.bodyAlive === true &&
        enemy.noOverlap === true &&
        Number(enemy.displayWidth ?? 0) >= 170 &&
        Number(enemy.displayHeight ?? 0) >= 190 &&
        Number(enemy.bodyWidth ?? 0) >= 60 &&
        Number(enemy.bodyHeight ?? 0) >= 54 &&
        Number(enemy.frameCount ?? 0) > 1 &&
        String(enemy.renderVariant ?? '').includes('imagegen') &&
        typeof enemy.motionProfile === 'string' &&
        enemy.motionProfile.length > 0,
      ) &&
      chapter2Trail.runtime.chapter2Trail.lastSwordDamage?.targets > 0 &&
      chapter2Trail.runtime.chapter2Trail.lastSwordDamage.afterTotalHp < chapter2Trail.runtime.chapter2Trail.lastSwordDamage.beforeTotalHp &&
      chapter2Trail.runtime.chapter2Trail.lastTerminalDamage?.targets > 0 &&
      chapter2Trail.runtime.chapter2Trail.lastTerminalDamage.afterTotalHp < chapter2Trail.runtime.chapter2Trail.lastTerminalDamage.beforeTotalHp,
    'Chapter 2 warriors are large, generated, separated, damageable by X and terminal, and Chapter 2 proves 15 playable minutes',
    chapter2Trail?.runtime.chapter2Trail,
  );
  assertProof(
    pauseMenu?.runtime.paused === true &&
      pauseMenu.runtime.pauseMenu === 'main' &&
      pauseMenu.runtime.pauseVisual?.scene === 'DungeonScene' &&
      pauseMenu.runtime.pauseVisual?.usesImagegenPanel === true &&
      Number(pauseMenu.runtime.pauseVisual?.primitivePanelPieces ?? 99) === 0 &&
      pauseMenu.runtime.pauseVisual?.title === 'Pause' &&
      pauseMenu.runtime.pauseVisual?.noOverflow === true &&
      pauseMenu.runtime.pauseVisual?.noOverlap === true &&
      Number(pauseMenu.runtime.pauseVisual?.rowCount ?? 0) === 5 &&
      ['Resume', 'Save Game', 'Settings', 'Extras', 'Exit to Title'].every((label) =>
        (pauseMenu.runtime.pauseVisual?.rowLabels ?? []).includes(label),
      ) &&
      pauseMenu.runtime.layoutAudits?.['pause-menu']?.noOverflow === true &&
      pauseMenu.runtime.layoutAudits?.['pause-menu']?.noOverlap === true,
    'Escape pause menu uses generated panel, required options, and clean layout',
    {
      paused: pauseMenu?.runtime.paused,
      menu: pauseMenu?.runtime.pauseMenu,
      visual: pauseMenu?.runtime.pauseVisual,
      layout: pauseMenu?.runtime.layoutAudits?.['pause-menu'],
    },
  );
  assertProof(
    terminalPopup?.runtime.terminalOpen === true &&
      terminalPopup.runtime.timeScale === 0.5 &&
      terminalPopup.runtime.terminalInput === 'try.catch' &&
      terminalPopup.runtime.terminalVisual?.scene === 'DungeonScene' &&
      terminalPopup.runtime.terminalVisual?.usesImagegenPanel === true &&
      Number(terminalPopup.runtime.terminalVisual?.primitivePanelPieces ?? 99) === 0 &&
      terminalPopup.runtime.terminalVisual?.compactHelperCopy === true &&
      Number(terminalPopup.runtime.terminalVisual?.panelWidth ?? 999) <= 860 &&
      Number(terminalPopup.runtime.terminalVisual?.panelHeight ?? 999) <= 410 &&
      (terminalPopup.runtime.terminalCommandCards ?? []).length >= 5 &&
      (terminalPopup.runtime.terminalCommandCards ?? []).some((card) =>
        card.command === 'try.catch' &&
        card.abilityId === 'try-catch' &&
        card.usesGeneratedIcon === true,
      ) &&
      (terminalPopup.runtime.terminalCommandCards ?? []).every((card) => card.usesGeneratedIcon === true) &&
      /try\.catch/.test(String(terminalPopup.runtime.terminalPreview ?? '')) &&
      /\benergy\b/.test(String(terminalPopup.runtime.terminalPreview ?? '')) &&
      terminalPopup.runtime.layoutAudits?.terminal?.noOverflow === true &&
      terminalPopup.runtime.layoutAudits?.terminal?.noOverlap === true,
    'T terminal popup uses generated panel/icons, 0.5x slow time, full try.catch input, and clean layout',
    {
      terminalOpen: terminalPopup?.runtime.terminalOpen,
      timeScale: terminalPopup?.runtime.timeScale,
      input: terminalPopup?.runtime.terminalInput,
      visual: terminalPopup?.runtime.terminalVisual,
      cards: terminalPopup?.runtime.terminalCommandCards,
      preview: terminalPopup?.runtime.terminalPreview,
      layout: terminalPopup?.runtime.layoutAudits?.terminal,
    },
  );
  assertProof(
    boss?.runtime.bossMotion?.scene === 'boss' &&
      boss.runtime.bossMotion?.id === 'null-oni' &&
      boss.runtime.bossMotion?.snapFree === true &&
      boss.runtime.bossMotion?.cappedSeparation === true &&
      boss.runtime.bossMotion?.noHardStop === true &&
      boss.runtime.bossMotion?.glideDamping === true &&
      boss.runtime.bossMotion?.velocityUsesFrameDelta === true &&
      boss.runtime.bossMotion?.visualGrounded === true &&
      boss.runtime.bossMotion?.usesImagegenAura === true &&
      boss.runtime.bossMotion?.usesImagegenMotionSmear === true &&
      boss.runtime.bossMotion?.usesImagegenShadowstep === true &&
      boss.runtime.bossMotion?.usesImagegenTrail === true &&
      Number(boss.runtime.bossMotion?.motionSmearFrameCount ?? 0) === 6 &&
      Number(boss.runtime.bossMotion?.motionSmearFrameWidth ?? 0) > 300 &&
      Number(boss.runtime.bossMotion?.motionSmearFrameHeight ?? 0) > 600 &&
      Number(boss.runtime.bossMotion?.generatedAfterimages ?? 0) > 0 &&
      Number(boss.runtime.bossMotion?.primitiveAfterimages ?? 999) === 0 &&
      Number(boss.runtime.bossMotion?.maxFrameStep ?? 999) <= 26 &&
      Number(boss.runtime.bossMotion?.frameCount ?? 0) > 1 &&
      typeof boss.runtime.bossMotion?.renderVariant === 'string' &&
      boss.runtime.bossMotion.renderVariant.length > 0 &&
      typeof boss.runtime.bossMotion?.motionProfile === 'string' &&
      boss.runtime.bossMotion.motionProfile.length > 0,
    'Null Oni boss movement uses generated animation assets without snapping or primitive afterimages',
    boss?.runtime.bossMotion,
  );
  assertProof(
    (() => {
      const history = boss?.runtime.bossAttackHistory ?? [];
      const uniqueAttackIds = new Set(history.map((entry) => entry.attack).filter(Boolean));
      return history.length >= 3 &&
        uniqueAttackIds.size >= 3 &&
        history.every((entry) =>
          entry.phase >= 1 &&
          Number(entry.threatLevel ?? 0) >= 2 &&
          typeof entry.castLine === 'string' &&
          /^[a-z]+(?:\.[a-z]+)+\(\)$/.test(entry.castLine) &&
          typeof entry.phaseRole === 'string' &&
          entry.phaseRole.length >= 8 &&
          typeof entry.movementTell === 'string' &&
          entry.movementTell.length >= 30 &&
          typeof entry.bossMotion === 'string' &&
          entry.bossMotion.length >= 24 &&
          typeof entry.counterStyle === 'string' &&
          entry.counterStyle.length >= 20 &&
          Array.isArray(entry.dangerLayers) &&
          entry.dangerLayers.length >= 3 &&
          typeof entry.counterRhythm === 'string' &&
          entry.counterRhythm.length >= 20 &&
          typeof entry.commandHint === 'string' &&
          entry.commandHint.length >= 16,
        );
    })() &&
      (boss.runtime.generatedTelegraphs ?? []).some((entry) =>
        entry.scene === 'boss' &&
        entry.textureKey === 'boss-telegraph-sigils' &&
        entry.generated === true &&
        Number(entry.width ?? 0) >= 90 &&
        Number(entry.height ?? 0) >= 90 &&
        Number(entry.alpha ?? 0) > 0.4,
      ) &&
      (boss.runtime.bossImpactVfx ?? []).some((effect) =>
        effect.scene === 'boss' &&
        effect.generated === true &&
        effect.textureKey === 'boss-impact-vfx' &&
        Number(effect.width ?? 0) >= 120 &&
        Number(effect.height ?? 0) >= 70,
      ) &&
      boss.runtime.bossWarning?.usesGeneratedTelegraphs === true &&
      boss.runtime.bossWarning?.usesImagegenWarningLanes === true &&
      Number(boss.runtime.bossWarning?.generatedWarningLaneOverlayCount ?? 0) > 0 &&
      boss.runtime.bossWarning?.warningLaneTextureKey === 'boss-warning-lanes' &&
      Number(boss.runtime.bossWarning?.generatedWarningCount ?? 0) > 0 &&
      Number(boss.runtime.bossWarning?.visiblePrimitiveWarningCount ?? 99) === 0 &&
      boss.runtime.bossWarning?.collisionShapesHidden === true &&
      boss.runtime.bossWarning?.generatedArtOnly === true &&
      boss.runtime.bossTelegraph?.usesImagegenBanner === true &&
      boss.runtime.bossTelegraph?.usesImagegenAttackCue === true &&
      boss.runtime.bossTelegraph?.usesImagegenThreatPips === true &&
      Number(boss.runtime.bossTelegraph?.primitiveBannerPieces ?? 99) === 0 &&
      Number(boss.runtime.bossTelegraph?.primitiveAttackCuePieces ?? 99) === 0 &&
      Number(boss.runtime.bossTelegraph?.primitiveThreatPips ?? 99) === 0 &&
      Number(boss.runtime.bossTelegraph?.visibleTextLabels ?? 99) === 0 &&
      typeof boss.runtime.bossTelegraph?.movementTell === 'string' &&
      boss.runtime.bossTelegraph.movementTell.length > 20 &&
      typeof boss.runtime.bossTelegraph?.commandHint === 'string' &&
      boss.runtime.bossTelegraph.commandHint.length > 16 &&
      boss.runtime.bossAttackBanner?.usesImagegenBanner === true &&
      boss.runtime.bossAttackBanner?.usesImagegenAttackCue === true &&
      boss.runtime.bossAttackBanner?.usesImagegenThreatPips === true &&
      Number(boss.runtime.bossAttackBanner?.primitiveBannerPieces ?? 99) === 0 &&
      Number(boss.runtime.bossAttackBanner?.primitiveAttackCuePieces ?? 99) === 0 &&
      Number(boss.runtime.bossAttackBanner?.primitiveThreatPips ?? 99) === 0 &&
      Number(boss.runtime.bossAttackBanner?.textLineCount ?? 99) === 0,
    'Null Oni attacks use varied detailed command patterns plus generated telegraphs, warning lanes, banners, and impact VFX with no primitive labels',
    {
      telegraph: boss?.runtime.bossTelegraph,
      warning: boss?.runtime.bossWarning,
      banner: boss?.runtime.bossAttackBanner,
      history: boss?.runtime.bossAttackHistory,
      generatedTelegraphs: boss?.runtime.generatedTelegraphs,
      impactVfx: boss?.runtime.bossImpactVfx,
    },
  );
  assertProof(
    Number(dungeon?.runtime.chapterOnePlaytime?.chapterOnePlayableMinutes ?? 0) >= 15 &&
      Number(dungeon?.runtime.chapterOnePlaytime?.actualRoomCount ?? 0) === chapterOneDungeonRoomCount,
    'Chapter 1 runtime proves at least 15 playable minutes and all dungeon rooms',
    dungeon?.runtime.chapterOnePlaytime,
  );
  assertProof(
    lose?.runtime.scene === 'boss' &&
      lose.runtime.bossMotionReady === true &&
      lose.runtime.bossMotion?.usesImagegenMotionSmear === true &&
      Number(lose.runtime.bossMotion?.primitiveAfterimages ?? 999) === 0,
    'death retry returns to a ready boss scene',
    lose?.runtime,
  );

  return {
    routes: manifest.routes.length,
    frames: frames.length,
    animatedRoutesWithChangingFrames: animatedProofRoutes.filter((route) =>
      new Set((route.frames ?? []).map((frame) => frame.hash).filter(Boolean)).size >= Math.min(frameCount, 2),
    ).length,
    runtimeIssues: manifest.runtimeIssues.length,
    primitiveFallbacks: primitiveFallbacks.length,
    generatedAssets: assetInventory.generatedAssetCount,
    dungeonRooms: dungeonRooms.length,
    uniqueDungeonVisuals: new Set(dungeonRooms.map((route) => {
      const visual = route.runtime.dungeonRoom;
      return `${visual?.textureKey ?? 'missing'}:${visual?.cropIndex ?? -1}`;
    })).size,
    binarySentinels: (dungeon?.runtime.enemyBounds ?? []).filter((enemy) => enemy.scene === 'dungeon' && enemy.displayName === 'Binary Sentinel').length,
    cleanSentinelIdentity: (dungeon?.runtime.enemyBounds ?? []).filter((enemy) => enemy.scene === 'dungeon').every((enemy) => enemy.cleanIdentity === true),
    generatedAnimationKinds: (dungeon?.runtime.animationCatalog ?? []).filter((entry) => entry.usesGeneratedTexture === true && entry.allRequiredPresent === true).length,
    generatedSwingRoutes: manifest.routes.filter((route) => route.runtime.swordSwing?.usesImagegenVfx === true && route.runtime.swordSwing?.primitivePieces === 0).length,
    pauseMenuOptions: pauseMenu?.runtime.pauseVisual?.rowLabels,
    pauseMenuGenerated: pauseMenu?.runtime.pauseVisual?.usesImagegenPanel === true,
    terminalPopupInput: terminalPopup?.runtime.terminalInput,
    terminalPopupTimeScale: terminalPopup?.runtime.timeScale,
    terminalPopupGenerated: terminalPopup?.runtime.terminalVisual?.usesImagegenPanel === true,
    titleSkyDrop: title?.runtime.titleLayout?.fallAnimation?.complete === true && title?.runtime.titleLayout?.title === 'LEGENDS OF CODEJITSU',
    storyArchiveConfrontationClear: story?.runtime.dialogueStaging?.archiveConfrontationClear === true,
    storyBackdropGenerated: story?.runtime.dialogueBackdrop?.usesGeneratedAtmosphereOverlay === true && story?.runtime.dialogueBackdrop?.primitiveShadePieces === 0,
    tutorialHudNoOverlap: tutorial?.runtime.tutorialPanel?.noOverlap === true,
    tutorialHudReadable: Number(tutorial?.runtime.tutorialPanel?.instruction?.height ?? 0) > 12,
    tutorialLessonCount: tutorial?.runtime.tutorialFlow?.codeLinesExplained?.length,
    archiveSingleGate: archiveApproach?.runtime.archiveGate?.singleGatePresentation === true,
    archiveTextOverlays: archiveApproach?.runtime.archiveHud?.textOverlayCount,
    hubGeneratedGate: hub?.runtime.hubGate?.usesImagegenGate === true && hub?.runtime.hubGate?.primitiveGatePieces === 0,
    hubTextOverlays: hub?.runtime.hubHud?.textOverlayCount,
    distinctMainBackdrops: new Set([
      story?.runtime.dialogueBackdrop?.textureKey,
      tutorial?.runtime.tutorialBackdrop?.textureKey,
      archiveApproach?.runtime.archiveBackdrop?.textureKey,
      hub?.runtime.hubBackdrop?.textureKey,
      dungeon?.runtime.dungeonRoom?.textureKey,
      boss?.runtime.bossBackdrop?.textureKey,
      routesByName.get('chapter2-trail')?.runtime.chapter2Trail?.stageBackdropKey,
    ].filter(Boolean)).size,
    bossMotionSmear: boss?.runtime.bossMotion?.usesImagegenMotionSmear === true,
    bossPrimitiveAfterimages: boss?.runtime.bossMotion?.primitiveAfterimages,
    bossGeneratedAttackArt: boss?.runtime.bossWarning?.generatedArtOnly === true && boss?.runtime.bossAttackBanner?.textLineCount === 0,
    bossUniqueAttacks: new Set((boss?.runtime.bossAttackHistory ?? []).map((entry) => entry.attack).filter(Boolean)).size,
    bossImpactVfx: (boss?.runtime.bossImpactVfx ?? []).filter((effect) => effect.scene === 'boss' && effect.generated === true).length,
    chapterOnePlayableMinutes: dungeon?.runtime.chapterOnePlaytime?.chapterOnePlayableMinutes,
    chapterTwoPlayableMinutes: chapter2Trail?.runtime.chapter2Trail?.chapterTwoPlaytime?.chapterTwoPlayableMinutes,
    chapter2HudTextOverlays: chapter2Trail?.runtime.chapter2TrailHud?.textOverlayCount,
    retryReturnedToBoss: lose?.runtime.scene === 'boss',
  };
}

async function main() {
  if (!Number.isFinite(frameCount) || frameCount < 1) {
    throw new Error(`Invalid CODEJITSU_PROOF_FRAMES value: ${process.env.CODEJITSU_PROOF_FRAMES}`);
  }
  if (!Number.isFinite(frameDelayMs) || frameDelayMs < 0) {
    throw new Error(`Invalid CODEJITSU_PROOF_DELAY_MS value: ${process.env.CODEJITSU_PROOF_DELAY_MS}`);
  }

  const ownedServer = await ensureDevServer();
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const manifest = {
    baseUrl,
    outputDir,
    capturedAt: new Date().toISOString(),
    frameCount,
    frameDelayMs,
    generatedAssetInventory: await collectGeneratedAssetInventory(),
    runtimeIssues: [],
    routes: [],
  };
  page.on('console', (message) => {
    const text = message.text();
    if ((message.type() === 'error' || message.type() === 'warning') && relevantRuntimeIssue(text)) {
      manifest.runtimeIssues.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => {
    manifest.runtimeIssues.push({ type: 'pageerror', text: error.stack ?? error.message });
  });

  try {
    for (const route of routes) {
      const url = `${baseUrl}${route.path}`;
      console.log(`Capturing ${route.name} from ${url}`);
      await page.goto(url);
      try {
        await page.waitForFunction(route.ready, route.readyArg, { timeout: 15_000 });
      } catch (error) {
        const runtime = await page.evaluate(() => ({
          scene: window.__CODEJITSU_SCENE,
          tutorialPanel: window.__CODEJITSU_TUTORIAL_PANEL_LAYOUT,
          dungeonHud: window.__CODEJITSU_DUNGEON_HUD_VISUAL,
          dungeonRoom: window.__CODEJITSU_DUNGEON_ROOM_VISUAL,
          bossMotion: window.__CODEJITSU_BOSS_MOTION,
          chapter2TrailHud: window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL,
        }));
        throw new Error(`Timed out waiting for route "${route.name}": ${JSON.stringify(runtime)}`, { cause: error });
      }
      if (route.action) {
        await route.action(page);
      }
      const runtime = await page.evaluate(() => ({
        scene: window.__CODEJITSU_SCENE,
        titleLayout: window.__CODEJITSU_TITLE_LAYOUT,
        dialogueText: window.__CODEJITSU_DIALOGUE_TEXT,
        dialogueRevealed: window.__CODEJITSU_DIALOGUE_REVEALED,
        dialogueBackdrop: window.__CODEJITSU_DIALOGUE_BACKDROP,
        dialogueLayout: window.__CODEJITSU_DIALOGUE_LAYOUT,
        dialogueStaging: window.__CODEJITSU_DIALOGUE_STAGING,
        dialogueActors: window.__CODEJITSU_DIALOGUE_ACTORS,
        tutorialBackdrop: window.__CODEJITSU_TUTORIAL_BACKDROP,
        titleReady: window.__CODEJITSU_TITLE_LAYOUT?.fallAnimation?.complete === true,
        tutorialPanel: window.__CODEJITSU_TUTORIAL_PANEL_LAYOUT,
        tutorialFlow: window.__CODEJITSU_TUTORIAL_FLOW,
        tutorialPanelReady: window.__CODEJITSU_TUTORIAL_PANEL_LAYOUT?.microDocked === true,
        archiveGate: window.__CODEJITSU_ARCHIVE_GATE_VISUAL,
        archiveHud: window.__CODEJITSU_ARCHIVE_HUD_VISUAL,
        archiveBackdrop: window.__CODEJITSU_ARCHIVE_BACKDROP,
        archivePath: window.__CODEJITSU_ARCHIVE_PATH_VISUAL,
        hubGate: window.__CODEJITSU_HUB_GATE_VISUAL,
        hubHud: window.__CODEJITSU_HUB_HUD_VISUAL,
        hubBackdrop: window.__CODEJITSU_HUB_BACKDROP,
        bossMotionReady: window.__CODEJITSU_BOSS_MOTION?.usesImagegenMotionSmear === true,
        bossMotion: window.__CODEJITSU_BOSS_MOTION,
        bossBackdrop: window.__CODEJITSU_BOSS_BACKDROP,
        bossTelegraph: window.__CODEJITSU_BOSS_TELEGRAPH,
        bossWarning: window.__CODEJITSU_BOSS_WARNING_VISUAL,
        bossAttackBanner: window.__CODEJITSU_BOSS_ATTACK_BANNER_VISUAL,
        bossAttackHistory: window.__CODEJITSU_BOSS_ATTACK_HISTORY,
        generatedTelegraphs: window.__CODEJITSU_GENERATED_TELEGRAPHS,
        bossImpactVfx: window.__CODEJITSU_BOSS_IMPACT_VFX,
        swordSwing: window.__CODEJITSU_SWORD_SWING,
        dungeonRoom: window.__CODEJITSU_DUNGEON_ROOM_VISUAL,
        routeProgress: window.__CODEJITSU_CHAPTER1_ROUTE_PROGRESS,
        chapter2Trail: window.__CODEJITSU_CHAPTER2_TRAIL,
        chapter2TrailHud: window.__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL,
        chapterOnePlaytime: window.__CODEJITSU_CHAPTER1_PLAYTIME_RUNTIME,
        enemyBounds: window.__CODEJITSU_ENEMY_BOUNDS,
        animationCatalog: window.__CODEJITSU_ANIMATION_CATALOG,
        assetAudit: window.__CODEJITSU_ASSET_AUDIT,
        enemyCount: window.__CODEJITSU_ENEMY_BOUNDS?.filter((enemy) => enemy.scene === window.__CODEJITSU_SCENE && enemy.bodyAlive).length ?? 0,
        terminalOpen: window.__CODEJITSU_TERMINAL_OPEN,
        terminalInput: window.__CODEJITSU_TERMINAL_INPUT,
        timeScale: window.__CODEJITSU_TIME_SCALE,
        terminalVisual: window.__CODEJITSU_TERMINAL_VISUAL,
        terminalCommandCards: window.__CODEJITSU_TERMINAL_COMMAND_CARDS,
        terminalPreview: window.__CODEJITSU_TERMINAL_PREVIEW,
        lastAbilityCast: window.__CODEJITSU_LAST_ABILITY_CAST_ART,
        lastAbilityDamage: window.__CODEJITSU_LAST_ABILITY_DAMAGE,
        paused: window.__CODEJITSU_PAUSED,
        pauseMenu: window.__CODEJITSU_PAUSE_MENU,
        pauseVisual: window.__CODEJITSU_PAUSE_VISUAL,
        layoutAudits: window.__CODEJITSU_LAYOUT_AUDITS,
        deathScreen: window.__CODEJITSU_DEATH_SCREEN,
        primitiveFallbacks: (() => {
          const root = window;
          const visited = new WeakSet();
          const offenders = [];
          const inspect = (value, path) => {
            if (!value || typeof value !== 'object') return;
            if (visited.has(value)) return;
            visited.add(value);
            for (const [key, child] of Object.entries(value)) {
              const childPath = `${path}.${key}`;
              if (/primitive/i.test(key)) {
                const failedNumber = typeof child === 'number' && child > 0;
                const failedBoolean = child === true;
                const failedString = typeof child === 'string' && child.trim().length > 0;
                if (failedNumber || failedBoolean || failedString) {
                  offenders.push({
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
        })(),
      }));
      const frames = [];

      for (let index = 0; index < frameCount; index += 1) {
        if (index > 0) await page.waitForTimeout(frameDelayMs);
        const path = resolve(outputDir, `${route.name}-${String(index + 1).padStart(2, '0')}.png`);
        const buffer = await page.screenshot({ path, fullPage: false });
        frames.push({
          path,
          bytes: buffer.byteLength,
          hash: createHash('sha256').update(buffer).digest('hex'),
        });
      }

      manifest.routes.push({
        name: route.name,
        url,
        runtime,
        frames,
      });
    }
  } finally {
    await browser.close();
    await stopOwnedServer(ownedServer);
  }

  const manifestPath = resolve(outputDir, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const validation = validateManifest(manifest);
  console.log(`Captured ${manifest.routes.length * frameCount} frames into ${outputDir}`);
  console.log(`Validated visual proof: ${JSON.stringify(validation)}`);
  console.log(manifestPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
