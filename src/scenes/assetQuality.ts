import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

interface BackdropQualityEntry {
  key: string;
  role: string;
  exists: boolean;
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  coversCanvas: boolean;
  fullResolution: boolean;
  noUpscaleNeeded: boolean;
  at: number;
}

interface CombatSheetQualityEntry {
  key: string;
  role: string;
  exists: boolean;
  sourceWidth: number;
  sourceHeight: number;
  minimumWidth: number;
  minimumHeight: number;
  highResolution: boolean;
  transparentCapable: boolean;
  alphaSampled: boolean;
  transparentCorners: boolean;
  edgeBleedScore: number;
  cleanTransparentEdges: boolean;
  generatedCombatSheet: boolean;
  notFallbackAtlas: boolean;
  at: number;
}

const backdropTextures: Array<{ key: string; role: string }> = [
  { key: TextureKeys.TitleKeyArt, role: 'title-cover' },
  { key: TextureKeys.ArchiveMemory, role: 'story-archive' },
  { key: TextureKeys.BrokenDojo, role: 'dojo-map' },
  { key: TextureKeys.DungeonGate, role: 'dungeon-map' },
  { key: TextureKeys.NullOniArena, role: 'boss-map' },
  { key: TextureKeys.ForegroundDepth, role: 'foreground-depth' },
  { key: TextureKeys.Chapter2OutdoorTrail, role: 'chapter2-outdoor-map' },
  { key: TextureKeys.Chapter2StageGateLoop, role: 'chapter2-stage-gate-loop' },
  { key: TextureKeys.Chapter2StageBooleanSwitchback, role: 'chapter2-stage-boolean-switchback' },
  { key: TextureKeys.Chapter2StageArrayShrine, role: 'chapter2-stage-array-shrine' },
  { key: TextureKeys.Chapter2StageRuntimeRavine, role: 'chapter2-stage-runtime-ravine' },
  { key: TextureKeys.Chapter2StageReturnThreshold, role: 'chapter2-stage-return-threshold' },
  { key: TextureKeys.Chapter2RevengeArena, role: 'chapter2-boss-map' },
  { key: TextureKeys.GatePortal, role: 'gate-portal' },
  { key: TextureKeys.ResultBackdrop, role: 'result-cinematic-backdrop' },
  { key: TextureKeys.ResultVictoryBackdrop, role: 'result-victory-backdrop' },
  { key: TextureKeys.ResultDeathBackdrop, role: 'result-death-backdrop' },
  { key: TextureKeys.Chapter2VowInterlude, role: 'chapter2-vow-interlude' },
];

const combatSheetTextures: Array<{ key: string; role: string; minimumWidth: number; minimumHeight: number }> = [
  { key: TextureKeys.ApprenticeCombat, role: 'apprentice-combat', minimumWidth: 1400, minimumHeight: 900 },
  { key: TextureKeys.MasterKeikoCombat, role: 'master-keiko-combat', minimumWidth: 1400, minimumHeight: 900 },
  { key: TextureKeys.BinarySentinelCombat, role: 'binary-sentinel-combat', minimumWidth: 1400, minimumHeight: 900 },
  { key: TextureKeys.NullOniBossCombat, role: 'null-oni-boss-combat', minimumWidth: 1400, minimumHeight: 900 },
  { key: TextureKeys.ReturnOniSheet, role: 'return-oni-combat', minimumWidth: 1400, minimumHeight: 900 },
  { key: TextureKeys.Chapter2MinionVariants, role: 'chapter2-minion-variants', minimumWidth: 1400, minimumHeight: 800 },
];

export function publishGeneratedBackdropQuality(scene: Phaser.Scene): void {
  const canvasWidth = Number(scene.game.config.width ?? 1280);
  const canvasHeight = Number(scene.game.config.height ?? 720);
  const entries = backdropTextures.map(({ key, role }) => {
    const exists = scene.textures.exists(key);
    const source = exists
      ? scene.textures.get(key).getSourceImage() as { width?: number; height?: number }
      : undefined;
    const sourceWidth = Number(source?.width ?? 0);
    const sourceHeight = Number(source?.height ?? 0);
    const coverScale = sourceWidth > 0 && sourceHeight > 0
      ? Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
      : 0;
    return {
      key,
      role,
      exists,
      sourceWidth,
      sourceHeight,
      canvasWidth,
      canvasHeight,
      coversCanvas: coverScale > 0 && sourceWidth * coverScale >= canvasWidth && sourceHeight * coverScale >= canvasHeight,
      fullResolution: sourceWidth >= canvasWidth && sourceHeight >= canvasHeight,
      noUpscaleNeeded: coverScale > 0 && coverScale <= 1,
      at: Math.round(performance.now()),
    };
  });

  (window as Window & {
    __CODEJITSU_BACKDROP_QUALITY?: BackdropQualityEntry[];
  }).__CODEJITSU_BACKDROP_QUALITY = entries;
}

export function publishGeneratedCombatSheetQuality(scene: Phaser.Scene): void {
  const entries = combatSheetTextures.map(({ key, role, minimumWidth, minimumHeight }) => {
    const exists = scene.textures.exists(key);
    const texture = exists ? scene.textures.get(key) : undefined;
    const source = texture?.getSourceImage() as { width?: number; height?: number; complete?: boolean } | undefined;
    const sourceWidth = Number(source?.width ?? 0);
    const sourceHeight = Number(source?.height ?? 0);
    const alpha = sampleTextureAlpha(source);
    return {
      key,
      role,
      exists,
      sourceWidth,
      sourceHeight,
      minimumWidth,
      minimumHeight,
      highResolution: sourceWidth >= minimumWidth && sourceHeight >= minimumHeight,
      transparentCapable: alpha.alphaSampled && alpha.transparentCorners,
      alphaSampled: alpha.alphaSampled,
      transparentCorners: alpha.transparentCorners,
      edgeBleedScore: alpha.edgeBleedScore,
      cleanTransparentEdges: alpha.cleanTransparentEdges,
      generatedCombatSheet: exists && key !== TextureKeys.Chapter1Characters && key !== TextureKeys.SpriteAtlas,
      notFallbackAtlas: key !== TextureKeys.SpriteAtlas && key !== TextureKeys.Hero && key !== TextureKeys.Mentor && key !== TextureKeys.NullOni,
      at: Math.round(performance.now()),
    };
  });

  (window as Window & {
    __CODEJITSU_COMBAT_SHEET_QUALITY?: CombatSheetQualityEntry[];
  }).__CODEJITSU_COMBAT_SHEET_QUALITY = entries;
}

function sampleTextureAlpha(source: unknown): {
  alphaSampled: boolean;
  transparentCorners: boolean;
  edgeBleedScore: number;
  cleanTransparentEdges: boolean;
} {
  const image = source as CanvasImageSource & { width?: number; height?: number } | undefined;
  const width = Math.floor(Number(image?.width ?? 0));
  const height = Math.floor(Number(image?.height ?? 0));
  if (!image || width <= 0 || height <= 0) {
    return { alphaSampled: false, transparentCorners: false, edgeBleedScore: 1, cleanTransparentEdges: false };
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { alphaSampled: false, transparentCorners: false, edgeBleedScore: 1, cleanTransparentEdges: false };
    context.drawImage(image, 0, 0, width, height);
    const cornerSize = Math.min(44, Math.max(12, Math.floor(Math.min(width, height) / 24)));
    const corners = [
      context.getImageData(0, 0, cornerSize, cornerSize),
      context.getImageData(width - cornerSize, 0, cornerSize, cornerSize),
      context.getImageData(0, height - cornerSize, cornerSize, cornerSize),
      context.getImageData(width - cornerSize, height - cornerSize, cornerSize, cornerSize),
    ];
    const cornerOpaqueRatio = corners.reduce((sum, imageData) => sum + opaqueRatio(imageData, 16), 0) / corners.length;
    const strip = Math.min(32, Math.max(8, Math.floor(Math.min(width, height) / 36)));
    const edgeSamples = [
      context.getImageData(0, 0, width, strip),
      context.getImageData(0, height - strip, width, strip),
      context.getImageData(0, 0, strip, height),
      context.getImageData(width - strip, 0, strip, height),
    ];
    const edgeBleedScore = edgeSamples.reduce((sum, imageData) => sum + opaqueRatio(imageData, 24), 0) / edgeSamples.length;
    return {
      alphaSampled: true,
      transparentCorners: cornerOpaqueRatio < 0.02,
      edgeBleedScore: Math.round(edgeBleedScore * 1000) / 1000,
      cleanTransparentEdges: edgeBleedScore < 0.16,
    };
  } catch {
    return { alphaSampled: false, transparentCorners: false, edgeBleedScore: 1, cleanTransparentEdges: false };
  }
}

function opaqueRatio(imageData: ImageData, alphaThreshold: number): number {
  let opaque = 0;
  const total = imageData.data.length / 4;
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] > alphaThreshold) opaque += 1;
  }
  return total > 0 ? opaque / total : 1;
}
