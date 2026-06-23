import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

export type AdvancePromptSealKind = 'advance' | 'confirm' | 'retry';

interface AdvancePromptSealOptions {
  width?: number;
  height?: number;
  depth?: number;
  alpha?: number;
  sceneId?: string;
  pulse?: boolean;
}

const frameIndexByKind: Record<AdvancePromptSealKind, number> = {
  advance: 0,
  confirm: 1,
  retry: 2,
};

export function addAdvancePromptSeal(
  scene: Phaser.Scene,
  kind: AdvancePromptSealKind,
  x: number,
  y: number,
  options: AdvancePromptSealOptions = {},
): Phaser.GameObjects.Image | undefined {
  const textureKey = TextureKeys.AdvancePromptSeal;
  const frameIndex = frameIndexByKind[kind];
  if (!scene.textures.exists(textureKey)) {
    publishAdvancePromptSealRuntime(scene, {
      scene: options.sceneId ?? scene.scene.key,
      kind,
      usesImagegenPromptSeal: false,
      visibleTextPrompt: false,
      textureKey: 'missing',
      frameIndex,
    });
    return undefined;
  }

  const frame = ensureAdvancePromptSealFrame(scene, frameIndex);
  const seal = scene.add.image(x, y, textureKey, frame)
    .setDisplaySize(options.width ?? 72, options.height ?? 36)
    .setDepth(options.depth ?? 2001)
    .setAlpha(options.alpha ?? 0.9)
    .setData('usesImagegenPromptSeal', true)
    .setData('advancePromptSealKind', kind)
    .setData('advancePromptSealFrameIndex', frameIndex);
  seal.setBlendMode(Phaser.BlendModes.ADD);

  if (options.pulse ?? true) {
    scene.tweens.add({
      targets: seal,
      alpha: { from: 0.68, to: 1 },
      scaleX: seal.scaleX * 1.05,
      scaleY: seal.scaleY * 1.05,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  publishAdvancePromptSealRuntime(scene, {
    scene: options.sceneId ?? scene.scene.key,
    kind,
    usesImagegenPromptSeal: true,
    visibleTextPrompt: false,
    textureKey,
    frameIndex,
  });

  return seal;
}

function ensureAdvancePromptSealFrame(scene: Phaser.Scene, frameIndex: number): string {
  const texture = scene.textures.get(TextureKeys.AdvancePromptSeal) as Phaser.Textures.Texture & {
    has?: (name: string) => boolean;
  };
  const frameName = `advance-prompt-seal-${frameIndex}`;
  if (typeof texture.has === 'function' && texture.has(frameName)) return frameName;
  const source = texture.getSourceImage() as { width?: number; height?: number };
  const frameWidth = Math.max(1, Math.floor(Number(source.width ?? 2172) / 3));
  const frameHeight = Math.max(1, Math.floor(Number(source.height ?? 724)));
  const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 2);
  texture.add(frameName, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
  return frameName;
}

function publishAdvancePromptSealRuntime(scene: Phaser.Scene, payload: {
  scene: string;
  kind: AdvancePromptSealKind;
  usesImagegenPromptSeal: boolean;
  visibleTextPrompt: boolean;
  textureKey: string;
  frameIndex: number;
}): void {
  (window as Window & {
    __CODEJITSU_ADVANCE_PROMPT_SEAL?: typeof payload & { at: number };
  }).__CODEJITSU_ADVANCE_PROMPT_SEAL = {
    ...payload,
    at: Math.round(performance.now()),
  };
}
