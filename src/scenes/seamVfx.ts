import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

export type SeamVfxKind = 'trail' | 'wisp' | 'slash' | 'burst' | 'spark' | 'crescent' | 'seal' | 'motes';

const frameIndex: Record<SeamVfxKind, number> = {
  trail: 0,
  wisp: 1,
  slash: 2,
  burst: 3,
  spark: 4,
  crescent: 5,
  seal: 6,
  motes: 7,
};

interface SeamVfxRuntimeEntry {
  scene: string;
  kind: SeamVfxKind;
  textureKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  generated: boolean;
  at: number;
}

export function addSeamVfx(
  scene: Phaser.Scene,
  sceneId: string,
  kind: SeamVfxKind,
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
    blendMode?: Phaser.BlendModes;
  } = {},
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(TextureKeys.SeamVfx)) return undefined;
  const frame = ensureSeamVfxFrame(scene, kind);
  const width = options.width ?? 112;
  const height = options.height ?? 92;
  const image = scene.add.image(x, y, TextureKeys.SeamVfx, frame)
    .setDisplaySize(width, height)
    .setOrigin(0.5)
    .setAlpha(options.alpha ?? 0.72)
    .setDepth(options.depth ?? y + 2)
    .setRotation(options.rotation ?? 0)
    .setBlendMode(options.blendMode ?? Phaser.BlendModes.ADD);
  if (options.tint !== undefined) image.setTint(options.tint);
  image.setData('usesImagegenSeamVfx', true);
  image.setData('seamVfxKind', kind);
  publishSeamVfxRuntime(sceneId, kind, x, y, width, height);
  if (options.lifespanMs) {
    scene.time.delayedCall(options.lifespanMs, () => image.destroy());
  }
  return image;
}

function ensureSeamVfxFrame(scene: Phaser.Scene, kind: SeamVfxKind): string {
  const texture = scene.textures.get(TextureKeys.SeamVfx) as Phaser.Textures.Texture & {
    has?: (name: string) => boolean;
  };
  const frameName = `seam-vfx-${kind}`;
  if (texture.has?.(frameName)) return frameName;
  const source = texture.getSourceImage() as { width?: number; height?: number };
  const sourceWidth = Number(source.width ?? 1536);
  const sourceHeight = Number(source.height ?? 1024);
  const cellWidth = Math.max(1, Math.floor(sourceWidth / 4));
  const cellHeight = Math.max(1, Math.floor(sourceHeight / 2));
  const index = frameIndex[kind];
  texture.add(frameName, 0, (index % 4) * cellWidth, Math.floor(index / 4) * cellHeight, cellWidth, cellHeight);
  return frameName;
}

function publishSeamVfxRuntime(
  sceneId: string,
  kind: SeamVfxKind,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const runtime = window as Window & {
    __CODEJITSU_SEAM_VFX?: SeamVfxRuntimeEntry[];
  };
  runtime.__CODEJITSU_SEAM_VFX = [
    ...(runtime.__CODEJITSU_SEAM_VFX ?? []),
    {
      scene: sceneId,
      kind,
      textureKey: TextureKeys.SeamVfx,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(width),
      height: Math.round(height),
      generated: true,
      at: Math.round(performance.now()),
    },
  ].slice(-80);
}
