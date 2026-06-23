import Phaser from 'phaser';
import { getAbility } from '../data/abilities';
import { addAdvancePromptSeal } from './advancePromptSeal';
import { addAbilityIcon, publishAbilityArtRuntime } from './abilityVisuals';
import { installAudioUnlock } from './audioUnlock';
import { publishTextPanelAudit } from './layoutAudit';
import { addResultVfx, resultVfxAssetInfo, type ResultVfxKind } from './resultVfx';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, playBoom } from './ui';

interface ResultData {
  outcome: 'win' | 'lose';
  unlock?: string;
  chapter?: number;
  bossId?: string;
  deathReason?: string;
  retryScene?: string;
  retryData?: object;
}

interface ResultBackdropRuntime {
  usesGeneratedBackdrop: boolean;
  textureKey: string;
  coverWidth: number;
  coverHeight: number;
  usesImagegenAtmosphereOverlay: boolean;
  primitiveBackdropShadePieces: number;
  atmosphereTextureKey: string;
}

interface ResultMotionRuntime {
  animated: boolean;
  ringCount: number;
  particleCount: number;
  codeGlyphCount: number;
  usesImagegenAmbientMotes: boolean;
  ambientMoteCount: number;
  primitiveAmbientMotePieces: number;
  usesGeneratedVfx: boolean;
  generatedVfxPieces: number;
  primitiveMotionPieces: number;
  vfxTextureKey: string;
  vfxFrameCount: number;
  vfxSourceWidth: number;
  vfxSourceHeight: number;
}

interface ResultPanelRuntime {
  usesImagegenPanel: boolean;
  primitivePanelPieces: number;
  panelKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResultWarningSigilRuntime {
  usesImagegenWarningSigil: boolean;
  primitiveWarningSigilPieces: number;
  warningSigilKey: string;
  warningSigilFrame: string;
}

const RESULT_PANEL_RECT = new Phaser.Geom.Rectangle(150, 118, 980, 440);

export class ResultScene extends Phaser.Scene {
  private resultData?: ResultData;

  constructor() {
    super(SceneKeys.Result);
  }

  init(data: ResultData): void {
    this.resultData = data;
  }

  create(): void {
    const outcome = this.resultData?.outcome ?? 'lose';
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = outcome === 'win' ? 'win' : 'lose';
    installAudioUnlock(this);
    this.cameras.main.setBackgroundColor(outcome === 'win' ? '#0f1410' : '#15080d');
    const backdrop = this.addResultBackdrop(outcome);
    const motion = this.addResultMotion(outcome);
    const panel = this.addResultPanel(outcome);
    if (outcome === 'win') {
      playBoom(this, 0.9);
      const ability = this.resultData?.unlock ? getAbility(this.resultData.unlock) : undefined;
      const chapter = this.resultData?.chapter ?? 1;
      publishAbilityArtRuntime(this);
      const abilityId = ability?.id ?? 'try-catch';
      const icon = addAbilityIcon(this, 386, 350, abilityId, 92, 22);
      if (icon) {
        this.tweens.add({
          targets: icon,
          scaleX: 1.06,
          scaleY: 1.06,
          alpha: { from: 0.88, to: 1 },
          duration: 680,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
      const title = makePixelText(this, 790, 248, chapter === 1 ? 'First Mask Broken' : 'Loop Severed', 38, '#f0c36b', 'center').setOrigin(0.5).setDepth(22);
      const unlock = makePixelText(this, 742, 316, ability?.displayName ?? 'try.catch', 25, '#f6ead3', 'center').setOrigin(0.5).setDepth(22);
      const description = makePixelText(
        this,
        740,
        400,
        'A vow answers in your hand.',
        19,
        '#cdbdcb',
        'center',
      )
        .setOrigin(0.5)
        .setWordWrapWidth(372)
        .setDepth(22);
      const prompt = addAdvancePromptSeal(this, 'confirm', 790, 602, {
        sceneId: 'result-win',
        width: 92,
        height: 46,
        depth: 22,
      });
      publishTextPanelAudit('result-win', new Phaser.Geom.Rectangle(248, 154, 784, 392), [
        { id: 'title', object: title },
        { id: 'icon', object: icon },
        { id: 'unlock', object: unlock },
        { id: 'description', object: description },
        ...(prompt ? [{ id: 'advance-seal', object: prompt, allowOutside: true }] : []),
      ], 14);
      (window as Window & {
        __CODEJITSU_RESULT_ABILITY_ART?: {
          abilityId: string;
          usesGeneratedIcon: boolean;
          chapter: number;
          usesImagegenBackdrop: boolean;
          usesGeneratedVfx: boolean;
          generatedVfxPieces: number;
          primitiveMotionPieces: number;
          animated: boolean;
          usesImagegenPanel: boolean;
          at: number;
        };
      }).__CODEJITSU_RESULT_ABILITY_ART = {
        abilityId,
        usesGeneratedIcon: Boolean(icon),
        chapter,
        usesImagegenBackdrop: backdrop.usesGeneratedBackdrop,
        usesGeneratedVfx: motion.usesGeneratedVfx,
        generatedVfxPieces: motion.generatedVfxPieces,
        primitiveMotionPieces: motion.primitiveMotionPieces,
        animated: motion.animated,
        usesImagegenPanel: panel.usesImagegenPanel,
        at: Math.round(performance.now()),
      };
      this.publishResultRuntime(outcome, chapter, backdrop, motion, panel);
      const nextScene = chapter === 1 ? SceneKeys.Chapter2Story : SceneKeys.Title;
      this.input.keyboard?.once('keydown-ENTER', () => this.scene.start(nextScene));
      this.input.once('pointerdown', () => this.scene.start(nextScene));
      return;
    }

    const chapter = this.resultData?.chapter ?? 1;
    const reason = this.resultData?.deathReason ?? (chapter === 2 ? 'The loop caught your rhythm.' : 'The null mask broke your guard.');
    const warningSigil = this.addDeathWarningSigil();
    const title = makePixelText(this, 640, 274, chapter === 2 ? 'Loop Rewound' : 'Mask Reformed', 40, '#d64f45', 'center').setOrigin(0.5).setDepth(22);
    const body = makePixelText(this, 640, 340, 'Breathe. Read the mask.', 23, '#f6ead3', 'center')
      .setOrigin(0.5)
      .setWordWrapWidth(640)
      .setDepth(22);
    const prompt = addAdvancePromptSeal(this, 'retry', 640, 602, {
      sceneId: 'result-lose',
      width: 94,
      height: 47,
      depth: 22,
    });
    this.tweens.add({
      targets: prompt ? [title, prompt] : [title],
      alpha: { from: 0.72, to: 1 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    publishTextPanelAudit('result-lose', new Phaser.Geom.Rectangle(248, 154, 784, 392), [
      { id: 'title', object: title },
      { id: 'body', object: body },
      ...(prompt ? [{ id: 'advance-seal', object: prompt, allowOutside: true }] : []),
    ], 14);
    (window as Window & {
      __CODEJITSU_DEATH_SCREEN?: {
        chapter: number;
        reason: string;
        clickToRetry: boolean;
        retryScene: string;
        usesImagegenBackdrop: boolean;
        backdropKey: string;
        animated: boolean;
        ringCount: number;
        particleCount: number;
        usesGeneratedVfx: boolean;
        generatedVfxPieces: number;
        primitiveMotionPieces: number;
        usesImagegenPanel: boolean;
        usesImagegenAtmosphereOverlay: boolean;
        primitiveBackdropShadePieces: number;
        usesImagegenWarningSigil: boolean;
        primitiveWarningSigilPieces: number;
        at: number;
      };
      }).__CODEJITSU_DEATH_SCREEN = {
      chapter,
      reason,
      clickToRetry: true,
      retryScene: this.resultData?.retryScene ?? SceneKeys.Boss,
      usesImagegenBackdrop: backdrop.usesGeneratedBackdrop,
      backdropKey: backdrop.textureKey,
      animated: motion.animated,
      ringCount: motion.ringCount,
      particleCount: motion.particleCount,
      usesGeneratedVfx: motion.usesGeneratedVfx,
      generatedVfxPieces: motion.generatedVfxPieces,
      primitiveMotionPieces: motion.primitiveMotionPieces,
      usesImagegenPanel: panel.usesImagegenPanel,
      usesImagegenAtmosphereOverlay: backdrop.usesImagegenAtmosphereOverlay,
      primitiveBackdropShadePieces: backdrop.primitiveBackdropShadePieces,
      usesImagegenWarningSigil: warningSigil.usesImagegenWarningSigil,
      primitiveWarningSigilPieces: warningSigil.primitiveWarningSigilPieces,
      at: Math.round(performance.now()),
    };
    this.publishResultRuntime(outcome, chapter, backdrop, motion, panel, warningSigil);
    const retryScene = this.resultData?.retryScene ?? SceneKeys.Boss;
    const retryBaseData = (this.resultData?.retryData ?? { bossId: this.resultData?.bossId ?? 'null-oni' }) as Record<string, unknown>;
    const retryData = {
      ...retryBaseData,
      retryFromDeath: true,
      retryChapter: chapter,
    };
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start(retryScene, retryData));
    this.input.once('pointerdown', () => this.scene.start(retryScene, retryData));
  }

  private addDeathWarningSigil(): ResultWarningSigilRuntime {
    if (!this.textures.exists(TextureKeys.WarningSigils)) {
      return {
        usesImagegenWarningSigil: false,
        primitiveWarningSigilPieces: 0,
        warningSigilKey: 'missing-warning-sigils',
        warningSigilFrame: 'none',
      };
    }

    const frameName = this.ensureWarningSigilFrame('cracked-mask', 0, 512, 512, 512);
    const sigil = this.add.image(640, 232, TextureKeys.WarningSigils, frameName)
      .setDisplaySize(156, 156)
      .setAlpha(0.42)
      .setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setData('usesImagegenWarningSigil', true);
    this.tweens.add({
      targets: sigil,
      alpha: { from: 0.28, to: 0.5 },
      scaleX: sigil.scaleX * 1.08,
      scaleY: sigil.scaleY * 1.08,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return {
      usesImagegenWarningSigil: true,
      primitiveWarningSigilPieces: 0,
      warningSigilKey: TextureKeys.WarningSigils,
      warningSigilFrame: frameName,
    };
  }

  private ensureWarningSigilFrame(frameName: string, x: number, y: number, width: number, height: number): string {
    const texture = this.textures.get(TextureKeys.WarningSigils) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
      add?: (name: string, sourceIndex: number, x: number, y: number, width: number, height: number) => Phaser.Textures.Frame;
    };
    if (!texture.has?.(frameName)) {
      texture.add?.(frameName, 0, x, y, width, height);
    }
    return frameName;
  }

  private addResultBackdrop(outcome: 'win' | 'lose'): ResultBackdropRuntime {
    const preferredTexture = outcome === 'win' ? TextureKeys.ResultVictoryBackdrop : TextureKeys.ResultDeathBackdrop;
    const textureKey = this.textures.exists(preferredTexture)
      ? preferredTexture
      : TextureKeys.ResultBackdrop;
    if (this.textures.exists(textureKey)) {
      const source = this.textures.get(textureKey).getSourceImage() as { width?: number; height?: number };
      const sourceWidth = Number(source.width ?? 1280);
      const sourceHeight = Number(source.height ?? 720);
      const scale = Math.max(1280 / sourceWidth, 720 / sourceHeight);
      const coverWidth = Math.ceil(sourceWidth * scale);
      const coverHeight = Math.ceil(sourceHeight * scale);
      const backdrop = this.add.image(640, 360, textureKey)
        .setDisplaySize(coverWidth, coverHeight)
        .setDepth(-30)
        .setAlpha(0.96);
      const overlay = this.addResultAtmosphereOverlay();
      this.tweens.add({
        targets: backdrop,
        scaleX: backdrop.scaleX * 1.018,
        scaleY: backdrop.scaleY * 1.018,
        x: outcome === 'win' ? 634 : 646,
        duration: 5200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      return {
        usesGeneratedBackdrop: true,
        textureKey,
        coverWidth,
        coverHeight,
        usesImagegenAtmosphereOverlay: overlay.usesImagegenAtmosphereOverlay,
        primitiveBackdropShadePieces: overlay.primitiveBackdropShadePieces,
        atmosphereTextureKey: overlay.atmosphereTextureKey,
      };
    }

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 12; col += 1) {
        this.add.image(110 + col * 88 + row * 44, 280 + row * 30, TextureKeys.FloorTile).setAlpha(0.56).setDepth(-30);
      }
    }
    return {
      usesGeneratedBackdrop: false,
      textureKey: 'fallback-floor-tile',
      coverWidth: 1280,
      coverHeight: 720,
      usesImagegenAtmosphereOverlay: false,
      primitiveBackdropShadePieces: 0,
      atmosphereTextureKey: 'none',
    };
  }

  private addResultAtmosphereOverlay(): Pick<ResultBackdropRuntime, 'usesImagegenAtmosphereOverlay' | 'primitiveBackdropShadePieces' | 'atmosphereTextureKey'> {
    if (this.textures.exists(TextureKeys.ResultAtmosphereOverlay)) {
      const source = this.textures.get(TextureKeys.ResultAtmosphereOverlay).getSourceImage() as { width?: number; height?: number };
      const scale = Math.max(1280 / Number(source.width ?? 1280), 720 / Number(source.height ?? 720));
      this.add.image(640, 360, TextureKeys.ResultAtmosphereOverlay)
        .setScale(scale)
        .setDepth(-20)
        .setAlpha(0.7)
        .setData('usesImagegenResultAtmosphere', true);
      return {
        usesImagegenAtmosphereOverlay: true,
        primitiveBackdropShadePieces: 0,
        atmosphereTextureKey: TextureKeys.ResultAtmosphereOverlay,
      };
    }

    this.add.rectangle(640, 360, 1280, 720, 0x09070d, 0.18).setDepth(-20);
    return {
      usesImagegenAtmosphereOverlay: false,
      primitiveBackdropShadePieces: 1,
      atmosphereTextureKey: 'fallback-rectangle',
    };
  }

  private addResultMotion(outcome: 'win' | 'lose'): ResultMotionRuntime {
    const vowColor = outcome === 'win' ? 0xf0c36b : 0xd64f45;
    const accentColor = outcome === 'win' ? 0x90d2b7 : 0xb85dff;
    const vfxInfo = resultVfxAssetInfo(this);
    let generatedVfxPieces = 0;
    let primitiveMotionPieces = 0;
    let ambientMoteCount = 0;
    let primitiveAmbientMotePieces = 0;
    const ringCount = 5;
    const particleCount = 26;
    const ringKinds: ResultVfxKind[] = outcome === 'win'
      ? ['victory-ring', 'return-seam', 'archive-motes']
      : ['retry-seal', 'null-smoke', 'mask-shards'];
    const particleKinds: ResultVfxKind[] = outcome === 'win'
      ? ['gold-sparks', 'archive-motes', 'return-seam']
      : ['ember-burst', 'mask-shards', 'null-smoke'];

    for (let index = 0; index < ringCount; index += 1) {
      const ring = addResultVfx(this, ringKinds[index % ringKinds.length], 640, 390 + index * 3, {
        width: 244 + index * 82,
        height: 126 + index * 28,
        depth: 4,
        alpha: 0.34,
        tint: index % 2 === 0 ? vowColor : accentColor,
      }) ?? this.add.ellipse(640, 390, 190 + index * 62, 52 + index * 15)
        .setStrokeStyle(2, index % 2 === 0 ? vowColor : accentColor, 0.18)
        .setDepth(4)
        .setAlpha(0.35);
      if (ring.getData('usesGeneratedResultVfx')) generatedVfxPieces += 1;
      else primitiveMotionPieces += 1;
      this.tweens.add({
        targets: ring,
        scaleX: 1.2,
        scaleY: 1.28,
        alpha: 0.03,
        delay: index * 120,
        duration: 1300 + index * 110,
        repeat: -1,
        ease: 'Sine.Out',
      });
    }

    for (let index = 0; index < particleCount; index += 1) {
      const x = Phaser.Math.Between(120, 1180);
      const y = Phaser.Math.Between(110, 620);
      const particle = addResultVfx(this, particleKinds[index % particleKinds.length], x, y, {
        width: Phaser.Math.Between(34, 74),
        height: Phaser.Math.Between(40, 84),
        depth: 5,
        alpha: 0.22,
        tint: index % 2 === 0 ? vowColor : accentColor,
        rotation: Phaser.Math.FloatBetween(-0.18, 0.18),
      }) ?? this.add.rectangle(x, y, Phaser.Math.Between(3, 7), Phaser.Math.Between(10, 28), index % 2 === 0 ? vowColor : accentColor, 0.18)
        .setDepth(5)
        .setRotation(Phaser.Math.FloatBetween(-0.18, 0.18));
      if (particle.getData('usesGeneratedResultVfx')) generatedVfxPieces += 1;
      else primitiveMotionPieces += 1;
      this.tweens.add({
        targets: particle,
        y: y - Phaser.Math.Between(24, 80),
        alpha: { from: 0.08, to: 0.38 },
        delay: index * 38,
        duration: Phaser.Math.Between(900, 1600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    const ambientSlots = outcome === 'win'
      ? [
        { x: 230, y: 134, frame: 0, tint: 0xf0c36b },
        { x: 390, y: 210, frame: 1, tint: 0xbda3ff },
        { x: 852, y: 286, frame: 2, tint: 0x90d2b7 },
        { x: 990, y: 360, frame: 3, tint: 0xb85dff },
      ]
      : [];
    ambientSlots.forEach((slot, index) => {
      const mote = this.addResultAmbientMote(slot.x, slot.y, slot.frame, slot.tint);
      if (mote?.getData('usesImagegenAmbientMote')) ambientMoteCount += 1;
      else primitiveAmbientMotePieces += 1;
      this.tweens.add({
        targets: mote,
        y: slot.y + (index % 2 === 0 ? -18 : 18),
        alpha: { from: 0.18, to: 0.52 },
        duration: 1400 + index * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    });

    return {
      animated: true,
      ringCount,
      particleCount,
      codeGlyphCount: 0,
      usesImagegenAmbientMotes: outcome === 'win' && ambientMoteCount === ambientSlots.length && ambientMoteCount > 0,
      ambientMoteCount,
      primitiveAmbientMotePieces,
      usesGeneratedVfx: vfxInfo.textureLoaded && generatedVfxPieces > 0,
      generatedVfxPieces,
      primitiveMotionPieces: primitiveMotionPieces + primitiveAmbientMotePieces,
      vfxTextureKey: vfxInfo.textureKey,
      vfxFrameCount: vfxInfo.frameCount,
      vfxSourceWidth: vfxInfo.sourceWidth,
      vfxSourceHeight: vfxInfo.sourceHeight,
    };
  }

  private addResultAmbientMote(x: number, y: number, frameIndex: number, tint: number): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    if (this.textures.exists(TextureKeys.ResultAmbientMotes)) {
      const frame = this.ensureResultAmbientMoteFrame(frameIndex);
      return this.add.image(x, y, TextureKeys.ResultAmbientMotes, frame)
        .setDisplaySize(126, 112)
        .setDepth(6)
        .setAlpha(0.34)
        .setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setData('usesImagegenAmbientMote', true)
        .setData('ambientMoteFrameIndex', frameIndex);
    }
    return this.add.ellipse(x, y, 48, 26, tint, 0.16)
      .setDepth(6)
      .setAlpha(0.34);
  }

  private ensureResultAmbientMoteFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.ResultAmbientMotes) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
    const frameName = `result-ambient-mote-${safeFrame}`;
    if (texture.has?.(frameName)) return frameName;
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor(Number(source.width ?? 1983) / 4);
    const frameHeight = Number(source.height ?? 793);
    texture.add(frameName, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
    return frameName;
  }

  private addResultPanel(outcome: 'win' | 'lose'): ResultPanelRuntime {
    const rect = RESULT_PANEL_RECT;
    if (this.textures.exists(TextureKeys.ResultPanel)) {
      const panel = this.add.image(rect.centerX, rect.centerY, TextureKeys.ResultPanel)
        .setDisplaySize(rect.width, rect.height)
        .setDepth(20)
        .setAlpha(outcome === 'win' ? 0.96 : 0.98);
      panel.setData('usesImagegenPanel', true);
      this.tweens.add({
        targets: panel,
        alpha: outcome === 'win' ? { from: 0.88, to: 0.98 } : { from: 0.92, to: 1 },
        scaleX: panel.scaleX * 1.006,
        scaleY: panel.scaleY * 1.006,
        duration: outcome === 'win' ? 1420 : 1180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      return {
        usesImagegenPanel: true,
        primitivePanelPieces: 0,
        panelKey: TextureKeys.ResultPanel,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }

    addPanel(this, 248, 154, 784, 392, 0.88).setDepth(20);
    return {
      usesImagegenPanel: false,
      primitivePanelPieces: 1,
      panelKey: 'fallback-panel',
      x: 248,
      y: 154,
      width: 784,
      height: 392,
    };
  }

  private publishResultRuntime(
    outcome: 'win' | 'lose',
    chapter: number,
    backdrop: ResultBackdropRuntime,
    motion: ResultMotionRuntime,
    panel: ResultPanelRuntime,
    warningSigil: ResultWarningSigilRuntime = {
      usesImagegenWarningSigil: false,
      primitiveWarningSigilPieces: 0,
      warningSigilKey: 'none',
      warningSigilFrame: 'none',
    },
  ): void {
    (window as Window & {
      __CODEJITSU_RESULT_SCENE?: {
        outcome: 'win' | 'lose';
        chapter: number;
        usesImagegenBackdrop: boolean;
        backdropKey: string;
        coverWidth: number;
        coverHeight: number;
        coversCanvas: boolean;
        usesImagegenAtmosphereOverlay: boolean;
        primitiveBackdropShadePieces: number;
        atmosphereTextureKey: string;
        animated: boolean;
        ringCount: number;
        particleCount: number;
        codeGlyphCount: number;
        usesImagegenAmbientMotes: boolean;
        ambientMoteCount: number;
        primitiveAmbientMotePieces: number;
        usesGeneratedVfx: boolean;
        generatedVfxPieces: number;
        primitiveMotionPieces: number;
        vfxTextureKey: string;
        vfxFrameCount: number;
        vfxSourceWidth: number;
        vfxSourceHeight: number;
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        panelKey: string;
        panelWidth: number;
        panelHeight: number;
        usesImagegenWarningSigil: boolean;
        primitiveWarningSigilPieces: number;
        warningSigilKey: string;
        warningSigilFrame: string;
        at: number;
      };
    }).__CODEJITSU_RESULT_SCENE = {
      outcome,
      chapter,
      usesImagegenBackdrop: backdrop.usesGeneratedBackdrop,
      backdropKey: backdrop.textureKey,
      coverWidth: backdrop.coverWidth,
      coverHeight: backdrop.coverHeight,
      coversCanvas: backdrop.coverWidth >= 1280 && backdrop.coverHeight >= 720,
      usesImagegenAtmosphereOverlay: backdrop.usesImagegenAtmosphereOverlay,
      primitiveBackdropShadePieces: backdrop.primitiveBackdropShadePieces,
      atmosphereTextureKey: backdrop.atmosphereTextureKey,
      animated: motion.animated,
      ringCount: motion.ringCount,
      particleCount: motion.particleCount,
      codeGlyphCount: motion.codeGlyphCount,
      usesImagegenAmbientMotes: motion.usesImagegenAmbientMotes,
      ambientMoteCount: motion.ambientMoteCount,
      primitiveAmbientMotePieces: motion.primitiveAmbientMotePieces,
      usesGeneratedVfx: motion.usesGeneratedVfx,
      generatedVfxPieces: motion.generatedVfxPieces,
      primitiveMotionPieces: motion.primitiveMotionPieces,
      vfxTextureKey: motion.vfxTextureKey,
      vfxFrameCount: motion.vfxFrameCount,
      vfxSourceWidth: motion.vfxSourceWidth,
      vfxSourceHeight: motion.vfxSourceHeight,
      usesImagegenPanel: panel.usesImagegenPanel,
      primitivePanelPieces: panel.primitivePanelPieces,
      panelKey: panel.panelKey,
      panelWidth: panel.width,
      panelHeight: panel.height,
      usesImagegenWarningSigil: warningSigil.usesImagegenWarningSigil,
      primitiveWarningSigilPieces: warningSigil.primitiveWarningSigilPieces,
      warningSigilKey: warningSigil.warningSigilKey,
      warningSigilFrame: warningSigil.warningSigilFrame,
      at: Math.round(performance.now()),
    };
    (window as Window & {
      __CODEJITSU_RESULT_PANEL_VISUAL?: ResultPanelRuntime & {
        outcome: 'win' | 'lose';
        chapter: number;
        at: number;
      };
    }).__CODEJITSU_RESULT_PANEL_VISUAL = {
      ...panel,
      outcome,
      chapter,
      at: Math.round(performance.now()),
    };
  }
}
