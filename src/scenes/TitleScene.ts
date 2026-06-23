import Phaser from 'phaser';
import { isTestMode } from '../systems/testMode';
import { installAudioUnlock } from './audioUnlock';
import { queueGeneratedChapterAssets } from './generatedAssets';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { fadeToScene } from './transition';
import { makePixelText, resumeAudio } from './ui';

export class TitleScene extends Phaser.Scene {
  private titleBackdrop?: Phaser.GameObjects.Image;
  private titleFallComplete = false;
  private titleMotionTrailCount = 0;
  private titleGeneratedFxPieces = 0;
  private titlePrimitiveFxPieces = 0;
  private titleGeneratedStaticDecorPieces = 0;
  private titlePrimitiveStaticDecorPieces = 0;
  private titlePromptUsesImagegenPanel = false;
  private titlePromptPrimitivePieces = 0;
  private titleVignetteUsesImagegen = false;
  private titlePrimitiveVignettePieces = 0;
  private titleShadowUsesImagegen = false;
  private titlePrimitiveShadowPieces = 0;
  private titleSkyGateUsesImagegen = false;
  private titlePrimitiveSkyGatePieces = 0;
  private titleImpactPlayed = false;
  private titleImpactCount = 0;
  private titleFallFromY: [number, number] = [-370, -250];
  private titleFallTargetY: [number, number] = [210, 328];

  constructor() {
    super(SceneKeys.Title);
  }

  create(): void {
    installAudioUnlock(this);
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'title';
    this.cameras.main.setBackgroundColor('#09070d');
    queueGeneratedChapterAssets(this);
    this.addTitleBackdrop();
    this.addSkyfallTitle();

    const start = () => {
      resumeAudio(this);
      fadeToScene(this, SceneKeys.Story, isTestMode() ? 180 : 300);
    };

    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);
  }

  private addTitleBackdrop(): void {
    if (this.textures.exists(TextureKeys.TitleKeyArt)) {
      this.titleBackdrop = this.addCoverImage(TextureKeys.TitleKeyArt, 1);
    } else {
      const sky = this.add.graphics();
      // Richer 4-stop gradient: deep void purple → mid crimson → warm amber horizon
      sky.fillGradientStyle(0x07050f, 0x07050f, 0x3a1428, 0x8b2e0a, 1, 1, 1, 1);
      sky.fillRect(0, 0, 1280, 720);
      // Secondary mid-band warmth
      const midGlow = this.add.graphics();
      midGlow.fillGradientStyle(0x000000, 0x000000, 0xb85d20, 0xb85d20, 0, 0, 0.18, 0.18);
      midGlow.fillRect(0, 380, 1280, 340);
      // Scanline overlay
      const scanlines = this.add.graphics().setAlpha(0.07).setDepth(7);
      for (let row = 0; row < 720; row += 4) {
        scanlines.fillStyle(0x000000, 1);
        scanlines.fillRect(0, row, 1280, 2);
      }
      // Ambient side glow columns
      const leftGlow = this.add.graphics().setDepth(6).setAlpha(0.13);
      leftGlow.fillGradientStyle(0x8f7dff, 0x000000, 0x8f7dff, 0x000000, 1, 0, 1, 0);
      leftGlow.fillRect(0, 0, 180, 720);
      const rightGlow = this.add.graphics().setDepth(6).setAlpha(0.13);
      rightGlow.fillGradientStyle(0x000000, 0x8f7dff, 0x000000, 0x8f7dff, 0, 1, 0, 1);
      rightGlow.fillRect(1100, 0, 180, 720);
      // Floor tiles
      for (let col = 0; col < 12; col += 1) {
        this.add.image(118 + col * 96, 602, TextureKeys.FloorTile).setAlpha(0.62);
      }
      // Central title glow halo
      const halo = this.add.ellipse(640, 275, 680, 180, 0xff2e63, 0.0)
        .setDepth(6)
        .setAlpha(0);
      this.tweens.add({
        targets: halo,
        alpha: 0.07,
        delay: 1100,
        duration: 800,
        ease: 'Sine.Out',
      });
    }

    this.addGeneratedTitleAmbientDebris();
    this.addTitleCinematicVignette();
  }

  private addTitleCinematicVignette(): void {
    this.titleVignetteUsesImagegen = this.textures.exists(TextureKeys.TitleCinematicVignette);
    this.titlePrimitiveVignettePieces = 0;
    if (this.titleVignetteUsesImagegen) {
      const source = this.textures.get(TextureKeys.TitleCinematicVignette).getSourceImage() as { width?: number; height?: number };
      const sourceWidth = Number(source.width ?? 1280);
      const sourceHeight = Number(source.height ?? 720);
      const scale = Math.max(1280 / Math.max(1, sourceWidth), 720 / Math.max(1, sourceHeight));
      this.add.image(640, 360, TextureKeys.TitleCinematicVignette)
        .setDisplaySize(Math.ceil(sourceWidth * scale), Math.ceil(sourceHeight * scale))
        .setDepth(8)
        .setAlpha(0.84)
        .setData('usesImagegenTitleVignette', true);
      return;
    }
  }

  private addCoverImage(textureKey: string, alpha: number): Phaser.GameObjects.Image {
    const source = this.textures.get(textureKey).getSourceImage() as { width?: number; height?: number };
    const sourceWidth = source.width ?? 1280;
    const sourceHeight = source.height ?? 720;
    const scale = Math.max(1280 / sourceWidth, 720 / sourceHeight);
    const image = this.add.image(640, 360, textureKey)
      .setDisplaySize(Math.ceil(sourceWidth * scale), Math.ceil(sourceHeight * scale))
      .setAlpha(alpha);
    image.setData('coverWidth', Math.ceil(sourceWidth * scale));
    image.setData('coverHeight', Math.ceil(sourceHeight * scale));
    return image;
  }

  private addSkyfallTitle(): void {
    const finalTopY = 210;
    const finalBottomY = 328;
    const lineGap = finalBottomY - finalTopY;
    const titleCenterY = (finalTopY + finalBottomY) / 2;
    const startCenterY = -420;
    const lineOffset = lineGap / 2;
    this.titleFallFromY = [Math.round(startCenterY - lineOffset), Math.round(startCenterY + lineOffset)];
    this.titleFallTargetY = [finalTopY, finalBottomY];

    this.addTitleSkyGate();

    const titleDrop = this.add.container(640, startCenterY).setDepth(20);
    const titleShadow = this.addTitleFxImage(2, 'title-drop-shadow', 0, 176, 560, 126, 0);
    this.titleShadowUsesImagegen = Boolean(titleShadow);
    this.titlePrimitiveShadowPieces = 0;
    if (titleShadow) {
      titleShadow
        .setScale(0.42, 0.5)
        .setAlpha(0);
      titleShadow.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    const topLine = makePixelText(this, 0, -lineOffset, 'LEGENDS OF', 80, '#f6ead3', 'center')
      .setOrigin(0.5)
      .setStroke('#09070d', 18)
      .setShadow(0, 8, '#241329', 0, true, true);
    const bottomLine = makePixelText(this, 0, lineOffset, 'CODEJITSU', 108, '#f6ead3', 'center')
      .setOrigin(0.5)
      .setStroke('#09070d', 20)
      .setShadow(0, 7, '#3a2130', 0, true, true);
    const slashLeft = this.addTitleFxImage(3, 'slash-left', -344, 0, 158, 86, 0);
    const slashRight = this.addTitleFxImage(3, 'slash-right', 344, 0, 158, 86, 0);
    slashLeft?.setRotation(-0.38);
    slashRight?.setRotation(0.38);
    if (slashRight) {
      slashRight.setFlipX(true);
    }
    titleDrop.add([titleShadow, slashLeft, slashRight, topLine, bottomLine].filter(Boolean) as Phaser.GameObjects.GameObject[]);
    topLine.setScale(0.9, 1.16);
    bottomLine.setScale(0.88, 1.18);
    titleDrop.setScale(1.08, 1.08);
    titleDrop.setAlpha(0.72);

    const startSeal = this.createStartPromptPanel();
    const startSealScale = {
      x: Number((startSeal as Phaser.GameObjects.GameObject & { scaleX?: number }).scaleX ?? 1),
      y: Number((startSeal as Phaser.GameObjects.GameObject & { scaleY?: number }).scaleY ?? 1),
    };

    const fallDelay = isTestMode() ? 0 : 80;
    const fallDuration = isTestMode() ? 520 : 1320;
    this.addTitleMotionTrails(fallDuration + fallDelay + 260);
    this.publishTitleLayout(false, startCenterY - lineOffset, startCenterY + lineOffset);
    this.tweens.add({
      targets: titleDrop,
      y: titleCenterY,
      alpha: { from: 0.72, to: 1 },
      scaleX: 1,
      scaleY: 1,
      rotation: { from: -0.018, to: 0 },
      delay: fallDelay,
      duration: fallDuration,
      ease: 'Bounce.Out',
      onUpdate: () => this.publishTitleLayout(false, titleDrop.y - lineOffset, titleDrop.y + lineOffset),
      onComplete: () => {
        this.titleFallComplete = true;
        this.addTitleLandingImpact();
        this.publishTitleLayout(true, finalTopY, finalBottomY);
        this.tweens.add({
          targets: startSeal,
          alpha: 1,
          duration: 260,
          ease: 'Sine.Out',
        });
        this.tweens.add({
          targets: startSeal,
          alpha: { from: 0.72, to: 1 },
          scaleX: startSealScale.x * 1.05,
          scaleY: startSealScale.y * 1.05,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      },
    });
    if (titleShadow) {
      this.tweens.add({
        targets: titleShadow,
        alpha: { from: 0, to: 0.58 },
        scaleX: { from: 0.42, to: 1 },
        scaleY: { from: 0.5, to: 1 },
        delay: fallDelay,
        duration: fallDuration,
        ease: 'Quad.Out',
      });
    }
    const generatedSlashes = [slashLeft, slashRight].filter(Boolean) as Phaser.GameObjects.Image[];
    if (generatedSlashes.length > 0) {
      this.tweens.add({
        targets: generatedSlashes,
        alpha: { from: 0.1, to: 0.72 },
        delay: Math.max(0, fallDelay + fallDuration * 0.24),
        duration: fallDuration * 0.72,
        ease: 'Sine.Out',
      });
    }
  }

  private createStartPromptPanel(): Phaser.GameObjects.GameObject {
    this.titlePromptUsesImagegenPanel = false;
    this.titlePromptPrimitivePieces = 0;
    return makePixelText(this, 640, 626, 'Click or press Enter to start', 22, '#f6ead3', 'center')
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0)
      .setStroke('#09070d', 8)
      .setData('usesImagegenPanel', false)
      .setData('visiblePromptText', true);
  }

  private addTitleSkyGate(): void {
    const generatedGate = this.addTitleFxImage(0, 'sky-rift', 640, 74, 560, 196, 18);
    if (generatedGate) {
      this.titleSkyGateUsesImagegen = true;
      this.titlePrimitiveSkyGatePieces = 0;
      generatedGate
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.88);
      this.tweens.add({
        targets: generatedGate,
        alpha: 0,
        scaleX: generatedGate.scaleX * 1.08,
        scaleY: generatedGate.scaleY * 0.72,
        delay: isTestMode() ? 230 : 640,
        duration: isTestMode() ? 240 : 620,
        ease: 'Sine.InOut',
        onComplete: () => generatedGate.destroy(),
      });
      return;
    }

    this.titleSkyGateUsesImagegen = false;
    this.titlePrimitiveSkyGatePieces = 0;
  }

  private addTitleMotionTrails(duration: number): void {
    const generatedFrame = this.ensureTitleFxFrame(1, 'fall-streaks');
    if (generatedFrame) {
      const streaks = [-420, -210, 0, 210, 420].map((offset, index) => this.add.image(640 + offset, 94 + index * 22, TextureKeys.TitleSkyfallFx, generatedFrame)
        .setDisplaySize(430, 340)
        .setDepth(16)
        .setAlpha(0.15 + (index % 3) * 0.08)
        .setBlendMode(Phaser.BlendModes.ADD));
      this.titleGeneratedFxPieces += streaks.length;
      this.titleMotionTrailCount = 20;
      streaks.forEach((streak, index) => {
        this.tweens.add({
          targets: streak,
          y: streak.y + Phaser.Math.Between(160, 260),
          alpha: 0,
          delay: index * (isTestMode() ? 28 : 56),
          duration,
          ease: 'Quad.Out',
          onComplete: () => streak.destroy(),
        });
      });
      return;
    }

    this.titleMotionTrailCount = 0;
  }

  private addGeneratedTitleAmbientDebris(): void {
    const frame = this.ensureTitleFxFrame(1, 'ambient-debris');
    if (!frame) return;

    const placements = [
      [82, 84, 18, 34], [176, 112, 14, 28], [296, 72, 16, 38], [412, 104, 12, 30],
      [872, 78, 15, 36], [1018, 112, 18, 32], [1138, 76, 13, 28], [1224, 140, 16, 34],
      [48, 292, 12, 24], [144, 392, 17, 30], [252, 492, 13, 28], [382, 556, 16, 28],
      [896, 520, 15, 30], [1036, 438, 13, 26], [1138, 344, 18, 32], [1240, 274, 12, 28],
      [72, 622, 18, 34], [228, 644, 12, 26], [514, 632, 14, 30], [764, 638, 14, 30],
      [1052, 626, 16, 34], [1210, 612, 12, 26], [34, 184, 14, 30], [1248, 188, 14, 30],
    ] as const;

    placements.forEach(([x, y, width, height], index) => {
      const debris = this.add.image(x, y, TextureKeys.TitleSkyfallFx, frame)
        .setDisplaySize(width, height)
        .setDepth(5)
        .setAlpha(0.13 + (index % 5) * 0.035)
        .setRotation(((index % 7) - 3) * 0.045)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setData('usesImagegenStaticDecor', true);
      this.tweens.add({
        targets: debris,
        y: y + 8 + (index % 6) * 4,
        alpha: 0.06 + (index % 4) * 0.025,
        duration: 1700 + (index % 8) * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this.titleGeneratedStaticDecorPieces += 1;
    });
  }

  private addTitleLandingImpact(): void {
    const frame = this.ensureTitleFxFrame(2, 'landing-impact');
    if (!frame) return;

    const crater = this.add.image(640, 398, TextureKeys.TitleSkyfallFx, frame)
      .setDisplaySize(560, 170)
      .setDepth(19)
      .setAlpha(0.76)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shock = this.add.image(640, 398, TextureKeys.TitleSkyfallFx, frame)
      .setDisplaySize(720, 220)
      .setDepth(18)
      .setAlpha(0.38)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.titleImpactPlayed = true;
    this.titleImpactCount += 2;
    this.titleGeneratedFxPieces += 2;

    this.tweens.add({
      targets: crater,
      alpha: { from: 0.76, to: 0.2 },
      scaleX: crater.scaleX * 1.04,
      scaleY: crater.scaleY * 1.08,
      duration: isTestMode() ? 680 : 920,
      ease: 'Sine.Out',
    });
    this.tweens.add({
      targets: shock,
      alpha: 0,
      scaleX: shock.scaleX * 1.18,
      scaleY: shock.scaleY * 1.2,
      duration: isTestMode() ? 620 : 840,
      ease: 'Quad.Out',
      onComplete: () => shock.destroy(),
    });
  }

  private addTitleFxImage(
    panelIndex: number,
    frameName: string,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
  ): Phaser.GameObjects.Image | undefined {
    const frame = this.ensureTitleFxFrame(panelIndex, frameName);
    if (!frame) return undefined;
    this.titleGeneratedFxPieces += 1;
    return this.add.image(x, y, TextureKeys.TitleSkyfallFx, frame)
      .setDisplaySize(width, height)
      .setDepth(depth)
      .setData('usesImagegenFx', true);
  }

  private ensureTitleFxFrame(panelIndex: number, frameName: string): string | undefined {
    if (!this.textures.exists(TextureKeys.TitleSkyfallFx)) return undefined;
    const texture = this.textures.get(TextureKeys.TitleSkyfallFx) as Phaser.Textures.Texture & {
      frames: Record<string, Phaser.Textures.Frame>;
    };
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const sourceWidth = Number(source.width ?? 0);
    const sourceHeight = Number(source.height ?? 0);
    if (sourceWidth <= 0 || sourceHeight <= 0) return undefined;
    const safePanel = Phaser.Math.Clamp(panelIndex, 0, 3);
    const panelWidth = Math.floor(sourceWidth / 4);
    const cropX = safePanel * panelWidth;
    const cropWidth = safePanel === 3 ? sourceWidth - cropX : panelWidth;
    const frameKey = `title-fx-${frameName}-${safePanel}`;
    if (!texture.frames[frameKey]) {
      texture.add(frameKey, 0, cropX, 0, cropWidth, sourceHeight);
    }
    return frameKey;
  }

  private publishTitleLayout(complete = this.titleFallComplete, topY = 210, bottomY = 328): void {
    const coverWidth = Number(this.titleBackdrop?.getData('coverWidth') ?? 1280);
    const coverHeight = Number(this.titleBackdrop?.getData('coverHeight') ?? 720);
    (window as Window & {
      __CODEJITSU_TITLE_LAYOUT?: {
        scene: string;
        title: string;
        coverWidth: number;
        coverHeight: number;
        coversCanvas: boolean;
        glitchLayers: number;
        retroLayers: number;
        sliceLayers: number;
        glyphLayers: number;
        titleLines: string[];
        prompt: string;
        visiblePromptText: boolean;
        hasCodeLeak: boolean;
        titleReadable: boolean;
        calmCover: boolean;
        coverMode: 'cover';
        titleFx: {
          usesImagegenSkyfallFx: boolean;
          textureKey: string;
          primitiveFxPieces: number;
          generatedFxPieces: number;
          panelCount: number;
          promptUsesImagegenPanel: boolean;
          promptPrimitivePieces: number;
          startPromptTextureKey: string;
          generatedStaticDecorPieces: number;
          primitiveStaticDecorPieces: number;
          usesImagegenVignette: boolean;
          primitiveVignettePieces: number;
          vignetteTextureKey: string;
          shadowUsesImagegen: boolean;
          primitiveShadowPieces: number;
          skyGateUsesImagegen: boolean;
          primitiveSkyGatePieces: number;
          primitiveSimpleShapeFallbackPieces: number;
          generatedOnlyTitleFx: boolean;
        };
        fallAnimation: {
          mode: 'sky-drop';
          brandedDrop: 'single-title-stack';
          pieces: number;
          fromY: number[];
          targetY: number[];
          currentY: number[];
          complete: boolean;
          impact: boolean;
          dropOrigin: 'sky';
          motionTrailCount: number;
          impactCount: number;
          dropDistancePx: number;
          skyHoldMs: number;
        };
      };
    }).__CODEJITSU_TITLE_LAYOUT = {
      scene: 'title',
      title: 'LEGENDS OF CODEJITSU',
      coverWidth,
      coverHeight,
      coversCanvas: coverWidth >= 1280 && coverHeight >= 720,
      glitchLayers: 0,
      retroLayers: 0,
      sliceLayers: 0,
      glyphLayers: 0,
      titleLines: ['LEGENDS OF', 'CODEJITSU'],
      prompt: 'Click or press Enter to start',
      visiblePromptText: true,
      hasCodeLeak: false,
      titleReadable: true,
      calmCover: true,
      coverMode: 'cover',
      titleFx: {
        usesImagegenSkyfallFx: this.textures.exists(TextureKeys.TitleSkyfallFx),
        textureKey: TextureKeys.TitleSkyfallFx,
        primitiveFxPieces: this.titlePrimitiveFxPieces,
        generatedFxPieces: this.titleGeneratedFxPieces,
        panelCount: 4,
        promptUsesImagegenPanel: this.titlePromptUsesImagegenPanel,
        promptPrimitivePieces: this.titlePromptPrimitivePieces,
        startPromptTextureKey: 'text-prompt',
        generatedStaticDecorPieces: this.titleGeneratedStaticDecorPieces,
        primitiveStaticDecorPieces: this.titlePrimitiveStaticDecorPieces,
        usesImagegenVignette: this.titleVignetteUsesImagegen,
        primitiveVignettePieces: this.titlePrimitiveVignettePieces,
        vignetteTextureKey: this.titleVignetteUsesImagegen ? TextureKeys.TitleCinematicVignette : 'fallback-rectangles',
        shadowUsesImagegen: this.titleShadowUsesImagegen,
        primitiveShadowPieces: this.titlePrimitiveShadowPieces,
        skyGateUsesImagegen: this.titleSkyGateUsesImagegen,
        primitiveSkyGatePieces: this.titlePrimitiveSkyGatePieces,
        primitiveSimpleShapeFallbackPieces: this.titlePrimitiveFxPieces +
          this.titlePromptPrimitivePieces +
          this.titlePrimitiveStaticDecorPieces +
          this.titlePrimitiveVignettePieces +
          this.titlePrimitiveShadowPieces +
          this.titlePrimitiveSkyGatePieces,
        generatedOnlyTitleFx: this.titlePrimitiveFxPieces === 0 &&
          this.titlePromptPrimitivePieces === 0 &&
          this.titlePrimitiveStaticDecorPieces === 0 &&
          this.titlePrimitiveVignettePieces === 0 &&
          this.titlePrimitiveShadowPieces === 0 &&
          this.titlePrimitiveSkyGatePieces === 0,
      },
      fallAnimation: {
        mode: 'sky-drop',
        brandedDrop: 'single-title-stack',
        pieces: 1,
        fromY: this.titleFallFromY,
        targetY: this.titleFallTargetY,
        currentY: [Math.round(topY), Math.round(bottomY)],
        complete,
        impact: this.titleImpactPlayed,
        dropOrigin: 'sky',
        motionTrailCount: this.titleMotionTrailCount,
        impactCount: this.titleImpactCount,
        dropDistancePx: this.titleFallTargetY[0] - this.titleFallFromY[0],
        skyHoldMs: isTestMode() ? 0 : 80,
      },
    };
  }
}
