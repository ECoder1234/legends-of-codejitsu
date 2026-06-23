import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

export type ResultVfxKind =
  | 'victory-ring'
  | 'retry-seal'
  | 'gold-sparks'
  | 'mask-shards'
  | 'archive-motes'
  | 'null-smoke'
  | 'return-seam'
  | 'ember-burst';

const frameIndex: Record<ResultVfxKind, number> = {
  'victory-ring': 0,
  'retry-seal': 1,
  'gold-sparks': 2,
  'mask-shards': 3,
  'archive-motes': 4,
  'null-smoke': 5,
  'return-seam': 6,
  'ember-burst': 7,
};

export function addResultVfx(
  scene: Phaser.Scene,
  kind: ResultVfxKind,
  x: number,
  y: number,
  options: {
    width?: number;
    height?: number;
    depth?: number;
    alpha?: number;
    rotation?: number;
    tint?: number;
    blendMode?: Phaser.BlendModes;
  } = {},
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(TextureKeys.ResultRitualVfx)) return undefined;
  const frame = ensureResultVfxFrame(scene, kind);
  const image = scene.add.image(x, y, TextureKeys.ResultRitualVfx, frame)
    .setDisplaySize(options.width ?? 160, options.height ?? 130)
    .setDepth(options.depth ?? y)
    .setAlpha(options.alpha ?? 0.78)
    .setRotation(options.rotation ?? 0)
    .setBlendMode(options.blendMode ?? Phaser.BlendModes.ADD);
  if (options.tint !== undefined) image.setTint(options.tint);
  image.setData('usesGeneratedResultVfx', true);
  image.setData('resultVfxKind', kind);
  return image;
}

export function resultVfxAssetInfo(scene: Phaser.Scene): {
  textureLoaded: boolean;
  textureKey: string;
  sourceWidth: number;
  sourceHeight: number;
  frameCount: number;
} {
  const texture = scene.textures.exists(TextureKeys.ResultRitualVfx)
    ? scene.textures.get(TextureKeys.ResultRitualVfx)
    : undefined;
  const source = texture?.getSourceImage() as { width?: number; height?: number } | undefined;
  return {
    textureLoaded: Boolean(texture),
    textureKey: TextureKeys.ResultRitualVfx,
    sourceWidth: Number(source?.width ?? 0),
    sourceHeight: Number(source?.height ?? 0),
    frameCount: 8,
  };
}

function ensureResultVfxFrame(scene: Phaser.Scene, kind: ResultVfxKind): string {
  const texture = scene.textures.get(TextureKeys.ResultRitualVfx) as Phaser.Textures.Texture & {
    has?: (name: string) => boolean;
  };
  const frameName = `result-vfx-${kind}`;
  if (texture.has?.(frameName)) return frameName;
  const source = texture.getSourceImage() as { width?: number; height?: number };
  const sourceWidth = Number(source.width ?? 0);
  const sourceHeight = Number(source.height ?? 0);
  const cellWidth = Math.max(1, Math.floor(sourceWidth / 4));
  const cellHeight = Math.max(1, Math.floor(sourceHeight / 2));
  const index = frameIndex[kind];
  texture.add(frameName, 0, (index % 4) * cellWidth, Math.floor(index / 4) * cellHeight, cellWidth, cellHeight);
  return frameName;
}
