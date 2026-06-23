import Phaser from 'phaser';
import type { ArenaClampSide } from './transition';
import { TextureKeys } from './sceneKeys';
import { addSeamVfx } from './seamVfx';

let codejitsuAudioContext: AudioContext | undefined;

interface GroundedMotionVisual {
  moving: boolean;
  velocity: { x: number; y: number };
  momentumState?: string;
  runFactor: number;
  strideIntensity: number;
  strideIntervalMs: number;
  footPlantPhase?: number;
  bodyLean?: number;
  shadowLead?: { x: number; y: number };
  trailIntensity?: number;
  cameraLead?: { x: number; y: number };
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
}

export function makePixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 22,
  color = '#f6ead3',
  align: CanvasTextAlign = 'left',
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: 'monospace',
    fontSize: `${size}px`,
    color,
    align,
    lineSpacing: 8,
    shadow: {
      offsetX: 3,
      offsetY: 3,
      color: '#12080b',
      blur: 0,
      stroke: true,
      fill: true,
    },
  });
}

export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.86,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x140d18, alpha);
  graphics.fillRoundedRect(x, y, width, height, 8);
  graphics.lineStyle(2, 0xf0c36b, 0.78);
  graphics.strokeRoundedRect(x, y, width, height, 8);
  return graphics;
}

export function addRoomDepthBorders(
  scene: Phaser.Scene,
  bounds: Phaser.Geom.Rectangle,
  options: {
    sceneId?: string;
    topDepth?: number;
    sideDepth?: number;
    frontDepth?: number;
    accentColor?: number;
  } = {},
): void {
  const accent = options.accentColor ?? 0xf0c36b;
  const topDepth = options.topDepth ?? 52;
  const sideDepth = options.sideDepth ?? 66;
  const frontDepth = options.frontDepth ?? 840;
  const dark = 0x08060c;
  const sceneId = options.sceneId ?? scene.scene.key;
  const hasGeneratedVfx = scene.textures.exists(TextureKeys.SeamVfx);

  scene.add.rectangle(bounds.centerX, bounds.bottom + 24, bounds.width + 86, 30, dark, 0.11).setDepth(frontDepth);
  scene.add.rectangle(bounds.centerX, bounds.bottom + 4, bounds.width + 44, 4, dark, 0.14).setDepth(frontDepth + 1);

  if (hasGeneratedVfx) {
    addSeamVfx(scene, sceneId, 'trail', bounds.left + 118, bounds.top + 8, {
      width: 178,
      height: 58,
      depth: topDepth + 2,
      alpha: 0.24,
      tint: accent,
      rotation: 0.02,
    });
    addSeamVfx(scene, sceneId, 'trail', bounds.right - 118, bounds.top + 8, {
      width: 178,
      height: 58,
      depth: topDepth + 2,
      alpha: 0.24,
      tint: accent,
      rotation: -0.02,
    });
    addSeamVfx(scene, sceneId, 'spark', bounds.left + 100, bounds.bottom + 2, {
      width: 150,
      height: 70,
      depth: frontDepth + 3,
      alpha: 0.32,
      tint: accent,
      rotation: -0.05,
    });
    addSeamVfx(scene, sceneId, 'spark', bounds.right - 100, bounds.bottom + 2, {
      width: 150,
      height: 70,
      depth: frontDepth + 3,
      alpha: 0.32,
      tint: accent,
      rotation: 0.05,
    });
    addSeamVfx(scene, sceneId, 'motes', bounds.left - 8, bounds.top + 118, {
      width: 94,
      height: 170,
      depth: sideDepth + 2,
      alpha: 0.22,
      tint: accent,
      rotation: -0.2,
    });
    addSeamVfx(scene, sceneId, 'motes', bounds.right + 8, bounds.top + 118, {
      width: 94,
      height: 170,
      depth: sideDepth + 2,
      alpha: 0.22,
      tint: accent,
      rotation: 0.2,
    });
  } else {
    scene.add.rectangle(bounds.left + 118, bounds.top, 190, 2, accent, 0.08).setDepth(topDepth + 1);
    scene.add.rectangle(bounds.right - 118, bounds.top, 190, 2, accent, 0.08).setDepth(topDepth + 1);
    scene.add.rectangle(bounds.left - 8, bounds.top + 96, 3, 160, accent, 0.06).setDepth(sideDepth + 1);
    scene.add.rectangle(bounds.right + 8, bounds.top + 96, 3, 160, accent, 0.06).setDepth(sideDepth + 1);
  }

  const posts = [
    [bounds.left - 6, bounds.top + 8, topDepth + 2],
    [bounds.right + 6, bounds.top + 8, topDepth + 2],
    [bounds.left - 10, bounds.bottom + 4, frontDepth + 2],
    [bounds.right + 10, bounds.bottom + 4, frontDepth + 2],
  ] as const;
  posts.forEach(([x, y, depth], index) => {
    if (hasGeneratedVfx) {
      addSeamVfx(scene, sceneId, index < 2 ? 'wisp' : 'spark', x, y - 10, {
        width: index < 2 ? 74 : 86,
        height: index < 2 ? 86 : 72,
        depth: depth + 2,
        alpha: index < 2 ? 0.2 : 0.28,
        tint: accent,
        rotation: index % 2 === 0 ? -0.18 : 0.18,
      });
    } else {
      scene.add.rectangle(x, y, 14, index < 2 ? 34 : 46, 0x211625, 0.58)
        .setDepth(depth)
        .setAlpha(0.36)
        .setStrokeStyle(1, accent, 0.16);
      scene.add.rectangle(x, y - 15, 8, 6, 0x8f7dff, 0.18).setDepth(depth + 1);
    }
  });

  publishRoomBorderRuntime({
    scene: sceneId,
    usesImagegenSeamVfx: hasGeneratedVfx,
    visibleRailAlpha: hasGeneratedVfx ? 0.14 : 0.36,
    primitivePostAlpha: hasGeneratedVfx ? 0 : 0.36,
    seamFragments: hasGeneratedVfx ? 10 : 0,
    generatedOnlyBorders: hasGeneratedVfx,
    at: Date.now(),
  });
}

export function addForegroundDepthOverlay(scene: Phaser.Scene, depth = 870, alpha = 0.88): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(TextureKeys.ForegroundDepth)) {
    return undefined;
  }
  return scene.add.image(640, 360, TextureKeys.ForegroundDepth)
    .setDisplaySize(1280, 720)
    .setDepth(depth)
    .setAlpha(alpha);
}

export function updateForegroundParallaxDepth(
  scene: Phaser.Scene,
  sceneId: string,
  overlay: Phaser.GameObjects.Image | undefined,
  movement: GroundedMotionVisual,
  intensity = 0.34,
): void {
  const lead = movement.cameraLead ?? { x: 0, y: 0 };
  const leadMagnitude = Math.hypot(lead.x, lead.y);
  const targetX = 640 - lead.x * intensity;
  const targetY = 360 - lead.y * intensity * 0.72;
  let normalizedOverlayScale = 1;
  if (overlay) {
    const baseScaleX = Number(overlay.getData('foregroundBaseScaleX') ?? overlay.scaleX);
    const baseScaleY = Number(overlay.getData('foregroundBaseScaleY') ?? overlay.scaleY);
    overlay.setData('foregroundBaseScaleX', baseScaleX);
    overlay.setData('foregroundBaseScaleY', baseScaleY);
    const targetScaleMultiplier = 1.006 + Math.min(0.018, leadMagnitude / 9000);
    overlay.setPosition(
      Phaser.Math.Linear(overlay.x, targetX, 0.22),
      Phaser.Math.Linear(overlay.y, targetY, 0.22),
    );
    overlay.setScale(
      Phaser.Math.Linear(overlay.scaleX, baseScaleX * targetScaleMultiplier, 0.16),
      Phaser.Math.Linear(overlay.scaleY, baseScaleY * targetScaleMultiplier, 0.16),
    );
    normalizedOverlayScale = baseScaleX > 0 ? overlay.scaleX / baseScaleX : 1;
  }
  (window as Window & {
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
  }).__CODEJITSU_DEPTH_MOTION = {
    scene: sceneId,
    parallaxActive: Boolean(overlay) && leadMagnitude > 0.5,
    leadX: Math.round(lead.x * 100) / 100,
    leadY: Math.round(lead.y * 100) / 100,
    leadMagnitude: Math.round(leadMagnitude * 100) / 100,
    overlayX: Math.round((overlay?.x ?? 640) * 100) / 100,
    overlayY: Math.round((overlay?.y ?? 360) * 100) / 100,
    overlayScale: Math.round(normalizedOverlayScale * 1000) / 1000,
    movementState: movement.momentumState,
    at: Math.round(performance.now()),
  };
}

export function addArenaDepthCues(
  scene: Phaser.Scene,
  bounds: Phaser.Geom.Rectangle,
  options: {
    sceneId: string;
    accentColor?: number;
    topWidthRatio?: number;
    floorDepth?: number;
    foregroundDepth?: number;
    bandCount?: number;
  },
): void {
  const accent = options.accentColor ?? 0xf0c36b;
  const topWidthRatio = options.topWidthRatio ?? 0.48;
  const bandCount = options.bandCount ?? 7;
  const floorDepth = options.floorDepth ?? 57;
  const foregroundDepth = options.foregroundDepth ?? 852;
  const graphics = scene.add.graphics().setDepth(floorDepth).setAlpha(0.72);
  const dark = 0x07050b;

  let previousLeft = bounds.centerX - (bounds.width * topWidthRatio) / 2;
  let previousRight = bounds.centerX + (bounds.width * topWidthRatio) / 2;
  let previousY = bounds.top;
  for (let index = 0; index < bandCount; index += 1) {
    const t = (index + 1) / (bandCount + 1);
    const eased = 1 - Math.pow(1 - t, 1.45);
    const width = bounds.width * Phaser.Math.Linear(topWidthRatio, 1, eased);
    const y = bounds.top + bounds.height * t;
    const left = bounds.centerX - width / 2;
    const right = bounds.centerX + width / 2;
    const alpha = 0.08 + t * 0.07;

    graphics.lineStyle(2, accent, alpha);
    graphics.beginPath();
    graphics.moveTo(left, y);
    graphics.lineTo(right, y);
    graphics.strokePath();

    graphics.lineStyle(1, 0xf6ead3, alpha * 0.42);
    graphics.beginPath();
    graphics.moveTo(previousLeft, previousY);
    graphics.lineTo(left, y);
    graphics.moveTo(previousRight, previousY);
    graphics.lineTo(right, y);
    graphics.strokePath();

    previousLeft = left;
    previousRight = right;
    previousY = y;
  }

  const frontGlow = scene.add.ellipse(bounds.centerX, bounds.bottom + 24, bounds.width * 0.92, 50, accent, 0.06)
    .setDepth(foregroundDepth - 3);
  const frontShade = scene.add.rectangle(bounds.centerX, bounds.bottom + 34, bounds.width + 136, 44, dark, 0.16)
    .setDepth(foregroundDepth);
  const frontRail = scene.add.rectangle(bounds.centerX, bounds.bottom + 10, bounds.width * 0.78, 6, 0xf6ead3, 0.05)
    .setDepth(foregroundDepth + 1)
    .setStrokeStyle(1, accent, 0.07);
  const occluderXs = [
    bounds.left + bounds.width * 0.16,
    bounds.left + bounds.width * 0.32,
    bounds.right - bounds.width * 0.32,
    bounds.right - bounds.width * 0.16,
  ];
  const hasGeneratedVfx = scene.textures.exists(TextureKeys.SeamVfx);
  occluderXs.forEach((x, index) => {
    scene.add.rectangle(x, bounds.bottom + 8 + (index % 2) * 5, 16, 44, dark, 0.5)
      .setAlpha(hasGeneratedVfx ? 0.16 : 0.42)
      .setDepth(foregroundDepth + 2)
      .setStrokeStyle(1, accent, hasGeneratedVfx ? 0.05 : 0.14);
    scene.add.ellipse(x, bounds.bottom - 12 + (index % 2) * 3, 42, 12, accent, 0.08)
      .setDepth(foregroundDepth - 2);
    if (hasGeneratedVfx) {
      addSeamVfx(scene, options.sceneId, index % 2 === 0 ? 'motes' : 'spark', x, bounds.bottom + 4 + (index % 2) * 5, {
        width: 74,
        height: 72,
        depth: foregroundDepth + 3,
        alpha: 0.2,
        tint: accent,
        rotation: index < 2 ? -0.12 : 0.12,
      });
    }
  });

  publishDepthCueRuntime({
    scene: options.sceneId,
    topWidthRatio,
    bandCount,
    foregroundOccluders: occluderXs.length + 3,
    foregroundDepth,
    actorDepthMode: 'y-sorted',
    perspectiveScale: true,
    textureForeground: scene.textures.exists(TextureKeys.ForegroundDepth),
    at: Date.now(),
  });

  scene.tweens.add({
    targets: [graphics, frontGlow, frontShade, frontRail],
    alpha: { from: 0.38, to: 0.72 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut',
  });
}

function publishRoomBorderRuntime(entry: {
  scene: string;
  usesImagegenSeamVfx: boolean;
  visibleRailAlpha: number;
  primitivePostAlpha: number;
  seamFragments: number;
  generatedOnlyBorders: boolean;
  at: number;
}): void {
  const global = window as unknown as {
    __CODEJITSU_ROOM_BORDER_VISUAL?: Array<typeof entry>;
  };
  const previous = global.__CODEJITSU_ROOM_BORDER_VISUAL ?? [];
  global.__CODEJITSU_ROOM_BORDER_VISUAL = [
    ...previous.filter((candidate) => candidate.scene !== entry.scene),
    entry,
  ];
}

function publishDepthCueRuntime(entry: {
  scene: string;
  topWidthRatio: number;
  bandCount: number;
  foregroundOccluders: number;
  foregroundDepth: number;
  actorDepthMode: 'y-sorted';
  perspectiveScale: boolean;
  textureForeground: boolean;
  at: number;
}): void {
  const global = window as unknown as {
    __CODEJITSU_DEPTH_CUES?: Array<typeof entry>;
  };
  const previous = global.__CODEJITSU_DEPTH_CUES ?? [];
  global.__CODEJITSU_DEPTH_CUES = [
    ...previous.filter((candidate) => candidate.scene !== entry.scene),
    entry,
  ];
}

export function addBoundaryBump(
  scene: Phaser.Scene,
  x: number,
  y: number,
  side: ArenaClampSide,
  depth: number,
): void {
  const horizontal = side === 'left' || side === 'right';
  const direction = side === 'left' || side === 'top' ? -1 : 1;
  const edgeLine = scene.add.rectangle(
    x + (horizontal ? direction * 12 : 0),
    y + (horizontal ? -6 : direction * 10),
    horizontal ? 5 : 82,
    horizontal ? 74 : 5,
    0xf0c36b,
    0.5,
  )
    .setDepth(depth + 3);
  const pressure = scene.add.ellipse(x, y + 18, 76, 26, 0x8f7dff, 0.2)
    .setStrokeStyle(2, 0xf6ead3, 0.28)
    .setDepth(depth + 2);
  const sparkCount = 5;
  for (let index = 0; index < sparkCount; index += 1) {
    const offset = (index - (sparkCount - 1) / 2) * 12;
    const spark = scene.add.rectangle(
      x + (horizontal ? direction * 18 : offset),
      y + (horizontal ? offset : direction * 16),
      14,
      3,
      index % 2 === 0 ? 0xf0c36b : 0xf6ead3,
      0.82,
    )
      .setRotation(horizontal ? direction * 0.28 : direction * 1.32)
      .setDepth(depth + 4);
    scene.tweens.add({
      targets: spark,
      x: spark.x - (horizontal ? direction * 22 : 0),
      y: spark.y - (horizontal ? 0 : direction * 18),
      alpha: 0,
      duration: 180,
      ease: 'Quad.Out',
      onComplete: () => spark.destroy(),
    });
  }
  scene.tweens.add({
    targets: edgeLine,
    alpha: 0,
    scaleX: horizontal ? 1 : 1.18,
    scaleY: horizontal ? 1.18 : 1,
    duration: 210,
    ease: 'Quad.Out',
    onComplete: () => edgeLine.destroy(),
  });
  scene.tweens.add({
    targets: pressure,
    alpha: 0,
    scaleX: 1.28,
    scaleY: 1.16,
    duration: 240,
    ease: 'Quad.Out',
    onComplete: () => pressure.destroy(),
  });
}

export function addHealthBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
): {
  group: Phaser.GameObjects.Group;
  setValue: (value: number, max: number) => void;
} {
  const usesImagegenFrame = scene.textures.exists(TextureKeys.HealthBarFrame);
  const usesImagegenFill = scene.textures.exists(TextureKeys.HealthMeterFill);
  const backing = scene.add.graphics();
  const frame = usesImagegenFrame
    ? scene.add.image(x + width / 2, y + height / 2, TextureKeys.HealthBarFrame)
      .setDisplaySize(width + 34, height + 30)
      .setAlpha(0.98)
    : undefined;
  const fill = usesImagegenFill
    ? scene.add.image(x + 3, y + height / 2, TextureKeys.HealthMeterFill)
      .setOrigin(0, 0.5)
      .setDisplaySize(width - 6, height - 6)
      .setAlpha(0.96)
      .setDepth(1)
      .setData('usesImagegenMeterFill', true)
    : scene.add.graphics();
  const title = makePixelText(scene, x, y - 28, label, 18, '#f6ead3');
  const group = scene.add.group([backing, ...(frame ? [frame] : []), fill, title]);

  const setValue = (value: number, max: number) => {
    const ratio = Phaser.Math.Clamp(value / max, 0, 1);
    backing.clear();
    backing.fillStyle(0x110914, usesImagegenFrame ? 0.72 : 0.92);
    backing.fillRoundedRect(x, y, width, height, 5);
    if (!usesImagegenFrame) {
      backing.lineStyle(2, 0x5d4a61, 1);
      backing.strokeRoundedRect(x, y, width, height, 5);
    }
    const fillWidth = Math.max(0, (width - 6) * ratio);
    if (fill instanceof Phaser.GameObjects.Image) {
      const source = scene.textures.get(TextureKeys.HealthMeterFill).getSourceImage() as { width?: number; height?: number };
      const sourceWidth = Number(source.width ?? 1);
      const sourceHeight = Number(source.height ?? 1);
      fill
        .setVisible(fillWidth > 0.5)
        .setCrop(0, 0, sourceWidth * ratio, sourceHeight)
        .setDisplaySize(fillWidth, height - 6)
        .setTint(ratio > 0.35 ? 0xffffff : 0xffc36b);
    } else {
      fill.clear();
      fill.fillStyle(ratio > 0.35 ? 0xd64f45 : 0xffb84d, 1);
      fill.fillRoundedRect(x + 3, y + 3, fillWidth, height - 6, 4);
    }
    publishHealthBarVisual({
      scene: scene.scene.key,
      label,
      usesImagegenFrame,
      usesImagegenFill,
      primitiveFramePieces: usesImagegenFrame ? 0 : 2,
      primitiveFillPieces: usesImagegenFill ? 0 : 1,
      generatedFillCropped: usesImagegenFill,
      ratio: Math.round(ratio * 100) / 100,
      frameWidth: width + 34,
      frameHeight: height + 30,
      fillWidth: Math.round(fillWidth * 10) / 10,
      at: Math.round(performance.now()),
    });
  };

  setValue(1, 1);
  return { group, setValue };
}

function publishHealthBarVisual(entry: {
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
}): void {
  const runtime = window as Window & {
    __CODEJITSU_HEALTH_BAR_VISUAL?: Array<typeof entry>;
  };
  const previous = runtime.__CODEJITSU_HEALTH_BAR_VISUAL ?? [];
  runtime.__CODEJITSU_HEALTH_BAR_VISUAL = [
    ...previous.filter((item) => !(item.scene === entry.scene && item.label === entry.label)),
    entry,
  ].slice(-8);
}

export function playBoom(scene: Phaser.Scene, intensity = 1): void {
  playTone(scene, 90 * intensity, 0.5, 'sawtooth', 0.35 * intensity, 28);
}

export function playSlash(scene: Phaser.Scene): void {
  playTone(scene, 520, 0.12, 'triangle', 0.13, 190);
}

export function playCast(scene: Phaser.Scene): void {
  playTone(scene, 360, 0.24, 'square', 0.12, 720);
}

export function playHit(scene: Phaser.Scene): void {
  playTone(scene, 150, 0.14, 'sawtooth', 0.13, 80);
}

export function addImpactPause(scene: Phaser.Scene, durationMs = 70, scale = 0.18): void {
  if (scene.time.timeScale < 0.95) return;
  scene.time.timeScale = scale;
  scene.physics.world.timeScale = scale;
  window.setTimeout(() => {
    if (!scene.sys.isActive()) return;
    scene.time.timeScale = 1;
    scene.physics.world.timeScale = 1;
  }, durationMs);
}

export function addSwordSwing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  direction: 1 | -1,
  depth: number,
  variant = 0,
): { hitX: number; hitY: number; usesImagegenVfx: boolean; primitivePieces: number; vfxFrameIndex: number } {
  const reach = variant === 2 ? 128 : variant === 1 ? 108 : 92;
  const arcRadius = variant === 2 ? 108 : variant === 1 ? 96 : 84;
  const arcLift = variant === 2 ? -24 : -16;
  const color = variant === 2 ? 0xf0c36b : 0xf6ead3;
  const gripX = x + 13 * direction;
  const gripY = y - 7;
  const tipX = x + reach * direction;
  const tipY = y - (variant === 2 ? 54 : 42);
  const hitX = x + (reach - 8) * direction;
  const hitY = y - (variant === 2 ? 26 : 20);
  const bladeAngle = Phaser.Math.Angle.Between(gripX, gripY, tipX, tipY);
  const bladeLength = Phaser.Math.Distance.Between(gripX, gripY, tipX, tipY);
  const usesImagegenVfx = scene.textures.exists(TextureKeys.SwordSwingVfx);

  if (usesImagegenVfx) {
    const frameIndex = Phaser.Math.Clamp(variant, 0, 3);
    const source = scene.textures.get(TextureKeys.SwordSwingVfx).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const frameWidth = Math.floor(source.width / 4);
    const frameHeight = source.height;
    const cropX = frameIndex * frameWidth;
    const slashScale = variant === 2 ? 0.33 : variant === 1 ? 0.29 : 0.25;
    const glowScale = (variant === 2 ? 0.27 : 0.23) * 0.8;
    const slash = scene.add.image(x + 58 * direction, y - 42, TextureKeys.SwordSwingVfx)
      .setCrop(cropX, 0, frameWidth, frameHeight)
      .setDepth(depth + 3)
      .setOrigin(0.5, 0.58)
      .setFlipX(direction < 0)
      .setDisplaySize(frameWidth * slashScale, frameHeight * slashScale)
      .setAlpha(0.96);
    const glow = scene.add.image(Phaser.Math.Linear(x, hitX, 0.62), Phaser.Math.Linear(y, hitY, 0.6), TextureKeys.SwordSwingVfx)
      .setCrop(cropX, 0, frameWidth, frameHeight)
      .setDepth(depth + 1)
      .setOrigin(0.5, 0.58)
      .setFlipX(direction < 0)
      .setTint(variant === 2 ? 0xf0c36b : 0x8f7dff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(frameWidth * glowScale, frameHeight * glowScale)
      .setAlpha(0.28);

    scene.tweens.add({
      targets: [slash, glow],
      alpha: 0,
      scaleX: '+=0.07',
      scaleY: '+=0.04',
      duration: variant === 2 ? 240 : 190,
      ease: 'Quad.Out',
      onComplete: () => {
        slash.destroy();
        glow.destroy();
      },
    });

    return {
      hitX,
      hitY,
      usesImagegenVfx: true,
      primitivePieces: 0,
      vfxFrameIndex: frameIndex,
    };
  }

  const trail = scene.add.graphics().setDepth(depth);
  trail.lineStyle(variant === 2 ? 22 : 16, color, 0.78);
  trail.beginPath();
  trail.arc(
    x + 42 * direction,
    y + arcLift,
    arcRadius,
    direction > 0 ? -1.1 : Math.PI + 0.08,
    direction > 0 ? 0.36 : Math.PI + 1.54,
    direction < 0,
  );
  trail.strokePath();
  trail.lineStyle(variant === 2 ? 9 : 6, 0x8f7dff, 0.86);
  trail.beginPath();
  trail.arc(
    x + 42 * direction,
    y + arcLift,
    arcRadius - 18,
    direction > 0 ? -0.94 : Math.PI + 0.22,
    direction > 0 ? 0.18 : Math.PI + 1.34,
    direction < 0,
  );
  trail.strokePath();

  const sword = scene.add.graphics().setDepth(depth + 1);
  sword.lineStyle(variant === 2 ? 11 : 8, 0x09070d, 0.92);
  sword.beginPath();
  sword.moveTo(gripX - 4 * direction, gripY + 6);
  sword.lineTo(tipX, tipY);
  sword.strokePath();
  sword.lineStyle(variant === 2 ? 7 : 5, 0xf6ead3, 1);
  sword.beginPath();
  sword.moveTo(gripX, gripY);
  sword.lineTo(tipX, tipY);
  sword.strokePath();
  sword.lineStyle(2, 0xf0c36b, 0.96);
  sword.beginPath();
  sword.moveTo(gripX - 8 * direction, gripY + 8);
  sword.lineTo(gripX + 26 * direction, gripY - 14);
  sword.strokePath();

  const bladeFlash = scene.add.rectangle(
    Phaser.Math.Linear(gripX, tipX, 0.64),
    Phaser.Math.Linear(gripY, tipY, 0.64),
    bladeLength * 0.54,
    variant === 2 ? 9 : 7,
    0xf6ead3,
    0.82,
  )
    .setRotation(bladeAngle)
    .setDepth(depth + 2);
  const tipSpark = scene.add.rectangle(hitX, hitY, variant === 2 ? 22 : 16, 4, 0xf0c36b, 0.94)
    .setRotation(bladeAngle)
    .setDepth(depth + 3);
  const pressureLine = scene.add.rectangle(
    Phaser.Math.Linear(x, hitX, 0.58),
    Phaser.Math.Linear(y, hitY, 0.58),
    Phaser.Math.Distance.Between(x, y, hitX, hitY),
    3,
    0xd64f45,
    0.38,
  )
    .setRotation(Phaser.Math.Angle.Between(x, y, hitX, hitY))
    .setDepth(depth - 1);

  scene.tweens.add({
    targets: [trail, sword, bladeFlash, tipSpark, pressureLine],
    alpha: 0,
    scaleX: 1.22,
    scaleY: 1.08,
    duration: variant === 2 ? 220 : 170,
    ease: 'Quad.Out',
    onComplete: () => {
      trail.destroy();
      sword.destroy();
      bladeFlash.destroy();
      tipSpark.destroy();
      pressureLine.destroy();
    },
  });

  return {
    hitX,
    hitY,
    usesImagegenVfx: false,
    primitivePieces: 5,
    vfxFrameIndex: -1,
  };
}

export function addHitSparks(scene: Phaser.Scene, x: number, y: number, depth: number): void {
  for (let index = 0; index < 8; index += 1) {
    const spark = scene.add.rectangle(x, y, 8, 3, Phaser.Math.RND.pick([0xf6ead3, 0xf0c36b, 0x8f7dff]), 0.95)
      .setDepth(depth + 2)
      .setRotation(Phaser.Math.FloatBetween(-1.2, 1.2));
    scene.tweens.add({
      targets: spark,
      x: x + Phaser.Math.Between(-42, 42),
      y: y + Phaser.Math.Between(-34, 22),
      alpha: 0,
      scaleX: 0.2,
      duration: Phaser.Math.Between(150, 260),
      ease: 'Quad.Out',
      onComplete: () => spark.destroy(),
    });
  }
}

export function addVoidBurst(scene: Phaser.Scene, x: number, y: number, color: number, depth: number): void {
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const shard = scene.add.rectangle(x, y, 10, 4, index % 2 === 0 ? color : 0xf6ead3, 0.86)
      .setDepth(depth + 2)
      .setRotation(angle);
    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * Phaser.Math.Between(42, 82),
      y: y + Math.sin(angle) * Phaser.Math.Between(22, 54),
      alpha: 0,
      scaleX: 0.2,
      duration: Phaser.Math.Between(220, 380),
      ease: 'Quad.Out',
      onComplete: () => shard.destroy(),
    });
  }
}

export function addGroundCrack(scene: Phaser.Scene, x: number, y: number, color: number, depth: number): void {
  const cracks = scene.add.graphics().setDepth(depth);
  cracks.lineStyle(3, color, 0.72);
  for (let index = 0; index < 7; index += 1) {
    const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
    const length = Phaser.Math.Between(34, 86);
    cracks.beginPath();
    cracks.moveTo(x + Math.cos(angle) * 12, y + Math.sin(angle) * 8);
    cracks.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length * 0.48);
    cracks.strokePath();
  }
  scene.tweens.add({
    targets: cracks,
    alpha: 0,
    duration: 520,
    ease: 'Quad.In',
    onComplete: () => cracks.destroy(),
  });
}

export function addStepDust(scene: Phaser.Scene, x: number, y: number, depth: number, directionX: number): void {
  const dust = scene.add.ellipse(x - directionX * 8, y + 30, 20, 8, 0xf0c36b, 0.24)
    .setDepth(depth)
    .setRotation(Phaser.Math.FloatBetween(-0.18, 0.18));
  scene.tweens.add({
    targets: dust,
    x: dust.x - directionX * Phaser.Math.Between(10, 20),
    y: dust.y + Phaser.Math.Between(2, 8),
    alpha: 0,
    scaleX: 1.45,
    scaleY: 0.5,
    duration: 260,
    ease: 'Quad.Out',
    onComplete: () => dust.destroy(),
  });
}

export function addMovementAfterimage(
  scene: Phaser.Scene,
  actor: Phaser.GameObjects.Sprite,
  depthOffset = 8,
  tint = 0x8f7dff,
): void {
  const ghost = scene.add.image(actor.x, actor.y, actor.texture.key)
    .setFrame(actor.frame.name)
    .setScale(actor.scaleX, actor.scaleY)
    .setFlipX(actor.flipX)
    .setRotation(actor.rotation)
    .setAlpha(0.32)
    .setTint(tint)
    .setDepth(actor.y - depthOffset);
  scene.tweens.add({
    targets: ghost,
    alpha: 0,
    scaleX: actor.scaleX * 0.92,
    scaleY: actor.scaleY * 0.92,
    duration: 190,
    ease: 'Quad.Out',
    onComplete: () => ghost.destroy(),
  });
}

export function updateGroundedActorVisual(
  scene: Phaser.Scene,
  actor: Phaser.GameObjects.Sprite,
  shadow: Phaser.GameObjects.Image,
  offsetY: number,
  movement: GroundedMotionVisual,
  baseShadow: { width: number; height: number; alpha: number },
): void {
  const speedSq = movement.velocity.x * movement.velocity.x + movement.velocity.y * movement.velocity.y;
  const moving = movement.moving && speedSq > 900;
  const stride = moving
    ? Math.sin((scene.time.now / Math.max(60, movement.strideIntervalMs)) * Math.PI * 2)
    : 0;
  const weight = Math.abs(stride) * movement.strideIntensity;
  const bodyLean = movement.bodyLean ?? 0;
  const targetRotation = moving
    ? Phaser.Math.Clamp(bodyLean + stride * 0.018, -0.16, 0.16)
    : Phaser.Math.Clamp(bodyLean, -0.07, 0.07);
  const lead = movement.shadowLead ?? { x: 0, y: 0 };
  const runWeight = Math.max(0, movement.runFactor - 1);
  const squash = weight * 0.08 + runWeight * 0.08;
  const stretch = weight * 0.1 + runWeight * 0.1;
  const depthProgress = Phaser.Math.Clamp((actor.y - 166) / 444, 0, 1);
  const perspectiveScale = 0.93 + depthProgress * 0.15;
  const baseScaleX = Number(actor.getData('actorBaseScaleX') ?? Math.abs(actor.scaleX));
  const baseScaleY = Number(actor.getData('actorBaseScaleY') ?? Math.abs(actor.scaleY));
  const footPlant = 1 - weight * 0.035;
  const runStretch = 1 + runWeight * 0.1;
  const visualScaleX = baseScaleX * perspectiveScale * (1 + squash * 0.24);
  const visualScaleY = baseScaleY * perspectiveScale * footPlant * (1 + stretch * 0.16) * runStretch;

  actor.setRotation(Phaser.Math.Linear(actor.rotation, targetRotation, moving ? 0.42 : 0.2));
  actor.setScale(visualScaleX, visualScaleY);
  actor.setData('actorVisualScale', Math.round(perspectiveScale * 1000) / 1000);
  actor.setData('actorVisualStride', Math.round(weight * 1000) / 1000);
  actor.setData('actorVisualGrounded', true);
  actor.setData('actorTractionGrip', Math.round((movement.tractionGrip ?? 0) * 1000) / 1000);
  actor.setData('actorBrakingSnap', movement.brakingSnap === true);
  actor.setData('actorDriftSuppression', movement.driftSuppression ?? 0);
  actor.setData('actorInputResponsiveness', movement.inputResponsiveness ?? 0);
  actor.setData('actorTurnAnticipation', movement.turnAnticipation ?? 0);
  actor.setData('actorStopGrip', movement.stopGrip ?? 0);
  actor.setData('actorCinematicSnap', movement.cinematicSnap ?? 0);
  actor.setData('actorMomentumState', movement.momentumState ?? (moving ? 'walk' : 'idle'));
  actor.setData('actorFootPlantPhase', movement.footPlantPhase ?? 0);
  actor.setData('actorAccelerationBurst', movement.accelerationBurst ?? 1);
  actor.setData('actorBrakingGrip', movement.brakingGrip ?? 0);
  actor.setData('actorStepBeat', movement.stepBeat ?? 0);
  actor.setData('actorMovePolishLevel', movement.movePolishLevel ?? 0);
  actor.setData('actorReleaseBrakeAssist', movement.releaseBrakeAssist ?? 0);
  shadow
    .setPosition(actor.x + lead.x, actor.y + offsetY + lead.y)
    .setDepth(actor.y - 8)
    .setDisplaySize(baseShadow.width * perspectiveScale * (1 + stretch * 1.25), baseShadow.height * perspectiveScale * (1 - squash * 0.8))
    .setAlpha(baseShadow.alpha + weight * 0.09 + depthProgress * 0.04);

  const trailIntensity = movement.trailIntensity ?? 0;
  const lastTrailAt = Number(actor.getData('lastRunTrailAt') ?? 0);
  if (trailIntensity > 0.58 && scene.time.now - lastTrailAt > 185) {
    actor.setData('lastRunTrailAt', scene.time.now);
    addMovementAfterimage(scene, actor, 18, 0xf0c36b);
  }
}

export function playTalk(scene: Phaser.Scene): void {
  const frequency = Phaser.Math.Between(320, 460);
  const endFrequency = Phaser.Math.Between(280, 360);
  const runtime = window as Window & {
    __CODEJITSU_TALK_SOUND?: {
      requested: number;
      played: number;
      lastFrequency: number;
      lastEndFrequency: number;
      oscillator: OscillatorType;
      duration: number;
      audioState: string;
      scene: string;
      at: number;
    };
  };
  const previous = runtime.__CODEJITSU_TALK_SOUND;
  const audioState = codejitsuAudioContext?.state ?? 'not-created';
  const willPlay = audioState === 'running';
  runtime.__CODEJITSU_TALK_SOUND = {
    requested: (previous?.requested ?? 0) + 1,
    played: (previous?.played ?? 0) + (willPlay ? 1 : 0),
    lastFrequency: frequency,
    lastEndFrequency: endFrequency,
    oscillator: 'square',
    duration: 0.035,
    audioState,
    scene: scene.sys.settings.key,
    at: Math.round(performance.now()),
  };
  playTone(scene, frequency, 0.035, 'square', 0.035, endFrequency);
}

export function resumeAudio(scene: Phaser.Scene): void {
  const runtime = window as Window & {
    __CODEJITSU_AUDIO_UNLOCK?: {
      attempted: boolean;
      state: string;
      at: number;
    };
  };
  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    runtime.__CODEJITSU_AUDIO_UNLOCK = { attempted: false, state: 'unsupported', at: Math.round(performance.now()) };
    return;
  }
  codejitsuAudioContext ??= new AudioContextCtor();
  if (codejitsuAudioContext.state === 'running') {
    runtime.__CODEJITSU_AUDIO_UNLOCK = { attempted: true, state: codejitsuAudioContext.state, at: Math.round(performance.now()) };
    return;
  }
  runtime.__CODEJITSU_AUDIO_UNLOCK = { attempted: true, state: codejitsuAudioContext.state, at: Math.round(performance.now()) };
  void codejitsuAudioContext.resume().then(() => {
    runtime.__CODEJITSU_AUDIO_UNLOCK = {
      attempted: true,
      state: codejitsuAudioContext?.state ?? 'unknown',
      at: Math.round(performance.now()),
    };
  });
}

function playTone(
  scene: Phaser.Scene,
  startFrequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  endFrequency = startFrequency,
): void {
  const ctx = codejitsuAudioContext;
  if (!ctx || ctx.state !== 'running') {
    return;
  }
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration * 0.72);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}
