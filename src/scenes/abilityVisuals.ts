import Phaser from 'phaser';
import { abilities } from '../data/abilities';
import { TextureKeys } from './sceneKeys';

export interface AbilityIconCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

export interface AbilityEffectCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  abilityIndex: number;
  frameIndex: number;
}

export function abilityIconIndex(abilityId: string): number {
  return Math.max(0, abilities.findIndex((ability) => ability.id === abilityId));
}

export function getAbilityIconCrop(scene: Phaser.Scene, abilityId: string): AbilityIconCrop | undefined {
  if (!scene.textures.exists(TextureKeys.AbilityVowCards)) {
    return undefined;
  }
  const texture = scene.textures.get(TextureKeys.AbilityVowCards);
  const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const sourceWidth = Number(source.width ?? 0);
  const sourceHeight = Number(source.height ?? 0);
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return undefined;
  }
  const index = Math.min(abilities.length - 1, abilityIconIndex(abilityId));
  const panelWidth = Math.floor(sourceWidth / abilities.length);
  const cropX = Math.min(sourceWidth - panelWidth, index * panelWidth);
  const cropSize = Math.min(panelWidth, sourceHeight);
  const cropY = Phaser.Math.Clamp(Math.round((sourceHeight - cropSize) / 2) - Math.round(cropSize * 0.06), 0, sourceHeight - cropSize);
  return {
    x: cropX,
    y: cropY,
    width: index === abilities.length - 1 ? sourceWidth - cropX : panelWidth,
    height: cropSize,
    index,
  };
}

export function addAbilityIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  abilityId: string,
  size: number,
  depth: number,
): Phaser.GameObjects.Image | undefined {
  const crop = getAbilityIconCrop(scene, abilityId);
  if (!crop) {
    return undefined;
  }
  const texture = scene.textures.get(TextureKeys.AbilityVowCards) as Phaser.Textures.Texture & {
    frames: Record<string, Phaser.Textures.Frame>;
  };
  const frameKey = `ability-${abilityId}`;
  if (!texture.frames[frameKey]) {
    texture.add(frameKey, 0, crop.x, crop.y, crop.width, crop.height);
  }
  return scene.add.image(x, y, TextureKeys.AbilityVowCards, frameKey)
    .setDisplaySize(size, size)
    .setDepth(depth);
}

export function publishAbilityArtRuntime(scene: Phaser.Scene): void {
  const texture = scene.textures.exists(TextureKeys.AbilityVowCards) ? scene.textures.get(TextureKeys.AbilityVowCards) : undefined;
  const source = texture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  const effectsTexture = scene.textures.exists(TextureKeys.AbilityVowEffects) ? scene.textures.get(TextureKeys.AbilityVowEffects) : undefined;
  const effectsSource = effectsTexture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  (window as Window & {
    __CODEJITSU_ABILITY_ART?: {
      textureLoaded: boolean;
      sourceWidth: number;
      sourceHeight: number;
      effectTextureLoaded: boolean;
      effectSourceWidth: number;
      effectSourceHeight: number;
      effectFrameRows: number;
      effectFrameColumns: number;
      cards: Array<{ abilityId: string; displayName: string; iconIndex: number; crop?: AbilityIconCrop }>;
      at: number;
    };
  }).__CODEJITSU_ABILITY_ART = {
    textureLoaded: Boolean(texture && source),
    sourceWidth: Number(source?.width ?? 0),
    sourceHeight: Number(source?.height ?? 0),
    effectTextureLoaded: Boolean(effectsTexture && effectsSource),
    effectSourceWidth: Number(effectsSource?.width ?? 0),
    effectSourceHeight: Number(effectsSource?.height ?? 0),
    effectFrameRows: 3,
    effectFrameColumns: abilities.length,
    cards: abilities.map((ability) => ({
      abilityId: ability.id,
      displayName: ability.displayName,
      iconIndex: abilityIconIndex(ability.id),
      crop: getAbilityIconCrop(scene, ability.id),
    })),
    at: Math.round(performance.now()),
  };
}

function getAbilityEffectCrop(scene: Phaser.Scene, abilityId: string, frameIndex: number): AbilityEffectCrop | undefined {
  if (!scene.textures.exists(TextureKeys.AbilityVowEffects)) {
    return undefined;
  }
  const texture = scene.textures.get(TextureKeys.AbilityVowEffects);
  const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const sourceWidth = Number(source.width ?? 0);
  const sourceHeight = Number(source.height ?? 0);
  if (sourceWidth <= 0 || sourceHeight <= 0) return undefined;
  const abilityIndex = Math.min(abilities.length - 1, abilityIconIndex(abilityId));
  const width = Math.floor(sourceWidth / abilities.length);
  const height = Math.floor(sourceHeight / 3);
  const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 2);
  return {
    x: abilityIndex * width,
    y: safeFrame * height,
    width,
    height,
    abilityIndex,
    frameIndex: safeFrame,
  };
}

function ensureAbilityEffectFrame(scene: Phaser.Scene, abilityId: string, frameIndex: number): string | undefined {
  const crop = getAbilityEffectCrop(scene, abilityId, frameIndex);
  if (!crop) return undefined;
  const texture = scene.textures.get(TextureKeys.AbilityVowEffects) as Phaser.Textures.Texture & {
    frames: Record<string, Phaser.Textures.Frame>;
  };
  const frameKey = `vow-effect-${abilityId}-${frameIndex}`;
  if (!texture.frames[frameKey]) {
    texture.add(frameKey, 0, crop.x, crop.y, crop.width, crop.height);
  }
  return frameKey;
}

function addAbilityEffectBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  abilityId: string,
  depth: number,
): Phaser.GameObjects.Image | undefined {
  const frame = ensureAbilityEffectFrame(scene, abilityId, 0);
  if (!frame) return undefined;
  const effect = scene.add.image(x, y - 38, TextureKeys.AbilityVowEffects, frame)
    .setDisplaySize(168, 168)
    .setDepth(depth + 1)
    .setAlpha(0.88)
    .setBlendMode(Phaser.BlendModes.ADD);
  effect.setData('usesGeneratedEffect', true);
  effect.setData('effectFrameCount', 3);
  [1, 2].forEach((frameIndex) => {
    scene.time.delayedCall(frameIndex * 130, () => {
      const nextFrame = ensureAbilityEffectFrame(scene, abilityId, frameIndex);
      if (nextFrame && effect.active) effect.setFrame(nextFrame);
    });
  });
  scene.tweens.add({
    targets: effect,
    y: y - 90,
    alpha: 0,
    scaleX: effect.scaleX * 1.32,
    scaleY: effect.scaleY * 1.32,
    duration: 640,
    ease: 'Quad.Out',
    onComplete: () => effect.destroy(),
  });
  return effect;
}

export function addAbilityCastBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  abilityId: string,
  depth: number,
): Phaser.GameObjects.Image | undefined {
  const effect = addAbilityEffectBurst(scene, x, y, abilityId, depth);
  const icon = addAbilityIcon(scene, x, y - 72, abilityId, 72, depth);
  const published = icon ?? effect;
  if (!published) return undefined;
  published.setData('usesGeneratedEffect', Boolean(effect));
  published.setData('effectFrameCount', effect ? 3 : 0);
  if (!icon) return published;
  icon.setAlpha(0.95);
  scene.tweens.add({
    targets: icon,
    y: y - 108,
    alpha: 0,
    scaleX: icon.scaleX * 1.32,
    scaleY: icon.scaleY * 1.32,
    duration: 640,
    ease: 'Quad.Out',
    onComplete: () => icon.destroy(),
  });
  return published;
}
