import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

export type BossImpactVfxKind = 'slash-line' | 'crescent' | 'ring' | 'pillar' | 'palm' | 'footprint';

const frameIndex: Record<BossImpactVfxKind, number> = {
  'slash-line': 0,
  crescent: 1,
  ring: 2,
  pillar: 3,
  palm: 4,
  footprint: 5,
};

interface BossImpactVfxRuntimeEntry {
  scene: string;
  kind: BossImpactVfxKind;
  textureKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  generated: boolean;
  at: number;
}

export function addBossImpactVfx(
  scene: Phaser.Scene,
  kind: BossImpactVfxKind,
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
    scaleOut?: number;
    sceneId?: string;
  } = {},
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(TextureKeys.BossImpactVfx)) return undefined;
  const frame = ensureBossImpactFrame(scene, kind);
  const width = options.width ?? 180;
  const height = options.height ?? 118;
  const image = scene.add.image(x, y, TextureKeys.BossImpactVfx, frame)
    .setOrigin(0.5)
    .setDisplaySize(width, height)
    .setDepth(options.depth ?? y + 24)
    .setRotation(options.rotation ?? 0)
    .setAlpha(options.alpha ?? 0.82)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (options.tint !== undefined) image.setTint(options.tint);
  image.setData('usesImagegenBossImpactVfx', true);
  image.setData('bossImpactVfxKind', kind);
  publishBossImpactRuntime(options.sceneId ?? 'boss', kind, x, y, width, height);
  if (options.lifespanMs) {
    scene.tweens.add({
      targets: image,
      alpha: 0,
      scaleX: image.scaleX * (options.scaleOut ?? 1.18),
      scaleY: image.scaleY * (options.scaleOut ?? 1.18),
      duration: options.lifespanMs,
      ease: 'Quad.Out',
      onComplete: () => image.destroy(),
    });
  }
  return image;
}

function ensureBossImpactFrame(scene: Phaser.Scene, kind: BossImpactVfxKind): string {
  const texture = scene.textures.get(TextureKeys.BossImpactVfx) as Phaser.Textures.Texture & {
    has?: (name: string) => boolean;
  };
  const frameName = `boss-impact-${kind}`;
  if (texture.has?.(frameName)) return frameName;
  const source = texture.getSourceImage() as { width?: number; height?: number };
  const sourceWidth = Number(source.width ?? 1680);
  const sourceHeight = Number(source.height ?? 512);
  const safeIndex = frameIndex[kind];
  const frameWidth = Math.max(1, Math.floor(sourceWidth / 6));
  const cropX = safeIndex * frameWidth;
  const cropWidth = safeIndex === 5 ? sourceWidth - cropX : frameWidth;
  texture.add(frameName, 0, cropX, 0, cropWidth, sourceHeight);
  return frameName;
}

function publishBossImpactRuntime(
  sceneId: string,
  kind: BossImpactVfxKind,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const runtime = window as Window & {
    __CODEJITSU_BOSS_IMPACT_VFX?: BossImpactVfxRuntimeEntry[];
    __CODEJITSU_IMPACT_VFX?: BossImpactVfxRuntimeEntry[];
  };
  const entry: BossImpactVfxRuntimeEntry = {
    scene: sceneId,
    kind,
    textureKey: TextureKeys.BossImpactVfx,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: Math.round(width),
    height: Math.round(height),
    generated: true,
    at: Math.round(performance.now()),
  };
  runtime.__CODEJITSU_IMPACT_VFX = [
    ...(runtime.__CODEJITSU_IMPACT_VFX ?? []),
    entry,
  ].slice(-100);
  if (sceneId === 'boss') {
    runtime.__CODEJITSU_BOSS_IMPACT_VFX = [
      ...(runtime.__CODEJITSU_BOSS_IMPACT_VFX ?? []),
      entry,
    ].slice(-100);
  }
}
