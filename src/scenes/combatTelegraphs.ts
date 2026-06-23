import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

export type TelegraphSigilKind = 'lane' | 'ring' | 'burst' | 'cage' | 'pursuit' | 'palm';

const sigilIndex: Record<TelegraphSigilKind, number> = {
  lane: 0,
  ring: 1,
  burst: 2,
  cage: 3,
  pursuit: 4,
  palm: 5,
};

interface TelegraphRuntimeEntry {
  scene: string;
  kind: TelegraphSigilKind;
  textureKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  generated: boolean;
  at: number;
}

export function addGeneratedTelegraphSigil(
  scene: Phaser.Scene,
  sceneId: string,
  kind: TelegraphSigilKind,
  x: number,
  y: number,
  options: {
    width?: number;
    height?: number;
    depth?: number;
    rotation?: number;
    alpha?: number;
    tint?: number;
    lifespanMs?: number;
  } = {},
): Phaser.GameObjects.Image | undefined {
  const textureKey = textureKeyForTelegraph(scene, sceneId);
  if (!textureKey) return undefined;
  const frame = ensureTelegraphFrame(scene, textureKey, kind);
  const width = options.width ?? (kind === 'lane' ? 130 : 112);
  const height = options.height ?? (kind === 'lane' ? 196 : 112);
  const image = scene.add.image(x, y, textureKey, frame)
    .setDisplaySize(width, height)
    .setAlpha(options.alpha ?? 0.66)
    .setDepth(options.depth ?? y + 20)
    .setRotation(options.rotation ?? 0)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (options.tint !== undefined) image.setTint(options.tint);
  image.setData('generatedTelegraph', true);
  image.setData('telegraphKind', kind);
  image.setData('telegraphTextureKey', textureKey);
  publishTelegraphRuntime(sceneId, kind, textureKey, x, y, width, height, image.alpha);
  scene.tweens.add({
    targets: image,
    alpha: { from: image.alpha * 0.56, to: image.alpha },
    scaleX: image.scaleX * 1.08,
    scaleY: image.scaleY * 1.08,
    duration: Math.min(520, Math.max(160, (options.lifespanMs ?? 620) * 0.52)),
    yoyo: true,
    repeat: options.lifespanMs && options.lifespanMs > 900 ? 1 : 0,
    ease: 'Sine.InOut',
  });
  if (options.lifespanMs) {
    scene.time.delayedCall(options.lifespanMs, () => image.destroy());
  }
  return image;
}

export function publishTelegraphAssetRuntime(scene: Phaser.Scene): void {
  const texture = scene.textures.exists(TextureKeys.CombatTelegraphSigils)
    ? scene.textures.get(TextureKeys.CombatTelegraphSigils)
    : undefined;
  const bossTexture = scene.textures.exists(TextureKeys.BossTelegraphSigils)
    ? scene.textures.get(TextureKeys.BossTelegraphSigils)
    : undefined;
  const source = texture?.getSourceImage() as { width?: number; height?: number } | undefined;
  const bossSource = bossTexture?.getSourceImage() as { width?: number; height?: number } | undefined;
  (window as Window & {
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
  }).__CODEJITSU_TELEGRAPH_ASSET = {
    textureLoaded: Boolean(texture),
    textureKey: TextureKeys.CombatTelegraphSigils,
    sourceWidth: Number(source?.width ?? 0),
    sourceHeight: Number(source?.height ?? 0),
    frameCount: 6,
    generated: Boolean(texture),
    bossTextureLoaded: Boolean(bossTexture),
    bossTextureKey: TextureKeys.BossTelegraphSigils,
    bossSourceWidth: Number(bossSource?.width ?? 0),
    bossSourceHeight: Number(bossSource?.height ?? 0),
    at: Math.round(performance.now()),
  };
}

function textureKeyForTelegraph(scene: Phaser.Scene, sceneId: string): string | undefined {
  if (sceneId === 'boss' && scene.textures.exists(TextureKeys.BossTelegraphSigils)) {
    return TextureKeys.BossTelegraphSigils;
  }
  if (scene.textures.exists(TextureKeys.CombatTelegraphSigils)) {
    return TextureKeys.CombatTelegraphSigils;
  }
  if (scene.textures.exists(TextureKeys.BossTelegraphSigils)) {
    return TextureKeys.BossTelegraphSigils;
  }
  return undefined;
}

function ensureTelegraphFrame(scene: Phaser.Scene, textureKey: string, kind: TelegraphSigilKind): string {
  const texture = scene.textures.get(textureKey) as Phaser.Textures.Texture & {
    has?: (name: string) => boolean;
  };
  const frameName = `${textureKey}-telegraph-${kind}`;
  if (texture.has?.(frameName)) return frameName;
  const source = texture.getSourceImage() as { width?: number; height?: number };
  const sourceWidth = Number(source.width ?? 0);
  const sourceHeight = Number(source.height ?? 0);
  const frameWidth = Math.max(1, Math.floor(sourceWidth / 6));
  texture.add(frameName, 0, sigilIndex[kind] * frameWidth, 0, frameWidth, sourceHeight);
  return frameName;
}

function publishTelegraphRuntime(
  sceneId: string,
  kind: TelegraphSigilKind,
  textureKey: string,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
): void {
  const runtime = window as Window & {
    __CODEJITSU_GENERATED_TELEGRAPHS?: TelegraphRuntimeEntry[];
  };
  const entry: TelegraphRuntimeEntry = {
    scene: sceneId,
    kind,
    textureKey,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: Math.round(width),
    height: Math.round(height),
    alpha: Math.round(alpha * 100) / 100,
    generated: true,
    at: Math.round(performance.now()),
  };
  runtime.__CODEJITSU_GENERATED_TELEGRAPHS = [
    ...(runtime.__CODEJITSU_GENERATED_TELEGRAPHS ?? []),
    entry,
  ].slice(-80);
}
