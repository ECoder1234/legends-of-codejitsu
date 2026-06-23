import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

export type CombatHitMarkKind = 'vow' | 'counter' | 'hurt' | 'finish';

interface CombatHitMarkOptions {
  width?: number;
  height?: number;
  depth?: number;
  alpha?: number;
  tint?: number;
  sceneId?: string;
  abilityId?: string;
  lifespanMs?: number;
  driftY?: number;
}

const frameIndexByKind: Record<CombatHitMarkKind, number> = {
  vow: 0,
  counter: 1,
  hurt: 2,
  finish: 3,
};

export function addCombatHitMark(
  scene: Phaser.Scene,
  kind: CombatHitMarkKind,
  x: number,
  y: number,
  options: CombatHitMarkOptions = {},
): Phaser.GameObjects.Image | undefined {
  const textureKey = TextureKeys.CombatHitMarks;
  const frameIndex = frameIndexByKind[kind];
  if (!scene.textures.exists(textureKey)) {
    publishCombatHitMarkRuntime(scene, {
      scene: options.sceneId ?? scene.scene.key,
      kind,
      abilityId: options.abilityId,
      usesImagegenCombatHitMark: false,
      primitiveTextLabels: 0,
      visibleTextLabels: false,
      textureKey: 'missing',
      frameIndex,
    });
    return undefined;
  }

  const frame = ensureCombatHitMarkFrame(scene, frameIndex);
  const mark = scene.add.image(x, y, textureKey, frame)
    .setDepth(options.depth ?? y + 130)
    .setAlpha(options.alpha ?? 0.88)
    .setData('usesImagegenCombatHitMark', true)
    .setData('combatHitMarkFrameIndex', frameIndex)
    .setData('combatHitMarkKind', kind)
    .setData('combatHitMarkTextureKey', textureKey);

  mark.setDisplaySize(options.width ?? (kind === 'finish' ? 116 : 154), options.height ?? (kind === 'counter' ? 118 : 96));
  const baseScaleX = mark.scaleX;
  const baseScaleY = mark.scaleY;
  const startScale = 0.74;
  const endScale = kind === 'counter' ? 1.18 : 1.04;
  mark.setScale(baseScaleX * startScale, baseScaleY * startScale);
  mark.setBlendMode(Phaser.BlendModes.ADD);
  if (options.tint !== undefined) mark.setTint(options.tint);

  const lifespanMs = options.lifespanMs ?? 560;
  scene.tweens.add({
    targets: mark,
    y: y + (options.driftY ?? -24),
    alpha: 0,
    scaleX: baseScaleX * endScale,
    scaleY: baseScaleY * endScale,
    duration: lifespanMs,
    ease: 'Quad.Out',
    onComplete: () => {
      if (mark.active) mark.destroy();
    },
  });

  publishCombatHitMarkRuntime(scene, {
    scene: options.sceneId ?? scene.scene.key,
    kind,
    abilityId: options.abilityId,
    usesImagegenCombatHitMark: true,
    primitiveTextLabels: 0,
    visibleTextLabels: false,
    textureKey,
    frameIndex,
  });

  return mark;
}

function ensureCombatHitMarkFrame(scene: Phaser.Scene, frameIndex: number): string {
  const texture = scene.textures.get(TextureKeys.CombatHitMarks) as Phaser.Textures.Texture & {
    has?: (name: string) => boolean;
  };
  const frameName = `combat-hit-mark-${frameIndex}`;
  if (typeof texture.has === 'function' && texture.has(frameName)) return frameName;
  const source = texture.getSourceImage() as { width?: number; height?: number };
  const frameWidth = Math.max(1, Math.floor(Number(source.width ?? 1774) / 4));
  const frameHeight = Math.max(1, Math.floor(Number(source.height ?? 887)));
  const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
  texture.add(frameName, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
  return frameName;
}

function publishCombatHitMarkRuntime(scene: Phaser.Scene, payload: {
  scene: string;
  kind: CombatHitMarkKind;
  abilityId?: string;
  usesImagegenCombatHitMark: boolean;
  primitiveTextLabels: number;
  visibleTextLabels: boolean;
  textureKey: string;
  frameIndex: number;
}): void {
  (window as Window & {
    __CODEJITSU_COMBAT_HIT_MARK?: typeof payload & { at: number };
  }).__CODEJITSU_COMBAT_HIT_MARK = {
    ...payload,
    at: Math.round(performance.now()),
  };
}
