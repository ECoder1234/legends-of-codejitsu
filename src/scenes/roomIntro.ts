import Phaser from 'phaser';
import { addPanel, makePixelText } from './ui';
import { TextureKeys } from './sceneKeys';

export interface KeikoHelperOptions {
  title: string;
  speaker?: string;
  radio?: boolean;
  lines: string[];
  onDismiss?: () => void;
  autoDismissMs?: number;
}

/**
 * Shows a Keiko mentor overlay at the start of a room with explanatory text.
 * Player presses Space/Enter/click to dismiss and start playing.
 * Solves the "scenes come out of nowhere" problem by always having an intro.
 */
export function showKeikoHelper(scene: Phaser.Scene, options: KeikoHelperOptions): void {
  const speaker = options.speaker ?? 'Master Keiko';
  const lines = options.lines;
  const layer: Phaser.GameObjects.GameObject[] = [];

  // Dim backdrop
  const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.62).setDepth(8000);
  layer.push(dim);

  // Keiko portrait area (left)
  const portraitBg = scene.add.rectangle(220, 380, 220, 280, 0x140d18, 0.95)
    .setStrokeStyle(3, 0xf0c36b, 0.85).setDepth(8001);
  layer.push(portraitBg);

  if (scene.textures.exists(TextureKeys.KeikoMentorOverlay)) {
    const mentor = scene.add.image(220, 380, TextureKeys.KeikoMentorOverlay).setDisplaySize(180, 240).setDepth(8002);
    layer.push(mentor);
  } else if (scene.textures.exists('mentor')) {
    const mentor = scene.add.image(220, 380, 'mentor').setDisplaySize(180, 240).setDepth(8002);
    layer.push(mentor);
  } else {
    // Fallback: a simple silhouette
    const silhouette = scene.add.rectangle(220, 380, 120, 200, 0xf0c36b, 0.6).setDepth(8002);
    layer.push(silhouette);
  }

  if (options.radio && scene.textures.exists(TextureKeys.KeikoRadioOverlay)) {
    const radioFrame = scene.add.image(220, 526, TextureKeys.KeikoRadioOverlay)
      .setDisplaySize(230, 70)
      .setDepth(8002);
    layer.push(radioFrame);
  } else {
    const nameplate = scene.add.rectangle(220, 500, 210, 38, 0x0b0918, 0.82)
      .setStrokeStyle(2, 0xf0c36b, 0.5)
      .setDepth(8002);
    layer.push(nameplate);
  }

  const speakerLabel = makePixelText(scene, 220, options.radio ? 530 : 490, speaker, 17, '#f0c36b', 'center')
    .setOrigin(0.5, 0).setDepth(8003);
  layer.push(speakerLabel);

  // Calculate panel height dynamically based on content
  const panelX = 360;
  const panelY = 220;
  const panelW = 820;
  const titlePad = 76; // top of panel to first body line
  let totalBodyH = 0;
  lines.forEach((line) => { totalBodyH += Math.max(40, Math.ceil(line.length / 60) * 28 + 26); });
  const dismissPad = 50; // space for dismiss text + bottom margin
  const panelH = Math.max(320, titlePad + totalBodyH + dismissPad);

  // Dialogue panel (right of portrait)
  const panel = addPanel(scene, panelX, panelY, panelW, panelH, 0.94).setDepth(8001);
  layer.push(panel);

  const titleText = makePixelText(scene, 386, panelY + 24, options.title, 26, '#f0c36b')
    .setDepth(8003);
  layer.push(titleText);

  let bodyY = panelY + titlePad;
  lines.forEach((line) => {
    const text = makePixelText(scene, 386, bodyY, line, 17, '#f6ead3')
      .setWordWrapWidth(780).setDepth(8003);
    layer.push(text);
    bodyY += Math.max(40, Math.ceil(line.length / 60) * 28 + 26);
  });

  const dismissText = makePixelText(scene, 770, panelY + panelH - 30, '[SPACE / ENTER / CLICK to begin]', 15, '#90d2b7', 'center')
    .setOrigin(0.5, 0).setDepth(8003);
  layer.push(dismissText);
  if (scene.textures.exists(TextureKeys.HelperDismissArrow)) {
    const dismissKey = scene.add.image(575, panelY + panelH - 19, TextureKeys.HelperDismissArrow)
      .setDisplaySize(64, 24)
      .setDepth(8003);
    layer.push(dismissKey);
  }

  scene.tweens.add({
    targets: dismissText,
    alpha: { from: 0.55, to: 1 },
    duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut',
  });

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    scene.tweens.add({
      targets: layer,
      alpha: 0,
      duration: 260,
      onComplete: () => layer.forEach((obj) => obj.destroy()),
    });
    options.onDismiss?.();
  };

  const keyboardHandler = (event: KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
      dismiss();
      scene.input.keyboard?.off('keydown', keyboardHandler);
    }
  };
  scene.input.keyboard?.on('keydown', keyboardHandler);

  const pointerHandler = () => {
    dismiss();
    scene.input.off('pointerdown', pointerHandler);
  };
  scene.input.on('pointerdown', pointerHandler);

  if (options.autoDismissMs) {
    scene.time.delayedCall(options.autoDismissMs, dismiss);
  }

  (window as Window & { __CODEJITSU_KEIKO_HELPER?: { title: string; speaker: string; at: number } }).__CODEJITSU_KEIKO_HELPER = {
    title: options.title,
    speaker,
    at: Math.round(performance.now()),
  };
}

export interface ExitBeaconOptions {
  x: number;
  y: number;
  label?: string;
  color?: number;
  width?: number;
  height?: number;
}

/**
 * Adds a highly visible animated EXIT beacon at the given position.
 * Returns the main rect so callers can use it for distance/collision checks.
 */
export function addVisibleExitBeacon(scene: Phaser.Scene, options: ExitBeaconOptions): {
  rect: Phaser.GameObjects.Rectangle;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
} {
  const color = options.color ?? 0xf0c36b;
  const width = options.width ?? 140;
  const height = options.height ?? 160;
  const label = options.label ?? 'EXIT';
  const usesBanner = scene.textures.exists(TextureKeys.ExitBeaconBanner);

  const glow = scene.add.rectangle(options.x, options.y, width + 60, height + 60, color, 0.18)
    .setDepth(800);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.1, to: 0.32 },
    scaleX: 1.08, scaleY: 1.08,
    duration: 760, yoyo: true, repeat: -1, ease: 'Sine.InOut',
  });

  const rect = scene.add.rectangle(options.x, options.y, width, height, color, usesBanner ? 0.08 : 0.22)
    .setStrokeStyle(4, color, 0.92).setDepth(801);

  const banner = usesBanner
    ? scene.add.image(options.x, options.y, TextureKeys.ExitBeaconBanner)
      .setDisplaySize(Math.max(176, width + 72), 72)
      .setDepth(802)
    : undefined;

  const labelText = makePixelText(scene, options.x, options.y - height / 2 - 14, label, 22, '#f6ead3', 'center')
    .setOrigin(0.5, 1).setDepth(803).setStroke('#09070d', 4);

  // Animated arrow above
  const arrow = scene.add.triangle(options.x, options.y - height / 2 - 50,
    -16, 0, 16, 0, 0, 18, color, 0.95).setDepth(803);
  scene.tweens.add({
    targets: arrow,
    y: { from: options.y - height / 2 - 50, to: options.y - height / 2 - 38 },
    duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut',
  });

  // Animated chevrons on the sides
  const sideArrows: Phaser.GameObjects.Triangle[] = [];
  for (let i = 0; i < 3; i++) {
    const left = scene.add.triangle(options.x - width / 2 - 14 - i * 16, options.y,
      0, -10, 12, 0, 0, 10, color, 0.7 - i * 0.18).setDepth(803);
    sideArrows.push(left);
  }

  return {
    rect,
    setVisible: (visible: boolean) => {
      [glow, rect, banner, labelText, arrow, ...sideArrows].forEach((obj) => obj?.setVisible(visible));
    },
    destroy: () => {
      [glow, rect, banner, labelText, arrow, ...sideArrows].forEach((obj) => obj?.destroy());
    },
  };
}

/**
 * Adds a subtle full-screen brightening overlay for too-dark scenes.
 * Useful when generated backdrops are very dark.
 */
export function addBrightnessLift(scene: Phaser.Scene, depth = 3, alpha = 0.12): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(640, 360, 1280, 720, 0xf6ead3, alpha).setDepth(depth);
}
