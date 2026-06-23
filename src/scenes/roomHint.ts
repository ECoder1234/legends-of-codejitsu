import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';
import { makePixelText } from './ui';

const HINT_DEPTH = 9000;

export interface RoomHintConfig {
  title: string;
  steps: string[];
  /** When set, the banner auto-fades after this many ms. Default: stays
   *  visible until the scene is shut down. */
  durationMs?: number;
}

/**
 * Adds a centered tutorial banner that explains how to play the room.
 * Stays visible until the scene shuts down (or for `durationMs` if provided).
 *
 * The banner is interactive: hovering or clicking it dismisses it.
 */
export function addRoomHint(scene: Phaser.Scene, config: RoomHintConfig): void {
  const { title, steps, durationMs } = config;
  const camera = scene.cameras.main;
  const cx = camera.width / 2;

  const usesGeneratedBanner = scene.textures.exists(TextureKeys.RoomHintBanner);
  const cardW = usesGeneratedBanner ? 720 : 620;
  const cardH = usesGeneratedBanner ? 140 : 60 + steps.length * 18;
  const cardX = cx - cardW / 2;
  const cardY = 78;

  const card = scene.add.graphics().setDepth(HINT_DEPTH).setScrollFactor(0);
  let banner: Phaser.GameObjects.Image | undefined;
  if (usesGeneratedBanner) {
    banner = scene.add.image(cx, cardY + cardH / 2, TextureKeys.RoomHintBanner)
      .setDisplaySize(cardW, cardH)
      .setDepth(HINT_DEPTH)
      .setScrollFactor(0)
      .setData('usesRoomHintBanner', true);
  } else {
    card.fillStyle(0x000000, 0.86);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 6);
    card.lineStyle(2, 0x33ff66, 0.7);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 6);
  }

  const titleText = makePixelText(scene, cx, cardY + 10, title, 14, '#33ff66', 'center')
    .setOrigin(0.5, 0)
    .setDepth(HINT_DEPTH + 1)
    .setScrollFactor(0);

  const stepTexts = steps.map((step, i) =>
    makePixelText(scene, cx, cardY + 36 + i * 18, step, 11, '#cdbdcb', 'center')
      .setOrigin(0.5, 0)
      .setDepth(HINT_DEPTH + 1)
      .setScrollFactor(0),
  );

  const closeHint = makePixelText(scene, cx + cardW / 2 - 10, cardY + 6, '[x]', 11, '#9ca3af', 'center')
    .setOrigin(1, 0)
    .setDepth(HINT_DEPTH + 1)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  const dismiss = () => {
    card.destroy();
    banner?.destroy();
    titleText.destroy();
    stepTexts.forEach((t) => t.destroy());
    closeHint.destroy();
  };

  closeHint.on('pointerdown', dismiss);

  if (durationMs && durationMs > 0) {
    const handle = window.setTimeout(dismiss, durationMs);
    scene.events.once('shutdown', () => window.clearTimeout(handle));
    scene.events.once('destroy', () => window.clearTimeout(handle));
  }
}

export function makeFloatingPrompt(scene: Phaser.Scene, text: string, color = '#f0c36b'): Phaser.GameObjects.Text {
  return makePixelText(scene, 0, 0, text, 12, color, 'center')
    .setOrigin(0.5, 1)
    .setDepth(HINT_DEPTH + 2)
    .setVisible(false);
}
